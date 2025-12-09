const pool = require('../config/database');
const WorkflowInstance = require('../models/WorkflowInstance');
const WorkflowNodeInstance = require('../models/WorkflowNodeInstance');
const FormNodeExecutor = require('./nodeExecutors/FormNodeExecutor');
const ApprovalNodeExecutor = require('./nodeExecutors/ApprovalNodeExecutor');
const AgentNodeExecutor = require('./nodeExecutors/AgentNodeExecutor');
const CoreSignalAgentExecutor = require('./nodeExecutors/CoreSignalAgentExecutor');
const ApiNodeExecutor = require('./nodeExecutors/ApiNodeExecutor');
const WebhookNodeExecutor = require('./nodeExecutors/WebhookNodeExecutor');
const NotificationNodeExecutor = require('./nodeExecutors/NotificationNodeExecutor');
const UpdateNodeExecutor = require('./nodeExecutors/UpdateNodeExecutor');
const TriggerNodeExecutor = require('./nodeExecutors/TriggerNodeExecutor');
const CrmUpdateNodeExecutor = require('./nodeExecutors/CrmUpdateNodeExecutor');
const PromptNodeExecutor = require('./nodeExecutors/PromptNodeExecutor');
const CrmApprovalNodeExecutor = require('./nodeExecutors/CrmApprovalNodeExecutor');
const PdfNodeExecutor = require('./nodeExecutors/PdfNodeExecutor');

class WorkflowExecutor {
  constructor(io) {
    this.io = io; // Socket.io instance for real-time communication
    this.nodeExecutors = {
      'formNode': new FormNodeExecutor(io),
      'approvalNode': new ApprovalNodeExecutor(io),
      'crmApprovalNode': new CrmApprovalNodeExecutor(io),
      'agentNode': new AgentNodeExecutor(io),
      'coresignalAgentNode': new CoreSignalAgentExecutor(io),
      'apiNode': new ApiNodeExecutor(io),
      'webhookNode': new WebhookNodeExecutor(io),
      'notificationNode': new NotificationNodeExecutor(io),
      'updateNode': new UpdateNodeExecutor(io),
      'crmUpdateNode': new CrmUpdateNodeExecutor(io),
      'triggerNode': new TriggerNodeExecutor(io),
      'promptNode': new PromptNodeExecutor(io),
      'pdfNode': new PdfNodeExecutor(io),
    };
  }

  async executeWorkflow(workflowName, data = {}, userId = null) {
    try {
      // Find workflow by name
      const { rows: workflows } = await pool.query(
        'SELECT * FROM workflow_workflows WHERE name = $1',
        [workflowName]
      );

      if (workflows.length === 0) {
        throw new Error(`Workflow "${workflowName}" not found`);
      }

      const workflow = workflows[0];

      // // Check if workflow is active
      // if (!workflow.is_active) {
      //   throw new Error(`Workflow "${workflowName}" is not active and cannot be executed`);
      // }

      // Create workflow instance
      const instance = await WorkflowInstance.create(
        workflow.id,
        `${workflowName}_${Date.now()}`,
        data,
        userId,
        userId
      );

      // Set initial workflow instance status to active
      await WorkflowInstance.updateStatus(
        instance.id,
        'active',
        null
      );

      // Get workflow nodes
      const { rows: nodes } = await pool.query(
        'SELECT * FROM workflow_nodes WHERE workflow_id = $1 ORDER BY position_x, position_y',
        [workflow.id]
      );

      if (nodes.length === 0) {
        throw new Error('No nodes found in workflow');
      }

      // Find start node
      const startNode = nodes.find(node => {
        const config = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
        return config.isStartNode;
      });
      if (!startNode) {
        throw new Error('No start node found in workflow');
      }

      // Create node instance for start node
      const nodeInstance = await WorkflowNodeInstance.create(
        instance.id,
        startNode.id,
        startNode.node_id,
        userId,
        startNode.type
      );
      // Log execution
      await WorkflowNodeInstance.logExecution(
        instance.id,
        nodeInstance.id,
        'info',
        `Workflow execution started`,
        { workflowName, startNode: startNode.node_id }
      );
      console.log("@@##!!@1123zxc------nodeInstance",nodeInstance);
      console.log("@@##!!@1123zxc------startNode",startNode);
      console.log("@@##!!@1123zxc------instance", instance);
      console.log("@@##!!@1123zxc------data",data);
      // Execute the start node
      await this.executeNode(nodeInstance, startNode, instance, data);

      return {
        success: true,
        instanceId: instance.id,
        message: 'Workflow execution started'
      };

    } catch (error) {
      console.error('Workflow execution error:', error);
      throw error;
    }
  }

