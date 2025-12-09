const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const stripeController = require('../controllers/stripeController');
const bodyParser = require('body-parser');

// Create a Stripe customer
router.post('/customers', authenticateToken, stripeController.createCustomer);

// Create a checkout session
router.post('/checkout-sessions', authenticateToken, stripeController.createCheckoutSession);

// Get user subscriptions
router.get('/subscriptions', authenticateToken, stripeController.getUserSubscriptions);

// Create a billing portal session
router.post('/billing-portal', authenticateToken, stripeController.createBillingPortalSession);

// Add new verify-session route
router.post('/verify-session', authenticateToken, stripeController.verifySession);


// Stripe webhook
// Note: This route doesn't use authenticateToken middleware because Stripe webhooks don't include auth tokens
router.post('/webhook', express.raw({ type: 'application/json' }), stripeController.handleWebhook);

router.post('/a_subscription', authenticateToken, stripeController.getAdminSubscriptions);

router.post('/cancel-subscription/:subscriptionId', authenticateToken, stripeController.cancelSubscription);

module.exports = router;
