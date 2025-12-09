-- Create user_analytics_sessions table to track user sessions and paths
CREATE TABLE IF NOT EXISTS user_analytics_sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    path VARCHAR(1000) NOT NULL,
    referrer VARCHAR(1000),
    user_agent TEXT,
    ip_address INET,
    viewport_width INTEGER,
    viewport_height INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    time_spent INTEGER DEFAULT 0, -- in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_analytics_mouse_movements table
CREATE TABLE IF NOT EXISTS user_analytics_mouse_movements (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
    session_id VARCHAR(36) REFERENCES user_analytics_sessions(id) ON DELETE CASCADE,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    path VARCHAR(1000) NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    scroll_x INTEGER DEFAULT 0,
    scroll_y INTEGER DEFAULT 0,
    viewport_width INTEGER,
    viewport_height INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_analytics_clicks table
CREATE TABLE IF NOT EXISTS user_analytics_clicks (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
    session_id VARCHAR(36) REFERENCES user_analytics_sessions(id) ON DELETE CASCADE,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    path VARCHAR(1000) NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    scroll_x INTEGER DEFAULT 0,
    scroll_y INTEGER DEFAULT 0,
    target_tag VARCHAR(50),
    target_id VARCHAR(255),
    target_class VARCHAR(500),
    target_text TEXT,
    button_type INTEGER DEFAULT 0, -- 0: left, 1: middle, 2: right
    ctrl_key BOOLEAN DEFAULT FALSE,
    shift_key BOOLEAN DEFAULT FALSE,
    alt_key BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_id ON user_analytics_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_path ON user_analytics_sessions(path);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started_at ON user_analytics_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_analytics_movements_session_id ON user_analytics_mouse_movements(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_movements_user_id ON user_analytics_mouse_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_movements_path ON user_analytics_mouse_movements(path);
CREATE INDEX IF NOT EXISTS idx_analytics_movements_timestamp ON user_analytics_mouse_movements(timestamp);

CREATE INDEX IF NOT EXISTS idx_analytics_clicks_session_id ON user_analytics_clicks(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_clicks_user_id ON user_analytics_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_clicks_path ON user_analytics_clicks(path);
CREATE INDEX IF NOT EXISTS idx_analytics_clicks_timestamp ON user_analytics_clicks(timestamp);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for sessions table
CREATE TRIGGER update_analytics_sessions_updated_at 
    BEFORE UPDATE ON user_analytics_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 