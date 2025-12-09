import React from 'react';
import { X, Check, LayoutTemplate, Users, Lightbulb, DollarSign } from 'lucide-react';

interface SaveAsTemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  templateData: {
    name: string;
    description: string;
    category: string;
    epics: any[];
    stats: {
      totalEpics: number;
      totalFeatures: number;
      totalStories: number;
      totalResources?: number;
      totalSkills?: number;
      totalStoryPoints?: number;
      totalEstimatedHours?: number;
      effectiveHours?: number;
      avgHourlyRate?: number;
      estimatedCost?: number;
    };
  } | null;
  isLoading?: boolean;
}

const SaveAsTemplatePreviewModal: React.FC<SaveAsTemplatePreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  templateData,
  isLoading = false
}) => {
  if (!isOpen || !templateData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <LayoutTemplate className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">📋 Template Preview</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Template Info */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Template Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Name:</span>
                <span className="ml-2 font-medium text-gray-900">{templateData.name}</span>
              </div>
              <div>
                <span className="text-gray-600">Category:</span>
                <span className="ml-2 font-medium text-gray-900">{templateData.category}</span>
              </div>
              <div>
                <span className="text-gray-600">Total Items:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {templateData.stats.totalEpics + templateData.stats.totalFeatures + templateData.stats.totalStories}
                </span>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-gray-600">Description:</span>
              <p className="mt-1 text-gray-800">{templateData.description}</p>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Template Structure Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">{templateData.stats.totalEpics}</div>
                <div className="text-sm text-gray-500">Epics</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{templateData.stats.totalFeatures}</div>
                <div className="text-sm text-gray-500">Features</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{templateData.stats.totalStories}</div>
                <div className="text-sm text-gray-500">Stories</div>
              </div>
            </div>
          </div>

          {/* Resource, Skills & Cost Details */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              Resource, Skills & Cost Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Resources */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-600">Resources</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {templateData.stats.totalResources || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">Team members required</div>
              </div>

              {/* Skills */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-600">Skills</span>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {templateData.stats.totalSkills || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">Unique skills needed</div>
              </div>

              {/* Estimated Cost */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-600">Estimated Cost</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {(templateData.stats.estimatedCost || 0) > 0 ? (
                    `$${(templateData.stats.estimatedCost || 0).toLocaleString()}`
                  ) : (
                    <span className="text-gray-400 text-lg">Not Available</span>
                  )}
                </div>
                {(templateData.stats.estimatedCost || 0) > 0 ? (
                  <>
                    <div className="text-xs text-gray-500 mt-1">
                      {templateData.stats.effectiveHours || 0}h × ${templateData.stats.avgHourlyRate || 0}/hr
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      ({templateData.stats.totalStoryPoints || 0} story points)
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-orange-600 mt-1 font-medium">
                    {templateData.stats.totalResources > 0 
                      ? '⚠️ Resource hourly rates not configured' 
                      : '⚠️ No resources assigned to project'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hierarchical Structure Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Template Structure</h3>
            <p className="text-sm text-gray-600 mb-3">
              This template will create a project with the following hierarchical structure:
            </p>
            <div className="space-y-3 text-sm max-h-80 overflow-y-auto">
              {templateData.epics.map((epic: any, epicIndex: number) => (
                <div key={epic.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                  {/* Epic Level */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                      <span className="font-semibold text-purple-700">{epic.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 bg-purple-100 px-2 py-1 rounded">
                      {epic.features?.length || 0} features, {epic.features?.reduce((sum: number, f: any) => sum + (f.stories?.length || 0), 0) || 0} stories
                    </div>
                  </div>

                  {/* Features Level */}
                  {epic.features && epic.features.length > 0 && (
                    <div className="ml-4 space-y-2">
                      {epic.features.map((feature: any, featureIndex: number) => (
                        <div key={feature.id} className="border-l-2 border-blue-200 pl-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                              <span className="font-medium text-blue-700">{feature.name}</span>
                            </div>
                            <div className="text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded">
                              {feature.stories?.length || 0} stories
                            </div>
                          </div>

                          {/* Stories Level */}
                          {feature.stories && feature.stories.length > 0 && (
                            <div className="ml-4 space-y-1">
                              {feature.stories.map((story: any, storyIndex: number) => (
                                <div key={story.id} className="flex items-center">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                                  <span className="text-green-700">{story.name}</span>
                                  {story.storyPoints && (
                                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">
                                      {story.storyPoints} pts
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              All items will be created with their original names, descriptions, and story points.
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save Template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveAsTemplatePreviewModal;
