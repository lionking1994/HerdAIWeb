const express = require('express');
const router = express.Router();
const { authenticateToken, isCompanyAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/organizationController');

// Organizations CRUD
router.get('/:companyId', authenticateToken, isCompanyAdmin, ctrl.listOrganizations);
router.post('/', authenticateToken, isCompanyAdmin, ctrl.createOrganization);
router.put('/:id', authenticateToken, isCompanyAdmin, ctrl.updateOrganization);
router.delete('/:id', authenticateToken, isCompanyAdmin, ctrl.deleteOrganization);

// Role tree for an organization
router.get('/:organizationId/role-tree', authenticateToken, isCompanyAdmin, ctrl.getRoleTree);
router.post('/:organizationId/role-tree', authenticateToken, isCompanyAdmin, ctrl.bulkSaveRoleTree);

module.exports = router;


