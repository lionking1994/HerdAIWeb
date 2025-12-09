# CoreSignal API Integration

## Overview

This integration provides direct access to CoreSignal's API for company and people data, bypassing the MCP (Model Context Protocol) layer. It offers a more reliable and efficient way to access CoreSignal data.

## Features

- Direct API integration (no MCP dependency)
- Company search and details
- People search and profiles
- Company insights and analytics
- Employee data retrieval
- Usage statistics
- Agent-based execution
- Comprehensive error handling
- Request/response logging

## Setup

### 1. Environment Configuration

Update your `server/.env` file:

```bash
CORESIGNAL_API_KEY=MxoA5PNPglG4Gvstfch49iHiDA7xJdQM
```

### 2. API Endpoints

#### Test Connection
```http
GET /api/coresignal/test
```

#### Company Search
```http
POST /api/coresignal/companies/search
Content-Type: application/json

{
  "query": "technology companies",
  "limit": 10,
  "offset": 0,
  "filters": {
    "industry": "technology",
    "location": "San Francisco"
  },
  "sortBy": "relevance",
  "sortOrder": "desc"
}
```

#### Get Company Details
```http
GET /api/coresignal/companies/{companyId}
```

#### Get Company Employees
```http
GET /api/coresignal/companies/{companyId}/employees?limit=50&offset=0
```

#### Get Company Insights
```http
GET /api/coresignal/companies/{companyId}/insights
```

#### People Search
```http
POST /api/coresignal/people/search
Content-Type: application/json

{
  "query": "software engineers",
  "limit": 10,
  "offset": 0,
  "filters": {
    "title": "engineer",
    "location": "California"
  },
  "sortBy": "relevance",
  "sortOrder": "desc"
}
```

#### Get Person Details
```http
GET /api/coresignal/people/{personId}
```

#### Usage Statistics
```http
GET /api/coresignal/usage
```

#### Agent Execution
```http
POST /api/coresignal/agent/execute
Content-Type: application/json

{
  "agentType": "research",
  "query": "technology companies in San Francisco",
  "limit": 10,
  "filters": {
    "industry": "technology"
  }
}
```

## Agent Types

### 1. Research Agent
Searches for both companies and people based on a query.

### 2. Analysis Agent
Provides comprehensive analysis of a specific company.

### 3. Summary Agent
Creates summaries of findings.

### 4. Custom Agent
Handles custom queries.

## Workflow Integration

Add a `coresignalAgentNode` to your workflows:

```json
{
  "type": "coresignalAgentNode",
  "config": {
    "agentConfig": {
      "agentType": "research",
      "query": "{{formData.companyName}} companies",
      "limit": 10
    }
  }
}
```

## Testing

Run the test script:
```bash
cd server
node test-coresignal-api.js
```

## Benefits

- Reliability: Direct API calls are more reliable than MCP
- Performance: Faster response times
- Debugging: Better error messages and logging
- Flexibility: More control over API parameters
- Maintenance: Easier to maintain and update 