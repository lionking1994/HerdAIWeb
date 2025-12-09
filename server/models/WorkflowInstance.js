const pool = require('../config/database');

class WorkflowInstance {
  static async create(workflowId, name, data = {}, assignedTo = null, createdBy = null) {
    const query = `
      INSERT INTO workflow_instances (workflow_id, name, data, assigned_to, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [workflowId, name, JSON.stringify(data), assignedTo, createdBy];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM workflow_instances WHERE id = $1';
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  static async findByWorkflowId(workflowId) {
    const query = 'SELECT * FROM workflow_instances WHERE workflow_id = $1 ORDER BY created_at DESC';
    const { rows } = await pool.query(query, [workflowId]);
    return rows;
  }

  static async updateStatus(id, status, currentNodeId = null, data = null) {
    let query = 'UPDATE workflow_instances SET status = $1, updated_at = CURRENT_TIMESTAMP';
    let values = [status];
    let paramCount = 1;

    if (currentNodeId) {
      paramCount++;
      query += `, current_node_id = $${paramCount}`;
      values.push(currentNodeId);
    }

    if (data) {
      paramCount++;
      query += `, data = $${paramCount}`;
      values.push(JSON.stringify(data));
    }

    if (status === 'completed') {
      // paramCount++;
      query += `, completed_at = CURRENT_TIMESTAMP`;
    }

    paramCount++;
    query += ` WHERE id = $${paramCount} RETURNING *`;
    values.push(id);

    console.log("Workflow Instance Update Status query", query);
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async updateData(id, data) {
    const query = `
      UPDATE workflow_instances 
      SET data = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *
    `;
    const { rows } = await pool.query(query, [JSON.stringify(data), id]);
    return rows[0];
  }

  static async getActiveInstances() {
    const query = `
      SELECT wi.*, ww.name as workflow_name, u.name as assigned_user_name
      FROM workflow_instances wi
      JOIN workflow_workflows ww ON wi.workflow_id = ww.id
      LEFT JOIN users u ON wi.assigned_to = u.id
      WHERE wi.status IN ('active', 'paused')
      ORDER BY wi.created_at DESC
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  static async getAllInstances() {
    const query = `
      SELECT wi.*, ww.name as workflow_name, u.name as assigned_user_name
      FROM workflow_instances wi
      JOIN workflow_workflows ww ON wi.workflow_id = ww.id
      LEFT JOIN users u ON wi.assigned_to = u.id
      ORDER BY wi.created_at DESC
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  static async getInstancesByCompany(companyId) {
    const query = `
      SELECT wi.*, ww.name as workflow_name, u.name as assigned_user_name
      FROM workflow_instances wi
      JOIN workflow_workflows ww ON wi.workflow_id = ww.id
      LEFT JOIN users u ON wi.assigned_to = u.id
      WHERE ww.company_id = $1
      ORDER BY wi.created_at DESC
    `;
    const { rows } = await pool.query(query, [companyId]);
    return rows;
  }

  static async deleteInstance(id) {
    // First delete related node instances
    await pool.query('DELETE FROM workflow_node_instances WHERE workflow_instance_id = $1', [id]);
    
    // Then delete the workflow instance
    const query = 'DELETE FROM workflow_instances WHERE id = $1 RETURNING *';
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  static async getInstanceCountsByCompany(companyId) {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN wi.status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN wi.status = 'paused' THEN 1 END) as paused,
        COUNT(CASE WHEN wi.status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN wi.status = 'cancelled' THEN 1 END) as cancelled
      FROM workflow_instances wi
      JOIN workflow_workflows ww ON wi.workflow_id = ww.id
      WHERE ww.company_id = $1
    `;
    const { rows } = await pool.query(query, [companyId]);
    return rows[0];
  }

  static async getInstanceWithNodes(instanceId) {
    const query = `
      SELECT 
        wi.*,
        ww.name as workflow_name,
        wni.id as node_instance_id,
        wni.node_id,
        wni.status as node_status,
        wni.started_at as node_started_at,
        wni.completed_at as node_completed_at,
        wni.data as node_data,
        wni.result as node_result,
        wn.type as node_type,
        wn.config as node_config
      FROM workflow_instances wi
      JOIN workflow_workflows ww ON wi.workflow_id = ww.id
      LEFT JOIN workflow_node_instances wni ON wi.id = wni.workflow_instance_id
      LEFT JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wi.id = $1
      ORDER BY wni.created_at
    `;
    const { rows } = await pool.query(query, [instanceId]);
    return rows;
  }
}

module.exports = WorkflowInstance; 