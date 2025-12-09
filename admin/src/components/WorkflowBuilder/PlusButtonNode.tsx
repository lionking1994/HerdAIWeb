import React, { useState, useRef, useEffect } from 'react';
import { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Plus, X } from 'lucide-react';

interface PlusButtonNodeData {
  onAddNode: (nodeType: string, position: { x: number; y: number }) => void;
  parentNodeId?: string;
  isTrailingButton?: boolean;
  isDefaultButton?: boolean;
  isStartButton?: boolean;
  isFixedButton?: boolean;
}

const nodeTypes = [
  { 
    type: 'triggerNode', 
    label: 'Trigger', 
    description: 'Workflow trigger point',
    icon: '⚡',
    color: 'bg-purple-500 hover:bg-purple-600'
  },
  { 
    type: 'formNode', 
    label: 'Form', 
    description: 'Form builder with fields and layout',
    icon: '📋',
    color: 'bg-cyan-500 hover:bg-cyan-600'
  },
  { 
    type: 'approvalNode', 
    label: 'Approval', 
    description: 'Role or person-based approval',
    icon: '✓',
    color: 'bg-orange-500 hover:bg-orange-600'
  },
  { 
    type: 'conditionNode', 
    label: 'Condition', 
    description: 'Branch workflow logic',
    icon: '?',
    color: 'bg-amber-500 hover:bg-amber-600'
  },
  { 
    type: 'updateNode', 
    label: 'Update', 
    description: 'Update table records',
    icon: '🔄',
    color: 'bg-indigo-500 hover:bg-indigo-600'
  },
  { 
    type: 'crmUpdateNode', 
    label: 'CRM Update', 
    description: 'Update CRM records (accounts, contacts, opportunities)',
    icon: '🏢',
    color: 'bg-emerald-500 hover:bg-emerald-600'
  },
  { 
    type: 'notificationNode', 
    label: 'Notification', 
    description: 'Email or application notification',
    icon: '🔔',
    color: 'bg-teal-500 hover:bg-teal-600'
  },
  { 
    type: 'delayNode', 
    label: 'Delay', 
    description: 'Time-based delay',
    icon: '⏱',
    color: 'bg-gray-500 hover:bg-gray-600'
  },
  { 
    type: 'webhookNode', 
    label: 'Webhook', 
    description: 'Webhook with authentication',
    icon: '🌐',
    color: 'bg-pink-500 hover:bg-pink-600'
  },
  { 
    type: 'apiNode', 
    label: 'API', 
    description: 'API call with authentication',
    icon: '🔗',
    color: 'bg-emerald-500 hover:bg-emerald-600'
  },
  { 
    type: 'agentNode', 
    label: 'Agent', 
    description: 'Agent MCP details',
    icon: '🤖',
    color: 'bg-violet-500 hover:bg-violet-600'
  },
  { 
    type: 'promptNode', 
    label: 'Prompt', 
    description: 'AI-powered prompt processing',
    icon: '💬',
    color: 'bg-emerald-500 hover:bg-emerald-600'
  },
  { 
    type: 'endNode', 
    label: 'End', 
    description: 'Workflow end point',
    icon: '⏹️',
    color: 'bg-red-500 hover:bg-red-600'
  },
  { 
    type: 'task_update', 
    label: 'Task Update', 
    description: 'Update task information',
    icon: '📝',
    color: 'bg-violet-500 hover:bg-violet-600'
  },
  { 
    type: 'promptNode', 
    label: 'Prompt', 
    description: 'AI-powered prompt processing',
    icon: '💬',
    color: 'bg-emerald-500 hover:bg-emerald-600'
    icon: '💬',
    color: 'bg-emerald-500 hover:bg-emerald-600'
    color: 'bg-emerald-500 hover:bg-emerald-600'
  },
  },
  { 
    type: 'notification', 
    label: 'Send notification', 
    description: 'Send notification to users',
    icon: '🔔',
    color: 'bg-orange-500 hover:bg-orange-600'
  }
];

