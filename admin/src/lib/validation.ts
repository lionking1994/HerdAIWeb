export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

interface FormFieldData {
  name: string;
  type: string;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

interface NodeData {
  table?: string;
  triggerType?: string;
  approvers?: Array<string | { id: number; name: string; email: string }>;
  field?: string;
  operator?: string;
  value?: string;
  criteria?: string;
  updateValue?: string;
  notificationType?: string;
  title?: string;
  message?: string;
  timePeriod?: string;
  duration?: number;
  url?: string;
  method?: string;
  authType?: string;
  endpoint?: string;
  formFields?: FormFieldData[];
  [key: string]: unknown;
}

// Validation functions for different field types
export const validateRequired = (value: unknown, fieldName: string): ValidationError | null => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return {
      field: fieldName,
      message: `${fieldName} is required`
    };
  }
  return null;
};

export const validateMinLength = (value: string, minLength: number, fieldName: string): ValidationError | null => {
  if (value && value.length < minLength) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${minLength} characters long`
    };
  }
  return null;
};

export const validateMaxLength = (value: string, maxLength: number, fieldName: string): ValidationError | null => {
  if (value && value.length > maxLength) {
    return {
      field: fieldName,
      message: `${fieldName} must be no more than ${maxLength} characters long`
    };
  }
  return null;
};

export const validateEmail = (value: string, fieldName: string): ValidationError | null => {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid email address`
    };
  }
  return null;
};

export const validateUrl = (value: string, fieldName: string): ValidationError | null => {
  if (value && !/^https?:\/\/.+/.test(value)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid URL starting with http:// or https://`
    };
  }
  return null;
};

export const validateNumber = (value: unknown, fieldName: string): ValidationError | null => {
  if (value && (isNaN(Number(value)) || Number(value) < 0)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid positive number`
    };
  }
  return null;
};

export const validateMinValue = (value: number, minValue: number, fieldName: string): ValidationError | null => {
  if (value < minValue) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${minValue}`
    };
  }
  return null;
};

export const validateMaxValue = (value: number, maxValue: number, fieldName: string): ValidationError | null => {
  if (value > maxValue) {
    return {
      field: fieldName,
      message: `${fieldName} must be no more than ${maxValue}`
    };
  }
  return null;
};

export const validatePattern = (value: string, pattern: string, fieldName: string): ValidationError | null => {
  if (value && !new RegExp(pattern).test(value)) {
    return {
      field: fieldName,
      message: `${fieldName} format is invalid`
    };
  }
  return null;
};

