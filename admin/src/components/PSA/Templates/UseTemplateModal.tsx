import React, { useState, useEffect } from 'react';
import { X, Play, AlertCircle, Check } from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

interface UseTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  template: any;
  companyId: string;
}

interface ProjectFormData {
  projectName: string;
  projectDescription: string;
  projectType: string;
  methodology: string;
  client: string;
  startDate: string;
  endDate: string;
  budgetHours: number;
}

const UseTemplateModal: React.FC<UseTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  template,
  companyId
}) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState<ProjectFormData>({
    projectName: '',
    projectDescription: '',
    projectType: 'development',
    methodology: 'agile',
    client: '',
    startDate: '',
    endDate: '',
    budgetHours: 0
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  const projectTypes = [
    { value: 'development', label: 'Development' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'research', label: 'Research' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'training', label: 'Training' }
  ];

  const methodologies = [
    { value: 'agile', label: 'Agile' },
    { value: 'scrum', label: 'Scrum' },
    { value: 'kanban', label: 'Kanban' },
    { value: 'waterfall', label: 'Waterfall' },
    { value: 'devops', label: 'DevOps' }
  ];

  // Fetch clients from API
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await api.get(`/psa/clients?companyId=${companyId}`);
        if (response.data.success) {
          setClients(response.data.clients);
        }
      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };

    if (isOpen && companyId) {
      fetchClients();
    }
  }, [isOpen, companyId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isClientDropdownOpen && !target.closest('.client-dropdown')) {
        setIsClientDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isClientDropdownOpen]);

  useEffect(() => {
    if (template && isOpen) {
      console.log('=== UseTemplateModal Debug ===');
      console.log('Template:', template);
      console.log('Template type:', template.type);
      console.log('Template epics:', template.epics);
      console.log('Template epics length:', template.epics?.length);
      console.log('Template features:', template.features);
      console.log('Template features length:', template.features?.length);
      console.log('=== End Debug ===\n');
      
      setFormData({
        projectName: `New Project from ${template.name}`,
        projectDescription: `Project created from ${template.name} template. ${template.description}`,
        projectType: 'development',
        methodology: 'agile',
        client: '',
        startDate: '',
        endDate: '',
        budgetHours: template.estimatedHours || 0
      });
    }
  }, [template, isOpen]);

  const handleInputChange = (field: keyof ProjectFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const selectClient = (clientId: string) => {
    setFormData(prev => ({
      ...prev,
      client: clientId
    }));
    setIsClientDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Check if this is a hierarchical template
      if (template.epics && template.epics.length > 0) {
        // Use hierarchical endpoint
        await api.post(`/psa/templates/${template.id}/create-hierarchical-project`, {
          ...formData,
          epics: template.epics
        }, {
          params: { companyId }
        });
      } else {
        // Use regular endpoint
        await api.post(`/psa/templates/${template.id}/create-project`, formData, {
          params: { companyId }
        });
      }
      
      onSuccess();
      onClose();
      showSuccess('Project created successfully from template!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'An error occurred while creating the project';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !template) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <Play className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Project from Template</h2>
              <p className="text-gray-600">Using: {template.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Template Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Template Preview</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Type:</span>
                <span className="ml-2 font-medium capitalize">{template.type}</span>
              </div>
              <div>
                <span className="text-gray-600">Category:</span>
                <span className="ml-2 font-medium">{template.category}</span>
              </div>
              <div>
                <span className="text-gray-600">Priority:</span>
                <span className="ml-2 font-medium capitalize">{template.priority}</span>
              </div>
              <div>
                <span className="text-gray-600">Story Points:</span>
                <span className="ml-2 font-medium">{template.storyPoints}</span>
              </div>
            </div>
            {template.requiredSkills && template.requiredSkills.length > 0 && (
              <div className="mt-3">
                <span className="text-gray-600 text-sm">Required Skills:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {template.requiredSkills.map((skill: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Project Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Project Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.projectName}
                onChange={(e) => handleInputChange('projectName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter project name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Description *
              </label>
              <textarea
                value={formData.projectDescription}
                onChange={(e) => handleInputChange('projectDescription', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter project description"
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Type
                </label>
                <select
                  value={formData.projectType}
                  onChange={(e) => handleInputChange('projectType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {projectTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Methodology
                </label>
                <select
                  value={formData.methodology}
                  onChange={(e) => handleInputChange('methodology', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {methodologies.map(methodology => (
                    <option key={methodology.value} value={methodology.value}>
                      {methodology.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client (Optional)
              </label>
              <div className="relative client-dropdown">
                <button
                  type="button"
                  onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between"
                >
                  <span className={formData.client ? 'text-gray-900' : 'text-gray-500'}>
                    {formData.client ? clients.find(c => c.id === formData.client)?.name || 'Select Client' : 'Select Client'}
                  </span>
                  <svg className={`w-4 h-4 transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isClientDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {clients.map(client => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => selectClient(client.id)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{client.name}</div>
                          <div className="text-sm text-gray-500">{client.email}</div>
                        </div>
                        {formData.client === client.id && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </button>
                    ))}
                    {clients.length === 0 && (
                      <div className="px-3 py-2 text-gray-500 text-sm">No clients available</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budget
              </label>
              <input
                type="number"
                value={formData.budgetHours}
                onChange={(e) => handleInputChange('budgetHours', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                placeholder="Enter budget amount"
              />
            </div>
          </div>

          {/* Default Structure Preview */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Default Structure</h3>
            <p className="text-sm text-gray-600 mb-3">
              This template will create a project with the following default structure:
            </p>
            <div className="space-y-3 text-sm max-h-80 overflow-y-auto">
              {template.epics && template.epics.length > 0 ? (
                // Multi-epic hierarchical template with visual tree
                <>
                  {/* Summary Stats */}
                  <div className="bg-white rounded-lg p-3 border border-gray-200 mb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-purple-600">{template.epics.length}</div>
                        <div className="text-xs text-gray-500">Epics</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-600">
                          {template.epics.reduce((sum: number, e: any) => sum + (e.features?.length || 0), 0)}
                        </div>
                        <div className="text-xs text-gray-500">Features</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">
                          {template.epics.reduce((sum: number, e: any) => 
                            sum + (e.features?.reduce((fSum: number, f: any) => fSum + (f.stories?.length || 0), 0) || 0), 0)}
                        </div>
                        <div className="text-xs text-gray-500">Stories</div>
                      </div>
                    </div>
                  </div>

                  {/* Hierarchical Tree Structure */}
                  <div className="space-y-4">
                    {template.epics.map((epic: any) => (
                      <div key={epic.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                        {/* Epic Level */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                            <span className="font-semibold text-purple-700">{epic.name}</span>
                          </div>
                          <div className="text-xs text-gray-500 bg-purple-100 px-2 py-1 rounded">
                            {epic.features?.length || 0} features, {epic.features?.reduce((sum: number, f: any) => sum + (f.stories?.length || 0), 0) || 0} stories
                          </div>
                        </div>

                        {/* Features Level */}
                        {epic.features && epic.features.length > 0 && (
                          <div className="ml-4 space-y-2">
                            {epic.features.map((feature: any) => (
                              <div key={feature.id} className="border-l-2 border-blue-200 pl-3">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                    <span className="font-medium text-blue-700">{feature.name}</span>
                                  </div>
                                  <div className="text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded">
                                    {feature.stories?.length || 0} stories
                                  </div>
                                </div>

                                {/* Stories Level */}
                                {feature.stories && feature.stories.length > 0 && (
                                  <div className="ml-4 space-y-1">
                                    {feature.stories.map((story: any) => (
                                      <div key={story.id} className="flex items-center">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                                        <span className="text-green-700">{story.name}</span>
                                        {story.storyPoints && (
                                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">
                                            {story.storyPoints} pts
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : template.features && template.features.length > 0 ? (
                // Single epic template
                <>
                  {/* Summary Stats */}
                  <div className="bg-white rounded-lg p-3 border border-gray-200 mb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-purple-600">1</div>
                        <div className="text-xs text-gray-500">Epic</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-600">{template.features.length}</div>
                        <div className="text-xs text-gray-500">Features</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">
                          {template.features.reduce((sum: number, f: any) => sum + (f.stories?.length || 0), 0)}
                        </div>
                        <div className="text-xs text-gray-500">Stories</div>
                      </div>
                    </div>
                  </div>

                  {/* Single Epic Structure */}
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                        <span className="font-semibold text-purple-700">{template.name}</span>
                      </div>
                      <div className="text-xs text-gray-500 bg-purple-100 px-2 py-1 rounded">
                        {template.features.length} features, {template.features.reduce((sum: number, f: any) => sum + (f.stories?.length || 0), 0)} stories
                      </div>
                    </div>

                    {/* Features */}
                    <div className="ml-4 space-y-2">
                      {template.features.map((feature: any) => (
                        <div key={feature.id} className="border-l-2 border-blue-200 pl-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                              <span className="font-medium text-blue-700">{feature.name}</span>
                            </div>
                            <div className="text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded">
                              {feature.stories?.length || 0} stories
                            </div>
                          </div>

                          {/* Stories */}
                          {feature.stories && feature.stories.length > 0 && (
                            <div className="ml-4 space-y-1">
                              {feature.stories.map((story: any) => (
                                <div key={story.id} className="flex items-center">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                                  <span className="text-green-700">{story.name}</span>
                                  {story.storyPoints && (
                                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">
                                      {story.storyPoints} pts
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                // Default structure for single templates
                <div className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                    <span className="font-semibold text-purple-700">{template.name}</span>
                    <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {template.type}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              You can edit these items after creating the project.
            </p>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Project...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UseTemplateModal;
