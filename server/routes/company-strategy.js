const express = require('express');
const router = express.Router();
const companyStrategyController = require('../controllers/companyStrategyController');
const { authenticateToken } = require('../middleware/auth');

// Since we're already at /api/company-strategy, we don't need to repeat 'company-strategy' in the routes
router.post('/intelligence', companyStrategyController.intelligencegraph);
router.post('/opportunity-node-graph',authenticateToken, companyStrategyController.email_intelligencegraph);
router.post('/participant-value-analysis', companyStrategyController.participantvalueanalysis);
router.get('/years/:companyId', companyStrategyController.getAvailableYears);
router.post('/score-meeting', companyStrategyController.scoreMeeting);
router.get('/:companyId', companyStrategyController.getStrategies);
router.post('/:companyId', companyStrategyController.createStrategy);
router.put('/:id', companyStrategyController.updateStrategy);
router.delete('/:id', companyStrategyController.deleteStrategy);

module.exports = router;