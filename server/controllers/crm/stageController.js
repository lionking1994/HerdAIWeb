const pool = require('../../config/database');
const { getTenantId, getOrCreateTenant, getTenant } = require('../../utils/crm');

// Create new opportunity stage
const createStage = async (req, res) => {
  try {
    const stageData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Creating opportunity stage for tenant ID:', tenantId);

    // Validation
    if (!stageData.name) {
      return res.status(400).json({
        success: false,
        message: 'Stage name is required'
      });
    }

    // Validate weight_percentage
    if (stageData.weight_percentage !== undefined && (stageData.weight_percentage < 0 || stageData.weight_percentage > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Weight percentage must be between 0 and 100'
      });
    }

    // Check if stage name already exists for this tenant
    const existingStage = await pool.query(
      'SELECT * FROM opportunity_stages WHERE tenant_id = $1 AND name = $2',
      [tenantId, stageData.name]
    );

    if (existingStage.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Stage with this name already exists'
      });
    }

    // Get the next order index
    const orderResult = await pool.query(
      'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM opportunity_stages WHERE tenant_id = $1',
      [tenantId]
    );
    const nextOrder = orderResult.rows[0].next_order;

    // Create stage
    const newStage = await pool.query(
      `INSERT INTO opportunity_stages (
        tenant_id, name, description, order_index, weight_percentage, is_closed_won, is_closed_lost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        tenantId, stageData.name, stageData.description || '',
        nextOrder, stageData.weight_percentage || 0, stageData.is_closed_won || false, stageData.is_closed_lost || false
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Opportunity stage created successfully',
      data: newStage.rows[0]
    });

  } catch (error) {
    console.error('Error creating opportunity stage:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get all opportunity stages for tenant
const getStages = async (req, res) => {
  try {
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching opportunity stages for tenant ID:', tenantId);
    
    const result = await pool.query(
      'SELECT * FROM opportunity_stages WHERE tenant_id = $1 ORDER BY order_index',
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching opportunity stages:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get stage by ID
const getStageById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching stage ID:', id, 'for tenant ID:', tenantId);
    
    const result = await pool.query(
      'SELECT * FROM opportunity_stages WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity stage not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching opportunity stage:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update stage
const updateStage = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Updating stage ID:', id, 'for tenant ID:', tenantId);
    
    // Check if stage exists and belongs to tenant
    const existingStage = await pool.query(
      'SELECT * FROM opportunity_stages WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingStage.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity stage not found'
      });
    }

    // Check if name is being changed and if new name already exists
    if (updateData.name && updateData.name !== existingStage.rows[0].name) {
      const nameExists = await pool.query(
        'SELECT * FROM opportunity_stages WHERE tenant_id = $1 AND name = $2 AND id != $3',
        [tenantId, updateData.name, id]
      );

      if (nameExists.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Stage with this name already exists'
        });
      }
    }

    // Validate weight_percentage if provided
    if (updateData.weight_percentage !== undefined && (updateData.weight_percentage < 0 || updateData.weight_percentage > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Weight percentage must be between 0 and 100'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && key !== 'tenant_id' && key !== 'created_at') {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Add WHERE clause parameters
    values.push(id, tenantId);

    const updateQuery = `
      UPDATE opportunity_stages 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Opportunity stage updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating opportunity stage:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Delete stage
const deleteStage = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Deleting stage ID:', id, 'for tenant ID:', tenantId);
    
    // Check if stage exists and belongs to tenant
    const existingStage = await pool.query(
      'SELECT * FROM opportunity_stages WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingStage.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity stage not found'
      });
    }

    // Check if stage has related opportunities
    const hasOpportunities = await pool.query(
      'SELECT COUNT(*) FROM opportunities WHERE stage_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    const opportunityCount = parseInt(hasOpportunities.rows[0].count);

    if (opportunityCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete stage with related opportunities',
        data: {
          opportunity_count: opportunityCount
        }
      });
    }

    // Delete stage
    await pool.query(
      'DELETE FROM opportunity_stages WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    res.json({
      success: true,
      message: 'Opportunity stage deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting opportunity stage:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Reorder stages
const reorderStages = async (req, res) => {
  try {
    const { stageIds } = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Reordering stages for tenant ID:', tenantId);

    if (!Array.isArray(stageIds) || stageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Stage IDs array is required'
      });
    }

    // Verify all stages belong to tenant
    const stagesExist = await pool.query(
      'SELECT COUNT(*) FROM opportunity_stages WHERE id = ANY($1) AND tenant_id = $2',
      [stageIds, tenantId]
    );

    if (parseInt(stagesExist.rows[0].count) !== stageIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some stages do not exist or do not belong to this tenant'
      });
    }

    // Update order for each stage
    for (let i = 0; i < stageIds.length; i++) {
      await pool.query(
        'UPDATE opportunity_stages SET order_index = $1 WHERE id = $2 AND tenant_id = $3',
        [i + 1, stageIds[i], tenantId]
      );
    }

    res.json({
      success: true,
      message: 'Stages reordered successfully'
    });

  } catch (error) {
    console.error('Error reordering stages:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  createStage,
  getStages,
  getStageById,
  updateStage,
  deleteStage,
  reorderStages
};