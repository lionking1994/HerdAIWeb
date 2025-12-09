const pool = require("../config/database");

// Get tenant ID from request (either from query params, request body, or user context)
// tenant_id is now an INTEGER that matches company.id
const getTenantId = async (req) => {
  // First try to get from request body (for API calls)
  if (req.body && req.body.tenantId) {
    const tenantId = parseInt(req.body.tenantId);
    console.log(
      `🔍 Found tenantId in request body: ${req.body.tenantId} (parsed as: ${tenantId})`
    );
    console.log(`🔍 Request body:`, req.body);

    // Check if company exists for this ID (since tenant_id now matches company.id)
    const company = await pool.query("SELECT * FROM company WHERE id = $1", [
      tenantId,
    ]);

    console.log(`🔍 Company query result:`, company.rows);

    if (company.rows.length === 0) {
      throw new Error(`Company with ID ${tenantId} not found`);
    }

    console.log(`✅ Found company: ${company.rows[0].name} (ID: ${tenantId})`);
    return tenantId;
  }

  // Second try to get from query parameters (for admin panel)
  if (req.query.company) {
    const companyId = parseInt(req.query.company);
    console.log(`🔍 Found company in query params: ${companyId}`);

    // Check if company exists for this ID
    const company = await pool.query("SELECT * FROM company WHERE id = $1", [
      companyId,
    ]);

    //Get tenants from company, don't exist, create and return it's id

    const tenants = await pool.query("SELECT * FROM tenants WHERE id = $1", [
      companyId,
    ]);

    if (tenants.rows.length === 0) {
      const newTenant = await pool.query(
        "INSERT INTO tenants (id, name, subdomain, is_active, created_at, updated_at) VALUES ($1, $2, $3, true, NOW(), NOW()) RETURNING *",
        [companyId, company.rows[0].name, company.rows[0].domain]
      );
      return newTenant.rows[0].id;
    }
    return tenants.rows[0].id; // return tenant id
  }

  // Third try to get from user's company (for regular users)
  if (req.user && req.user.company_id) {
    console.log(`🔍 Found company_id in user object: ${req.user.company_id}`);
    return req.user.company_id;
  }

  // If none exists, throw error
  throw new Error(
    "Tenant ID is required. Please provide tenantId in request body, company parameter, or ensure user has company_id."
  );
};

// Get or create tenant based on user's email domain
// tenant_id will now match company.id
const getOrCreateTenant = async (userEmail) => {
  const domain = userEmail.split("@")[1];

  // Get company based on domain
  let company = await pool.query("SELECT * FROM company WHERE domain = $1", [
    domain,
  ]);

  if (company.rows.length === 0) {
    // Create company if it doesn't exist
    company = await pool.query(
      `INSERT INTO company (name, domain, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *`,
      [domain, domain]
    );
  }

  // Now get or create tenant with matching ID
  let tenant = await pool.query("SELECT * FROM tenants WHERE id = $1", [
    company.rows[0].id,
  ]);

  if (tenant.rows.length === 0) {
    // Create tenant with matching ID
    tenant = await pool.query(
      `INSERT INTO tenants (id, name, subdomain, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())
       RETURNING *`,
      [company.rows[0].id, company.rows[0].name, company.rows[0].domain]
    );
  }

  return tenant.rows[0];
};

// Get tenant based on user's email domain (doesn't create if missing)
// tenant_id will now match company.id
const getTenant = async (userEmail) => {
  const domain = userEmail.split("@")[1];

  // Get company based on domain
  const company = await pool.query("SELECT * FROM company WHERE domain = $1", [
    domain,
  ]);

  if (company.rows.length === 0) {
    return null;
  }

  // Get tenant with matching ID
  const tenant = await pool.query("SELECT * FROM tenants WHERE id = $1", [
    company.rows[0].id,
  ]);

  return tenant.rows[0];
};

// Legacy functions for backward compatibility (will be removed)
const getCompanyId = (req) => {
  console.warn("getCompanyId is deprecated. Use getTenantId instead.");
  return getTenantId(req);
};

const getOrCreateCompany = async (userEmail) => {
  console.warn(
    "getOrCreateCompany is deprecated. Use getOrCreateTenant instead."
  );
  return await getOrCreateTenant(userEmail);
};

const getCompany = async (userEmail) => {
  console.warn("getCompany is deprecated. Use getTenant instead.");
  return await getTenant(userEmail);
};

module.exports = {
  getTenantId,
  getOrCreateTenant,
  getTenant,
  // Legacy exports for backward compatibility
  getCompanyId,
  getOrCreateCompany,
  getCompany,
};
