# Template-Based Prompt System

## Overview

The template-based prompt system allows companies to use their own custom prompts for generating tasks and summaries, while falling back to platform defaults when no company-specific templates are available.

## How It Works

### 1. Prompt Selection Logic

When generating tasks or summaries, the system follows this priority:

1. **Company Template**: If the company has a template for the specific category (`task`, `executive_summary`, `open_task_summary`), use that template's prompt
2. **Platform Default**: If no company template exists, fall back to the platform's default prompt stored in the `prompts` table

### 2. Database Structure

#### Templates Table (`templates`)
- Stores company-specific prompts
- Key fields:
  - `company_id`: Links to the company
  - `category`: The prompt category (`task`, `executive_summary`, `open_task_summary`)
  - `prompt`: The actual prompt text
  - `platform`: NULL for company templates, non-NULL for platform templates

#### Prompts Table (`prompts`)
- Stores platform default prompts
- Contains system-wide prompt configurations
- Used as fallback when no company templates exist

### 3. Implementation Details

#### Core Utility: `promptSelector.js`

The `getPromptForCategory(category, companyId)` function handles the selection logic:

```javascript
const promptConfig = await getPromptForCategory("task", companyId);
```

Returns:
```javascript
{
  promptContent: "The actual prompt text",
  model: "gpt-4",
  modelId: 123,
  maxtokens: 2048,
  apiKey: "api-key",
  provider: "openai",
  source: "company_template", // or "platform_default"
  templateId: 456, // only present for company templates
  templateName: "Custom Task Template" // only present for company templates
}
```

#### Updated Controllers

The following controllers have been updated to use the new system:

1. **Task Generation** (`taskController.js`)
   - `generateTasksInside()`: Uses company templates for task generation
   - `getSummaryOpenTasks()`: Uses company templates for open task summaries

2. **Meeting Summary Generation**
   - `gmeetController.js`: `processGmeetTranscript()`
   - `zoomController.js`: Meeting processing functions
   - `teamsController.js`: Meeting processing functions

### 4. Usage Examples

#### Creating a Company Template

```javascript
// Create a custom task generation template for a company
const template = {
  name: "Custom Task Template",
  description: "Specialized task generation for our company",
  prompt: "Generate tasks focusing on our company's specific processes...",
  company_id: 123,
  category: "task"
};

const createdTemplate = await Template.create(template);
```

#### Using the Prompt Selector

```javascript
const { getPromptForCategory } = require('../utils/promptSelector');

// Get prompt for task generation
const promptConfig = await getPromptForCategory("task", companyId);

// Use the prompt configuration
const response = await test_prompt(
  promptConfig.promptContent,
  transcription,
  promptConfig.maxtokens,
  promptConfig.provider,
  promptConfig.model
);
```

### 5. Logging and Monitoring

The system logs which prompt source is being used:

```
Using prompt source: company_template for company 123 in task generation
Using prompt source: platform_default for company 456 in meeting summary generation
```

### 6. Available Prompt Categories

- `task`: For generating actionable tasks from meeting transcriptions
- `executive_summary`: For generating meeting summaries
- `open_task_summary`: For generating summaries of open tasks

### 7. Testing

Run the test script to verify the implementation:

```bash
cd server
node test_prompt_selector.js
```

The test script covers:
- Company with templates (should use company templates)
- Company without templates (should fallback to platform defaults)
- Available categories listing
- Statistics reporting
- Error handling

### 8. Frontend Integration

The system now provides prompt source information to the frontend through the prompt API endpoint. When fetching prompts, the response includes:

```javascript
{
  "success": true,
  "prompt": "The actual prompt content",
  "modelId": 123,
  "maxtokens": 2048,
  "promptSource": {
    "source": "company_template", // or "platform_default"
    "templateId": 456, // only present for company templates
    "templateName": "Custom Task Template", // only present for company templates
    "model": "gpt-4",
    "provider": "openai"
  }
}
```

This information is displayed in the PromptModal component, showing users:
- Whether they're using a company template or platform default
- The template name (if using a company template)
- The model and provider being used

### 9. Benefits

1. **Customization**: Companies can tailor prompts to their specific needs
2. **Consistency**: Platform defaults ensure consistent behavior when no custom templates exist
3. **Flexibility**: Easy to add new prompt categories
4. **Monitoring**: Clear logging shows which prompt source is being used
5. **Transparency**: Users can see which prompt source is being used in the UI
6. **Backwards Compatibility**: Existing functionality continues to work unchanged

### 10. Email-Based Company Lookup

The system now supports email-based company identification, allowing users to be associated with companies based on their email domains.

#### How It Works

1. **Email Domain Extraction**: The system extracts the company name from the user's email domain
   - Example: `user@example.com` → company name "example"

2. **Company ID Lookup**: The system looks up the company ID using multiple methods:
   - Direct lookup: User's `company_id` field in the database
   - Email-based lookup: Extract company name from email domain and find matching company
   - Fallback: Return null if no company is found

#### Utility Functions

```javascript
const { 
  getCompanyIdFromUserId,
  extractCompanyFromEmail,
  getCompanyIdFromEmail,
  getCompanyFromEmail
} = require('../utils/companyHelper');

// Get company ID from user ID (tries email if no direct company_id)
const companyId = await getCompanyIdFromUserId(userId);

// Extract company name from email
const companyName = extractCompanyFromEmail('user@example.com'); // Returns "example"

// Get company ID from email
const companyId = await getCompanyIdFromEmail('user@example.com');

// Get full company information
const company = await getCompanyFromEmail('user@example.com');
```

#### Database Requirements

The system works with the existing database structure:
- `users` table: Contains user email and optional `company_id`
- `companies` table: Contains company name and domain information
- The system matches email domains to company names (e.g., "example.com" → "example")

### 11. Migration Notes

- Existing platform prompts continue to work as before
- Companies can gradually add custom templates without affecting existing functionality
- The system gracefully handles missing templates by falling back to platform defaults
- Email-based company lookup works with existing database structures
- No database migration required - the system works with existing data structures

### 12. Future Enhancements

Potential improvements for the future:

1. **Template Versioning**: Allow multiple versions of templates
2. **A/B Testing**: Support for testing different template variations
3. **Template Inheritance**: Allow templates to inherit from parent templates
4. **Performance Metrics**: Track which templates perform better
5. **Template Sharing**: Allow companies to share successful templates
