import React from 'react';
import { Download, Save, Users, Building2, Target, Lightbulb } from 'lucide-react';

// Types
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

type AnnotationType = 'node' | 'edge';

interface AnnotationState {
  isEditing: boolean;
  nodeId: string | null;
  edgeId: string | null;
  type: AnnotationType;
  position: { x: number; y: number };
}

type NodeAnnotations = Record<string, string>;
type EdgeAnnotations = Record<string, string>;

// Node with computed position for the simple SVG layout
interface PositionedNode extends VisualizationNode {
  x: number;
  y: number;
}

// Custom layout algorithm inspired by dagre
const createLayout = (
  nodes: VisualizationNode[],
  edges: VisualizationEdge[]
): { nodes: PositionedNode[]; edges: VisualizationEdge[] } => {
  const nodeWidth = 172;
  const nodeHeight = 60;
  const spacing = 120;
  
  // Create adjacency lists
  const adjacencyList: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  
  nodes.forEach(node => {
    adjacencyList[node.id] = [];
    inDegree[node.id] = 0;
  });
  
  edges.forEach(edge => {
    if (adjacencyList[edge.from]) {
      adjacencyList[edge.from].push(edge.to);
      inDegree[edge.to] = (inDegree[edge.to] || 0) + 1;
    }
  });
  
  // Topological sort for layering
  const layers: string[][] = [];
  const queue: VisualizationNode[] = nodes.filter(node => inDegree[node.id] === 0);
  
  while (queue.length > 0) {
    const currentLayer: string[] = [];
    const nextQueue: VisualizationNode[] = [];
    
    for (const node of queue) {
      currentLayer.push(node.id);
      
      for (const neighbor of adjacencyList[node.id] || []) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          const found = nodes.find(n => n.id === neighbor);
          if (found) nextQueue.push(found);
        }
      }
    }
    
    layers.push(currentLayer);
    queue.length = 0;
    queue.push(...nextQueue);
  }
  
  // Position nodes
  const positionedNodes: PositionedNode[] = [];
  layers.forEach((layer, layerIndex) => {
    const y = layerIndex * (nodeHeight + spacing) + 50;
    const layerWidth = layer.length * (nodeWidth + spacing) - spacing;
    const startX = (window.innerWidth - layerWidth - 320) / 2; // Account for side panel width
    
    layer.forEach((nodeId, nodeIndex) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        positionedNodes.push({
          ...node,
          x: startX + nodeIndex * (nodeWidth + spacing),
          y: y
        });
      }
    });
  });
  
  return { nodes: positionedNodes, edges };
};

interface OpportunityNodeGraphInnerProps {
  jsonData: JsonData;
  onNodeClick?: (node: VisualizationNode) => void;
  onAnnotationChange?: (id: string, text: string, type: AnnotationType) => void;
  exportFormat?: 'png' | 'svg' | 'json';
}

