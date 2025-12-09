const express = require('express');
const router = express.Router();
const { authenticateToken, verifyApiKey } = require('../middleware/auth');
const meetingController = require('../controllers/meetingController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
router.get('/meeting_list', authenticateToken, meetingController.getMeetingList);
router.get('/upcoming', authenticateToken, meetingController.getUpcomingMeetings);
router.get('/meeting_details', authenticateToken, meetingController.getMeetingDetails);
router.get('/api_settings', authenticateToken, meetingController.getApiSettings);
router.get('/get-file-url', authenticateToken, meetingController.getFileUrl);
router.post('/update-transcription', authenticateToken, meetingController.updateTranscription);
router.get('/meeting_all_list', authenticateToken, meetingController.getMeetingAllList);
router.post('/add_user_to_meeting', authenticateToken, meetingController.addUserToMeeting);
router.post('/delete', authenticateToken, meetingController.deleteMeeting);
router.post('/meetingsData', meetingController.statisticMeeting);
router.post('/top-expensive-meetings', meetingController.getTopExpensiveMeetings);
router.post('/meeting-analytics', authenticateToken, meetingController.getMeetingAnalytics);
router.post('/upcomingmeetingalert', meetingController.upcomingMeetingAlert);
router.post('/preview-prompt', authenticateToken, meetingController.previewPrompt)
router.post('/company-meetings/:companyId', authenticateToken, meetingController.companyMeetings);
router.get('/meetings-dropdown/:companyId', authenticateToken, meetingController.getMeetingsForDropdown);
router.post('/uploadMeetingAudio', authenticateToken, upload.single('audio'), meetingController.uploadMeetingAudio);
router.post('/prepare', verifyApiKey, meetingController.prepareMeeting);
router.post('/upcoming-meeting-alert-test', meetingController.upcomingMeetingAlertTest)
router.post("/remove_participant", authenticateToken, meetingController.removeParticipant);
router.post('/todays-schedule', authenticateToken, meetingController.todaysSchedule);
router.get("/available-meeting-types", authenticateToken, meetingController.availableMeetingTypes);
router.post('/get-research-topic', authenticateToken, meetingController.getResearchTopic);
router.post('/get-users-upcoming-meetings', verifyApiKey, meetingController.getUsersUpcomingMeetings);
router.post('/get-last-10-meetings', authenticateToken, meetingController.getLast10Meetings);
router.post('/get-time-in-meetings-percentage', authenticateToken, meetingController.getTimeInMeetingsPercentage);
router.post('/getLastThreeMeetings', authenticateToken, meetingController.getLastThreeMeetings);
router.post('/schedule-meeting', verifyApiKey, meetingController.scheduleMeeting);

module.exports = router; 
