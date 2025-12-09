// Opportunity model
// This file will contain the Opportunity schema and methods
const db = require('../../config/crmDatabase');
const { v4: uuidv4 } = require('uuid');

class Opportunity {
  static async create(opportunityData, tenantId) {
    const {
      label, description, amount, probability, stage, stage_id,
      expected_close_date, actual_close_date, account_id, owner_id, lead_source, meeting_id, custom_fields
    } = opportunityData;
    
    // Check for duplicate opportunities before creating
    const duplicateChecks = [];
    
    // Similarity threshold for name matching (0.7 = 70% similarity for names)
    const NAME_SIMILARITY_THRESHOLD = 0.7;
    let nameCheck;
    // Check for similar name within the same account
    if (label && account_id) {
      nameCheck = await db.getRow(
        `SELECT id, name, account_id, 
         similarity(LOWER(name), LOWER($2)) as name_similarity
         FROM opportunities 
         WHERE tenant_id = $1 
         AND account_id = $3
         AND similarity(LOWER(name), LOWER($2)) > $4`,
        [tenantId, label, account_id, NAME_SIMILARITY_THRESHOLD]
      );
      if (nameCheck) {
        duplicateChecks.push(`Opportunity with similar name "${nameCheck.name}" (${Math.round(nameCheck.name_similarity * 100)}% similarity) already exists for this account`);
      }
    }
    
    // Check for similar name across all accounts (optional - uncomment if needed)
    // if (label) {
    //   const globalNameCheck = await db.getRow(
    //     `SELECT id, name, account_id, 
    //      similarity(LOWER(name), LOWER($2)) as name_similarity
    //      FROM opportunities 
    //      WHERE tenant_id = $1 
    //      AND similarity(LOWER(name), LOWER($2)) > $3`,
    //     [tenantId, label, NAME_SIMILARITY_THRESHOLD]
    //   );
    //   if (globalNameCheck) {
    //     duplicateChecks.push(`Opportunity with similar name "${globalNameCheck.name}" (${Math.round(globalNameCheck.name_similarity * 100)}% similarity) already exists`);
    //   }
    // }
    
    // If duplicates found, return the existing record
    if (duplicateChecks.length > 0) {
      // Return the first duplicate found (most similar match)
      if (nameCheck) {
        return nameCheck;
      }
    }
    
    const id = uuidv4();
    
    const query = `
      INSERT INTO opportunities (
        id, tenant_id, name, description, amount, probability, stage, stage_id,
        expected_close_date, actual_close_date, account_id, owner_id, lead_source, meeting_id, custom_fields
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const result = await db.getRow(query, [
      id, tenantId, label, description || null, amount || null, probability || null, stage || null, stage_id || null,
      expected_close_date || null, actual_close_date || null, account_id || null, owner_id || null, lead_source || null, meeting_id || null, custom_fields || {}
    ]);
    
    return result;
  }

  static async findById(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'SELECT * FROM opportunities WHERE id = $1';
    return await db.getRow(query, [id]);
  }

  static async findByTenant(tenantId, searchTerm = null) {
    await db.setTenantContext(tenantId);
    
    let query = `
      SELECT 
        o.*,
        a.name as account_name,
        s.name as stage_name
      FROM opportunities o
      LEFT JOIN accounts a ON o.account_id = a.id
      LEFT JOIN opportunity_stages s ON o.stage_id = s.id
      WHERE o.tenant_id = $1
    `;
    let params = [tenantId];
    
    if (searchTerm) {
      query += ` AND (
        o.name ILIKE $2 OR 
        o.description ILIKE $2 OR 
        o.lead_source ILIKE $2 OR
        o.custom_fields::text ILIKE $2
      )`;
      params.push(`%${searchTerm}%`);
    }
    
    query += ' ORDER BY o.created_at DESC';
    return await db.getRows(query, params);
  }

  static async update(id, updateData, tenantId) {
    await db.setTenantContext(tenantId);

    const {
      name, description, amount, probability, stage, stage_id,
      expected_close_date, actual_close_date, account_id, owner_id, lead_source, meeting_id, custom_fields
    } = updateData;
    
    const query = `
      UPDATE opportunities
      SET name = COALESCE($2, name),
          description = COALESCE($3, description),
          amount = COALESCE($4, amount),
          probability = COALESCE($5, probability),
          stage = COALESCE($6, stage),
          stage_id = COALESCE($7, stage_id),
          expected_close_date = COALESCE($8, expected_close_date),
          actual_close_date = COALESCE($9, actual_close_date),
          account_id = COALESCE($10, account_id),
          owner_id = COALESCE($11, owner_id),
          lead_source = COALESCE($12, lead_source),
          meeting_id = COALESCE($13, meeting_id),
          custom_fields = COALESCE($14, custom_fields),
          updated_at = NOW()
      WHERE id = $1 AND tenant_id = $15
      RETURNING *
    `;

    return await db.getRow(query, [
      id, name, description, amount, probability, stage, stage_id,
      expected_close_date, actual_close_date, account_id, owner_id, lead_source, meeting_id, custom_fields, tenantId
    ]);
  }

  static async delete(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'DELETE FROM opportunities WHERE id = $1 AND tenant_id = $2 RETURNING *';
    return await db.getRow(query, [id, tenantId]);
  }

  static async getPipeline(tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        s.id as stage_id,
        s.name as stage_name,
        s.order_index,
        COUNT(o.id) as opportunity_count,
        COALESCE(SUM(o.amount), 0) as total_amount
      FROM opportunity_stages s
      LEFT JOIN opportunities o ON s.id = o.stage_id AND o.tenant_id = s.tenant_id
      WHERE s.tenant_id = $1 AND s.is_active = true
      GROUP BY s.id, s.name, s.order_index
      ORDER BY s.order_index
    `;
    
    return await db.getRows(query, [tenantId]);
  }
}

module.exports = Opportunity;