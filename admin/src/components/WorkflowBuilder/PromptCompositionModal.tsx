import React, { useState, useRef, useEffect } from 'react';
import { X, Tag, Download, FileText } from 'lucide-react';
// import { analyseComplexValue } from 'framer-motion';
import ReactMarkdown from "react-markdown";

interface FormField {
  name: string;
  type: 'text' | 'dropdown' | 'memo' | 'file' | 'radio' | 'signature' | 'date';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  validation?: 'none' | 'email' | 'phone' | 'url' | 'number' | 'date' | 'time' | 'zipcode' | 'ssn' | 'creditcard';
}

interface PromptCompositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prompt: string) => void;
  formFields: FormField[];
  initialPrompt?: string;
  nodeType?: string; // Add node type to customize the interface
  customTitle?: string;
  contentLabel?: string;
  placeholderText?: string;
  saveButtonLabel?: string;
  api?: string;
  model?: string;
}

const PromptCompositionModal: React.FC<PromptCompositionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  formFields,
  initialPrompt = '',
  nodeType = 'form',
  customTitle,
  contentLabel,
  placeholderText,
  saveButtonLabel,
  api = 'openai',
  model = 'gpt-4',
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showTest, setShowTest] = useState(false);
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const [testOutputType, setTestOutputType] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ result?: string; resultType?: string; svgPath?: string; error?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  const handleDragStart = (e: React.DragEvent, fieldName: string) => {
    e.dataTransfer.setData('text/plain', `{{${fieldName}}}`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fieldTag = e.dataTransfer.getData('text/plain');
    
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = textarea.value;
      
      const newValue = currentValue.substring(0, start) + fieldTag + currentValue.substring(end);
      setPrompt(newValue);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + fieldTag.length, start + fieldTag.length);
      }, 0);
    }
  };

  const handleTagClick = (fieldName: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = textarea.value;
      const fieldTag = `{{${fieldName}}}`;
      
      const newValue = currentValue.substring(0, start) + fieldTag + currentValue.substring(end);
      setPrompt(newValue);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + fieldTag.length, start + fieldTag.length);
      }, 0);
    }
  };

  const handleSave = () => {
    onSave(prompt);
    onClose();
  };

  const replaceTags = (template: string, values: Record<string, string>) => {
    let processed = template;
    Object.keys(values).forEach((key) => {
      const placeholder = `{{${key}}}`;
      processed = processed.replace(new RegExp(placeholder, 'g'), values[key] || '');
    });
    return processed;
  };

  const handleRunTest = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      const userPrompt = replaceTags(prompt, testValues);
      const token = localStorage.getItem('token');
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/prompt/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          // systemPrompt: testSystemPrompt,
          userPrompt,
          provider: api,
          model,
          max_tokens: 4000,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data.success === false) {
        setTestResult({ error: data?.error || `HTTP ${resp.status}` });
      } else {
        setTestResult({ result: data.result, resultType: data.resultType, svgPath:data?.svgPath || null });
        setTestOutputType(data.output_type);
      }
    } catch (e: any) {
      setTestResult({ error: e?.message || 'Unknown error' });
    } finally {
      setIsTesting(false);
    }
  };

  // const analyseOutputType = async () => {
  //   try {
  //     setTestOutputType('');
  //     const token = localStorage.getItem('token');
  //     const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/prompt/output_type`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Authorization': `Bearer ${token || ''}`,
  //       },
  //       body: JSON.stringify({
  //         prompt,
  //       }),
  //     });
  //     const data = await resp.json();
  //     if (!resp.ok || data.success === false) {
  //       setTestOutputType(`error: ${data?.error}`);
  //       setIsTesting(true);        
  //     } else {
  //       setTestOutputType(data.result);
  //     }
  //   } catch (e: any) {
  //     setTestOutputType(`${e?.message}`);
  //   }
  // };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 md:p-5 border-b">
          <div className="min-w-0">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 truncate">
              {customTitle || (nodeType === 'agentNode' ? 'Compose Agent Prompt' : 'Compose Prompt')}
            </h3>
            {nodeType === 'agentNode' && !customTitle && (
              <p className="text-xs md:text-sm text-gray-600 mt-1">
                Create prompts for MCP agent execution
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 border border-gray-200">
              {api}/{model}
            </span>
            <button onClick={ e=>{showTest? setShowTest((v)=>!v): onClose()}} className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showTest?null:<div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5">
          <div className="flex gap-4 min-h-0">
            <div className="w-64 bg-gray-50 rounded-lg p-4 border border-gray-200 self-start max-h-[70vh] overflow-y-auto">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Form Fields</h4>
            <div className="space-y-2">
              {formFields.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No form fields available</p>
              ) : (
                formFields.map((field, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, field.name)}
                    onClick={() => handleTagClick(field.name)}
                    className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    title={`Drag to insert or click to add {{${field.name}}}`}
                  >
                    <Tag className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{field.name}</div>
                      <div className="text-xs text-gray-500 capitalize">
                        {field.type}
                        {field.required && <span className="text-red-500 ml-1">• Required</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-xs font-medium text-blue-800 mb-2">Instructions</h5>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Drag fields to insert tags</li>
                <li>• Click fields to add tags</li>
                <li>• Tags will be replaced with actual values</li>
                {nodeType === 'agentNode' && (
                  <li>• Use workflow context and user data in your prompts</li>
                )}
              </ul>
            </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {contentLabel || (nodeType === 'agentNode' ? 'Agent Prompt Content' : 'Prompt Content')}
              </label>
              <div className="text-xs text-gray-500 mb-2">
                {placeholderText
                  ? placeholderText
                  : (nodeType === 'agentNode' 
                    ? 'Use the form field tags on the left to create dynamic MCP agent prompts'
                    : 'Use the form field tags on the left to create dynamic prompts')}
              </div>
            </div>
            
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder={placeholderText || (nodeType === 'agentNode' 
                ? "Compose your MCP agent prompt here... You can drag form field tags from the left panel or type them manually using {{fieldName}} syntax. Examples: 'Find companies in {{location}}' or 'Analyze {{companyName}} for {{analysisType}}'"
                : "Compose your prompt here... You can drag form field tags from the left panel or type them manually using {{fieldName}} syntax.")}
            />
            
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <h5 className="text-xs font-medium text-gray-700 mb-2">Preview</h5>
              <div className="text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {prompt || 'No content yet'}
              </div>
            </div>
            </div>
          </div>
        </div>}
        
        <div className="flex items-center justify-end gap-3 p-4 md:p-5 border-t">
          <button
            onClick={async () =>{
              // if(!showTest)
              // await analyseOutputType();
              setShowTest((v) => !v)}}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors mr-auto"
            title="Test this prompt"
          >
            {showTest ? 'Hide Test' : 'Test Prompt'}
          </button>
          <button onClick={ e=>{showTest? setShowTest((v)=>!v): onClose()}} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors">
            {saveButtonLabel || 'Save Prompt'}
          </button>
        </div>

        {showTest && (
          <div className="px-4 md:px-5 pb-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">Test Prompt</h4>
              <span className="text-xs text-gray-500">
                <h4 className='text-sm font-medium'>{testOutputType && `Output Type : ${testOutputType}`}</h4>
                Model: {api}/{model}
                </span>
            </div>

            {formFields.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Input test values for form fields</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {formFields.map((f, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600">{f.name}</span>
                      <textarea
                        // type="text"
                        value={testValues[f.name] || ''}
                        onChange={(e) => setTestValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                        rows={3}
                        // className="px-2 py-1 border border-gray-300 rounded"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Value for ${f.name}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">System Prompt (optional)</label>
          {/*     <textarea
                value={testSystemPrompt}
                onChange={(e) => setTestSystemPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              /> */}

              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder={placeholderText || (nodeType === 'agentNode' 
                  ? "Compose your MCP agent prompt here... You can drag form field tags from the left panel or type them manually using {{fieldName}} syntax. Examples: 'Find companies in {{location}}' or 'Analyze {{companyName}} for {{analysisType}}'"
                  : "Compose your prompt here... You can drag form field tags from the left panel or type them manually using {{fieldName}} syntax.")}
              />

            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
              <div className="text-sm font-medium text-gray-700 mb-1">User Prompt Preview</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-auto">
                {replaceTags(prompt, testValues) || 'No content'}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunTest}
                disabled={isTesting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {isTesting ? 'Running…' : 'Run Test'}
              </button>
              {testResult?.error && (
                <span className="text-sm text-red-600">{testResult.error}</span>
              )}
            </div>

            {testResult?.result && (
              <div className="p-3 bg-green-50 border border-green-200 rounded overflow-auto">
                <div className="text-xs font-medium text-green-800 mb-1">Result ({testOutputType})</div>
                {testResult.resultType === 'image' ? (
                  <div className="flex flex-col items-center gap-4 p-4">
                    {/* <img 
                      src={testResult?.svgPath ? `${import.meta.env.VITE_API_BASE_URL}${testResult.result}` : `${import.meta.env.VITE_API_BASE_URL}${testResult.result}`} 
                      alt="AI Result" 
                      className="max-h-64 rounded" 
                    /> */}
                    {testResult?.svgPath ? <a
                      href={`${import.meta.env.VITE_API_BASE_URL}${testResult.result}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Image</span>
                    </a>
                    : <img 
                    src={testResult.result} 
                    alt="AI Result" 
                    className="max-h-64 rounded" 
                  />
}
                  </div>
                ) : testOutputType === 'ppt' ? (
                  <div className="flex flex-col items-center gap-4 p-4">
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL}${testResult.result}`}
                      download
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PPTX</span>
                    </a>
                  </div>
                ) :  testOutputType === 'csv' ? (
                  <div className="flex flex-col items-center gap-4 p-4">
                  <a
                      href={`${import.meta.env.VITE_API_BASE_URL}${testResult.result}`}
                      download
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download CSV</span>
                    </a>
                  </div>
                ) :   (
                  <div className="text-sm h-32 overflow-auto text-green-900 whitespace-pre-wrap"><ReactMarkdown>{testResult.result}</ReactMarkdown></div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptCompositionModal; 