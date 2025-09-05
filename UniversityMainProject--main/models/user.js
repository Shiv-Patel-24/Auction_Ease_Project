// // const mongoose = require("mongoose");
// // const Schema = mongoose.Schema;
// // const passportLocalMongoose = require("passport-local-mongoose")

// // const userSchema = new Schema({
// //     email :{
// //         type: String,
// //         require : true
// //     },
// //     walletBalance: { type: Number, default: 0 },
// //     walletTransactions: [{ type: new Schema({ amount: Number, type: { type: String }, ref: String, createdAt: { type: Date, default: Date.now } }, { _id: false }) }]
// // })

// // userSchema.plugin(passportLocalMongoose)

// // module.exports = mongoose.model('User', userSchema);


// const mongoose = require("mongoose");
// const Schema = mongoose.Schema;
// const passportLocalMongoose = require("passport-local-mongoose");

// const userSchema = new Schema({
//   email: {
//     type: String,
//     required: true, // Corrected from 'require'
//   },

//   // --- Fields added for Google OAuth ---
//   googleId: {
//     type: String,
//   },
//   profilePicture: {
//     type: String,
//   },
//   // --- End of Google OAuth fields ---

//   walletBalance: {
//     type: Number,
//     default: 0,
//   },
//   walletTransactions: [
//     {
//       type: new Schema(
//         {
//           amount: Number,
//           type: { type: String },
//           ref: String,
//           createdAt: { type: Date, default: Date.now },
//         },
//         { _id: false }
//       ),
//     },
//   ],
// });

// // The plugin adds 'username', 'hash', and 'salt' fields automatically.
// userSchema.plugin(passportLocalMongoose);

// module.exports = mongoose.model("User", userSchema);


const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
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
      type: new Schema(
        {
          amount: Number,
          type: { type: String },
          ref: String,
          createdAt: { type: Date, default: Date.now },
        },
        { _id: false }
      ),
    },
  ],

  // Added field to distinguish admin users
  isAdmin: {
    type: Boolean,
    default: false,
  },
});

// The plugin adds 'username', 'hash', and 'salt' fields automatically.
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
