import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle, AlertCircle, FileText } from 'lucide-react';

interface DocumentUploadProps {
  onUploadComplete: (documentUrl: string, fileName: string, fileSize: number, fileType: string) => void;
  onCancel: () => void;
}

interface UploadProgress {
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  message: string;
}

export function DocumentUpload({ onUploadComplete, onCancel }: DocumentUploadProps) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB limit
  });

  const uploadDocument = async () => {
    if (!selectedFile) return;
 
    const formData = new FormData();
    formData.append('document', selectedFile);
 
    try {
      setUploadProgress({ progress: 0, status: 'uploading', message: 'Uploading...' });
 
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/documents/upload`, {
        method: 'POST',
        body: formData
      });
 
      if (!resp.ok) throw new Error(`Error: ${resp.statusText}`);
 
      const result = await resp.json();
      setUploadProgress({ progress: 100, status: 'complete', message: 'Upload complete!' });
 
      if (onUploadComplete) {
        onUploadComplete(result.fileUrl, result.originalName, result.size, result.mimeType);
      }
    } catch (error:any) {
      console.error('Upload error:', error);
      setUploadProgress({ progress: 0, status: 'error', message: error.message });
    }
  };
 

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (uploadProgress) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-100 mb-4">
            {uploadProgress.status === 'complete' ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : uploadProgress.status === 'error' ? (
              <AlertCircle className="h-8 w-8 text-red-600" />
            ) : (
              <Upload className="h-8 w-8 text-indigo-600" />
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {uploadProgress.status === 'complete' ? 'Upload Complete!' :
             uploadProgress.status === 'error' ? 'Upload Failed' :
             'Uploading Document'}
          </h3>

          <p className="text-gray-600 mb-4">{uploadProgress.message}</p>

          {uploadProgress.status !== 'error' && uploadProgress.status !== 'complete' && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
          )}

          {uploadProgress.status === 'error' && (
            <button
              onClick={() => {
                setUploadProgress(null);
                setSelectedFile(null);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h3>

      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            {isDragActive ? 'Drop your document here' : 'Upload a document'}
          </p>
          <p className="text-gray-600 mb-4">
            Drag and drop your document here, or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supports PDF, DOC, DOCX, TXT, MD, PPT, PPTX (max 50MB)
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-indigo-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={uploadDocument}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Upload Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}