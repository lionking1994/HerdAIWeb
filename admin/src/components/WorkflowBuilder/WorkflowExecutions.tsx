import React, { useState, useEffect } from 'react';
import { Eye, Trash2, Clock, CheckCircle, Pause, XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { WorkflowExecution, WorkflowExecutionCounts } from '../../types';
import { workflowAPI } from '../../lib/api';

interface WorkflowExecutionsProps {
  companyId: string;
  onBack: () => void;
}

const WorkflowExecutions: React.FC<WorkflowExecutionsProps> = ({ companyId, onBack }) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [counts, setCounts] = useState<WorkflowExecutionCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [deletingExecutionId, setDeletingExecutionId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'completed' | 'cancelled'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchExecutions();
    fetchCounts();
  }, [companyId]);

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const response = await workflowAPI.getWorkflowInstances(companyId);
      if (response.success) {
        // Transform the API response to match our WorkflowExecution interface
        const transformedExecutions = response.instances?.map((execution: any) => ({
          id: execution.id,
          workflowId: execution.workflow_id,
          workflowName: execution.workflow_name,
          status: execution.status,
          currentStepId: execution.current_node_id,
          data: execution.data || {},
          startedAt: execution.started_at,
          completedAt: execution.completed_at,
          assignedTo: execution.assigned_to,
          assignedUserName: execution.assigned_user_name,
          createdAt: execution.created_at,
          updatedAt: execution.updated_at,
        })) || [];
        setExecutions(transformedExecutions);
      }
    } catch (error) {
      console.error('Error fetching workflow executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      const response = await workflowAPI.getWorkflowInstanceCounts(companyId);
      if (response.success) {
        setCounts(response.counts);
      }
    } catch (error) {
      console.error('Error fetching execution counts:', error);
    }
  };

  const handleDeleteExecution = async (execution: WorkflowExecution) => {
    const confirmationMessage = `Are you sure you want to delete this workflow execution?

This will permanently delete:
• The execution record and all its data
• All associated node execution logs
• This action cannot be undone.`;

    if (window.confirm(confirmationMessage)) {
      try {
        setDeletingExecutionId(execution.id);
        const result = await workflowAPI.deleteWorkflowInstance(execution.id);
        
        if (result.success) {
          // Refresh the executions list and counts
          fetchExecutions();
          fetchCounts();
        } else {
          alert(`Failed to delete execution: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting execution:', error);
        alert(`Error deleting execution: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setDeletingExecutionId(null);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredExecutions = executions.filter(execution => {
    const matchesSearch = execution.workflowName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || execution.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const renderExecutionDetails = (execution: WorkflowExecution) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{execution.workflowName}</h3>
        <button
          onClick={() => setSelectedExecution(null)}
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-sm font-medium text-gray-500">Status</label>
          <div className="flex items-center mt-1">
            {getStatusIcon(execution.status)}
            <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(execution.status)}`}>
              {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
            </span>
          </div>
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-500">Execution ID</label>
          <p className="text-sm text-gray-900 mt-1 font-mono">{execution.id}</p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-500">Started</label>
          <p className="text-sm text-gray-900 mt-1">
            {new Date(execution.startedAt).toLocaleString()}
          </p>
        </div>
        
        {execution.completedAt && (
          <div>
            <label className="text-sm font-medium text-gray-500">Completed</label>
            <p className="text-sm text-gray-900 mt-1">
              {new Date(execution.completedAt).toLocaleString()}
            </p>
          </div>
        )}
        
        {execution.assignedUserName && (
          <div>
            <label className="text-sm font-medium text-gray-500">Assigned To</label>
            <p className="text-sm text-gray-900 mt-1">{execution.assignedUserName}</p>
          </div>
        )}
      </div>
      
      {Object.keys(execution.data).length > 0 && (
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-500">Execution Data</label>
          <div className="mt-1 bg-gray-50 rounded-md p-3">
            <pre className="text-xs text-gray-700 overflow-auto">
              {JSON.stringify(execution.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => handleDeleteExecution(execution)}
          disabled={deletingExecutionId === execution.id}
          className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 disabled:opacity-50"
        >
          {deletingExecutionId === execution.id ? (
            <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
          ) : (
            <Trash2 className="w-4 h-4 inline mr-2" />
          )}
          Delete Execution
        </button>
      </div>
    </div>
  );

  const renderExecutionList = () => (
    <div className="space-y-4">
      {/* Header with counts */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Workflow Executions</h1>
            <p className="text-sm sm:text-base text-gray-600">Monitor and manage workflow executions</p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            Back to Workflows
          </button>
        </div>
        
        {counts && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{counts.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{counts.active}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{counts.paused}</div>
              <div className="text-sm text-gray-600">Paused</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{counts.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{counts.cancelled}</div>
              <div className="text-sm text-gray-600">Cancelled</div>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search workflow names..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={() => { fetchExecutions(); fetchCounts(); }}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Refresh
        </button>
      </div>

      {/* Executions List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading executions...</p>
        </div>
      ) : filteredExecutions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterStatus !== 'all' ? 'No executions found' : 'No executions yet'}
          </h3>
          <p className="text-gray-600">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filters to find what you\'re looking for'
              : 'Workflow executions will appear here when workflows are triggered'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredExecutions.map((execution) => (
            <div key={execution.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(execution.status)}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{execution.workflowName}</h3>
                    <p className="text-xs text-gray-500">ID: {execution.id}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(execution.status)}`}>
                    {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
                  </span>
                  
                  <div className="text-xs text-gray-500">
                    Started: {new Date(execution.startedAt).toLocaleDateString()}
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedExecution(execution)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleDeleteExecution(execution)}
                      disabled={deletingExecutionId === execution.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingExecutionId === execution.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full h-full relative overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        {selectedExecution ? renderExecutionDetails(selectedExecution) : renderExecutionList()}
      </div>
    </div>
  );
};

export default WorkflowExecutions;
