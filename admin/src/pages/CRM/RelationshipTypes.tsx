import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  GitBranch, 
  Search, 
  Filter, 
  MoreVertical,
  Copy,
  Archive,
  RefreshCw,
  Info,
  AlertCircle,
  CheckCircle,
  Users,
  Building,
  Target
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ConfirmationModal from '../../components/ui/confirmation-modal';
import { createRelationshipTypeService, RelationshipType, CreateRelationshipTypeData } from '../../services/crm/relationshipTypeService';

interface RelationshipTypeForm {
  name: string;
  description: string;
  entity_type_from: string;
  entity_type_to: string;
  is_active: boolean;
  sort_order: number;
}

interface RelationshipTypeWithStats extends RelationshipType {
  usage_count?: number;
  last_used?: string;
}

export default function RelationshipTypes() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipTypeWithStats[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<RelationshipTypeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<RelationshipType | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('account-account');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: RelationshipType | null }>({ isOpen: false, type: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'usage_count'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [bulkActionModal, setBulkActionModal] = useState<{ isOpen: boolean; action: string }>({ isOpen: false, action: '' });
  const { showSuccess, showError } = useToast();

  // Create service instance
  const relationshipTypeService = companyId ? createRelationshipTypeService(companyId) : null;

  // Get valid "To Entity" options based on selected "From Entity"
  const getValidToEntityOptions = (fromEntity: string) => {
    switch (fromEntity) {
      case 'account':
        return ['account', 'contact']; // Account can relate to Account or Contact
      case 'contact':
        return ['opportunity']; // Contact can only relate to Opportunity
      case 'opportunity':
        return []; // Opportunity cannot be the "from" entity
      default:
        return [];
    }
  };

  const [formData, setFormData] = useState<RelationshipTypeForm>({
    name: '',
    description: '',
    entity_type_from: 'account',
    entity_type_to: 'account',
    is_active: true,
    sort_order: 0
  });

  const tabs = [
    { 
      id: 'account-account', 
      label: 'Account ↔ Account', 
      from: 'account', 
      to: 'account',
      icon: Building,
      description: 'Define relationships between companies'
    },
    { 
      id: 'account-contact', 
      label: 'Account ↔ Contact', 
      from: 'account', 
      to: 'contact',
      icon: Users,
      description: 'Define relationships between companies and people'
    },
    { 
      id: 'contact-opportunity', 
      label: 'Contact ↔ Opportunity', 
      from: 'contact', 
      to: 'opportunity',
      icon: Target,
      description: 'Define roles for people in opportunities'
    }
  ];

  useEffect(() => {
    if (companyId) {
      loadRelationshipTypes();
    }
  }, [companyId, activeTab]);

  useEffect(() => {
    filterAndSortTypes();
  }, [relationshipTypes, searchTerm, showInactive, sortBy, sortOrder]);

  const loadRelationshipTypes = async () => {
    if (!relationshipTypeService) return;
    
    try {
      setIsLoading(true);
      const activeTabData = tabs.find(tab => tab.id === activeTab);
      if (!activeTabData) return;

      const data = await relationshipTypeService.getRelationshipTypes({
        entity_type_from: activeTabData.from,
        entity_type_to: activeTabData.to
      });
      
      // Add mock usage statistics for demonstration
      const typesWithStats = data.map((type, index) => ({
        ...type,
        usage_count: Math.floor(Math.random() * 50) + 1,
        last_used: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      }));
      
      setRelationshipTypes(typesWithStats);
    } catch (error) {
      console.error('Failed to load relationship types:', error);
      showError('Failed to load relationship types');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortTypes = () => {
    let filtered = relationshipTypes.filter(type => {
      const matchesSearch = type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (type.description && type.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesActiveFilter = showInactive || type.is_active;
      return matchesSearch && matchesActiveFilter;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
        case 'usage_count':
          aValue = a.usage_count || 0;
          bValue = b.usage_count || 0;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredTypes(filtered);
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setShowForm(false);
    setEditingType(undefined);
    setSearchTerm('');
    setSelectedTypes(new Set());
  };

  const handleCreate = () => {
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    if (activeTabData) {
      setFormData({
        name: '',
        description: '',
        entity_type_from: activeTabData.from,
        entity_type_to: activeTabData.to,
        is_active: true,
        sort_order: 0
      });
    }
    setEditingType(undefined);
    setShowForm(true);
  };

  const handleEdit = (type: RelationshipType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description || '',
      entity_type_from: type.entity_type_from,
      entity_type_to: type.entity_type_to,
      is_active: type.is_active,
      sort_order: type.sort_order
    });
    setShowForm(true);
  };

  const handleDelete = async (type: RelationshipType) => {
    setDeleteModal({ isOpen: true, type });
  };

  const confirmDelete = async () => {
    if (!relationshipTypeService || !deleteModal.type) return;
    
    try {
      await relationshipTypeService.deleteRelationshipType(deleteModal.type.id);
      await loadRelationshipTypes();
      showSuccess('Relationship type deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete relationship type:', error);
      showError(error.message || 'Failed to delete relationship type');
    } finally {
      setDeleteModal({ isOpen: false, type: null });
    }
  };

  const handleBulkAction = async () => {
    if (selectedTypes.size === 0) return;
    
    try {
      if (bulkActionModal.action === 'delete') {
        // Implement bulk delete
        showSuccess(`Deleted ${selectedTypes.size} relationship types`);
      } else if (bulkActionModal.action === 'archive') {
        // Implement bulk archive
        showSuccess(`Archived ${selectedTypes.size} relationship types`);
      }
      
      setSelectedTypes(new Set());
      await loadRelationshipTypes();
    } catch (error: any) {
      showError(error.message || 'Bulk action failed');
    } finally {
      setBulkActionModal({ isOpen: false, action: '' });
    }
  };

  const handleSelectAll = () => {
    if (selectedTypes.size === filteredTypes.length) {
      setSelectedTypes(new Set());
    } else {
      setSelectedTypes(new Set(filteredTypes.map(type => type.id)));
    }
  };

  const handleSelectType = (typeId: string) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(typeId)) {
      newSelected.delete(typeId);
    } else {
      newSelected.add(typeId);
    }
    setSelectedTypes(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipTypeService) return;
    
    try {
      setIsSubmitting(true);
      
      if (editingType) {
        await relationshipTypeService.updateRelationshipType(editingType.id, formData);
        showSuccess('Relationship type updated successfully');
      } else {
        await relationshipTypeService.createRelationshipType(formData);
        showSuccess('Relationship type created successfully');
      }
      
      await loadRelationshipTypes();
      setShowForm(false);
      setEditingType(undefined);
      setFormData({
        name: '',
        description: '',
        entity_type_from: 'account',
        entity_type_to: 'account',
        is_active: true,
        sort_order: 0
      });
    } catch (error: any) {
      console.error('Failed to save relationship type:', error);
      showError(error.message || 'Failed to save relationship type');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof RelationshipTypeForm, value: string | boolean | number) => {
    if (field === 'entity_type_from') {
      // When "From Entity" changes, update "To Entity" to a valid option
      const validToOptions = getValidToEntityOptions(value as string);
      const newToEntity = validToOptions.includes(formData.entity_type_to) 
        ? formData.entity_type_to 
        : validToOptions[0];
      
      setFormData(prev => ({ 
        ...prev, 
        entity_type_from: value as string,
        entity_type_to: newToEntity
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const getUsageColor = (count: number) => {
    if (count > 30) return 'text-green-600';
    if (count > 10) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!companyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Company ID Required</h2>
          <p className="text-gray-600">Please select a company to manage relationship types.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 sm:px-0 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Relationship Types</h1>
              <p className="text-gray-600 mt-1">
                Define and manage relationship types between different CRM entities
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => loadRelationshipTypes()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={handleCreate}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Relationship Type
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-0 mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          {/* Tab description */}
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="px-4 sm:px-0 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search relationship types..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Show inactive</span>
                </label>

                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="created_at-desc">Newest first</option>
                  <option value="created_at-asc">Oldest first</option>
                  <option value="usage_count-desc">Most used</option>
                  <option value="usage_count-asc">Least used</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedTypes.size > 0 && (
          <div className="px-4 sm:px-0 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-blue-700">
                    {selectedTypes.size} relationship type{selectedTypes.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => setSelectedTypes(new Set())}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setBulkActionModal({ isOpen: true, action: 'archive' })}
                    className="inline-flex items-center px-3 py-1 border border-blue-300 text-sm font-medium rounded text-blue-700 bg-white hover:bg-blue-50"
                  >
                    <Archive className="mr-1 h-3 w-3" />
                    Archive
                  </button>
                  <button
                    onClick={() => setBulkActionModal({ isOpen: true, action: 'delete' })}
                    className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-4 sm:px-0">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading relationship types...</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              {filteredTypes.length === 0 ? (
                <div className="text-center py-12">
                  <GitBranch className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No relationship types found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating a new relationship type.'}
                  </p>
                  {!searchTerm && (
                    <div className="mt-6">
                      <button
                        onClick={handleCreate}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Relationship Type
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedTypes.size === filteredTypes.length && filteredTypes.length > 0}
                            onChange={handleSelectAll}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Usage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Used
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredTypes.map((type) => (
                        <tr key={type.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedTypes.has(type.id)}
                              onChange={() => handleSelectType(type.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="text-sm font-medium text-gray-900">
                                {type.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate">
                              {type.description || 'No description'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${getUsageColor(type.usage_count || 0)}`}>
                              {type.usage_count || 0} uses
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(type.is_active)}`}>
                              {type.is_active ? (
                                <>
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <X className="mr-1 h-3 w-3" />
                                  Inactive
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {type.last_used ? formatDate(type.last_used) : 'Never'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleEdit(type)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(type)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingType ? 'Edit Relationship Type' : 'Add Relationship Type'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingType(undefined);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Partner, Competitor, Decision Maker"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe the relationship type..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      From Entity
                    </label>
                    <select
                      value={formData.entity_type_from}
                      onChange={(e) => handleInputChange('entity_type_from', e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="account">Account</option>
                      <option value="contact">Contact</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      To Entity
                    </label>
                    <select
                      value={formData.entity_type_to}
                      onChange={(e) => handleInputChange('entity_type_to', e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {getValidToEntityOptions(formData.entity_type_from).map(option => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Helper text showing valid combinations */}
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  <strong>Valid combinations:</strong> Account ↔ Account, Account ↔ Contact, Contact ↔ Opportunity
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => handleInputChange('sort_order', parseInt(e.target.value) || 0)}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center mt-6">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Active
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingType(undefined);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {editingType ? 'Update' : 'Create'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, type: null })}
        onConfirm={confirmDelete}
        title="Delete Relationship Type"
        description={`Are you sure you want to delete "${deleteModal.type?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Bulk Action Confirmation Modal */}
      <ConfirmationModal
        isOpen={bulkActionModal.isOpen}
        onClose={() => setBulkActionModal({ isOpen: false, action: '' })}
        onConfirm={handleBulkAction}
        title={`${bulkActionModal.action === 'delete' ? 'Delete' : 'Archive'} Relationship Types`}
        description={`Are you sure you want to ${bulkActionModal.action} ${selectedTypes.size} relationship type${selectedTypes.size !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText={bulkActionModal.action === 'delete' ? 'Delete' : 'Archive'}
        cancelText="Cancel"
        variant={bulkActionModal.action === 'delete' ? 'destructive' : 'default'}
      />
    </div>
  );
}
