const { Pool } = require('pg');
const { initializeStripe } = require('../utils/stripe');
require('dotenv').config();

// For debugging connection issues
console.log('Database connection config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  // Not logging password for security
});

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false // Required for AWS RDS
  },
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20,
});

// Log pool events for better debugging
pool.on('connect', async () => {
  console.log('New client connected to database:', process.env.DB_HOST);

  // Initialize Stripe environment variables
  const envResult = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'stripe_config'");
  const stripeData = JSON.parse(envResult.rows[0].setting_value);
  if (stripeData.environment === "production") {
    process.env.STRIPE_ENVIRONMENT = 'production';
    process.env.STRIPE_PUBLISHABLE_KEY = stripeData.productionPublishableKey;
    process.env.STRIPE_SECRET_KEY = stripeData.productionSecretKey;
    process.env.STRIPE_WEBHOOK_SECRET = stripeData.productionWebhookSecret;
  } else {
    process.env.STRIPE_ENVIRONMENT = 'sandbox';
    process.env.STRIPE_PUBLISHABLE_KEY = stripeData.sandboxPublishableKey;
    process.env.STRIPE_SECRET_KEY = stripeData.sandboxSecretKey;
    process.env.STRIPE_WEBHOOK_SECRET = stripeData.sandboxWebhookSecret;
  }


});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool; 