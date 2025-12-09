import { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Users, Search, Check } from 'lucide-react';
import { Resource, Project } from '../Dashboard/types';
import api from '../../../lib/api';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (project: Partial<Project>) => void;
  onRefresh: () => void; // Add refresh function
  companyId: string;
  companyResources: Resource[];
  editingProject?: Project | null; // Add editing project prop
  isEditMode?: boolean; // Add edit mode flag
  loadingResources?: boolean; // Add loading state prop
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface ProjectFormData {
  name: string;
  description: string;
  type: string;
  client: string;
  startDate: string;
  endDate: string;
  budget: string;
  methodology: string;
  assignedResources: Array<{
    resourceId: string;
    role: string;
    allocationPercentage: number;
  }>;
}

export default function NewProjectModal({ isOpen, onClose, onSubmit, onRefresh, companyId, companyResources, editingProject, isEditMode = false, loadingResources = false }: NewProjectModalProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    type: 'consulting',
    client: '',
    startDate: '',
    endDate: '',
    budget: '',
    methodology: 'agile',
    assignedResources: [],
  });

  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [resourceFilters, setResourceFilters] = useState({
    role: 'all',
    skill: 'all',
    availability: 'all',
    experience: 'all',
    certification: 'all',
  });

  const [skills, setSkills] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [loadingCertifications, setLoadingCertifications] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResourceAssignment, setShowResourceAssignment] = useState(false);

  // Fetch clients when modal opens
  useEffect(() => {
    if (isOpen && companyId) {
      fetchClients();
      fetchSkills();
      fetchCertifications();
    }
  }, [isOpen, companyId]);

  // Populate form when editing a project
  useEffect(() => {
    if (isEditMode && editingProject) {
      setFormData({
        name: editingProject.name || '',
        description: editingProject.description || '',
        type: 'consulting', // Default type since Project doesn't have type property
        client: editingProject.clientId || '',
        startDate: editingProject.startDate ? new Date(editingProject.startDate).toISOString().split('T')[0] : '',
        endDate: editingProject.endDate ? new Date(editingProject.endDate).toISOString().split('T')[0] : '',
        budget: editingProject.budgetHours?.toString() || '',
        methodology: editingProject.methodology || 'agile',
        assignedResources: editingProject.resourceUserIds?.map((userId, index) => ({
          resourceId: userId.toString(),
          role: editingProject.resourceRoles?.[index] || 'Team Member',
          allocationPercentage: editingProject.resourceAllocations?.[index] || 0
        })) || [],
      });
    } else {
      // Reset form for new project
      setFormData({
        name: '',
        description: '',
        type: 'consulting',
        client: '',
        startDate: '',
        endDate: '',
        budget: '',
        methodology: 'agile',
        assignedResources: [],
      });
    }
  }, [isEditMode, editingProject, isOpen]);

  if (!isOpen) return null;

  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const response = await api.get(`/psa/clients?companyId=${companyId}`);
      if (response.data.success) {
        setClients(response.data.clients);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchSkills = async () => {
    try {
      setLoadingSkills(true);
      const response = await api.get('/psa/skills');
      if (response.data.success) {
        // Filter only active skills
        const activeSkills = response.data.skills.filter((skill: any) => skill.is_active !== false);
        setSkills(activeSkills);
      }
    } catch (error) {
      console.error('Error fetching skills:', error);
    } finally {
      setLoadingSkills(false);
    }
  };

  const fetchCertifications = async () => {
    try {
      setLoadingCertifications(true);
      const response = await api.get('/psa/certifications');
      if (response.data.success) {
        // Filter only active certifications
        const activeCertifications = response.data.certifications.filter((cert: any) => cert.is_active !== false);
        setCertifications(activeCertifications);
      }
    } catch (error) {
      console.error('Error fetching certifications:', error);
    } finally {
      setLoadingCertifications(false);
    }
  };

  const handleInputChange = (field: keyof ProjectFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Prepare assigned resources with user_id
      const assignedResources = formData.assignedResources.map(ar => {
        const resource = companyResources.find(r => r.userId === ar.resourceId);
        return {
          resource_user_id: resource?.userId || ar.resourceId,
          role: ar.role,
          allocation_percentage: ar.allocationPercentage
        };
      });

      const requestBody = {
        project_title: formData.name,
        description: formData.description,
        project_type: formData.type,
        methodology: formData.methodology,
        client: formData.client, // This will be stored as client_id in database
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
        budget_hours: formData.budget ? Number(formData.budget) : 0,
        assigned_resources: assignedResources,
      };

      let resp;
      if (isEditMode && editingProject) {
        // Update existing project
        resp = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/psa/updateProject/${companyId}/${editingProject.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody),
          }
        );
      } else {
        // Create new project
        resp = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/psa/createProject/${companyId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: formData.name,
              description: formData.description,
              type: formData.type,
              methodology: formData.methodology,
              client: formData.client, // Add client field for create request
              start_date: formData.startDate || null,
              end_date: formData.endDate || null,
              budget_hours: formData.budget ? Number(formData.budget) : 0,
              assigned_resources: assignedResources,
            }),
          }
        );
      }

      if (!resp.ok) throw new Error(`Error ${isEditMode ? 'updating' : 'saving'} project: ${resp.status}`);
      const result = await resp.json();
      
      if (result.success) {
        onSubmit(result.project);
        onRefresh(); // Refresh the projects list
        onClose();
      } else {
        throw new Error(result.message || `Failed to ${isEditMode ? 'update' : 'create'} project`);
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'saving'} project:`, error);
      // You might want to show an error toast here
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const filteredResources = (companyResources || []).filter(resource => {
    const matchesSearch = resource.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.skills?.some(skill => skill.skill?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = resourceFilters.role === 'all' ||
      resource.skills?.some(skill => skill.skill?.category?.toLowerCase() === resourceFilters.role);
    const matchesSkill = resourceFilters.skill === 'all' ||
      resource.skills?.some(skill => skill.skill?.name === resourceFilters.skill);
    const matchesAvailability = resourceFilters.availability === 'all' ||
      (resourceFilters.availability === 'available' && resource.availability > 0) ||
      (resourceFilters.availability === 'high' && resource.availability >= 50);
    const matchesExperience = resourceFilters.experience === 'all' ||
      (resourceFilters.experience === 'senior' && resource.performanceRating >= 4.5) ||
      (resourceFilters.experience === 'mid' && resource.performanceRating >= 4.0 && resource.performanceRating < 4.5) ||
      (resourceFilters.experience === 'junior' && resource.performanceRating < 4.0);
    const matchesCertification = resourceFilters.certification === 'all' ||
      resource.certifications?.some(cert => cert.certification?.name === resourceFilters.certification);

    return matchesSearch && matchesRole && matchesSkill && matchesAvailability && matchesExperience && matchesCertification;
  });

  const isResourceAssigned = (resourceId: string) => {
    return formData.assignedResources.some(ar => ar.resourceId === resourceId);
  };

  const toggleResourceAssignment = (resource: Resource) => {
    // Don't allow assignment of resources without resource_id
    if (!resource.resource || !resource.resource.resource_id) {
      return;
    }

    if (isResourceAssigned(resource.userId)) {
      setFormData(prev => ({
        ...prev,
        assignedResources: prev.assignedResources.filter(ar => ar.resourceId !== resource.userId)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        assignedResources: [...prev.assignedResources, {
          resourceId: resource.userId,
          role: 'Team Member',
          allocationPercentage: 100
        }]
      }));
    }
  };

  const updateResourceRole = (resourceId: string, role: string) => {
    setFormData(prev => ({
      ...prev,
      assignedResources: prev.assignedResources.map(ar =>
        ar.resourceId === resourceId ? { ...ar, role } : ar
      )
    }));
  };

  const updateResourceAllocation = (resourceId: string, allocation: number) => {
    setFormData(prev => ({
      ...prev,
      assignedResources: prev.assignedResources.map(ar =>
        ar.resourceId === resourceId ? { ...ar, allocationPercentage: allocation } : ar
      )
    }));
  };

  const roles = ['Project Manager', 'Tech Lead', 'Senior Developer', 'Developer', 'Designer', 'QA Engineer', 'Business Analyst', 'Team Member'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Update Project' : 'Create New Project'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-y-auto">
          <div className="flex-1 flex  gap-6 p-6">
            {/* Left Panel */}
            <div className="flex-1 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Title *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter project title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the project scope and objectives"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Type *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="consulting">Consulting</option>
                    <option value="development">Development</option>
                    <option value="implementation">Implementation</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Methodology *</label>
                  <select
                    required
                    value={formData.methodology}
                    onChange={(e) => handleInputChange('methodology', e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="agile">Agile/Scrum</option>
                    <option value="waterfall">Waterfall</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client *</label>
                <select
                  required
                  value={formData.client}
                  onChange={(e) => handleInputChange('client', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loadingClients}
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {loadingClients && (
                  <p className="text-sm text-gray-500 mt-1">Loading clients...</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Budget *</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.budget}
                    onChange={(e) => handleInputChange('budget', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter budget amount"
                  />
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowResourceAssignment(!showResourceAssignment)}
                  className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Assign Resources ({formData.assignedResources.length} selected)
                </button>
              </div>
            </div>

            {/* Right Panel */}
            {showResourceAssignment && (
              <div className="w-1/2 flex flex-col border-l border-gray-200">
                <div className="p-6 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search resources..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={resourceFilters.role}
                      onChange={(e) => setResourceFilters(prev => ({ ...prev, role: e.target.value }))}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Roles</option>
                      <option value="frontend">Frontend</option>
                      <option value="backend">Backend</option>
                      <option value="management">Management</option>
                      <option value="cloud">Cloud</option>
                    </select>

                    <select
                      value={resourceFilters.skill}
                      onChange={(e) => setResourceFilters(prev => ({ ...prev, skill: e.target.value }))}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loadingSkills}
                    >
                      <option value="all">All Skills</option>
                      {loadingSkills ? (
                        <option disabled>Loading skills...</option>
                      ) : (
                        skills.map(skill => (
                          <option key={skill.id} value={skill.name}>{skill.name}</option>
                        ))
                      )}
                    </select>

                    <select
                      value={resourceFilters.availability}
                      onChange={(e) => setResourceFilters(prev => ({ ...prev, availability: e.target.value }))}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Availability</option>
                      <option value="available">Available</option>
                      <option value="high">High Availability (50%+)</option>
                    </select>

                    <select
                      value={resourceFilters.experience}
                      onChange={(e) => setResourceFilters(prev => ({ ...prev, experience: e.target.value }))}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Experience</option>
                      <option value="senior">Senior (4.5+)</option>
                      <option value="mid">Mid-level (4.0-4.5)</option>
                      <option value="junior">Junior (&lt;4.0)</option>
                    </select>

                    <select
                      value={resourceFilters.certification}
                      onChange={(e) => setResourceFilters(prev => ({ ...prev, certification: e.target.value }))}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loadingCertifications}
                    >
                      <option value="all">All Certifications</option>
                      {loadingCertifications ? (
                        <option disabled>Loading certifications...</option>
                      ) : (
                        certifications.map(cert => (
                          <option key={cert.id} value={cert.name}>{cert.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingResources ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-gray-600 mt-2">Loading resources...</p>
                    </div>
                  ) : filteredResources.length > 0 ? filteredResources.map(resource => {
                    const isAssigned = isResourceAssigned(resource.userId);
                    const assignment = formData.assignedResources.find(ar => ar.resourceId === resource.userId);
                    const hasResourceId = resource.resource && resource.resource.resource_id;
                    const isDisabled = !hasResourceId;

                    return (
                      <div 
                        key={resource.id} 
                        className={`p-3 border rounded-lg transition-all relative ${
                          isDisabled 
                            ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' 
                            : isAssigned 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 hover:border-gray-300'
                        }`}
                        title={isDisabled ? "To add this resource, please first edit the resource and save the changes." : ""}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => !isDisabled && toggleResourceAssignment(resource)}
                              disabled={isDisabled}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 ${
                                isDisabled 
                                  ? 'border-gray-300 bg-gray-100 cursor-not-allowed' 
                                  : isAssigned 
                                    ? 'bg-blue-600 border-blue-600' 
                                    : 'border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {isAssigned && <Check className="w-3 h-3 text-white" />}
                            </button>
                            <div>
                              <h4 className={`font-medium text-sm ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}>
                                {resource.user.name}
                              </h4>
                              <p className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                                {resource.department}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-medium ${isDisabled ? 'text-gray-400' : 'text-green-600'}`}>
                              {resource.availability}% Available
                            </p>
                            <p className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
                              ${resource.hourlyRate}/hr
                            </p>
                          </div>
                        </div>

                        <div className={`text-xs mb-2 ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                          <strong>Skills:</strong> {resource.skills.slice(0, 2).map(s => s.skill.name).join(', ')}
                          {resource.skills.length > 2 && ` +${resource.skills.length - 2} more`}
                        </div>

                        <div className={`text-xs mb-2 ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                          <strong>Experience:</strong> {resource.successfulProjects || 0} projects, {resource.performanceRating || 0}/5.0 rating
                        </div>

                        {isAssigned && assignment && !isDisabled && (
                          <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                              <select
                                value={assignment.role}
                                onChange={(e) => updateResourceRole(resource.userId, e.target.value)}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                              >
                                {roles.map(role => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Allocation: {assignment.allocationPercentage}%
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={assignment.allocationPercentage}
                                onChange={(e) => updateResourceAllocation(resource.userId, parseInt(e.target.value))}
                                className="w-full"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8">
                      <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">No resources match your criteria</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {formData.assignedResources.length > 0 && (
                <span>{formData.assignedResources.length} resource{formData.assignedResources.length !== 1 ? 's' : ''} assigned</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={saving}
              >
                {saving ? (isEditMode ? "Updating..." : "Saving...") : (isEditMode ? "Update Project" : "Create Project")}
              </button>


            </div>
          </div>
        </form>


      </div>
    </div>
  );
}
