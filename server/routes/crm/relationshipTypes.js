const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const {
  createRelationshipType,
  getRelationshipTypes,
  getRelationshipTypeById,
  updateRelationshipType,
  deleteRelationshipType,
  getEntityTypeCombinations,
  bulkUpdateSortOrder
} = require('../../controllers/crm/relationshipTypeController');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all relationship type definitions
router.get('/', getRelationshipTypes);

// Get entity type combinations
router.get('/combinations', getEntityTypeCombinations);

// Get relationship type definition by ID
router.get('/:id', getRelationshipTypeById);

// Create new relationship type definition
router.post('/', createRelationshipType);

// Update relationship type definition
router.put('/:id', updateRelationshipType);

// Delete relationship type definition
router.delete('/:id', deleteRelationshipType);

// Bulk update sort order
router.put('/sort-order/bulk', bulkUpdateSortOrder);

module.exports = router;
