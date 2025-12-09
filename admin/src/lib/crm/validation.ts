export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Common validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\d{10}$/, // Exactly 10 digits
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  CURRENCY: /^[0-9]+(\.[0-9]{1,2})?$/,
  ZIP_CODE: /^[0-9]{5}(-[0-9]{4})?$/,
  ALPHA_NUMERIC: /^[a-zA-Z0-9\s\-_]+$/,
};

// Validation rules for different field types
export const FIELD_VALIDATION_RULES: Record<string, ValidationRule> = {
  // Account fields
  account_name: {
    required: true,
    minLength: 2,
    maxLength: 100,
  },
  account_email: {
    required: true,
    custom: (value) => {
      if (!value) return 'Email is required';
      if (!VALIDATION_PATTERNS.EMAIL.test(value)) {
        return 'Please enter a valid email address';
      }
      return null;
    },
  },
  account_website: {
    custom: (value) => {
      if (value && !VALIDATION_PATTERNS.URL.test(value)) {
        return 'Please enter a valid website URL (e.g., https://example.com)';
      }
      return null;
    },
  },
  account_phone: {
    required: true,
    custom: (value) => {
      if (!value) return 'Phone number is required';
      
      // Remove spaces and check if contains non-digits
      const cleaned = value.replace(/\s/g, '');
      if (!/^\d+$/.test(cleaned)) {
        return 'Invalid format - must be digits only';
      }
      
      // Check length (max 10 digits)
      if (cleaned.length > 10) {
        return 'Phone number cannot exceed 10 digits';
      }
      
      if (cleaned.length < 10) {
        return 'Phone number must be at least 10 digits';
      }
      
      return null;
    },
  },

  // Contact fields
  contact_first_name: {
    required: true,
    minLength: 1,
    maxLength: 50,
  },
  contact_last_name: {
    required: true,
    minLength: 1,
    maxLength: 50,
  },
  contact_email: {
    required: true,
    custom: (value) => {
      if (!value) return 'Email is required';
      if (!VALIDATION_PATTERNS.EMAIL.test(value)) {
        return 'Please enter a valid email address';
      }
      return null;
    },
  },
  contact_phone: {
    custom: (value) => {
      if (value) {
        // Remove spaces and check if contains non-digits
        const cleaned = value.replace(/\s/g, '');
        if (!/^\d+$/.test(cleaned)) {
          return 'Invalid format - must be digits only';
        }
        
        // Check length (max 10 digits)
        if (cleaned.length > 10) {
          return 'Phone number cannot exceed 10 digits';
        }
        
        if (cleaned.length < 10) {
          return 'Phone number must be at least 10 digits';
        }
      }
      return null;
    },
  },
  contact_mobile_phone: {
    required: true,
    custom: (value) => {
      if (!value) return 'Mobile phone is required';
      
      // Remove spaces and check if contains non-digits
      const cleaned = value.replace(/\s/g, '');
      if (!/^\d+$/.test(cleaned)) {
        return 'Invalid format - must be digits only';
      }
      
      // Check length (max 10 digits)
      if (cleaned.length > 10) {
        return 'Mobile phone cannot exceed 10 digits';
      }
      
      if (cleaned.length < 10) {
        return 'Mobile phone must be at least 10 digits';
      }
      
      return null;
    },
  },
  contact_zip: {
    custom: (value) => {
      if (value) {
        // Remove spaces and check format
        const cleaned = value.replace(/\s/g, '');
        if (!VALIDATION_PATTERNS.ZIP_CODE.test(cleaned)) {
          return 'ZIP code must be 5 digits (e.g., 12345) or 9 digits with hyphen (e.g., 12345-6789)';
        }
      }
      return null;
    },
  },

  // Opportunity fields
  opportunity_name: {
    required: true,
    minLength: 2,
    maxLength: 100,
  },
  opportunity_amount: {
    custom: (value) => {
      if (value && !VALIDATION_PATTERNS.CURRENCY.test(value)) {
        return 'Please enter a valid amount (e.g., 1000.50)';
      }
      if (value && parseFloat(value) < 0) {
        return 'Amount cannot be negative';
      }
      return null;
    },
  },
  opportunity_probability: {
    custom: (value) => {
      if (value && (parseInt(value) < 0 || parseInt(value) > 100)) {
        return 'Probability must be between 0 and 100';
      }
      return null;
    },
  },

  // Stage fields
  stage_name: {
    required: true,
    minLength: 2,
    maxLength: 50,
  },
  stage_order_index: {
    required: true,
    custom: (value) => {
      if (!value || isNaN(parseInt(value))) {
        return 'Order index must be a number';
      }
      if (parseInt(value) < 0) {
        return 'Order index cannot be negative';
      }
      return null;
    },
  },

  // Custom field validation based on type
  custom_text: {
    maxLength: 255,
  },
  custom_number: {
    custom: (value) => {
      if (value && isNaN(parseFloat(value))) {
        return 'Please enter a valid number';
      }
      return null;
    },
  },
  custom_email: {
    custom: (value) => {
      if (value && !VALIDATION_PATTERNS.EMAIL.test(value)) {
        return 'Please enter a valid email address';
      }
      return null;
    },
  },
  custom_url: {
    custom: (value) => {
      if (value && !VALIDATION_PATTERNS.URL.test(value)) {
        return 'Please enter a valid URL';
      }
      return null;
    },
  },
};

// Main validation function
export function validateField(fieldName: string, value: any, rules: ValidationRule): string | null {
  // Required field validation
  if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return 'This field is required';
  }

  // Skip other validations if value is empty and not required
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  // Length validation
  if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
    return `Minimum length is ${rules.minLength} characters`;
  }

  if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
    return `Maximum length is ${rules.maxLength} characters`;
  }

  // Custom validation (run before pattern validation to show specific messages)
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) return customError;
  }

  // Pattern validation (only if no custom validation error)
  if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
    return 'Invalid format';
  }

  return null;
}

// Validate entire form
export function validateForm(formData: Record<string, any>, fieldRules: Record<string, ValidationRule>): ValidationResult {
  const errors: Record<string, string> = {};
  let isValid = true;

  for (const [fieldName, rules] of Object.entries(fieldRules)) {
    const value = formData[fieldName];
    const error = validateField(fieldName, value, rules);
    
    if (error) {
      errors[fieldName] = error;
      isValid = false;
    }
  }

  return { isValid, errors };
}

// Format phone number for display
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone;
}

// Format currency for display
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

// Sanitize input (remove dangerous characters)
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}
