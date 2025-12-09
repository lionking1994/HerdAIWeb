const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.post('/', authenticateToken, notificationController.getNotification);
router.post('/remove', authenticateToken, notificationController.removeNotification);
router.get('/is-new-notification', authenticateToken, notificationController.isNewNotification);


module.exports = router; 