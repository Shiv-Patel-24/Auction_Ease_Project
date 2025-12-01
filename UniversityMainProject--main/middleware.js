// middleware.js
const Review = require("./models/review.js");
const Listing = require("./models/listing.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const ExpressError = require("./utils/ExpressError.js");

/**
 * Ensure the user is logged in.
 * If not, save the original URL to session (so we can redirect after login)
 * and redirect to /login with a flash message.
 */
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    // Save original URL so user can be redirected back after login
    if (req.session) req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in to perform that action.");
    return res.redirect("/login");
  }
  return next();
};

/**
 * If a redirect URL was stored in session, expose it to views via res.locals.
 * (Used by login handler to send user back where they wanted to go.)
 */
module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session && req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  return next();
};

/**
 * Check that the currently authenticated user is the owner of the listing.
 * Uses req.user (from Passport). If listing not found or user is not owner -> redirect.
 *
 * NOTE: Some parts of the codebase refer to listing.owner while others use listing.author.
 * This middleware accepts either field.
 */
module.exports.isOwner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
      req.flash("error", "Listing not found.");
      return res.redirect("/listings");
    }

    // Ensure user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      req.flash("error", "You must be logged in.");
      return res.redirect("/login");
    }

    // Accept either `owner` or `author` field on the listing
    const ownerId = listing.owner ?? listing.author;
    if (!ownerId) {
      req.flash("error", "Listing does not have an owner set.");
      return res.redirect(`/listings/${id}`);
    }

    // ownerId may be an ObjectId or a string; use equals if available
    const isOwner =
      (typeof ownerId.equals === "function" && ownerId.equals(req.user._id)) ||
      String(ownerId) === String(req.user._id);

    if (!isOwner) {
      req.flash("error", "You are not the owner of this listing.");
      return res.redirect(`/listings/${id}`);
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Joi validation for listing payload.
 * Throws ExpressError with 400 status if validation fails.
 */
module.exports.validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    // Compose a helpful message from Joi details
    const msg = error.details ? error.details.map((d) => d.message).join(", ") : error.message;
    throw new ExpressError(400, msg);
  }
  return next();
};

/**
 * Joi validation for review payload.
 */
module.exports.validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const msg = error.details ? error.details.map((d) => d.message).join(", ") : error.message;
    throw new ExpressError(400, msg);
  }
  return next();
};

/**
 * Ensure the currently authenticated user is the author of the review.
 */
module.exports.isReviewAuthor = async (req, res, next) => {
  try {
    const { reviewId, id } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) {
      req.flash("error", "Review not found.");
      return res.redirect(`/listings/${id}`);
    }

    if (!req.isAuthenticated || !req.isAuthenticated()) {
      req.flash("error", "You must be logged in.");
      return res.redirect("/login");
    }

    const isAuthor =
      (typeof review.author.equals === "function" && review.author.equals(req.user._id)) ||
      String(review.author) === String(req.user._id);

    if (!isAuthor) {
      req.flash("error", "You are not the author of this review.");
      return res.redirect(`/listings/${id}`);
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Admin-only guard.
 * Ensures user is logged in and has isAdmin === true on their user document.
 */
module.exports.isAdmin = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    req.flash("error", "You must be logged in to access that page.");
    return res.redirect("/login");
  }

  if (req.user && req.user.isAdmin) {
    return next();
  }

  req.flash("error", "You do not have permission to access this page.");
  return res.redirect("/");
};
