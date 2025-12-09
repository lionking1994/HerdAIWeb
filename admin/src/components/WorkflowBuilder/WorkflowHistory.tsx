import React from 'react';
import { ArrowLeft, Clock, Edit, Play, Pause, Trash, CheckCircle } from 'lucide-react';
import { WorkflowHistory as WorkflowHistoryType } from '../../types';

interface WorkflowHistoryProps {
  history: WorkflowHistoryType[];
  workflowId: string;
  onBack: () => void;
}

const WorkflowHistory: React.FC<WorkflowHistoryProps> = ({
  history,
  onBack
}) => {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'updated':
        return <Edit className="w-4 h-4 text-blue-500" />;
      case 'activated':
        return <Play className="w-4 h-4 text-green-500" />;
      case 'deactivated':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'deleted':
        return <Trash className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'bg-green-100 text-green-800';
      case 'updated':
        return 'bg-blue-100 text-blue-800';
      case 'activated':
        return 'bg-green-100 text-green-800';
      case 'deactivated':
        return 'bg-yellow-100 text-yellow-800';
      case 'deleted':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Workflow History</h1>
            <p className="text-sm sm:text-base text-gray-600">View changes and activity for this workflow</p>
          </div>
        </div>
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
          </div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No history available</h3>
          <p className="text-sm sm:text-base text-gray-600">
            No activity has been recorded for this workflow yet.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Activity Timeline</h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {history.map((item) => (
              <div key={item.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-3 sm:space-x-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getActionIcon(item.action)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0">
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(item.action)} self-start sm:self-auto`}>
                          {item.action.charAt(0).toUpperCase() + item.action.slice(1)}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500">
                          by {item.userId}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm text-gray-500">
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>
                    
                    {item.changes && Object.keys(item.changes).length > 0 && (
                      <div className="mt-2">
                        <details className="text-xs sm:text-sm">
                          <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                            View changes
                          </summary>
                          <div className="mt-2 p-2 sm:p-3 bg-gray-50 rounded-md">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(item.changes, null, 2)}
                            </pre>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowHistory; 