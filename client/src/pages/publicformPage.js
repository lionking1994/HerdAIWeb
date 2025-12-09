import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const PublicFormPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const magicToken = searchParams.get('magic_token') || searchParams.get('token');
  
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null); // 'success' or 'error'
  const [isLoading, setIsLoading] = useState(true);
  const [formConfig, setFormConfig] = useState(null);
  const [error, setError] = useState(null);
  
  // Add refs for signature canvas
  const signatureCanvasRef = useRef(null);
  const [signatureCanvas, setSignatureCanvas] = useState(null);

  useEffect(() => {
    if (!magicToken) {
      setError('Missing required magic token');
      setIsLoading(false);
      return;
    }

    fetchFormConfig();
  }, [magicToken]);

  // Initialize signature canvas when component mounts
  useEffect(() => {
    if (signatureCanvasRef.current) {
      const canvas = signatureCanvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      // Set drawing styles
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      
      setSignatureCanvas(canvas);
      
      // Add drawing event listeners
      let isDrawing = false;
      let lastX = 0;
      let lastY = 0;
      
      const startDrawing = (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        lastX = e.clientX - rect.left;
        lastY = e.clientY - rect.top;
      };
      
      const draw = (e) => {
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        lastX = x;
        lastY = y;
      };
      
      const stopDrawing = () => {
        isDrawing = false;
      };
      
      canvas.addEventListener('mousedown', startDrawing);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stopDrawing);
      canvas.addEventListener('mouseout', stopDrawing);
      
      // Touch events for mobile
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        lastX = touch.clientX - rect.left;
        lastY = touch.clientY - rect.top;
        isDrawing = true;
      });
      
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        lastX = x;
        lastY = y;
      });
      
      canvas.addEventListener('touchend', stopDrawing);
      
      // Cleanup function
      return () => {
        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stopDrawing);
        canvas.removeEventListener('mouseout', stopDrawing);
        canvas.removeEventListener('touchstart', startDrawing);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stopDrawing);
      };
    }
  }, [signatureCanvasRef.current]);

  const fetchFormConfig = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/workflow/public-form-config`,
        {
          params: { magic_token: magicToken }
        }
      );

      if (response.data.success) {
        setFormConfig(response.data.formConfig);
      } else {
        setError('Failed to load form configuration');
      }
    } catch (error) {
      console.error('Error fetching form config:', error);
      setError('Error loading form configuration');
    } finally {
      setIsLoading(false);
    }
  };

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateURL = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const validateNumber = (value, min, max) => {
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
  };

  const validateRequired = (value) => {
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (typeof value === 'boolean') {
      return value === true;
    }
    return value !== null && value !== undefined;
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };

  const validateDate = (date) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
  };

  const validateTime = (time) => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const validateZipCode = (zipcode) => {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    return zipRegex.test(zipcode);
  };

  const validateSSN = (ssn) => {
    const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;
    return ssnRegex.test(ssn);
  };

  const validateCreditCard = (card) => {
    const cardRegex = /^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/;
    return cardRegex.test(card.replace(/\s/g, ''));
  };

  // Signature handling functions
  const handleClearSignature = () => {
    if (signatureCanvas) {
      const ctx = signatureCanvas.getContext('2d');
      ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
      setFormData(prev => ({
        ...prev,
        signature: null
      }));
    }
  };

  const getSignatureData = () => {
    if (signatureCanvas) {
      return signatureCanvas.toDataURL('image/png');
    }
    return null;
  };

  // File upload function
  const uploadFile = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/upload/file`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(magicToken ? {} : { 'Authorization': `Bearer ${localStorage.getItem('token')}` })
          }
        }
      );
      
      if (response.data.success) {
        return response.data.fileUrl;
              } else {
        throw new Error(response.data.error || 'File upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  function ensureWwwUrl(url) {
    try {
      // Add https:// if no protocol is present
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
  
      const urlObj = new URL(url);
      
      // If hostname doesn't start with www., add it
      if (!urlObj.hostname.startsWith('www.')) {
        urlObj.hostname = 'www.' + urlObj.hostname;
      }
  
      let result = urlObj.toString();
      
      // Remove trailing slash if present
      if (result.endsWith('/')) {
        result = result.slice(0, -1);
      }
  
      return result;
    } catch (e) {
      console.error('Invalid URL:', e);
      return url; // Return original if URL parsing fails
    }
  }

  const validateField = (field, value) => {
    const { type, required, min, max, pattern, validation } = field;
    let error = '';

    // Check required fields
    if (required && !validateRequired(value)) {
      return {error: `${field.name} is required`,validatedValue: value};
    }

    // Skip further validation if field is empty and not required
    if (!required && (value === '' || value === null || value === undefined)) {
      return {error: '',validatedValue: value};
    }

    // Type-specific validation
    switch (type) {
      case 'text':
        if (validation && value) {
          switch (validation) {
            case 'email':
              if (!validateEmail(value)) {
                error = 'Please enter a valid email address';
              }
              break;
            case 'phone':
              if (!validatePhone(value)) {
                error = 'Please enter a valid phone number';
              }
              break;
            case 'url':
              // URL validation is handled in the submit function
              break;
            case 'number':
              if (!validateNumber(value, min, max)) {
                if (min !== undefined && max !== undefined) {
                  error = `${field.name} must be between ${min} and ${max}`;
                } else if (min !== undefined) {
                  error = `${field.name} must be at least ${min}`;
                } else if (max !== undefined) {
                  error = `${field.name} must be at most ${max}`;
                  } else {
                  error = 'Please enter a valid number';
                }
              }
              break;
            case 'date':
              if (!validateDate(value)) {
                error = 'Please enter a valid date (YYYY-MM-DD)';
              }
              break;
            case 'time':
              if (!validateTime(value)) {
                error = 'Please enter a valid time (HH:MM)';
              }
              break;
            case 'zipcode':
              if (!validateZipCode(value)) {
                error = 'Please enter a valid zip code';
              }
              break;
            case 'ssn':
              if (!validateSSN(value)) {
                error = 'Please enter a valid SSN (XXX-XX-XXXX)';
              }
              break;
            case 'creditcard':
              if (!validateCreditCard(value)) {
                error = 'Please enter a valid credit card number';
              }
              break;
            case 'none':
              // No validation needed
              break;
            default:
              // Custom pattern validation
              if (pattern && value) {
                const regex = new RegExp(pattern);
                if (!regex.test(value)) {
                  error = `Please enter a valid ${field.name}`;
                }
              }
              break;
          }
        }
        break;

      case 'email':
        if (value && !validateEmail(value)) {
          error = 'Please enter a valid email address';
        }
        break;

      case 'number':
        if (value && !validateNumber(value, min, max)) {
          if (min !== undefined && max !== undefined) {
            error = `${field.name} must be between ${min} and ${max}`;
          } else if (min !== undefined) {
            error = `${field.name} must be at least ${min}`;
          } else if (max !== undefined) {
            error = `${field.name} must be at most ${max}`;
          } else {
            error = 'Please enter a valid number';
          }
        }
        break;

      case 'signature':
        if (required && !value) {
          error = 'Signature is required';
        }
        break;

      case 'file':
        if (required && !value) {
          error = 'File is required';
        }
        break;

      default:
        break;
    }

    return {error,validatedValue: value};
  };

  const validateForm = () => {
    if (!formConfig || !formConfig.fields) return true;

    const errors = {};
    let isValid = true;

    formConfig.fields.forEach(field => {
      const {error,validatedValue} = validateField(field, formData[field.name]);
      if (error) {
        errors[field.name] = error;
        isValid = false;
      }
      formData[field.name] = validatedValue;
    });

    setFormErrors(errors);
    return isValid;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setIsSubmitting(true);
    let formDataToSend = { ...formData };
    
    try {
      // Handle file uploads and signature data
      if (formConfig) {
        await Promise.all(Object.values(formConfig.fields).map(async (field) => {
          const fieldName = field.name;
          
          // Handle URL fields
          if (field.type === 'text' && field.validation === 'url' && formDataToSend[fieldName]) {
      const response = await axios.post(
              `${process.env.REACT_APP_API_URL}/workflow/update-url`,
              { url: formDataToSend[fieldName] },
        {
          headers: {
                  ...(magicToken ? {} : { 'Authorization': `Bearer ${localStorage.getItem('token')}` })
                }
              }
            );
            formDataToSend[fieldName] = response.data.result;
          }
          
          // Handle file uploads
          if (field.type === 'file' && formDataToSend[fieldName]) {
            try {
              const fileUrl = await uploadFile(formDataToSend[fieldName]);
              formDataToSend[fieldName] = fileUrl; // Store URL instead of file object
            } catch (error) {
              toast.error(`Failed to upload ${fieldName}: ${error.message}`);
              setIsSubmitting(false);
        return;
      }
          }
          
          // Handle signature data
          if (field.type === 'signature' && formDataToSend[fieldName] === null) {
            const signatureData = getSignatureData();
            if (signatureData) {
              // Convert signature to file and upload
              try {
                const response = await fetch(signatureData);
                const blob = await response.blob();
                const file = new File([blob], 'signature.png', { type: 'image/png' });
                const fileUrl = await uploadFile(file);
                formDataToSend[fieldName] = fileUrl;
              } catch (error) {
                toast.error(`Failed to save signature: ${error.message}`);
                setIsSubmitting(false);
        return;
      }
            }
          }
        }));
      }
      
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/workflow/public-form-submit`,
        {
          magic_token: magicToken,
          formData: formDataToSend
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        // toast.success('Form submitted successfully');
        setIsSubmitted(true);
        setSubmissionStatus('success');
      } else {
        toast.error(response.data.error || 'Failed to submit form');
        setSubmissionStatus('error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      // toast.error('Error submitting form');
      setSubmissionStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFormField = (field) => {
    const { name, type, label, required, options, placeholder, validation, min, max, pattern } = field;
    const hasError = formErrors[name];

    switch (type) {
      case 'text':
    return (
          <div key={name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {name} {required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData[name] || ''}
              onChange={(e) => handleInputChange(name, e.target.value)}
              placeholder={placeholder}
              required={required}
              min={min}
              max={max}
              pattern={pattern}
              disabled={isSubmitted}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
              } ${isSubmitted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            {hasError && (
              <p className="mt-1 text-sm text-red-600">{hasError}</p>
            )}
      </div>
    );

      case 'email':
      case 'number':
      case 'url':
    return (
          <div key={name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {name} {required && <span className="text-red-500">*</span>}
            </label>
            <input
              type={type}
              value={formData[name] || ''}
              onChange={(e) => handleInputChange(name, e.target.value)}
              placeholder={placeholder}
              required={required}
              min={min}
              max={max}
              pattern={pattern}
              disabled={isSubmitted}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
              } ${isSubmitted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            {hasError && (
              <p className="mt-1 text-sm text-red-600">{hasError}</p>
            )}
      </div>
    );

      case 'textarea':
      case 'memo':
    return (
          <div key={name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {name} {required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={formData[name] || ''}
              onChange={(e) => handleInputChange(name, e.target.value)}
              placeholder={placeholder}
              required={required}
              rows={4}
              disabled={isSubmitted}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
              } ${isSubmitted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            {hasError && (
              <p className="mt-1 text-sm text-red-600">{hasError}</p>
            )}
      </div>
    );

      case 'select':
  return (
          <div key={name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {name} {required && <span className="text-red-500">*</span>}
            </label>
            <select
              value={formData[name] || ''}
              onChange={(e) => handleInputChange(name, e.target.value)}
              required={required}
              disabled={isSubmitted}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
              } ${isSubmitted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              <option value="">Select an option...</option>
              {options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {hasError && (
              <p className="mt-1 text-sm text-red-600">{hasError}</p>
                      )}
                    </div>
        );

      case 'checkbox':
        return (
          <div key={name} className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData[name] || false}
                onChange={(e) => handleInputChange(name, e.target.checked)}
                disabled={isSubmitted}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-sm font-medium text-gray-700">
                {name} {required && <span className="text-red-500">*</span>}
                          </span>
            </label>
                          </div>
        );

      case 'date':
        return (
          <div key={name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {name} {required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="date"
              value={formData[name] || ''}
              onChange={(e) => handleInputChange(name, e.target.value)}
              required={required}
              disabled={isSubmitted}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSubmitted ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
                        />
                      </div>
        );

      case 'signature':
        return (
          <div key={name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {name} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="w-full h-32 border border-gray-300 rounded-md bg-white">
              <canvas 
                ref={signatureCanvasRef}
                className="w-full h-full cursor-crosshair"
                style={{ touchAction: 'none' }}
              ></canvas>
                      </div>
            <div className="flex gap-2 mt-2">
                      <button
                type="button"
                onClick={handleClearSignature}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
              >
                Clear
                      </button>
                      <button
                type="button"
                onClick={() => {
                  const signatureData = getSignatureData();
                  if (signatureData) {
                    setFormData(prev => ({
                      ...prev,
                      [name]: signatureData
                    }));
                    toast.success('Signature saved');
                  } else {
                    toast.error('Please draw a signature first');
                  }
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm"
              >
                Save Signature
                      </button>
                    </div>
            {formData[name] && (
              <p className="mt-1 text-sm text-green-600">✓ Signature saved</p>
            )}
            {hasError && (
              <p className="mt-1 text-sm text-red-600">{hasError}</p>
                        )}
                      </div>
        );

      case 'file':
        return (
          <div key={name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {name} {required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setFormData(prev => ({
                    ...prev,
                    [name]: file
                  }));
                  // Clear any previous errors
                  if (formErrors[name]) {
                    setFormErrors(prev => ({
                      ...prev,
                      [name]: ''
                    }));
                  }
                }
              }}
              required={required}
              disabled={isSubmitted}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
              } ${isSubmitted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            {formData[name] && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Selected file:</strong> {formData[name].name}
                  <br />
                  <span className="text-blue-600">
                    Size: {(formData[name].size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </p>
                          </div>
            )}
            {hasError && (
              <p className="mt-1 text-sm text-red-600">{hasError}</p>
            )}
                        </div>
        );
      
      default:
        return null;
    }
  };


  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
                    </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
                    <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
              Go Back
                    </button>
                  </div>
                </div>
              </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-auto">
        <main className="container mx-auto px-4 py-6 max-w-2xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {formConfig?.title || 'Public Form'}
            </h1>
            {formConfig?.description && (
              <p className="mt-2 text-gray-600">{formConfig.description}</p>
            )}
              </div>

          {/* Success Message */}
          {submissionStatus === 'success' && (
            <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-green-800 mb-2">
                  Thank You!
                </h2>
                <p className="text-green-700">
                  Thank you for submitting, we will be in touch soon.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {submissionStatus === 'error' && (
            <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-500 text-xl font-bold">!</span>
                </div>
                <h2 className="text-xl font-semibold text-red-800 mb-2">
                  Submission Failed
                </h2>
                <p className="text-red-700 mb-4">
                  There was an error submitting your form. Please try again.
                </p>
                <button
                  onClick={() => {
                    setSubmissionStatus(null);
                    setIsSubmitted(false);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          {submissionStatus !== 'success' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <form onSubmit={handleSubmit}>
                {formConfig?.fields?.map(renderFormField)}

                <div className="flex justify-end space-x-3 mt-6">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || isSubmitted}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : isSubmitted ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Submitted
                      </>
                    ) : (
                      'Submit'
                    )}
                </button>
              </div>
              </form>
            </div>
          )}
        </main>
        </div>
    </div>
  );
};

export default PublicFormPage;