const pool = require('../config/database');

class UserLicense {
  /**
   * Create a new user license
   * @param {Object} licenseData - License data
   * @returns {Promise<Object>} Created license
   */
  static async create(licenseData) {
    const {
      company_id,
      product_ids,
      license_count,
      total_price,
      payment_method,
      payment_details,
      status,
      created_by,
      billing_interval,
      next_billing_date,
      stripe_subscription_id,
      is_recurring
    } = licenseData;

    const query = `
      INSERT INTO user_licenses (
        company_id,
        product_ids,
        license_count,
        total_price,
        payment_method,
        payment_details,
        status,
        created_by,
        billing_interval,
        next_billing_date,
        stripe_subscription_id,
        is_recurring,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      company_id,
      JSON.stringify(product_ids),
      license_count,
      total_price,
      payment_method,
      JSON.stringify(payment_details),
      status,
      created_by,
      billing_interval || 'month',
      next_billing_date,
      stripe_subscription_id,
      is_recurring || false
    ]);

    return rows[0];
  }

  /**
   * Update a user license
   * @param {number} id - License ID
   * @param {Object} licenseData - License data to update
   * @returns {Promise<Object>} Updated license
   */
  static async update(id, licenseData) {
    const {
      company_id,
      product_ids,
      license_count,
      total_price,
      payment_method,
      payment_details,
      status,
      payment_link,
      payment_link_expires_at,
      billing_interval,
      next_billing_date,
      stripe_subscription_id,
      is_recurring
    } = licenseData;

    const query = `
      UPDATE user_licenses
      SET
        company_id = COALESCE($1, company_id),
        product_ids = COALESCE($2, product_ids),
        license_count = COALESCE($3, license_count),
        total_price = COALESCE($4, total_price),
        payment_method = COALESCE($5, payment_method),
        payment_details = COALESCE($6, payment_details),
        status = COALESCE($7, status),
        payment_link = COALESCE($8, payment_link),
        payment_link_expires_at = COALESCE($9, payment_link_expires_at),
        billing_interval = COALESCE($10, billing_interval),
        next_billing_date = COALESCE($11, next_billing_date),
        stripe_subscription_id = COALESCE($12, stripe_subscription_id),
        is_recurring = COALESCE($13, is_recurring),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      company_id,
      product_ids ? JSON.stringify(product_ids) : null,
      license_count,
      total_price,
      payment_method,
      payment_details ? JSON.stringify(payment_details) : null,
      status,
      payment_link,
      payment_link_expires_at,
      billing_interval,
      next_billing_date,
      stripe_subscription_id,
      is_recurring,
      id
    ]);

    return rows[0];
  }

  /**
   * Find a license by ID
   * @param {number} id - License ID
   * @returns {Promise<Object>} License
   */
  static async findById(id) {
    const query = 'SELECT * FROM user_licenses WHERE id = $1';
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  /**
   * Find licenses by company ID
   * @param {number} companyId - Company ID
   * @returns {Promise<Array>} Array of licenses
   */
  static async findByCompanyId(companyId) {
    const query = 'SELECT * FROM user_licenses WHERE company_id = $1 ORDER BY created_at DESC';
    const { rows } = await pool.query(query, [companyId]);
    return rows;
  }

  /**
   * Get all licenses
   * @returns {Promise<Array>} Array of licenses
   */
  static async findAll() {
    const query = `
      SELECT ul.*, c.name as company_name, u.name as created_by_name
      FROM user_licenses ul
      LEFT JOIN company c ON ul.company_id = c.id
      LEFT JOIN users u ON ul.created_by = u.id
      ORDER BY ul.created_at DESC
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  /**
   * Delete a license
   * @param {number} id - License ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(id) {
    const query = 'DELETE FROM user_licenses WHERE id = $1 RETURNING id';
    const { rows } = await pool.query(query, [id]);
    return rows.length > 0;
  }
}

module.exports = UserLicense;

