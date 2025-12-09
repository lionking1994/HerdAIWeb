const WorkflowNodeInstance = require('../../models/WorkflowNodeInstance');
const axios = require('axios');

class ApiNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeConfig = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
      
      // Log API execution start
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'API execution started',
        { apiConfig: nodeConfig.apiConfig }
      );

      // Execute API call
      const apiResult = await this.executeApiCall(nodeConfig, data);

      // Log API completion
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'API execution completed',
        { result: apiResult }
      );

      return {
        status: 'completed',
        data: data,
        result: apiResult,
        error: null
      };

    } catch (error) {
      console.error('API node execution error:', error);
      return {
        status: 'failed',
        data: data,
        result: {},
        error: error.message
      };
    }
  }

  async executeApiCall(apiConfig, data) {
    try {
      const { url, method = 'GET', headers = {}, body = {}, authentication } = apiConfig;

      // Prepare request config
      const requestConfig = {
        method: method.toLowerCase(),
        url,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      // Add authentication if provided
      if (authentication) {
        if (authentication.type === 'bearer') {
          requestConfig.headers.Authorization = `Bearer ${authentication.token}`;
        } else if (authentication.type === 'basic') {
          const credentials = Buffer.from(`${authentication.username}:${authentication.password}`).toString('base64');
          requestConfig.headers.Authorization = `Basic ${credentials}`;
        }
      }

      // Add body for POST/PUT requests
      if (['post', 'put', 'patch'].includes(method.toLowerCase()) && body) {
        requestConfig.data = body;
      }

      // Make the API call
      const response = await axios(requestConfig);

      return {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`API call failed: ${error.message}`);
    }
  }
}

module.exports = ApiNodeExecutor; 