import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Star, Users, Edit2 } from 'lucide-react';

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
  parentId?: string;
  parentName?: string; // Name of the parent item (epic name for features, feature name for stories)
  children?: BacklogItem[];
  businessValue?: number; // Business value for epics
}

interface EpicManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  epic: BacklogItem;
  onUpdateEpic: (updatedEpic: BacklogItem) => void;
  onAddFeature: (feature: Omit<BacklogItem, 'id' | 'status'>) => void;
  onRemoveFeature: (featureId: string) => void;
  onEditEpic?: (epic: BacklogItem) => void;
  onEditFeature?: (feature: BacklogItem) => void;
  project_id?: string;
  assignedResources?: any[];
  onRefresh?: () => void;
  editMode?: 'epic' | 'feature' | null;
  editingItem?: BacklogItem | null;
  setEditMode?: (mode: 'epic' | 'feature' | null) => void;
  setEditingItem?: (item: BacklogItem | null) => void;
}

export default function EpicManagementModal({
  isOpen,
  onClose,
  epic,
  onUpdateEpic: _onUpdateEpic,
  onAddFeature,
  onRemoveFeature,
  onEditEpic,
  onEditFeature,
  project_id,
  assignedResources = [],
  onRefresh,
  editMode,
  editingItem,
  setEditMode,
  setEditingItem
}: EpicManagementModalProps) {
  // const { showSuccess } = useToast();
  const [showAddFeatureForm, setShowAddFeatureForm] = useState(false);
  const [isCreatingFeature, setIsCreatingFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    storyPoints: 5,
    tags: [] as string[],
    acceptanceCriteria: [''] as string[],
    businessValue: 1,
  });
  const [newTag, setNewTag] = useState('');

  // Populate form when editing
  useEffect(() => {
    if ((editMode === 'feature' || editMode === 'epic') && editingItem) {
      setNewFeature({
        title: editingItem.title,
        description: editingItem.description,
        priority: editingItem.priority,
        storyPoints: editingItem.storyPoints || 5,
        tags: editingItem.tags || [],
        acceptanceCriteria: editingItem.acceptanceCriteria || [''],
        businessValue: editingItem.businessValue || 1,
      });
    } else {
      // Reset form for new feature
      setNewFeature({
        title: '',
        description: '',
        priority: 'medium',
        storyPoints: 5,
        tags: [],
        acceptanceCriteria: [''],
        businessValue: 1,
      });
    }
  }, [editMode, editingItem]);

  if (!isOpen) return null;

  const features = epic.children || [];
