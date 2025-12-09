const express = require('express');
const router = express.Router();
const { authenticateToken, verifyApiKey } = require('../middleware/auth');
const zoomController = require('../controllers/zoomController');

router.get('/zoomauth', zoomController.getZoomAuth);
router.post('/callback', authenticateToken, zoomController.handleZoomCallback);
router.delete('/disconnect', authenticateToken, zoomController.disconnectZoom);
router.post('/activate', authenticateToken, zoomController.activateZoom);
router.get('/retrieve-meetings-info', authenticateToken, zoomController.retrieveMeetingsInfo);
router.post('/set-retrieved-meetings', authenticateToken, zoomController.setRetrievedMeetings);
router.post('/webhook', zoomController.webhook);
router.post('/connect-agent', authenticateToken, zoomController.connectAgent);
router.delete('/disconnect-agent', authenticateToken, zoomController.disconnectAgent);
router.post('/enable-scheduling', authenticateToken, zoomController.enablescheduling);
router.post('/disable-scheduling', authenticateToken, zoomController.disablescheduling);
router.post('/addAttendees', zoomController.addAttendees);
router.get('/get-user-upcoming-meetings', authenticateToken, zoomController.getUserUpcomingMeetings);
router.post('/create-zoom-meeting', verifyApiKey, zoomController.scheduleZoomMeeting);

module.exports = router; 