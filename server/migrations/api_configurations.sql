-- Create api_configurations table
CREATE TABLE IF NOT EXISTS api_configurations (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    api_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_configurations_provider ON api_configurations(provider);

-- Migrate existing API key from system_settings if it exists
DO $$
DECLARE
    llm_setting RECORD;
    new_id VARCHAR(36);
BEGIN
    -- Check if llm setting exists
    SELECT * INTO llm_setting FROM system_settings WHERE setting_key = 'llm' LIMIT 1;
    
    IF FOUND AND llm_setting.setting_value = 'perplexity' AND llm_setting.description IS NOT NULL AND llm_setting.description != '' THEN
        -- Generate a UUID
        new_id := gen_random_uuid()::VARCHAR;
        
        -- Insert the existing API key as a new configuration
        INSERT INTO api_configurations (id, name, provider, api_key)
        VALUES (new_id, 'Migrated Perplexity API', 'perplexity', llm_setting.description);
        
        -- Delete the old setting
        DELETE FROM system_settings WHERE setting_key = 'llm';
    END IF;
END $$;
