import React, { useState, useMemo } from 'react';
import { Search, X, Variable, FileText, Bot, Globe, Zap } from 'lucide-react';
import { useWorkflowVariables } from '../../hooks/useWorkflowVariables';

interface VariableSelectorProps {
  onSelectVariable: (variableName: string) => void;
  onClose: () => void;
  currentValue?: string;
  placeholder?: string;
  filterByType?: string[];
  excludeNodeId?: string;
}

const VariableSelector: React.FC<VariableSelectorProps> = ({
  onSelectVariable,
  onClose,
  currentValue = '',
  placeholder = 'Select a variable...',
  filterByType,
  excludeNodeId
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { getAvailableVariables, getVariableSuggestions } = useWorkflowVariables();

  const availableVariables = useMemo(() => {
    let variables = excludeNodeId ? getAvailableVariables(excludeNodeId) : getVariableSuggestions(searchQuery);
    
    if (filterByType && filterByType.length > 0) {
      variables = variables.filter(variable => filterByType.includes(variable.type));
    }
    
    if (searchQuery) {
      variables = variables.filter(variable => 
        variable.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        variable.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return variables;
  }, [getAvailableVariables, getVariableSuggestions, searchQuery, filterByType, excludeNodeId]);

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

  const handleVariableSelect = (variableName: string) => {
    onSelectVariable(variableName);
    onClose();
  };

  const insertVariable = (variableName: string) => {
    const variableReference = `{{${variableName}}}`;
    onSelectVariable(variableReference);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Select Variable</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search variables..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Variables List */}
        <div className="flex-1 overflow-y-auto p-4">
          {availableVariables.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Variable className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No variables found</p>
              {searchQuery && (
                <p className="text-sm mt-2">Try adjusting your search terms</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {availableVariables.map((variable) => (
                <div
                  key={variable.id}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => insertVariable(variable.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${getTypeColor(variable.type)}`}>
                        {getTypeIcon(variable.type)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{variable.name}</div>
                        {variable.description && (
                          <div className="text-sm text-gray-500">{variable.description}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          From: {variable.nodeName}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      {`{{${variable.name}}}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <p className="mb-2">💡 <strong>Tip:</strong> Use variables to reference data from other nodes in your workflow.</p>
            <p>Variables are automatically updated when the source node's data changes.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VariableSelector;
