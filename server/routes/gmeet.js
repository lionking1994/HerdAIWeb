const express = require('express');
const router = express.Router();
const { authenticateToken, verifyApiKey } = require('../middleware/auth');
const gmeetController = require('../controllers/gmeetController');

router.get('/gmeetauth', gmeetController.getGmeetAuth);
router.post('/callback', authenticateToken, gmeetController.handleGmeetCallback);
router.get('/retrieve-meetings-info', authenticateToken, gmeetController.retrieveMeetingsInfo);
router.delete('/disconnect', authenticateToken, gmeetController.disconnectGmeet);
router.post('/set-retrieved-meetings', authenticateToken, gmeetController.setRetrievedMeetings);
router.post('/webhook', gmeetController.webhook);
router.post('/setsametimeRetrievedMeetings', gmeetController.setsametimeRetrievedMeetings);
// router.post('/connect-agent', authenticateToken, gmeetController.connectAgent);
router.post('/enable-scheduling', authenticateToken, gmeetController.enablescheduling);
router.post('/disable-scheduling', authenticateToken, gmeetController.disablescheduling);
router.get('/get-user-upcoming-meetings', authenticateToken, gmeetController.getUserUpcomingMeetings);
router.post('/create-google-calendar-meeting', verifyApiKey, gmeetController.createGoogleCalendarMeeting)

module.exports = router; 