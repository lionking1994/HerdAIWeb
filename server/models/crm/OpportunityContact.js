// Junction table model
// This file will contain the OpportunityContact schema and methods
const db = require('../../config/crmDatabase');
const { v4: uuidv4 } = require('uuid');

class OpportunityContact {
  static async create(relationshipData, tenantId) {
    const { opportunity_id, contact_id, role } = relationshipData;
    
    const id = uuidv4();
    
    const query = `
      INSERT INTO opportunity_contacts (
        id, tenant_id, opportunity_id, contact_id, role
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await db.getRow(query, [
      id, tenantId, opportunity_id, contact_id, role || 'influencer'
    ]);
    
    return result;
  }

  static async findByOpportunity(opportunityId, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        oc.*,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.title
      FROM opportunity_contacts oc
      JOIN contacts c ON oc.contact_id = c.id
      WHERE oc.opportunity_id = $1 AND oc.tenant_id = $2
      ORDER BY c.last_name, c.first_name
    `;
    
    return await db.getRows(query, [opportunityId, tenantId]);
  }

  static async findByContact(contactId, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        oc.*,
        o.name as opportunity_name,
        o.stage,
        o.amount,
        o.expected_close_date
      FROM opportunity_contacts oc
      JOIN opportunities o ON oc.opportunity_id = o.id
      WHERE oc.contact_id = $1 AND oc.tenant_id = $2
      ORDER BY o.expected_close_date DESC
    `;
    
    return await db.getRows(query, [contactId, tenantId]);
  }

  static async update(id, updateData, tenantId) {
    await db.setTenantContext(tenantId);
    
    const { role } = updateData;
    
    const query = `
      UPDATE opportunity_contacts 
      SET role = COALESCE($2, role)
      WHERE id = $1 AND tenant_id = $3
      RETURNING *
    `;
    
    return await db.getRow(query, [id, role, tenantId]);
  }

  static async delete(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'DELETE FROM opportunity_contacts WHERE id = $1 AND tenant_id = $2 RETURNING *';
    return await db.getRow(query, [id, tenantId]);
  }
}

module.exports = OpportunityContact;