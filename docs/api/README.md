# API Documentation

This document provides detailed information about the API endpoints of the HerdAIWeb application.

## Overview

The HerdAIWeb API is a RESTful API that provides access to the application's functionality. The API is organized into several resource groups:

- Authentication
- Users
- Meetings
- Tasks
- Feedback
- Companies
- System Settings
- System Logs
- External Integrations (Zoom, Teams, Google Meet)

## Base URL

The base URL for all API endpoints is:

```
https://api.herdaiweb.com/
```

For development environments, the base URL is:

```
http://localhost:5000/
```

## Authentication

All API endpoints (except for authentication endpoints) require authentication. The API uses JWT (JSON Web Token) for authentication.

To authenticate, include the JWT token in the `Authorization` header of your request:

```
Authorization: Bearer <token>
```

### Authentication Endpoints

#### Register a new user

```
POST /auth/register
```

Request body:
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "securepassword"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "provider": "email",
    "is_new_user": true,
    "registration_completed": false
  }
}
```

#### Login with email and password

```
POST /auth/login
```

Request body:
```json
{
  "email": "john.doe@example.com",
  "password": "securepassword"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "provider": "email",
    "is_new_user": false,
    "registration_completed": true
  }
}
```

#### Request password reset

```
POST /auth/forgot-password
```

Request body:
```json
{
  "email": "john.doe@example.com"
}
```

Response:
```json
{
  "message": "Password reset email sent"
}
```

#### Reset password with token

```
POST /auth/reset-password
```

Request body:
```json
{
  "token": "reset-token-from-email",
  "password": "new-secure-password"
}
```

Response:
```json
{
  "message": "Password reset successful"
}
```

#### Get user profile

```
GET /auth/profile
```

Response:
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john.doe@example.com",
  "provider": "email",
  "phone": "123-456-7890",
  "location": "New York",
  "bio": "Software developer",
  "face_id_enabled": false,
  "use_zoom": true,
  "use_teams": false
}
```

#### Update user profile

```
PUT /auth/profile/update
```

Request body:
```json
{
  "name": "John Smith",
  "phone": "123-456-7890",
  "location": "New York",
  "bio": "Software developer"
}
```

Response:
```json
{
  "id": 1,
  "name": "John Smith",
  "email": "john.doe@example.com",
  "provider": "email",
  "phone": "123-456-7890",
  "location": "New York",
  "bio": "Software developer",
  "face_id_enabled": false,
  "use_zoom": true,
  "use_teams": false
}
```

#### Change password

```
POST /auth/change-password
```

Request body:
```json
{
  "oldPassword": "current-password",
  "newPassword": "new-secure-password"
}
```

Response:
```json
{
  "message": "Password changed successfully"
}
```

#### Update Face ID

```
POST /auth/face-id/update
```

Request body:
```json
{
  "faceIdData": "base64-encoded-face-data",
  "enabled": true
}
```

Response:
```json
{
  "message": "Face ID updated successfully",
  "face_id_enabled": true
}
```

## User Management

### User Endpoints

#### Get all users

```
GET /users
```

Query parameters:
- `page`: Page number (default: 1)
- `limit`: Number of users per page (default: 10)
- `search`: Search term for name or email

Response:
```json
{
  "users": [
    {
      "id": 1,
      "name": "John Smith",
      "email": "john.doe@example.com",
      "provider": "email",
      "registration_completed": true,
      "last_login": "2023-04-10T15:30:00Z"
    },
    {
      "id": 2,
      "name": "Jane Doe",
      "email": "jane.doe@example.com",
      "provider": "google",
      "registration_completed": true,
      "last_login": "2023-04-09T10:15:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "pages": 3
}
```

#### Get user by ID

```
GET /users/:id
```

Response:
```json
{
  "id": 1,
  "name": "John Smith",
  "email": "john.doe@example.com",
  "provider": "email",
  "phone": "123-456-7890",
  "location": "New York",
  "bio": "Software developer",
  "face_id_enabled": false,
  "use_zoom": true,
  "use_teams": false,
  "registration_completed": true,
  "last_login": "2023-04-10T15:30:00Z",
  "created_at": "2023-01-15T10:00:00Z",
  "updated_at": "2023-04-10T15:30:00Z"
}
```

## Meeting Management

### Meeting Endpoints

#### Get meeting list

```
GET /meeting/meeting_list
```

Query parameters:
- `page`: Page number (default: 1)
- `limit`: Number of meetings per page (default: 10)
- `status`: Filter by status (scheduled, in-progress, completed, cancelled)
- `platform`: Filter by platform (zoom, teams, gmeet)
- `startDate`: Filter by start date (ISO format)
- `endDate`: Filter by end date (ISO format)

