"use client"

import type React from "react"
import { useCallback, useRef, useState, useEffect } from "react"
import { useSearchParams } from 'react-router-dom'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  ReactFlowProvider,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"


import NodePropertiesPanel from "./node-properties-panel"
import { Save, X, Plus, Zap, FileText, CheckCircle, Database, Bell, Bot, Users, Building2, MessageSquare } from 'lucide-react';
import { workflowAPI } from '../../lib/api';
import TriggerNode from "./nodes/trigger-node"
import FormNode from "./nodes/form-node"
import ApprovalNode from "./nodes/approval-node"
import CrmApprovalNode from "./nodes/crm-approval-node"
// import { ConditionNode } from "./nodes/condition-node"
import UpdateNode from "./nodes/update-node"
import CrmUpdateNode from "./nodes/crm-update-node"
import NotificationNode from "./nodes/notification-node"
// import DelayNode from "./nodes/delay-node"
// import WebhookNode from "./nodes/webhook-node"
// import ApiNode from "./nodes/api-node"
import AgentNode from "./nodes/agent-node"
import PromptNode from "./nodes/prompt-node"
import PdfNode from "./nodes/pdf-node"
// import EndNode from "./nodes/end-node"
import { v4 as uuidv4 } from 'uuid';
import { generateNodeId, validateUserNodeId } from './nodeIdGenerator';



interface WorkflowBuilderProps {
  workflow?: Record<string, unknown> | null;
  companyId: string;
  onSave: () => void;
  onCancel: () => void;
}

const nodeTypes = {
  triggerNode: TriggerNode,
  formNode: FormNode,
  approvalNode: ApprovalNode,
  crmApprovalNode: CrmApprovalNode,
  // conditionNode: ConditionNode,
  updateNode: UpdateNode,
  crmUpdateNode: CrmUpdateNode,
  notificationNode: NotificationNode,
  // delayNode: DelayNode,
  // webhookNode: WebhookNode,
  // apiNode: ApiNode,
  agentNode: AgentNode,
  promptNode: PromptNode,
  pdfNode: PdfNode,
  // endNode: EndNode,
}

const initialNodes: Node[] = []

const initialEdges: Edge[] = []

