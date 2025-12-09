const pool = require('../config/database');

class Subscription {
  /**
   * Create a new subscription
   * @param {Object} subscriptionData - Subscription data
   * @returns {Promise<Object>} Created subscription
   */
  static async create({ subscription_id, user_id, product_ids, status, current_period_end, stripe_data }) {
    const query = `
      INSERT INTO payment_subscriptions (
        subscription_id,
        user_id,
        product_ids,
        status,
        current_period_end,
        stripe_data,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;


    const { rows } = await pool.query(query, [
      subscription_id,
      user_id,
      product_ids,
      status,
      current_period_end,
      stripe_data
    ]);

    return rows[0];
  }

  /**
   * Update a subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Updated subscription
   */
  static async update(subscriptionId) {
    const query = `
      UPDATE payment_subscriptions
      SET updated_at = CURRENT_TIMESTAMP
      WHERE subscription_id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [subscriptionId]);
    return rows[0];
  }

  /**
   * Update subscription status
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {string} status - New status
   * @param {Date} currentPeriodEnd - Current period end date
   * @param {string} stripeData - JSON string of Stripe data
   * @returns {Promise<Object>} Updated subscription
   */
  static async updateData(subscriptionId, status, currentPeriodEnd, stripeData) {
    const query = `
      UPDATE payment_subscriptions
      SET 
        status = $2,
        current_period_end = $3,
        stripe_data = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE subscription_id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      subscriptionId,
      status,
      currentPeriodEnd,
      stripeData
    ]);
    
    return rows[0];
  }


  static async updateStatus(subscriptionId, status) {
    const query = `
      UPDATE payment_subscriptions
      SET 
        status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE subscription_id = $1 
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      subscriptionId,
      status
    ]);

    return rows[0];
  }


  /**
   * Find a subscription by ID
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Subscription
   */
  static async findById(subscriptionId) {
    const query = 'SELECT * FROM payment_subscriptions WHERE subscription_id = $1';
    const { rows } = await pool.query(query, [subscriptionId]);
    return rows[0];
  }

  /**
   * Find a subscription by user ID and product ID
   * @param {number} userId - User ID
   * @param {number} productId - Product ID
   * @returns {Promise<Object>} Subscription
   */
  static async findByUserAndProduct(userId, productId) {
    const query = 'SELECT * FROM payment_subscriptions WHERE user_id = $1 AND product_id = $2';
    const { rows } = await pool.query(query, [userId, productId]);
    return rows[0];
  }

  /**
   * Find all subscriptions for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of subscriptions
   */
  static async findAllByUserId(userId) {
    const query = `
      SELECT s.*,
        ARRAY_AGG(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'price', p.price
          )
        ) as products
      FROM payment_subscriptions s
      LEFT JOIN products p ON p.id = ANY(s.product_ids)
      WHERE s.user_id = $1 AND s.status != 'canceled'
      GROUP BY s.id, s.subscription_id, s.user_id, s.status, s.current_period_end, s.stripe_data, s.created_at, s.updated_at, s.product_ids
      ORDER BY s.created_at DESC
    `;
    
    const { rows } = await pool.query(query, [userId]);
    return rows;
  }

  /**
   * Find active subscriptions for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of active subscriptions
   */
  static async findActiveByUserId(userId) {
    const query = `
      SELECT * FROM payment_subscriptions
      WHERE user_id = $1
      AND status = 'active'
      AND current_period_end > NOW()
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows;
  }

  /**
   * Check if a user has an active subscription for a product
   * @param {number} userId - User ID
   * @param {number} productId - Product ID
   * @returns {Promise<boolean>} True if user has active subscription
   */
  static async hasActiveSubscription(userId, productId) {
    const query = `
      SELECT COUNT(*) as count
      FROM payment_subscriptions
      WHERE user_id = $1 
      AND product_id = $2
      AND status IN ('active', 'trialing')
    `;
    
    const { rows } = await pool.query(query, [userId, productId]);
    return parseInt(rows[0].count) > 0;
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Canceled subscription
   */
  static async cancel(subscriptionId) {
    const query = `
      UPDATE payment_subscriptions
      SET 
        status = 'canceled',
        updated_at = CURRENT_TIMESTAMP
      WHERE subscription_id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [subscriptionId]);
    return rows[0];
  }
}

module.exports = Subscription;
