import React, { useState, useEffect } from 'react';
import { Variable, Plus, Edit, Trash2, RefreshCw, FileText, Bot, Globe, Zap } from 'lucide-react';
import { useWorkflowVariables } from '../../hooks/useWorkflowVariables';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { updateNode } from '../../store/slices/workflowSlice';

interface VariableManagementPanelProps {
  onClose?: () => void;
}

const VariableManagementPanel: React.FC<VariableManagementPanelProps> = ({ onClose }) => {
  const dispatch = useDispatch();
  const { nodes } = useSelector((state: RootState) => state.workflow);
  const {
    variables,
    generateVariablesFromNodes,
    getFormVariables,
    getSystemVariables,
    updateVariableById,
    deleteVariableById
  } = useWorkflowVariables();

  const [isGenerating, setIsGenerating] = useState(false);
  const [editingVariable, setEditingVariable] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const formVariables = getFormVariables();
  const systemVariables = getSystemVariables();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'form': return <FileText className="w-4 h-4" />;
      case 'pdf': return <FileText className="w-4 h-4" />;
      case 'agent': return <Bot className="w-4 h-4" />;
      case 'api': return <Zap className="w-4 h-4" />;
      case 'webhook': return <Globe className="w-4 h-4" />;
      default: return <Variable className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'form': return 'text-blue-600 bg-blue-100';
      case 'pdf': return 'text-red-600 bg-red-100';
      case 'agent': return 'text-green-600 bg-green-100';
      case 'api': return 'text-purple-600 bg-purple-100';
      case 'webhook': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleGenerateVariables = async () => {
    setIsGenerating(true);
    try {
      // This would trigger the variable generation logic
      // For now, we'll just simulate the process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update all nodes to trigger variable regeneration
      nodes.forEach(node => {
        dispatch(updateNode({ nodeId: node.id, data: { ...node.data } }));
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditVariable = (variableId: string) => {
    const variable = variables.find(v => v.id === variableId);
    if (variable) {
      setEditingVariable(variableId);
      setEditName(variable.name);
      setEditDescription(variable.description || '');
    }
  };

  const handleSaveEdit = () => {
    if (editingVariable) {
      updateVariableById(editingVariable, {
        name: editName,
        description: editDescription
      });
      setEditingVariable(null);
      setEditName('');
      setEditDescription('');
    }
  };

  const handleCancelEdit = () => {
    setEditingVariable(null);
    setEditName('');
    setEditDescription('');
  };

  const handleDeleteVariable = (variableId: string) => {
    if (window.confirm('Are you sure you want to delete this variable?')) {
      deleteVariableById(variableId);
    }
  };

  const renderVariableList = (variables: any[], title: string) => (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900 flex items-center gap-2">
        {title}
        <span className="text-sm text-gray-500">({variables.length})</span>
      </h4>
      
      {variables.length === 0 ? (
        <div className="text-sm text-gray-500 italic py-4 text-center border-2 border-dashed border-gray-200 rounded-lg">
          No {title.toLowerCase()} found
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {variables.map((variable) => (
            <div
              key={variable.id}
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {editingVariable === variable.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Variable name"
                  />
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Description"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(variable.type)}`}>
                      {getTypeIcon(variable.type)}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{variable.name}</div>
                      {variable.description && (
                        <div className="text-xs text-gray-500">{variable.description}</div>
                      )}
                      <div className="text-xs text-gray-400">
                        From: {variable.nodeName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleEditVariable(variable.id)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit variable"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteVariable(variable.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete variable"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full lg:w-80 bg-white border-l border-gray-200 p-4 lg:p-6 overflow-y-auto max-h-screen">
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <h3 className="text-base lg:text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Variable className="w-5 h-5" />
          Variables
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="Close panel"
          >
            ×
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Generate Variables Button */}
        <div>
          <button
            onClick={handleGenerateVariables}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : 'Generate Variables'}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Automatically generate variables from all nodes in the workflow
          </p>
        </div>

        {/* Form Variables */}
        {renderVariableList(formVariables, 'Form Variables')}

        {/* System Variables */}
        {renderVariableList(systemVariables, 'System Variables')}

        {/* Variable Usage Info */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">How to use variables:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use <code className="bg-blue-100 px-1 rounded">{'{{variableName}}'}</code> syntax</li>
            <li>• Variables are automatically updated when source data changes</li>
            <li>• Form variables reference field values from form submissions</li>
            <li>• System variables reference outputs from other nodes</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VariableManagementPanel;
