-- Simple time logs table
CREATE TABLE IF NOT EXISTS psa_time_logs (
  id SERIAL PRIMARY KEY,
  story_id UUID NOT NULL,
  user_id INTEGER NOT NULL,
  log_date DATE NOT NULL,
  time_from TIME NOT NULL,
  time_to TIME NOT NULL,
  duration_hours DECIMAL(5,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Simple indexes
CREATE INDEX IF NOT EXISTS idx_psa_time_logs_story_id ON psa_time_logs(story_id);
CREATE INDEX IF NOT EXISTS idx_psa_time_logs_user_id ON psa_time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_psa_time_logs_log_date ON psa_time_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_psa_time_logs_is_deleted ON psa_time_logs(is_deleted);
