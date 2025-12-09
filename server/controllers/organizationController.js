const pool = require('../config/database');
const { handleError } = require('../utils/errorHandler');

exports.listOrganizations = async (req, res) => {
  try {
    const { companyId } = req.params;
    const result = await pool.query(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM organizations WHERE company_id = $1 ORDER BY name`,
      [companyId]
    );
    res.json({ success: true, organizations: result.rows });
  } catch (error) {
    handleError(res, error, 'Error fetching organizations');
  }
};

exports.createOrganization = async (req, res) => {
  try {
    const { company_id, name, description, is_active } = req.body;
    const result = await pool.query(
      `INSERT INTO organizations (company_id, name, description, is_active)
       VALUES ($1, $2, $3, COALESCE($4, TRUE)) RETURNING *`,
      [company_id, name, description, is_active]
    );
    res.status(201).json({ success: true, organization: result.rows[0] });
  } catch (error) {
    handleError(res, error, 'Error creating organization');
  }
};

exports.updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    const result = await pool.query(
      `UPDATE organizations SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name, description, is_active, id]
    );
    res.json({ success: true, organization: result.rows[0] });
  } catch (error) {
    handleError(res, error, 'Error updating organization');
  }
};

exports.deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM organizations WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Error deleting organization');
  }
};

// ---- Role hierarchy ----
exports.getRoleTree = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const result = await pool.query(
      `SELECT id, role_id, parent_node_id, sort_order, depth_level
       FROM organization_role_nodes WHERE organization_id = $1
       ORDER BY COALESCE(parent_node_id, 0), sort_order, id`,
      [organizationId]
    );
    res.json({ success: true, nodes: result.rows });
  } catch (error) {
    handleError(res, error, 'Error fetching role tree');
  }
};

exports.bulkSaveRoleTree = async (req, res) => {
  const client = await pool.connect();
  try {
    const { organizationId } = req.params;
    const { nodes } = req.body; // [{role_id, parent_node_id, sort_order, depth_level}]

    await client.query('BEGIN');
    await client.query('DELETE FROM organization_role_nodes WHERE organization_id = $1', [organizationId]);

    // First, insert all nodes without parent references to get their IDs
    const nodeIdMap = new Map(); // Maps role_id to the new node ID
    const insertResults = [];

    for (const n of nodes) {
      const result = await client.query(
        `INSERT INTO organization_role_nodes (organization_id, role_id, parent_node_id, sort_order, depth_level)
         VALUES ($1, $2, NULL, $3, $4) RETURNING id, role_id`,
        [organizationId, n.role_id, n.sort_order || 0, n.depth_level || 0]
      );
      
      const insertedNode = result.rows[0];
      nodeIdMap.set(insertedNode.role_id, insertedNode.id);
      insertResults.push({ ...insertedNode, originalParent: n.parent_node_id });
    }

    // Now update parent references using the new node IDs
    for (const result of insertResults) {
      if (result.originalParent) {
        // Find the parent node ID by role_id
        const parentNodeId = nodeIdMap.get(result.originalParent);
        if (parentNodeId) {
          await client.query(
            'UPDATE organization_role_nodes SET parent_node_id = $1 WHERE id = $2',
            [parentNodeId, result.id]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    handleError(res, error, 'Error saving role tree');
  } finally {
    client.release();
  }
};


