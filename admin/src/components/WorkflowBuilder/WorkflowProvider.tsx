import React, { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store } from '../../store';
import { 
  setWorkflowData, 
  setNodes, 
  setEdges, 
  updateNode,
  deleteNode,
  setSelectedNodeId,
  setWorkflowName,
  setWorkflowDescription,
  markClean
} from '../../store/slices/workflowSlice';
import { useWorkflowVariables } from '../../hooks/useWorkflowVariables';
import { Node, Edge } from '@xyflow/react';

interface WorkflowProviderProps {
  children: React.ReactNode;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  workflowName?: string;
  workflowDescription?: string;
}

const WorkflowProviderInner: React.FC<WorkflowProviderProps> = ({
  children,
  initialNodes = [],
  initialEdges = [],
  workflowName = 'Untitled Workflow',
  workflowDescription = ''
}) => {
  const dispatch = useDispatch();
  const { nodes, edges, selectedNodeId, isDirty } = useSelector((state: any) => state.workflow);
  const { generateVariablesFromNodes } = useWorkflowVariables();

  // Initialize workflow data
  useEffect(() => {
    if (initialNodes.length > 0 || initialEdges.length > 0) {
      dispatch(setWorkflowData({
        nodes: initialNodes,
        edges: initialEdges,
        variables: []
      }));
    }
    
    if (workflowName) {
      dispatch(setWorkflowName(workflowName));
    }
    
    if (workflowDescription) {
      dispatch(setWorkflowDescription(workflowDescription));
    }
  }, [dispatch, initialNodes, initialEdges, workflowName, workflowDescription]);

  // Generate variables when nodes change
  useEffect(() => {
    if (nodes.length > 0) {
      const newVariables = generateVariablesFromNodes();
      // Update variables in the store
      // This would be handled by the variable generation logic
    }
  }, [nodes, generateVariablesFromNodes]);

  // Expose workflow methods to children via context
  const workflowMethods = {
    updateNode: (nodeId: string, data: Record<string, unknown>) => {
      dispatch(updateNode({ nodeId, data }));
    },
    deleteNode: (nodeId: string) => {
      dispatch(deleteNode(nodeId));
    },
    setSelectedNode: (nodeId: string | null) => {
      dispatch(setSelectedNodeId(nodeId));
    },
    setNodes: (newNodes: Node[]) => {
      dispatch(setNodes(newNodes));
    },
    setEdges: (newEdges: Edge[]) => {
      dispatch(setEdges(newEdges));
    },
    markClean: () => {
      dispatch(markClean());
    }
  };

  return (
    <WorkflowContext.Provider value={workflowMethods}>
      {children}
    </WorkflowContext.Provider>
  );
};

// Create context for workflow methods
const WorkflowContext = React.createContext<{
  updateNode: (nodeId: string, data: Record<string, unknown>) => void;
  deleteNode: (nodeId: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setNodes: (newNodes: Node[]) => void;
  setEdges: (newEdges: Edge[]) => void;
  markClean: () => void;
} | null>(null);

export const useWorkflowMethods = () => {
  const context = React.useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflowMethods must be used within a WorkflowProvider');
  }
  return context;
};

const WorkflowProvider: React.FC<WorkflowProviderProps> = (props) => {
  return (
    <Provider store={store}>
      <WorkflowProviderInner {...props} />
    </Provider>
  );
};

export default WorkflowProvider;
