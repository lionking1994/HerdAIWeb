import React from 'react';
import { Zap, FileText, CheckCircle, GitBranch, Database, Bell, Clock, Webhook, Globe, Bot, Square, Users, MessageSquare } from 'lucide-react';

// No props needed for now

const Sidebar: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const nodeTypes = [
    {
      type: 'triggerNode',
      label: 'Trigger',
      icon: Zap,
      color: 'bg-purple-500',
      description: 'Workflow trigger point'
    },
    {
      type: 'formNode',
      label: 'Form',
      icon: FileText,
      color: 'bg-cyan-500',
      description: 'Form builder with fields and layout'
    },
    {
      type: 'approvalNode',
      label: 'Approval',
      icon: CheckCircle,
      color: 'bg-orange-500',
      description: 'Role or person-based approval'
    },
    {
      type: 'crmApprovalNode',
      label: 'CRM Approval',
      icon: Users,
      color: 'bg-indigo-600',
      description: 'CRM-specific approval workflow'
    },
    {
      type: 'conditionNode',
      label: 'Condition',
      icon: GitBranch,
      color: 'bg-amber-500',
      description: 'Branch workflow logic'
    },
    {
      type: 'updateNode',
      label: 'Update',
      icon: Database,
      color: 'bg-indigo-500',
      description: 'Update table records'
    },
    {
      type: 'notificationNode',
      label: 'Notification',
      icon: Bell,
      color: 'bg-teal-500',
      description: 'Email or application notification'
    },
    {
      type: 'delayNode',
      label: 'Delay',
      icon: Clock,
      color: 'bg-gray-500',
      description: 'Time-based delay'
    },
    {
      type: 'webhookNode',
      label: 'Webhook',
      icon: Webhook,
      color: 'bg-pink-500',
      description: 'Webhook with authentication'
    },
    {
      type: 'apiNode',
      label: 'API',
      icon: Globe,
      color: 'bg-emerald-500',
      description: 'API call with authentication'
    },
    {
      type: 'agentNode',
      label: 'Agent',
      icon: Bot,
      color: 'bg-violet-500',
      description: 'Agent MCP details'
    },
    {
      type: 'promptNode',
      label: 'Prompt',
      icon: MessageSquare,
      color: 'bg-emerald-500',
      description: 'AI-powered prompt processing'
    },
    {
      type: 'endNode',
      label: 'End',
      icon: Square,
      color: 'bg-red-500',
      description: 'Workflow end point'
    }
  ];

  return (
    <div className="w-full lg:w-64 bg-white border-b lg:border-r lg:border-b-0 border-gray-200 p-3 sm:p-4 shadow-lg lg:shadow-none">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">Node Types</h3>
        <p className="text-xs sm:text-sm text-gray-600">Drag nodes to the canvas to build your workflow</p>
      </div>
      
      <div className="grid grid-cols-1 gap-2 sm:gap-3">
        {nodeTypes.map((nodeType) => (
          <div
            key={nodeType.type}
            className="flex items-center p-2 sm:p-3 border border-gray-200 rounded-lg cursor-move hover:bg-gray-50 transition-colors"
            draggable
            onDragStart={(event) => onDragStart(event, nodeType.type)}
          >
            <div className={`w-8 h-8 sm:w-10 sm:h-10 ${nodeType.color} rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0`}>
              <nodeType.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-xs sm:text-sm lg:text-base">{nodeType.label}</div>
              <div className="text-xs sm:text-sm text-gray-500">{nodeType.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar; 