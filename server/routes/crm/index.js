const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');

// Debug middleware to log all CRM requests
router.use((req, res, next) => {
  console.log(`🔍 CRM Request: ${req.method} ${req.path}`);
  console.log(`🔍 CRM Headers:`, req.headers);
  next();
});

// Import individual route modules
const tenantRoutes = require('./tenants');
const accountRoutes = require('./accounts');
const contactRoutes = require('./contacts');
const opportunityRoutes = require('./opportunities');
const customFieldRoutes = require('./customFields');
const stageRoutes = require('./stages');
const relationshipRoutes = require('./relationships');
const relationshipTypeRoutes = require('./relationshipTypes');
const searchRoutes = require('./search');
const dashboardRoutes = require('./dashboard');
const researchRoutes = require('./research');

// Apply authentication middleware to all CRM routes
router.use(authenticateToken);

// Debug middleware after auth
router.use((req, res, next) => {
  console.log(`✅ CRM Auth passed for: ${req.method} ${req.path}`);
  console.log(`✅ User:`, req.user);
  next();
});

// Mount individual route modules
router.use('/tenants', tenantRoutes);
router.use('/accounts', accountRoutes);
router.use('/contacts', contactRoutes);
router.use('/opportunities', opportunityRoutes);
router.use('/custom-fields', customFieldRoutes);
router.use('/stages', stageRoutes);
router.use('/relationships', relationshipRoutes);
router.use('/relationship-types', relationshipTypeRoutes);
router.use('/search', searchRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/research', researchRoutes);

module.exports = router;