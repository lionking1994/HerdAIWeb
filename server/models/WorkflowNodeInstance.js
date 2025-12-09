const pool = require("../config/database");

class WorkflowNodeInstance {
  static async create(
    workflowInstanceId,
    workflowNodeId,
    nodeId,
    assignedTo = null,
    nodeType = null
  ) {
    const query = `
      INSERT INTO workflow_node_instances (workflow_instance_id, workflow_node_id, node_id, assigned_to, node_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      workflowInstanceId,
      workflowNodeId,
      nodeId,
      assignedTo,
      nodeType,
    ];
    console.log("---create---");
    console.log(query, values);
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findById(id) {
    const query = "SELECT * FROM workflow_node_instances WHERE id = $1";
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  static async findByInstanceAndNodeId(workflowInstanceId, nodeId) {
    const query = `
      SELECT wni.*, wn.type as node_type, wn.config as node_config
      FROM workflow_node_instances wni
      JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wni.workflow_instance_id = $1 AND wni.node_id = $2
    `;
    const { rows } = await pool.query(query, [workflowInstanceId, nodeId]);
    return rows[0];
  }

  static async updateStatus(
    id,
    status,
    data = null,
    result = null,
    errorMessage = null
  ) {
    let query =
      "UPDATE workflow_node_instances SET status = $1, updated_at = CURRENT_TIMESTAMP";
    let values = [status];
    let paramCount = 1;

    if (status === "in_progress" && !data) {
      query += `, started_at = CURRENT_TIMESTAMP`;
    }

    if (status === "completed" || status === "failed") {
      query += `, completed_at = CURRENT_TIMESTAMP`;
    }

    if (data) {
      paramCount++;
      query += `, data = $${paramCount}`;
      values.push(JSON.stringify(data));
    }

    if (result) {
      paramCount++;
      query += `, result = $${paramCount}`;
      values.push(JSON.stringify(result));
    }

    if (errorMessage) {
      paramCount++;
      query += `, error_message = $${paramCount}`;
      values.push(errorMessage);
    }

    paramCount++;
    query += ` WHERE id = $${paramCount} RETURNING *`;
    values.push(id);
    console.log("---query 66---", query, values);
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async getPendingNodes(workflowInstanceId) {
    const query = `
      SELECT wni.*, wn.type as node_type, wn.config as node_config
      FROM workflow_node_instances wni
      JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wni.workflow_instance_id = $1 
      AND wni.status IN ('pending', 'waiting_user_input')
      ORDER BY wni.created_at
    `;
    const { rows } = await pool.query(query, [workflowInstanceId]);
    return rows;
  }

  static async getCompletedNodes(workflowInstanceId) {
    const query = `
      SELECT wni.*, wn.type as node_type, wn.config as node_config
      FROM workflow_node_instances wni
      JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wni.workflow_instance_id = $1 
      AND wni.status = 'completed'
      ORDER BY wni.completed_at
    `;
    const { rows } = await pool.query(query, [workflowInstanceId]);
    return rows;
  }

  static async getWaitingUserInputNodes(workflowInstanceId) {
    const query = `
      SELECT wni.*, wn.type as node_type, wn.config as node_config
      FROM workflow_node_instances wni
      JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wni.workflow_instance_id = $1 
      AND wni.status = 'waiting_user_input'
      ORDER BY wni.created_at
    `;
    const { rows } = await pool.query(query, [workflowInstanceId]);
    return rows;
  }

  // New method to get nodes by type
  static async getNodesByType(workflowInstanceId, nodeType) {
    const query = `
      SELECT wni.*, wn.type as node_type, wn.config as node_config
      FROM workflow_node_instances wni
      JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wni.workflow_instance_id = $1 
      AND wni.node_type = $2
      ORDER BY wni.created_at
    `;
    const { rows } = await pool.query(query, [workflowInstanceId, nodeType]);
    return rows;
  }

  // New method to get nodes by type and status
  static async getNodesByTypeAndStatus(workflowInstanceId, nodeType, status) {
    const query = `
      SELECT wni.*, wn.type as node_type, wn.config as node_config
      FROM workflow_node_instances wni
      JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wni.workflow_instance_id = $1 
      AND wni.node_type = $2
      AND wni.status = $3
      ORDER BY wni.created_at
    `;
    const { rows } = await pool.query(query, [
      workflowInstanceId,
      nodeType,
      status,
    ]);
    return rows;
  }

  static async logExecution(
    workflowInstanceId,
    workflowNodeInstanceId,
    level,
    message,
    data = {}
  ) {
    const query = `
      INSERT INTO workflow_execution_logs (workflow_instance_id, workflow_node_instance_id, level, message, data)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      workflowInstanceId,
      workflowNodeInstanceId,
      level,
      message,
      JSON.stringify(data),
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async getPrevNodeInstance(workflowInstanceId, currentNodeInstanceId) {
    const query = `
      SELECT wni.*, wn.type as node_type, wn.config as node_config
      FROM workflow_node_instances wni
      JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wni.workflow_instance_id = $1 
      AND wni.id < $2
      AND wni.status = 'completed'
      ORDER BY wni.completed_at DESC
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [
      workflowInstanceId,
      currentNodeInstanceId,
    ]);
    return rows[0] || null;
  }

  static async findByInstanceAndLogicalId(workflowInstanceId, logicalId) {
    const query = `
      SELECT wni.*, wn.type as node_type, wn.config as node_config
      FROM workflow_node_instances wni
      JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wni.workflow_instance_id = $1 
      AND wn.config::jsonb ->> 'logicalId' = $2
    `;
    const { rows } = await pool.query(query, [workflowInstanceId, logicalId]);
    return rows[0];
  }
}

module.exports = WorkflowNodeInstance;