  async continueWorkflow(instanceId, nodeData = {}) {
    try {
      // Get workflow instance
      const instance = await WorkflowInstance.findById(instanceId);
      if (!instance) {
        throw new Error(`Workflow instance ${instanceId} not found`);
      }
      // Get current node instance
      const currentNodeInstance = await WorkflowNodeInstance.findByInstanceAndNodeId(
        instanceId,
        instance.current_node_id
      );

      if (!currentNodeInstance) {
        throw new Error(`Current node instance not found`);
      }

      // Get node definition
      const { rows: nodes } = await pool.query(
        'SELECT * FROM workflow_nodes WHERE id = $1',
        [currentNodeInstance.workflow_node_id]
      );

      if (nodes.length === 0) {
        throw new Error('Node definition not found');
      }

      const node = nodes[0];

      // Continue execution with provided data
      await this.executeNode(currentNodeInstance, node, instance, nodeData);

      return {
        success: true,
        message: 'Workflow continued successfully'
      };

    } catch (error) {
      console.error('Workflow continuation error:', error);
      throw error;
    }
  }

  async executeNode(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeType = node.type;
      const nodeConfig = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;

      // Combine workflow data with incoming data
      const combinedData = {
        ...workflowInstance.data,
        ...data,
        currentNodeId: node.node_id,
        nodeType: nodeType
      };

      // Log execution start
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        `Executing node: ${nodeType}`,
        { nodeId: node.node_id, nodeType, data: combinedData }
      );

      // Get executor for node type

      const executor = this.nodeExecutors[nodeType];
      if (!executor) {
        throw new Error(`No executor found for node type: ${nodeType}`);
      }

      // Execute the node
      const result = await executor.execute(nodeInstance, node, workflowInstance, combinedData);

      // Update node instance with result (only if not already updated by the executor)
      if (result.status && result.status !== 'waiting_user_input') {
        await WorkflowNodeInstance.updateStatus(
          nodeInstance.id,
          result.status,
          result.data,
          result.result,
          result.error
        );
      }

