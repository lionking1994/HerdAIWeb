import React from 'react';
import { MessageSquare, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const PromptNode = ({ nodeInstance }) => {
  const { node_name, data, result, status, started_at, completed_at } = nodeInstance;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'waiting_user_input':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'waiting_user_input':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {node_name || 'Prompt Node'}
          </h3>
        </div>
        <p className="text-sm text-gray-600">
          AI-powered prompt processing and content generation
        </p>
      </div>
      
      {/* Status Information */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="font-medium text-gray-900">
              Status: {status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          {started_at && (
            <div>
              <span className="font-medium text-gray-700">Started:</span>
              <span className="ml-2 text-gray-600">{formatDate(started_at)}</span>
            </div>
          )}
          {completed_at && (
            <div>
              <span className="font-medium text-gray-700">Completed:</span>
              <span className="ml-2 text-gray-600">{formatDate(completed_at)}</span>
            </div>
          )}
        </div>
      </div>
      {/* AI Generated Result */}
      {/* Image Generation Result with image url*/}
      {result?.result && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Generated Image</h4>
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
            <div className="text-sm text-gray-700 whitespace-pre-wrap flex justify-center">
              <img src={result.result} alt="Generated Image" className="w-1/2 h-auto" />
            </div>
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {status === 'failed' && result?.error && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-red-900 mb-3">Error Details</h4>
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="text-sm text-red-700">
              {result.error}
            </div>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!result && status !== 'failed' && (
        <div className="text-center text-gray-500 py-8">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No prompt results available yet</p>
          <p className="text-sm mt-2">This node will process prompts and generate content when executed</p>
        </div>
      )}
    </div>
  );
};

export default PromptNode;
