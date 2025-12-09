import React, { useState } from 'react';
import FileUploader from '../components/FileUploader';
import { toast } from 'react-toastify';

const FileUploaderDemo = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadMode, setUploadMode] = useState('single');
  const [fileTypes, setFileTypes] = useState('all');
  const [maxFileSize, setMaxFileSize] = useState(100);

  const handleFileUploaded = (fileData, originalFile) => {
    setUploadedFiles(prev => [...prev, {
      ...fileData,
      originalName: originalFile.name,
      size: originalFile.size,
      type: originalFile.type,
      uploadedAt: new Date()
    }]);
    
    toast.success(`File ${originalFile.name} uploaded successfully!`);
  };

  const getAcceptedFileTypes = () => {
    switch (fileTypes) {
      case 'images':
        return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      case 'documents':
        return ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
      case 'videos':
        return ['video/mp4', 'video/webm', 'video/ogg'];
      case 'audio':
        return ['audio/mpeg', 'audio/ogg', 'audio/wav'];
      default:
        return null; // Accept all file types
    }
  };

  const clearUploadedFiles = () => {
    setUploadedFiles([]);
    toast.info('Uploaded files list cleared');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">File Uploader Component Demo</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload Mode</label>
            <select
              value={uploadMode}
              onChange={(e) => setUploadMode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="single">Single File</option>
              <option value="multiple">Multiple Files</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">File Types</label>
            <select
              value={fileTypes}
              onChange={(e) => setFileTypes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Files</option>
              <option value="images">Images Only</option>
              <option value="documents">Documents Only</option>
              <option value="videos">Videos Only</option>
              <option value="audio">Audio Only</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max File Size (MB)
            </label>
            <input
              type="number"
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Current Configuration:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Upload Mode: <span className="font-medium">{uploadMode === 'single' ? 'Single File' : 'Multiple Files'}</span></li>
            <li>• Accepted File Types: <span className="font-medium">{fileTypes === 'all' ? 'All Files' : `${fileTypes} Only`}</span></li>
            <li>• Max File Size: <span className="font-medium">{maxFileSize} MB</span></li>
          </ul>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">File Uploader</h2>
        <FileUploader
          onFileUploaded={handleFileUploaded}
          maxSize={maxFileSize}
          acceptedTypes={getAcceptedFileTypes()}
          multiple={uploadMode === 'multiple'}
        />
      </div>
      
      {uploadedFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Uploaded Files</h2>
            <button
              onClick={clearUploadedFiles}
              className="px-3 py-1 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700"
            >
              Clear List
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded At
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {uploadedFiles.map((file, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {file.originalName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {file.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {file.uploadedAt.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <a 
                        href={`/api${file.path}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View/Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploaderDemo;

