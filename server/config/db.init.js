const pool = require('./database');

const initializeDatabase = async () => {
  let client;
  try {
    // Test the connection
    client = await pool.connect();
    console.log('🔌 Connected to PostgreSQL database at:', process.env.DB_HOST);

    // Create users table if it doesn't exist with additional auth fields
    await client.query(`
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
    `);
    console.log('📋 Users table is ready');

    // Create system_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        updated_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('📋 System settings table is ready');

    // Modify provider_id constraint
    await client.query(`
      DO $$ 
      BEGIN
        ALTER TABLE users 
        ALTER COLUMN provider_id DROP NOT NULL;
      EXCEPTION
        WHEN undefined_column THEN NULL;
      END $$;
    `);

    // Create trigger for updating updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
      CREATE TRIGGER update_system_settings_updated_at
        BEFORE UPDATE ON system_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`      CREATE TABLE IF NOT EXISTS meetings (
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
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_participants (
        meeting_id INTEGER NOT NULL REFERENCES meetings(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        role VARCHAR(255),
        PRIMARY KEY (meeting_id, user_id)
      );
    `);

    await client.query(`
    CREATE TABLE IF NOT EXISTS api_configurations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      provider VARCHAR(50) NOT NULL,
      api_key TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

    // Create agent_meetings table for storing recall.ai bot meeting data
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_meetings (
        id SERIAL PRIMARY KEY,
        meeting_id VARCHAR(1024),
        link VARCHAR(4096),
        bot_id VARCHAR(255),
        bot_name VARCHAR(500),
        join_time TIMESTAMP,
        recall_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add index on bot_id for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_meetings_bot_id ON agent_meetings(bot_id);
    `);

    // Add index on meeting_id for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_meetings_meeting_id ON agent_meetings(meeting_id);
    `);

    // Add trigger for updating updated_at on agent_meetings
    await client.query(`
      DROP TRIGGER IF EXISTS update_agent_meetings_updated_at ON agent_meetings;
      CREATE TRIGGER update_agent_meetings_updated_at
        BEFORE UPDATE ON agent_meetings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('📋 Meetings and meeting participants tables are ready');
    console.log('📋 Agent meetings table is ready');

    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', {
      message: error.message,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
    });
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Function to check if database is alive
const checkDatabase = async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT NOW()');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

module.exports = {
  initializeDatabase,
  checkDatabase
}; 