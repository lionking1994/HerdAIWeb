// Data validation helpers
// This file will contain validation utility functions
const { z } = require('zod');

// Validation Utility Functions
class ValidationUtils {
  // Common validation schemas
  static schemas = {
    // Company ID validation (integer)
    companyId: z.number().int().positive('Company ID must be a positive integer'),
    
    // User ID validation (integer)
    userId: z.number().int().positive('User ID must be a positive integer'),
    
    // Email validation
    email: z.string().email('Invalid email format'),
    
    // Phone validation
    phone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format'),
    
    // URL validation
    url: z.string().url('Invalid URL format'),
    
    // Date validation
    date: z.string().datetime('Invalid date format'),
    
    // Currency validation
    currency: z.string().length(3, 'Currency must be 3 characters'),
    
    // Percentage validation (0-100)
    percentage: z.number().min(0, 'Percentage must be at least 0').max(100, 'Percentage must be at most 100'),
    
    // Positive number validation
    positiveNumber: z.number().positive('Number must be positive'),
    
    // Non-negative number validation
    nonNegativeNumber: z.number().min(0, 'Number must be non-negative')
  };

  // Validate common fields
  static validateCommonFields(data, requiredFields = []) {
    const schema = z.object({
      id: z.number().int().positive().optional(),
      company_id: this.schemas.companyId.optional(),
      created_at: this.schemas.date.optional(),
      updated_at: this.schemas.date.optional(),
      created_by_user_id: this.schemas.userId.optional(),
      updated_by_user_id: this.schemas.userId.optional()
    });

    try {
      const validated = schema.parse(data);
      return { isValid: true, data: validated };
    } catch (error) {
      return { isValid: false, errors: error.errors };
    }
  }

  // Validate address object
  static validateAddress(address) {
    const addressSchema = z.object({
      street: z.string().min(1, 'Street is required').max(255, 'Street too long'),
      city: z.string().min(1, 'City is required').max(100, 'City too long'),
      state: z.string().min(1, 'State is required').max(100, 'State too long'),
      zip: z.string().min(1, 'ZIP code is required').max(20, 'ZIP code too long'),
      country: z.string().min(1, 'Country is required').max(100, 'Country too long')
    });

    try {
      const validated = addressSchema.parse(address);
      return { isValid: true, data: validated };
    } catch (error) {
      return { isValid: false, errors: error.errors };
    }
  }

