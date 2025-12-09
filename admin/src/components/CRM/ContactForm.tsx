import React, { useState, useEffect } from 'react';
import { Contact } from '../../types/crm';
import { createCustomFieldService } from '../../services/crm/customFieldService';
import { createCRMService } from '../../services/crm/crmService';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import { useSearchParams } from 'react-router-dom';
import { validateForm as validateFormData, FIELD_VALIDATION_RULES } from '../../lib/crm/validation';
import { checkContactDuplicates } from '../../services/crm/duplicateDetection';
import { useToast } from '../../hooks/useToast';
import DuplicateWarningModal from './DuplicateWarningModal';

interface ContactFormProps {
  contact?: Contact;
  onSubmit: (data: Partial<Contact>) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  existingContacts?: Contact[]; // For duplicate checking
}

interface Relationship {
  id?: number;
  related_entity_id: string; // Changed from number to string for UUIDs
  related_entity_type: 'account' | 'opportunity';
  relationship_type: string;
  related_entity_name?: string;
  created_at?: string; // Add created_at field
}

export default function ContactForm({ contact, onSubmit, onCancel, isSubmitting, existingContacts = [] }: ContactFormProps) {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile_phone: '',
    title: '',
    department: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    custom_fields: {},
  });
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; duplicates: any[] }>({ isOpen: false, duplicates: [] });
  
  // Relationship states
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [showAddRelationshipModal, setShowAddRelationshipModal] = useState(false);
  const [newRelationship, setNewRelationship] = useState<Partial<Relationship>>({});
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [allOpportunities, setAllOpportunities] = useState<any[]>([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  
  const { showError, showSuccess } = useToast();

  // Create service instances
  const customFieldService = companyId ? createCustomFieldService(companyId) : null;
  const crmService = companyId ? createCRMService(companyId) : null;

  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        mobile_phone: contact.mobile_phone || '',
        title: contact.title || '',
        department: contact.department || '',
        address1: contact.address1 || '',
        address2: contact.address2 || '',
        city: contact.city || '',
        state: contact.state || '',
        zip: contact.zip || '',
        country: contact.country || 'US',
        custom_fields: contact.custom_fields || {},
      });
      
      // Load existing relationships if editing
      if (contact.id) {
        loadExistingRelationships();
      }
    }
    if (companyId) {
      loadCustomFields();
      loadAllEntities();
    }
  }, [contact, companyId]);

  const loadCustomFields = async () => {
    if (!customFieldService) return;
    
    try {
      const fields = await customFieldService.getCustomFieldDefinitions('contacts');
      setCustomFields(fields || []);
    } catch (error) {
      console.error('Failed to load custom fields:', error);
      setCustomFields([]);
    }
  };

  const loadAllEntities = async () => {
    if (!crmService) return;
    
    try {
      const [accountsData, opportunitiesData] = await Promise.all([
        crmService.getAccounts(''),
        crmService.getOpportunities('')
      ]);
      setAllAccounts(accountsData || []);
      setAllOpportunities(opportunitiesData || []);
    } catch (error) {
      console.error('Failed to load entities:', error);
    }
  };

  const loadExistingRelationships = async () => {
    if (!crmService || !contact?.id) return;
    
    setIsLoadingRelationships(true);
    try {
      // Load contact-account relationships
      const accountRelationships = await crmService.getAccountContacts('', contact.id);
      // Load contact-opportunity relationships  
      const opportunityRelationships = await crmService.getOpportunityContacts('', contact.id);
      
      const formattedRelationships: Relationship[] = [
        ...accountRelationships.map((rel: any) => ({
          id: rel.id,
          related_entity_id: rel.account_id,
          related_entity_type: 'account' as const,
          relationship_type: rel.role,
          related_entity_name: rel.name || allAccounts.find(a => a.id === rel.account_id)?.name,
          created_at: rel.created_at
        })),
        ...opportunityRelationships.map((rel: any) => ({
          id: rel.id,
          related_entity_id: rel.opportunity_id,
          related_entity_type: 'opportunity' as const,
          relationship_type: rel.role,
          related_entity_name: rel.name || allOpportunities.find(o => o.id === rel.opportunity_id)?.name,
          created_at: rel.created_at
        }))
      ];
      
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
          if (existingRelationship.related_entity_type === 'account') {
            await crmService?.deleteAccountContact(existingRelationship.id!);
          } else {
            await crmService?.deleteOpportunityContact(existingRelationship.id!);
          }
          
          // Then create the new relationship
          if (newRelationship.related_entity_type === 'account') {
            await crmService?.createAccountContact({
              account_id: newRelationship.related_entity_id,
              contact_id: contact?.id || '',
              role: newRelationship.relationship_type,
              tenant_id: parseInt(companyId || '0')
            });
          } else {
            await crmService?.createOpportunityContact({
              opportunity_id: newRelationship.related_entity_id,
              contact_id: contact?.id || '',
              role: newRelationship.relationship_type,
              tenant_id: parseInt(companyId || '0')
            });
          }
          
          showSuccess('Relationship updated successfully');
        } else {
          // Only relationship type changed - update existing
          if (newRelationship.related_entity_type === 'account') {
            await crmService?.updateAccountContact(newRelationship.id, {
              role: newRelationship.relationship_type
            });
          } else {
            await crmService?.updateOpportunityContact(newRelationship.id, {
              role: newRelationship.relationship_type
            });
          }
          showSuccess('Relationship updated successfully');
        }
      } else {
        // Create new relationship
        if (newRelationship.related_entity_type === 'account') {
          await crmService?.createAccountContact({
            account_id: newRelationship.related_entity_id,
            contact_id: contact?.id || '',
            role: newRelationship.relationship_type,
            tenant_id: parseInt(companyId || '0')
          });
        } else {
          await crmService?.createOpportunityContact({
            opportunity_id: newRelationship.related_entity_id,
            contact_id: contact?.id || '',
            role: newRelationship.relationship_type,
            tenant_id: parseInt(companyId || '0')
          });
        }
        showSuccess('Relationship added successfully');
      }
      
      setShowAddRelationshipModal(false);
      setNewRelationship({});
      
      // Reload relationships
      if (contact?.id) {
        loadExistingRelationships();
      }
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to save relationship');
    }
  };

  const handleDeleteRelationship = async (relationshipId: number, entityType: string) => {
    try {
      if (entityType === 'account') {
        await crmService?.deleteAccountContact(relationshipId);
      } else {
        await crmService?.deleteOpportunityContact(relationshipId);
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
      first_name: FIELD_VALIDATION_RULES.contact_first_name,
      last_name: FIELD_VALIDATION_RULES.contact_last_name,
      email: FIELD_VALIDATION_RULES.contact_email,
      phone: FIELD_VALIDATION_RULES.contact_phone,
    };

    const formDataForValidation = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone,
    };

    const validationResult = validateFormData(formDataForValidation, validationRules);
    setErrors(validationResult.errors);
    
    if (!validationResult.isValid) {
      return false;
    }
    
    // Check for duplicates if we have existing contacts
    if (existingContacts && existingContacts.length > 0) {
      try {
        const duplicates = await checkContactDuplicates(formData, existingContacts, {
          excludeId: contact?.id,
          threshold: 0.8
        });

        if (duplicates.length > 0) {
          setDuplicateModal({ isOpen: true, duplicates });
          return false;
        }
      } catch (error) {
        console.error('Error checking duplicates:', error);
        showError('Error checking for duplicates. Please try again.');
      }
    }
    
    return true;
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
            {contact ? 'Edit Contact' : 'Create New Contact'}
          </h3>
          <button
            onClick={onCancel}
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
                First Name *
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.first_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter first name"
              />
              {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.last_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter last name"
              />
              {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter email address"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter phone number"
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile Phone
              </label>
              <input
                type="tel"
                value={formData.mobile_phone}
                onChange={(e) => handleChange('mobile_phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter mobile phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter job title"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter department"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <select
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="UK">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="JP">Japan</option>
                <option value="IN">India</option>
                <option value="BR">Brazil</option>
                <option value="MX">Mexico</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Address Information */}
          <div className="border-t pt-4">
            <h4 className="text-md font-medium text-gray-900 mb-3">Address Information</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={formData.address1}
                  onChange={(e) => handleChange('address1', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter street address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={formData.address2}
                  onChange={(e) => handleChange('address2', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter city"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State/Province
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter state"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP/Postal Code
                  </label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => handleChange('zip', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter ZIP code"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Relationships Section */}
          {contact?.id && (
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
                              {relationship.related_entity_type === 'account' ? 'Account' : 'Opportunity'}
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
              {isSubmitting ? 'Saving...' : (contact ? 'Update Contact' : 'Create Contact')}
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
                  onChange={(e) => setNewRelationship(prev => ({ ...prev, related_entity_type: e.target.value as 'account' | 'opportunity' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select entity type</option>
                  <option value="account">Account</option>
                  <option value="opportunity">Opportunity</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {newRelationship.related_entity_type === 'account' ? 'Account' : 'Opportunity'} *
                </label>
                <select
                  value={newRelationship.related_entity_id || ''}
                  onChange={(e) => setNewRelationship(prev => ({ ...prev, related_entity_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select {newRelationship.related_entity_type === 'account' ? 'account' : 'opportunity'}</option>
                  {newRelationship.related_entity_type === 'account' ? 
                    allAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} {acc.industry ? `(${acc.industry})` : ''}
                      </option>
                    )) :
                    allOpportunities.map(opp => (
                      <option key={opp.id} value={opp.id}>
                        {opp.name} {opp.stage ? `(${opp.stage})` : ''}
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
                      <option value="Decision Maker">Decision Maker</option>
                      <option value="Employee">Employee</option>
                      <option value="Advisor">Advisor</option>
                      <option value="Influencer">Influencer</option>
                      <option value="End User">End User</option>
                    </>
                  ) : (
                    <>
                      <option value="Owner">Owner</option>
                      <option value="Team Member">Team Member</option>
                      <option value="Stakeholder">Stakeholder</option>
                      <option value="Influencer">Influencer</option>
                      <option value="Decision Maker">Decision Maker</option>
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
        entityType="Contact"
      />
    </div>
  );
}