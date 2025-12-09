const pool = require('../../config/database');

// Temporary inline getTenantId function to avoid import issues
const getTenantId = (req) => {
  const companyId = req.query.company || req.body.company;
  if (!companyId) {
    throw new Error('Company ID is required. Please provide company parameter or ensure user has company_id.');
  }
  return parseInt(companyId);
};

// Create account-account relationship
const createAccountRelationship = async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { parent_account_id, child_account_id, relationship_type, description } = req.body;

    if (!parent_account_id || !child_account_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'parent_account_id and child_account_id are required' 
      });
    }

    // Check if relationship already exists
    const existingCheck = await pool.query(
      'SELECT id FROM account_relationships WHERE (parent_account_id = $1 AND child_account_id = $2) OR (parent_account_id = $2 AND child_account_id = $1) AND tenant_id = $3',
      [parent_account_id, child_account_id, tenantId]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Relationship already exists between these accounts' 
      });
    }

    // Create the relationship
    const result = await pool.query(
      `INSERT INTO account_relationships (
        tenant_id, parent_account_id, child_account_id, 
        relationship_type, description, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [
        tenantId, 
        parent_account_id, 
        child_account_id, 
        relationship_type || 'related', 
        description || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Account-account relationship created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating account-account relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account-account relationship',
      error: error.message
    });
  }
};

// Get account relationships
const getAccountRelationships = async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { account_id } = req.query;
    let query = 'SELECT * FROM account_relationships WHERE tenant_id = $1';
    let params = [tenantId];

    if (account_id) {
      query += ' AND (parent_account_id = $2 OR child_account_id = $2)';
      params.push(account_id);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching account relationships:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account relationships',
      error: error.message
    });
  }
};

// Get relationships for a specific account
const getAccountRelationshipsByAccount = async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const account_id = req.params.id; // Changed from req.params.account_id to req.params.id

    const result = await pool.query(
      `SELECT ar.*, 
              CASE 
                WHEN ar.parent_account_id = $1 THEN ar.child_account_id 
                ELSE ar.parent_account_id 
              END as related_account_id,
              CASE 
                WHEN ar.parent_account_id = $1 THEN a2.name 
                ELSE a1.name 
              END as related_account_name,
              CASE 
                WHEN ar.parent_account_id = $1 THEN a2.industry 
                ELSE a1.industry 
              END as related_account_industry
       FROM account_relationships ar
       JOIN accounts a1 ON ar.parent_account_id = a1.id
       JOIN accounts a2 ON ar.child_account_id = a2.id
       WHERE (ar.parent_account_id = $1 OR ar.child_account_id = $1) 
         AND ar.tenant_id = $2
       ORDER BY ar.created_at DESC`,
      [account_id, tenantId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching account relationships:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account relationships',
      error: error.message
    });
  }
};

// Delete account-account relationship
const deleteAccountRelationship = async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM account_relationships WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account-account relationship not found'
      });
    }

    res.json({
      success: true,
      message: 'Account-account relationship deleted successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting account-account relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account-account relationship',
      error: error.message
    });
  }
};

// Update account-account relationship
const updateAccountRelationship = async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { id } = req.params;
    const { relationship_type, description } = req.body;

    const result = await pool.query(
      `UPDATE account_relationships 
       SET relationship_type = COALESCE($1, relationship_type), 
           description = COALESCE($2, description)
       WHERE id = $3 AND tenant_id = $4 
       RETURNING *`,
      [relationship_type, description, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account-account relationship not found'
      });
    }

    res.json({
      success: true,
      message: 'Account-account relationship updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating account-account relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update account-account relationship',
      error: error.message
    });
  }
};

module.exports = {
  createAccountRelationship,
  getAccountRelationships,
  getAccountRelationshipsByAccount,
  deleteAccountRelationship,
  updateAccountRelationship
};
