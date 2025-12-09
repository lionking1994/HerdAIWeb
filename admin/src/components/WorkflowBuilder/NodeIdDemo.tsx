import React, { useState } from 'react';
import { Node } from '@xyflow/react';
import { generateNodeId } from './nodeIdGenerator';

const NodeIdDemo: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([
    { id: 'form1', type: 'formNode', position: { x: 0, y: 0 }, data: { label: 'Form 1' } },
    { id: 'agent1', type: 'agentNode', position: { x: 0, y: 0 }, data: { label: 'Agent 1' } },
    { id: 'pdf1', type: 'pdfNode', position: { x: 0, y: 0 }, data: { label: 'PDF 1' } }
  ]);

  const addNode = (nodeType: string) => {
    const newNodeId = generateNodeId(nodeType, nodes);
    const newNode: Node = {
      id: newNodeId,
      type: nodeType,
      position: { x: 0, y: 0 },
      data: { label: `${nodeType.replace('Node', '')} ${newNodeId}` }
    };
    setNodes([...nodes, newNode]);
  };

  const getVariableExamples = (node: Node) => {
    switch (node.type) {
      case 'formNode':
        return [`${node.id}.name`, `${node.id}.email`, `${node.id}.phone`];
      case 'agentNode':
        return [`${node.id}.response`, `${node.id}.status`];
      case 'pdfNode':
        return [`${node.id}.result`, `${node.id}.url`];
      default:
        return [`${node.id}.result`];
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Node ID System Demo
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Node Management */}
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Add New Nodes</h2>
          <div className="space-y-2">
            <button
              onClick={() => addNode('formNode')}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add Form Node
            </button>
            <button
              onClick={() => addNode('agentNode')}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Add Agent Node
            </button>
            <button
              onClick={() => addNode('pdfNode')}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Add PDF Node
            </button>
            <button
              onClick={() => addNode('apiNode')}
              className="w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              Add API Node
            </button>
          </div>
        </div>

        {/* Current Nodes */}
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Current Nodes</h2>
          <div className="space-y-3">
            {nodes.map(node => (
              <div key={node.id} className="p-3 bg-gray-50 rounded border">
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
        </div>
      </div>

      {/* Usage Examples */}
      <div className="mt-6 bg-white p-4 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Usage Examples</h2>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-blue-50 rounded border-l-4 border-blue-400">
            <strong>Email Notification:</strong>
            <p className="mt-1 text-gray-700">
              "Hello {{form1.name}}, your document {{pdf1.url}} is ready for review."
            </p>
          </div>
          
          <div className="p-3 bg-green-50 rounded border-l-4 border-green-400">
            <strong>Agent Prompt:</strong>
            <p className="mt-1 text-gray-700">
              "Analyze the form submission from {{form1.email}} at {{form1.company}} and provide recommendations."
            </p>
          </div>
          
          <div className="p-3 bg-purple-50 rounded border-l-4 border-purple-400">
            <strong>Database Update:</strong>
            <p className="mt-1 text-gray-700">
              "Update user record with email {{form1.email}} and status {{agent1.status}}."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeIdDemo;
