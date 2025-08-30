// routes/wallet.js
const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware");
const User = require("../models/user");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY is missing. Set it in .env");
}
const stripe = require("stripe")(STRIPE_SECRET_KEY);

// 🪙 Show wallet page
router.get("/", isLoggedIn, async (req, res) => {
  const user = await User.findById(req.user._id);
  res.render("wallet/index.ejs", {
    user,
    success: req.query.success,
    cancelled: req.query.cancelled,
  });
});

// 🔹 Lightweight balance endpoint for navbar badge
router.get("/balance", isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("walletBalance");
    res.json({ balance: user?.walletBalance || 0 });
  } catch {
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

module.exports = router;
