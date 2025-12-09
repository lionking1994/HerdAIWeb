const express = require('express');
const router = express.Router();
const { getResearchContentByIds } = require('../controllers/researchController');

router.post('/get-research-content-by-ids', getResearchContentByIds);

module.exports = router;