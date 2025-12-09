const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { getTenantId, getOrCreateTenant, getTenant } = require('../../utils/crm');

// Create new account
const createAccount = async (req, res) => {
  try {
    const accountData = req.body;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Creating account for tenant ID:', tenantId);

    // Validation
    if (!accountData.name) {
      return res.status(400).json({
        success: false,
        message: 'Account name is required'
      });
    }

    // Check if account name already exists for this tenant
    const existingAccount = await pool.query(
      'SELECT * FROM accounts WHERE tenant_id = $1 AND name = $2',
      [tenantId, accountData.name]
    );

    if (existingAccount.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Account with this name already exists'
      });
    }

    // Check if account email already exists for this tenant (if email is provided)
    if (accountData.email) {
      const existingEmailAccount = await pool.query(
        'SELECT * FROM accounts WHERE tenant_id = $1 AND email = $2',
        [tenantId, accountData.email]
      );

      if (existingEmailAccount.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Account with this email already exists'
        });
      }
    }

    // Create account
    const newAccount = await pool.query(
      `INSERT INTO accounts (
        tenant_id, name, description, industry, account_type, website, phone, email,
        billing_address, shipping_address, custom_fields, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        tenantId, accountData.name, accountData.description || '',
        accountData.industry || null, accountData.account_type || null,
        accountData.website || null, accountData.phone || null, accountData.email || null,
        accountData.billing_address || null, accountData.shipping_address || null,
        accountData.custom_fields || null, req.user?.id || null, req.user?.id || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: newAccount.rows[0]
    });

  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get all accounts with pagination and search
// const getAccounts = async (req, res) => {
//   try {
//     const { page = 1, limit = 20, search, filters = {} } = req.query;

//     // Get tenant ID from request
//     const tenantId = await getTenantId(req);
//     console.log('🔍 Fetching accounts for tenant ID:', tenantId);

//     const offset = (page - 1) * limit;

//     let query = `
//       SELECT a.*, 
//         COUNT(ac.contact_id) as contact_count,
//         COUNT(o.id) as opportunity_count
//       FROM accounts a
//       LEFT JOIN account_contacts ac ON a.id = ac.account_id
//       LEFT JOIN opportunities o ON a.id = o.account_id
//       WHERE a.tenant_id = $1
//     `;

//     let params = [tenantId];
//     let paramCount = 1;

//     // Add search functionality
//     if (search) {
//       paramCount++;
//       query += ` AND (
//         a.name ILIKE $${paramCount} OR 
//         a.description ILIKE $${paramCount} OR 
//         a.industry ILIKE $${paramCount} OR
//         a.website ILIKE $${paramCount} OR
//         a.email ILIKE $${paramCount}
//       )`;
//       params.push(`%${search}%`);
//     }

//     // Add filters
//     if (filters.industry) {
//       paramCount++;
//       query += ` AND a.industry = $${paramCount}`;
//       params.push(filters.industry);
//     }

//     if (filters.account_type) {
//       paramCount++;
//       query += ` AND a.account_type = $${paramCount}`;
//       params.push(filters.account_type);
//     }

//     if (filters.has_contacts) {
//       query += ` AND EXISTS (SELECT 1 FROM account_contacts ac2 WHERE ac2.account_id = a.id)`;
//     }

//     if (filters.has_opportunities) {
//       query += ` AND EXISTS (SELECT 1 FROM opportunities o2 WHERE o2.account_id = a.id)`;
//     }

//     // Add grouping and get total count
//     query += ' GROUP BY a.id';

//     const countQuery = query.replace('SELECT a.*, COUNT(ac.contact_id) as contact_count, COUNT(o.id) as opportunity_count', 'SELECT COUNT(DISTINCT a.id)');
//     const countResult = await pool.query(countQuery, params);

//     // Handle case when no accounts exist for this tenant
//     if (!countResult.rows || countResult.rows.length === 0) {
//       return res.json({
//         success: true,
//         data: [],
//         pagination: {
//           page: parseInt(page),
//           limit: parseInt(limit),
//           total: 0,
//           pages: 0
//         }
//       });
//     }

//     const total = parseInt(countResult.rows[0].count);

//     // Add ordering and pagination
//     paramCount++;
//     query += ` ORDER BY a.name LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
//     params.push(parseInt(limit), offset);

//     const result = await pool.query(query, params);

//     res.json({
//       success: true,
//       data: result.rows,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit)
//       }
//     });

//   } catch (error) {
//     console.error('Error fetching accounts:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message || 'Internal server error'
//     });
//   }
// };

const getAccounts = async (req, res) => {
  try {
    const { page = 1, limit = 0, search, filters = {} } = req.query;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching accounts for tenant ID:', tenantId);

    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, 
        COUNT(ac.contact_id) as contact_count,
        COUNT(o.id) as opportunity_count,
        COALESCE(
          ROUND(
            (NULLIF(COUNT(os.id),0) * 100.0 / NULLIF(COUNT(o.id), 0))::numeric, 
            2
          ), 
          0
        ) AS opportunities_percentage
      FROM accounts a
      LEFT JOIN account_contacts ac ON a.id = ac.account_id
      LEFT JOIN opportunities o ON a.id = o.account_id
      LEFT JOIN opportunity_stages os ON o.stage_id = os.id AND os.is_closed_won = true
      WHERE a.tenant_id = $1
    `;

    let params = [tenantId];
    let paramCount = 1;

    // Add search functionality
    if (search) {
      paramCount++;
      query += ` AND (
        a.name ILIKE $${paramCount} OR 
        a.description ILIKE $${paramCount} OR 
        a.industry ILIKE $${paramCount} OR
        a.website ILIKE $${paramCount} OR
        a.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Add filters
    if (filters.industry) {
      paramCount++;
      query += ` AND a.industry = $${paramCount}`;
      params.push(filters.industry);
    }

    if (filters.account_type) {
      paramCount++;
      query += ` AND a.account_type = $${paramCount}`;
      params.push(filters.account_type);
    }

    if (filters.has_contacts) {
      query += ` AND EXISTS (SELECT 1 FROM account_contacts ac2 WHERE ac2.account_id = a.id)`;
    }

    if (filters.has_opportunities) {
      query += ` AND EXISTS (SELECT 1 FROM opportunities o2 WHERE o2.account_id = a.id)`;
    }

    // Add grouping for the main query
    query += ' GROUP BY a.id';

    // Create a separate count query that doesn't include the complex aggregations
    let countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM accounts a
      LEFT JOIN account_contacts ac ON a.id = ac.account_id
      LEFT JOIN opportunities o ON a.id = o.account_id
      LEFT JOIN opportunity_stages os ON o.stage_id = os.id AND os.is_closed_won = true
      WHERE a.tenant_id = $1
    `;

    // Add the same search and filter conditions to count query
    let countParamCount = 1;
    let countParams = [tenantId];

    // Add search functionality to count query
    if (search) {
      countParamCount++;
      countQuery += ` AND (
        a.name ILIKE $${countParamCount} OR 
        a.description ILIKE $${countParamCount} OR 
        a.industry ILIKE $${countParamCount} OR
        a.website ILIKE $${countParamCount} OR
        a.email ILIKE $${countParamCount}
      )`;
      countParams.push(`%${search}%`);
    }

    // Add filters to count query
    if (filters.industry) {
      countParamCount++;
      countQuery += ` AND a.industry = $${countParamCount}`;
      countParams.push(filters.industry);
    }

    if (filters.account_type) {
      countParamCount++;
      countQuery += ` AND a.account_type = $${countParamCount}`;
      countParams.push(filters.account_type);
    }

    if (filters.has_contacts) {
      countQuery += ` AND EXISTS (SELECT 1 FROM account_contacts ac2 WHERE ac2.account_id = a.id)`;
    }

    if (filters.has_opportunities) {
      countQuery += ` AND EXISTS (SELECT 1 FROM opportunities o2 WHERE o2.account_id = a.id)`;
    }

    const countResult = await pool.query(countQuery, countParams);

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
    const totalPages = parseInt(limit) === -1 ? 1 : Math.ceil(total / limit);

    // Add ordering and pagination
    query += ` ORDER BY a.name`;
    
    // Only add LIMIT and OFFSET if limit is not -1
    if (parseInt(limit) !== -1) {
      paramCount++;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(parseInt(limit), offset);
    }

    const result = await pool.query(query, params);

    console.log("total pages", result.rows.length)

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: totalPages
      }
    });

  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get account by ID
const getAccountById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching account ID:', id, 'for tenant ID:', tenantId);

    const result = await pool.query(
      'SELECT * FROM accounts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update account
const updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Updating account ID:', id, 'for tenant ID:', tenantId);

    // Check if account exists and belongs to tenant
    const existingAccount = await pool.query(
      'SELECT * FROM accounts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingAccount.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Check if name is being changed and if new name already exists
    if (updateData.name && updateData.name !== existingAccount.rows[0].name) {
      const nameExists = await pool.query(
        'SELECT * FROM accounts WHERE tenant_id = $1 AND name = $2 AND id != $3',
        [tenantId, updateData.name, id]
      );

      if (nameExists.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Account with this name already exists'
        });
      }
    }

    // Check if email is being changed and if new email already exists
    if (updateData.email && updateData.email !== existingAccount.rows[0].email) {
      const emailExists = await pool.query(
        'SELECT * FROM accounts WHERE tenant_id = $1 AND email = $2 AND id != $3',
        [tenantId, updateData.email, id]
      );

      if (emailExists.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Account with this email already exists'
        });
      }
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

    // Add updated_by and updated_at
    updateFields.push(`updated_by = $${paramCount}`);
    updateFields.push(`updated_at = NOW()`);
    values.push(req.user?.id || null);

    // Add WHERE clause parameters
    values.push(id, tenantId);

    const updateQuery = `
      UPDATE accounts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1} AND tenant_id = $${paramCount + 2}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Account updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Check account relationships before deletion
const checkAccountRelations = async (req, res) => {
  try {
    const { id } = req.params;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Checking relationships for account ID:', id, 'tenant ID:', tenantId);

    // Check if account exists and belongs to tenant
    const existingAccount = await pool.query(
      'SELECT * FROM accounts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingAccount.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Check related data
    const relatedData = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM account_contacts WHERE account_id = $1) as contact_count,
        (SELECT COUNT(*) FROM opportunities WHERE account_id = $1) as opportunity_count`,
      [id]
    );

    const contactCount = parseInt(relatedData.rows[0].contact_count);
    const opportunityCount = parseInt(relatedData.rows[0].opportunity_count);

    res.json({
      success: true,
      data: {
        account_id: id,
        contact_count: contactCount,
        opportunity_count: opportunityCount,
        has_related_data: contactCount > 0 || opportunityCount > 0
      }
    });

  } catch (error) {
    console.error('Error checking account relationships:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Delete account
const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { forceDelete = false } = req.query; // New parameter for force deletion

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Deleting account ID:', id, 'for tenant ID:', tenantId, 'forceDelete:', forceDelete);

    // Check if account exists and belongs to tenant
    const existingAccount = await pool.query(
      'SELECT * FROM accounts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingAccount.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Check if account has related data
    const hasRelatedData = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM account_contacts WHERE account_id = $1) as contact_count,
        (SELECT COUNT(*) FROM opportunities WHERE account_id = $1) as opportunity_count`,
      [id]
    );

    const contactCount = parseInt(hasRelatedData.rows[0].contact_count);
    const opportunityCount = parseInt(hasRelatedData.rows[0].opportunity_count);

    if ((contactCount > 0 || opportunityCount > 0) && !forceDelete) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account with related data',
        data: {
          contact_count: contactCount,
          opportunity_count: opportunityCount,
          suggestion: 'Use forceDelete=true to proceed with deletion'
        }
      });
    }

    // Delete account (CASCADE will handle related records)
    await pool.query(
      'DELETE FROM accounts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    res.json({
      success: true,
      message: (contactCount > 0 || opportunityCount > 0)
        ? `Account deleted successfully. ${contactCount} related contact(s) and ${opportunityCount} related opportunity(ies) were also removed.`
        : 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get account with relationships
const getAccountWithRelations = async (req, res) => {
  try {
    const { id } = req.params;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching account relationships ID:', id, 'for tenant ID:', tenantId);

    // Check if account exists and belongs to tenant
    const accountExists = await pool.query(
      'SELECT * FROM accounts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (accountExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Get related contacts
    const contacts = await pool.query(
      `SELECT 
        c.*,
        ac.relationship_type,
        ac.is_primary
      FROM account_contacts ac
      JOIN contacts c ON ac.contact_id = c.id AND c.tenant_id = $1
      WHERE ac.account_id = $2
      ORDER BY ac.is_primary DESC, c.last_name, c.first_name`,
      [tenantId, id]
    );

    // Get related opportunities
    const opportunities = await pool.query(
      `SELECT 
        o.*,
        s.name as stage_name
      FROM opportunities o
      LEFT JOIN opportunity_stages s ON o.stage_id = s.id AND s.tenant_id = $1
      WHERE o.account_id = $2 AND o.tenant_id = $1
      ORDER BY o.expected_close_date DESC`,
      [tenantId, id]
    );

    res.json({
      success: true,
      data: {
        account: accountExists.rows[0],
        contacts: contacts.rows,
        opportunities: opportunities.rows
      }
    });

  } catch (error) {
    console.error('Error fetching account relationships:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Search accounts
const searchAccounts = async (req, res) => {
  try {
    const { query, filters = {}, limit = 50, offset = 0 } = req.body;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Searching accounts for tenant ID:', tenantId);

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchTerm = `%${query.trim()}%`;

    let sqlQuery = `
      SELECT 
        a.*,
        COUNT(ac.contact_id) as contact_count,
        COUNT(o.id) as opportunity_count
      FROM accounts a
      LEFT JOIN account_contacts ac ON a.id = ac.account_id
      LEFT JOIN opportunities o ON a.id = o.account_id
      WHERE a.tenant_id = $1 AND (
        a.name ILIKE $2 OR 
        a.description ILIKE $2 OR 
        a.industry ILIKE $2 OR
        a.website ILIKE $2
      )
    `;

    let params = [tenantId, searchTerm];
    let paramCount = 2;

    // Add filters
    if (filters.industry) {
      paramCount++;
      sqlQuery += ` AND a.industry = $${paramCount}`;
      params.push(filters.industry);
    }

    if (filters.account_type) {
      paramCount++;
      sqlQuery += ` AND a.account_type = $${paramCount}`;
      params.push(filters.account_type);
    }

    // Add grouping, ordering, and pagination
    sqlQuery += ` GROUP BY a.id ORDER BY a.name LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
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
    console.error('Error searching accounts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

const getPipeLineData = async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching account for tenant ID:', tenantId);

    const result = await pool.query(
      `SELECT 
        o.id,
        o.name as title, 
        a.name as company,
        s.name as stage,
        o.stage_id, 
        o.amount as value,
        u.name as salesRep,
        co.country as geography,
        co.state as state,
        a.industry as product,
        o.created_at as createdAt,
        o.updated_at as lastActivity,
        s.weight_percentage as weight_percentage,
        CASE 
            WHEN COALESCE(o.probability, 0) < 30 THEN 'low'
            WHEN COALESCE(o.probability, 0) <= 60 THEN 'medium'
            ELSE 'high'
        END AS risk_level,
        COALESCE(o.probability, 0) AS probability,

        COALESCE(
          json_agg(
            json_build_object(
              'movedAt', osh.entered_at,
              'fromStage', fs.name,
              'toStage', ts.name
            )
          ) FILTER (WHERE osh.id IS NOT NULL), 
          '[]'::json
        ) as movementHistory

      FROM public.opportunities as o
      INNER JOIN accounts as a ON o.account_id = a.id
      INNER JOIN public.opportunity_stages as s ON o.stage_id = s.id
      INNER JOIN public.company as c ON c.id = o.tenant_id
      INNER JOIN public.users as u ON u.id = o.owner_id
      LEFT JOIN public.opportunity_contacts as oc ON o.id = oc.opportunity_id 
      and oc.id =(
       SELECT opco.id FROM opportunity_contacts opco WHERE opco.opportunity_id = o.id ORDER BY opco.created_at DESC LIMIT 1
      )
      LEFT JOIN public.contacts as co ON co.id = oc.contact_id
      LEFT JOIN public.opportunity_stage_history as osh ON osh.opportunity_id = o.id
      LEFT JOIN public.opportunity_stages as fs ON osh.from_stage_id = fs.id
      LEFT JOIN public.opportunity_stages as ts ON osh.stage_id = ts.id

      WHERE o.tenant_id = $1
      GROUP BY 
          o.id, o.name, a.name, s.name, o.stage_id, o.amount, 
          u.name, co.country, co.state, a.industry, 
          o.created_at, o.updated_at, o.probability, s.weight_percentage
      ORDER BY o.created_at ASC`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};


module.exports = {
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  getAccountWithRelations,
  searchAccounts,
  checkAccountRelations,  // Add this new function
  getPipeLineData
};