const pool = require('../config/database');

async function createTemplatesTable() {
  try {
    // Check if the table already exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'templates'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log('Templates table already exists, skipping creation.');
      return;
    }

    // Create the templates table
    await pool.query(`
      CREATE TABLE templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        prompt TEXT NOT NULL,
        company_id INTEGER NOT NULL,
        category TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Templates table created successfully.');
  } catch (error) {
    console.error('Error creating templates table:', error);
    throw error;
  }
}

module.exports = createTemplatesTable;

// Run the migration if this file is executed directly
if (require.main === module) {
  createTemplatesTable()
    .then(() => {
      console.log('Migration completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

