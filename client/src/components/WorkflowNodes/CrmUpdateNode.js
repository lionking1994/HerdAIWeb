import React from 'react';

const CrmUpdateNode = ({ nodeInstance }) => {
  const { node_type, node_name, data, result, status, started_at, completed_at } = nodeInstance;

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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {node_name || `${node_type} Node`}
        </h3>
        <p className="text-sm text-gray-600">
          Node type: {node_type}
        </p>
      </div>
      
      {/* Status Information */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${
            status === 'completed' ? 'bg-green-500' 
            : status === 'failed' ? 'bg-red-500'
            : status === 'waiting_user_input' ? 'bg-yellow-500'
            : 'bg-blue-500'
          }`}></div>
          <span className="font-medium text-gray-900">
            Status: {status}
          </span>
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
      
      <div className="mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <a href={`/task-details?id=${data.taskId}`} className=' underline'>Go to task Details.</a>
        </div>
      </div>

      {/* Data Section */}
      {/* {data && Object.keys(data).length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Input Data</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      )} */}
      
      {/* Results Section */}
      {result && Object.keys(result).length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Output Results</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {/* {(!data || Object.keys(data).length === 0) && 
       (!result || Object.keys(result).length === 0) && (
        <div className="text-center text-gray-500 py-8">
          <p>No data available for this node</p>
        </div>
      )} */}
    </div>
  );
};

export default CrmUpdateNode;
