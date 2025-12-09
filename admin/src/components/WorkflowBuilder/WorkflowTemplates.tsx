
import { JSXElementConstructor, Key, ReactPortal, ReactElement, ReactNode, useEffect, useState } from 'react';
import { workflowAPI } from '../../lib/api';
import { WorkflowStep } from '../../types';
import { useNavigate } from 'react-router-dom';

interface WorkflowNode {
  id: number;
  workflow_id: number;
  node_id: string;
  type: string;
  name: string;
  position_x: string;
  position_y: string;
  config: any;
}

interface WorkflowConnection {
  id: number;
  workflow_id: number;
  connection_id: string;
  from_node_id: number;
  to_node_id: number;
  from_port: string | null;
  to_port: string | null;
  condition: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  companyId: string;
  steps: WorkflowStep[];
  connections: WorkflowConnection[];
  createdAt: string;
  updatedAt: string;
  version: number;
  isActive: boolean;
  template?: boolean;
}

interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

interface WorkflowTemplatesProps {
  templates?: any;
  companyId: string;
  onUseTemplate?: (template: WorkflowTemplate) => void;
  onBack?: () => void;
}

export default function WorkflowTemplates({
  templates,
  companyId,
  onUseTemplate,
  onBack,
}: WorkflowTemplatesProps) {
    const navigate = useNavigate();
  const [displayTemplates, setDisplayTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await workflowAPI.getWorkflows(companyId);
        const workflows = response?.workflows;

        if (Array.isArray(workflows)) {
          setDisplayTemplates(workflows);
        } else {
          console.error('Invalid format: workflows is not an array', response.data);
        }
      } catch (err) {
        console.error('Failed to fetch workflows:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [companyId]);
    const handleEditWorkflow = (workflow: Workflow) => {
      navigate(`/workflow-builder?company=${companyId}&workflowId=${workflow.id}`);
    };

  if (loading) return <p>Loading templates...</p>;
  if (!displayTemplates.length) return <p>No templates found.</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Workflow Templates</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayTemplates.map((template: any) => (
          <div
            key={template.id}
            className="border p-4 rounded shadow hover:shadow-lg transition cursor-pointer"
            // onClick={() => onUseTemplate?.(template)}
            onClick={() => handleEditWorkflow(template)}
          >
            <h3 className="text-lg font-semibold">{template.name}</h3>
            <p className="text-sm text-gray-600">{template.description}</p>
            <p className="text-xs text-gray-500 mt-1">Version: {template.version}</p>

            <div className="mt-2">
              <strong>Nodes:</strong>
              <ul className="text-sm list-disc list-inside">
                {template.nodes.map((node: { id: Key | null | undefined; name: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; type: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; }) => (
                  <li key={node.id}>
                    {node.name} ({node.type})
                  </li>
                ))}
              </ul>
            </div>

            {template.connections.length > 0 && (
              <div className="mt-2">
                <strong>Connections:</strong>
                <ul className="text-sm list-disc list-inside">
                  {template.connections.map((conn: { id: Key | null | undefined; from_node_id: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; to_node_id: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; }) => (
                    <li key={conn.id}>
                      {conn.from_node_id} → {conn.to_node_id}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {onBack && (
        <button
          className="mt-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={onBack}
        >
          Back
        </button>
      )}
    </div>
  );
}























// import React from 'react';
// import { ArrowLeft, Plus, Zap, FileText, CheckCircle, GitBranch, Database, Bell, Clock, Webhook, Globe, Bot } from 'lucide-react';
// import { WorkflowTemplate } from '../../types';

// interface WorkflowTemplatesProps {
//   templates: WorkflowTemplate[];
//   companyId: string;
//   onUseTemplate: (template: WorkflowTemplate) => void;
//   onBack: () => void;
// }

// const WorkflowTemplates: React.FC<WorkflowTemplatesProps> = ({
//   templates,
//   companyId: _companyId,
//   onUseTemplate,
//   onBack
// }) => {
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   const companyId = _companyId; // Available for future API integration

//   // Sample templates if none provided
//   const sampleTemplates: WorkflowTemplate[] = [
//     {
//       id: '1',
//       name: 'Meeting Approval Workflow',
//       description: 'Automated approval process for meeting requests with form collection and notifications',
//       category: 'Approval',
//       steps: [
//         {
//           id: '1',
//           name: 'Meeting Request',
//           type: 'trigger',
//           description: 'Trigger when meeting is created',
//           assigneeType: 'role',
//           assigneeRole: 'manager',
//           priority: 'medium',
//           dependencies: [],
//           position: { x: 100, y: 100 },
//           triggerConfig: { table: 'meeting', action: 'create' }
//         },
//         {
//           id: '2',
//           name: 'Request Form',
//           type: 'form',
//           description: 'Collect meeting details',
//           assigneeType: 'person',
//           assigneePerson: 'requester',
//           priority: 'medium',
//           dependencies: ['1'],
//           position: { x: 300, y: 100 },
//           formFields: [
//             { id: '1', name: 'title', type: 'text', label: 'Meeting Title', required: true },
//             { id: '2', name: 'date', type: 'date', label: 'Meeting Date', required: true },
//             { id: '3', name: 'attendees', type: 'text', label: 'Attendees', required: true }
//           ]
//         },
//         {
//           id: '3',
//           name: 'Manager Approval',
//           type: 'approval',
//           description: 'Manager reviews and approves',
//           assigneeType: 'role',
//           assigneeRole: 'manager',
//           priority: 'high',
//           dependencies: ['2'],
//           position: { x: 500, y: 100 },
//           approvalConfig: { approver: 'manager', message: 'Please review and approve this meeting request' }
//         },
//         {
//           id: '4',
//           name: 'Send Notification',
//           type: 'notification',
//           description: 'Notify participants',
//           assigneeType: 'person',
//           assigneePerson: 'system',
//           priority: 'medium',
//           dependencies: ['3'],
//           position: { x: 700, y: 100 },
//           notificationConfig: { type: 'email', recipients: ['participants'], message: 'Meeting approved', priority: 'medium' }
//         }
//       ],
//       tags: ['approval', 'meeting', 'automation']
//     },
//     {
//       id: '2',
//       name: 'Task Assignment Workflow',
//       description: 'Intelligent task assignment with AI agent analysis and role-based distribution',
//       category: 'Assignment',
//       steps: [
//         {
//           id: '1',
//           name: 'Task Created',
//           type: 'trigger',
//           description: 'Trigger when task is created',
//           assigneeType: 'role',
//           assigneeRole: 'system',
//           priority: 'medium',
//           dependencies: [],
//           position: { x: 100, y: 100 },
//           triggerConfig: { table: 'task', action: 'create' }
//         },
//         {
//           id: '2',
//           name: 'AI Analysis',
//           type: 'agent',
//           description: 'Analyze task requirements',
//           assigneeType: 'person',
//           assigneePerson: 'ai-agent',
//           priority: 'high',
//           dependencies: ['1'],
//           position: { x: 300, y: 100 },
//           agentConfig: { agentType: 'analysis', prompt: 'Analyze task requirements and suggest best assignee' }
//         },
//         {
//           id: '3',
//           name: 'Assign Task',
//           type: 'update',
//           description: 'Update task with assignee',
//           assigneeType: 'person',
//           assigneePerson: 'system',
//           priority: 'medium',
//           dependencies: ['2'],
//           position: { x: 500, y: 100 },
//           updateConfig: { table: 'task', field: 'assignee', recordCriteria: 'task_id', value: 'suggested_assignee' }
//         },
//         {
//           id: '4',
//           name: 'Notify Assignee',
//           type: 'notification',
//           description: 'Send notification to assignee',
//           assigneeType: 'person',
//           assigneePerson: 'system',
//           priority: 'medium',
//           dependencies: ['3'],
//           position: { x: 700, y: 100 },
//           notificationConfig: { type: 'email', recipients: ['assignee'], message: 'New task assigned', priority: 'high' }
//         }
//       ],
//       tags: ['assignment', 'ai', 'automation']
//     },
//     {
//       id: '3',
//       name: 'Data Processing Pipeline',
//       description: 'Automated data processing with webhook integration and API calls',
//       category: 'Processing',
//       steps: [
//         {
//           id: '1',
//           name: 'Data Received',
//           type: 'trigger',
//           description: 'Trigger when data is received',
//           assigneeType: 'person',
//           assigneePerson: 'system',
//           priority: 'high',
//           dependencies: [],
//           position: { x: 100, y: 100 },
//           triggerConfig: { table: 'task', action: 'create' }
//         },
//         {
//           id: '2',
//           name: 'Process Data',
//           type: 'webhook',
//           description: 'Send data to processing service',
//           assigneeType: 'person',
//           assigneePerson: 'system',
//           priority: 'high',
//           dependencies: ['1'],
//           position: { x: 300, y: 100 },
//           webhookConfig: { url: 'https://api.processor.com/data', method: 'POST' }
//         },
//         {
//           id: '3',
//           name: 'Wait for Processing',
//           type: 'delay',
//           description: 'Wait for processing to complete',
//           assigneeType: 'person',
//           assigneePerson: 'system',
//           priority: 'medium',
//           dependencies: ['2'],
//           position: { x: 500, y: 100 },
//           delayConfig: { timePeriod: 'minutes', duration: 5 }
//         },
//         {
//           id: '4',
//           name: 'Fetch Results',
//           type: 'api',
//           description: 'Fetch processed results',
//           assigneeType: 'person',
//           assigneePerson: 'system',
//           priority: 'high',
//           dependencies: ['3'],
//           position: { x: 700, y: 100 },
//           apiConfig: { endpoint: 'https://api.processor.com/results', method: 'GET' }
//         }
//       ],
//       tags: ['processing', 'webhook', 'api']
//     }
//   ];

//   const displayTemplates = templates.length > 0 ? templates : sampleTemplates;

//   const getStepTypeIcon = (type: string) => {
//     switch (type) {
//       case 'trigger':
//         return <Zap className="w-4 h-4 text-purple-500" />;
//       case 'form':
//         return <FileText className="w-4 h-4 text-cyan-500" />;
//       case 'approval':
//         return <CheckCircle className="w-4 h-4 text-orange-500" />;
//       case 'condition':
//         return <GitBranch className="w-4 h-4 text-amber-500" />;
//       case 'update':
//         return <Database className="w-4 h-4 text-indigo-500" />;
//       case 'notification':
//         return <Bell className="w-4 h-4 text-teal-500" />;
//       case 'delay':
//         return <Clock className="w-4 h-4 text-gray-500" />;
//       case 'webhook':
//         return <Webhook className="w-4 h-4 text-pink-500" />;
//       case 'api':
//         return <Globe className="w-4 h-4 text-emerald-500" />;
//       case 'agent':
//         return <Bot className="w-4 h-4 text-violet-500" />;
//       default:
//         return <Plus className="w-4 h-4 text-gray-500" />;
//     }
//   };
//   return (
//     <div className="space-y-4 sm:space-y-6">
//       {/* Header */}
//       <div className="flex justify-between items-center">
//         <div className="flex items-center space-x-2 sm:space-x-4">
//           <button
//             onClick={onBack}
//             className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
//           >
//             <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
//           </button>
//           <div>
//             <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Workflow Templates</h1>
//             <p className="text-sm sm:text-base text-gray-600">Choose from pre-built workflow templates</p>
//           </div>
//         </div>
//       </div>

//       {/* Templates Grid */}
//       {displayTemplates.length === 0 ? (
//         <div className="text-center py-8 sm:py-12">
//           <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
//             <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
//           </div>
//           <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No templates available</h3>
//           <p className="text-sm sm:text-base text-gray-600 mb-4">
//             No workflow templates are currently available.
//           </p>
//         </div>
//       ) : (
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
//           {displayTemplates.map((template) => (
//             <div key={template.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
//               <div className="p-4 sm:p-6">
//                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 space-y-2 sm:space-y-0">
//                   <div className="flex-1">
//                     <h3 className="text-base sm:text-lg font-semibold text-gray-900">{template.name}</h3>
//                     <p className="text-xs sm:text-sm text-gray-600 mt-1">{template.description}</p>
//                   </div>
//                   <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full self-start">
//                     Template
//                   </span>
//                 </div>
                
//                 <div className="grid grid-cols-2 sm:block space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600">
//                   <div>Steps: {template.steps.length}</div>
//                   <div>Category: {template.category}</div>
//                 </div>

//                 {/* Step Types Preview */}
//                 <div className="mt-3 sm:mt-4">
//                   <div className="text-xs font-medium text-gray-500 mb-2">Step Types:</div>
//                   <div className="flex flex-wrap gap-1">
//                     {template.steps.slice(0, 3).map((step, index) => (
//                       <div key={index} className="flex items-center space-x-1 px-1.5 sm:px-2 py-1 bg-gray-100 rounded text-xs">
//                         {getStepTypeIcon(step.type)}
//                         <span className="text-gray-600 hidden sm:inline">{step.type}</span>
//                       </div>
//                     ))}
//                     {template.steps.length > 3 && (
//                       <div className="px-1.5 sm:px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">
//                         +{template.steps.length - 3} more
//                       </div>
//                     )}
//                   </div>
//                 </div>

//                 {/* Tags */}
//                 {template.tags && template.tags.length > 0 && (
//                   <div className="mt-3 sm:mt-4">
//                     <div className="flex flex-wrap gap-1">
//                       {template.tags.slice(0, 3).map((tag, index) => (
//                         <span key={index} className="px-1.5 sm:px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
//                           {tag}
//                         </span>
//                       ))}
//                       {template.tags.length > 3 && (
//                         <span className="px-1.5 sm:px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
//                           +{template.tags.length - 3}
//                         </span>
//                       )}
//                     </div>
//                   </div>
//                 )}

//                 <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
//                   <button
//                     onClick={() => onUseTemplate(template)}
//                     className="w-full px-3 sm:px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
//                   >
//                     Use Template
//                   </button>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };

// export default WorkflowTemplates; 






// import React, { useEffect, useState } from 'react';
// import axios from 'axios';
// import { workflowAPI } from '../../lib/api';

// interface WorkflowStep {
//   id: string;
//   name: string;
//   type: string;
//   description?: string;
//   assigneeType?: string;
//   assigneeRole?: string;
//   assigneeId?: string;
//   priority?: string;
//   dependencies?: string[];
//   position?: {
//     x: number;
//     y: number;
//   };
//   triggerConfig?: {
//     table: string;
//     action: string;
//   };
// }

// interface WorkflowTemplate {
//   id: string;
//   name: string;
//   description: string;
//   category: string;
//   tags: string[];
//   steps: WorkflowStep[];
// }

// interface WorkflowTemplatesProps {
//   templates: WorkflowTemplate[];
//   companyId: string;
//   onUseTemplate: (template: WorkflowTemplate) => void;
//   onBack: () => void;
// }

// const WorkflowTemplates: React.FC<WorkflowTemplatesProps> = ({
//   templates,
//   companyId,
//   onUseTemplate,
//   onBack
// }) => {
//   const [fetchedTemplates, setFetchedTemplates] = useState<WorkflowTemplate[]>([]);
//   const [loading, setLoading] = useState(false);

//   // Sample fallback templates (optional customization)
//   const sampleTemplates: WorkflowTemplate[] = [
//     {
//       id: '1',
//       name: 'Meeting Approval Workflow',
//       description: 'Automated approval process for scheduling meetings.',
//       category: 'Approval',
//       tags: ['approval', 'meeting'],
//       steps: [
//         {
//           id: '1',
//           name: 'Meeting Request',
//           type: 'trigger',
//           description: 'Triggered when a new meeting is created.',
//           assigneeType: 'role',
//           assigneeRole: 'manager',
//           priority: 'medium',
//           dependencies: [],
//           position: { x: 100, y: 100 },
//           triggerConfig: {
//             table: 'meeting',
//             action: 'create'
//           }
//         }
//       ]
//     },
//     {
//       id: '2',
//       name: 'Task Completion Reminder',
//       description: 'Remind team members of pending tasks.',
//       category: 'Notification',
//       tags: ['task', 'reminder'],
//       steps: [
//         {
//           id: '1',
//           name: 'Task Assigned',
//           type: 'trigger',
//           description: 'Triggered when a new task is assigned.',
//           assigneeType: 'user',
//           assigneeId: 'user456',
//           priority: 'low',
//           dependencies: [],
//           position: { x: 50, y: 50 },
//           triggerConfig: {
//             table: 'task',
//             action: 'create'
//           }
//         }
//       ]
//     }
//   ];

//   useEffect(() => {
//     const fetchTemplates = async () => {
//       try {
//         setLoading(true);
//         // const response = await axios.get(`/api/workflows/${companyId}`);
//      let response = await workflowAPI.getWorkflows(companyId);
//         setFetchedTemplates(response.data || []);
// console.log(response.data, "kjoiuyhjuyghjugbhjuh");
//         debugger;
//       } catch (error) {
//         console.error('Error fetching templates:', error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     // Fetch only if templates are not passed via props
//     if (templates.length === 0) {
//       fetchTemplates();
//     }
//   }, [companyId, templates]);

//   const displayTemplates =
//     templates.length > 0
//       ? templates
//       : fetchedTemplates.length > 0
//       ? fetchedTemplates
//       : sampleTemplates;

//   return (
//     <div className="p-4">
//       <div className="mb-4 flex justify-between items-center">
//         <h2 className="text-2xl font-semibold">Select a Template</h2>
//         <button
//           onClick={onBack}
//           className="text-sm text-blue-600 hover:underline focus:outline-none"
//         >
//           ← Back
//         </button>
//       </div>

//       {loading ? (
//         <p className="text-gray-500">Loading templates...</p>
//       ) : (
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           {displayTemplates.map((template) => (
//             <div
//               key={template.id}
//               className="border border-gray-200 rounded-lg p-4 shadow hover:shadow-md transition cursor-pointer"
//               onClick={() => onUseTemplate(template)}
//             >
//               <h3 className="text-lg font-bold mb-1">{template.name}</h3>
//               <p className="text-gray-600 mb-2">{template.description}</p>
//               <div className="text-sm text-gray-500 mb-1">
//                 <span className="font-medium">Category:</span> {template.category}
//               </div>
//               <div className="text-sm text-gray-500">
//                 <span className="font-medium">Tags:</span>{' '}
//                 {template.tags && template.tags.length > 0
//                   ? template.tags.join(', ')
//                   : 'None'}
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };

// export default WorkflowTemplates;



