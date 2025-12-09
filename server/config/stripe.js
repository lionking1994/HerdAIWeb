const Stripe = require('stripe');
require('dotenv').config();

/**
 * Get Stripe instance
 * @returns {Object} Stripe instance
 */
exports.getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('Stripe secret key is not defined in environment variables');
  }
  
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16', // Use the latest API version
    appInfo: {
      name: 'Herd App',
      version: '1.0.0'
    }
  });
};

/**
 * Get Stripe publishable key
 * @returns {string} Stripe publishable key
 */
exports.getPublishableKey = () => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    throw new Error('Stripe publishable key is not defined in environment variables');
  }
  
  return publishableKey;
};

/**
 * Get Stripe webhook secret
 * @returns {string} Stripe webhook secret
 */
exports.getWebhookSecret = () => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('Stripe webhook secret is not defined in environment variables');
  }
  
  return webhookSecret;
};

/**
 * Get client URL for Stripe redirects
 * @returns {string} Client URL
 */
exports.getClientUrl = () => {
  return process.env.FRONTEND_URL || 'https://app.getherd.ai';
};

// /**
//  * Get admin URL for Stripe redirects (admin panel)
//  * @returns {string} Admin URL
//  */
// exports.getAdminUrl = () => {
//   return process.env.ADMIN_URL || 'http://localhost:5173';
// };