Response:
```json
{
  "meetings": [
    {
      "id": 1,
      "title": "Weekly Team Meeting",
      "datetime": "2023-04-15T10:00:00Z",
      "duration": 60,
      "status": "scheduled",
      "platform": "zoom",
      "join_url": "https://zoom.us/j/123456789"
    },
    {
      "id": 2,
      "title": "Project Kickoff",
      "datetime": "2023-04-16T14:30:00Z",
      "duration": 90,
      "status": "scheduled",
      "platform": "teams",
      "join_url": "https://teams.microsoft.com/l/meetup-join/..."
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 10,
  "pages": 2
}
```

#### Get meeting details

```
GET /meeting/meeting_details
```

Query parameters:
- `id`: Meeting ID

Response:
```json
{
  "id": 1,
  "title": "Weekly Team Meeting",
  "summary": "Discuss project progress and upcoming tasks",
  "datetime": "2023-04-15T10:00:00Z",
  "duration": 60,
  "status": "scheduled",
  "platform": "zoom",
  "transcription_link": "https://example.com/transcription/123",
  "record_link": "https://example.com/recording/123",
  "join_url": "https://zoom.us/j/123456789",
  "participants": [
    {
      "id": 1,
      "name": "John Smith",
      "email": "john.doe@example.com",
      "role": "organizer"
    },
    {
      "id": 2,
      "name": "Jane Doe",
      "email": "jane.doe@example.com",
      "role": "attendee"
    }
  ]
}
```

#### Update meeting transcription

```
POST /meeting/update-transcription
```

Request body:
```json
{
  "id": 1,
  "transcription_link": "https://example.com/transcription/123"
}
```

Response:
```json
{
  "message": "Transcription updated successfully",
  "meeting": {
    "id": 1,
    "title": "Weekly Team Meeting",
    "transcription_link": "https://example.com/transcription/123"
  }
}
```

#### Add user to meeting

```
POST /meeting/add_user_to_meeting
```

Request body:
```json
{
  "meeting_id": 1,
  "user_id": 3,
  "role": "attendee"
}
```

Response:
```json
{
  "message": "User added to meeting successfully",
  "participant": {
    "meeting_id": 1,
    "user_id": 3,
    "role": "attendee"
  }
}
```

#### Delete meeting

```
POST /meeting/delete
```

Request body:
```json
{
  "id": 1
}
```

Response:
```json
{
  "message": "Meeting deleted successfully"
}
```

## Task Management

### Task Endpoints

#### Get all tasks

```
GET /tasks
```

Query parameters:
- `page`: Page number (default: 1)
- `limit`: Number of tasks per page (default: 10)
- `status`: Filter by status (pending, in-progress, completed, cancelled)
- `priority`: Filter by priority (low, medium, high)
- `assigned_to`: Filter by assigned user ID
- `meeting_id`: Filter by associated meeting ID

Response:
```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Prepare presentation",
      "status": "in-progress",
      "priority": "high",
      "due_date": "2023-04-20T17:00:00Z",
      "created_by": {
        "id": 1,
        "name": "John Smith"
      },
      "assigned_to": {
        "id": 2,
        "name": "Jane Doe"
      },
      "meeting_id": 1
    },
    {
      "id": 2,
      "title": "Review documentation",
      "status": "pending",
      "priority": "medium",
      "due_date": "2023-04-22T17:00:00Z",
      "created_by": {
        "id": 1,
        "name": "John Smith"
      },
      "assigned_to": {
        "id": 1,
        "name": "John Smith"
      },
      "meeting_id": null
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 10,
  "pages": 2
}
```

#### Create a new task

```
POST /tasks
```

Request body:
```json
{
  "title": "Implement new feature",
  "description": "Implement the user profile page",
  "status": "pending",
  "priority": "high",
  "due_date": "2023-04-25T17:00:00Z",
  "assigned_to": 2,
  "meeting_id": 1
}
```

Response:
```json
{
  "id": 3,
  "title": "Implement new feature",
  "description": "Implement the user profile page",
  "status": "pending",
  "priority": "high",
  "due_date": "2023-04-25T17:00:00Z",
  "created_by": {
    "id": 1,
    "name": "John Smith"
  },
  "assigned_to": {
    "id": 2,
    "name": "Jane Doe"
  },
  "meeting_id": 1,
  "created_at": "2023-04-11T14:30:00Z",
  "updated_at": "2023-04-11T14:30:00Z"
}
```

#### Get task details

```
GET /tasks/:id
```

Response:
```json
{
  "id": 1,
  "title": "Prepare presentation",
  "description": "Prepare the project presentation for the client meeting",
  "status": "in-progress",
  "priority": "high",
  "due_date": "2023-04-20T17:00:00Z",
  "created_by": {
    "id": 1,
    "name": "John Smith"
  },
  "assigned_to": {
    "id": 2,
    "name": "Jane Doe"
  },
  "meeting_id": 1,
  "meeting": {
    "id": 1,
    "title": "Weekly Team Meeting"
  },
  "created_at": "2023-04-10T10:00:00Z",
  "updated_at": "2023-04-10T15:30:00Z"
}
```

