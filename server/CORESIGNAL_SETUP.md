# CoreSignal MCP Integration Setup Guide

## Problem
The error `"apikey header is required"` occurs when the CoreSignal MCP server doesn't receive the API key in the connection headers.

## Solution

### 1. Set up the API Key

#### Option A: Environment Variable (Recommended)
1. Edit `server/.env` file
2. Replace the placeholder value:
   ```
   CORESIGNAL_API_KEY=your_actual_api_key_here
   ```
3. Restart the server

#### Option B: MCP Configuration
When configuring MCP agents in workflows, use this template:

```json
{
  "mcpServers": {
    "coresignal": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-coresignal",
        "--header",
        "apikey:${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "your_actual_api_key_here"
      }
    }
  }
}
```

### 2. How the Fix Works

The system now includes several fallback mechanisms:

1. **MCP Configuration**: Uses API key from `mcpServers.coresignal.env.AUTH_HEADER`
2. **Environment Variable**: Falls back to `CORESIGNAL_API_KEY` environment variable
3. **Header Extraction**: Automatically extracts API key from connection headers
4. **Tool Argument Prevention**: Prevents API key from being passed as tool arguments for CoreSignal tools

### 3. Testing

Run the test script to verify the setup:
```bash
cd server
node test-coresignal-fix.js
```

### 4. Debugging

If you still get errors, check the server logs for:
- Connection headers being set correctly
- API key being extracted properly
- Tool arguments not containing the API key

### 5. Common Issues

1. **"unexpected_keyword_argument"**: API key is being passed as tool argument (fixed)
2. **"apikey header is required"**: API key not in connection headers (check configuration)
3. **Invalid API key**: Check if the API key is correct and active

### 6. MCP Configuration in Workflow Builder

1. Open the workflow builder
2. Add an MCP agent node
3. Click "Generate CoreSignal Config" button
4. Replace `your_coresignal_api_key_here` with your actual API key
5. Save the configuration

## Files Modified

- `server/utils/mcpClient.js`: Added CoreSignal tool detection and API key handling
- `server/utils/nodeExecutors/AgentNodeExecutor.js`: Added environment variable fallback
- `admin/src/components/WorkflowBuilder/McpDetailsModal.tsx`: Added CoreSignal config generator
- `server/test-coresignal-fix.js`: Test script for verification
- `server/setup-coresignal.js`: Setup helper script 