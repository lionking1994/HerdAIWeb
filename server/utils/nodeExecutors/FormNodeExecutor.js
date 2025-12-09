const WorkflowNodeInstance = require('../../models/WorkflowNodeInstance');
const pool = require('../../config/database');
const WorkflowInstance = require('../../models/WorkflowInstance');

class FormNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeConfig = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
      
      // Update node instance status to in_progress
      await WorkflowNodeInstance.updateStatus(nodeInstance.id, 'in_progress', data);
      
      // Log form execution start
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Form execution started',
        { formFields: nodeConfig.formFields, label: nodeConfig.label, description: nodeConfig.description }
      );

      // For form nodes, we typically wait for user input
      // The form data will be submitted through a separate endpoint
      // and the workflow will continue from there
      // Form fields are defined in nodeConfig.formFields array

      // Create notification for workflow form
      const notificationMessage = 'Please complete the required form to continue the workflow.';
      const redirectUrl = `/workflow-form?workflowInstanceId=${workflowInstance.id}&nodeInstanceId=${nodeInstance.id}&nodeId=${node.node_id}`;
      
      // Create notification in database
      const { rows: notificationResult } = await pool.query(
        "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          workflowInstance.userId || workflowInstance.data.userId,
          false,
          notificationMessage,
          false,
          redirectUrl,
          new Date()
        ]
      );
      
      // Send notification via socket
      const socketEvent = {
        type: 'notification',
        id: workflowInstance.data.userId,
        notification: {
          id: notificationResult[0].id,
          title: 'Workflow Form Required',
          message: notificationMessage,
          type: 'workflow_form',
          data: {
            workflowInstanceId: workflowInstance.id,
            nodeInstanceId: nodeInstance.id,
            nodeId: node.node_id,
            formTitle: nodeConfig.label || 'Form Required',
            formDescription: nodeConfig.description || '',
            redirectUrl: redirectUrl
          },
          created_at: new Date().toISOString()
        }
      };

      console.log('Emitting notification for workflow form:', socketEvent);
      this.io.emit('notification', socketEvent);

      // Log form request
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Form requested',
        { formFields: nodeConfig.formFields, label: nodeConfig.label, description: nodeConfig.description }
      );

      // Update node instance status to waiting_user_input
      await WorkflowNodeInstance.updateStatus(nodeInstance.id, 'waiting_user_input', data, {});

      // Return waiting status
      return {
        status: 'waiting_user_input',
        data: data,
        result: {},
        error: null
      };

    } catch (error) {
      console.error('Form node execution error:', error);
      return {
        status: 'failed',
        data: data,
        result: {},
        error: error.message
      };
    }
  }

  async handleFormSubmission(workflowInstanceId, nodeInstanceId, formData, user) {
    try {
      // Log form submission
      await WorkflowNodeInstance.logExecution(
        workflowInstanceId,
        nodeInstanceId,
        'info',
        'Form submitted',
        { formData, submittedBy: user.id }
      );

      // Update node instance with form data
      const result = await WorkflowNodeInstance.updateStatus(nodeInstanceId, 'completed', formData, {formData, submittedBy: user});
      console.log("---result 87---",result);

      // Get workflow instance and node information
      const workflowInstance = await WorkflowInstance.findById(workflowInstanceId);
      
      if (!workflowInstance) {
        throw new Error('Workflow instance not found');
      }

      // Get the completed node instance to find the node_id
      const nodeInstance = await WorkflowNodeInstance.findById(nodeInstanceId);
      if (!nodeInstance) {
        throw new Error('Node instance not found');
      }

      // Get the node configuration
      const { rows: nodes } = await pool.query(
        'SELECT * FROM workflow_nodes WHERE id = $1',
        [nodeInstance.workflow_node_id]
      );

      if (nodes.length === 0) {
        throw new Error('Node not found');
      }

      const node = nodes[0];

      // Find and execute next node
      await this.executeNextNode(node.node_id, workflowInstance, formData);

      return {
        status: 'completed',
        data: formData,
        result: { submittedBy: user.id, timestamp: new Date().toISOString() },
        error: null
      };

    } catch (error) {
      console.error('Form submission error:', error);
      return {
        status: 'failed',
        data: formData,
        result: {},
        error: error.message
      };
    }
  }

  async executeNextNode(currentNodeId, workflowInstance, nodeResult = {}) {
    try {
      // Get workflow connections
      const { rows: connections } = await pool.query(
        'SELECT * FROM workflow_connections WHERE from_node_id = $1',
        [currentNodeId]
      );

      if (connections.length === 0) {
        // No next node, workflow completed
        await WorkflowInstance.updateStatus(
          workflowInstance.id,
          'completed',
          null,
          { ...workflowInstance.data, ...nodeResult }
        );

        await WorkflowNodeInstance.logExecution(
          workflowInstance.id,
          null,
          'info',
          'Workflow execution completed',
          { finalResult: nodeResult }
        );
        return;
      }

      // Get the next node
      const nextConnection = connections[0]; // Assuming single connection for now
      const { rows: nextNodes } = await pool.query(
        'SELECT * FROM workflow_nodes WHERE node_id = $1',
        [nextConnection.to_node_id]
      );

      if (nextNodes.length === 0) {
        throw new Error('Next node not found');
      }

      const nextNode = nextNodes[0];

      // Create next node instance
      const nextNodeInstance = await WorkflowNodeInstance.create(
        workflowInstance.id,
        nextNode.id,
        nextNode.node_id,
        workflowInstance.assigned_to,
        nextNode.type
      );

      // Update workflow instance current node
      await WorkflowInstance.updateStatus(
        workflowInstance.id,
        'active',
        nextNode.node_id,
        { ...workflowInstance.data, ...nodeResult }
      );

      // Execute next node using workflow executor
      const WorkflowExecutor = require('../workflowExecutor');
      const workflowExecutor = new WorkflowExecutor(this.io);
      await workflowExecutor.executeNode(nextNodeInstance, nextNode, workflowInstance, nodeResult);

    } catch (error) {
      console.error('Error executing next node:', error);
      throw error;
    }
  }
}

module.exports = FormNodeExecutor; 