const handleAddFeature = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsCreatingFeature(true);

  try {
    if (editMode === 'feature' && editingItem) {
      // Update existing feature
      const updatedFeature = {
        ...editingItem,
        title: newFeature.title,
        description: newFeature.description,
        priority: newFeature.priority,
        tags: newFeature.tags,
        // Keep other properties from editingItem
      };
      
      // Call update handler (this should be passed from parent)
      if (onEditFeature) {
        onEditFeature(updatedFeature);
      }
    } else if (editMode === 'epic' && editingItem) {
      // Update existing epic
      const updatedEpic = {
        ...editingItem,
        title: newFeature.title,
        description: newFeature.description,
        priority: newFeature.priority,
        tags: newFeature.tags,
        businessValue: newFeature.businessValue,
        // Keep other properties from editingItem
      };
      
      // Call update handler for epic
      if (onEditEpic) {
        onEditEpic(updatedEpic);
      }
    } else {
      // Add new feature
      const mappedFeature = {
        title: newFeature.title,
        description: newFeature.description,
        type: 'feature' as const,
        priority: newFeature.priority,
        storyPoints: undefined, // Features don't have story points
        tags: newFeature.tags,
        acceptanceCriteria: [], // Features don't have acceptance criteria
        parentId: epic.id
      };
      
      // Let the parent component handle the API call
      await onAddFeature(mappedFeature);
    }
    
    setShowAddFeatureForm(false);
    
    // Reset form
    setNewFeature({
      title: '',
      description: '',
      priority: 'medium',
      storyPoints: 5, // Keep for form state but won't be used
      tags: [],
      acceptanceCriteria: [''], // Keep for form state but won't be used
      businessValue: 1,
    });

    // Epic data will be updated by the parent component
  } catch (error) {
    console.error('Error creating feature:', error);
  } finally {
    setIsCreatingFeature(false);
  }
};

  const addTag = () => {
      if (newTag.trim() && !newFeature.tags.includes(newTag.trim())) {
        setNewFeature(prev => ({
          ...prev,
          tags: [...prev.tags, newTag.trim()]
        }));
        setNewTag('');
      }
    };

    const removeTag = (tagToRemove: string) => {
      setNewFeature(prev => ({
        ...prev,
        tags: prev.tags.filter(tag => tag !== tagToRemove)
      }));
    };

    // Acceptance criteria functions removed - not needed for features

    const handleEditEpic = (epic: BacklogItem) => {
      if (onEditEpic) {
        onEditEpic(epic);
      }
    };

    const handleEditFeature = (feature: BacklogItem) => {
      if (onEditFeature) {
        onEditFeature(feature);
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
              <div className="p-2 rounded-lg mr-3 border-2 bg-purple-50 text-purple-700 border-purple-500">
                <Star className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Manage Epic: {epic.title}</h2>
                                <h2 className="text-2xl font-bold text-gray-900">Manage id: {epic.id}</h2>

                <p className="text-gray-600">Add, remove, and organize features within this epic</p>
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
            {/* Left Panel - Epic Details & Features List */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Epic Summary */}
              <div className="bg-purple-50 rounded-lg p-4 mb-6 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-purple-900">Epic Overview</h3>
                  <button
                    onClick={() => {
                      // Set edit mode and editing item to open the edit form
                      if (setEditMode) setEditMode('epic');
                      if (setEditingItem) setEditingItem(epic);
                      setShowAddFeatureForm(true);
                    }}
                    className="p-1 text-purple-600 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition-colors"
                    title="Edit epic"
                  >
                    {/* <Edit2 className="w-4 h-4" /> */}
                  </button>
                </div>
                <p className="text-purple-800 text-sm mb-3">{epic.description}</p>
                <div className="flex items-center space-x-4 text-sm">
                  <span className={`px-2 py-1 rounded-full border ${getPriorityColor(epic.priority)}`}>
                    {epic.priority} priority
                  </span>
                  <span className={`px-2 py-1 rounded-full ${getStatusColor(epic.status)}`}>
                    {epic.status.replace('_', ' ')}
                  </span>
                  {epic.businessValue && <span className="text-green-600 bg-green-100 px-2 py-1 rounded-full text-xs">{epic.businessValue} BV</span>}
                  {epic.storyPoints && <span className="text-purple-700">{epic.storyPoints} story points</span>}
                  <span className="text-purple-700">{features.length} features</span>
                </div>
              </div>

              {/* Features List */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Features ({features.length})</h3>
                  {editMode !== 'feature' && (
                    <button
                      onClick={() => setShowAddFeatureForm(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Feature
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {features.map(feature => (
                    <div key={feature.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center flex-1">
                          <div className="p-2 rounded-lg mr-3 bg-blue-50 text-blue-700 border border-blue-200">
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{feature.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                            <div className="flex items-center space-x-3 mt-2">
                              <span className={`px-2 py-1 rounded-full text-xs border ${getPriorityColor(feature.priority)}`}>
                                {feature.priority}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(feature.status)}`}>
                                {feature.status.replace('_', ' ')}
                              </span>
                              {feature.storyPoints && <span className="text-xs text-gray-500">{feature.storyPoints} pts</span>}
                              {feature.children && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                  {feature.children.length} stories
                                </span>
                              )}
                            </div>
                            {feature.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {feature.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-4">
                          <button
                            onClick={() => {
                              // Set edit mode and editing item to open the edit form
                              if (setEditMode) setEditMode('feature');
                              if (setEditingItem) setEditingItem(feature);
                              setShowAddFeatureForm(true);
                            }}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit feature"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onRemoveFeature(feature.id)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete feature"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {features.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-lg font-medium text-gray-900 mb-2">No features yet</p>
                      <p>Add features to break down this epic into manageable pieces</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Add/Edit Feature Form */}
            {(showAddFeatureForm || editMode === 'feature' || editMode === 'epic') && (
              <div className="w-1/2 border-l border-gray-200 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editMode === 'feature' ? 'Edit Feature' : editMode === 'epic' ? 'Edit Epic' : 'Add New Feature'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddFeatureForm(false);
                      // Reset edit mode when closing
                      if (editMode === 'feature' || editMode === 'epic') {
                        // This will be handled by parent component
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddFeature} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Feature Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={newFeature.title}
                      onChange={(e) => setNewFeature(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter feature title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={newFeature.description}
                      onChange={(e) => setNewFeature(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe the feature requirements"
                    />
                  </div>

                  <div className={`grid gap-4 ${editMode === 'epic' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority *
                      </label>
                      <select
                        value={newFeature.priority}
                        onChange={(e) => setNewFeature(prev => ({ ...prev, priority: e.target.value as any }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>

                    {/* Business Value for Epic */}
                    {editMode === 'epic' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Business Value *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={newFeature.businessValue}
                          onChange={(e) => setNewFeature(prev => ({ ...prev, businessValue: parseInt(e.target.value) || 1 }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter business value"
                          required
                        />
                      </div>
                    )}

                    {/* Story Points hidden for features */}
                  </div>


                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {newFeature.tags.map(tag => (
                        <span
                          key={tag}
                          className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center"
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
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Acceptance Criteria hidden for features */}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddFeatureForm(false)}
                      className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingFeature}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreatingFeature ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {editMode === 'feature' ? 'Updating...' : editMode === 'epic' ? 'Updating...' : 'Creating...'}
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          {editMode === 'feature' ? 'Update Feature' : editMode === 'epic' ? 'Update Epic' : 'Add Feature'}
                        </>
                      )}
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