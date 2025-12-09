import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Workflow API functions
export const workflowAPI = {
  // Add a new workflow
  addWorkflow: async (workflowData: {
    workflow: {
      name: string;
      description?: string;
      version?: string;
      company_id: string;
    };
    nodes: Array<{
      id: string;
      type: string;
      name: string;
      position: { x: number; y: number };
      config: Record<string, unknown>;
    }>;
    connections: Array<{
      id: string;
      from_node: string;
      to_node: string;
      from_port?: string;
      to_port?: string;
    }>;
    variables?: {
      global: Record<string, unknown>[];
      flow: Record<string, unknown>[];
    };
    settings?: {
      enabled: boolean;
      max_executions: number;
      timeout: {
        duration: number;
        unit: string;
      };
      error_handling: {
        strategy: string;
        max_retries: number;
        notification: boolean;
      };
    };
  }) => {
    console.log('API: Sending workflow data with company_id:', workflowData.workflow.company_id);
    const response = await api.post('/workflow/workflows', workflowData);
    return response.data;
  },

  // Get workflows for a company
  getWorkflows: async (companyId: string) => {
    console.log('API: Fetching workflows for company_id:', companyId);
    const response = await api.get(`/workflow/workflows?company=${companyId}`);
    return response.data;
  },

  // Get a specific workflow
  getWorkflow: async (workflowId: string) => {
    const response = await api.get(`/workflow/workflows/${workflowId}`);
    return response.data;
  },


  // Get all user of admin by company id
   getAllUserBycompanyId: async (companyId: string) => {
    console.log('API: Fetching workflows for company_id:', companyId);
    const response = await api.get(`/company/user-companyId?companyId=${companyId}`);
    return response.data;
  },

  // Update a workflow
  updateWorkflow: async (workflowId: string, updateData: {
    workflow: {
      name: string;
      description?: string;
      version?: string;
    };
    nodes: Array<{
      id: string;
      type: string;
      name: string;
      position: { x: number; y: number };
      config: Record<string, unknown>;
    }>;
    connections: Array<{
      id: string;
      from_node: string;
      to_node: string;
      from_port?: string;
      to_port?: string;
    }>;
  }) => {
    console.log('API: Updating workflow with ID:', workflowId);
    const response = await api.put(`/workflow/workflows/${workflowId}`, updateData);
    return response.data;
  },

  // Delete a workflow
  deleteWorkflow: async (workflowId: string) => {
    const response = await api.delete(`/workflow/workflows/${workflowId}`);
    return response.data;
  },

  // Execute a workflow
  executeWorkflow: async (workflowId: string) => {
    const response = await api.post(`/workflow/workflows/${workflowId}/execute`);
    return response.data;
  },

  // Toggle workflow active status
  toggleWorkflow: async (workflowId: string) => {
    console.log('API: Toggling workflow with ID:', workflowId);
    const response = await api.patch(`/workflow/workflows/${workflowId}/toggle`);
    return response.data;
  },

  // Get workflow instances for a company
  getWorkflowInstances: async (companyId: string) => {
    const response = await api.get(`/workflow/company-instances?company=${companyId}`);
    return response.data;
  },

  // Get workflow instance counts for a company
  getWorkflowInstanceCounts: async (companyId: string) => {
    const response = await api.get(`/workflow/company-instance-counts?company=${companyId}`);
    return response.data;
  },

  // Delete a workflow instance
  deleteWorkflowInstance: async (instanceId: string) => {
    const response = await api.delete(`/workflow/instances/${instanceId}`);
    return response.data;
  },

  // Upload a PDF for PDF node
  uploadPdf: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post('/upload/pdf', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { success: boolean; url?: string; key?: string; message?: string };
  },
};

export default api; 