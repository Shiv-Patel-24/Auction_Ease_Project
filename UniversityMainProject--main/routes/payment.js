// routes/payment.js
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Listing = require("../models/listing");
const Order = require("../models/order");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// -------------------------------
// Create Checkout Session (Buy Now or Wallet Top-up)
// -------------------------------
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { listingId, title, description, updatedPrice, purpose } = req.body;

    const amount = Math.max(1, Math.floor(Number(updatedPrice || 0)));
    if (!amount) {
      return res.status(400).json({ error: "Invalid amount." });
    }

    let successUrl;
    let cancelUrl;

    if (purpose === "wallet_topup") {
      // Wallet Top-up → redirect to wallet page
      successUrl = `${req.protocol}://${req.get("host")}/wallet?success=1`;
      cancelUrl = `${req.protocol}://${req.get("host")}/wallet?cancelled=1`;
    } else {
      // Listing purchase → redirect to payment success page
      successUrl = `${req.protocol}://${req.get("host")}/payment/success`;
      cancelUrl = `${req.protocol}://${req.get("host")}/listings/${listingId}`;
    }

    const sessionPayload = {
      mode: "payment",
      payment_method_types: ["card"], // ✅ card only
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: { name: title || "Listing purchase", description: description || "" },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        purpose: purpose || "listing_purchase",
        listingId: listingId || "",
        amount: String(amount),
        title: title || ""
      },
    };

    const session = await stripe.checkout.sessions.create(sessionPayload);
    return res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe session creation failed:", err.message);
    return res.status(500).json({ error: `Stripe session creation failed: ${err.message}` });
  }
});

// -------------------------------
// Success Page (for card purchases)
// -------------------------------
router.get("/success", (req, res) => {
  res.render("payment/success"); // views/payment/success.ejs
});

// -------------------------------
// Stripe Webhook (Option A - raw body set in app.js)
// -------------------------------
router.post("/stripe/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const purpose = session.metadata?.purpose;
      const amount = Number(session.metadata?.amount || 0);
      const listingId = session.metadata?.listingId;
      const customerEmail = session.customer_details?.email || session.customer_email || null;

      if (purpose === "wallet_topup") {
        if (customerEmail) {
          const user = await User.findOne({ email: customerEmail });
          if (user) {
            user.walletBalance = Number(user.walletBalance || 0) + amount;
            user.walletTransactions = user.walletTransactions || [];
            user.walletTransactions.push({
              type: "credit",
              amount,
              ref: `TOPUP_${session.id}`,
              createdAt: new Date(),
            });
            await user.save();
            console.log(`✅ Wallet top-up: Credited ₹${amount} to ${customerEmail}`);
          } else {
            console.warn(`Wallet top-up: customer email ${customerEmail} not found in users.`);
          }
        } else {
          console.warn("Wallet top-up: no customer email available in session.");
        }
      }

      if (purpose === "listing_purchase" && listingId) {
        try {
          // Find buyer by email if available
          let buyer = null;
          if (customerEmail) {
            buyer = await User.findOne({ email: customerEmail });
          }

          // Pull listing snapshot (lean not required because we may update later)
          const listing = await Listing.findById(listingId).exec();

          // Build order item snapshot
          const itemSnapshot = {
            listing: listing ? listing._id : null,
            title: listing ? listing.title : (session.metadata?.title || "Listing"),
            image: listing ? listing.image : "/images/default-listing.jpg",
            price: amount,
            quantity: 1,
          };

          const newOrder = new Order({
            buyer: buyer ? buyer._id : null,
            items: [itemSnapshot],
            payment: {
              provider: "stripe",
              providerPaymentId: session.payment_intent || session.id || null,
              method: "card",
              status: "succeeded",
              raw: session,
            },
            subtotal: amount,
            shippingCost: 0,
            total: amount,
            status: "paid",
            seller: listing ? listing.owner || null : null,
          });

          await newOrder.save();

          // Attempt to atomically mark the listing sold
          try {
            const paymentInfoForListing = {
              provider: "stripe",
              providerPaymentId: session.payment_intent || session.id || null,
              amount,
              raw: {
                sessionId: session.id,
                checkout: undefined, // avoid saving heavy objects; set if needed
              },
            };

            const updatedListing = await Listing.markSoldIfAvailable(
              listingId,
              buyer ? buyer._id : null,
              paymentInfoForListing
            );

            if (!updatedListing) {
              // Listing already sold; issue a refund and update order status accordingly
              console.warn(`Listing ${listingId} already sold. Attempting refund for payment_intent=${session.payment_intent}`);

              try {
                if (session.payment_intent) {
                  const refund = await stripe.refunds.create({
                    payment_intent: session.payment_intent,
                    metadata: { reason: "listing_already_sold", listingId, orderId: newOrder._id.toString() },
                  });

                  newOrder.status = "refunded";
                  newOrder.refund = {
                    id: refund.id,
                    status: refund.status,
                    amount_refunded: refund.amount,
                    createdAt: new Date(),
                  };
                  await newOrder.save();

                  console.log(`🔁 Refunded order ${newOrder._id} (refund id: ${refund.id}) because listing was already sold.`);
                } else {
                  // No payment_intent available — mark order failed and alert for manual refund
                  newOrder.status = "failed";
                  newOrder.failureReason = "Listing already sold; no payment_intent available for automatic refund.";
                  await newOrder.save();
                  console.error("Cannot automatically refund: session.payment_intent is missing. Manual refund required.");
                }
              } catch (refundErr) {
                // Refund failed — mark order with refund failure for manual intervention
                newOrder.status = "refund_failed";
                newOrder.refund = newOrder.refund || {};
                newOrder.refund.error = refundErr.message;
                await newOrder.save();
                console.error("Automatic refund failed:", refundErr);
              }
            } else {
              // Successfully marked listing sold — nothing else required here.
              console.log(`✅ Listing ${listingId} atomically marked sold to buyer ${buyer ? buyer._id : "unknown (email-only)"} (Order ${newOrder._id}).`);
            }
          } catch (markErr) {
            // If marking the listing failed for other reasons, log and set order status for manual review
            console.error("Error while attempting to mark listing sold:", markErr);
            newOrder.status = "needs_review";
            newOrder.failureReason = `Error marking listing sold: ${markErr.message}`;
            await newOrder.save();
          }
        } catch (err) {
          console.error("Error creating order from stripe webhook:", err);
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).send("Webhook handler error");
  }
});

module.exports = router;
