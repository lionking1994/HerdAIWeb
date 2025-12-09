const express = require('express');
const router = express.Router();
const promptController = require('../controllers/promptController');
const { authenticateToken, verifyApiKey } = require('../middleware/auth');

router.put('/', authenticateToken, promptController.updatePrompt);
router.get('/:prompt_title', authenticateToken, promptController.getPrompt);
router.post('/test', authenticateToken, promptController.testPrompt);
router.post('/output_type', authenticateToken, promptController.outputType);

module.exports = router;
