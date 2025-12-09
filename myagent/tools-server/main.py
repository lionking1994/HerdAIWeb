from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from datetime import datetime, timedelta
import psycopg2
from pinecone import Pinecone
import openai
from dotenv import load_dotenv
import asyncio
import concurrent.futures
from functools import partial
import json
import aiohttp
import time
from simple_salesforce import Salesforce

# Load environment variables
load_dotenv()

app = FastAPI(title="Meetings Search Tool Server", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Static API key - in production, use environment variables
API_KEY = os.getenv("API_KEY", "your-secret-api-key-here")
X_API_KEY = os.getenv("REST_API_KEY", "your-x-api-key-here")
RECALL_API_KEY = os.getenv("RECALL_API_KEY", "your-recall-api-key-here")
API_BASE_URL = os.getenv("API_BASE_URL", "https://app.getherd.ai/api")

# Database configuration from environment variables
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'postgres'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', '')
}

# Request/Response models
class MeetingSearchRequest(BaseModel):
    user_id: str
    query: str
    top_k: Optional[int] = 10  # Default to 10 if not provided

class MeetingInfo(BaseModel):
    meeting_id: str
    title: str
    summary: str  # Always include summary (generated if needed)
    datetime: str
    similarity_score: float

class MeetingSearchResponse(BaseModel):
    status: str
    meetings: List[MeetingInfo]
    total_found: int
    timestamp: str

class ResearchDocumentsRequest(BaseModel):
    user_id: str

class ResearchDocumentsResponse(BaseModel):
    status: str
    documents: List[Dict[str, Any]]

class GetAttendeesRequest(BaseModel):
    meeting_id: str

class UserProfile(BaseModel):
    id: str
    email: str
    education: Optional[str] = None
    certifications: Optional[str] = None
    skills: Optional[str] = None
    projects: Optional[str] = None
    publications: Optional[str] = None
    recommendations: Optional[str] = None
    role: Optional[str] = None
    name: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None

class GetAttendeesResponse(BaseModel):
    status: str
    attendees: List[UserProfile]
    total_found: int
    timestamp: str

class GetUserInfoRequest(BaseModel):
    user_id: str

class GetUserInfoResponse(BaseModel):
    status: str
    user: Optional[UserProfile] = None
    timestamp: str

class GetCompanyUsersRequest(BaseModel):
    user_email: str

class CompanyUser(BaseModel):
    user_id: str
    user_name: str
    user_email: str

class GetCompanyUsersResponse(BaseModel):
    status: str
    company_users: List[CompanyUser]
    total_found: int
    timestamp: str

class ResearchRequest(BaseModel):
    user_email: str
    topic: str
    agent_meeting_id: int
    token: str

class ResearchResponse(BaseModel):
    success: bool
    message: str
    research_id: Optional[str] = None

# Salesforce-related models
class SalesforceCredentials(BaseModel):
    username: str
    password: str
    security_token: str
    is_sandbox: bool = False

class SalesforceQueryRequest(BaseModel):
    credentials: SalesforceCredentials
    soql_query: str

class SalesforceQueryResponse(BaseModel):
    success: bool
    data: List[Dict[str, Any]]
    total_size: int
    message: Optional[str] = None

class SalesforceAccountOverviewRequest(BaseModel):
    credentials: SalesforceCredentials
    account_name: Optional[str] = None
    account_id: Optional[str] = None

class SalesforceAccountOverviewResponse(BaseModel):
    success: bool
    account_info: Dict[str, Any]
    open_opportunities: List[Dict[str, Any]]
    total_pipeline_value: float
    longest_open_opportunity: Dict[str, Any]
    message: Optional[str] = None

class SalesforceGenerateSOQLRequest(BaseModel):
    credentials: SalesforceCredentials
    user_query: str

class SalesforceGenerateSOQLResponse(BaseModel):
    success: bool
    generated_soql: str
    explanation: str
    data: Optional[List[Dict[str, Any]]] = None
    message: Optional[str] = None

# Authentication dependency
async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key"
        )
    return x_api_key

# Global variables for services
pinecone_client = None
pinecone_index = None
openai_client = None

def initialize_services():
    """Initialize Pinecone and OpenAI clients"""
    global pinecone_client, pinecone_index, openai_client
    
    try:
        # Initialize Pinecone
        pinecone_client = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
        index_name = os.getenv('PINECONE_INDEX_NAME', 'meetings-history')
        pinecone_index = pinecone_client.Index(index_name)
        
        # Initialize OpenAI
        openai_client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        print("Services initialized successfully")
        
    except Exception as e:
        print(f"Error initializing services: {e}")
        raise

def get_embedding(text: str) -> List[float]:
    """Get embedding vector for text using OpenAI"""
    try:
        response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error getting embedding: {e}")
        raise

def generate_summary_with_gpt(meeting_id: int, title: str, transcription_link: str) -> Dict[str, Any]:
    """Generate summary using GPT-4o-mini when summary is missing"""
    try:
        prompt = f"""
        Please create a concise summary covering the main topics and key points discussed, who said what and etc for this meeting:
        
        Title: {title}
        Transcription: {transcription_link}
        """
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        summary = response.choices[0].message.content.strip()
        return {
            'meeting_id': meeting_id,
            'summary': summary,
            'success': True
        }
        
    except Exception as e:
        print(f"Error generating summary for meeting {meeting_id}: {e}")
        return {
            'meeting_id': meeting_id,
            'summary': f"Meeting about {title} - Summary generation failed",
            'success': False
        }

async def generate_summaries_parallel(meetings_needing_summaries: List[Dict[str, Any]]) -> Dict[int, str]:
    """Generate summaries for multiple meetings in parallel"""
    if not meetings_needing_summaries:
        return {}
    
    print(f"Generating summaries for {len(meetings_needing_summaries)} meetings in parallel...")
    
    # Create a thread pool executor for parallel execution
    loop = asyncio.get_event_loop()
    
    # Create partial functions for each meeting
    tasks = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        for meeting in meetings_needing_summaries:
            task = loop.run_in_executor(
                executor,
                generate_summary_with_gpt,
                meeting['id'],
                meeting['title'],
                meeting['transcription_link']
            )
            tasks.append(task)
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results
    summary_map = {}
    successful_summaries = []
    
    for result in results:
        if isinstance(result, Exception):
            print(f"Exception in summary generation: {result}")
            continue
            
        if result['success']:
            summary_map[result['meeting_id']] = result['summary']
            successful_summaries.append({
                'meeting_id': result['meeting_id'],
                'summary': result['summary']
            })
    
    # Batch update database with generated summaries
    if successful_summaries:
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()
            
            # Batch update using executemany
            update_query = "UPDATE meetings SET summary = %s WHERE id = %s"
            update_data = [(summary['summary'], summary['meeting_id']) for summary in successful_summaries]
            
            cursor.executemany(update_query, update_data)
            conn.commit()
            cursor.close()
            conn.close()
            
            print(f"Successfully updated {len(successful_summaries)} meeting summaries in database")
            
        except Exception as e:
            print(f"Failed to batch update summaries in database: {e}")
    
    return summary_map

