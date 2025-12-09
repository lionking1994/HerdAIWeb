const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const userLicenseController = require('../controllers/userLicenseController');

// Get all licenses (admin only) - legacy endpoint
router.get('/', authenticateToken, isAdmin, userLicenseController.getAllLicenses);

// Get all licenses with pagination, sorting, and filtering (admin only)
router.post('/all', authenticateToken, isAdmin, userLicenseController.getAllLicenses);

// Get licenses for a specific company
router.get('/company/:companyId', authenticateToken, userLicenseController.getCompanyLicenses);

// Get a license by ID
router.get('/:id', authenticateToken, userLicenseController.getLicenseById);

// Create a new license (for non-credit card payments)
router.post('/', authenticateToken, userLicenseController.createLicense);

// Stripe Payment Integration Routes
// Create Stripe payment intent for credit card payment
router.post('/payment-intent', authenticateToken, userLicenseController.createPaymentIntent);

// Create Stripe checkout session for credit card payment
router.post('/checkout-session', authenticateToken, userLicenseController.createCheckoutSession);

// Create recurring subscription for license purchase
router.post('/recurring-subscription', authenticateToken, userLicenseController.createRecurringSubscription);

// Create Stripe checkout session for user license (redirect to Stripe)
router.post('/stripe-checkout', authenticateToken, userLicenseController.createCheckoutSession);

// Confirm payment and activate license
router.post('/confirm-payment', authenticateToken, userLicenseController.confirmPayment);

// Stripe webhook handler (no authentication required for webhooks)
router.post('/webhook', express.raw({ type: 'application/json' }), userLicenseController.handleWebhook);

// // Verify Stripe checkout session
// router.post('/verify-session', authenticateToken, userLicenseController.verifySession);

// Update a license (admin only)
router.put('/:id', authenticateToken, isAdmin, userLicenseController.updateLicense);

// Generate payment link for a license (admin only)
router.post('/:id/generate-payment-link', authenticateToken, isAdmin, userLicenseController.generatePaymentLink);

// Send payment link via email (admin only)
router.post('/:id/send-payment-link-email', authenticateToken, isAdmin, userLicenseController.sendPaymentLinkEmail);

// Delete a license (admin only)
router.delete('/:id', authenticateToken, isAdmin, userLicenseController.deleteLicense);

// Get active products for license selection
router.get('/products/active', authenticateToken, userLicenseController.getActiveProducts);

// Get subscription cancellation logs (admin only)
router.get('/cancellation-logs', authenticateToken, isAdmin, userLicenseController.getCancellationLogs);

module.exports = router;

