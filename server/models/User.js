const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Company = require('./Company');
const { sendEmail } = require('../utils/email');
class User {
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await pool.query(query, [email?.toLowerCase()]);
    return rows[0];
  }

  static async create(userData) {
    const { name, email, provider, provider_id } = userData;

    const company = await Company.findByEmail(email);

    const status = company ? 'enabled' : 'disabled';

    //Need to send email to Matt.francis@getherd.ai
    //Send Name, Email
    if (company) {
      await sendEmail({
        to: 'Matt.francis@getherd.ai',
        subject: 'New User Registration - Approval Required',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New User Registration</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
              .user-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
              .approve-btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
              .approve-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4); }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
              .highlight { color: #667eea; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 28px;">🎉 New User Registration</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Approval Required</p>
              </div>
              
              <div class="content">
                <h2 style="color: #333; margin-bottom: 20px;">Hello Matt,</h2>
                
                <p>A new user has registered and requires your approval to access the platform.</p>
                
                <div class="user-info">
                  <h3 style="margin: 0 0 15px 0; color: #667eea;">👤 User Details</h3>
                  <p><strong>Name:</strong> <span class="highlight">${name}</span></p>
                  <p><strong>Email:</strong> <span class="highlight">${email}</span></p>
                  <p><strong>Registration Date:</strong> <span class="highlight">${new Date().toLocaleDateString()}</span></p>
                </div>
                
                <p style="margin: 25px 0;">Please review the user's information and click the button below to approve their account.</p>
                
                <div style="text-align: center;">
                  <a href="${process.env.ADMIN_URL}/user-management?action_type=approve_new_user&user_id=${userId}" class="approve-btn">
                    ✅ Approve User Account
                  </a>
                </div>
                
                <p style="margin: 25px 0; font-size: 14px; color: #666;">
                  <strong>Note:</strong> This link will take you directly to the user management page where you can approve the user's account.
                </p>
                
                <div class="footer">
                  <p>This is an automated notification from the HerdAI platform.</p>
                  <p>If you have any questions, please contact the development team.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      });
    }

    const query = `
      INSERT INTO users (
        name, 
        email, 
        provider, 
        provider_id, 
        is_new_user,
        registration_completed,
        last_login,
        use_zoom,
        use_teams,
        status
      )
      VALUES ($1, $2, $3, $4, true, false, CURRENT_TIMESTAMP, false, false, $5)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [name, email?.toLowerCase(), provider, provider_id, status]);
    return rows[0];
  }

  static async updateLoginTime(id) {
    const query = `
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP,
          agreed_date = CURRENT_TIMESTAMP,
          login_count = login_count + 1
      WHERE id = $1 
      RETURNING *
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  static async completeRegistration(id, additionalData = {}) {
    const query = `
      UPDATE users 
      SET 
        registration_completed = true,
        is_new_user = false,
        updated_at = CURRENT_TIMESTAMP
        ${additionalData.phone ? ', phone = $2' : ''}
        ${additionalData.location ? ', location = $3' : ''}
      WHERE id = $1 
      RETURNING *
    `;
    
    const values = [id];
    if (additionalData.phone) values.push(additionalData.phone);
    if (additionalData.location) values.push(additionalData.location);
    
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  static async createWithPassword(userData) {
    const { name, email, password } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);

    const company = await Company.findByEmail(email);

    const status = company ? 'enabled' : 'disabled';

    

    const query = `
      INSERT INTO users (
        name, 
        email, 
        password_hash,
        provider,
        is_new_user,
        registration_completed,
        last_login,
        use_zoom,
        use_teams,
        status
      )
      VALUES ($1, $2, $3, 'email', true, false, CURRENT_TIMESTAMP, false, false, $4)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [name, email?.toLowerCase(), hashedPassword, status]);


    //Need to send email to Matt.francis@getherd.ai
    //Send Name, Email
    if (rows.length > 0 && !company) {
      await sendEmail({
        to: 'Matt.francis@getherd.ai',
        subject: 'New User Registration - Approval Required',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New User Registration</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
              .user-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
              .approve-btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
              .approve-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4); }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
              .highlight { color: #667eea; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 28px;">🎉 New User Registration</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Approval Required</p>
              </div>
              
              <div class="content">
                <h2 style="color: #333; margin-bottom: 20px;">Hello Matt,</h2>
                
                <p>A new user has registered and requires your approval to access the platform.</p>
                
                <div class="user-info">
                  <h3 style="margin: 0 0 15px 0; color: #667eea;">👤 User Details</h3>
                  <p><strong>Name:</strong> <span class="highlight">${name}</span></p>
                  <p><strong>Email:</strong> <span class="highlight">${email}</span></p>
                  <p><strong>Registration Date:</strong> <span class="highlight">${new Date().toLocaleDateString()}</span></p>
                </div>
                
                <p style="margin: 25px 0;">Please review the user's information and click the button below to approve their account.</p>
                
                <div style="text-align: center;">
                  <a href="${process.env.ADMIN_URL}/user-management?action_type=approve_new_user&user_id=${rows[0].id}" class="approve-btn">
                    ✅ Approve User Account
                  </a>
                </div>
                
                <p style="margin: 25px 0; font-size: 14px; color: #666;">
                  <strong>Note:</strong> This link will take you directly to the user management page where you can approve the user's account.
                </p>
                
                <div class="footer">
                  <p>This is an automated notification from the HerdAI platform.</p>
                  <p>If you have any questions, please contact the development team.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      });
    }

    return rows[0];
  }

  static async verifyPassword(email, password) {
    const user = await this.findByEmail(email);
    if (!user || !user.password_hash) return null;
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return null;
    
    return user;
  }

  static async createPasswordReset(email) {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const query = `
      UPDATE users 
      SET 
        reset_token = $2,
        reset_token_expires = NOW() + INTERVAL '1 hour'
      WHERE email = $1
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [email, resetToken]);
    return { user: rows[0], resetToken };
  }

  static async resetPassword(resetToken, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const query = `
      UPDATE users 
      SET 
        password_hash = $2,
        reset_token = NULL,
        reset_token_expires = NULL
      WHERE reset_token = $1 
        AND reset_token_expires > NOW()
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [resetToken, hashedPassword]);
    return rows[0];
  }

  static async updateFaceId(userId, faceIdData, enabled = true) {
    const query = `
      UPDATE users 
      SET 
        face_id_enabled = $2,
        face_id_data = $3
      WHERE id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [userId, enabled, faceIdData]);
    return rows[0];
  }

  static async updateProfile(id, data) {
    const { name, phone, location, bio, use_zoom, use_teams, email } = data;
    const query = `
      UPDATE users 
      SET 
        name = COALESCE($2, name),
        phone = COALESCE($3, phone),
        location = COALESCE($4, location),
        bio = COALESCE($5, bio),
        updated_at = CURRENT_TIMESTAMP,
        email = COALESCE($6, email),
        use_zoom = COALESCE($7, use_zoom),
        use_teams = COALESCE($8, use_teams)
      WHERE id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [id, name, phone, location, bio, email, use_zoom, use_teams]);
    return rows[0];
  }

  static async updateAvatar(userId, avatarUrl) {
    const query = `
      UPDATE users 
      SET 
        avatar = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [userId, avatarUrl]);
    return rows[0];
  }

  static async changePassword(userId, oldPassword, newPassword) {
    // First check if user exists and their auth method
    const findUserQuery = 'SELECT * FROM users WHERE id = $1';
    const { rows: [user] } = await pool.query(findUserQuery, [userId]);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is using OAuth
    if (user.provider !== 'email') {
      throw new Error(`Password cannot be changed for ${user.provider} account`);
    }

    // Continue with password change only for email users
    if (!user.password_hash) {
      throw new Error('No password set for this account');
    }

    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 
      RETURNING *
    `;
    
    const { rows } = await pool.query(updateQuery, [hashedPassword, userId]);
    return rows[0];
  }

  static async connectOAuth(userId, provider, providerId) {
    const query = `
      UPDATE users 
      SET 
        provider = $2,
        provider_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [userId, provider, providerId]);
    return rows[0];
  }

  static async disconnectOAuth(userId) {
    const query = `
      UPDATE users 
      SET 
        provider = 'email',
        provider_id = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [userId]);
    return rows[0];
  }

  static async updateZoomCredentials(userId, zoomData) {
    const query = `
      UPDATE users 
      SET 
        use_zoom = true,
        zoom_access_token = $2,
        zoom_refresh_token = $3,
        zoom_connected_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      userId, 
      zoomData.access_token, 
      zoomData.refresh_token
    ]);
    return rows[0];
  }

  static async disconnectZoom(userId) {
    const query = `
      UPDATE users 
      SET 
        use_zoom = false,
        zoom_access_token = NULL,
        zoom_refresh_token = NULL,
        zoom_connected_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [userId]);
    return rows[0];
  }

  static async updateZoomStatus(userId, status) {
    const query = `
      UPDATE users 
      SET 
        use_zoom = $2,
        updated_at = CURRENT_TIMESTAMP  
      WHERE id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [userId, status]);
    return rows[0];
  }

  static async updateTeamsSubscription(userId, subscription) {
    const query = `
      UPDATE users 
      SET 
        teams_subscription = $2,
        teams_subscription_id = $3,
        teams_subscription_created_at = CURRENT_TIMESTAMP  
      WHERE id = $1 
      RETURNING *
    `;
    try {
      const { rows } = await pool.query(query, [userId, subscription, subscription.id]);
      if (rows.length === 0) {
        throw new Error('User not found');
      }
      return rows[0];

    } catch (error) {
      console.error('Error updating teams subscription:', error);
      throw error;
    }
  }

  static async updateTeamsCredentials(userId, credentials) {
    try {
      const result = await pool.query(
        `UPDATE users 
         SET teams_access_token = $1, 
             teams_refresh_token = $2,
             teams_connected_at = CURRENT_TIMESTAMP,
             is_polling_enabled = $3,
             lastMeetingsState = $4,
             use_teams = true,
             updated_at = CURRENT_TIMESTAMP

         WHERE id = $5

         RETURNING *`,

        [
          credentials.access_token || null,
          credentials.refresh_token || null,
          credentials.is_polling_enabled || true,
          credentials.lastMeetingsState || [],
          userId

        ]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error updating teams credentials:', error);
      throw error;
    }
  }

  static async disconnectTeams(userId) {
    const query = `
      UPDATE users 
      SET 
        use_teams = false,
        teams_access_token = NULL,
        teams_refresh_token = NULL,
        teams_connected_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;  

    const { rows } = await pool.query(query, [userId]);
    return rows[0];
  } 

  static async updateTeamsStatus(userId, status) {
    const query = `
      UPDATE users 
      SET 
        use_teams = $2,
        updated_at = CURRENT_TIMESTAMP  
      WHERE id = $1 
      RETURNING *
    `;

    const { rows } = await pool.query(query, [userId, status]);
    return rows[0]; 
  }

  static async findOne(condition) {
    const query = `
      SELECT * FROM users 
      WHERE ${condition}
    `;
    const { rows } = await pool.query(query);
    return rows[0];
  }

  static async updateTeamsMeetings(userId, meetings) {
    const query = `
      UPDATE users 
      SET lastMeetingsState = $2
      WHERE id = $1
      RETURNING *
    `;
    const { rows } = await pool.query(query, [userId, meetings]);
    return rows[0];

  }

  static async find(conditions = {}) {
    let query = 'SELECT * FROM users WHERE 1=1';
    const values = [];
    let paramCount = 1;

    // Handle each condition
    Object.entries(conditions).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        // Handle special operators like $ne (not equal)
        if ('$ne' in value) {
          query += ` AND ${key} IS NOT NULL`;
        }
      } else {
        // Handle direct value comparison
        query += ` AND ${key} = $${paramCount}`;
        values.push(value);
        paramCount++;
      }
    });

    const { rows } = await pool.query(query, values);
    return rows;
  }

  static async updateZoomAgent(agent) {
    const { id, use_zoom_agent } = agent;
    const query = `
      UPDATE users 
      SET use_zoom_agent = $2
      WHERE id = $1
      RETURNING *
    `;
    const { rows } = await pool.query(query, [id, use_zoom_agent]);
    return rows[0];
  }

  /**
   * Update user's Stripe customer ID
   * @param {number} userId - User ID
   * @param {string} stripeCustomerId - Stripe customer ID
   * @returns {Promise<Object>} Updated user
   */
  static async updateStripeCustomerId(userId, stripeCustomerId) {

    const query = `
      UPDATE users 
      SET 
        ${process.env.STRIPE_ENVIRONMENT == 'production' ? 'stripe_customer_id_production' : 'stripe_customer_id_sandbox'} = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [userId, stripeCustomerId]);
    return rows[0];
  }

  /**
   * Update user's meeting count
   * @param {number} userId - User ID
   * @param {number} count - New meeting count (or increment by 1 if not provided)
   * @returns {Promise<Object>} Updated user
   */
  static async updateMeetingCount(userId, count = null) {
    let query;
    let params;
    
    if (count === null) {
      // Increment by 1
      query = `
        UPDATE users 
        SET 
          meeting_count = COALESCE(meeting_count, 0) + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 
        RETURNING *
      `;
      params = [userId];
    } else {
      // Set to specific value
      query = `
        UPDATE users 
        SET 
          meeting_count = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 
        RETURNING *
      `;
      params = [userId, count];
    }
    
    const { rows } = await pool.query(query, params);
    return rows[0];
  }

  /**
   * Reset user's meeting count to zero
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated user
   */
  static async resetMeetingCount(userId) {
    const query = `
      UPDATE users 
      SET 
        meeting_count = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [userId]);
    return rows[0];
  }

  /**
   * Get user's meeting count
   * @param {number} userId - User ID
   * @returns {Promise<number>} Meeting count
   */
  static async getMeetingCount(userId) {
    const query = 'SELECT COUNT(*) FROM meetings WHERE org_id = $1';
    const { rows } = await pool.query(query, [userId]);
    return rows[0]?.count || 0;
  }
}

module.exports = User;
