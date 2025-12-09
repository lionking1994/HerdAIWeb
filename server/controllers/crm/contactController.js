const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { getTenantId, getOrCreateTenant, getTenant } = require('../../utils/crm');

// Create new contact
const createContact = async (req, res) => {
  try {
    const contactData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Creating contact for tenant ID:', tenantId);

    // Validation
    if (!contactData.first_name || !contactData.last_name) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required'
      });
    }

    // Check if contact with same first and last name already exists for this tenant
    const existingNameContact = await pool.query(
      'SELECT * FROM contacts WHERE tenant_id = $1 AND first_name = $2 AND last_name = $3',
      [tenantId, contactData.first_name, contactData.last_name]
    );

    if (existingNameContact.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Contact with this first and last name already exists'
      });
    }

    // Check if email already exists for this tenant
    if (contactData.email) {
      const existingContact = await pool.query(
        'SELECT * FROM contacts WHERE tenant_id = $1 AND email = $2',
        [tenantId, contactData.email]
      );

      if (existingContact.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Contact with this email already exists'
        });
      }
    }

    // Create contact
    const newContact = await pool.query(
      `INSERT INTO contacts (
        tenant_id, first_name, last_name, email, phone, mobile_phone,
        title, department, address1, address2, city, state, zip, country, custom_fields, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        tenantId, contactData.first_name, contactData.last_name, contactData.email || null,
        contactData.phone || null, contactData.mobile_phone || null, contactData.title || null,
        contactData.department || null, contactData.address1 || null, contactData.address2 || null,
        contactData.city || null, contactData.state || null, contactData.zip || null, contactData.country || null,
        contactData.custom_fields || {}, req.user?.id || null, req.user?.id || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Contact created successfully',
      data: newContact.rows[0]
    });

  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get all contacts with pagination and search
const getContacts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, filters = {} } = req.query;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching contacts for tenant ID:', tenantId);
    
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT c.*, 
        COUNT(ac.account_id) as account_count,
        COUNT(oc.opportunity_id) as opportunity_count
      FROM contacts c
      LEFT JOIN account_contacts ac ON c.id = ac.contact_id
      LEFT JOIN opportunity_contacts oc ON c.id = oc.contact_id
      WHERE c.tenant_id = $1
    `;
    
    let params = [tenantId];
    let paramCount = 1;

    // Add search functionality
    if (search) {
      paramCount++;
      query += ` AND (
        c.first_name ILIKE $${paramCount} OR 
        c.last_name ILIKE $${paramCount} OR 
        c.email ILIKE $${paramCount} OR 
        c.phone ILIKE $${paramCount} OR
        c.title ILIKE $${paramCount} OR
        c.department ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Add filters
    if (filters.title) {
      paramCount++;
      query += ` AND c.title = $${paramCount}`;
      params.push(filters.title);
    }

    if (filters.department) {
      paramCount++;
      query += ` AND c.department = $${paramCount}`;
      params.push(filters.department);
    }

    if (filters.has_accounts) {
      query += ` AND EXISTS (SELECT 1 FROM account_contacts ac2 WHERE ac2.contact_id = c.id)`;
    }

    if (filters.has_opportunities) {
      query += ` AND EXISTS (SELECT 1 FROM opportunity_contacts oc2 WHERE oc2.contact_id = c.id)`;
    }

    // Add grouping for the main query
    query += ' GROUP BY c.id';

    // Create a separate count query that doesn't include the complex aggregations
    let countQuery = `
      SELECT COUNT(*) as total
      FROM contacts c
      WHERE c.tenant_id = $1
    `;

    // Add the same search and filter conditions to count query
    let countParamCount = 1;
    let countParams = [tenantId];

    // Add search functionality to count query
    if (search) {
      countParamCount++;
      countQuery += ` AND (
        c.first_name ILIKE $${countParamCount} OR 
        c.last_name ILIKE $${countParamCount} OR 
        c.email ILIKE $${countParamCount} OR 
        c.phone ILIKE $${countParamCount} OR
        c.title ILIKE $${countParamCount} OR
        c.department ILIKE $${countParamCount}
      )`;
      countParams.push(`%${search}%`);
    }

    // Add filters to count query
    if (filters.title) {
      countParamCount++;
      countQuery += ` AND c.title = $${countParamCount}`;
      countParams.push(filters.title);
    }

    if (filters.department) {
      countParamCount++;
      countQuery += ` AND c.department = $${countParamCount}`;
      countParams.push(filters.department);
    }

    if (filters.has_accounts) {
      countQuery += ` AND EXISTS (SELECT 1 FROM account_contacts ac2 WHERE ac2.contact_id = c.id)`;
    }

    if (filters.has_opportunities) {
      countQuery += ` AND EXISTS (SELECT 1 FROM opportunity_contacts oc2 WHERE oc2.contact_id = c.id)`;
    }

    console.log('🔍 Count Query:', countQuery);
    console.log('🔍 Count Params:', countParams);
    
    const countResult = await pool.query(countQuery, countParams);
    console.log('🔍 Count Result:', countResult.rows);
    
    // Handle case when no contacts exist for this tenant
    if (!countResult.rows || countResult.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }
    
    const total = parseInt(countResult.rows[0].total);
    console.log('🔍 Total count:', total);

    // Add ordering and pagination
    query += ` ORDER BY c.last_name, c.first_name`;
    
    // Only add LIMIT and OFFSET if limit is not -1
    if (parseInt(limit) !== -1) {
      paramCount++;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(parseInt(limit), offset);
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: parseInt(limit) === -1 ? 1 : Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get contact by ID
const getContactById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching contact ID:', id, 'for tenant ID:', tenantId);
    
    const result = await pool.query(
      'SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update contact
const updateContact = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Updating contact ID:', id, 'for tenant ID:', tenantId);
    
    // Check if contact exists and belongs to tenant
    const existingContact = await pool.query(
      'SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingContact.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Check if first_name or last_name is being changed and if new name combination already exists
    const currentFirstName = existingContact.rows[0].first_name;
    const currentLastName = existingContact.rows[0].last_name;
    const newFirstName = updateData.first_name || currentFirstName;
    const newLastName = updateData.last_name || currentLastName;

    if ((updateData.first_name && updateData.first_name !== currentFirstName) || 
        (updateData.last_name && updateData.last_name !== currentLastName)) {
      const nameExists = await pool.query(
        'SELECT * FROM contacts WHERE tenant_id = $1 AND first_name = $2 AND last_name = $3 AND id != $4',
        [tenantId, newFirstName, newLastName, id]
      );

      if (nameExists.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Contact with this first and last name already exists'
        });
      }
    }

    // Check if email is being changed and if new email already exists
    if (updateData.email && updateData.email !== existingContact.rows[0].email) {
      const emailExists = await pool.query(
        'SELECT * FROM contacts WHERE tenant_id = $1 AND email = $2 AND id != $3',
        [tenantId, updateData.email, id]
      );

      if (emailExists.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Contact with this email already exists'
        });
      }
    }

    // Build update query with explicit parameter counting
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    // Add all the update fields first
    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && key !== 'tenant_id' && key !== 'created_at') {
        if (key === 'custom_fields') {
          // Handle JSONB field with explicit type casting
          updateFields.push(`${key} = $${paramCount}::jsonb`);
        } else {
          updateFields.push(`${key} = $${paramCount}`);
        }
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

    // Add updated_by and updated_at
    updateFields.push(`updated_by = $${paramCount}`);
    updateFields.push(`updated_at = NOW()`);
    values.push(req.user?.id || 1); // Use default user ID if none provided
    paramCount++;

    // Add WHERE clause parameters
    values.push(id, tenantId);

    const updateQuery = `
      UPDATE contacts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
      RETURNING *
    `;

    console.log('🔍 Update query:', updateQuery);
    console.log('🔍 Update values:', values);
    console.log('🔍 Update fields count:', updateFields.length);
    console.log('🔍 Values length:', values.length);
    console.log('🔍 Final param count:', paramCount);
    console.log('🔍 ID value:', id);
    console.log('🔍 Tenant ID value:', tenantId);

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Contact updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Delete contact
const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Deleting contact ID:', id, 'for tenant ID:', tenantId);
    
    // Check if contact exists and belongs to tenant
    const existingContact = await pool.query(
      'SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingContact.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Check if contact has related data
    const hasRelatedData = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM account_contacts WHERE contact_id = $1) as account_count,
        (SELECT COUNT(*) FROM opportunity_contacts WHERE contact_id = $1) as opportunity_count`,
      [id]
    );

    const accountCount = parseInt(hasRelatedData.rows[0].account_count);
    const opportunityCount = parseInt(hasRelatedData.rows[0].opportunity_count);

    if (accountCount > 0 || opportunityCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete contact with related data',
        data: {
          account_count: accountCount,
          opportunity_count: opportunityCount
        }
      });
    }

    // Delete contact
    await pool.query(
      'DELETE FROM contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get contact with relationships
const getContactWithRelations = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching contact relationships ID:', id, 'for tenant ID:', tenantId);
    
    // Check if contact exists and belongs to tenant
    const contactExists = await pool.query(
      'SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (contactExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Get related accounts
    const accounts = await pool.query(
      `SELECT 
        a.*,
        ac.relationship_type,
        ac.is_primary
      FROM account_contacts ac
      JOIN accounts a ON ac.account_id = a.id AND a.tenant_id = $1
      WHERE ac.contact_id = $2
      ORDER BY ac.is_primary DESC, a.name`,
      [tenantId, id]
    );

    // Get related opportunities
    const opportunities = await pool.query(
      `SELECT 
        o.*,
        oc.role,
        a.name as account_name,
        s.name as stage_name
      FROM opportunity_contacts oc
      JOIN opportunities o ON oc.opportunity_id = o.id AND o.tenant_id = $1
      LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $1
      LEFT JOIN opportunity_stages s ON o.stage_id = s.id AND s.tenant_id = $1
      WHERE oc.contact_id = $2
      ORDER BY o.expected_close_date DESC`,
      [tenantId, id]
    );

    res.json({
      success: true,
      data: {
        contact: contactExists.rows[0],
        accounts: accounts.rows,
        opportunities: opportunities.rows
      }
    });

  } catch (error) {
    console.error('Error fetching contact relationships:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Search contacts
const searchContacts = async (req, res) => {
  try {
    const { query, filters = {}, limit = 50, offset = 0 } = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Searching contacts for tenant ID:', tenantId);

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchTerm = `%${query.trim()}%`;
    
    let sqlQuery = `
      SELECT 
        c.*,
        COUNT(ac.account_id) as account_count,
        COUNT(oc.opportunity_id) as opportunity_count
      FROM contacts c
      LEFT JOIN account_contacts ac ON c.id = ac.contact_id
      LEFT JOIN opportunity_contacts oc ON c.id = oc.contact_id
      WHERE c.tenant_id = $1 AND (
        c.first_name ILIKE $2 OR 
        c.last_name ILIKE $2 OR 
        c.email ILIKE $2 OR 
        c.phone ILIKE $2 OR 
        c.mobile_phone ILIKE $2 OR
        c.title ILIKE $2 OR
        c.department ILIKE $2
      )
    `;
    
    let params = [tenantId, searchTerm];
    let paramCount = 2;

    // Add filters
    if (filters.title) {
      paramCount++;
      sqlQuery += ` AND c.title = $${paramCount}`;
      params.push(filters.title);
    }

    if (filters.department) {
      paramCount++;
      sqlQuery += ` AND c.department = $${paramCount}`;
      params.push(filters.department);
    }

    if (filters.country) {
      paramCount++;
      sqlQuery += ` AND c.country = $${paramCount}`;
      params.push(filters.country);
    }

    // Add grouping, ordering, and pagination
    sqlQuery += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(sqlQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
      }
    });

  } catch (error) {
    console.error('Error searching contacts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get contact statistics
const getContactStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching contact stats ID:', id, 'for tenant ID:', tenantId);
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Check if contact exists and belongs to tenant
    const contactExists = await pool.query(
      'SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (contactExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Get contact statistics
    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM account_contacts WHERE contact_id = $1) as account_count,
        (SELECT COUNT(*) FROM opportunity_contacts WHERE contact_id = $1) as opportunity_count,
        (SELECT COUNT(*) FROM tasks WHERE assigned_to = $1) as task_count,
        (SELECT COUNT(*) FROM meetings WHERE organizer_id = $1) as meeting_count`,
      [id]
    );

    res.json({
      success: true,
      data: {
        contact: contactExists.rows[0],
        stats: stats.rows[0]
      }
    });

  } catch (error) {
    console.error('Error fetching contact stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  createContact,
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
  getContactStats,
  getContactWithRelations,
  searchContacts
};