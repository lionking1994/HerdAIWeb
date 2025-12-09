-- Migration: Create user_tracking_actions table for comprehensive user action tracking
-- This table will store all types of user interactions from the tracking script

-- Create user_tracking_actions table
CREATE TABLE IF NOT EXISTS user_tracking_actions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'page_view', 'click', 'mousemove', 'scroll', 'keypress', 'visibility_change', 'page_unload'
    timestamp BIGINT NOT NULL, -- Unix timestamp in milliseconds
    url VARCHAR(2000),
    title VARCHAR(500),
    referrer VARCHAR(2000),
    user_agent TEXT,
    
    -- Element information (for clicks, keypresses)
    element_tag VARCHAR(50),
    element_id VARCHAR(255),
    element_class VARCHAR(1000),
    element_text TEXT,
    element_href VARCHAR(2000),
    element_type VARCHAR(50),
    
    -- Position information (for clicks, mousemove)
    position_x INTEGER,
    position_y INTEGER,
    position_page_x INTEGER,
    position_page_y INTEGER,
    
    -- Scroll information (for scroll events)
    scroll_x INTEGER,
    scroll_y INTEGER,
    scroll_top INTEGER,
    scroll_left INTEGER,
    
    -- Keyboard information (for keypress events)
    key_pressed VARCHAR(10),
    key_code VARCHAR(50),
    
    -- Modifier keys
    ctrl_key BOOLEAN DEFAULT FALSE,
    shift_key BOOLEAN DEFAULT FALSE,
    alt_key BOOLEAN DEFAULT FALSE,
    meta_key BOOLEAN DEFAULT FALSE,
    
    -- Screen and viewport information
    screen_width INTEGER,
    screen_height INTEGER,
    viewport_width INTEGER,
    viewport_height INTEGER,
    
    -- Additional data for specific action types
    hidden BOOLEAN, -- for visibility_change
    additional_data JSONB, -- for any other data that doesn't fit in specific columns
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tracking_actions_user_id ON user_tracking_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_actions_session_id ON user_tracking_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_actions_action_type ON user_tracking_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_tracking_actions_timestamp ON user_tracking_actions(timestamp);
CREATE INDEX IF NOT EXISTS idx_tracking_actions_url ON user_tracking_actions(url);
CREATE INDEX IF NOT EXISTS idx_tracking_actions_created_at ON user_tracking_actions(created_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tracking_actions_user_session ON user_tracking_actions(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_actions_user_type ON user_tracking_actions(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_tracking_actions_session_type ON user_tracking_actions(session_id, action_type);
CREATE INDEX IF NOT EXISTS idx_tracking_actions_user_timestamp ON user_tracking_actions(user_id, timestamp);

-- Create function to get tracking statistics
CREATE OR REPLACE FUNCTION get_user_tracking_stats(
    p_user_id VARCHAR(36),
    p_start_timestamp BIGINT DEFAULT NULL,
    p_end_timestamp BIGINT DEFAULT NULL
)
RETURNS TABLE(
    total_actions BIGINT,
    page_views BIGINT,
    clicks BIGINT,
    mouse_movements BIGINT,
    scrolls BIGINT,
    keypresses BIGINT,
    visibility_changes BIGINT,
    unique_sessions BIGINT,
    unique_urls BIGINT,
    total_time_spent BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_actions,
        COUNT(CASE WHEN action_type = 'page_view' THEN 1 END)::BIGINT as page_views,
        COUNT(CASE WHEN action_type = 'click' THEN 1 END)::BIGINT as clicks,
        COUNT(CASE WHEN action_type = 'mousemove' THEN 1 END)::BIGINT as mouse_movements,
        COUNT(CASE WHEN action_type = 'scroll' THEN 1 END)::BIGINT as scrolls,
        COUNT(CASE WHEN action_type = 'keypress' THEN 1 END)::BIGINT as keypresses,
        COUNT(CASE WHEN action_type = 'visibility_change' THEN 1 END)::BIGINT as visibility_changes,
        COUNT(DISTINCT session_id)::BIGINT as unique_sessions,
        COUNT(DISTINCT url)::BIGINT as unique_urls,
        COALESCE(MAX(timestamp) - MIN(timestamp), 0)::BIGINT as total_time_spent
    FROM user_tracking_actions
    WHERE user_id = p_user_id
    AND (p_start_timestamp IS NULL OR timestamp >= p_start_timestamp)
    AND (p_end_timestamp IS NULL OR timestamp <= p_end_timestamp);
END;
$$ LANGUAGE plpgsql;

-- Create function to get session timeline
CREATE OR REPLACE FUNCTION get_session_timeline(
    p_session_id VARCHAR(255)
)
RETURNS TABLE(
    action_type VARCHAR(50),
    timestamp BIGINT,
    url VARCHAR(2000),
    element_tag VARCHAR(50),
    element_text TEXT,
    position_x INTEGER,
    position_y INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uta.action_type,
        uta.timestamp,
        uta.url,
        uta.element_tag,
        uta.element_text,
        uta.position_x,
        uta.position_y
    FROM user_tracking_actions uta
    WHERE uta.session_id = p_session_id
    ORDER BY uta.timestamp ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get click heatmap data
CREATE OR REPLACE FUNCTION get_click_heatmap(
    p_user_id VARCHAR(36),
    p_url VARCHAR(2000) DEFAULT NULL,
    p_start_timestamp BIGINT DEFAULT NULL,
    p_end_timestamp BIGINT DEFAULT NULL
)
RETURNS TABLE(
    position_x INTEGER,
    position_y INTEGER,
    click_count BIGINT,
    avg_x NUMERIC,
    avg_y NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uta.position_x,
        uta.position_y,
        COUNT(*)::BIGINT as click_count,
        AVG(uta.position_x)::NUMERIC as avg_x,
        AVG(uta.position_y)::NUMERIC as avg_y
    FROM user_tracking_actions uta
    WHERE uta.user_id = p_user_id 
    AND uta.action_type = 'click'
    AND (p_url IS NULL OR uta.url = p_url)
    AND (p_start_timestamp IS NULL OR uta.timestamp >= p_start_timestamp)
    AND (p_end_timestamp IS NULL OR uta.timestamp <= p_end_timestamp)
    GROUP BY uta.position_x, uta.position_y
    ORDER BY click_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user sessions summary
CREATE OR REPLACE FUNCTION get_user_sessions_summary(
    p_user_id VARCHAR(36),
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
    session_id VARCHAR(255),
    session_start BIGINT,
    session_end BIGINT,
    action_count BIGINT,
    action_types TEXT[],
    urls TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uta.session_id,
        MIN(uta.timestamp)::BIGINT as session_start,
        MAX(uta.timestamp)::BIGINT as session_end,
        COUNT(*)::BIGINT as action_count,
        array_agg(DISTINCT uta.action_type)::TEXT[] as action_types,
        array_agg(DISTINCT uta.url)::TEXT[] as urls
    FROM user_tracking_actions uta
    WHERE uta.user_id = p_user_id
    GROUP BY uta.session_id
    ORDER BY session_start DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add comments to table and columns for documentation
COMMENT ON TABLE user_tracking_actions IS 'Stores comprehensive user interaction tracking data from client-side tracking script';
COMMENT ON COLUMN user_tracking_actions.action_type IS 'Type of user action: page_view, click, mousemove, scroll, keypress, visibility_change, page_unload';
COMMENT ON COLUMN user_tracking_actions.timestamp IS 'Unix timestamp in milliseconds when the action occurred';
COMMENT ON COLUMN user_tracking_actions.additional_data IS 'JSONB field for storing any additional data that doesn''t fit in specific columns';

-- Create a view for easy access to recent tracking data
CREATE OR REPLACE VIEW recent_tracking_data AS
SELECT 
    uta.*,
    u.name as user_name,
    u.email as user_email
FROM user_tracking_actions uta
JOIN users u ON uta.user_id = u.id
ORDER BY uta.timestamp DESC;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_tracking_actions TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_user_tracking_stats TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_session_timeline TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_click_heatmap TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_user_sessions_summary TO your_app_user; 