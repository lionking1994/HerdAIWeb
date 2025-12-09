import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  Controls,
  Background,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowInstance,
  Connection,
  NodeTypes,
  EdgeTypes
} from 'reactflow';
import dagre from 'dagre'
import html2canvas from 'html2canvas';
import { Download, ZoomIn, ZoomOut, RotateCcw, Save, FileText, Users, Building2, Target, ChevronLeft, ChevronRight,RefreshCw } from 'lucide-react';
 
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';
import 'reactflow/dist/style.css';
 
 
// Type definitions
interface VisualizationNode {
  id: string;
  label: string;
  color: string;
  group: string;
}
 
interface VisualizationEdge {
  from: string;
  to: string;
  label: string;
  thickness?: number;
}
 
interface VisualizationData {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
}
 
interface JsonData {
  visualization: VisualizationData;
}
 
interface AnnotationState {
  isEditing: boolean;
  nodeId: string | null;
  edgeId: string | null;
  type: 'node' | 'edge';
  position: { x: number; y: number };
}
 
interface NodeAnnotations {
  [key: string]: string;
}
 
interface EdgeAnnotations {
  [key: string]: string;
}
 
interface SummaryStats {
  people: number;
  companies: number;
  opportunities: number;
  connections: number;
}
 
// React Flow node/edge data types
type RFNodeData = {
  label: string;
  color: string;
  group: string;
  annotation?: string;
  onAnnotationClick: (nodeId: string) => void;
};

type RFEdgeData = {
  label: string;
  thickness: number;
  annotation?: string;
  onAnnotationClick: (edgeId: string) => void;
};

interface NodeIconAndColor {
  icon: React.ComponentType<any>;
  color: string;
}
 
interface GroupNames {
  [key: string]: string;
}
 
interface OpportunityNodeGraphProps {
  jsonData: JsonData;
  meetingId?: string;
  templateId?: number;
  tPrompt?: string;
  onReprocess?: () => Promise<void>;
  template_name?: string;
  onNodeClick?: (node: VisualizationNode) => void;
  onAnnotationChange?: (id: string, text: string, type: 'node' | 'edge') => void;
  exportFormat?: 'png' | 'svg' | 'json';
}
 
interface OpportunityNodeGraphInnerProps extends OpportunityNodeGraphProps {}
 
interface LegendProps {
  nodes: VisualizationNode[];
}
 
// Add custom CSS to ensure edges are visible
const customStyles: string = `
  .react-flow__edge {
    z-index: 1 !important;
    pointer-events: all !important;
  }
  .react-flow__edge-path {
    stroke: #64748b !important;
    stroke-width: 2px !important;
  }
  .react-flow__edge-text {
    font-size: 10px !important;
    fill: #374151 !important;
  }
  .react-flow__edge-custom {
    z-index: 2 !important;
  }
  .react-flow__edge-label {
    z-index: 3 !important;
  }
  /* Hide React Flow watermark */
  .react-flow__attribution {
    display: none !important;
  }
`;
 
// Inject custom styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = customStyles;
  document.head.appendChild(styleElement);
}
 
const nodeTypes: NodeTypes = { custom: CustomNode };
const edgeTypes: EdgeTypes = { custom: CustomEdge };
 
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth: number = 172;
const nodeHeight: number = 60;
 
const getLayoutedElements = (nodes: Node<RFNodeData>[], edges: Edge<RFEdgeData>[]): { nodes: Node<RFNodeData>[]; edges: Edge<RFEdgeData>[] } => {
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 });
 
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  dagre.layout(dagreGraph);
 
  const layoutedNodes: Node<RFNodeData>[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });
 
  return { nodes: layoutedNodes, edges };
};
 
