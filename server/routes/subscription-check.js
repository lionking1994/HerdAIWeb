const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const subscriptionCheckController = require('../controllers/subscriptionCheckController');

// Check if user needs to subscribe
router.get('/status', authenticateToken, subscriptionCheckController.checkSubscriptionNeeded);

// Increment user's meeting count
router.post('/increment-meeting-count', authenticateToken, subscriptionCheckController.incrementMeetingCount);

// Reset user's meeting count
router.post('/reset-meeting-count', authenticateToken, subscriptionCheckController.resetMeetingCount);

module.exports = router;
