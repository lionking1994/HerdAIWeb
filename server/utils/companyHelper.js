const pool = require("../config/database");

/**
 * Get company ID for a user using multiple methods:
 * 1. Direct company_id from users table
 * 2. Extract company name from email domain and lookup in companies table
 * 
 * @param {number} userId - The user ID
 * @returns {number|null} - Company ID or null if not found
 */
async function getCompanyIdFromUserId(userId) {
  try {
    // Get user's email and company_id
    const userQuery = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
    const user = userQuery.rows[0];
    
    if (!user) {
      console.log(`User with ID ${userId} not found`);
      return null;
    }
    
    // If no direct company_id, try to get company ID from email domain
    if (user.email) {
      const emailDomain = user.email.split('@')[1].split('.')[0]; // Extract domain from email
      const companyQuery = await pool.query("SELECT id FROM company WHERE name = $1", [emailDomain]);
      
      if (companyQuery.rows.length > 0) {
        const companyId = companyQuery.rows[0].id;
        console.log(`Found company ID ${companyId} for email domain: ${emailDomain}`);
        return companyId;
      } else {
        console.log(`No company found for email domain: ${emailDomain}`);
      }
    }
    
    console.log(`No company ID found for user ${userId}`);
    return null; 
    
  } catch (error) {
    console.error('Error getting company ID from user ID:', error);
    return null;
  }
}

/**
 * Extract company name from email domain
 * @param {string} email - User email address
 * @returns {string|null} - Company name or null if extraction fails
 */
function extractCompanyFromEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  const parts = email.split('@');
  if (parts.length !== 2) {
    return null;
  }
  
  return parts[1]; // Return the domain part
}

/**
 * Get company ID from email domain
 * @param {string} email - User email address
 * @returns {number|null} - Company ID or null if not found
 */
async function getCompanyIdFromEmail(email) {
  try {
    const companyName = extractCompanyFromEmail(email);
    if (!companyName) {
      return null;
    }
    
    const companyQuery = await pool.query("SELECT id FROM companies WHERE name = $1", [companyName]);
    
    if (companyQuery.rows.length > 0) {
      return companyQuery.rows[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting company ID from email:', error);
    return null;
  }
}

/**
 * Get full company information from email domain
 * @param {string} email - User email address
 * @returns {Object|null} - Company object or null if not found
 */
async function getCompanyFromEmail(email) {
  try {
    const companyName = extractCompanyFromEmail(email);
    if (!companyName) {
      return null;
    }
    
    const companyQuery = await pool.query("SELECT * FROM companies WHERE name = $1", [companyName]);
    
    if (companyQuery.rows.length > 0) {
      return companyQuery.rows[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error getting company from email:', error);
    return null;
  }
}

module.exports = {
  getCompanyIdFromUserId,
  extractCompanyFromEmail,
  getCompanyIdFromEmail,
  getCompanyFromEmail
};