const OpportunityNodeGraphInner: React.FC<OpportunityNodeGraphInnerProps> = ({
  jsonData,
  meetingId,
  templateId,
  tPrompt,
  onReprocess,
  template_name,
  onNodeClick,
  onAnnotationChange,
  exportFormat = 'png'
}) => {
  console.log("asdadasfasfafafgasfagga", jsonData);
  console.log("Template ID:", tPrompt);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [annotationState, setAnnotationState] = useState<AnnotationState>({
    isEditing: false,
    nodeId: null,
    edgeId: null,
    type: 'node',
    position: { x: 0, y: 0 }
  });
  const [annotationText, setAnnotationText] = useState<string>('');
  const [nodeAnnotations, setNodeAnnotations] = useState<NodeAnnotations>({});
  const [edgeAnnotations, setEdgeAnnotations] = useState<EdgeAnnotations>({});
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [templatePrompt, setTemplatePrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
 
  // Handlers for optional modal open/close are managed inline where used.
  const handleReprocessClick = () => {
    setTemplatePrompt(tPrompt  ?? ''); // optional default
    setIsModalOpen(true);
  };


  const closeModal = () => setIsModalOpen(false);

  const handleAnnotationClick = useCallback((id: string, type: 'node' | 'edge' = 'node'): void => {
    const currentAnnotation = type === 'node' ? nodeAnnotations[id] : edgeAnnotations[id];
    setAnnotationText(currentAnnotation || '');
    setAnnotationState({
      isEditing: true,
      nodeId: type === 'node' ? id : null,
      edgeId: type === 'edge' ? id : null,
      type,
      position: { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    });
  }, [nodeAnnotations, edgeAnnotations]);
 
  const saveAnnotation = useCallback((): void => {
    const id = annotationState.nodeId || annotationState.edgeId;
    if (!id) return;
 
    if (annotationState.type === 'node') {
      setNodeAnnotations(prev => ({ ...prev, [id]: annotationText }));
    } else {
      setEdgeAnnotations(prev => ({ ...prev, [id]: annotationText }));
    }
 
    onAnnotationChange?.(id, annotationText, annotationState.type);
    setAnnotationState({ isEditing: false, nodeId: null, edgeId: null, type: 'node', position: { x: 0, y: 0 } });
    setAnnotationText('');
  }, [annotationState, annotationText, onAnnotationChange]);
 
  const cancelAnnotation = useCallback((): void => {
    setAnnotationState({ isEditing: false, nodeId: null, edgeId: null, type: 'node', position: { x: 0, y: 0 } });
    setAnnotationText('');
  }, []);
 
  const convertToReactFlowFormat = useCallback((): { nodes: Node<RFNodeData>[]; edges: Edge<RFEdgeData>[] } => {
    const nodes: Node<RFNodeData>[] = jsonData.visualization.nodes.map(node => ({
      id: node.id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        color: node.color,
        group: node.group,
        annotation: nodeAnnotations[node.id],
        onAnnotationClick: (nodeId: string) => handleAnnotationClick(nodeId, 'node')
      }
    }));
 
    const edges: Edge<RFEdgeData>[] = jsonData.visualization.edges.map((edge, index) => {
      const edgeId = `${edge.from}-${edge.to}-${index}`;
 
      // Use custom edge type now that handles are fixed
      const edgeType = 'custom';
 
      return {
        id: edgeId,
        source: edge.from,
        target: edge.to,
        type: edgeType,
        data: {
          label: edge.label,
          thickness: edge.thickness || 1,
          annotation: edgeAnnotations[edgeId],
          onAnnotationClick: (edgeId: string) => handleAnnotationClick(edgeId, 'edge')
        }
      };
    });
 
    const result = getLayoutedElements(nodes, edges);
    return result;
  }, [jsonData, nodeAnnotations, edgeAnnotations, handleAnnotationClick]);
 
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdgeData>([]);
 
  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = convertToReactFlowFormat();
    setNodes(layoutedNodes as any);
    setEdges(layoutedEdges as any);
  }, [convertToReactFlowFormat, setNodes, setEdges]);
 
  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
 
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node<RFNodeData>): void => {
    const graphNode = jsonData.visualization.nodes.find(n => n.id === node.id);
    if (graphNode) {
      // Use the ReactFlow node data which has the correct group information
      setSelectedNode({
        ...graphNode,
        group: node.data?.group || graphNode.group
      });
 
 if (onNodeClick) {
        onNodeClick(graphNode);
      }
    }
  }, [jsonData, onNodeClick]);
 
  const exportGraph = useCallback(async (): Promise<void> => {
    if (!reactFlowWrapper.current) return;
    try {
      if (exportFormat === 'json') {
        const dataStr = JSON.stringify({
          ...jsonData,
          annotations: { nodes: nodeAnnotations, edges: edgeAnnotations }
        }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'meeting-analysis.json';
        link.click();
        URL.revokeObjectURL(url);
      } 
      else {
        const canvas = await html2canvas(reactFlowWrapper.current, {
          background: '#ffffff',
          // Type cast to allow additional options used commonly in practice
          ...( { scale: 2, logging: false, useCORS: true } as any )
        });
        const link = document.createElement('a');
        link.download = `meeting-analysis.${exportFormat}`;
        link.href = canvas.toDataURL(`image/${exportFormat}`);
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  }, [exportFormat, jsonData, nodeAnnotations, edgeAnnotations]);

 
  const handleZoomIn = useCallback((): void => {
    if (reactFlowInstance?.zoomIn) {
      reactFlowInstance.zoomIn({ duration: 300 });
    }
  }, [reactFlowInstance]);
 
  const handleZoomOut = useCallback((): void => {
    if (reactFlowInstance?.zoomOut) {
      reactFlowInstance.zoomOut({ duration: 300 });
    }
  }, [reactFlowInstance]);
 
  const handleFitView = useCallback((): void => {
    if (reactFlowInstance?.fitView) {
      reactFlowInstance.fitView({ padding: 0.1, duration: 800 });
    }
  }, [reactFlowInstance]);
 
  // Calculate summary statistics
  const summaryStats: SummaryStats = useMemo(() => {
    const peopleCount = nodes.filter(node => node.data?.group === 'person' || node.data?.group === 'people').length;
    const companiesCount = nodes.filter(node => node.data?.group === 'company' || node.data?.group === 'companies').length;
    const opportunitiesCount = nodes.filter(node => node.data?.group === 'opportunity' || node.data?.group === 'opportunities').length;
    const connectionsCount = edges.length;
 
    return {
      people: peopleCount,
      companies: companiesCount,
      opportunities: opportunitiesCount,
      connections: connectionsCount
    };
  }, [nodes, edges]);
 
  // Selected node state
  const [selectedNode, setSelectedNode] = useState<VisualizationNode | null>(null);
 
  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
 
  // Get node icon and color based on group
  const getNodeIconAndColor = (group: string): NodeIconAndColor => {
    switch (group) {
      case 'person':
      case 'people':
        return { icon: Users, color: '#8b5cf6' };
      case 'company':
      case 'companies':
        return { icon: Building2, color: '#3b82f6' };
      case 'opportunity':
      case 'opportunities':
        return { icon: Target, color: '#10b981' };
      case 'theme':
      case 'central_theme':
        return { icon: FileText, color: '#f97316' };
      default:
        return { icon: Target, color: '#6b7280' };
    }
  };
 
  return (
    <div className="interactive-node-graph" style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <div ref={reactFlowWrapper} style={{ width: isSidebarCollapsed ? '100%' : 'calc(100% - 300px)', height: '100%', transition: 'width 0.3s ease-in-out' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={true}
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          panOnDrag={true}
          zoomOnScroll={true}
          selectNodesOnDrag={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Controls showZoom={false} showFitView={false} showInteractive={true} position="top-left" />
          <Background color="#f1f5f9" gap={20} size={1} />
        </ReactFlow>
      </div>
 
      {/* Right Sidebar */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: isSidebarCollapsed ? '0px' : '300px',
        height: '100%',
        backgroundColor: 'white',
        borderLeft: '1px solid #e5e7eb',
        padding: isSidebarCollapsed ? '0px' : '20px',
        zIndex: 5,
        boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease-in-out',
        overflow: isSidebarCollapsed ? 'hidden' : 'auto'
      }}>
 
        {/* Legend Section */}
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            marginBottom: '18px',
            color: '#1f2937',
            borderBottom: '2px solid #f3f4f6',
            paddingBottom: '8px'
          }}>
            Legend
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Legend nodes={jsonData?.visualization?.nodes} />
          </div>
        </div>
 
        {/* Divider */}
        <div style={{
          height: '1px',
          backgroundColor: '#e5e7eb',
          margin: '25px 0',
          opacity: 0.6
        }}></div>
 
        {/* Selected Node Section - Only show when a node is selected */}
        {selectedNode && (
          <>
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                marginBottom: '18px',
                color: '#1f2937',
                borderBottom: '2px solid #f3f4f6',
                paddingBottom: '8px'
              }}>
                Selected Node
              </h3>
              <div style={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                {(() => {
                  const nodeGroup = selectedNode.group;
                  const { icon: IconComponent, color } = getNodeIconAndColor(nodeGroup);
                  const groupLabel = (nodeGroup === 'person' || nodeGroup === 'people') ? 'Person' :
                    (nodeGroup === 'company' || nodeGroup === 'companies') ? 'Company' :
                      (nodeGroup === 'opportunity' || nodeGroup === 'opportunities') ? 'Sales Opportunity' :
                        (nodeGroup === 'theme' || nodeGroup === 'central_theme') ? 'Central Theme' : 'Node';
 
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <IconComponent size={20} color={color} />
                        <span style={{
                          fontSize: '14px',
                          color: color,
                          fontWeight: '500',
                          textTransform: 'capitalize'
                        }}>
                          {groupLabel}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1f2937',
                        wordBreak: 'break-word'
                      }}>
                        {selectedNode.label}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
 
            {/* Divider */}
            <div style={{
              height: '1px',
              backgroundColor: '#e5e7eb',
              margin: '25px 0',
              opacity: 0.6
            }}></div>
          </>
        )}
          {/* Divider */}
         <div style={{
          height: '1px',
          backgroundColor: '#e5e7eb',
          margin: '25px 0',
          opacity: 0.6
        }}></div>
         {/* Templet Name Section */}
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            marginBottom: '18px',
            color: '#1f2937',
            borderBottom: '2px solid #f3f4f6',
            paddingBottom: '8px'
          }}>
            Template Used: {template_name || 'N/A'}
          </h3>
          </div>

        {/* Instructions Section */}
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            marginBottom: '18px',
            color: '#1f2937',
            borderBottom: '2px solid #f3f4f6',
            paddingBottom: '8px'
          }}>
            Instructions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#8b5cf6', marginTop: '2px' }}>•</span>
              <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.4' }}>Click: Select nodes to view details</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>•</span>
              <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.4' }}>Scroll: Zoom in/out of the graph</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#10b981', marginTop: '2px' }}>•</span>
              <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.4' }}>Drag: Pan around the graph</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#f97316', marginTop: '2px' }}>•</span>
              <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.4' }}>Edit icon: Add annotations to nodes and edges</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>•</span>
              <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.4' }}>Download: Export the graph as PNG, SVG, or JSON</span>
            </div>
          </div>
        </div>
 
        {/* Divider */}
        <div style={{
          height: '1px',
          backgroundColor: '#e5e7eb',
          margin: '25px 0',
          opacity: 0.6
        }}></div>
 
        {/* Summary Section */}
        <div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            marginBottom: '18px',
            color: '#1f2937',
            borderBottom: '2px solid #f3f4f6',
            paddingBottom: '8px'
          }}>
            Summary
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
 <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#6b7280',
                  borderRadius: '50%'
                }}></div>
                <span style={{ fontSize: '15px', color: '#374151', fontWeight: '500' }}>Connections</span>
              </div>
              <span style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#6b7280',
                backgroundColor: '#f3f4f6',
                padding: '4px 12px',
                borderRadius: '20px',
                minWidth: '40px',
                textAlign: 'center'
              }}>{summaryStats.connections}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '50%'
                }}></div>
                <span style={{ fontSize: '15px', color: '#374151', fontWeight: '500' }}>Companies</span>
              </div>
              <span style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#3b82f6',
                backgroundColor: '#f3f4f6',
                padding: '4px 12px',
                borderRadius: '20px',
                minWidth: '40px',
                textAlign: 'center'
              }}>{summaryStats.companies}</span>
              </div>

              {/* <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#10b981',
                  borderRadius: '50%'
                }}></div>
                <span style={{ fontSize: '15px', color: '#374151', fontWeight: '500' }}>Opportunities</span>
              </div>
              <span style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#10b981',
                backgroundColor: '#f3f4f6',
                padding: '4px 12px',
                borderRadius: '20px',
                minWidth: '40px',
                textAlign: 'center'
              }}>{summaryStats.opportunities}</span>
            </div> */}
            {/* <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#6b7280',
                  borderRadius: '50%'
                }}></div>
                <span style={{ fontSize: '15px', color: '#374151', fontWeight: '500' }}>Connections</span>
                <span style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#6b7280',
                backgroundColor: '#f3f4f6',
                padding: '4px 12px',
                borderRadius: '20px',
                minWidth: '40px',
                textAlign: 'center'
              }}>{summaryStats.connections}</span>
              </div>
            </div> */}
          </div>
        </div>
      </div>
 
      {/* Control Buttons */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: isSidebarCollapsed ? '20px' : '320px',
        display: 'flex',
        gap: '8px',
        zIndex: 10,
        transition: 'right 0.3s ease-in-out'
      }}>
        <button
          onClick={handleZoomIn}
          style={{
            padding: '8px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            padding: '8px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={handleFitView}
          style={{
            padding: '8px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          title="Fit View"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={exportGraph}
          style={{
            padding: '8px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          title={`Export as ${exportFormat.toUpperCase()}`}
        >
          <Download size={16} />
        </button>
        <button
                  onClick={handleReprocessClick}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    marginRight: '8px'
                  }}
                  title="Reprocess"
                >
                  <RefreshCw size={16} />
                </button>
 
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          style={{
            padding: '8px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease-in-out'
          }}
          title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
        >
          {isSidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
 
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '800px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
          }}>
            <h3>{template_name || 'N/A'}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '16px' }}>
              {tPrompt ?? 'Not Available'}
            </pre>
 
            <div style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={async () => {
                  setIsProcessing(true); // ⏳ show spinner
                  try {
                    if (onReprocess) {
                      await onReprocess(); // 🔥 API call
                    }
                    setIsModalOpen(false); // ✅ close modal (optional)
                  } catch (error) {
                    console.error("Error reprocessing:", error);
                  } finally {
                    setIsProcessing(false); // ✅ hide spinner
                  }
                }}
                disabled={isProcessing}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isProcessing ? '#93c5fd' : '#3b82f6', // lighter blue when loading
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessing ? 'Reprocessing...' : 'Reprocess'}
              </button>
 
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#1f2937',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Annotation Modal */}
      {annotationState.isEditing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '24px', borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)', minWidth: '300px'
          }}>
            <h3 style={{ marginBottom: '16px' }}>Add Annotation</h3>
            <textarea
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              placeholder="Enter your annotation..."
              style={{
                width: '100%', minHeight: '80px', padding: '12px',
                border: '1px solid #d1d5db', borderRadius: '6px', resize: 'vertical'
              }}
              autoFocus
            />
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={cancelAnnotation}>Cancel</button>
              <button onClick={saveAnnotation}><Save size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
 
