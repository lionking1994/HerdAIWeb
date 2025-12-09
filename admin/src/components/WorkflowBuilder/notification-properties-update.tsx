// Updated notification properties with variable support
import React, { useState } from 'react';
import { X } from 'lucide-react';
import VariableInput from './VariableInput';
import MultiSelectDropdown from '../ui/MultiSelectDropdown';

interface NotificationPropertiesProps {
  node: any;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  userOptions: any[];
}

const NotificationProperties: React.FC<NotificationPropertiesProps> = ({
  node,
  onUpdateNode,
  userOptions
}) => {
  const [emailInput, setEmailInput] = useState('');

  // Email validation function
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailAdd = (email: string) => {
    if (email && isValidEmail(email)) {
      const currentTags = (node.data?.emailTags as string[]) || [];
      if (!currentTags.includes(email)) {
        onUpdateNode(node.id, { 
          emailTags: [...currentTags, email],
          emailInput: ''
        });
      }
    }
  };

  const handleEmailRemove = (index: number) => {
    const currentTags = (node.data?.emailTags as string[]) || [];
    const newTags = currentTags.filter((_, i) => i !== index);
    onUpdateNode(node.id, { emailTags: newTags });
  };

  return (
    <div className="space-y-4">
      {/* Notification Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type
        </label>
        <select
          value={(node.data?.notificationType as string) || ""}
          onChange={(e) =>
            onUpdateNode(node.id, { notificationType: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Type</option>
          <option value="email">Email</option>
          <option value="application">Application</option>
        </select>
      </div>

      {/* Email Notification Fields */}
      {(node.data?.notificationType as string) === 'email' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Addresses
            </label>
            <div className="space-y-2">
              {/* Static email tags */}
              <div className="w-full min-h-[60px] border border-gray-300 rounded-lg p-2">
                <div className="flex flex-wrap gap-2 mb-2">
                  {(node.data?.emailTags as string[])?.map((email, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleEmailRemove(index)}
                        className="text-blue-600 hover:text-blue-800 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleEmailAdd(emailInput.trim());
                      setEmailInput('');
                    }
                  }}
                  onBlur={() => {
                    handleEmailAdd(emailInput.trim());
                    setEmailInput('');
                  }}
                  className="w-full border-none outline-none text-sm"
                  placeholder="Type email address and press Enter..."
                />
              </div>
              
              {/* Variable-based email addresses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Variables
                </label>
                <VariableInput
                  value={(node.data?.emailVariables as string) || ""}
                  onChange={(value) => onUpdateNode(node.id, { emailVariables: value })}
                  placeholder="Use variables for dynamic email addresses (e.g., {{form1.email}})"
                  filterByType={['form']}
                  excludeNodeId={node.id}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use form variables to dynamically set email addresses from form submissions.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Title
            </label>
            <VariableInput
              value={(node.data?.emailTitle as string) || ""}
              onChange={(value) => onUpdateNode(node.id, { emailTitle: value })}
              placeholder="Enter email title (can use variables)"
              excludeNodeId={node.id}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Body
            </label>
            <VariableInput
              value={(node.data?.emailBody as string) || ""}
              onChange={(value) => onUpdateNode(node.id, { emailBody: value })}
              placeholder="Enter email body (can use variables)"
              multiline={true}
              excludeNodeId={node.id}
            />
          </div>
        </>
      )}

      {/* Application Notification Fields */}
      {(node.data?.notificationType as string) === 'application' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select User
            </label>
            <MultiSelectDropdown
              label="Select Users"
              value={(node.data?.selectedUsers as string[]) || []}
              onChange={(newValues) =>
                onUpdateNode(node.id, { selectedUsers: newValues })
              }
              options={userOptions}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notification Text
            </label>
            <VariableInput
              value={(node.data?.notificationText as string) || ""}
              onChange={(value) => onUpdateNode(node.id, { notificationText: value })}
              placeholder="Enter notification text (can use variables)"
              multiline={true}
              excludeNodeId={node.id}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationProperties;
