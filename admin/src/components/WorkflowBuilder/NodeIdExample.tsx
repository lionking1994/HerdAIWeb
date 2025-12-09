import React from 'react';
import { Node } from '@xyflow/react';

interface NodeIdExampleProps {
  nodes: Node[];
}

const NodeIdExample: React.FC<NodeIdExampleProps> = ({ nodes }) => {
  const getVariableExamples = (node: Node) => {
    switch (node.type) {
      case 'formNode':
        return [
          `${node.id}.name`,
          `${node.id}.email`,
          `${node.id}.phone`,
          `${node.id}.company`
        ];
      case 'agentNode':
        return [
          `${node.id}.response`,
          `${node.id}.status`,
          `${node.id}.confidence`
        ];
      case 'pdfNode':
        return [
          `${node.id}.result`,
          `${node.id}.url`,
          `${node.id}.status`
        ];
      case 'apiNode':
        return [
          `${node.id}.response`,
          `${node.id}.status`,
          `${node.id}.headers`
        ];
      case 'webhookNode':
        return [
          `${node.id}.response`,
          `${node.id}.status`
        ];
      default:
        return [`${node.id}.result`];
    }
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Node ID System Examples
      </h3>
      
      <div className="space-y-4">
        {nodes.map(node => (
          <div key={node.id} className="bg-white p-3 rounded border">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {node.id}
              </span>
              <span className="text-sm text-gray-600">
                ({node.type})
              </span>
            </div>
            
            <div className="text-sm text-gray-700">
              <strong>Available Variables:</strong>
              <div className="mt-1 flex flex-wrap gap-1">
                {getVariableExamples(node).map((variable, index) => (
                  <span
                    key={index}
                    className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded border"
                  >
                    {`{{${variable}}}`}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          Usage Examples:
        </h4>
        <div className="text-xs text-blue-700 space-y-1">
          <p><strong>Email Notification:</strong> "Hello {{form1.name}}, your document {{pdf1.url}} is ready."</p>
          <p><strong>Agent Prompt:</strong> "Analyze {{form1.email}} and {{form1.company}} using {{api1.response}}."</p>
          <p><strong>Database Update:</strong> "Update user with email {{form1.email}} and status {{agent1.status}}."</p>
        </div>
      </div>
    </div>
  );
};

export default NodeIdExample;
