const WorkflowNodeInstance = require('../../models/WorkflowNodeInstance');
const axios = require('axios');

class WebhookNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeConfig = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
      
      // Log webhook execution start
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Webhook execution started',
        { webhookConfig: nodeConfig.webhookConfig }
      );

      // Execute webhook call
      const webhookResult = await this.executeWebhook(nodeConfig, data);

      // Log webhook completion
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Webhook execution completed',
        { result: webhookResult }
      );

      return {
        status: 'completed',
        data: data,
        result: webhookResult,
        error: null
      };

    } catch (error) {
      console.error('Webhook node execution error:', error);
      return {
        status: 'failed',
        data: data,
        result: {},
        error: error.message
      };
    }
  }

  async executeWebhook(webhookConfig, data) {
    try {
      const { url, method = 'POST', headers = {}, body = {}, authentication, timeout = 30000 } = webhookConfig;

      // Prepare request config
      const requestConfig = {
        method: method.toLowerCase(),
        url,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout
      };

      // Add authentication if provided
      if (authentication) {
        if (authentication.type === 'bearer') {
          requestConfig.headers.Authorization = `Bearer ${authentication.token}`;
        } else if (authentication.type === 'basic') {
          const credentials = Buffer.from(`${authentication.username}:${authentication.password}`).toString('base64');
          requestConfig.headers.Authorization = `Basic ${credentials}`;
        } else if (authentication.type === 'api_key') {
          requestConfig.headers[authentication.header_name || 'X-API-Key'] = authentication.api_key;
        }
      }

      // Add body for POST/PUT requests
      if (['post', 'put', 'patch'].includes(method.toLowerCase()) && body) {
        requestConfig.data = body;
      }

      // Make the webhook call
      const response = await axios(requestConfig);

      return {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Webhook call failed: ${error.message}`);
    }
  }
}

module.exports = WebhookNodeExecutor; 