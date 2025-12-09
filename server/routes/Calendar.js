const express = require('express');
const router = express.Router();
const { authenticateToken, verifyApiKey } = require('../middleware/auth');
const calendarController = require('../controllers/calendarController');

router.get('/get-All-Upcoming-Meeting', authenticateToken, calendarController.getAllUpcomingMeeting);
router.get('/get-upcoming-meetings-understand-schedule', authenticateToken, calendarController.getUpcomingMeetingsUnderstandSchedule);
router.get('/get-teams-calendar', authenticateToken, calendarController.getTeamsCalendar)

module.exports = router; 
