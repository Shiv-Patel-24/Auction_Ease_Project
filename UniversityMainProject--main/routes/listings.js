// routes/listings.js
const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");
const User = require("../models/user");
const Order = require("../models/order");
const { isLoggedIn } = require("../middleware");

// Stripe integration
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

if (!stripeSecretKey || !stripePublishableKey) {
  throw new Error("❌ Stripe keys missing in environment variables. Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to your .env file.");
}
const stripe = require("stripe")(stripeSecretKey);

/* =========================
   Helpers
   ========================= */
function isAuctionActiveFor(l) {
  if (!l) return false;
  const now = new Date();
  const start = l.startTime ? new Date(l.startTime) : null;
  const end = l.endTime ? new Date(l.endTime) : null;
  if (!start || !end) return false;
  return now >= start && now <= end;
}

function currentPriceToShowFor(l) {
  // during auction show currentBid if > 0 otherwise starting price
  if (isAuctionActiveFor(l)) {
    return (l.currentBid && l.currentBid > 0) ? l.currentBid : (l.price || 0);
  }
  return l.price || 0;
}

/* =========================
   All Listings (decorated)
   ========================= */
router.get("/", async (req, res) => {
  try {
    // fetch full documents (not lean) so virtuals/refs work if you rely on them; but
    // we decorate manually and pass to view.
    const allListings = await Listing.find().populate("owner").exec();

    const decorated = allListings.map(l => {
      const raw = l.toObject ? l.toObject() : l;
      const isAuctionActive = isAuctionActiveFor(raw);
      const currentPriceToShow = currentPriceToShowFor(raw);
      return {
        ...raw,
        isAuctionActive,
        currentPriceToShow,
      };
    });

    res.render("listings/index", { allListings: decorated });
  } catch (err) {
    console.error("List all error:", err);
    res.status(500).send("Internal Server Error");
  }
});

/* =========================
   New listing form
   ========================= */
router.get("/new", isLoggedIn, (req, res) => {
  res.render("listings/new");
});

/* =========================
   Create new listing
   ========================= */
router.post("/", isLoggedIn, async (req, res) => {
  try {
    const { listing } = req.body;

    const newListing = new Listing({
      ...listing,
      owner: req.user._id,
      startTime: listing.startTime ? new Date(listing.startTime) : listing.startTime,
      endTime: listing.endTime ? new Date(listing.endTime) : listing.endTime,
    });

    await newListing.save();
    req.flash("success", "New listing created!");
    res.redirect(`/listings/${newListing._id}`);
  } catch (err) {
    console.error("Create listing error:", err);
    req.flash("error", "Failed to create listing.");
    res.redirect("/listings/new");
  }
});

/* =========================
   Edit form
   ========================= */
router.get("/:id/edit", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }
  res.render("listings/edit", { listing });
});

/* =========================
   Update listing
   ========================= */
router.put("/:id", isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body.listing,
      startTime: req.body.listing.startTime ? new Date(req.body.listing.startTime) : req.body.listing.startTime,
      endTime: req.body.listing.endTime ? new Date(req.body.listing.endTime) : req.body.listing.endTime,
    };

    await Listing.findByIdAndUpdate(id, updateData);
    req.flash("success", "Listing updated!");
    res.redirect(`/listings/${id}`);
  } catch (err) {
    console.error("Update listing error:", err);
    req.flash("error", "Failed to update listing.");
    res.redirect(`/listings/${req.params.id}/edit`);
  }
});

/* =========================
   Delete listing
   ========================= */
router.delete("/:id", isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing deleted!");
    res.redirect("/listings");
  } catch (err) {
    console.error("Delete listing error:", err);
    req.flash("error", "Failed to delete listing.");
    res.redirect("/listings");
  }
});

/* =========================
   Show single listing
   (populates owner)
   ========================= */
