// Custom field processing
// This file will contain custom field processing utilities
const { crmDb } = require('../../config/crmDatabase');

// Custom Field Processing Utilities
class CustomFieldProcessor {
  // Process custom field values before saving
  static processCustomFieldValue(fieldType, value, fieldDefinition) {
    try {
      switch (fieldType) {
        case 'text':
        case 'textarea':
          return typeof value === 'string' ? value.trim() : String(value || '');

        case 'number':
          const numValue = parseFloat(value);
          return isNaN(numValue) ? null : numValue;

        case 'date':
          if (!value) return null;
          const dateValue = new Date(value);
          return isNaN(dateValue.getTime()) ? null : dateValue.toISOString();

        case 'boolean':
          if (typeof value === 'boolean') return value;
          if (typeof value === 'string') {
            return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
          }
          if (typeof value === 'number') return value !== 0;
          return false;

        case 'email':
          return typeof value === 'string' ? value.trim().toLowerCase() : '';

        case 'phone':
          return typeof value === 'string' ? value.replace(/[\s\-\(\)]/g, '') : '';

        case 'url':
          return typeof value === 'string' ? value.trim() : '';

        case 'single_select':
          if (fieldDefinition.select_options && fieldDefinition.select_options.length > 0) {
            return fieldDefinition.select_options.includes(value) ? value : null;
          }
          return value;

        case 'multi_select':
          if (!Array.isArray(value)) return [];
          if (fieldDefinition.select_options && fieldDefinition.select_options.length > 0) {
            return value.filter(item => fieldDefinition.select_options.includes(item));
          }
          return value;

        default:
          return value;
      }
    } catch (error) {
      console.error('Error processing custom field value:', error);
      return null;
    }
  }

  // Validate custom field value against field definition
  static validateCustomFieldValue(value, fieldDefinition) {
    try {
      const { field_type, is_required, validation_rules } = fieldDefinition;

      // Check required field
      if (is_required && (value === null || value === undefined || value === '')) {
        return { isValid: false, message: 'This field is required' };
      }

      // Skip validation if value is empty and not required
      if (!is_required && (value === null || value === undefined || value === '')) {
        return { isValid: true };
      }

      // Type-specific validation
      switch (field_type) {
        case 'text':
        case 'textarea':
          if (typeof value !== 'string') {
            return { isValid: false, message: 'Value must be text' };
          }
          if (validation_rules?.maxLength && value.length > validation_rules.maxLength) {
            return { isValid: false, message: `Text must be less than ${validation_rules.maxLength} characters` };
          }
          if (validation_rules?.minLength && value.length < validation_rules.minLength) {
            return { isValid: false, message: `Text must be at least ${validation_rules.minLength} characters` };
          }
          break;

        case 'number':
          if (isNaN(parseFloat(value))) {
            return { isValid: false, message: 'Value must be a number' };
          }
          const numValue = parseFloat(value);
          if (validation_rules?.min !== undefined && numValue < validation_rules.min) {
            return { isValid: false, message: `Number must be at least ${validation_rules.min}` };
          }
          if (validation_rules?.max !== undefined && numValue > validation_rules.max) {
            return { isValid: false, message: `Number must be at most ${validation_rules.max}` };
          }
          break;

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return { isValid: false, message: 'Invalid email format' };
          }
          break;

        case 'phone':
          const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
          if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
            return { isValid: false, message: 'Invalid phone number format' };
          }
          break;

        case 'url':
          try {
            new URL(value);
          } catch {
            return { isValid: false, message: 'Invalid URL format' };
          }
          break;

        case 'single_select':
          if (fieldDefinition.select_options && fieldDefinition.select_options.length > 0) {
            if (!fieldDefinition.select_options.includes(value)) {
              return { isValid: false, message: 'Invalid option selected' };
            }
          }
          break;

        case 'multi_select':
          if (!Array.isArray(value)) {
            return { isValid: false, message: 'Multi-select value must be an array' };
          }
          if (fieldDefinition.select_options && fieldDefinition.select_options.length > 0) {
            const invalidOptions = value.filter(item => !fieldDefinition.select_options.includes(item));
            if (invalidOptions.length > 0) {
              return { isValid: false, message: 'Invalid options selected' };
            }
          }
          break;
      }

      return { isValid: true };
    } catch (error) {
      console.error('Error validating custom field value:', error);
      return { isValid: false, message: 'Validation error occurred' };
    }
  }

  // Get custom field definitions for a table
  static async getCustomFieldDefinitions(tenantId, tableName) {
    try {
      const query = `
        SELECT * FROM custom_field_definitions 
        WHERE tenant_id = $1 AND table_name = $2 
        ORDER BY created_at ASC
      `;
      
      const customFields = await crmDb.query(query, [tenantId, tableName]);
      return customFields.rows || [];
    } catch (error) {
      console.error('Error fetching custom field definitions:', error);
      return [];
    }
  }

  // Process custom fields for a record
  static async processRecordCustomFields(tenantId, tableName, recordData) {
    try {
      const customFieldDefinitions = await this.getCustomFieldDefinitions(tenantId, tableName);
      const processedData = { ...recordData };
      const customFields = {};

      for (const fieldDef of customFieldDefinitions) {
        const fieldValue = recordData.custom_fields?.[fieldDef.field_name];
        
        if (fieldValue !== undefined) {
          // Process and validate the value
          const processedValue = this.processCustomFieldValue(fieldDef.field_type, fieldValue, fieldDef);
          const validation = this.validateCustomFieldValue(processedValue, fieldDef);
          
          if (validation.isValid) {
            customFields[fieldDef.field_name] = processedValue;
          } else {
            throw new Error(`Custom field validation failed for ${fieldDef.field_name}: ${validation.message}`);
          }
        } else if (fieldDef.default_value !== null) {
          // Use default value if no value provided
          customFields[fieldDef.field_name] = fieldDef.default_value;
        }
      }

      processedData.custom_fields = customFields;
      return processedData;
    } catch (error) {
      console.error('Error processing record custom fields:', error);
      throw error;
    }
  }

  // Generate custom field schema for API documentation
  static generateCustomFieldSchema(customFieldDefinitions) {
    const schema = {};
    
    for (const fieldDef of customFieldDefinitions) {
      let fieldSchema = {};
      
      switch (fieldDef.field_type) {
        case 'text':
        case 'textarea':
          fieldSchema = { type: 'string' };
          if (fieldDef.validation_rules?.maxLength) {
            fieldSchema.maxLength = fieldDef.validation_rules.maxLength;
          }
          if (fieldDef.validation_rules?.minLength) {
            fieldSchema.minLength = fieldDef.validation_rules.minLength;
          }
          break;

        case 'number':
          fieldSchema = { type: 'number' };
          if (fieldDef.validation_rules?.min !== undefined) {
            fieldSchema.minimum = fieldDef.validation_rules.min;
          }
          if (fieldDef.validation_rules?.max !== undefined) {
            fieldSchema.maximum = fieldDef.validation_rules.max;
          }
          break;

        case 'date':
          fieldSchema = { type: 'string', format: 'date-time' };
          break;

        case 'boolean':
          fieldSchema = { type: 'boolean' };
          break;

        case 'email':
          fieldSchema = { type: 'string', format: 'email' };
          break;

        case 'phone':
          fieldSchema = { type: 'string', pattern: '^[\\+]?[1-9][\\d]{0,15}$' };
          break;

        case 'url':
          fieldSchema = { type: 'string', format: 'uri' };
          break;

        case 'single_select':
          fieldSchema = { 
            type: 'string',
            enum: fieldDef.select_options || []
          };
          break;

        case 'multi_select':
          fieldSchema = { 
            type: 'array',
            items: { type: 'string' },
            enum: fieldDef.select_options || []
          };
          break;
      }

      if (fieldDef.is_required) {
        fieldSchema.required = true;
      }

      if (fieldDef.field_description) {
        fieldSchema.description = fieldDef.field_description;
      }

      schema[fieldDef.field_name] = fieldSchema;
    }

    return schema;
  }
}

module.exports = CustomFieldProcessor;