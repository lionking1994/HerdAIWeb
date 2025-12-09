// Contact routes
// This file will contain contact-related route definitions
const express = require('express');
const router = express.Router();
const {
  createContact,
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
  getContactWithRelations,
  searchContacts
} = require('../../controllers/crm/contactController');

// Debug middleware for contacts routes
router.use((req, res, next) => {
  console.log(`📝 Contacts Route: ${req.method} ${req.path}`);
  console.log(`📝 Request Body:`, req.body);
  console.log(`📝 Route matched:`, req.route?.path || 'No route matched');
  console.log(`📝 Params:`, req.params);
  console.log(`📝 Original URL:`, req.originalUrl);
  console.log(`📝 Base URL:`, req.baseUrl);
  console.log(`📝 Path:`, req.path);
  console.log(`📝 URL:`, req.url);
  next();
});

// Contact management routes
router.post('/', createContact);
router.get('/', getContacts);
router.post('/search', searchContacts);

// Test route to verify routing is working
router.get('/test-routing', (req, res) => {
  console.log('🧪 Test route hit!');
  res.json({ success: true, message: 'Test route working', params: req.params, path: req.path });
});

// Contact relationship routes - these need to be before the /:id route to avoid conflicts
router.post('/accounts', require('../../controllers/crm/accountContactController').createAccountContact);
router.get('/accounts', require('../../controllers/crm/accountContactController').getAccountContacts);
router.delete('/accounts/:id', require('../../controllers/crm/accountContactController').deleteAccountContact);

router.post('/opportunities', require('../../controllers/crm/opportunityContactController').createOpportunityContact);
router.get('/opportunities', require('../../controllers/crm/opportunityContactController').getOpportunityContacts);
router.delete('/opportunities/:id', require('../../controllers/crm/opportunityContactController').deleteOpportunityContact);

// Contact-specific relationship routes (must come BEFORE general /:id routes)
router.get('/:id/accounts', require('../../controllers/crm/accountContactController').getContactAccounts);
router.get('/:id/opportunities', require('../../controllers/crm/opportunityContactController').getContactOpportunities);
router.get('/:id/relationships', getContactWithRelations);

// General contact management routes (must come AFTER specific relationship routes)
router.get('/:id', getContactById);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;