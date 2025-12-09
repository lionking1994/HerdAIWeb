import React, { useState, useEffect } from 'react';
import { CustomFieldDefinition } from '../../types/crm';
import { useCompanyId } from '../../hooks/useCompanyId';
import api from '../../lib/api';

interface CompanyUser {
  id: string;
  name: string;
  email: string;
  title?: string;
  department?: string;
  status: string;
  company_role_name?: string;
}

interface CustomFieldRendererProps {
  field: CustomFieldDefinition;
  value: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  error?: string;
}

export const CustomFieldRenderer: React.FC<CustomFieldRendererProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  error
}) => {
  const companyId = useCompanyId();
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Load company users for user_lookup fields
  useEffect(() => {
    console.log('useEffect triggered:', { fieldType: field.field_type, companyId, field });

    if (field.field_type === 'user_lookup' && companyId) {
      console.log('Loading company users for company ID:', companyId);
      setIsLoadingUsers(true);

      // Use existing users API endpoint with centralized API utility
      api.post('/users/all', {
        company: parseInt(companyId),
        status: 'enabled',
        filter: '',
        page: 1,
        per_page: 100
      })
        .then(response => {
          console.log('API Response:', response.data);
          if (response.data.success && response.data.users) {
            setCompanyUsers(response.data.users);
            console.log('Company users loaded:', response.data.users);
          } else {
            console.log('No users found or invalid response structure');
          }
        })
        .catch(error => {
          console.error('Failed to load company users:', error);
        })
        .finally(() => {
          setIsLoadingUsers(false);
        });
    }
  }, [field.field_type, companyId]);

  // Ensure select_options is always an array for select fields
  const normalizedSelectOptions = (field.field_type === 'single_select' || field.field_type === 'multi_select') &&
    !Array.isArray(field.select_options) ? [] : field.select_options;
  const renderField = () => {
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : field.field_type === 'url' ? 'url' : 'text'}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`}
            placeholder={field.field_label}
            pattern={field.field_type === 'phone' ? "\\d{10}" : undefined}
            inputMode={field.field_type === 'phone' ? 'numeric' : undefined}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange?.(Number(e.target.value))}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`}
            placeholder={field.field_label}
            step="0.01"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`}
          />
        );

      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange?.(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        );

      case 'user_lookup':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select {field.field_label}</option>
            {/* This will be populated with company users */}
            {isLoadingUsers ? (
              <option value="" disabled>Loading users...</option>
            ) : companyUsers.length > 0 ? (
              companyUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}{user.company_role_name ? ` - ${user.company_role_name}` : ''}
                </option>
              ))
            ) : (
              <option value="" disabled>No users found</option>
            )}
          </select>
        );

      case 'single_select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">Select {field.field_label}</option>
            {Array.isArray(normalizedSelectOptions) && normalizedSelectOptions.length > 0 ? (
              normalizedSelectOptions.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))
            ) : (
              <option value="" disabled>No options available</option>
            )}
          </select>
        );

      case 'multi_select':
        return (
         <div className={`space-y-2 border rounded-md p-2 ${error ? 'border-red-500' : 'border-gray-300'}`}>
            <div className="text-sm text-gray-600 mb-2">
              Select one or more options:
            </div>
            <div className="space-y-2">
              {Array.isArray(normalizedSelectOptions) && normalizedSelectOptions.length > 0 ? (
                normalizedSelectOptions.map((option: string) => (
                  <label key={option} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Array.isArray(value) && value.includes(option)}
                      onChange={(e) => {
                        const currentValue = Array.isArray(value) ? value : [];
                        const newValue = e.target.checked
                          ? [...currentValue, option]
                          : currentValue.filter(v => v !== option);
                        console.log('Multi-select checkbox change:', { field: field.field_name, option, checked: e.target.checked, newValue });
                        onChange?.(newValue);
                      }}
                      disabled={disabled}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{option}</span>
                  </label>
                ))
              ) : (
                <div className="text-gray-500 text-sm">No options available</div>
              )}
            </div>
            {Array.isArray(value) && value.length > 0 && (
              <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                Selected: {value.join(', ')}
              </div>
            )}
            <div className="text-xs text-gray-500">
              Debug: value = {JSON.stringify(value)}, type = {typeof value}, isArray = {Array.isArray(value)}
            </div>
          </div>
        );



      default:
        return <div>Unsupported field type: {field.field_type}</div>;
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.field_label}
        {field.is_required && <span className="text-red-500">*</span>}
      </label>
      {renderField()}
      {field.field_description && <p className="text-sm text-gray-500 mt-1">{field.field_description}</p>}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};