import React, { useState, useEffect } from 'react';
import { X, Plus, Star, Users, FileText, Tag } from 'lucide-react';

interface BacklogItem {
  id: string;
  title: string;
  description: string;
  type: 'epic' | 'feature' | 'story';
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints?: number; // Made optional for epics
  assigneeId?: string;
  requiredSkills?: string[]; // Required skills for stories
  tags: string[];
  acceptanceCriteria: string[];
  parentId?: string; // For linking features to epics, stories to features
  businessValue?: number; // Business value for epics
  children?: BacklogItem[]; // For hierarchical display
}

interface AddBacklogItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (item: Omit<BacklogItem, 'id' | 'status'>) => void | Promise<void>;
  projectId: string;
  parentItem?: BacklogItem; // Optional parent for creating child items
  assignedResources?: any[]; // Project's assigned resources
  editItem?: BacklogItem; // Item to edit (if provided, modal will be in edit mode)
  onUpdate?: (item: BacklogItem) => void | Promise<void>; // Update handler for edit mode
  allBacklogItems?: BacklogItem[]; // All backlog items to find parent info
  companyId?: string; // Add companyId prop
}

export default function AddBacklogItemModal({ isOpen, onClose, onSubmit, projectId, parentItem, assignedResources = [], editItem, onUpdate, allBacklogItems = [], companyId }: AddBacklogItemModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: (parentItem?.type === 'epic' ? 'feature' : parentItem?.type === 'feature' ? 'story' : 'story') as 'epic' | 'feature' | 'story',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    storyPoints: 1,
    assigneeId: '',
    sprintId: '',
    status: 'backlog' as 'backlog' | 'in_progress' | 'review' | 'done',
    requiredSkills: [] as string[],
    tags: [] as string[],
    acceptanceCriteria: [''] as string[],
    parentId: parentItem?.id || undefined,
    businessValue: undefined as number | undefined,
  });

  const [newTag, setNewTag] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [availableSprints, setAvailableSprints] = useState<any[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(false);

  // Function to get parent information for display
  const getParentInfo = () => {
    if (!editItem?.parentId) return null;
    
    const parent = allBacklogItems.find(item => item.id === editItem.parentId);
    if (!parent) return null;
    
    // Find grandparent (epic) if parent is a feature
    let grandparent = null;
    if (parent.type === 'feature' && parent.parentId) {
      grandparent = allBacklogItems.find(item => item.id === parent.parentId);
    }
    
    // Alternative approach: Find epic by searching through all items
    // This handles cases where the hierarchy might not be properly linked
    if (!grandparent && parent.type === 'feature') {
      grandparent = allBacklogItems.find(item => 
        item.type === 'epic' && 
        item.children && 
        item.children.some((child: BacklogItem) => child.id === parent.id)
      );
    }
    
    // Final fallback: If still no grandparent found, try to find any epic
    // This is a last resort to show something useful
    if (!grandparent && parent.type === 'feature') {
      const allEpics = allBacklogItems.filter(item => item.type === 'epic');
      if (allEpics.length > 0) {
        grandparent = allEpics[0]; // Show the first epic as fallback
      }
    }
    
    return { parent, grandparent };
  };

  const parentInfo = getParentInfo();

  // Populate form data when editing
  useEffect(() => {
    if (editItem) {
      setFormData({
        title: editItem.title,
        description: editItem.description,
        type: editItem.type,
        priority: editItem.priority,
        storyPoints: editItem.storyPoints || 1,
        assigneeId: editItem.assigneeId || '',
        sprintId: editItem.sprintId || '',
        status: editItem.status || 'backlog',
        requiredSkills: Array.isArray(editItem.requiredSkills) ? editItem.requiredSkills : [],
        tags: Array.isArray(editItem.tags) ? editItem.tags : [],
        acceptanceCriteria: Array.isArray(editItem.acceptanceCriteria) ? editItem.acceptanceCriteria : [''],
        parentId: editItem.parentId,
        businessValue: editItem.businessValue,
      });
    } else {
      // Reset form for new item
      setFormData({
        title: '',
        description: '',
        type: (parentItem?.type === 'epic' ? 'feature' : parentItem?.type === 'feature' ? 'story' : 'story') as 'epic' | 'feature' | 'story',
        priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
        storyPoints: 1,
        assigneeId: '',
        sprintId: '',
        status: 'backlog' as 'backlog' | 'in_progress' | 'review' | 'done',
        requiredSkills: [] as string[],
        tags: [] as string[],
        acceptanceCriteria: [''] as string[],
        parentId: parentItem?.id || undefined,
        businessValue: undefined,
      });
    }
  }, [editItem, parentItem]);

  // Fetch available sprints when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      fetchSprints();
    }
  }, [isOpen, projectId]);

  // Fetch available sprints
  const fetchSprints = async () => {
    try {
      setLoadingSprints(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/sprints/${projectId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableSprints(data.sprints || []);
        }
      }
    } catch (error) {
      console.error('Error fetching sprints:', error);
    } finally {
      setLoadingSprints(false);
    }
  };

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateAcceptanceCriteria = async () => {
    if (!companyId) {
      alert('Company ID is required for AI generation');
      return;
    }

    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please provide both title and description to generate acceptance criteria');
      return;
    }

    setIsGeneratingAI(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/generate-acceptance-criteria`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          storyTitle: formData.title,
          storyDescription: formData.description,
          requiredSkills: formData.requiredSkills || [],
          companyId: companyId,
          storyPriority: formData.priority
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.acceptanceCriteria) {
          // Convert JSON criteria to simple string array
          const criteriaTexts = data.acceptanceCriteria.map((criteria: any) => criteria.criteria);
          
          setFormData(prev => ({
            ...prev,
            acceptanceCriteria: criteriaTexts
          }));
          
          console.log('✅ AI-generated acceptance criteria:', data.summary);
        } else {
          console.error('❌ AI generation failed:', data.message);
          alert('Failed to generate acceptance criteria: ' + (data.message || 'Unknown error'));
        }
      } else {
        const errorData = await response.json();
        console.error('❌ API error:', errorData);
        alert('Failed to generate acceptance criteria: ' + (errorData.message || 'Server error'));
      }
    } catch (error) {
      console.error('❌ Error generating acceptance criteria:', error);
      alert('Failed to generate acceptance criteria. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate business value for epics
    if (formData.type === 'epic' && (!formData.businessValue || formData.businessValue <= 0)) {
      alert('Business value is required for Epic and must be greater than 0');
      return;
    }
    
    if (editItem && onUpdate) {
      // Update mode
      const updatedItem = {
        ...editItem,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        storyPoints: formData.type === 'story' ? formData.storyPoints : undefined,
        assigneeId: formData.type === 'story' ? formData.assigneeId : undefined,
        sprintId: formData.type === 'story' ? (formData.sprintId || null) : undefined,
        status: formData.status,
        requiredSkills: formData.type === 'story' ? formData.requiredSkills : [],
        tags: formData.tags,
        acceptanceCriteria: formData.type === 'story' ? (formData.acceptanceCriteria || []).filter(c => c.trim()) : [],
        ...(formData.type === 'epic' && { businessValue: formData.businessValue }),
      };

      try {
        await onUpdate(updatedItem);
        onClose();
      } catch (error) {
        console.error('Error updating item:', error);
      }
    } else {
      // Create mode
      console.log('Form data before submission:', formData);
       const newItem = {
         title: formData.title,
         description: formData.description,
         type: formData.type,
         priority: formData.priority,
         storyPoints: formData.type === 'story' ? formData.storyPoints : undefined,
         assigneeId: formData.type === 'story' ? formData.assigneeId : undefined,
         status: formData.status,
         requiredSkills: formData.type === 'story' ? formData.requiredSkills : [],
         tags: formData.tags,
         acceptanceCriteria: formData.type === 'story' ? (formData.acceptanceCriteria || []).filter(c => c.trim()) : [],
         ...(formData.type === 'epic' && { businessValue: formData.businessValue }),
       };
      console.log('New item being submitted:', newItem);

      try {
        await onSubmit(newItem);
      setFormData({
        title: '',
        description: '',
        type: 'story',
        priority: 'medium',
        storyPoints: 1,
        assigneeId: '',
        status: 'backlog',
        requiredSkills: [],
        tags: [],
        acceptanceCriteria: [''],
        parentId: parentItem?.id || undefined,
        businessValue: undefined,
      });
        setNewTag('');
        setNewSkill('');
      } catch (error) {
        console.error('Error creating backlog item:', error);
      }
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      handleInputChange('tags', [...formData.tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleInputChange('tags', (formData.tags || []).filter(tag => tag !== tagToRemove));
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.requiredSkills.includes(newSkill.trim())) {
      handleInputChange('requiredSkills', [...formData.requiredSkills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    handleInputChange('requiredSkills', (formData.requiredSkills || []).filter(skill => skill !== skillToRemove));
  };

  const addAcceptanceCriteria = () => {
    handleInputChange('acceptanceCriteria', [...(formData.acceptanceCriteria || []), '']);
  };

  const updateAcceptanceCriteria = (index: number, value: string) => {
    const updated = [...(formData.acceptanceCriteria || [])];
    updated[index] = value;
    handleInputChange('acceptanceCriteria', updated);
  };

  const removeAcceptanceCriteria = (index: number) => {
    const updated = (formData.acceptanceCriteria || []).filter((_, i) => i !== index);
    handleInputChange('acceptanceCriteria', updated);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'epic': return Star;
      case 'feature': return FileText;
      case 'story': return Users;
      default: return Users;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'epic': return 'bg-purple-100 border-purple-300 text-purple-700';
      case 'feature': return 'bg-blue-100 border-blue-300 text-blue-700';
      case 'story': return 'bg-green-100 border-green-300 text-green-700';
      default: return 'bg-gray-100 border-gray-300 text-gray-700';
    }
  };

  const TypeIcon = getTypeIcon(formData.type);

  const storyPointOptions = [1, 2, 3, 5, 8, 13, 21, 34];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg mr-3 border-2 ${getTypeColor(formData.type)}`}>
              <TypeIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editItem ? 'Edit' : 'Add New'} {formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
              </h2>
              <p className="text-sm text-gray-600">
                {editItem ? 'Update the backlog item details' : 'Create a new backlog item for the project'}
              </p>
              {parentInfo && (
                <div className="mt-2 text-xs text-gray-500">
                  <div className="flex items-center space-x-2">
                    <span>Parent:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      parentInfo.parent.type === 'epic' ? 'bg-purple-100 text-purple-800' :
                      parentInfo.parent.type === 'feature' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {parentInfo.parent.type}
                    </span>
                    <span className="font-medium">{parentInfo.parent.title}</span>
                  </div>
                  {parentInfo.grandparent && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span>Epic:</span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        epic
                      </span>
                      <span className="font-medium">{parentInfo.grandparent.title}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Main Form */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-6">
                 {/* Type Selection - Hide tabs based on edit mode */}
                 {!(editItem && (editItem.type === 'feature' || editItem.type === 'story')) && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-3">
                       Item Type *
                     </label>
                     <div className={`grid gap-3 ${editItem && editItem.type === 'epic' ? 'grid-cols-1' : 'grid-cols-3'}`}>
                       {(['epic', 'feature', 'story'] as const)
                         .filter(type => {
                           // When editing epic, only show epic tab
                           if (editItem && editItem.type === 'epic') {
                             return type === 'epic';
                           }
                           // When editing feature or story, hide all tabs (handled by outer condition)
                           // When creating new item, show all tabs
                           return true;
                         })
                         .map((type) => {
                      const Icon = getTypeIcon(type);
                      const isSelected = formData.type === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleInputChange('type', type)}
                          className={`p-4 border-2 rounded-lg transition-all duration-200 ${isSelected
                              ? getTypeColor(type) + ' shadow-md'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                        >
                          <Icon className="w-6 h-6 mx-auto mb-2" />
                          <div className="text-sm font-medium capitalize">{type}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Enter ${formData.type} title`}
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Describe the ${formData.type} requirements and objectives`}
                  />
                </div>

                {/* Priority, Business Value and Story Points */}
                <div className={`grid gap-4 ${formData.type === 'story' ? 'grid-cols-1 md:grid-cols-2' : formData.type === 'epic' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['low', 'medium', 'high', 'critical'] as const).map((priority) => {
                        const isSelected = formData.priority === priority;
                        return (
                          <button
                            key={priority}
                            type="button"
                            onClick={() => handleInputChange('priority', priority)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-yellow-100 border-2 border-yellow-300 text-yellow-800'
                                : 'bg-gray-100 border-2 border-gray-200 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {priority.charAt(0).toUpperCase() + priority.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Business Value for Epic */}
                  {formData.type === 'epic' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Value *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.businessValue || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          handleInputChange('businessValue', isNaN(value) ? undefined : value);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter business value (minimum 1)"
                        required
                      />
                    </div>
                  )}

                  {/* Hide Story Points for Epic and Feature */}
                  {formData.type === 'story' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Story Points *
                      </label>
                      <select
                        value={formData.storyPoints}
                        onChange={(e) => handleInputChange('storyPoints', parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {storyPointOptions.map(points => (
                          <option key={points} value={points}>{points} points</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Hide Assignee for Epic and Feature */}
                {formData.type === 'story' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assignee
                    </label>
                    <select
                      value={formData.assigneeId}
                      onChange={(e) => handleInputChange('assigneeId', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Unassigned</option>
                      {assignedResources.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name} ({resource.allocation}%) - {resource.project_role}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                 {/* Sprint Assignment - Only for Stories when editing */}
                 {formData.type === 'story' && editItem && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Sprint Assignment
                     </label>
                     <div className="relative">
                       <select
                         value={formData.sprintId}
                         onChange={(e) => handleInputChange('sprintId', e.target.value)}
                         className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         disabled={loadingSprints}
                       >
                         <option value="">No Sprint</option>
                         {availableSprints.map(sprint => (
                           <option key={sprint.id} value={sprint.id}>
                             {sprint.name} ({new Date(sprint.start_date).toLocaleDateString()} - {new Date(sprint.end_date).toLocaleDateString()})
                           </option>
                         ))}
                       </select>
                       {loadingSprints && (
                         <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                         </div>
                       )}
                     </div>
                   </div>
                 )}

                {/* Status - Show for all types */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value as 'backlog' | 'in_progress' | 'review' | 'done')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                {/* Required Skills - Only for stories */}
                {formData.type === 'story' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Required Skills
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addSkill();
                          }
                        }}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Add a skill"
                      />
                      <button
                        type="button"
                        onClick={addSkill}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </button>
                    </div>
                    {(formData.requiredSkills || []).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {(formData.requiredSkills || []).map((skill, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                          >
                            {skill}
                            <button
                              type="button"
                              onClick={() => removeSkill(skill)}
                              className="ml-2 text-green-600 hover:text-green-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add a tag"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <Tag className="w-4 h-4 mr-1" />
                      Add
                    </button>
                  </div>
                  {(formData.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(formData.tags || []).map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Acceptance Criteria (only for stories) */}
            {formData.type === 'story' && (
              <div className="w-1/2 border-l border-gray-200 p-6 overflow-y-auto">
                <div className="space-y-6">
                  {/* Story Information Section */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Story Information</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Type:</span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          User Story
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Current Status:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          formData.status === 'done' ? 'bg-green-100 text-green-800' :
                          formData.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          formData.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {formData.status.toUpperCase()}
                        </span>
                      </div>
                      {parentInfo && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Parent Feature:</span>
                            <span className="text-sm font-medium text-gray-900">{parentInfo.parent.title}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Parent Epic:</span>
                            <span className="text-sm font-medium text-gray-900">
                              {parentInfo.grandparent ? parentInfo.grandparent.title : 'Not found'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Acceptance Criteria</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={generateAcceptanceCriteria}
                        disabled={isGeneratingAI || !formData.title.trim() || !formData.description.trim()}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isGeneratingAI || !formData.title.trim() || !formData.description.trim()
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200 hover:scale-105'
                        }`}
                        title="Generate acceptance criteria using AI"
                      >
                        {isGeneratingAI ? (
                          <>
                            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <img
                              src="/ai_icon.png"
                              alt="AI Prompt"
                              className="w-8 h-8 object-contain"
                            />
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={addAcceptanceCriteria}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Criteria
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {isGeneratingAI ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="flex items-center gap-3 text-purple-600">
                          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm font-medium">AI is generating acceptance criteria...</span>
                        </div>
                      </div>
                    ) : (
                      (formData.acceptanceCriteria || []).map((criteria, index) => (
                        <div key={index} className="flex gap-2">
                          <div className="flex-1">
                            <textarea
                              value={criteria}
                              onChange={(e) => updateAcceptanceCriteria(index, e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              placeholder={`Acceptance criteria ${index + 1}`}
                              rows={2}
                            />
                          </div>
                          {(formData.acceptanceCriteria || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAcceptanceCriteria(index)}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Guidelines Section - Always visible */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {formData.type === 'epic' && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-medium text-purple-900 mb-2">Epic Guidelines</h4>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• Should contain multiple features</li>
                  <li>• Typically spans multiple sprints</li>
                  <li>• Represents a significant business capability</li>
                  <li>• Should have clear business value</li>
                </ul>
              </div>
            )}

            {formData.type === 'feature' && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Feature Guidelines</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Should be deliverable within 1-2 sprints</li>
                  <li>• Provides specific functionality to users</li>
                  <li>• Can be broken down into user stories</li>
                  <li>• Focuses on functionality rather than detailed criteria</li>
                </ul>
              </div>
            )}

            {formData.type === 'story' && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">User Story Guidelines</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Should follow "As a... I want... So that..." format</li>
                  <li>• Completable within one sprint</li>
                  <li>• Has clear definition of done</li>
                  <li>• Provides value to end users</li>
                </ul>
              </div>
            )}
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="text-sm text-gray-600">
              {formData.type === 'epic' 
                ? `Creating ${formData.type}` 
                : formData.type === 'feature'
                ? `Creating ${formData.type}`
                : `Creating ${formData.type} with ${formData.storyPoints} story points`
              }
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                {editItem ? 'Update' : 'Create'} {formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}