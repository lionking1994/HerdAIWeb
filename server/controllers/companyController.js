const pool = require('../config/database')
const { handleError } = require('../utils/errorHandler')

// Get company by domain
exports.getCompanyByDomain = async (req, res) => {
  try {
    const { domain } = req.params
    const query = `
            SELECT c.*, u.name as admin_name, u.email as admin_email
            FROM company c
            LEFT JOIN users u ON c.admin_id = u.id
            WHERE c.domain = $1
        `
    const result = await pool.query(query, [domain])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      })
    }

    res.status(200).json({
      success: true,
      company: result.rows[0],
    })
  } catch (error) {
    return handleError(res, error, 'Failed to get company')
  }
}

// Get company by ID
exports.getCompanyById = async (req, res) => {
  try {
    const { id } = req.params
    const query = `
            SELECT c.*, u.name as admin_name, u.email as admin_email
            FROM company c
            LEFT JOIN users u ON c.admin_id = u.id
            WHERE c.id = $1
        `
    const result = await pool.query(query, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      })
    }

    res.status(200).json({
      success: true,
      company: result.rows[0],
    })
  } catch (error) {
    return handleError(res, error, 'Failed to get company')
  }
}

// Update company
exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params
    const { name, domain, admin_id, description, default_cph } = req.body

    const query = `
            UPDATE company
            SET name = $1,
                domain = $2,
                admin_id = $3,
                description = $4,
                default_cph = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
            RETURNING *
        `
    const result = await pool.query(query, [
      name,
      domain,
      admin_id,
      description,
      default_cph,
      id,
    ])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      })
    }

    res.status(200).json({
      success: true,
      company: result.rows[0],
    })
  } catch (error) {
    return handleError(res, error, 'Failed to update company')
  }
}

// Delete company
exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params
    const query = 'DELETE FROM company WHERE id = $1 RETURNING *'
    const result = await pool.query(query, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Company deleted successfully',
    })
  } catch (error) {
    return handleError(res, error, 'Failed to delete company')
  }
}

// Get all companies
exports.getAllCompanies = async (req, res) => {
  try {
    const query = `
            SELECT c.*, u.name as admin_name, u.email as admin_email
            FROM company c
            LEFT JOIN users u ON c.admin_id = u.id
            ORDER BY c.created_at DESC
        `
    const result = await pool.query(query)

    res.status(200).json({
      success: true,
      companies: result.rows,
    })
  } catch (error) {
    return handleError(res, error, 'Failed to get companies')
  }
}

// Get company statistics
exports.getCompanyStats = async (req, res) => {
  try {
    const { id } = req.params
    const statsQuery = `
            SELECT
                c.id,
                c.name,
                c.domain,
                (SELECT COUNT(*) FROM users WHERE email LIKE '%' || c.domain) as total_users,
                (SELECT COUNT(*) FROM meetings m
                 JOIN users u ON m.org_id = u.id
                 WHERE u.email LIKE '%' || c.domain) as total_meetings,
                (SELECT COUNT(*) FROM tasks t
                 JOIN meetings m ON t.meeting_id = m.id
                 JOIN users u ON m.org_id = u.id
                 WHERE u.email LIKE '%' || c.domain) as total_tasks
            FROM company c
            WHERE c.id = $1
        `
    const result = await pool.query(statsQuery, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      })
    }

    res.status(200).json({
      success: true,
      stats: result.rows[0],
    })
  } catch (error) {
    return handleError(res, error, 'Failed to get company statistics')
  }
}

// Toggle company enabled status
exports.toggleEnabled = async (req, res) => {
  try {
    const { id } = req.params
    const { enabled } = req.body

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Enabled status must be a boolean',
      })
    }

    const query = `
            UPDATE company
            SET enabled = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `
    const result = await pool.query(query, [enabled, id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      })
    }

    res.status(200).json({
      success: true,
      company: result.rows[0],
    })
  } catch (error) {
    return handleError(res, error, 'Failed to toggle company status')
  }
}

// Toggle auto create tasks from activities
exports.toggleAutoCreateTasks = async (req, res) => {
  try {
    const { id } = req.params
    const { autoCreateTasks } = req.body

    if (typeof autoCreateTasks !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Auto create tasks status must be a boolean',
      })
    }

    const query = `
            UPDATE company
            SET auto_create_tasks_from_activities = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `
    const result = await pool.query(query, [autoCreateTasks, id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      })
    }

    res.status(200).json({
      success: true,
      company: result.rows[0],
    })
  } catch (error) {
    return handleError(res, error, 'Failed to toggle auto create tasks status')
  }
}

