const pool = require("../config/database");
const WorkflowInstance = require("../models/WorkflowInstance");
const WorkflowNodeInstance = require("../models/WorkflowNodeInstance");
const { processAI, test_prompt } = require("../utils/llmservice");
const PdfNodeExecutor = require("../utils/nodeExecutors/PdfNodeExecutor");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../utils/email");

// Helper: Run a transaction
const runTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// Add a new workflow
const addWorkflow = async (req, res) => {
  const { workflow, nodes, connections, variables, settings } = req.body;
  console.log("Server: Adding workflow with company_id:", workflow.company_id);
  try {
    const result = await runTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO workflow_workflows (name, description, version, company_id, input_field, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
        [
          workflow.name,
          workflow.description,
          workflow.version || "1.0.0",
          workflow.company_id,
          workflow.input_field || null,
          workflow.is_active !== undefined ? workflow.is_active : false,
        ]
      );
      const workflowId = rows[0].id;

      // Insert nodes and track ID mappings
      const nodeIdMapping = {};
      for (const node of nodes) {
        const { rows } = await client.query(
          `INSERT INTO workflow_nodes (workflow_id, node_id, type, name, position_x, position_y, config)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, node_id`,
          [
            workflowId,
            node.id,
            node.type,
            node.name,
            node.position.x,
            node.position.y,
            JSON.stringify(node.config),
          ]
        );
        // Map frontend node ID to database node ID
        nodeIdMapping[node.id] = rows[0].id;
      }

      // Insert connections using mapped node IDs
      for (const conn of connections) {
        await client.query(
          `INSERT INTO workflow_connections (workflow_id, connection_id, from_node_id, to_node_id, from_port, to_port)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            workflowId,
            conn.id,
            conn.from_node,
            conn.to_node,
            conn.from_port,
            conn.to_port,
          ]
        );
      }
      /*
      // Insert variables
      await client.query(
        `INSERT INTO workflow_variables (workflow_id, variable_type, variables)
         VALUES ($1, 'global', $2), ($1, 'flow', $3)`,
        [workflowId, JSON.stringify(variables.global), JSON.stringify(variables.flow)]
      );

      // Insert settings
      await client.query(
        `INSERT INTO workflow_settings (workflow_id, enabled, max_executions, timeout_duration, timeout_unit, error_strategy, max_retries, notification_on_error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          workflowId,
          settings.enabled,
          settings.max_executions,
          settings.timeout.duration,
          settings.timeout.unit,
          settings.error_handling.strategy,
          settings.error_handling.max_retries,
          settings.error_handling.notification
        ]
      );
*/
      return workflowId;
    });
    res.json({ success: true, workflowId: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get a workflow by ID
const getWorkflow = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    const workflowRes = await client.query(
      `SELECT * FROM workflow_workflows WHERE id=$1`,
      [id]
    );
    if (workflowRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Workflow not found" });
    }
    const workflow = workflowRes.rows[0];

    const nodesRes = await client.query(
      `SELECT * FROM workflow_nodes WHERE workflow_id=$1`,
      [id]
    );
    const connectionsRes = await client.query(
      `SELECT * FROM workflow_connections WHERE workflow_id=$1`,
      [id]
    );
    const variablesRes = await client.query(
      `SELECT * FROM workflow_variables WHERE workflow_id=$1`,
      [id]
    );
    const settingsRes = await client.query(
      `SELECT * FROM workflow_settings WHERE workflow_id=$1`,
      [id]
    );

    client.release();

    res.json({
      workflow,
      nodes: nodesRes.rows,
      connections: connectionsRes.rows,
      variables: variablesRes.rows,
      settings: settingsRes.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all workflows for a company
const getCompanyWorkflows = async (req, res) => {
  const { company } = req.query;
  console.log("Server: Getting workflows for company_id:", company);
  try {
    // Get all workflows for the company
    const workflowsRes = await pool.query(
      `SELECT * FROM workflow_workflows WHERE company_id = $1 ORDER BY created_at DESC`,
      [company]
    );

    const workflows = workflowsRes.rows;

    // For each workflow, get its nodes and connections
    for (let workflow of workflows) {
      const nodesRes = await pool.query(
        `SELECT * FROM workflow_nodes WHERE workflow_id = $1`,
        [workflow.id]
      );
      const connectionsRes = await pool.query(
        `SELECT * FROM workflow_connections WHERE workflow_id = $1`,
        [workflow.id]
      );

      workflow.nodes = nodesRes.rows;
      workflow.connections = connectionsRes.rows;
    }

    res.json({
      success: true,
      workflows: workflows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getCompanyWorkflow = async (req, res) => {
  const { id } = req.params;
  try {
    const workflowRes = await pool.query(
      `SELECT * FROM workflow_workflows WHERE company_id=$1`,
      [id]
    );
    if (workflowRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Workflow not found" });
    }
    const workflow = workflowRes.rows[0];

    res.json({
      workflow,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update a workflow with complete data
const updateWorkflow = async (req, res) => {
  const { id } = req.params;
  const { workflow, nodes, connections } = req.body;
  console.log("Server: Updating workflow with ID:", id);

  try {
    const result = await runTransaction(async (client) => {
      // Update workflow basic info
      const workflowResult = await client.query(
        `UPDATE workflow_workflows SET name=$1, description=$2, version=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
        [workflow.name, workflow.description, workflow.version, id]
      );

      if (workflowResult.rowCount === 0) {
        throw new Error("Workflow not found");
      }

      // Delete existing nodes and connections
      await client.query(
        `DELETE FROM workflow_connections WHERE workflow_id=$1`,
        [id]
      );
      await client.query(`DELETE FROM workflow_nodes WHERE workflow_id=$1`, [
        id,
      ]);

      for (const node of nodes) {
        const { rows } = await client.query(
          `INSERT INTO workflow_nodes (workflow_id, node_id, type, name, position_x, position_y, config)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, node_id`,
          [
            id,
            node.id,
            node.type,
            node.name,
            node.position.x,
            node.position.y,
            JSON.stringify(node.config),
          ]
        );
      }

      // Insert updated connections using mapped node IDs
      for (const conn of connections) {
        await client.query(
          `INSERT INTO workflow_connections (workflow_id, connection_id, from_node_id, to_node_id, from_port, to_port)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            conn.id,
            conn.from_node,
            conn.to_node,
            conn.from_port,
            conn.to_port,
          ]
        );
      }

      return workflowResult.rows[0];
    });

    res.json({ success: true, workflow: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete a workflow and associated data
const deleteWorkflow = async (req, res) => {
  const { id } = req.params;
  try {
    await runTransaction(async (client) => {
      await client.query(`DELETE FROM workflow_settings WHERE workflow_id=$1`, [
        id,
      ]);
      await client.query(
        `DELETE FROM workflow_variables WHERE workflow_id=$1`,
        [id]
      );
      await client.query(
        `DELETE FROM workflow_connections WHERE workflow_id=$1`,
        [id]
      );
      await client.query(`DELETE FROM workflow_nodes WHERE workflow_id=$1`, [
        id,
      ]);
      await client.query(`DELETE FROM workflow_workflows WHERE id=$1`, [id]);
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Placeholder for execution engine
// const executeWorkflow = async (req, res) => {
//   const { workflowName } = req.body; // passed from client (POST body)
//   const data = req.body.data || {};   // optional initial input data
//   const userId = req.user?.id || null;

//   if (!workflowName) {
//     return res.status(400).json({
//       success: false,
//       error: 'Workflow name is required',
//     });
//   }

//   try {
//     const io = req.app.get('io'); // Socket.io instance if set via app.set('io', io)
//     const executor = new WorkflowExecutor(io);

//     const result = await executor.executeWorkflow(workflowName, data, userId);

//     return res.json({
//       success: true,
//       message: result.message,
//       instanceId: result.instanceId,
//     });
//   } catch (err) {
//     console.error('executeWorkflow error:', err);
//     return res.status(500).json({
//       success: false,
//       error: err.message || 'Internal server error',
//     });
//   }
// };

const executeWorkflow = async (req, res) => {
  try {
    const { workflowName, data = {} } = req.body;
    const userId = req.user?.id || null;

    if (!workflowName) {
      return res.status(400).json({
        success: false,
        error: "Missing workflowName",
      });
    }

    // Get socket instance
    const io = req.app.get("io");
    const executor = new WorkflowExecutor(io);

    // Execute the workflow
    const result = await executor.executeWorkflow(workflowName, data, userId);

    return res.status(200).json({
      success: true,
      message: "Workflow started successfully",
      instanceId: result.instanceId,
    });
  } catch (err) {
    console.error("Error executing workflow:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Workflow execution failed",
    });
  }
};

const updateUrl = async (req, res) => {
  const { url } = req.body;
  const maxtokens = 2024;
  const result = await processAI(
    "return as json format {url: <correct url>}",
    url,
    maxtokens
  );
  const match = result.match(/\{[\s\S]*?\}/);
  const parsedResult = JSON.parse(match[0]);

  res.json({
    success: true,
    result: parsedResult.url,
  });
};

const webhook = async (req, res) => {
  try {
    const { workflowName, workflowInstanceId, formData, uuid, path } = req.body;

    console.log("😶😶😶, req.body", req.body);

    // Get socket.io instance from app
    const io = req.app.get("io");
    const WorkflowExecutor = require("../utils/workflowExecutor");
    const workflowExecutor = new WorkflowExecutor(io);

    // Case 1: New workflow execution (workflowName provided, no workflowInstanceId)
    if (workflowName && !workflowInstanceId) {
      // Include UUID and path in the workflow data
      const workflowData = {
        uuid: uuid,
        path: path,
        ...req.body.basic_data,
      };

      console.log("😶😶😶, workflowData", workflowData);

      const result = workflowExecutor.executeWorkflow(
        workflowName,
        workflowData,
        req.user?.id
      );

      return res.json({
        success: true,
        message: "Workflow execution started",
        instanceId: result.instanceId,
      });
    }

    // Case 2: Continue workflow execution (workflowInstanceId provided)
    if (workflowInstanceId) {
      let nodeData = {};

      // Handle form submission
      if (formData) {
        const FormNodeExecutor = require("../utils/nodeExecutors/FormNodeExecutor");
        const formExecutor = new FormNodeExecutor(io);
        console.log("---formData---", formData);

        // Get node instance - either from request body or find waiting node
        let nodeInstanceId = req.body.nodeInstanceId;
        let nodeInstance;

        if (nodeInstanceId) {
          // Use provided node instance ID
          const { rows: nodeInstances } = await pool.query(
            "SELECT * FROM workflow_node_instances WHERE id = $1 AND workflow_instance_id = $2",
            [nodeInstanceId, workflowInstanceId]
          );
          if (nodeInstances.length > 0) {
            nodeInstance = nodeInstances[0];
          }
        } else {
          // Find waiting node instance
          const { rows: nodeInstances } = await pool.query(
            "SELECT * FROM workflow_node_instances WHERE workflow_instance_id = $1 AND status = $2",
            [workflowInstanceId, "waiting_user_input"]
          );
          if (nodeInstances.length > 0) {
            nodeInstance = nodeInstances[0];
          }
        }

        if (nodeInstance) {
          // Handle form submission
          formExecutor.handleFormSubmission(
            workflowInstanceId,
            nodeInstance.id,
            formData,
            req.user
          );

          nodeData = formData;
        } else {
          return res.status(404).json({
            success: false,
            error: "No waiting node instance found for form submission",
          });
        }
      }

      // Handle approval decision
      // if (approvalDecision) {
      //   const ApprovalNodeExecutor = require('../utils/nodeExecutors/ApprovalNodeExecutor');
      //   const approvalExecutor = new ApprovalNodeExecutor(io);

      //   const { approvalId, decision, comments } = approvalDecision;

      //   // Get current node instance
      //   const { rows: nodeInstances } = await pool.query(
      //     'SELECT * FROM workflow_node_instances WHERE workflow_instance_id = $1 AND status = $2',
      //     [workflowInstanceId, 'waiting_user_input']
      //   );

      //   if (nodeInstances.length > 0) {
      //     const nodeInstance = nodeInstances[0];

      //     // Handle approval decision
      //     await approvalExecutor.handleApprovalDecision(
      //       workflowInstanceId,
      //       nodeInstance.id,
      //       approvalId,
      //       decision,
      //       comments,
      //       req.user?.id
      //     );

      //     nodeData = { decision, comments };
      //   }
      // }

      // Continue workflow execution
      // const result = await workflowExecutor.continueWorkflow(workflowInstanceId, nodeData);

      return res.json({
        success: true,
        message: "Workflow continued successfully",
        workflowInstanceId: workflowInstanceId,
      });
    }

    // Invalid request
    return res.status(400).json({
      success: false,
      error: "Either workflowName or workflowInstanceId must be provided",
    });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUserAllWorkflows = async (req, res) => {
  let {
    page = 1,
    limit = 5,
    status,
    userId,
    formField,
    fieldValue,
    fieldType,
    approver,
  } = req.query;

  status = status === "" ? "active" : status;
  console.log(
    "Server: Getting workflow instances - page:",
    page,
    "limit:",
    limit,
    "status:",
    status,
    "userId:",
    userId,
    "formField:",
    formField,
    "fieldValue:",
    fieldValue,
    "fieldType:",
    fieldType,
    "approver:",
    approver
  );

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const values = [];
  const conditions = [];

  // Add status condition (if not "completed")
  if (status && status.trim().length > 0 && status !== "completed") {
    values.push(status.trim());
    conditions.push(`wi.status = $${values.length}`);

    // ✅ If status is "active", add assigned_to = userId filter
    if (status === "active" && userId) {
      values.push(userId);
      conditions.push(`(wi.data->>'userId')::int = $${values.length}`);
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    let workflowsQuery, workflowsValues;
    let countQuery, countValues;

    if (status === "completed") {
      // ✅ Fetch from workflow_node_instances (pending approvals for current user)
      workflowsQuery = `
        SELECT DISTINCT wi.*
        FROM workflow_node_instances wa
        JOIN workflow_instances wi ON wa.workflow_instance_id = wi.id
        WHERE wa.status = 'waiting_user_input'
          AND wa.node_type = 'approvalNode'
          AND (wa.data->>'userId')::int = $1
        ORDER BY wi.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      workflowsValues = [userId, limit, offset];

      countQuery = `
        SELECT COUNT(DISTINCT wa.workflow_instance_id) as count
        FROM workflow_node_instances wa
        WHERE wa.status = 'waiting_user_input'
          AND wa.node_type = 'approvalNode'
          AND (wa.data->>'userId')::int = $1
      `;
      countValues = [userId];
    } else {
      // ✅ Build dynamic query with search parameters
      let baseQuery = `
        SELECT DISTINCT wi.*
        FROM workflow_instances wi
      `;

      let joinClause = "";
      let searchConditions = [...conditions];
      let searchValues = [...values];

      // Add search for form fields in workflow nodes and node instances
      if (formField) {
        joinClause += `
          JOIN workflow_node_instances wni ON wi.id = wni.workflow_instance_id
          JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
        `;

        // Search in workflow node config (form fields) for the specific field
        searchValues.push(formField);
        searchConditions.push(`
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(wn.config->'formFields') AS fields
            WHERE fields->>'name' = $${searchValues.length}
          )
        `);
      }

      if (fieldValue) {
        if (!joinClause.includes("workflow_node_instances")) {
          joinClause += `
            JOIN workflow_node_instances wni ON wi.id = wni.workflow_instance_id
            JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
          `;
        }

        // Search in node instance data for the field value
        searchValues.push(fieldValue);
        searchConditions.push(`
          wni.data::text ILIKE '%' || $${searchValues.length} || '%'
        `);
      }

      if (fieldType) {
        if (!joinClause.includes("workflow_node_instances")) {
          joinClause += `
            JOIN workflow_node_instances wni ON wi.id = wni.workflow_instance_id
            JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
          `;
        }

        // Search in workflow node config for the specific field type
        searchValues.push(fieldType);
        searchConditions.push(`
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(wn.config->'formFields') AS fields
            WHERE fields->>'type' = $${searchValues.length}
          )
        `);
      }

      // Add search for approver in workflow node instances
      if (approver) {
        if (!joinClause.includes("workflow_node_instances")) {
          joinClause += `
            JOIN workflow_node_instances wni ON wi.id = wni.workflow_instance_id
          `;
        }

        searchValues.push(approver);
        searchConditions.push(`
          (wni.data->>'approver')::text ILIKE $${searchValues.length}
        `);

        joinClause += `
        JOIN workflow_node_instances wni ON wi.id = wni.workflow_instance_id AND wni.node_type = 'approvalNode'
        JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      `;

        // Search in workflow node config (form fields) for the specific field

        // {"label": "Approval", "approvers": [{"id": 66, "bio": "John Doe"}]}
        // I mean that fields is array and we need to search for the email in the array
        searchValues.push(approver);
        searchConditions.push(`
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(wn.config->'approvers') AS fields
          WHERE fields->>'email' ILIKE $${searchValues.length}
        )
      `);
      }

      // Build final query
      workflowsQuery = `
        ${baseQuery}
        ${joinClause}
        ${
          searchConditions.length > 0
            ? "WHERE " + searchConditions.join(" AND ")
            : ""
        }
        ORDER BY wi.created_at DESC
        LIMIT $${searchValues.length + 1} OFFSET $${searchValues.length + 2}
      `;
      workflowsValues = [...searchValues, limit, offset];

      // Build count query
      countQuery = `
        SELECT COUNT(DISTINCT wi.id)
        FROM workflow_instances wi
        ${joinClause}
        ${
          searchConditions.length > 0
            ? "WHERE " + searchConditions.join(" AND ")
            : ""
        }
      `;
      countValues = searchValues;
    }

    console.log("workflowsQuery", workflowsQuery);
    console.log("workflowsValues", workflowsValues);

    // Execute both queries in parallel
    const [countRes, workflowsRes] = await Promise.all([
      pool.query(countQuery, countValues),
      pool.query(workflowsQuery, workflowsValues),
    ]);

    const totalWorkflows = parseInt(countRes.rows[0].count);
    const workflows = workflowsRes.rows;

    // Fetch related data for each workflow
    for (let workflow of workflows) {
      const [nodesRes, connectionsRes, currentStepRes] = await Promise.all([
        pool.query(`SELECT * FROM workflow_nodes WHERE workflow_id = $1`, [
          workflow.workflow_id,
        ]),
        pool.query(
          `SELECT * FROM workflow_connections WHERE workflow_id = $1`,
          [workflow.workflow_id]
        ),
        pool.query(
          `
          SELECT
            wni.id as node_instance_id,
            wni.node_id,
            wni.status as node_status,
            wni.node_type,
            wn.name as node_name,
            wn.config as node_config
          FROM workflow_node_instances wni
          LEFT JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
          WHERE wni.workflow_instance_id = $1
            AND wni.status = 'waiting_user_input'
          ORDER BY wni.created_at DESC
          LIMIT 1
        `,
          [workflow.id]
        ),
      ]);

      workflow.nodes = nodesRes.rows;
      workflow.connections = connectionsRes.rows;
      workflow.currentStep = currentStepRes.rows[0] || null;
    }

    // ✅ Count ALL pending approvals for current user (regardless of filters)
    const [totalCountRes, pendingApprovalsRes] = await Promise.all([
      pool.query(
        `
        SELECT COUNT(*)
        FROM workflow_instances
        WHERE status = 'active' AND (data->>'userId')::int = $1
        `,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT wni.workflow_instance_id) AS count
        FROM workflow_node_instances wni
        WHERE wni.status = 'waiting_user_input'
          AND wni.node_type = 'approvalNode'
          AND (wni.data->>'userId')::int = $1`,
        [userId]
      ),
    ]);

    const TotalWorkflowCount = parseInt(totalCountRes.rows[0].count);
    const ApprovedWorkflowsCount = parseInt(pendingApprovalsRes.rows[0].count); // Actually pending count

    // Send final response
    res.json({
      success: true,
      workflows,
      pagination: {
        total: totalWorkflows,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalWorkflows / limit),
      },
      TotalWorkflowCount,
      ApprovedWorkflowsCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all workflow instances
const getWorkflowInstances = async (req, res) => {
  try {
    const WorkflowInstance = require("../models/WorkflowInstance");
    const instances = await WorkflowInstance.getActiveInstances();

    res.json({
      success: true,
      instances,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all workflow instances for a company
const getCompanyWorkflowInstances = async (req, res) => {
  try {
    const { company } = req.query;
    if (!company) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required",
      });
    }

    const WorkflowInstance = require("../models/WorkflowInstance");
    const instances = await WorkflowInstance.getInstancesByCompany(company);

    res.json({
      success: true,
      instances,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get workflow instance counts for a company
const getWorkflowInstanceCounts = async (req, res) => {
  try {
    const { company } = req.query;
    if (!company) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required",
      });
    }

    const WorkflowInstance = require("../models/WorkflowInstance");
    const counts = await WorkflowInstance.getInstanceCountsByCompany(company);

    res.json({
      success: true,
      counts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete a workflow instance
const deleteWorkflowInstance = async (req, res) => {
  try {
    const { id } = req.params;

    const WorkflowInstance = require("../models/WorkflowInstance");
    const deletedInstance = await WorkflowInstance.deleteInstance(id);

    if (!deletedInstance) {
      return res.status(404).json({
        success: false,
        error: "Workflow instance not found",
      });
    }

    res.json({
      success: true,
      message: "Workflow instance deleted successfully",
      deletedInstance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get specific workflow instance
const getWorkflowInstance = async (req, res) => {
  try {
    const { id } = req.params;

    // Get workflow instance details
    const { rows: workflowInstances } = await pool.query(
      `SELECT
        wi.*,
        ww.name as workflow_name
      FROM workflow_instances wi
      JOIN workflow_workflows ww ON wi.workflow_id = ww.id
      WHERE wi.id = $1`,
      [id]
    );

    if (workflowInstances.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Workflow instance not found" });
    }

    const workflowInstance = workflowInstances[0];

    // Get workflow history (node instances)
    const { rows: workflowHistory } = await pool.query(
      `SELECT
        id,
        node_id,
        status,
        started_at,
        completed_at,
        result,
        error_message,
        node_type,
        data
      FROM workflow_node_instances
      WHERE workflow_instance_id = $1
      ORDER BY completed_at ASC`,
      [id]
    );

    // Format history for frontend
    const formattedHistory = workflowHistory.map((instance, index) => {
      let title = instance.node_type
        ? instance.node_type.charAt(0).toUpperCase() +
          instance.node_type.slice(1)
        : `Step ${index + 1}`;

      let description =
        instance.error_message ||
        `${instance.node_type || "Workflow"} step executed`;

      return {
        id: instance.id,
        title,
        description,
        status: instance.status,
        timestamp: instance.completed_at || instance.started_at,
        result: instance.result,
        error_message: instance.error_message,
        data: instance.data,
        node_type: instance.node_type,
        node_id: instance.node_id,
      };
    });

    res.json({
      success: true,
      workflowInstance: {
        id: workflowInstance.id,
        workflow_name: workflowInstance.workflow_name,
        status: workflowInstance.status,
        created_at: workflowInstance.created_at,
        started_at: workflowInstance.started_at,
        completed_at: workflowInstance.completed_at,
        assigned_to: workflowInstance.assigned_to,
        data: workflowInstance.data,
      },
      history: formattedHistory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get workflow status
const getWorkflowStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const io = req.app.get("io");
    const WorkflowExecutor = require("../utils/workflowExecutor");
    const workflowExecutor = new WorkflowExecutor(io);

    const status = await workflowExecutor.getWorkflowStatus(id);

    res.json({
      success: true,
      status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Submit form data
const submitForm = async (req, res) => {
  try {
    const { id } = req.params;
    const { formData } = req.body;
    const user = req.user;
    const io = req.app.get("io");
    const FormNodeExecutor = require("../utils/nodeExecutors/FormNodeExecutor");
    const formExecutor = new FormNodeExecutor(io);
    console.log("---formData is called---");

    // Get current node instance - now using node_type for better querying
    const { rows: nodeInstances } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE workflow_instance_id = $1 AND status = $2 AND node_type = $3",
      [id, "waiting_user_input", "form"]
    );

    if (nodeInstances.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No waiting form found" });
    }

    const nodeInstance = nodeInstances[0];

    // Handle form submission
    const result = await formExecutor.handleFormSubmission(
      id,
      nodeInstance.id,
      formData,
      user
    );

    if (result.status === "failed") {
      return res.status(500).json({
        success: false,
        error: result.error || "Form submission failed",
      });
    }

    // Continue workflow with form data
    const WorkflowExecutor = require("../utils/workflowExecutor");
    const workflowExecutor = new WorkflowExecutor(io);

    // Pass form data to continue workflow
    const workflowResult = await workflowExecutor.continueWorkflow(id, {
      formData: formData,
      submittedBy: req.user?.id,
      submissionTimestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Form submitted successfully",
      workflowInstanceId: id,
      result: {
        formSubmission: result,
        workflowContinuation: workflowResult,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Submit approval decision
const submitApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;
    console.log(id);
    const io = req.app.get("io");
    const ApprovalNodeExecutor = require("../utils/nodeExecutors/ApprovalNodeExecutor");
    const approvalExecutor = new ApprovalNodeExecutor(io);

    // Get current node instance - now using node_type for better querying
    const { rows: nodeInstances } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1 AND status = $2",
      [id, "waiting_user_input"]
    );

    if (nodeInstances.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No waiting approval found" });
    }

    const nodeInstance = nodeInstances[0];

    // Get Approval

    const { rows: approvals } = await pool.query(
      `SELECT * FROM workflow_approvals WHERE workflow_node_instance_id = $1`,
      [nodeInstance.id]
    );
    if (approvals.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No waiting approval found" });
    }

    const approval = approvals[0];
    console.log(
      "--------asdffasdfdfasdf----",
      nodeInstance.workflow_instance_id
    );
    // Handle approval decision
    const result = await approvalExecutor.handleApprovalDecision(
      nodeInstance.workflow_instance_id,
      nodeInstance.id,
      approval.id,
      decision,
      comments,
      req.user?.id,
      req.user?.name
    );

    // // Continue workflow
    // const WorkflowExecutor = require("../utils/workflowExecutor");
    // const workflowExecutor = new WorkflowExecutor(io);
    // await workflowExecutor.continueWorkflow(nodeInstance.workflow_instance_id, { decision, comments });

    res.json({
      success: true,
      message: `Approval ${decision}`,
      result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Submit CRM approval decision
const submitCrmApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, comments, selectedCrmItems, assignedSellers } = req.body;
    console.log("CRM Approval submission:", {
      id,
      decision,
      comments,
      selectedCrmItems,
      assignedSellers,
    });

    const io = req.app.get("io");
    const CrmApprovalNodeExecutor = require("../utils/nodeExecutors/CrmApprovalNodeExecutor");
    const crmApprovalExecutor = new CrmApprovalNodeExecutor(io);

    // Get current node instance - now using node_type for better querying
    const { rows: nodeInstances } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1 AND status = $2",
      [id, "waiting_user_input"]
    );

    if (nodeInstances.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No waiting CRM approval found" });
    }

    const nodeInstance = nodeInstances[0];

    // Get Approval
    const { rows: approvals } = await pool.query(
      `SELECT * FROM workflow_approvals WHERE workflow_node_instance_id = $1`,
      [nodeInstance.id]
    );
    if (approvals.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No waiting CRM approval found" });
    }

    const approval = approvals[0];
    console.log(
      "CRM Approval processing for workflow:",
      nodeInstance.workflow_instance_id
    );

    // Handle CRM approval decision
    const result = await crmApprovalExecutor.handleApprovalDecision(
      nodeInstance.workflow_instance_id,
      nodeInstance.id,
      approval.id,
      decision,
      comments,
      req.user?.id,
      req.user?.name,
      selectedCrmItems || [],
      assignedSellers || {}
    );

    // Add CRM item selection status and assigned sellers to workflow_instance data field
    try {
      const { rows: workflowInstances } = await pool.query(
        "SELECT data FROM workflow_instances WHERE id = $1",
        [nodeInstance.workflow_instance_id]
      );

      if (workflowInstances.length > 0) {
        let currentData = workflowInstances[0].data || {};

        // Add CRM selection status to the data - selectedCrmItems is now an array like ['account', 'contact', 'opportunity']
        currentData.crmApprovalItems = selectedCrmItems || [];

        // Add assigned sellers data
        currentData.assignedSellers = assignedSellers || {};

        // Update the workflow instance data
        await pool.query(
          "UPDATE workflow_instances SET data = $1, updated_at = NOW() WHERE id = $2",
          [JSON.stringify(currentData), nodeInstance.workflow_instance_id]
        );

        console.log(
          "Updated workflow instance data with CRM approval items:",
          currentData.crmApprovalItems
        );
        console.log(
          "Updated workflow instance data with assigned sellers:",
          currentData.assignedSellers
        );
      }
    } catch (dataUpdateError) {
      console.warn(
        "Warning: Could not update workflow instance data:",
        dataUpdateError.message
      );
      // Don't fail the approval if data update fails
    }

    res.json({
      success: true,
      message: `CRM Approval ${decision}`,
      result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Direct approval via email link
const directApproval = async (req, res) => {
  try {
    const { id, email } = req.params;
    const { decision = "approved", comments = "Approved via email link" } =
      req.query;

    console.log(
      `Direct approval request for workflow ${id} by email ${email} with decision: ${decision}`
    );

    const io = req.app.get("io");
    const ApprovalNodeExecutor = require("../utils/nodeExecutors/ApprovalNodeExecutor");
    const approvalExecutor = new ApprovalNodeExecutor(io);

    // Get current node instance waiting for approval
    const { rows: nodeInstances } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE workflow_instance_id = $1 AND status = $2 AND node_type = $3",
      [id, "waiting_user_input", "approval"]
    );

    if (nodeInstances.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No waiting approval found for this workflow",
      });
    }

    const nodeInstance = nodeInstances[0];

    // Check if there's a pending approval for this email
    const { rows: approvals } = await pool.query(
      "SELECT * FROM workflow_approvals WHERE workflow_instance_id = $1 AND workflow_node_instance_id = $2 AND status = $3",
      [id, nodeInstance.id, "pending"]
    );

    if (approvals.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No pending approval found" });
    }

    const approval = approvals[0];

    // Verify the email matches the approver (for external users, check if approver_id contains the email)
    const isEmailMatch =
      approval.approver_id === email ||
      (typeof approval.approver_id === "string" &&
        approval.approver_id.includes(email));

    if (!isEmailMatch) {
      return res.status(403).json({
        success: false,
        message: "Email does not match the approver for this approval",
      });
    }

    // Handle approval decision
    const result = await approvalExecutor.handleApprovalDecision(
      id,
      nodeInstance.id,
      approval.id,
      decision,
      comments,
      email // Use email as approver ID for external users
    );

    // Continue workflow
    const WorkflowExecutor = require("../utils/workflowExecutor");
    const workflowExecutor = new WorkflowExecutor(io);
    await workflowExecutor.continueWorkflow(id, { decision, comments });

    // Return a success page instead of JSON
    const successHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Approval Successful</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: center; padding: 50px 20px; }
          .container { max-width: 600px; margin: 0 auto; }
          .success-icon { font-size: 64px; color: #28a745; margin-bottom: 20px; }
          .message { background-color: #d4edda; color: #155724; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Approval Successful!</h1>
          <div class="message">
            <p><strong>Decision:</strong> ${
              decision.charAt(0).toUpperCase() + decision.slice(1)
            }</p>
            <p><strong>Comments:</strong> ${comments}</p>
          </div>
          <div class="info">
            <p>Your approval has been recorded and the workflow will continue automatically.</p>
            <p>You can close this window now.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    res.send(successHtml);
  } catch (err) {
    console.error("Direct approval error:", err);

    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Approval Error</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: center; padding: 50px 20px; }
          .container { max-width: 600px; margin: 0 auto; }
          .error-icon { font-size: 64px; color: #dc3545; margin-bottom: 20px; }
          .error-message { background-color: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1>Approval Error</h1>
          <div class="error-message">
            <p>An error occurred while processing your approval.</p>
            <p>Please contact your system administrator.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    res.status(500).send(errorHtml);
  }
};

// Direct approval via approval ID
const directApprovalById = async (req, res) => {
  try {
    const { approvalId } = req.params;

    console.log("Incoming approvalId:", approvalId);

    let workflowInstance;
    let nodeInstanceId = null;

    // Step 1: Check if approvalId is a node instance ID
    const { rows: nodeCheck } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1",
      [approvalId]
    );

    if (nodeCheck.length) {
      console.log("Detected: Node Instance ID");
      nodeInstanceId = Number(approvalId);
      const { rows } = await pool.query(
        "SELECT wi.* FROM workflow_instances wi WHERE wi.id = $1",
        [nodeCheck[0].workflow_instance_id]
      );
      workflowInstance = rows[0];
    } else {
      // Step 2: Check if it's a workflow instance ID
      const { rows: workflowCheck } = await pool.query(
        "SELECT * FROM workflow_instances WHERE id = $1",
        [approvalId]
      );
      if (workflowCheck.length) {
        console.log("Detected: Workflow Instance ID");
        workflowInstance = workflowCheck[0];
        // If we want a default node instance, pick the first one
        const { rows: firstNode } = await pool.query(
          "SELECT id FROM workflow_node_instances WHERE workflow_instance_id = $1 ORDER BY id ASC LIMIT 1",
          [workflowInstance.id]
        );
        if (firstNode.length) {
          nodeInstanceId = firstNode[0].id;
        }
      }
    }

    if (!workflowInstance) {
      return res
        .status(404)
        .json({ success: false, message: "Workflow instance not found" });
    }

    console.log(
      "Final workflowInstance.id:",
      workflowInstance.id,
      "NodeInstanceId:",
      nodeInstanceId
    );

    // Step 3: Get the workflow definition
    const { rows: workflows } = await pool.query(
      "SELECT * FROM workflow_workflows WHERE id = $1",
      [workflowInstance.workflow_id]
    );

    if (workflows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Workflow not found" });
    }

    const workflow = workflows[0];

    // Step 4: Get the node instance
    let node_instance = null;
    if (nodeInstanceId) {
      const { rows } = await pool.query(
        `SELECT
          nodes.*
        FROM
          workflow_node_instances nodes
          LEFT JOIN workflow_node_instances noi ON (noi.id = $1 AND nodes.workflow_instance_id = noi.workflow_instance_id)
          LEFT JOIN workflow_connections con ON (con.workflow_id = $2 AND con.to_node_id = noi.node_id)
        WHERE nodes.node_id = con.from_node_id`,
        [nodeInstanceId, workflow.id]
      );
      if (rows.length) node_instance = rows[0];
    }

    // Step 5: Get the current node instance (approval step)
    let current_node_instance = null;
    if (nodeInstanceId) {
      const { rows } = await pool.query(
        `SELECT * FROM workflow_node_instances WHERE id = $1`,
        [nodeInstanceId]
      );
      if (rows.length) current_node_instance = rows[0];
    }

    // Step 6: Extract company info
    console.log("🤔🤔🤔 node_instance:", node_instance);
    let company_info = {};
    if (node_instance?.result?.agentResponse) {
      const jsonMatch =
        typeof node_instance.result.agentResponse == "string"
          ? node_instance.result.agentResponse.match(/```json\n([\s\S]*?)\n```/)
          : null;
      if (jsonMatch) {
        try {
          company_info = JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.error("Error parsing JSON from agent response:", e);
        }
      } else {
        company_info = node_instance.result.agentResponse;
      }
    }

    // Step 7: Get all workflow node instances
    const { rows: allNodeInstances } = await pool.query(
      `SELECT
        wni.id,
        wni.node_id,
        wni.status,
        wni.started_at,
        wni.completed_at,
        wni.data,
        wni.result,
        wni.error_message,
        wni.node_type,
        wn.name as node_name,
        wn.config as node_config
      FROM workflow_node_instances wni
      LEFT JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wni.workflow_instance_id = $1
      ORDER BY wni.completed_at ASC`,
      [workflowInstance.id]
    );

    // Step 8: Workflow history
    const { rows: workflowHistory } = await pool.query(
      `SELECT
        id,
        node_id,
        status,
        started_at,
        completed_at,
        result,
        error_message,
        node_type
      FROM workflow_node_instances
      WHERE workflow_instance_id = $1
      ORDER BY started_at ASC`,
      [workflowInstance.id]
    );

    const formattedHistory = workflowHistory
      .map((instance, index) => {
        let type = instance.node_type || "workflow_started";
        let title =
          instance.node_type?.charAt(0).toUpperCase() +
            instance.node_type?.slice(1) || "Workflow Started";
        let description =
          instance.error_message || "Workflow execution initiated";
        let status =
          instance.status === "completed"
            ? "completed"
            : instance.status === "failed"
            ? "failed"
            : "pending";

        if (instance.node_id && instance.node_id.includes("api")) {
          type = "api_call";
          title = `API Called: ${instance.node_id}`;
          description = "External API integration completed";
        } else if (instance.status === "waiting_user_input") {
          type = "approval_required";
          title = "Approval Required";
          description = "Manual approval needed for workflow continuation";
          status = "pending";
        }
        let approvalInfo = {};
        if (instance.node_type == "approvalNode") {
          approvalInfo = instance.result;
        }
        return {
          id: `event_${index + 1}`,
          node_id: instance.id,
          type,
          title,
          description,
          timestamp: instance.completed_at,
          status,
          approvalInfo,
          node_type: instance.node_type,
        };
      })
      .sort((a, b) => a.node_id - b.node_id);

    // Step 9: Form info
    let forminfo = {};
    if (nodeInstanceId) {
      const { rows: forminfos } = await pool.query(
        `SELECT nofo.*
        FROM workflow_node_instances nofo
        LEFT JOIN workflow_node_instances noap ON noap.workflow_instance_id = nofo.workflow_instance_id
        LEFT JOIN workflow_connections wc ON wc.from_node_id = nofo.node_id
        LEFT JOIN workflow_workflows ww ON ww.id = wc.workflow_id
        LEFT JOIN workflow_instances wi ON wi.id = noap.workflow_instance_id
        WHERE noap.id = $1 AND nofo.node_type= 'formNode'`,
        [nodeInstanceId]
      );
      if (forminfos.length) {
        forminfo = forminfos[0];
      }
    }
    console.log("🤔🤔🤔 company_infocompany_info:", company_info);

//     const workflowNodePrompt = `You are an expert data analyst. Analyze the given input data and create a comprehensive JSON structure with nodes and edges that represent the relationships between entities.

// Requirements:
// 1. Create nodes for all important entities found in the data (companies, people, technologies, locations, products, services, etc.)
// 2. Each node must have: id, type, name, and relevant properties from the data
// 3. Node types should be meaningful classifications (Company, Person, Technology, Location, Product, Service, Industry, etc.)
// 4. Create edges that connect related nodes with descriptive relationship labels
// 5. Ensure logical connections between related entities
// 6. Include all important data points as node properties
// 7. Use descriptive IDs that reflect the entity type and name
// 8. All data on input data must be represented in the nodes
// 9. If the input data is not present in the nodes, create a new node for it
// 10. If there are X items on input data, create X nodes for it
// 11. Please make sure to create nodes for all the data on input data

// Example structure:
// {
//   "nodes": [
//     {
//       "id": "{{Company ID}}",
//       "type": "Company",
//       "name": {{Company Name}}",
//       "industry": {{Company Industry}},
//       "location": {{Company Location}},
//       "size": {{Company Size}},
//       "annualRevenueUSD": {{Company Annual Revenue}},
//       "website": {{Company Website Link}}
//     },
//     {
//       "id": {{Person ID}},
//       "type": "Person",
//       "name": {{Person Name}},
//       "position": {{Person Position}}
//     }
//   ],
//   "edges": [
//     {
//       "from": {{Company ID}},
//       "to": {{Person ID}},
//       "relationship": {{Relationship}}
//     }
//   ]
// }

// Return only valid JSON without any markdown formatting, explanations, or additional text.`;
    // const max_tokens = 65000;
    // const resultWorkflowNode = await processAI(
    //   workflowNodePrompt,
    //   JSON.stringify(company_info),
    //   max_tokens
    // );
    // console.log("🤔🤔🤔 company_info:", company_info?.companyAnalysis);
    // console.log("😴😴😴 resultWorkflowNode:", resultWorkflowNode);

    // // Parse the AI response to extract JSON
    // let aiGeneratedNodes = null;
    // try {
    //   // Try to extract JSON from the response
    //   const jsonMatch =
    //     resultWorkflowNode.match(/```json\n([\s\S]*?)\n```/) ||
    //     resultWorkflowNode.match(/```\n([\s\S]*?)\n```/) ||
    //     resultWorkflowNode.match(/\{[\s\S]*\}/);

    //   if (jsonMatch) {
    //     const jsonString = jsonMatch[1] || jsonMatch[0];
    //     // aiGeneratedNodes = JSON.parse(jsonString);
    //   } else {
    //     // Try to parse the entire response as JSON
    //     // aiGeneratedNodes = JSON.parse(resultWorkflowNode);
    //   }
    // } catch (parseError) {
    //   console.error("Error parsing AI response JSON:", parseError);
    //   console.log("Raw AI response:", resultWorkflowNode);
    // }

    // Structure the response to match sample data format

    // Step 10: Response
    const result = {
      workflow: {
        id: workflowInstance.id,
        title: workflow.name,
        status: workflowInstance.status || "pending_approval",
        createdAt: workflowInstance.created_at,
        updatedAt: workflowInstance.updated_at || workflowInstance.created_at,
      },
      // company: {
      //   name:
      //     company_info?.companyAnalysis?.companyName ||
      //     company_info.name ||
      //     "Unknown",
      //   website: company_info?.companyAnalysis?.website || "Unknown",
      //   revenue: company_info?.companyAnalysis?.revenue || "Unknown",
      //   description: company_info?.companyAnalysis?.description || "Unknown",
      //   industry: company_info?.companyAnalysis?.industry || "Unknown",
      //   size: company_info?.companyAnalysis?.size || "Unknown",
      //   location: company_info?.companyAnalysis?.location || "Unknown",
      // },
      workflowHistory: formattedHistory,
      insights: company_info,
      node_instance: current_node_instance,
      // forminfo: forminfo?.data,
      nodeInstances: allNodeInstances,
      // Add AI-generated node JSON for the approval page
      // aiGeneratedNodes: aiGeneratedNodes,
    };

    res.json({
      success: true,
      workflow: result,
    });
  } catch (err) {
    console.error("Direct approval by ID error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateApprovalById = async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { comments, decision } = req.body;
    console.log("req.body", approvalId, comments, decision);
    res.json({
      success: true,
    });
  } catch (err) {
    console.error("Direct approval by ID error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get current step information for a workflow instance
const getCurrentStep = async (req, res) => {
  try {
    const { workflowInstanceId } = req.params;

    if (!workflowInstanceId) {
      return res.status(400).json({
        success: false,
        error: "workflowInstanceId is required",
      });
    }

    // Get current step information
    const { rows: currentStep } = await pool.query(
      `SELECT
        wni.id as node_instance_id,
        wni.node_id,
        wni.status as node_status,
        wni.node_type,
        wni.data as node_data,
        wni.result as node_result,
        wni.started_at,
        wni.completed_at,
        wn.name as node_name,
        wn.config as node_config
      FROM workflow_node_instances wni
      LEFT JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      WHERE wni.workflow_instance_id = $1
      AND wni.status = 'waiting_user_input'
      ORDER BY wni.created_at DESC
      LIMIT 1`,
      [workflowInstanceId]
    );

    if (currentStep.length === 0) {
      return res.json({
        success: true,
        currentStep: null,
        message:
          "No current step found - workflow may be completed or not started",
      });
    }

    res.json({
      success: true,
      currentStep: currentStep[0],
    });
  } catch (err) {
    console.error("Get current step error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
// Get form configuration for workflow form page
const getFormConfig = async (req, res) => {
  try {
    const { workflowInstanceId, nodeInstanceId, nodeId } = req.query;

    if (!workflowInstanceId || !nodeInstanceId) {
      return res.status(400).json({
        success: false,
        error: "workflowInstanceId and nodeInstanceId are required",
      });
    }

    // Get the node instance
    const { rows: nodeInstances } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1 AND workflow_instance_id = $2",
      [nodeInstanceId, workflowInstanceId]
    );

    if (nodeInstances.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Node instance not found",
      });
    }

    const nodeInstance = nodeInstances[0];

    // Get the workflow node configuration
    const { rows: nodes } = await pool.query(
      "SELECT * FROM workflow_nodes WHERE id = $1",
      [nodeInstance.workflow_node_id]
    );

    if (nodes.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Workflow node not found",
      });
    }

    const node = nodes[0];
    const nodeConfig =
      typeof node.config === "string" ? JSON.parse(node.config) : node.config;

    // Build form configuration
    const formConfig = {
      title: nodeConfig.label || "Form Required",
      description: nodeConfig.description || "",
      fields: nodeConfig.formFields || [],
    };

    res.json({
      success: true,
      formConfig,
    });
  } catch (err) {
    console.error("Get form config error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Helper function to generate visualization from form data
const generateVisualizationFromFormData = async (formData) => {
  const { processAI } = require("../utils/llmservice");
  
  const systemPrompt = `You are a CRM data visualization expert. Your task is to analyze form data and generate a graph visualization structure similar to the provided example.

Example structure:
{
  "graph_data": {
    "visualization": {
      "nodes": [
        {
          "id": "person_1",
          "role": "CEO",
          "color": "#a855f7",
          "email": "matt.francis@getherd.ai",
          "group": "person",
          "label": "Matt Francis",
          "phone": "678-522-6650",
          "company_name": "getherd",
          "participant_id": "66"
        },
        {
          "id": "company_1",
          "color": "#3b82f6",
          "group": "company",
          "label": "getherd"
        },
        {
          "id": "opportunity_1",
          "color": "#22c55e",
          "group": "opportunity",
          "label": "23 Open Opportunities",
          "description": "Total value: $10,375,995.72"
        }
      ],
      "edges": []
    }
  }
}

Rules:
1. Extract person, company, and opportunity information from the formData
2. Create nodes with appropriate IDs (person_X, company_X, opportunity_X)
3. Use consistent colors: purple (#a855f7) for persons, blue (#3b82f6) for companies, green (#22c55e) for opportunities
4. Include relevant fields like email, phone, role for persons
5. Include company_name for persons
6. Include description for opportunities
7. Always return valid JSON format`;

  const userPrompt = `Please analyze this form data and generate a graph visualization structure:

${JSON.stringify(formData, null, 2)}

Return only the JSON structure without any additional text or markdown formatting.`;

  const aiResponse = await processAI(systemPrompt, userPrompt, 2000);
  
  // Parse the AI response
  let generatedData;
  try {
    // Clean the response in case it has markdown formatting
    const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    generatedData = JSON.parse(cleanResponse);
  } catch (parseError) {
    console.error("Error parsing AI response:", parseError);
    console.log("Raw AI response:", aiResponse);
    
    // Fallback: create a basic structure
    generatedData = {
      graph_data: {
        visualization: {
          nodes: [
            {
              id: "form_data_1",
              color: "#3b82f6",
              group: "data",
              label: "Form Data",
              description: "Generated from form submission"
            }
          ],
          edges: []
        }
      }
    };
  }

  return generatedData;
};

// Helper function to process CRM data and return appropriate response
const processCrmData = async (data, res, workflowNodeInstanceId = null, companyUsers = []) => {
  // Check if it's case 1 (has graph_data) or case 2 (has formData)
  console.log("🏢 Company users by domain:", companyUsers);

  if (data && data.graph_data) {
    // Case 1: Already has graph_data structure
    res.json({
      success: true,
      graph_data: data,
      company_users: companyUsers,
    });
  } else if (data && data.formData) {
    // Case 2: Has formData, need to generate visualization
    try {
      const generatedData = await generateVisualizationFromFormData(data.formData);
      
      if (workflowNodeInstanceId) {
        try {
          // Get the workflow_instance_id first
          const { rows: nodeRows } = await pool.query(
            "SELECT workflow_instance_id FROM workflow_node_instances WHERE id = $1",
            [workflowNodeInstanceId]
          );
          
          if (nodeRows.length > 0) {
            const workflowInstanceId = nodeRows[0].workflow_instance_id;
            await pool.query(
              "UPDATE workflow_instances SET data = $1 WHERE id = $2",
              [JSON.stringify(generatedData), workflowInstanceId]
            );
            console.log("✅ Updated workflow_instances via workflow_node_instance with generated visualization data");
          }
        } catch (dbError) {
          console.error("Error updating workflow_instances via workflow_node_instance:", dbError);
          // Continue with response even if DB update fails
        }
      }
      
      res.json({
        success: true,
        graph_data: generatedData,
        company_users: companyUsers,
      });
    } catch (aiError) {
      console.error("Error generating visualization with AI:", aiError);
      res.status(500).json({ 
        success: false, 
        error: "Failed to generate visualization from form data" 
      });
    }
  } else {
    // Unknown data structure
    res.json({
      success: true,
      graph_data: data,
      company_users: companyUsers,
    });
  }
};

const getCrmData = async (req, res) => {
  try {
    const { workflowInstanceId, workflow_node_instance_id } = req.query;

    if (workflowInstanceId) {
      const { rows } = await pool.query(
        "SELECT data FROM workflow_instances WHERE id = $1",
        [workflowInstanceId]
      );
      console.log("🤔🤔🤔 crmData:", rows[0].data);
    } else if (workflow_node_instance_id) {
      const { rows } = await pool.query(
        `SELECT wi.data, ww.company_id, c.domain FROM workflow_node_instances wni
        LEFT JOIN workflow_instances wi ON wni.workflow_instance_id = wi.id
        LEFT JOIN workflow_workflows ww ON wi.workflow_id = ww.id
        LEFT JOIN company c ON ww.company_id = c.id
        WHERE wni.id = $1`,
        [workflow_node_instance_id]
      );
      console.log("🤔🤔🤔 crmData:", rows[0]);
      
      // Get company users by email domain matching
      let companyUsers = [];
      if (rows[0].domain) {
        try {
          const usersQuery = `
            SELECT
              u.id AS user_id,
              u.name AS user_name,
              u.email AS user_email
            FROM
              users u
            WHERE
              u.email LIKE $1 AND u.status = 'enabled'
            ORDER BY
              u.id ASC
          `;
          const domainPattern = `%@${rows[0].domain}`;
          const usersResult = await pool.query(usersQuery, [domainPattern]);
          companyUsers = usersResult.rows;
          // console.log("🏢 Company users by domain:", companyUsers);
        } catch (usersError) {
          console.error("Error fetching company users by domain:", usersError);
        }
      }
  console.log("🏢 Company users by domain:", companyUsers);
      
      await processCrmData(rows[0].data, res, workflow_node_instance_id, companyUsers);
    }
  } catch (err) {
    console.error("Get crm data error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Toggle workflow active status
const toggleWorkflow = async (req, res) => {
  const { id } = req.params;
  console.log("Server: Toggling workflow with ID:", id);

  try {
    const result = await runTransaction(async (client) => {
      // First, get the current status of the workflow
      const { rows } = await client.query(
        `SELECT is_active FROM workflow_workflows WHERE id = $1`,
        [id]
      );

      if (rows.length === 0) {
        throw new Error("Workflow not found");
      }

      const currentStatus = rows[0].is_active;
      const newStatus = !currentStatus;

      // Update the workflow status
      const updateResult = await client.query(
        `UPDATE workflow_workflows SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [newStatus, id]
      );

      return updateResult.rows[0];
    });

    res.json({
      success: true,
      workflow: result,
      message: `Workflow ${
        result.is_active ? "activated" : "deactivated"
      } successfully`,
    });
  } catch (err) {
    console.error("Toggle workflow error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getWorkflowNodeInstance = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the workflow node instance
    const { rows: nodeInstanceRows } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1",
      [id]
    );

    if (nodeInstanceRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Workflow node instance not found",
      });
    }

    const nodeInstance = nodeInstanceRows[0];

    // Get the associated workflow node data
    const { rows: nodeRows } = await pool.query(
      `SELECT wn.*, ww.name as workflow_name, ww.description as workflow_description
       FROM workflow_nodes wn
       JOIN workflow_workflows ww ON wn.workflow_id = ww.id
       WHERE wn.id = $1`,
      [nodeInstance.workflow_node_id]
    );

    const nodeData = nodeRows.length > 0 ? nodeRows[0] : null;

    // Get the workflow instance data
    const { rows: instanceRows } = await pool.query(
      "SELECT * FROM workflow_instances WHERE id = $1",
      [nodeInstance.workflow_instance_id]
    );

    const workflowInstance = instanceRows.length > 0 ? instanceRows[0] : null;

    res.json({
      success: true,
      node_instance: nodeInstance,
      node_data: nodeData,
      workflow_instance: workflowInstance,
      workflow: {
        id: nodeData?.workflow_id,
        name: nodeData?.workflow_name,
        description: nodeData?.workflow_description,
      },
    });
  } catch (error) {
    console.error("Error fetching workflow node instance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const savePdfWithSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const { signature, pdfUrl } = req.body;

    // Get the node instance
    const { rows: nodeInstanceRows } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1",
      [id]
    );

    if (nodeInstanceRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Workflow node instance not found",
      });
    }

    const nodeInstance = nodeInstanceRows[0];

    // Here you would typically:
    // 1. Download the original PDF
    // 2. Add the signature to the PDF
    // 3. Upload the new PDF to S3
    // 4. Update the node instance with the new PDF URL

    // For now, we'll just update the node instance with the signature data
    const updatedResult = {
      ...nodeInstance.result,
      signature: signature,
      signedAt: new Date().toISOString(),
      signedBy: req.user?.name || req.user?.email || "Unknown",
    };

    await pool.query(
      "UPDATE workflow_node_instances SET result = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(updatedResult), id]
    );

    res.json({
      success: true,
      message: "PDF with signature saved successfully",
      result: updatedResult,
    });
  } catch (error) {
    console.error("Error saving PDF with signature:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const completePdfNode = async (req, res) => {
  try {
    const { magic_token } = req.body;

    if (!magic_token) {
      return res.status(400).json({
        success: false,
        error: "magic_token is required",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(magic_token, process.env.JWT_SECRET);
    } catch (e) {
      return res
        .status(401)
        .json({ success: false, error: "invalid or expired token" });
    }
    const id = decoded.nodeInstanceId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "PDF file is required",
      });
    }

    // Get the node instance
    const { rows: nodeInstanceRows } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1",
      [id]
    );

    if (nodeInstanceRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Workflow node instance not found",
      });
    }

    const nodeInstance = nodeInstanceRows[0];

    // Get the workflow instance
    const { rows: workflowInstanceRows } = await pool.query(
      "SELECT * FROM workflow_instances WHERE id = $1",
      [nodeInstance.workflow_instance_id]
    );

    if (workflowInstanceRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Workflow instance not found",
      });
    }

    const workflowInstance = workflowInstanceRows[0];

    // Get the workflow node
    const { rows: nodeRows } = await pool.query(
      "SELECT * FROM workflow_nodes WHERE id = $1",
      [nodeInstance.workflow_node_id]
    );

    if (nodeRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Workflow node not found",
      });
    }

    const node = nodeRows[0];

    // Configure AWS S3
    const AWS = require("aws-sdk");
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || "us-east-1",
    });

    // Upload PDF to S3
    const timestamp = Date.now();
    const fileName = `signed-pdf-${timestamp}.pdf`;

    const key = `pdf/${fileName}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.pdf`;

    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: "application/pdf",
    };

    const uploadResult = await s3.upload(uploadParams).promise();
    const signedPdfUrl = uploadResult.Location;

    // Complete the node with the results
    const finalResult = {
      ...nodeInstance.result,
      result: signedPdfUrl,
      completedAt: new Date().toISOString(),
      completedBy: req.user?.name || req.user?.email || "Unknown",
    };

    await pool.query(
      "UPDATE workflow_node_instances SET status = $1, result = $2, completed_at = $3, updated_at = NOW() WHERE id = $4",
      ["completed", JSON.stringify(finalResult), new Date(), id]
    );

    const io = req.app.get("io");
    const PdfNodeExecutor = require("../utils/nodeExecutors/PdfNodeExecutor");
    const pdfExecutor = new PdfNodeExecutor(io);

    try {
      await pdfExecutor.executeNextNode(
        node.node_id,
        workflowInstance,
        finalResult
      );
    } catch (chainError) {
      console.error("Error executing next node:", chainError);
    }

    res.json({
      success: true,
      message: "PDF node completed successfully",
      result: finalResult,
      signedPdfUrl: signedPdfUrl,
    });
  } catch (error) {
    console.error("Error completing PDF node:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Generate a public PDF magic link and email it to the recipient
const sendPdfMagicLink = async (req, res) => {
  try {
    const { email, nodeInstanceId, expiresInMinutes = 60 } = req.body || {};

    if (!email || !nodeInstanceId) {
      return res.status(400).json({
        success: false,
        message: "email and nodeInstanceId are required",
      });
    }

    // Verify node instance exists
    const { rows: nodeInstanceRows } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1",
      [nodeInstanceId]
    );

    if (nodeInstanceRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Workflow node instance not found" });
    }

    const expiresInSeconds = Math.max(60, Number(expiresInMinutes) * 60);

    const token = jwt.sign(
      {
        purpose: "pdf_magic_link",
        nodeInstanceId,
        email,
      },
      process.env.JWT_SECRET,
      { expiresIn: expiresInSeconds }
    );

    const link = `${process.env.CLIENT_URL.replace(
      /\/$/,
      ""
    )}/public/pdf?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: email,
      subject: "Action required: Review and sign PDF",
      html: `
        <p>Hello,</p>
        <p>You have a document to review and complete. Click the secure link below to proceed:</p>
        <p><a href="${link}">Open document</a></p>
        <p>This link will expire in ${Math.round(
          expiresInSeconds / 60
        )} minutes.</p>
      `,
    });

    res.json({ success: true, link, token });
  } catch (error) {
    console.error("Error sending PDF magic link:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Validate PDF magic-link token and return minimal info for the public page
const validatePdfMagicToken = async (req, res) => {
  try {
    const token =
      req.query.token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== "pdf_magic_link" || !decoded.nodeInstanceId) {
      return res.status(400).json({ success: false, message: "invalid token" });
    }

    // Fetch node instance and associated node to derive any public PDF URL needed by the UI
    const { rows: nodeInstanceRows } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1",
      [decoded.nodeInstanceId]
    );

    if (!nodeInstanceRows.length) {
      return res
        .status(404)
        .json({ success: false, message: "node instance not found" });
    }

    const nodeInstance = nodeInstanceRows[0];

    const { rows: nodeRows } = await pool.query(
      "SELECT wn.* FROM workflow_nodes wn WHERE wn.id = $1",
      [nodeInstance.workflow_node_id]
    );

    const node = nodeRows[0] || null;
    let pdfUrl = null;
    try {
      const config =
        node?.config &&
        (typeof node.config === "string"
          ? JSON.parse(node.config)
          : node.config);
      pdfUrl = config?.pdfUrl || null;
    } catch (_) {}

    res.json({
      success: true,
      nodeInstanceId: decoded.nodeInstanceId,
      email: decoded.email,
      pdfUrl,
    });
  } catch (error) {
    console.error("Error validating PDF magic token:", error);
    res.status(400).json({ success: false, error: error.message });
  }
};

// Public version of PDF completion using magic-link token
const completePdfNodePublic = async (req, res) => {
  try {
    const { id } = req.params; // nodeInstanceId
    const token =
      req.query.token || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ success: false, error: "token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res
        .status(401)
        .json({ success: false, error: "invalid or expired token" });
    }

    if (
      decoded.purpose !== "pdf_magic_link" ||
      String(decoded.nodeInstanceId) !== String(id)
    ) {
      return res
        .status(403)
        .json({ success: false, error: "token does not match this node" });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "PDF file is required" });
    }

    // Load node instance
    const { rows: nodeInstanceRows } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1",
      [id]
    );
    if (!nodeInstanceRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Workflow node instance not found" });
    }
    const nodeInstance = nodeInstanceRows[0];

    // Load workflow instance and node
    const { rows: workflowInstanceRows } = await pool.query(
      "SELECT * FROM workflow_instances WHERE id = $1",
      [nodeInstance.workflow_instance_id]
    );
    if (!workflowInstanceRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Workflow instance not found" });
    }
    const workflowInstance = workflowInstanceRows[0];

    const { rows: nodeRows } = await pool.query(
      "SELECT * FROM workflow_nodes WHERE id = $1",
      [nodeInstance.workflow_node_id]
    );
    if (!nodeRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Workflow node not found" });
    }
    const node = nodeRows[0];

    // Upload to S3
    const AWS = require("aws-sdk");
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || "us-east-1",
    });

    const key = `${Math.random().toString(36).slice(2)}.pdf`;
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: "application/pdf",
    };

    const uploadResult = await s3.upload(uploadParams).promise();
    const signedPdfUrl = uploadResult.Location;

    const finalResult = {
      ...nodeInstance.result,
      result: signedPdfUrl,
      completedAt: new Date().toISOString(),
      completedBy: decoded.email || "Public User",
    };

    await pool.query(
      "UPDATE workflow_node_instances SET status = $1, result = $2, completed_at = $3, updated_at = NOW() WHERE id = $4",
      ["completed", JSON.stringify(finalResult), new Date(), id]
    );

    const io = req.app.get("io");
    const PdfNodeExecutor = require("../utils/nodeExecutors/PdfNodeExecutor");
    const pdfExecutor = new PdfNodeExecutor(io);
    try {
      await pdfExecutor.executeNextNode(
        node.node_id,
        workflowInstance,
        finalResult
      );
    } catch (chainError) {
      console.error("Error executing next node:", chainError);
    }

    res.json({
      success: true,
      message: "PDF node completed successfully",
      result: finalResult,
      signedPdfUrl,
    });
  } catch (error) {
    console.error("Error completing PDF node (public):", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Return full node data for public PDF page using magic token
const getPdfNodeDataPublic = async (req, res) => {
  try {
    const token =
      req.query.magic_token ||
      req.query.token ||
      req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res
        .status(400)
        .json({ success: false, error: "magic_token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res
        .status(401)
        .json({ success: false, error: "invalid or expired token" });
    }

    if (decoded.purpose !== "pdf_magic_link" || !decoded.nodeInstanceId) {
      return res
        .status(400)
        .json({ success: false, error: "invalid token payload" });
    }

    const nodeInstanceId = decoded.nodeInstanceId;

    // Load node instance
    const { rows: nodeInstanceRows } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1",
      [nodeInstanceId]
    );
    if (!nodeInstanceRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "node instance not found" });
    }
    const nodeInstance = nodeInstanceRows[0];

    // Load the workflow instance
    const { rows: workflowInstanceRows } = await pool.query(
      "SELECT * FROM workflow_instances WHERE id = $1",
      [nodeInstance.workflow_instance_id]
    );
    const workflowInstance = workflowInstanceRows[0] || null;

    // Load the node
    const { rows: nodeRows } = await pool.query(
      "SELECT * FROM workflow_nodes WHERE id = $1",
      [nodeInstance.workflow_node_id]
    );
    if (!nodeRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "workflow node not found" });
    }
    const node = nodeRows[0];

    // Normalize node_data shape expected by the frontend
    let nodeConfig = null;
    try {
      nodeConfig =
        node?.config &&
        (typeof node.config === "string"
          ? JSON.parse(node.config)
          : node.config);
    } catch (_) {
      nodeConfig = node?.config || null;
    }

    // Optionally include a pdfUrl convenience value
    const pdfUrl = nodeConfig?.pdfUrl || null;

    const nodeData = {
      id: node.id,
      node_id: node.node_id,
      type: node.type,
      name: node.name,
      config: nodeConfig || {},
    };

    return res.json({
      success: true,
      token_email: decoded.email || null,
      node_instance: nodeInstance,
      workflow_instance: workflowInstance,
      node_data: nodeData,
      pdfUrl,
    });
  } catch (error) {
    console.error("Error fetching PDF node data (public):", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const savePdfSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const { signature, pdfUrl, magic_token } = req.body;

    if (!signature) {
      return res
        .status(400)
        .json({ success: false, error: "Signature is required" });
    }

    if (!magic_token) {
      return res
        .status(400)
        .json({ success: false, error: "magic_token is required" });
    }

    let decoded;

    try {
      decoded = jwt.verify(magic_token, process.env.JWT_SECRET);
    } catch (e) {
      return res
        .status(401)
        .json({ success: false, error: "invalid or expired token" });
    }

    // Load node instance
    const { rows: nodeInstanceRows } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1",
      [id]
    );
    if (!nodeInstanceRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Node instance not found" });
    }
    const nodeInstance = nodeInstanceRows[0];

    // Load the node
    const { rows: nodeRows } = await pool.query(
      "SELECT * FROM workflow_nodes WHERE id = $1",
      [nodeInstance.workflow_node_id]
    );
    if (!nodeRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Workflow node not found" });
    }
    const node = nodeRows[0];

    // Get PDF content from URL
    let pdfBuffer;
    if (pdfUrl) {
      try {
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
          throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
        }
        pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      } catch (error) {
        console.error("Error fetching PDF from URL:", error);
        return res
          .status(400)
          .json({ success: false, error: "Failed to fetch PDF from URL" });
      }
    } else {
      return res
        .status(400)
        .json({ success: false, error: "PDF URL is required" });
    }

    // Rebuild PDF with signature using PDF-lib
    const PDFLib = require("pdf-lib");
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    // Convert signature from base64 to PNG bytes
    const signatureBase64 = signature.replace(
      /^data:image\/[a-z]+;base64,/,
      ""
    );
    const signatureBuffer = Buffer.from(signatureBase64, "base64");
    const signatureImage = await pdfDoc.embedPng(signatureBuffer);

    // Add signature to the first page (you can modify this logic as needed)
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Position signature in bottom right corner
    const signatureWidth = 150;
    const signatureHeight = 75;
    const x = width - signatureWidth - 50;
    const y = 50;

    firstPage.drawImage(signatureImage, {
      x: x,
      y: y,
      width: signatureWidth,
      height: signatureHeight,
      opacity: 1,
    });

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    const modifiedPdfBuffer = Buffer.from(modifiedPdfBytes);

    // Configure AWS S3
    const AWS = require("aws-sdk");
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || "us-east-1",
    });

    // Upload modified PDF to S3
    const timestamp = Date.now();
    const fileName = `signed-pdf-${timestamp}.pdf`;
    const key = `pdf/${fileName}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.pdf`;

    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: modifiedPdfBuffer,
      ContentType: "application/pdf",
    };

    const uploadResult = await s3.upload(uploadParams).promise();
    const signedPdfUrl = uploadResult.Location;

    // Update node instance with the signed PDF URL
    const finalResult = {
      ...nodeInstance.result,
      result: signedPdfUrl,
      completedAt: new Date().toISOString(),
      completedBy: req.user?.name || req.user?.email || "Unknown",
      signature: signature,
    };

    await pool.query(
      "UPDATE workflow_node_instances SET status = $1, result = $2, completed_at = $3, updated_at = NOW() WHERE id = $4",
      ["completed", JSON.stringify(finalResult), new Date(), id]
    );

    // Execute next node

    const io = req.app.get("io");
    const PdfNodeExecutor = require("../utils/nodeExecutors/PdfNodeExecutor");
    const pdfExecutor = new PdfNodeExecutor(io);

    try {
      await pdfExecutor.executeNextNode(
        node.node_id,
        decoded.workflowInstanceId,
        finalResult
      );
    } catch (chainError) {
      console.error("Error executing next node:", chainError);
    }

    res.json({
      success: true,
      message: "PDF with signature saved successfully",
      signedPdfUrl: signedPdfUrl,
      result: finalResult,
    });
  } catch (error) {
    console.error("Error saving PDF signature:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get public form configuration using magic token (random ID)
const getPublicFormConfig = async (req, res) => {
  try {
    const magicToken = req.query.magic_token;

    if (!magicToken) {
      return res.status(400).json({
        success: false,
        error: "magic_token is required",
      });
    }

    // Search for the magic token in workflow_nodes table
    const { rows: nodes } = await pool.query(
      "SELECT * FROM workflow_nodes WHERE config::text LIKE $1",
      [`%"publicLinkId": "${magicToken}"%`]
    );
    console.log('magic_token', magicToken);

    if (nodes.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Public form link not found",
      });
    }

    const node = nodes[0];
    const nodeConfig = typeof node.config === "string" ? JSON.parse(node.config) : node.config;

    // Check if the node is marked as public
    if (!nodeConfig.publicData) {
      return res.status(403).json({
        success: false,
        error: "This form is not available for public access",
      });
    }

    // Get the workflow information
    const { rows: workflows } = await pool.query(
      "SELECT * FROM workflow_workflows WHERE id = $1",
      [node.workflow_id]
    );

    if (workflows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    const workflow = workflows[0];

    // Build form configuration
    const formConfig = {
      title: nodeConfig.label || "Public Form",
      description: nodeConfig.description || "",
      fields: nodeConfig.formFields || [],
    };

    return res.json({
      success: true,
      formConfig,
      nodeId: nodeConfig.logicalId || node.id,
      workflowId: workflow.id,
      magicToken: magicToken,
      isPublic: true,
    });
  } catch (err) {
    console.error("Get public form config error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Submit public form data using magic token
const submitPublicForm = async (req, res) => {
  try {
    const { magic_token, formData } = req.body;

    if (!magic_token) {
      return res.status(400).json({
        success: false,
        error: "magic_token is required",
      });
    }

    // Search for the magic token in workflow_nodes table
    const { rows: nodes } = await pool.query(
      "SELECT * FROM workflow_nodes WHERE config::text LIKE $1",
      [`%"publicLinkId": "${magic_token}"%`]
    );

    if (nodes.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Public form link not found",
      });
    }

    const node = nodes[0];
    const nodeConfig = typeof node.config === "string" ? JSON.parse(node.config) : node.config;

    // Check if the node is marked as public
    if (!nodeConfig.publicData) {
      return res.status(403).json({
        success: false,
        error: "This form is not available for public access",
      });
    }

    // Get the workflow information
    const { rows: workflows } = await pool.query(
      "SELECT * FROM workflow_workflows WHERE id = $1",
      [node.workflow_id]
    );

    if (workflows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    const workflow = workflows[0];

    // Create workflow instance
    const WorkflowInstance = require('../models/WorkflowInstance');
    const WorkflowNodeInstance = require('../models/WorkflowNodeInstance');
    
    const instanceName = `Public Form - ${workflow.name} - ${new Date().toISOString()}`;
    const workflowData = {
      magicToken: magic_token,
      formData: formData,
      submittedAt: new Date().toISOString(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      isPublicSubmission: true
    };

    const workflowInstance = await WorkflowInstance.create(
      workflow.id,
      instanceName,
      workflowData,
      null, // No assigned user for public submissions
      null  // No created by user for public submissions
    );

    // Set workflow instance status to active
    await WorkflowInstance.updateStatus(
      workflowInstance.id,
      'active',
      node.node_id,
      workflowData
    );

    // Create node instance for the form node
    const nodeInstance = await WorkflowNodeInstance.create(
      workflowInstance.id,
      node.id,
      node.node_id,
      null, // No assigned user for public submissions
      node.type
    );

    // Store form data in the node instance and mark as completed
    await WorkflowNodeInstance.updateStatus(
      nodeInstance.id,
      'completed',
      formData,
      { formData, submittedAt: new Date().toISOString() }
    );

    // Log the form submission
    await WorkflowNodeInstance.logExecution(
      workflowInstance.id,
      nodeInstance.id,
      'info',
      'Public form submitted',
      { formData, magicToken: magic_token }
    );

    // Get socket.io instance for workflow execution
    const io = req.app.get("io");
    const FormNodeExecutor = require("../utils/nodeExecutors/FormNodeExecutor");
    const formExecutor = new FormNodeExecutor(io);

    // Execute next node in the workflow
    try {
      await formExecutor.executeNextNode(node.node_id, workflowInstance, formData);
    } catch (nextNodeError) {
      console.error("Error executing next node:", nextNodeError);
      // Continue even if next node execution fails
    }

    return res.json({
      success: true,
      message: "Form submitted successfully",
      workflowInstanceId: workflowInstance.id,
      nodeInstanceId: nodeInstance.id,
      workflowId: workflow.id,
      nodeId: nodeConfig.logicalId || node.id,
      magicToken: magic_token,
    });
  } catch (err) {
    console.error("Submit public form error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Generate a public form magic link and email it to the recipient
const sendFormMagicLink = async (req, res) => {
  try {
    const { email, nodeInstanceId, expiresInMinutes = 60 } = req.body || {};

    if (!email || !nodeInstanceId) {
      return res.status(400).json({
        success: false,
        message: "email and nodeInstanceId are required",
      });
    }

    // Verify node instance exists
    const { rows: nodeInstanceRows } = await pool.query(
      "SELECT * FROM workflow_node_instances WHERE id = $1",
      [nodeInstanceId]
    );

    if (nodeInstanceRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Workflow node instance not found" });
    }

    const expiresInSeconds = Math.max(60, Number(expiresInMinutes) * 60);

    const token = jwt.sign(
      {
        purpose: "form_magic_link",
        nodeInstanceId,
        email,
      },
      process.env.JWT_SECRET,
      { expiresIn: expiresInSeconds }
    );

    const link = `${process.env.CLIENT_URL.replace(
      /\/$/,
      ""
    )}/public/form?magic_token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: email,
      subject: "Action required: Complete form",
      html: `
        <p>Hello,</p>
        <p>You have a form to complete. Click the secure link below to proceed:</p>
        <p><a href="${link}">Open form</a></p>
        <p>This link will expire in ${Math.round(
          expiresInSeconds / 60
        )} minutes.</p>
      `,
    });

    res.json({ success: true, link, token });
  } catch (error) {
    console.error("Error sending form magic link:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  addWorkflow,
  getWorkflow,
  getCompanyWorkflows,
  updateWorkflow,
  toggleWorkflow,
  deleteWorkflow,
  executeWorkflow,
  getCompanyWorkflow,
  webhook,
  getWorkflowInstances,
  getCompanyWorkflowInstances,
  getWorkflowInstanceCounts,
  deleteWorkflowInstance,
  getWorkflowInstance,
  getWorkflowStatus,
  submitForm,
  submitApproval,
  submitCrmApproval,
  directApproval,
  directApprovalById,
  getFormConfig,
  updateApprovalById,
  updateUrl,
  getUserAllWorkflows,
  getCurrentStep,
  getCrmData,
  getWorkflowNodeInstance,
  savePdfWithSignature,
  completePdfNode,
  // Public PDF magic-link endpoints
  sendPdfMagicLink,
  validatePdfMagicToken,
  completePdfNodePublic,
  getPdfNodeDataPublic,
  savePdfSignature,
  // Public form magic-link endpoints
  getPublicFormConfig,
  submitPublicForm,
  sendFormMagicLink,
};
