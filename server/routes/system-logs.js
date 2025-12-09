const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const systemLogsController = require('../controllers/systemLogsController');

// Since we're already at /api/company-strategy, we don't need to repeat 'company-strategy' in the routes
router.get('/all', authenticateToken, systemLogsController.getAllLogs);

module.exports = router;