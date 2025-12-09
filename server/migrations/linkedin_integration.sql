-- Create LinkedIn user table
CREATE TABLE IF NOT EXISTS user_linkedin (
  id SERIAL PRIMARY KEY,
  account_id VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  linkedin_access_token TEXT,
  linkedin_refresh_token TEXT,
  profile_url VARCHAR(255),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_connected BOOLEAN DEFAULT TRUE
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_linkedin_user_id ON user_linkedin(user_id);

-- Create LinkedIn data table to store imported profile information
CREATE TABLE IF NOT EXISTS user_linkedin_data (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  work_history JSONB DEFAULT '[]',
  education JSONB DEFAULT '[]',
  skills JSONB DEFAULT '[]',
  projects JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_linkedin_data_user_id ON user_linkedin_data(user_id);

