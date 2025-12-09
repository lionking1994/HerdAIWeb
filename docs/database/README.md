# Database Documentation

This document provides detailed information about the database schema and data model of the HerdAIWeb application.

## Overview

HerdAIWeb uses PostgreSQL as its relational database management system. The database stores user accounts, meeting data, task information, feedback, and other application data.

## Database Connection

The application connects to the PostgreSQL database using the `node-postgres` library. The connection is configured in `server/config/database.js`:

```javascript
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false // Required for AWS RDS
  },
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20,
});
```

The connection uses environment variables for configuration, allowing for different database settings in development, staging, and production environments.

## Database Initialization

The database schema is initialized in `server/config/db.init.js`. This script creates the necessary tables if they don't exist and sets up triggers for automatic timestamp updates.

## Schema

### Users Table

The `users` table stores user account information:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255),
  password_hash VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  is_new_user BOOLEAN DEFAULT true,
  registration_completed BOOLEAN DEFAULT false,
  login_count INTEGER DEFAULT 0,
  last_login TIMESTAMP,
  phone VARCHAR(20),
  location VARCHAR(255),
  bio TEXT,
  face_id_enabled BOOLEAN DEFAULT false,
  face_id_data TEXT,
  use_zoom BOOLEAN DEFAULT false,
  zoom_access_token TEXT,
  zoom_refresh_token TEXT,
  zoom_connected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Key fields:
- `id`: Unique identifier for the user
- `email`: User's email address (unique)
- `provider`: Authentication provider (email, google, facebook, apple)
- `provider_id`: ID from the authentication provider
- `password_hash`: Hashed password (for email authentication)
- `face_id_enabled`: Whether Face ID authentication is enabled
- `face_id_data`: Face ID authentication data
- `use_zoom`: Whether Zoom integration is enabled
- `zoom_access_token`: Zoom API access token
- `zoom_refresh_token`: Zoom API refresh token

### Meetings Table

The `meetings` table stores information about meetings:

```sql
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  teams_id VARCHAR(1024),
  title VARCHAR(500) NOT NULL,
  summary VARCHAR(4096),
  org_id INTEGER,
  duration INTEGER,
  datetime TIMESTAMP NOT NULL,
  status VARCHAR(255),
  platform VARCHAR(255),
  transcription_link VARCHAR(255),
  record_link VARCHAR(255),
  join_url VARCHAR(4096)
);
```

Key fields:
- `id`: Unique identifier for the meeting
- `teams_id`: Microsoft Teams meeting ID
- `title`: Meeting title
- `summary`: Meeting summary
- `datetime`: Meeting date and time
- `status`: Meeting status (scheduled, in-progress, completed, cancelled)
- `platform`: Meeting platform (Zoom, Teams, Google Meet)
- `transcription_link`: Link to meeting transcription
- `record_link`: Link to meeting recording
- `join_url`: URL to join the meeting

### Meeting Participants Table

The `meeting_participants` table stores the relationship between meetings and participants:

```sql
CREATE TABLE IF NOT EXISTS meeting_participants (
  meeting_id INTEGER NOT NULL REFERENCES meetings(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role VARCHAR(255),
  PRIMARY KEY (meeting_id, user_id)
);
```

Key fields:
- `meeting_id`: Reference to the meeting
- `user_id`: Reference to the user
- `role`: Participant role (organizer, presenter, attendee)

### Tasks Table

