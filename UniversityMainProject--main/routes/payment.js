// routes/payment.js
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Listing = require("../models/listing");

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
          }
        }
      }

      if (purpose === "listing_purchase" && listingId) {
        console.log(`✅ Listing ${listingId} purchased for ₹${amount}`);
        // optional: mark listing as sold
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).send("Webhook handler error");
  }
});

module.exports = router;
