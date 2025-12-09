import React from 'react';
import { Clock, Star, Users, FileText, Lightbulb, DollarSign } from 'lucide-react';
import { ProjectTemplate } from '../Dashboard/types';

interface TemplateCardProps {
  template: ProjectTemplate & {
    features?: any[];
    epics?: any[];
    totalItems?: number;
    stats?: {
      totalResources?: number;
      totalSkills?: number;
      estimatedCost?: number;
      effectiveHours?: number;
    };
  };
  onSelect?: (template: any) => void;
  onUse?: (template: any) => void;
}

export default function TemplateCard({ template, onSelect, onUse }: TemplateCardProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'epic': return 'text-purple-600 bg-purple-100';
      case 'feature': return 'text-blue-600 bg-blue-100';
      case 'story': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'epic': return Star;
      case 'feature': return Users;
      case 'story': return FileText;
      default: return FileText;
    }
  };

  const TypeIcon = getTypeIcon(template.type);

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className={`p-2 rounded-lg ${getTypeColor(template.type)} mr-3`}>
            <TypeIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
            <p className="text-gray-600 text-sm">{template.category}</p>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getTypeColor(template.type)}`}>
            {template.type.toUpperCase()}
          </div>
          <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getPriorityColor(template.priority)}`}>
            {template.priority.toUpperCase()}
          </div>
        </div>
      </div>

      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{template.description}</p>

      {/* Hierarchical Template Information */}
      {(template.features && template.features.length > 0) || (template.epics && template.epics.length > 0) ? (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-900">Template Structure</h4>
            <span className="text-xs text-gray-500">{template.totalItems} items</span>
          </div>
          <div className="space-y-1 text-xs text-gray-600">
            {template.epics && template.epics.length > 0 ? (
              // Multi-epic hierarchical template
              <>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  <span>{template.epics.length} Epics</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  <span>{template.epics.reduce((sum: number, e: any) => sum + (e.features?.length || 0), 0)} Features</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span>{template.epics.reduce((sum: number, e: any) => sum + e.features?.reduce((fSum: number, f: any) => fSum + (f.stories?.length || 0), 0) || 0, 0)} Stories</span>
                </div>
              </>
            ) : (
              // Single epic template
              <>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  <span>1 Epic</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  <span>{template.features?.length || 0} Features</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span>{template.features?.reduce((sum: number, f: any) => sum + (f.stories?.length || 0), 0) || 0} Stories</span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Resource, Skills & Cost Stats */}
      {template.stats && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="flex items-center justify-center mb-1">
                <Users className="w-3 h-3 text-blue-600" />
              </div>
              <div className="text-lg font-bold text-blue-600">{template.stats.totalResources || 0}</div>
              <div className="text-xs text-gray-600">Resources</div>
            </div>
            <div>
              <div className="flex items-center justify-center mb-1">
                <Lightbulb className="w-3 h-3 text-yellow-600" />
              </div>
              <div className="text-lg font-bold text-yellow-600">{template.stats.totalSkills || 0}</div>
              <div className="text-xs text-gray-600">Skills</div>
            </div>
            <div>
              <div className="flex items-center justify-center mb-1">
                <DollarSign className="w-3 h-3 text-green-600" />
              </div>
              <div className="text-lg font-bold text-green-600">
                {(template.stats.estimatedCost || 0) > 0 
                  ? `$${(template.stats.estimatedCost / 1000).toFixed(1)}k`
                  : 'N/A'}
              </div>
              <div className="text-xs text-gray-600">Est. Cost</div>
            </div>
          </div>
          {template.stats.effectiveHours && template.stats.effectiveHours > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-200 text-center">
              <span className="text-xs text-gray-600">
                {template.stats.effectiveHours}h estimated
              </span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <Clock className="w-4 h-4 mr-2" />
          <span>Estimated: {template.estimatedHours} hours</span>
        </div>
        
        <div className="flex items-center text-sm text-gray-600">
          <Users className="w-4 h-4 mr-2" />
          <span>{template.requiredSkills.length} skills required</span>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Required Skills</h4>
        <div className="flex flex-wrap gap-2">
          {template.requiredSkills.slice(0, 3).map((skill, index) => (
            <div key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs">
              {skill}
            </div>
          ))}
          {template.requiredSkills.length > 3 && (
            <div className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs">
              +{template.requiredSkills.length - 3} more
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Acceptance Criteria</h4>
        <div className="text-xs text-gray-600">
          {template.acceptanceCriteria.length} criteria defined
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-gray-100">
        <button
          onClick={() => onSelect?.(template)}
          className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          View Details
        </button>
        <button
          onClick={() => onUse?.(template)}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          Use Template
        </button>
      </div>
    </div>
  );
}