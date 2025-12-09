import React, { useState, useEffect } from 'react';
import { CustomFieldDefinition, TableName } from '../../types/crm';
import { createCustomFieldService } from '../../services/crm/customFieldService';
import CustomFieldForm from '../../components/CRM/CustomFieldForm';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import ConfirmationModal from '../../components/ui/confirmation-modal';

export default function CustomFields() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | undefined>();
  const [selectedTable, setSelectedTable] = useState<TableName>('contacts');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; field: CustomFieldDefinition | null }>({ isOpen: false, field: null });
  const { showSuccess, showError } = useToast();

  // Create custom field service instance
  const customFieldService = companyId ? createCustomFieldService(companyId) : null;

  useEffect(() => {
    if (companyId) {
      loadCustomFields();
    }
  }, [selectedTable, companyId]);

  const loadCustomFields = async () => {
    if (!customFieldService) return;
    
    try {
      setIsLoading(true);
      const data = await customFieldService.getCustomFieldDefinitions(selectedTable);
      setCustomFields(data || []);
    } catch (error) {
      console.error('Failed to load custom fields:', error);
      setCustomFields([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setShowForm(true);
  };

  const handleDelete = async (field: CustomFieldDefinition) => {
    setDeleteModal({ isOpen: true, field });
  };

  const confirmDelete = async () => {
    if (!customFieldService || !deleteModal.field) return;
    
    try {
      await customFieldService.deleteCustomField(deleteModal.field.id);
      await loadCustomFields();
      showSuccess('Custom field deleted successfully');
    } catch (error) {
      console.error('Failed to delete custom field:', error);
      showError('Failed to delete custom field. Please try again.');
    } finally {
      setDeleteModal({ isOpen: false, field: null });
    }
  };

  const handleCreate = () => {
    console.log('🔄 Creating new custom field for table:', selectedTable);
    setEditingField(undefined);
    setShowForm(true);
  };

  const handleSubmit = async (fieldData: Partial<CustomFieldDefinition>) => {
    if (!customFieldService) return;
    
    try {
      console.log('🔄 Submitting custom field data:', fieldData);
      setIsSubmitting(true);
      if (editingField) {
        console.log('🔄 Updating existing custom field:', editingField.id);
        await customFieldService.updateCustomField(editingField.id, fieldData);
      } else {
        console.log('🔄 Creating new custom field');
        await customFieldService.createCustomField({
          ...fieldData,
          table_name: selectedTable,
        } as Omit<CustomFieldDefinition, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'version'>);
      }
      console.log('✅ Custom field saved successfully');
      setShowForm(false);
      await loadCustomFields();
    } catch (error) {
      console.error('❌ Failed to save custom field:', error);
      showError('Failed to save custom field. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tableOptions: { value: TableName; label: string }[] = [
    { value: 'accounts', label: 'Accounts' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'opportunities', label: 'Opportunities' },
  ];

  return (
    <div className="p-6 crm-page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Custom Fields</h1>
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Add Custom Field
        </button>
      </div>

      {/* Table Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Table
        </label>
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value as TableName)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {tableOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Fields List */}
      {isLoading ? (
        <div className="text-center py-8">Loading custom fields...</div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Custom Fields for {tableOptions.find(t => t.value === selectedTable)?.label}
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {Array.isArray(customFields) && customFields.length > 0 ? (
              customFields.map((field) => (
                <div key={field.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{field.field_label}</div>
                    <div className="text-sm text-gray-500">
                      {field.field_type} • {field.is_required ? 'Required' : 'Optional'}
                    </div>
                    {field.field_description && (
                      <div className="text-sm text-gray-500 mt-1">{field.field_description}</div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(field)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(field)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                No custom fields defined for this table.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="crm-page-spacer"></div>
      {showForm && (
        <CustomFieldForm
          field={editingField}
          tableName={selectedTable}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          isSubmitting={isSubmitting}
        />
      )}
      
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, field: null })}
        onConfirm={confirmDelete}
        title="Delete Custom Field"
        description={`Are you sure you want to delete "${deleteModal.field?.field_label}" from custom fields?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}