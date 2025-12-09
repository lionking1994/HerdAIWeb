import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  useReactFlow,
  NodeTypes,
  EdgeTypes,
  ConnectionLineType,
  ReactFlowProvider,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '../ui/button';
import { 
  Trash2, 
  Settings, 
  Save,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';

import PlusButtonNode from './PlusButtonNode';
import {ConditionNode} from './nodes/condition-node';
import EndNode from './nodes/end-node';

// Define types for node data
interface WorkflowNodeData {
  label: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  description?: string;
  config?: Record<string, unknown>;
  onDelete?: () => void;
  onConfigOpen?: () => void;
  position?: { x: number; y: number };
  order?: number;
}

interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  config?: Record<string, unknown>;
  position?: { x: number; y: number };
}

interface WorkflowConnection {
  from: string;
  to: string;
}

interface Workflow {
  id?: string;
  name?: string;
  steps?: WorkflowStep[];
  connections?: WorkflowConnection[];
}

// Modern Professional Node Component
const WorkflowStepNode = ({ data, selected }: { data: WorkflowNodeData; selected: boolean }) => {
  const deleteNode = () => {
    if (data?.onDelete) {
      data.onDelete();
    }
  };

  const openConfig = () => {
    if (data?.onConfigOpen) {
      data.onConfigOpen();
    }
  };

  const getNodeStyle = (type: string) => {
    const styles = {
      trigger: {
        bg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
        border: 'border-indigo-200/20',
        shadow: 'shadow-indigo-500/25',
        icon: '⚡',
        accent: 'from-indigo-400 to-purple-500'
      },
      form: {
        bg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
        border: 'border-blue-200/20',
        shadow: 'shadow-blue-500/25',
        icon: '📋',
        accent: 'from-blue-400 to-cyan-500'
      },
      api_call: {
        bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
        border: 'border-emerald-200/20',
        shadow: 'shadow-emerald-500/25',
        icon: '🔗',
        accent: 'from-emerald-400 to-teal-500'
      },
      approval: {
        bg: 'bg-gradient-to-br from-amber-500 to-orange-600',
        border: 'border-amber-200/20',
        shadow: 'shadow-amber-500/25',
        icon: '✓',
        accent: 'from-amber-400 to-orange-500'
      },
      condition: {
        bg: 'bg-gradient-to-br from-rose-500 to-pink-600',
        border: 'border-rose-200/20',
        shadow: 'shadow-rose-500/25',
        icon: '?',
        accent: 'from-rose-400 to-pink-500'
      },
      task_update: {
        bg: 'bg-gradient-to-br from-violet-500 to-purple-600',
        border: 'border-violet-200/20',
        shadow: 'shadow-violet-500/25',
        icon: '📝',
        accent: 'from-violet-400 to-purple-500'
      },
      email: {
        bg: 'bg-gradient-to-br from-cyan-500 to-blue-600',
        border: 'border-cyan-200/20',
        shadow: 'shadow-cyan-500/25',
        icon: '✉',
        accent: 'from-cyan-400 to-blue-500'
      },
      notification: {
        bg: 'bg-gradient-to-br from-orange-500 to-red-600',
        border: 'border-orange-200/20',
        shadow: 'shadow-orange-500/25',
        icon: '🔔',
        accent: 'from-orange-400 to-red-500'
      },
      delay: {
        bg: 'bg-gradient-to-br from-slate-500 to-gray-600',
        border: 'border-slate-200/20',
        shadow: 'shadow-slate-500/25',
        icon: '⏱',
        accent: 'from-slate-400 to-gray-500'
      },
      webhook: {
        bg: 'bg-gradient-to-br from-green-500 to-emerald-600',
        border: 'border-green-200/20',
        shadow: 'shadow-green-500/25',
        icon: '🌐',
        accent: 'from-green-400 to-emerald-500'
      },
      agent: {
        bg: 'bg-gradient-to-br from-purple-500 to-violet-600',
        border: 'border-purple-200/20',
        shadow: 'shadow-purple-500/25',
        icon: '🤖',
        accent: 'from-purple-400 to-violet-500'
      }
    };
    
    return styles[type as keyof typeof styles] || styles.form;
  };

  const nodeStyle = getNodeStyle(data.type);
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isError = data.status === 'error';

  return (
    <div className={`relative group ${selected ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-gray-900' : ''}`}>
      {/* Modern Professional Node */}
      <div className={`
        relative w-72 h-24 rounded-2xl ${nodeStyle.bg} ${nodeStyle.border}
        shadow-lg ${nodeStyle.shadow} hover:shadow-2xl transition-all duration-300
        transform hover:scale-102 cursor-pointer backdrop-blur-sm
        flex items-center justify-between px-6 py-4
        ${isRunning ? 'animate-pulse' : ''}
        ${isCompleted ? 'ring-2 ring-emerald-400/60' : ''}
        ${isError ? 'ring-2 ring-red-400/60' : ''}
        border border-white/10
      `}>
        {/* Icon and Content */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Icon Container */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <div className="text-2xl text-white drop-shadow-sm">
                {nodeStyle.icon}
              </div>
            </div>
            {/* Status Indicator */}
            <div className="absolute -top-1 -right-1">
              {isRunning && (
                <div className="w-3 h-3 bg-white rounded-full animate-pulse shadow-sm" />
              )}
              {isCompleted && (
                <div className="w-3 h-3 bg-emerald-300 rounded-full shadow-sm" />
              )}
              {isError && (
                <div className="w-3 h-3 bg-red-300 rounded-full shadow-sm" />
              )}
            </div>
          </div>

          {/* Text Content */}
          <div className="text-white min-w-0 flex-1 overflow-hidden">
            <div className="font-semibold text-base leading-tight truncate">
              {data.label}
            </div>
            {data.description && (
              <div className="text-sm opacity-90 leading-tight mt-1 truncate">
                {data.description}
              </div>
            )}
          </div>
        </div>

        {/* Order Badge */}
        <div className="absolute -top-3 -left-3 w-7 h-7 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-full flex items-center justify-center text-xs font-bold text-gray-700 shadow-lg">
          {data.order || 1}
        </div>

        {/* Action Buttons - Elegant hover reveal */}
        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2 transform translate-x-2 group-hover:translate-x-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openConfig();
            }}
            className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105 backdrop-blur-sm border border-white/20"
          >
            <Settings className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
            }}
            className="w-8 h-8 bg-white/15 hover:bg-red-400/30 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105 backdrop-blur-sm border border-white/20"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Elegant Connector Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-5 h-5 bg-white/90 backdrop-blur-sm border-2 border-gray-300/50 shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 rounded-full"
        style={{ top: -10 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-5 h-5 bg-white/90 backdrop-blur-sm border-2 border-gray-300/50 shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 rounded-full"
        style={{ bottom: -10 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-5 h-5 bg-white/90 backdrop-blur-sm border-2 border-gray-300/50 shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 rounded-full"
        style={{ left: -10 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-5 h-5 bg-white/90 backdrop-blur-sm border-2 border-gray-300/50 shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 rounded-full"
        style={{ right: -10 }}
      />
    </div>
  );
};

// Node Types
const nodeTypes: NodeTypes = {
  workflowStep: WorkflowStepNode,
  plusButton: PlusButtonNode,
  conditionNode: ConditionNode,
  endNode: EndNode,
};

// Edge Types - Updated with EdgeWithPlusButton
const edgeTypes: EdgeTypes = {
  plusEdge: EdgeWithPlusButton,
};

interface WorkflowCanvasProps {
  workflow?: Workflow;
  onWorkflowChange?: (workflow: Workflow) => void;
  readOnly?: boolean;
  zoomLevel?: number;
  onStepSelect?: (stepId: string) => void;
  onStepUpdate?: (step: WorkflowStep) => void;
  onStepDelete?: (stepId: string) => void;
  onConnectionAdd?: (connection: WorkflowConnection) => void;
  onConnectionDelete?: (connectionId: string) => void;
}

const WorkflowCanvasInner: React.FC<WorkflowCanvasProps> = ({
  workflow,
  onWorkflowChange,
  readOnly = false,
}) => {
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [configuringNode, setConfiguringNode] = useState<Node | null>(null);
  const [isRunning] = useState(false);

  
  const { getViewport } = useReactFlow();

  // Helper function to calculate center position of canvas
  const getCanvasCenter = useCallback(() => {
    const viewport = getViewport();
    const canvasElement = document.querySelector('.react-flow__viewport');
    if (canvasElement) {
      const rect = canvasElement.getBoundingClientRect();
      return {
        x: (rect.width / 2) - (viewport.x / viewport.zoom),
        y: (rect.height / 2) - (viewport.y / viewport.zoom)
      };
    }
    // Fallback to default center if canvas element not found
    return { x: 400, y: 300 };
  }, [getViewport]);



  // State to track if canvas is ready
  const [canvasReady, setCanvasReady] = useState(false);

  // Effect to set canvas ready after initial render
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCanvasReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Node configuration functions
  const openNodeConfig = useCallback((node: Node) => {
    setConfiguringNode(node);
    setConfigDrawerOpen(true);
  }, []);

  const closeNodeConfig = useCallback(() => {
    setConfigDrawerOpen(false);
    setConfiguringNode(null);
  }, []);

  // Helper functions to get node type information
  const getNodeTypeLabel = useCallback((type: string) => {
    const typeMap: { [key: string]: string } = {
      trigger: 'Trigger',
      form: 'Form',
      approval: 'Approval',
      agent: 'AI Agent',
      email: 'Email',
      condition: 'Condition',
      delay: 'Delay',
      webhook: 'Webhook',
      api_call: 'API Call',
      task_update: 'Task Update',
      notification: 'Send notification'
    };
    return typeMap[type] || 'New Step';
  }, []);

  const getNodeTypeDescription = useCallback((type: string) => {
    const descMap: { [key: string]: string } = {
      trigger: 'Start workflow on event',
      form: 'Collect data from users',
      approval: 'Require approval from assignee',
      agent: 'Automated AI processing',
      email: 'Send email notifications',
      condition: 'Branch workflow logic',
      delay: 'Wait for time period',
      webhook: 'Call external webhook',
      api_call: 'Make API request',
      task_update: 'Update task information',
      notification: 'Send notification'
    };
    return descMap[type] || 'Configure this step';
  }, []);





  // Professional relative positioning utilities
  const PositionCalculator = React.useMemo(() => ({
    // Calculate center-aligned position relative to a reference point
    getCenterAlignedPosition: (referencePosition: { x: number; y: number }, nodeDimensions: { width: number; height: number }) => {
      return {
        x: referencePosition.x - (nodeDimensions.width / 2),
        y: referencePosition.y - (nodeDimensions.height / 2)
      };
    },

    // Calculate position with custom offset
    getOffsetPosition: (referencePosition: { x: number; y: number }, offset: { x: number; y: number }) => {
      return {
        x: referencePosition.x + offset.x,
        y: referencePosition.y + offset.y
      };
    },

    // Get default node dimensions
    getDefaultNodeDimensions: () => ({
      width: 288, // w-72 = 18rem = 288px
      height: 96  // h-24 = 6rem = 96px
    }),

    // Calculate optimal spacing between nodes
    getOptimalSpacing: () => ({
      vertical: 200,
      horizontal: 50
    }),

    // Calculate position for a node at a specific order index
    getOrderedPosition: (index: number, centerX: number = 400) => {
      const spacing = 240; // Increased spacing for larger nodes
      const startY = 100;
      return {
        x: centerX - 144, // Center the node (288px width / 2)
        y: startY + (index * spacing)
      };
    },

    // Get the order index of a node based on its position
    getNodeOrder: (nodePosition: { x: number; y: number }) => {
      const startY = 100;
      const spacing = 240; // Updated to match new spacing
      return Math.round((nodePosition.y - startY) / spacing);
    }
  }), []);

  // Function to automatically arrange all workflow nodes in order
  const arrangeNodesInOrder = useCallback(() => {
    setNodes((nds) => {
      const workflowNodes = nds.filter(node => node.type === 'workflowStep');
      const plusButtonNodes = nds.filter(node => node.type === 'plusButton');
      
      // Sort workflow nodes by their current Y position to determine order
      const sortedNodes = [...workflowNodes].sort((a, b) => {
        const orderA = PositionCalculator.getNodeOrder(a.position);
        const orderB = PositionCalculator.getNodeOrder(b.position);
        return orderA - orderB;
      });
      
      // Reposition all workflow nodes in order
      const updatedWorkflowNodes = sortedNodes.map((node, index) => ({
        ...node,
        position: PositionCalculator.getOrderedPosition(index),
        data: {
          ...node.data,
          order: index + 1
        }
      }));
      
      // Update plus button positions
      const updatedPlusButtonNodes = plusButtonNodes.map(node => {
        if (node.data.isFixedButton) {
          // Keep fixed button in top-left corner
          return {
            ...node,
            position: { x: 50, y: 50 }
          };
        } else if (node.data.isStartButton) {
          // Position start button before the first workflow node
          return {
            ...node,
            position: PositionCalculator.getOrderedPosition(-1)
          };
        } else {
          // Position default button after the last workflow node
          return {
            ...node,
            position: PositionCalculator.getOrderedPosition(updatedWorkflowNodes.length)
          };
        }
      });
      
      return [...updatedWorkflowNodes, ...updatedPlusButtonNodes];
    });
  }, [setNodes, PositionCalculator]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      // Remove the node and its trailing plus button
      const filteredNodes = nds.filter((node) => 
        node.id !== nodeId 
      );
      
      // Check if there are any workflow steps left
      const workflowSteps = filteredNodes.filter(node => node.type === 'workflowStep');
      
      // If no workflow steps remain, return empty array
      if (workflowSteps.length === 0) {
        return [];
      }
      
      return filteredNodes;
    });
    
    // Handle edge reconnection when deleting a middle step
    setEdges((eds) => {
      // Find edges connected to the deleted node
      const incomingEdges = eds.filter(edge => edge.target === nodeId);
      const outgoingEdges = eds.filter(edge => edge.source === nodeId);
      
      // Remove all edges connected to the deleted node
      const edgesWithoutDeletedNode = eds.filter(edge => 
        edge.source !== nodeId && edge.target !== nodeId
      );
      
      // If this was a middle step (has both incoming and outgoing edges), reconnect them
      if (incomingEdges.length > 0 && outgoingEdges.length > 0) {
        const newEdges = [...edgesWithoutDeletedNode];
        
        // For each incoming edge, connect it to each outgoing edge's target
        incomingEdges.forEach(incomingEdge => {
          outgoingEdges.forEach(outgoingEdge => {
            const newEdgeId = `edge-${incomingEdge.source}-${outgoingEdge.target}`;
            
            // Only add the edge if it doesn't already exist
            if (!newEdges.some(edge => edge.id === newEdgeId)) {
              newEdges.push({
                id: newEdgeId,
                source: incomingEdge.source,
                target: outgoingEdge.target,
                type: 'plusEdge',
                data: {
                  onInsertNode: () => {
                    // This will be replaced by the actual function later
                    console.log('insertNodeOnEdge called but not yet defined');
                  },
                  onDelete: () => {
                    // This will be replaced by the actual function later
                    console.log('deleteEdge called but not yet defined');
                  }
                }
              });
            }
          });
        });
        
        return newEdges;
      }
      
      // If it was not a middle step, just remove the edges
      return edgesWithoutDeletedNode;
    });
    
    // Automatically arrange remaining nodes after deletion
    setTimeout(() => {
      arrangeNodesInOrder();
    }, 50);
  }, [setNodes, setEdges, getCanvasCenter, arrangeNodesInOrder]);



  // Function to add a new node from the plus button
  const addNodeFromPlusButton = useCallback((nodeType: string, relativePosition: { x: number; y: number }) => {
    const newNodeId = `step-${Date.now()}`;
    
    setNodes((nds) => {
      // Find the current plus button from the current nodes state
      const plusButtonNode = nds.find(node => node.type === 'plusButton');
      
      if (!plusButtonNode) {
        console.warn('No plus button found for positioning new node');
        return nds;
      }

      // Calculate node position - for branching workflows, position near the plus button
      let newNodePosition: { x: number; y: number };
      
      if (plusButtonNode.data.isFixedButton) {
        // For fixed button, position new node in the center of the canvas
        const centerX = 400;
        const centerY = 300;
        newNodePosition = {
          x: centerX - 144, // Center the node (288px width / 2)
          y: centerY - 48   // Center the node (96px height / 2)
        };
      } else if (relativePosition.x === 0 && relativePosition.y === 0) {
        // Default center-aligned positioning
        const nodeDimensions = PositionCalculator.getDefaultNodeDimensions();
        newNodePosition = PositionCalculator.getCenterAlignedPosition(
          plusButtonNode.position,
          nodeDimensions
        );
      } else {
        // Custom offset positioning
        newNodePosition = PositionCalculator.getOffsetPosition(
          plusButtonNode.position,
          relativePosition
        );
      }
      
      const newNode: Node = {
        id: newNodeId,
        type: 'workflowStep',
        position: newNodePosition,
        data: {
          label: getNodeTypeLabel(nodeType),
          type: nodeType,
          status: 'pending',
          description: getNodeTypeDescription(nodeType),
          onDelete: () => deleteNode(newNodeId),
          onConfigOpen: () => {
            setTimeout(() => {
              const createdNode = nds.find(n => n.id === newNodeId);
              if (createdNode) openNodeConfig(createdNode);
            }, 100);
          }
        },
        draggable: true,
      };

      const updatedNodes = [...nds, newNode];
      
      // Auto-arrange nodes after adding from fixed button
      setTimeout(() => {
        arrangeNodesInOrder();
      }, 100);
      
      return updatedNodes;
    });
  }, [setNodes, deleteNode, getNodeTypeLabel, getNodeTypeDescription, PositionCalculator, arrangeNodesInOrder, openNodeConfig]);


  




  // Initialize workflow data with fixed plus button in top left
  React.useEffect(() => {
    if (!canvasReady) return; // Wait for canvas to be ready

    if (workflow) {
      // Convert workflow data to nodes and edges
      const workflowNodes: Node[] = workflow.steps?.map((step: WorkflowStep, index: number) => ({
        id: step.id || `step-${index}`,
        type: 'workflowStep',
        position: step.position || { x: index * 300, y: 100 },
        data: {
          label: step.name || `Step ${index + 1}`,
          type: step.type || 'action',
          status: step.status || 'pending',
          description: step.description,
          config: step.config,
          onDelete: () => deleteNode(step.id || `step-${index}`),

        },
        draggable: true,
      })) || [];

      const workflowEdges: Edge[] = workflow.connections?.map((conn: WorkflowConnection, index: number) => ({
        id: `edge-${index}`,
        source: conn.from,
        target: conn.to,
        type: 'plusEdge',
        data: {
          onInsertNode: insertNodeOnEdge,
          onDelete: () => deleteEdge(`edge-${index}`)
        }
      })) || [];

      // Add fixed plus button in top-left corner
      const fixedPlusButton: Node = {
        id: 'fixed-plus-button',
        type: 'plusButton',
        position: { x: 50, y: 50 },
        data: {
          onAddNode: addNodeFromPlusButton,
          isFixedButton: true,
        },
        draggable: false,
      };

      setNodes([...workflowNodes, fixedPlusButton]);
      setEdges(workflowEdges);
      
      // Automatically arrange nodes after loading workflow data
      setTimeout(() => {
        arrangeNodesInOrder();
      }, 100);
    } else {
      // Initialize with empty canvas and fixed plus button when no workflow is provided
      const fixedPlusButton: Node = {
        id: 'fixed-plus-button',
        type: 'plusButton',
        position: { x: 50, y: 50 },
        data: {
          onAddNode: addNodeFromPlusButton,
          isFixedButton: true,
        },
        draggable: false,
      };
      
      setNodes([fixedPlusButton]);
      setEdges([]);
    }
  }, [workflow, setNodes, setEdges, getCanvasCenter, canvasReady, deleteNode, PositionCalculator, arrangeNodesInOrder, addNodeFromPlusButton]);



  // // Custom handler to update plus button positions when nodes are moved
  // const handleNodesChange = useCallback((changes: NodeChange[]) => {
  //   onNodesChange(changes);
    
  //   // Check if any workflow nodes were moved
  //   const positionChanges = changes.filter((change) => 
  //     change.type === 'position' && 
  //     change.dragging === false && // Only when dragging ends
  //     change.position && 
  //     nodes.find(node => node.id === change.id)?.type === 'workflowStep'
  //   );

  //   if (positionChanges.length > 0) {
  //     // Update plus button positions for moved nodes
  //     setNodes((currentNodes) => {
  //       const updatedNodes = [...currentNodes];
        
  //       positionChanges.forEach((change) => {
  //         if (change.type === 'position' && change.position) {
  //           const movedNode = updatedNodes.find(node => node.id === change.id);
  //           if (movedNode && movedNode.type === 'workflowStep') {
  //             // Find the plus button for this node
  //             const plusButton = updatedNodes.find(node => 
  //               node.type === 'plusButton' && 
  //               node.data.parentNodeId === change.id
  //             );
              
  //             if (plusButton) {
  //               // Update plus button position to be 200 pixels below the moved node
  //               plusButton.position = {
  //                 x: change.position.x,
  //                 y: change.position.y + 200
  //               };
  //             }
              
  //             // Also check if this is the last workflow node and update default plus button
  //             const workflowNodes = updatedNodes.filter(node => node.type === 'workflowStep');
  //             const defaultPlusButton = updatedNodes.find(node => 
  //               node.type === 'plusButton' && node.data.isDefaultButton
  //             );
              
  //             if (workflowNodes.length === 1 && defaultPlusButton) {
  //               // If this is the only workflow node, update default plus button position
  //               defaultPlusButton.position = {
  //                 x: change.position.x,
  //                 y: change.position.y + 200
  //               };
  //             }
  //           }
  //         }
  //       });
        
  //       return updatedNodes;
  //     });
  //   }
  // }, [onNodesChange, nodes, setNodes]);



  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);

  // Function to insert a new node on an edge and rearrange all nodes
  const insertNodeOnEdge = useCallback((nodeType: string, edgeId: string, position: { x: number; y: number }) => {
    const newNodeId = `step-${Date.now()}`;
    
    setEdges((eds) => {
      const edge = eds.find(e => e.id === edgeId);
      if (!edge) return eds;
      
      const sourceNodeId = edge.source;
      const targetNodeId = edge.target;
      
      // Remove the original edge
      const edgesWithoutOriginal = eds.filter(e => e.id !== edgeId);
      
      // Add the new node and rearrange all nodes
      setNodes((nds) => {
        const newNode: Node = {
          id: newNodeId,
          type: 'workflowStep',
          position: position,
          data: {
            label: getNodeTypeLabel(nodeType),
            type: nodeType,
            status: 'pending',
            description: getNodeTypeDescription(nodeType),
            onDelete: () => deleteNode(newNodeId),
            onConfigOpen: () => {
              setTimeout(() => {
                const createdNode = nds.find(n => n.id === newNodeId);
                if (createdNode) openNodeConfig(createdNode);
              }, 100);
            }
          },
          draggable: true,
        };
        
        const nodesWithNewNode = [...nds, newNode];
        
        // Insert the node between source and target, then rearrange
        setTimeout(() => {
          insertNodeBetweenSteps(sourceNodeId, targetNodeId, newNodeId);
        }, 50);
        
        return nodesWithNewNode;
      });
      
      // Add two new edges: source -> new node and new node -> target
      return [
        ...edgesWithoutOriginal,
        {
          id: `edge-${sourceNodeId}-${newNodeId}`,
          source: sourceNodeId,
          target: newNodeId,
          type: 'plusEdge',
          data: {
            onInsertNode: insertNodeOnEdge,
            onDelete: () => deleteEdge(`edge-${sourceNodeId}-${newNodeId}`)
          }
        },
        {
          id: `edge-${newNodeId}-${targetNodeId}`,
          source: newNodeId,
          target: targetNodeId,
          type: 'plusEdge',
          data: {
            onInsertNode: insertNodeOnEdge,
            onDelete: () => deleteEdge(`edge-${newNodeId}-${targetNodeId}`)
          }
        }
      ];
    });
  }, [setNodes, setEdges, getNodeTypeLabel, getNodeTypeDescription, deleteNode, openNodeConfig, deleteEdge]);

  // Function to insert a node between two specific steps and rearrange
  const insertNodeBetweenSteps = useCallback((sourceNodeId: string, targetNodeId: string, newNodeId: string) => {
    setNodes((nds) => {
      const workflowNodes = nds.filter(node => node.type === 'workflowStep');
      const plusButtonNodes = nds.filter(node => node.type === 'plusButton');
      
      // Find the source and target nodes
      const sourceNode = workflowNodes.find(node => node.id === sourceNodeId);
      const targetNode = workflowNodes.find(node => node.id === targetNodeId);
      const newNode = workflowNodes.find(node => node.id === newNodeId);
      
      if (!sourceNode || !targetNode || !newNode) return nds;
      
      // Get current order of source node
      const sourceOrder = PositionCalculator.getNodeOrder(sourceNode.position);
      
      // Determine the insertion order (between source and target)
      const insertionOrder = sourceOrder + 1;
      
      // Create a new ordered list
      const orderedNodes: Node[] = [];
      let currentOrder = 0;
      
      // Add nodes before the insertion point
      workflowNodes.forEach(node => {
        const nodeOrder = PositionCalculator.getNodeOrder(node.position);
        if (nodeOrder < insertionOrder && node.id !== newNodeId) {
          orderedNodes.push({
            ...node,
            position: PositionCalculator.getOrderedPosition(currentOrder),
            data: {
              ...node.data,
              order: currentOrder + 1
            }
          });
          currentOrder++;
        }
      });
      
      // Add the new node at the insertion point
      orderedNodes.push({
        ...newNode,
        position: PositionCalculator.getOrderedPosition(currentOrder),
        data: {
          ...newNode.data,
          order: currentOrder + 1
        }
      });
      currentOrder++;
      
      // Add nodes after the insertion point (including the target and any nodes that were after it)
      workflowNodes.forEach(node => {
        const nodeOrder = PositionCalculator.getNodeOrder(node.position);
        if (nodeOrder >= insertionOrder && node.id !== newNodeId) {
          orderedNodes.push({
            ...node,
            position: PositionCalculator.getOrderedPosition(currentOrder),
            data: {
              ...node.data,
              order: currentOrder + 1
            }
          });
          currentOrder++;
        }
      });
      
      // Update plus button positions
      const updatedPlusButtonNodes = plusButtonNodes.map(node => ({
        ...node,
        position: PositionCalculator.getOrderedPosition(orderedNodes.length)
      }));
      
      return [...orderedNodes, ...updatedPlusButtonNodes];
    });
  }, [setNodes, PositionCalculator]);

  // Function to add a new node at the beginning of the workflow
  const addNodeAtStart = useCallback((nodeType: string) => {
    const newNodeId = `step-${Date.now()}`;
    
    setNodes((nds) => {
      const newNode: Node = {
        id: newNodeId,
        type: 'workflowStep',
        position: PositionCalculator.getOrderedPosition(0), // Position at the start
        data: {
          label: getNodeTypeLabel(nodeType),
          type: nodeType,
          status: 'pending',
          description: getNodeTypeDescription(nodeType),
          onDelete: () => deleteNode(newNodeId),
          onConfigOpen: () => {
            setTimeout(() => {
              const createdNode = nds.find(n => n.id === newNodeId);
              if (createdNode) openNodeConfig(createdNode);
            }, 100);
          }
        },
        draggable: true,
      };

      const nodesWithNewNode = [...nds, newNode];
      
      // Insert the node at the start and rearrange all nodes
      setTimeout(() => {
        insertNodeAtStart(newNodeId);
      }, 50);
      
      return nodesWithNewNode;
    });
  }, [setNodes, getNodeTypeLabel, getNodeTypeDescription, deleteNode, openNodeConfig, PositionCalculator]);

  // Function to insert a node at the start of the workflow
  const insertNodeAtStart = useCallback((newNodeId: string) => {
    setNodes((nds) => {
      const workflowNodes = nds.filter(node => node.type === 'workflowStep');
      const plusButtonNodes = nds.filter(node => node.type === 'plusButton');
      
      // Find the new node
      const newNode = workflowNodes.find(node => node.id === newNodeId);
      if (!newNode) return nds;
      
      // Create a new ordered list starting with the new node
      const orderedNodes: Node[] = [];
      let currentOrder = 0;
      
      // Add the new node first
      orderedNodes.push({
        ...newNode,
        position: PositionCalculator.getOrderedPosition(currentOrder),
        data: {
          ...newNode.data,
          order: currentOrder + 1
        }
      });
      currentOrder++;
      
      // Add all existing workflow nodes after the new node
      workflowNodes.forEach(node => {
        if (node.id !== newNodeId) {
          orderedNodes.push({
            ...node,
            position: PositionCalculator.getOrderedPosition(currentOrder),
            data: {
              ...node.data,
              order: currentOrder + 1
            }
          });
          currentOrder++;
        }
      });
      
      // Update plus button positions
      const updatedPlusButtonNodes = plusButtonNodes.map(node => ({
        ...node,
        position: PositionCalculator.getOrderedPosition(orderedNodes.length)
      }));
      
      return [...orderedNodes, ...updatedPlusButtonNodes];
    });
    
    // Create connections after rearrangement
    setTimeout(() => {
      setEdges((eds) => {
        const newEdges = [...eds];
        
        // Get current nodes to find the new node and first existing node
        setNodes((currentNodes) => {
          const workflowNodes = currentNodes.filter((node: Node) => node.type === 'workflowStep');
          const newNode = workflowNodes.find((node: Node) => node.id === newNodeId);
          const firstExistingNode = workflowNodes
            .filter((node: Node) => node.id !== newNodeId)
            .sort((a: Node, b: Node) => {
              const orderA = PositionCalculator.getNodeOrder(a.position);
              const orderB = PositionCalculator.getNodeOrder(b.position);
              return orderA - orderB;
            })[0];
          
          if (newNode && firstExistingNode) {
            // Connect new node to the first existing node
            newEdges.push({
              id: `edge-${newNodeId}-${firstExistingNode.id}`,
              source: newNodeId,
              target: firstExistingNode.id,
              type: 'plusEdge',
              data: {
                onInsertNode: insertNodeOnEdge,
                onDelete: () => deleteEdge(`edge-${newNodeId}-${firstExistingNode.id}`)
              }
            });
          }
          
          return currentNodes;
        });
        
        return newEdges;
      });
    }, 100);
  }, [setNodes, setEdges, PositionCalculator, insertNodeOnEdge, deleteEdge]);



  const saveWorkflow = useCallback(() => {
    const workflowData: Workflow = {
      id: workflow?.id || `workflow-${Date.now()}`,
      name: workflow?.name || 'Untitled Workflow',
      steps: nodes.map((node) => ({
        id: node.id,
        name: node.data.label as string,
        type: node.data.type as string,
        status: node.data.status as string,
        description: node.data.description as string | undefined,
        config: node.data.config as Record<string, unknown> | undefined,
        position: node.position,
      })),
      connections: edges.map((edge) => ({
        from: edge.source,
        to: edge.target,
      })),
    };
    
    onWorkflowChange?.(workflowData);
  }, [workflow, nodes, edges, onWorkflowChange]);



  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
  }, []);



  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        type: 'plusEdge',
        data: {
          onInsertNode: insertNodeOnEdge,
          onDelete: () => deleteEdge(`edge-${params.source}-${params.target}`)
        }
      };
      setEdges((eds) => addEdge(newEdge, eds));
      
      // Automatically arrange nodes after making a connection
      setTimeout(() => {
        arrangeNodesInOrder();
      }, 50);
    },
    [setEdges, insertNodeOnEdge, deleteEdge, arrangeNodesInOrder]
  );

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge.id);
    setSelectedNode(null);
  }, []);



  return (
    <div className="w-full h-full flex flex-col">
      {/* Simple Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowGrid(!showGrid)}
            variant="outline"
            size="sm"
          >
            {showGrid ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          
          <Button
            onClick={saveWorkflow}
            disabled={readOnly}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              onDelete: () => deleteNode(node.id),
              onConfigOpen: () => openNodeConfig(node)
            }
          }))}
          edges={edges.map(edge => ({ 
            ...edge, 
            type: edge.type || 'plusEdge',
            data: { 
              ...edge.data,
              onInsertNode: insertNodeOnEdge,
              onDelete: () => deleteEdge(edge.id) 
            }
          }))}
          // onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          attributionPosition="bottom-left"
          className="bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50"
          style={{
            backgroundImage: `
              radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 75% 75%, rgba(147, 51, 234, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.05) 0%, transparent 50%)
            `,
            touchAction: 'pan-x pan-y'
          }}
        >
          <Controls />
          {showGrid && <Background />}
        </ReactFlow>

        {/* Configuration Drawer */}
        {configDrawerOpen && configuringNode && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 z-50 transform transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">Configure Node</h3>
                <button
                  onClick={closeNodeConfig}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* Node Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">Node Information</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Name</label>
                        <input
                          type="text"
                          defaultValue={configuringNode.data.label as string}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Description</label>
                        <textarea
                          defaultValue={configuringNode.data.description as string}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Type</label>
                        <div className="mt-1 px-3 py-2 text-sm bg-gray-100 rounded-lg text-gray-600">
                          {configuringNode.data.type as string}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Type-specific Configuration */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">Configuration</h4>
                    <div className="space-y-3">
                      {configuringNode.data.type === 'form' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Form Fields</label>
                          <textarea
                            placeholder="Enter form field configuration..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                            rows={4}
                          />
                        </div>
                      )}
                      
                      {configuringNode.data.type === 'api_call' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">API Configuration</label>
                          <textarea
                            placeholder="Enter API endpoint and configuration..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                            rows={4}
                          />
                        </div>
                      )}
                      
                      {configuringNode.data.type === 'approval' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Approval Settings</label>
                          <textarea
                            placeholder="Enter approval configuration..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                            rows={4}
                          />
                        </div>
                      )}
                      
                      {configuringNode.data.type === 'email' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Email Template</label>
                          <textarea
                            placeholder="Enter email template..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                            rows={4}
                          />
                        </div>
                      )}
                      
                      {configuringNode.data.type === 'notification' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Notification Settings</label>
                          <textarea
                            placeholder="Enter notification configuration..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                            rows={4}
                          />
                        </div>
                      )}
                      
                      {configuringNode.data.type === 'delay' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Delay Duration</label>
                          <input
                            type="text"
                            placeholder="e.g., 5 minutes, 1 hour, 1 day"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                          />
                        </div>
                      )}
                      
                      {configuringNode.data.type === 'webhook' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Webhook URL</label>
                          <input
                            type="url"
                            placeholder="https://example.com/webhook"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                          />
                        </div>
                      )}
                      
                      {!['form', 'api_call', 'approval', 'email', 'notification', 'delay', 'webhook'].includes(configuringNode.data.type as string) && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Custom Configuration</label>
                          <textarea
                            placeholder="Enter custom configuration..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                            rows={4}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <Button
                    onClick={closeNodeConfig}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={closeNodeConfig}
                    className="flex-1"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between p-2 bg-gray-100 text-sm">
        <div className="flex items-center gap-4">
          <span>Nodes: {nodes.length}</span>
          <span>Edges: {edges.length}</span>
          {selectedNode && <span>Selected Node: {selectedNode}</span>}
          {selectedEdge && <span>Selected Edge: {selectedEdge}</span>}
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              Workflow Running
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowCanvas;