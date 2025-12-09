// Custom field validation middleware
// This file will contain custom field validation logic
const { z } = require('zod');

// Custom field validation schemas
const customFieldSchema = z.object({
  table_name: z.enum(['accounts', 'contacts', 'opportunities'], {
    required_error: 'Table name is required',
    invalid_type_error: 'Table name must be one of: accounts, contacts, opportunities'
  }),
  field_name: z.string()
    .min(1, 'Field name is required')
    .max(50, 'Field name must be less than 50 characters')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Field name must start with letter or underscore and contain only letters, numbers, and underscores'),
  field_type: z.enum(['text', 'number', 'date', 'boolean', 'email', 'phone', 'url', 'textarea', 'single_select', 'multi_select'], {
    required_error: 'Field type is required',
    invalid_type_error: 'Invalid field type'
  }),
  field_label: z.string()
    .min(1, 'Field label is required')
    .max(100, 'Field label must be less than 100 characters'),
  field_description: z.string().max(500, 'Field description must be less than 500 characters').optional(),
  is_required: z.boolean().default(false),
  default_value: z.any().optional(),
  validation_rules: z.object({}).optional(),
  select_options: z.array(z.string()).optional()
});

// Validation middleware for custom fields
const validateCustomField = (req, res, next) => {
  try {
    const validatedData = customFieldSchema.parse(req.body);
    req.validatedData = validatedData;
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Custom field validation failed',
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }
};

// Validate custom field update (partial validation)
const validateCustomFieldUpdate = (req, res, next) => {
  try {
    const updateSchema = customFieldSchema.partial();
    const validatedData = updateSchema.parse(req.body);
    req.validatedData = validatedData;
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Custom field update validation failed',
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }
};

// Validate custom field value based on field type
const validateCustomFieldValue = (fieldType, value, validationRules = {}) => {
  try {
    switch (fieldType) {
      case 'text':
      case 'textarea':
        if (validationRules.maxLength && value.length > validationRules.maxLength) {
          return { isValid: false, message: `Text must be less than ${validationRules.maxLength} characters` };
        }
        if (validationRules.minLength && value.length < validationRules.minLength) {
          return { isValid: false, message: `Text must be at least ${validationRules.minLength} characters` };
        }
        break;

      case 'number':
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return { isValid: false, message: 'Value must be a valid number' };
        }
        if (validationRules.min !== undefined && numValue < validationRules.min) {
          return { isValid: false, message: `Number must be at least ${validationRules.min}` };
        }
        if (validationRules.max !== undefined && numValue > validationRules.max) {
          return { isValid: false, message: `Number must be at most ${validationRules.max}` };
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
        if (validationRules.options && !validationRules.options.includes(value)) {
          return { isValid: false, message: 'Invalid option selected' };
        }
        break;

      case 'multi_select':
        if (!Array.isArray(value)) {
          return { isValid: false, message: 'Multi-select value must be an array' };
        }
        if (validationRules.options) {
          const invalidOptions = value.filter(option => !validationRules.options.includes(option));
          if (invalidOptions.length > 0) {
            return { isValid: false, message: 'Invalid options selected' };
          }
        }
        break;
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, message: 'Validation error occurred' };
  }
};

module.exports = {
  validateCustomField,
  validateCustomFieldUpdate,
  validateCustomFieldValue,
  customFieldSchema
};