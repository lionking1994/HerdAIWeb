import React, { useState } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';

interface McpDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mcpDetails: string;
  onSave: (details: string) => void;
}

const McpDetailsModal: React.FC<McpDetailsModalProps> = ({
  isOpen,
  onClose,
  mcpDetails,
  onSave
}) => {
  const [details, setDetails] = useState(mcpDetails || '{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isValidJson, setIsValidJson] = useState<boolean>(true);

  const validateJson = (value: string) => {
    if (!value.trim()) {
      setJsonError(null);
      setIsValidJson(true);
      return;
    }
    
    try {
      JSON.parse(value);
      setJsonError(null);
      setIsValidJson(true);
    } catch (error) {
      setJsonError((error as Error).message);
      setIsValidJson(false);
    }
  };

  const handleChange = (value: string) => {
    setDetails(value);
    validateJson(value);
  };

  const formatJson = () => {
    if (!details.trim()) return;
    
    try {
      const parsed = JSON.parse(details);
      const formatted = JSON.stringify(parsed, null, 2);
      setDetails(formatted);
      setJsonError(null);
      setIsValidJson(true);
    } catch {
      // If it's not valid JSON, don't format
    }
  };

  const handleSave = () => {
    if (isValidJson) {
      onSave(details);
      onClose();
    }
  };

  const handleReset = () => {
    setDetails(mcpDetails);
    validateJson(mcpDetails);
  };

  const generateCoreSignalConfig = () => {
    const config = {
      mcpServers: {
        coresignal: {
          command: "npx",
          args: [
            "@modelcontextprotocol/server-coresignal",
            "--header",
            "apikey:" + "${AUTH_HEADER}"
          ],
          env: {
            AUTH_HEADER: "MxoA5PNPglG4Gvstfch49iHiDA7xJdQM"
          }
        }
      }
    };
    const configString = JSON.stringify(config, null, 2);
    setDetails(configString);
    validateJson(configString);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-900">MCP Configuration Editor</h2>
            {isValidJson && details.trim() && (
              <div className="flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>
                Valid JSON
              </div>
            )}
            {jsonError && (
              <div className="flex items-center px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></div>
                Invalid JSON
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2">
            <button
              onClick={formatJson}
              className="inline-flex items-center px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Format JSON
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center px-3 py-2 text-sm font-medium bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={generateCoreSignalConfig}
              className="inline-flex items-center px-3 py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Generate CoreSignal Config
            </button>
          </div>
          <div className="text-sm text-gray-500">
            Model Context Protocol Configuration
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="h-full relative">
            <textarea
              value={details}
              onChange={(e) => handleChange(e.target.value)}
              className={`w-full h-full px-4 py-3 border-2 rounded-lg font-mono text-sm leading-relaxed resize-none whitespace-pre overflow-auto ${
                isValidJson 
                  ? 'border-gray-300 bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100' 
                  : 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-100'
              }`}
              placeholder={`{
                "mcpServers": {
                  "coresignal": {
                    "command": "npx",
                    "args": [
                      "@modelcontextprotocol/server-coresignal",
                      "--header",
                      "apikey: ... "
                    ],
                    "env": {
                      "AUTH_HEADER": "your_coresignal_api_key_here"
                    }
                  }
                }
              }`}
            />
          </div>
        </div>

        {/* Error Display */}
        {jsonError && (
          <div className="p-4 bg-red-50 border-t border-red-200">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <div className="text-sm font-medium text-red-800 mb-1">JSON Syntax Error</div>
                <div className="text-sm text-red-700 font-mono bg-red-100 px-3 py-2 rounded">{jsonError}</div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {details.length} characters
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValidJson}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                isValidJson 
                  ? 'bg-blue-500 hover:bg-blue-600' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4 mr-2 inline" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default McpDetailsModal; 