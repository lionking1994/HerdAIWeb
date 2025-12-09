import { Node } from '@xyflow/react';

// Function to generate unique logical IDs based on type (e.g., form1, agent1, pdf1)
export const generateNodeId = (nodeType: string, existingNodes: Node[]): string => {
  // Map node types to prefixes
  const typePrefixes: Record<string, string> = {
    'triggerNode': 'trigger',
    'formNode': 'form',
    'approvalNode': 'approval',
    'crmApprovalNode': 'crmApproval',
    'conditionNode': 'condition',
    'updateNode': 'update',
    'crmUpdateNode': 'crmUpdate',
    'notificationNode': 'notification',
    'delayNode': 'delay',
    'webhookNode': 'webhook',
    'apiNode': 'api',
    'agentNode': 'agent',
    'promptNode': 'prompt',
    'pdfNode': 'pdf',
    'endNode': 'end'
  };

  const prefix = typePrefixes[nodeType] || 'node';
  
  // Find the highest number for this type among existing logicalIds
  let maxNumber = 0;
  existingNodes.forEach(node => {
    const candidateId = (node.data as Record<string, unknown>)?.logicalId as string || '';
    if (candidateId.startsWith(prefix)) {
      const numberPart = candidateId.substring(prefix.length);
      const number = parseInt(numberPart, 10);
      if (!isNaN(number) && number > maxNumber) {
        maxNumber = number;
      }
    }
  });

  return `${prefix}${maxNumber + 1}`;
};

// Function to get node type from logical ID (e.g., "form1" -> "formNode")
export const getNodeTypeFromId = (nodeId: string): string => {
  const typePrefixes: Record<string, string> = {
    'trigger': 'triggerNode',
    'form': 'formNode',
    'approval': 'approvalNode',
    'crmApproval': 'crmApprovalNode',
    'condition': 'conditionNode',
    'update': 'updateNode',
    'crmUpdate': 'crmUpdateNode',
    'notification': 'notificationNode',
    'delay': 'delayNode',
    'webhook': 'webhookNode',
    'api': 'apiNode',
    'agent': 'agentNode',
    'prompt': 'promptNode',
    'pdf': 'pdfNode',
    'end': 'endNode'
  };

  // Extract prefix from nodeId (e.g., "form1" -> "form")
  const match = nodeId.match(/^([a-zA-Z]+)\d*$/);
  if (match) {
    const prefix = match[1];
    return typePrefixes[prefix] || 'unknown';
  }
  
  return 'unknown';
};

// Function to validate if a logical ID follows the expected format
export const isValidNodeId = (nodeId: string): boolean => {
  return /^[a-zA-Z]+\d+$/.test(nodeId);
};

// Function to check if a logical ID is unique within existing nodes (excluding current node by system id)
export const isNodeIdUnique = (nodeId: string, existingNodes: Node[], currentNodeId?: string): boolean => {
  return !existingNodes.some(node => {
    const logicalId = (node.data as Record<string, unknown>)?.logicalId as string | undefined;
    if (!logicalId) return false;
    if (currentNodeId && node.id === currentNodeId) return false;
    return logicalId === nodeId;
  });
};

// Function to validate a user-entered logical ID
export const validateUserNodeId = (nodeId: string, existingNodes: Node[], currentNodeId?: string): { 
  isValid: boolean; 
  error?: string; 
} => {
  // Check if empty
  if (!nodeId.trim()) {
    return { isValid: false, error: 'Logical ID cannot be empty' };
  }

  // Check format (letters followed by numbers)
  if (!isValidNodeId(nodeId)) {
    return { isValid: false, error: 'Logical ID must be letters followed by numbers (e.g., form1, agent2)' };
  }

  // Check uniqueness among logicalIds
  if (!isNodeIdUnique(nodeId, existingNodes, currentNodeId)) {
    return { isValid: false, error: 'Logical ID must be unique within the workflow' };
  }

  return { isValid: true };
};

// Function to suggest a corrected logical ID if the user's input is invalid
export const suggestNodeId = (nodeType: string, userInput: string, existingNodes: Node[]): string => {
  // Extract letters from user input
  const lettersPart = userInput.replace(/[^a-zA-Z]/g, '') || 'node';
  
  // Try to use the type prefix if no letters provided or if it makes sense
  const typePrefixes: Record<string, string> = {
    'triggerNode': 'trigger',
    'formNode': 'form',
    'approvalNode': 'approval',
    'crmApprovalNode': 'crmApproval',
    'conditionNode': 'condition',
    'updateNode': 'update',
    'crmUpdateNode': 'crmUpdate',
    'notificationNode': 'notification',
    'delayNode': 'delay',
    'webhookNode': 'webhook',
    'apiNode': 'api',
    'agentNode': 'agent',
    'promptNode': 'prompt',
    'pdfNode': 'pdf',
    'endNode': 'end'
  };

  const prefix = typePrefixes[nodeType] || lettersPart || 'node';
  
  // Find next available number among logicalIds
  let number = 1;
  while (!isNodeIdUnique(`${prefix}${number}`, existingNodes)) {
    number++;
  }
  
  return `${prefix}${number}`;
};
