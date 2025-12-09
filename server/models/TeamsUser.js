const pool = require("../config/database");

class TeamsUser {
  static async create(teamsUserData) {
    const { account_id, name, mail, user_id, teams_access_token, tenant_id, teams_refresh_token } = teamsUserData;


    const teamsUser = await TeamsUser.findByUserId(user_id);
    if (teamsUser) {
      await TeamsUser.disconnect(user_id);
    }
    const result = await pool.query(
      `INSERT INTO teams_users (
      account_id, name, mail, user_id, teams_access_token, teams_refresh_token, tenant_id, 
      expires_at, created_at, updated_at, is_connected, teams_scheduling, 
      is_outlook_connected, outlook_created_at
    ) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
    RETURNING *`,
      [
        account_id,
        name,
        mail?.toLowerCase(),
        user_id,
        teams_access_token,
        teams_refresh_token,
        tenant_id,
        null,           // expires_at
        new Date(),     // created_at
        new Date(),     // updated_at
        true,           // is_connected
        false,          // teams_scheduling
        true,           // is_outlook_connected
        new Date()      // outlook_created_at
      ]
    );


    return result.rows[0];
  }
  static async update(teamsUserData) {
    const { account_id, name, mail, user_id, teams_access_token, teams_refresh_token } = teamsUserData;
    const result = await pool.query(
      `UPDATE teams_users SET name = $1, mail = $2, user_id = $3, teams_access_token = $4, teams_refresh_token = $5, expires_at = $6, updated_at = $7, is_connected = $8, is_outlook_connected= $9,outlook_created_at =$10  WHERE account_id = $11`,
      [name, mail?.toLowerCase(), user_id, teams_access_token, teams_refresh_token, null, new Date(), true, true, new Date(), account_id]
    );

    return result.rows[0];
  }
  static async disconnect(user_id) {
    const result = await pool.query(
      `UPDATE teams_users SET is_connected = false, teams_access_token=NULL, teams_refresh_token=NULL, teams_scheduling = false, is_outlook_connected = false WHERE user_id = $1`,
      [user_id]
    );
    return result.rows[0];
  }
  static async findByUserId(user_id) {
    const result = await pool.query(
      `SELECT * FROM teams_users WHERE user_id = $1 AND is_connected = true`,
      [user_id]
    );
    return result.rows[0];
  }
  static async findByAccountId(account_id) {
    const result = await pool.query(
      `SELECT * FROM teams_users WHERE account_id = $1`,
      [account_id]
    );
    return result.rows[0];
  }
  static async findByTenantId(tenant_id) {
    const result = await pool.query(
      `SELECT * FROM teams_users WHERE tenant_id = $1`,
      [tenant_id]
    );
    return result.rows[0];
  }
  static async enablescheduling(user_id) {
    const result = await pool.query(
      `UPDATE teams_users SET teams_scheduling = true  WHERE user_id = $1`,
      [user_id]
    );
    return result.rows[0];
  }
  static async disablescheduling(user_id) {
    const result = await pool.query(
      `UPDATE teams_users SET teams_scheduling = false  WHERE user_id = $1`,
      [user_id]
    );
    return result.rows[0];
  }
}

module.exports = TeamsUser;
