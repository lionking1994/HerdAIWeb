import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'react-toastify';

const FileUploader = ({
  onFileUploaded,
  maxSize = 100, // Default max size in MB
  acceptedTypes = null, // Default to accept all file types
  multiple = false,
  className = '',
  uploadEndpoint = '/api/upload/file'
}) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const cancelTokens = useRef({});

  // Convert maxSize from MB to bytes for dropzone
  const maxSizeBytes = maxSize * 1024 * 1024;

  const onDrop = useCallback((acceptedFiles) => {
    // Map files to add preview URLs and initial progress
    const newFiles = acceptedFiles.map(file => {
      // Create a preview URL for images
      const isImage = file.type.startsWith('image/');
      const preview = isImage ? URL.createObjectURL(file) : null;
      
      return {
        file,
        id: `${file.name}-${Date.now()}`,
        preview,
        progress: 0,
        uploading: false,
        error: null,
        uploaded: false
      };
    });

    // If multiple is false, replace existing files
    if (!multiple) {
      // Revoke any existing preview URLs to prevent memory leaks
      files.forEach(fileObj => {
        if (fileObj.preview) URL.revokeObjectURL(fileObj.preview);
      });
      setFiles(newFiles);
    } else {
      // Otherwise, add to existing files
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
    }
  }, [files, multiple]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes ? acceptedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {}) : undefined,
    maxSize: maxSizeBytes,
    multiple,
    onDropRejected: (rejectedFiles) => {
      rejectedFiles.forEach(({ file, errors }) => {
        let errorMessage = 'File rejected: ';
        errors.forEach(error => {
          if (error.code === 'file-too-large') {
            errorMessage += `File is larger than ${maxSize}MB`;
          } else if (error.code === 'file-invalid-type') {
            errorMessage += 'File type not accepted';
          } else {
            errorMessage += error.message;
          }
        });
        toast.error(errorMessage);
      });
    }
  });

  const uploadFile = async (fileObj) => {
    const { file, id } = fileObj;
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);

    // Create cancel token
    const cancelToken = axios.CancelToken.source();
    cancelTokens.current[id] = cancelToken;

    try {
      // Update file status
      setFiles(prevFiles => 
        prevFiles.map(f => 
          f.id === id ? { ...f, uploading: true, error: null } : f
        )
      );

      // Make the upload request
      const response = await axios.post(uploadEndpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        cancelToken: cancelToken.token,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          
          // Update progress for this specific file
          setUploadProgress(prev => ({
            ...prev,
            [id]: percentCompleted
          }));
          
          // Also update the files array with progress
          setFiles(prevFiles => 
            prevFiles.map(f => 
              f.id === id ? { ...f, progress: percentCompleted } : f
            )
          );
        }
      });

      // Update file status on success
      setFiles(prevFiles => 
        prevFiles.map(f => 
          f.id === id ? { 
            ...f, 
            uploading: false, 
            uploaded: true, 
            progress: 100,
            response: response.data
          } : f
        )
      );

      // Call the callback with the uploaded file data
      if (onFileUploaded) {
        onFileUploaded(response.data, file);
      }

      toast.success(`File ${file.name} uploaded successfully`);
      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) {
        toast.info(`Upload of ${file.name} was cancelled`);
      } else {
        const errorMsg = error.response?.data?.message || 'Error uploading file';
        toast.error(`Error uploading ${file.name}: ${errorMsg}`);
        
        // Update file status on error
        setFiles(prevFiles => 
          prevFiles.map(f => 
            f.id === id ? { ...f, uploading: false, error: errorMsg } : f
          )
        );
      }
      return null;
    } finally {
      // Clean up cancel token
      delete cancelTokens.current[id];
    }
  };

  const uploadAllFiles = async () => {
    if (files.length === 0) {
      toast.info('No files to upload');
      return;
    }

    setUploading(true);
    
    try {
      // Filter out already uploaded files
      const filesToUpload = files.filter(f => !f.uploaded && !f.uploading);
      
      if (filesToUpload.length === 0) {
        toast.info('All files already uploaded');
        return;
      }

      // Upload files in parallel
      await Promise.all(filesToUpload.map(fileObj => uploadFile(fileObj)));
    } finally {
      setUploading(false);
    }
  };

  const cancelUpload = (id) => {
    if (cancelTokens.current[id]) {
      cancelTokens.current[id].cancel('Upload cancelled by user');
      delete cancelTokens.current[id];
      
      // Update file status
      setFiles(prevFiles => 
        prevFiles.map(f => 
          f.id === id ? { ...f, uploading: false, error: 'Upload cancelled' } : f
        )
      );
    }
  };

  const removeFile = (id) => {
    // If file is uploading, cancel the upload first
    if (cancelTokens.current[id]) {
      cancelUpload(id);
    }

    // Find the file to revoke its preview URL if it exists
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove && fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }

    // Remove the file from state
    setFiles(prevFiles => prevFiles.filter(f => f.id !== id));
    
    // Remove from progress tracking
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[id];
      return newProgress;
    });
  };

  // Clean up preview URLs when component unmounts
  React.useEffect(() => {
    return () => {
      files.forEach(fileObj => {
        if (fileObj.preview) URL.revokeObjectURL(fileObj.preview);
      });
    };
  }, [files]);

  return (
    <div className={`w-full ${className}`}>
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${files.length > 0 ? 'bg-gray-50' : 'bg-white'}`}
      >
        <input {...getInputProps()} />
        
        {files.length === 0 && (
          <div>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              Drag and drop {multiple ? 'files' : 'a file'} here, or click to select
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {acceptedTypes ? acceptedTypes.join(', ') : 'Any file type'} up to {maxSize}MB
            </p>
          </div>
        )}

        {files.length > 0 && (
          <p className="text-sm text-gray-600">
            Drop more files here, or click to select more
          </p>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">
              {files.length} {files.length === 1 ? 'file' : 'files'} selected
            </h3>
            {multiple && (
              <button
                type="button"
                onClick={uploadAllFiles}
                disabled={uploading || files.every(f => f.uploaded)}
                className={`px-3 py-1 text-sm font-medium rounded-md 
                  ${uploading || files.every(f => f.uploaded) 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                {uploading ? 'Uploading...' : 'Upload All'}
              </button>
            )}
          </div>

          <ul className="space-y-2">
            {files.map((fileObj) => (
              <li key={fileObj.id} className="border rounded-md p-3 bg-white">
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-3">
                    {fileObj.preview ? (
                      <img 
                        src={fileObj.preview} 
                        alt="Preview" 
                        className="h-12 w-12 object-cover rounded" 
                      />
                    ) : (
                      <div className="h-12 w-12 flex items-center justify-center bg-gray-100 rounded">
                        <svg className="h-6 w-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileObj.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(fileObj.file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      {fileObj.error && (
                        <p className="text-xs text-red-500 mt-1">{fileObj.error}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {fileObj.uploading ? (
                      <button
                        type="button"
                        onClick={() => cancelUpload(fileObj.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Cancel
                      </button>
                    ) : fileObj.uploaded ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Uploaded
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => uploadFile(fileObj)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Upload
                      </button>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => removeFile(fileObj.id)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                
                {(fileObj.uploading || fileObj.uploaded) && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${fileObj.error ? 'bg-red-600' : 'bg-blue-600'}`}
                        style={{ width: `${fileObj.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-right">
                      {fileObj.progress}%
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUploader;

