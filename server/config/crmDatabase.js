// CRM specific database functions
// This file will contain CRM-specific database operations
const { Pool } = require('pg');

// CRM Database connection pool
const crmPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// CRM Database utility functions
const crmDb = {
  // Execute query with parameters
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await crmPool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },

  // Get single row
  getRow: async (text, params) => {
    const res = await crmPool.query(text, params);
    return res.rows[0];
  },

  // Get multiple rows
  getRows: async (text, params) => {
    const res = await crmPool.query(text, params);
    return res.rows;
  },

  // Execute transaction
  transaction: async (callback) => {
    const client = await crmPool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Set company context for RLS (formerly tenant context)
  setCompanyContext: async (companyId) => {
    await crmPool.query('SELECT set_company_context($1)', [companyId]);
  },

  // Legacy method for backward compatibility
  setTenantContext: async (tenantId) => {
    console.warn('setTenantContext is deprecated. Use setCompanyContext instead.');
    await crmPool.query('SELECT set_company_context($1)', [tenantId]);
  },

  // Get current company context
  getCurrentCompanyContext: async () => {
    const result = await crmPool.query('SELECT current_setting($1) as company_id', ['app.current_company_id']);
    return result.rows[0]?.company_id;
  },

  // Legacy method for backward compatibility
  getCurrentTenantContext: async () => {
    console.warn('getCurrentTenantContext is deprecated. Use getCurrentCompanyContext instead.');
    return await crmDb.getCurrentCompanyContext();
  },

  // Close pool
  close: async () => {
    await crmPool.end();
  }
};

module.exports = crmDb;