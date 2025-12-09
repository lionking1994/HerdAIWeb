const express = require('express');
const router = express.Router();
const { authenticateToken, checkRole } = require('../middleware/auth');
const feedbackController = require('../controllers/feedbackController');
const uploadFile = require('../middleware/upload_file');

router.post('/save-feedback', authenticateToken, uploadFile.single('attachment'), feedbackController.saveFeedback);
router.post('/feedbackStatistic', feedbackController.feedbackStatistic);
router.post('/get-feedback-details', feedbackController.getFeedbackDetails);
router.put('/update-status', authenticateToken, feedbackController.updateFeedbackStatus);
router.get('/all', authenticateToken, feedbackController.getAllFeedback);
router.get('/stats', authenticateToken, feedbackController.getFeedbackStats);
router.get('/get-feedback-details-by-id/:feedbackId', authenticateToken, feedbackController.getFeedbackDetailsById);
router.put('/update/:feedbackId', authenticateToken, feedbackController.updateFeedback);

module.exports = router;