router.get("/:id", isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate("owner");

    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    const isAuctionActive = isAuctionActiveFor(listing);
    const currentPriceToShow = currentPriceToShowFor(listing);

    /**
     * --- NEW: flash message when the winner hasn't completed payment ---
     *
     * We try to detect the winner using a few common field names (winner, highestBidder, buyer, soldTo).
     * Then check whether the listing appears paid using common flags (isPaid, paid) or presence of
     * payment/paymentInfo objects. If the current logged-in user is the winner and payment is not complete,
     * set an "error" flash that the view will display.
     *
     * This is intentionally robust to different naming conventions in the model.
     */
    try {
      // Determine winner id from common fields
      let winnerId = null;
      if (listing.winner) winnerId = listing.winner;
      else if (listing.highestBidder) winnerId = listing.highestBidder;
      else if (listing.buyer) winnerId = listing.buyer;
      else if (listing.soldTo) winnerId = listing.soldTo;
      else if (listing.buyerId) winnerId = listing.buyerId;

      if (winnerId && typeof winnerId !== "string") {
        // If it's an ObjectId or object, cast to string
        try { winnerId = String(winnerId); } catch (e) {}
      }

      // Determine if listing is paid using common fields
      let isPaid = false;
      if (listing.isPaid || listing.paid) isPaid = true;
      else if (listing.payment && (listing.payment.status === "succeeded" || listing.payment.status === "paid")) isPaid = true;
      else if (listing.paymentInfo) isPaid = true;
      else if (listing.auctionProcessed && listing.status === "paid") isPaid = true;

      // If current user is the winner AND listing not paid -> flash error
      if (req.user && winnerId && String(req.user._id) === String(winnerId) && !isPaid) {
        req.flash("error", "Payment not completed. Please complete your payment.");
      }
    } catch (e) {
      // Non-fatal; do not block rendering if detection fails
      console.warn("Payment/winner detection check failed:", e && e.message ? e.message : e);
    }

    res.render("listings/show", {
      listing,
      currUser: req.user,
      stripePublishableKey,
      isAuctionActive,
      currentPriceToShow,
    });
  } catch (err) {
    console.error("Show listing error:", err);
    req.flash("error", "Error loading listing.");
    res.redirect("/listings");
  }
});

/* =========================
   Stripe Checkout: Buy Now (legacy route)
   - Prevent checkout for auction-active listings
   ========================= */
router.post("/:id/create-checkout-session", isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
      return res.status(404).send("Listing not found");
    }

    // disallow direct purchases while auction is active
    if (isAuctionActiveFor(listing)) {
      req.flash("error", "Bidding in progress — direct purchases are disabled until auction ends.");
      return res.redirect(`/listings/${id}`);
    }

    const sessionPayload = {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: { name: listing.title, description: listing.description },
            unit_amount: (listing.price || 0) * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.protocol}://${req.get("host")}/listings/${listing._id}?success=true`,
      cancel_url: `${req.protocol}://${req.get("host")}/listings/${listing._id}?cancelled=true`,
      metadata: {
        purpose: "listing_purchase",
        listingId: listing._id.toString(),
        amount: ((listing.price || 0)).toString()
      }
    };

    // attach customer email if available to help webhook identify user
    if (req.user?.email) {
      sessionPayload.customer_email = req.user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);

    res.redirect(303, session.url);
  } catch (err) {
    console.error("Stripe Checkout Error:", err.message);
    res.status(500).send("Payment session creation failed");
  }
});

/* =========================
   Bid on listing (auction)
   - atomic update to avoid race conditions
   - returns JSON
   - emits socket event to listing room with bidder name + amount for flash
   ========================= */
