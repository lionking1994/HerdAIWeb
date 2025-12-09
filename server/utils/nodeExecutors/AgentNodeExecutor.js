const WorkflowNodeInstance = require('../../models/WorkflowNodeInstance');
const WorkflowInstance = require('../../models/WorkflowInstance');
const { processAI } = require('../llmservice');

// Use the existing MCP client manager that's already working
let mcpClientManager;

async function loadMCPClientManager() {
  if (!mcpClientManager) {
    mcpClientManager = require('../mcpClient.js');
  }
  return mcpClientManager;
}

/**
 * AgentNodeExecutor - Executes agent nodes in workflows with MCP integration
 * 
 * TWO-STEP MCP PROCESS:
 * 1. TOOL EXECUTION: Runs MCP tools to find data (companies, employees, jobs)
 * 2. CHAT INTERACTION: Sends follow-up questions to get detailed insights
 * 
 * NATURAL LANGUAGE QUERY SUPPORT:
 * This executor supports natural language queries for MCP tools.
 * Users can input plain English queries in their workflow forms:
 * 
 * Supported form fields for natural language:
 * - query: "Find AI startups in Silicon Valley"
 * - naturalQuery: "Software engineers at tech companies" 
 * - query_text: "Healthcare companies with 500+ employees"
 * 
 * Query processing priority:
 * 1. Natural language fields (naturalQuery, natural_query, query_text)
 * 2. String queries (query field as string) - treated as natural language
 * 3. Object queries (query field as object) - used as-is for structured queries
 * 4. Structured data - builds query from individual fields (company, location, etc.)
 * 
 * EXECUTION FLOW:
 * Step 1: Execute tool (e.g., "Find fintech companies in NYC")
 *         → Returns company data from Coresignal API
 * Step 2: Send chat message (e.g., "Tell me more about [Company Name]")
 *         → Returns detailed insights and analysis
 * 
 * Examples of natural language queries:
 * - "Companies in Austin Texas with software development"
 * - "Find remote job opportunities for data scientists"
 * - "Startups founded after 2020 in the fintech industry"
 * - "Senior software engineers at Fortune 500 companies"
 * 
 * The MCP server handles both tool calls and conversational queries.
 */
class AgentNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeConfig = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
      console.log("Node config:", JSON.stringify(nodeConfig, null, 2));
      
      // Get previous node data using workflow executor helper
      const WorkflowExecutor = require('../workflowExecutor');
      const workflowExecutor = new WorkflowExecutor(this.io);
      const previousNodeData = await workflowExecutor.getPreviousNodeData(
        workflowInstance.id, 
        node.node_id
      );

      console.log("Previous node data:", JSON.stringify(previousNodeData, null, 2));
      
      // Get form data from previous nodes or workflow instance
      const workflowData = previousNodeData.previousNode.data;
      
      // Log agent execution start
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Agent execution started',
        { 
          agentConfig: nodeConfig.agentConfig,
          agentType: nodeConfig.agentType,
          inputData: workflowData,
          previousNode: previousNodeData.previousNode,
          enableLLMEnhancement: nodeConfig.agentConfig?.enableLLMEnhancement,
          hasPrompt: !!nodeConfig.agentConfig?.prompt
        }
      );

      // Execute agent logic based on agent type
      const agentResult = await this.executeAgent(nodeConfig, workflowData);

      // Log agent completion
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Agent execution completed',
        { result: agentResult }
      );

      return {
        status: 'completed',
        data: workflowData,
        result: agentResult,
        error: null
      };

    } catch (error) {
      console.error('Agent node execution error:', error);
      
      // Log error
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'error',
        'Agent execution failed',
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

  async executeAgent(agentConfig, data) {
    try {
      const agentType = agentConfig.agentType || 'mcp';
      console.log(`Executing agent type: ${agentType}`);
      
      // Handle different agent types
      switch (agentType) {
        case 'mcp':
          return await this.executeMcpAgent(agentConfig, data);
        case 'research':
          return await this.executeResearchAgent(agentConfig, data);
        case 'analysis':
          return await this.executeAnalysisAgent(agentConfig, data);
        case 'summary':
          return await this.executeSummaryAgent(agentConfig, data);
        case 'custom':
          return await this.executeCustomAgent(agentConfig, data);
        default:
          console.warn(`Unknown agent type: ${agentType}, defaulting to MCP`);
          return await this.executeMcpAgent(agentConfig, data);
      }
    } catch (error) {
      console.error('Agent execution error:', error);
      throw error;
    }
  }

  async executeMcpAgent(agentConfig, data) {
    try {
      let prompt = agentConfig.prompt || '';

      /*  
       Prompt Sample = Give me the company details {{Company Name}} for with url {{Company URL}},
Need details on revenue, key executives, offerings and services, industry challenges, 
give me deep and result as json format that is need to summarize as max length
       Data Sample = {
        "Email": "****",
        "Last Name": "***",
        "First Name": "***",
        "Company URL": "***",
        "Company Name": "***",
        "Company Revenue YTD": "***"
      }
        need to replace this all data value on prompt
        use iterate
      */
      
      Object.keys(data).forEach(key => {
        prompt = prompt.replace(`{{${key}}}`, data[key]);
      });

      const mcpDetails = agentConfig.mcpDetails || '';

      console.log('**🤖 agentConfig**', agentConfig);
      console.log("**data**", data);
      // Extract form data for MCP agent
      const formData = data.formData || {};
      const workflowData = { ...data, formData };
      
      // Log natural language query examples for user reference
      this.logNaturalLanguageExamples();
      
      // Prepare context for MCP agent
      const agentContext = {
        formData: formData,
        workflowData: workflowData,
        prompt: prompt,
        mcpDetails: mcpDetails,
        agentConfig: agentConfig, // Pass the full agent config for enhancement prompt access
        timestamp: new Date().toISOString()
      };
      
      console.log("MCP Agent context:", JSON.stringify(agentContext, null, 2));
      
      // Call MCP agent with the context
      const mcpResult = await this.callMcpAgent(prompt, agentContext);

      console.log('mcpResult ----> ', mcpResult);
      
      return {
        agentType: 'mcp',
        agentResponse: mcpResult.response,
        originalMcpResult: mcpResult.originalMcpResult,
        enhanced: mcpResult.enhanced,
        processedFormData: formData,
        prompt: prompt,
        enhancementPrompt: agentConfig.prompt, // Include the enhancement prompt used
        mcpDetails: mcpDetails,
        context: agentContext,
        timestamp: new Date().toISOString(),
        success: mcpResult.success,
        mcpResult: mcpResult.mcpResult,
        toolUsed: mcpResult.toolUsed,
        llmError: mcpResult.llmError
      };
    } catch (error) {
      console.error('MCP agent execution error:', error);
      throw new Error(`MCP agent execution failed: ${error.message}`);
    }
  }

  /**
   * Log examples of natural language queries for user reference
   */
  logNaturalLanguageExamples() {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  MCP NATURAL LANGUAGE + CHAT                  ║
╠════════════════════════════════════════════════════════════════╣
║ NEW: Two-step process for comprehensive company insights!      ║
║                                                                ║
║ STEP 1 - TOOL EXECUTION: Find companies with natural language ║
║ Form field options:                                            ║
║ • query: "AI startups in San Francisco"                       ║
║ • naturalQuery: "Find software companies in Austin"           ║
║ • query_text: "Tech companies with 100+ employees"            ║
║                                                                ║
║ STEP 2 - CHAT INTERACTION: Get detailed insights              ║
║ Automatically asks: "Tell me more about [Company Name].       ║
║ What are their key business areas, recent developments?"       ║
║                                                                ║
║ Example complete flow:                                         ║
║ 1. Query: "Find fintech companies in New York"                ║
║    → Returns: List of fintech companies                       ║
║ 2. Chat: "Tell me more about [First Company]"                 ║
║    → Returns: Detailed analysis and insights                  ║
║                                                                ║
║ More example queries:                                          ║
║ • "Software engineers at Google"                              ║
║ • "Hiring managers in healthcare startups"                    ║
║ • "Companies founded after 2010 in Silicon Valley"            ║
║ • "Remote software developer jobs"                            ║
║                                                                ║
║ Get both structured data AND conversational insights!         ║
╚════════════════════════════════════════════════════════════════╝
    `);
  }

  async executeResearchAgent(agentConfig, data) {
    // Enhanced research agent placeholder
    return {
      agentType: 'research',
      agentResponse: `Research completed for query: ${data.query || 'general research'}`,
      processedData: data,
      research_results: {
        sources: [],
        summary: "Research agent functionality not yet implemented",
        confidence: 0
      },
      timestamp: new Date().toISOString()
    };
  }

  async executeAnalysisAgent(agentConfig, data) {
    // Enhanced analysis agent placeholder
    return {
      agentType: 'analysis',
      agentResponse: `Analysis completed for data with ${Object.keys(data).length} fields`,
      processedData: data,
      analysis_results: {
        insights: [],
        metrics: {},
        recommendations: []
      },
      timestamp: new Date().toISOString()
    };
  }

  async executeSummaryAgent(agentConfig, data) {
    // Enhanced summary agent placeholder
    const dataString = JSON.stringify(data, null, 2);
    const wordCount = dataString.split(/\s+/).length;
    
    return {
      agentType: 'summary',
      agentResponse: `Summary generated from ${wordCount} words of input data`,
      processedData: data,
      summary_results: {
        key_points: [],
        word_count: wordCount,
        summary: "Summary agent functionality not yet implemented"
      },
      timestamp: new Date().toISOString()
    };
  }

  async executeCustomAgent(agentConfig, data) {
    // Enhanced custom agent placeholder
    return {
      agentType: 'custom',
      agentResponse: `Custom agent executed with configuration`,
      processedData: data,
      custom_results: {
        config_used: agentConfig,
        execution_details: "Custom agent functionality not yet implemented"
      },
      timestamp: new Date().toISOString()
    };
  }

  async callMcpAgent(mcpConfig, context) {
    try {
     let tryCount = 0;
     let maxCount = 3;
     while (tryCount < maxCount) {
      tryCount++;
      const response = await fetch(`${process.env.MCPAGENT_URL}/query`, {
        method: 'POST',
        body: JSON.stringify({ query: context.prompt }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const responseData = await response.json();
      console.log('response.response', responseData.response);

      // Get the MCP result
      const mcpResult = responseData.response;
      
      // Check if we have an enhancement prompt and LLM enhancement is enabled
      const enhancementPrompt = context.agentConfig?.enhancementPrompt || context.agentConfig?.prompt;
      const enableLLMEnhancement = context.agentConfig?.enableLLMEnhancement !== false; // Default to true if not specified
      
      if (enhancementPrompt && mcpResult && enableLLMEnhancement) {
        try {
          console.log('🤖 Enhancing MCP result with LLM...');
          
          // Create a system prompt for LLM enhancement
          const systemPrompt = `
          Rule : 
          1. Convert the result to clean, valid JSON format with proper nesting
          2. If the input contains multiple JSON objects or mixed content, extract and combine the relevant data
          3. Remove any markdown formatting, code blocks, or explanatory text
          4. Ensure the output is a single, well-structured JSON object with nested properties
          5. Structure company data under a "companyAnalysis" object
          6. Include nested objects for different data categories:
          7. Maintain data accuracy and completeness
          
          Do not include any explanations, markdown formatting, or code blocks in your response.
          `;
          
          // Create the user prompt combining the enhancement prompt and MCP result
          const userPrompt = `
          Original MCP Result:

          \`\`\`
          ${mcpResult}
          \`\`\`
          
          OUTPUT FORMAT MUST BE BELONG TO THIS JSON FORMAT, DON'T NEED ANY OTHER DATA:
          
          Do not include any explanations, markdown formatting, or code blocks in your response.`;
          
          // Process with LLM
          const enhancedResult = await processAI(systemPrompt, userPrompt, 65000);

          // Clean the result to remove any remaining markdown or code blocks

          console.log('😯😯😯enhancedResult', enhancedResult);
          let cleanedResult = enhancedResult.trim();
          
          // Remove markdown code blocks if present
          if (cleanedResult.startsWith('\`\`\`json')) {
            cleanedResult = cleanedResult.replace(/^\`\`\`json\s*/, '').replace(/\`\`\`\s*$/, '');
          } else if (cleanedResult.startsWith('\`\`\`')) {
            cleanedResult = cleanedResult.replace(/^\`\`\`\s*/, '').replace(/\`\`\`\s*$/, '');
          }
          
          // Remove any explanatory text before or after JSON
          const jsonStart = cleanedResult.search(/\{|\[/);
          const jsonEnd = cleanedResult.lastIndexOf('}') !== -1 ? cleanedResult.lastIndexOf('}') + 1 : 
                         cleanedResult.lastIndexOf(']') !== -1 ? cleanedResult.lastIndexOf(']') + 1 : -1;
          
          if (jsonStart !== -1 && jsonEnd !== -1) {
            cleanedResult = cleanedResult.substring(jsonStart, jsonEnd);
          }
          
          // Try to parse as JSON
          let JsonFormat;
          try {
            JsonFormat = JSON.parse(cleanedResult);
          } catch (parseError) {
            console.error('❌ JSON parsing failed, trying to extract JSON from response:', parseError);
            // Try to extract JSON from the response if it contains mixed content
            const jsonMatch = cleanedResult.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) {
              JsonFormat = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('Unable to extract valid JSON from enhanced result');
            }
          }
          if (JSON.stringify(JsonFormat).length < 400) {
            continue;
          }
          return {
            response: JsonFormat,
            enhanced: true,
            success: true, 
            timestamp: new Date().toISOString()
          };
          
        } catch (llmError) {
          console.error('❌ LLM enhancement failed:', llmError);
          // Return original MCP result if LLM enhancement fails
          return {
            response: mcpResult,
            enhanced: false,
            success: true,
            timestamp: new Date().toISOString(),
            llmError: llmError.message
          };
        }
      }
      
      // Return original MCP result if no enhancement prompt
      return {
        response: mcpResult, 
        enhanced: false,
        success: true, 
        timestamp: new Date().toISOString()
      };
    }
      
    } catch (error) {
      console.error('MCP agent call error:', error);
      return {
        response: `MCP Agent error: ${error.message}`,
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Format MCP response for consistent output
   */
  formatMcpResponse(toolResult, chatResult = null) {
    let response = '';

    // Format tool result
    if (toolResult) {
      response += '=== TOOL RESULTS ===\n';
      
      if (toolResult.content) {
        if (Array.isArray(toolResult.content)) {
          response += toolResult.content.map(item => 
            typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)
          ).join('\n');
        } else if (typeof toolResult.content === 'object') {
          response += JSON.stringify(toolResult.content, null, 2);
        } else {
          response += String(toolResult.content);
        }
      } else if (toolResult.response) {
        response += typeof toolResult.response === 'object' ? 
          JSON.stringify(toolResult.response, null, 2) : String(toolResult.response);
      } else {
        response += JSON.stringify(toolResult, null, 2);
      }
    }

    // Format chat result
    if (chatResult && chatResult.success) {
      response += '\n\n=== CHAT INSIGHTS ===\n';
      
      if (chatResult.chatResponse) {
        if (chatResult.chatResponse.content) {
          if (Array.isArray(chatResult.chatResponse.content)) {
            response += chatResult.chatResponse.content.map(item => 
              typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)
            ).join('\n');
          } else if (typeof chatResult.chatResponse.content === 'object') {
            response += JSON.stringify(chatResult.chatResponse.content, null, 2);
          } else {
            response += String(chatResult.chatResponse.content);
          }
        } else {
          response += JSON.stringify(chatResult.chatResponse, null, 2);
        }
      }
      
      if (chatResult.chatMessage) {
        response += '\n\nQuestion asked: ' + chatResult.chatMessage;
      }
    } else if (chatResult && !chatResult.success) {
      response += '\n\n=== CHAT ERROR ===\n';
      response += `Chat request failed: ${chatResult.error || 'Unknown error'}`;
    }

    return response || 'No response from MCP tool';
  }
  
  /**
   * Parse MCP configuration from string or object
   */
  parseMcpConfig(mcpDetails) {
    try {
      if (typeof mcpDetails === 'string') {
        return JSON.parse(mcpDetails);
      }
      if (typeof mcpDetails === 'object' && mcpDetails !== null) {
        return mcpDetails;
      }
      throw new Error('MCP details must be a string or object');
    } catch (error) {
      throw new Error(`Invalid MCP details format: ${error.message}`);
    }
  }
  
  /**
   * Extract connection configuration from parsed MCP config
   */
  extractConnectionConfig(mcpConfigParsed) {
    let connectionConfig;
    let toolName = null;
    
    if (mcpConfigParsed.mcpServers) {
      // New format with mcpServers
      const result = this.extractFromMcpServers(mcpConfigParsed.mcpServers);
      connectionConfig = result.connectionConfig;
      toolName = result.toolName;
    } else {
      // Legacy format - use config as-is
      connectionConfig = mcpConfigParsed;
      toolName = mcpConfigParsed.toolName || null;
    }
    
    return { connectionConfig, toolName };
  }
  
  /**
   * Extract configuration from mcpServers format
   */
  extractFromMcpServers(mcpServers) {
    const serverNames = Object.keys(mcpServers);
    
    if (serverNames.length === 0) {
      throw new Error('No MCP servers configured in mcpServers');
    }
    
    // Use the first server or find a specific one
    const serverName = serverNames[0];
    const serverConfig = mcpServers[serverName];
    
    console.log(`Using MCP server: ${serverName}`, JSON.stringify(serverConfig, null, 2));
    
    // Build connection configuration
    const connectionConfig = {
      name: serverName,
      version: '1.0.0',
      type: serverConfig.type || 'sse',
      url: this.extractUrlFromConfig(serverConfig),
      credentials: {
        headers: this.extractHeadersFromConfig(serverConfig)
      }
    };
    
    // Extract tool name
    const toolName = this.extractToolNameFromConfig(serverName, serverConfig);
    
    return { connectionConfig, toolName };
  }
  
  /**
   * Extract URL from server configuration
   */
  extractUrlFromConfig(serverConfig) {
    // Try to get URL from args array (npx command format)
    if (serverConfig.args && Array.isArray(serverConfig.args)) {
      const urlArg = serverConfig.args.find(arg => 
        typeof arg === 'string' && (arg.startsWith('http://') || arg.startsWith('https://'))
      );
      if (urlArg) return urlArg;
    }
    
    // Try direct url property
    if (serverConfig.url) return serverConfig.url;
    
    // Try to extract from command string if it's a single command
    if (serverConfig.command && typeof serverConfig.command === 'string') {
      const commandParts = serverConfig.command.split(' ');
      const urlPart = commandParts.find(part => 
        part.startsWith('http://') || part.startsWith('https://')
      );
      if (urlPart) return urlPart;
    }
    
    // Default URLs based on server type or name
    if (serverConfig.command && serverConfig.command.includes('coresignal')) {
      return 'https://mcp.coresignal.com/sse';
    }
    
    // For Coresignal specifically
    if (serverConfig.name && serverConfig.name.toLowerCase().includes('coresignal')) {
      return 'https://mcp.coresignal.com/sse';
    }
    
    throw new Error('No URL found in server configuration');
  }
  
  /**
   * Extract headers from server configuration
   */
  extractHeadersFromConfig(serverConfig) {
    const headers = {};
    
    // Add API key from env if available
    if (serverConfig.env?.AUTH_HEADER) {
      headers['apikey'] = serverConfig.env.AUTH_HEADER;
    }
    
    // Check for specific environment variables
    if (process.env.CORESIGNAL_API_KEY && process.env.CORESIGNAL_API_KEY !== 'your_coresignal_api_key_here') {
      headers['apikey'] = process.env.CORESIGNAL_API_KEY;
      console.log('Using CoreSignal API key from environment variable');
    }
    
    // Extract headers from args array (npx command format)
    if (serverConfig.args && Array.isArray(serverConfig.args)) {
      for (let i = 0; i < serverConfig.args.length; i++) {
        if (serverConfig.args[i] === '--header' && serverConfig.args[i + 1]) {
          const headerString = serverConfig.args[i + 1];
          const [headerName, ...headerValueParts] = headerString.split(':');
          
          if (headerName && headerValueParts.length > 0) {
            let headerValue = headerValueParts.join(':').trim();
            
            // Replace environment variable placeholders
            if (headerValue.includes('${AUTH_HEADER}') && serverConfig.env?.AUTH_HEADER) {
              headerValue = headerValue.replace('${AUTH_HEADER}', serverConfig.env.AUTH_HEADER);
            }
            
            headers[headerName.trim()] = headerValue;
          }
        }
      }
    }
    
    // Extract headers from command string if it's a single command
    if (serverConfig.command && typeof serverConfig.command === 'string') {
      const commandParts = serverConfig.command.split(' ');
      
      for (let i = 0; i < commandParts.length; i++) {
        if (commandParts[i] === '--header' && commandParts[i + 1]) {
          const headerString = commandParts[i + 1];
          // Remove quotes if present
          const cleanHeaderString = headerString.replace(/^["']|["']$/g, '');
          const [headerName, ...headerValueParts] = cleanHeaderString.split(':');
          
          if (headerName && headerValueParts.length > 0) {
            let headerValue = headerValueParts.join(':').trim();
            headers[headerName.trim()] = headerValue;
          }
        }
      }
    }
    
    // Add direct header properties if available
    if (serverConfig.headers && typeof serverConfig.headers === 'object') {
      Object.assign(headers, serverConfig.headers);
    }
    
    return headers;
  }
  
  /**
   * Extract tool name from server configuration
   */
  extractToolNameFromConfig(serverName, serverConfig) {
    // Try to extract from args
    if (serverConfig.args && Array.isArray(serverConfig.args)) {
      for (let i = 0; i < serverConfig.args.length; i++) {
        const arg = serverConfig.args[i];
        if (arg === '--tool' && i + 1 < serverConfig.args.length) {
          return serverConfig.args[i + 1];
        }
      }
    }
    
    // Try to derive from server name or command
    if (serverName.includes('coresignal') || (serverConfig.command && serverConfig.command.includes('coresignal'))) {
      return 'coresignal_employee_multisource_api';
    }
    
    // Return tool name from config if available
    return serverConfig.toolName || null;
  }
  

  

  

  

  

  

  

  
  /**
   * Create structured query for APIs that expect objects
   */
  createStructuredQuery(workflowData) {
    console.log('Creating query from workflow data:', JSON.stringify(workflowData, null, 2));
    
    // If there's a natural language query, use it directly
    if (workflowData.naturalQuery || workflowData.natural_query || workflowData.query_text) {
      const naturalQuery = workflowData.naturalQuery || workflowData.natural_query || workflowData.query_text;
      console.log('Using natural language query:', naturalQuery);
      
      // Return simple match query for natural language
      return {
        query_string: {
          query: naturalQuery,
          default_operator: "AND"
        }
      };
    }
    
    // If query is already provided and it's a string, treat it as natural language
    if (workflowData.query && typeof workflowData.query === 'string') {
      console.log('Using provided string query as natural language:', workflowData.query);
      
      return {
        query_string: {
          query: workflowData.query,
          default_operator: "AND"
        }
      };
    }
    
    // If query is already an object, use it as-is
    if (workflowData.query && typeof workflowData.query === 'object') {
      console.log('Using provided object query:', JSON.stringify(workflowData.query, null, 2));
      return workflowData.query;
    }
    
    const mustClauses = [];
    const shouldClauses = [];
    
    // Add company name match
    if (workflowData.company || workflowData.company_name) {
      mustClauses.push({
        match: {
          company_name: workflowData.company || workflowData.company_name
        }
      });
    }
    
    // Add location filters
    if (workflowData.city || workflowData.hq_city) {
      mustClauses.push({
        match: {
          hq_city: workflowData.city || workflowData.hq_city
        }
      });
    }
    
    if (workflowData.state || workflowData.hq_state) {
      mustClauses.push({
        match: {
          hq_state: workflowData.state || workflowData.hq_state
        }
      });
    }
    
    if (workflowData.country || workflowData.hq_country) {
      mustClauses.push({
        match: {
          hq_country: workflowData.country || workflowData.hq_country
        }
      });
    }
    
    // Add industry matches
    if (workflowData.industry) {
      const industries = Array.isArray(workflowData.industry) ? workflowData.industry : [workflowData.industry];
      
      industries.forEach(industry => {
        shouldClauses.push(
          { match: { industry: industry } },
          { match: { categories_and_keywords: industry } }
        );
      });
    }
    
    // Add employee count range
    if (workflowData.min_employees || workflowData.max_employees) {
      const rangeFilter = { range: { employees_count: {} } };
      
      if (workflowData.min_employees) {
        rangeFilter.range.employees_count.gte = parseInt(workflowData.min_employees);
      }
      
      if (workflowData.max_employees) {
        rangeFilter.range.employees_count.lte = parseInt(workflowData.max_employees);
      }
      
      mustClauses.push(rangeFilter);
    }
    
    // Add size range filter
    if (workflowData.size_range) {
      mustClauses.push({
        match: {
          size_range: workflowData.size_range
        }
      });
    }
    
    // Add founded year range
    if (workflowData.founded_after || workflowData.founded_before) {
      const rangeFilter = { range: { founded_year: {} } };
      
      if (workflowData.founded_after) {
        rangeFilter.range.founded_year.gte = parseInt(workflowData.founded_after);
      }
      
      if (workflowData.founded_before) {
        rangeFilter.range.founded_year.lte = parseInt(workflowData.founded_before);
      }
      
      mustClauses.push(rangeFilter);
    }
    
    // Build the final query
    const query = { bool: {} };
    
    if (mustClauses.length > 0) {
      query.bool.must = mustClauses;
    }
    
    if (shouldClauses.length > 0) {
      query.bool.should = shouldClauses;
      query.bool.minimum_should_match = 1;
    }
    
    // If no specific filters, create a default technology-focused query
    if (mustClauses.length === 0 && shouldClauses.length === 0) {
      console.log('No specific data provided, using default natural language query');
      return {
        query_string: {
          query: "technology companies software",
          default_operator: "OR"
        }
      };
    }
    
    console.log('Generated structured query:', JSON.stringify(query, null, 2));
    return query;
  }
  
  /**
   * Select appropriate keys based on workflow data and schema
   */
  selectKeys(workflowData, propSchema, toolName = '') {
    // If keys are specified in workflow data
    if (workflowData.keys && Array.isArray(workflowData.keys)) {
      return workflowData.keys;
    }
    
    // Use schema default if available
    if (propSchema.default && Array.isArray(propSchema.default)) {
      return propSchema.default;
    }
    
    // Default keys based on tool type
    if (toolName.includes('employee')) {
      return [
        "id",
        "full_name",
        "first_name",
        "last_name",
        "headline",
        "location_full",
        "location_country",
        "active_experience_title",
        "active_experience_company_id",
        "linkedin_url",
        "is_working",
        "connections_count",
        "experience",
        "education"
      ];
    }
    
    if (toolName.includes('company')) {
      return [
        "id",
        "company_name",
        "industry",
        "description",
        "website",
        "employees_count",
        "size_range",
        "hq_country",
        "hq_full_address",
        "hq_city",
        "hq_state",
        "founded_year",
        "type",
        "professional_network_url",
        "categories_and_keywords",
        "is_public",
        "revenue_annual"
      ];
    }
    
    if (toolName.includes('job')) {
      return [
        "id",
        "title",
        "description",
        "company_name",
        "company_id",
        "location",
        "employment_type",
        "seniority",
        "salary",
        "time_posted",
        "url",
        "company_url"
      ];
    }
    
    // Generic default keys for unknown tools
    return [
      "id",
      "company_name",
      "industry",
      "description",
      "website",
      "employees_count",
      "hq_country",
      "revenue_annual",
      "full_name",
      "headline",
      "location_full"
    ];
  }
  

  
  /**
   * Prepare arguments when no schema is available
   */
  prepareGenericArguments(workflowData, toolName = '') {
    console.log('Using generic arguments preparation for tool:', toolName);
    console.log('Workflow data:', JSON.stringify(workflowData, null, 2));
    
    const args = {
      limit: workflowData.limit || 10
    };
    
    // Handle natural language queries
    if (workflowData.naturalQuery || workflowData.natural_query || workflowData.query_text) {
      const naturalQuery = workflowData.naturalQuery || workflowData.natural_query || workflowData.query_text;
      console.log('Using natural language query:', naturalQuery);
      
      // For natural language, use simple string query or query_string format
      if (toolName.includes('coresignal')) {
        // Coresignal supports query_string format
        args.query = {
          query_string: {
            query: naturalQuery,
            default_operator: "AND"
          }
        };
      } else {
        // For other tools, pass as simple string
        args.query = naturalQuery;
      }
    }
    // Handle simple string queries
    else if (workflowData.query && typeof workflowData.query === 'string') {
      console.log('Using string query as natural language:', workflowData.query);
      
      if (toolName.includes('coresignal')) {
        args.query = {
          query_string: {
            query: workflowData.query,
            default_operator: "AND"
          }
        };
      } else {
        args.query = workflowData.query;
      }
    }
    // Handle structured queries
    else if (workflowData.query && typeof workflowData.query === 'object') {
      console.log('Using provided object query');
      args.query = workflowData.query;
    }
    // Build query from structured data
    else {
      console.log('Building query from structured workflow data');
      args.query = this.createStructuredQuery(workflowData);
    }
    
    // Add keys based on tool type
    args.keys = workflowData.keys || this.selectKeys(workflowData, {}, toolName);
    
    // Add tool-specific arguments
    if (toolName.includes('employee')) {
      // Employee-specific arguments
      if (workflowData.company_id) {
        args.company_id = workflowData.company_id;
      }
      if (workflowData.is_working !== undefined) {
        args.is_working = workflowData.is_working;
      }
    } else if (toolName.includes('job')) {
      // Job-specific arguments
      if (workflowData.company_id) {
        args.company_id = workflowData.company_id;
      }
      if (workflowData.application_active !== undefined) {
        args.application_active = workflowData.application_active;
      }
    } else if (toolName.includes('company')) {
      // Company-specific arguments - query is already handled above
      if (workflowData.is_public !== undefined) {
        args.is_public = workflowData.is_public;
      }
    }
    
    console.log('Generated arguments:', JSON.stringify(args, null, 2));
    return args;
  }



  /**
   * Initialize MCP client with proper configuration
   */
  async initializeMcpClient(mcpManager, connectionConfig) {
    try {
      // Check if already connected to the same server
      if (mcpManager.isReady() && mcpManager.getCurrentConnectionUrl && 
          mcpManager.getCurrentConnectionUrl() === connectionConfig.url) {
        console.log('MCP client already connected to the same server');
        return;
      }
      
      console.log('Initializing MCP client with config:', JSON.stringify(connectionConfig, null, 2));
      await mcpManager.initialize(connectionConfig);
      
    } catch (error) {
      console.error('MCP client initialization error:', error);
      throw new Error(`MCP client initialization failed: ${error.message}`);
    }
  }

  /**
   * Execute MCP tool to get data
   */
  async executeMcpTool(mcpManager, configuredToolName, workflowData) {
    try {
      // Get available tools
      const availableTools = await mcpManager.getAvailableTools();
      console.log('Available tools:', availableTools.map(t => t.name).join(', '));
      
      if (availableTools.length === 0) {
        throw new Error('No MCP tools available from the server');
      }

      // Select tool to use
      const selectedTool = this.selectTool(configuredToolName, availableTools);
      console.log(`Selected tool: ${selectedTool.name}`);
      
      // Prepare tool arguments
      const toolArgs = this.prepareGenericArguments(workflowData, selectedTool.name);
      console.log(`Tool arguments for ${selectedTool.name}:`, JSON.stringify(toolArgs, null, 2));
      
      // Execute the MCP tool call
      const result = await mcpManager.callTool(selectedTool.name, toolArgs);
      console.log("MCP tool result:", JSON.stringify(result, null, 2));
      
      return result;
      
    } catch (error) {
      console.error('MCP tool execution error:', error);
      throw new Error(`MCP tool execution failed: ${error.message}`);
    }
  }

  /**
   * Execute MCP chat for additional insights
   */
  async executeMcpChat(mcpManager, toolResult, workflowData) {
    try {
      console.log('Sending chat message to MCP server for additional information...');
      
      // Create a chat message based on the tool results
      const chatMessage = this.createChatMessage(toolResult, workflowData);
      console.log('Chat message:', chatMessage);
      
      // Check if MCP client supports chat
      if (typeof mcpManager.sendMessage === 'function') {
        const chatResult = await mcpManager.sendMessage(chatMessage);
        console.log('Chat execution completed, result:', JSON.stringify(chatResult, null, 2));
        
        return {
          success: true,
          chatResponse: chatResult,
          chatMessage: chatMessage
        };
      } else {
        console.log('MCP client does not support chat, skipping chat interaction');
        return {
          success: false,
          chatResponse: null,
          chatMessage: chatMessage,
          error: 'Chat not supported by MCP client'
        };
      }
      
    } catch (error) {
      console.error('Chat execution error:', error);
      return {
        success: false,
        chatResponse: null,
        chatMessage: '',
        error: error.message
      };
    }
  }

  /**
   * Select the appropriate tool to use
   */
  selectTool(configuredToolName, availableTools) {
    if (availableTools.length === 0) {
      throw new Error('No MCP tools available');
    }
    
    // If a specific tool is configured, try to find it
    if (configuredToolName) {
      const tool = availableTools.find(t => t.name === configuredToolName);
      if (tool) {
        console.log(`Using configured tool: ${configuredToolName}`);
        return tool;
      }
      console.warn(`Configured tool '${configuredToolName}' not found. Available: ${availableTools.map(t => t.name).join(', ')}`);
    }
    
    // Smart selection based on available tools
    // Prefer employee/company search tools for CoreSignal
    const preferredTools = [
      'coresignal_employee_multisource_api',
      'coresignal_company_multisource_api',
      'coresignal_job_api'
    ];
    
    for (const preferredTool of preferredTools) {
      const tool = availableTools.find(t => t.name === preferredTool);
      if (tool) {
        console.log(`Using preferred tool: ${preferredTool}`);
        return tool;
      }
    }
    
    // Fallback to first available tool
    console.log(`Using first available tool: ${availableTools[0].name}`);
    return availableTools[0];
  }
}

module.exports = AgentNodeExecutor;