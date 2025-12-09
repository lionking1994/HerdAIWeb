import { Calendar, Users, AlertCircle, CheckCircle, Clock, Edit2, Trash2, Building2 } from 'lucide-react';
import { Project } from '../Dashboard/types';

interface ProjectCardProps {
  project: Project;
  onSelect?: (project: Project) => void;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
}

export default function ProjectCard({ project, onSelect, onEdit, onDelete }: ProjectCardProps) {
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'green': return 'text-green-600 bg-green-100';
      case 'yellow': return 'text-yellow-600 bg-yellow-100';
      case 'red': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'green': return CheckCircle;
      case 'yellow': return Clock;
      case 'red': return AlertCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'on_hold': return 'text-yellow-600 bg-yellow-100';
      case 'planning': return 'text-purple-600 bg-purple-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const HealthIcon = getHealthIcon(project.health);
  
  // Use story-based progress if available, otherwise fall back to cost-based, then hours-based
  const progressPercentage = project.storyProgress ? 
    project.storyProgress.storyProgressPercentage : 
    (project.costSummary ? 
      project.costSummary.costProgress : 
      (project.costAnalysis ? 
        project.costAnalysis.progress.costProgress : 
        (project.budgetHours > 0 ? Math.min((project.actualHours / project.budgetHours) * 100, 100) : 0)
      )
    );

  return (
    <div 
      className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer"
      onClick={() => onSelect?.(project)}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
          <p className="text-gray-600 text-sm line-clamp-2">{project.description}</p>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(project);
              }}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit project"
            >
              <Edit2 className="w-4 h-4 text-gray-500 hover:text-blue-600" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(project);
              }}
              className="p-1 hover:bg-red-100 rounded-lg transition-colors"
              title="Delete project"
            >
              <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600" />
            </button>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
              {(project.status?.replace('_', ' ') ?? 'UNKNOWN').toUpperCase()}
            </div>
          </div>

          <div className={`flex items-center px-2 py-1 rounded-lg text-xs font-medium ${getHealthColor(project.health)}`}>
            <HealthIcon className="w-3 h-3 mr-1" />
            {(project.health ?? 'UNKNOWN').toUpperCase()}
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {project.client && (
          <div className="flex items-center text-sm">
            <Building2 className="w-4 h-4 mr-2 text-gray-600" />
            <span className="text-gray-600">Client: </span>
            <span className="font-medium text-gray-900 ml-1">{project.client.name}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>{new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-600">
            <Users className="w-4 h-4 mr-2" />
            <span>{project.resources?.length ?? 0} resource{(project.resources?.length ?? 0) !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <span className="capitalize">{project.methodology}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          {project.storyProgress ? (
            <span>{project.storyProgress.completedStoryPoints} / {project.storyProgress.totalStoryPoints} story points</span>
          ) : project.costSummary ? (
            <span>${project.costSummary.totalSpent.toLocaleString()} / ${project.budgetHours.toLocaleString()}</span>
          ) : project.costAnalysis ? (
            <span>${project.costAnalysis.costs.totalSpent.toLocaleString()} / ${project.budgetHours.toLocaleString()}</span>
          ) : (
            <span>{project.actualHours} / {project.budgetHours} hours</span>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              progressPercentage > 90 ? 'bg-red-500' : 
              progressPercentage > 75 ? 'bg-yellow-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {Math.round(progressPercentage)}% complete
        </div>
      </div>

      {project.changeRequests.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
            <span className="text-sm text-yellow-800">
              {project.changeRequests.length} pending change request{project.changeRequests.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <div className="text-sm text-gray-600">
          Budget: ${project.budgetHours.toLocaleString()}
        </div>
        <div className="text-sm font-medium text-gray-900">
          {project.costSummary ? (
            <>
              Spent: ${project.costSummary.totalSpent.toLocaleString()}
              <br />
              <span className="text-xs text-gray-500">
                Remaining: ${project.costSummary.budgetRemaining.toLocaleString()}
              </span>
            </>
          ) : project.costAnalysis ? (
            <>
              Spent: ${project.costAnalysis.costs.totalSpent.toLocaleString()}
              <br />
              <span className="text-xs text-gray-500">
                Remaining: ${project.costAnalysis.costs.budgetRemaining.toLocaleString()}
              </span>
            </>
          ) : (
            `Remaining: $${(project.budgetHours - project.actualHours).toLocaleString()}`
          )}
        </div>
      </div>
    </div>
  );
}