      // Log execution completion
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        `Node execution completed: ${result.status}`,
        { result: result.result, error: result.error }
      );
      // Check if node requires user interaction
      if (result.status === 'waiting_user_input') {
        // Update workflow instance current node and keep status as active
        await WorkflowInstance.updateStatus(
          workflowInstance.id,
          'active',
          node.node_id,
          { ...workflowInstance.data, ...result.result }
        );
        
        // Log that workflow is waiting for user input
        await WorkflowNodeInstance.logExecution(
          workflowInstance.id,
          nodeInstance.id,
          'info',
          'Workflow waiting for user input',
          { nodeId: node.node_id, nodeType }
        );
        
        return result;
      }

      // Find next node
      const nextNode = await this.findNextNode(node.node_id, workflowInstance.id, result.result);
      if (nextNode) {
        // Create next node instance
        const nextNodeInstance = await WorkflowNodeInstance.create(
          workflowInstance.id,
          nextNode.id,
          nextNode.node_id,
          workflowInstance.assigned_to,
          nextNode.type
        );

        // Prepare data for next node - include form data and previous node results
        const nextNodeData = {
          ...workflowInstance.data,
          ...result.result,
          previousNodeId: node.node_id,
          previousNodeType: nodeType,
          previousNodeResult: result.result
        };

        // Update workflow instance current node and data
        await WorkflowInstance.updateStatus(
          workflowInstance.id,
          'active',
          nextNode.node_id,
          nextNodeData
        );

        // Execute next node asynchronously (don't wait for completion)
        this.executeNode(nextNodeInstance, nextNode, workflowInstance, nextNodeData)
          .catch(error => {
            console.error('Error in async next node execution:', error);
          });
      } else {
        // No more nodes, workflow completed
        const finalData = {
          ...workflowInstance.data,
          ...result.result,
          completedAt: new Date().toISOString()
        };

        await WorkflowInstance.updateStatus(
          workflowInstance.id,
          'completed',
          null,
          finalData
        );

        await WorkflowNodeInstance.logExecution(
          workflowInstance.id,
          null,
          'info',
          'Workflow execution completed',
          { finalResult: result.result }
        );

        // Emit workflow completion event with UUID and path if available
        if (workflowInstance.data.uuid && workflowInstance.data.path) {
          const workflowEvent = {
            uuid: workflowInstance.data.uuid,
            path: workflowInstance.data.path,
            eventType: 'workflow_completed',
            eventData: {
              workflowInstanceId: workflowInstance.id,
              finalResult: result.result
            }
          };
          
          this.io.emit('workflow_event', workflowEvent);
        }
      }

      return result;

    } catch (error) {
      console.error(`Node execution error:`, error);
      
      // Update node instance with error
      await WorkflowNodeInstance.updateStatus(
        nodeInstance.id,
        'failed',
        null,
        null,
        error.message
      );

      // Log error
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'error',
        `Node execution failed: ${error.message}`,
        { error: error.stack }
      );

      // Update workflow instance status
      await WorkflowInstance.updateStatus(workflowInstance.id, 'failed');

      // Emit workflow failure event with UUID and path if available
      if (workflowInstance.data.uuid && workflowInstance.data.path) {
        const workflowEvent = {
          uuid: workflowInstance.data.uuid,
          path: workflowInstance.data.path,
          eventType: 'workflow_failed',
          eventData: {
            workflowInstanceId: workflowInstance.id,
            error: error.message
          }
        };
        
        this.io.emit('workflow_event', workflowEvent);
      }

      throw error;
    }
  }

  async getPreviousNodeData(workflowInstanceId, currentNodeId) {
    try {
      // Get all completed node instances for this workflow
      const { rows: completedNodes } = await pool.query(
        `SELECT wni.*, wn.type as node_type, wn.config as node_config
         FROM workflow_node_instances wni
         JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
         WHERE wni.workflow_instance_id = $1 
         AND wni.status = 'completed'
         ORDER BY wni.completed_at DESC`,
        [workflowInstanceId]
      );

      // Get the most recent completed node before the current node
      const previousNode = completedNodes.find(node => 
        node.node_id !== currentNodeId
      );

      if (!previousNode) {
        return {};
      }

      // Get workflow instance to access accumulated data
      const workflowInstance = await WorkflowInstance.findById(workflowInstanceId);
      
      return {
        previousNode: {
          id: previousNode.id,
          nodeId: previousNode.node_id,
          type: previousNode.node_type,
          config: previousNode.node_config,
          data: previousNode.data,
          result: previousNode.result,
          completedAt: previousNode.completed_at
        },
        workflowData: workflowInstance.data || {},
        formData: workflowInstance.data?.formData || {},
        allCompletedNodes: completedNodes
      };
    } catch (error) {
      console.error('Error getting previous node data:', error);
      return {};
    }
  }

  async findNextNode(currentNodeId, workflowInstanceId, nodeResult = {}) {
    try {
      // Get workflow connections

      const workflow = await WorkflowInstance.findById(workflowInstanceId);

      const { rows: connections } = await pool.query(
        'SELECT * FROM workflow_connections WHERE from_node_id = $1 AND workflow_id = $2',
        [currentNodeId, workflow.workflow_id]
      );

      if (connections.length === 0) {
        return null; // No next node
      }

      // For now, take the first connection (can be enhanced with conditions)
      const connection = connections[0];

      // Get target node
      const { rows: nodes } = await pool.query(
        'SELECT * FROM workflow_nodes WHERE node_id = $1 AND workflow_id = $2',
        [connection.to_node_id, workflow.workflow_id]
      );

      if (nodes.length === 0) {
        return null;
      }

      // Check if node instance already exists
      const existingInstance = await WorkflowNodeInstance.findByInstanceAndNodeId(
        workflowInstanceId,
        connection.to_node_id
      );

      if (existingInstance) {
        return null; // Node already processed
      }

      return nodes[0];

    } catch (error) {
      console.error('Error finding next node:', error);
      return null;
    }
  }

  async getWorkflowStatus(instanceId) {
    try {
      const instance = await WorkflowInstance.getInstanceWithNodes(instanceId);
      return instance;
    } catch (error) {
      console.error('Error getting workflow status:', error);
      throw error;
    }
  }
}

module.exports = WorkflowExecutor; 