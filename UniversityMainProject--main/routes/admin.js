// routes/admin.js
const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");

const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");
const { isLoggedIn, isAdmin } = require("../middleware"); // auth middlewares

/**
 * Admin Dashboard
 */
router.get(
  "/dashboard",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const perPage = 10;
    const userPage = Math.max(1, parseInt(req.query.userPage) || 1);
    const listingPage = Math.max(1, parseInt(req.query.listingPage) || 1);

    const [users, userCount, listings, listingsCount, reviews] = await Promise.all([
      User.find()
        .skip((userPage - 1) * perPage)
        .limit(perPage)
        .select("-hash -salt -__v"),
      User.countDocuments(),
      Listing.find()
        .skip((listingPage - 1) * perPage)
        .limit(perPage)
        .populate("owner", "username email"),
      Listing.countDocuments(),
      Review.find().sort({ createdAt: -1 }).limit(10).populate("author", "username"),
    ]);

    return res.render("admin/dashboard", {
      users,
      listings,
      reviews,
      userPagination: {
        page: userPage,
        pageCount: Math.max(1, Math.ceil(userCount / perPage)),
      },
      listingPagination: {
        page: listingPage,
        pageCount: Math.max(1, Math.ceil(listingsCount / perPage)),
      },
    });
  })
);

/**
 * Promote user
 */
router.post(
  "/users/:id/promote",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("back");
    }
    user.isAdmin = true;
    await user.save();
    req.flash("success", `${user.username || user.email} promoted to admin.`);
    res.redirect("back");
  })
);

/**
 * Demote user
 */
router.post(
  "/users/:id/demote",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("back");
    }
    if (req.user && req.user._id.equals(user._id)) {
      req.flash("error", "You cannot demote yourself.");
      return res.redirect("back");
    }
    user.isAdmin = false;
    await user.save();
    req.flash("success", `${user.username || user.email} demoted from admin.`);
    res.redirect("back");
  })
);

/**
 * Delete user (no cascade by default)
 */
router.delete(
  "/users/:id",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("back");
    }

    if (req.user && req.user._id.equals(user._id)) {
      req.flash("error", "You cannot delete your own account.");
      return res.redirect("back");
    }

    // OPTIONAL: cascade delete user's listings & reviews if you want
    // await Listing.deleteMany({ owner: userId });
    // await Review.deleteMany({ author: userId });

    await User.deleteOne({ _id: userId });
    req.flash("success", "User account deleted.");
    res.redirect("/admin/dashboard");
  })
);

/**
 * Delete listing (safe, model-level deletion)
 * - removes associated reviews
 * - emits a `listingDeleted` socket event if io is available
 */
router.delete(
  "/listings/:id",
  isLoggedIn,
  isAdmin,
  wrapAsync(async (req, res) => {
    const listingId = req.params.id;

    // find listing (for title / owner info) - do not rely on its .remove()
    const listing = await Listing.findById(listingId).populate("owner", "username email");
    if (!listing) {
      req.flash("error", "Listing not found.");
      return res.redirect("back");
    }

    // delete related reviews first
    try {
      await Review.deleteMany({ listing: listingId });
    } catch (err) {
      // log and continue
      console.error(`Failed to delete reviews for listing ${listingId}:`, err);
    }

    // use model-level delete (works in all Mongoose versions and whether the object is doc or plain)
    await Listing.deleteOne({ _id: listingId });

    // emit socket event to update admin dashboards (if your app exposes io)
    try {
      const io = req.app && req.app.get && req.app.get("io");
      if (io && typeof io.emit === "function") {
        io.emit("listingDeleted", { id: listingId });
      }
    } catch (emitErr) {
      console.error("Error emitting listingDeleted event:", emitErr);
    }

    req.flash("success", `Listing "${listing.title || listingId}" removed.`);
    // go back to admin dashboard so pagination resets properly
    return res.redirect("/admin/dashboard");
  })
);

module.exports = router;
