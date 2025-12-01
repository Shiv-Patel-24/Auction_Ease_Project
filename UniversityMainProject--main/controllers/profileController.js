// controllers/profileController.js
const User = require('../models/user');
const Listing = require('../models/listing');
const Order = require('../models/order');

module.exports.getProfile = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect('/login');
    const userId = req.user._id;

    // fresh user data
    const user = await User.findById(userId).select('name username email profilePicture walletBalance createdAt').lean();

    // listings by owner (your schema uses owner)
    const listings = await Listing.find({ owner: userId }).sort({ createdAt: -1 }).lean();

    // orders where buyer equals the logged in user
    const orders = await Order.find({ buyer: userId }).sort({ createdAt: -1 }).populate('items.listing').lean();

    // flatten purchases for display
    const purchased = [];
    for (const order of (orders || [])) {
      if (Array.isArray(order.items) && order.items.length) {
        for (const it of order.items) {
          const listingPop = it.listing || null;
          purchased.push({
            orderId: order._id,
            title: it.title || (listingPop && listingPop.title) || 'Item',
            image: it.image || (listingPop && listingPop.image) || '/images/default-listing.jpg',
            price: it.price || (listingPop && listingPop.price) || 0,
            qty: it.quantity || it.qty || 1,
            purchasedAt: order.createdAt,
          });
        }
      } else if (order.listing) {
        const lp = order.listing;
        purchased.push({
          orderId: order._id,
          title: lp.title || 'Item',
          image: lp.image || '/images/default-listing.jpg',
          price: lp.price || 0,
          qty: order.quantity || 1,
          purchasedAt: order.createdAt,
        });
      }
    }

    const debugInfo = {
      loggedInUserId: String(userId),
      listingsFound: (listings || []).length,
      purchasesFound: purchased.length,
    };

    res.render('profile/profile', { user, listings, purchased, debugInfo });
  } catch (err) {
    next(err);
  }
};
