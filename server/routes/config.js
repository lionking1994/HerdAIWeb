const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const configController = require('../controllers/configController');
router.get('/stripe-key',  authenticateToken, configController.stripeKey);

module.exports = router;