router.post("/:id/bid", isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const newBid = Math.max(0, Number(req.body.amount || 0));

    if (!newBid || newBid <= 0) {
      return res.status(400).json({ ok: false, message: "Invalid bid amount." });
    }

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ ok: false, message: "Listing not found." });

    const now = new Date();
    if (!listing.startTime || !listing.endTime || !(now >= listing.startTime && now <= listing.endTime)) {
      return res.status(400).json({ ok: false, message: "Auction not active." });
    }

    // compute minimum required: if currentBid > 0 then +1, else price + 1 (simple increment logic)
    const minRequired = (listing.currentBid && listing.currentBid > 0) ? (listing.currentBid + 1) : ((listing.price || 0) + 1);
    if (newBid < minRequired) {
      return res.status(400).json({ ok: false, message: `Bid must be at least ₹${minRequired}` });
    }

    // Atomic update: only set if currentBid < newBid
    const updated = await Listing.findOneAndUpdate(
      { _id: id, $or: [{ currentBid: { $lt: newBid } }, { currentBid: null }, { currentBid: 0 }] },
      { $set: { currentBid: newBid, highestBidder: req.user._id } },
      { new: true }
    ).populate("highestBidder");

    if (!updated) {
      return res.status(409).json({ ok: false, message: "Your bid was not high enough — someone else placed a higher bid." });
    }

    // Build bidder display name (best effort)
    let bidderDisplayName = null;
    if (updated.highestBidder && typeof updated.highestBidder === "object") {
      bidderDisplayName = updated.highestBidder.username || updated.highestBidder.name || updated.highestBidder.email || String(updated.highestBidder._id);
    } else {
      // fallback: use current user info (req.user)
      bidderDisplayName = req.user?.username || req.user?.name || req.user?.email || String(req.user?._id);
    }

    // emit socket event to update other clients in the specific listing room
    const io = req.app.get("io");
    if (io) {
      const room = `listing_${id}`;
      io.to(room).emit("newBidFlash", {
        listingId: id,
        bidderName: bidderDisplayName,
        amount: newBid,
        highestBidderId: String(req.user._id)
      });

      // also emit an event to update highest bid display if clients subscribe to it
      io.to(room).emit("updateHighestBid", {
        listingId: id,
        highestBid: {
          user: String(req.user._id),
          name: bidderDisplayName,
          amount: newBid
        }
      });
    }

    return res.json({ ok: true, currentBid: updated.currentBid });
  } catch (err) {
    console.error("Bid error:", err);
    return res.status(500).json({ ok: false, message: "Server error while placing bid." });
  }
});

/* =========================
   Buy Now (only current highest bidder can use this while auction is active)
   - Uses wallet balance to complete the purchase immediately
   - Uses atomic wallet deduct + atomic listing mark to avoid races
   - Creates an Order, emits 'listing:sold' to room
   ========================= */
