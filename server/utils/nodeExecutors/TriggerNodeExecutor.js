const WorkflowNodeInstance = require('../../models/WorkflowNodeInstance');

/**
 * TriggerNodeExecutor - Executes trigger nodes in workflows
 * 
 * This executor is designed for trigger nodes that don't require any processing.
 * It simply logs the execution and continues to the next node in the workflow.
 * 
 * Use cases:
 * - Manual triggers (user-initiated workflow starts)
 * - Scheduled triggers (time-based workflow starts)
 * - Event triggers (external system notifications)
 * - Conditional triggers (workflow branching points)
 * 
 * The executor maintains the workflow data flow without modification.
 */
class TriggerNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeConfig = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
      
      // Log trigger execution start
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Trigger execution started',
        { 
          triggerConfig: nodeConfig.triggerConfig,
          triggerType: nodeConfig.triggerType,
          inputData: data
        }
      );

      // For trigger nodes, we don't need to process anything
      // Just pass through the data to the next node
      const triggerResult = {
        triggered: true,
        timestamp: new Date().toISOString(),
        triggerType: nodeConfig.triggerType || 'manual',
        data: data
      };

      // Log trigger completion
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Trigger execution completed',
        { result: triggerResult }
      );

      return {
        status: 'completed',
        data: data,
        result: triggerResult,
        error: null
      };

    } catch (error) {
      console.error('Trigger node execution error:', error);
      
      // Log the error
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'error',
        'Trigger execution failed',
        { error: error.message }
      );

      return {
        status: 'failed',
        data: data,
        result: {},
        error: error.message
      };
    }
  }
}

module.exports = TriggerNodeExecutor;
