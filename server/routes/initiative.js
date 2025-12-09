const express = require('express');
const router = express.Router();
const { authenticateToken, isCompanyAdmin } = require('../middleware/auth');
const initiativeController = require('../controllers/initiativeController');

// Route to get initiative intelligence data
router.post('/initiative-intelligence', authenticateToken, initiativeController.getInitiativeIntelligence);

module.exports = router;
