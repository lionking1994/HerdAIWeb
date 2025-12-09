import React, { useState } from 'react';
import { Search, Plus, FolderKanban, Filter } from 'lucide-react';
import ProjectCard from './ProjectCard';
import NewProjectModal from './NewProjectModal';
import ProjectDetailView from './ProjectDetailView';
import { mockProjects } from '../Dashboard/Data/mockData';
import { Project } from '../Dashboard/types';

export default function ProjectsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterHealth, setFilterHealth] = useState('all');
  const [filterMethodology, setFilterMethodology] = useState('all');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [projects, setProjects] = useState(mockProjects);
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
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

  const handleCreateProject = (newProject: Partial<Project>) => {
    const project: Project = {
      id: `proj-${Date.now()}`,
      ...newProject,
      changeRequests: [],
      sprints: [],
    } as Project;
    
    setProjects(prev => [...prev, project]);
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
        onBack={() => setSelectedProject(null)} 
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center">
          <FolderKanban className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Project Management</h2>
            <p className="text-gray-600">Oversee all projects and track progress</p>
          </div>
        </div>
        <button 
          onClick={() => setShowNewProjectModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => handleStatCardClick('total')}
          className={`bg-white rounded-xl p-4 border-2 transition-all duration-200 text-left hover:shadow-md ${
            activeStatFilter === 'total' 
              ? 'border-blue-500 bg-blue-50 shadow-md' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <h3 className="text-sm font-medium text-gray-600">Total Projects</h3>
          <p className={`text-2xl font-bold ${
            activeStatFilter === 'total' ? 'text-blue-700' : 'text-gray-900'
          }`}>{projectStats.total}</p>
          {activeStatFilter === 'total' && (
            <p className="text-xs text-blue-600 mt-1">Click to clear filter</p>
          )}
        </button>
        <button
          onClick={() => handleStatCardClick('active')}
          className={`bg-white rounded-xl p-4 border-2 transition-all duration-200 text-left hover:shadow-md ${
            activeStatFilter === 'active' 
              ? 'border-blue-500 bg-blue-50 shadow-md' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <h3 className="text-sm font-medium text-gray-600">Active Projects</h3>
          <p className={`text-2xl font-bold ${
            activeStatFilter === 'active' ? 'text-blue-700' : 'text-blue-600'
          }`}>{projectStats.active}</p>
          {activeStatFilter === 'active' && (
            <p className="text-xs text-blue-600 mt-1">Click to clear filter</p>
          )}
        </button>
        <button
          onClick={() => handleStatCardClick('planning')}
          className={`bg-white rounded-xl p-4 border-2 transition-all duration-200 text-left hover:shadow-md ${
            activeStatFilter === 'planning' 
              ? 'border-purple-500 bg-purple-50 shadow-md' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <h3 className="text-sm font-medium text-gray-600">In Planning</h3>
          <p className={`text-2xl font-bold ${
            activeStatFilter === 'planning' ? 'text-purple-700' : 'text-purple-600'
          }`}>{projectStats.planning}</p>
          {activeStatFilter === 'planning' && (
            <p className="text-xs text-purple-600 mt-1">Click to clear filter</p>
          )}
        </button>
        <button
          onClick={() => handleStatCardClick('at-risk')}
          className={`bg-white rounded-xl p-4 border-2 transition-all duration-200 text-left hover:shadow-md ${
            activeStatFilter === 'at-risk' 
              ? 'border-red-500 bg-red-50 shadow-md' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <h3 className="text-sm font-medium text-gray-600">At Risk</h3>
          <p className={`text-2xl font-bold ${
            activeStatFilter === 'at-risk' ? 'text-red-700' : 'text-red-600'
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

      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}