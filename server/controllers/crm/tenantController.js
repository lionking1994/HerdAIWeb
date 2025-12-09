const pool = require('../../config/database');
const { getTenantId, getOrCreateTenant, getTenant } = require('../../utils/crm');

// Get tenant information
const getTenantInfo = async (req, res) => {
  try {
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching tenant info for tenant ID:', tenantId);
    
    // Get tenant details
    const tenant = await pool.query(
      'SELECT * FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenant.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Get company details (since tenant.id now matches company.id)
    const company = await pool.query(
      'SELECT * FROM company WHERE id = $1',
      [tenantId]
    );

    // Get tenant statistics
    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM accounts WHERE tenant_id = $1) as account_count,
        (SELECT COUNT(*) FROM contacts WHERE tenant_id = $1) as contact_count,
        (SELECT COUNT(*) FROM opportunities WHERE tenant_id = $1) as opportunity_count,
        (SELECT COUNT(*) FROM opportunity_stages WHERE tenant_id = $1) as stage_count,
        (SELECT COUNT(*) FROM custom_field_definitions WHERE tenant_id = $1) as custom_field_count`,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        tenant: tenant.rows[0],
        company: company.rows[0] || null,
        stats: stats.rows[0]
      }
    });

  } catch (error) {
    console.error('Error fetching tenant info:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update tenant information
const updateTenant = async (req, res) => {
  try {
    const updateData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Updating tenant ID:', tenantId);
    
    // Check if tenant exists
    const existingTenant = await pool.query(
      'SELECT * FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (existingTenant.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && key !== 'created_at') {
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

    // Add updated_at
    updateFields.push(`updated_at = NOW()`);

    // Add WHERE clause parameters
    values.push(tenantId);

    const updateQuery = `
      UPDATE tenants 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get tenant settings
const getTenantSettings = async (req, res) => {
  try {
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching tenant settings for tenant ID:', tenantId);
    
    // Get tenant settings (you can extend this based on your needs)
    const settings = await pool.query(
      `SELECT 
        t.name,
        t.subdomain,
        t.is_active,
        t.created_at,
        t.updated_at,
        c.name as company_name,
        c.domain,
        c.industry,
        c.size
      FROM tenants t
      LEFT JOIN company c ON t.id = c.id
      WHERE t.id = $1`,
      [tenantId]
    );

    if (settings.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    res.json({
      success: true,
      data: settings.rows[0]
    });

  } catch (error) {
    console.error('Error fetching tenant settings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update tenant settings
const updateTenantSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Updating tenant settings for tenant ID:', tenantId);
    
    // Check if tenant exists
    const existingTenant = await pool.query(
      'SELECT * FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (existingTenant.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Update tenant settings
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(settings).forEach(key => {
      if (key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(settings[key]);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid settings to update'
      });
    }

    // Add updated_at
    updateFields.push(`updated_at = NOW()`);

    // Add WHERE clause parameters
    values.push(tenantId);

    const updateQuery = `
      UPDATE tenants 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Tenant settings updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating tenant settings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get tenant dashboard data
const getTenantDashboard = async (req, res) => {
  try {
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching tenant dashboard for tenant ID:', tenantId);
    
    // Get recent accounts
    const recentAccounts = await pool.query(
      'SELECT * FROM accounts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5',
      [tenantId]
    );

    // Get recent contacts
    const recentContacts = await pool.query(
      'SELECT * FROM contacts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5',
      [tenantId]
    );

    // Get recent opportunities
    const recentOpportunities = await pool.query(
      `SELECT o.*, a.name as account_name, s.name as stage_name
       FROM opportunities o
       LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $1
       LEFT JOIN opportunity_stages s ON o.stage_id = s.id AND s.tenant_id = $1
       WHERE o.tenant_id = $1
       ORDER BY o.created_at DESC LIMIT 5`,
      [tenantId]
    );

    // Get opportunity pipeline summary
    const pipelineSummary = await pool.query(
      `SELECT 
        s.name as stage_name,
        s.color as stage_color,
        COUNT(o.id) as opportunity_count,
        COALESCE(SUM(o.amount), 0) as total_amount
       FROM opportunity_stages s
       LEFT JOIN opportunities o ON s.id = o.stage_id AND o.tenant_id = $1
       WHERE s.tenant_id = $1
       GROUP BY s.id, s.name, s.color, s.order_index
       ORDER BY s.order_index`,
      [tenantId]
    );

    // Get quick stats
    const quickStats = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM accounts WHERE tenant_id = $1) as total_accounts,
        (SELECT COUNT(*) FROM contacts WHERE tenant_id = $1) as total_contacts,
        (SELECT COUNT(*) FROM opportunities WHERE tenant_id = $1) as total_opportunities,
        (SELECT COALESCE(SUM(amount), 0) FROM opportunities WHERE tenant_id = $1) as total_pipeline_value`,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        recent_accounts: recentAccounts.rows,
        recent_contacts: recentContacts.rows,
        recent_opportunities: recentOpportunities.rows,
        pipeline_summary: pipelineSummary.rows,
        quick_stats: quickStats.rows[0]
      }
    });

  } catch (error) {
    console.error('Error fetching tenant dashboard:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  getTenantInfo,
  updateTenant,
  getTenantSettings,
  updateTenantSettings,
  getTenantDashboard
};