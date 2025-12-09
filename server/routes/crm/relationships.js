// Relationship routes
// This file will contain relationship-related route definitions
const express = require('express');
const router = express.Router();
const {
  createRelationship,
  getRelationships,
  getRelationshipById,
  updateRelationship,
  deleteRelationship,
  getAccountHierarchy
} = require('../../controllers/crm/relationshipController');

// Relationship management routes
router.post('/', createRelationship);
router.get('/', getRelationships);
router.get('/account/:account_id/hierarchy', getAccountHierarchy);
router.get('/:id', getRelationshipById);
router.put('/:id', updateRelationship);
router.delete('/:id', deleteRelationship);

module.exports = router;