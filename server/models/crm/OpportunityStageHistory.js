// Stage history model
// This file will contain the OpportunityStageHistory schema and methods
const db = require('../../config/crmDatabase');

class OpportunityStageHistory {
  static async create(historyData, tenantId) {
    const { opportunity_id, stage_id, created_by } = historyData;
    
    const query = `
      INSERT INTO opportunity_stage_history (
        tenant_id, opportunity_id, stage_id, created_by
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    return await db.getRow(query, [tenantId, opportunity_id, stage_id, created_by]);
  }

  static async findByOpportunity(opportunityId, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        h.*,
        s.name as stage_name,
        s.description as stage_description
      FROM opportunity_stage_history h
      JOIN opportunity_stages s ON h.stage_id = s.id
      WHERE h.opportunity_id = $1 AND h.tenant_id = $2
      ORDER BY h.entered_at DESC
    `;
    
    return await db.getRows(query, [opportunityId, tenantId]);
  }

  static async getStageDuration(opportunityId, stageId, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        entered_at,
        LEAD(entered_at) OVER (ORDER BY entered_at) as next_stage_date
      FROM opportunity_stage_history
      WHERE opportunity_id = $1 AND stage_id = $2 AND tenant_id = $3
      ORDER BY entered_at DESC
      LIMIT 1
    `;
    
    const result = await db.getRow(query, [opportunityId, stageId, tenantId]);
    
    if (!result) return null;
    
    const currentDate = new Date();
    const nextDate = result.next_stage_date ? new Date(result.next_stage_date) : currentDate;
    const duration = Math.floor((nextDate - new Date(result.entered_at)) / (1000 * 60 * 60 * 24));
    
    return {
      entered_at: result.entered_at,
      next_stage_date: result.next_stage_date,
      duration_days: duration
    };
  }
}

module.exports = OpportunityStageHistory;