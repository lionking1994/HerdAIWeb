const pool = require('../config/database');
const { handleError } = require('../utils/errorHandler');

// Get all company roles for a specific company
exports.getCompanyRoles = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    
    const result = await pool.query(
      `SELECT * FROM company_roles WHERE company_id = $1 ORDER BY name`,
      [companyId]
    );
    
    res.json({ success: true, roles: result.rows });
  } catch (error) {
    console.error('Error fetching company roles:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create a new company role
exports.createCompanyRole = async (req, res) => {
  try {
    const { 
      company_id, 
      name, 
      description, 
      meeting_weight, 
      top_meeting_count, 
      research_review_weight, 
      research_review_top_count, 
      task_weight, 
      task_top_count, 
      rating_given_weight, 
      rating_given_top_count,
      est_cph
    } = req.body;
    
    
    const result = await pool.query(
      `INSERT INTO company_roles (
        company_id, 
        name, 
        description, 
        meeting_weight, 
        top_meeting_count, 
        research_review_weight, 
        research_review_top_count, 
        task_weight, 
        task_top_count, 
        rating_given_weight, 
        rating_given_top_count,
        est_cph
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        company_id, 
        name, 
        description, 
        meeting_weight || 1, 
        top_meeting_count || 5, 
        research_review_weight || 1, 
        research_review_top_count || 5, 
        task_weight || 1, 
        task_top_count || 5, 
        rating_given_weight || 1, 
        rating_given_top_count || 5,
        est_cph
      ]
    );
    
    res.status(201).json({ success: true, role: result.rows[0] });
  } catch (error) {
    console.error('Error creating company role:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update a company role
exports.updateCompanyRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { 
      name, 
      description, 
      meeting_weight, 
      top_meeting_count, 
      research_review_weight, 
      research_review_top_count, 
      task_weight, 
      task_top_count, 
      rating_given_weight, 
      rating_given_top_count,
      est_cph
    } = req.body;
    
    // Get the company_id for this role
    const roleCheck = await pool.query(
      `SELECT company_id FROM company_roles WHERE id = $1`,
      [roleId]
    );
    
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    
    const company_id = roleCheck.rows[0].company_id;
    

    
    const result = await pool.query(
      `UPDATE company_roles SET 
        name = $1, 
        description = $2, 
        meeting_weight = $3, 
        top_meeting_count = $4, 
        research_review_weight = $5, 
        research_review_top_count = $6, 
        task_weight = $7, 
        task_top_count = $8, 
        rating_given_weight = $9, 
        rating_given_top_count = $10,
        est_cph = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 RETURNING *`,
      [
        name, 
        description, 
        meeting_weight, 
        top_meeting_count, 
        research_review_weight, 
        research_review_top_count, 
        task_weight, 
        task_top_count, 
        rating_given_weight, 
        rating_given_top_count,
        est_cph,
        roleId
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    
    res.json({ success: true, role: result.rows[0] });
  } catch (error) {
    console.error('Error updating company role:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete a company role
exports.deleteCompanyRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    
    // Get the company_id for this role
    const roleCheck = await pool.query(
      `SELECT company_id FROM company_roles WHERE id = $1`,
      [roleId]
    );
    
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    
    
    // First update any users with this role to have null company_role_id
    await pool.query(
      `UPDATE company_users SET company_role_id = NULL WHERE company_role_id = $1`,
      [roleId]
    );
    
    // Then delete the role
    const result = await pool.query(
      `DELETE FROM company_roles WHERE id = $1 RETURNING *`,
      [roleId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting company role:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update a user's company role
exports.updateUserCompanyRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { company_role_id, companyId } = req.body;
    
    // Check if the role belongs to the company
    if (company_role_id) {
      const roleCheck = await pool.query(
        `SELECT * FROM company_roles WHERE id = $1 AND company_id = $2`,
        [company_role_id, companyId]
      );
      
      if (roleCheck.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid role for this company' });
      }
    }
    
    // Get the user's current role in the system
    const userCheck = await pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update the user's company role directly in the users table
    const result = await pool.query(
      `UPDATE users SET company_role_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [company_role_id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: 'User role updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user company role:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get a user's company role
exports.getUserCompanyRole = async (req, res) => {
  try {
    const { userId, companyId } = req.params;
    
    // Get the user's company role directly from the users table and join with company_roles
    const result = await pool.query(
      `SELECT u.company_role_id, cr.name, cr.description 
       FROM users u 
       LEFT JOIN company_roles cr ON u.company_role_id = cr.id 
       WHERE u.id = $1 AND cr.company_id = $2`,
      [userId, companyId]
    );
    
    if (result.rows.length === 0) {
      // Check if the user exists but has no role for this company
      const userCheck = await pool.query(
        `SELECT * FROM users WHERE id = $1`,
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      return res.json({ success: true, role: { company_role_id: null, name: null, description: null } });
    }
    
    res.json({ success: true, role: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user company role:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
