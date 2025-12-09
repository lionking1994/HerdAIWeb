import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Check, Plus, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  template?: any; // For editing existing template
}

interface TemplateFormData {
  name: string;
  description: string;
  type: string;
  category: string;
  estimatedHours: number;
  storyPoints: number;
  requiredSkills: string[];
  acceptanceCriteria: string[];
  definitionOfDone: string[];
  priority: string;
  tags: string[];
}

// New interfaces for hierarchical templates
interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  storyPoints: number;
  estimatedHours: number;
  priority: string;
  requiredSkills: string[];
  acceptanceCriteria: string[];
  definitionOfDone: string[];
  tags: string[];
}

interface FeatureTemplate {
  id: string;
  name: string;
  description: string;
  estimatedHours: number;
  priority: string;
  definitionOfDone: string[];
  tags: string[];
  stories: StoryTemplate[];
}

interface EpicTemplate {
  id: string;
  name: string;
  description: string;
  estimatedHours: number;
  priority: string;
  definitionOfDone: string[];
  tags: string[];
  features: FeatureTemplate[];
}

interface HierarchicalTemplateData {
  templateName: string;
  templateDescription: string;
  category: string;
  epics: EpicTemplate[];
}

const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  template
}) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    type: 'story',
    category: '',
    estimatedHours: 0,
    storyPoints: 1,
    requiredSkills: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    priority: 'medium',
    tags: []
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [skills, setSkills] = useState<any[]>([]);
  const [isSkillsDropdownOpen, setIsSkillsDropdownOpen] = useState(false);
  const [newCriteria, setNewCriteria] = useState('');
  const [newDefinition, setNewDefinition] = useState('');
  const [newTag, setNewTag] = useState('');

  // New state for hierarchical templates
  const [templateMode, setTemplateMode] = useState<'single' | 'hierarchical'>('single');
  const [hierarchicalData, setHierarchicalData] = useState<HierarchicalTemplateData>({
    templateName: '',
    templateDescription: '',
    category: '',
    epics: []
  });
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  const templateTypes = [
    { value: 'epic', label: 'Epic' },
    { value: 'feature', label: 'Feature' },
    { value: 'story', label: 'Story' }
  ];

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];

  const categories = [
    'Development',
    'Design',
    'Testing',
    'Documentation',
    'Infrastructure',
    'Security',
    'Performance',
    'UI/UX',
    'Backend',
    'Frontend',
    'Mobile',
    'Web',
    'API',
    'Database',
    'DevOps'
  ];

  // Fetch skills from API
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await api.get('/psa/skills');
        if (response.data.success) {
          setSkills(response.data.skills);
        }
      } catch (error) {
        console.error('Error fetching skills:', error);
      }
    };

    if (isOpen) {
      fetchSkills();
    }
  }, [isOpen]);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isSkillsDropdownOpen && !target.closest('.skills-dropdown')) {
        setIsSkillsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSkillsDropdownOpen]);

  useEffect(() => {
    if (template) {
      // Check if it's a hierarchical template
      if (template.type === 'hierarchical' && template.epics) {
        setTemplateMode('hierarchical');
        // Ensure features have stories array
        const processedEpics = template.epics?.map((epic: any) => ({
          ...epic,
          features: epic.features?.map((feature: any) => ({
            ...feature,
            stories: feature.stories || []
          })) || []
        })) || [];

        setHierarchicalData({
          templateName: template.name || '',
          templateDescription: template.description || '',
          category: template.category || '',
          epics: processedEpics
        });
        
        // Expand all epics, features, and stories when editing
        const allEpicIds = new Set<string>(processedEpics.map((epic: any) => epic.id) || []);
        const allFeatureIds = new Set<string>();
        processedEpics.forEach((epic: any) => {
          if (epic.features && Array.isArray(epic.features)) {
            epic.features.forEach((feature: any) => {
              if (feature.id) {
                allFeatureIds.add(feature.id);
              }
            });
          }
        });
        
        setExpandedEpics(allEpicIds);
        setExpandedFeatures(allFeatureIds);
        
        console.log('Loading hierarchical template for editing:', template.name, 'Epics:', template.epics?.length);
        console.log('Template epics structure:', template.epics);
        console.log('All epic IDs to expand:', Array.from(allEpicIds));
        console.log('All feature IDs to expand:', Array.from(allFeatureIds));
      } else {
        setTemplateMode('single');
        setFormData({
          name: template.name || '',
          description: template.description || '',
          type: template.type || 'story',
          category: template.category || '',
          estimatedHours: template.estimatedHours || 0,
          storyPoints: template.storyPoints || 1,
          requiredSkills: template.requiredSkills || [],
          acceptanceCriteria: template.acceptanceCriteria || [],
          definitionOfDone: template.definitionOfDone || [],
          priority: template.priority || 'medium',
          tags: template.tags || []
        });
      }
    } else {
      setTemplateMode('single');
      setFormData({
        name: '',
        description: '',
        type: 'story',
        category: '',
        estimatedHours: 0,
        storyPoints: 1,
        requiredSkills: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        priority: 'medium',
        tags: []
      });
      setHierarchicalData({
        templateName: '',
        templateDescription: '',
        category: '',
        epics: []
      });
    }
  }, [template, isOpen]);

  const handleInputChange = (field: keyof TemplateFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddArrayItem = (field: 'requiredSkills' | 'acceptanceCriteria' | 'definitionOfDone' | 'tags', value: string) => {
    if (value.trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
    }
  };

  const handleRemoveArrayItem = (field: 'requiredSkills' | 'acceptanceCriteria' | 'definitionOfDone' | 'tags', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const toggleSkill = (skillId: string) => {
    setFormData(prev => {
      const currentSkills = prev.requiredSkills;
      const skill = skills.find(s => s.id === skillId);
      const skillName = skill?.name || '';
      const isSelected = currentSkills.includes(skillName);
      
      if (isSelected) {
        return {
          ...prev,
          requiredSkills: currentSkills.filter(name => name !== skillName)
        };
      } else {
        return {
          ...prev,
          requiredSkills: [...currentSkills, skillName]
        };
      }
    });
  };

  const removeSkill = (skillName: string) => {
    setFormData(prev => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter(name => name !== skillName)
    }));
  };

  // Helper functions for hierarchical templates
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addEpic = () => {
    const newEpic: EpicTemplate = {
      id: generateId(),
      name: '',
      description: '',
      estimatedHours: 0,
      priority: 'medium',
      definitionOfDone: [],
      tags: [],
      features: []
    };
    setHierarchicalData(prev => ({
      ...prev,
      epics: [...prev.epics, newEpic]
    }));
  };

  const addFeature = (epicId: string) => {
    const newFeature: FeatureTemplate = {
      id: generateId(),
      name: '',
      description: '',
      estimatedHours: 0,
      priority: 'medium',
      definitionOfDone: [],
      tags: [],
      stories: []
    };
    setHierarchicalData(prev => ({
      ...prev,
      epics: prev.epics.map(epic => 
        epic.id === epicId 
          ? { ...epic, features: [...epic.features, newFeature] }
          : epic
      )
    }));
  };

  const addStory = (epicId: string, featureId: string) => {
    const newStory: StoryTemplate = {
      id: generateId(),
      name: '',
      description: '',
      storyPoints: 1,
      estimatedHours: 0,
      priority: 'medium',
      requiredSkills: [],
      acceptanceCriteria: [],
      definitionOfDone: [],
      tags: []
    };
    setHierarchicalData(prev => ({
      ...prev,
      epics: prev.epics.map(epic => 
        epic.id === epicId 
          ? {
              ...epic,
              features: epic.features.map(feature =>
                feature.id === featureId
                  ? { ...feature, stories: [...feature.stories, newStory] }
                  : feature
              )
            }
          : epic
      )
    }));
  };

  const removeEpic = (epicId: string) => {
    setHierarchicalData(prev => ({
      ...prev,
      epics: prev.epics.filter(epic => epic.id !== epicId)
    }));
  };

  const removeFeature = (epicId: string, featureId: string) => {
    setHierarchicalData(prev => ({
      ...prev,
      epics: prev.epics.map(epic => 
        epic.id === epicId 
          ? { ...epic, features: epic.features.filter(feature => feature.id !== featureId) }
          : epic
      )
    }));
  };

  const removeStory = (epicId: string, featureId: string, storyId: string) => {
    setHierarchicalData(prev => ({
      ...prev,
      epics: prev.epics.map(epic => 
        epic.id === epicId 
          ? {
              ...epic,
              features: epic.features.map(feature =>
                feature.id === featureId
                  ? { ...feature, stories: feature.stories.filter(story => story.id !== storyId) }
                  : feature
              )
            }
          : epic
      )
    }));
  };

  const updateEpic = (epicId: string, field: keyof EpicTemplate, value: any) => {
    setHierarchicalData(prev => ({
      ...prev,
      epics: prev.epics.map(epic => 
        epic.id === epicId ? { ...epic, [field]: value } : epic
      )
    }));
  };

  const updateFeature = (epicId: string, featureId: string, field: keyof FeatureTemplate, value: any) => {
    setHierarchicalData(prev => ({
      ...prev,
      epics: prev.epics.map(epic => 
        epic.id === epicId 
          ? {
              ...epic,
              features: epic.features.map(feature =>
                feature.id === featureId ? { ...feature, [field]: value } : feature
              )
            }
          : epic
      )
    }));
  };

  const updateStory = (epicId: string, featureId: string, storyId: string, field: keyof StoryTemplate, value: any) => {
    setHierarchicalData(prev => ({
      ...prev,
      epics: prev.epics.map(epic => 
        epic.id === epicId 
          ? {
              ...epic,
              features: epic.features.map(feature =>
                feature.id === featureId
                  ? {
                      ...feature,
                      stories: feature.stories.map(story =>
                        story.id === storyId ? { ...story, [field]: value } : story
                      )
                    }
                  : feature
              )
            }
          : epic
      )
    }));
  };

  const toggleEpicExpansion = (epicId: string) => {
    setExpandedEpics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(epicId)) {
        newSet.delete(epicId);
      } else {
        newSet.add(epicId);
      }
      return newSet;
    });
  };

  const toggleFeatureExpansion = (featureId: string) => {
    setExpandedFeatures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(featureId)) {
        newSet.delete(featureId);
      } else {
        newSet.add(featureId);
      }
      return newSet;
    });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (templateMode === 'single') {
        // Handle single template creation (existing logic)
        const submitData = {
          ...formData,
          ...(formData.type !== 'epic' && { storyPoints: formData.storyPoints })
        };

        if (template) {
          await api.put(`/psa/templates/${template.id}`, submitData, {
            params: { companyId }
          });
        } else {
          await api.post(`/psa/templates/${companyId}`, submitData);
        }
      } else {
        // Handle hierarchical template creation
        if (hierarchicalData.epics.length === 0) {
          throw new Error('Please add at least one epic to create a hierarchical template');
        }

        // Validate that all epics have names
        for (const epic of hierarchicalData.epics) {
          if (!epic.name.trim()) {
            throw new Error('All epics must have a name');
          }
        }

        const submitData = {
          name: hierarchicalData.templateName,
          description: hierarchicalData.templateDescription,
          category: hierarchicalData.category,
          epics: hierarchicalData.epics
        };

        if (template) {
          await api.put(`/psa/templates/hierarchical/${template.id}`, submitData, {
            params: { companyId }
          });
        } else {
          await api.post(`/psa/templates/hierarchical/${companyId}`, submitData);
        }
      }
      
      onSuccess();
      onClose();
      showSuccess(template ? 'Template updated successfully!' : 'Template created successfully!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'An error occurred while saving the template';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {template ? 'Edit Template' : 'Create New Template'}
          </h2>
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

          {/* Template Mode Selection */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Type</h3>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="single"
                  checked={templateMode === 'single'}
                  onChange={(e) => setTemplateMode(e.target.value as 'single' | 'hierarchical')}
                  className="mr-2"
                  disabled={template && template.type === 'hierarchical'}
                />
                <span className={`text-gray-700 ${template && template.type === 'hierarchical' ? 'opacity-50' : ''}`}>
                  Single Template
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="hierarchical"
                  checked={templateMode === 'hierarchical'}
                  onChange={(e) => setTemplateMode(e.target.value as 'single' | 'hierarchical')}
                  className="mr-2"
                  disabled={template && template.type === 'hierarchical'}
                />
                <span className={`text-gray-700 ${template && template.type === 'hierarchical' ? 'opacity-50' : ''}`}>
                  Hierarchical Template (Epic → Features → Stories)
                </span>
              </label>
            </div>
            {template && template.type === 'hierarchical' && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                  Template type cannot be changed for hierarchical templates
                </p>
                <p className="text-sm text-purple-600 bg-purple-50 p-2 rounded">
                  ✏️ <strong>Edit Mode:</strong> You can modify template name, description, category, and all epics, features, and stories below.
                </p>
              </div>
            )}
          </div>

          {templateMode === 'single' ? (
            // Single Template Form (existing)
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter template name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter template description"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {templateTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`grid gap-4 ${formData.type === 'epic' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    value={formData.estimatedHours}
                    onChange={(e) => handleInputChange('estimatedHours', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                </div>

                {/* Hide Story Points for Epic and Feature */}
                {formData.type === 'story' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Story Points
                    </label>
                    <input
                      type="number"
                      value={formData.storyPoints}
                      onChange={(e) => handleInputChange('storyPoints', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {priorities.map(priority => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* Skills and Requirements */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Skills & Requirements</h3>
              
              {/* Required Skills - Only show for story type */}
              {formData.type === 'story' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Required Skills
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.requiredSkills.map(skillName => (
                      <span
                        key={skillName}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center"
                      >
                        {skillName}
                        <button
                          type="button"
                          onClick={() => removeSkill(skillName)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="relative skills-dropdown">
                    <button
                      type="button"
                      onClick={() => setIsSkillsDropdownOpen(!isSkillsDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between"
                    >
                      <span className="text-gray-500">Select Skills</span>
                      <svg className={`w-4 h-4 transition-transform ${isSkillsDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isSkillsDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {skills.map(skill => {
                          const isSelected = formData.requiredSkills.includes(skill.name);
                          return (
                            <button
                              key={skill.id}
                              type="button"
                              onClick={() => toggleSkill(skill.id)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-medium text-gray-900">{skill.name}</div>
                                <div className="text-sm text-gray-500">{skill.category}</div>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-blue-600" />
                              )}
                            </button>
                          );
                        })}
                        {skills.length === 0 && (
                          <div className="px-3 py-2 text-gray-500 text-sm">No skills available</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Acceptance Criteria (only for stories) */}
              {formData.type === 'story' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Acceptance Criteria
                  </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newCriteria}
                    onChange={(e) => setNewCriteria(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add acceptance criteria"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddArrayItem('acceptanceCriteria', newCriteria);
                        setNewCriteria('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleAddArrayItem('acceptanceCriteria', newCriteria);
                      setNewCriteria('');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.acceptanceCriteria.map((criteria, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-700">{criteria}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveArrayItem('acceptanceCriteria', index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Definition of Done */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Definition of Done
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newDefinition}
                    onChange={(e) => setNewDefinition(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add definition of done"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddArrayItem('definitionOfDone', newDefinition);
                        setNewDefinition('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleAddArrayItem('definitionOfDone', newDefinition);
                      setNewDefinition('');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.definitionOfDone.map((definition, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-700">{definition}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveArrayItem('definitionOfDone', index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add a tag"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddArrayItem('tags', newTag);
                        setNewTag('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleAddArrayItem('tags', newTag);
                      setNewTag('');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveArrayItem('tags', index)}
                        className="ml-2 text-gray-600 hover:text-gray-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          ) : (
            // Hierarchical Template Form
            <div className="space-y-6">
              {template && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">📝 Edit Template</h3>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p><strong>✅ You can edit:</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Template name, description, and category</li>
                      <li>All epics, features, and stories (add/edit/delete)</li>
                      <li>Individual item details (priority, story points, skills, etc.)</li>
                    </ul>
                  <p><strong>🔒 Cannot change:</strong> Template type (Hierarchical)</p>
                  <div className="mt-2 p-2 bg-white rounded border">
                    <p className="text-xs text-gray-600"><strong>Debug Info:</strong></p>
                    <p className="text-xs text-gray-600">Expanded Epics: {Array.from(expandedEpics).join(', ') || 'None'}</p>
                    <p className="text-xs text-gray-600">Expanded Features: {Array.from(expandedFeatures).join(', ') || 'None'}</p>
                  </div>
                </div>
              </div>
            )}
              
              {/* Template Basic Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={hierarchicalData.templateName}
                      onChange={(e) => setHierarchicalData(prev => ({ ...prev, templateName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter template name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={hierarchicalData.category}
                      onChange={(e) => setHierarchicalData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Description *
                  </label>
                  <textarea
                    value={hierarchicalData.templateDescription}
                    onChange={(e) => setHierarchicalData(prev => ({ ...prev, templateDescription: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter template description"
                    rows={3}
                    required
                  />
                </div>
              </div>

              {/* Epics Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">Epics</h3>
                    {template && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          All Expanded for Editing
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {hierarchicalData.epics.length} Epics, {hierarchicalData.epics.reduce((sum, epic) => sum + epic.features.length, 0)} Features, {hierarchicalData.epics.reduce((sum, epic) => sum + epic.features.reduce((fSum, feature) => fSum + feature.stories.length, 0), 0)} Stories
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={addEpic}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Epic
                  </button>
                </div>

                {hierarchicalData.epics.map((epic, epicIndex) => (
                  <div key={epic.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        type="button"
                        onClick={() => toggleEpicExpansion(epic.id)}
                        className="flex items-center text-gray-700 hover:text-gray-900"
                      >
                        {expandedEpics.has(epic.id) ? (
                          <ChevronDown className="w-4 h-4 mr-2" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mr-2" />
                        )}
                        <span className="font-medium">Epic {epicIndex + 1}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded ml-2">
                          {epic.features.length} features, {epic.features.reduce((sum, f) => sum + f.stories.length, 0)} stories
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEpic(epic.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>

                    {expandedEpics.has(epic.id) && (
                      <div className="space-y-4">
                        {/* Epic Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Epic Name *
                            </label>
                            <input
                              type="text"
                              value={epic.name}
                              onChange={(e) => updateEpic(epic.id, 'name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Enter epic name"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Priority
                            </label>
                            <select
                              value={epic.priority}
                              onChange={(e) => updateEpic(epic.id, 'priority', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              {priorities.map(priority => (
                                <option key={priority.value} value={priority.value}>
                                  {priority.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Epic Description *
                          </label>
                          <textarea
                            value={epic.description}
                            onChange={(e) => updateEpic(epic.id, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter epic description"
                            rows={2}
                            required
                          />
                        </div>

                        {/* Features Section */}
                        <div className="ml-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-md font-semibold text-gray-800">Features</h4>
                            <button
                              type="button"
                              onClick={() => addFeature(epic.id)}
                              className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Feature
                            </button>
                          </div>

                          {epic.features.map((feature, featureIndex) => (
                            <div key={feature.id} className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                              <div className="flex items-center justify-between mb-3">
                                <button
                                  type="button"
                                  onClick={() => toggleFeatureExpansion(feature.id)}
                                  className="flex items-center text-blue-700 hover:text-blue-900"
                                >
                                  {expandedFeatures.has(feature.id) ? (
                                    <ChevronDown className="w-3 h-3 mr-1" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 mr-1" />
                                  )}
                                  <span className="font-medium text-sm">Feature {featureIndex + 1}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeFeature(epic.id, feature.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                              </div>

                              {expandedFeatures.has(feature.id) && (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Feature Name *
                                      </label>
                                      <input
                                        type="text"
                                        value={feature.name}
                                        onChange={(e) => updateFeature(epic.id, feature.id, 'name', e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        placeholder="Enter feature name"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Priority
                                      </label>
                                      <select
                                        value={feature.priority}
                                        onChange={(e) => updateFeature(epic.id, feature.id, 'priority', e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                      >
                                        {priorities.map(priority => (
                                          <option key={priority.value} value={priority.value}>
                                            {priority.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Feature Description *
                                    </label>
                                    <textarea
                                      value={feature.description}
                                      onChange={(e) => updateFeature(epic.id, feature.id, 'description', e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                      placeholder="Enter feature description"
                                      rows={2}
                                      required
                                    />
                                  </div>

                                  {/* Stories Section */}
                                  <div className="ml-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-sm font-semibold text-gray-700">Stories</h5>
                                      <button
                                        type="button"
                                        onClick={() => addStory(epic.id, feature.id)}
                                        className="flex items-center px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                                      >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Add Story
                                      </button>
                                    </div>

                                    {feature.stories.map((story, storyIndex) => (
                                      <div key={story.id} className="border border-green-200 rounded p-2 bg-green-50">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-medium text-green-800">Story {storyIndex + 1}</span>
                                          <button
                                            type="button"
                                            onClick={() => removeStory(epic.id, feature.id, story.id)}
                                            className="text-red-600 hover:text-red-800"
                                          >
                                            <Minus className="w-3 h-3" />
                                          </button>
                                        </div>
                                        <div className="space-y-2">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Story Name *
                                              </label>
                                              <input
                                                type="text"
                                                value={story.name}
                                                onChange={(e) => updateStory(epic.id, feature.id, story.id, 'name', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                                                placeholder="Enter story name"
                                                required
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Story Points
                                              </label>
                                              <input
                                                type="number"
                                                value={story.storyPoints}
                                                onChange={(e) => updateStory(epic.id, feature.id, story.id, 'storyPoints', parseInt(e.target.value) || 1)}
                                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                                                min="1"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              Story Description *
                                            </label>
                                            <textarea
                                              value={story.description}
                                              onChange={(e) => updateStory(epic.id, feature.id, story.id, 'description', e.target.value)}
                                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                                              placeholder="Enter story description"
                                              rows={2}
                                              required
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {template ? 'Update Template' : 'Create Template'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTemplateModal;
