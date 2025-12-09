-- Create company_roles table
CREATE TABLE IF NOT EXISTS company_roles (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  meeting_weight INTEGER DEFAULT 1,
  top_meeting_count INTEGER DEFAULT 5,
  research_review_weight INTEGER DEFAULT 1,
  research_review_top_count INTEGER DEFAULT 5,
  task_weight INTEGER DEFAULT 1,
  task_top_count INTEGER DEFAULT 5,
  rating_given_weight INTEGER DEFAULT 1,
  rating_given_top_count INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add company_role_id to company_users table
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS company_role_id INTEGER REFERENCES company_roles(id);

