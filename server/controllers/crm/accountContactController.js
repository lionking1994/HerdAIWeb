const pool = require('../../config/database');

// Temporary inline getTenantId function to avoid import issues
const getTenantId = (req) => {
  const companyId = req.query.company || req.body.company;
  if (!companyId) {
    throw new Error('Company ID is required. Please provide company parameter or ensure user has company_id.');
  }
  return parseInt(companyId);
};

// Create account-contact relationship
const createAccountContact = async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { account_id, contact_id, role, is_primary, relationship_type, description } = req.body;

    if (!account_id || !contact_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'account_id and contact_id are required' 
      });
    }

    // Check if relationship already exists
    const existingCheck = await pool.query(
      'SELECT id FROM account_contacts WHERE account_id = $1 AND contact_id = $2 AND tenant_id = $3',
      [account_id, contact_id, tenantId]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Relationship already exists between this account and contact' 
      });
    }

    // Create the relationship
    const result = await pool.query(
      `INSERT INTO account_contacts (
        tenant_id, account_id, contact_id, role, is_primary, 
        relationship_type, description, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [
        tenantId, 
        account_id, 
        contact_id, 
        role || null, 
        is_primary || false, 
        relationship_type || 'contact', 
        description || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Account-contact relationship created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating account-contact relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account-contact relationship',
      error: error.message
    });
  }
};

// Get account contacts (can be filtered by account_id or contact_id)
const getAccountContacts = async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { account_id, contact_id } = req.query;
    let query = 'SELECT * FROM account_contacts WHERE tenant_id = $1';
    let params = [tenantId];
    let paramIndex = 2;

    if (account_id) {
      query += ` AND account_id = $${paramIndex}`;
      params.push(account_id);
      paramIndex++;
    }

    if (contact_id) {
      query += ` AND contact_id = $${paramIndex}`;
      params.push(contact_id);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching account contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account contacts',
      error: error.message
    });
  }
};

// Get contacts for a specific account
const getAccountContactsByAccount = async (req, res) => {
  try {
    const tenantId = getTenantId(req); // Removed await
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const account_id = req.params.id; // Changed from req.params.account_id to req.params.id
    
    console.log('🔍 getAccountContactsByAccount - account_id:', account_id, 'tenant_id:', tenantId);
    console.log('🔍 req.params:', req.params);

    // First, let's check if the account_contacts record exists
    const checkQuery = await pool.query(
      'SELECT * FROM account_contacts WHERE account_id = $1 AND tenant_id = $2',
      [account_id, tenantId]
    );
    console.log('🔍 Found account_contacts records:', checkQuery.rows.length);

    const result = await pool.query(
      `SELECT ac.*, c.first_name, c.last_name, c.email, c.phone 
       FROM account_contacts ac 
       LEFT JOIN contacts c ON ac.contact_id = c.id 
       WHERE ac.account_id = $1 AND ac.tenant_id = $2 
       ORDER BY ac.created_at DESC`,
      [account_id, tenantId]
    );

    console.log('🔍 Final result rows:', result.rows.length);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching account contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account contacts',
      error: error.message
    });
  }
};

// Get accounts for a specific contact
const getContactAccounts = async (req, res) => {
  try {
    const tenantId = getTenantId(req); // Removed await
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const contact_id = req.params.id; // Extract 'id' parameter and use it as contact_id

    console.log('🔍 getContactAccounts - contact_id:', contact_id, 'tenant_id:', tenantId);
    console.log('🔍 getContactAccounts - Full request path:', req.path);
    console.log('🔍 getContactAccounts - All params:', req.params);
    console.log('🔍 getContactAccounts - All query:', req.query);

    // Test database connection
    const testQuery = await pool.query('SELECT NOW() as current_time');
    console.log('🔍 Database connection test:', testQuery.rows[0]);

    // Check if there's any data in the table at all
    const allData = await pool.query('SELECT * FROM account_contacts LIMIT 5');
    console.log('🔍 All data in account_contacts table (first 5 rows):', allData.rows);

    // Check for the specific contact_id without tenant filter
    const contactCheck = await pool.query(
      'SELECT * FROM account_contacts WHERE contact_id = $1',
      [contact_id]
    );
    console.log('🔍 Contact check (no tenant filter):', contactCheck.rows);

    // Check for the specific tenant_id without contact filter
    const tenantCheck = await pool.query(
      'SELECT * FROM account_contacts WHERE tenant_id = $1',
      [tenantId]
    );
    console.log('🔍 Tenant check (no contact filter):', tenantCheck.rows);

    const result = await pool.query(
      `SELECT ac.*, a.name, a.industry, a.account_type 
       FROM account_contacts ac 
       LEFT JOIN accounts a ON ac.account_id = a.id 
       WHERE ac.contact_id = $1 AND ac.tenant_id = $2 
       ORDER BY ac.created_at DESC`,
      [contact_id, tenantId]
    );

    console.log('🔍 Final SQL Query: SELECT ac.*, a.name, a.industry, a.account_type FROM account_contacts ac LEFT JOIN accounts a ON ac.account_id = a.id WHERE ac.contact_id = $1 AND ac.tenant_id = $2 ORDER BY ac.created_at DESC');
    console.log('🔍 Final Parameters: contact_id =', contact_id, 'tenant_id =', tenantId);
    console.log('🔍 Final result rows:', result.rows.length);
    console.log('🔍 Final result:', result.rows);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching contact accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact accounts',
      error: error.message
    });
  }
};

// Delete account-contact relationship
const deleteAccountContact = async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM account_contacts WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account-contact relationship not found'
      });
    }

    res.json({
      success: true,
      message: 'Account-contact relationship deleted successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting account-contact relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account-contact relationship',
      error: error.message
    });
  }
};

// Update account-contact relationship
const updateAccountContact = async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { id } = req.params;
    const { role, description } = req.body;

    const result = await pool.query(
      `UPDATE account_contacts 
       SET role = COALESCE($1, role), 
           description = COALESCE($2, description)
       WHERE id = $3 AND tenant_id = $4 
       RETURNING *`,
      [role, description, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account-contact relationship not found'
      });
    }

    res.json({
      success: true,
      message: 'Account-contact relationship updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating account-contact relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update account-contact relationship',
      error: error.message
    });
  }
};

module.exports = {
  createAccountContact,
  getAccountContacts,
  getAccountContactsByAccount,
  getContactAccounts,
  deleteAccountContact,
  updateAccountContact
};
