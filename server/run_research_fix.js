const pool = require('./config/database');
const fs = require('fs');
const path = require('path');

const runMigration = async () => {
  let client;
  try {
    console.log('🔧 Starting research table data type fix...');
    
    client = await pool.connect();
    
    // Read and execute the migration
    const migrationPath = path.join(__dirname, 'migrations', 'fix_crm_research_data_types_final.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('🔍 Research table data types have been fixed.');
    console.log('📊 You should now be able to research any contact (not just the owner).');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    if (error.code === '42704') {
      console.log('💡 This error suggests the column type change failed.');
      console.log('🔧 Trying alternative approach...');
      
      try {
        // Alternative approach: drop and recreate the table
        console.log('🔄 Dropping and recreating crm_research table...');
        
        await client.query('DROP TABLE IF EXISTS crm_research CASCADE');
        
        // Read and execute the corrected original migration
        const originalMigrationPath = path.join(__dirname, 'migrations', 'crm', '016_create_research_tracking.sql');
        const originalMigrationSQL = fs.readFileSync(originalMigrationPath, 'utf8');
        
        await client.query(originalMigrationSQL);
        
        console.log('✅ Table recreated successfully with correct data types!');
        
      } catch (recreateError) {
        console.error('❌ Table recreation also failed:', recreateError);
      }
    }
    
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
};

// Run the migration
runMigration().catch(console.error);
