const express = require('express');
const router = express.Router();
const { authenticateToken, isCompanyAdmin, isAdmin } = require('../middleware/auth');
const userController = require('../controllers/userController');

// Get company users (for dropdowns/selectors)
router.get('/company-users', authenticateToken, userController.getCompanyUsers);

router.post('/search', authenticateToken, userController.search);
router.post('/searchAgent', authenticateToken, userController.searchAgent);
router.post('/get', authenticateToken, userController.get);
router.post('/usersData', userController.statisticUser);
router.post('/all', userController.getAllUsers);
router.put('/update-role', userController.updateUserRole);
router.put('/update-status', authenticateToken, isAdmin, userController.updateUserStatus);
router.post('/update-company-role', authenticateToken, isCompanyAdmin, userController.updateCompanyUserRole);
router.post('/productivity-score', authenticateToken, userController.getProductivityScore);
router.post('/update-linkedin', authenticateToken, userController.updateLinkedinUrl);
router.post('/get-username-by-id', authenticateToken, userController.getUsernameById);

// Consolidation endpoints
router.post('/consolidation-accounts', authenticateToken, isAdmin, userController.getConsolidationAccounts);
router.post('/consolidate-accounts', authenticateToken, isAdmin, userController.consolidateAccounts);

module.exports = router;

