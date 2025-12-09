// Use dynamic import for ES module
let MCPClient;

async function loadMCPClient() {
  if (!MCPClient) {
    const mcpModule = await import('mcp-client');
    MCPClient = mcpModule.MCPClient;
  }
  return MCPClient;
}

class MCPClientManager {
  constructor() {
    this.mcpClient = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 3;
    this.connectionConfig = null;
  }

  async initialize(config) {
    try {
      console.log('Initializing MCP Client with config:', JSON.stringify(config, null, 2));
      
      // Load MCPClient dynamically
      const MCPClientClass = await loadMCPClient();
      
      // Create new client instance each time to ensure clean state
      this.mcpClient = new MCPClientClass({
        name: config.name || 'workflow-agent',
        version: config.version || '1.0.0'
      });
      
      // Reset connection state
      this.isConnected = false;
      this.connectionAttempts = 0;

      // Connect to MCP server
      const serverUrl = config.server || config.url || 'https://mcp.coresignal.com/sse';
      const connectionType = config.type || 'sse';
      console.log(`Connecting to MCP server: ${serverUrl} using ${connectionType}`);
      
      // Prepare connection configuration for remote MCP server
      const connectionConfig = {
        type: connectionType,
        url: serverUrl
      };
      
      // Handle credentials and headers
      if (config.credentials) {
        if (config.credentials.headers) {
          // Add headers to connection config
          connectionConfig.headers = config.credentials.headers;
          
          // If we have an API key in headers, also try adding it to the URL as a fallback
          if (config.credentials.headers.apikey) {
            try {
              const urlWithApiKey = new URL(serverUrl);
              urlWithApiKey.searchParams.set('apikey', config.credentials.headers.apikey);
              connectionConfig.url = urlWithApiKey.toString();
              console.log('Added API key to URL as query parameter:', connectionConfig.url);
            } catch (error) {
              console.warn('Could not add API key to URL:', error.message);
              // Keep original URL if we can't modify it
            }
          }
          
          // Also ensure the API key is in the main headers object for SSE connections
          if (!connectionConfig.headers) {
            connectionConfig.headers = {};
          }
          connectionConfig.headers.apikey = config.credentials.headers.apikey;
        }
        // Add other credentials properties
        Object.keys(config.credentials).forEach(key => {
          if (key !== 'headers') {
            connectionConfig[key] = config.credentials[key];
          }
        });
      }
      
      console.log('Connection config:', JSON.stringify(connectionConfig, null, 2));
      
      // Store the connection config for later use
      this.connectionConfig = connectionConfig;
      
      // Also store the original credentials structure for tool calls
      if (config.credentials) {
        this.connectionConfig.credentials = config.credentials;
      }
      
      console.log('Final stored connection config:', JSON.stringify(this.connectionConfig, null, 2));
      
      // Connect to remote MCP server
      // For SSE connections, we need to ensure headers are properly set
      if (connectionConfig.type === 'sse') {
        // Prepare SSE connection config with headers
        const sseConfig = {
          type: connectionConfig.type,
          url: connectionConfig.url
        };
        
        // Add headers if available
        if (connectionConfig.headers) {
          sseConfig.headers = connectionConfig.headers;
        } else if (connectionConfig.credentials && connectionConfig.credentials.headers) {
          sseConfig.headers = connectionConfig.credentials.headers;
        }
        
        // Ensure API key is in connection headers
        const apiKey = config.credentials?.headers?.apikey || connectionConfig.headers?.apikey;
        if (apiKey && (!sseConfig.headers || !sseConfig.headers.apikey)) {
          if (!sseConfig.headers) {
            sseConfig.headers = {};
          }
          sseConfig.headers.apikey = apiKey;
          console.log('Added API key to SSE connection headers');
        }
        
        console.log('SSE connection config for remote MCP server:', JSON.stringify(sseConfig, null, 2));
        await this.mcpClient.connect(sseConfig);
      } else {
        // For other connection types (websocket, etc.)
        console.log('Standard connection config for remote MCP server:', JSON.stringify(connectionConfig, null, 2));
        await this.mcpClient.connect(connectionConfig);
      }
      console.log("connectionConfig",connectionConfig)
      console.log("this.mcpClient",this.mcpClient)
      this.isConnected = true;
      this.connectionAttempts = 0;
      console.log('✅ Successfully connected to MCP Server');

      // Get available tools
      try {
        const tools = await this.mcpClient.getAllTools();
        console.log('📋 Available MCP Tools:', tools.map(t => t.name));
      } catch (toolError) {
        console.warn('⚠️ Could not fetch available tools:', toolError.message);
      }
 
      return true;
    } catch (error) {
      this.connectionAttempts++;
      console.error(`❌ Failed to initialize MCP Client (attempt ${this.connectionAttempts}/${this.maxRetries}):`, error.message);
      this.isConnected = false;
      
      if (this.connectionAttempts < this.maxRetries) {
        console.log(`Retrying connection in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.initialize(config);
      }
      
      throw error;
    }
  }

  async callTool(toolName, args = {}) {
    try {
      if (!this.mcpClient || !this.isConnected) {
        throw new Error('MCP Client not connected to remote server');
      }

      console.log(`🔧 Calling remote MCP tool: ${toolName}`);
      console.log(`📤 Tool arguments:`, JSON.stringify(args, null, 2));
      
      // Prepare tool arguments
      let toolArgs = { ...args };
      
      // Check if we need to add API key to tool arguments
      // Some MCP servers require API key in tool arguments even if it's in connection headers
      // For CoreSignal tools, the API key should only be in connection headers, not tool arguments
      const apiKey = this.getApiKey();
      const isCoreSignalTool = toolName.includes('coresignal');
      
      if (apiKey && !toolArgs.apikey && !toolArgs.headers && !isCoreSignalTool) {
        // Try adding API key as a direct argument first (but not for CoreSignal tools)
        toolArgs.apikey = apiKey;
        console.log('Added API key to tool arguments as direct parameter');
      }
      
      console.log('Final tool arguments:', JSON.stringify(toolArgs, null, 2));
      
      // Call remote MCP tool with retry mechanism
      let result;
      try {
        result = await this.mcpClient.callTool({
          name: toolName,
          arguments: toolArgs
        });
      } catch (toolError) {
        console.log('Tool call error:', toolError.message);
        
        // If first attempt fails with API key error, try different approaches
        if (toolError.message && toolError.message.includes('apikey')) {
          console.log('API key error detected, trying alternative approaches...');
          
          // For CoreSignal tools, the API key should only be in connection headers
          if (isCoreSignalTool) {
            console.log('CoreSignal tool detected - API key should only be in connection headers');
            // Try without any API key in tool arguments
            try {
              console.log('Trying CoreSignal tool without API key in tool arguments...');
              const toolArgsWithoutApiKey = { ...args };
              delete toolArgsWithoutApiKey.apikey;
              
              result = await this.mcpClient.callTool({
                name: toolName,
                arguments: toolArgsWithoutApiKey
              });
              console.log('Success with CoreSignal tool without API key in tool arguments');
              return result;
            } catch (noKeyError) {
              console.log('CoreSignal approach failed:', noKeyError.message);
              throw toolError;
            }
          } else {
            // For non-CoreSignal tools, try different approaches
            // Try approach 1: Add API key as headers in tool arguments
            try {
              console.log('Trying with API key in headers object...');
              const toolArgsWithHeaders = { 
                ...args,
                headers: {
                  apikey: apiKey
                }
              };
              
              result = await this.mcpClient.callTool({
                name: toolName,
                arguments: toolArgsWithHeaders
              });
              console.log('Success with API key in headers object');
              return result;
            } catch (headerError) {
              console.log('Headers approach failed:', headerError.message);
            }
            
            // Try approach 2: Remove API key completely
            try {
              console.log('Trying without API key in tool arguments...');
              const toolArgsWithoutApiKey = { ...args };
              delete toolArgsWithoutApiKey.apikey;
              
              result = await this.mcpClient.callTool({
                name: toolName,
                arguments: toolArgsWithoutApiKey
              });
              console.log('Success without API key in tool arguments');
              return result;
            } catch (noKeyError) {
              console.log('No API key approach failed:', noKeyError.message);
            }
            
            // If all approaches fail, throw the original error
            console.error('All API key approaches failed');
            throw toolError;
          }
        } else {
          throw toolError;
        }
      }

      console.log(`📥 Remote MCP tool ${toolName} result:`, JSON.stringify(result));
      return result;
    } catch (error) {
      console.error(`❌ Error calling remote MCP tool ${toolName}:`, error);
      
      // Try to reconnect if connection was lost
      if (error.message.includes('connection') || error.message.includes('disconnected')) {
        console.log('🔄 Attempting to reconnect to remote MCP server...');
        this.isConnected = false;
        // Note: You might want to reinitialize here if you have the config
      }
      
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.mcpClient && this.isConnected) {
        // Try different disconnect methods
        if (typeof this.mcpClient.disconnect === 'function') {
          await this.mcpClient.disconnect();
        } else if (typeof this.mcpClient.close === 'function') {
          await this.mcpClient.close();
        } else if (this.mcpClient.client && typeof this.mcpClient.client.close === 'function') {
          await this.mcpClient.client.close();
        } else {
          console.log('⚠️ No disconnect method found, marking as disconnected');
        }
        this.isConnected = false;
        console.log('✅ MCP Client disconnected');
      }
    } catch (error) {
      console.error('❌ Error disconnecting MCP client:', error);
      // Don't throw error, just mark as disconnected
      this.isConnected = false;
    }
  }

  isReady() {
    return this.mcpClient && this.isConnected;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      client: this.mcpClient ? 'available' : 'not_available',
      connectionAttempts: this.connectionAttempts
    };
  }

  getCurrentConnectionUrl() {
    if (this.connectionConfig && this.connectionConfig.url) {
      return this.connectionConfig.url;
    }
    return null;
  }

  // Helper method to get available tools from remote MCP server
  async getAvailableTools() {
    try {
      if (!this.mcpClient || !this.isConnected) {
        throw new Error('MCP Client not connected to remote server');
      }
      return await this.mcpClient.getAllTools();
    } catch (error) {
      console.error('Error getting available tools from remote MCP server:', error);
      throw error;
    }
  }

  // Helper method to get API key from stored configuration
  getApiKey() {
    if (this.connectionConfig && this.connectionConfig.credentials && this.connectionConfig.credentials.headers) {
      return this.connectionConfig.credentials.headers.apikey;
    } else if (this.connectionConfig && this.connectionConfig.headers) {
      return this.connectionConfig.headers.apikey;
    }
    return null;
  }
}

// Create a singleton instance
const mcpClientManager = new MCPClientManager();

module.exports = mcpClientManager; 