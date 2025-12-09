import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle, AlertCircle, Film } from 'lucide-react';

interface VideoUploadProps {
  onUploadComplete: (videoUrl: string, duration: number) => void;
  onCancel: () => void;
}

interface UploadProgress {
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  message: string;
}

export function VideoUpload({ onUploadComplete, onCancel }: VideoUploadProps) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentXhr, setCurrentXhr] = useState<XMLHttpRequest | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm']
    },
    maxFiles: 1,
  });

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      // Set timeout for large files
      const timeout = setTimeout(() => {
        window.URL.revokeObjectURL(video.src);
        reject(new Error('Timeout loading video metadata'));
      }, 30000); // 30 second timeout
      
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        window.URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration || 0));
      };
      
      video.onerror = () => {
        clearTimeout(timeout);
        window.URL.revokeObjectURL(video.src);
        reject(new Error('Error loading video metadata'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

const uploadVideo = async () => {
    if (!selectedFile) return;
 
    try {
        setUploadProgress({
            progress: 0,
            status: 'uploading',
            message: 'Preparing upload...',
        });
 
        // Skip frontend duration extraction - backend will handle it
        setUploadProgress({
            progress: 10,
            status: 'uploading',
            message: 'Starting upload...',
        });
 
        const formData = new FormData();
        formData.append('video', selectedFile);
        // Note: Duration will be calculated by backend

        // Use XMLHttpRequest for upload progress tracking
        const xhr = new XMLHttpRequest();
        setCurrentXhr(xhr); // Store reference for potential cancellation
        
        let startTime = Date.now();
        
        // Create a promise to handle the XMLHttpRequest
        const uploadPromise = new Promise<{publicUrl: string, duration: number}>((resolve, reject) => {
            // Track upload progress
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 90) + 10; // Reserve 10% for processing
                    const uploadedMB = (event.loaded / (1024 * 1024)).toFixed(1);
                    const totalMB = (event.total / (1024 * 1024)).toFixed(1);
                    
                    // Calculate upload speed
                    const elapsed = (Date.now() - startTime) / 1000; // seconds
                    const uploadSpeed = elapsed > 0 ? (event.loaded / elapsed / (1024 * 1024)).toFixed(1) : '0';
                    
                    // Calculate ETA
                    const remainingBytes = event.total - event.loaded;
                    const eta = elapsed > 0 && event.loaded > 0 ? 
                        Math.round(remainingBytes / (event.loaded / elapsed)) : 0;
                    const etaText = eta > 0 ? ` • ETA: ${Math.floor(eta / 60)}:${(eta % 60).toString().padStart(2, '0')}` : '';
                    
                    setUploadProgress({
                        progress: percentComplete,
                        status: 'uploading',
                        message: `Uploading... ${uploadedMB}MB / ${totalMB}MB (${uploadSpeed} MB/s)${etaText}`,
                    });
                }
            });

            // Handle upload completion
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        console.log('📹 Upload API Response:', response);
                        
                        // Extract data from API response structure
                        const publicUrl = response.publicUrl || response.video?.video_url;
                        const duration = response.duration || response.video?.duration || 0;
                        
                        resolve({ publicUrl, duration });
                    } catch (error) {
                        reject(new Error('Invalid response from server'));
                    }
                } else {
                    reject(new Error(`Upload failed with status: ${xhr.status}`));
                }
            });

            // Handle upload errors
            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });

            // Handle upload timeout
            xhr.addEventListener('timeout', () => {
                reject(new Error('Upload timeout - please try again'));
            });

            // Configure and send the request
            xhr.open('POST', `${import.meta.env.VITE_API_BASE_URL}/lms/upload-video`);
            xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
            xhr.timeout = 300000; // 5 minute timeout for large files
            xhr.send(formData);
        });

        // Wait for upload to complete
        const { publicUrl, duration } = await uploadPromise;

        // Clear xhr reference
        setCurrentXhr(null);

        // Final processing step
        setUploadProgress({
            progress: 100,
            status: 'complete',
            message: 'Upload complete!',
        });

        console.log('✅ Video upload successful:', { publicUrl, duration });

        // Wait a moment to show completion
        setTimeout(() => {
            onUploadComplete(publicUrl, duration);
        }, 1000);
 
    } catch (error) {
        console.error('Upload error:', error);
        setCurrentXhr(null);
        
        // Check if error was due to user cancellation
        if (error instanceof Error && error.message.includes('abort')) {
            setUploadProgress(null); // Reset to initial state
            setSelectedFile(null);
        } else {
            setUploadProgress({
                progress: 0,
                status: 'error',
                message: error instanceof Error ? error.message : 'Upload failed',
            });
        }
    }
};

const cancelUpload = () => {
    if (currentXhr) {
        currentXhr.abort();
        setCurrentXhr(null);
    }
    setUploadProgress(null);
    setSelectedFile(null);
};
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
             'Uploading Video'}
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
            <div className="flex justify-center space-x-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setUploadProgress(null);
                  setSelectedFile(null);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {(uploadProgress.status === 'uploading' || uploadProgress.status === 'processing') && (
            <button
              onClick={cancelUpload}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Cancel Upload
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Video </h3>

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
          <Film className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            {isDragActive ? 'Drop your video here' : 'Upload a video file'}
          </p>
          <p className="text-gray-600 mb-4">
            Drag and drop your video file here, or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supports MP4, MOV, AVI, MKV, WebM (Large files may take longer to process)
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Film className="h-8 w-8 text-indigo-600" />
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
              onClick={uploadVideo}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Upload Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}