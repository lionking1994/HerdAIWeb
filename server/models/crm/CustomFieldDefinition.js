// Custom field model
// This file will contain the CustomFieldDefinition schema and methods
const db = require('../../config/crmDatabase');
const { v4: uuidv4 } = require('uuid');

class CustomFieldDefinition {
  static async create(fieldData, tenantId) {
    const {
      table_name, field_name, field_type, field_label, field_description,
      is_required, default_value, validation_rules, select_options
    } = fieldData;
    
    const id = uuidv4();
    
    const query = `
      INSERT INTO custom_field_definitions (
        id, tenant_id, table_name, field_name, field_type, field_label,
        field_description, is_required, default_value, validation_rules, select_options
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const result = await db.getRow(query, [
      id, tenantId, table_name, field_name, field_type, field_label,
      field_description, is_required || false, default_value, validation_rules, select_options
    ]);
    
    return result;
  }

  static async findById(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'SELECT * FROM custom_field_definitions WHERE id = $1';
    return await db.getRow(query, [id]);
  }

  static async findByTable(tableName, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'SELECT * FROM custom_field_definitions WHERE table_name = $1 AND tenant_id = $2 ORDER BY field_name';
    return await db.getRows(query, [tableName, tenantId]);
  }

  static async update(id, updateData, tenantId) {
    await db.setTenantContext(tenantId);
    
    const {
      field_label, field_description, is_required, default_value, validation_rules, select_options
    } = updateData;
    
    const query = `
      UPDATE custom_field_definitions 
      SET field_label = COALESCE($2, field_label),
          field_description = COALESCE($3, field_description),
          is_required = COALESCE($4, is_required),
          default_value = COALESCE($5, default_value),
          validation_rules = COALESCE($6, validation_rules),
          select_options = COALESCE($7, select_options),
          version = version + 1,
          updated_at = NOW()
      WHERE id = $1 AND tenant_id = $8
      RETURNING *
    `;
    
    return await db.getRow(query, [
      id, field_label, field_description, is_required, default_value, validation_rules, select_options, tenantId
    ]);
  }

  static async delete(id, tenantId) {
    await db.setTenantContext(tenantId);
    const query = 'DELETE FROM custom_field_definitions WHERE id = $1 AND tenant_id = $2 RETURNING *';
    return await db.getRow(query, [id, tenantId]);
  }

  static async getSchema(tableName, tenantId) {
    await db.setTenantContext(tenantId);
    
    const query = `
      SELECT 
        field_name,
        field_type,
        field_label,
        field_description,
        is_required,
        default_value,
        validation_rules,
        select_options
      FROM custom_field_definitions
      WHERE table_name = $1 AND tenant_id = $2
      ORDER BY field_name
    `;
    
    const fields = await db.getRows(query, [tableName, tenantId]);
    
    const schema = {};
    fields.forEach(field => {
      schema[field.field_name] = {
        type: field.field_type,
        label: field.field_label,
        description: field.field_description,
        required: field.is_required,
        default: field.default_value,
        validation: field.validation_rules,
        options: field.select_options
      };
    });
    
    return schema;
  }

  static async validateCustomFields(tableName, customFields, tenantId) {
    const schema = await this.getSchema(tableName, tenantId);
    const errors = [];
    
    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const fieldValue = customFields[fieldName];
      
      // Check required fields
      if (fieldDef.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
        errors.push(`Field '${fieldDef.label}' is required`);
        continue;
      }
      
      // Skip validation if field is not provided and not required
      if (fieldValue === undefined || fieldValue === null) {
        continue;
      }
      
      // Type validation
      switch (fieldDef.type) {
        case 'number':
          if (typeof fieldValue !== 'number' || isNaN(fieldValue)) {
            errors.push(`Field '${fieldDef.label}' must be a number`);
          }
          break;
          
        case 'boolean':
          if (typeof fieldValue !== 'boolean') {
            errors.push(`Field '${fieldDef.label}' must be a boolean`);
          }
          break;
          
        case 'date':
          if (isNaN(Date.parse(fieldValue))) {
            errors.push(`Field '${fieldDef.label}' must be a valid date`);
          }
          break;
          
        case 'single_select':
          if (fieldDef.options && !fieldDef.options.includes(fieldValue)) {
            errors.push(`Field '${fieldDef.label}' contains invalid option`);
          }
          break;
          
        case 'multi_select':
          if (fieldDef.options && Array.isArray(fieldValue)) {
            const invalidOptions = fieldValue.filter(option => !fieldDef.options.includes(option));
            if (invalidOptions.length > 0) {
              errors.push(`Field '${fieldDef.label}' contains invalid options`);
            }
          }
          break;
      }
    }
    
    return errors;
  }
}

module.exports = CustomFieldDefinition;