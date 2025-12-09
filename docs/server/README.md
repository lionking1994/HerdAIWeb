# Server Documentation

This document provides detailed information about the server component of the HerdAIWeb application.

## Overview

The server is built using Node.js and Express.js, providing a RESTful API for the client and admin applications. It handles authentication, database operations, and integration with external services.

## Directory Structure

```
server/
├── app.js                 # Main application setup
├── server.js              # Server entry point
├── config/                # Configuration files
│   ├── database.js        # Database connection
│   ├── db.init.js         # Database initialization
│   ├── logger.js          # Logging configuration
│   ├── passport.js        # Authentication configuration
│   └── azureauth.js       # Azure/Microsoft authentication
├── controllers/           # Request handlers
│   ├── authController.js  # Authentication handlers
│   ├── meetingController.js # Meeting-related handlers
│   ├── taskController.js  # Task-related handlers
│   └── ...                # Other controllers
├── middleware/            # Express middleware
│   ├── auth.js            # Authentication middleware
│   ├── upload.js          # File upload middleware
│   └── ...                # Other middleware
├── models/                # Database models
│   ├── User.js            # User model
│   ├── Meeting.js         # Meeting model
│   └── ...                # Other models
├── routes/                # API routes
│   ├── auth.js            # Authentication routes
│   ├── meeting.js         # Meeting routes
│   └── ...                # Other routes
└── utils/                 # Utility functions
    ├── email.js           # Email utilities
    ├── errorHandler.js    # Error handling utilities
    └── ...                # Other utilities
```

## Core Components

### Configuration

The `config` directory contains configuration files for various aspects of the server:

- **database.js**: PostgreSQL database connection setup
- **db.init.js**: Database initialization and schema creation
- **passport.js**: Authentication strategies configuration
- **logger.js**: Logging configuration

### Models

The `models` directory contains database models that handle data access and manipulation:

- **User.js**: User account management
- **Meeting.js**: Meeting data management
- **MeetingParticipant.js**: Meeting participant relationships
- **ZoomUser.js**: Zoom integration user data
- **TeamsUser.js**: Microsoft Teams integration user data
- **GmeetUser.js**: Google Meet integration user data

### Controllers

The `controllers` directory contains request handlers that implement the business logic:

- **authController.js**: Authentication and user management
- **meetingController.js**: Meeting creation, retrieval, and management
- **taskController.js**: Task creation, assignment, and tracking
- **feedbackController.js**: Feedback collection and analysis
- **zoomController.js**: Zoom API integration
- **teamsController.js**: Microsoft Teams API integration
- **gmeetController.js**: Google Meet API integration

### Routes

The `routes` directory contains API route definitions:

- **auth.js**: Authentication endpoints
- **meeting.js**: Meeting management endpoints
- **tasks.js**: Task management endpoints
- **feedback.js**: Feedback collection endpoints
- **zoom.js**: Zoom integration endpoints
- **teams.js**: Microsoft Teams integration endpoints
- **gmeet.js**: Google Meet integration endpoints

### Middleware

The `middleware` directory contains Express middleware functions:

- **auth.js**: JWT authentication middleware
- **upload.js**: File upload handling middleware

### Utilities

The `utils` directory contains utility functions:

- **email.js**: Email sending utilities
- **errorHandler.js**: Error handling utilities
- **socket.js**: WebSocket communication utilities

## Authentication

The server uses multiple authentication strategies:

1. **JWT Authentication**: For API access
2. **OAuth Authentication**: For third-party service integration
3. **Password Authentication**: For email/password login

Authentication flow:

1. User logs in via client application
2. Server validates credentials and issues JWT
3. Client includes JWT in subsequent requests
4. Server validates JWT for protected routes

## Database Access

The server uses the `node-postgres` library to interact with the PostgreSQL database:

- Connection pooling for efficient database access
- Parameterized queries to prevent SQL injection
- Transaction support for atomic operations

## API Endpoints

The server provides the following API endpoints:

### Authentication

- `POST /auth/register`: Register a new user
- `POST /auth/login`: Log in an existing user
- `POST /auth/forgot-password`: Request password reset
- `POST /auth/reset-password`: Reset password with token
- `GET /auth/profile`: Get user profile
- `PUT /auth/profile/update`: Update user profile

### Meeting Management

- `GET /meeting/meeting_list`: Get list of meetings
- `GET /meeting/meeting_details`: Get meeting details
- `POST /meeting/update-transcription`: Update meeting transcription
- `POST /meeting/add_user_to_meeting`: Add user to meeting
- `POST /meeting/delete`: Delete meeting

### Task Management

- `GET /tasks`: Get list of tasks
- `POST /tasks`: Create a new task
- `GET /tasks/:id`: Get task details
- `PUT /tasks/:id`: Update task
- `DELETE /tasks/:id`: Delete task

### Feedback Management

- `POST /feedback/save-feedback`: Save feedback
- `GET /feedback/all`: Get all feedback
- `GET /feedback/stats`: Get feedback statistics

### External Integrations

- `GET /zoom/auth`: Authenticate with Zoom
- `GET /teams/auth`: Authenticate with Microsoft Teams
- `GET /gmeet/auth`: Authenticate with Google Meet

## WebSocket Communication

The server uses Socket.IO for real-time communication:

- Notification delivery
- Meeting status updates
- Task assignment notifications

## Error Handling

The server implements a centralized error handling mechanism:

- Custom error classes for different error types
- Consistent error response format
- Detailed error logging

## Security Measures

The server implements several security measures:

- HTTPS for all communications
- JWT for secure authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CSRF protection
- Rate limiting for API endpoints

## Logging

The server uses a structured logging system:

- Request logging
- Error logging
- Audit logging for security events
- Performance monitoring

## Environment Configuration

The server uses environment variables for configuration:

- Database connection details
- JWT secret
- External API credentials
- Environment-specific settings

## Development and Deployment

### Development

To set up the server for development:

1. Install dependencies: `npm install`
2. Set up environment variables
3. Start development server: `npm run dev`

### Deployment

To deploy the server:

1. Build the application: `npm run build`
2. Set up environment variables for production
3. Start the server: `npm start`

## Performance Considerations

- Connection pooling for database access
- Caching for frequently accessed data
- Asynchronous processing for resource-intensive tasks
- Optimized database queries
