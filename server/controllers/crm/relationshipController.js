const pool = require('../../config/database');
const { getTenantId, getOrCreateTenant, getTenant } = require('../../utils/crm');

// Create new account relationship
const createRelationship = async (req, res) => {
  try {
    const relationshipData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Creating account relationship for tenant ID:', tenantId);

    // Validation
    if (!relationshipData.parent_account_id || !relationshipData.child_account_id) {
      return res.status(400).json({
        success: false,
        message: 'Parent account ID and child account ID are required'
      });
    }

    // Check if accounts belong to tenant
    const accountsExist = await pool.query(
      'SELECT COUNT(*) FROM accounts WHERE id IN ($1, $2) AND tenant_id = $3',
      [relationshipData.parent_account_id, relationshipData.child_account_id, tenantId]
    );

    if (parseInt(accountsExist.rows[0].count) !== 2) {
      return res.status(404).json({
        success: false,
        message: 'One or both accounts not found'
      });
    }

    // Check if relationship already exists
    const existingRelationship = await pool.query(
      'SELECT * FROM account_relationships WHERE parent_account_id = $1 AND child_account_id = $2 AND tenant_id = $3',
      [relationshipData.parent_account_id, relationshipData.child_account_id, tenantId]
    );

    if (existingRelationship.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Relationship already exists between these accounts'
      });
    }

    // Check for circular relationships
    if (relationshipData.parent_account_id === relationshipData.child_account_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create relationship between an account and itself'
      });
    }

    // Create relationship
    const newRelationship = await pool.query(
      `INSERT INTO account_relationships (
        tenant_id, parent_account_id, child_account_id, relationship_type, 
        description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        tenantId, relationshipData.parent_account_id, relationshipData.child_account_id,
        relationshipData.relationship_type || 'subsidiary', relationshipData.description || '',
        req.user?.id || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Account relationship created successfully',
      data: newRelationship.rows[0]
    });

  } catch (error) {
    console.error('Error creating account relationship:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get all account relationships for tenant
const getRelationships = async (req, res) => {
  try {
    const { account_id, relationship_type } = req.query;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching account relationships for tenant ID:', tenantId);
    
    let query = `
      SELECT ar.*, 
        p.name as parent_account_name,
        c.name as child_account_name
      FROM account_relationships ar
      JOIN accounts p ON ar.parent_account_id = p.id AND p.tenant_id = $1
      JOIN accounts c ON ar.child_account_id = c.id AND c.tenant_id = $1
      WHERE ar.tenant_id = $1
    `;
    
    let params = [tenantId];
    let paramCount = 1;

    if (account_id) {
      paramCount++;
      query += ` AND (ar.parent_account_id = $${paramCount} OR ar.child_account_id = $${paramCount})`;
      params.push(account_id);
    }

    if (relationship_type) {
      paramCount++;
      query += ` AND ar.relationship_type = $${paramCount}`;
      params.push(relationship_type);
    }

    query += ' ORDER BY ar.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching account relationships:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get relationship by ID
const getRelationshipById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching relationship ID:', id, 'for tenant ID:', tenantId);
    
    const result = await pool.query(
      `SELECT ar.*, 
        p.name as parent_account_name,
        c.name as child_account_name
      FROM account_relationships ar
      JOIN accounts p ON ar.parent_account_id = p.id AND p.tenant_id = $1
      JOIN accounts c ON ar.child_account_id = c.id AND c.tenant_id = $1
      WHERE ar.id = $2 AND ar.tenant_id = $1`,
      [tenantId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account relationship not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching account relationship:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update relationship
const updateRelationship = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Updating relationship ID:', id, 'for tenant ID:', tenantId);
    
    // Check if relationship exists and belongs to tenant
    const existingRelationship = await pool.query(
      'SELECT * FROM account_relationships WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingRelationship.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account relationship not found'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && key !== 'tenant_id' && key !== 'created_at') {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Add WHERE clause parameters
    values.push(id, tenantId);

    const updateQuery = `
      UPDATE account_relationships 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1} AND tenant_id = $${paramCount + 2}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Account relationship updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating account relationship:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Delete relationship
const deleteRelationship = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Deleting relationship ID:', id, 'for tenant ID:', tenantId);
    
    // Check if relationship exists and belongs to tenant
    const existingRelationship = await pool.query(
      'SELECT * FROM account_relationships WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingRelationship.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account relationship not found'
      });
    }

    // Delete relationship
    await pool.query(
      'DELETE FROM account_relationships WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    res.json({
      success: true,
      message: 'Account relationship deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting account relationship:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get account hierarchy
const getAccountHierarchy = async (req, res) => {
  try {
    const { account_id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching account hierarchy for account ID:', account_id, 'tenant ID:', tenantId);
    
    // Check if account exists and belongs to tenant
    const accountExists = await pool.query(
      'SELECT * FROM accounts WHERE id = $1 AND tenant_id = $2',
      [account_id, tenantId]
    );

    if (accountExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Get parent relationships (accounts that this account is a child of)
    const parentRelationships = await pool.query(
      `SELECT ar.*, a.name as account_name, a.industry
       FROM account_relationships ar
       JOIN accounts a ON ar.parent_account_id = a.id AND a.tenant_id = $1
       WHERE ar.child_account_id = $2 AND ar.tenant_id = $1`,
      [tenantId, account_id]
    );

    // Get child relationships (accounts that this account is a parent of)
    const childRelationships = await pool.query(
      `SELECT ar.*, a.name as account_name, a.industry
       FROM account_relationships ar
       JOIN accounts a ON ar.child_account_id = a.id AND a.tenant_id = $1
       WHERE ar.parent_account_id = $2 AND ar.tenant_id = $1`,
      [tenantId, account_id]
    );

    res.json({
      success: true,
      data: {
        account: accountExists.rows[0],
        parents: parentRelationships.rows,
        children: childRelationships.rows
      }
    });

  } catch (error) {
    console.error('Error fetching account hierarchy:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  createRelationship,
  getRelationships,
  getRelationshipById,
  updateRelationship,
  deleteRelationship,
  getAccountHierarchy
};