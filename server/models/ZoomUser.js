const pool = require("../config/database");

class ZoomUser {
  static async create(zoomUserData) {
    const { account_id, name, mail, user_id, zoom_access_token, zoom_refresh_token, tenant_id, role_name, type } = zoomUserData;


    const zoomUser = await ZoomUser.findByUserId(user_id);
    if (zoomUser) {
      await ZoomUser.disconnect(user_id);
    }
    const result = await pool.query(
      `INSERT INTO zoom_users (
        account_id, name, mail, user_id, zoom_access_token, zoom_refresh_token, tenant_id, expires_at, created_at, updated_at, is_connected, role_name, type, zoom_scheduling
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        account_id,
        name,
        mail?.toLowerCase(),
        user_id,
        zoom_access_token, //access_token, 
        zoom_refresh_token, //refresh_token,
        tenant_id,
        null, //expires_at,
        new Date(), //created_at,
        new Date(), //updated_at,
        true, //is_connected
        role_name,
        type,
        false, //is_scheduling
      ]
    );

    return result.rows[0];
  }
  static async update(zoomUserData) {
    const { account_id, name, mail, user_id, zoom_access_token, zoom_refresh_token, tenant_id, role_name, type } = zoomUserData;
    const result = await pool.query(
      `UPDATE zoom_users SET name = $1, mail = $2, user_id = $3, zoom_access_token = $4, zoom_refresh_token = $5, tenant_id = $6, expires_at = $7, updated_at = $8, is_connected = $9, role_name = $10, type = $11 WHERE account_id = $12`,
      [name, mail?.toLowerCase(), user_id, zoom_access_token, zoom_refresh_token, tenant_id, null, new Date(), true, role_name, type, account_id]
    );

    return result.rows[0];
  }
  static async disconnect(user_id) {
    const result = await pool.query(
      `UPDATE zoom_users SET is_connected = false, zoom_access_token=NULL, zoom_refresh_token=NULL, zoom_scheduling = false WHERE user_id = $1`,
      [user_id]
    );
    return result.rows[0];
  }
  static async findByUserId(user_id) {
    const result = await pool.query(
      `SELECT * FROM zoom_users WHERE user_id = $1 AND is_connected = true`,
      [user_id]
    );
    return result.rows[0];
  }
  static async findByAccountId(account_id) {
    const result = await pool.query(
      `SELECT * FROM zoom_users WHERE account_id = $1`,
      [account_id]
    );
    return result.rows[0];
  }
  static async findByTenantId(tenant_id) {
    const result = await pool.query(
      `SELECT * FROM zoom_users WHERE tenant_id = $1`,
      [tenant_id]
    );
    return result.rows[0];
  }
  static async enablescheduling(user_id) {
    const result = await pool.query(
      `UPDATE zoom_users SET zoom_scheduling = true  WHERE user_id = $1`,
      [user_id]
    );
    return result.rows[0];
  }
  static async disablescheduling(user_id) {
    const result = await pool.query(
      `UPDATE zoom_users SET zoom_scheduling = false  WHERE user_id = $1`,
      [user_id]
    );
    return result.rows[0];
  }
}

module.exports = ZoomUser;
