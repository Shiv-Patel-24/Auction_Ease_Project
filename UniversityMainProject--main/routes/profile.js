// routes/profile.js
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { isLoggedIn } = require('../middleware'); // add or adapt your auth middleware

router.get('/', isLoggedIn, profileController.getProfile);

module.exports = router;
