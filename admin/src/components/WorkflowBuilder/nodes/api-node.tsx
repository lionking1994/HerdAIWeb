import React from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { Globe, Edit, Trash2 } from 'lucide-react';

interface ApiNodeData {
  label: string;
  description?: string;
  endpoint?: string;
  method?: string;
  authType?: string;
  isStartNode?: boolean;
}

const ApiNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as ApiNodeData;

  return (
    <div className={`relative group ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} ${nodeData?.isStartNode ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}>
      <div className="bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg min-w-[160px] max-w-[200px]">
        {/* Play Button for Start Node */}
        {nodeData?.isStartNode && (
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg z-10 hover:bg-blue-600 transition-colors cursor-pointer">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4" />
            <span className="font-medium text-sm">{nodeData?.label || 'API'}</span>
          </div>
          {selected && (
            <div className="flex items-center space-xS-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1 hover:bg-emerald-600 rounded text-xs">
                <Edit className="w-3 h-3" />
              </button>
              <button className="p-1 hover:bg-red-500 rounded text-xs">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        
        {nodeData?.description && (
          <div className="text-xs opacity-90 mb-2 line-clamp-2">
            {nodeData.description}
          </div>
        )}
        
        {nodeData?.method && (
          <div className="text-xs opacity-75 bg-emerald-600 px-2 py-1 rounded">
            {nodeData.method}
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

export default ApiNode; 