import { User, MapPin, Award, Clock, Star, AlertCircle, Edit } from 'lucide-react';
import { Resource } from '../Dashboard/types';

interface ResourceCardProps {
  resource: Resource;
  onSelect?: (resource: Resource) => void;
  companyId?: string;
}

export default function ResourceCard({ resource, onSelect, companyId }: ResourceCardProps) {
  const getAvailabilityColor = (availability: number) => {
    if (availability >= 75) return 'text-green-600 bg-green-100';
    if (availability >= 25) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getSkillLevel = (level: number) => {
    const levels = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'];
    return levels[level - 1] || 'Unknown';
  };

  // Check if resource needs to be edited (missing resource_id)
  const needsEdit = !resource.resource || !resource.resource.resource_id;

  return (
    <div 
      className={`bg-white rounded-xl p-6 border transition-all duration-200 cursor-pointer relative ${
        needsEdit 
          ? 'border-orange-200 hover:border-orange-300 hover:shadow-md' 
          : 'border-gray-200 hover:shadow-lg'
      }`}
      onClick={() => onSelect?.(resource)}
    >
      {/* Edit Required Banner */}
      {needsEdit && (
        <div className="absolute top-0 left-0 right-0 bg-orange-100 border-b border-orange-200 rounded-t-xl px-4 py-2 flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-orange-600 mr-2" />
          <span className="text-orange-700 text-sm font-medium">Profile update required before assigning to a project</span>
          <Edit className="w-4 h-4 text-orange-600 ml-2" />
        </div>
      )}

      <div className={`flex items-start justify-between mb-4 ${needsEdit ? 'mt-8' : ''}`}>
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center">
            {resource.user.avatar ? (
              <img 
                src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${resource.user.avatar}`}
                alt={resource.user.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to default icon if image fails to load
                  e.currentTarget.style.display = 'none';
                  const fallbackElement = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallbackElement) {
                    fallbackElement.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div 
              className={`w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ${resource.user.avatar ? 'hidden' : ''}`}
              style={{ display: resource.user.avatar ? 'none' : 'flex' }}
            >
              <User className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-gray-900">{resource.user.name}</h3>
            <p className="text-gray-600 text-sm">{resource.department}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getAvailabilityColor(100 - resource.availability)}`}>
          {100 - resource.availability}% Available
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center text-gray-600 text-sm">
          <MapPin className="w-4 h-4 mr-2" />
          {resource.location}
        </div>
        <div className="flex items-center text-gray-600 text-sm">
          <Clock className="w-4 h-4 mr-2" />
          ${resource.hourlyRate}/hour
        </div>
        <div className="flex items-center text-gray-600 text-sm">
          <Star className="w-4 h-4 mr-2" />
          {resource.performanceRating}/5.0 rating
        </div>
      </div>

      {/* Active Projects */}
      {resource.activeProjects && resource.activeProjects.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Active Projects ({resource.activeProjects.length})</h4>
          <div className="space-y-1">
            {resource.activeProjects.map((project, index) => (
              <div key={project.id || index} className="text-sm">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Navigate to project details in the same tab
                    const url = companyId 
                      ? `/admin/psa/projects?company=${companyId}&project=${project.id}`
                      : `/admin/psa/projects?project=${project.id}`;
                    window.location.href = url;
                  }}
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  {project.name}
                </button>                
                <span className="text-gray-500 text-xs ml-2">({project.role})</span>
                <span className="text-gray-500 text-xs ml-2">| allocation {project.allocation}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Top Skills</h4>
        <div className="flex flex-wrap gap-2">
          {resource.skills?.slice(0, 3).map((skill, index) => (
            <div key={skill.skillId || index} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs">
              {skill.skill?.name || 'Unknown Skill'} ({getSkillLevel(skill.proficiencyLevel)})
            </div>
          ))}
          {(!resource.skills || resource.skills.length === 0) && (
            <span className="text-gray-500 text-xs">No skills added</span>
          )}
        </div>
      </div>

      {resource.certifications && resource.certifications.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Certifications</h4>
          <div className="flex items-center">
            <Award className="w-4 h-4 text-yellow-500 mr-2" />
            <span className="text-sm text-gray-600">
              {resource.certifications.length} active certification{resource.certifications.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-between text-sm text-gray-600 pt-4 border-t border-gray-100">
        <span>{resource.successfulProjects} projects completed</span>
        <span>{resource.totalProjectHours.toLocaleString()} hours logged</span>
      </div>
    </div>
  );
}   