// Workflow-specific validation functions
export const validateWorkflowName = (name: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const requiredError = validateRequired(name, 'Workflow name');
  if (requiredError) errors.push(requiredError);
  
  const minLengthError = validateMinLength(name, 3, 'Workflow name');
  if (minLengthError) errors.push(minLengthError);
  
  const maxLengthError = validateMaxLength(name, 100, 'Workflow name');
  if (maxLengthError) errors.push(maxLengthError);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateNodeLabel = (label: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const requiredError = validateRequired(label, 'Node name');
  if (requiredError) errors.push(requiredError);
  
  const minLengthError = validateMinLength(label, 2, 'Node name');
  if (minLengthError) errors.push(minLengthError);
  
  const maxLengthError = validateMaxLength(label, 50, 'Node name');
  if (maxLengthError) errors.push(maxLengthError);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateFormField = (field: FormFieldData): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Validate field name
  const nameError = validateRequired(field.name, 'Field name');
  if (nameError) errors.push(nameError);
  
  if (field.name) {
    const minLengthError = validateMinLength(field.name, 2, 'Field name');
    if (minLengthError) errors.push(minLengthError);
    
    const maxLengthError = validateMaxLength(field.name, 30, 'Field name');
    if (maxLengthError) errors.push(maxLengthError);
    
    // Check for valid field name pattern (alphanumeric and underscore only)
    const patternError = validatePattern(field.name, '^[a-zA-Z][a-zA-Z0-9_]*$', 'Field name');
    if (patternError) {
      patternError.message = 'Field name must start with a letter and contain only letters, numbers, and underscores';
      errors.push(patternError);
    }
  }
  
  // Validate field type
  const typeError = validateRequired(field.type, 'Field type');
  if (typeError) errors.push(typeError);
  
  // Validate options for dropdown and radio fields
  if ((field.type === 'dropdown' || field.type === 'radio') && field.options) {
    if (field.options.length === 0) {
      errors.push({
        field: 'options',
        message: `${field.type} fields must have at least one option`
      });
    }
    
    // Check for duplicate options
    const uniqueOptions = new Set(field.options);
    if (uniqueOptions.size !== field.options.length) {
      errors.push({
        field: 'options',
        message: `${field.type} options must be unique`
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateTriggerNode = (data: NodeData): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const tableError = validateRequired(data.table, 'Table');
  if (tableError) errors.push(tableError);
  
  const triggerTypeError = validateRequired(data.triggerType, 'Action');
  if (triggerTypeError) errors.push(triggerTypeError);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateApprovalNode = (data: NodeData): ValidationResult => {
  const errors: ValidationError[] = [];
  
  if (!data.approvers || data.approvers.length === 0) {
    errors.push({
      field: 'approvers',
      message: 'At least one approver is required'
    });
  } else {
    // Validate that each approver has the required fields
    const approvers = Array.isArray(data.approvers) ? data.approvers : [];
    for (let i = 0; i < approvers.length; i++) {
      const approver = approvers[i];
      if (typeof approver === 'object' && approver !== null) {
        const approverObj = approver as { id?: number; name?: string; email?: string };
        if (!approverObj.id || !approverObj.name || !approverObj.email) {
          errors.push({
            field: `approvers[${i}]`,
            message: 'Each approver must have id, name, and email'
          });
        }
      } else if (typeof approver === 'string') {
        // Old format - just email string
        if (!approver.trim()) {
          errors.push({
            field: `approvers[${i}]`,
            message: 'Approver email cannot be empty'
          });
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateConditionNode = (data: NodeData): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const fieldError = validateRequired(data.field, 'Field');
  if (fieldError) errors.push(fieldError);
  
  const operatorError = validateRequired(data.operator, 'Operator');
  if (operatorError) errors.push(operatorError);
  
  const valueError = validateRequired(data.value, 'Value');
  if (valueError) errors.push(valueError);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateUpdateNode = (data: NodeData): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const tableError = validateRequired(data.table, 'Table');
  if (tableError) errors.push(tableError);
  
  const fieldError = validateRequired(data.field, 'Field');
  if (fieldError) errors.push(fieldError);
  
  const criteriaError = validateRequired(data.criteria, 'Record Criteria');
  if (criteriaError) errors.push(criteriaError);
  
  const valueError = validateRequired(data.updateValue, 'Value');
  if (valueError) errors.push(valueError);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateNotificationNode = (data: NodeData): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const typeError = validateRequired(data.notificationType, 'Type');
  if (typeError) errors.push(typeError);
  
  const titleError = validateRequired(data.title, 'Title');
  if (titleError) errors.push(titleError);
  
  const messageError = validateRequired(data.message, 'Message');
  if (messageError) errors.push(messageError);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateDelayNode = (data: NodeData): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const timePeriodError = validateRequired(data.timePeriod, 'Time Period');
  if (timePeriodError) errors.push(timePeriodError);
  
  const durationError = validateRequired(data.duration, 'Duration');
  if (durationError) errors.push(durationError);
  
  if (data.duration) {
    const numberError = validateNumber(data.duration, 'Duration');
    if (numberError) errors.push(numberError);
    
    const minValueError = validateMinValue(Number(data.duration), 1, 'Duration');
    if (minValueError) errors.push(minValueError);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateWebhookNode = (data: NodeData): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const urlError = validateRequired(data.url, 'URL');
  if (urlError) errors.push(urlError);
  
  if (data.url) {
    const validUrlError = validateUrl(data.url, 'URL');
    if (validUrlError) errors.push(validUrlError);
  }
  
  const methodError = validateRequired(data.method, 'Method');
  if (methodError) errors.push(methodError);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateApiNode = (data: NodeData): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const endpointError = validateRequired(data.endpoint, 'Endpoint');
  if (endpointError) errors.push(endpointError);
  
  const methodError = validateRequired(data.method, 'Method');
  if (methodError) errors.push(methodError);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateAgentNode = (): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // For now, agent nodes don't have required fields, but we can add validation later
  // if specific agent configurations become required
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Main validation function for any node type
export const validateNodeData = (nodeType: string, data: NodeData): ValidationResult => {
  switch (nodeType) {
    case 'triggerNode':
      return validateTriggerNode(data);
    case 'formNode':
      return validateFormFields(data.formFields || []);
    case 'approvalNode':
      return validateApprovalNode(data);
    case 'conditionNode':
      return validateConditionNode(data);
    case 'updateNode':
      return validateUpdateNode(data);
    case 'notificationNode':
      return validateNotificationNode(data);
    case 'delayNode':
      return validateDelayNode(data);
    case 'webhookNode':
      return validateWebhookNode(data);
    case 'apiNode':
      return validateApiNode(data);
    case 'agentNode':
      return validateAgentNode();
    default:
      return { isValid: true, errors: [] };
  }
};

// Validate form fields array
export const validateFormFields = (formFields: FormFieldData[]): ValidationResult => {
  const errors: ValidationError[] = [];
  
  if (formFields.length === 0) {
    errors.push({
      field: 'formFields',
      message: 'At least one form field is required'
    });
  }
  
  formFields.forEach((field, index) => {
    const fieldValidation = validateFormField(field);
    fieldValidation.errors.forEach(error => {
      errors.push({
        field: `formFields[${index}].${error.field}`,
        message: error.message
      });
    });
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Utility function to get error message for a specific field
export const getFieldError = (errors: ValidationError[], fieldName: string): string | null => {
  const error = errors.find(err => err.field === fieldName);
  return error ? error.message : null;
};

// Utility function to check if a field has an error
export const hasFieldError = (errors: ValidationError[], fieldName: string): boolean => {
  return errors.some(err => err.field === fieldName);
}; 