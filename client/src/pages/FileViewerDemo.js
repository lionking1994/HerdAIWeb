import React, { useState } from 'react';
import { FileViewer, FileAttachment } from '../components/FileViewer';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const FileViewerDemo = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [showViewer, setShowViewer] = useState(false);
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileUrl('');
      setShowViewer(true);
    }
  };
  
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (fileUrl.trim()) {
      setSelectedFile(null);
      setShowViewer(true);
    }
  };
  
  const handleCloseViewer = () => {
    setShowViewer(false);
  };
  
  // Sample files for demonstration
  const sampleFiles = [
    {
      name: 'sample-image.jpg',
      url: 'https://source.unsplash.com/random/800x600/?nature',
      type: 'image/jpeg'
    },
    {
      name: 'sample-pdf.pdf',
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      type: 'application/pdf'
    },
    {
      name: 'sample-video.mp4',
      url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      type: 'video/mp4'
    },
    {
      name: 'sample-audio.mp3',
      url: 'https://sample-videos.com/audio/mp3/crowd-cheering.mp3',
      type: 'audio/mp3'
    },
    {
      name: 'sample-text.txt',
      url: 'https://www.w3.org/TR/PNG/iso_8859-1.txt',
      type: 'text/plain'
    }
  ];
  
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">File Viewer Component Demo</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Upload a File</h2>
            <div className="p-4 border border-gray-300 rounded-lg">
              <input
                type="file"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">Enter File URL</h2>
            <form onSubmit={handleUrlSubmit} className="p-4 border border-gray-300 rounded-lg">
              <div className="flex">
                <input
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://example.com/file.pdf"
                  className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  View
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <h2 className="text-xl font-semibold mb-4">Sample Files</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {sampleFiles.map((file, index) => (
            <FileAttachment
              key={index}
              file={file}
              allowPreview={true}
              allowDownload={true}
              className="cursor-pointer"
              onClick={() => {
                setSelectedFile(file);
                setFileUrl('');
                setShowViewer(true);
              }}
            />
          ))}
        </div>
        
        {showViewer && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">File Viewer</h2>
            <div className="border border-gray-300 rounded-lg overflow-hidden" style={{ height: '600px' }}>
              <FileViewer
                file={selectedFile || fileUrl}
                onClose={handleCloseViewer}
                allowDownload={true}
                allowZoom={true}
              />
            </div>
          </div>
        )}
      </div>
      
      <Footer />
    </div>
  );
};

export default FileViewerDemo;

