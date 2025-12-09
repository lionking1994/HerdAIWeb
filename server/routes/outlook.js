const express = require('express');
const router = express.Router();
const { authenticateToken, verifyApiKey } = require('../middleware/auth');
const outlookController = require('../controllers/outlookController');

router.post('/connect', authenticateToken, outlookController.connectOutlook);
router.post('/disconnect', authenticateToken, outlookController.disconnectOutlook);

module.exports = router; 