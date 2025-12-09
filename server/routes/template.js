const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { authenticateToken  } = require('../middleware/auth');

// Get all templates for a company
router.get('/', authenticateToken, templateController.getAllTemplates);

// Get a specific template by ID
router.get('/:id', authenticateToken, templateController.getTemplateById);

// Create a new template
// router.post('/', authenticateToken, checkCompanyAccess, templateController.createTemplate);
router.post('/create-template', authenticateToken,  templateController.createTemplate);

// Update an existing template
// router.put('/:id', authenticateToken, checkCompanyAccess, templateController.updateTemplate);
router.put('/update/:id', authenticateToken,  templateController.updateTemplate);

// Delete a template
// router.delete('/:id', authenticateToken, checkCompanyAccess, templateController.deleteTemplate);
router.delete('/:id', authenticateToken,   templateController.deleteTemplate);

module.exports = router;

