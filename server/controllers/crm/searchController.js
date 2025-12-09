const pool = require('../../config/database');
const { getTenantId, getOrCreateTenant, getTenant } = require('../../utils/crm');

// Global search across all CRM entities
const globalSearch = async (req, res) => {
  try {
    const { query, limit = 50 } = req.query;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Performing global search for tenant ID:', tenantId);

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchTerm = `%${query.trim()}%`;
    const searchLimit = Math.min(parseInt(limit), 100); // Cap at 100 results

    // Search accounts
    const accounts = await pool.query(
      `SELECT 
        'account' as entity_type,
        id,
        name as display_name,
        description,
        industry,
        created_at
      FROM accounts 
      WHERE tenant_id = $1 AND (
        name ILIKE $2 OR 
        description ILIKE $2 OR 
        industry ILIKE $2
      )
      ORDER BY name
      LIMIT $3`,
      [tenantId, searchTerm, searchLimit]
    );

    // Search contacts
    const contacts = await pool.query(
      `SELECT 
        'contact' as entity_type,
        id,
        CONCAT(first_name, ' ', last_name) as display_name,
        email,
        title,
        department,
        created_at
      FROM contacts 
      WHERE tenant_id = $1 AND (
        first_name ILIKE $2 OR 
        last_name ILIKE $2 OR 
        email ILIKE $2 OR 
        title ILIKE $2 OR
        department ILIKE $2
      )
      ORDER BY last_name, first_name
      LIMIT $3`,
      [tenantId, searchTerm, searchLimit]
    );

    // Search opportunities
    const opportunities = await pool.query(
      `SELECT 
        'opportunity' as entity_type,
        o.id,
        o.name as display_name,
        o.description,
        o.amount,
        a.name as account_name,
        o.expected_close_date,
        o.created_at
      FROM opportunities o
      LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $1
      WHERE o.tenant_id = $1 AND (
        o.name ILIKE $2 OR 
        o.description ILIKE $2 OR
        a.name ILIKE $2
      )
      ORDER BY o.expected_close_date DESC
      LIMIT $3`,
      [tenantId, searchTerm, searchLimit]
    );

    // Combine and format results
    const results = [
      ...accounts.rows.map(row => ({ ...row, score: 1 })),
      ...contacts.rows.map(row => ({ ...row, score: 1 })),
      ...opportunities.rows.map(row => ({ ...row, score: 1 }))
    ];

    // Sort by relevance (you can implement more sophisticated scoring here)
    results.sort((a, b) => {
      // Prioritize exact matches
      const aExact = a.display_name.toLowerCase() === query.toLowerCase();
      const bExact = b.display_name.toLowerCase() === query.toLowerCase();
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Then by creation date (newer first)
      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.json({
      success: true,
      data: {
        query: query.trim(),
        total_results: results.length,
        results: results.slice(0, searchLimit)
      }
    });

  } catch (error) {
    console.error('Error performing global search:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Search within a specific entity type
const entitySearch = async (req, res) => {
  try {
    const { entity_type } = req.params;
    const { query, filters = {}, limit = 50, offset = 0 } = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Searching', entity_type, 'for tenant ID:', tenantId);

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchTerm = `%${query.trim()}%`;
    const searchLimit = Math.min(parseInt(limit), 100);
    const searchOffset = parseInt(offset);

    let result;
    let totalCount;

    switch (entity_type) {
      case 'accounts':
        result = await searchAccounts(tenantId, searchTerm, filters, searchLimit, searchOffset);
        totalCount = await getAccountCount(tenantId, searchTerm, filters);
        break;
      
      case 'contacts':
        result = await searchContacts(tenantId, searchTerm, filters, searchLimit, searchOffset);
        totalCount = await getContactCount(tenantId, searchTerm, filters);
        break;
      
      case 'opportunities':
        result = await searchOpportunities(tenantId, searchTerm, filters, searchLimit, searchOffset);
        totalCount = await getOpportunityCount(tenantId, searchTerm, filters);
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type. Must be one of: accounts, contacts, opportunities'
        });
    }

    res.json({
      success: true,
      data: {
        entity_type,
        query: query.trim(),
        results: result.rows,
        total: totalCount,
        pagination: {
          limit: searchLimit,
          offset: searchOffset,
          total: totalCount
        }
      }
    });

  } catch (error) {
    console.error('Error performing entity search:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Helper function to search accounts
const searchAccounts = async (tenantId, searchTerm, filters, limit, offset) => {
  let query = `
    SELECT a.*, 
      COUNT(ac.contact_id) as contact_count,
      COUNT(o.id) as opportunity_count
    FROM accounts a
    LEFT JOIN account_contacts ac ON a.id = ac.account_id
    LEFT JOIN opportunities o ON a.id = o.account_id
    WHERE a.tenant_id = $1 AND (
      a.name ILIKE $2 OR 
      a.description ILIKE $2 OR 
      a.industry ILIKE $2
    )
  `;
  
  let params = [tenantId, searchTerm];
  let paramCount = 2;

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

  query += ` GROUP BY a.id ORDER BY a.name LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(limit, offset);

  return await pool.query(query, params);
};

// Helper function to search contacts
const searchContacts = async (tenantId, searchTerm, filters, limit, offset) => {
  let query = `
    SELECT c.*, 
      COUNT(ac.account_id) as account_count,
      COUNT(oc.opportunity_id) as opportunity_count
    FROM contacts c
    LEFT JOIN account_contacts ac ON c.id = ac.contact_id
    LEFT JOIN opportunity_contacts oc ON c.id = oc.contact_id
    WHERE c.tenant_id = $1 AND (
      c.first_name ILIKE $2 OR 
      c.last_name ILIKE $2 OR 
      c.email ILIKE $2 OR 
      c.title ILIKE $2 OR
      c.department ILIKE $2
    )
  `;
  
  let params = [tenantId, searchTerm];
  let paramCount = 2;

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

  query += ` GROUP BY c.id ORDER BY c.last_name, c.first_name LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(limit, offset);

  return await pool.query(query, params);
};

// Helper function to search opportunities
const searchOpportunities = async (tenantId, searchTerm, filters, limit, offset) => {
  let query = `
    SELECT o.*, 
      a.name as account_name,
      s.name as stage_name
    FROM opportunities o
    LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $1
    LEFT JOIN opportunity_stages s ON o.stage_id = s.id AND s.tenant_id = $1
    WHERE o.tenant_id = $1 AND (
      o.name ILIKE $2 OR 
      o.description ILIKE $2 OR
      a.name ILIKE $2
    )
  `;
  
  let params = [tenantId, searchTerm];
  let paramCount = 2;

  // Add filters
  if (filters.stage_id) {
    paramCount++;
    query += ` AND o.stage_id = $${paramCount}`;
    params.push(filters.stage_id);
  }

  if (filters.min_amount) {
    paramCount++;
    query += ` AND o.amount >= $${paramCount}`;
    params.push(parseFloat(filters.min_amount));
  }

  query += ` ORDER BY o.expected_close_date DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(limit, offset);

  return await pool.query(query, params);
};

// Helper function to get account count
const getAccountCount = async (tenantId, searchTerm, filters) => {
  let query = 'SELECT COUNT(*) FROM accounts WHERE tenant_id = $1 AND (name ILIKE $2 OR description ILIKE $2 OR industry ILIKE $2)';
  let params = [tenantId, searchTerm];

  if (filters.industry) {
    query += ' AND industry = $3';
    params.push(filters.industry);
  }

  if (filters.account_type) {
    query += ' AND account_type = $' + (params.length + 1);
    params.push(filters.account_type);
  }

  const result = await pool.query(query, params);
  
  // Handle case when no accounts exist for this tenant
  if (!result.rows || result.rows.length === 0) {
    return 0;
  }
  
  return parseInt(result.rows[0].count);
};

// Helper function to get contact count
const getContactCount = async (tenantId, searchTerm, filters) => {
  let query = 'SELECT COUNT(*) FROM contacts WHERE tenant_id = $1 AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2 OR title ILIKE $2 OR department ILIKE $2)';
  let params = [tenantId, searchTerm];

  if (filters.title) {
    query += ' AND title = $3';
    params.push(filters.title);
  }

  if (filters.department) {
    query += ' AND department = $' + (params.length + 1);
    params.push(filters.department);
  }

  const result = await pool.query(query, params);
  
  // Handle case when no contacts exist for this tenant
  if (!result.rows || result.rows.length === 0) {
    return 0;
  }
  
  return parseInt(result.rows[0].count);
};

// Helper function to get opportunity count
const getOpportunityCount = async (tenantId, searchTerm, filters) => {
  let query = `
    SELECT COUNT(*) FROM opportunities o
    LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $1
    WHERE o.tenant_id = $1 AND (o.name ILIKE $2 OR o.description ILIKE $2 OR a.name ILIKE $2)
  `;
  let params = [tenantId, searchTerm];

  if (filters.stage_id) {
    query += ' AND o.stage_id = $3';
    params.push(filters.stage_id);
  }

  if (filters.min_amount) {
    query += ' AND o.amount >= $' + (params.length + 1);
    params.push(parseFloat(filters.min_amount));
  }

  const result = await pool.query(query, params);
  
  // Handle case when no opportunities exist for this tenant
  if (!result.rows || result.rows.length === 0) {
    return 0;
  }
  return parseInt(result.rows[0].count);
};

module.exports = {
  globalSearch,
  entitySearch
};