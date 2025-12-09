import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import WorkflowBuilder from '../components/WorkflowBuilder/WorkflowBuilder';
import { workflowAPI } from '../lib/api';
import { Workflow, FormField, AgentConfig, EmailConfig, ApiConfig, ApprovalConfig, TaskUpdateConfig, NotificationConfig, TriggerConfig, ConditionConfig, UpdateConfig, DelayConfig, WebhookConfig } from '../types';
import LoadingScreen from '../components/LoadingScreen';

const WorkflowBuilderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const companyId = searchParams.get('company') || '';
  const workflowId = searchParams.get('workflowId');
  const templateData = searchParams.get('template');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setError('Company ID is required');
      setLoading(false);
      return;
    }

    if (workflowId) {
      // Editing existing workflow
      fetchWorkflow();
    } else if (templateData) {
      // Creating workflow from template
      try {
        const template = JSON.parse(decodeURIComponent(templateData));
        setWorkflow(template);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing template data:', error);
        setError('Invalid template data');
        setLoading(false);
      }
    } else {
      // Creating new workflow
      setLoading(false);
    }
  }, [workflowId, companyId, templateData]);

  const fetchWorkflow = async () => {
    try {
      setLoading(true);
      const response = await workflowAPI.getWorkflow(workflowId!);
      
      if (response.workflow) {
        // Transform the API response to match our Workflow interface
        const transformedWorkflow: Workflow = {
          id: response.workflow.id as string,
          name: response.workflow.name as string,
          description: response.workflow.description as string,
          companyId: response.workflow.company_id as string,
          steps: (response.workflow.nodes as Array<Record<string, unknown>>)?.map((node) => ({
            id: node.node_id as string,
            name: node.name as string,
            type: node.type as 'trigger' | 'form' | 'approval' | 'condition' | 'update' | 'notification' | 'delay' | 'webhook' | 'api' | 'agent',
            description: node.description as string,
            assigneeType: (node.assignee_type as 'role' | 'person') || 'role',
            assigneeRole: node.assignee_role as string,
            assigneePerson: node.assignee_person as string,
            dueDate: node.due_date as string,
            priority: (node.priority as 'low' | 'medium' | 'high') || 'medium',
            dependencies: (node.dependencies as string[]) || [],
            position: { x: node.position_x as number, y: node.position_y as number },
            formFields: node.form_fields as FormField[] | undefined,
            agentConfig: node.agent_config as AgentConfig | undefined,
            emailConfig: node.email_config as EmailConfig | undefined,
            apiConfig: node.api_config as ApiConfig | undefined,
            approvalConfig: node.approval_config as ApprovalConfig | undefined,
            taskUpdateConfig: node.task_update_config as TaskUpdateConfig | undefined,
            notificationConfig: node.notification_config as NotificationConfig | undefined,
            triggerConfig: node.trigger_config as TriggerConfig | undefined,
            conditionConfig: node.condition_config as ConditionConfig | undefined,
            updateConfig: node.update_config as UpdateConfig | undefined,
            delayConfig: node.delay_config as DelayConfig | undefined,
            webhookConfig: node.webhook_config as WebhookConfig | undefined
          })) || [],
          connections: (response.workflow.connections as Array<Record<string, unknown>>)?.map((conn) => ({
            id: conn.id as string,
            sourceStepId: conn.from_node_id as string,
            targetStepId: conn.to_node_id as string,
            condition: conn.condition as string
          })) || [],
          createdAt: response.workflow.created_at as string,
          updatedAt: response.workflow.updated_at as string,
          version: response.workflow.version as number,
          isActive: (response.workflow.is_active as boolean) || false
        };
        setWorkflow(transformedWorkflow);
      } else {
        setError('Workflow not found');
      }
    } catch (error) {
      console.error('Error fetching workflow:', error);
      setError('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    // Navigate back to workflows list after successful save
    navigate(`/workflows?company=${companyId}`);
  };

  const handleCancel = () => {
    // Navigate back to workflows list
    navigate(`/workflows?company=${companyId}`);
  };

  if (loading) {
    return <LoadingScreen message="Loading workflow..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button
            onClick={() => navigate(`/workflows?company=${companyId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <WorkflowBuilder
        workflow={workflow as unknown as Record<string, unknown>}
        companyId={companyId}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </ReactFlowProvider>
  );
};

export default WorkflowBuilderPage; 