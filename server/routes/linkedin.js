const express = require("express");
const router = express.Router();
const linkedinController = require("../controllers/linkedinController");
const { authenticateToken } = require("../middleware/auth");

// LinkedIn authentication
router.get('/linkedinauth', linkedinController.getLinkedinAuth);

// LinkedIn callback
router.get('/callback', authenticateToken, linkedinController.handleLinkedinCallback);

// Disconnect LinkedIn
router.delete('/disconnect', authenticateToken, linkedinController.disconnect);

// Get LinkedIn profile data
router.get('/profile-data', authenticateToken, linkedinController.getProfileData);

module.exports = router;

