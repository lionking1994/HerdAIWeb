# MCP Prompt Composition in Workflow Builder

## Overview

The workflow builder now supports **prompt composition directly in MCP/Agent nodes**, addressing the client requirement: *"I would think the prompt would be built on the MCP node right? Not always going to do MCP after form…"*

## Key Features

### 1. Prompt Composition in Agent Nodes
- **Direct prompt building**: Users can now compose prompts directly in MCP/Agent nodes
- **No dependency on forms**: MCP nodes can work independently without requiring upstream form nodes
- **Rich prompt editor**: Drag-and-drop interface for building dynamic prompts

### 2. Dynamic Prompt Variables
- **Form field tags**: Use `{{fieldName}}` syntax to reference form fields from upstream nodes
- **Workflow context**: Access workflow data and user information
- **Real-time preview**: See how your prompt will look with actual values

### 3. Enhanced User Experience
- **Node-specific interface**: Different prompts and instructions for Agent vs Form nodes
- **Visual feedback**: Clear indication of current prompt and edit options
- **Intuitive workflow**: Seamless integration with existing workflow builder

## How It Works

### For Agent/MCP Nodes:
1. **Configure MCP Details**: Set up your MCP server configuration (JSON)
2. **Compose Agent Prompt**: Click "Compose Prompt" to open the prompt editor
3. **Build Dynamic Prompts**: Use form field tags and workflow context
4. **Execute**: The MCP agent will execute your composed prompt

### Example Workflows:

#### Independent MCP Node:
```
Trigger → Agent Node (with prompt: "Find AI startups in Silicon Valley")
```

#### Form + MCP Workflow:
```
Trigger → Form (collects: location, industry) → Agent Node (prompt: "Find {{industry}} companies in {{location}}")
```

#### Complex Workflow:
```
Trigger → Form → Approval → Agent Node (prompt: "Analyze {{companyName}} for {{analysisType}}") → Notification
```

## Technical Implementation

### Agent Node Properties:
- **MCP Configuration**: JSON-based MCP server setup
- **Agent Prompt**: Composed prompt for MCP agent execution
- **Prompt Instructions**: Built-in guidance for effective prompt creation

### Prompt Composition Modal:
- **Node-aware interface**: Different UI for Agent vs Form nodes
- **Field tag support**: Drag-and-drop form field integration
- **Context variables**: Access to workflow and user data
- **Real-time preview**: Live prompt preview

### Backend Integration:
- **Prompt storage**: Prompts stored with node configuration
- **Variable substitution**: Form field values injected at runtime
- **MCP execution**: Agent executes composed prompts with context

## Benefits

1. **Flexibility**: MCP nodes can work independently or with forms
2. **User Control**: Direct control over what the MCP agent does
3. **Dynamic Content**: Prompts adapt based on form data and workflow context
4. **Better UX**: Intuitive prompt building interface
5. **Scalability**: Supports complex workflow scenarios

## Usage Examples

### Simple Company Search:
```
Prompt: "Find technology companies in {{location}}"
```

### Data Analysis:
```
Prompt: "Analyze {{companyName}} for {{analysisType}} and provide insights on {{focusArea}}"
```

### Research Query:
```
Prompt: "Research {{topic}} in {{industry}} sector with focus on {{timeframe}}"
```

### Custom Instructions:
```
Prompt: "Using the provided data {{formData}}, generate a comprehensive report on {{subject}} with recommendations for {{stakeholder}}"
```

## Future Enhancements

1. **Advanced Variables**: More workflow context variables
2. **Prompt Templates**: Pre-built prompt templates for common use cases
3. **Prompt Validation**: Syntax checking and validation
4. **Multi-step Prompts**: Complex prompt chains within a single node
5. **Prompt History**: Version control for prompts

---

This enhancement directly addresses the client's feedback and provides a more intuitive and flexible workflow building experience. 