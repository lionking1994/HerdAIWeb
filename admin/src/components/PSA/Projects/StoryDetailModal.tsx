import { useState, useEffect } from 'react';
import { X, Save, User, Tag, Plus, FileText, Clock, Check } from 'lucide-react';

interface BacklogItem {
  id: string;
  title: string;
  description: string;
  type: 'epic' | 'feature' | 'story';
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints?: number; // Made optional for epics
  assigneeId?: string;
  tags: string[];
  acceptanceCriteria: string[];
  requiredSkills?: string[]; // Array of skill names
  parentId?: string;
  parentName?: string; // Name of the parent item (epic name for features, feature name for stories)
  parentEpicName?: string; // Name of the parent epic (for stories)
  children?: BacklogItem[];
}


interface StoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: BacklogItem;
  onUpdateStory: (updatedStory: BacklogItem) => void;
  assignedResources?: any[];
  companyId?: string; // Add companyId prop
  projectId?: string; // Add projectId prop
}

export default function StoryDetailModal({ isOpen, onClose, story, onUpdateStory, assignedResources = [], companyId, projectId }: StoryDetailModalProps) {
  const [formData, setFormData] = useState({
    title: story.title || '',
    description: story.description || '',
    status: story.status || 'backlog',
    priority: story.priority || 'medium',
    storyPoints: story.storyPoints || 0,
    assigneeId: story.assigneeId || '',
    sprintId: story.sprintId || '',
    tags: Array.isArray(story.tags) ? [...story.tags] : [],  // ✅ FIXED
    acceptanceCriteria: Array.isArray(story.acceptanceCriteria) ? [...story.acceptanceCriteria] : [],  // ✅ FIXED
    requiredSkills: Array.isArray(story.requiredSkills) ? [...story.requiredSkills] : [],  // ✅ FIXED
  });

  const [newTag, setNewTag] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSkillsDropdownOpen, setIsSkillsDropdownOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const [skills, setSkills] = useState<any[]>([]);
  const [availableSprints, setAvailableSprints] = useState<any[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(false);

  // Update form data when story changes
  useEffect(() => {
    if (story) {
      console.log('📝 Story data received in modal:', {
        title: story.title,
        acceptanceCriteria: story.acceptanceCriteria,
        acceptanceCriteriaType: typeof story.acceptanceCriteria,
        acceptanceCriteriaLength: Array.isArray(story.acceptanceCriteria) ? story.acceptanceCriteria.length : 'not array'
      });
      
      setFormData({
        title: story.title || '',
        description: story.description || '',
        status: story.status || 'backlog',
        priority: story.priority || 'medium',
        storyPoints: story.storyPoints || 0,
        assigneeId: story.assigneeId || '',
        sprintId: story.sprintId || '',
        tags: Array.isArray(story.tags) ? [...story.tags] : [],
        acceptanceCriteria: Array.isArray(story.acceptanceCriteria) ? [...story.acceptanceCriteria] : [],
        requiredSkills: Array.isArray(story.requiredSkills) ? [...story.requiredSkills] : [],
      });
      
      console.log('📝 Form data set:', {
        acceptanceCriteria: Array.isArray(story.acceptanceCriteria) ? [...story.acceptanceCriteria] : [],
        acceptanceCriteriaLength: Array.isArray(story.acceptanceCriteria) ? story.acceptanceCriteria.length : 0
      });
    }
  }, [story]);

  // Fetch skills from API
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/skills`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSkills(data.skills);
          }
        }
      } catch (error) {
        console.error('Error fetching skills:', error);
      }
    };

    if (isOpen) {
      fetchSkills();
      fetchSprints();
    }
  }, [isOpen, projectId]);

  // Fetch available sprints
  const fetchSprints = async () => {
    if (!projectId) return;
    
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

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
      setHasChanges(true);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
    setHasChanges(true);
  };

  const addAcceptanceCriteria = () => {
    setFormData(prev => ({
      ...prev,
      acceptanceCriteria: [...prev.acceptanceCriteria, '']
    }));
    setHasChanges(true);
  };

  const updateAcceptanceCriteria = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.map((criteria, i) => 
        i === index ? value : criteria
      )
    }));
    setHasChanges(true);
  };

  const removeAcceptanceCriteria = (index: number) => {
    setFormData(prev => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
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
    setHasChanges(true);
  };

  const removeSkill = (skillName: string) => {
    setFormData(prev => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter(name => name !== skillName)
    }));
    setHasChanges(true);
  };

  // AI Generation function
  const generateAcceptanceCriteria = async () => {
    if (!companyId) {
      alert('Company ID is required for AI generation');
      return;
    }

    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in the story title and description before generating acceptance criteria');
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
          requiredSkills: formData.requiredSkills,
          companyId: companyId,
          storyPriority: formData.priority
        })
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
          setHasChanges(true);
          
          console.log('✅ AI-generated acceptance criteria:', data.summary);
        } else {
          alert('Failed to generate acceptance criteria: ' + (data.message || 'Unknown error'));
        }
      } else {
        const errorData = await response.json();
        alert('Error generating acceptance criteria: ' + (errorData.message || 'Server error'));
      }
    } catch (error) {
      console.error('Error generating acceptance criteria:', error);
      alert('Error generating acceptance criteria. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSave = () => {
    const updatedStory: BacklogItem = {
      ...story,
      title: formData.title,
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      storyPoints: formData.storyPoints,
      assigneeId: formData.assigneeId || undefined,
      sprintId: formData.sprintId || null,
      tags: formData.tags,
      acceptanceCriteria: formData.acceptanceCriteria.filter(criteria => criteria.trim() !== ''),
      requiredSkills: formData.requiredSkills
    };

    onUpdateStory(updatedStory);
    setHasChanges(false);
    onClose();
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-red-500 bg-red-50 text-red-700';
      case 'high': return 'border-orange-500 bg-orange-50 text-orange-700';
      case 'medium': return 'border-yellow-500 bg-yellow-50 text-yellow-700';
      case 'low': return 'border-green-500 bg-green-50 text-green-700';
      default: return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'review': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const assignedResource = assignedResources.find(r => r.id === formData.assigneeId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center">
            <div className="p-2 rounded-lg mr-3 border-2 bg-green-50 text-green-700 border-green-500">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">User Story Details</h2>
              <p className="text-gray-600">View and edit user story information</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left Panel - Story Details */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Story Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Story Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="As a [user], I want [goal] so that [benefit]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Detailed description of the user story requirements"
                />
              </div>

              {/* Status and Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>

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
                          className={`p-2 border-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isSelected 
                              ? getPriorityColor(priority) + ' shadow-md' 
                              : 'border-gray-200 hover:border-gray-300 bg-white text-gray-600'
                          }`}
                        >
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Story Points, Assignee, and Sprint */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Story Points *
                  </label>
                  <select
                    value={formData.storyPoints}
                    onChange={(e) => handleInputChange('storyPoints', parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {[1, 2, 3, 5, 8, 13].map(points => (
                      <option key={points} value={points}>{points} points</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assignee
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <select
                      value={formData.assigneeId}
                      onChange={(e) => handleInputChange('assigneeId', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Unassigned</option>
                      {assignedResources.map(resource => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name} ({resource.allocation}%) - {resource.project_role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

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
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add tag (press Enter)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Required Skills */}
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

              {/* Current Assignment Info */}
              {assignedResource && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Current Assignment</h4>
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-blue-900">{assignedResource.name}</p>
                      <p className="text-sm text-blue-800">{assignedResource.project_role}</p>
                      <p className="text-sm text-blue-700">
                        {assignedResource.allocation}% allocation
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Acceptance Criteria */}
          <div className="w-1/2 border-l border-gray-200 p-6 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Acceptance Criteria</h3>
                <div className="flex items-center gap-2">
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
                    className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center"
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
                  formData.acceptanceCriteria.map((criteria, index) => (
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
                      {formData.acceptanceCriteria.length > 1 && (
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

              {formData.acceptanceCriteria.length === 0 && !isGeneratingAI && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No acceptance criteria defined</p>
                  <button
                    type="button"
                    onClick={addAcceptanceCriteria}
                    className="text-green-600 hover:text-green-700 text-sm font-medium mt-2"
                  >
                    Add the first criteria
                  </button>
                </div>
              )}

              {/* Story Guidelines */}
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">User Story Best Practices</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Follow "As a [user], I want [goal] so that [benefit]" format</li>
                  <li>• Should be completable within one sprint</li>
                  <li>• Include clear, testable acceptance criteria</li>
                  <li>• Focus on user value and outcomes</li>
                  <li>• Keep stories independent and negotiable</li>
                </ul>
              </div>

              {/* Story Metadata */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3">Story Information</h4>
                <div className="space-y-2 text-sm">
                  {/* <div className="flex justify-between">
                    <span className="text-gray-600">Story ID:</span>
                    <span className="font-medium text-gray-900">{story.id}</span>
                  </div> */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200`}>
                      User Story
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(formData.status)}`}>
                      {formData.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  {story.parentName && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Parent Feature:</span>
                      <span className="font-medium text-gray-900">{story.parentName}</span>
                    </div>
                  )}
                  {story.parentEpicName && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Parent Epic:</span>
                      <span className="font-medium text-gray-900">{story.parentEpicName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="text-sm text-gray-600">
            {hasChanges && (
              <span className="text-orange-600 font-medium">
                <Clock className="w-4 h-4 inline mr-1" />
                You have unsaved changes
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {hasChanges ? 'Cancel' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
                hasChanges
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}