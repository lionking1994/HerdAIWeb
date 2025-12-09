import React, { useState, useEffect } from 'react';
import { CustomFieldDefinition, TableName, FieldType } from '../../types/crm';

interface CustomFieldFormProps {
  field?: CustomFieldDefinition;
  tableName: TableName;
  onSubmit: (data: Partial<CustomFieldDefinition>) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function CustomFieldForm({ field, tableName, onSubmit, onCancel, isSubmitting }: CustomFieldFormProps) {
  const [formData, setFormData] = useState({
    field_name: '',
    field_type: 'text' as FieldType,
    field_label: '',
    field_description: '',
    is_required: false,
    default_value: '',
    validation_rules: {},
    select_options: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    if (field) {
      setFormData({
        field_name: field.field_name || '',
        field_type: (field.field_type === 'select' as any ? 'single_select' : field.field_type) || 'text',
        field_label: field.field_label || '',
        field_description: field.field_description || '',
        is_required: field.is_required || false,
        default_value: field.default_value ? String(field.default_value) : '',
        validation_rules: field.validation_rules || {},
        select_options: field.select_options || [],
      });
    }
  }, [field]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addSelectOption = () => {
    if (newOption.trim() && !formData.select_options.includes(newOption.trim())) {
      setFormData(prev => ({
        ...prev,
        select_options: [...prev.select_options, newOption.trim()]
      }));
      setNewOption('');
    }
  };

  const removeSelectOption = (option: string) => {
    setFormData(prev => ({
      ...prev,
      select_options: prev.select_options.filter(o => o !== option)
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.field_name.trim()) {
      newErrors.field_name = 'Field name is required';
    } else if (!/^[a-z_][a-z0-9_]*$/.test(formData.field_name)) {
      newErrors.field_name = 'Field name must be lowercase with underscores only';
    }
    
    if (!formData.field_label.trim()) {
      newErrors.field_label = 'Field label is required';
    }

    if ((formData.field_type === 'single_select' || formData.field_type === 'multi_select') && formData.select_options.length === 0) {
      newErrors.select_options = 'Select options are required for select fields';
    }

    // Validate default value based on field type
    if (formData.default_value) {
      if (formData.field_type === 'number') {
        if (isNaN(parseFloat(formData.default_value))) {
          newErrors.default_value = 'Default value must be a valid number';
        }
      } else if (formData.field_type === 'date') {
        if (isNaN(Date.parse(formData.default_value))) {
          newErrors.default_value = 'Default value must be a valid date';
        }
      } else if (formData.field_type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.default_value)) {
          newErrors.default_value = 'Default value must be a valid email address';
        }
      } else if (formData.field_type === 'url') {
        try {
          new URL(formData.default_value);
        } catch {
          newErrors.default_value = 'Default value must be a valid URL';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Handle default value based on field type
      let processedDefaultValue = undefined;
      
      if (formData.default_value) {
        if (formData.field_type === 'boolean') {
          // For boolean fields, convert string to boolean
          processedDefaultValue = formData.default_value === 'true';
        } else if (formData.field_type === 'number') {
          // For number fields, convert string to number
          processedDefaultValue = parseFloat(formData.default_value);
        } else {
          // For text, email, phone, url, date fields, use as is
          processedDefaultValue = formData.default_value;
        }
      }
      
             const submitData = {
         ...formData,
         table_name: tableName,
         default_value: processedDefaultValue,
         validation_rules: formData.validation_rules && Object.keys(formData.validation_rules).length > 0 ? formData.validation_rules : {},
         select_options: formData.select_options && formData.select_options.length > 0 ? formData.select_options : [],
       };
      onSubmit(submitData);
    }
  };

  const fieldTypes: { value: FieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'url', label: 'URL' },
    { value: 'single_select', label: 'Single Select' },
    { value: 'multi_select', label: 'Multi Select' },
    { value: 'user_lookup', label: 'User Lookup' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {field ? 'Edit Custom Field' : 'Create New Custom Field'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Field Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Name *
              </label>
              <input
                type="text"
                value={formData.field_name}
                onChange={(e) => handleChange('field_name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.field_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., credit_rating"
                disabled={!!field} // Can't change field name after creation
              />
              {errors.field_name && <p className="text-red-500 text-sm mt-1">{errors.field_name}</p>}
              <p className="text-xs text-gray-500 mt-1">
                Use lowercase letters and underscores only
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Type *
              </label>
              <select
                value={formData.field_type}
                onChange={(e) => handleChange('field_type', e.target.value as FieldType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!!field} // Can't change field type after creation
              >
                {fieldTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Label *
            </label>
            <input
              type="text"
              value={formData.field_label}
              onChange={(e) => handleChange('field_label', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.field_label ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Credit Rating"
            />
            {errors.field_label && <p className="text-red-500 text-sm mt-1">{errors.field_label}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.field_description}
              onChange={(e) => handleChange('field_description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter field description"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_required"
              checked={formData.is_required}
              onChange={(e) => handleChange('is_required', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_required" className="ml-2 block text-sm text-gray-900">
              This field is required
            </label>
          </div>

          {/* Default Value */}
          {(formData.field_type === 'text' || formData.field_type === 'email' || formData.field_type === 'phone' || formData.field_type === 'url') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Value
              </label>
              <input
                type="text"
                value={formData.default_value}
                onChange={(e) => handleChange('default_value', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.default_value ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter default value"
              />
              {errors.default_value && <p className="text-red-500 text-sm mt-1">{errors.default_value}</p>}
            </div>
          )}

          {formData.field_type === 'number' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Value
              </label>
              <input
                type="number"
                value={formData.default_value}
                onChange={(e) => handleChange('default_value', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.default_value ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter default value"
                step="0.01"
              />
              {errors.default_value && <p className="text-red-500 text-sm mt-1">{errors.default_value}</p>}
            </div>
          )}

          {formData.field_type === 'date' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Value
              </label>
              <input
                type="date"
                value={formData.default_value}
                onChange={(e) => handleChange('default_value', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.default_value ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.default_value && <p className="text-red-500 text-sm mt-1">{errors.default_value}</p>}
            </div>
          )}

          {formData.field_type === 'boolean' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Value
              </label>
              <select
                value={formData.default_value}
                onChange={(e) => handleChange('default_value', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.default_value ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">No default</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
              {errors.default_value && <p className="text-red-500 text-sm mt-1">{errors.default_value}</p>}
            </div>
          )}

          {/* Select Options */}
          {(formData.field_type === 'single_select' || formData.field_type === 'multi_select') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Options *
              </label>
              <div className="space-y-2">
                {formData.select_options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="flex-1 px-3 py-2 bg-gray-100 rounded-md">{option}</span>
                    <button
                      type="button"
                      onClick={() => removeSelectOption(option)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Add new option"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSelectOption())}
                  />
                  <button
                    type="button"
                    onClick={addSelectOption}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Add
                  </button>
                </div>
                {errors.select_options && <p className="text-red-500 text-sm mt-1">{errors.select_options}</p>}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (field ? 'Update Field' : 'Create Field')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}