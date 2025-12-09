// Relationship Type Definition model
// This file contains the RelationshipTypeDefinition schema and methods
const db = require('../../config/crmDatabase');
const { v4: uuidv4 } = require('uuid');

class RelationshipTypeDefinition {
  static async create(definitionData, tenantId) {
    const { 
      name, 
      description, 
      entity_type_from, 
      entity_type_to, 
      is_active = true, 
      sort_order = 0 
    } = definitionData;
    
    const id = uuidv4();
    
    const query = `
      INSERT INTO relationship_type_definitions (
        id, tenant_id, name, description, entity_type_from, entity_type_to, is_active, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await db.getRow(query, [
      id, tenantId, name, description, entity_type_from, entity_type_to, is_active, sort_order
    ]);
    
    return result;
  }

  static async findById(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'SELECT * FROM relationship_type_definitions WHERE id = $1';
    return await db.getRow(query, [id]);
  }

  static async findByEntityTypes(entityTypeFrom, entityTypeTo, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT * FROM relationship_type_definitions 
      WHERE entity_type_from = $1 AND entity_type_to = $2 AND tenant_id = $3 AND is_active = true
      ORDER BY sort_order ASC, name ASC
    `;
    
    return await db.getRows(query, [entityTypeFrom, entityTypeTo, tenantId]);
  }

  static async findAll(tenantId, includeInactive = false) {
    await db.setTenantContext(tenantId);
    
    let query = 'SELECT * FROM relationship_type_definitions WHERE tenant_id = $1';
    let params = [tenantId];
    
    if (!includeInactive) {
      query += ' AND is_active = true';
    }
    
    query += ' ORDER BY entity_type_from ASC, entity_type_to ASC, sort_order ASC, name ASC';
    
    return await db.getRows(query, params);
  }

  static async update(id, updateData, tenantId) {
    await db.setTenantContext(tenantId);
    
    const { 
      name, 
      description, 
      entity_type_from, 
      entity_type_to, 
      is_active, 
      sort_order 
    } = updateData;
    
    const query = `
      UPDATE relationship_type_definitions 
      SET name = COALESCE($2, name),
          description = COALESCE($3, description),
          entity_type_from = COALESCE($4, entity_type_from),
          entity_type_to = COALESCE($5, entity_type_to),
          is_active = COALESCE($6, is_active),
          sort_order = COALESCE($7, sort_order),
          updated_at = now()
      WHERE id = $1 AND tenant_id = $8
      RETURNING *
    `;
    
    return await db.getRow(query, [
      id, name, description, entity_type_from, entity_type_to, is_active, sort_order, tenantId
    ]);
  }

  static async delete(id, tenantId) {
    await db.setTenantContext(tenantId);
    
    // Check if this relationship type is being used
    const usageQuery = `
      SELECT 
        (SELECT COUNT(*) FROM account_relationships WHERE relationship_type_id = $1) as account_relationships,
        (SELECT COUNT(*) FROM account_contacts WHERE relationship_type_id = $1) as account_contacts,
        (SELECT COUNT(*) FROM opportunity_contacts WHERE relationship_type_id = $1) as opportunity_contacts
    `;
    
    const usage = await db.getRow(usageQuery, [id]);
    const totalUsage = parseInt(usage.account_relationships) + parseInt(usage.account_contacts) + parseInt(usage.opportunity_contacts);
    
    if (totalUsage > 0) {
      throw new Error(`Cannot delete relationship type. It is being used by ${totalUsage} relationship(s).`);
    }
    
    const query = 'DELETE FROM relationship_type_definitions WHERE id = $1 AND tenant_id = $2 RETURNING *';
    return await db.getRow(query, [id, tenantId]);
  }

  static async getEntityTypeCombinations(tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT DISTINCT entity_type_from, entity_type_to
      FROM relationship_type_definitions 
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY entity_type_from ASC, entity_type_to ASC
    `;
    
    return await db.getRows(query, [tenantId]);
  }

  static async bulkUpdateSortOrder(sortOrderData, tenantId) {
    await db.setTenantContext(tenantId);
    
    const updates = [];
    for (const item of sortOrderData) {
      updates.push(
        db.getRow(
          'UPDATE relationship_type_definitions SET sort_order = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id',
          [item.sort_order, item.id, tenantId]
        )
      );
    }
    
    return await Promise.all(updates);
  }
}

module.exports = RelationshipTypeDefinition;
