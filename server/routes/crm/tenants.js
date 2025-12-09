// Tenant routes
// This file will contain tenant-related route definitions
const express = require('express');
const router = express.Router();
const {
  getTenantInfo,
  updateTenant,
  getTenantSettings,
  updateTenantSettings,
  getTenantDashboard
} = require('../../controllers/crm/tenantController');

// Tenant management routes
router.get('/info', getTenantInfo);
router.put('/info', updateTenant);
router.get('/settings', getTenantSettings);
router.put('/settings', updateTenantSettings);
router.get('/dashboard', getTenantDashboard);

module.exports = router;