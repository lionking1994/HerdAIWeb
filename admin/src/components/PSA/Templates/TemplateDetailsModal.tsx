import React from 'react';
import { X, Clock, Star, Users, FileText, Tag, CheckCircle } from 'lucide-react';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: 'epic' | 'feature' | 'story';
  category: string;
  estimatedHours: number;
  storyPoints?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiredSkills: string[];
  acceptanceCriteria: string[];
  definitionOfDone: string[];
  tags: string[];
}

interface TemplateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: ProjectTemplate | null;
}

export default function TemplateDetailsModal({ isOpen, onClose, template }: TemplateDetailsModalProps) {
  if (!isOpen || !template) return null;

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className={`p-3 rounded-lg ${getTypeColor(template.type)} mr-4`}>
              <TypeIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{template.name}</h2>
              <p className="text-gray-600">{template.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Template Type and Priority */}
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-lg text-sm font-medium ${getTypeColor(template.type)}`}>
              {template.type.toUpperCase()}
            </div>
            <div className={`px-3 py-1 rounded-lg text-sm font-medium ${getPriorityColor(template.priority)}`}>
              {template.priority.toUpperCase()} PRIORITY
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700 leading-relaxed">{template.description}</p>
          </div>

          {/* Template Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center text-gray-700">
                <Clock className="w-5 h-5 mr-3 text-gray-500" />
                <div>
                  <div className="font-medium">Estimated Hours</div>
                  <div className="text-sm text-gray-600">{template.estimatedHours} hours</div>
                </div>
              </div>

              {template.storyPoints && (
                <div className="flex items-center text-gray-700">
                  <Star className="w-5 h-5 mr-3 text-gray-500" />
                  <div>
                    <div className="font-medium">Story Points</div>
                    <div className="text-sm text-gray-600">{template.storyPoints} points</div>
                  </div>
                </div>
              )}

              <div className="flex items-center text-gray-700">
                <Users className="w-5 h-5 mr-3 text-gray-500" />
                <div>
                  <div className="font-medium">Required Skills</div>
                  <div className="text-sm text-gray-600">{template.requiredSkills.length} skills</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center text-gray-700">
                <CheckCircle className="w-5 h-5 mr-3 text-gray-500" />
                <div>
                  <div className="font-medium">Acceptance Criteria</div>
                  <div className="text-sm text-gray-600">{template.acceptanceCriteria.length} criteria</div>
                </div>
              </div>

              <div className="flex items-center text-gray-700">
                <Tag className="w-5 h-5 mr-3 text-gray-500" />
                <div>
                  <div className="font-medium">Tags</div>
                  <div className="text-sm text-gray-600">{template.tags.length} tags</div>
                </div>
              </div>
            </div>
          </div>

          {/* Required Skills */}
          {template.requiredSkills.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {template.requiredSkills.map((skill, index) => (
                  <div key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm">
                    {skill}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acceptance Criteria */}
          {template.acceptanceCriteria.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Acceptance Criteria</h3>
              <div className="space-y-2">
                {template.acceptanceCriteria.map((criteria, index) => (
                  <div key={index} className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{criteria}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Definition of Done */}
          {template.definitionOfDone.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Definition of Done</h3>
              <div className="space-y-2">
                {template.definitionOfDone.map((item, index) => (
                  <div key={index} className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {template.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {template.tags.map((tag, index) => (
                  <div key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-sm">
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