const Legend: React.FC<LegendProps> = ({ nodes }) => {
  // Create a map of group => color
  const groupMap: { [key: string]: string } = {};
 
  nodes.forEach((node) => {
    if (!groupMap[node.group]) {
      groupMap[node.group] = node.color;
    }
  });
 
  // Optional: Map group keys to display names
  const groupNames: GroupNames = {
    person: "People",
    company: "Companies",
    sales_opportunity: "Sales Opportunities",
    central_theme: "Central Theme",
    task: "Task"
  };
 
  return (
    <div>
      {Object.entries(groupMap).map(([group, color]) => (
        <div key={group} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '18px',
            height: '18px',
            backgroundColor: color,
            borderRadius: '50%',
            boxShadow: `0 2px 4px ${color}33` // Add transparency to shadow
          }}></div>
          <span style={{ fontSize: '15px', color: '#4b5563', fontWeight: '500' }}>
            {groupNames[group] || group} {/* fallback to group key if no mapping */}
          </span>
        </div>
      ))}
    </div>
  );
};
 
const OpportunityNodeGraph: React.FC<OpportunityNodeGraphProps> = (props) => (
  <ReactFlowProvider>
    <OpportunityNodeGraphInner {...props} />
  </ReactFlowProvider>
);
 
export default OpportunityNodeGraph;
 