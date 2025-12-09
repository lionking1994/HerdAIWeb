const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const contactusController = require('../controllers/contactusController');

router.post('/send', authenticateToken, contactusController.sendContactMessage);

module.exports = router;

