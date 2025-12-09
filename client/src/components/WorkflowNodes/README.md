# WorkflowNodes Components

This directory contains React components for rendering different types of workflow nodes in the HerdAI application.

## FormNode Component

The `FormNode` component has been enhanced to provide rich display capabilities for different form field types, including file downloads and signature image display.

### Features

#### 🎯 Smart Type Detection
- **Explicit Type Definition**: Uses `formFields` array when available for precise type detection
- **Automatic Type Inference**: Falls back to intelligent type detection based on data values
- **Pattern Recognition**: Automatically identifies file URLs and signature data URIs

#### 📁 File Handling
- **Download Icons**: Beautiful download buttons with FileText and Download icons from Lucide React
- **URL Validation**: Robust URL validation with error handling for invalid file URLs
- **Filename Extraction**: Automatically extracts and displays meaningful filenames
- **Multiple File Types**: Supports various file formats (PDF, DOC, images, etc.)

#### ✍️ Signature Display
- **Image Rendering**: Displays signature images with proper sizing and borders
- **Raw Data Display**: Shows the underlying data URI with truncation for readability
- **Copy Functionality**: One-click copy of full signature data
- **Error Handling**: Graceful fallback when images fail to load

#### 🎨 Rich Field Type Support
- **Text Fields**: Standard text, email, phone, URL with proper formatting
- **Form Controls**: Checkbox, radio, dropdown with styled badges
- **Data Types**: Date, number with validation and formatting
- **Long Content**: Textarea/memo with proper whitespace handling
- **Interactive Elements**: Clickable email, phone, and URL fields

### Usage

```jsx
import { FormNode } from '../components/WorkflowNodes';

const MyComponent = () => {
  const nodeInstance = {
    node_name: 'My Form',
    formFields: [
      { name: 'document', type: 'file' },
      { name: 'signature', type: 'signature' }
    ],
    data: {
      document: 'https://api.example.com/upload/files/document.pdf',
      signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    }
  };

  return <FormNode nodeInstance={nodeInstance} />;
};
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `nodeInstance` | `Object` | The node instance containing form data and configuration |

### Node Instance Structure

```typescript
interface NodeInstance {
  node_name?: string;           // Display name for the form
  formFields?: FormField[];     // Optional field definitions
  data: Record<string, any>;    // Form data values
}

interface FormField {
  name: string;                 // Field name
  type: FieldType;             // Field type
  required?: boolean;           // Required flag
  options?: string[];          // Options for dropdown/radio
  placeholder?: string;         // Placeholder text
  validation?: string;         // Validation rules
}

type FieldType = 
  | 'text' | 'email' | 'phone' | 'url'
  | 'textarea' | 'memo' | 'dropdown' | 'radio'
  | 'checkbox' | 'date' | 'number' | 'file' | 'signature';
```

### Type Detection Logic

1. **Primary**: Uses `formFields` array if available
2. **Fallback**: Infers types from data values:
   - URLs containing `/upload/` or `/files/` → `file`
   - Data URIs starting with `data:image/` → `signature`
   - Email patterns → `email`
   - Phone patterns → `phone`
   - URL patterns → `url`
   - Date strings → `date`
   - Numbers → `number`
   - Booleans → `checkbox`
   - Objects → JSON display

### Styling

The component uses Tailwind CSS classes and provides:
- **Responsive Design**: Adapts to different screen sizes
- **Consistent Spacing**: Uniform padding and margins
- **Visual Hierarchy**: Clear distinction between field types
- **Interactive States**: Hover effects and transitions
- **Error Handling**: Red styling for validation errors

### Icons

Uses Lucide React icons for consistent visual language:
- `FileText`: File fields
- `Download`: Download buttons
- `Image`: Signature fields
- `AlertCircle`: Error states

### Browser Compatibility

- **Modern Browsers**: Full support for all features
- **Clipboard API**: Copy functionality requires HTTPS or localhost
- **Image Loading**: Graceful fallback for failed image loads
- **URL Validation**: Uses native URL constructor with fallback

### Performance Considerations

- **Lazy Rendering**: Only renders visible fields
- **Image Optimization**: Limits signature image height
- **Data Truncation**: Shows limited raw data with copy option
- **Error Boundaries**: Prevents component crashes from invalid data

### Examples

See `FormNodeDemo.js` for comprehensive examples of all field types and configurations.

### Contributing

When adding new field types:
1. Add the type to the `FieldType` union
2. Implement rendering logic in `renderFieldValue`
3. Add type detection in `getFieldType`
4. Update this documentation
5. Add examples to the demo component

### Related Components

- `ApprovalNode`: For approval workflow steps
- `AgentNode`: For AI-powered workflow steps
- `GenericNode`: For fallback node types
- `CrmApprovalNode`: For CRM-specific approvals 