#### Update task

```
PUT /tasks/:id
```

Request body:
```json
{
  "title": "Prepare presentation slides",
  "status": "completed",
  "priority": "high",
  "due_date": "2023-04-20T17:00:00Z",
  "assigned_to": 2
}
```

Response:
```json
{
  "id": 1,
  "title": "Prepare presentation slides",
  "description": "Prepare the project presentation for the client meeting",
  "status": "completed",
  "priority": "high",
  "due_date": "2023-04-20T17:00:00Z",
  "created_by": {
    "id": 1,
    "name": "John Smith"
  },
  "assigned_to": {
    "id": 2,
    "name": "Jane Doe"
  },
  "meeting_id": 1,
  "updated_at": "2023-04-11T14:45:00Z"
}
```

#### Delete task

```
DELETE /tasks/:id
```

Response:
```json
{
  "message": "Task deleted successfully"
}
```

## Feedback Management

### Feedback Endpoints

#### Save feedback

```
POST /feedback/save-feedback
```

Request body (multipart/form-data):
```
type: "bug"
content: "The meeting join button is not working correctly"
rating: 3
attachment: [file upload]
```

Response:
```json
{
  "id": 1,
  "type": "bug",
  "content": "The meeting join button is not working correctly",
  "rating": 3,
  "status": "pending",
  "attachment_url": "https://example.com/attachments/feedback-1.png",
  "created_at": "2023-04-11T15:00:00Z"
}
```

#### Get all feedback

```
GET /feedback/all
```

Query parameters:
- `page`: Page number (default: 1)
- `limit`: Number of feedback entries per page (default: 10)
- `type`: Filter by type (bug, feature, suggestion, other)
- `status`: Filter by status (pending, in-progress, resolved, rejected)

Response:
```json
{
  "feedback": [
    {
      "id": 1,
      "user": {
        "id": 1,
        "name": "John Smith"
      },
      "type": "bug",
      "content": "The meeting join button is not working correctly",
      "rating": 3,
      "status": "pending",
      "attachment_url": "https://example.com/attachments/feedback-1.png",
      "created_at": "2023-04-11T15:00:00Z"
    },
    {
      "id": 2,
      "user": {
        "id": 2,
        "name": "Jane Doe"
      },
      "type": "feature",
      "content": "Add calendar integration for meetings",
      "rating": 5,
      "status": "pending",
      "attachment_url": null,
      "created_at": "2023-04-10T12:30:00Z"
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 10,
  "pages": 1
}
```

#### Get feedback statistics

```
GET /feedback/stats
```

Response:
```json
{
  "total": 8,
  "by_type": {
    "bug": 3,
    "feature": 2,
    "suggestion": 2,
    "other": 1
  },
  "by_status": {
    "pending": 4,
    "in-progress": 2,
    "resolved": 1,
    "rejected": 1
  },
  "average_rating": 4.2
}
```

#### Update feedback status

```
PUT /feedback/update-status
```

Request body:
```json
{
  "id": 1,
  "status": "in-progress"
}
```

Response:
```json
{
  "id": 1,
  "status": "in-progress",
  "updated_at": "2023-04-11T15:30:00Z"
}
```

## External Integrations

### Zoom Integration

#### Authenticate with Zoom

```
GET /zoom/auth
```

Redirects to Zoom OAuth authorization page.

#### Zoom OAuth callback

```
GET /zoom/auth/callback
```

Handles the OAuth callback from Zoom and stores the access token.

#### Get Zoom meetings

```
GET /zoom/meetings
```

Response:
```json
{
  "meetings": [
    {
      "id": "123456789",
      "topic": "Weekly Team Meeting",
      "start_time": "2023-04-15T10:00:00Z",
      "duration": 60,
      "join_url": "https://zoom.us/j/123456789"
    },
    {
      "id": "987654321",
      "topic": "Project Review",
      "start_time": "2023-04-16T14:00:00Z",
      "duration": 45,
      "join_url": "https://zoom.us/j/987654321"
    }
  ]
}
```

#### Create Zoom meeting

```
POST /zoom/meetings
```

Request body:
```json
{
  "topic": "New Project Kickoff",
  "start_time": "2023-04-20T09:00:00Z",
  "duration": 60,
  "agenda": "Discuss project goals and timeline"
}
```

Response:
```json
{
  "id": "456789123",
  "topic": "New Project Kickoff",
  "start_time": "2023-04-20T09:00:00Z",
  "duration": 60,
  "join_url": "https://zoom.us/j/456789123",
  "agenda": "Discuss project goals and timeline"
}
```