router.post("/:id/buy-now", isLoggedIn, async (req, res) => {
  try {
    const listingId = req.params.id;
    const userId = String(req.user._id);

    const listing = await Listing.findById(listingId).populate("owner");
    if (!listing) return res.status(404).json({ ok: false, message: "Listing not found." });

    // require that the requester is the current highest bidder
    if (!listing.highestBidder || String(listing.highestBidder) !== userId) {
      return res.status(403).json({ ok: false, message: "Only the current highest bidder may use Buy Now." });
    }

    const currentAmount = Number(listing.currentBid || 0);
    if (!currentAmount || currentAmount <= 0) {
      return res.status(400).json({ ok: false, message: "No valid current bid to purchase." });
    }

    // Atomically deduct wallet balance from user (prevent race on balance)
    const buyerAfterDeduct = await User.findOneAndUpdate(
      { _id: userId, walletBalance: { $gte: currentAmount } },
      { $inc: { walletBalance: -currentAmount }, $push: { walletTransactions: {
        $each: [{
          type: "debit",
          amount: currentAmount,
          ref: `BUY_NOW_${listing._id}`,
          createdAt: new Date()
        }]
      } } },
      { new: true }
    ).exec();

    if (!buyerAfterDeduct) {
      return res.status(400).json({ ok: false, message: "Insufficient wallet balance for Buy Now." });
    }

    // Create an Order document to record this purchase (tentative)
    const order = new Order({
      buyer: buyerAfterDeduct._id,
      items: [
        {
          listing: listing._id,
          title: listing.title,
          image: listing.image,
          price: currentAmount,
          quantity: 1,
        },
      ],
      payment: {
        provider: "wallet",
        providerPaymentId: `WALLET_BUY_NOW_${Date.now()}`,
        method: "wallet",
        status: "succeeded",
        raw: { note: "buy-now wallet purchase" },
      },
      subtotal: currentAmount,
      shippingCost: 0,
      total: currentAmount,
      status: "paid",
      seller: listing.owner || null,
    });

    await order.save();

    // Attempt to atomically mark the listing sold
    try {
      const paymentInfoForListing = {
        provider: "wallet",
        providerPaymentId: order.payment.providerPaymentId,
        amount: currentAmount,
        raw: { orderId: order._id.toString() },
      };

      const updatedListing = await Listing.markSoldIfAvailable(listingId, buyerAfterDeduct._id, paymentInfoForListing);

      if (!updatedListing) {
        // Listing already sold — refund the wallet and update order
        console.warn(`Listing ${listingId} already sold; refunding buyer ${userId}`);

        // Refund: re-increment walletBalance and record refund transaction
        await User.findByIdAndUpdate(userId, {
          $inc: { walletBalance: currentAmount },
          $push: { walletTransactions: {
            $each: [{
              type: "credit",
              amount: currentAmount,
              ref: `REFUND_BUY_NOW_${listingId}`,
              createdAt: new Date()
            }]
          } }
        }).exec();

        order.status = "refunded";
        order.refund = {
          method: "wallet",
          amount_refunded: currentAmount,
          refundedAt: new Date(),
        };
        await order.save();

        return res.status(409).json({ ok: false, message: "Listing already sold. Wallet refunded." });
      }

      // Success — update listing fields final price/auctionProcessed if desired
      updatedListing.price = currentAmount;
      updatedListing.auctionProcessed = true;
      await updatedListing.save();

      // Emit sold event to listing room
      const io = req.app.get("io");
      if (io) {
        const room = `listing_${listingId}`;
        io.to(room).emit("listing:sold", {
          listingId,
          buyerId: String(buyerAfterDeduct._id),
          buyerName: buyerAfterDeduct.username || buyerAfterDeduct.name || buyerAfterDeduct.email || String(buyerAfterDeduct._id),
          soldPrice: currentAmount,
          orderId: String(order._id)
        });
      }

      return res.status(200).json({ ok: true, message: "Purchase successful", orderId: order._id, balance: buyerAfterDeduct.walletBalance });
    } catch (markErr) {
      console.error("Error marking listing sold after Buy Now:", markErr);

      // Attempt refund
      try {
        await User.findByIdAndUpdate(userId, {
          $inc: { walletBalance: currentAmount },
          $push: { walletTransactions: {
            $each: [{
              type: "credit",
              amount: currentAmount,
              ref: `REFUND_ON_ERR_BUY_NOW_${listingId}`,
              createdAt: new Date()
            }]
          } }
        }).exec();

        order.status = "failed_refunded";
        order.failureReason = `Error marking listing sold: ${markErr.message}`;
        await order.save();

        return res.status(500).json({ ok: false, message: "Purchase failed during finalization; wallet refunded." });
      } catch (refundErr) {
        console.error("Critical: refund after mark error failed:", refundErr);
        order.status = "failed_refund_failed";
        order.failureReason = `Mark error: ${markErr.message}; refund error: ${refundErr.message}`;
        await order.save();
        return res.status(500).json({ ok: false, message: "Purchase failed and automatic refund failed. Contact support." });
      }
    }
  } catch (err) {
    console.error("Buy Now error:", err);
    return res.status(500).json({ ok: false, message: "Server error while processing Buy Now." });
  }
});

/* =========================
   ✅ Buy with Wallet (JSON-only endpoint)
   - Now requires login
   - Uses atomic wallet deduct + atomic listing mark. Creates an order.
   ========================= */
