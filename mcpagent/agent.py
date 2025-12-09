import os
from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, SseConnectionParams

def create_coresignal_agent():
    """Creates an agent with CoreSignal MCP tools."""
    
    # CoreSignal API key
    api_key = "MxoA5PNPglG4Gvstfch49iHiDA7xJdQM"
    if not api_key:
        raise ValueError("API key is required")
    
    # Create MCP toolset for CoreSignal using SseConnectionParams
    toolset = MCPToolset(
        connection_params=SseConnectionParams(
            url="https://mcp.coresignal.com/sse",
            headers={"apikey": api_key}
        )
    )

    print('toolset', toolset)
    
    # Create the agent with CoreSignal tools
    agent = LlmAgent(
        model="gemini-2.0-flash",
        name="coresignal_business_intelligence_agent",
        instruction=(
            "You are a business intelligence assistant with access to CoreSignal data. "
            "You can help users find information about companies, employees, and jobs. "
            "Use the available CoreSignal tools to provide accurate business intelligence data. "
            "Always explain what data you're retrieving and format your responses clearly."

        ),
        tools=[toolset],
    )
    
    return agent

# Create the root agent
root_agent = create_coresignal_agent()