The `tasks` table stores task information:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL,
  priority VARCHAR(50),
  due_date TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  assigned_to INTEGER REFERENCES users(id),
  meeting_id INTEGER REFERENCES meetings(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Key fields:
- `id`: Unique identifier for the task
- `title`: Task title
- `description`: Task description
- `status`: Task status (pending, in-progress, completed, cancelled)
- `priority`: Task priority (low, medium, high)
- `due_date`: Task due date
- `created_by`: Reference to the user who created the task
- `assigned_to`: Reference to the user assigned to the task
- `meeting_id`: Reference to the associated meeting (if any)

### Feedback Table

The `feedback` table stores user feedback:

```sql
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  attachment_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Key fields:
- `id`: Unique identifier for the feedback
- `user_id`: Reference to the user who submitted the feedback
- `type`: Feedback type (bug, feature, suggestion, other)
- `content`: Feedback content
- `rating`: Feedback rating (1-5)
- `status`: Feedback status (pending, in-progress, resolved, rejected)
- `attachment_url`: URL to attached file (if any)

### System Logs Table

The `system_logs` table stores system activity logs:

```sql
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  details TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Key fields:
- `id`: Unique identifier for the log entry
- `user_id`: Reference to the user who performed the action
- `action`: Action performed
- `details`: Additional details about the action
- `ip_address`: IP address of the user
- `user_agent`: User agent of the user's browser

### System Settings Table

The `system_settings` table stores application configuration settings:

```sql
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Key fields:
- `id`: Unique identifier for the setting
- `key`: Setting key
- `value`: Setting value
- `description`: Setting description
- `updated_by`: Reference to the user who last updated the setting

### Companies Table

The `companies` table stores company information:

```sql
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url VARCHAR(255),
  website VARCHAR(255),
  industry VARCHAR(100),
  size VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Key fields:
- `id`: Unique identifier for the company
- `name`: Company name
- `description`: Company description
- `logo_url`: URL to company logo
- `website`: Company website
- `industry`: Company industry
- `size`: Company size (small, medium, large, enterprise)

### Company Users Table

The `company_users` table stores the relationship between companies and users:

```sql
CREATE TABLE IF NOT EXISTS company_users (
  company_id INTEGER NOT NULL REFERENCES companies(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role VARCHAR(50) NOT NULL,
  PRIMARY KEY (company_id, user_id)
);
```

Key fields:
- `company_id`: Reference to the company
- `user_id`: Reference to the user
- `role`: User role within the company (admin, manager, member)

### Integration-specific Tables

#### Zoom Users Table

The `zoom_users` table stores Zoom integration data:

```sql
CREATE TABLE IF NOT EXISTS zoom_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  zoom_user_id VARCHAR(255) UNIQUE NOT NULL,
  zoom_email VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Teams Users Table

The `teams_users` table stores Microsoft Teams integration data:

```sql
CREATE TABLE IF NOT EXISTS teams_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  teams_user_id VARCHAR(255) UNIQUE NOT NULL,
  teams_email VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Google Meet Users Table

The `gmeet_users` table stores Google Meet integration data:

```sql
CREATE TABLE IF NOT EXISTS gmeet_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  gmeet_user_id VARCHAR(255) UNIQUE NOT NULL,
  gmeet_email VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Relationships

### One-to-Many Relationships

- One user can create many meetings
- One user can create many tasks
- One user can submit many feedback entries
- One company can have many users

### Many-to-Many Relationships

- Many users can participate in many meetings (via meeting_participants)
- Many users can belong to many companies (via company_users)

## Indexes

The database uses indexes to optimize query performance:

- Primary key indexes on all tables
- Foreign key indexes for relationships
- Unique indexes for email addresses and other unique fields
- Composite indexes for frequently queried combinations

## Triggers

The database uses triggers for certain operations:

- `update_updated_at_column`: Updates the `updated_at` column whenever a record is updated

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Data Access

The application accesses the database through model classes that encapsulate database operations:

- `User.js`: User account operations
- `Meeting.js`: Meeting operations
- `MeetingParticipant.js`: Meeting participant operations
- `ZoomUser.js`: Zoom integration operations
- `TeamsUser.js`: Microsoft Teams integration operations
- `GmeetUser.js`: Google Meet integration operations

These models use parameterized queries to prevent SQL injection and implement proper error handling.

## Migrations

Database schema changes are managed through migration scripts in the `server/migrations` directory. These scripts are applied in sequence to update the database schema.

## Backup and Recovery

The database should be regularly backed up to prevent data loss. Backup strategies include:

- Daily full backups
- Point-in-time recovery
- Replication for high availability

## Performance Considerations

To ensure optimal database performance:

- Use connection pooling to manage database connections
- Implement proper indexing for frequently queried fields
- Use transactions for atomic operations
- Optimize queries for performance
- Monitor query performance and optimize as needed