export default function WorkflowBuilder({ workflow, companyId: _companyId, onSave, onCancel }: WorkflowBuilderProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const companyId = _companyId; // Available for future API integration
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [workflowName, setWorkflowName] = useState<string>('Untitled Workflow')
  const [workflowDescription, setWorkflowDescription] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const onConnect = useCallback((params: Connection) => {
    type NarrowEdge = { id: string; source: string; target: string; sourceHandle: string | null; targetHandle: string | null };

    const connectionWithId: NarrowEdge = {
      id: `xy-edge__${params.source}-${params.target}`,
      source: params.source as string,
      target: params.target as string,
      sourceHandle: params.sourceHandle ?? null,
      targetHandle: params.targetHandle ?? null,
    };

    setEdges((eds) =>
      addEdge(
        connectionWithId,
        eds.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          targetHandle: e.targetHandle ?? null,
        })) as NarrowEdge[]
      )
    );
  }, [setEdges])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const nodeType = event.dataTransfer.getData("application/reactflow")

      if (typeof nodeType === "undefined" || !nodeType) {
        return
      }

      if (!reactFlowInstance || !reactFlowWrapper.current) return

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      })

      const newNode: Node = {
        id: uuidv4(),
        type: nodeType,
        position,
        data: {
          label:
            nodeType === "triggerNode"
              ? "Trigger"
              : nodeType === "formNode"
                ? "Form"
                : nodeType === "approvalNode"
                  ? "Approval"
                  : nodeType === "crmApprovalNode"
                    ? "CRM Approval"
                    : nodeType === "conditionNode"
                      ? "Condition"
                      : nodeType === "updateNode"
                        ? "Update"
                        : nodeType === "crmUpdateNode"
                          ? "CRM Update"
                          : nodeType === "notificationNode"
                          ? "Notification"
                          : nodeType === "delayNode"
                            ? "Delay"
                            : nodeType === "webhookNode"
                              ? "Webhook"
                              : nodeType === "apiNode"
                                ? "API"
                                : nodeType === "agentNode"
                                  ? "Agent"
                                  : nodeType === "promptNode"
                                    ? "Prompt"
                                    : nodeType === "pdfNode"
                                      ? "PDF"
                                      : nodeType === "endNode"
                                        ? "End"
                                        : "Action",
          logicalId: generateNodeId(nodeType, nodes),
          isStartNode: false
        },
      }

      setNodes((nds) => {
        // If this is the first node, mark it as the start node
        const isFirstNode = nds.length === 0;
        const nodeWithStartFlag = {
          ...newNode,
          data: {
            ...newNode.data,
            isStartNode: isFirstNode
          }
        };
        return nds.concat(nodeWithStartFlag);
      })
    },
    [reactFlowInstance, setNodes, nodes],
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])



  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setShowPlusMenu(false)
  }, [])

  // Load existing workflow data
  const loadWorkflowData = useCallback(async () => {
    if (!workflow || !workflow.id) return;

    setIsLoading(true);
    try {
      console.log('Loading workflow with ID:', workflow.id);
      const response = await workflowAPI.getWorkflow(workflow.id as string);
      console.log(response)
      if (response.workflow) {
        const workflowData = response.workflow;
    
        // Set workflow name
        setWorkflowName(workflowData.name || 'Untitled Workflow');
        setWorkflowDescription(workflowData.description || '');
        
        // Convert nodes to React Flow format
        console.log('=== NODE DEBUGGING ===');
        console.log('Raw nodes from server:', response.nodes);
        
        const reactFlowNodes = (response.nodes || []).map((node: Record<string, unknown>) => ({
          id: node.node_id as string,
          type: node.type as string,
          position: { x: node.position_x as number, y: node.position_y as number },
          data: {
            label: node.name as string,
            ...(node.config as Record<string, unknown>),
            // Ensure logicalId exists for backward compatibility
            logicalId: (node.config as Record<string, unknown>)?.logicalId as string || generateNodeId(node.type as string, []),
            isStartNode: (node.config as Record<string, unknown>)?.isStartNode as boolean || false
          }
        }));
        
        console.log('React Flow nodes:', reactFlowNodes);
        console.log('Node IDs:', reactFlowNodes.map((n: { id: string }) => n.id));
        
        // Convert connections to React Flow edges
        console.log('=== CONNECTION DEBUGGING ===');
        console.log('Raw connections from server:', response.connections);
        console.log('Number of connections:', response.connections?.length || 0);
        
        const nodeIds = reactFlowNodes.map((n: { id: string }) => n.id);
        console.log('Available node IDs for connections:', nodeIds);
        
        const reactFlowEdges = (response.connections || []).map((conn: Record<string, unknown>) => {
          console.log('Processing connection:', conn);
          
          // Check if connection has required fields
          if (!conn.connection_id || !conn.from_node_id || !conn.to_node_id) {
            console.warn('Invalid connection data:', conn);
            return null;
          }
          
          const fromNodeId = String(conn.from_node_id);
          const toNodeId = String(conn.to_node_id);
          
          console.log(`Connection: ${fromNodeId} -> ${toNodeId}, Available nodes:`, nodeIds);
          
          // Check if source and target nodes exist
          if (!nodeIds.includes(fromNodeId)) {
            console.warn(`Source node ${fromNodeId} not found in available nodes:`, nodeIds);
            return null;
          }
          
          if (!nodeIds.includes(toNodeId)) {
            console.warn(`Target node ${toNodeId} not found in available nodes:`, nodeIds);
            return null;
          }
          
          const edge = {
            id: conn.connection_id as string,
            source: fromNodeId,
            target: toNodeId,
            sourceHandle: (conn.from_port === false || conn.from_port === null || conn.from_port === undefined) ? null : (conn.from_port as string) || 'default',
            targetHandle: (conn.to_port === false || conn.to_port === null || conn.to_port === undefined) ? null : (conn.to_port as string) || 'default'
          };
          console.log('Created edge:', edge);
          return edge;
        }).filter((edge: Edge | null) => edge !== null);
        
        console.log('Final React Flow edges:', reactFlowEdges);
        console.log('Number of valid edges:', reactFlowEdges.length);
        
        // Set nodes and edges
        console.log('Setting nodes:', reactFlowNodes);
        console.log('Setting edges:', reactFlowEdges);
        
        setNodes(reactFlowNodes);
        
        // Set edges after a small delay to ensure nodes are rendered
        setTimeout(() => {
          console.log('Setting edges after delay:', reactFlowEdges);
          setEdges(reactFlowEdges as Edge[]);
        }, 200);
        
        // Check edges after setting
        setTimeout(() => {
          console.log('Edges after setting (from state):', edges);
        }, 300);
        
        console.log('Workflow loaded successfully:', {
          nodes: reactFlowNodes.length,
          edges: reactFlowEdges.length
        });
        

      }
    } catch (error) {
      console.error('Error loading workflow:', error);
      alert('Error loading workflow data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [workflow, setNodes, setEdges]);

  // Load workflow data when component mounts or workflow changes
  useEffect(() => {
    if (workflow && workflow.id) {
      loadWorkflowData();
    }
  }, [workflow, loadWorkflowData]);

  const updateNodeData = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) => {
        const updatedNodes = nds.map((node) => {
          if (node.id === nodeId) {
            // If marking as start node, unmark all other nodes
            if ((newData as Record<string, unknown>).isStartNode) {
              const updatedNode = {
                ...node,
                data: {
                  ...node.data,
                  ...newData,
                  isStartNode: true
                }
              };
              // Update selected node if it's the one being updated
              setSelectedNode((currentSelected) => {
                if (currentSelected && currentSelected.id === nodeId) {
                  return updatedNode;
                }
                return currentSelected;
              });
              return updatedNode;
            } else {
              const updatedNode = {
                ...node,
                data: {
                  ...node.data,
                  ...newData
                }
              };
              // Update selected node if it's the one being updated
              setSelectedNode((currentSelected) => {
                if (currentSelected && currentSelected.id === nodeId) {
                  return updatedNode;
                }
                return currentSelected;
              });
              return updatedNode;
            }
          } else {
            // If marking a node as start, unmark all other nodes
            if ((newData as Record<string, unknown>).isStartNode) {
              return {
                ...node,
                data: {
                  ...node.data,
                  isStartNode: false
                }
              };
            }
            return node;
          }
        });
        return updatedNodes;
      });
    },
    [setNodes],
  )

  const updateNodeId = useCallback(
    (oldNodeId: string, newNodeId: string) => {
      // Validate the new logical ID
      const validation = validateUserNodeId(newNodeId, nodes, oldNodeId);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Update logicalId in node.data; keep system UUID id stable
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.id === oldNodeId) {
            const updatedNode = {
              ...node,
              data: {
                ...node.data,
                logicalId: newNodeId
              }
            };
            
            // Update selected node if it's the one being updated
            setSelectedNode((currentSelected) => {
              if (currentSelected && currentSelected.id === oldNodeId) {
                return updatedNode;
              }
              return currentSelected;
            });
            
            return updatedNode;
          }
          return node;
        });
      });

      // No change to edges needed since edges reference system UUIDs
    },
    [nodes, setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId))
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
      setSelectedNode(null)
    },
    [setNodes, setEdges],
  )



  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showPlusMenu && !target.closest('.plus-button-container')) {
        setShowPlusMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPlusMenu])

  const addNodeFromPlusButton = useCallback((nodeType: string) => {
    if (!reactFlowInstance || !reactFlowWrapper.current) return

    // Get the canvas container dimensions
    const canvasRect = reactFlowWrapper.current.getBoundingClientRect()
    
    // Calculate the center of the canvas in screen coordinates
    const centerX = canvasRect.width / 2
    const centerY = canvasRect.height / 2
    
    // Convert screen coordinates to flow coordinates
    const position = reactFlowInstance.screenToFlowPosition({
      x: centerX,
      y: centerY,
    })

    const getNodeLabel = (type: string) => {
      const labels: { [key: string]: string } = {
        triggerNode: 'Trigger',
        formNode: 'Form',
        approvalNode: 'Approval',
        crmApprovalNode: 'CRM Approval',
        // conditionNode: 'Condition',
        updateNode: 'Update',
        notificationNode: 'Notification',
        crmUpdateNode: 'CRM Update',
        // delayNode: 'Delay',
        // webhookNode: 'Webhook',
        // apiNode: 'API',
        agentNode: 'Agent',
        promptNode: 'Prompt',
        pdfNode: 'PDF',
        // endNode: 'End'
      }
      return labels[type] || 'Node'
    }

    const newNode: Node = {
      id: uuidv4(),
      type: nodeType as keyof typeof nodeTypes,
      position,
      data: { label: getNodeLabel(nodeType), logicalId: generateNodeId(nodeType, nodes), isStartNode: false },
    }

    setNodes((nds) => {
      // If this is the first node, mark it as the start node
      const isFirstNode = nds.length === 0;
      const nodeWithStartFlag = {
        ...newNode,
        data: {
          ...newNode.data,
          isStartNode: isFirstNode
        }
      };
      return nds.concat(nodeWithStartFlag);
    })
    setShowPlusMenu(false)
  }, [reactFlowInstance, setNodes, nodes])

  // Save workflow function
  const handleSaveWorkflow = async () => {
    if (!_companyId) {
      alert('Company ID is required to save workflow.');
      return;
    }

    if (nodes.length === 0) {
      alert('Please add at least one node to the workflow before saving.');
      return;
    }

    if (!workflowName.trim()) {
      alert('Please enter a workflow name before saving.');
      return;
    }

          setIsSaving(true);
      try {
        console.log('Saving workflow with company_id:', _companyId);
        // Prepare workflow data
      const workflowData = {
        workflow: {
          name: workflowName,
          description: workflowDescription,
          version: '1.0.0',
          company_id: _companyId
        },
        nodes: nodes.map(node => ({
          id: node.id, // system UUID
          type: node.type || 'unknown',
          name: (node.data as Record<string, unknown>)?.label as string || 'Unnamed Node',
          position: node.position,
          config: {
            ...node.data,
            logicalId: (node.data as Record<string, unknown>)?.logicalId as string,
            isStartNode: (node.data as Record<string, unknown>)?.isStartNode as boolean || false
          }
        })),
        connections: edges.map(edge => ({
          id: edge.id,
          from_node: edge.source,
          to_node: edge.target,
          from_port: edge.sourceHandle || undefined,
          to_port: edge.targetHandle || undefined
        })),
        variables: {
          global: [],
          flow: []
        },
        settings: {
          enabled: true,
          max_executions: 100,
          timeout: {
            duration: 30,
            unit: 'minutes'
          },
          error_handling: {
            strategy: 'retry',
            max_retries: 3,
            notification: true
          }
        }
      };

      let result;
      if (workflow && workflow.id) {
        // Update existing workflow
        console.log('Updating existing workflow with ID:', workflow.id);
        result = await workflowAPI.updateWorkflow(workflow.id as string, {
          workflow: {
            name: workflowName,
            description: workflowDescription,
            version: '1.0.0'
          },
          nodes: nodes.map(node => ({
            id: node.id,
            type: node.type || 'unknown',
            name: (node.data as Record<string, unknown>)?.label as string || 'Unnamed Node',
            position: node.position,
            config: {
              ...node.data,
              logicalId: (node.data as Record<string, unknown>)?.logicalId as string,
              isStartNode: (node.data as Record<string, unknown>)?.isStartNode as boolean || false
            }
          })),
          connections: edges.map(edge => ({
            id: edge.id,
            from_node: edge.source,
            to_node: edge.target,
            from_port: edge.sourceHandle || undefined,
            to_port: edge.targetHandle || undefined
          }))
        });
      } else {
        // Create new workflow
        console.log('Creating new workflow');
        result = await workflowAPI.addWorkflow(workflowData);
      }
      
      if (result.success) {
        alert(workflow && workflow.id ? 'Workflow updated successfully!' : 'Workflow saved successfully!');
        onSave(); // Call the parent's onSave callback
      } else {
        alert('Failed to save workflow: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Error saving workflow. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col w-full">
        {/* Professional Toolbar */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200/60 backdrop-blur-sm">
          <div className="px-6 py-4">
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
              {/* Form Fields Section */}
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Workflow Title */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 tracking-wide">
                      Workflow Title
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        placeholder="Enter a descriptive workflow title..."
                        className="w-full h-11 px-4 text-sm border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 placeholder:text-gray-400 shadow-sm"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* Workflow Description */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 tracking-wide">
                      Description
                    </label>
                    <div className="relative">
                      <textarea
                        value={workflowDescription}
                        onChange={(e) => setWorkflowDescription(e.target.value)}
                        placeholder="Describe what this workflow accomplishes..."
                        className="w-full h-11 px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 placeholder:text-gray-400 resize-none shadow-sm"
                        rows={1}
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={onCancel}
                  className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-600 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl hover:bg-white hover:border-gray-300 transition-all duration-200 shadow-sm"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </button>
                
                <button
                  onClick={handleSaveWorkflow}
                  disabled={isSaving}
                  className={`flex items-center px-6 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm ${
                    isSaving 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 hover:shadow-md active:scale-95'
                  }`}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : (workflow && workflow.id ? 'Update Workflow' : 'Save Workflow')}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col lg:flex-row relative">
          <div className="flex-1" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
            >
              <Controls />
              <MiniMap />
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
            
            {/* Loading State */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-5">
                <div className="text-center bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-lg border border-gray-200">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Workflow</h3>
                  <p className="text-gray-600">Please wait while we load your workflow...</p>
                </div>
              </div>
            )}

            {/* Empty State Message */}
            {!isLoading && nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-5">
                <div className="text-center bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-lg border border-gray-200">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Building Your Workflow</h3>
                  <p className="text-gray-600 mb-4">Click the plus button to add your first node</p>
                  <button
                    onClick={() => setShowPlusMenu(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Node
                  </button>
                </div>
              </div>
            )}

            {/* Fixed Circular Plus Button */}
            <div className="absolute top-4 left-4 z-10 plus-button-container">
              <button
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-xl"
                title="Add new node"
              >
                <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              
              {/* Dropdown Menu */}
              {showPlusMenu && (
                <div className="absolute top-12 sm:top-14 left-0 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[180px] sm:min-w-[200px]">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    Add Node
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => addNodeFromPlusButton('triggerNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Zap className="w-4 h-4 text-purple-500" />
                      <span>Trigger</span>
                    </button>
                    <button
                      onClick={() => addNodeFromPlusButton('formNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4 text-cyan-500" />
                      <span>Form</span>
                    </button>
                    <button
                      onClick={() => addNodeFromPlusButton('approvalNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <CheckCircle className="w-4 h-4 text-orange-500" />
                      <span>Approval</span>
                    </button>
                    <button
                      onClick={() => addNodeFromPlusButton('crmApprovalNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Users className="w-4 h-4 text-indigo-500" />
                      <span>CRM Approval</span>
                    </button>
                    {/* <button
                      onClick={() => addNodeFromPlusButton('conditionNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <GitBranch className="w-4 h-4 text-amber-500" />
                      <span>Condition</span>
                    </button> */}
                    <button
                      onClick={() => addNodeFromPlusButton('updateNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Database className="w-4 h-4 text-indigo-500" />
                      <span>Update</span>
                    </button>
                    <button
                      onClick={() => addNodeFromPlusButton('crmUpdateNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Building2 className="w-4 h-4 text-indigo-500" />
                      <span>CRM Update</span>
                    </button>
                    <button
                      onClick={() => addNodeFromPlusButton('notificationNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Bell className="w-4 h-4 text-teal-500" />
                      <span>Notification</span>
                    </button>
                    {/* <button
                      onClick={() => addNodeFromPlusButton('delayNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>Delay</span>
                    </button> */}
                    {/* <button
                      onClick={() => addNodeFromPlusButton('webhookNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Webhook className="w-4 h-4 text-pink-500" />
                      <span>Webhook</span>
                    </button> */}
                    {/* <button
                      onClick={() => addNodeFromPlusButton('apiNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Code className="w-4 h-4 text-emerald-500" />
                      <span>API</span>
                    </button> */}
                    <button
                      onClick={() => addNodeFromPlusButton('agentNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Bot className="w-4 h-4 text-violet-500" />
                      <span>Agent</span>
                    </button>
                    <button
                      onClick={() => addNodeFromPlusButton('promptNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-500" />
                      <span>Prompt</span>
                    </button>
                    <button
                      onClick={() => addNodeFromPlusButton('pdfNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4 text-purple-500" />
                      <span>PDF</span>
                    </button>
                    {/* <button
                      onClick={() => addNodeFromPlusButton('endNode')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Square className="w-4 h-4 text-red-500" />
                      <span>End</span>
                    </button> */}
                  </div>
                </div>
              )}
            </div>
          </div>
          {selectedNode && (
            <NodePropertiesPanel 
              key={selectedNode.id}
              node={selectedNode} 
              nodes={nodes}
              edges={edges}
              onUpdateNode={updateNodeData} 
              onUpdateNodeId={updateNodeId}
              onDeleteNode={deleteNode}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function WorkflowBuilderWrapper() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company') || '';
  
  const handleSave = () => {
    // Navigate back to workflows list after successful save
    window.history.back();
  };
  
  const handleCancel = () => {
    // Navigate back to workflows list
    window.history.back();
  };

  return (
    <ReactFlowProvider>
      <WorkflowBuilder 
        workflow={null}
        companyId={companyId}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </ReactFlowProvider>
  )
}
