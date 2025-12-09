const pool = require('../config/database');
const stripeConfig = require('../config/stripe');

class Product {
  /**
   * Create a new product
   * @param {Object} productData - Product data
   * @returns {Promise<Object>} Created product
   */
  static async create(productData) {
    const {
      name,
      description,
      price,
      interval,
      stripe_product_id,
      stripe_price_id,
      is_enabled,
      features
    } = productData;

    const query = `
      INSERT INTO products (
        name,
        description,
        price,
        interval,
        stripe_product_id,
        stripe_price_id,
        is_enabled,
        features,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      name,
      description,
      price,
      interval,
      stripe_product_id,
      stripe_price_id,
      is_enabled,
      JSON.stringify(features)
    ]);

    return rows[0];
  }

  /**
   * Update a product
   * @param {number} id - Product ID
   * @param {Object} productData - Product data to update
   * @returns {Promise<Object>} Updated product
   */
  static async update(id, productData) {
    const {
      name,
      description,
      price,
      interval,
      stripe_product_id,
      stripe_price_id,
      is_enabled,
      features
    } = productData;

    const query = `
      UPDATE products
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        interval = COALESCE($4, interval),
        stripe_product_id = COALESCE($5, stripe_product_id),
        stripe_price_id = COALESCE($6, stripe_price_id),
        is_enabled = COALESCE($7, is_enabled),
        features = COALESCE($8, features),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      name,
      description,
      price,
      interval,
      stripe_product_id,
      stripe_price_id,
      is_enabled,
      features ? JSON.stringify(features) : null,
      id
    ]);

    return rows[0];
  }

  /**
   * Find a product by ID
   * @param {number} id - Product ID
   * @returns {Promise<Object>} Product
   */
  static async findById(id) {
    const product = stripeConfig.getStripe().products.retrieve(id, {
      expand: ['default_price']
    });

    return product;
  }

  /**
   * Find a product by Stripe product ID
   * @param {string} stripeProductId - Stripe product ID
   * @returns {Promise<Object>} Product
   */
  static async findByStripeProductId(stripeProductId) {
    const query = 'SELECT * FROM products WHERE stripe_product_id = $1';
    const { rows } = await pool.query(query, [stripeProductId]);
    return rows[0];
  }

  /**
   * Get all products
   * @param {boolean} enabledOnly - If true, only return enabled products
   * @returns {Promise<Array>} Array of products
   */
  static async findAll(enabledOnly = true) {
    // return only active products with default price from stripe
    const stripe = stripeConfig.getStripe();

    const stripeProducts = await stripe.products.list(enabledOnly ? { active: true, expand: ['data.default_price'] } : { expand: ['data.default_price'] });
    const products = stripeProducts.data.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      active: product.active,
      default_price: product.default_price,
      features: product.metadata.features ? JSON.parse(product.metadata.features) : [],
      metadata: product.metadata
    }));

    return products;
  }

  /**
   * Delete a product
   * @param {number} id - Product ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(id) {
    const query = 'DELETE FROM products WHERE id = $1 RETURNING id';
    const { rows } = await pool.query(query, [id]);
    return rows.length > 0;
  }

  /**
   * Toggle product enabled status
   * @param {number} id - Product ID
   * @param {boolean} isEnabled - New enabled status
   * @returns {Promise<Object>} Updated product
   */
  static async toggleEnabled(id, isEnabled) {
    const query = `
      UPDATE products
      SET
        is_enabled = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE stripe_product_id = $2
      RETURNING *
    `;

    const { rows } = await pool.query(query, [isEnabled, id]);
    return rows[0];
  }
}

module.exports = Product;
