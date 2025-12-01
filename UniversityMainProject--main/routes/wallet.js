// routes/wallet.js
const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware");
const User = require("../models/user");
const Listing = require("../models/listing");
const Order = require("../models/order");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY is missing. Set it in .env");
}
const stripe = require("stripe")(STRIPE_SECRET_KEY);

/**
 * Helper: compute the amount a buyer should pay for a listing.
 * - If auction is active and there's a currentBid > 0, prefer currentBid.
 * - Otherwise use listing.price.
 */
function computeListingAmount(listing) {
  // listing could be a Mongoose doc or plain object
  const currentBid = Number(listing.currentBid || 0);
  const price = Number(listing.price || 0);
  // If auction is active and currentBid > 0, use that
  const now = new Date();
  const startTime = listing.startTime ? new Date(listing.startTime) : null;
  const endTime = listing.endTime ? new Date(listing.endTime) : null;
  const isAuctionActive = startTime && endTime && now >= startTime && now <= endTime;
  if (isAuctionActive && currentBid > 0) return currentBid;
  return price;
}

// 🪙 Show wallet page
router.get("/", isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.render("wallet/index.ejs", {
      user,
      success: req.query.success,
      cancelled: req.query.cancelled,
    });
  } catch (err) {
    console.error("Error rendering wallet page:", err);
    res.status(500).send("Server error");
  }
});

// 🔹 Lightweight balance endpoint for navbar badge
router.get("/balance", isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("walletBalance");
    res.json({ balance: user?.walletBalance || 0 });
  } catch (err) {
    console.error("Error fetching wallet balance:", err);
    res.json({ balance: 0 });
  }
});

// ➕ Create Stripe Checkout session for wallet top-up
router.post("/topup", isLoggedIn, async (req, res) => {
  try {
    const raw = Number(req.body.amount);
    const amount = Math.max(1, Math.floor(isNaN(raw) ? 0 : raw)); // INR (whole number)

    if (!amount) {
      return res.status(400).json({ error: "Enter a valid amount (₹)" });
    }

    const sessionPayload = {
      mode: "payment",
      // ⚠️ Keep card only unless you've enabled other methods in Stripe Dashboard
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: { name: "Wallet Top-up" },
            unit_amount: amount * 100, // paise
          },
          quantity: 1,
        },
      ],
      success_url: `${req.protocol}://${req.get("host")}/wallet?success=1`,
      cancel_url: `${req.protocol}://${req.get("host")}/wallet?cancelled=1`,
      metadata: {
        purpose: "wallet_topup",
        userId: req.user._id.toString(),
        amount: String(amount),
      },
    };

    // Optional: attach email if available
    if (req.user?.email) sessionPayload.customer_email = req.user.email;

    const session = await stripe.checkout.sessions.create(sessionPayload);
    return res.json({ url: session.url });
  } catch (e) {
    console.error("Top-up session error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Unable to create top-up session" });
  }
});

/**
 * POST /wallet/purchase
 * Body: { listingId }
 *
 * Flow:
 *  - Validate listing exists and not already sold
 *  - Compute amount to pay (currentBid if auction active else price)
 *  - Atomically deduct wallet balance from user (findOneAndUpdate with $gte)
 *  - Create an Order record (status 'paid' tentatively)
 *  - Attempt Listing.markSoldIfAvailable(...)
 *     - if success: return success
 *     - if fail (already sold): refund wallet (re-inc balance) and update order status to refunded
 */
