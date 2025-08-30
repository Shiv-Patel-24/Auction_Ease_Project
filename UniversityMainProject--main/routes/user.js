// // ======================================================================
// //  OLD VERSION (COMMENTED OUT - for reference only)
// // ======================================================================

// // const express = require("express");
// // const router = express.Router();
// // const wrapAsync = require("../utils/wrapAsync");
// // const passport = require("passport");
// // const { saveRedirectUrl } = require("../middleware.js");
// //
// // router.get("/signup", (req, res) => {
// //     res.render("users/signup.ejs");
// // });
// //
// // router.post("/signup", wrapAsync(async(req, res)=>{
// //     try {
// //         let { username, email, password } = req.body;
// //         const newUser = new User({email,  username  });
// //         const registerUser = await User.register(newUser, password)
// //         console.log(registerUser)
// //         req.login(registerUser, (err) => {  
// //             if(err){
// //                 return next(err);
// //             }
// //             req.flash("success", `Welcome ${registerUser.username}!`);
// //             res.render("/listings")
// //         });
// //     } catch (error) {
// //         req.flash("error", error.message);
// //         res.redirect("/signup");
// //     }
// // }))
// //
// // router.get("/login", (req, res) => {
// //     res.render("users/login.ejs");
// // });
// //
// // router.post("/login", saveRedirectUrl,passport.authenticate("local", {  failureRedirect:'/login', failureFlash: true }), async (req, res) => {
// //     req.flash("success", "Welcome to Shiv Project")
// //     let redirectUrl = res.locals.redirectUrl || "/listings"; // if redirectUrl is not set, default to "/listings"
// //     res.redirect(redirectUrl);
// // });
// //
// // router.get("/logout", (req, res) => {   
// //     req.logOut((err) =>{
// //         if((err) =>{
// //             return next(err);
// //         })
// //         req.flash("success", "You have successfully logged out.");
// //         res.redirect("/listings");
// //     });
// // });
// //
// // module.exports = router;


// // ======================================================================
// //  NEW WORKING VERSION (with fixes)
// // ======================================================================

// const express = require("express");
// const router = express.Router();
// const wrapAsync = require("../utils/wrapAsync");
// const passport = require("passport");
// const { saveRedirectUrl } = require("../middleware.js");
// const User = require("../models/user"); // Import User model

// /* =========================
//    GET: Signup form
//    ========================= */
// router.get("/signup", (req, res) => {
//   res.render("users/signup.ejs");
// });

// /* =========================
//    POST: Signup
//    ========================= */
// router.post(
//   "/signup",
//   wrapAsync(async (req, res, next) => {
//     try {
//       const { username, email, password } = req.body;
//       const newUser = new User({ email, username });
//       const registeredUser = await User.register(newUser, password);

//       req.login(registeredUser, (err) => {
//         if (err) return next(err);
//         req.flash("success", `Welcome ${registeredUser.username}!`);
//         return res.redirect("/listings"); // ✅ go to listings after signup
//       });
//     } catch (error) {
//       req.flash("error", error.message);
//       res.redirect("/signup");
//     }
//   })
// );

// /* =========================
//    GET: Login form
//    ========================= */
// router.get("/login", (req, res) => {
//   res.render("users/login.ejs");
// });

// /* =========================
//    POST: Login
//    ========================= */
// router.post(
//   "/login",
//   saveRedirectUrl, // may set res.locals.redirectUrl
//   passport.authenticate("local", {
//     failureRedirect: "/login",
//     failureFlash: true,
//   }),
//   (req, res) => {
//     req.flash("success", "Welcome back!");

//     // Start with provided redirect or default to /listings
//     let redirectUrl = res.locals.redirectUrl || "/listings";

//     // Ensure it's safe (string + relative path)
//     if (typeof redirectUrl !== "string" || !redirectUrl.startsWith("/")) {
//       redirectUrl = "/listings";
//     }

//     // Disallow API-ish or non-landing endpoints
//     const disallowedTargets = [
//       /^\/wallet\/balance\b/i,
//       /^\/payment\/stripe\/webhook\b/i,
//       /^\/payment\/create-checkout-session\b/i,
//       /^\/api\b/i,
//     ];
//     if (disallowedTargets.some((rx) => rx.test(redirectUrl))) {
//       redirectUrl = "/listings";
//     }

//     // Clear returnTo if set
//     if (req.session) delete req.session.returnTo;

//     return res.redirect(redirectUrl);
//   }
// );

// /* =========================
//    GET: Logout
//    ========================= */
// router.get("/logout", (req, res, next) => {
//   req.logout((err) => {
//     if (err) return next(err);
//     req.flash("success", "You have successfully logged out.");
//     res.redirect("/listings"); // ✅ always to listings
//   });
// });

// module.exports = router;


const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware.js");
const User = require("../models/user"); // Import User model

/* =========================
   GET: Signup form
   ========================= */
router.get("/signup", (req, res) => {
  res.render("users/signup.ejs");
});

/* =========================
   POST: Signup
   ========================= */
router.post(
  "/signup",
  wrapAsync(async (req, res, next) => {
    try {
      const { username, email, password } = req.body;
      const newUser = new User({ email, username });
      const registeredUser = await User.register(newUser, password);

      req.login(registeredUser, (err) => {
        if (err) return next(err);
        req.flash("success", `Welcome ${registeredUser.username}!`);
        return res.redirect("/listings"); // ✅ go to listings after signup
      });
    } catch (error) {
      req.flash("error", error.message);
      res.redirect("/signup");
    }
  })
);

/* =========================
   GET: Login form
   ========================= */
router.get("/login", (req, res) => {
  res.render("users/login.ejs");
});

/* =========================
   POST: Login
   ========================= */
router.post(
  "/login",
  saveRedirectUrl, // may set res.locals.redirectUrl
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    req.flash("success", "Welcome back!");

    // Start with provided redirect or default to /listings
    let redirectUrl = res.locals.redirectUrl || "/listings";

    // Ensure it's safe (string + relative path)
    if (typeof redirectUrl !== "string" || !redirectUrl.startsWith("/")) {
      redirectUrl = "/listings";
    }

    // Disallow API-ish or non-landing endpoints
    const disallowedTargets = [
      /^\/wallet\/balance\b/i,
      /^\/payment\/stripe\/webhook\b/i,
      /^\/payment\/create-checkout-session\b/i,
      /^\/api\b/i,
    ];
    if (disallowedTargets.some((rx) => rx.test(redirectUrl))) {
      redirectUrl = "/listings";
    }

    // Clear returnTo if set
    if (req.session) delete req.session.returnTo;

    return res.redirect(redirectUrl);
  }
);

/* =========================
   ✨ GOOGLE OAUTH ROUTES ✨
   ========================= */

// GET /auth/google -> The route that starts the Google login process
router.get('/auth/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'] // We ask Google for the user's profile and email
  })
);

// GET /auth/google/callback -> The route Google redirects back to after login
router.get('/auth/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login', // If login fails, redirect back to the login page
    failureFlash: true
  }),
  (req, res) => {
    // On successful authentication, this function is called.
    req.flash('success', `Welcome to AuctionEase, ${req.user.username}!`);
    res.redirect('/listings'); // Redirect to the main listings page
  }
);


/* =========================
   GET: Logout
   ========================= */
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You have successfully logged out.");
    res.redirect("/"); // ✅ always to listings
  });
});

module.exports = router;