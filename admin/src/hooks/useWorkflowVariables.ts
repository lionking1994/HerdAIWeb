import { useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { 
  addVariable, 
  updateVariable, 
  deleteVariable, 
  WorkflowVariable 
} from '../store/slices/workflowSlice';
import { Node, Edge } from '@xyflow/react';

export const useWorkflowVariables = () => {
  const dispatch = useDispatch();
  const { nodes, edges, variables } = useSelector((state: RootState) => state.workflow);

  // Generate variables from nodes
  const generateVariablesFromNodes = useCallback(() => {
    const newVariables: WorkflowVariable[] = [];

    nodes.forEach(node => {
      const nodeId = node.id; // Use the node ID directly (e.g., "form1", "agent1")
      const nodeName = (node.data?.label as string) || node.type;

      switch (node.type) {
        case 'formNode':
          const formFields = (node.data?.formFields as Array<{ name: string; type: string }>) || [];
          formFields.forEach(field => {
            newVariables.push({
              id: `${nodeId}_${field.name}`,
              name: `${nodeId}.${field.name}`, // e.g., "form1.email"
              type: 'form',
              nodeId,
              nodeName,
              fieldName: field.name,
              description: `Form field: ${field.name} (${field.type})`,
            });
          });
          break;

        case 'pdfNode':
          newVariables.push({
            id: `${nodeId}_result`,
            name: `${nodeId}.result`, // e.g., "pdf1.result"
            type: 'pdf',
            nodeId,
            nodeName,
            description: 'PDF generation result',
          });
          newVariables.push({
            id: `${nodeId}_url`,
            name: `${nodeId}.url`, // e.g., "pdf1.url"
            type: 'pdf',
            nodeId,
            nodeName,
            description: 'Generated PDF URL',
          });
          break;

        case 'agentNode':
          newVariables.push({
            id: `${nodeId}_response`,
            name: `${nodeId}.response`, // e.g., "agent1.response"
            type: 'agent',
            nodeId,
            nodeName,
            description: 'Agent response',
          });
          newVariables.push({
            id: `${nodeId}_status`,
            name: `${nodeId}.status`, // e.g., "agent1.status"
            type: 'agent',
            nodeId,
            nodeName,
            description: 'Agent execution status',
          });
          break;

        case 'apiNode':
          newVariables.push({
            id: `${nodeId}_response`,
            name: `${nodeId}.response`, // e.g., "api1.response"
            type: 'api',
            nodeId,
            nodeName,
            description: 'API response',
          });
          newVariables.push({
            id: `${nodeId}_status`,
            name: `${nodeId}.status`, // e.g., "api1.status"
            type: 'api',
            nodeId,
            nodeName,
            description: 'HTTP status code',
          });
          break;

        case 'webhookNode':
          newVariables.push({
            id: `${nodeId}_response`,
            name: `${nodeId}.response`, // e.g., "webhook1.response"
            type: 'webhook',
            nodeId,
            nodeName,
            description: 'Webhook response',
          });
          newVariables.push({
            id: `${nodeId}_status`,
            name: `${nodeId}.status`, // e.g., "webhook1.status"
            type: 'webhook',
            nodeId,
            nodeName,
            description: 'Response status',
          });
          break;

        case 'updateNode':
          newVariables.push({
            id: `${nodeId}_result`,
            name: `${nodeId}.result`, // e.g., "update1.result"
            type: 'custom',
            nodeId,
            nodeName,
            description: 'Update operation result',
          });
          break;

        case 'crmUpdateNode':
          newVariables.push({
            id: `${nodeId}_result`,
            name: `${nodeId}.result`, // e.g., "crmUpdate1.result"
            type: 'custom',
            nodeId,
            nodeName,
            description: 'CRM update operation result',
          });
          break;

        case 'notificationNode':
          newVariables.push({
            id: `${nodeId}_status`,
            name: `${nodeId}.status`, // e.g., "notification1.status"
            type: 'custom',
            nodeId,
            nodeName,
            description: 'Notification delivery status',
          });
          break;
      }
    });

    return newVariables;
  }, [nodes]);

  // Get available variables for a specific node (excluding its own variables)
  const getAvailableVariables = useCallback((nodeId: string) => {
    return variables.filter(variable => variable.nodeId !== nodeId);
  }, [variables]);

  // Get variables by type
  const getVariablesByType = useCallback((type: WorkflowVariable['type']) => {
    return variables.filter(variable => variable.type === type);
  }, [variables]);

  // Get form variables
  const getFormVariables = useCallback(() => {
    return getVariablesByType('form');
  }, [getVariablesByType]);

  // Get system variables (non-form)
  const getSystemVariables = useCallback(() => {
    return variables.filter(variable => variable.type !== 'form');
  }, [variables]);

  // Add a custom variable
  const addCustomVariable = useCallback((variable: Omit<WorkflowVariable, 'id'>) => {
    const newVariable: WorkflowVariable = {
      ...variable,
      id: `${variable.nodeId}_${variable.name}_${Date.now()}`,
    };
    dispatch(addVariable(newVariable));
  }, [dispatch]);

  // Update a variable
  const updateVariableById = useCallback((variableId: string, updates: Partial<WorkflowVariable>) => {
    dispatch(updateVariable({ variableId, updates }));
  }, [dispatch]);

  // Delete a variable
  const deleteVariableById = useCallback((variableId: string) => {
    dispatch(deleteVariable(variableId));
  }, [dispatch]);

  // Parse variable references in text (e.g., "Hello {{form1.name}}")
  const parseVariableReferences = useCallback((text: string) => {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const matches = text.match(variableRegex);
    if (!matches) return [];

    return matches.map(match => {
      const variableName = match.replace(/\{\{|\}\}/g, '');
      return variables.find(variable => variable.name === variableName);
    }).filter(Boolean) as WorkflowVariable[];
  }, [variables]);

  // Replace variable references with actual values
  const replaceVariableReferences = useCallback((text: string, context: Record<string, any> = {}) => {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const variable = variables.find(v => v.name === variableName);
      if (variable && context[variableName] !== undefined) {
        return context[variableName];
      }
      return match; // Return original if variable not found or no value
    });
  }, [variables]);

  // Get variable suggestions for autocomplete
  const getVariableSuggestions = useCallback((query: string = '') => {
    if (!query) return variables;
    
    return variables.filter(variable => 
      variable.name.toLowerCase().includes(query.toLowerCase()) ||
      variable.description?.toLowerCase().includes(query.toLowerCase())
    );
  }, [variables]);

  // Check if a variable reference is valid
  const isValidVariableReference = useCallback((variableName: string) => {
    return variables.some(variable => variable.name === variableName);
  }, [variables]);

  return {
    variables,
    generateVariablesFromNodes,
    getAvailableVariables,
    getVariablesByType,
    getFormVariables,
    getSystemVariables,
    addCustomVariable,
    updateVariableById,
    deleteVariableById,
    parseVariableReferences,
    replaceVariableReferences,
    getVariableSuggestions,
    isValidVariableReference,
  };
};
