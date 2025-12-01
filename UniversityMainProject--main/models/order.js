// models/order.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Order model
 *
 * - buyer: reference to the User who purchased
 * - items: array of purchased items; each item stores a reference to the Listing,
 *          a snapshot of price at purchase time, quantity, and optional title/image
 *          snapshot fields (useful if the listing is later deleted/changed)
 * - payment: subdocument storing provider, id, method, status, raw metadata
 * - status: order lifecycle (placed, paid, shipped, completed, refunded, cancelled)
 * - shipping: optional shipping address details
 *
 * Important: we store price on each item so order totals don't change if a listing's price changes later.
 */

const OrderItemSchema = new Schema({
  listing: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
  },
  // snapshot fields to keep minimal information about the purchased item
  title: String,
  image: String,
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1,
  },
});

const PaymentSchema = new Schema({
  provider: String,          // e.g., 'stripe', 'paypal', 'wallet'
  providerPaymentId: String, // e.g., Stripe PaymentIntent id
  method: String,            // e.g., 'card', 'upi', 'wallet'

  // key field for retry & status tracking
  status: {
    type: String,
    enum: ["pending", "succeeded", "failed"],
    default: "pending",
  },

  raw: Schema.Types.Mixed,   // store raw provider response if needed
});

// Refund subdocument to store automatic/manual refund metadata
const RefundSchema = new Schema({
  id: String,               // provider refund id (e.g., Stripe refund id)
  status: String,           // provider refund status
  amount_refunded: Number,  // amount refunded in currency units (not paise)
  method: String,           // 'stripe' | 'wallet' | 'manual'
  refundedAt: Date,
  error: String,            // error message if refund failed
}, { _id: false });

const ShippingSchema = new Schema({
  name: String,
  phone: String,
  addressLine1: String,
  addressLine2: String,
  city: String,
  state: String,
  postalCode: String,
  country: String,
});

const OrderSchema = new Schema(
  {
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: [OrderItemSchema],

    // cached totals (optional, can be computed on the fly)
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },

    // payment schema holds provider, method & status for retry
    payment: PaymentSchema,

    // Status values include extended states your routes use:
    // placed, paid, shipped, completed, refunded, cancelled,
    // failed, refund_failed, failed_refunded, failed_refund_failed, needs_review
    status: {
      type: String,
      enum: [
        "placed",
        "paid",
        "shipped",
        "completed",
        "refunded",
        "cancelled",
        "failed",
        "refund_failed",
        "failed_refunded",
        "failed_refund_failed",
        "needs_review"
      ],
      default: "placed",
    },

    // Refund metadata (if applicable)
    refund: RefundSchema,

    // If some operation failed and you want to track why
    failureReason: String,

    // optional shipping info (if applicable)
    shipping: ShippingSchema,

    // optional seller reference if you want to quickly group by seller (for single-seller orders)
    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    notes: String,
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save hook to (re)compute subtotal and total based on items.
 * Useful if you sometimes update item prices/quantity before saving.
 */
OrderSchema.pre("save", function (next) {
  try {
    if (!this.items || this.items.length === 0) {
      this.subtotal = 0;
      this.total = Number(this.shippingCost || 0);
      return next();
    }
    const subtotal = this.items.reduce((sum, it) => {
      const p = Number(it.price || 0);
      const q = Number(it.quantity || 1);
      return sum + p * q;
    }, 0);
    this.subtotal = subtotal;
    this.total = subtotal + Number(this.shippingCost || 0);
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * Virtual: computedTotal (same as total field but computed on the fly if you prefer)
 */
OrderSchema.virtual("computedTotal").get(function () {
  const subtotal = this.items ? this.items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0) : 0;
  return subtotal + (this.shippingCost || 0);
});

// add index to quickly query orders by buyer and createdAt for profile view
OrderSchema.index({ buyer: 1, createdAt: -1 });

module.exports = mongoose.model("Order", OrderSchema);
