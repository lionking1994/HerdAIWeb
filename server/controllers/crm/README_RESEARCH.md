# CRM Research Controller - ResearchBy.ai Integration

## Overview

This controller provides complete integration with ResearchBy.ai for conducting company and contact research within the CRM system. It handles research requests, progress monitoring, file downloads, and storage management.

## Features

- **Company Research**: Industry analysis, financial information, market position, competitors
- **Contact Research**: Professional background, skills, LinkedIn profile, decision-making authority
- **File Management**: Automatic download and storage of research documents (.docx files)
- **Progress Tracking**: Real-time status updates from ResearchBy.ai
- **Background Monitoring**: Automatic file download when research completes
- **Database Integration**: Stores research data in `crm_research` table

## Environment Variables Required

Add these to your `.env` file:

```bash
# ResearchBy.ai API Configuration
RESEARCH_BY_AI_API_URL=https://api.researchby.ai
RESEARCH_BY_AI_API_KEY=your_api_key_here
```

## API Endpoints

### 1. Start Company Research
```http
POST /api/crm/research/company
```

**Request Body:**
```json
{
  "companyName": "Acme Corp",
  "opportunityId": 123,
  "accountId": 456,
  "tenantId": 789
}
```

**Response:**
```json
{
  "success": true,
  "message": "Company research started for Acme Corp",
  "data": {
    "researchId": 1,
    "requestId": "req_abc123",
    "companyName": "Acme Corp",
    "opportunityId": 123,
    "accountId": 456,
    "tenantId": 789
  }
}
```

### 2. Start Contact Research
```http
POST /api/crm/research/contact
```

**Request Body:**
```json
{
  "contactName": "John Doe",
  "contactEmail": "john@acme.com",
  "companyName": "Acme Corp",
  "opportunityId": 123,
  "contactId": 789,
  "tenantId": 456
}
```

### 3. Start Both Researches
```http
POST /api/crm/research/opportunity
```

**Request Body:**
```json
{
  "companyName": "Acme Corp",
  "contactName": "John Doe",
  "opportunityId": 123,
  "accountId": 456,
  "contactId": 789,
  "tenantId": 456
}
```

### 4. Get Research Status
```http
GET /api/crm/research/status/:opportunityId/:tenantId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "company": {
      "status": "completed",
      "progress": 100
    },
    "contact": {
      "status": "in-progress",
      "progress": 50
    },
    "overall": {
      "progress": 75
    }
  }
}
```

### 5. Get Research Results
```http
GET /api/crm/research/results/:opportunityId/:tenantId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "opportunity": { "id": 123 },
    "account": {
      "research_results": {
        "status": "completed",
        "file_path": "crm-research/company/company-1-req_abc123.docx",
        "file_name": "company-1-req_abc123.docx",
        "download_url": "/api/files/crm-research/company/company-1-req_abc123.docx",
        "request_id": "req_abc123",
        "company_name": "Acme Corp"
      }
    },
    "contact": {
      "research_results": {
        "status": "completed",
        "file_path": "crm-research/contact/contact-1-req_def456.docx",
        "file_name": "contact-1-req_def456.docx",
        "download_url": "/api/files/crm-research/contact/contact-1-req_def456.docx",
        "request_id": "req_def456",
        "contact_name": "John Doe"
      }
    },
    "research_id": 1,
    "completed_at": "2024-01-15T10:30:00.000Z"
  }
}
```

## File Storage

Research documents are automatically downloaded and stored in:
- **Company Research**: `public/files/crm-research/company/`
- **Contact Research**: `public/files/crm-research/contact/`
- **Opportunity Research**: `public/files/crm-research/opportunity/`

Files are accessible via: `/api/files/crm-research/[type]/[filename]`

## Database Schema

The system uses the `crm_research` table with the following key fields:

- `id`: Primary key
- `opportunity_id`: Associated opportunity
- `account_id`: Associated company account
- `contact_id`: Associated contact
- `tenant_id`: Multi-tenant isolation
- `research_type`: 'company', 'contact', or 'both'
- `status`: 'pending', 'in-progress', 'completed', 'failed'
- `progress`: 0-100 percentage
- `research_data`: JSONB field storing ResearchBy.ai request IDs and file info
- `started_at`: Research start timestamp
- `completed_at`: Research completion timestamp

## Research Process Flow

1. **Research Request**: User clicks research button
2. **API Call**: Controller calls ResearchBy.ai API
3. **Background Monitoring**: System polls ResearchBy.ai for status
4. **File Download**: When complete, downloads .docx file
5. **File Storage**: Saves file to appropriate directory
6. **Database Update**: Updates research record with file information
7. **User Notification**: Frontend shows completion status

## Error Handling

- **API Failures**: Logs errors and returns appropriate HTTP status codes
- **File System Errors**: Creates directories if they don't exist
- **Database Errors**: Logs errors and maintains data integrity
- **Timeout Handling**: 5-minute timeout for research completion

## Monitoring & Logging

The controller provides comprehensive logging:
- 🚀 Research start events
- 🔍 Status check events
- 📥 File download events
- 💾 File storage events
- ❌ Error events with detailed information

## Security Features

- **Authentication Required**: All endpoints require valid JWT token
- **Tenant Isolation**: Research data is isolated by tenant ID
- **File Access Control**: Files are served through authenticated API routes
- **Input Validation**: All input parameters are validated

## Performance Considerations

- **Background Processing**: Research monitoring runs asynchronously
- **File Streaming**: Large files are handled efficiently
- **Database Optimization**: Uses prepared statements and proper indexing
- **Memory Management**: Files are processed in chunks when possible

## Troubleshooting

### Common Issues

1. **Environment Variables Not Set**
   - Check `.env` file for `RESEARCH_BY_AI_API_URL` and `RESEARCH_BY_AI_API_KEY`
   - Restart server after adding variables

2. **File Permission Errors**
   - Ensure `public/files/` directory is writable
   - Check file system permissions

3. **ResearchBy.ai API Errors**
   - Verify API credentials
   - Check API endpoint availability
   - Review API rate limits

4. **Database Connection Issues**
   - Verify database connection string
   - Check `crm_research` table exists
   - Ensure proper database permissions

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=1
```

This will provide detailed logging of all API calls and file operations.

## Future Enhancements

- **Document Parsing**: Extract structured data from .docx files
- **Research Templates**: Customizable research queries
- **Batch Processing**: Multiple research requests in parallel
- **Research History**: Track and compare research results over time
- **Export Options**: PDF, Excel, and other format support