// Toggle show cost estimates
exports.toggleShowCostEstimates = async (req, res) => {
  try {
    const { id } = req.params
    const { showCostEstimates } = req.body

    if (typeof showCostEstimates !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Show cost estimates status must be a boolean',
      })
    }

    const query = `
            UPDATE company
            SET show_cost_estimates = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `
    const result = await pool.query(query, [showCostEstimates, id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      })
    }

    res.status(200).json({
      success: true,
      company: result.rows[0],
    })
  } catch (error) {
    return handleError(
      res,
      error,
      'Failed to toggle show cost estimates status'
    )
  }
}

// Get user companies
exports.getUserCompanies = async (req, res) => {
  try {
    const userId = req.user.id

    const query = `
      SELECT c.id, c.name, c.description, c.logo_url, cu.role, cu.company_role_id
      FROM companies c
      JOIN company_users cu ON c.id = cu.company_id
      WHERE cu.user_id = $1
      ORDER BY c.name
    `

    const result = await pool.query(query, [userId])

    return res.json({
      success: true,
      companies: result.rows,
    })
  } catch (error) {
    return handleError(res, error, 'Failed to get user companies')
  }
}
// getCompanyByCompanyRole

exports.getCompanyByCompanyRole = async (req, res) => {
  try {
    const { companyRoleId } = req.query

    const query = `
      SELECT * FROM company_roles WHERE id = $1
    `

    const result = await pool.query(query, [companyRoleId])

    res.status(200).json({
      success: true,
      companyRole: result.rows[0], // returns a single object instead of an array
    })
  } catch (error) {
    return handleError(res, error, 'Failed to get company role by ID')
  }
}

exports.getCompanyUsers = async (req, res) => {
  try {
    const { companyId } = req.query

    const query = `
      SELECT
        u.id AS user_id,
        u.name AS user_name,
        u.email AS user_email
      FROM
        users u
      JOIN
        company_roles cr ON u.company_role = cr.id
      JOIN
        company c ON cr.company_id = c.id
      WHERE
        c.id = $1
      ORDER BY
        u.id ASC
    `

    const result = await pool.query(query, [companyId])

    res.status(200).json({
      success: true,
      users: result.rows,
    })
  } catch (error) {
    return handleError(res, error, 'Failed to get users for the company')
  }
}

// Aggregated bootstrap for admin Company Roles page
exports.getCompanyBootstrap = async (req, res) => {
  const client = await pool.connect()
  try {
    const { id } = req.params

    // Company
    const companyResult = await client.query(
      `SELECT c.*, u.name as admin_name, u.email as admin_email
       FROM company c
       LEFT JOIN users u ON c.admin_id = u.id
       WHERE c.id = $1`,
      [id]
    )

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Company not found' })
    }

    // Roles
    const rolesResult = await client.query(
      `SELECT id, name, description, meeting_weight, top_meeting_count,
              research_review_weight, research_review_top_count,
              task_weight, task_top_count, rating_given_weight,
              rating_given_top_count, est_cph
       FROM company_roles WHERE company_id = $1 ORDER BY id`,
      [id]
    )

    // Orgs
    const orgsResult = await client.query(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM organizations WHERE company_id = $1 ORDER BY name`,
      [id]
    )

    const organizations = orgsResult.rows
    let firstOrgRoleTree = []
    const firstOrg = organizations[0]
    if (firstOrg) {
      const treeResult = await client.query(
        `SELECT id, role_id, parent_node_id, sort_order, depth_level
         FROM organization_role_nodes WHERE organization_id = $1
         ORDER BY COALESCE(parent_node_id, 0), sort_order, id`,
        [firstOrg.id]
      )
      firstOrgRoleTree = treeResult.rows
    }

    return res.json({
      success: true,
      company: companyResult.rows[0],
      roles: rolesResult.rows,
      organizations,
      firstOrganizationId: firstOrg ? firstOrg.id : null,
      firstOrgRoleTree,
    })
  } catch (error) {
    return handleError(res, error, 'Failed to load company bootstrap data')
  } finally {
    client.release()
  }
}