router.post("/:id/buy-wallet", isLoggedIn, async (req, res) => {
  res.set("Content-Type", "application/json");
  try {
    const listingId = req.params.id;
    const userId = req.user._id;

    const amount = Math.max(1, Math.floor(Number(req.body.amount || 0)));
    if (!amount) {
      return res.status(400).json({ ok: false, message: "Invalid amount." });
    }

    const listing = await Listing.findById(listingId).exec();
    if (!listing) {
      return res.status(404).json({ ok: false, message: "Listing not found." });
    }

    // Prevent wallet buy if auction is active
    if (isAuctionActiveFor(listing)) {
      return res.status(400).json({ ok: false, message: "Bidding in progress — direct purchases are disabled until auction ends." });
    }

    // Atomically deduct wallet balance
    const buyerAfterDeduct = await User.findOneAndUpdate(
      { _id: userId, walletBalance: { $gte: amount } },
      { $inc: { walletBalance: -amount }, $push: { walletTransactions: {
        $each: [{
          type: "debit",
          amount,
          ref: `BUY_${listing._id}`,
          createdAt: new Date()
        }]
      } } },
      { new: true }
    ).exec();

    if (!buyerAfterDeduct) {
      return res.status(400).json({ ok: false, message: "Insufficient wallet balance." });
    }

    // Create an Order document to record this purchase (tentative)
    const order = new Order({
      buyer: buyerAfterDeduct._id,
      items: [
        {
          listing: listing._id,
          title: listing.title,
          image: listing.image,
          price: amount,
          quantity: 1,
        },
      ],
      payment: {
        provider: "wallet",
        providerPaymentId: `WALLET_${Date.now()}`,
        method: "wallet",
        status: "succeeded",
        raw: { note: "wallet purchase" },
      },
      subtotal: amount,
      shippingCost: 0,
      total: amount,
      status: "paid",
      seller: listing.owner || null,
    });

    await order.save();

    // Attempt to atomically mark listing sold
    try {
      const paymentInfoForListing = {
        provider: "wallet",
        providerPaymentId: order.payment.providerPaymentId,
        amount,
        raw: { orderId: order._id.toString() },
      };

      const updatedListing = await Listing.markSoldIfAvailable(listingId, buyerAfterDeduct._id, paymentInfoForListing);

      if (!updatedListing) {
        // Already sold — refund and update order
        console.warn(`Listing ${listingId} already sold; refunding buyer ${userId}`);

        await User.findByIdAndUpdate(userId, {
          $inc: { walletBalance: amount },
          $push: { walletTransactions: {
            $each: [{
              type: "credit",
              amount,
              ref: `REFUND_${listingId}`,
              createdAt: new Date()
            }]
          } }
        }).exec();

        order.status = "refunded";
        order.refund = {
          method: "wallet",
          amount_refunded: amount,
          refundedAt: new Date(),
        };
        await order.save();

        return res.status(409).json({ ok: false, message: "Listing already sold. Wallet refunded." });
      }

      // Success — emit event and return
      const io = req.app.get("io");
      if (io) {
        const room = `listing_${listingId}`;
        io.to(room).emit("listing:sold", {
          listingId,
          buyerId: String(buyerAfterDeduct._id),
          buyerName: buyerAfterDeduct.username || buyerAfterDeduct.name || buyerAfterDeduct.email || String(buyerAfterDeduct._id),
          soldPrice: amount,
          orderId: String(order._id)
        });
      }

      return res.status(200).json({ ok: true, balance: buyerAfterDeduct.walletBalance, orderId: order._id });
    } catch (markErr) {
      console.error("Error marking listing sold after wallet buy:", markErr);

      // Refund attempt
      try {
        await User.findByIdAndUpdate(userId, {
          $inc: { walletBalance: amount },
          $push: { walletTransactions: {
            $each: [{
              type: "credit",
              amount,
              ref: `REFUND_ON_ERR_${listingId}`,
              createdAt: new Date()
            }]
          } }
        }).exec();

        order.status = "failed_refunded";
        order.failureReason = `Error marking listing sold: ${markErr.message}`;
        await order.save();

        return res.status(500).json({ ok: false, message: "Purchase failed during finalization; wallet refunded." });
      } catch (refundErr) {
        console.error("Critical: refund after mark error failed:", refundErr);
        order.status = "failed_refund_failed";
        order.failureReason = `Mark error: ${markErr.message}; refund error: ${refundErr.message}`;
        await order.save();
        return res.status(500).json({ ok: false, message: "Purchase failed and automatic refund failed. Contact support." });
      }
    }
  } catch (err) {
    console.error("Buy with wallet error:", err);
    return res.status(500).json({ ok: false, message: "Server error while buying." });
  }
});

module.exports = router;
