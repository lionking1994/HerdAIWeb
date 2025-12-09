import { useState, useEffect } from 'react';
import { Search, Plus, BookTemplate as FileTemplate, Edit, Trash2 } from 'lucide-react';
import TemplateCard from '../../components/PSA/Templates/TemplateCard';
import CreateTemplateModal from '../../components/PSA/Templates/CreateTemplateModal';
import UseTemplateModal from '../../components/PSA/Templates/UseTemplateModal';
import TemplateDetailsModal from '../../components/PSA/Templates/TemplateDetailsModal';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';


export default function Templates() {
  const { showSuccess, showError } = useToast();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateStats, setTemplateStats] = useState({
    totalTemplates: 0,
    epicTemplates: 0,
    featureTemplates: 0,
    storyTemplates: 0,
    taskTemplates: 0,
    bugTemplates: 0
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Group templates hierarchically
  const groupTemplatesHierarchically = (allTemplates: any[]): any[] => {
    // Group templates by creation time (within 1 minute) and category
    const templateGroups = new Map();
    
    allTemplates.forEach(template => {
      const createdAt = new Date(template.createdAt);
      const timeKey = Math.floor(createdAt.getTime() / 60000); // Group by minute
      const groupKey = `${timeKey}_${template.category}`;
      
      if (!templateGroups.has(groupKey)) {
        templateGroups.set(groupKey, []);
      }
      templateGroups.get(groupKey).push(template);
    });
    
    const hierarchicalTemplates: any[] = [];
    
    // Process each group
    templateGroups.forEach((templates) => {
      const epicTemplates = templates.filter((t: any) => t.type === 'epic' && !t.parentId);
      const childEpicTemplates = templates.filter((t: any) => t.type === 'epic' && t.parentId);
      const featureTemplates = templates.filter((t: any) => t.type === 'feature');
      const storyTemplates = templates.filter((t: any) => t.type === 'story');
      
      // If this group has multiple epics, create a single hierarchical template
      if (epicTemplates.length > 1) {
        const allFeatures = featureTemplates;
        const allStories = storyTemplates;
        
        // Create a virtual parent template for the group
        const groupTemplate = {
          id: epicTemplates[0].id, // Use the first epic's ID as the template ID
          name: `Hierarchical Template (${epicTemplates.length} Epics)`,
          description: `Template containing ${epicTemplates.length} epics with ${allFeatures.length} features and ${allStories.length} stories`,
          type: 'hierarchical',
          category: epicTemplates[0].category,
          estimatedHours: epicTemplates.reduce((sum: number, e: any) => sum + e.estimatedHours, 0),
          priority: 'medium',
          tags: [],
          requiredSkills: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          usageCount: 0,
          isActive: true,
          createdAt: epicTemplates[0].createdAt,
          updatedAt: epicTemplates[0].updatedAt,
          createdBy: epicTemplates[0].createdBy,
          userId: epicTemplates[0].userId,
          companyId: epicTemplates[0].companyId,
          projectId: epicTemplates[0].projectId,
          parentId: null,
          stats: epicTemplates[0].stats || null, // Preserve stats from the first epic
          epics: epicTemplates.map((epic: any) => {
            const features = allFeatures.filter((f: any) => f.parentId === epic.id);
            const featuresWithStories = features.map((feature: any) => {
              const stories = allStories.filter((s: any) => s.parentId === feature.id);
              return {
                ...feature,
                stories
              };
            });
            return {
              ...epic,
              features: featuresWithStories
            };
          }),
          totalItems: epicTemplates.length + allFeatures.length + allStories.length
        };
        
        console.log('=== Grouped Template Stats Debug ===');
        console.log('Group Template:', groupTemplate);
        console.log('Stats:', groupTemplate.stats);
        console.log('=== End Stats Debug ===\n');
        
        hierarchicalTemplates.push(groupTemplate);
      } else if (epicTemplates.length === 1) {
        // Single epic - group with its children and create hierarchical structure
        const epic = epicTemplates[0];
        
        // Get child epics (if any) and features
        const childEpics = childEpicTemplates.filter((e: any) => e.parentId === epic.id);
        const features = featureTemplates.filter((f: any) => f.parentId === epic.id);
        
        // Process child epics with their features and stories
        const childEpicsWithFeatures = childEpics.map((childEpic: any) => {
          const childFeatures = featureTemplates.filter((f: any) => f.parentId === childEpic.id);
          const featuresWithStories = childFeatures.map((feature: any) => {
            const stories = storyTemplates.filter((s: any) => s.parentId === feature.id);
            return {
              ...feature,
              stories
            };
          });
          return {
            ...childEpic,
            features: featuresWithStories
          };
        });
        
        // Process direct features (if any)
        const featuresWithStories = features.map((feature: any) => {
          const stories = storyTemplates.filter((s: any) => s.parentId === feature.id);
          return {
            ...feature,
            stories
          };
        });
        
        // Create hierarchical template structure
        const singleEpicTemplate = {
          ...epic,
          type: 'hierarchical', // Change type to hierarchical
          epics: childEpicsWithFeatures.length > 0 ? childEpicsWithFeatures : [{
            ...epic,
            features: featuresWithStories
          }],
          features: featuresWithStories, // Keep for backward compatibility
          totalItems: 1 + childEpicsWithFeatures.length + featuresWithStories.length + 
                     childEpicsWithFeatures.reduce((sum: number, e: any) => sum + e.features.length, 0) +
                     featuresWithStories.reduce((sum: number, f: any) => sum + f.stories.length, 0)
        };
        
        console.log('=== Single Epic Template Debug ===');
        console.log('Epic:', epic);
        console.log('Epic ID:', epic.id);
        console.log('Child epics:', childEpics);
        console.log('Direct features:', features);
        console.log('All feature templates:', featureTemplates);
        console.log('All story templates:', storyTemplates);
        console.log('Child epics with features:', childEpicsWithFeatures);
        console.log('Features with stories:', featuresWithStories);
        console.log('Single epic template:', singleEpicTemplate);
        console.log('=== End Single Epic Debug ===\n');
        
        hierarchicalTemplates.push(singleEpicTemplate);
      }
    });
    
    return hierarchicalTemplates;
  };

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!companyId) {
        throw new Error('Company ID not found in URL parameters');
      }
      
      const response = await api.get(`/psa/templates/company/${companyId}`, {
        params: {
          type: filterType,
          category: filterCategory,
          priority: filterPriority,
          search: searchTerm,
          page: 1,
          limit: 100
        }
      });
      
      if (response.data.success) {
        const allTemplatesData = response.data.data.templates;
        
        // Group templates hierarchically
        const groupedTemplates = groupTemplatesHierarchically(allTemplatesData);
        
        // For display, show only hierarchical templates (grouped templates)
        const displayTemplates = groupedTemplates;
        setTemplates(displayTemplates);
        
        // Update stats based on grouped templates
        const updatedStats = {
          totalTemplates: displayTemplates.length,
          epicTemplates: response.data.data.stats.epicTemplates, // Use original epic count
          featureTemplates: response.data.data.stats.featureTemplates, // Use original feature count
          storyTemplates: response.data.data.stats.storyTemplates, // Use original story count
          taskTemplates: response.data.data.stats.taskTemplates,
          bugTemplates: response.data.data.stats.bugTemplates
        };
        
        setTemplateStats(updatedStats);
        setCategories(response.data.data.filters.categories);
      } else {
        setError('Failed to fetch templates');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to fetch templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [companyId, filterType, filterCategory, filterPriority, searchTerm]);

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setIsDetailsModalOpen(true);
  };

  const handleUseTemplate = async (template: any) => {
    try {
      if (!companyId) {
        showError('Company ID not found');
        return;
      }

      // For hierarchical templates, fetch the complete structure
      if (template.type === 'hierarchical') {
        const response = await api.get(`/psa/templates/item/${template.id}`, {
          params: { companyId }
        });

        if (response.data.success) {
          setSelectedTemplate(response.data.data);
          setIsUseModalOpen(true);
        } else {
          showError('Failed to load template data');
        }
      } else {
        // For single templates, use the template data directly
        setSelectedTemplate(template);
        setIsUseModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching template data:', error);
      showError('Failed to load template data');
    }
  };

  const handleEditTemplate = async (template: any) => {
    try {
      if (!companyId) {
        showError('Company ID not found');
        return;
      }

      // Prevent multiple clicks while loading
      if (editingTemplateId === template.id) {
        return;
      }

      // Set loading state for this specific template
      setEditingTemplateId(template.id);

      // For hierarchical templates, fetch the complete structure
      if (template.type === 'hierarchical') {
        const response = await api.get(`/psa/templates/item/${template.id}`, {
          params: { companyId }
        });

        if (response.data.success) {
          setEditingTemplate(response.data.data);
          setIsCreateModalOpen(true);
        } else {
          showError('Failed to load template data');
        }
      } else {
        // For single templates, use the template data directly
        setEditingTemplate(template);
        setIsCreateModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching template data:', error);
      showError('Failed to load template data');
    } finally {
      // Clear loading state
      setEditingTemplateId(null);
    }
  };

  const handleDeleteTemplate = async (template: any) => {
    if (window.confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      try {
        if (!companyId) {
          throw new Error('Company ID not found');
        }
        
        await api.delete(`/psa/templates/${template.id}`, {
          params: { companyId }
        });
        fetchTemplates(); // Refresh the list
        showSuccess('Template deleted successfully!');
      } catch (error) {
        console.error('Error deleting template:', error);
        showError('Failed to delete template');
      }
    }
  };

  const handleCreateSuccess = () => {
    fetchTemplates(); // Refresh the list
    setEditingTemplate(null);
    setEditingTemplateId(null);
  };

  const handleCreateModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingTemplate(null);
    setEditingTemplateId(null);
  };

  const handleUseSuccess = () => {
    // Refresh templates to show updated usage counts
    fetchTemplates();
    showSuccess('Project created successfully!');
  };

  return (
    <div className="psa-page-container">
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center">
              <FileTemplate className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Template Library</h2>
                <p className="text-gray-600">Reusable templates for Epics, Features, and Stories</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setEditingTemplate(null);
                setIsCreateModalOpen(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-600">Total Templates</h3>
              <p className="text-2xl font-bold text-gray-900">{templateStats.totalTemplates}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-600">Epics</h3>
              <p className="text-2xl font-bold text-purple-600">{templateStats.epicTemplates}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-600">Features</h3>
              <p className="text-2xl font-bold text-blue-600">{templateStats.featureTemplates}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-600">Stories</h3>
              <p className="text-2xl font-bold text-green-600">{templateStats.storyTemplates}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-4">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="epic">Epic</option>
                  <option value="feature">Feature</option>
                  <option value="story">Story</option>
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading templates...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileTemplate className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading templates</h3>
                <p className="text-gray-600">{error}</p>
                <button 
                  onClick={fetchTemplates}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {templates.map(template => (
                    <div key={template.id} className="relative group">
                      <TemplateCard
                        template={template}
                        onSelect={handleTemplateSelect}
                        onUse={handleUseTemplate}
                      />
                      {/* Loading overlay */}
                      {editingTemplateId === template.id && (
                        <div className="absolute inset-0 bg-white bg-opacity-75 rounded-xl flex items-center justify-center z-10">
                          <div className="text-center">
                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-sm text-gray-600">Loading template...</p>
                          </div>
                        </div>
                      )}
                      {/* Action buttons */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditTemplate(template)}
                            disabled={editingTemplateId === template.id}
                            className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Edit template"
                          >
                            {editingTemplateId === template.id ? (
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                            ) : (
                              <Edit className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template)}
                            className="p-2 bg-white rounded-lg shadow-md hover:bg-red-50 transition-colors"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {templates.length === 0 && (
                  <div className="text-center py-12">
                    <FileTemplate className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                    <p className="text-gray-600 mb-4">Try adjusting your search criteria or filters.</p>
                    <button 
                      onClick={() => {
                        setEditingTemplate(null);
                        setIsCreateModalOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center mx-auto"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Template
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => {
                  const epicTemplate = templates.find(t => t.type === 'epic');
                  if (epicTemplate) {
                    handleUseTemplate(epicTemplate);
                  } else {
                    showError('No epic templates available. Create one first!');
                  }
                }}
                className="p-4 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
              >
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <FileTemplate className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-medium text-gray-900">Generate Epic Backlog</h4>
                  <p className="text-sm text-gray-600 mt-1">Create an epic with pre-configured features</p>
                </div>
              </button>

              <button
                onClick={() => {
                  const featureTemplate = templates.find(t => t.type === 'feature');
                  if (featureTemplate) {
                    handleUseTemplate(featureTemplate);
                  } else {
                    showError('No feature templates available. Create one first!');
                  }
                }}
                className="p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <FileTemplate className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="font-medium text-gray-900">Generate Feature Set</h4>
                  <p className="text-sm text-gray-600 mt-1">Create multiple related features</p>
                </div>
              </button>

              <button
                onClick={() => {
                  const storyTemplate = templates.find(t => t.type === 'story');
                  if (storyTemplate) {
                    handleUseTemplate(storyTemplate);
                  } else {
                    showError('No story templates available. Create one first!');
                  }
                }}
                className="p-4 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
              >
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <FileTemplate className="w-6 h-6 text-green-600" />
                  </div>
                  <h4 className="font-medium text-gray-900">Generate Sprint Backlog</h4>
                  <p className="text-sm text-gray-600 mt-1">Create stories for sprint planning</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateTemplateModal
        isOpen={isCreateModalOpen}
        onClose={handleCreateModalClose}
        onSuccess={handleCreateSuccess}
        companyId={companyId || ''}
        template={editingTemplate}
      />

      <UseTemplateModal
        isOpen={isUseModalOpen}
        onClose={() => {
          setIsUseModalOpen(false);
          setSelectedTemplate(null);
        }}
        onSuccess={handleUseSuccess}
        template={selectedTemplate}
        companyId={companyId || ''}
      />

      <TemplateDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
      />
    </div>
  );
}