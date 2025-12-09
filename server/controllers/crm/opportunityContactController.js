const pool = require('../../config/database');

// Temporary inline getTenantId function to avoid import issues
const getTenantId = (req) => {
  const companyId = req.query.company || req.body.company;
  if (!companyId) {
    throw new Error('Company ID is required. Please provide company parameter or ensure user has company_id.');
  }
  return parseInt(companyId);
};

// Create opportunity-contact relationship
const createOpportunityContact = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { opportunity_id, contact_id, role } = req.body;

    if (!opportunity_id || !contact_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'opportunity_id and contact_id are required' 
      });
    }

    // Check if relationship already exists
    const existingCheck = await pool.query(
      'SELECT id FROM opportunity_contacts WHERE opportunity_id = $1 AND contact_id = $2 AND tenant_id = $3',
      [opportunity_id, contact_id, tenantId]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Relationship already exists between this opportunity and contact' 
      });
    }

    // Create the relationship
    const result = await pool.query(
      `INSERT INTO opportunity_contacts (
        tenant_id, opportunity_id, contact_id, role, created_at
      ) VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [
        tenantId, 
        opportunity_id, 
        contact_id, 
        role || 'influencer'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Opportunity-contact relationship created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating opportunity-contact relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create opportunity-contact relationship',
      error: error.message
    });
  }
};

// Get opportunity contacts (can be filtered by opportunity_id or contact_id)
const getOpportunityContacts = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { opportunity_id, contact_id } = req.query;
    let query = 'SELECT * FROM opportunity_contacts WHERE tenant_id = $1';
    let params = [tenantId];
    let paramIndex = 2;

    if (opportunity_id) {
      query += ` AND opportunity_id = $${paramIndex}`;
      params.push(opportunity_id);
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
    console.error('Error fetching opportunity contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch opportunity contacts',
      error: error.message
    });
  }
};

// Get contacts for a specific opportunity
const getOpportunityContactsByOpportunity = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const opportunity_id = req.params.id; // Changed from req.params.opportunity_id to req.params.id

    console.log('🔍 getOpportunityContactsByOpportunity - opportunity_id:', opportunity_id, 'tenant_id:', tenantId);

    const result = await pool.query(
      `SELECT oc.*, c.first_name, c.last_name, c.email, c.phone 
       FROM opportunity_contacts oc 
       LEFT JOIN contacts c ON oc.contact_id = c.id 
       WHERE oc.opportunity_id = $1 AND oc.tenant_id = $2 
       ORDER BY oc.created_at DESC`,
      [opportunity_id, tenantId]
    );

    console.log('📊 getOpportunityContactsByOpportunity - result rows:', result.rows.length);
    console.log('📊 getOpportunityContactsByOpportunity - result:', result.rows);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching opportunity contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch opportunity contacts',
      error: error.message
    });
  }
};

// Get opportunities for a specific contact
const getContactOpportunities = async (req, res) => {
  
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const contact_id = req.params.id; // Extract 'id' parameter and use it as contact_id


    // Test database connection
    const testQuery = await pool.query('SELECT NOW() as current_time');
    // Check current database and schema
    const dbInfo = await pool.query('SELECT current_database() as db_name, current_schema() as schema_name');

    // Check if the table exists in the current schema
    const tableExists = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = current_schema() 
      AND table_name = 'opportunity_contacts'
    `);

    // Check table structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'opportunity_contacts' 
      ORDER BY ordinal_position
    `);

    // Check if there's any data in the table at all
    const allData = await pool.query('SELECT * FROM opportunity_contacts LIMIT 5');

    // Check for the specific contact_id without tenant filter
    const contactCheck = await pool.query(
      'SELECT * FROM opportunity_contacts WHERE contact_id = $1',
      [contact_id]
    );

    // Check for the specific tenant_id without contact filter
    const tenantCheck = await pool.query(
      'SELECT * FROM opportunity_contacts WHERE tenant_id = $1',
      [tenantId]
    );

    // Check RLS status and policies
    const rlsStatus = await pool.query(`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE tablename = 'opportunity_contacts'
    `);

    if (rlsStatus.rows.length > 0 && rlsStatus.rows[0].rowsecurity) {
      const rlsPolicies = await pool.query(`
        SELECT policyname, permissive, roles, cmd, qual 
        FROM pg_policies 
        WHERE tablename = 'opportunity_contacts'
      `);
    }

    // First, let's check if the data exists in opportunity_contacts table
    const checkQuery = await pool.query(
      'SELECT * FROM opportunity_contacts WHERE contact_id = $1 AND tenant_id = $2',
      [contact_id, tenantId]
    );

    const result = await pool.query(
      `SELECT oc.*, o.name, o.stage, o.amount 
       FROM opportunity_contacts oc 
       LEFT JOIN opportunities o ON oc.opportunity_id = o.id 
       WHERE oc.contact_id = $1 AND oc.tenant_id = $2 
       ORDER BY oc.created_at DESC`,
      [contact_id, tenantId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching contact opportunities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact opportunities',
      error: error.message
    });
  }
};

// Delete opportunity-contact relationship
const deleteOpportunityContact = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM opportunity_contacts WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity-contact relationship not found'
      });
    }

    res.json({
      success: true,
      message: 'Opportunity-contact relationship deleted successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting opportunity-contact relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete opportunity-contact relationship',
      error: error.message
    });
  }
};

// Update opportunity-contact relationship
const updateOpportunityContact = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const { id } = req.params;
    const { role } = req.body;

    const result = await pool.query(
      `UPDATE opportunity_contacts 
       SET role = COALESCE($1, role)
       WHERE id = $2 AND tenant_id = $3 
       RETURNING *`,
      [role, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity-contact relationship not found'
      });
    }

    res.json({
      success: true,
      message: 'Opportunity-contact relationship updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating opportunity-contact relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update opportunity-contact relationship',
      error: error.message
    });
  }
};

module.exports = {
  createOpportunityContact,
  getOpportunityContacts,
  getOpportunityContactsByOpportunity,
  getContactOpportunities,
  deleteOpportunityContact,
  updateOpportunityContact
};
