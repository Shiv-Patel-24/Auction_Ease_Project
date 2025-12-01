// models/user.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

// Sub-schema for wallet transactions
const walletTransactionSchema = new Schema(
  {
    amount: Number,
    type: { type: String }, // e.g. "credit" or "debit"
    ref: String,            // transaction reference
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new Schema({
  // passport-local-mongoose will add 'username', 'hash', 'salt' automatically
  email: {
    type: String,
    required: true,
  },

  // --- Fields added for Google OAuth ---
  googleId: {
    type: String,
  },
  profilePicture: {
    type: String,
  },
  // --- End of Google OAuth fields ---

  walletBalance: {
    type: Number,
    default: 0,
  },
  walletTransactions: [
    {
      type: walletTransactionSchema,
    },
  ],

  // --- Admin field ---
  isAdmin: {
    type: Boolean,
    default: false, // by default all users are regular users
  },
});

// Add passport-local-mongoose plugin (adds username, password hash, etc.)
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
