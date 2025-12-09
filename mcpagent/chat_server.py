#!/usr/bin/env python3
"""
FastAPI server for CoreSignal MCP Agent
Converts the MCP agent into REST API endpoints for external query processing
"""
import asyncio
import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from contextlib import asynccontextmanager
import dotenv
dotenv.load_dotenv()
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field


from google.genai import types
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService

# Import your agent
from agent import root_agent


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Request/Response Models
class QueryRequest(BaseModel):
    query: str = Field(..., description="The query to process", min_length=1)
    session_id: Optional[str] = Field(None, description="Optional session ID for conversation continuity")
    user_id: Optional[str] = Field("default_user", description="User identifier")
    timeout: Optional[int] = Field(30, description="Request timeout in seconds", ge=5, le=120)
    max_events: Optional[int] = Field(100, description="Maximum events to process", ge=1, le=500)


class StatusResponse(BaseModel):
    status: str
    uptime: float
    active_sessions: int
    version: str = "1.0.0"

# Global state management
class AppState:
    def __init__(self):
        self.session_service = None
        self.artifacts_service = None
        self.runner = None
        self.active_sessions: Dict[str, Any] = {}
        self.start_time = datetime.now()
        self.shutdown_requested = False

app_state = AppState()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    logger.info("🚀 Starting CoreSignal MCP API Server...")
    
    try:
        # Initialize services
        app_state.session_service = InMemorySessionService()
        app_state.artifacts_service = InMemoryArtifactService()
        
        # Create runner
        app_state.runner = Runner(
            app_name='coresignal_api_server',
            agent=root_agent,
            artifact_service=app_state.artifacts_service,
            session_service=app_state.session_service,
        )
        
        logger.info("✅ CoreSignal MCP Agent initialized successfully")
        yield
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize services: {e}")
        raise
    finally:
        logger.info("🛑 Shutting down CoreSignal MCP API Server...")
        app_state.shutdown_requested = True
        
        # Cleanup
        try:
            import gc
            gc.collect()
            await asyncio.sleep(0.1)
        except Exception as e:
            logger.warning(f"⚠️ Cleanup warning: {e}")

# Initialize FastAPI app
app = FastAPI(
    title="CoreSignal MCP API",
    description="REST API for CoreSignal MCP Agent - Company Intelligence Processing",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure as needed for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint with basic info"""
    return {
        "service": "CoreSignal MCP API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health", response_model=StatusResponse)
async def health_check():
    """Health check endpoint"""
    uptime = (datetime.now() - app_state.start_time).total_seconds()
    return StatusResponse(
        status="healthy" if not app_state.shutdown_requested else "shutting_down",
        uptime=uptime,
        active_sessions=len(app_state.active_sessions)
    )

async def process_agent(test_query):
    """Simplified test without complex async context management"""
    
    print("🧪 Simple CoreSignal MCP Agent Test")
    print("="*40)
    
    rule_query = """
        Rule:
            1. Output format should be in JSON
            2. Output should be detailed and comprehensive
            """
    enhanced_query = f"{test_query}\n\n{rule_query}"
    try:
        # Initialize services directly
        session_service = InMemorySessionService()
        artifacts_service = InMemoryArtifactService()
        
        # Create a session
        session = await session_service.create_session(
            state={}, 
            app_name='coresignal_agent_test', 
            user_id='test_user'
        )
        
        # Create runner
        runner = Runner(
            app_name='coresignal_agent_test',
            agent=root_agent,
            artifact_service=artifacts_service,
            session_service=session_service,
        )
        
        print(f"📤 Test Query: {enhanced_query}")
        print("🔄 Processing...")
        
        # Create user message
        content = types.Content(
            role='user',
            parts=[types.Part(text=enhanced_query)]
        )
        
        # Run the agent with shorter timeout
        events_async = runner.run_async(
            session_id=session.id,
            user_id=session.user_id,
            new_message=content
        )
        
        # Collect response with basic iteration
        response_text = ""
        event_count = 0
        max_events = 50  # Limit number of events to process
        
        try:
            async for event in events_async:
                event_count += 1
                if event_count > max_events:
                    print(f"⚠️ Reached maximum events limit ({max_events})")
                    break
                
                if hasattr(event, 'content') and hasattr(event.content, 'parts'):
                    for part in event.content.parts:
                        if hasattr(part, 'text') and part.text is not None:
                            response_text += part.text
        except Exception as e:
            error_msg = str(e)
            if "503" in error_msg or "overloaded" in error_msg.lower():
                print("⚠️ Model is currently overloaded. Please try again in a few moments.")
            else:
                print(f"⚠️ Error during event processing: {e}")
            # Continue with partial response
        finally:
            # Ensure proper cleanup of the async generator
            try:
                if hasattr(events_async, 'aclose'):
                    await events_async.aclose()
            except Exception as cleanup_error:
                # Suppress cleanup errors silently
                pass
            
            # Additional cleanup for MCP client
            try:
                # Force garbage collection to help with cleanup
                import gc
                gc.collect()
            except Exception as gc_error:
                # Suppress garbage collection errors silently
                pass
        
        print("✅ Agent Response:")
        print(response_text or "No response received")
        return response_text
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        # Print only the last few lines of traceback for clarity
        import traceback
        tb_lines = traceback.format_exc().split('\n')
        print("Last error details:")
        for line in tb_lines[-5:]:
            if line.strip():
                print(f"  {line}")

@app.post("/query")
async def process_query(request: QueryRequest):

    logger.info(f"Processing query for user {request.user_id}: {request.query[:100]}...")
    
    try:
        # Process the query
        response_text = await process_agent(request.query)
        
        return {
            "success":True,
            "response":response_text,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error processing query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Main application runner
if __name__ == "__main__":
    import uvicorn
    
    # Configuration
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8001"))
    workers = int(os.getenv("API_WORKERS", "1"))
    
    print(f"🚀 Starting CoreSignal MCP API Server")
    print(f"📍 Host: {host}:{port}")
    print(f"👥 Workers: {workers}")
    print(f"📚 Docs: http://{host}:{port}/docs")
    
    uvicorn.run(
        "chat_server:app",  # Adjust if your file is named differently
        host=host,
        port=port,
        workers=workers,
        reload=False,  # Set to True for development
        log_level="info"
    )