router.post("/purchase", isLoggedIn, async (req, res) => {
  try {
    const buyerId = req.user._id;
    const { listingId } = req.body;
    if (!listingId) return res.status(400).json({ error: "Missing listingId" });

    // Get listing
    const listing = await Listing.findById(listingId).exec();
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    if (listing.sold) {
      return res.status(409).json({ error: "Listing already sold" });
    }

    // Compute amount
    const amount = computeListingAmount(listing);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid listing amount" });
    }

    // Atomically deduct wallet balance from user
    const buyerAfterDeduct = await User.findOneAndUpdate(
      { _id: buyerId, walletBalance: { $gte: amount } },
      { $inc: { walletBalance: -amount } },
      { new: true }
    ).exec();

    if (!buyerAfterDeduct) {
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    // Create order snapshot (tentative success)
    const itemSnapshot = {
      listing: listing._id,
      title: listing.title,
      image: listing.image || "/images/default-listing.jpg",
      price: amount,
      quantity: 1,
    };

    const newOrder = new Order({
      buyer: buyerId,
      items: [itemSnapshot],
      payment: {
        provider: "wallet",
        providerPaymentId: `wallet_${Date.now()}_${buyerId}`,
        method: "wallet",
        status: "succeeded",
        raw: null,
      },
      subtotal: amount,
      shippingCost: 0,
      total: amount,
      status: "paid",
      seller: listing.owner || null,
    });

    await newOrder.save();

    // Attempt to atomically mark listing sold
    try {
      const paymentInfoForListing = {
        provider: "wallet",
        providerPaymentId: newOrder.payment.providerPaymentId,
        amount,
        raw: { orderId: newOrder._id.toString() },
      };

      const updatedListing = await Listing.markSoldIfAvailable(
        listingId,
        buyerId,
        paymentInfoForListing
      );

      if (!updatedListing) {
        // Already sold — refund wallet and update order
        console.warn(`Listing ${listingId} already sold; refunding buyer ${buyerId}`);

        try {
          const refundResult = await User.findByIdAndUpdate(
            buyerId,
            { $inc: { walletBalance: amount } },
            { new: true }
          ).exec();

          newOrder.status = "refunded";
          newOrder.refund = {
            method: "wallet",
            amount_refunded: amount,
            refundedAt: new Date(),
          };

          await newOrder.save();

          console.log(`🔁 Wallet refund completed for user ${buyerId} (₹${amount})`);
          return res.status(409).json({ error: "Listing already sold. Wallet refunded." });
        } catch (refundErr) {
          // Refund failed — flag order for manual review
          console.error("Wallet refund failed:", refundErr);
          newOrder.status = "refund_failed";
          newOrder.refund = {
            method: "wallet",
            amount_refunded: 0,
            error: refundErr.message,
            attemptedAt: new Date(),
          };
          await newOrder.save();

          return res.status(500).json({
            error:
              "Listing already sold. Automatic refund failed — your wallet will be reviewed by support.",
          });
        }
      } else {
        // Success
        console.log(
          `✅ Wallet purchase succeeded: listing ${listingId} marked sold to ${buyerId} (order ${newOrder._id})`
        );
        return res.json({ success: true, orderId: newOrder._id, listing: updatedListing });
      }
    } catch (markErr) {
      console.error("Error marking listing sold after wallet deduct:", markErr);

      // Try to refund buyer to avoid lost funds
      try {
        await User.findByIdAndUpdate(buyerId, { $inc: { walletBalance: amount } }).exec();

        newOrder.status = "failed";
        newOrder.failureReason = `Error marking listing sold: ${markErr.message}`;
        await newOrder.save();

        return res.status(500).json({
          error: "Purchase failed during finalization; wallet refunded.",
        });
      } catch (refundErr2) {
        // Hard failure — listing not marked sold, and refund also failed.
        newOrder.status = "failed_refund_failed";
        newOrder.failureReason = `Mark error: ${markErr.message}; refund error: ${refundErr2.message}`;
        await newOrder.save();

        console.error("Critical: refund after mark error also failed:", refundErr2);
        return res.status(500).json({
          error:
            "Purchase failed and automatic refund failed. Please contact support — funds may be in an inconsistent state.",
        });
      }
    }
  } catch (err) {
    console.error("Wallet purchase error:", err);
    return res.status(500).json({ error: "Server error processing wallet purchase" });
  }
});

module.exports = router;