async def fetch_meeting_details_from_db(meeting_ids: List[str]) -> List[Dict[str, Any]]:
    """Fetch meeting details from PostgreSQL by meeting IDs with parallel summary generation"""
    if not meeting_ids:
        return []
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Create placeholders for the IN clause
        placeholders = ','.join(['%s'] * len(meeting_ids))
        
        query = f"""
        SELECT id, title, summary, transcription_link, datetime
        FROM meetings
        WHERE id IN ({placeholders})
        ORDER BY datetime DESC
        """
        
        cursor.execute(query, meeting_ids)
        rows = cursor.fetchall()
        
        # First pass: identify meetings needing summaries
        meetings_needing_summaries = []
        all_meetings_data = []
        
        for row in rows:
            meeting_data = {
                'id': row[0],
                'title': row[1] or '',
                'summary': (row[2] or '').strip(),
                'transcription_link': row[3] or '',
                'datetime': row[4]
            }
            all_meetings_data.append(meeting_data)
            
            # Check if summary generation is needed
            if not meeting_data['summary'] and meeting_data['title'] and meeting_data['transcription_link']:
                meetings_needing_summaries.append(meeting_data)
        
        cursor.close()
        conn.close()
        
        # Generate summaries in parallel if needed
        generated_summaries = {}
        if meetings_needing_summaries:
            generated_summaries = await generate_summaries_parallel(meetings_needing_summaries)
        
        # Prepare final meetings list with summaries
        meetings = []
        for meeting_data in all_meetings_data:
            # Use generated summary if available, otherwise use existing or fallback
            if meeting_data['id'] in generated_summaries:
                summary = generated_summaries[meeting_data['id']]
            else:
                summary = meeting_data['summary'] or f"Meeting about {meeting_data['title']}"
            
            meeting = {
                'id': meeting_data['id'],
                'title': meeting_data['title'],
                'summary': summary,
                'datetime': meeting_data['datetime']
            }
            meetings.append(meeting)
        
        return meetings
        
    except Exception as e:
        print(f"Error fetching meeting details from database: {e}")
        raise

def safe_str(val):
    if isinstance(val, (list, dict)):
        return json.dumps(val)
    return val if val is not None else ""

# Initialize services on startup
@app.on_event("startup")
async def startup_event():
    initialize_services()

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Meetings Search Tool Server is running"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "meetings-search-tool-server"}

