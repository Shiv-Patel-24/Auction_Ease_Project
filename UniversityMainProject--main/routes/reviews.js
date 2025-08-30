const express = require("express");
const router = express.Router({ mergeParams: true }); //mergeParams : becuase after ID URL that url not work properly that is the reason am //using mergeParams : true . More info go to Express docu --> Router
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("../schema.js");
const Review = require("../models/review.js");
const Listing = require("../models/listing.js");
const { validateReview,isLoggedIn, isReviewAuthor } = require("../middleware.js");

// const validateReview = (req, res, next) => {
//   let { error } = reviewSchema.validate(req.body);
//   if (error) {
//     throw new ExpressError(400, result.error);
//   } else {
//     next();
//   }
// };

//Reviews
//POST Review Route
router.post(
  "/",
  isLoggedIn, // this is for the user who is logged in
  validateReview,
  wrapAsync(async (req, res) => {
    console.log(req.params.id);
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review); //Show.ejs created a form when the from submit "review[rating], review[comment]" backend pass

    listing.reviews.push(newReview); //models-> reviews array created a new. that will be pass here

    await newReview.save();
    await listing.save();

    // console.log("new review saved")
    // res.send("new review saved")
    req.flash("success", "New Review Created!");
    res.redirect(`/listings/${listing._id}`);
  })
);

// Delete Review Route
router.delete(
  "/:reviewId",
  isLoggedIn,
  isReviewAuthor,
  wrapAsync(async (req, res) => {
    let { id, reviewId } = req.params;

    // here i am using mongoose "$pull" operator
    await Listing.findByIdAndUpdate(id, { $pull: { reviewId } });

    await Review.findByIdAndDelete(reviewId);
    
    req.flash("success", "Review Deleted!");
    res.redirect(`/listings/${id}`);
  })
);

module.exports = router;
