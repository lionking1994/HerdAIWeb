import React, { useState, useEffect } from 'react';

const DynamicFormModal = ({ config, isOpen, onClose }) => {
  const [formData, setFormData] = useState(() => {
    const initialData = {};
    config?.formFields?.forEach(field => {
      initialData[field.name] = '';
    });
    return initialData;
  });

  const [errors, setErrors] = useState({});

  // Optional: If config might change during component lifecycle, reset formData accordingly
  useEffect(() => {
    const resetData = {};
    config?.formFields?.forEach(field => {
      resetData[field.name] = '';
    });
    setFormData(resetData);
    setErrors({});
  }, [config]);

  if (!isOpen) return null;
  
  const { formFields, description } = config;

  const validateField = (name, value, validation) => {
    if (!validation || validation === 'none') return '';
    
    switch (validation) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? '' : 'Please enter a valid email address';
      
      case 'number':
        if (value === '') return ''; // Allow empty for optional fields
        return !isNaN(value) && value !== '' ? '' : 'Please enter a valid number';
      
      case 'required':
        return value.trim() !== '' ? '' : 'This field is required';
      
      default:
        return '';
    }
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleBlur = (name, value, validation) => {
    const error = validateField(name, value, validation);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    formFields.forEach(field => {
      const value = formData[field.name];
      let error = '';

      // Check required fields
      if (field.required && (!value || value.trim() === '')) {
        error = 'This field is required';
        isValid = false;
      } else if (value && value.trim() !== '') {
        // Validate based on validation type
        error = validateField(field.name, value, field.validation);
        if (error) isValid = false;
      }

      if (error) {
        newErrors[field.name] = error;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      console.log('Form submitted:', formData);
      onClose();
    }
  };

  const renderField = (field) => {
    const { name, type, options, required, validation, placeholder } = field;
    const value = formData[name];
    const error = errors[name];

    const baseInputClasses = "w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500";
    const errorClasses = error ? "border-red-500" : "border-gray-300";

    switch (type) {
      case 'memo':
        return (
          <textarea
            className={`${baseInputClasses} ${errorClasses} resize-none min-h-[80px]`}
            placeholder={placeholder}
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            onBlur={(e) => handleBlur(name, e.target.value, validation)}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            className={`${baseInputClasses} ${errorClasses}`}
            placeholder={placeholder}
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            onBlur={(e) => handleBlur(name, e.target.value, validation)}
          />
        );

      case 'select':
        return (
          <select
            className={`${baseInputClasses} ${errorClasses}`}
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            onBlur={(e) => handleBlur(name, e.target.value, validation)}
          >
            <option value="">{placeholder || 'Select an option'}</option>
            {options.map((option, index) => (
              <option key={index} value={option.value || option}>
                {option.label || option}
              </option>
            ))}
          </select>
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            className={`${baseInputClasses} ${errorClasses}`}
            placeholder={placeholder}
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            onBlur={(e) => handleBlur(name, e.target.value, validation)}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50">
      <div className="bg-white text-left rounded-lg shadow-lg max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-2">{config.label}</h2>
        {description && <p className="mb-4 text-gray-600">{description}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {formFields.map((field, index) => (
            <div key={index}>
              <label className="block mb-1 font-medium text-gray-700">
                {field.name}{field.required && ' *'}
              </label>
              {renderField(field)}
              {errors[field.name] && (
                <p className="text-red-500 text-sm mt-1">{errors[field.name]}</p>
              )}
            </div>
          ))}
          <div className="flex justify-end space-x-2 mt-6">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DynamicFormModal;