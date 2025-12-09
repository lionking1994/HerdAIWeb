const pool = require('../../config/database');
const { getTenantId, getOrCreateTenant, getTenant } = require('../../utils/crm');

// Create new custom field definition
const createCustomField = async (req, res) => {
  try {
    const fieldData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Creating custom field for tenant ID:', tenantId);
    console.log('📝 Field data received:', JSON.stringify(fieldData, null, 2));

    // Validation - check for field_name instead of name
    if (!fieldData.field_name || !fieldData.table_name || !fieldData.field_type) {
      return res.status(400).json({
        success: false,
        message: 'Field name, table name, and field type are required'
      });
    }

    // Check if field name already exists for this table and tenant
    const existingField = await pool.query(
      'SELECT * FROM custom_field_definitions WHERE tenant_id = $1 AND table_name = $2 AND field_name = $3',
      [tenantId, fieldData.table_name, fieldData.field_name]
    );

    if (existingField.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Custom field with this name already exists for this table'
      });
    }

    // Create custom field definition - use field_name instead of name
    const insertValues = [
      tenantId, fieldData.table_name, fieldData.field_name, fieldData.field_label || fieldData.field_name,
      fieldData.field_type, fieldData.is_required || false, fieldData.field_description || null,
      fieldData.default_value || null, 
      fieldData.validation_rules ? JSON.stringify(fieldData.validation_rules) : null,
      fieldData.select_options ? JSON.stringify(fieldData.select_options) : null
    ];
    
    console.log('💾 Inserting with values:', JSON.stringify(insertValues, null, 2));
    
    const newField = await pool.query(
      `INSERT INTO custom_field_definitions (
        tenant_id, table_name, field_name, field_label, field_type, is_required, 
        field_description, default_value, validation_rules, select_options, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      insertValues
    );

    res.status(201).json({
      success: true,
      message: 'Custom field created successfully',
      data: newField.rows[0]
    });

  } catch (error) {
    console.error('Error creating custom field:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get all custom field definitions for tenant
const getCustomFields = async (req, res) => {
  try {
    const { table_name } = req.query;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching custom fields for tenant ID:', tenantId);
    
    let query = 'SELECT * FROM custom_field_definitions WHERE tenant_id = $1';
    let params = [tenantId];

    if (table_name) {
      query += ' AND table_name = $2';
      params.push(table_name);
    }

    query += ' ORDER BY table_name, field_name';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching custom fields:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get custom field by ID
const getCustomFieldById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching custom field ID:', id, 'for tenant ID:', tenantId);
    
    const result = await pool.query(
      'SELECT * FROM custom_field_definitions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom field not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching custom field:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update custom field
const updateCustomField = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Updating custom field ID:', id, 'for tenant ID:', tenantId);
    
    // Check if field exists and belongs to tenant
    const existingField = await pool.query(
      'SELECT * FROM custom_field_definitions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingField.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom field not found'
      });
    }

    // Check if field_name is being changed and if new field_name already exists for the same table
    if (updateData.field_name && updateData.field_name !== existingField.rows[0].field_name) {
      const nameExists = await pool.query(
        'SELECT * FROM custom_field_definitions WHERE tenant_id = $1 AND table_name = $2 AND field_name = $3 AND id != $4',
        [tenantId, existingField.rows[0].table_name, updateData.field_name, id]
      );

      if (nameExists.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Custom field with this name already exists for this table'
        });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Filter out fields that shouldn't be updated
    const allowedFields = ['field_name', 'field_label', 'field_type', 'field_description', 'is_required', 'default_value', 'validation_rules', 'select_options'];
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramCount}`);
        // Convert JSON fields to strings for database storage
        if (key === 'validation_rules' || key === 'select_options') {
          values.push(updateData[key] ? JSON.stringify(updateData[key]) : null);
        } else {
          values.push(updateData[key]);
        }
        paramCount++;
      }
    });

    // Always add updated_at
    updateFields.push('updated_at = NOW()');

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Add WHERE clause parameters
    values.push(id, tenantId);

    const updateQuery = `
      UPDATE custom_field_definitions 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Custom field updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating custom field:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Delete custom field
const deleteCustomField = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Deleting custom field ID:', id, 'for tenant ID:', tenantId);
    
    // Check if field exists and belongs to tenant
    const existingField = await pool.query(
      'SELECT * FROM custom_field_definitions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingField.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom field not found'
      });
    }

    // Check if field is being used in any records
    const fieldName = existingField.rows[0].field_name;
    const tableName = existingField.rows[0].table_name;
    
    // Check if the custom field exists in the target table's custom_fields JSONB column
    const isFieldUsed = await pool.query(
      `SELECT COUNT(*) FROM ${tableName} WHERE custom_fields ? $1 AND tenant_id = $2`,
      [fieldName, tenantId]
    );

    const usageCount = parseInt(isFieldUsed.rows[0].count);

    if (usageCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete custom field that is being used',
        data: {
          usage_count: usageCount,
          table_name: tableName
        }
      });
    }

    // Delete custom field definition
    await pool.query(
      'DELETE FROM custom_field_definitions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    res.json({
      success: true,
      message: 'Custom field deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting custom field:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get custom field schema for a specific table
const getCustomFieldSchema = async (req, res) => {
  try {
    const { table_name } = req.params;
    
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching custom field schema for table:', table_name, 'tenant ID:', tenantId);
    
    if (!table_name) {
      return res.status(400).json({
        success: false,
        message: 'Table name is required'
      });
    }

    const result = await pool.query(
      'SELECT * FROM custom_field_definitions WHERE tenant_id = $1 AND table_name = $2 ORDER BY field_name',
      [tenantId, table_name]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching custom field schema:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  createCustomField,
  getCustomFields,
  getCustomFieldById,
  updateCustomField,
  deleteCustomField,
  getCustomFieldSchema
};