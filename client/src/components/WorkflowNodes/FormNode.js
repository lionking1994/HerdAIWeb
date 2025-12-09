import React from 'react';
import { Download, FileText, Image, AlertCircle } from 'lucide-react';
import AvatarPop from "../AvatarPop";

const FormNode = ({ nodeInstance }) => {
  const { data, node_name, formFields } = nodeInstance;

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <p>No form data available</p>
        </div>
      </div>
    );
  }

  // Helper function to get field type from formFields or infer from data
  const getFieldType = (fieldName) => {
    if (formFields && Array.isArray(formFields)) {
      const field = formFields.find(f => f.name === fieldName);
      return field?.type || 'text';
    }
    // Infer type from data value
    const value = data[fieldName];
    if (typeof value === 'string') {
      if (value.startsWith('http') && (value.includes('/upload/') || value.includes('/files/'))) {
        return 'file';
      }
      if (value.startsWith('data:image/')) {
        return 'signature';
      }
    }
    return 'text';
  };

  // Helper function to validate and format file URLs
  const getFileInfo = (url) => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const filename = pathParts[pathParts.length - 1] || 'Unknown File';
      return { url, filename, isValid: true };
    } catch (error) {
      return { url, filename: 'Invalid URL', isValid: false };
    }
  };

  // Helper function to render field value based on type
  const renderFieldValue = (fieldName, value, fieldType) => {
    switch (fieldType) {
      case 'file':
        const fileInfo = getFileInfo(value);
        if (!fileInfo.isValid) {
          return (
            <div className="flex items-center space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-700">Invalid file URL: {value}</span>
            </div>
          );
        }
        
        return (
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <div className="flex-1">
              <div className="text-gray-700 font-medium">{fileInfo.filename}</div>
              <div className="text-sm text-gray-500">{fileInfo.url}</div>
            </div>
            <a
              href={fileInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </a>
          </div>
        );

      case 'signature':
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Image className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Signature Image</span>
            </div>
            <div className="border rounded-lg p-3 bg-gray-50">
              <img 
                src={value} 
                alt="Signature" 
                className="max-w-full h-auto max-h-32 object-contain border rounded"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="hidden text-center text-gray-500 text-sm">
                <Image className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Image failed to load</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded border">
              <strong>Raw Data:</strong> {value.substring(0, 100)}...
              {value.length > 100 && (
                <button 
                  onClick={() => navigator.clipboard.writeText(value)}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Copy Full Data
                </button>
              )}
            </div>
          </div>
        );

      case 'textarea':
      case 'memo':
        return (
          <div className="whitespace-pre-wrap text-gray-700 bg-gray-50 p-3 rounded-lg border">
            {value}
          </div>
        );

      case 'dropdown':
      case 'radio':
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {value}
          </span>
        );

      case 'checkbox':
        return (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {value ? 'Yes' : 'No'}
          </span>
        );

      case 'date':
        try {
          const dateValue = new Date(value);
          if (isNaN(dateValue.getTime())) {
            return <span className="text-red-600">Invalid date: {value}</span>;
          }
          return (
            <span className="text-gray-700">
              {dateValue.toLocaleDateString()}
            </span>
          );
        } catch (error) {
          return <span className="text-red-600">Invalid date: {value}</span>;
        }

      case 'number':
        return (
          <span className="font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">
            {value}
          </span>
        );

      case 'email':
        return (
          <a 
            href={`mailto:${value}`}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {value}
          </a>
        );

      case 'phone':
        return (
          <a 
            href={`tel:${value}`}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {value}
          </a>
        );

      case 'url':
        return (
          <a 
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline break-all"
          >
            {value}
          </a>
        );

      default:
        return (
          <span className="text-gray-700">
            {typeof value === 'object' 
              ? JSON.stringify(value, null, 2)
              : String(value)
            }
          </span>
        );
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between">
        
      </div>
      {nodeInstance.result?.submittedBy && <div className='flex gap-3 mb-3'>
          <AvatarPop participant={nodeInstance.result?.submittedBy} />
          <div className="">
          <span>{nodeInstance.result?.submittedBy.name}</span>
          <h3 className="text-lg font-semibold text-gray-900">
            {node_name || 'Form Data'}
          </h3>
        </div>
       
      </div>}
          <p className="text-sm text-gray-600 mb-6">
            Form submission details and collected information
          </p>

      <div className="space-y-3">
        {Object.keys(data).map((key) => {
          const fieldType = getFieldType(key);
          const value = data[key];
          
          return (
            <div key={key} className="rounded-lg p-4 bg-white shadow-sm border border-gray-200">
              <div className="flex items-start space-x-4">
                <div className="min-w-[150px]">
                  <span className="font-semibold text-gray-900 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">
                    Type: {fieldType}
                  </div>
                </div>
                <div className="flex-1">
                  {renderFieldValue(key, value, fieldType)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FormNode;