### Microsoft Teams Integration

#### Authenticate with Microsoft Teams

```
GET /teams/auth
```

Redirects to Microsoft OAuth authorization page.

#### Microsoft Teams OAuth callback

```
GET /teams/auth/callback
```

Handles the OAuth callback from Microsoft and stores the access token.

#### Get Teams meetings

```
GET /teams/meetings
```

Response:
```json
{
  "meetings": [
    {
      "id": "AAMkAGVmMDEzMTM4LTZmYWUtNDdkNC1hMDZiLTU1OGY5OTZhYmY4OABGAAAAAAAiQ8W967B7TKBjgx9rVEURBwAiIsqMbYjsT5e-T7KzowPTAAAAAAENAAAiIsqMbYjsT5e-T7KzowPTAAAa4QBIAAA=",
      "subject": "Weekly Team Meeting",
      "start": {
        "dateTime": "2023-04-15T10:00:00.0000000",
        "timeZone": "UTC"
      },
      "end": {
        "dateTime": "2023-04-15T11:00:00.0000000",
        "timeZone": "UTC"
      },
      "onlineMeeting": {
        "joinUrl": "https://teams.microsoft.com/l/meetup-join/..."
      }
    }
  ]
}
```

#### Create Teams meeting

```
POST /teams/meetings
```

Request body:
```json
{
  "subject": "New Project Kickoff",
  "start": "2023-04-20T09:00:00Z",
  "end": "2023-04-20T10:00:00Z",
  "content": "Discuss project goals and timeline"
}
```

Response:
```json
{
  "id": "AAMkAGVmMDEzMTM4LTZmYWUtNDdkNC1hMDZiLTU1OGY5OTZhYmY4OABGAAAAAAAiQ8W967B7TKBjgx9rVEURBwAiIsqMbYjsT5e-T7KzowPTAAAAAAENAAAiIsqMbYjsT5e-T7KzowPTAAAa4QBJAAA=",
  "subject": "New Project Kickoff",
  "start": {
    "dateTime": "2023-04-20T09:00:00.0000000",
    "timeZone": "UTC"
  },
  "end": {
    "dateTime": "2023-04-20T10:00:00.0000000",
    "timeZone": "UTC"
  },
  "onlineMeeting": {
    "joinUrl": "https://teams.microsoft.com/l/meetup-join/..."
  }
}
```

### Google Meet Integration

#### Authenticate with Google

```
GET /gmeet/auth
```

Redirects to Google OAuth authorization page.

#### Google OAuth callback

```
GET /gmeet/auth/callback
```

Handles the OAuth callback from Google and stores the access token.

#### Get Google Meet meetings

```
GET /gmeet/meetings
```

Response:
```json
{
  "meetings": [
    {
      "id": "abc123",
      "summary": "Weekly Team Meeting",
      "start": {
        "dateTime": "2023-04-15T10:00:00Z"
      },
      "end": {
        "dateTime": "2023-04-15T11:00:00Z"
      },
      "hangoutLink": "https://meet.google.com/abc-defg-hij"
    }
  ]
}
```

#### Create Google Meet meeting

```
POST /gmeet/meetings
```

Request body:
```json
{
  "summary": "New Project Kickoff",
  "start": "2023-04-20T09:00:00Z",
  "end": "2023-04-20T10:00:00Z",
  "description": "Discuss project goals and timeline"
}
```

Response:
```json
{
  "id": "def456",
  "summary": "New Project Kickoff",
  "start": {
    "dateTime": "2023-04-20T09:00:00Z"
  },
  "end": {
    "dateTime": "2023-04-20T10:00:00Z"
  },
  "description": "Discuss project goals and timeline",
  "hangoutLink": "https://meet.google.com/jkl-mnop-qrs"
}
```

## Error Handling

The API returns standard HTTP status codes to indicate the success or failure of a request:

- 200 OK: The request was successful
- 201 Created: The resource was successfully created
- 400 Bad Request: The request was invalid or cannot be served
- 401 Unauthorized: Authentication is required or failed
- 403 Forbidden: The authenticated user does not have permission to access the resource
- 404 Not Found: The requested resource does not exist
- 500 Internal Server Error: An error occurred on the server

Error responses include a JSON object with an error message:

```json
{
  "error": "Invalid credentials"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse. The rate limits are:

- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

When a rate limit is exceeded, the API returns a 429 Too Many Requests status code with a Retry-After header indicating how long to wait before making another request.

## Versioning

The API is versioned to ensure backward compatibility. The current version is v1.

To specify a version, include it in the URL:

```
https://api.herdaiweb.com/v1/users
```

If no version is specified, the latest version is used.