@app.post("/search-meetings", response_model=MeetingSearchResponse)
async def search_meetings(
    request: MeetingSearchRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Search for meetings that a specific user attended based on a query.
    Returns meeting details from PostgreSQL for matching meetings.
    """
    try:
        # Check if services are initialized
        if not pinecone_index or not openai_client:
            raise HTTPException(
                status_code=500,
                detail="Services not properly initialized"
            )
        
        # Get embedding for the search query
        query_embedding = get_embedding(request.query)
        
        # Search in Pinecone with user filter and dynamic top_k
        results = pinecone_index.query(
            vector=query_embedding,
            filter={'users': {'$in': [request.user_id]}},  # Filter by user_id in users array
            top_k=request.top_k,  # Use top_k from request
            include_metadata=True
        )
        
        if not results.matches:
            return MeetingSearchResponse(
                status="success",
                meetings=[],
                total_found=0,
                timestamp=datetime.utcnow().isoformat() + "Z"
            )
        
        # Extract unique meeting IDs from results
        meeting_ids = list(set([match.metadata['meeting_id'] for match in results.matches]))
        
        # Fetch full meeting details from PostgreSQL (with parallel summary generation)
        meeting_details = await fetch_meeting_details_from_db(meeting_ids)
        
        # Create meeting info objects with similarity scores
        meetings_info = []
        meeting_scores = {}
        
        # Map similarity scores by meeting_id (use highest score if multiple parts)
        for match in results.matches:
            meeting_id = match.metadata['meeting_id']
            if meeting_id not in meeting_scores or match.score > meeting_scores[meeting_id]:
                meeting_scores[meeting_id] = match.score
        
        for meeting in meeting_details:
            meeting_info = MeetingInfo(
                meeting_id=str(meeting['id']),
                title=meeting['title'],
                summary=meeting['summary'],  # Include summary (generated if needed)
                datetime=meeting['datetime'].isoformat() if meeting['datetime'] else '',
                similarity_score=meeting_scores.get(str(meeting['id']), 0.0)
            )
            meetings_info.append(meeting_info)
        
        # Sort by similarity score (highest first)
        meetings_info.sort(key=lambda x: x.similarity_score, reverse=True)
        
        return MeetingSearchResponse(
            status="success",
            meetings=meetings_info,
            total_found=len(meetings_info),
            timestamp=datetime.utcnow().isoformat() + "Z"
        )
        
    except Exception as e:
        print(f"Error searching meetings: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error searching meetings: {str(e)}"
        )

@app.post("/get-research-documents", response_model=ResearchDocumentsResponse)
async def get_research_documents(
    request: ResearchDocumentsRequest,
    api_key: str = Depends(verify_api_key)
):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # First get the user's email
        cursor.execute("SELECT email FROM users WHERE id = %s", (request.user_id,))
        user_result = cursor.fetchone()
        
        if not user_result:
            raise HTTPException(status_code=404, detail="User not found")
            
        user_email = user_result[0]
        email_domain = user_email.split('@')[1]
        
        # Get documents from the last 30 days with matching domain
        thirty_days_ago = datetime.now() - timedelta(days=30)
        
        cursor.execute("""
            SELECT id, topic 
            FROM research_requests 
            WHERE user_email LIKE %s 
            AND created_at >= %s
            ORDER BY created_at DESC
        """, (f'%@{email_domain}', thirty_days_ago))
        
        seen_topics = set()
        documents = []
        for row in cursor.fetchall():
            topic = row[1]
            if topic not in seen_topics:
                documents.append({"id": str(row[0]), "title": topic})
                seen_topics.add(topic)
        
        cursor.close()
        conn.close()
        
        return {
            "status": "success",
            "documents": documents
        }
        
    except Exception as e:
        print(f"Error fetching research documents: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching research documents: {str(e)}"
        )

@app.post("/get-attendees", response_model=GetAttendeesResponse)
async def get_attendees(
    request: GetAttendeesRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Get user profiles for all attendees in a specific meeting.
    """
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Execute the query to get attendees
        query = """
        SELECT 
            u.id,
            u.email,
            u.education,
            u.certifications,
            u.skills,
            u.projects,
            u.publications,
            u.recommendations,
            mp.role,
            CASE 
                WHEN u.name != u.email THEN u.name 
            END AS name,
            CASE 
                WHEN u.location != 'xxxxx' THEN u.location 
            END AS location,
            CASE 
                WHEN u.bio != 'I am using agent' THEN u.bio 
            END AS bio,
            CASE 
                WHEN u.phone != '1234567' THEN u.phone 
            END AS phone
        FROM users u
        INNER JOIN meeting_participants mp ON u.id = mp.user_id
        WHERE mp.meeting_id = %s
        ORDER BY COALESCE(u.name, u.email);
        """
        
        cursor.execute(query, (request.meeting_id,))
        rows = cursor.fetchall()
        
        # Convert rows to UserProfile objects
        attendees = []
        for row in rows:
            user_profile = UserProfile(
                id=str(row[0]),
                email=row[1],
                education=safe_str(row[2]),
                certifications=safe_str(row[3]),
                skills=row[4],
                projects=safe_str(row[5]),
                publications=safe_str(row[6]),
                recommendations=safe_str(row[7]),
                role=row[8],
                name=row[9],
                location=row[10],
                bio=row[11],
                phone=row[12]
            )
            attendees.append(user_profile)
        
        cursor.close()
        conn.close()
        
        return GetAttendeesResponse(
            status="success",
            attendees=attendees,
            total_found=len(attendees),
            timestamp=datetime.utcnow().isoformat() + "Z"
        )
        
    except Exception as e:
        print(f"Error fetching attendees: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching attendees: {str(e)}"
        )

@app.post("/get-user-info", response_model=GetUserInfoResponse)
async def get_user_info(
    request: GetUserInfoRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Get user profile information by user ID.
    """
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Execute the query to get user information
        query = """
        SELECT 
            u.id,
            u.email,
            u.education,
            u.certifications,
            u.skills,
            u.projects,
            u.publications,
            u.recommendations,
            NULL as role,
            CASE 
                WHEN u.name != u.email THEN u.name 
            END AS name,
            CASE 
                WHEN u.location != 'xxxxx' THEN u.location 
            END AS location,
            CASE 
                WHEN u.bio != 'I am using agent' THEN u.bio 
            END AS bio,
            CASE 
                WHEN u.phone != '1234567' THEN u.phone 
            END AS phone
        FROM users u
        WHERE u.id = %s;
        """
        
        cursor.execute(query, (request.user_id,))
        row = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if not row:
            return GetUserInfoResponse(
                status="success",
                user=None,
                timestamp=datetime.utcnow().isoformat() + "Z"
            )
        
        # Convert row to UserProfile object
        user_profile = UserProfile(
            id=str(row[0]),
            email=row[1],
            education=safe_str(row[2]),
            certifications=safe_str(row[3]),
            skills=row[4],
            projects=safe_str(row[5]),
            publications=safe_str(row[6]),
            recommendations=safe_str(row[7]),
            role=row[8],
            name=row[9],
            location=row[10],
            bio=row[11],
            phone=row[12]
        )
        
        return GetUserInfoResponse(
            status="success",
            user=user_profile,
            timestamp=datetime.utcnow().isoformat() + "Z"
        )
        
    except Exception as e:
        print(f"Error fetching user info: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching user info: {str(e)}"
        )

@app.post("/get-company-users", response_model=GetCompanyUsersResponse)
async def get_company_users(
    request: GetCompanyUsersRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Get all users who are in the same company as the provided user email.
    Users are considered in the same company if they share the same email domain,
    excluding public email domains.
    """
    try:
        # Define public email domains to exclude
        public_domains = {
            'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'aol.com',
            'icloud.com', 'live.com', 'msn.com', 'yandex.com', 'protonmail.com',
            'mail.com', 'zoho.com', 'tutanota.com', 'fastmail.com'
        }
        
        # Extract domain from the user email
        if '@' not in request.user_email:
            raise HTTPException(
                status_code=400,
                detail="Invalid email format"
            )
        
        email_domain = request.user_email.split('@')[1].lower()
        
        # Check if it's a public domain
        if email_domain in public_domains:
            return GetCompanyUsersResponse(
                status="success",
                company_users=[],
                total_found=0,
                timestamp=datetime.utcnow().isoformat() + "Z"
            )
        
        # Connect to database and query for users with same domain
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Query to get users with the same email domain
        query = """
        SELECT 
            u.id,
            CASE 
                WHEN u.name != u.email AND u.name IS NOT NULL THEN u.name 
                ELSE u.email
            END AS display_name,
            u.email
        FROM users u
        WHERE LOWER(u.email) LIKE %s
        ORDER BY u.email;
        """
        
        domain_pattern = f'%@{email_domain}'
        cursor.execute(query, (domain_pattern,))
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Convert rows to CompanyUser objects
        company_users = []
        for row in rows:
            company_user = CompanyUser(
                user_id=str(row[0]),
                user_name=row[1] or row[2],  # Use display_name or fallback to email
                user_email=row[2]
            )
            company_users.append(company_user)
        
        return GetCompanyUsersResponse(
            status="success",
            company_users=company_users,
            total_found=len(company_users),
            timestamp=datetime.utcnow().isoformat() + "Z"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Error fetching company users: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching company users: {str(e)}"
        )

async def handle_research_completion_and_bot_notification(
    request_id: str,
    user_email: str,
    token: str,
    agent_meeting_id: int
):
    """
    Background task to monitor research completion and notify the bot.
    """
    try:
        async with aiohttp.ClientSession() as session:
            # Step 1: Poll for research completion
            status_url = f"{API_BASE_URL}/tasks/get-research-status"
            status_payload = {
                "requestId": request_id,
                "email": user_email
            }
            status_headers = {
                "Authorization": token,
                "Content-Type": "application/json"
            }
            
            max_attempts = 180  # 15 minutes max (5 second intervals)
            attempt = 0
            download_link = None
            
            print(f"Starting background monitoring for research request: {request_id}")
            
            while attempt < max_attempts:
                await asyncio.sleep(5)  # Wait 5 seconds between checks
                attempt += 1
                
                try:
                    async with session.post(
                        status_url,
                        json=status_payload,
                        headers=status_headers
                    ) as response:
                        if response.status != 200:
                            continue  # Keep trying
                        
                        status_result = await response.json()
                        if not status_result.get("success"):
                            continue  # Keep trying
                        
                        status_list = status_result["data"]["status"]
                        if "COMPLETED" in status_list:
                            download_link = status_result["data"]["downloadlink"]
                            print(f"Research completed for request: {request_id}")
                            break
                except Exception as e:
                    print(f"Error checking research status: {e}")
                    continue  # Keep trying
            
            if not download_link:
                print(f"Research completion timeout for request: {request_id}")
                return
            
            # Step 2: Get bot_id from agent_meetings table
            get_meeting_url = f"{API_BASE_URL}/agent/meetings/{agent_meeting_id}"
            get_meeting_headers = {
                "x-api-key": X_API_KEY
            }
            
            try:
                async with session.get(
                    get_meeting_url,
                    headers=get_meeting_headers
                ) as response:
                    if response.status != 200:
                        print(f"Failed to get agent meeting: {await response.text()}")
                        return
                    
                    meeting_result = await response.json()
                    if not meeting_result.get("success"):
                        print("Failed to get agent meeting data")
                        return
                    
                    bot_id = meeting_result["data"]["bot_id"]
                    if not bot_id:
                        print("No bot_id found in agent meeting data")
                        return
            except Exception as e:
                print(f"Error getting agent meeting data: {e}")
                return
            
            # Step 3: Send message to recall.ai bot
            full_download_link = f"{API_BASE_URL}{download_link}"
            bot_message = f"Research is complete. You can download the result here: {full_download_link}"
            
            recall_url = f"https://us-west-2.recall.ai/api/v1/bot/{bot_id}/send_chat_message/"
            recall_payload = {
                "message": bot_message
            }
            recall_headers = {
                "Authorization": RECALL_API_KEY,
                "accept": "application/json",
                "content-type": "application/json"
            }
            
            try:
                async with session.post(
                    recall_url,
                    json=recall_payload,
                    headers=recall_headers
                ) as response:
                    if response.status in [200, 201]:
                        print(f"Successfully notified bot {bot_id} about completed research")
                    else:
                        print(f"Failed to send message to bot: {await response.text()}")
            except Exception as e:
                print(f"Error sending message to recall.ai bot: {e}")
                
    except Exception as e:
        print(f"Error in background research completion handler: {e}")

@app.post("/start-research-with-bot-notification", response_model=ResearchResponse)
async def start_research_with_bot_notification(
    request: ResearchRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Start research and return immediately. Handle completion monitoring and bot notification in background.
    """
    try:
        async with aiohttp.ClientSession() as session:
            # Step 1: Start research
            start_research_url = f"{API_BASE_URL}/tasks/start-research"
            start_research_payload = {
                "topic": request.topic,
                "email": request.user_email
            }
            start_research_headers = {
                "x-api-key": X_API_KEY,
                "Content-Type": "application/json"
            }
            
            async with session.post(
                start_research_url,
                json=start_research_payload,
                headers=start_research_headers
            ) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to start research: {await response.text()}"
                    )
                
                start_research_result = await response.json()
                if not start_research_result.get("success"):
                    raise HTTPException(
                        status_code=500,
                        detail="Research start failed"
                    )
                
                request_id = start_research_result["data"]["requestId"]
            
            # Step 2: Start background task for completion monitoring and bot notification
            asyncio.create_task(handle_research_completion_and_bot_notification(
                request_id,
                request.user_email,
                request.token,
                request.agent_meeting_id
            ))
            
            # Step 3: Return immediately
            return ResearchResponse(
                success=True,
                message="Research started successfully.",
                research_id=request_id
            )
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Error starting research: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start research: {str(e)}"
        )

# Salesforce utility functions
def create_salesforce_connection(credentials: SalesforceCredentials):
    """Create and authenticate Salesforce connection"""
    try:
        # Determine login URL based on environment
        if credentials.is_sandbox:
            domain = 'test'
        else:
            domain = 'login'
        
        # Create connection
        sf = Salesforce(
            username=credentials.username,
            password=credentials.password,
            security_token=credentials.security_token,
            domain=domain
        )
        
        return sf, None
        
    except Exception as e:
        error_message = f"Salesforce connection error: {str(e)}"
        
        # Add more specific context based on common error types
        if 'API_CURRENTLY_DISABLED' in str(e):
            error_message = f"Salesforce API error: {str(e)} Please check your Salesforce org status and API access."
        elif 'INVALID_LOGIN' in str(e):
            error_message = f"Salesforce authentication error: {str(e)} Please verify your username and password."
        elif 'LOGIN_MUST_USE_SECURITY_TOKEN' in str(e):
            error_message = f"Salesforce security error: {str(e)} You may need to append your security token to your password."
        
        return None, error_message

def generate_soql_with_llm(user_query: str) -> tuple[str, str]:
    """Generate SOQL query using OpenAI based on user request"""
    try:
        client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        system_prompt = """You are a Salesforce SOQL query generator. Generate accurate SOQL queries based on user requests.

Common Salesforce objects and fields:
- Account: Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees, BillingAddress, Phone, Website
- Contact: Id, Name, FirstName, LastName, Email, Phone, AccountId, Title, Department
- Opportunity: Id, Name, Amount, StageName, CloseDate, Probability, AccountId, OwnerId, Type, ForecastCategoryName
- Lead: Id, Name, FirstName, LastName, Email, Phone, Company, Status, LeadSource
- Case: Id, CaseNumber, Subject, Status, Priority, AccountId, ContactId, OwnerId
- Task: Id, Subject, Status, Priority, ActivityDate, WhoId, WhatId, OwnerId
- Event: Id, Subject, StartDateTime, EndDateTime, WhoId, WhatId, OwnerId

Guidelines:
1. Always include Id field in SELECT
2. Use proper SOQL syntax
3. For date queries, use SOQL date literals (TODAY, THIS_QUARTER, etc.)
4. Limit results appropriately (usually LIMIT 100 or less)
5. Use proper relationship queries when needed (Account.Name, Owner.Name, etc.)

Generate only the SOQL query, no explanations in the query itself."""

        user_prompt = f"Generate a SOQL query for: {user_query}"
        
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=500,
            temperature=0.1
        )
        
        generated_query = response.choices[0].message.content.strip()
        
        # Generate explanation
        explanation_prompt = f"Explain what this SOQL query does in business terms: {generated_query}"
        explanation_response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": "Explain SOQL queries in simple business terms."},
                {"role": "user", "content": explanation_prompt}
            ],
            max_tokens=200,
            temperature=0.3
        )
        
        explanation = explanation_response.choices[0].message.content.strip()
        
        return generated_query, explanation
        
    except Exception as e:
        return f"SELECT Id FROM Account LIMIT 1", f"Error generating query: {str(e)}"

# Salesforce endpoints
@app.post("/salesforce/query", response_model=SalesforceQueryResponse)
async def salesforce_query(request: SalesforceQueryRequest, api_key: str = Depends(verify_api_key)):
    """Execute a SOQL query against Salesforce"""
    try:
        # Create Salesforce connection
        sf, error = create_salesforce_connection(request.credentials)
        if error:
            print(f"❌ Salesforce connection failed: {error}")
            raise HTTPException(status_code=400, detail=error)
        
        # Execute query
        result = sf.query(request.soql_query)
        
        return SalesforceQueryResponse(
            success=True,
            data=result['records'],
            total_size=result['totalSize'],
            message=f"Query executed successfully. Found {result['totalSize']} records."
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute Salesforce query: {str(e)}"
        )

@app.post("/salesforce/generate-soql", response_model=SalesforceGenerateSOQLResponse)
async def salesforce_generate_soql(request: SalesforceGenerateSOQLRequest, api_key: str = Depends(verify_api_key)):
    """Generate SOQL query using LLM and optionally execute it"""
    try:
        # Generate SOQL query
        generated_query, explanation = generate_soql_with_llm(request.user_query)
        
        # Create Salesforce connection
        sf, error = create_salesforce_connection(request.credentials)
        if error:
            return SalesforceGenerateSOQLResponse(
                success=False,
                generated_soql=generated_query,
                explanation=explanation,
                message=f"Query generated but connection failed: {error}"
            )
        
        try:
            # Execute the generated query
            result = sf.query(generated_query)
            
            return SalesforceGenerateSOQLResponse(
                success=True,
                generated_soql=generated_query,
                explanation=explanation,
                data=result['records'],
                message=f"Query generated and executed successfully. Found {result['totalSize']} records."
            )
            
        except Exception as query_error:
            return SalesforceGenerateSOQLResponse(
                success=False,
                generated_soql=generated_query,
                explanation=explanation,
                message=f"Query generated but execution failed: {str(query_error)}"
            )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate SOQL query: {str(e)}"
        )

@app.post("/salesforce/account-overview", response_model=SalesforceAccountOverviewResponse)
async def salesforce_account_overview(request: SalesforceAccountOverviewRequest, api_key: str = Depends(verify_api_key)):
    """Get comprehensive account overview including opportunities and pipeline"""
    try:
        # Create Salesforce connection
        sf, error = create_salesforce_connection(request.credentials)
        if error:
            raise HTTPException(status_code=400, detail=error)
        
        # Find account
        account_query = ""
        if request.account_id:
            account_query = f"SELECT Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees, Phone, Website, BillingAddress FROM Account WHERE Id = '{request.account_id}'"
        elif request.account_name:
            account_query = f"SELECT Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees, Phone, Website, BillingAddress FROM Account WHERE Name LIKE '%{request.account_name}%' LIMIT 1"
        else:
            raise HTTPException(status_code=400, detail="Either account_id or account_name must be provided")
        
        account_result = sf.query(account_query)
        if not account_result['records']:
            raise HTTPException(status_code=404, detail="Account not found")
        
        account = account_result['records'][0]
        account_id = account['Id']
        
        # Get open opportunities for this account
        opp_query = f"""
            SELECT Id, Name, Amount, StageName, CloseDate, Probability, Owner.Name, Type, ForecastCategoryName, CreatedDate
            FROM Opportunity 
            WHERE AccountId = '{account_id}' 
            AND IsClosed = false 
            ORDER BY CreatedDate ASC
        """
        
        opportunities_result = sf.query(opp_query)
        opportunities = opportunities_result['records']
        
        # Calculate total pipeline value
        total_pipeline = sum(float(opp.get('Amount', 0) or 0) for opp in opportunities)
        
        # Find longest open opportunity
        longest_open_opp = {}
        if opportunities:
            longest_open_opp = min(opportunities, key=lambda x: x['CreatedDate'])
        
        return SalesforceAccountOverviewResponse(
            success=True,
            account_info=account,
            open_opportunities=opportunities,
            total_pipeline_value=total_pipeline,
            longest_open_opportunity=longest_open_opp,
            message=f"Account overview retrieved successfully. {len(opportunities)} open opportunities found."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get account overview: {str(e)}"
        )

@app.post("/salesforce/pipeline-analysis")
async def salesforce_pipeline_analysis(request: SalesforceGenerateSOQLRequest, api_key: str = Depends(verify_api_key)):
    """Analyze sales pipeline data by stage, rep, or time period"""
    try:
        # Create Salesforce connection
        sf, error = create_salesforce_connection(request.credentials)
        if error:
            raise HTTPException(status_code=400, detail=error)
        
        # Generate appropriate pipeline analysis query
        pipeline_queries = {
            "pipeline by stage": """
                SELECT StageName, COUNT(Id) opportunity_count, SUM(Amount) total_value
                FROM Opportunity 
                WHERE IsClosed = false 
                GROUP BY StageName 
                ORDER BY SUM(Amount) DESC
            """,
            "quarterly pipeline": """
                SELECT CALENDAR_QUARTER(CloseDate) quarter, COUNT(Id) opportunity_count, SUM(Amount) total_value
                FROM Opportunity 
                WHERE IsClosed = false AND CloseDate = THIS_YEAR
                GROUP BY CALENDAR_QUARTER(CloseDate) 
                ORDER BY CALENDAR_QUARTER(CloseDate)
            """,
            "rep performance": """
                SELECT Owner.Name, COUNT(Id) opportunity_count, SUM(Amount) total_pipeline
                FROM Opportunity 
                WHERE IsClosed = false 
                GROUP BY Owner.Name 
                ORDER BY SUM(Amount) DESC
                LIMIT 20
            """
        }
        
        # Generate SOQL query based on user request
        generated_query, explanation = generate_soql_with_llm(request.user_query)
        
        # Execute the generated query
        result = sf.query(generated_query)
        
        return {
            "success": True,
            "generated_soql": generated_query,
            "explanation": explanation,
            "data": result['records'],
            "total_size": result['totalSize'],
            "message": f"Pipeline analysis completed successfully. Found {result['totalSize']} records."
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze pipeline: {str(e)}"
        )

@app.post("/salesforce/opportunity-details")
async def salesforce_opportunity_details(request: SalesforceGenerateSOQLRequest, api_key: str = Depends(verify_api_key)):
    """Get detailed information about specific opportunities"""
    try:
        # Create Salesforce connection
        sf, error = create_salesforce_connection(request.credentials)
        if error:
            raise HTTPException(status_code=400, detail=error)
        
        # Generate SOQL for opportunity details
        generated_query, explanation = generate_soql_with_llm(request.user_query)
        
        # Execute the generated query
        result = sf.query(generated_query)
        
        # If specific opportunity requested, get additional details like activities
        opportunities = result['records']
        for opp in opportunities:
            if 'Id' in opp:
                # Get recent activities for this opportunity
                activity_query = f"""
                    SELECT Id, Subject, Status, Priority, ActivityDate, Owner.Name
                    FROM Task 
                    WHERE WhatId = '{opp['Id']}' 
                    ORDER BY ActivityDate DESC 
                    LIMIT 10
                """
                activities = sf.query(activity_query)
                opp['recent_activities'] = activities['records']
        
        return {
            "success": True,
            "generated_soql": generated_query,
            "explanation": explanation,
            "data": opportunities,
            "total_size": result['totalSize'],
            "message": f"Opportunity details retrieved successfully. Found {result['totalSize']} opportunities."
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get opportunity details: {str(e)}"
        )


class SalesforceAgenticRequest(BaseModel):
    credentials: SalesforceCredentials
    user_query: str

class SalesforceAgenticResponse(BaseModel):
    success: bool
    final_result: Dict[str, Any]
    queries_executed: List[str]
    errors_encountered: List[str]
    corrections_made: List[str]
    message: str

# Agentic Salesforce Tool Implementation
# Agentic Salesforce Tool Implementation - FIXED VERSION
# Sequential Reasoning Agentic Salesforce Tool Implementation
async def salesforce_agentic_handler(credentials: SalesforceCredentials, user_query: str) -> SalesforceAgenticResponse:
    """
    Intelligent Salesforce agent with sequential reasoning and step-by-step execution
    """
    print("\n" + "="*80)
    print("🚀 SALESFORCE AGENTIC TOOL STARTED")
    print("="*80)
    print(f"📝 User Query: {user_query}")
    print(f"🔐 Credentials: {credentials.username} ({'sandbox' if credentials.is_sandbox else 'production'})")
    print("-"*80)
    
    reasoning_steps = []
    queries_executed = []
    errors_encountered = []
    corrections_made = []
    final_result = {}
    
    try:
        # Create Salesforce connection
        print("🔌 Creating Salesforce connection...")
        sf, error = create_salesforce_connection(credentials)
        if error:
            return SalesforceAgenticResponse(
                success=False,
                final_result={},
                
                queries_executed=[],
                errors_encountered=[error],
                corrections_made=[],
                message=f"Failed to connect to Salesforce: {error}"
            )
        
        print("\n🧠 STEP 1: GENERATING COMPLETE REASONING PLAN")
        print("-"*60)
        
        # Step 1: Generate COMPLETE reasoning plan upfront
        client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        reasoning_prompt = f"""
        You are a Salesforce expert agent. Create a COMPLETE step-by-step reasoning plan to answer this user query.
        
        User Query: "{user_query}"
        
        Available Salesforce objects and fields:
        - Account: Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees, Phone, Website
        - Contact: Id, Name, FirstName, LastName, Email, Phone, AccountId, Title
        - Opportunity: Id, Name, Amount, StageName, CloseDate, Probability, AccountId, OwnerId, Type, CreatedDate
        - Lead: Id, Name, FirstName, LastName, Email, Phone, Company, Status
        - Task: Id, Subject, Status, Priority, ActivityDate, WhoId, WhatId
        - Event: Id, Subject, StartDateTime, EndDateTime, WhoId, WhatId
        
        Create a JSON response with:
        {{
            "reasoning_plan": [
                {{
                    "step_number": 1,
                    "step_description": "Find the account by name",
                    "query_purpose": "Get account ID for further queries",
                    "expected_outcome": "Account ID and basic info",
                    "fallback_if_fails": "Try broader name search"
                }},
                {{
                    "step_number": 2,
                    "step_description": "Get all opportunities for the account",
                    "query_purpose": "Retrieve opportunity data",
                    "expected_outcome": "List of opportunities with amounts and stages",
                    "fallback_if_fails": "Check if account has any opportunities"
                }}
            ],
            "success_criteria": "What data is needed to fully answer the user's question",
            "potential_challenges": ["What could go wrong", "How to handle each challenge"]
        }}
        
        Make the reasoning plan COMPLETE and SEQUENTIAL - each step should build on the previous one.
        Format as valid JSON only.
        """
        
        print("🤖 Calling GPT-4 to generate reasoning plan...")
        reasoning_response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[{"role": "user", "content": reasoning_prompt}],
            max_tokens=1000,
            temperature=0.1
        )
        
        try:
            full_reasoning_plan = json.loads(reasoning_response.choices[0].message.content)
            print("✅ Reasoning plan generated successfully!")
            print(f"📋 Plan has {len(full_reasoning_plan.get('reasoning_plan', []))} steps")
            for step in full_reasoning_plan.get('reasoning_plan', []):
                print(f"   Step {step.get('step_number', '?')}: {step.get('step_description', 'Unknown')}")
            reasoning_steps.append({"step": "complete_reasoning_generated", "plan": full_reasoning_plan})
        except json.JSONDecodeError:
            # Fallback reasoning plan
            full_reasoning_plan = {
                "reasoning_plan": [
                    {
                        "step_number": 1,
                        "step_description": "Find account by extracting name from query",
                        "query_purpose": "Get account ID",
                        "expected_outcome": "Account record with ID",
                        "fallback_if_fails": "Try partial name search"
                    }
                ],
                "success_criteria": "Find relevant data for user query",
                "potential_challenges": ["Name variations", "No data found"]
            }
            reasoning_steps.append({"step": "fallback_reasoning_used", "details": "JSON parse failed, using basic plan"})
        
        print("\n⚡ STEP 2: SEQUENTIAL EXECUTION OF REASONING PLAN")
        print("-"*60)
        
        # Step 2: Execute reasoning plan step by step
        current_data = {}
        context_data = {}
        plan_steps = full_reasoning_plan.get("reasoning_plan", [])
        
        reasoning_steps.append({
            "step": "starting_sequential_execution", 
            "total_steps_planned": len(plan_steps),
            "plan_overview": [step["step_description"] for step in plan_steps]
        })
        
        print(f"\nExecuting {len(plan_steps)} reasoning steps sequentially...")
        
        for step_info in plan_steps:
            step_number = step_info["step_number"]
            print(f"\n🎯 Executing Step {step_number}: {step_info['step_description']}")
            print(f"   Purpose: {step_info.get('query_purpose', 'Not specified')}")
            step_description = step_info["step_description"]
            
            reasoning_steps.append({
                "step": f"executing_reasoning_step_{step_number}",
                "description": step_description,
                "purpose": step_info.get("query_purpose", ""),
                "expected": step_info.get("expected_outcome", "")
            })
            
            # Generate query for this specific reasoning step
            step_success = False
            max_attempts_per_step = 5  # Max attempts per reasoning step
            attempt = 0
            
            while not step_success and attempt < max_attempts_per_step:
                attempt += 1
                
                query_generation_prompt = f"""
                Current reasoning step: {step_number}
                Step description: {step_description}
                Query purpose: {step_info.get('query_purpose', '')}
                Expected outcome: {step_info.get('expected_outcome', '')}
                
                User query: {user_query}
                Previous data collected: {str(current_data)[:600]}
                Available context (IDs, names, etc.): {str(context_data)[:400]}
                Attempt number: {attempt}
                
                Generate ONE SOQL query to accomplish this specific reasoning step.
                
                RULES:
                - Generate only ONE query for this step
                - NO bind variables (:variable) - use actual values
                - Use context data when available (account IDs, etc.)
                - For open opportunities: WHERE IsClosed = false
                - Include all fields needed for this step
                
                Previous errors in this step: {[e for e in errors_encountered if f"step_{step_number}" in str(e)][-2:]}
                
                Return only the SOQL query, nothing else.
                """
                
                query_response = client.chat.completions.create(
                    model="gpt-4.1",
                    messages=[{"role": "user", "content": query_generation_prompt}],
                    max_tokens=300,
                    temperature=0.1
                )
                
                generated_query = query_response.choices[0].message.content.strip()
                
                # Clean and validate the query
                if not generated_query.upper().startswith('SELECT'):
                    # Extract SELECT statement if wrapped in text
                    lines = generated_query.split('\n')
                    for line in lines:
                        if line.strip().upper().startswith('SELECT'):
                            generated_query = line.strip()
                            break
                
                if not generated_query.upper().startswith('SELECT'):
                    errors_encountered.append(f"step_{step_number}_attempt_{attempt}: Invalid query format")
                    continue
                
                # Clean query
                cleaned_query = clean_soql_query(generated_query, context_data)
                print(f"�� Generated query: {cleaned_query}")
                
                reasoning_steps.append({
                    "step": f"step_{step_number}_attempt_{attempt}",
                    "generated_query": cleaned_query,
                    "purpose": step_description
                })
                
                # Execute the query
                try:
                    print("⏳ Executing query...")
                    result = sf.query(cleaned_query)
                    print(f"✅ Query executed! Found {result['totalSize']} records")
                    queries_executed.append(cleaned_query)
                    
                    # Store results for this step
                    step_key = f"step_{step_number}_result"
                    current_data[step_key] = {
                        "step_description": step_description,
                        "query": cleaned_query,
                        "records": result['records'],
                        "total_size": result['totalSize']
                    }
                    
                    # Extract context data for next steps
                    if result['records']:
                        for record in result['records']:
                            if 'Id' in record:
                                if record['Id'].startswith('001'):  # Account ID
                                    context_data['account_id'] = record['Id']
                                elif record['Id'].startswith('006'):  # Opportunity ID
                                    context_data['opportunity_id'] = record['Id']
                            if 'Name' in record:
                                if 'account_name' not in context_data:
                                    context_data['account_name'] = record['Name']
                            if 'AccountId' in record:
                                context_data['account_id'] = record['AccountId']
                    
                    step_success = True
                    reasoning_steps.append({
                        "step": f"step_{step_number}_success",
                        "records_found": result['totalSize'],
                        "context_extracted": list(context_data.keys())
                    })
                    
                    # If no records found, might still be success depending on the query type
                    if result['totalSize'] == 0:
                        reasoning_steps.append({
                            "step": f"step_{step_number}_no_records",
                            "details": "Query executed successfully but no records found"
                        })
                    
                except Exception as e:
                    error_msg = str(e)
                    print(f"❌ Query failed: {error_msg[:100]}...")
                    errors_encountered.append(f"step_{step_number}_attempt_{attempt}: {error_msg}")
                    
                    reasoning_steps.append({
                        "step": f"step_{step_number}_error",
                        "attempt": attempt,
                        "error": error_msg,
                        "query": cleaned_query
                    })
                    
                    # Try to fix the error
                    if "MALFORMED_QUERY" in error_msg or "bind variables" in error_msg.lower():
                        fixed_query = fix_bind_variables(cleaned_query, context_data)
                        if fixed_query != cleaned_query:
                            corrections_made.append(f"Step {step_number}: Fixed bind variables")
                            print("🔧 Fixed bind variables in query")
                            try:
                                result = sf.query(fixed_query)
                                queries_executed.append(fixed_query)
                                current_data[f"step_{step_number}_result"] = {
                                    "step_description": step_description,
                                    "query": fixed_query,
                                    "records": result['records'],
                                    "total_size": result['totalSize']
                                }
                                step_success = True
                                corrections_made.append(f"Step {step_number}: Successfully fixed and executed query")
                                break
                            except:
                                pass
                    
                    elif "INVALID_FIELD" in error_msg:
                        corrected_query = await fix_invalid_field_error(cleaned_query, error_msg, sf)
                        if corrected_query != cleaned_query:
                            corrections_made.append(f"Step {step_number}: Fixed invalid field")
                            print("🔧 Fixed invalid field in query")
                            try:
                                result = sf.query(corrected_query)
                                queries_executed.append(corrected_query)
                                current_data[f"step_{step_number}_result"] = {
                                    "step_description": step_description,
                                    "query": corrected_query,
                                    "records": result['records'],
                                    "total_size": result['totalSize']
                                }
                                step_success = True
                                break
                            except:
                                pass
            
            # If step failed completely, try fallback
            if not step_success and "fallback_if_fails" in step_info:
                fallback_description = step_info["fallback_if_fails"]
                reasoning_steps.append({
                    "step": f"step_{step_number}_fallback",
                    "description": fallback_description,
                    "reason": "Primary approach failed"
                })
                
                # Generate fallback query
                fallback_prompt = f"""
                Original step failed: {step_description}
                Fallback strategy: {fallback_description}
                User query: {user_query}
                Context available: {str(context_data)}
                
                Generate a broader/simpler SOQL query as fallback.
                Return only the SOQL query.
                """
                
                fallback_response = client.chat.completions.create(
                    model="gpt-4.1",
                    messages=[{"role": "user", "content": fallback_prompt}],
                    max_tokens=200,
                    temperature=0.2
                )
                
                fallback_query = fallback_response.choices[0].message.content.strip()
                
                try:
                    if fallback_query.upper().startswith('SELECT'):
                        fallback_query = clean_soql_query(fallback_query, context_data)
                        result = sf.query(fallback_query)
                        queries_executed.append(fallback_query)
                        current_data[f"step_{step_number}_fallback_result"] = {
                            "step_description": f"{step_description} (fallback)",
                            "query": fallback_query,
                            "records": result['records'],
                            "total_size": result['totalSize']
                        }
                        corrections_made.append(f"Step {step_number}: Used fallback strategy successfully")
                        print("🔄 Fallback strategy worked!")
                except:
                    reasoning_steps.append({
                        "step": f"step_{step_number}_fallback_failed",
                        "details": "Fallback strategy also failed"
                    })
        
        print("\n📊 STEP 3: ANALYZING COLLECTED DATA")
        print("-"*60)
        print(f"📈 Total data points collected: {len(current_data)}")
        print(f"🎯 Context data: {context_data}")
        
        # Step 3: Analyze all collected data and generate comprehensive response
        reasoning_steps.append({
            "step": "analyzing_collected_data",
            "total_data_points": len(current_data),
            "context_extracted": context_data
        })
        
        if current_data:
            analysis_prompt = f"""
            User Query: "{user_query}"
            
            Complete reasoning plan that was executed:
            {json.dumps(full_reasoning_plan, indent=2)[:1000]}
            
            Data collected from sequential execution:
            {json.dumps(current_data, default=str, indent=2)[:2500]}
            
            Context extracted:
            {json.dumps(context_data, indent=2)}
            
            Provide a comprehensive business-friendly analysis with this EXACT structure:
            {{
                "answer": "Direct, clear answer to the user's specific question",
                "insights": ["Key business insights from the data", "Important patterns discovered", "Notable findings"],
                "metrics": {{"metric_name": value, "another_metric": value}},
                "recommendations": ["Actionable business recommendations", "Next steps to consider"]
            }}
            
            Be specific with numbers, names, and business context. Return valid JSON only.
            """
            
            print("🤖 Generating final analysis with GPT-4...")
            analysis_response = client.chat.completions.create(
                model="gpt-4.1",
                messages=[{"role": "user", "content": analysis_prompt}],
                max_tokens=800,
                temperature=0.2
            )
            
            try:
                final_analysis = json.loads(analysis_response.choices[0].message.content)
                print("✅ Final analysis generated successfully!")
                print(f"💡 Answer: {final_analysis.get('answer', 'No answer')[:100]}...")
                final_result = {
                    "analysis": final_analysis,
                    "raw_data": current_data,
                    "context_data": context_data,
                    "reasoning_plan_executed": full_reasoning_plan,
                    "summary": f"Sequential execution completed: {len(plan_steps)} reasoning steps, {len(queries_executed)} queries executed"
                }
                
                print("\n🎉 SALESFORCE AGENTIC TOOL COMPLETED SUCCESSFULLY!")
                print("="*80)
                print(f"📊 Summary:")
                print(f"   - Reasoning steps executed: {len(plan_steps)}")
                print(f"   - Queries executed: {len(queries_executed)}")
                print(f"   - Errors encountered: {len(errors_encountered)}")
                print(f"   - Corrections made: {len(corrections_made)}")
                print("="*80 + "\n")
                
                return SalesforceAgenticResponse(
                    success=True,
                    final_result=final_result,
                    
                    queries_executed=queries_executed,
                    errors_encountered=errors_encountered,
                    corrections_made=corrections_made,
                    message=f"Sequential reasoning completed: {final_analysis.get('answer', 'Analysis completed')}"
                )
                
            except json.JSONDecodeError:
                final_result = {
                    "analysis": {
                        "answer": f"Sequential execution found {sum(d.get('total_size', 0) for d in current_data.values())} total records but analysis formatting failed.",
                        "insights": ["Data was successfully retrieved using sequential reasoning", "Analysis formatting needs improvement"],
                        "metrics": {"total_records": sum(d.get('total_size', 0) for d in current_data.values()), "reasoning_steps_completed": len(plan_steps)},
                        "recommendations": ["Review raw data for specific insights", "Improve analysis formatting"]
                    },
                    "raw_data": current_data,
                    "context_data": context_data,
                    "reasoning_plan_executed": full_reasoning_plan
                }
        else:
            final_result = {
                "analysis": {
                    "answer": f"Sequential reasoning executed {len(plan_steps)} steps but no data was found for '{user_query}'.",
                    "insights": ["Complete reasoning plan was generated and executed", "No matching records found in Salesforce"],
                    "metrics": {"reasoning_steps_attempted": len(plan_steps), "queries_executed": len(queries_executed), "records_found": 0},
                    "recommendations": ["Verify account/opportunity names exist", "Check if data is available in Salesforce", "Try broader search terms"]
                },
                "reasoning_plan_executed": full_reasoning_plan,
                "context_data": context_data
            }
        
        return SalesforceAgenticResponse(
            success=len(current_data) > 0,
            final_result=final_result,
            
            queries_executed=queries_executed,
            errors_encountered=errors_encountered,
            corrections_made=corrections_made,
            message=final_result["analysis"]["answer"]
        )
        
    except Exception as e:
        return SalesforceAgenticResponse(
            success=False,
            final_result={"error": str(e)},
            
            queries_executed=queries_executed,
            errors_encountered=errors_encountered + [str(e)],
            corrections_made=corrections_made,
            message=f"Sequential reasoning failed: {str(e)}"
        )
def clean_soql_query(query: str, context_data: dict) -> str:
    """Clean SOQL query by removing bind variables and fixing common issues"""
    cleaned = query.strip()
    
    # Replace bind variables with actual values
    if ':accountId' in cleaned and 'account_id' in context_data:
        cleaned = cleaned.replace(':accountId', f"'{context_data['account_id']}'")
    
    # Remove any remaining bind variables
    import re
    cleaned = re.sub(r':\w+', '', cleaned)
    
    # Fix common issues
    cleaned = cleaned.replace('= AND', 'AND')
    cleaned = cleaned.replace('WHERE AND', 'WHERE')
    
    return cleaned

def fix_bind_variables(query: str, context_data: dict) -> str:
    """Fix bind variables in SOQL queries"""
    fixed = query
    
    # Replace common bind variables
    if ':accountId' in fixed and 'account_id' in context_data:
        fixed = fixed.replace(':accountId', f"'{context_data['account_id']}'")
    
    # Remove any other bind variables
    import re
    fixed = re.sub(r':\w+', "''", fixed)
    
    return fixed

def has_sufficient_data_for_query(current_data: dict, user_query: str) -> bool:
    """Check if we have sufficient data to answer the user's query"""
    query_lower = user_query.lower()
    
    # For opportunity-related queries, check if we have opportunity data
    if 'opportunit' in query_lower:
        for data in current_data.values():
            if data.get('records') and any('Opportunity' in str(record.get('attributes', {})) for record in data['records']):
                return True
    
    # For account-related queries, check if we have account data
    if 'account' in query_lower:
        for data in current_data.values():
            if data.get('records') and any('Account' in str(record.get('attributes', {})) for record in data['records']):
                return len(current_data) >= 2  # Need account + related data
    
    return False

def generate_broader_search_queries(user_query: str, context_data: dict) -> list:
    """Generate broader search queries when specific searches fail"""
    queries = []
    
    # Extract potential account name from query
    words = user_query.split()
    for word in words:
        if len(word) > 3 and word.isalpha():
            queries.append(f"SELECT Id, Name FROM Account WHERE Name LIKE '%{word}%' LIMIT 10")
            break
    
    # If we have an account ID, get opportunities
    if 'account_id' in context_data:
        queries.extend([
            f"SELECT Id, Name, Amount, StageName, CreatedDate FROM Opportunity WHERE AccountId = '{context_data['account_id']}' AND IsClosed = false",
            f"SELECT COUNT(Id) FROM Opportunity WHERE AccountId = '{context_data['account_id']}' AND IsClosed = false",
            f"SELECT SUM(Amount) FROM Opportunity WHERE AccountId = '{context_data['account_id']}' AND IsClosed = false"
        ])
    
    # General fallback queries
    if not queries:
        queries.extend([
            "SELECT Id, Name FROM Account ORDER BY CreatedDate DESC LIMIT 10",
            "SELECT Id, Name, Amount, StageName FROM Opportunity WHERE IsClosed = false ORDER BY CreatedDate DESC LIMIT 10"
        ])
    
    return queries
async def fix_invalid_field_error(query: str, error_msg: str, sf) -> str:
    """Try to fix invalid field errors by checking object describe"""
    try:
        # Extract object name from query
        query_upper = query.upper()
        from_index = query_upper.find('FROM ') + 5
        object_name = query_upper[from_index:].split()[0]
        
        # Get object description to find valid fields
        obj_describe = getattr(sf, object_name).describe()
        valid_fields = [field['name'] for field in obj_describe['fields']]
        
        # Try to replace invalid field with similar valid field
        for field in valid_fields:
            if field.lower() in error_msg.lower():
                # Replace in query
                corrected_query = query.replace(field, field)  # This is a simple approach
                return corrected_query
                
        return query
    except:
        return query

@app.post("/salesforce/agentic", response_model=SalesforceAgenticResponse)
async def salesforce_agentic_tool(request: SalesforceAgenticRequest, api_key: str = Depends(verify_api_key)):
    """
    Intelligent Salesforce agent that reasons, executes queries, handles errors, and corrects itself
    """
    return await salesforce_agentic_handler(request.credentials, request.user_query)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 