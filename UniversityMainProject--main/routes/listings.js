const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");
const User = require("../models/user");
const { isLoggedIn } = require("../middleware");

// Stripe integration
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

if (!stripeSecretKey || !stripePublishableKey) {
  throw new Error("❌ Stripe keys missing in environment variables. Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to your .env file.");
}
const stripe = require("stripe")(stripeSecretKey);

/* =========================
   All Listings
   ========================= */
router.get("/", async (req, res) => {
  try {
    const allListings = await Listing.find();
    res.render("listings/index", { allListings });
  } catch (err) {
    console.error(err);
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
   (includes auctionEndTime parsing)
   ========================= */
router.post("/", isLoggedIn, async (req, res) => {
  const { listing } = req.body;

  const newListing = new Listing({
    ...listing,
    owner: req.user._id,
    auctionEndTime: listing.auctionEndTime ? new Date(listing.auctionEndTime) : null,
  });

  await newListing.save();
  req.flash("success", "New listing created!");
  res.redirect(`/listings/${newListing._id}`);
});

/* =========================
   Edit form
   ========================= */
router.get("/:id/edit", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  res.render("listings/edit", { listing });
});

/* =========================
   Update listing
   ========================= */
router.put("/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const updateData = {
    ...req.body.listing,
    auctionEndTime: req.body.listing.auctionEndTime ? new Date(req.body.listing.auctionEndTime) : null,
  };

  await Listing.findByIdAndUpdate(id, updateData);
  req.flash("success", "Listing updated!");
  res.redirect(`/listings/${id}`);
});

/* =========================
   Delete listing
   ========================= */
router.delete("/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
});

/* =========================
   Show single listing
   (populates owner)
   ========================= */
router.get("/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id).populate("owner");

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  res.render("listings/show", {
    listing,
    currUser: req.user,
    stripePublishableKey,
  });
});

/* =========================
   Stripe Checkout: Buy Now (legacy route)
   (Kept for compatibility; your UI uses /payment/create-checkout-session)
   ========================= */
router.post("/:id/create-checkout-session", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    return res.status(404).send("Listing not found");
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: { name: listing.title, description: listing.description },
            unit_amount: listing.price * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.protocol}://${req.get("host")}/listings/${listing._id}?success=true`,
      cancel_url: `${req.protocol}://${req.get("host")}/listings/${listing._id}?cancelled=true`,
    });

    res.redirect(303, session.url);
  } catch (err) {
    console.error("Stripe Checkout Error:", err.message);
    res.status(500).send("Payment session creation failed");
  }
});

/* =========================
   ✅ Buy with Wallet (JSON-only endpoint)
   - No isLoggedIn middleware to avoid HTML redirect.
   - Owners ARE allowed to buy their own listing (restriction removed).
   - Always responds with JSON.
   ========================= */
router.post("/:id/buy-wallet", async (req, res) => {
  res.set("Content-Type", "application/json");
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: "Please log in to buy with wallet." });
    }

    const listingId = req.params.id;
    const amount = Math.max(1, Math.floor(Number(req.body.amount || 0)));
    if (!amount) {
      return res.status(400).json({ ok: false, message: "Invalid amount." });
    }

    const [listing, user] = await Promise.all([
      Listing.findById(listingId),
      User.findById(req.user._id),
    ]);

    if (!listing) {
      return res.status(404).json({ ok: false, message: "Listing not found." });
    }

    // 🔓 Owner purchase allowed — removed the block

    // Check wallet balance
    const balance = Number(user.walletBalance || 0);
    if (balance < amount) {
      return res.status(400).json({ ok: false, message: "Insufficient wallet balance." });
    }

    // Deduct and record transaction
    user.walletBalance = balance - amount;
    user.walletTransactions = user.walletTransactions || [];
    user.walletTransactions.push({
      type: "debit",
      amount,
      ref: `BUY_${listing._id}`,
      createdAt: new Date(),
    });
    await user.save();

    // Optional: mark listing sold to this user if your schema supports it
    // listing.status = "sold";
    // listing.buyer = user._id;
    // await listing.save();

    return res.status(200).json({ ok: true, balance: user.walletBalance });
  } catch (err) {
    console.error("Buy with wallet error:", err);
    return res.status(500).json({ ok: false, message: "Server error while buying." });
  }
});

module.exports = router;
