const express = require('express');
const router = express.Router();

const User = require('../models/user');
const Listing = require('../models/listing');
const Review = require('../models/review');
const { isLoggedIn, isAdmin } = require('../middleware'); // Assuming you have these middlewares for auth checks

// Admin dashboard route
// router.get('/dashboard', isLoggedIn, isAdmin, async (req, res) => {
//   try {
//     const users = await User.find({});
//     const listings = await Listing.find({});
//     const reviews = await Review.find({});
//     res.render('admin/dashboard', { users, listings, reviews });
//   } catch (err) {
//     console.error(err);
//     req.flash('error', 'Something went wrong loading admin dashboard');
//     res.redirect('/');
//   }
// });

router.get('/dashboard', isLoggedIn, isAdmin, async (req, res) => {
  const perPage = 10;
  const userPage = parseInt(req.query.userPage) || 1;
  const listingPage = parseInt(req.query.listingPage) || 1;

  const [users, userCount] = await Promise.all([
    User.find()
      .skip((userPage - 1) * perPage)
      .limit(perPage),
    User.countDocuments()
  ]);

  const [listings, listingsCount] = await Promise.all([
    Listing.find()
      .skip((listingPage - 1) * perPage)
      .limit(perPage),
    Listing.countDocuments()
  ]);

  const reviews = await Review.find().limit(10);

  res.render('admin/dashboard', {
    users,
    listings,
    reviews,
    userPagination: {
      page: userPage,
      pageCount: Math.ceil(userCount / perPage)
    },
    listingPagination: {
      page: listingPage,
      pageCount: Math.ceil(listingsCount / perPage)
    }
  });
});



// Additional admin routes can go here
// For example: routes to delete a user, edit listings, etc.

module.exports = router;
