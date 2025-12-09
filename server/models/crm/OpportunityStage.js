// Stage model
// This file will contain the OpportunityStage schema and methods
const db = require('../../config/crmDatabase');
const { v4: uuidv4 } = require('uuid');

class OpportunityStage {
  static async create(stageData, tenantId) {
    const {
      name, description, order_index, weight_percentage, is_active, is_closed_won, is_closed_lost
    } = stageData;
    
    const id = uuidv4();
    
    const query = `
      INSERT INTO opportunity_stages (
        id, tenant_id, name, description, order_index, weight_percentage, is_active, is_closed_won, is_closed_lost
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await db.getRow(query, [
      id, tenantId, name, description, order_index || 0, weight_percentage || 0, is_active !== false, is_closed_won || false, is_closed_lost || false
    ]);
    
    return result;
  }

  static async findById(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'SELECT * FROM opportunity_stages WHERE id = $1';
    return await db.getRow(query, [id]);
  }

  static async findByTenant(tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'SELECT * FROM opportunity_stages WHERE tenant_id = $1 ORDER BY order_index, name';
    return await db.getRows(query, [tenantId]);
  }

  static async update(id, updateData, tenantId) {
    await db.setTenantContext(tenantId);
    
    const {
      name, description, order_index, weight_percentage, is_active, is_closed_won, is_closed_lost
    } = updateData;
    
    const query = `
      UPDATE opportunity_stages 
      SET name = COALESCE($2, name),
          description = COALESCE($3, description),
          order_index = COALESCE($4, order_index),
          weight_percentage = COALESCE($5, weight_percentage),
          is_active = COALESCE($6, is_active),
          is_closed_won = COALESCE($7, is_closed_won),
          is_closed_lost = COALESCE($8, is_closed_lost),
          updated_at = NOW()
      WHERE id = $1 AND tenant_id = $9
      RETURNING *
    `;
    
    return await db.getRow(query, [
      id, name, description, order_index, weight_percentage, is_active, is_closed_won, is_closed_lost, tenantId
    ]);
  }

  static async delete(id, tenantId) {
    await db.setTenantContext(tenantId);
    
    // Check if stage is being used by opportunities
    const usageCheck = await db.getRow(
      'SELECT COUNT(*) as count FROM opportunities WHERE stage_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (parseInt(usageCheck.count) > 0) {
      throw new Error('Cannot delete stage that is in use by opportunities');
    }
    
    const query = 'DELETE FROM opportunity_stages WHERE id = $1 AND tenant_id = $2 RETURNING *';
    return await db.getRow(query, [id, tenantId]);
  }

  static async reorder(tenantId, stageOrders) {
    await db.setTenantContext(tenantId);
    
    return await db.transaction(async (client) => {
      for (const { id, order_index } of stageOrders) {
        await client.query(
          'UPDATE opportunity_stages SET order_index = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
          [order_index, id, tenantId]
        );
      }
    });
  }
}

module.exports = OpportunityStage;