const PlusButtonNode: React.FC<NodeProps> = ({ 
  data, 
  selected
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const nodeData = (data as unknown) as PlusButtonNodeData;
  const isTrailing = nodeData.isTrailingButton;
  const isDefault = nodeData.isDefaultButton;
  const isStart = nodeData.isStartButton;
  const isFixed = nodeData.isFixedButton;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleAddNode = (nodeType: string) => {
    setShowMenu(false);
    nodeData.onAddNode(nodeType, { x: 0, y: 0 });
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  // Different styles based on button type
  const getButtonStyle = () => {
    if (isFixed) {
      return `
        w-14 h-14 rounded-full border-3 border-dashed border-purple-400/60 
        bg-white/95 backdrop-blur-sm hover:bg-white hover:border-purple-500 flex items-center justify-center
        transition-all duration-300 hover:scale-110 hover:border-purple-500
        shadow-xl hover:shadow-2xl group animate-pulse hover:animate-none
        ${selected ? 'ring-2 ring-purple-500/60 ring-offset-2' : ''}
      `;
    }
    
    if (isTrailing) {
      return `
        w-10 h-10 rounded-full border-2 border-dashed border-gray-300/60 
        bg-white/95 backdrop-blur-sm hover:bg-white hover:border-blue-400 flex items-center justify-center
        transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl
        ${selected ? 'ring-2 ring-blue-500/60 ring-offset-2' : ''}
      `;
    }
    
    if (isDefault) {
      return `
        w-16 h-16 rounded-full border-3 border-dashed border-blue-400/60 
        bg-white/95 backdrop-blur-sm hover:bg-white hover:border-blue-500 flex items-center justify-center
        transition-all duration-300 hover:scale-110 hover:border-blue-500
        shadow-xl hover:shadow-2xl group animate-pulse hover:animate-none
        ${selected ? 'ring-2 ring-blue-500/60 ring-offset-2' : ''}
      `;
    }

    if (isStart) {
      return `
        w-12 h-12 rounded-full border-2 border-dashed border-green-400/60 
        bg-white/95 backdrop-blur-sm hover:bg-white hover:border-green-500 flex items-center justify-center
        transition-all duration-200 hover:scale-110 hover:border-green-500
        shadow-lg hover:shadow-xl group
        ${selected ? 'ring-2 ring-green-500/60 ring-offset-2' : ''}
      `;
    }

    // Regular plus button
    return `
      w-12 h-12 rounded-full border-2 border-dashed border-blue-400/60 
      bg-white/95 backdrop-blur-sm hover:bg-white hover:border-blue-500 flex items-center justify-center
      transition-all duration-200 hover:scale-110 hover:border-blue-500
      shadow-lg hover:shadow-xl group
      ${selected ? 'ring-2 ring-blue-500/60 ring-offset-2' : ''}
    `;
  };

  const getIconStyle = () => {
    if (isFixed) {
      return `w-7 h-7 text-purple-500 transition-transform duration-300 
        ${showMenu ? 'rotate-45' : 'group-hover:scale-110'}`;
    }
    
    if (isTrailing) {
      return `w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors duration-200 
        ${showMenu ? 'rotate-45' : ''}`;
    }
    
    if (isDefault) {
      return `w-8 h-8 text-blue-500 transition-transform duration-300 
        ${showMenu ? 'rotate-45' : 'group-hover:scale-110'}`;
    }

    if (isStart) {
      return `w-6 h-6 text-green-500 transition-transform duration-200 
        ${showMenu ? 'rotate-45' : 'group-hover:scale-110'}`;
    }

    return `w-6 h-6 text-blue-500 transition-transform duration-200 
      ${showMenu ? 'rotate-45' : 'group-hover:scale-110'}`;
  };

  return (
    <div className="relative">
      {/* Plus Button */}
      <button
        ref={buttonRef}
        onClick={handlePlusClick}
        className={getButtonStyle()}
      >
        <Plus className={getIconStyle()} />
      </button>


      {/* Start button text */}
      {isStart && (
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 text-center">
          <p className="text-sm font-medium text-gray-600 mb-1">Add at start</p>
          <p className="text-xs text-gray-500">Insert step at beginning</p>
        </div>
      )}

      {/* Context Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className={`absolute ${isTrailing ? 'top-12' : 'top-14'} left-1/2 transform -translate-x-1/2 z-50 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 p-3 min-w-80 max-h-96 overflow-y-auto`}
          style={{ zIndex: 1000 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-100/50">
            <h3 className="text-sm font-semibold text-gray-800">
              {isFixed ? 'Add New Step' : isTrailing ? 'Add Next Step' : isStart ? 'Add at Start' : 'Add Step'}
            </h3>
            <button
              onClick={() => setShowMenu(false)}
              className="w-6 h-6 rounded-full hover:bg-gray-100/50 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Node Type Options */}
          <div className="py-2">
            {nodeTypes.map((nodeType) => (
              <button
                key={nodeType.type}
                onClick={() => handleAddNode(nodeType.type)}
                className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50/50 transition-all duration-200 text-left group"
              >
                <div className={`
                  w-10 h-10 rounded-xl ${nodeType.color} flex items-center justify-center
                  text-white text-lg font-medium shadow-sm group-hover:scale-105 transition-transform
                `}>
                  {nodeType.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">
                    {nodeType.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {nodeType.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Connection Handles - Different for different button types */}
      {!isDefault && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            className="w-3 h-3 bg-blue-400 border-2 border-white shadow-sm opacity-0"
            style={{ top: isTrailing ? -4 : -6 }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            className="w-3 h-3 bg-blue-400 border-2 border-white shadow-sm opacity-0"
            style={{ bottom: isTrailing ? -4 : -6 }}
          />
        </>
      )}
    </div>
  );
};

export default PlusButtonNode;