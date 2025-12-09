import React from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Building2, Edit, Trash2 } from 'lucide-react';

interface CrmUpdateNodeData {
  label: string;
  description?: string;
  crmEntity?: string;
  updateMethod?: string;
  fieldMapping?: Record<string, string>;
  isStartNode?: boolean;
}

const CrmUpdateNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const nodeData = data as unknown as CrmUpdateNodeData;
  const { setNodes, setEdges } = useReactFlow();

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    // This will trigger the node selection which opens the properties panel
    const event = new MouseEvent('click', { bubbles: true });
    e.currentTarget.dispatchEvent(event);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
  };

  return (
    <div className={`relative group ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} ${nodeData?.isStartNode ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}>
      <div className="bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg min-w-[180px] max-w-[220px]">
        {/* Play Button for Start Node */}
        {nodeData?.isStartNode && (
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg z-10 hover:bg-blue-600 transition-colors cursor-pointer">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}
        {/* Header with icon, name, and action buttons */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4" />
            <span className="font-semibold text-sm">{nodeData?.label || 'CRM Update'}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button 
              onClick={handleEdit}
              className="p-1 hover:bg-emerald-600 rounded text-xs transition-colors"
              title="Edit node"
            >
              <Edit className="w-3 h-3" />
            </button>
            <button 
              onClick={handleDelete}
              className="p-1 hover:bg-red-500 rounded text-xs transition-colors"
              title="Delete node"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        {/* Description - always visible */}
        {nodeData?.description ? (
          <div className="text-xs opacity-90 mb-2 leading-relaxed">
            {nodeData.description}
          </div>
        ) : (
          <div className="text-xs opacity-60 mb-2 italic">
            No description
          </div>
        )}
        
        {/* Status information */}
        {nodeData?.crmEntity && nodeData?.updateMethod && (
          <div className="text-xs opacity-75 bg-emerald-600 px-2 py-1 rounded">
            {nodeData.crmEntity} - {nodeData.updateMethod}
          </div>
        )}
      </div>
      
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-emerald-600 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-emerald-600 border-2 border-white"
      />
    </div>
  );
};

export default CrmUpdateNode; 