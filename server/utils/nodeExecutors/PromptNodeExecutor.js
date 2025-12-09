const WorkflowNodeInstance = require('../../models/WorkflowNodeInstance');
const { replaceWorkflowPlaceholders } = require('../workflowPlaceholder');
const { processAI, processAIWithModel, outputType1 } = require('../llmservice');

/**
 * PromptNodeExecutor - Executes prompt nodes in workflows
 * 
 * This executor processes prompt nodes that can:
 * - Generate text content using AI/LLM
 * - Process and transform data using prompts
 * - Create dynamic content based on workflow data
 * 
 * The executor supports:
 * - Template variable substitution ({{variable}})
 * - AI-powered content generation
 * - Data transformation and formatting
 * - Custom prompt configurations
 */
class PromptNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeConfig = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
      
      // Log prompt execution start
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Prompt execution started',
        { 
          promptConfig: nodeConfig,
          inputData: data,
          hasPrompt: !!nodeConfig.prompt
        }
      );

      // Execute prompt logic
      const promptResult = await this.executePrompt(nodeConfig, data, workflowInstance);

      // Log prompt completion
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Prompt execution completed',
        { result: promptResult }
      );

      // Update node instance status to completed
      await WorkflowNodeInstance.updateStatus(nodeInstance.id, 'completed', data, {});

      return {
        status: 'completed',
        data: data,
        result: promptResult,
        error: null
      };

    } catch (error) {
      console.error('Prompt node execution error:', error);
      
      // Log error
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'error',
        'Prompt execution failed',
        { error: error.message, stack: error.stack }
      );

      return {
        status: 'failed',
        data: data,
        result: {},
        error: error.message
      };
    }
  }

  async executePrompt(promptConfig, data, workflowInstance) {
    try {
      const { prompt } = promptConfig;
      
      if (!prompt) {
        throw new Error('No prompt provided in node configuration');
      }

      console.log('whatisthemeaningofpromptConfig', promptConfig)
      console.log('Executing prompt:', { hasPrompt: !!prompt, hasData: Object.keys(data).length > 0 });

      // Replace template variables in the prompt
      const processedPrompt = await this.replaceTemplateVariables(prompt, data, workflowInstance);
      
      // Process with AI to generate content
      const aiResult = await this.processWithAI(processedPrompt, data, promptConfig);
      
      return {
        promptType: 'prompt',
        resultType: aiResult.resultType,
        originalPrompt: prompt,
        processedPrompt: processedPrompt,
        result: aiResult.result,
        content: aiResult?.content || null,
        variables: data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Prompt execution error:', error);
      throw error;
    }
  }

  /**
   * Replace template variables in the prompt
   * Supports {{variable}} syntax
   */
  async replaceTemplateVariables(prompt, variables = {}, workflowInstance) {
    let processedPrompt = prompt;

    // Build full variable context from workflow history plus current data
    const combinedVariables = await this.buildVariableContext(workflowInstance, variables);

    // Replace all {{variable}} patterns using the combined variable set
    Object.keys(combinedVariables).forEach(key => {
      const rawValue = combinedVariables[key];
      if (rawValue === undefined || rawValue === null) {
        return;
      }
      const value = this.stringifyValue(rawValue);
      const placeholder = `{{${key}}}`;
      processedPrompt = processedPrompt.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        value
      );
    });

    // Resolve any remaining workflow placeholders (e.g., {{logicalId.field}})
    if (workflowInstance && workflowInstance.id) {
      try {
        processedPrompt = await replaceWorkflowPlaceholders(processedPrompt, workflowInstance);
      } catch (error) {
        console.error('Workflow placeholder replacement error:', error);
      }
    }
    
    return processedPrompt;
  }

  async buildVariableContext(workflowInstance, currentVariables = {}) {
    const aggregatedVariables = {};

    if (workflowInstance && workflowInstance.id) {
      try {
        const completedNodes = await WorkflowNodeInstance.getCompletedNodes(workflowInstance.id);
        completedNodes.forEach(nodeInstance => {
          const nodeConfig = this.safeJsonParse(nodeInstance.node_config);
          const logicalId = nodeConfig?.logicalId || nodeInstance.node_id;
          const nodeData = this.safeJsonParse(nodeInstance.data);
          let nodeResult = this.safeJsonParse(nodeInstance.result);

          // If this is a prompt node and has content, use content instead of result
          if (nodeInstance.node_type === 'promptNode' && nodeResult && nodeResult.content) {
            nodeResult = {
              ...nodeResult,
              result: nodeResult.content
            };
          }

          this.addNodeVariables(aggregatedVariables, nodeData, logicalId);
          this.addNodeVariables(aggregatedVariables, nodeResult, logicalId);
        });

        // Also include the workflow-level data snapshot
        this.addNodeVariables(
          aggregatedVariables,
          this.safeJsonParse(workflowInstance.data),
          'workflow'
        );
      } catch (error) {
        console.error('Error building workflow variable context:', error);
      }
    }

    return {
      ...aggregatedVariables,
      ...(currentVariables || {})
    };
  }

  addNodeVariables(target, source, logicalId) {
    if (source === null || source === undefined) {
      return;
    }

    if (typeof source !== 'object' || source instanceof Date) {
      const value = this.stringifyValue(source);
      if (logicalId) {
        target[logicalId] = value;
        target[`${logicalId}.result`] = value;
      }
      return;
    }

    const flattened = this.flattenObject(source);
    Object.entries(flattened).forEach(([keyPath, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      const stringValue = this.stringifyValue(value);
      target[keyPath] = stringValue;
      if (logicalId) {
        target[`${logicalId}.${keyPath}`] = stringValue;
      }
    });
  }

  flattenObject(obj, prefix = '') {
    if (obj === null || obj === undefined) {
      return {};
    }

    if (typeof obj !== 'object' || obj instanceof Date) {
      if (!prefix) {
        return { value: obj };
      }
      return { [prefix]: obj };
    }

    const flattened = {};
    const entries = Array.isArray(obj)
      ? Array.from(obj.entries())
      : Object.entries(obj);

    for (const [key, value] of entries) {
      const newPrefix = prefix ? `${prefix}.${key}` : `${key}`;
      Object.assign(flattened, this.flattenObject(value, newPrefix));
    }

    return flattened;
  }

  safeJsonParse(payload) {
    if (!payload) {
      return null;
    }

    if (typeof payload === 'object') {
      return payload;
    }

    try {
      return JSON.parse(payload);
    } catch (error) {
      return payload;
    }
  }

  stringifyValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value);
  }

  /**
   * Process prompt with AI/LLM
   */
  async processWithAI(prompt, data, promptConfig) {
    try {
      console.log('Processing prompt with AI:', prompt.substring(0, 100) + '...');
      
      const output_type = await outputType1(prompt);
      console.log("-------output_type--------", output_type);
      // Create a system prompt for AI processing
      const systemPrompt = `
      You are a helpful assistant that processes prompts and generates appropriate responses.
      Follow these guidelines:
      1. Provide clear, concise, and relevant responses
      2. If the prompt asks for specific formatting, follow it exactly
      3. If the prompt contains data to be processed, analyze and respond appropriately
      4. Be helpful and accurate in your responses
      5. If you're unsure about something, say so rather than guessing
      6. Do not add any content other than what is requested.
      `;

      // Process with LLM
      const aiResult = await processAIWithModel(systemPrompt, prompt, 4000, promptConfig.api, promptConfig.model, output_type?.result);

      console.log("🤡🤡🤡🤡AI Result:", aiResult);
      
      return aiResult;
    } catch (error) {
      console.error('AI processing error:', error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }
}

module.exports = PromptNodeExecutor;
