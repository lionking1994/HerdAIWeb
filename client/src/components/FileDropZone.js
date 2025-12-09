import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';

const FileDropZone = ({ onFileUpload, maxSize = 5, acceptedTypes = ['image/jpeg', 'image/png', 'image/gif'] }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    useEffect(() => {
        // Add paste event listener to the window
        const handlePaste = (e) => {
            const items = e.clipboardData?.items;
            
            if (!items) return;

            // Look for image items in clipboard
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file && validateFile(file)) {
                        handleFile(file);
                        break; // Only handle the first valid image
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);

        // Cleanup
        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, []);

    const validateFile = (file) => {
        // Check file type
        if (!acceptedTypes.includes(file.type)) {
            toast.error('Invalid file type. Please upload an image.');
            return false;
        }

        // Check file size (convert maxSize from MB to bytes)
        if (file.size > maxSize * 1024 * 1024) {
            toast.error(`File size must be less than ${maxSize}MB`);
            return false;
        }

        return true;
    };

    const handleFile = (file) => {
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result);
        };
        reader.readAsDataURL(file);

        // Call the parent's upload handler
        onFileUpload(file);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragIn = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragOut = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file && validateFile(file)) {
            handleFile(file);
        }
    };

    const handleFileInput = (e) => {
        const file = e.target.files[0];
        if (file && validateFile(file)) {
            handleFile(file);
        }
    };

    const handleClick = () => {
        fileInputRef.current.click();
    };

    const removeFile = (e) => {
        e.stopPropagation(); // Prevent triggering the parent div's click handler
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onFileUpload(null);
    };

    return (
        <div className="w-full">
            <div
                ref={dropZoneRef}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                    ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                    ${preview ? 'bg-gray-50' : 'bg-white'}`}
                onDragEnter={handleDragIn}
                onDragLeave={handleDragOut}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={preview ? undefined : handleClick}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={acceptedTypes.join(',')}
                    onChange={handleFileInput}
                />

                {preview ? (
                    <div className="relative">
                        <img
                            src={preview}
                            alt="Preview"
                            className="max-h-64 mx-auto rounded-lg"
                        />
                        <button
                            onClick={removeFile}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                ) : (
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
                            Drag and drop an image here, click to select, or paste from clipboard
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                            PNG, JPG, GIF up to {maxSize}MB
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileDropZone;
