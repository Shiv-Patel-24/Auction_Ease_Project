// require("dotenv").config();

// const express = require("express");
// const app = express();

// /* ✅ Stripe webhook must receive the RAW body (Buffer) BEFORE any JSON/urlencoded parsers */
// app.use("/payment/stripe/webhook", express.raw({ type: "application/json" }));

// /* Normal parsers for everything else */
// app.use(express.json()); // must come before any routes using POST/JSON

// const mongoose = require("mongoose");
// const path = require("path");
// const Listing = require("./models/listing.js");
// const methodOverride = require("method-override");
// const ejsMate = require("ejs-mate");
// const wrapAsync = require("./utils/wrapAsync.js");
// const ExpressError = require("./utils/ExpressError.js");
// const { listingSchema, reviewSchema } = require("./schema.js");
// const session = require("express-session");
// const flash = require("connect-flash");
// const passport = require("passport");
// const LocalStrategy = require("passport-local");
// const User = require("./models/user.js");

// // ✨ ADDED THIS LINE: Require the Google OAuth 2.0 strategy
// const GoogleStrategy = require('passport-google-oauth20').Strategy;

// // Routers
// const listingsRouter = require("./routes/listings.js");
// const reviewsRouter = require("./routes/reviews.js");
// const userRoutes = require("./routes/user.js");
// const paymentRoutes = require("./routes/payment.js");
// const adminRoutes = require('./routes/admin');
// const { isAdmin } = require('./middleware');

// // ✅ Wallet router
// const walletRouter = require("./routes/wallet");

// // MongoDB Connection
// const MONGO_URL = "mongodb://127.0.0.1:27017/finalproject";

// main()
//   .then(() => {
//     console.log("✅ Connected to MongoDB");
//   })
//   .catch((err) => {
//     console.error("❌ MongoDB Error:", err);
//   });

// async function main() {
//   await mongoose.connect(MONGO_URL);
// }

// // View Engine Setup
// app.engine("ejs", ejsMate);
// app.set("view engine", "ejs");
// app.set("views", path.join(__dirname, "views"));

// // Middleware
// app.use(express.static(path.join(__dirname, "public")));
// app.use(express.urlencoded({ extended: true }));
// app.use(methodOverride("_method"));

// // Session & Flash
// const sessionOption = {
//   secret: "mysupersecretcode",
//   resave: false,
//   saveUninitialized: true,
//   cookie: {
//     expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
//     maxAge: 7 * 24 * 60 * 60 * 1000,
//     httpOnly: true,
//   },
// };

// app.use(session(sessionOption));
// app.use(flash());

// // Passport Authentication
// app.use(passport.initialize());
// app.use(passport.session());

// // This is your existing local strategy for username/password login
// passport.use(new LocalStrategy(User.authenticate()));

// // --- ✨ ADDED THIS BLOCK: GOOGLE OAUTH STRATEGY ---
// // This tells Passport how to handle logins with Google
// passport.use(new GoogleStrategy({
//   clientID: process.env.GOOGLE_CLIENT_ID,
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//   callbackURL: "/auth/google/callback" // This must match the URI in Google Cloud Console
// },
// async function(accessToken, refreshToken, profile, done) {
//   try {
//     // 1. Check if a user with this Google ID already exists in your database
//     let user = await User.findOne({ googleId: profile.id });

//     if (user) {
//       // 2. If the user exists, log them in
//       return done(null, user);
//     } else {
//       // 3. If the user does not exist, create a new user in your database
//       const newUser = new User({
//         googleId: profile.id,
//         username: profile.displayName,
//         email: profile.emails[0].value,
//         profilePicture: profile.photos[0].value,
//       });

//       await newUser.save();
//       return done(null, newUser);
//     }
//   } catch (err) {
//     return done(err, false);
//   }
// }
// ));
// // --- END OF GOOGLE OAUTH STRATEGY BLOCK ---

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

// // Global Middleware
// app.use((req, res, next) => {
//   res.locals.success = req.flash("success");
//   res.locals.error = req.flash("error");
//   res.locals.currUser = req.user;

//   // ✅ Make Stripe public key available to all views
//   res.locals.stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

//   // ✅ Hide Navbar + Loader on these routes
//   const noNavbarRoutes = ["/login", "/register"];
//   res.locals.hideNavbar = noNavbarRoutes.includes(req.path);

//   next();
// });

// // ✅ Home Page Route (default when server starts)
// app.get("/", (req, res) => {
//   res.render("home");   // renders views/home.ejs
// });

// // Other Routes
// app.use("/listings", listingsRouter);
// app.use("/listings/:id/reviews", reviewsRouter);
// app.use("/", userRoutes);

// // Stripe + Wallet Routes
// app.use("/payment", paymentRoutes); // includes: /payment/stripe/webhook (gets RAW body from the app-level middleware)
// app.use("/wallet", walletRouter);   // ✅ Wallet routes

// // 404 Handler
// app.all("*", (req, res, next) => {
//   next(new ExpressError(404, "Page Not Found"));
// });

// // Global Error Handler
// app.use((err, req, res, next) => {
//   const { statusCode = 500, message = "Something went wrong!" } = err;
//   res.status(statusCode).render("error.ejs", { message });
// });

// // Start Server
// app.listen(8080, () => {
//   console.log("🚀 Server running on http://localhost:8080");
// });


require("dotenv").config();

const express = require("express");
const app = express();

/* ✅ Stripe webhook must receive the RAW body (Buffer) BEFORE any JSON/urlencoded parsers */
app.use("/payment/stripe/webhook", express.raw({ type: "application/json" }));

/* Normal parsers for everything else */
app.use(express.json()); // must come before any routes using POST/JSON

const mongoose = require("mongoose");
const path = require("path");
const Listing = require("./models/listing.js");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

// ✨ ADDED THIS LINE: Require the Google OAuth 2.0 strategy
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Routers
const listingsRouter = require("./routes/listings.js");
const reviewsRouter = require("./routes/reviews.js");
const userRoutes = require("./routes/user.js");
const paymentRoutes = require("./routes/payment.js");
const adminRoutes = require('./routes/admin');  // Admin routes added
const { isAdmin } = require('./middleware');

// ✅ Wallet router
const walletRouter = require("./routes/wallet");

// MongoDB Connection
const MONGO_URL = "mongodb://127.0.0.1:27017/finalproject";

main()
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("❌ MongoDB Error:", err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

// View Engine Setup
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// Session & Flash
const sessionOption = {
  secret: "mysupersecretcode",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOption));
app.use(flash());

// Passport Authentication
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

// --- GOOGLE OAUTH STRATEGY ---
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
},
async function(accessToken, refreshToken, profile, done) {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (user) {
      return done(null, user);
    } else {
      const newUser = new User({
        googleId: profile.id,
        username: profile.displayName,
        email: profile.emails[0].value,
        profilePicture: profile.photos[0].value,
      });
      await newUser.save();
      return done(null, newUser);
    }
  } catch (err) {
    return done(err, false);
  }
}));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Global Middleware
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;

  res.locals.stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  const noNavbarRoutes = ["/login", "/register"];
  res.locals.hideNavbar = noNavbarRoutes.includes(req.path);

  next();
});

// Home page
app.get("/", (req, res) => {
  res.render("home");
});

// Use your routes
app.use("/listings", listingsRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/", userRoutes);
app.use("/payment", paymentRoutes);
app.use("/wallet", walletRouter);

app.use('/admin', adminRoutes);  // Admin routes added here

// 404 handler
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

// Error handler
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

// Start server
app.listen(8080, () => {
  console.log("🚀 Server running on http://localhost:8080");
});
