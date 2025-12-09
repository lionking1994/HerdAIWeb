const express = require('express');
const router = express.Router();
const { authenticateToken, isCompanyAdmin } = require('../middleware/auth');
const companyRolesController = require('../controllers/companyRolesController');

// Get all company roles for a specific company
router.get('/:companyId', authenticateToken, companyRolesController.getCompanyRoles);

// Create a new company role
router.post('/', authenticateToken, isCompanyAdmin, companyRolesController.createCompanyRole);

// Update a company role
router.put('/:roleId', authenticateToken, isCompanyAdmin, companyRolesController.updateCompanyRole);

// Delete a company role
router.delete('/:roleId', authenticateToken, isCompanyAdmin, companyRolesController.deleteCompanyRole);

// Update a user's company role
router.put('/user/:userId', authenticateToken, companyRolesController.updateUserCompanyRole);

// Get a user's company role
router.get('/user/:userId/company/:companyId', authenticateToken, companyRolesController.getUserCompanyRole);


module.exports = router;

