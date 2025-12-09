import React, { useState, useEffect } from 'react';
import { Account } from '../../types/crm';
import { createCustomFieldService } from '../../services/crm/customFieldService';
import { createCRMService } from '../../services/crm/crmService';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import { useSearchParams } from 'react-router-dom';
import { validateForm as validateFormData, FIELD_VALIDATION_RULES, sanitizeInput } from '../../lib/crm/validation';
import { checkAccountDuplicates } from '../../services/crm/duplicateDetection';
import { useToast } from '../../hooks/useToast';
import DuplicateWarningModal from './DuplicateWarningModal';

interface AccountFormProps {
  account?: Account;
  onSubmit: (data: Partial<Account>) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  existingAccounts?: Account[]; // For duplicate checking
}

interface Relationship {
  id?: number;
  related_entity_id: string; // Changed from number to string for UUIDs
  related_entity_type: 'account' | 'contact';
  relationship_type: string;
  related_entity_name?: string;
  created_at?: string; // Add created_at field back
}

export default function AccountForm({ account, onSubmit, onCancel, isSubmitting, existingAccounts }: AccountFormProps) {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    account_type: string;
    industry: string;
    website: string;
    phone: string;
    email: string;
    billing_address: Record<string, any>;
    shipping_address: Record<string, any>;
    custom_fields: Record<string, any>; // ✅ dynamic keys allowed
  }>({
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
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; duplicates: any[] }>({ isOpen: false, duplicates: [] });
  const [showCustomIndustry, setShowCustomIndustry] = useState(false);
  
  // Relationship states
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [showAddRelationshipModal, setShowAddRelationshipModal] = useState(false);
  const [newRelationship, setNewRelationship] = useState<Partial<Relationship>>({});
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  
  const { showError, showSuccess } = useToast();

  // Create service instances
  const customFieldService = companyId ? createCustomFieldService(companyId) : null;
  const crmService = companyId ? createCRMService(companyId) : null;

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        description: account.description || '',
        account_type: account.account_type || 'customer',
        industry: account.industry || '',
        website: account.website || '',
        phone: account.phone || '',
        email: account.email || '',
        billing_address: account.billing_address || {},
        shipping_address: account.shipping_address || {},
        custom_fields: account.custom_fields || {},
      });
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
      setShowCustomIndustry(Boolean(account.industry && !standardIndustries.includes(account.industry)));
      
      // Load existing relationships if editing
      if (account.id) {
        loadExistingRelationships();
      }
    }
    if (companyId) {
      loadCustomFields();
      loadAllEntities();
    }
  }, [account, companyId]);

  const loadCustomFields = async () => {
    if (!customFieldService) return;

    try {
      const fields = await customFieldService.getCustomFieldDefinitions('accounts');
      setCustomFields(fields || []);
    } catch (error) {
      console.error('Failed to load custom fields:', error);
      setCustomFields([]);
    }
  };

  const loadAllEntities = async () => {
    if (!crmService) return;
    
    try {
      const [accountsData, contactsData] = await Promise.all([
        crmService.getAccounts(''),
        crmService.getContacts('')
      ]);
      setAllAccounts(accountsData || []);
      setAllContacts(contactsData || []);
    } catch (error) {
      console.error('Failed to load entities:', error);
    }
  };

  const loadExistingRelationships = async () => {
    if (!crmService || !account?.id) return;
    
    setIsLoadingRelationships(true);
    try {
      // Load account-account relationships
      const accountRelationships = await crmService.getAccountRelationships(account.id);
      // Load account-contact relationships  
      const contactRelationships = await crmService.getAccountContacts(account.id);
      
      console.log('Account relationships:', accountRelationships);
      console.log('Contact relationships:', contactRelationships);
      
      // Handle the case where the API returns { success: true, data: [...] }
      const accountData = Array.isArray(accountRelationships) ? accountRelationships : ((accountRelationships as any)?.data || []);
      const contactData = Array.isArray(contactRelationships) ? contactRelationships : ((contactRelationships as any)?.data || []);
      
      const formattedRelationships: Relationship[] = [
        ...accountData.map((rel: any) => ({
          id: rel.id,
          related_entity_id: rel.child_account_id,
          related_entity_type: 'account' as const,
          relationship_type: rel.relationship_type,
          related_entity_name: rel.child_account_name || allAccounts.find(a => a.id === rel.child_account_id)?.name || 'Unknown Account',
          created_at: rel.created_at
        })),
        ...contactData.map((rel: any) => ({
          id: rel.id,
          related_entity_id: rel.contact_id,
          related_entity_type: 'contact' as const,
          relationship_type: rel.role,
          related_entity_name: rel.first_name && rel.last_name ? `${rel.first_name} ${rel.last_name}` : rel.email || 'Unknown Contact',
          created_at: rel.created_at
        }))
      ];
      
      console.log('Formatted relationships:', formattedRelationships);
      setRelationships(formattedRelationships);
    } catch (error) {
      console.error('Failed to load relationships:', error);
    } finally {
      setIsLoadingRelationships(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: { ...prev.custom_fields, [fieldName]: value }
    }));
    if (errors[`custom_${fieldName}`]) {
      setErrors(prev => ({ ...prev, [`custom_${fieldName}`]: '' }));
    }
  };

  // Relationship handlers
  const handleAddRelationship = () => {
    setNewRelationship({});
    setShowAddRelationshipModal(true);
  };

  const handleSaveRelationship = async () => {
    if (!newRelationship.related_entity_id || !newRelationship.relationship_type) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      if (newRelationship.id) {
        // Check if entity type or entity has changed
        const existingRelationship = relationships.find(r => r.id === newRelationship.id);
        if (!existingRelationship) {
          showError('Relationship not found');
          return;
        }
        
        const entityTypeChanged = existingRelationship.related_entity_type !== newRelationship.related_entity_type;
        const entityChanged = existingRelationship.related_entity_id !== newRelationship.related_entity_id;
        
        if (entityTypeChanged || entityChanged) {
          // Entity type or entity changed - we need to delete old and create new
          // First delete the old relationship
          if (existingRelationship?.related_entity_type === 'account') {
            await crmService?.deleteAccountRelationship(existingRelationship.id!);
          } else {
            await crmService?.deleteAccountContact(existingRelationship.id!);
          }
          
          // Then create the new relationship
          if (newRelationship.related_entity_type === 'account') {
            await crmService?.createAccountRelationship({
              parent_account_id: account?.id || '',
              child_account_id: newRelationship.related_entity_id,
              relationship_type: newRelationship.relationship_type,
              tenant_id: parseInt(companyId || '0')
            });
          } else {
            await crmService?.createAccountContact({
              account_id: account?.id || '',
              contact_id: newRelationship.related_entity_id,
              role: newRelationship.relationship_type,
              tenant_id: parseInt(companyId || '0')
            });
          }
          
          showSuccess('Relationship updated successfully');
        } else {
          // Only relationship type changed - update existing
          if (newRelationship.related_entity_type === 'account') {
            await crmService?.updateAccountRelationship(newRelationship.id, {
              relationship_type: newRelationship.relationship_type
            });
          } else {
            await crmService?.updateAccountContact(newRelationship.id, {
              role: newRelationship.relationship_type
            });
          }
          showSuccess('Relationship updated successfully');
        }
      } else {
        // Create new relationship
        if (newRelationship.related_entity_type === 'account') {
          await crmService?.createAccountRelationship({
            parent_account_id: account?.id || '',
            child_account_id: newRelationship.related_entity_id,
            relationship_type: newRelationship.relationship_type,
            tenant_id: parseInt(companyId || '0')
          });
        } else {
          await crmService?.createAccountContact({
            account_id: account?.id || '',
            contact_id: newRelationship.related_entity_id,
            role: newRelationship.relationship_type,
            tenant_id: parseInt(companyId || '0')
          });
        }
        showSuccess('Relationship added successfully');
      }
      
      setShowAddRelationshipModal(false);
      setNewRelationship({});
      
      // Reload relationships
      if (account?.id) {
        loadExistingRelationships();
      }
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to save relationship');
    }
  };

  const handleDeleteRelationship = async (relationshipId: number, entityType: string) => {
    try {
      if (entityType === 'account') {
        await crmService?.deleteAccountRelationship(relationshipId);
      } else {
        await crmService?.deleteAccountContact(relationshipId);
      }
      
      showSuccess('Relationship deleted successfully');
      setRelationships(prev => prev.filter(r => r.id !== relationshipId));
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to delete relationship');
    }
  };

  const handleEditRelationship = (relationship: Relationship) => {
    // Set the existing relationship data for editing
    setNewRelationship({
      id: relationship.id,
      related_entity_type: relationship.related_entity_type,
      related_entity_id: relationship.related_entity_id,
      relationship_type: relationship.relationship_type
    });
    setShowAddRelationshipModal(true);
  };

  const validateForm = async () => {
    // Use the comprehensive validation system
    const validationRules = {
      name: FIELD_VALIDATION_RULES.account_name,
      email: FIELD_VALIDATION_RULES.account_email,
      website: FIELD_VALIDATION_RULES.account_website,
      phone: FIELD_VALIDATION_RULES.account_phone,
    };

    const formDataForValidation = {
      name: formData.name,
      email: formData.email,
      website: formData.website,
      phone: formData.phone,
    };

    const standardValidationResult = validateFormData(formDataForValidation, validationRules);
    let allErrors: Record<string, string> = { ...standardValidationResult.errors };

    // Custom fields validation
    customFields.forEach(field => {
      const value = formData.custom_fields[field.field_name];

      // Required validation (handle arrays for multi_select)
      if (field.is_required) {
        const isEmptyArray = Array.isArray(value) && value.length === 0;
        const isEmptyValue = value === undefined || value === null || value === '';
        if (isEmptyArray || isEmptyValue) {
          allErrors[`custom_${field.field_name}`] = `${field.field_label} is required`;
          return;
        }
      }

      // Type-specific validation from stored rules
      if (value && (field as any).validation_rules) {
        const rules = (field as any).validation_rules as any;

        if (rules.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            allErrors[`custom_${field.field_name}`] = `${field.field_label} must be a valid email`;
          }
        }

        if (rules.type === 'number' && isNaN(Number(value))) {
          allErrors[`custom_${field.field_name}`] = `${field.field_label} must be a number`;
        }

        if (rules.minLength && value.length < rules.minLength) {
          allErrors[`custom_${field.field_name}`] = `${field.field_label} must be at least ${rules.minLength} characters`;
        }

        if (rules.maxLength && value.length > rules.maxLength) {
          allErrors[`custom_${field.field_name}`] = `${field.field_label} must be at most ${rules.maxLength} characters`;
        }

        // Additional validations (pattern/URL)
        if (rules.type === 'url') {
          try {
            // Will throw if invalid URL
            // eslint-disable-next-line no-new
            new URL(value);
          } catch {
            allErrors[`custom_${field.field_name}`] = `${field.field_label} must be a valid URL`;
          }
        }
        if (rules.pattern && typeof value === 'string') {
          try {
            const regex = new RegExp(rules.pattern);
            if (!regex.test(value)) {
              allErrors[`custom_${field.field_name}`] = `${field.field_label} has an invalid format`;
            }
          } catch {
            // ignore invalid pattern definitions
          }
        }
      }

      // Baseline validation derived from field_type
      if (value && !allErrors[`custom_${field.field_name}`]) {
        switch (field.field_type) {
          case 'email': {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(String(value))) {
              allErrors[`custom_${field.field_name}`] = `${field.field_label} must be a valid email`;
            }
            break;
          }
          case 'phone': {
            const cleaned = String(value).replace(/\s/g, '');
            if (!/^\d{10}$/.test(cleaned)) {
              allErrors[`custom_${field.field_name}`] = `${field.field_label} must be exactly 10 digits`;
            }
            break;
          }
          case 'url': {
            try {
              // eslint-disable-next-line no-new
              new URL(String(value));
            } catch {
              allErrors[`custom_${field.field_name}`] = `${field.field_label} must be a valid URL`;
            }
            break;
          }
          default:
            break;
        }
      }
    });

    // Set field-level errors
    setErrors(allErrors);

    // Return true if no errors
    return Object.keys(allErrors).length === 0;
  };


  const handleDuplicateProceed = () => {
    setDuplicateModal({ isOpen: false, duplicates: [] });
    onSubmit(formData);
  };

  const handleViewExisting = (record: any) => {
    // Close modal and let parent handle viewing the record
    setDuplicateModal({ isOpen: false, duplicates: [] });
    // You can implement navigation to the existing record here
    console.log('View existing record:', record);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await validateForm();
    if (isValid) {
      onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {account ? 'Edit Account' : 'Create New Account'}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>



        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Enter account name"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Type
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
              placeholder="Enter account description"
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
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.website ? 'border-red-500' : 'border-gray-300'
                  }`}
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
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
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
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Enter email address"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Relationships Section */}
          {account?.id && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-md font-medium text-gray-900">Relationships</h4>
                <button
                  type="button"
                  onClick={handleAddRelationship}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  + Add Relationship
                </button>
              </div>
              
              {isLoadingRelationships ? (
                <div className="text-center py-4 text-gray-500">Loading relationships...</div>
              ) : relationships.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Entity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Relationship
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {relationships.map((relationship) => (
                        <tr key={relationship.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {relationship.related_entity_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {relationship.related_entity_type === 'account' ? 'Account' : 'Contact'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {relationship.relationship_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {relationship.created_at ? new Date(relationship.created_at).toLocaleDateString() : 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              type="button"
                              onClick={() => handleEditRelationship(relationship)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRelationship(relationship.id!, relationship.related_entity_type)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No relationships added yet. Click "Add Relationship" to get started.
                </div>
              )}
            </div>
          )}

          {/* Custom Fields */}
          {Array.isArray(customFields) && customFields.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-md font-medium text-gray-900 mb-3">Custom Fields</h4>
              <div className="space-y-3">
                {customFields.map((field) => (
                  <CustomFieldRenderer
                    key={field.id}
                    field={field}
                    value={(formData.custom_fields as any)[field.field_name]}
                    onChange={(value) => handleCustomFieldChange(field.field_name, value)}
                    error={errors[`custom_${field.field_name}`]}
                  />
                ))}
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
              {isSubmitting ? 'Saving...' : (account ? 'Update Account' : 'Create Account')}
            </button>
          </div>
        </form>
      </div>

      {/* Add Relationship Modal */}
      {showAddRelationshipModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {newRelationship.id ? 'Edit Relationship' : 'Add Relationship'}
              </h3>
              <button
                onClick={() => setShowAddRelationshipModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entity Type *
                </label>
                <select
                  value={newRelationship.related_entity_type || ''}
                  onChange={(e) => setNewRelationship(prev => ({ ...prev, related_entity_type: e.target.value as 'account' | 'contact' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select entity type</option>
                  <option value="account">Account</option>
                  <option value="contact">Contact</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {newRelationship.related_entity_type === 'account' ? 'Account' : 'Contact'} *
                </label>
                <select
                  value={newRelationship.related_entity_id || ''}
                  onChange={(e) => setNewRelationship(prev => ({ ...prev, related_entity_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select {newRelationship.related_entity_type === 'account' ? 'account' : 'contact'}</option>
                  {newRelationship.related_entity_type === 'account' ? 
                    allAccounts
                      .filter(a => a.id !== account?.id)
                      .map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} {acc.industry ? `(${acc.industry})` : ''}
                        </option>
                      )) :
                    allContacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name} {contact.email ? `(${contact.email})` : ''}
                      </option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship Type *
                </label>
                <select
                  value={newRelationship.relationship_type || ''}
                  onChange={(e) => setNewRelationship(prev => ({ ...prev, relationship_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select relationship type</option>
                  {newRelationship.related_entity_type === 'account' ? (
                    <>
                      <option value="Partner">Partner</option>
                      <option value="Competitor">Competitor</option>
                      <option value="Subsidiary">Subsidiary</option>
                      <option value="Parent Company">Parent Company</option>
                      <option value="Vendor">Vendor</option>
                      <option value="Customer">Customer</option>
                    </>
                  ) : (
                    <>
                      <option value="Decision Maker">Decision Maker</option>
                      <option value="Employee">Employee</option>
                      <option value="Advisor">Advisor</option>
                      <option value="Influencer">Influencer</option>
                      <option value="End User">End User</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddRelationshipModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRelationship}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  {newRelationship.id ? 'Update Relationship' : 'Add Relationship'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Warning Modal */}
      <DuplicateWarningModal
        isOpen={duplicateModal.isOpen}
        onClose={() => setDuplicateModal({ isOpen: false, duplicates: [] })}
        onProceed={handleDuplicateProceed}
        onViewExisting={handleViewExisting}
        duplicates={duplicateModal.duplicates}
        entityType="Account"
      />
    </div>
  );
}