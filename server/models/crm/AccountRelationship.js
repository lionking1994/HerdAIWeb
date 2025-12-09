// Account relationship model
// This file will contain the AccountRelationship schema and methods
const db = require('../../config/crmDatabase');
const { v4: uuidv4 } = require('uuid');

class AccountRelationship {
  static async create(relationshipData, tenantId) {
    const { parent_account_id, child_account_id, relationship_type, description, created_by } = relationshipData;
    
    const id = uuidv4();
    
    const query = `
      INSERT INTO account_relationships (
        id, tenant_id, parent_account_id, child_account_id, relationship_type, description, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await db.getRow(query, [
      id, tenantId, parent_account_id, child_account_id, relationship_type || 'related', description, created_by
    ]);
    
    return result;
  }

  static async findById(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'SELECT * FROM account_relationships WHERE id = $1';
    return await db.getRow(query, [id]);
  }

  static async findByAccount(accountId, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        ar.*,
        parent.name as parent_account_name,
        child.name as child_account_name
      FROM account_relationships ar
      JOIN accounts parent ON ar.parent_account_id = parent.id
      JOIN accounts child ON ar.child_account_id = child.id
      WHERE (ar.parent_account_id = $1 OR ar.child_account_id = $1) AND ar.tenant_id = $2
      ORDER BY ar.created_at DESC
    `;
    
    return await db.getRows(query, [accountId, tenantId]);
  }

  static async update(id, updateData, tenantId) {
    await db.setTenantContext(tenantId);
    
    const { relationship_type, description } = updateData;
    
    const query = `
      UPDATE account_relationships 
      SET relationship_type = COALESCE($2, relationship_type),
          description = COALESCE($3, description)
      WHERE id = $1 AND tenant_id = $4
      RETURNING *
    `;
    
    return await db.getRow(query, [id, relationship_type, description, tenantId]);
  }

  static async delete(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'DELETE FROM account_relationships WHERE id = $1 AND tenant_id = $2 RETURNING *';
    return await db.getRow(query, [id, tenantId]);
  }

  static async getAccountHierarchy(accountId, tenantId) {
    await db.setTenantContext(tenantId);
    
    // Get parent accounts (ancestors)
    const parentQuery = `
      WITH RECURSIVE account_hierarchy AS (
        SELECT ar.parent_account_id, ar.relationship_type, ar.description, 1 as level
        FROM account_relationships ar
        WHERE ar.child_account_id = $1 AND ar.tenant_id = $2
        
        UNION ALL
        
        SELECT ar2.parent_account_id, ar2.relationship_type, ar2.description, ah.level + 1
        FROM account_relationships ar2
        JOIN account_hierarchy ah ON ar2.child_account_id = ah.parent_account_id
        WHERE ar2.tenant_id = $2
      )
      SELECT DISTINCT ah.*, a.name as account_name, a.industry
      FROM account_hierarchy ah
      JOIN accounts a ON ah.parent_account_id = a.id
      ORDER BY ah.level
    `;
    
    // Get child accounts (descendants)
    const childQuery = `
      WITH RECURSIVE account_hierarchy AS (
        SELECT ar.child_account_id, ar.relationship_type, ar.description, 1 as level
        FROM account_relationships ar
        WHERE ar.parent_account_id = $1 AND ar.tenant_id = $2
        
        UNION ALL
        
        SELECT ar2.child_account_id, ar2.relationship_type, ar2.description, ah.level + 1
        FROM account_relationships ar2
        JOIN account_hierarchy ah ON ar2.parent_account_id = ah.child_account_id
        WHERE ar2.tenant_id = $2
      )
      SELECT DISTINCT ah.*, a.name as account_name, a.industry
      FROM account_hierarchy ah
      JOIN accounts a ON ah.child_account_id = a.id
      ORDER BY ah.level
    `;
    
    const [parents, children] = await Promise.all([
      db.getRows(parentQuery, [accountId, tenantId]),
      db.getRows(childQuery, [accountId, tenantId])
    ]);
    
    return { parents, children };
  }
}

module.exports = AccountRelationship;