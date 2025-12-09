const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const searchController = require('../controllers/searchController');

// Add this to your routes
router.get('/search', authenticateToken, searchController.globalSearch);


module.exports = router;