const OpportunityNodeGraphInner: React.FC<OpportunityNodeGraphInnerProps> = ({
  jsonData,
  onNodeClick,
  onAnnotationChange,
  exportFormat = 'png'
}) => {
  const [selectedNode, setSelectedNode] = React.useState<VisualizationNode | null>(null);
  const [annotationState, setAnnotationState] = React.useState<AnnotationState>({
    isEditing: false,
    nodeId: null,
    edgeId: null,
    type: 'node',
    position: { x: 0, y: 0 }
  });
  
  const [annotationText, setAnnotationText] = React.useState<string>('');
  const [nodeAnnotations, setNodeAnnotations] = React.useState<NodeAnnotations>({});
  const [edgeAnnotations, setEdgeAnnotations] = React.useState<EdgeAnnotations>({});
  const [format, setFormat] = React.useState<'png' | 'svg' | 'json'>(exportFormat);

  const handleAnnotationClick = React.useCallback((id: string, type: AnnotationType = 'node') => {
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

  const saveAnnotation = React.useCallback((): void => {
    const id = annotationState.nodeId || annotationState.edgeId;
    if (!id) return;

    if (annotationState.type === 'node') {
      setNodeAnnotations(prev => ({
        ...prev,
        [id]: annotationText
      }));
    } else {
      setEdgeAnnotations(prev => ({
        ...prev,
        [id]: annotationText
      }));
    }

    onAnnotationChange?.(id, annotationText, annotationState.type);
    setAnnotationState({
      isEditing: false,
      nodeId: null,
      edgeId: null,
      type: 'node',
      position: { x: 0, y: 0 }
    });
    setAnnotationText('');
  }, [annotationState, annotationText, onAnnotationChange]);

  const cancelAnnotation = React.useCallback((): void => {
    setAnnotationState({
      isEditing: false,
      nodeId: null,
      edgeId: null,
      type: 'node',
      position: { x: 0, y: 0 }
    });
    setAnnotationText('');
  }, []);

  // Create layout
  const { nodes, edges } = React.useMemo((): { nodes: PositionedNode[]; edges: VisualizationEdge[] } => {
    return createLayout(jsonData.visualization.nodes, jsonData.visualization.edges);
  }, [jsonData]);

  const handleNodeClick = React.useCallback((node: VisualizationNode) => {
    setSelectedNode(node);
    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [onNodeClick]);

  const exportGraph = React.useCallback(async (): Promise<void> => {
    try {
      if (format === 'json') {
        const dataStr = JSON.stringify({
          ...jsonData,
          annotations: {
            nodes: nodeAnnotations,
            edges: edgeAnnotations
          }
        }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'meeting-analysis.json';
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // For image export, we'll use a simple approach
        const svgElement = document.querySelector('.graph-svg') as SVGSVGElement | null;
        if (svgElement) {
          const svgData = new XMLSerializer().serializeToString(svgElement);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          const img = new Image();
          
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const link = document.createElement('a');
            link.download = `meeting-analysis.${format}`;
            link.href = canvas.toDataURL(`image/${format}`);
            link.click();
          };
          
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  }, [format, jsonData, nodeAnnotations, edgeAnnotations]);

  // Helper functions for side panel
  const getNodeIcon = (group: string): JSX.Element => {
    switch (group) {
      case 'person':
        return <Users size={16} className="text-purple-500" />;
      case 'company':
        return <Building2 size={16} className="text-blue-500" />;
      case 'opportunity':
        return <Target size={16} className="text-green-500" />;
      case 'central_theme':
        return <Lightbulb size={16} className="text-orange-500" />;
      default:
        return <Users size={16} className="text-gray-500" />;
    }
  };

  const getGroupLabel = (group: string): string => {
    switch (group) {
      case 'person':
        return 'Person';
      case 'company':
        return 'Company';
      case 'opportunity':
        return 'Sales Opportunity';
      case 'central_theme':
        return 'Central Theme';
      default:
        return 'Node';
    }
  };

  return (
    <div className="interactive-node-graph" style={{ width: '100%', height: '100vh', display: 'flex' }}>
      {/* Main Graph Area */}
      <div style={{ 
        flex: 1, 
        position: 'relative', 
        backgroundColor: '#f8fafc',
        padding: '20px',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 10
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: '0 0 4px 0'
          }}>
            Meeting Analysis Dashboard
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: 0
          }}>
            Interactive visualization of meeting transcript relationships and opportunities
          </p>
        </div>

        {/* Export Controls */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as 'png' | 'svg' | 'json')}
            style={{
              padding: '4px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            <option value="png">PNG</option>
            <option value="svg">SVG</option>
            <option value="json">JSON</option>
          </select>
          <button
            onClick={exportGraph}
            style={{
              padding: '6px 12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={`Export as ${format.toUpperCase()}`}
          >
            <Download size={14} />
            Export
          </button>
        </div>

        <svg 
          className="graph-svg"
          width="100%" 
          height="100%" 
          style={{ 
            minWidth: '1200px', 
            minHeight: '800px',
            backgroundColor: '#f8fafc'
          }}
        >
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
            </marker>
          </defs>

          {/* Draw edges first (behind nodes) */}
          {edges.map((edge, index) => {
            const sourceNode = nodes.find(n => n.id === edge.from);
            const targetNode = nodes.find(n => n.id === edge.to);
            
            if (!sourceNode || !targetNode) return null;
            
            return (
              <g key={`edge-${index}`}>
                <line
                  x1={sourceNode.x + 86}
                  y1={sourceNode.y + 30}
                  x2={targetNode.x + 86}
                  y2={targetNode.y + 30}
                  stroke="#666"
                  strokeWidth={edge.thickness || 2}
                  markerEnd="url(#arrowhead)"
                />
                <text
                  x={(sourceNode.x + targetNode.x) / 2 + 86}
                  y={(sourceNode.y + targetNode.y) / 2 + 25}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#333"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {/* Draw nodes */}
          {nodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width="172"
                height="60"
                rx="8"
                fill={node.color}
                stroke="#333"
                strokeWidth="2"
                cursor="pointer"
                onClick={() => handleNodeClick(node)}
                style={{ transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => {
                  const target = e.target as SVGRectElement & { style: any };
                  target.style.transform = 'scale(1.05)';
                  target.style.filter = 'brightness(1.1)';
                }}
                onMouseLeave={(e) => {
                  const target = e.target as SVGRectElement & { style: any };
                  target.style.transform = 'scale(1)';
                  target.style.filter = 'brightness(1)';
                }}
              />
              <text
                x={node.x + 86}
                y={node.y + 35}
                textAnchor="middle"
                fontSize="12"
                fill="white"
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {node.label}
              </text>
              {nodeAnnotations[node.id] && (
                <text
                  x={node.x + 86}
                  y={node.y + 50}
                  textAnchor="middle"
                  fontSize="10"
                  fill="white"
                  style={{ pointerEvents: 'none' }}
                >
                  {nodeAnnotations[node.id]}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Side Panel */}
      <div style={{
        width: '320px',
        backgroundColor: 'white',
        borderLeft: '1px solid #e5e7eb',
        padding: '24px',
        overflowY: 'auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Legend */}
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              margin: '0 0 16px 0'
            }}>
              Legend
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#8b5cf6',
                  borderRadius: '4px'
                }}></div>
                <span style={{ fontSize: '14px', color: '#374151' }}>People</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '4px'
                }}></div>
                <span style={{ fontSize: '14px', color: '#374151' }}>Companies</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#10b981',
                  borderRadius: '4px'
                }}></div>
                <span style={{ fontSize: '14px', color: '#374151' }}>Sales Opportunities</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#f59e0b',
                  borderRadius: '4px'
                }}></div>
                <span style={{ fontSize: '14px', color: '#374151' }}>Central Theme</span>
              </div>
            </div>
          </div>

          {/* Selected Node Info */}
          {selectedNode && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
                margin: '0 0 16px 0'
              }}>
                Selected Node
              </h3>
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {getNodeIcon(selectedNode.group)}
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>
                    {getGroupLabel(selectedNode.group)}
                  </span>
                </div>
                <h4 style={{
                  fontWeight: '600',
                  color: '#111827',
                  margin: '0 0 8px 0'
                }}>
                  {selectedNode.label}
                </h4>
                {nodeAnnotations[selectedNode.id] && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: '#dbeafe',
                    border: '1px solid #93c5fd',
                    borderRadius: '4px'
                  }}>
                    <p style={{ fontSize: '12px', color: '#1e40af', fontWeight: '500', margin: '0 0 4px 0' }}>
                      Annotation:
                    </p>
                    <p style={{ fontSize: '14px', color: '#1d4ed8', margin: 0 }}>
                      {nodeAnnotations[selectedNode.id]}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              margin: '0 0 16px 0'
            }}>
              Instructions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151', minWidth: '60px' }}>
                  Click:
                </span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  Select nodes to view details
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151', minWidth: '60px' }}>
                  Scroll:
                </span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  Zoom in/out of the graph
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151', minWidth: '60px' }}>
                  Drag:
                </span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  Pan around the graph
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151', minWidth: '60px' }}>
                  Edit icon:
                </span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  Add annotations to nodes and edges
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151', minWidth: '60px' }}>
                  Download:
                </span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  Export the graph as PNG, SVG, or JSON
                </span>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              margin: '0 0 16px 0'
            }}>
              Summary
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#8b5cf6'
                }}>
                  {jsonData.visualization.nodes.filter(n => n.group === 'person').length}
                </div>
                {/* <div style={{ fontSize: '12px', color: '#6b7280' }}>People</div> */}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#3b82f6'
                }}>
                  {jsonData.visualization.nodes.filter(n => n.group === 'company').length}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Companies</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#10b981'
                }}>
                  {jsonData.visualization.nodes.filter(n => n.group === 'opportunity').length}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Opportunities</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#f59e0b'
                }}>
                  {jsonData.visualization.edges.length}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Connections</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Annotation Modal */}
      {annotationState.isEditing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
            minWidth: '300px',
            maxWidth: '500px'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '18px', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Add Annotation
            </h3>
            <textarea
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              placeholder="Enter your annotation..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              autoFocus
            />
            <div style={{
              marginTop: '16px',
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={cancelAnnotation}
                style={{
                  padding: '8px 16px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveAnnotation}
                style={{
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Save size={14} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OpportunityNodeGraph: React.FC<OpportunityNodeGraphInnerProps> = (props) => {
  return <OpportunityNodeGraphInner {...props} />;
};

export default OpportunityNodeGraph; 


