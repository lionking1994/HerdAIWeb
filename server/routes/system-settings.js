const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const systemSettingsController = require('../controllers/systemSettingController');

router.get('/', systemSettingsController.getSettings);
router.put('/', systemSettingsController.updateSettings);
router.get('/threshold', systemSettingsController.getThreshold);
router.put('/threshold', systemSettingsController.updateThreshold);
router.delete('/threshold', systemSettingsController.deleteThreshold);
router.post('/threshold/initialize', systemSettingsController.initializeThreshold);

// Agent Configuration routes
router.get('/agent-config', systemSettingsController.getAgentConfig);
router.put('/agent-config', systemSettingsController.updateAgentConfig);

// New routes for individual agent API keys
router.get('/agent-api-keys', authenticateToken, systemSettingsController.getAgentApiKeys);
router.get('/agent-api-keys/:keyType', authenticateToken, systemSettingsController.getAgentApiKeyByType);

router.get('/stripe-config', authenticateToken, systemSettingsController.getStripeConfig);
router.put('/stripe-config', authenticateToken, systemSettingsController.updateStripeConfig);
router.put('/stripe-environment', authenticateToken, systemSettingsController.stripeEnvironment);
router.get('/stripe-products', systemSettingsController.stripeProducts);
router.post('/add-product', systemSettingsController.addProduct);
router.post('/archive-product', systemSettingsController.archiveProduct);
router.post('/stripe-products/:id', systemSettingsController.updateProduct);
router.get('/getProductivityQuoteForaday', authenticateToken, systemSettingsController.getProductivityQuoteForaday);

// API Configuration routes
router.post('/api-config/:configId/models', authenticateToken, systemSettingsController.addModel);
router.put('/api-config/:configId/models/:modelId', authenticateToken, systemSettingsController.updateModel);
router.delete('/api-config/:configId/models/:modelId', authenticateToken, systemSettingsController.deleteModel);
router.get('/api-config/:configId', authenticateToken, systemSettingsController.getApiConfig);
router.get('/api-config', systemSettingsController.getApiConfigs);
router.post('/api-config', systemSettingsController.createApiConfig);
router.put('/api-config/:id', systemSettingsController.updateApiConfig);
router.delete('/api-config/:id', systemSettingsController.deleteApiConfig);

module.exports = router;
