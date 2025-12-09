const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const codegenController = require('../controllers/codegenController');

router.post('/start', authenticateToken, codegenController.startCodegen);
router.get('/status/:taskId', authenticateToken, codegenController.checkStatus);

module.exports = router; 