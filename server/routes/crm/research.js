const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { getTenantId } = require('../../utils/crm');
const crmResearchController = require('../../controllers/crm/crmResearchController');

/**
 * CRM Research Routes
 * Separate from existing research routes to avoid conflicts
 */

/**
 * Start company research for an opportunity
 * POST /api/crm/research/company
 */
router.post('/company', authenticateToken, async (req, res) => {
  try {
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    req.body.tenantId = tenantId;
    await crmResearchController.startCompanyResearch(req, res);
  } catch (error) {
    console.error('Error in company research route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error in company research route'
    });
  }
 });

/**
 * Start contact research for an opportunity
 * POST /api/crm/research/contact
 */
router.post('/contact', authenticateToken, async (req, res) => {
  try {
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    req.body.tenantId = tenantId;
    await crmResearchController.startContactResearch(req, res);
  } catch (error) {
    console.error('Error in contact research route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error in contact research route'
    });
  }
 });

/**
 * Start both company and contact research for an opportunity
 * POST /api/crm/research/opportunity
 */
router.post('/opportunity', authenticateToken, async (req, res) => {
  try {
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    req.body.tenantId = tenantId;
    await crmResearchController.startOpportunityResearch(req, res);
  } catch (error) {
    console.error('Error in opportunity research route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error in opportunity research route'
    });
  }
 });

/**
 * Check if research exists and is completed for an opportunity
 * GET /api/crm/research/check/:opportunityId/:tenantId
 */
router.get('/check/:opportunityId/:tenantId', authenticateToken, async (req, res) => {
  try {
    await crmResearchController.checkResearchExists(req, res);
  } catch (error) {
    console.error('Error in research check route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error in research check route'
    });
  }
});

/**
 * Get research status for an opportunity
 * GET /api/crm/research/status/:opportunityId/:tenantId
 */
router.get('/status/:opportunityId/:tenantId', authenticateToken, async (req, res) => {
  try {
    await crmResearchController.getResearchStatus(req, res);
  } catch (error) {
    console.error('Error in research status route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error in research status route'
    });
  }
});

/**
 * Get research results for an opportunity
 * GET /api/crm/research/results/:opportunityId/:tenantId
 */
router.get('/results/:opportunityId/:tenantId', authenticateToken, async (req, res) => {
  try {
    await crmResearchController.getResearchResults(req, res);
  } catch (error) {
    console.error('Error in research results route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error in research results route'
    });
  }
});

/**
 * Clear incomplete research records for an opportunity
 * DELETE /api/crm/research/clear/:opportunityId/:tenantId
 */
router.delete('/clear/:opportunityId/:tenantId', authenticateToken, async (req, res) => {
  try {
    await crmResearchController.clearIncompleteResearch(req, res);
  } catch (error) {
    console.error('Error in clear research route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error in clear research route'
    });
  }
});

module.exports = router;
