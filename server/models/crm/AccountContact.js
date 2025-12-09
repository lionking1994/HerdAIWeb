// Junction table model
// This file will contain the AccountContact schema and methods
const db = require('../../config/crmDatabase');
const { v4: uuidv4 } = require('uuid');

class AccountContact {
  static async create(relationshipData, tenantId) {
    const { account_id, contact_id, role, is_primary, relationship_type, description } = relationshipData;
    
    const id = uuidv4();
    
    const query = `
      INSERT INTO account_contacts (
        id, tenant_id, account_id, contact_id, role, is_primary, relationship_type, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await db.getRow(query, [
      id, tenantId, account_id, contact_id, role, is_primary || false, relationship_type || 'contact', description
    ]);
    
    return result;
  }

  static async findByAccount(accountId, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        ac.*,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.title
      FROM account_contacts ac
      JOIN contacts c ON ac.contact_id = c.id
      WHERE ac.account_id = $1 AND ac.tenant_id = $2
      ORDER BY ac.is_primary DESC, c.last_name, c.first_name
    `;
    
    return await db.getRows(query, [accountId, tenantId]);
  }

  static async findByContact(contactId, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        ac.*,
        a.name as account_name,
        a.industry,
        a.account_type
      FROM account_contacts ac
      JOIN accounts a ON ac.account_id = a.id
      WHERE ac.contact_id = $1 AND ac.tenant_id = $2
      ORDER BY ac.is_primary DESC, a.name
    `;
    
    return await db.getRows(query, [contactId, tenantId]);
  }

  static async update(id, updateData, tenantId) {
    await db.setTenantContext(tenantId);
    
    const { role, is_primary, relationship_type, description } = updateData;
    
    const query = `
      UPDATE account_contacts 
      SET role = COALESCE($2, role),
          is_primary = COALESCE($3, is_primary),
          relationship_type = COALESCE($4, relationship_type),
          description = COALESCE($5, description)
      WHERE id = $1 AND tenant_id = $6
      RETURNING *
    `;
    
    return await db.getRow(query, [id, role, is_primary, relationship_type, description, tenantId]);
  }

  static async delete(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'DELETE FROM account_contacts WHERE id = $1 AND tenant_id = $2 RETURNING *';
    return await db.getRow(query, [id, tenantId]);
  }

  static async setPrimaryContact(accountId, contactId, tenantId) {
    await db.setTenantContext(tenantId);
    
    return await db.transaction(async (client) => {
      // Remove primary from all other contacts in this account
      await client.query(
        'UPDATE account_contacts SET is_primary = false WHERE account_id = $1 AND tenant_id = $2',
        [accountId, tenantId]
      );
      
      // Set the specified contact as primary
      await client.query(
        'UPDATE account_contacts SET is_primary = true WHERE account_id = $1 AND contact_id = $2 AND tenant_id = $3',
        [accountId, contactId, tenantId]
      );
      
      return true;
    });
  }
}

module.exports = AccountContact;