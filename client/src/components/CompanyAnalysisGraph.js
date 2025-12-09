import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Building2, 
  Users, 
  Briefcase, 
  Cpu, 
  DollarSign,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  ChevronLeft,
  ChevronRight,
  MapPin,
  User,
  BriefcaseIcon,
  Globe
} from 'lucide-react';

const CompanyAnalysisGraph = ({ companyData }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);


  // Main data processing and node/edge creation logic
  useMemo(() => {
    if (!companyData || !companyData.nodes) return;

    const newNodes = [];
    const newEdges = [];
    console.log("🤔🤔🤔 companyData:", companyData);

    // Improved positioning algorithm to prevent overlapping
    const calculateNodePositions = (nodes) => {
      const positions = [];
      const nodeSpacing = 250; // Minimum distance between nodes
      const centerX = 600;
      const centerY = 400;
      
      // Group nodes by type
      const nodesByType = {};
      nodes.forEach(node => {
        if (!nodesByType[node.type]) {
          nodesByType[node.type] = [];
        }
        nodesByType[node.type].push(node);
      });

      // Position company nodes in the center
      if (nodesByType['Company']) {
        nodesByType['Company'].forEach((node, index) => {
          positions.push({
            id: node.id,
            x: centerX + (index * 50),
            y: centerY + (index * 50)
          });
        });
      }

      // Position executives in a circle around the company
      if (nodesByType['Executive']) {
        const radius = 300;
        const angleStep = (2 * Math.PI) / nodesByType['Executive'].length;
        nodesByType['Executive'].forEach((node, index) => {
          const angle = index * angleStep;
          positions.push({
            id: node.id,
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          });
        });
      }

      // Position other node types in different quadrants
      const otherTypes = Object.keys(nodesByType).filter(type => type !== 'Company' && type !== 'Executive');
      otherTypes.forEach((type, typeIndex) => {
        const nodesOfType = nodesByType[type];
        const quadrant = typeIndex % 4;
        let baseX, baseY;
        
        switch (quadrant) {
          case 0: // Top-left
            baseX = 200;
            baseY = 100;
            break;
          case 1: // Top-right
            baseX = 800;
            baseY = 100;
            break;
          case 2: // Bottom-left
            baseX = 200;
            baseY = 600;
            break;
          case 3: // Bottom-right
            baseX = 800;
            baseY = 600;
            break;
          default: // Fallback to top-left
            baseX = 200;
            baseY = 100;
            break;
        }

        // Arrange nodes in a grid within their quadrant
        const nodesPerRow = Math.ceil(Math.sqrt(nodesOfType.length));
        nodesOfType.forEach((node, index) => {
          const row = Math.floor(index / nodesPerRow);
          const col = index % nodesPerRow;
          positions.push({
            id: node.id,
            x: baseX + (col * nodeSpacing),
            y: baseY + (row * nodeSpacing)
          });
        });
      });

      // Collision detection and adjustment
      const adjustForCollisions = (positions) => {
        const adjustedPositions = [...positions];
        const minDistance = nodeSpacing;
        let hasCollisions = true;
        let iterations = 0;
        const maxIterations = 50;

        while (hasCollisions && iterations < maxIterations) {
          hasCollisions = false;
          iterations++;

          for (let i = 0; i < adjustedPositions.length; i++) {
            for (let j = i + 1; j < adjustedPositions.length; j++) {
              const pos1 = adjustedPositions[i];
              const pos2 = adjustedPositions[j];
              
              const distance = Math.sqrt(
                Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
              );

              if (distance < minDistance) {
                hasCollisions = true;
                
                // Calculate separation vector
                const angle = Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x);
                const separation = minDistance - distance;
                
                // Move nodes apart
                pos1.x -= Math.cos(angle) * separation * 0.5;
                pos1.y -= Math.sin(angle) * separation * 0.5;
                pos2.x += Math.cos(angle) * separation * 0.5;
                pos2.y += Math.sin(angle) * separation * 0.5;
              }
            }
          }
        }

        return adjustedPositions;
      };

      return adjustForCollisions(positions);
    };

    // Calculate positions for all nodes
    const nodePositions = calculateNodePositions(companyData.nodes);

    // Process nodes from the data
    companyData.nodes.forEach((nodeData, index) => {
      // Find the calculated position for this node
      const position = nodePositions.find(pos => pos.id === nodeData.id) || 
                      { x: 100 + (index * 200), y: 100 + (index * 150) };

      const node = {
        id: nodeData.id,
        type: 'default', // Use default node type
        position: { x: position.x, y: position.y },
        data: {
          ...nodeData, // Include all node data
          label: nodeData.name || nodeData.label || nodeData.id,
        },
      };
      
      newNodes.push(node);
    });

    // Process edges from the data
    if (companyData.edges) {
      companyData.edges.forEach((edgeData, index) => {
        const edge = {
          id: `edge-${index}`,
          source: edgeData.from,
          target: edgeData.to,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#8b5cf6', strokeWidth: 2 },
          label: edgeData.relationship || 'employs',
        };
        
        newEdges.push(edge);
      });
    }

    console.log("newNodes", newNodes);
    console.log("newEdges", newEdges);
    
    // Update the graph with all nodes and connections
    setNodes(newNodes);
    setEdges(newEdges);
  }, [companyData, setNodes, setEdges]);

  // Handle manual edge connections (for user interactions)
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Control functions
  const handleZoomIn = useCallback(() => {
    if (reactFlowInstance?.zoomIn) {
      reactFlowInstance.zoomIn({ duration: 300 });
    }
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    if (reactFlowInstance?.zoomOut) {
      reactFlowInstance.zoomOut({ duration: 300 });
    }
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    if (reactFlowInstance?.fitView) {
      reactFlowInstance.fitView({ padding: 0.1, duration: 800 });
    }
  }, [reactFlowInstance]);

  const exportGraph = useCallback(async () => {
    try {
      const dataStr = JSON.stringify({
        companyData,
        nodes,
        edges
      }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'company-analysis.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  }, [companyData, nodes, edges]);

  // Calculate summary statistics dynamically
  const summaryStats = useMemo(() => {
    const connectionsCount = edges.length;

    return {
      connections: connectionsCount
    };
  }, [edges]);

  // Get primary node data for sidebar (first node or any node with specific properties)
  const primaryNode = useMemo(() => {
    return nodes.find(node => 
      node.data.annualRevenueUSD || 
      node.data.industry || 
      node.data.website
    ) || nodes[0];
  }, [nodes]);

  if (!companyData || !companyData.nodes) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Company Data</h3>
          <p className="mt-1 text-sm text-gray-500">Company analysis data is not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[800px] border border-gray-200 rounded-lg overflow-hidden relative">      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        fitView
        attributionPosition="bottom-left"
        className="bg-gray-50"
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        nodeTypes={{
          default: GenericNode, // Use our custom generic node
        }}
      >
        <MiniMap 
          nodeStrokeColor={(n) => {
            // Generate color based on node type dynamically
            const type = n.data.type || 'default';
            const colors = {
              'Company': '#1f2937',
              'Executive': '#f59e0b',
              'Technology': '#3b82f6',
              'Revenue': '#10b981',
              'Role': '#8b5cf6',
              'default': '#6b7280'
            };
            return colors[type] || colors.default;
          }}
          nodeColor={(n) => {
            // Generate background color based on node type dynamically
            const type = n.data.type || 'default';
            const colors = {
              'Company': '#f3f4f6',
              'Executive': '#fef3c7',
              'Technology': '#dbeafe',
              'Revenue': '#d1fae5',
              'Role': '#f3e8ff',
              'default': '#f9fafb'
            };
            return colors[type] || colors.default;
          }}
        />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>

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
        overflowY: 'auto',
        zIndex: 5,
        boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease-in-out',
        overflow: isSidebarCollapsed ? 'hidden' : 'auto'
      }}>
        {/* Primary Node Overview */}
        {primaryNode && (
        <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Primary Node Overview</h4>
          <div className="space-y-3 text-sm">
              {primaryNode.data.annualRevenueUSD && (
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
                  <span>{new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(primaryNode.data.annualRevenueUSD)}</span>
            </div>
              )}
              {primaryNode.data.location && (
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-500" />
                  <span>{primaryNode.data.location}</span>
            </div>
              )}
              {primaryNode.data.size && (
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
                  <span>{primaryNode.data.size}</span>
            </div>
              )}
              {primaryNode.data.industry && (
            <div className="flex items-center space-x-2">
              <BriefcaseIcon className="h-4 w-4 text-gray-500" />
                  <span>{primaryNode.data.industry}</span>
            </div>
              )}
              {primaryNode.data.website && (
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-gray-500" />
                  <span>{primaryNode.data.website}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Legend Section */}
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
            {Array.from(new Set(nodes.map(n => n.data.type))).map(nodeType => {
              const colors = {
                'Company': { bg: '#1f2937', text: 'Company' },
                'Executive': { bg: '#f59e0b', text: 'Executives' },
                'Technology': { bg: '#3b82f6', text: 'Technology' },
                'Revenue': { bg: '#10b981', text: 'Revenue' },
                'Role': { bg: '#8b5cf6', text: 'Role Categories' },
                'default': { bg: '#6b7280', text: nodeType || 'Other' }
              };
              const color = colors[nodeType] || colors.default;
              
              return (
                <div key={nodeType} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '18px',
                height: '18px',
                    backgroundColor: color.bg,
                borderRadius: '50%',
                    boxShadow: `0 2px 4px ${color.bg}40`
              }}></div>
                  <span style={{ fontSize: '15px', color: '#4b5563', fontWeight: '500' }}>{color.text}</span>
            </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{
          height: '1px',
          backgroundColor: '#e5e7eb',
          margin: '25px 0',
          opacity: 0.6
        }}></div>

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
              <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.4' }}>Scroll: Zoom in/out of the graph</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>•</span>
              <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.4' }}>Drag: Pan around the graph</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#10b981', marginTop: '2px' }}>•</span>
              <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.4' }}>Use controls: Zoom, fit view, export</span>
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

        {/* Dynamic Summary Section */}
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
            {Array.from(new Set(nodes.map(n => n.data.type))).map(nodeType => {
              const count = nodes.filter(n => n.data.type === nodeType).length;
              const colors = {
                'Company': { bg: '#1f2937', text: 'Companies' },
                'Executive': { bg: '#f59e0b', text: 'Executives' },
                'Technology': { bg: '#3b82f6', text: 'Technology' },
                'Revenue': { bg: '#10b981', text: 'Revenue Sources' },
                'Role': { bg: '#8b5cf6', text: 'Role Categories' },
                'default': { bg: '#6b7280', text: nodeType || 'Other' }
              };
              const color = colors[nodeType] || colors.default;
              
              return (
                <div key={nodeType} style={{
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
                      backgroundColor: color.bg,
                  borderRadius: '50%'
                }}></div>
                    <span style={{ fontSize: '15px', color: '#374151', fontWeight: '500' }}>{color.text}</span>
              </div>
              <span style={{
                fontSize: '18px',
                fontWeight: '700',
                    color: color.bg,
                backgroundColor: '#f3f4f6',
                padding: '4px 12px',
                borderRadius: '20px',
                minWidth: '40px',
                textAlign: 'center'
                  }}>{count}</span>
            </div>
              );
            })}
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
          title="Export as JSON"
        >
          <Download size={16} />
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
    </div>
  );
};

// Generic node component that adapts based on the node type
const GenericNode = ({ data }) => {
  const nodeType = data.type || 'default';

  // Dynamic color scheme based on node type
  const getNodeStyle = () => {
    const colorScheme = {
      'Company': {
        backgroundColor: '#f3f4f6',
        border: '2px solid #1f2937',
        color: '#1f2937',
        icon: <Building2 className="h-5 w-5" />
      },
      'Executive': {
        backgroundColor: '#fef3c7',
        border: '2px solid #f59e0b',
        color: '#f59e0b',
        icon: <Users className="h-4 w-4" />
      },
      'Technology': {
        backgroundColor: '#dbeafe',
        border: '2px solid #3b82f6',
        color: '#3b82f6',
        icon: <Cpu className="h-4 w-4" />
      },
      'Revenue': {
        backgroundColor: '#d1fae5',
        border: '2px solid #10b981',
        color: '#10b981',
        icon: <DollarSign className="h-4 w-4" />
      },
      'Role': {
        backgroundColor: '#f3e8ff',
        border: '2px solid #8b5cf6',
        color: '#8b5cf6',
        icon: <Briefcase className="h-4 w-4" />
      },
      'default': {
        backgroundColor: '#f9fafb',
        border: '2px solid #6b7280',
        color: '#6b7280',
        icon: <Briefcase className="h-4 w-4" />
      }
    };

    return colorScheme[nodeType] || colorScheme.default;
  };

  const style = getNodeStyle();

  // Get all available data fields for display
  const getDisplayData = () => {
    const displayFields = [];
    
    // Common fields that might be present
    const commonFields = [
      { key: 'industry', label: 'Industry' },
      { key: 'size', label: 'Size' },
      { key: 'location', label: 'Location' },
      { key: 'position', label: 'Position' },
      { key: 'description', label: 'Description' },
      { key: 'website', label: 'Website' },
      { key: 'annualRevenueUSD', label: 'Revenue', format: 'currency' },
      { key: 'count', label: 'Count' }
    ];

    commonFields.forEach(field => {
      if (data[field.key]) {
        let value = data[field.key];
        
        // Format currency values
        if (field.format === 'currency' && typeof value === 'number') {
          value = new Intl.NumberFormat('en-US', {
        style: 'currency',
            currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
          }).format(value);
        }
        
        displayFields.push({ label: field.label, value });
      }
    });

    return displayFields;
  };

  const displayData = getDisplayData();

  return (
    <div 
      className="rounded-lg p-3 shadow-md min-w-[180px] relative"
      style={{
        backgroundColor: style.backgroundColor,
        border: style.border,
        color: style.color
      }}
    >
    <Handle
      type="target"
      position="top"
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: style.color }}
    />
    <Handle
      type="source"
      position="bottom"
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: style.color }}
    />
    <Handle
      type="source"
      position="left"
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: style.color }}
    />
    <Handle
      type="source"
      position="right"
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: style.color }}
    />
      
    <div className="flex items-center gap-2 mb-1">
        {style.icon}
      <h4 className="font-semibold text-sm text-gray-900">{data.label}</h4>
      </div>
      
      {/* Display all available data dynamically */}
      {displayData.length > 0 && (
        <div className="text-xs text-gray-700 space-y-1">
          {displayData.map((item, index) => (
            <div key={index}>
              {item.label === 'Description' ? (
                <p className="line-clamp-2">{item.value}</p>
              ) : (
                <div><span className="font-medium">{item.label}:</span> {item.value}</div>
              )}
            </div>
          ))}
        </div>
      )}
  </div>
);
};

export default CompanyAnalysisGraph;