  // Validate custom fields object
  static validateCustomFields(customFields) {
    if (!customFields || typeof customFields !== 'object') {
      return { isValid: false, errors: [{ message: 'Custom fields must be an object' }] };
    }

    const errors = [];
    
    for (const [key, value] of Object.entries(customFields)) {
      if (typeof key !== 'string' || key.length === 0) {
        errors.push({ field: key, message: 'Custom field key must be a non-empty string' });
      }
      
      if (value === undefined || value === null) {
        errors.push({ field: key, message: 'Custom field value cannot be undefined or null' });
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return { isValid: true, data: customFields };
  }

  // Validate pagination parameters
  static validatePagination(page, limit) {
    const pageSchema = z.number().int().min(1, 'Page must be at least 1');
    const limitSchema = z.number().int().min(1, 'Limit must be at least 1').max(1000, 'Limit cannot exceed 1000');

    try {
      const validatedPage = pageSchema.parse(page);
      const validatedLimit = limitSchema.parse(limit);
      return { isValid: true, data: { page: validatedPage, limit: validatedLimit } };
    } catch (error) {
      return { isValid: false, errors: error.errors };
    }
  }

  // Validate search parameters
  static validateSearchParams(searchTerm, filters = {}) {
    if (searchTerm && (typeof searchTerm !== 'string' || searchTerm.trim().length < 2)) {
      return { isValid: false, errors: [{ message: 'Search term must be at least 2 characters long' }] };
    }

    if (filters && typeof filters !== 'object') {
      return { isValid: false, errors: [{ message: 'Filters must be an object' }] };
    }

    return { isValid: true, data: { searchTerm, filters } };
  }

  // Validate company context
  static validateCompanyContext(companyId) {
    try {
      const validatedCompanyId = this.schemas.companyId.parse(companyId);
      return { isValid: true, data: { companyId: validatedCompanyId } };
    } catch (error) {
      return { isValid: false, errors: error.errors };
    }
  }

  // Legacy validation for backward compatibility
  static validateTenantContext(tenantId) {
    console.warn('validateTenantContext is deprecated. Use validateCompanyContext instead.');
    return this.validateCompanyContext(tenantId);
  }

  // Validate custom field definition
  static validateCustomFieldDefinition(fieldData) {
    const fieldSchema = z.object({
      name: z.string().min(1, 'Field name is required').max(50, 'Field name too long'),
      display_name: z.string().min(1, 'Display name is required').max(100, 'Display name too long'),
      table_name: z.enum(['accounts', 'contacts', 'opportunities'], 'Invalid table name'),
      field_type: z.enum(['text', 'number', 'date', 'boolean', 'single_select', 'textarea', 'email', 'phone', 'url'], 'Invalid field type'),
      is_required: z.boolean().optional(),
      default_value: z.any().optional(),
      options: z.array(z.string()).optional(),
      validation_rules: z.any().optional(),
      help_text: z.string().max(500, 'Help text too long').optional(),
      is_active: z.boolean().optional(),
      order_index: z.number().int().min(0).optional()
    });

    try {
      const validated = fieldSchema.parse(fieldData);
      return { isValid: true, data: validated };
    } catch (error) {
      return { isValid: false, errors: error.errors };
    }
  }

  // Validate opportunity stage
  static validateOpportunityStage(stageData) {
    const stageSchema = z.object({
      name: z.string().min(1, 'Stage name is required').max(100, 'Stage name too long'),
      description: z.string().max(500, 'Description too long').optional(),
      order_index: z.number().int().min(0, 'Order index must be non-negative'),
      is_active: z.boolean().optional(),
      is_closed_won: z.boolean().optional(),
      is_closed_lost: z.boolean().optional(),
      color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').optional()
    });

    try {
      const validated = stageSchema.parse(stageData);
      return { isValid: true, data: validated };
    } catch (error) {
      return { isValid: false, errors: error.errors };
    }
  }

  // Validate account data
  static validateAccount(accountData) {
    const accountSchema = z.object({
      name: z.string().min(1, 'Account name is required').max(255, 'Account name too long'),
      description: z.string().max(1000, 'Description too long').optional(),
      parent_account_id: z.number().int().positive().optional(),
      account_type: z.enum(['customer', 'prospect', 'partner', 'competitor'], 'Invalid account type').optional(),
      industry: z.string().max(100, 'Industry too long').optional(),
      website: this.schemas.url.optional(),
      phone: this.schemas.phone.optional(),
      email: this.schemas.email.optional(),
      billing_address: this.validateAddress.optional(),
      shipping_address: this.validateAddress.optional(),
      custom_fields: this.validateCustomFields.optional()
    });

    try {
      const validated = accountSchema.parse(accountData);
      return { isValid: true, data: validated };
    } catch (error) {
      return { isValid: false, errors: error.errors };
    }
  }

  // Validate contact data
  static validateContact(contactData) {
    const contactSchema = z.object({
      first_name: z.string().min(1, 'First name is required').max(100, 'First name too long'),
      last_name: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
      email: this.schemas.email.optional(),
      phone: this.schemas.phone.optional(),
      title: z.string().max(100, 'Title too long').optional(),
      department: z.string().max(100, 'Department too long').optional(),
      company: z.string().max(255, 'Company too long').optional(),
      address: this.validateAddress.optional(),
      custom_fields: this.validateCustomFields.optional()
    });

    try {
      const validated = contactSchema.parse(contactData);
      return { isValid: true, data: validated };
    } catch (error) {
      return { isValid: false, errors: error.errors };
    }
  }

  // Validate opportunity data
  static validateOpportunity(opportunityData) {
    const opportunitySchema = z.object({
      name: z.string().min(1, 'Opportunity name is required').max(255, 'Opportunity name too long'),
      description: z.string().max(1000, 'Description too long').optional(),
      account_id: z.number().int().positive('Account ID is required'),
      stage_id: z.number().int().positive('Stage ID is required'),
      amount: z.number().positive('Amount must be positive').optional(),
      expected_close_date: this.schemas.date.optional(),
      lead_source: z.string().max(100, 'Lead source too long').optional(),
      probability: z.number().min(0, 'Probability must be at least 0').max(100, 'Probability must be at most 100').optional()
    });

    try {
      const validated = opportunitySchema.parse(opportunityData);
      return { isValid: true, data: validated };
    } catch (error) {
      return { isValid: false, errors: error.errors };
    }
  }
}

module.exports = ValidationUtils;