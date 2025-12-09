import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Users, FileText, Check, Edit2 } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';

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
  children?: BacklogItem[];
}

interface FeatureManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: BacklogItem;
  onUpdateFeature: (updatedFeature: BacklogItem) => void;
  onAddStory: (story: Omit<BacklogItem, 'id' | 'status'>) => void;
  onRemoveStory: (storyId: string) => void;
  onEditFeature?: (feature: BacklogItem) => void;
  onEditStory?: (story: BacklogItem) => void;
  assignedResources?: any[];
}

export default function FeatureManagementModal({ 
  isOpen, 
  onClose, 
  feature, 
  onUpdateFeature: _onUpdateFeature, 
  onAddStory, 
  onRemoveStory,
  onEditFeature,
  onEditStory,
  assignedResources = []
}: FeatureManagementModalProps) {
  const { showSuccess } = useToast();
  const [showAddStoryForm, setShowAddStoryForm] = useState(false);
  const [newStory, setNewStory] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    storyPoints: 3,
    assigneeId: '',
    tags: [] as string[],
    acceptanceCriteria: [''] as string[],
    requiredSkills: [] as string[],
  });
  const [newTag, setNewTag] = useState('');
  const [isSkillsDropdownOpen, setIsSkillsDropdownOpen] = useState(false);

  const [skills, setSkills] = useState<any[]>([]);

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

  if (!isOpen) return null;

  const stories = feature.children || [];

  const handleAddStory = (e: React.FormEvent) => {
    e.preventDefault();
    
    const story = {
      ...newStory,
      type: 'story' as const,
      parentId: feature.id,
      acceptanceCriteria: newStory.acceptanceCriteria.filter(criteria => criteria.trim() !== ''),
      requiredSkills: newStory.requiredSkills
    };

    onAddStory(story);
    
    // Show success toast
    showSuccess('Story created successfully!');
    
    // Reset form
    setNewStory({
      title: '',
      description: '',
      priority: 'medium',
      storyPoints: 3,
      assigneeId: '',
      tags: [],
      acceptanceCriteria: [''],
      requiredSkills: [],
    });
    setShowAddStoryForm(false);
    
    // Close the modal after successful creation
    onClose();
  };

  const addTag = () => {
    if (newTag.trim() && !newStory.tags.includes(newTag.trim())) {
      setNewStory(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewStory(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const toggleSkill = (skillId: string) => {
    setNewStory(prev => {
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
    setNewStory(prev => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter(name => name !== skillName)
    }));
  };

  const addAcceptanceCriteria = () => {
    setNewStory(prev => ({
      ...prev,
      acceptanceCriteria: [...prev.acceptanceCriteria, '']
    }));
  };

  const updateAcceptanceCriteria = (index: number, value: string) => {
    setNewStory(prev => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.map((criteria, i) => 
        i === index ? value : criteria
      )
    }));
  };

  const removeAcceptanceCriteria = (index: number) => {
    setNewStory(prev => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.filter((_, i) => i !== index)
    }));
  };

  const handleEditFeature = (feature: BacklogItem) => {
    if (onEditFeature) {
      onEditFeature(feature);
    }
  };

  const handleEditStory = (story: BacklogItem) => {
    if (onEditStory) {
      onEditStory(story);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-2 rounded-lg mr-3 border-2 bg-blue-50 text-blue-700 border-blue-500">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Manage Feature: {feature.title}</h2>
              <p className="text-gray-600">Add, remove, and organize user stories within this feature</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left Panel - Feature Details & Stories List */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Feature Summary */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-blue-900">Feature Overview</h3>
                <button
                  onClick={() => handleEditFeature(feature)}
                  className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                  title="Edit feature"
                >
                  {/* <Edit2 className="w-4 h-4" /> */}
                </button>
              </div>
              {feature.parentName && (
                <div className="mb-2">
                  <span className="text-blue-700 text-sm font-medium">Parent Epic: </span>
                  <span className="text-blue-800 text-sm">{feature.parentName}</span>
                </div>
              )}
              <p className="text-blue-800 text-sm mb-3">{feature.description}</p>
              <div className="flex items-center space-x-4 text-sm">
                <span className={`px-2 py-1 rounded-full border ${getPriorityColor(feature.priority)}`}>
                  {feature.priority} priority
                </span>
                <span className={`px-2 py-1 rounded-full ${getStatusColor(feature.status)}`}>
                  {feature.status.replace('_', ' ')}
                </span>
                <span className="text-blue-700">{feature.storyPoints} story points</span>
                <span className="text-blue-700">{stories.length} user stories</span>
              </div>
            </div>

            {/* User Stories List */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">User Stories ({stories.length})</h3>
                <button
                  onClick={() => setShowAddStoryForm(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center text-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add User Story
                </button>
              </div>

              <div className="space-y-3">
                {stories.map(story => (
                  <div key={story.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center flex-1">
                        <div className="p-2 rounded-lg mr-3 bg-green-50 text-green-700 border border-green-200">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{story.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{story.description}</p>
                          <div className="flex items-center space-x-3 mt-2">
                            <span className={`px-2 py-1 rounded-full text-xs border ${getPriorityColor(story.priority)}`}>
                              {story.priority}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(story.status)}`}>
                              {story.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-gray-500">{story.storyPoints} pts</span>
                            {story.assigneeId && (
                              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                Assigned
                              </span>
                            )}
                          </div>
                          {Array.isArray(story.tags) && story.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {story.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {Array.isArray(story.acceptanceCriteria) && story.acceptanceCriteria.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">Acceptance Criteria:</p>
                              <ul className="text-xs text-gray-600 space-y-1">
                                {story.acceptanceCriteria.slice(0, 2).map((criteria, index) => (
                                  <li key={index} className="flex items-start">
                                    <span className="text-green-500 mr-1">•</span>
                                    {criteria}
                                  </li>
                                ))}
                                {story.acceptanceCriteria.length > 2 && (
                                  <li className="text-gray-500">+{story.acceptanceCriteria.length - 2} more criteria</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 ml-4">
                        <button
                          onClick={() => handleEditStory(story)}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit story"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRemoveStory(story.id)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete story"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {stories.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-lg font-medium text-gray-900 mb-2">No user stories yet</p>
                    <p>Add user stories to define the specific requirements for this feature</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Add Story Form */}
          {showAddStoryForm && (
            <div className="w-1/2 border-l border-gray-200 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Add New User Story</h3>
                <button
                  onClick={() => setShowAddStoryForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddStory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Story Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStory.title}
                    onChange={(e) => setNewStory(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="As a [user], I want [goal] so that [benefit]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={newStory.description}
                    onChange={(e) => setNewStory(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe the user story in detail"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority *
                    </label>
                    <select
                      value={newStory.priority}
                      onChange={(e) => setNewStory(prev => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Story Points *
                    </label>
                    <select
                      value={newStory.storyPoints}
                      onChange={(e) => setNewStory(prev => ({ ...prev, storyPoints: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {[1, 2, 3, 5, 8, 13].map(points => (
                        <option key={points} value={points}>{points} points</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assignee
                  </label>
                  <select
                    value={newStory.assigneeId}
                    onChange={(e) => setNewStory(prev => ({ ...prev, assigneeId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {assignedResources.map(resource => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name} - {resource.project_role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newStory.tags.map(tag => (
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
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add tag"
                    />
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
                    {newStory.requiredSkills.map(skillName => (
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
                          const isSelected = newStory.requiredSkills.includes(skill.name);
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
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Acceptance Criteria
                    </label>
                    <button
                      type="button"
                      onClick={addAcceptanceCriteria}
                      className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {newStory.acceptanceCriteria.map((criteria, index) => (
                      <div key={index} className="flex gap-2">
                        <textarea
                          value={criteria}
                          onChange={(e) => updateAcceptanceCriteria(index, e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder={`Acceptance criteria ${index + 1}`}
                          rows={2}
                        />
                        {newStory.acceptanceCriteria.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAcceptanceCriteria(index)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 text-sm mb-1">User Story Guidelines</h4>
                  <ul className="text-xs text-green-800 space-y-1">
                    <li>• Follow "As a [user], I want [goal] so that [benefit]" format</li>
                    <li>• Should be completable within one sprint</li>
                    <li>• Include clear acceptance criteria</li>
                    <li>• Focus on user value and outcomes</li>
                  </ul>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddStoryForm(false)}
                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add User Story
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}