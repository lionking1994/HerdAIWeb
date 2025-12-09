import React, { useState, useRef, useEffect } from 'react';
import { Variable, X } from 'lucide-react';
import VariableSelector from './VariableSelector';
import { useWorkflowVariables } from '../../hooks/useWorkflowVariables';

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  filterByType?: string[];
  excludeNodeId?: string;
  showVariableButton?: boolean;
}

const VariableInput: React.FC<VariableInputProps> = ({
  value,
  onChange,
  placeholder = 'Enter text or use variables...',
  className = '',
  multiline = false,
  filterByType,
  excludeNodeId,
  showVariableButton = true
}) => {
  const [showVariableSelector, setShowVariableSelector] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const { parseVariableReferences, replaceVariableReferences } = useWorkflowVariables();

  // Parse variables in the current value
  const variablesInValue = parseVariableReferences(value);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleVariableInsert = (variableReference: string) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue = value.slice(0, start) + variableReference + value.slice(end);
    
    onChange(newValue);
    
    // Set cursor position after the inserted variable
    setTimeout(() => {
      const newCursorPosition = start + variableReference.length;
      input.setSelectionRange(newCursorPosition, newCursorPosition);
      input.focus();
    }, 0);
  };

  const removeVariable = (variableName: string) => {
    const variableReference = `{{${variableName}}}`;
    const newValue = value.replace(variableReference, '');
    onChange(newValue);
  };

  const InputComponent = multiline ? 'textarea' : 'input';
  const inputProps = {
    ref: inputRef as any,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleInputChange(e.target.value);
    },
    onSelect: (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      setCursorPosition(target.selectionStart || 0);
    },
    placeholder,
    className: `w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`,
    ...(multiline && { rows: 4 })
  };

  return (
    <div className="space-y-2">
      {/* Input with variable button */}
      <div className="relative">
        <InputComponent {...inputProps} />
        {showVariableButton && (
          <button
            type="button"
            onClick={() => setShowVariableSelector(true)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Insert variable"
          >
            <Variable className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Variables in use */}
      {variablesInValue.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Variables in use:</div>
          <div className="flex flex-wrap gap-2">
            {variablesInValue.map((variable, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
              >
                <span>{variable?.name}</span>
                <button
                  type="button"
                  onClick={() => variable && removeVariable(variable.name)}
                  className="text-blue-600 hover:text-blue-800 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variable selector modal */}
      {showVariableSelector && (
        <VariableSelector
          onSelectVariable={handleVariableInsert}
          onClose={() => setShowVariableSelector(false)}
          currentValue={value}
          filterByType={filterByType}
          excludeNodeId={excludeNodeId}
        />
      )}
    </div>
  );
};

export default VariableInput;
