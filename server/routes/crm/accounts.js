// Account routes
// This file will contain account-related route definitions
const express = require('express');
const router = express.Router();
const {
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  getAccountWithRelations,
  searchAccounts,
  checkAccountRelations,
  getPipeLineData
} = require('../../controllers/crm/accountController');

// Debug middleware for accounts routes
router.use((req, res, next) => {
  console.log(`📝 Accounts Route: ${req.method} ${req.path}`);
  console.log(`📝 Request Body:`, req.body);
  next();
});

// Account management routes
router.post('/', createAccount);
router.get('/', getAccounts);
router.post('/search', searchAccounts);

// Account-specific routes (must come before the general relationship routes)
router.get('/:id', getAccountById);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);
router.get('/:id/relationships', getAccountWithRelations);
router.get('/:id/check-relations', checkAccountRelations); // New route for checking relationships

// Account relationship routes - these need to be after the /:id routes to avoid conflicts
router.post('/contacts', require('../../controllers/crm/accountContactController').createAccountContact);
router.get('/contacts', require('../../controllers/crm/accountContactController').getAccountContacts);
router.get('/:id/contacts', require('../../controllers/crm/accountContactController').getAccountContactsByAccount);
router.put('/contacts/:id', require('../../controllers/crm/accountContactController').updateAccountContact);
router.delete('/contacts/:id', require('../../controllers/crm/accountContactController').deleteAccountContact);

router.post('/relationships', require('../../controllers/crm/accountRelationshipController').createAccountRelationship);
router.get('/relationships', require('../../controllers/crm/accountRelationshipController').getAccountRelationships);
router.get('/:id/relationships', require('../../controllers/crm/accountRelationshipController').getAccountRelationshipsByAccount);
router.put('/relationships/:id', require('../../controllers/crm/accountRelationshipController').updateAccountRelationship);
router.delete('/relationships/:id', require('../../controllers/crm/accountRelationshipController').deleteAccountRelationship);

router.post('/getPipeLineData', getPipeLineData)
module.exports = router;