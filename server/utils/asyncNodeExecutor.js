const WorkflowNodeInstance = require('../models/WorkflowNodeInstance');
const WorkflowInstance = require('../models/WorkflowInstance');
const pool = require('../config/database');

class AsyncNodeExecutor {
  constructor(io) {
    this.io = io;
    this.executionQueue = new Map(); // Track ongoing executions per workflow
  }

  /**
   * Schedule a node execution asynchronously
   */
  async scheduleNodeExecution(workflowInstanceId, nodeInstanceId, nodeId, nodeResult = {}) {
    try {
      console.log(`Scheduling async execution for workflow ${workflowInstanceId}, node ${nodeId}`);
      
      // Get workflow instance
      const workflowInstance = await WorkflowInstance.findById(workflowInstanceId);
      if (!workflowInstance) {
        throw new Error('Workflow instance not found');
      }

      // Get the node configuration
      const { rows: nodes } = await pool.query(
        'SELECT * FROM workflow_nodes WHERE node_id = $1',
        [nodeId]
      );

      if (nodes.length === 0) {
        throw new Error('Node not found');
      }

      const node = nodes[0];

      // Execute the node asynchronously
      this.executeNodeChain(node.node_id, workflowInstance, nodeResult);

    } catch (error) {
      console.error('Error scheduling node execution:', error);
      throw error;
    }
  }

  /**
   * Execute a chain of nodes asynchronously
   */
  async executeNodeChain(currentNodeId, workflowInstance, nodeResult = {}) {
    try {
      console.log(`Executing node chain starting from node ${currentNodeId}`);
      
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
        
        console.log(`Workflow ${workflowInstance.id} completed`);
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
      const WorkflowExecutor = require('./workflowExecutor');
      const workflowExecutor = new WorkflowExecutor(this.io);
      
      console.log(`Executing node ${nextNode.node_id} (${nextNode.type})`);
      
      // Execute the node and handle the result asynchronously
      workflowExecutor.executeNode(nextNodeInstance, nextNode, workflowInstance, nodeResult)
        .then(async (result) => {
          console.log(`Node ${nextNode.node_id} completed with status: ${result.status}`);
          
          // If node completed successfully and doesn't require user input, continue to next node
          if (result && result.status === 'completed') {
            // Schedule next node execution recursively
            setTimeout(() => {
              this.executeNodeChain(nextNode.node_id, workflowInstance, result.result || nodeResult)
                .catch(error => {
                  console.error('Error in recursive node chain execution:', error);
                });
            }, 100); // Small delay to prevent stack overflow
          }
        })
        .catch(error => {
          console.error(`Error executing node ${nextNode.node_id}:`, error);
        });

    } catch (error) {
      console.error('Error executing node chain:', error);
      throw error;
    }
  }

  /**
   * Check if a workflow has ongoing executions
   */
  hasOngoingExecution(workflowInstanceId) {
    return this.executionQueue.has(workflowInstanceId);
  }

  /**
   * Mark workflow execution as started
   */
  markExecutionStarted(workflowInstanceId) {
    this.executionQueue.set(workflowInstanceId, true);
  }

  /**
   * Mark workflow execution as completed
   */
  markExecutionCompleted(workflowInstanceId) {
    this.executionQueue.delete(workflowInstanceId);
  }
}

module.exports = AsyncNodeExecutor; 