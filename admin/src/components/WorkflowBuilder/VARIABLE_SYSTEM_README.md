# Workflow Variable System with Node IDs

## Overview

The Workflow Variable System enables dynamic data flow between nodes in the workflow builder using unique node IDs. Each node gets a unique ID based on its type (e.g., `form1`, `agent1`, `pdf1`) which can be used to reference its data throughout the workflow.

## Key Features

- **Unique Node IDs**: Each node gets a unique ID like `form1`, `agent1`, `pdf1`
- **Automatic Variable Generation**: Variables are automatically created from node data
- **Type-Safe References**: Variables are typed and validated
- **Real-Time Updates**: Variables update automatically when source data changes
- **Cross-Node Data Flow**: Any node can reference data from any other node
- **Visual Variable Selector**: Easy-to-use interface for selecting variables

## Node ID System

### ID Generation Rules

- **Form Nodes**: `form1`, `form2`, `form3`, etc.
- **Agent Nodes**: `agent1`, `agent2`, `agent3`, etc.
- **PDF Nodes**: `pdf1`, `pdf2`, `pdf3`, etc.
- **API Nodes**: `api1`, `api2`, `api3`, etc.
- **Webhook Nodes**: `webhook1`, `webhook2`, `webhook3`, etc.
- **Update Nodes**: `update1`, `update2`, `update3`, etc.
- **CRM Update Nodes**: `crmUpdate1`, `crmUpdate2`, `crmUpdate3`, etc.
- **Notification Nodes**: `notification1`, `notification2`, `notification3`, etc.
- **Approval Nodes**: `approval1`, `approval2`, `approval3`, etc.
- **CRM Approval Nodes**: `crmApproval1`, `crmApproval2`, `crmApproval3`, etc.

### ID Uniqueness

- Each node type maintains its own counter
- IDs are unique within a workflow
- When a node is deleted, its ID is not reused
- New nodes get the next available number for their type

## Variable Types

### Form Variables
Generated from form node fields:
- `form1.name` - Text field value
- `form1.email` - Email field value
- `form1.phone` - Phone field value
- `form1.company` - Company field value
- `form1.industry` - Industry field value
- `form1.budget` - Budget field value

### PDF Variables
Generated from PDF node outputs:
- `pdf1.result` - PDF generation result
- `pdf1.url` - Generated PDF URL
- `pdf1.status` - Generation status

### Agent Variables
Generated from agent node responses:
- `agent1.response` - Agent response text
- `agent1.status` - Execution status
- `agent1.confidence` - Response confidence score

### API Variables
Generated from API node responses:
- `api1.response` - API response data
- `api1.status` - HTTP status code
- `api1.headers` - Response headers

### Webhook Variables
Generated from webhook node outputs:
- `webhook1.response` - Webhook response
- `webhook1.status` - Response status

### Update Variables
Generated from update node outputs:
- `update1.result` - Update operation result
- `crmUpdate1.result` - CRM update operation result

### Notification Variables
Generated from notification node outputs:
- `notification1.status` - Notification delivery status

## Usage Examples

### Email Notification with Variables

**Email Addresses:**
```
{{form1.email}}, {{form1.manager_email}}
```

**Email Title:**
```
New submission from {{form1.name}}
```

**Email Body:**
```
Hello {{form1.manager_name}},

A new form has been submitted by {{form1.name}}.

Details:
- Email: {{form1.email}}
- Phone: {{form1.phone}}
- Company: {{form1.company}}

Please review the attached document: {{pdf1.url}}

Best regards,
Workflow System
```

### Agent Prompt with Variables

```
Analyze the following form submission and provide recommendations:

Form Data:
- Name: {{form1.name}}
- Email: {{form1.email}}
- Company: {{form1.company}}
- Industry: {{form1.industry}}
- Budget: {{form1.budget}}

Additional Context:
- Previous interactions: {{api1.response}}
- Document analysis: {{pdf1.result}}

Please provide:
1. Risk assessment
2. Recommended next steps
3. Priority level

Format your response as JSON.
```

