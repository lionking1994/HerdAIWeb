import { useState, useEffect } from 'react';
import { Search, Plus, FolderKanban } from 'lucide-react';
import api from '../../lib/api';
import ProjectCard from '../../components/PSA/Projects/ProjectCard';
import NewProjectModal from '../../components/PSA/Projects/NewProjectModal';
import ProjectDetailView from '../../components/PSA/Projects/ProjectDetailView';
import DeleteProjectModal from '../../components/PSA/Projects/DeleteProjectModal';
import { Project, Resource } from '../../components/PSA/Dashboard/types';
import { useSearchParams } from 'react-router-dom';

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterHealth, setFilterHealth] = useState('all');
  const [filterMethodology, setFilterMethodology] = useState('all');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [companyResources, setCompanyResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const projectId = searchParams.get('project');

  // Fetch projects from API
  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!companyId) {
        throw new Error('Company ID not found in URL parameters');
      }

      const response = await api.get(`/psa/getProject/${companyId}`);

      if (response.data.success) {
        // Map API fields to Project type
        const mappedProjects: Project[] = response.data.projects.map((p: any) => {
          // Map assigned resources from API arrays
          const assignedResources = [];
          if (p.resource_user_ids && p.resource_roles && p.resource_allocations) {
            for (let i = 0; i < p.resource_user_ids.length; i++) {
              const userId = p.resource_user_ids[i];
              const resource = companyResources.find(r => r.id === String(userId));
              
              assignedResources.push({
                id: String(userId),
                name: resource?.user?.name || `Resource ${userId}`,
                role: p.resource_roles[i] || 'Team Member',
                allocation: p.resource_allocations[i] || 0,
              });
            }
          }

          return {
            id: String(p.id),
            name: p.name,
            description: p.description,
            status: p.isdeleted ? 'archived' : 'active',
            health: 'green', // default since API doesn't provide
            methodology: p.methodology?.toLowerCase() || 'unknown',
            startDate: p.start_date,
            endDate: p.end_date,
            budgetHours: p.budget_hours || 0,
            actualHours: 0, // Start with 0 actual hours for new projects
            clientId: p.client_id,
            client: p.client, // Include client object from API
            managerId: String(p.user_id),
            resources: assignedResources, // Now includes actual assigned resources with names
            resourceUserIds: p.resource_user_ids || [],
            resourceRoles: p.resource_roles || [],
            resourceAllocations: p.resource_allocations || [],
            changeRequests: [], // API doesn't send CR yet
            sprints: [],
          };
        });

        setProjects(mappedProjects);
        
        // Update selectedProject if it exists and matches one of the fetched projects
        if (selectedProject) {
          const updatedSelectedProject = mappedProjects.find(p => p.id === selectedProject.id);
          if (updatedSelectedProject) {
            setSelectedProject(updatedSelectedProject);
          }
        }
        
        // Fetch cost summaries and story progress for all projects
        await Promise.all([
          fetchCostSummaries(),
          fetchStoryProgress()
        ]);
        
        // If a project ID is provided in URL, automatically select that project
        if (projectId) {
          const projectToSelect = mappedProjects.find(p => p.id === projectId);
          if (projectToSelect) {
            setSelectedProject(projectToSelect);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchCostSummaries = async () => {
    if (!companyId) return;
    
    try {
      // Fetch cost summaries for all projects in one API call
      const response = await api.get(`/psa/projects/${companyId}/cost-summaries`);
      
      if (response.data.success) {
        const costSummaries = response.data.data;
        
        // Update projects with cost summaries
        setProjects(prevProjects => 
          prevProjects.map(project => {
            const costSummary = costSummaries.find((cs: any) => cs.projectId === project.id);
            return costSummary ? { ...project, costSummary } : project;
          })
        );
      }
    } catch (error) {
      console.error('Error fetching cost summaries:', error);
    }
  };

  const fetchStoryProgress = async () => {
    if (!companyId) return;
    
    try {
      // Fetch story progress for all projects in one API call
      const response = await api.get(`/psa/projects/${companyId}/story-progress`);
      
      if (response.data.success) {
        const storyProgressData = response.data.data;
        
        // Update projects with story progress data
        setProjects(prevProjects => 
          prevProjects.map(project => {
            const storyProgress = storyProgressData.find((sp: any) => sp.projectId === project.id);
            return storyProgress ? { ...project, storyProgress } : project;
          })
        );
      }
    } catch (error) {
      console.error('Error fetching story progress:', error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [companyId]);

  // Handle project selection from URL parameter
  useEffect(() => {
    if (projectId && projects.length > 0) {
      const projectToSelect = projects.find(p => p.id === projectId);
      if (projectToSelect) {
        setSelectedProject(projectToSelect);
      }
    }
  }, [projectId, projects]);

  // Fetch company resources from API
  useEffect(() => {
    const fetchCompanyResources = async () => {
      try {
        if (!companyId) return;

        const response = await api.get(`/psa/companyresources/${companyId}`);

        if (response.data.success) {
          // Map API response to Resource type
          const mappedResources: Resource[] = response.data.resources.map((r: any) => ({
            id: String(r.id),
            userId: String(r.id),
            user: {
              id: String(r.id),
              name: r.name,
              email: r.email,
              role: r.role,
              avatar: r.avatar
            },
            skills: r.skills?.map((s: any) => ({
              skillId: String(s.skill_id),
              skill: {
                id: String(s.skill_id),
                name: s.skill_name,
                category: s.skill_category,
                description: s.skill_description
              },
              proficiencyLevel: s.proficiency_level as 1 | 2 | 3 | 4 | 5,
              yearsExperience: s.years_experience,
              lastUsed: s.last_used
            })) || [],
            certifications: r.certifications?.map((c: any) => ({
              certificationId: String(c.certification_id),
              certification: {
                id: String(c.certification_id),
                name: c.certification_name,
                issuingOrganization: c.issuing_organization,
                description: c.certification_description
              },
              dateObtained: c.date_obtained,
              expirationDate: c.expiration_date,
              status: c.cert_status as 'active' | 'expired' | 'expiring_soon',
              certificateNumber: c.certificate_number,
              verificationUrl: c.verification_url
            })) || [],
            availability: r.resource?.availability || 0,
            hourlyRate: r.resource?.hourly_rate || 0,
            location: r.resource?.location || '',
            department: r.resource?.department?.name || '',
            departmentId: r.resource?.department?.id || null,
            performanceRating: r.resource?.performance_rating || 0,
            isActive: r.resource?.is_active || false,
            hireDate: r.resource?.hire_date || '',
            totalProjectHours: 0, // Not provided by API
            successfulProjects: 0, // Not provided by API
            resource: r.resource
          }));

          setCompanyResources(mappedResources);
        }
      } catch (error) {
        console.error('Error fetching company resources:', error);
      }
    };

    fetchCompanyResources();
  }, [companyId]);


  const filteredProjects = projects.filter(project => {
    const matchesSearch =
      project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    const matchesStatFilter = !activeStatFilter ||
      (activeStatFilter === 'total') ||
      (activeStatFilter === 'active' && project.status === 'active') ||
      (activeStatFilter === 'planning' && project.status === 'planning') ||
      (activeStatFilter === 'at-risk' && project.health === 'red');
    const matchesHealth = filterHealth === 'all' || project.health === filterHealth;
    const matchesMethodology = filterMethodology === 'all' || project.methodology === filterMethodology;

    return matchesSearch && matchesStatus && matchesHealth && matchesMethodology && matchesStatFilter;
  });

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    // Refresh story progress when returning to project list
    fetchStoryProgress();
  };

  const handleCreateProject = (newProject: Partial<Project>) => {
    const project: Project = {
      id: `proj-${Date.now()}`,
      ...newProject,
      changeRequests: newProject.changeRequests || [],
      sprints: newProject.sprints || [],
    } as Project;

    setProjects(prev => [...prev, project]);
    
  };

  const handleUpdateProject = (updatedProject: Partial<Project>) => {
    // Update the project in the projects list
    setProjects(prev => prev.map(p => 
      p.id === updatedProject.id ? { ...p, ...updatedProject } : p
    ));
    
    // Update the selected project if it's the one being edited
    if (selectedProject && selectedProject.id === updatedProject.id) {
      setSelectedProject(prev => prev ? { ...prev, ...updatedProject } : null);
    }
    
   
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsEditMode(true);
    setShowNewProjectModal(true);
  };

  const handleCloseModal = () => {
    setShowNewProjectModal(false);
    setIsEditMode(false);
    setEditingProject(null);
  };

  const handleDeleteProject = (project: Project) => {
    setDeletingProject(project);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingProject(null);
  };

  const handleConfirmDelete = async (projectId: string, companyId: string) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/deleteProject/${companyId}/${projectId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error deleting project: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Remove the project from the local state
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setShowDeleteModal(false);
        setDeletingProject(null);
      } else {
        throw new Error(result.message || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      // You might want to show an error toast here
      throw error; // Re-throw so the modal can handle it
    }
  };

  const handleStatCardClick = (statType: string) => {
    if (activeStatFilter === statType) {
      // If clicking the same card, clear the filter
      setActiveStatFilter(null);
    } else {
      // Set new filter and clear other filters for better UX
      setActiveStatFilter(statType);
      if (statType === 'active') {
        setFilterStatus('active');
      } else if (statType === 'planning') {
        setFilterStatus('planning');
      } else if (statType === 'at-risk') {
        setFilterHealth('red');
      } else if (statType === 'total') {
        setFilterStatus('all');
        setFilterHealth('all');
      }
    }
  };

  // If a project is selected, show the detail view
  if (selectedProject) {
    return (
      <ProjectDetailView
        project={selectedProject}
        onBack={handleBackToProjects}
        onStoryUpdate={fetchStoryProgress}
        companyId={companyId || ''}
        onProjectUpdate={fetchProjects}
      />
    );
  }

  const projectStats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    planning: projects.filter(p => p.status === 'planning').length,
    completed: projects.filter(p => p.status === 'completed').length,
    health: {
      green: projects.filter(p => p.health === 'green').length,
      yellow: projects.filter(p => p.health === 'yellow').length,
      red: projects.filter(p => p.health === 'red').length,
    }
  };

  return (
    <div className="psa-page-container">
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center">
              <FolderKanban className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Project Management</h2>
                <p className="text-gray-600">Oversee all projects and track progress</p>
              </div>
            </div>
            <div className="flex gap-3">
              {/* <button
                onClick={fetchProjects}
                disabled={loading}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button> */}
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </button>
            </div>
          </div>

          {/* Loading and Error States */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading projects...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
              onClick={() => handleStatCardClick('total')}
              className={`bg-white rounded-xl p-4 border-2 transition-all duration-200 text-left hover:shadow-md ${activeStatFilter === 'total'
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <h3 className="text-sm font-medium text-gray-600">Total Projects</h3>
              <p className={`text-2xl font-bold ${activeStatFilter === 'total' ? 'text-blue-700' : 'text-gray-900'
                }`}>{projectStats.total}</p>
              {activeStatFilter === 'total' && (
                <p className="text-xs text-blue-600 mt-1">Click to clear filter</p>
              )}
            </button>
            <button
              onClick={() => handleStatCardClick('active')}
              className={`bg-white rounded-xl p-4 border-2 transition-all duration-200 text-left hover:shadow-md ${activeStatFilter === 'active'
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <h3 className="text-sm font-medium text-gray-600">Active Projects</h3>
              <p className={`text-2xl font-bold ${activeStatFilter === 'active' ? 'text-blue-700' : 'text-blue-600'
                }`}>{projectStats.active}</p>
              {activeStatFilter === 'active' && (
                <p className="text-xs text-blue-600 mt-1">Click to clear filter</p>
              )}
            </button>
            <button
              onClick={() => handleStatCardClick('planning')}
              className={`bg-white rounded-xl p-4 border-2 transition-all duration-200 text-left hover:shadow-md ${activeStatFilter === 'planning'
                ? 'border-purple-500 bg-purple-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <h3 className="text-sm font-medium text-gray-600">In Planning</h3>
              <p className={`text-2xl font-bold ${activeStatFilter === 'planning' ? 'text-purple-700' : 'text-purple-600'
                }`}>{projectStats.planning}</p>
              {activeStatFilter === 'planning' && (
                <p className="text-xs text-purple-600 mt-1">Click to clear filter</p>
              )}
            </button>
            <button
              onClick={() => handleStatCardClick('at-risk')}
              className={`bg-white rounded-xl p-4 border-2 transition-all duration-200 text-left hover:shadow-md ${activeStatFilter === 'at-risk'
                ? 'border-red-500 bg-red-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <h3 className="text-sm font-medium text-gray-600">At Risk</h3>
              <p className={`text-2xl font-bold ${activeStatFilter === 'at-risk' ? 'text-red-700' : 'text-red-600'
                }`}>{projectStats.health.red}</p>
              {activeStatFilter === 'at-risk' && (
                <p className="text-xs text-red-600 mt-1">Click to clear filter</p>
              )}
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-4">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  value={filterHealth}
                  onChange={(e) => setFilterHealth(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Health</option>
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="red">Red</option>
                </select>

                <select
                  value={filterMethodology}
                  onChange={(e) => setFilterMethodology(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Methodologies</option>
                  <option value="agile">Agile</option>
                  <option value="waterfall">Waterfall</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredProjects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={handleProjectSelect}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                />
              ))}
            </div>

            {filteredProjects.length === 0 && (
              <div className="text-center py-12">
                <FolderKanban className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
                <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
              </div>
            )}
            </div>
            </>
          )}

          <NewProjectModal
            isOpen={showNewProjectModal}
            onClose={handleCloseModal}
            onSubmit={isEditMode ? handleUpdateProject : handleCreateProject}
            onRefresh={fetchProjects}
            companyId={String(companyId)}
            companyResources={companyResources}
            editingProject={editingProject}
            isEditMode={isEditMode}
          />

          <DeleteProjectModal
            isOpen={showDeleteModal}
            onClose={handleCloseDeleteModal}
            onConfirm={handleConfirmDelete}
            project={deletingProject}
            companyId={String(companyId)}
          />
        </div>
      </div>
    </div>
  );
}