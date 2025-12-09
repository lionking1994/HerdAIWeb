import React, { useState, useEffect } from 'react';
import { X, Calendar, Target, Users, Plus } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';

interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSprintCreated?: () => void;
}

interface TeamMember {
  id: string;
  name: string;
  department: string;
  availability: number;
  isAdded: boolean;
}

export default function CreateSprintModal({ isOpen, onClose, projectId, onSprintCreated }: CreateSprintModalProps) {
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Sprint details
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [duration, setDuration] = useState('2');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState(20);
  const [commitment, setCommitment] = useState(0);
  
  // Team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Sprint name suggestions
  const sprintSuggestions = [
    'Sprint 8',
    'Sprint 9.4', 
    'Foundation Sprint',
    'Feature Sprint',
    'Hardening Sprint'
  ];

  // Calculate end date when start date or duration changes
  useEffect(() => {
    if (startDate && duration) {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(start.getDate() + (parseInt(duration) * 7));
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [startDate, duration]);

  // Calculate capacity based on selected team members
  useEffect(() => {
    const totalCapacity = teamMembers
      .filter(member => selectedMembers.includes(member.id))
      .reduce((sum, member) => sum + Math.round((member.availability / 100) * 20), 0);
    setCapacity(totalCapacity);
  }, [selectedMembers, teamMembers]);

  // Fetch team members when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers();
    }
  }, [isOpen]);

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/getAllResources`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const members: TeamMember[] = data.resources
          .filter((resource: any) => resource.resource)
          .map((resource: any) => ({
            id: resource.id.toString(),
            name: resource.name,
            department: resource.resource.department?.name || 'Unknown',
            availability: resource.resource.availability || 0,
            isAdded: false
          }));
        setTeamMembers(members);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const handleSprintNameSuggestion = (suggestion: string) => {
    setSprintName(suggestion);
  };

  const handleAddMember = (memberId: string) => {
    setSelectedMembers(prev => [...prev, memberId]);
    setTeamMembers(prev => 
      prev.map(member => 
        member.id === memberId 
          ? { ...member, isAdded: true }
          : member
      )
    );
  };

  const handleRemoveMember = (memberId: string) => {
    setSelectedMembers(prev => prev.filter(id => id !== memberId));
    setTeamMembers(prev => 
      prev.map(member => 
        member.id === memberId 
          ? { ...member, isAdded: false }
          : member
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sprintName.trim() || !startDate || !endDate) {
      showError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/createSprint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          name: sprintName,
          goal: sprintGoal,
          start_date: startDate,
          end_date: endDate,
          capacity: capacity,
          commitment: commitment,
          team_member_ids: selectedMembers
        }),
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('Sprint created successfully!');
        onSprintCreated?.();
        handleClose();
      } else {
        showError(data.message || 'Failed to create sprint');
      }
    } catch (error) {
      console.error('Error creating sprint:', error);
      showError('Failed to create sprint');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSprintName('');
    setSprintGoal('');
    setDuration('2');
    setStartDate('');
    setEndDate('');
    setCapacity(20);
    setCommitment(0);
    setSelectedMembers([]);
    setTeamMembers(prev => prev.map(member => ({ ...member, isAdded: false })));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create New Sprint</h2>
              <p className="text-sm text-gray-600">Plan and organize work for the upcoming sprint</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex">
            {/* Left Section - Sprint Details */}
            <div className="flex-1 p-6 border-r border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sprint Details</h3>
              
              {/* Sprint Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sprint Name *
                </label>
                <input
                  type="text"
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                  placeholder="Enter sprint name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-2">Suggestions:</p>
                  <div className="flex flex-wrap gap-2">
                    {sprintSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSprintNameSuggestion(suggestion)}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sprint Goal */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sprint Goal *
                </label>
                <textarea
                  value={sprintGoal}
                  onChange={(e) => setSprintGoal(e.target.value)}
                  placeholder="What is the main objective for this sprint?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  A clear, concise statement of what the team aims to achieve
                </p>
              </div>

              {/* Duration and Dates */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (Weeks)
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1">1 Week</option>
                    <option value="2">2 Weeks</option>
                    <option value="3">3 Weeks</option>
                    <option value="4">4 Weeks</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Capacity and Commitment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sprint Capacity (Story Points) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Commitment (Story Points)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={commitment}
                      onChange={(e) => setCommitment(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Section - Team Capacity Planning */}
            <div className="flex-1 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Team Capacity Planning</h3>
                <span className="text-sm text-gray-500">{selectedMembers.length} members</span>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">Add Team Members</p>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{member.name}</div>
                      <div className="text-sm text-gray-500">
                        {member.department} - {member.availability}% available
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => 
                        member.isAdded 
                          ? handleRemoveMember(member.id)
                          : handleAddMember(member.id)
                      }
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        member.isAdded
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {member.isAdded ? 'Remove' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>

              {selectedMembers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No team members added</p>
                  <p className="text-gray-400 text-xs">Add team members to calculate sprint capacity</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
