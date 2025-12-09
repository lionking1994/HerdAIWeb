// Account model
// This file will contain the Account schema and methods
const db = require('../../config/crmDatabase');
const { v4: uuidv4 } = require('uuid');

class Account {
  static async create(accountData, tenantId) {
    const {
      label, description, parent_account_id, account_type, industry,
      website, phone, email, billing_address, shipping_address, custom_fields
    } = accountData;
    
    // Check for duplicate accounts before creating
    const duplicateChecks = [];
    
    // Similarity threshold for name matching (0.6 = 60% similarity for names, 0.9 = 90% for emails)
    const NAME_SIMILARITY_THRESHOLD = 0.6;
    const EMAIL_SIMILARITY_THRESHOLD = 0.9;
    let nameCheck, emailCheck;
    
    // Check for similar name with additional business name logic
    if (label) {
      // First try exact match (case-insensitive)
      nameCheck = await db.getRow(
        `SELECT id, name, 1.0 as name_similarity
         FROM accounts 
         WHERE tenant_id = $1 
         AND LOWER(name) = LOWER($2)`,
        [tenantId, label]
      );
      
      // If no exact match, check for similar names
      if (!nameCheck) {
        nameCheck = await db.getRow(
          `SELECT id, name, 
           similarity(LOWER(name), LOWER($2)) as name_similarity
           FROM accounts 
           WHERE tenant_id = $1 
           AND similarity(LOWER(name), LOWER($2)) > $3
           ORDER BY similarity(LOWER(name), LOWER($2)) DESC
           LIMIT 1`,
          [tenantId, label, NAME_SIMILARITY_THRESHOLD]
        );
      }
      
      // Additional check for common business name variations
      if (!nameCheck) {
        const cleanLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '');
        nameCheck = await db.getRow(
          `SELECT id, name, 
           similarity(LOWER(REGEXP_REPLACE(name, '[^a-z0-9]', '', 'g')), $2) as name_similarity
           FROM accounts 
           WHERE tenant_id = $1 
           AND similarity(LOWER(REGEXP_REPLACE(name, '[^a-z0-9]', '', 'g')), $2) > $3
           ORDER BY similarity(LOWER(REGEXP_REPLACE(name, '[^a-z0-9]', '', 'g')), $2) DESC
           LIMIT 1`,
          [tenantId, cleanLabel, NAME_SIMILARITY_THRESHOLD]
        );
      }
      
      if (nameCheck) {
        duplicateChecks.push(`Account with similar name "${nameCheck.name}" (${Math.round(nameCheck.name_similarity * 100)}% similarity) already exists`);
      }
    }
    
    // Check for similar email
    if (email) {
      emailCheck = await db.getRow(
        `SELECT id, name, email, 
         similarity(LOWER(email), LOWER($2)) as email_similarity
         FROM accounts 
         WHERE tenant_id = $1 
         AND similarity(LOWER(email), LOWER($2)) > $3`,
        [tenantId, email, EMAIL_SIMILARITY_THRESHOLD]
      );
      if (emailCheck) {
        duplicateChecks.push(`Account with similar email "${emailCheck.email}" (${Math.round(emailCheck.email_similarity * 100)}% similarity) already exists`);
      }
    }
    
    // If duplicates found, return the existing record
    if (duplicateChecks.length > 0) {
      // Return the first duplicate found (most similar match)
      if (nameCheck) {
        return nameCheck;
      }
      if (emailCheck) {
        return emailCheck;
      }
    }
    
    const id = uuidv4();
    
    const query = `
      INSERT INTO accounts (
        id, tenant_id, name, description, parent_account_id, account_type,
        industry, website, phone, email, billing_address, shipping_address, custom_fields
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const result = await db.getRow(query, [
      id, tenantId, label || "", description || "", parent_account_id || null, account_type || "",
      industry || "", website || "", phone || "", email || "", billing_address || {}, shipping_address || {}, custom_fields || {}
    ]);
    
    return result;
  }

  static async findById(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'SELECT * FROM accounts WHERE id = $1';
    return await db.getRow(query, [id]);
  }

  static async findByTenant(tenantId, searchTerm = null) {
    await db.setTenantContext(tenantId);
    
    let query = 'SELECT * FROM accounts WHERE tenant_id = $1';
    let params = [tenantId];
    
    if (searchTerm) {
      query += ` AND (
        name ILIKE $2 OR 
        description ILIKE $2 OR 
        industry ILIKE $2 OR 
        website ILIKE $2 OR 
        phone ILIKE $2 OR 
        email ILIKE $2 OR
        custom_fields::text ILIKE $2
      )`;
      params.push(`%${searchTerm}%`);
    }
    
    query += ' ORDER BY name';
    return await db.getRows(query, params);
  }

  static async update(id, updateData, tenantId) {
    await db.setTenantContext(tenantId);
    
    const {
      name, description, parent_account_id, account_type, industry,
      website, phone, email, billing_address, shipping_address, custom_fields
    } = updateData;
    
    const query = `
      UPDATE accounts 
      SET name = COALESCE($2, name),
          description = COALESCE($3, description),
          parent_account_id = COALESCE($4, parent_account_id),
          account_type = COALESCE($5, account_type),
          industry = COALESCE($6, industry),
          website = COALESCE($7, website),
          phone = COALESCE($8, phone),
          email = COALESCE($9, email),
          billing_address = COALESCE($10, billing_address),
          shipping_address = COALESCE($11, shipping_address),
          custom_fields = COALESCE($12, custom_fields),
          updated_at = NOW()
      WHERE id = $1 AND tenant_id = $13
      RETURNING *
    `;
    
    return await db.getRow(query, [
      id, name, description, parent_account_id, account_type, industry,
      website, phone, email, billing_address, shipping_address, custom_fields, tenantId
    ]);
  }

  static async delete(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'DELETE FROM accounts WHERE id = $1 AND tenant_id = $2 RETURNING *';
    return await db.getRow(query, [id, tenantId]);
  }

  static async getWithRelations(id, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        a.*,
        p.name as parent_account_name,
        COUNT(ac.contact_id) as contact_count,
        COUNT(o.id) as opportunity_count
      FROM accounts a
      LEFT JOIN accounts p ON a.parent_account_id = p.id
      LEFT JOIN account_contacts ac ON a.id = ac.account_id
      LEFT JOIN opportunities o ON a.id = o.account_id
      WHERE a.id = $1 AND a.tenant_id = $2
      GROUP BY a.id, p.name
    `;
    
    return await db.getRow(query, [id, tenantId]);
  }
}

module.exports = Account;