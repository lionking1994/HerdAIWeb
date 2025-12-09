import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Edit, X, Check, AlertCircle, Settings, Play, Pause, Copy, Trash2 } from 'lucide-react';
import axios from 'axios';
import { Workflow } from '../types';
import { workflowAPI } from '../lib/api';

const WorkflowDetails: React.FC = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [searchParams] = useSearchParams();
  const company = searchParams.get('company');
  const navigate = useNavigate();
  
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: false,
    version: '1.0.0'
  });

  useEffect(() => {
    if (workflowId && company) {
      fetchWorkflowDetails();
    }
  }, [workflowId, company]);

  const fetchWorkflowDetails = async () => {
    if (!workflowId || !company) {
      setError('Missing workflow ID or company ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await workflowAPI.getWorkflow(workflowId);
      
      if (response.workflow) {
        const workflowData = response.workflow;
        const transformedWorkflow: Workflow = {
          id: workflowData.id as string,
          name: workflowData.name as string,
          description: workflowData.description as string,
          companyId: workflowData.company_id as string,
          steps: (workflowData.nodes as Array<Record<string, unknown>>)?.map((node) => ({
            id: node.node_id as string,
            name: node.name as string,
            type: (node.type as string) as 'trigger' | 'form' | 'approval' | 'condition' | 'update' | 'notification' | 'delay' | 'webhook' | 'api' | 'agent',
            description: node.description as string,
            assigneeType: 'role' as const,
            assigneeRole: '',
            assigneePerson: '',
            dueDate: '',
            priority: 'medium' as const,
            dependencies: [],
            position: { x: node.position_x as number, y: node.position_y as number },
            config: node.config as Record<string, unknown>
          })) || [],
          connections: (workflowData.connections as Array<Record<string, unknown>>)?.map((conn) => ({
            id: conn.id as string,
            sourceStepId: conn.from_node_id as string,
            targetStepId: conn.to_node_id as string,
            condition: conn.condition as string
          })) || [],
          createdAt: workflowData.created_at as string,
          updatedAt: workflowData.updated_at as string,
          version: workflowData.version as number,
          isActive: (workflowData.is_active as boolean) || false
        };
        
        setWorkflow(transformedWorkflow);
        setFormData({
          name: transformedWorkflow.name,
          description: transformedWorkflow.description || '',
          isActive: transformedWorkflow.isActive,
          version: transformedWorkflow.version.toString()
        });
      } else {
        setError(response.error || 'Failed to fetch workflow details');
      }
    } catch (error) {
      console.error('Error fetching workflow details:', error);
      setError('Failed to fetch workflow details');
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{
    console.log(workflow)
  },[workflow])
  const handleSave = async () => {
    if (!workflow) return;

    try {
      setSaving(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/workflows/${workflowId}`,
        {
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive,
          version: formData.version
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.status === 200) {
        setSuccessMessage('Workflow details updated successfully');
        setIsEditing(false);
        
        // Update the workflow state
        setWorkflow(prev => prev ? {
          ...prev,
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive,
          version: parseInt(formData.version) || prev.version,
          updatedAt: new Date().toISOString()
        } : null);
        
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error updating workflow:', error);
      setError('Failed to update workflow details');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (workflow) {
      setFormData({
        name: workflow.name,
        description: workflow.description || '',
        isActive: workflow.isActive,
        version: workflow.version.toString()
      });
    }
    setIsEditing(false);
    setError(null);
  };

  const handleBack = () => {
    navigate(`/workflows?company=${company}`);
  };

  const handleToggleWorkflow = async () => {
    if (!workflow) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/workflows/${workflowId}/toggle`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      // Refresh workflow data
      fetchWorkflowDetails();
      setSuccessMessage(`Workflow ${workflow.isActive ? 'deactivated' : 'activated'} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error toggling workflow:', error);
      setError('Failed to toggle workflow status');
    }
  };

  const handleDuplicateWorkflow = async () => {
    if (!workflow) return;
    
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
      setSuccessMessage('Workflow duplicated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error duplicating workflow:', error);
      setError('Failed to duplicate workflow');
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!workflow) return;
    
    const confirmationMessage = `Are you sure you want to delete "${workflow.name}"?

This will permanently delete:
• The workflow and all its configuration
• ${workflow.steps.length} workflow steps
• ${workflow.connections.length} connections
• All associated data

This action cannot be undone.`;

    if (window.confirm(confirmationMessage)) {
      try {
        const result = await workflowAPI.deleteWorkflow(workflow.id);
        
        if (result.success) {
          setSuccessMessage(`Workflow "${workflow.name}" has been deleted successfully.`);
          setTimeout(() => {
            setSuccessMessage(null);
            handleBack();
          }, 2000);
        } else {
          setError(`Failed to delete workflow: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting workflow:', error);
        setError(`Error deleting workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading workflow details...</p>
        </div>
      </div>
    );
  }

  if (error && !workflow) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Workflow</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Workflow Not Found</h3>
          <p className="text-gray-600 mb-4">The requested workflow could not be found.</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Workflow</h1>
              <p className="text-sm text-gray-600">Modify workflow configuration and settings</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <X className="w-4 h-4 inline mr-2" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <svg className="animate-spin h-4 w-4 inline mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Save className="w-4 h-4 inline mr-2" />
                  )}
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <Edit className="w-4 h-4 inline mr-2" />
                Edit Details
              </button>
            )}
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Details Form */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
          </div>
          
          <div className="px-6 py-6 space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Workflow Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter workflow name"
                />
              ) : (
                <p className="text-sm text-gray-900">{workflow.name}</p>
              )}
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              {isEditing ? (
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter workflow description"
                />
              ) : (
                <p className="text-sm text-gray-900">{workflow.description || 'No description provided'}</p>
              )}
            </div>

            {/* Version Field */}
            <div>
              <label htmlFor="version" className="block text-sm font-medium text-gray-700 mb-2">
                Version
              </label>
              {isEditing ? (
                <input
                  type="text"
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 1.0.0"
                />
              ) : (
                <p className="text-sm text-gray-900">{workflow.version}</p>
              )}
            </div>

            {/* Status Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              {isEditing ? (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                    Active
                  </label>
                </div>
              ) : (
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  workflow.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {workflow.isActive ? 'Active' : 'Inactive'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Workflow Statistics */}
        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Workflow Statistics</h3>
          </div>
          
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{workflow.steps.length}</div>
                <div className="text-sm text-gray-600">Total Steps</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{workflow.connections.length}</div>
                <div className="text-sm text-gray-600">Connections</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{workflow.version}</div>
                <div className="text-sm text-gray-600">Version</div>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Metadata</h3>
          </div>
          
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                <p className="text-sm text-gray-900">{new Date(workflow.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                <p className="text-sm text-gray-900">{new Date(workflow.updatedAt).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workflow ID</label>
                <p className="text-sm text-gray-900 font-mono">{workflow.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company ID</label>
                <p className="text-sm text-gray-900 font-mono">{workflow.companyId}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Management Actions */}
        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Workflow Actions</h3>
          </div>
          
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => navigate(`/workflows/${workflowId}/builder?company=${company}`)}
                className="flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
              >
                <Settings className="w-4 h-4 mr-2" />
                Open Builder
              </button>
              
              <button
                onClick={() => handleToggleWorkflow()}
                className="flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
              >
                {workflow.isActive ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {workflow.isActive ? 'Deactivate' : 'Activate'}
              </button>
              
              <button
                onClick={() => handleDuplicateWorkflow()}
                className="flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </button>
              
              <button
                onClick={() => handleDeleteWorkflow()}
                className="flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={handleBack}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            Back to Workflows
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={() => navigate(`/workflows?company=${company}`)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              View All Workflows
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDetails; 