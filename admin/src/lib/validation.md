# Workflow Properties Validation System

This document describes the form validation system implemented for the workflow properties panel.

## Overview

The validation system provides comprehensive form validation for all workflow node types, ensuring data integrity and user experience. It includes:

- Real-time validation feedback
- Visual error indicators
- Comprehensive error messages
- Support for all node types

## Validation Functions

### Basic Validation Functions

- `validateRequired(value, fieldName)` - Checks if a field is not empty
- `validateMinLength(value, minLength, fieldName)` - Validates minimum string length
- `validateMaxLength(value, maxLength, fieldName)` - Validates maximum string length
- `validateEmail(value, fieldName)` - Validates email format
- `validateUrl(value, fieldName)` - Validates URL format
- `validateNumber(value, fieldName)` - Validates numeric values
- `validateMinValue(value, minValue, fieldName)` - Validates minimum numeric value
- `validateMaxValue(value, maxValue, fieldName)` - Validates maximum numeric value
- `validatePattern(value, pattern, fieldName)` - Validates against regex pattern

### Node-Specific Validation Functions

- `validateNodeLabel(label)` - Validates node names (2-50 characters)
- `validateTriggerNode(data)` - Validates trigger node configuration
- `validateFormField(field)` - Validates individual form fields
- `validateApprovalNode(data)` - Validates approval node configuration
- `validateConditionNode(data)` - Validates condition node configuration
- `validateUpdateNode(data)` - Validates update node configuration
- `validateNotificationNode(data)` - Validates notification node configuration
- `validateDelayNode(data)` - Validates delay node configuration
- `validateWebhookNode(data)` - Validates webhook node configuration
- `validateApiNode(data)` - Validates API node configuration
- `validateAgentNode()` - Validates agent node configuration

### Main Validation Function

- `validateNodeData(nodeType, data)` - Main function that routes to appropriate validation based on node type

## Validation Rules

### Node Name
- Required
- 2-50 characters
- Cannot be empty

### Trigger Node
- Table: Required (Meeting, Task, User)
- Action: Required (create, update, delete)

### Form Node
- At least one form field required
- Each field must have:
  - Name: Required, 2-30 characters, alphanumeric + underscore, must start with letter
  - Type: Required (text, dropdown, memo, file, radio, signature)
  - Options: Required for dropdown/radio, must be unique

### Approval Node
- Approvers: At least one approver required

### Condition Node
- Field: Required
- Operator: Required (=, !=, >, <)
- Value: Required

### Update Node
- Table: Required
- Field: Required
- Record Criteria: Required
- Value: Required

### Notification Node
- Type: Required (email, application)
- Title: Required
- Message: Required

### Delay Node
- Time Period: Required (minutes, hours, days)
- Duration: Required, positive number, minimum 1

### Webhook Node
- URL: Required, valid HTTP/HTTPS URL
- Method: Required (GET, POST, PUT, DELETE)

### API Node
- Endpoint: Required
- Method: Required

## Usage in Components

The validation system is integrated into the `NodePropertiesPanel` component:

```typescript
import { 
  validateNodeData, 
  validateNodeLabel, 
  ValidationError, 
  getFieldError, 
  hasFieldError 
} from '../../lib/validation';

// Validation state
const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

// Real-time validation
useEffect(() => {
  const nodeValidation = validateNodeData(node.type || '', node.data || {});
  const labelValidation = validateNodeLabel((node.data?.label as string) || '');
  
  const allErrors = [...nodeValidation.errors, ...labelValidation.errors];
  setValidationErrors(allErrors);
}, [node.data, node.type]);

// Display validation errors
const renderValidationError = (fieldName: string) => {
  const error = getFieldError(validationErrors, fieldName);
  if (!error) return null;
  
  return (
    <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
      <AlertCircle className="w-3 h-3" />
      <span>{error}</span>
    </div>
  );
};

// Apply error styling to form fields
className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
  hasFieldError(validationErrors, 'Field Name') ? 'border-red-300 bg-red-50' : 'border-gray-300'
}`}
```

## Error Display

The validation system provides:

1. **Field-level errors**: Red border and background for invalid fields
2. **Error messages**: Small red text below each field with specific error
3. **Validation summary**: Red box at the top showing all errors when present
4. **Real-time feedback**: Errors clear as user types valid data

## Extending the System

To add validation for new node types:

1. Create a validation function following the pattern: `validateNewNodeType(data: NodeData): ValidationResult`
2. Add the new type to the `validateNodeData` switch statement
3. Update the `NodeData` interface if new fields are needed
4. Add validation error display to the corresponding render function

## Best Practices

- Always validate required fields
- Provide clear, user-friendly error messages
- Use appropriate validation types (email, URL, number, etc.)
- Validate field patterns for consistency
- Clear errors when user starts correcting them
 