import React, { useState, useEffect } from 'react';
import { X, Target } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import api from '../../../lib/api';

interface CreateProgramIncrementModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
  editingPI?: any; // For edit mode
}

interface PIObjective {
  id: string;
  title: string;
  description: string;
  businessValue: number;
  isStretch: boolean;
}

export default function CreateProgramIncrementModal({ 
  isOpen, 
  onClose, 
  projectId, 
  onSuccess,
  editingPI 
}: CreateProgramIncrementModalProps) {
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    durationWeeks: 6,
    piCapacity: 120,
    initialCommitment: 0
  });

  // Objectives
  const [objectives, setObjectives] = useState<PIObjective[]>([]);
  const [newObjective, setNewObjective] = useState({
    title: '',
    description: '',
    businessValue: 5,
    isStretch: false
  });

  // Sprint selection
  const [availableSprints, setAvailableSprints] = useState<any[]>([]);
  const [selectedSprints, setSelectedSprints] = useState<string[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [sprintCoverageWarning, setSprintCoverageWarning] = useState<string | null>(null);
  const [backendWarning, setBackendWarning] = useState<string | null>(null);

  // Suggestions
  const suggestions = [
    'PI 2025.3',
    'PI 2025.4', 
    'Q3 2025 Program Increment',
    'Foundation PI',
    'Innovation PI',
    'Scaling PI'
  ];

  // Calculate sprint coverage and show warnings
  const calculateSprintCoverage = () => {
    if (selectedSprints.length === 0 || !formData.startDate || !formData.endDate) {
      setSprintCoverageWarning(null);
      return;
    }

    const selectedSprintData = availableSprints.filter(sprint => selectedSprints.includes(sprint.id));
    if (selectedSprintData.length === 0) {
      setSprintCoverageWarning(null);
      return;
    }

    // Calculate PI duration in weeks
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    const piDurationWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));

    // Calculate total sprint duration
    let totalSprintWeeks = 0;
    selectedSprintData.forEach(sprint => {
      const sprintStart = new Date(sprint.start_date);
      const sprintEnd = new Date(sprint.end_date);
      const sprintWeeks = Math.ceil((sprintEnd.getTime() - sprintStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
      totalSprintWeeks += sprintWeeks;
    });

    const coveragePercentage = (totalSprintWeeks / piDurationWeeks) * 100;
    
    if (coveragePercentage < 80) {
      setSprintCoverageWarning(`Sprint coverage is ${coveragePercentage.toFixed(1)}%. Consider adding more sprints for better coverage.`);
    } else {
      setSprintCoverageWarning(null);
    }
  };

  // Update coverage warning when sprints or dates change
  useEffect(() => {
    calculateSprintCoverage();
  }, [selectedSprints, formData.startDate, formData.endDate, availableSprints]);

  // Fetch available sprints
  const fetchAvailableSprints = async () => {
    if (!projectId) return;
    
    setLoadingSprints(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/sprints/${projectId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          if (editingPI) {
            // In edit mode, show ALL sprints (both assigned and unassigned)
            setAvailableSprints(data.sprints);
          } else {
            // In create mode, show sprints that are not assigned to any PI
            // OR sprints that are assigned to other PIs (not the current one being edited)
            const unassignedSprints = data.sprints.filter((sprint: any) => !sprint.pi_id);
            setAvailableSprints(unassignedSprints);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching sprints:', error);
    } finally {
      setLoadingSprints(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAvailableSprints();
      setBackendWarning(null); // Clear any previous warnings
      
      if (editingPI) {
        // Populate form for editing
        setFormData({
          name: editingPI.name || '',
          description: editingPI.description || '',
          startDate: editingPI.start_date ? editingPI.start_date.split('T')[0] : '',
          endDate: editingPI.end_date ? editingPI.end_date.split('T')[0] : '',
          durationWeeks: editingPI.duration_weeks || 6,
          piCapacity: editingPI.pi_capacity || 120,
          initialCommitment: editingPI.current_commitment || 0
        });
        
        // Set selected sprints for editing
        if (editingPI.sprints) {
          setSelectedSprints(editingPI.sprints.map((sprint: any) => sprint.id));
        }
        
        // Map database fields to frontend format
        const mappedObjectives = (editingPI.objectives || []).map((obj: any) => ({
          id: obj.id,
          title: obj.title,
          description: obj.description,
          businessValue: obj.business_value || 5,
          isStretch: obj.is_stretch || false
        }));
        setObjectives(mappedObjectives);
      } else {
        // Reset form for creating
        setFormData({
          name: '',
          description: '',
          startDate: '',
          endDate: '',
          durationWeeks: 6,
          piCapacity: 120,
          initialCommitment: 0
        });
        setObjectives([]);
      }
      setNewObjective({
        title: '',
        description: '',
        businessValue: 5,
        isStretch: false
      });
    }
  }, [isOpen, editingPI]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-calculate duration when both dates are set
    if (field === 'endDate' && formData.startDate && value) {
      const start = new Date(formData.startDate);
      const end = new Date(value);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
      
      if (diffWeeks >= 1 && diffWeeks <= 6) {
        setFormData(prev => ({
          ...prev,
          durationWeeks: diffWeeks
        }));
      }
    }
  };

  const handleDurationChange = (weeks: number) => {
    setFormData(prev => ({
      ...prev,
      durationWeeks: weeks,
      endDate: prev.startDate ? 
        new Date(new Date(prev.startDate).getTime() + (weeks * 7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0] :
        prev.endDate
    }));
  };

  const addObjective = () => {
    if (!newObjective.title.trim()) return;

    const objective: PIObjective = {
      id: Date.now().toString(),
      ...newObjective
    };

    setObjectives(prev => [...prev, objective]);
    setNewObjective({
      title: '',
      description: '',
      businessValue: 5,
      isStretch: false
    });
  };

  const removeObjective = (id: string) => {
    setObjectives(prev => prev.filter(obj => obj.id !== id));
  };

  const updateObjective = (id: string, field: keyof PIObjective, value: any) => {
    setObjectives(prev => prev.map(obj => 
      obj.id === id ? { ...obj, [field]: value } : obj
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.description.trim() || !formData.startDate || !formData.endDate) {
      showError('Please fill in all required fields');
      return;
    }

    if (objectives.length === 0) {
      showError('Please add at least one objective');
      return;
    }

    setIsLoading(true);

    try {
      const companyId = new URLSearchParams(window.location.search).get('company');
      if (!companyId) {
        throw new Error('Company ID not found');
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        start_date: formData.startDate,
        end_date: formData.endDate,
        duration_weeks: formData.durationWeeks,
        pi_capacity: formData.piCapacity,
        current_commitment: formData.initialCommitment,
        status: editingPI ? editingPI.status : 'planning',
        sprint_ids: selectedSprints
      };

      let response;
      if (editingPI) {
        // Update existing PI
        response = await api.put(`/psa/program-increments/${editingPI.id}`, payload);
      } else {
        // Create new PI
        const createPayload = {
          ...payload,
          project_id: projectId,
          initial_commitment: formData.initialCommitment,
          company_id: parseInt(companyId),
          objectives: objectives.map(obj => ({
            title: obj.title,
            description: obj.description,
            business_value: obj.businessValue,
            is_stretch: obj.isStretch
          }))
        };
        response = await api.post('/psa/program-increments', createPayload);
      }
      
      if (response.data.success) {
        // Show success message
        showSuccess(editingPI ? 'Program Increment updated successfully' : 'Program Increment created successfully');
        
        // Show warning if provided (for edit mode)
        if (response.data.warning) {
          setBackendWarning(response.data.warning);
          // Show warning as a toast but don't block the success
          setTimeout(() => {
            showError(`Warning: ${response.data.warning}`);
          }, 1000);
        }
        
        onSuccess();
        onClose();
      } else {
        showError(response.data.message || `Failed to ${editingPI ? 'update' : 'create'} Program Increment`);
      }
    } catch (error: any) {
      console.error(`Error ${editingPI ? 'updating' : 'creating'} Program Increment:`, error);
      showError(error.response?.data?.message || `Failed to ${editingPI ? 'update' : 'create'} Program Increment`);
    } finally {
      setIsLoading(false);
    }
  };

  const totalBusinessValue = objectives.reduce((sum, obj) => sum + obj.businessValue, 0);
  const averageBusinessValue = objectives.length > 0 ? totalBusinessValue / objectives.length : 0;
  const stretchObjectives = objectives.filter(obj => obj.isStretch).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPI ? 'Edit Program Increment' : 'Create Program Increment'}
              </h2>
              <p className="text-sm text-gray-600">
                {editingPI ? 'Update your program increment details and objectives' : 'Plan a 8-12 week program increment with objectives and capacity'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - PI Details */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Program Increment Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter PI name (e.g., PI 2024.1)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, name: suggestion }))}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe the main theme and focus of this Program Increment"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (Weeks) *
                  </label>
                  <select
                    value={formData.durationWeeks}
                    onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {[1, 2, 3, 4, 5, 6].map(weeks => (
                      <option key={weeks} value={weeks}>{weeks} Weeks</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PI Capacity (Story Points) *
                  </label>
                  <input
                    type="number"
                    name="piCapacity"
                    value={formData.piCapacity}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Commitment (Story Points)
                  </label>
                  <input
                    type="number"
                    name="initialCommitment"
                    value={formData.initialCommitment}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Based on team size and sprint capacity. Will be refined during PI Planning.
              </p>

              {/* Sprint Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Sprints (Optional)
                </label>
                <div className="space-y-3">
                  {loadingSprints ? (
                    <div className="text-sm text-gray-500">Loading sprints...</div>
                  ) : availableSprints.length === 0 ? (
                    <div className="text-sm text-gray-500 space-y-2">
                      <div>No available sprints found</div>
                      <div className="text-xs text-gray-400">
                        All existing sprints are already assigned to Program Increments. 
                        Create a new sprint first to assign it to this PI.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {availableSprints.map((sprint) => {
                        const isSelected = selectedSprints.includes(sprint.id);
                        const isAssignedToCurrentPI = editingPI && sprint.pi_id === editingPI.id;
                        const isAssignedToOtherPI = sprint.pi_id && sprint.pi_id !== editingPI?.id;
                        
                        return (
                          <label key={sprint.id} className={`flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer ${
                            isAssignedToOtherPI ? 'opacity-50 cursor-not-allowed' : ''
                          }`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isAssignedToOtherPI}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSprints(prev => [...prev, sprint.id]);
                                } else {
                                  setSelectedSprints(prev => prev.filter(id => id !== sprint.id));
                                }
                              }}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                {sprint.name}
                                {isAssignedToCurrentPI && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Current PI</span>
                                )}
                                {isAssignedToOtherPI && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Assigned to other PI</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(sprint.start_date).toLocaleDateString()} - {new Date(sprint.end_date).toLocaleDateString()}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedSprints.length > 0 && (
                  <div className="mt-2 text-sm text-green-600">
                    ✓ {selectedSprints.length} sprint(s) selected
                  </div>
                )}
                {sprintCoverageWarning && (
                  <div className="mt-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    ⚠️ {sprintCoverageWarning}
                  </div>
                )}
                {backendWarning && (
                  <div className="mt-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-2">
                    ⚠️ Backend Warning: {backendWarning}
                  </div>
                )}
              </div>

              {/* SAFe Guidelines */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-2">SAFe Program Increment Guidelines</h4>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• PI duration is typically 8-12 weeks (4-6 sprints)</li>
                  <li>• Include Innovation & Planning (IP) sprint</li>
                  <li>• Set 3-5 clear PI objectives with business value</li>
                </ul>
              </div>
            </div>

            {/* Right Column - Objectives */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium text-gray-900">PI Objectives</h4>
                <div className="text-sm text-gray-600">
                  Avg BV: {averageBusinessValue.toFixed(1)}
                </div>
              </div>

              {/* Add Objective Form */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Objective Title
                  </label>
                  <input
                    type="text"
                    value={newObjective.title}
                    onChange={(e) => setNewObjective(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Objective title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newObjective.description}
                    onChange={(e) => setNewObjective(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the objective and success criteria"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newObjective.isStretch}
                      onChange={(e) => setNewObjective(prev => ({ ...prev, isStretch: e.target.checked }))}
                      className="mr-2"
                    />
                    <label className="text-sm text-gray-700">Stretch</label>
                  </div>
                  <button
                    type="button"
                    onClick={addObjective}
                    className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                  >
                    + Add Objective
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Value: {newObjective.businessValue}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={newObjective.businessValue}
                    onChange={(e) => setNewObjective(prev => ({ ...prev, businessValue: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Low Impact</span>
                    <span>High Impact</span>
                  </div>
                </div>
              </div>

              {/* Objectives List */}
              {objectives.map((objective, index) => (
                <div key={objective.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 mr-2">Objective {index + 1}</span>
                      {objective.isStretch && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                          Stretch
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeObjective(objective.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    value={objective.title}
                    onChange={(e) => updateObjective(objective.id, 'title', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                  />
                  <textarea
                    value={objective.description}
                    onChange={(e) => updateObjective(objective.id, 'description', e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={objective.isStretch}
                        onChange={(e) => updateObjective(objective.id, 'isStretch', e.target.checked)}
                        className="mr-2"
                      />
                      <label className="text-sm text-gray-700">Stretch</label>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div className="mb-1">Business Value: {objective.businessValue}/10</div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={objective.businessValue}
                        onChange={(e) => updateObjective(objective.id, 'businessValue', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Objectives Summary */}
              {objectives.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-2">Objectives Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm text-purple-800">
                    <div>Total Objectives: {objectives.length}</div>
                    <div>Stretch Objectives: {stretchObjectives}</div>
                    <div>Total Business Value: {totalBusinessValue}</div>
                    <div>Average BV: {averageBusinessValue.toFixed(1)}</div>
                  </div>
                </div>
              )}

              {/* Best Practices */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-2">PI Planning Best Practices</h4>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• Business Value: Rate objectives 1-10 for prioritization</li>
                  <li>• Stretch Objectives: Mark uncommitted objectives as stretch goals</li>
                  <li>• Dependencies: Identify cross-team dependencies early</li>
                  <li>• Capacity: Plan for 80% capacity, reserve 20% for risks</li>
                  <li>• Innovation: Include time for innovation and exploration</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || objectives.length === 0}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {editingPI ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                editingPI ? 'Update Program Increment' : 'Create Program Increment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
