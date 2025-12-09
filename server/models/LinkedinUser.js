const pool = require("../config/database");

class LinkedinUser {
  static async create(linkedinUserData) {
    const { 
      account_id, 
      name, 
      email, 
      user_id, 
      linkedin_access_token, 
      linkedin_refresh_token, 
      profile_url, 
      expires_at 
    } = linkedinUserData;

    const linkedinUser = await LinkedinUser.findByUserId(user_id);
    if(linkedinUser){
      await LinkedinUser.disconnect(user_id);
    }
    
    const result = await pool.query(
      `INSERT INTO user_linkedin (
        account_id, name, email, user_id, linkedin_access_token, linkedin_refresh_token, 
        profile_url, expires_at, created_at, updated_at, is_connected
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        account_id,
        name,
        email?.toLowerCase(),
        user_id,
        linkedin_access_token,
        linkedin_refresh_token,
        profile_url,
        expires_at,
        new Date(),
        new Date(),
        true
      ]
    );

    return result.rows[0];
  }
  
  static async update(linkedinUserData) {
    const { 
      account_id, 
      name, 
      email, 
      user_id, 
      linkedin_access_token, 
      linkedin_refresh_token, 
      profile_url, 
      expires_at 
    } = linkedinUserData;
    
    const result = await pool.query(
      `UPDATE user_linkedin SET 
        name = $1, 
        email = $2, 
        user_id = $3, 
        linkedin_access_token = $4, 
        linkedin_refresh_token = $5, 
        profile_url = $6, 
        expires_at = $7, 
        updated_at = $8, 
        is_connected = $9 
      WHERE account_id = $10`,
      [
        name, 
        email?.toLowerCase(), 
        user_id, 
        linkedin_access_token, 
        linkedin_refresh_token, 
        profile_url, 
        expires_at, 
        new Date(), 
        true, 
        account_id
      ]
    );

    return result.rows[0];
  }
  
  static async disconnect(user_id) {
    const result = await pool.query(
      `UPDATE user_linkedin SET 
        is_connected = false, 
        linkedin_access_token = NULL, 
        linkedin_refresh_token = NULL 
      WHERE user_id = $1`,
      [user_id]
    );
    
    return result.rows[0];
  }
  
  static async findByUserId(user_id) {
    const result = await pool.query(
      `SELECT * FROM user_linkedin WHERE user_id = $1 AND is_connected = true`,
      [user_id]
    );
    
    return result.rows[0];
  }
  
  static async findByAccountId(account_id) {
    const result = await pool.query(
      `SELECT * FROM user_linkedin WHERE account_id = $1`,
      [account_id]
    );
    
    return result.rows[0];
  }
}

module.exports = LinkedinUser;

