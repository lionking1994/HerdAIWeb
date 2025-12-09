// Custom field routes
// This file will contain custom field-related route definitions
const express = require('express');
const router = express.Router();
const {
  createCustomField,
  getCustomFields,
  getCustomFieldById,
  updateCustomField,
  deleteCustomField,
  getCustomFieldSchema
} = require('../../controllers/crm/customFieldController');

// Custom field management routes
router.post('/', createCustomField);
router.get('/', getCustomFields);
router.get('/table/:table_name', getCustomFieldSchema); // Add route for table-specific custom fields
router.get('/schema/:table_name', getCustomFieldSchema);
router.get('/:id', getCustomFieldById);
router.put('/:id', updateCustomField);
router.delete('/:id', deleteCustomField);

module.exports = router;