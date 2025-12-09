const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/crm/dashboardController');
const { authenticateToken } = require('../../middleware/auth');

// Dashboard opportunities endpoint
router.get('/opportunities', authenticateToken, dashboardController.getDashboardOpportunities);

// Dashboard projects endpoint
router.get('/projects', authenticateToken, dashboardController.getDashboardProjects);

module.exports = router;
