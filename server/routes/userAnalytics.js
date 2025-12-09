const express = require('express');
const router = express.Router();
const userAnalyticsController = require('../controllers/userAnalyticsController');
const {authenticateToken} = require('../middleware/auth');

// Tracking endpoints (for client-side tracking)
router.post('/session', authenticateToken, userAnalyticsController.trackSession);
router.put('/session', authenticateToken, userAnalyticsController.updateSession);
router.post('/movements', authenticateToken, userAnalyticsController.trackMouseMovements);
router.post('/clicks', authenticateToken, userAnalyticsController.trackClicks);
router.post('/bulk', authenticateToken, userAnalyticsController.trackBulk);
router.post('/update-per-10-seconds', authenticateToken, userAnalyticsController.updatePer10Seconds);

// New comprehensive tracking endpoints
router.post('/track-actions', authenticateToken, userAnalyticsController.trackActions);
router.get('/my-tracking-stats', authenticateToken, userAnalyticsController.getMyTrackingStats);
router.get('/session/:session_id/timeline', authenticateToken, userAnalyticsController.getSessionTimeline);
router.get('/my-recent-actions', authenticateToken, userAnalyticsController.getMyRecentActions);
router.get('/my-sessions', authenticateToken, userAnalyticsController.getMySessions);
router.get('/click-heatmap', authenticateToken, userAnalyticsController.getClickHeatmap);

// Analytics data endpoints
router.get('/my-analytics', authenticateToken, userAnalyticsController.getMyAnalytics);

// Admin endpoints
router.get('/all', authenticateToken, userAnalyticsController.getAllAnalytics);
router.get('/user/:userId', authenticateToken, userAnalyticsController.getUserAnalytics);
router.get('/all-tracking-data', authenticateToken, userAnalyticsController.getAllTrackingData);
router.get('/tracking-data', authenticateToken, userAnalyticsController.getTrackingData);
router.get('/unique-paths', authenticateToken, userAnalyticsController.getUniquePaths);

module.exports = router; 