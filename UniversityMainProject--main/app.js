require("dotenv").config();

const express = require("express");
const app = express();

/* -----------------------
   Stripe webhook raw body (must be before express.json())
   We mount raw() only on the exact webhook route so other routes use normal json parsing.
   ----------------------- */
app.use("/payment/stripe/webhook", express.raw({ type: "application/json" }));

/* -----------------------
   Normal parsers for everything else
   Use 'verify' to capture the raw body into req.rawBody as a defensive measure.
   ----------------------- */
app.use(
  express.json({
    verify: (req, res, buf) => {
      // store a copy of the raw body buffer on req.rawBody for handlers that want it
      if (buf && buf.length) {
        req.rawBody = buf.toString("utf8");
      }
    },
  })
);

const mongoose = require("mongoose");
const path = require("path");
const Listing = require("./models/listing.js"); // <== model used by auction processor
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

// ✨ Google OAuth 2.0 strategy
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// Routers
const listingsRouter = require("./routes/listings.js");
const reviewsRouter = require("./routes/reviews.js");
const userRoutes = require("./routes/user.js");
const paymentRoutes = require("./routes/payment.js");
const adminRoutes = require("./routes/admin");
const { isAdmin, isLoggedIn } = require("./middleware");

// Orders router (new)
const orderRoutes = require("./routes/orders");

// ✅ Wallet router
const walletRouter = require("./routes/wallet");

// NEW: Profile router (create routes/profile.js as shown earlier)
const profileRoutes = require("./routes/profile");

// MongoDB Connection
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/finalproject";

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
  secret: process.env.SESSION_SECRET || "mysupersecretcode",
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
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        // Try find by googleId first
        let user = await User.findOne({ googleId: profile.id });

        // Or try by email (user registered locally previously)
        if (!user && profile.emails && profile.emails.length) {
          user = await User.findOne({ email: profile.emails[0].value });
        }

        if (user) {
          // Ensure googleId and profilePicture are set when available
          if (!user.googleId) user.googleId = profile.id;
          if (!user.profilePicture && profile.photos && profile.photos[0])
            user.profilePicture = profile.photos[0].value;
          await user.save().catch(() => {}); // ignore save errors here
          return done(null, user);
        }

        // Create new user for first-time Google login
        const newUser = new User({
          googleId: profile.id,
          username:
            profile.displayName ||
            (profile.emails && profile.emails[0] && profile.emails[0].value.split("@")[0]),
          email: profile.emails && profile.emails[0] && profile.emails[0].value,
          profilePicture: profile.photos && profile.photos[0] && profile.photos[0].value,
          isAdmin: false,
        });

        await newUser.save();
        return done(null, newUser);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

// Use explicit serialize/deserialize that works for local & oauth users
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Global Middleware
app.use((req, res, next) => {
  // keep your original locals
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");

  // Expose user to views under both names for backward compatibility:
  // - `currentUser` is used in the new templates
  // - `currUser` preserves older templates that expect this variable
  res.locals.currentUser = req.user || null;
  res.locals.currUser = req.user || null;

  // Stripe key
  res.locals.stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  // Hide Navbar + Loader on these routes (update list if you use different routes)
  const noNavbarRoutes = ["/login", "/register", "/auth/google", "/auth/google/callback"];
  res.locals.hideNavbar = noNavbarRoutes.includes(req.path);

  next();
});

/* -----------------------
   Home page (with Top 5 Selling Products)
   ----------------------- */
app.get("/", async (req, res, next) => {
  try {
    // fetch top 5 listings by soldCount (fallback to empty if none)
    const topListings = await Listing.find({}).sort({ soldCount: -1 }).limit(5).lean();

    res.render("home", { topListings });
  } catch (err) {
    console.error("❌ Error fetching top listings:", err);
    res.render("home", { topListings: [] });
  }
});

/* -----------------------
   Small JSON endpoints used by frontend
   ----------------------- */

// Live wallet balance endpoint used by navbar script
app.get("/api/me/balance", isLoggedIn, (req, res) => {
  try {
    const balance = Number(req.user?.walletBalance || 0);
    return res.json({ balance });
  } catch (err) {
    return res.status(500).json({ error: "Unable to fetch balance" });
  }
});

/* -----------------------
   Mount routers
   ----------------------- */
app.use("/listings", listingsRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/", userRoutes);
app.use("/payment", paymentRoutes); // note: webhook route path is /payment/stripe/webhook
app.use("/wallet", walletRouter);

// Profile routes (displays profile, listings, purchases)
app.use("/profile", profileRoutes);

// Orders (new)
app.use("/orders", orderRoutes);

// Admin routes
app.use("/admin", adminRoutes);

// 404 handler
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

// Error handler
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

/* -----------------------
   Socket.IO integration
   ----------------------- */
const http = require("http");
const { Server } = require("socket.io");

// create http server for socket.io to hook into
const server = http.createServer(app);

// initialize socket.io
const io = new Server(server, {
  // options (CORS etc.) can be added if needed
});

// make io available to route handlers in two ways (compat)
app.set("io", io);
app.locals.io = io;

// socket connection handlers
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // join a listing room — client should emit 'joinListing' with listingId
  socket.on("joinListing", (listingId) => {
    try {
      const room = `listing_${listingId}`;
      socket.join(room);
      socket.emit("joinedListing", { listingId });
      console.log(`Socket ${socket.id} joined room ${room}`);
    } catch (e) {
      console.error("Error on joinListing:", e);
    }
  });

  // leave listing room
  socket.on("leaveListing", (listingId) => {
    try {
      const room = `listing_${listingId}`;
      socket.leave(room);
      socket.emit("leftListing", { listingId });
      console.log(`Socket ${socket.id} left room ${room}`);
    } catch (e) {
      console.error("Error on leaveListing:", e);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

/* -----------------------
   Auction end processor (runs periodically)
   - finds auctions whose endTime <= now and not yet processed
   - sets listing.price to final bid (if any) and marks auctionProcessed=true
   - emits 'auction:ended' event via socket.io so clients can update
   ----------------------- */

async function processEndedAuctions() {
  try {
    const now = new Date();

    // find listings that ended but not processed yet
    const ended = await Listing.find({
      endTime: { $lte: now },
      auctionProcessed: false,
    })
      .lean()
      .exec();

    if (!ended || ended.length === 0) return;

    for (const l of ended) {
      const listingId = l._id;
      // Determine final price: prefer currentBid (if >0) else fallback to listing.price
      const finalPrice = l.currentBid && l.currentBid > 0 ? l.currentBid : l.price || 0;

      try {
        // Mark as processed and set final price atomically
        await Listing.findByIdAndUpdate(listingId, {
          $set: {
            price: finalPrice,
            auctionProcessed: true,
          },
        });

        // Emit socket event to notify clients the auction ended for this listing
        io.emit("auction:ended", {
          listingId: String(listingId),
          finalPrice,
          currentBid: l.currentBid || 0,
          highestBidder: l.highestBidder || null,
        });

        console.log(`Auction processed for listing ${listingId} — finalPrice: ${finalPrice}`);
      } catch (err) {
        console.error(`Failed processing listing ${listingId}:`, err);
      }
    }
  } catch (err) {
    console.error("Error processing ended auctions:", err);
  }
}

// Run immediately and then every 30s
processEndedAuctions();
setInterval(processEndedAuctions, 30 * 1000);

/* -----------------------
   Start server
   ----------------------- */
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
