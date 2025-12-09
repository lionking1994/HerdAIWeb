const express = require('express');
const router = express.Router();
const coresignalController = require('../controllers/coresignalController');

// Test API connection
router.get('/test', coresignalController.testConnection);

// Company endpoints
router.post('/companies/search', coresignalController.searchCompanies);
router.get('/companies/:companyId', coresignalController.getCompanyDetails);
router.get('/companies/:companyId/employees', coresignalController.getCompanyEmployees);
router.get('/companies/:companyId/insights', coresignalController.getCompanyInsights);

// People endpoints
router.post('/people/search', coresignalController.searchPeople);
router.get('/people/:personId', coresignalController.getPersonDetails);

// Usage statistics
router.get('/usage', coresignalController.getUsageStats);

// Agent execution
router.post('/agent/execute', coresignalController.executeAgent);

module.exports = router; 