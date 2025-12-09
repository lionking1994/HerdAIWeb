import React, { useState } from "react";
import { Maximize2, Minimize2, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "react-toastify";

const PromptModal = ({
  isOpen,
  onClose,
  title = "Update Prompt",
  initialContent = "",
  aiModels,
  onPreview,
  onUpdate,
  selectedModel,
  setSelectedModel,
  maxTokens,
  setMaxTokens,
  maxTokensLimit = 4096,
  promptSource = null, // Add prompt source information
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [promptContent, setPromptContent] = useState(initialContent);
  const [previewContent, setPreviewContent] = useState(null);
  // const [selectedModel, setSelectedModel] = useState(Object.values(aiModels)[0]?.models[0]?.id);
  // const [maxTokens, setMaxTokens] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewSuccess, setIsPreviewSuccess] = useState(false);

  const handlePreviewPrompt = async () => {
    setIsPreviewLoading(true);
    try {
      const preview = await onPreview(promptContent, selectedModel, maxTokens);
      console.log("Preview:", JSON.stringify(preview));
      setPreviewContent(preview);
      if(preview)
      setIsPreviewSuccess(true);
    } catch (error) {
      console.error("Preview failed:", error);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen"></span>
        <div
          className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all ${
            isFullScreen
              ? "fixed top-24 bottom-24 left-6 right-6 m-0 rounded-2xl"
              : "sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
          }`}
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 sm:mt-0 sm:text-left w-full">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {title}
                    </h3>
                    {promptSource && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-gray-500">Prompt Source:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          promptSource.source === 'company_template' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {promptSource.source === 'company_template' ? (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clipRule="evenodd" />
                              </svg>
                              Company Template
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                              Platform Default
                            </>
                          )}
                        </span>
                        {promptSource.templateName && (
                          <span className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                            "{promptSource.templateName}"
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {promptSource.provider}/{promptSource.model}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                      title={isFullScreen ? "Exit full screen" : "Full screen"}
                    >
                      {isFullScreen ? (
                        <Minimize2 size={20} className="text-gray-600" />
                      ) : (
                        <Maximize2 size={20} className="text-gray-600" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setPreviewContent(null);
                        onClose();
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 relative">
                  <textarea
                    value={promptContent}
                    onChange={(e) => {
                      setPromptContent(e.target.value);
                      setIsPreviewSuccess(false);
                    }}
                    className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:border-blue-500"
                    rows="6"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(promptContent);
                      toast.success("Content copied to clipboard!");
                    }}
                    className="absolute bottom-2 right-3 p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                    title="Copy to clipboard"
                  >
                    <i className="fas fa-copy"></i>
                  </button>
                </div>
                {previewContent && (
                  <div className="mt-4 relative">
                    <div className=" p-4 bg-gray-50 border rounded-lg overflow-auto max-h-[400px] focus:border-blue-500">
                    {(() => {
                      try {
                        // Try to parse as JSON if it's a string
                        const jsonData =
                          typeof previewContent === "string"
                            ? JSON.parse(previewContent)
                            : previewContent;

                        // Check if it's an array of objects or a single object
                        if (Array.isArray(jsonData)) {
                          return (
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                  <tr>
                                    {Object.keys(jsonData[0] || {}).map(
                                      (header) => (
                                        <th
                                          key={header}
                                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >
                                          {header}
                                        </th>
                                      )
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {jsonData.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                      {Object.values(row).map(
                                        (cell, cellIndex) => (
                                          <td
                                            key={cellIndex}
                                            className="px-6 py-4 whitespace-normal text-sm text-gray-500"
                                          >
                                            {typeof cell === "object"
                                              ? JSON.stringify(cell)
                                              : String(cell)}
                                          </td>
                                        )
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        } else if (typeof jsonData === "object") {
                          return (
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Key
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Value
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {Object.entries(jsonData).map(
                                    ([key, value], index) => (
                                      <tr key={index}>
                                        <td className="px-6 py-4 whitespace-normal text-sm text-gray-500">
                                          {key}
                                        </td>
                                        <td className="px-6 py-4 whitespace-normal text-sm text-gray-500">
                                          {typeof value === "object"
                                            ? JSON.stringify(value)
                                            : String(value)}
                                        </td>
                                      </tr>
                                    )
                                  )}
                                </tbody>
                              </table>
                            </div>
                          );
                        }
                      } catch (e) {
                        // If not valid JSON or parsing fails, render as markdown
                        return <ReactMarkdown>{previewContent}</ReactMarkdown>;
                      }
                    })()}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(previewContent));
                        toast.success("Content copied to clipboard!");
                      }}
                      className="absolute bottom-2 right-3 p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                      title="Copy to clipboard"
                    >
                      <i className="fas fa-copy"></i>
                    </button>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2 w-full sm:w-auto">
                  <label
                    htmlFor="maxTokens"
                    className="text-sm font-medium text-gray-700 whitespace-nowrap"
                  >
                    Max Token Size:
                  </label>
                  <input
                    id="maxTokens"
                    type="number"
                    value={maxTokens}
                    onChange={(e) => {
                      setMaxTokens(e.target.value);
                      setIsPreviewSuccess(false);
                    }}
                    className="w-24 rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                    min="1"
                    max={maxTokensLimit}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse sticky bottom-0 w-full">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setIsPreviewSuccess(false);
                }}
                className="w-full sm:w-40 rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
              >
                {Object.entries(aiModels).map(([provider, providerData]) => (
                  <optgroup key={provider} label={providerData.name}>
                    {providerData.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                onClick={handlePreviewPrompt}
                disabled={isPreviewLoading}
                className={`w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isPreviewLoading ? "opacity-75 cursor-not-allowed" : ""
                }`}
              >
                {isPreviewLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Previewing...
                  </>
                ) : (
                  "Preview"
                )}
              </button>

              <button
                onClick={() =>
                  onUpdate(promptContent, selectedModel, maxTokens)
                }
                disabled={!isPreviewSuccess}
                className={`w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 ${
                  isPreviewSuccess
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-400 cursor-not-allowed text-gray-100"
                } text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptModal;
