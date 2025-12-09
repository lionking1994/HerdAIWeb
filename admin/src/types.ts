export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    company: string;
    lastLogin: string;
}

export interface WorkflowUser {
    id: number;
    name: string;
    email: string;
}

  export interface Logs {
    id: string;
    username: string;
    method: string;
    url: string;
    status: string;
    message: string;
    timestamp: string;
  } 
  
  export interface Company {
    id: string;
    name: string;
    industry: string;
    employees: number;
    enabled: boolean;
    subscription: string;
    joinedDate: string;
    total_users?: number;
    total_meetings?: number;
    default_cph?: number;
    available_licenses?: number;
    total_purchased_licenses?: number;
  }
  
  export interface FeedbackItem {
    text: string;
    value: number;
    id: number;
  }
  
  export interface ChartData {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
      tension?: number;
    }[];
  }

// Workflow Types
export interface WorkflowStep {
  id: string;
  name: string;
  type: 'trigger' | 'form' | 'approval' | 'condition' | 'update' | 'crmUpdate' | 'notification' | 'delay' | 'webhook' | 'api' | 'agent';
  description?: string;
  assigneeType: 'role' | 'person';
  assigneeRole?: string;
  assigneePerson?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  dependencies: string[];
  position: { x: number; y: number };
  formFields?: FormField[];
  agentConfig?: AgentConfig;
  emailConfig?: EmailConfig;
  apiConfig?: ApiConfig;
  approvalConfig?: ApprovalConfig;
  taskUpdateConfig?: TaskUpdateConfig;
  notificationConfig?: NotificationConfig;
  triggerConfig?: TriggerConfig;
  conditionConfig?: ConditionConfig;
  updateConfig?: UpdateConfig;
  crmUpdateConfig?: CrmUpdateConfig;
  delayConfig?: DelayConfig;
  webhookConfig?: WebhookConfig;
}

export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'file' | 'textarea';
  label: string;
  required: boolean;
  validation?: ValidationRule[];
  options?: string[]; // For dropdown fields
  placeholder?: string;
  defaultValue?: string | number | boolean;
  conditionalLogic?: ConditionalLogic;
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'email';
  value?: string | number;
  message: string;
}

export interface ConditionalLogic {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | number | boolean;
  action: 'show' | 'hide' | 'require';
}

export interface AgentConfig {
  agentType: 'research' | 'analysis' | 'summary' | 'custom' | 'mcp';
  prompt?: string;
  outputFormat?: string;
  notificationTarget?: 'user' | 'comment_thread' | 'both';
  mcpConfig?: {
    mcpServers: Record<string, {
      command: string;
      args: string[];
      env: Record<string, string>;
    }>;
  };
}

export interface EmailConfig {
  template: string;
  recipients: string[];
  subject: string;
  body: string;
  attachments?: string[];
}

export interface ApiConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
  timeout?: number;
}

export interface ApprovalConfig {
  approvers: WorkflowUser[];
  message: string;
  requireComment?: boolean;
  autoApprove?: boolean;
  timeout?: number;
}

export interface TaskUpdateConfig {
  newStatus: 'approved' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';
  message: string;
  updateFields?: Record<string, string>;
}

export interface NotificationConfig {
  type: 'email' | 'push' | 'sms' | 'slack';
  recipients: string[];
  message: string;
  priority: 'low' | 'medium' | 'high';
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

export interface WorkflowConnection {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  condition?: string;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  currentStepId?: string;
  data: Record<string, string | number | boolean | object>;
  startedAt: string;
  completedAt?: string;
  assignedTo?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  currentStepId?: string;
  data: Record<string, string | number | boolean | object>;
  startedAt: string;
  completedAt?: string;
  assignedTo?: string;
  assignedUserName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecutionCounts {
  total: number;
  active: number;
  paused: number;
  completed: number;
  cancelled: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: WorkflowStep[];
  tags: string[];
}

export interface WorkflowHistory {
  id: string;
  workflowId: string;
  action: 'created' | 'updated' | 'activated' | 'deactivated' | 'deleted';
  userId: string;
  timestamp: string;
  changes?: Record<string, string | number | boolean | object>;
}

export interface TriggerConfig {
  table: 'meeting' | 'task' | 'user';
  action: 'create' | 'update' | 'delete';
  conditions?: Record<string, string | number | boolean | object>;
}

export interface ConditionConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than';
  value: string | number | boolean;
  trueNodeId?: string;
  falseNodeId?: string;
}

export interface UpdateConfig {
  table: 'meeting' | 'task' | 'user';
  field: string;
  recordCriteria: string;
  value: string | number | boolean;
}

export interface CrmUpdateConfig {
  crmEntity: 'account' | 'contact' | 'opportunity';
  updateMethod: 'create' | 'update' | 'upsert';
  fieldMapping: Record<string, string>;
  searchCriteria?: {
    field: string;
    operator: string;
    value: string;
  };
}

export interface DelayConfig {
  timePeriod: 'minutes' | 'hours' | 'days';
  duration: number;
}

export interface WebhookConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, string | number | boolean | object>;
  auth?: {
    type: 'basic' | 'bearer' | 'api_key';
    credentials: Record<string, string>;
  };
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  total_videos: number;
  total_duration: number;
}

export interface Video {
  id: string;
  course_id: string;
  title: string;
  description: string;
  video_url: string;
  duration: number;
  order_index: number;
  ai_summary?: string;
  key_points?: string[];
  created_at: string;
}

export interface VideoDocument {
  id: string;
  video_id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type: string;
  file_size: number;
  order_index: number;
  created_at: string;
}

export interface UserRole {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface CourseRoleRestriction {
  id: string;
  course_id: string;
  role_id: string;
  created_at: string;
  user_roles: UserRole;
}