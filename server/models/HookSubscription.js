const pool = require('../config/database');

class Subscription {
  /**
   * Create a new subscription
   * @param {Object} subscriptionData - Subscription data
   * @returns {Promise<Object>} Created subscription
   */
  static async create(subscriptionData) {
    const {
      subscription_id,
      user_id,
      type
    } = subscriptionData;

    const query = `
      INSERT INTO subscriptions (
        subscription_id, 
        user_id, 
        type,
        created_at, 
        updated_at
      )
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      subscription_id,
      user_id,
      type
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
      UPDATE subscriptions
      SET updated_at = CURRENT_TIMESTAMP
      WHERE subscription_id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [subscriptionId]);
    return rows[0];
  }

  
  /**
   * Update a type
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Updated subscription
   */
  static async updateType(subscriptionId, type) {
    const query = `
      UPDATE subscriptions
      SET type = $2
      WHERE subscription_id = $1 
      RETURNING *
    `;
    const { rows } = await pool.query(query, [subscriptionId, type]);
    return rows[0];
  }

  /**
   * Find a subscription by ID
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Subscription
   */
  static async findById(subscriptionId) {
    const query = 'SELECT * FROM subscriptions WHERE subscription_id = $1';
    const { rows } = await pool.query(query, [subscriptionId]);
    return rows[0];
  }

  /**
   * Find a subscription by user ID and product ID
   * @param {number} userId - User ID
   * @param {number} productId - Product ID
   * @returns {Promise<Object>} Subscription
   */
  static async findByUserId(userId, type) {
    const query = 'SELECT * FROM subscriptions WHERE user_id = $1 AND type = $2';
    const { rows } = await pool.query(query, [userId, type]);
    return rows[0];
  }
}

module.exports = Subscription;
