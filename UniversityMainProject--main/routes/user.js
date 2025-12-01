// routes/user.js
const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl, isAdmin } = require("../middleware.js");
const User = require("../models/user"); // User model (passport-local-mongoose)

/* -----------------------------
   GET: Signup form
   ----------------------------- */
router.get("/signup", (req, res) => {
  res.render("users/signup.ejs");
});

/* -----------------------------
   POST: Signup (local) — emits newUser via Socket.IO
   ----------------------------- */
router.post(
  "/signup",
  wrapAsync(async (req, res, next) => {
    try {
      const { username, email, password } = req.body;
      const newUser = new User({ email, username });
      const registeredUser = await User.register(newUser, password);

      // Emit 'newUser' event to Socket.IO so admin dashboards can update live.
      // Only expose safe fields to clients.
      try {
        const io = req.app.get("io");
        if (io) {
          io.emit("newUser", {
            _id: registeredUser._id,
            username: registeredUser.username,
            email: registeredUser.email,
            isAdmin: registeredUser.isAdmin || false,
            createdAt: registeredUser.createdAt
              ? registeredUser.createdAt.toISOString()
              : new Date().toISOString(),
          });
        }
      } catch (emitErr) {
        // Log but do not block signup if sockets fail
        console.error("Socket emit error (newUser):", emitErr);
      }

      req.login(registeredUser, (err) => {
        if (err) return next(err);
        req.flash("success", `Welcome ${registeredUser.username}!`);
        return res.redirect("/listings");
      });
    } catch (error) {
      req.flash("error", error.message);
      res.redirect("/signup");
    }
  })
);

/* -----------------------------
   GET: Login form
   ----------------------------- */
router.get("/login", (req, res) => {
  res.render("users/login.ejs");
});

/* -----------------------------
   POST: Login
   ----------------------------- */
router.post(
  "/login",
  saveRedirectUrl, // optional middleware that sets res.locals.redirectUrl
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    req.flash("success", "Welcome back!");

    // Start with provided redirect or default to /listings
    let redirectUrl = res.locals.redirectUrl || "/";

    // Ensure it's safe (string + relative path)
    if (typeof redirectUrl !== "string" || !redirectUrl.startsWith("/")) {
      redirectUrl = "/listings";
    }

    // Disallow sensitive/non-landing endpoints from being the redirect target
    const disallowedTargets = [
      /^\/wallet\/balance\b/i,
      /^\/payment\/stripe\/webhook\b/i,
      /^\/payment\/create-checkout-session\b/i,
      /^\/api\b/i,
    ];
    if (disallowedTargets.some((rx) => rx.test(redirectUrl))) {
      redirectUrl = "/listings";
    }

    // Clear stored returnTo in session if present
    if (req.session) delete req.session.returnTo;

    return res.redirect(redirectUrl);
  }
);

/* -----------------------------
   GOOGLE OAUTH ROUTES
   ----------------------------- */
// Initiate Google OAuth
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

// Callback URL for Google OAuth
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    req.flash("success", `Welcome to AuctionEase, ${req.user.username}!`);
    // NOTE: Not emitting here to avoid broadcasting returning users.
    res.redirect("/");
  }
);

/* -----------------------------
   GET: Logout
   ----------------------------- */
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You have successfully logged out.");
    res.redirect("/login"); // redirect to home/listings
  });
});

/* -----------------------------
   ADMIN: Promote user to admin (Protected)
   Usage: POST /promote/:id
   ----------------------------- */
router.post(
  "/promote/:id",
  isAdmin,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("back");
    }
    user.isAdmin = true;
    await user.save();
    req.flash("success", `${user.username} is now an admin.`);
    return res.redirect("back");
  })
);

/* -----------------------------
   ADMIN: Demote user from admin (Protected)
   Usage: POST /demote/:id
   ----------------------------- */
router.post(
  "/demote/:id",
  isAdmin,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("back");
    }
    // Prevent demoting yourself inadvertently
    if (req.user && req.user._id && req.user._id.equals(user._id)) {
      req.flash("error", "You cannot demote yourself.");
      return res.redirect("back");
    }
    user.isAdmin = false;
    await user.save();
    req.flash("success", `${user.username} is no longer an admin.`);
    return res.redirect("back");
  })
);

module.exports = router;
