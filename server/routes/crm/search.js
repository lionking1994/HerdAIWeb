// Search routes
// This file will contain search-related route definitions
const express = require('express');
const router = express.Router();
const {
  globalSearch,
  entitySearch
} = require('../../controllers/crm/searchController');

// Search routes
router.get('/global', globalSearch);
router.post('/:entity_type', entitySearch);

module.exports = router;