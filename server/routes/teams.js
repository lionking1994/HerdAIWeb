const express = require('express');
const router = express.Router();
const { authenticateToken, verifyApiKey } = require('../middleware/auth');
const teamsController = require('../controllers/teamsController');

router.get('/login', teamsController.login);
router.post('/azurecallback', authenticateToken, teamsController.handleAzureCallback);
router.post('/callback', authenticateToken, teamsController.handleTeamsCallback);
router.post('/disconnect', authenticateToken, teamsController.disconnectTeams);
router.post('/activate', authenticateToken, teamsController.activateTeams);
router.post('/webhook', teamsController.handleTeamsWebhook);
router.post('/create-meeting', authenticateToken, teamsController.createMeeting);
router.get('/retrieve-meetings-info', authenticateToken, teamsController.retrieveMeetingsInfo);
router.post('/set-retrieved-meetings', authenticateToken, teamsController.setRetrievedMeetings);
router.post('/transcription-webhook', teamsController.handleTranscriptionWebhook);
router.get('/checkuseris-admin', authenticateToken, teamsController.checkIfUserIsAdmin);
router.post('/teams-calendar-schedule', authenticateToken, teamsController.getTeamsCalendarSchedule);
router.post('/updatemeetingdb', teamsController.updatemeetingdbapi);
router.post('/schedule-teams-meeting', authenticateToken, teamsController.scheduleTeamsMeeting);
router.post('/schedule-teams-meeting-agent', verifyApiKey, teamsController.scheduleTeamsMeetingAgent);
router.get('/get-user-upcoming-meetings', authenticateToken, teamsController.getUserUpcomingMeetings);
router.post('/enable-scheduling', authenticateToken, teamsController.enablescheduling);
router.post('/disable-scheduling', authenticateToken, teamsController.disablescheduling);
router.post('/azureredirect', authenticateToken, teamsController.handleAzureredirect);
router.post('/get-free-slot-time-getherd-calendar', authenticateToken, teamsController.getFreeSlotTimeGetherdCalendar);
router.post('/handleEmailWebhook',teamsController.handleEmailWebhook)

module.exports = router; 