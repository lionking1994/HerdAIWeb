const pool = require('../../config/database');
const { getTenantId } = require('../../utils/crm');

// Create new relationship type (validation only - types are created when actual relationships are made)
const createRelationshipType = async (req, res) => {
  try {
    const definitionData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Creating relationship type for tenant ID:', tenantId);

    // Validation
    if (!definitionData.name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // Validate entity types - only allow the three supported combinations
    const validCombinations = [
      { from: 'account', to: 'account' },
      { from: 'account', to: 'contact' },
      { from: 'contact', to: 'opportunity' }
    ];

    const isValidCombination = validCombinations.some(combo => 
      combo.from === definitionData.entity_type_from && combo.to === definitionData.entity_type_to
    );

    if (!isValidCombination) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type combination. Only account-account, account-contact, and opportunity-contact relationships are supported.'
      });
    }

    // Check if relationship type already exists for this tenant across all relationship tables
    let existingType = null;
    
    if (definitionData.entity_type_from === 'account' && definitionData.entity_type_to === 'account') {
      existingType = await pool.query(
        'SELECT DISTINCT relationship_type FROM account_relationships WHERE tenant_id = $1 AND relationship_type = $2',
        [tenantId, definitionData.name]
      );
    } else if (definitionData.entity_type_from === 'account' && definitionData.entity_type_to === 'contact') {
      existingType = await pool.query(
        'SELECT DISTINCT relationship_type FROM account_contacts WHERE tenant_id = $1 AND relationship_type = $2',
        [tenantId, definitionData.name]
      );
    } else if (definitionData.entity_type_from === 'contact' && definitionData.entity_type_to === 'opportunity') {
      existingType = await pool.query(
        'SELECT DISTINCT role FROM opportunity_contacts WHERE tenant_id = $1 AND role = $2',
        [tenantId, definitionData.name]
      );
    }

    if (existingType && existingType.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Relationship type with this name already exists'
      });
    }

    // Since we can't insert into account_relationships without valid account IDs,
    // we'll just validate the input and return success
    // The actual relationship type will be created when someone creates a real relationship with this type

    res.status(201).json({
      success: true,
      message: 'Relationship type validated successfully. It will be created when used in an actual relationship.',
      data: { 
        name: definitionData.name, 
        description: definitionData.description || '',
        entity_type_from: definitionData.entity_type_from || 'account',
        entity_type_to: definitionData.entity_type_to || 'account',
        is_active: true,
        sort_order: definitionData.sort_order || 0
      }
    });

  } catch (error) {
    console.error('Error creating relationship type:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get all relationship types for tenant (from existing relationship tables)
const getRelationshipTypes = async (req, res) => {
  try {
    const { entity_type_from, entity_type_to } = req.query;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching relationship types for tenant ID:', tenantId);
    
    let definitions = [];
    
    // Get account-account relationship types
    if (!entity_type_from || !entity_type_to || 
        (entity_type_from === 'account' && entity_type_to === 'account')) {
      const accountResult = await pool.query(
        `SELECT DISTINCT 
          relationship_type as name,
          relationship_type as id,
          '' as description,
          'account' as entity_type_from,
          'account' as entity_type_to,
          true as is_active,
          0 as sort_order,
          MIN(created_at) as created_at,
          MIN(created_at) as updated_at
         FROM account_relationships 
         WHERE tenant_id = $1 AND relationship_type IS NOT NULL AND relationship_type != ''
         GROUP BY relationship_type`,
        [tenantId]
      );
      definitions.push(...accountResult.rows);
    }
    
    // Get account-contact relationship types
    if (!entity_type_from || !entity_type_to || 
        (entity_type_from === 'account' && entity_type_to === 'contact')) {
      const accountContactResult = await pool.query(
        `SELECT DISTINCT 
          relationship_type as name,
          relationship_type as id,
          '' as description,
          'account' as entity_type_from,
          'contact' as entity_type_to,
          true as is_active,
          0 as sort_order,
          MIN(created_at) as created_at,
          MIN(created_at) as updated_at
         FROM account_contacts 
         WHERE tenant_id = $1 AND relationship_type IS NOT NULL AND relationship_type != ''
         GROUP BY relationship_type`,
        [tenantId]
      );
      definitions.push(...accountContactResult.rows);
    }
    
    // Get contact-opportunity relationship types
    if (!entity_type_from || !entity_type_to || 
        (entity_type_from === 'contact' && entity_type_to === 'opportunity')) {
      const contactOpportunityResult = await pool.query(
        `SELECT DISTINCT 
          role as name,
          role as id,
          '' as description,
          'contact' as entity_type_from,
          'opportunity' as entity_type_to,
          true as is_active,
          0 as sort_order,
          MIN(created_at) as created_at,
          MIN(created_at) as updated_at
         FROM opportunity_contacts 
         WHERE tenant_id = $1 AND role IS NOT NULL AND role != ''
         GROUP BY role`,
        [tenantId]
      );
      definitions.push(...contactOpportunityResult.rows);
    }

    // Sort all definitions by name
    definitions.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: definitions
    });

  } catch (error) {
    console.error('Error fetching relationship types:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get relationship type by name (from existing account_relationships table)
const getRelationshipTypeById = async (req, res) => {
  try {
    const { id } = req.params; // This is actually the relationship type name
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching relationship type:', id, 'for tenant ID:', tenantId);
    
    const result = await pool.query(
      `SELECT DISTINCT 
        relationship_type as name,
        relationship_type as id,
        '' as description,
        'account' as entity_type_from,
        'account' as entity_type_to,
        true as is_active,
        0 as sort_order,
        MIN(created_at) as created_at,
        MIN(created_at) as updated_at
       FROM account_relationships 
       WHERE tenant_id = $1 AND relationship_type = $2
       GROUP BY relationship_type`,
      [tenantId, id]
    );
    
    const definition = result.rows[0];

    if (!definition) {
      return res.status(404).json({
        success: false,
        message: 'Relationship type not found'
      });
    }

    res.json({
      success: true,
      data: definition
    });

  } catch (error) {
    console.error('Error fetching relationship type:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update relationship type (rename existing relationship_type values)
const updateRelationshipType = async (req, res) => {
  try {
    const { id } = req.params; // This is the old relationship type name
    const updateData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Updating relationship type:', id, 'for tenant ID:', tenantId);
    
    // Only allow updating the name (relationship_type field)
    if (!updateData.name || updateData.name === id) {
      return res.status(400).json({
        success: false,
        message: 'New name is required and must be different from current name'
      });
    }

    // Check if new name already exists
    const existingType = await pool.query(
      'SELECT DISTINCT relationship_type FROM account_relationships WHERE tenant_id = $1 AND relationship_type = $2',
      [tenantId, updateData.name]
    );

    if (existingType.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Relationship type with this name already exists'
      });
    }

    // Update all relationships with the old type to use the new type
    const result = await pool.query(
      `UPDATE account_relationships 
       SET relationship_type = $1
       WHERE tenant_id = $2 AND relationship_type = $3
       RETURNING relationship_type`,
      [updateData.name, tenantId, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Relationship type not found'
      });
    }

    res.json({
      success: true,
      message: 'Relationship type updated successfully',
      data: { 
        name: updateData.name, 
        description: updateData.description || '',
        entity_type_from: 'account',
        entity_type_to: 'account',
        is_active: true,
        sort_order: 0
      }
    });

  } catch (error) {
    console.error('Error updating relationship type:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Delete relationship type (remove from existing relationships)
const deleteRelationshipType = async (req, res) => {
  try {
    const { id } = req.params; // This is the relationship type name
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Deleting relationship type:', id, 'for tenant ID:', tenantId);
    
    // Check if this relationship type is being used
    const usageQuery = `
      SELECT COUNT(*) as total_usage
      FROM account_relationships 
      WHERE tenant_id = $1 AND relationship_type = $2
    `;
    
    const usage = await pool.query(usageQuery, [tenantId, id]);
    const totalUsage = parseInt(usage.rows[0].total_usage);
    
    if (totalUsage > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete relationship type. It is being used by ${totalUsage} relationship(s).`
      });
    }
    
    // Since no relationships use this type, we can safely delete it
    // (Actually, we don't need to delete anything since it's just a text value)
    
    res.json({
      success: true,
      message: 'Relationship type deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting relationship type:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get entity type combinations (the three supported relationship types)
const getEntityTypeCombinations = async (req, res) => {
  try {
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching entity type combinations for tenant ID:', tenantId);
    
    // We support three types of relationships:
    // 1. Account ↔ Account (e.g., Partner, Competitor, Subsidiary)
    // 2. Account ↔ Contact (e.g., Decision Maker, Employee, Advisor)
    // 3. Contact ↔ Opportunity (e.g., Owner, Team Member)
    const combinations = [
      { entity_type_from: 'account', entity_type_to: 'account' },
      { entity_type_from: 'account', entity_type_to: 'contact' },
      { entity_type_from: 'contact', entity_type_to: 'opportunity' }
    ];

    res.json({
      success: true,
      data: combinations
    });

  } catch (error) {
    console.error('Error fetching entity type combinations:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Bulk update sort order (not applicable for text-based relationship types)
const bulkUpdateSortOrder = async (req, res) => {
  try {
    const { sortOrderData } = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Bulk updating sort order for tenant ID:', tenantId);
    
    if (!Array.isArray(sortOrderData)) {
      return res.status(400).json({
        success: false,
        message: 'sortOrderData must be an array'
      });
    }
    
    // Since we're using text-based relationship types, sort order is not applicable
    // This method is kept for API compatibility but doesn't perform any operations

    res.json({
      success: true,
      message: 'Sort order updated successfully (no operation needed for text-based types)'
    });

  } catch (error) {
    console.error('Error updating sort order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get relationship type usage statistics
const getRelationshipTypeStats = async (req, res) => {
  try {
    const { id } = req.params; // This is the relationship type name
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching relationship type stats:', id, 'for tenant ID:', tenantId);
    
    let usageStats = {
      total_usage: 0,
      last_used: null,
      usage_by_entity_type: {}
    };

    // Check usage in account_relationships
    const accountResult = await pool.query(
      `SELECT COUNT(*) as count, MAX(created_at) as last_used
       FROM account_relationships 
       WHERE tenant_id = $1 AND relationship_type = $2`,
      [tenantId, id]
    );
    
    if (accountResult.rows[0].count > 0) {
      usageStats.total_usage += parseInt(accountResult.rows[0].count);
      usageStats.usage_by_entity_type['account-account'] = parseInt(accountResult.rows[0].count);
      if (accountResult.rows[0].last_used) {
        usageStats.last_used = accountResult.rows[0].last_used;
      }
    }

    // Check usage in account_contacts
    const accountContactResult = await pool.query(
      `SELECT COUNT(*) as count, MAX(created_at) as last_used
       FROM account_contacts 
       WHERE tenant_id = $1 AND relationship_type = $2`,
      [tenantId, id]
    );
    
    if (accountContactResult.rows[0].count > 0) {
      usageStats.total_usage += parseInt(accountContactResult.rows[0].count);
      usageStats.usage_by_entity_type['account-contact'] = parseInt(accountContactResult.rows[0].count);
      if (accountContactResult.rows[0].last_used && (!usageStats.last_used || accountContactResult.rows[0].last_used > usageStats.last_used)) {
        usageStats.last_used = accountContactResult.rows[0].last_used;
      }
    }

    // Check usage in opportunity_contacts
    const opportunityResult = await pool.query(
      `SELECT COUNT(*) as count, MAX(created_at) as last_used
       FROM opportunity_contacts 
       WHERE tenant_id = $1 AND role = $2`,
      [tenantId, id]
    );
    
    if (opportunityResult.rows[0].count > 0) {
      usageStats.total_usage += parseInt(opportunityResult.rows[0].count);
      usageStats.usage_by_entity_type['contact-opportunity'] = parseInt(opportunityResult.rows[0].count);
      if (opportunityResult.rows[0].last_used && (!usageStats.last_used || opportunityResult.rows[0].last_used > usageStats.last_used)) {
        usageStats.last_used = opportunityResult.rows[0].last_used;
      }
    }

    res.json({
      success: true,
      data: usageStats
    });

  } catch (error) {
    console.error('Error fetching relationship type stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Bulk update relationship types
const bulkUpdateRelationshipTypes = async (req, res) => {
  try {
    const { updates } = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Bulk updating relationship types for tenant ID:', tenantId);
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates must be an array'
      });
    }

    const results = [];
    
    for (const update of updates) {
      try {
        const { old_name, new_name, entity_type_from, entity_type_to } = update;
        
        if (!old_name || !new_name) {
          results.push({ old_name, success: false, error: 'Old name and new name are required' });
          continue;
        }

        // Update based on entity type combination
        if (entity_type_from === 'account' && entity_type_to === 'account') {
          const result = await pool.query(
            `UPDATE account_relationships 
             SET relationship_type = $1
             WHERE tenant_id = $2 AND relationship_type = $3`,
            [new_name, tenantId, old_name]
          );
          results.push({ old_name, new_name, success: true, updated_count: result.rowCount });
          
        } else if (entity_type_from === 'account' && entity_type_to === 'contact') {
          const result = await pool.query(
            `UPDATE account_contacts 
             SET relationship_type = $1
             WHERE tenant_id = $2 AND relationship_type = $3`,
            [new_name, tenantId, old_name]
          );
          results.push({ old_name, new_name, success: true, updated_count: result.rowCount });
          
        } else if (entity_type_from === 'contact' && entity_type_to === 'opportunity') {
          const result = await pool.query(
            `UPDATE opportunity_contacts 
             SET role = $1
             WHERE tenant_id = $2 AND role = $3`,
            [new_name, tenantId, old_name]
          );
          results.push({ old_name, new_name, success: true, updated_count: result.rowCount });
        }
        
      } catch (error) {
        results.push({ old_name: update.old_name, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Bulk update completed',
      data: results
    });

  } catch (error) {
    console.error('Error bulk updating relationship types:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  createRelationshipType,
  getRelationshipTypes,
  getRelationshipTypeById,
  updateRelationshipType,
  deleteRelationshipType,
  getEntityTypeCombinations,
  bulkUpdateSortOrder,
  getRelationshipTypeStats,
  bulkUpdateRelationshipTypes
};
