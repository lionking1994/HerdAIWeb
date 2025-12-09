import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Node, Edge } from '@xyflow/react';

export interface WorkflowVariable {
  id: string;
  name: string;
  type: 'form' | 'pdf' | 'agent' | 'api' | 'webhook' | 'custom';
  nodeId: string;
  nodeName: string;
  fieldName?: string; // For form fields
  value?: any;
  description?: string;
  isGlobal?: boolean;
}

export interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  variables: WorkflowVariable[];
  selectedNodeId: string | null;
  workflowName: string;
  workflowDescription: string;
  isDirty: boolean;
}

const initialState: WorkflowState = {
  nodes: [],
  edges: [],
  variables: [],
  selectedNodeId: null,
  workflowName: 'Untitled Workflow',
  workflowDescription: '',
  isDirty: false,
};

const workflowSlice = createSlice({
  name: 'workflow',
  initialState,
  reducers: {
    setNodes: (state, action: PayloadAction<Node[]>) => {
      state.nodes = action.payload;
      state.isDirty = true;
    },
    
    setEdges: (state, action: PayloadAction<Edge[]>) => {
      state.edges = action.payload;
      state.isDirty = true;
    },
    
    updateNode: (state, action: PayloadAction<{ nodeId: string; data: Record<string, unknown> }>) => {
      const { nodeId, data } = action.payload;
      const nodeIndex = state.nodes.findIndex(node => node.id === nodeId);
      if (nodeIndex !== -1) {
        state.nodes[nodeIndex] = {
          ...state.nodes[nodeIndex],
          data: {
            ...state.nodes[nodeIndex].data,
            ...data
          }
        };
        state.isDirty = true;
      }
    },
    
    deleteNode: (state, action: PayloadAction<string>) => {
      const nodeId = action.payload;
      state.nodes = state.nodes.filter(node => node.id !== nodeId);
      state.edges = state.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);
      // Remove variables associated with this node
      state.variables = state.variables.filter(variable => variable.nodeId !== nodeId);
      state.isDirty = true;
    },
    
    addVariable: (state, action: PayloadAction<WorkflowVariable>) => {
      state.variables.push(action.payload);
      state.isDirty = true;
    },
    
    updateVariable: (state, action: PayloadAction<{ variableId: string; updates: Partial<WorkflowVariable> }>) => {
      const { variableId, updates } = action.payload;
      const variableIndex = state.variables.findIndex(variable => variable.id === variableId);
      if (variableIndex !== -1) {
        state.variables[variableIndex] = {
          ...state.variables[variableIndex],
          ...updates
        };
        state.isDirty = true;
      }
    },
    
    deleteVariable: (state, action: PayloadAction<string>) => {
      state.variables = state.variables.filter(variable => variable.id !== action.payload);
      state.isDirty = true;
    },
    
    setSelectedNodeId: (state, action: PayloadAction<string | null>) => {
      state.selectedNodeId = action.payload;
    },
    
    setWorkflowName: (state, action: PayloadAction<string>) => {
      state.workflowName = action.payload;
      state.isDirty = true;
    },
    
    setWorkflowDescription: (state, action: PayloadAction<string>) => {
      state.workflowDescription = action.payload;
      state.isDirty = true;
    },
    
    setWorkflowData: (state, action: PayloadAction<{ nodes: Node[]; edges: Edge[]; variables?: WorkflowVariable[] }>) => {
      state.nodes = action.payload.nodes;
      state.edges = action.payload.edges;
      if (action.payload.variables) {
        state.variables = action.payload.variables;
      }
      state.isDirty = false;
    },
    
    resetWorkflow: (state) => {
      state.nodes = [];
      state.edges = [];
      state.variables = [];
      state.selectedNodeId = null;
      state.workflowName = 'Untitled Workflow';
      state.workflowDescription = '';
      state.isDirty = false;
    },
    
    markClean: (state) => {
      state.isDirty = false;
    }
  },
});

export const {
  setNodes,
  setEdges,
  updateNode,
  deleteNode,
  addVariable,
  updateVariable,
  deleteVariable,
  setSelectedNodeId,
  setWorkflowName,
  setWorkflowDescription,
  setWorkflowData,
  resetWorkflow,
  markClean
} = workflowSlice.actions;

export default workflowSlice.reducer;
