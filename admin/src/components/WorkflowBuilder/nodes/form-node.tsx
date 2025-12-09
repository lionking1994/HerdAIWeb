import React from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { FileText, Edit, Trash2 } from 'lucide-react';

interface FormField {
  name: string;
  type: 'text' | 'dropdown' | 'memo' | 'file' | 'radio' | 'signature' | 'date';
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface FormNodeData {
  label: string;
  description?: string;
  formFields?: FormField[];
  layout?: string;
  isStartNode?: boolean;
}

const FormNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const nodeData = data as unknown as FormNodeData;
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

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return '📝';
      case 'date': return '📅';
      case 'dropdown': return '📋';
      case 'memo': return '📄';
      case 'file': return '📁';
      case 'radio': return '🔘';
      case 'signature': return '✍️';
      default: return '📝';
    }
  };

  const getFieldTypeLabel = (type: string) => {
    switch (type) {
      case 'text': return 'Text';
      case 'date': return 'Date Picker';
      case 'dropdown': return 'Dropdown';
      case 'memo': return 'Memo';
      case 'file': return 'File';
      case 'radio': return 'Radio';
      case 'signature': return 'Signature';
      default: return 'Text';
    }
  };

  return (
    <div className={`relative group ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} ${nodeData?.isStartNode ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}>
      <div className="bg-cyan-500 text-white px-4 py-3 rounded-lg shadow-lg min-w-[180px] max-w-[220px]">
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
            <FileText className="w-4 h-4" />
            <span className="font-semibold text-sm">{nodeData?.label || 'Form'}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button 
              onClick={handleEdit}
              className="p-1 hover:bg-cyan-600 rounded text-xs transition-colors"
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
        
        {/* Form fields display */}
        {nodeData?.formFields && nodeData.formFields.length > 0 ? (
          <div className="space-y-1 mt-2">
            <div className="text-xs opacity-75 bg-cyan-600 px-2 py-1 rounded">
              {nodeData.formFields.length} fields
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {nodeData.formFields.slice(0, 3).map((field, index) => (
                <div key={index} className="text-xs bg-cyan-50 text-cyan-800 px-2 py-1 rounded border border-cyan-200 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <span>{getFieldTypeIcon(field.type)}</span>
                    <span className="truncate">{field.name}</span>
                    {field.required && <span className="text-red-500">*</span>}
                  </div>
                  <span className="text-cyan-600 text-xs opacity-75">
                    {getFieldTypeLabel(field.type)}
                  </span>
                </div>
              ))}
              {nodeData.formFields.length > 3 && (
                <div className="text-xs text-cyan-700 italic">
                  +{nodeData.formFields.length - 3} more fields
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs opacity-60 italic mt-2">
            No fields configured
          </div>
        )}
      </div>
      
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-cyan-600 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-cyan-600 border-2 border-white"
      />
    </div>
  );
};

export default FormNode; 