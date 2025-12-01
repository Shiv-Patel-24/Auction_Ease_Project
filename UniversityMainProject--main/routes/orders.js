// routes/orders.js
const express = require("express");
const router = express.Router();
const Order = require("../models/order");
const { isLoggedIn } = require("../middleware");

// 🛒 All orders for current user
router.get("/", isLoggedIn, async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate("items.listing")
      .sort({ createdAt: -1 });

    res.render("orders/index", { orders });
  } catch (err) {
    console.error("Error fetching orders:", err);
    req.flash("error", "Failed to load orders.");
    res.redirect("/");
  }
});

// 🛒 Single order details
router.get("/:id", isLoggedIn, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id })
      .populate("items.listing");

    if (!order) {
      req.flash("error", "Order not found.");
      return res.redirect("/orders");
    }

    res.render("orders/show", { order });
  } catch (err) {
    console.error("Error fetching order:", err);
    req.flash("error", "Failed to load order.");
    res.redirect("/orders");
  }
});

// 🔄 Retry payment route
router.post("/:id/retry", isLoggedIn, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id });

    if (!order) {
      req.flash("error", "Order not found.");
      return res.redirect("/orders");
    }

    // Only allow retry if payment failed or still pending
    if (!order.payment || !["failed", "pending"].includes(order.payment.status)) {
      req.flash("error", "This order cannot be retried.");
      return res.redirect(`/orders/${order._id}`);
    }

    // Reset payment status to pending (so frontend shows retry flow)
    order.payment.status = "pending";
    await order.save();

    // Redirect user to payment flow again (wallet/card/stripe/etc.)
    // Example: redirect to your checkout route with orderId
    req.flash("info", "Please complete your payment again.");
    return res.redirect(`/checkout/${order._id}`);
  } catch (err) {
    console.error("Error retrying payment:", err);
    req.flash("error", "Failed to retry payment.");
    return res.redirect("/orders");
  }
});

module.exports = router;
