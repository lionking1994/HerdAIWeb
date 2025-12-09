// Opportunity routes
// This file will contain opportunity-related route definitions
const express = require('express');
const router = express.Router();
const {
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
  getOpportunityWithRelations,
  searchOpportunities,
  checkOpportunityRelations,
  addStageHistoryEntry,
  getOpportunityDetail,
  getOwnerOpportunities,
  deleteOwnerOpportunities,
  stageHistoryDetails
} = require('../../controllers/crm/opportunityController');

// Task controllers for opportunity tasks
const {
  getOpportunityTasks,
  createOpportunityTask,
  linkTaskToOpportunity,
  unlinkTaskFromOpportunity
} = require('../../controllers/taskController');

const { authenticateToken } = require('../../middleware/auth');

// Debug middleware for opportunities routes
router.use((req, res, next) => {
  next();
});


// Opportunity management routes
router.post('/', createOpportunity);
router.get('/', getOpportunities);
router.get('/getOwnerOpportunities', getOwnerOpportunities);
router.post('/search', searchOpportunities);
router.delete('/deleteOpp', deleteOwnerOpportunities)

// Opportunity relationship routes - these need to be before the /:id route to avoid conflicts
router.post('/contacts', require('../../controllers/crm/opportunityContactController').createOpportunityContact);
router.get('/contacts', require('../../controllers/crm/opportunityContactController').getOpportunityContacts);
router.get('/:id/contacts', require('../../controllers/crm/opportunityContactController').getOpportunityContactsByOpportunity);
router.put('/contacts/:id', require('../../controllers/crm/opportunityContactController').updateOpportunityContact);
router.delete('/contacts/:id', require('../../controllers/crm/opportunityContactController').deleteOpportunityContact);

// Opportunity-Template relationship routes (NEW)
const {
  getOpportunityTemplate,
  getOpportunityTemplates,
  attachTemplateToOpportunity,
  updateOpportunityTemplate,
  removeOpportunityTemplate,
  removeSpecificTemplate
} = require('../../controllers/crm/opportunityTemplateController');

router.get('/:opportunityId/template', getOpportunityTemplate);
router.get('/:opportunityId/templates', getOpportunityTemplates);
router.post('/:opportunityId/template', attachTemplateToOpportunity);
router.put('/:opportunityId/template', updateOpportunityTemplate);
router.delete('/:opportunityId/template', removeOpportunityTemplate);
router.delete('/:opportunityId/templates/:templateId', removeSpecificTemplate);

// Opportunity-specific routes (must come after the relationship routes)
router.get('/:id', getOpportunityById);
router.put('/:id', updateOpportunity);
router.delete('/:id', deleteOpportunity);
router.get('/:id/relationships', getOpportunityWithRelations);
router.get('/:id/check-relations', checkOpportunityRelations); // New route for checking relationships
router.get('/:id/detail', authenticateToken, getOpportunityDetail);
router.get('/:id/stage-history-details', authenticateToken, stageHistoryDetails)

// Stage history management (for drag & drop functionality)
router.put('/stage-history/:id', addStageHistoryEntry);

// ==================== OPPORTUNITY TASKS ROUTES ====================
// Get tasks for an opportunity (with pagination, sorting)
router.get('/:opportunityId/tasks', authenticateToken, getOpportunityTasks);

// Create a new task for an opportunity
router.post('/:opportunityId/tasks', authenticateToken, createOpportunityTask);

// Link existing task to opportunity
router.post('/tasks/link', authenticateToken, linkTaskToOpportunity);

// Unlink task from opportunity
router.delete('/tasks/:taskId/unlink', authenticateToken, unlinkTaskFromOpportunity);

module.exports = router;