### Database Update with Variables

```
Update user record with:
- Email: {{form1.email}}
- Status: {{agent1.status}}
- Last Updated: {{form1.timestamp}}
- Notes: {{agent1.response}}
```

## Implementation

### 1. Node ID Generation

```typescript
// Generate unique node IDs based on type
export const generateNodeId = (nodeType: string, existingNodes: Node[]): string => {
  const typePrefixes: Record<string, string> = {
    'formNode': 'form',
    'agentNode': 'agent',
    'pdfNode': 'pdf',
    'apiNode': 'api',
    'webhookNode': 'webhook',
    'updateNode': 'update',
    'crmUpdateNode': 'crmUpdate',
    'notificationNode': 'notification',
    // ... other types
  };

  const prefix = typePrefixes[nodeType] || 'node';
  
  // Find the highest number for this type
  let maxNumber = 0;
  existingNodes.forEach(node => {
    if (node.id.startsWith(prefix)) {
      const numberPart = node.id.substring(prefix.length);
      const number = parseInt(numberPart, 10);
      if (!isNaN(number) && number > maxNumber) {
        maxNumber = number;
      }
    }
  });

  return `${prefix}${maxNumber + 1}`;
};
```

### 2. Variable Generation

```typescript
// Generate variables from nodes using node IDs
const generateVariablesFromNodes = useCallback(() => {
  const newVariables: WorkflowVariable[] = [];

  nodes.forEach(node => {
    const nodeId = node.id; // e.g., "form1", "agent1"

    switch (node.type) {
      case 'formNode':
        const formFields = node.data?.formFields || [];
        formFields.forEach(field => {
          newVariables.push({
            id: `${nodeId}_${field.name}`,
            name: `${nodeId}.${field.name}`, // e.g., "form1.email"
            type: 'form',
            nodeId,
            fieldName: field.name,
          });
        });
        break;
      // ... other node types
    }
  });

  return newVariables;
}, [nodes]);
```

### 3. Variable Input Component

```typescript
<VariableInput
  value={emailTitle}
  onChange={setEmailTitle}
  placeholder="Enter email title (can use variables)"
  excludeNodeId={currentNodeId}
  filterByType={['form']}
/>
```

## Best Practices

1. **Use Descriptive Node Names**: Node IDs are automatically generated but descriptive
2. **Group Related Variables**: Use consistent naming conventions
3. **Validate Variable References**: Ensure referenced variables exist
4. **Test Variable Resolution**: Verify variables resolve correctly during execution
5. **Document Variable Usage**: Keep track of which variables are used where

## Troubleshooting

### Common Issues

1. **Variable Not Found**: Ensure the source node exists and has generated variables
2. **Circular References**: Avoid referencing variables from nodes that depend on the current node
3. **Type Mismatches**: Ensure variable types match expected input types
4. **Missing Data**: Handle cases where referenced data might be empty

### Debug Tips

1. Use the Variable Management Panel to see all available variables
2. Check the browser console for variable resolution errors
3. Test workflows with sample data to verify variable behavior
4. Use the Node ID Example component for reference

## Migration from Old System

If you have existing workflows using the old variable system:

1. **Backup Your Workflows**: Always backup before migration
2. **Update Node References**: Change old variable references to use new node IDs
3. **Regenerate Variables**: Use the "Generate Variables" button in the variable management panel
4. **Test Thoroughly**: Verify all variable references work correctly

## Future Enhancements

1. **Variable Validation**: Real-time validation of variable references
2. **Variable Dependencies**: Visual representation of variable dependencies
3. **Custom Variable Types**: Support for user-defined variable types
4. **Variable Templates**: Pre-built variable combinations for common use cases
5. **Variable History**: Track changes to variables over time
6. **Node ID Customization**: Allow users to customize node IDs (with validation)
