// models/listing.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review"); // keep import for cleanup hook

const bidSubSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    placedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const listingSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    image: {
      type: String,
      default:
        "https://www.whiteteak.com/media/catalog/product/h/l/hl174-10005_11_.jpg?optimize=medium&fit=bounds&height=&width=",
      set: (v) =>
        v === ""
          ? "https://images.unsplash.com/photo-1577618163295-29d57a40e2b2?q=80&w=2040&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3Dhttps://www.whiteteak.com/media/catalog/product/h/l/hl174-10005_11_.jpg?optimize=medium&fit=bounds&height=&width="
          : v,
    },
    price: {
      type: Number,
      default: 0,
    },
    location: String,
    country: String,

    // Auction times (required in your previous schema)
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },

    // Auction bookkeeping fields
    currentBid: {
      type: Number,
      default: 0,
      min: 0,
    },
    highestBidder: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    auctionProcessed: {
      // becomes true once the auction end has been processed by the server
      type: Boolean,
      default: false,
    },

    // store bid history (optional but useful)
    bids: {
      type: [bidSubSchema],
      default: [],
    },

    // count of times sold (optional usage in your app)
    soldCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // --- New fields: sold state & payment audit ---
    sold: {
      type: Boolean,
      default: false,
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    soldAt: {
      type: Date,
      default: null,
    },
    paymentInfo: {
      provider: { type: String }, // e.g. 'stripe' | 'wallet'
      providerPaymentId: { type: String },
      amount: { type: Number },
      // raw provider payload or metadata when needed for audits
      raw: { type: Schema.Types.Mixed, default: null },
    },

    reviews: [
      {
        type: Schema.Types.ObjectId,
        ref: "Review",
      },
    ],

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Clean up reviews when a listing is removed
listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing && listing.reviews && listing.reviews.length) {
    try {
      await Review.deleteMany({ _id: { $in: listing.reviews } });
    } catch (err) {
      // Log but don't throw in a hook
      console.error("Error deleting listing reviews:", err);
    }
  }
});

/**
 * Instance method: placeBid
 * Usage:
 *   const newBid = await listing.placeBid(userObj, amount);
 *
 * Behaviour:
 *  - Validates amount is greater than currentBid.
 *  - Updates currentBid and highestBidder.
 *  - Pushes an entry into bids history.
 *  - Saves the listing and returns the pushed bid object.
 *
 * Throws an Error with message on invalid amount or other failures.
 */
listingSchema.methods.placeBid = async function (user, amount) {
  // Prevent bidding on a sold listing
  if (this.sold) {
    throw new Error("Cannot place bid: listing already sold");
  }

  if (!user || !user._id) {
    throw new Error("Authentication required to place a bid");
  }

  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid bid amount");
  }

  // Require strictly greater than currentBid
  const current = Number(this.currentBid || 0);
  if (numericAmount <= current) {
    throw new Error("Bid must be higher than the current bid");
  }

  // Build bid record
  const bidRecord = {
    user: user._id,
    name: user.username || user.name || user.email || "Anonymous",
    amount: numericAmount,
    placedAt: new Date(),
  };

  // Update fields
  this.currentBid = numericAmount;
  this.highestBidder = user._id;
  // keep history (push to bids array)
  this.bids.push(bidRecord);

  // Save and return the last bid (as stored in DB)
  await this.save();

  // Return a plain object copy of the last bid (for convenience)
  return {
    user: String(bidRecord.user),
    name: bidRecord.name,
    amount: bidRecord.amount,
    placedAt: bidRecord.placedAt,
  };
};

// Static helper: atomically mark a listing sold if not already sold.
// Returns the updated document (new:true) or null if it was already sold.
listingSchema.statics.markSoldIfAvailable = async function (
  listingId,
  buyerId,
  paymentInfo = {}
) {
  const now = new Date();
  const update = {
    $set: {
      sold: true,
      buyer: buyerId,
      soldAt: now,
      paymentInfo: paymentInfo || {},
    },
    $inc: { soldCount: 1 },
  };

  // Atomic find-and-update: only mark sold if sold was false
  const updated = await this.findOneAndUpdate(
    { _id: listingId, sold: false },
    update,
    { new: true }
  ).exec();

  return updated; // null if already sold
};

// Instance wrapper that uses the atomic static method
listingSchema.methods.markAsSold = async function (buyerId, paymentInfo = {}) {
  if (this.sold) return null;
  const Model = this.constructor;
  const updated = await Model.markSoldIfAvailable(this._id, buyerId, paymentInfo);
  return updated;
};

listingSchema.methods.isSold = function () {
  return !!this.sold;
};

// Optional helper virtuals (not strictly required, but convenient)
listingSchema.virtual("isAuctionActive").get(function () {
  if (!this.startTime || !this.endTime) return false;
  const now = new Date();
  return now >= this.startTime && now <= this.endTime;
});

listingSchema.virtual("currentPriceToShow").get(function () {
  // If sold, we intentionally return null so frontend can hide price and show SOLD badge
  if (this.sold) return null;

  // during auction, show currentBid if present else show starting price
  if (this.isAuctionActive) {
    return this.currentBid && this.currentBid > 0 ? this.currentBid : this.price || 0;
  }
  // after auction (or non-auction), show price
  return this.price || 0;
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
