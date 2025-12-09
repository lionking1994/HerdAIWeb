import React, { useState, useEffect } from 'react';
import { Opportunity, Account, OpportunityStage } from '../../types/crm';
import { createCRMService } from '../../services/crm/crmService';
import { createStageService } from '../../services/crm/stageService';
import { createCustomFieldService } from '../../services/crm/customFieldService';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import { useSearchParams } from 'react-router-dom';
import { validateForm as validateFormData, FIELD_VALIDATION_RULES } from '../../lib/crm/validation';
import { checkOpportunityDuplicates } from '../../services/crm/duplicateDetection';
import { useToast } from '../../hooks/useToast';
import DuplicateWarningModal from './DuplicateWarningModal';
import api from '../../lib/api';
import { Combobox } from '@headlessui/react'

interface OpportunityFormProps {
  opportunity?: Opportunity;
  onSubmit: (data: Partial<Opportunity>) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  existingOpportunities?: Opportunity[]; // For duplicate checking
}

interface Relationship {
  id?: number;
  related_entity_id: string; // Changed from number to string for UUIDs
  related_entity_type: 'contact';
  relationship_type: string;
  related_entity_name?: string;
  created_at?: string; // Add created_at field
}

export default function OpportunityForm({ opportunity, onSubmit, onCancel, isSubmitting, existingOpportunities = [] }: OpportunityFormProps) {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: 0,
    probability: 0,
    stage: '',
    stage_id: '',
    expected_close_date: '',
    actual_close_date: '',
    lead_source: '',
    account_id: '',
    custom_fields: {},
    opportunity_owner: '',
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stages, setStages] = useState<OpportunityStage[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; duplicates: unknown[] }>({ isOpen: false, duplicates: [] });

  // Relationship states
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [showAddRelationshipModal, setShowAddRelationshipModal] = useState(false);
  const [newRelationship, setNewRelationship] = useState<Partial<Relationship>>({});
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const { showError, showSuccess } = useToast();

  // Template states (NEW)
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<any[]>([]);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [aggregatedData, setAggregatedData] = useState<any>(null);

  // Create CRM service instances
  const crmService = companyId ? createCRMService(companyId) : null;
  const stageService = companyId ? createStageService(companyId) : null;
  const customFieldService = companyId ? createCustomFieldService(companyId) : null;

  useEffect(() => {
    console.log('Editing opportunity:', opportunity);
    if (opportunity) {
      setFormData({
        name: opportunity.name || '',
        description: opportunity.description || '',
        amount: opportunity.amount || 0,
        probability: opportunity.probability || 0,
        stage: opportunity.stage || '',
        stage_id: opportunity.stage_id || '',
        expected_close_date: opportunity.expected_close_date
          ? opportunity.expected_close_date.split('T')[0]
          : '',
        actual_close_date: opportunity.actual_close_date
          ? opportunity.actual_close_date.split('T')[0]
          : '',

        lead_source: opportunity.lead_source || '',
        account_id: opportunity.account_id || '',
        custom_fields: opportunity.custom_fields || {},
        opportunity_owner: opportunity?.owner_id || '',
      });
      // Load existing relationships if editing
      if (opportunity.id) {
        loadExistingRelationships();
      }
    }
    if (companyId) {
      loadFormData();
    }
  }, [opportunity, companyId]);

  const loadFormData = async () => {
    if (!crmService || !stageService) return;
    try {
      console.log('🔄 Loading form data...');
      // Load accounts and stages first (these are required for the form)
      const [accountsData, stagesData, contactsData, usersData] = await Promise.all([
        crmService.getAccounts('', { page: 1, limit: -1 }),
        stageService.getOpportunityStages(),
        crmService.getContacts('', { page: 1, limit: -1 }),
        api.post('/users/all', {
          company: parseInt(companyId || '0'),
          status: 'enabled',
          filter: '',
          page: 1,
          per_page: 100
        })
      ]);

      setCompanyUsers(usersData.data?.users || []);
      console.log('📊 Accounts data:', accountsData);
      console.log('🎯 Stages data:', stagesData);
      setAccounts(accountsData?.data || []);
      const sortedStages = (stagesData || []).sort((a: OpportunityStage, b: OpportunityStage) => a.order_index - b.order_index);
      setStages(sortedStages);
      setAllContacts(contactsData?.data || []);

      // Set default stage to first stage when creating a new opportunity
      if (!opportunity && sortedStages.length > 0) {
        const firstStage = sortedStages[0];
        setFormData(prev => ({
          ...prev,
          stage: firstStage.name,
          stage_id: firstStage.id
        }));
      }
      // Load custom fields separately (this is optional and can fail)
      if (customFieldService) {
        try {
          const customFieldsData = await customFieldService.getCustomFieldDefinitions('opportunities');
          console.log('🔧 Custom fields data:', customFieldsData);
          setCustomFields(customFieldsData || []);
        } catch (customFieldsError) {
          console.warn('⚠️ Custom fields failed to load (this is optional):', customFieldsError);
          setCustomFields([]);
        }
      }
      console.log('✅ Form data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading form data:', error);
      showError('Failed to load form data. Please try again.');
    }
  };

  const loadExistingRelationships = async () => {
    if (!crmService || !opportunity?.id) return;


    setIsLoadingRelationships(true);
    try {
      // Load opportunity-contact relationships
      const contactRelationships = await crmService.getOpportunityContacts(opportunity.id);

      const formattedRelationships: Relationship[] = contactRelationships.map((rel: any) => ({
        id: rel.id,
        related_entity_id: rel.contact_id,
        related_entity_type: 'contact' as const,
        relationship_type: rel.role,
        related_entity_name: `${rel.first_name || ''} ${rel.last_name || ''}`.trim() || allContacts.find(c => c.id === rel.contact_id)?.first_name + ' ' + allContacts.find(c => c.id === rel.contact_id)?.last_name,
        created_at: rel.created_at
      }));
      setRelationships(formattedRelationships);
    } catch (error) {
      console.error('Failed to load relationships:', error);
    } finally {
      setIsLoadingRelationships(false);
    }
  };

  // Template functions (NEW)
  const loadAvailableTemplates = async () => {
    if (!companyId) {
      console.log('⚠️ No companyId, skipping template load');
      return;
    }
    
    console.log('🔄 Loading available templates for company:', companyId);
    try {
      const response = await api.get(`/psa/templates/company/${companyId}`);
      console.log('📦 API Response:', response.data);
      
      if (response.data.success) {
        const allTemplates = response.data.data?.templates || [];
        console.log('📊 Total templates received:', allTemplates?.length);
        console.log('📋 All templates:', allTemplates);
        
        // Filter only parent templates (those with cost details populated)
        const templatesWithCost = allTemplates.filter((t: any) => {
          const isParent = t.parentId === null;
          // Check both top-level and stats object for cost (fallback for old templates)
          const topLevelCost = parseFloat(t.estimatedCost || 0);
          const statsCost = parseFloat(t.stats?.estimatedCost || 0);
          const effectiveCost = topLevelCost > 0 ? topLevelCost : statsCost;
          const hasCost = effectiveCost > 0;
          console.log(`🔍 Template "${t.name}": parent=${isParent}, topCost=${topLevelCost}, statsCost=${statsCost}, effectiveCost=${effectiveCost}, passed=${isParent && hasCost}`);
          return isParent && hasCost;
        });
        
        console.log('✅ Filtered templates with cost:', templatesWithCost.length);
        console.log('📋 Filtered templates:', templatesWithCost);
        setAvailableTemplates(templatesWithCost);
      }
    } catch (error) {
      console.error('❌ Error loading templates:', error);
    }
  };

  const loadExistingTemplates = async () => {
    if (!opportunity?.id || !companyId) return;
    setIsLoadingTemplate(true);
    try {
      const response = await api.get(
        `/crm/opportunities/${opportunity.id}/templates?company=${companyId}`
      );
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        
        // Process templates array
        const processedTemplates = data.templates.map((item: any) => ({
          association_id: item.associationId,
          opportunity_id: item.opportunityId,
          template_id: item.templateId,
          template_name: item.template.name,
          template_description: item.template.description,
          category: item.template.category,
          type: item.template.type,
          estimated_cost: item.template.estimatedCost,
          budget_hours: item.template.budgetHours,
          resource_count: item.template.resourceCount,
          resource_details: item.template.resourceDetails,
          all_required_skills: item.template.allRequiredSkills,
          duration_weeks: item.template.durationWeeks,
          notes: item.notes,
          attached_at: item.attachedAt,
          attached_by: item.attachedBy,
          attached_by_name: item.attachedByName,
          created_at: item.template.createdAt
        }));
        
        setSelectedTemplates(processedTemplates);
        setAggregatedData(data.aggregated);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('❌ Error loading templates:', error);
      }
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  const handleAttachTemplate = async (templateId: string) => {
    if (!opportunity?.id || !companyId) {
      showError('Opportunity must be saved before attaching a template');
      return;
    }

    try {
      setIsLoadingTemplate(true);
      
      // Always use POST for adding new templates
      const response = await api.post(
        `/crm/opportunities/${opportunity.id}/template?company=${companyId}`,
        { templateId, notes: '' }
      );
      
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        const template = data.template;
        
        // Flatten the response to match UI expectations
        const flattenedTemplate = {
          association_id: data.associationId,
          opportunity_id: data.opportunityId,
          template_id: data.templateId,
          template_name: template.name,
          template_description: template.description,
          category: template.category,
          type: template.type,
          estimated_cost: template.estimatedCost,
          budget_hours: template.budgetHours,
          resource_count: template.resourceCount,
          resource_details: template.resourceDetails,
          all_required_skills: template.allRequiredSkills,
          duration_weeks: template.durationWeeks,
          notes: data.notes,
          attached_at: data.attachedAt,
          attached_by: data.attachedBy,
          attached_by_name: data.attachedByName,
          created_at: template.createdAt
        };
        
        // Add to existing templates
        setSelectedTemplates(prev => [...prev, flattenedTemplate]);
        setShowTemplateSelector(false);
        showSuccess('Template attached successfully!');
        
        // Reload templates to get updated aggregated data
        await loadExistingTemplates();
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to attach template';
      showError(errorMsg);
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  const handleRemoveSpecificTemplate = async (templateId: string) => {
    if (!opportunity?.id || !companyId) return;

    try {
      setIsLoadingTemplate(true);
      await api.delete(
        `/crm/opportunities/${opportunity.id}/templates/${templateId}?company=${companyId}`
      );
      
      // Remove from local state
      setSelectedTemplates(prev => prev.filter(t => t.template_id !== templateId));
      showSuccess('Template removed successfully!');
      
      // Reload templates to get updated aggregated data
      await loadExistingTemplates();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to remove template';
      showError(errorMsg);
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  const handleRemoveAllTemplates = async () => {
    if (!opportunity?.id || !companyId) return;

    try {
      setIsLoadingTemplate(true);
      // Remove all templates by calling remove specific for each
      for (const template of selectedTemplates) {
        await api.delete(
          `/crm/opportunities/${opportunity.id}/templates/${template.template_id}?company=${companyId}`
        );
      }
      
      setSelectedTemplates([]);
      setAggregatedData(null);
      showSuccess('All templates removed successfully!');
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to remove templates';
      showError(errorMsg);
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  // Load templates when form opens
  useEffect(() => {
    if (companyId) {
      loadAvailableTemplates();
    }
    if (opportunity?.id && companyId) {
      loadExistingTemplates();
    }
  }, [companyId, opportunity?.id]);

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
        // Check if entity has changed
        const existingRelationship = relationships.find(r => r.id === newRelationship.id);
        if (!existingRelationship) {
          showError('Relationship not found');
          return;
        }
        const entityChanged = existingRelationship.related_entity_id !== newRelationship.related_entity_id;
        if (entityChanged) {
          // Entity changed - we need to delete old and create new
          // First delete the old relationship
          await crmService?.deleteOpportunityContact(existingRelationship.id!);
          // Then create the new relationship
          await crmService?.createOpportunityContact({
            opportunity_id: opportunity?.id || '',
            contact_id: newRelationship.related_entity_id,
            role: newRelationship.relationship_type,
            tenant_id: parseInt(companyId || '0')
          });
          showSuccess('Relationship updated successfully');
        } else {
          // Only relationship type changed - update existing
          await crmService?.updateOpportunityContact(newRelationship.id, {
            role: newRelationship.relationship_type
          });
          showSuccess('Relationship updated successfully');
        }
      } else {
        // Create new relationship
        await crmService?.createOpportunityContact({
          opportunity_id: opportunity?.id || '',
          contact_id: newRelationship.related_entity_id,
          role: newRelationship.relationship_type,
          tenant_id: parseInt(companyId || '0')
        });
        showSuccess('Relationship added successfully');
      }
      setShowAddRelationshipModal(false);
      setNewRelationship({});
      // Reload relationships
      if (opportunity?.id) {
        loadExistingRelationships();
      }
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to save relationship');
    }
  };

  const handleDeleteRelationship = async (relationshipId: number) => {
    try {
      await crmService?.deleteOpportunityContact(relationshipId);
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
      name: FIELD_VALIDATION_RULES.opportunity_name,
      amount: FIELD_VALIDATION_RULES.opportunity_amount,
      probability: FIELD_VALIDATION_RULES.opportunity_probability,
      stage_id: {
        required: true,
        message: 'Stage is required'
      }
    };

    const formDataForValidation = {
      name: formData.name,
      amount: formData.amount,
      probability: formData.probability,
      stage_id: formData.stage_id
    };

    const validationResult = validateFormData(formDataForValidation, validationRules);
    setErrors(validationResult.errors);
    if (!validationResult.isValid) {
      return false;
    }
    // Check for duplicates if we have existing opportunities
    if (existingOpportunities && existingOpportunities.length > 0) {
      try {
        const duplicates = await checkOpportunityDuplicates(formData, existingOpportunities, {
          excludeId: opportunity?.id,
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

    // Create clean payload for duplicate proceed as well
    const payload: any = {
      name: formData.name,
      description: formData.description,
      amount: formData.amount,
      probability: formData.probability,
      stage_id: formData.stage_id,
      expected_close_date: formData.expected_close_date ? formData.expected_close_date : null,
      actual_close_date: formData.actual_close_date ? formData.actual_close_date : null,
      lead_source: formData.lead_source,
      account_id: formData.account_id,
      owner_id: formData.opportunity_owner ? Number(formData.opportunity_owner) : null,
      custom_fields: { ...formData.custom_fields }
    };

    console.log('✅ Duplicate Proceed - Clean Payload:', payload);
    onSubmit(payload);
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
      // Create payload without spreading formData first
      const payload: any = {
        name: formData.name,
        description: formData.description,
        amount: formData.amount,
        probability: formData.probability,
        stage_id: formData.stage_id,
        expected_close_date: formData.expected_close_date ? formData.expected_close_date : null,
        actual_close_date: formData.actual_close_date ? formData.actual_close_date : null,
        lead_source: formData.lead_source,
        account_id: formData.account_id,
        owner_id: formData.opportunity_owner ? Number(formData.opportunity_owner) : null,
        custom_fields: { ...formData.custom_fields }
      };

      // Double-check: ensure no unwanted fields exist
      const allowedFields = [
        'name', 'description', 'amount', 'probability', 'stage_id',
        'expected_close_date', 'actual_close_date', 'lead_source',
        'account_id', 'owner_id', 'custom_fields'
      ];

      // Remove any fields that are not in the allowed list
      Object.keys(payload).forEach(key => {
        if (!allowedFields.includes(key)) {
          console.log(`🚫 Removing unwanted field: ${key}`);
          delete payload[key];
        }
      });

      console.log('🔍 Form Data (raw):', formData);
      console.log('✅ Clean Payload being sent:', payload);
      console.log('🔍 Payload keys:', Object.keys(payload));

      onSubmit(payload);
    }
  };





  function OpportunityOwnerSelect({
    users,
    value,
    onChange,
  }: {
    users: Array<{ id: string; name: string; company_role_name?: string }>;
    value: string;
    onChange: (val: string) => void;
  }) {
    const [query, setQuery] = React.useState('');

    const filtered =
      query === ''
        ? users
        : users.filter((u) =>
          `${u.name} ${u.company_role_name || ''}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );

    return (
      <Combobox value={value} onChange={onChange}>
        <div className="relative">
          {/* ✅ Writable input instead of placeholder */}
          <Combobox.Input
            className="w-full px-3 py-2 border border-gray-300 rounded-md 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
            displayValue={(id: string) =>
              users.find((u) => u.id === id)?.name || ''
            }
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search owner..."
          />

          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto 
                                     rounded-md bg-white border shadow-lg">
            {filtered.length === 0 && query !== '' ? (
              <div className="cursor-default select-none px-4 py-2 text-gray-500">
                No users found.
              </div>
            ) : (
              filtered.map((u) => (
                <Combobox.Option
                  key={u.id}
                  value={u.id}
                  className={({ active }) =>
                    `cursor-pointer select-none px-4 py-2 ${active ? 'bg-blue-600 text-white' : 'text-gray-900'
                    }`
                  }
                >
                  {u.name}
                  {u.company_role_name ? ` - ${u.company_role_name}` : ''}
                </Combobox.Option>
              ))
            )}
          </Combobox.Options>
        </div>
      </Combobox>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {opportunity ? 'Edit Opportunity' : 'Create New Opportunity'}
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
                Opportunity Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Enter opportunity name"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account
              </label>
              <select
                value={formData.account_id}
                onChange={(e) => handleChange('account_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} {account.industry ? `(${account.industry})` : ''}
                  </option>
                ))}
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
              placeholder="Enter opportunity description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => handleChange('amount', Number(e.target.value))}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
            </div>

            <div className='hidden'>
              {/* <label className="block text-sm font-medium text-gray-700 mb-1">
                Probability (%)
              </label> */}
              <input
                type="hidden"
                value={formData.probability}
                onChange={(e) => handleChange('probability', parseInt(e.target.value))}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.probability ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="0"
                min="0"
                max="100"
              />
              {errors.probability && <p className="text-red-500 text-sm mt-1">{errors.probability}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stage *
              </label>
              <select
                value={formData.stage_id}
                onChange={(e) => {
                  const stage = stages.find(s => s.id === e.target.value);
                  handleChange('stage_id', e.target.value);
                  handleChange('stage', stage?.name || '');
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.stage_id ? 'border-red-500' : 'border-gray-300'
                  }`}
              >
                <option value="">Select Stage</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              {errors.stage_id && (
                <p className="text-red-500 text-sm mt-1">{errors.stage_id}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead Source
              </label>
              <select
                value={formData.lead_source}
                onChange={(e) => handleChange('lead_source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Lead Source</option>
                <option value="Website">Website</option>
                <option value="Referral">Referral</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Trade Show">Trade Show</option>
                <option value="Social Media">Social Media</option>
                <option value="Email Campaign">Email Campaign</option>
                <option value="Partner">Partner</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Close Date
              </label>
              <input
                type="date"
                value={formData.expected_close_date}
                onChange={(e) => handleChange('expected_close_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">When you expect this opportunity to close</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actual Close Date
              </label>
              <input
                type="date"
                value={formData.actual_close_date}
                onChange={(e) => handleChange('actual_close_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">When this opportunity actually closed (optional)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opportunity Owner
              </label>
              <OpportunityOwnerSelect
                users={companyUsers}
                value={formData.opportunity_owner}
                onChange={(val: string) => handleChange('opportunity_owner', val)}
              />
            </div>
          </div>

          {/* Relationships Section */}
          {opportunity?.id && (
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
                          Contact
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
                              Contact
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
                              onClick={() => handleDeleteRelationship(relationship.id!)}
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

          {/* ✅ Searchable Opportunity Owner (Radix Select + search box) */}


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

          {/* PSA Project Templates Section */}
          {opportunity && opportunity.id && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-medium text-gray-900">Project Templates</h4>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplateSelector(true)}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    disabled={isLoadingTemplate}
                  >
                    {isLoadingTemplate ? 'Loading...' : 'Add Template'}
                  </button>
                </div>
              </div>

              {isLoadingTemplate ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2">Loading templates...</p>
                </div>
              ) : selectedTemplates.length > 0 ? (
                <div className="space-y-4">
                  {/* Individual Template Cards */}
                  {selectedTemplates.map((template, index) => (
                    <div key={template.template_id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h5 className="text-lg font-semibold text-gray-900">{template.template_name}</h5>
                          <p className="text-sm text-gray-600">{template.category || 'Uncategorized'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecificTemplate(template.template_id)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                          disabled={isLoadingTemplate}
                        >
                          Remove
                        </button>
                      </div>

                      {template.template_description && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-600">{template.template_description}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Budget Hours</p>
                          <p className="font-semibold text-gray-900">{template.budget_hours || 0} hrs</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Duration</p>
                          <p className="font-semibold text-gray-900">{template.duration_weeks || 0} weeks</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Resources</p>
                          <p className="font-semibold text-gray-900">{template.resource_count || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Est. Cost</p>
                          <p className="font-semibold text-green-700">
                            ${Number(template.estimated_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Skills */}
                      {template.all_required_skills && Array.isArray(template.all_required_skills) && template.all_required_skills.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 mb-1">Required Skills:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.all_required_skills.slice(0, 5).map((skill: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                                {skill}
                              </span>
                            ))}
                            {template.all_required_skills.length > 5 && (
                              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                                +{template.all_required_skills.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 text-xs text-gray-500">
                        Attached on: {new Date(template.attached_at).toLocaleDateString()} 
                        {template.attached_by_name && ` by ${template.attached_by_name}`}
                      </div>
                    </div>
                  ))}

                  {/* Aggregated Summary */}
                  {aggregatedData && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h5 className="text-lg font-semibold text-blue-900 mb-3">📊 Project Summary</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold text-blue-700">Total Budget Hours</p>
                          <p className="text-2xl font-bold text-blue-900">{aggregatedData.totalHours || 0} hrs</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-blue-700">Total Estimated Cost</p>
                          <p className="text-2xl font-bold text-green-700">
                            ${Number(aggregatedData.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-blue-700">Unique Resources</p>
                          <p className="text-xl font-bold text-blue-900">{aggregatedData.uniqueResources || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-blue-700">Total Templates</p>
                          <p className="text-xl font-bold text-blue-900">{selectedTemplates.length}</p>
                        </div>
                      </div>
                      
                      {/* All Skills */}
                      {aggregatedData.allSkills && aggregatedData.allSkills.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-blue-700 mb-2">All Required Skills:</p>
                          <div className="flex flex-wrap gap-2">
                            {aggregatedData.allSkills.map((skill: string, idx: number) => (
                              <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-sm">No templates attached to this opportunity.</p>
                  <p className="text-xs mt-1">Click "Add Template" to link PSA project templates for estimation.</p>
                </div>
              )}
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
              {isSubmitting ? 'Saving...' : (opportunity ? 'Update Opportunity' : 'Create Opportunity')}
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
                {newRelationship.id ? 'Edit Contact Relationship' : 'Add Contact Relationship'}
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
                  Contact *
                </label>
                <select
                  value={newRelationship.related_entity_id || ''}
                  onChange={(e) => setNewRelationship(prev => ({ ...prev, related_entity_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select contact</option>
                  {allContacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name} {contact.email ? `(${contact.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={newRelationship.relationship_type || ''}
                  onChange={(e) => setNewRelationship(prev => ({ ...prev, relationship_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select role</option>
                  <option value="Owner">Owner</option>
                  <option value="Team Member">Team Member</option>
                  <option value="Stakeholder">Stakeholder</option>
                  <option value="Influencer">Influencer</option>
                  <option value="Decision Maker">Decision Maker</option>
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
        entityType="Opportunity"
      />

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-[90%] max-w-5xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Select Project Templates
              </h3>
              <button
                onClick={() => setShowTemplateSelector(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            {availableTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No templates available with cost and resource details.</p>
                <p className="text-sm mt-2">Please create a template from an existing PSA project first.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {availableTemplates.map((template) => {
                  const isAlreadyAttached = selectedTemplates.some(t => t.template_id === template.id);
                  
                  return (
                    <div
                      key={template.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        isAlreadyAttached 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={isAlreadyAttached}
                            disabled={isAlreadyAttached}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            onChange={() => !isAlreadyAttached && handleAttachTemplate(template.id)}
                          />
                          <div className="flex-1">
                            <h4 className="text-md font-semibold text-gray-900">{template.name}</h4>
                            {template.description && (
                              <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-xs rounded-full ml-4 ${
                          isAlreadyAttached 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {isAlreadyAttached ? 'Attached' : (template.category || 'Uncategorized')}
                        </span>
                      </div>

                    <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Budget Hours</p>
                        <p className="font-semibold text-gray-900">
                          {template.budgetHours || template.stats?.effectiveHours || 0} hrs
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Duration</p>
                        <p className="font-semibold text-gray-900">{template.durationWeeks || 0} weeks</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Resources</p>
                        <p className="font-semibold text-gray-900">
                          {template.resourceCount || template.stats?.totalResources || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Est. Cost</p>
                        <p className="font-semibold text-green-700">
                          ${Number(template.estimatedCost || template.stats?.estimatedCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Skills */}
                    {template.allRequiredSkills && Array.isArray(template.allRequiredSkills) && template.allRequiredSkills.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">Required Skills:</p>
                        <div className="flex flex-wrap gap-1">
                          {template.allRequiredSkills.slice(0, 5).map((skill: string, idx: number) => (
                            <span key={idx} className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                              {skill}
                            </span>
                          ))}
                          {template.allRequiredSkills.length > 5 && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                              +{template.allRequiredSkills.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Resource Preview */}
                    {template.resourceDetails && Array.isArray(template.resourceDetails) && template.resourceDetails.length > 0 && (
                      <div className="mt-3 border-t pt-2">
                        <p className="text-xs text-gray-500 mb-1">Resources:</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {template.resourceDetails.slice(0, 3).map((resource: any, idx: number) => (
                            <span key={idx} className="text-gray-700">
                              {resource.name} ({resource.role}) - ${resource.hourly_rate}/hr
                            </span>
                          ))}
                          {template.resourceDetails.length > 3 && (
                            <span className="text-gray-500">+{template.resourceDetails.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end mt-4 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowTemplateSelector(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}