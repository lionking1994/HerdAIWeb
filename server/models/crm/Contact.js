// Contact model
// This file will contain the Contact schema and methods
const db = require('../../config/crmDatabase');
const { v4: uuidv4 } = require('uuid');

class Contact {
  static async create(contactData, tenantId) {
    const {
      label, email, phone, mobile_phone, title,
      department, address1, address2, city, state, zip, country, custom_fields
    } = contactData;
    
    // Check for duplicate contacts before creating
    const duplicateChecks = [];
    
    // Similarity threshold for name matching (0.7 = 70% similarity for names, 0.9 = 90% for emails)
    const NAME_SIMILARITY_THRESHOLD = 0.7;
    const EMAIL_SIMILARITY_THRESHOLD = 0.9;
    
    // Parse first and last name from label
    let first_name = label.split(' ')[0] || ""; 
    let last_name = label.split(' ')[1] || "";
    let nameCheck, emailCheck;
    // Check for similar first_name + last_name combination
    if (first_name && last_name) {
      nameCheck = await db.getRow(
        `SELECT id, first_name, last_name, 
         similarity(LOWER(first_name), LOWER($2)) as first_name_similarity,
         similarity(LOWER(last_name), LOWER($3)) as last_name_similarity,
         (similarity(LOWER(first_name), LOWER($2)) + similarity(LOWER(last_name), LOWER($3))) / 2 as avg_similarity
         FROM contacts 
         WHERE tenant_id = $1 
         AND (similarity(LOWER(first_name), LOWER($2)) + similarity(LOWER(last_name), LOWER($3))) / 2 > $4`,
        [tenantId, first_name, last_name, NAME_SIMILARITY_THRESHOLD]
      );
      if (nameCheck) {
        duplicateChecks.push(`Contact with similar name "${nameCheck.first_name} ${nameCheck.last_name}" (${Math.round(nameCheck.avg_similarity * 100)}% similarity) already exists`);
      }
    }
    
    // Check for similar email
    if (email) {
      emailCheck = await db.getRow(
        `SELECT id, first_name, last_name, email, 
         similarity(LOWER(email), LOWER($2)) as email_similarity
         FROM contacts 
         WHERE tenant_id = $1 
         AND similarity(LOWER(email), LOWER($2)) > $3`,
        [tenantId, email, EMAIL_SIMILARITY_THRESHOLD]
      );
      if (emailCheck) {
        duplicateChecks.push(`Contact with similar email "${emailCheck.email}" (${Math.round(emailCheck.email_similarity * 100)}% similarity) already exists`);
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
      INSERT INTO contacts (
        id, tenant_id, first_name, last_name, email, phone, mobile_phone,
        title, department, address1, address2, city, state, zip, country, custom_fields
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    
    const result = await db.getRow(query, [
      id, tenantId, first_name || "", last_name || "", email || "", phone || "", mobile_phone || "",
      title || "", department || "", address1 || "", address2 || "", city || "", state || "", zip || "", country || 'US', custom_fields || {}
    ]);
    
    return result;
  }

  static async findById(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'SELECT * FROM contacts WHERE id = $1';
    return await db.getRow(query, [id]);
  }

  static async findByTenant(tenantId, searchTerm = null) {
    await db.setTenantContext(tenantId);
    
    let query = 'SELECT * FROM contacts WHERE tenant_id = $1';
    let params = [tenantId];
    
    if (searchTerm) {
      query += ` AND (
        first_name ILIKE $2 OR 
        last_name ILIKE $2 OR 
        email ILIKE $2 OR 
        phone ILIKE $2 OR 
        mobile_phone ILIKE $2 OR
        title ILIKE $2 OR
        department ILIKE $2 OR
        custom_fields::text ILIKE $2
      )`;
      params.push(`%${searchTerm}%`);
    }
    
    query += ' ORDER BY last_name, first_name';
    return await db.getRows(query, params);
  }

  static async update(id, updateData, tenantId) {
    await db.setTenantContext(tenantId);
    
    const {
      first_name, last_name, email, phone, mobile_phone, title,
      department, address1, address2, city, state, zip, country, custom_fields
    } = updateData;
    
    const query = `
      UPDATE contacts 
      SET first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          email = COALESCE($4, email),
          phone = COALESCE($5, phone),
          mobile_phone = COALESCE($6, mobile_phone),
          title = COALESCE($7, title),
          department = COALESCE($8, department),
          address1 = COALESCE($9, address1),
          address2 = COALESCE($10, address2),
          city = COALESCE($11, city),
          state = COALESCE($12, state),
          zip = COALESCE($13, zip),
          country = COALESCE($14, country),
          custom_fields = COALESCE($15, custom_fields),
          updated_at = NOW()
      WHERE id = $1 AND tenant_id = $16
      RETURNING *
    `;
    
    return await db.getRow(query, [
      id, first_name, last_name, email, phone, mobile_phone, title,
      department, address1, address2, city, state, zip, country, custom_fields, tenantId
    ]);
  }

  static async delete(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'DELETE FROM contacts WHERE id = $1 AND tenant_id = $2 RETURNING *';
    return await db.getRow(query, [id, tenantId]);
  }

  static async getWithAccounts(id, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        c.*,
        json_agg(
          json_build_object(
            'account_id', ac.account_id,
            'account_name', a.name,
            'role', ac.role,
            'is_primary', ac.is_primary,
            'relationship_type', ac.relationship_type,
            'description', ac.description
          )
        ) as accounts
      FROM contacts c
      LEFT JOIN account_contacts ac ON c.id = ac.contact_id
      LEFT JOIN accounts a ON ac.account_id = a.id
      WHERE c.id = $1 AND c.tenant_id = $2
      GROUP BY c.id
    `;
    
    return await db.getRow(query, [id, tenantId]);
  }
}

module.exports = Contact;