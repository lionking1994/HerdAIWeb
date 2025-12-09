import React, { useState, useEffect } from 'react';

export default function CompanyFormModel({
  company = null,
  companyId,
  onSubmit,
  onCancel,
  onRefresh,
  isSubmitting = false
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    account_type: 'customer',
    industry: '',
    website: '',
    phone: '',
    email: '',
    billing_address: {},
    shipping_address: {},
    custom_fields: {},
  });

  const [errors, setErrors] = useState({});
  const [showCustomIndustry, setShowCustomIndustry] = useState(false);
  const [isSubmittingState, setIsSubmittingState] = useState(false);

  // Prefill form if editing
  useEffect(() => {
    if (company) {
      console.log('🏢 Company data received for editing:', company);

      const formDataToSet = {
        name: company.name || '',
        description: company.description || '',
        account_type: company.account_type || 'customer',
        industry: company.industry || '',
        website: company.website || '',
        phone: company.phone || '',
        email: company.email || '',
        billing_address: company.billing_address || {},
        shipping_address: company.shipping_address || {},
        custom_fields: company.custom_fields || {},
      };

      console.log('🏢 Form data set to:', formDataToSet);
      setFormData(formDataToSet);

      // Check if the industry is a custom one (not in standard list)
      const standardIndustries = [
        'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education',
        'Real Estate', 'Transportation', 'Energy', 'Media & Entertainment', 'Telecommunications',
        'Consulting', 'Legal', 'Insurance', 'Hospitality', 'Food & Beverage', 'Automotive',
        'Aerospace', 'Construction', 'Pharmaceuticals', 'Biotechnology', 'Chemicals',
        'Mining', 'Agriculture', 'Fashion & Apparel', 'Sports & Recreation', 'Non-Profit', 'Government',
        'E-commerce', 'SaaS', 'Fintech', 'EdTech', 'HealthTech', 'Clean Energy', 'Cybersecurity',
        'Artificial Intelligence', 'Blockchain'
      ];
      setShowCustomIndustry(Boolean(company.industry && !standardIndustries.includes(company.industry)));
    }
  }, [company]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name?.trim()) {
      newErrors.name = "Company name is required";
    }

    // if (!formData.phone?.trim()) {
    //   newErrors.phone = "Phone is required";
    // }

    if (formData.email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    if (formData.website?.trim()) {
      try {
        new URL(formData.website);
      } catch {
        newErrors.website = "Please enter a valid website URL";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      try {
        setIsSubmittingState(true);

        // API call for updating company
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/crm/accounts/${company.id}?company=${companyId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData),
          }
        );

        const result = await response.json();
        if (result.success) {
          console.log('✅ Company updated successfully:', result.data);
          // Show success message
          if (window.toast) {
            window.toast.success('Company updated successfully!');
          }

          // Close modal and refresh data
          onCancel();
          if (onRefresh) onRefresh();
        } else {
          throw new Error(result.message || 'Failed to update company');
        }
      } catch (error) {
        console.error('❌ Error updating company:', error);
        // Show error message
        if (window.toast) {
          window.toast.error(error.message || 'Failed to update company');
        }
      } finally {
        setIsSubmittingState(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-opacity-50 z-50 mt-20 overflow-y-auto">
      <div className="relative mb-30 top-10 mx-auto p-6 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {company ? "Edit Company" : "Create Company"}
          </h3>
          <button
            onClick={onCancel}
            type="button"
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter company name"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Type
              </label>
              <select
                value={formData.account_type}
                onChange={(e) => handleChange('account_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="customer">Customer</option>
                <option value="prospect">Prospect</option>
                <option value="partner">Partner</option>
                <option value="vendor">Vendor</option>
                <option value="competitor">Competitor</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter company description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Industry
              </label>
              <div className="space-y-2">
                <select
                  value={showCustomIndustry ? '' : formData.industry}
                  onChange={(e) => {
                    if (e.target.value === 'Other') {
                      setShowCustomIndustry(true);
                      handleChange('industry', '');
                    } else {
                      setShowCustomIndustry(false);
                      handleChange('industry', e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
                  style={{ maxHeight: '128px' }}
                >
                  <option value="">Select Industry</option>
                  <option value="Technology">Technology</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Retail">Retail</option>
                  <option value="Education">Education</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Energy">Energy</option>
                  <option value="Media & Entertainment">Media & Entertainment</option>
                  <option value="Telecommunications">Telecommunications</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Legal">Legal</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Hospitality">Hospitality</option>
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="Automotive">Automotive</option>
                  <option value="Aerospace">Aerospace</option>
                  <option value="Construction">Construction</option>
                  <option value="Pharmaceuticals">Pharmaceuticals</option>
                  <option value="Biotechnology">Biotechnology</option>
                  <option value="Chemicals">Chemicals</option>
                  <option value="Mining">Mining</option>
                  <option value="Agriculture">Agriculture</option>
                  <option value="Fashion & Apparel">Fashion & Apparel</option>
                  <option value="Sports & Recreation">Sports & Recreation</option>
                  <option value="Non-Profit">Non-Profit</option>
                  <option value="Government">Government</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="SaaS">SaaS</option>
                  <option value="Fintech">Fintech</option>
                  <option value="EdTech">EdTech</option>
                  <option value="HealthTech">HealthTech</option>
                  <option value="Clean Energy">Clean Energy</option>
                  <option value="Cybersecurity">Cybersecurity</option>
                  <option value="Artificial Intelligence">Artificial Intelligence</option>
                  <option value="Blockchain">Blockchain</option>
                  <option value="Other">Other</option>
                </select>
                {showCustomIndustry && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) => handleChange('industry', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter custom industry"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomIndustry(false);
                        handleChange('industry', '');
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      ← Back to standard industries
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => handleChange('website', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.website ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="https://example.com"
              />
              {errors.website && <p className="text-red-500 text-sm mt-1">{errors.website}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter phone number"
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter email address"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>

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
              {isSubmitting ? 'Saving...' : (company ? 'Update Company' : 'Create Company')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
