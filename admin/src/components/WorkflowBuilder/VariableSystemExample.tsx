import React from 'react';
import { FileText, Mail, Bot, File } from 'lucide-react';

/**
 * Variable System Example
 * 
 * This demonstrates how the new variable system works in the workflow builder.
 * 
 * Key Features:
 * 1. Automatic variable generation from nodes
 * 2. Variable referencing with {{variableName}} syntax
 * 3. Type-safe variable management
 * 4. Real-time variable updates
 * 5. Cross-node data flow
 */

const VariableSystemExample: React.FC = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Workflow Variable System</h1>
      
      <div className="space-y-8">
        {/* Overview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">System Overview</h2>
          <p className="text-blue-800 mb-4">
            The variable system allows nodes to reference data from other nodes in the workflow,
            enabling dynamic data flow and reducing the need for static configurations.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">Before (Static)</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Hard-coded email addresses</li>
                <li>• Static notification text</li>
                <li>• No data flow between nodes</li>
                <li>• Manual configuration required</li>
              </ul>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">After (Dynamic)</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Dynamic email from form data</li>
                <li>• Personalized notification text</li>
                <li>• Automatic data flow</li>
                <li>• Self-configuring workflows</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Variable Types */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Variable Types</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Form Variables */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium text-gray-900">Form Variables</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Automatically generated from form fields
              </p>
              <div className="space-y-2">
                <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                  form1.email
                </div>
                <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                  form1.name
                </div>
                <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                  form1.phone
                </div>
              </div>
            </div>

            {/* PDF Variables */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <File className="w-5 h-5 text-red-600" />
                <h3 className="font-medium text-gray-900">PDF Variables</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Generated from PDF node outputs
              </p>
              <div className="space-y-2">
                <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                  pdf1.result
                </div>
                <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                  pdf1.url
                </div>
              </div>
            </div>

            {/* Agent Variables */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-5 h-5 text-green-600" />
                <h3 className="font-medium text-gray-900">Agent Variables</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Generated from agent responses
              </p>
              <div className="space-y-2">
                <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                  agent1.response
                </div>
                <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                  agent1.status
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Examples */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Examples</h2>
          
          {/* Email Notification Example */}
          <div className="border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-teal-600" />
              <h3 className="font-medium text-gray-900">Email Notification</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Addresses
                </label>
                <div className="text-sm font-mono bg-gray-100 p-2 rounded">
                  {`{{form1.email}}, {{form1.manager_email}}`}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Uses email addresses from form fields
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Title
                </label>
                <div className="text-sm font-mono bg-gray-100 p-2 rounded">
                  {`New submission from {{form1.name}}`}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Personalized subject line
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body
                </label>
                <div className="text-sm font-mono bg-gray-100 p-2 rounded whitespace-pre-line">
                  {`Hello {{form1.manager_name}},

A new form has been submitted by {{form1.name}}.

Details:
- Email: {{form1.email}}
- Phone: {{form1.phone}}
- Company: {{form1.company}}

Please review the attached document: {{pdf1.url}}

Best regards,
Workflow System`}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Dynamic content with form data and PDF reference
                </p>
              </div>
            </div>
          </div>

          {/* Agent Prompt Example */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-5 h-5 text-green-600" />
              <h3 className="font-medium text-gray-900">Agent Prompt</h3>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agent Prompt
              </label>
              <div className="text-sm font-mono bg-gray-100 p-2 rounded whitespace-pre-line">
                {`Analyze the following form submission and provide recommendations:

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

Format your response as JSON.`}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Agent uses multiple data sources for comprehensive analysis
              </p>
            </div>
          </div>
        </div>

        {/* Implementation Steps */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-green-900 mb-4">Implementation Steps</h2>
          <ol className="space-y-3 text-green-800">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <div>
                <strong>Create Form Node:</strong> Add form fields (name, email, etc.)
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <div>
                <strong>Generate Variables:</strong> System automatically creates form1.name, form1.email, etc.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <div>
                <strong>Configure Notification:</strong> Use {{form1.email}} in email addresses field
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <div>
                <strong>Test Workflow:</strong> Variables are automatically populated during execution
              </div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default VariableSystemExample;
