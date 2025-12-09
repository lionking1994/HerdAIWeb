import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, History, Settings, Play, Pause, Trash2, Edit, Copy, Activity } from 'lucide-react';
import { Workflow, WorkflowTemplate, WorkflowHistory } from '../types';
import WorkflowTemplates from '../components/WorkflowBuilder/WorkflowTemplates';
import WorkflowHistoryComponent from '../components/WorkflowBuilder/WorkflowHistory';
import WorkflowExecutions from '../components/WorkflowBuilder/WorkflowExecutions';
import { workflowAPI } from '../lib/api';

const Workflows: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const company = searchParams.get('company');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [view, setView] = useState<'list' | 'templates' | 'history' | 'executions'>('list');
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowHistory[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [deletingWorkflowId, setDeletingWorkflowId] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [workflowInstanceCounts, setWorkflowInstanceCounts] = useState<Record<string, number>>({});
  const [loadingInstanceCounts, setLoadingInstanceCounts] = useState(false);

  useEffect(() => {
    if (company) {
      fetchWorkflows();
      fetchTemplates();
      fetchWorkflowInstanceCounts();
    }
  }, [company]);

  const fetchWorkflows = async () => {
    if (!company) {
      console.error('No company ID provided');
      setWorkflows([]);
      setLoading(false);
      return;
    }
    
    try {
      const response = await workflowAPI.getWorkflows(company);
      // Transform the API response to match our Workflow interface
      const transformedWorkflows = response.workflows?.map((workflow: Record<string, unknown>) => ({
        id: workflow.id as string,
        name: workflow.name as string,
        description: workflow.description as string,
        companyId: workflow.company_id as string,
        steps: (workflow.nodes as Array<Record<string, unknown>>)?.map((node) => ({
          id: node.node_id as string,
          name: node.name as string,
          type: node.type as string,
          position: { x: node.position_x as number, y: node.position_y as number },
          config: node.config as Record<string, unknown>
        })) || [],
        connections: (workflow.connections as Array<Record<string, unknown>>)?.map((conn) => ({
          from: conn.from_node_id as string,
          to: conn.to_node_id as string
        })) || [],
        createdAt: workflow.created_at as string,
        updatedAt: workflow.updated_at as string,
        version: workflow.version as number,
        isActive: (workflow.is_active as boolean) || false
      })) || [];
      setWorkflows(transformedWorkflows);
      if (transformedWorkflows.length > 0) {
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/workflows/templates`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setTemplates(response.data.templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchWorkflowHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/workflows/history?company=${company}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setWorkflowHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching workflow history:', error);
      setWorkflowHistory([]);
    }
  };

  const fetchWorkflowInstanceCounts = async () => {
    if (!company) return;
    
    try {
      setLoadingInstanceCounts(true);
      const response = await workflowAPI.getWorkflowInstances(company);
      if (response.success && response.instances) {
        // Count instances per workflow
        const counts: Record<string, number> = {};
        response.instances.forEach((instance: any) => {
          const workflowId = instance.workflow_id;
          counts[workflowId] = (counts[workflowId] || 0) + 1;
        });
        setWorkflowInstanceCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching workflow instance counts:', error);
    } finally {
      setLoadingInstanceCounts(false);
    }
  };

  const handleCreateWorkflow = () => {
    navigate(`/workflow-builder?company=${company}`);
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    navigate(`/workflow-builder?company=${company}&workflowId=${workflow.id}`);
  };

  const handleViewWorkflow = (workflow: Workflow) => {
    navigate(`/workflow-builder?company=${company}&workflowId=${workflow.id}`);
  };

  const handleDuplicateWorkflow = async (workflow: Workflow) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/workflows/duplicate`,
        {
          workflowId: workflow.id,
          name: `${workflow.name} (Copy)`,
          companyId: company
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      fetchWorkflows();
      fetchWorkflowInstanceCounts();
    } catch (error) {
      console.error('Error duplicating workflow:', error);
    }
  };

  const handleToggleWorkflow = async (workflow: Workflow) => {
    try {
      const result = await workflowAPI.toggleWorkflow(workflow.id);
      
      if (result.success) {
        // Show success message
        const action = workflow.isActive ? 'deactivated' : 'activated';
        setDeleteSuccessMessage(`Workflow "${workflow.name}" has been ${action} successfully.`);
        setTimeout(() => setDeleteSuccessMessage(null), 3000);
        // Refresh the workflows list and instance counts
        fetchWorkflows();
        fetchWorkflowInstanceCounts();
      } else {
        console.error('Failed to toggle workflow:', result.error);
      }
    } catch (error) {
      console.error('Error toggling workflow:', error);
    }
  };

  const handleDeleteWorkflow = async (workflow: Workflow) => {
    const confirmationMessage = `Are you sure you want to delete "${workflow.name}"?

This will permanently delete:
• The workflow and all its configuration
• ${workflow.steps.length} workflow steps
• ${workflow.connections.length} connections
• All associated data

This action cannot be undone.`;

    if (window.confirm(confirmationMessage)) {
      try {
        setDeletingWorkflowId(workflow.id);
        const result = await workflowAPI.deleteWorkflow(workflow.id);
        
        if (result.success) {
          // Show success message
          setDeleteSuccessMessage(`Workflow "${workflow.name}" has been deleted successfully.`);
          setTimeout(() => setDeleteSuccessMessage(null), 3000);
          // Refresh the workflows list and instance counts
          fetchWorkflows();
          fetchWorkflowInstanceCounts();
        } else {
          alert(`Failed to delete workflow: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting workflow:', error);
        alert(`Error deleting workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setDeletingWorkflowId(null);
      }
    }
  };

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && workflow.isActive) ||
                         (filterStatus === 'inactive' && !workflow.isActive);
    return matchesSearch && matchesFilter;
  });

  const renderWorkflowList = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Workflows loaded successfully! Found {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Success Message */}
      {deleteSuccessMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                {deleteSuccessMessage}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage and create automated workflows for your company</p>
          {Object.keys(workflowInstanceCounts).length > 0 && (
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center">
                <Activity className="w-4 h-4 mr-1" />
                Total Instances: {Object.values(workflowInstanceCounts).reduce((sum, count) => sum + count, 0)}
              </span>
              <span>Active Workflows: {workflows.filter(w => w.isActive).length}</span>
              <button
                onClick={fetchWorkflowInstanceCounts}
                disabled={loadingInstanceCounts}
                className="text-blue-600 hover:text-blue-800 underline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh instance counts"
              >
                {loadingInstanceCounts ? 'Refreshing...' : 'Refresh Counts'}
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={() => setView('templates')}
            className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Templates
          </button>
          <button
            onClick={() => {
              fetchWorkflowHistory();
              setView('history');
            }}
            className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <History className="w-4 h-4 inline mr-2" />
            History
          </button>
          <button
            onClick={() => setView('executions')}
            className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Activity className="w-4 h-4 inline mr-2" />
            Executions
          </button>
          <button
            onClick={handleCreateWorkflow}
            className="px-3 sm:px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Create Workflow
          </button>
        </div>
      </div>

      {/* Instance Counts Summary Card */}
      {Object.keys(workflowInstanceCounts).length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-900">{workflows.length}</div>
                <div className="text-sm text-blue-700">Total Workflows</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{workflows.filter(w => w.isActive).length}</div>
                <div className="text-sm text-green-700">Active Workflows</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Object.values(workflowInstanceCounts).reduce((sum, count) => sum + count, 0)}
                </div>
                <div className="text-sm text-purple-700">Total Instances</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {Object.values(workflowInstanceCounts).filter(count => count > 0).length}
                </div>
                <div className="text-sm text-orange-700">Workflows with Instances</div>
              </div>
            </div>
            <div className="text-right text-sm text-blue-600">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
          className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Workflows Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading workflows...</p>
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterStatus !== 'all' ? 'No workflows found' : 'No workflows yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filters to find what you\'re looking for'
              : 'Create your first workflow to automate your business processes'
            }
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <div className="space-y-3">
              <button
                onClick={handleCreateWorkflow}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Create Your First Workflow
              </button>
              <div className="text-xs text-gray-500">
                Start with a template or build from scratch
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredWorkflows.map((workflow) => (
            <div key={workflow.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 space-y-2 sm:space-y-0">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">{workflow.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">{workflow.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      workflow.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {workflow.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {workflowInstanceCounts[workflow.id] > 0 && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                        {workflowInstanceCounts[workflow.id]} Instance{workflowInstanceCounts[workflow.id] !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:block space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                  <div>Steps: {workflow.steps.length}</div>
                  <div>Version: {workflow.version}</div>
                  <div className="col-span-2 sm:col-span-1">Instances: {workflowInstanceCounts[workflow.id] || 0}</div>
                  <div className="col-span-2 sm:col-span-1">Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</div>
                  <div className="col-span-2 sm:col-span-1">Created: {new Date(workflow.createdAt).toLocaleDateString()}</div>
                </div>

                <div className="flex justify-between items-center mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
                  <div className="flex space-x-1 sm:space-x-2">
                    <button
                      onClick={() => handleEditWorkflow(workflow)}
                      className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicateWorkflow(workflow)}
                      className="p-1.5 sm:p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleWorkflow(workflow)}
                      className="p-1.5 sm:p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md"
                      title={workflow.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {workflow.isActive ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleDeleteWorkflow(workflow)}
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                    title="Delete"
                    disabled={deletingWorkflowId === workflow.id}
                  >
                    {deletingWorkflowId === workflow.id ? (
                      <svg className="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (view) {
      case 'templates':
        return (
          <WorkflowTemplates
            templates={templates}
            companyId={company || ''}
            onUseTemplate={(template) => {
              // Navigate to workflow builder with template data
              const templateData = encodeURIComponent(JSON.stringify({
                ...template,
                id: '',
                companyId: company || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
                isActive: false,
                template: false,
                connections: []
              }));
              navigate(`/workflow-builder?company=${company}&template=${templateData}`);
            }}
            onBack={() => setView('list')}
          />
        );
      case 'history':
        return (
          <WorkflowHistoryComponent
            history={workflowHistory}
            workflowId=""
            onBack={() => setView('list')}
          />
        );
      case 'executions':
        return (
          <WorkflowExecutions
            companyId={company || ''}
            onBack={() => setView('list')}
          />
        );
      default:
        return renderWorkflowList();
    }
  };

  return (
    <div className="w-full h-full relative overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        {renderContent()}
      </div>
    </div>
  );
};

export default Workflows; 