import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { XCircle } from 'lucide-react';
import { toast } from 'react-toastify';

export const AgentResearchItem = ({ requestId, onClose, onResearchComplete, onDownload }) => {
  const [status, setStatus] = useState();
  const [downloadLink, setDownloadLink] = useState();
  const [topic, setTopic] = useState('');
  const timeoutRef = useRef();
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (isClosed) {
      return () => {
        isMounted = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }

    const getStatus = async () => {
      if (!isMounted || !requestId) return;
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/tasks/get-research-status`,
          { requestId },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        if (!isMounted) return;

        // Stop polling if research is closed
        if (response.data && response.data.error === "Research request is closed") {
          setIsClosed(true);
          if (onClose) onClose();
          return;
        }

        if(response.data.success) {
          setStatus(response.data.data.status);
          setTopic(response.data.data.query);
          if(response.data.data.status && response.data.data.status[0] === 'COMPLETED') {
            setDownloadLink(`${process.env.REACT_APP_API_URL}${response.data.data.downloadlink}`);
            if (onResearchComplete) onResearchComplete();
            return;
          }
        } else {
          toast.error(response.data.error);
        }
        timeoutRef.current = setTimeout(getStatus, 5000);
      } catch (error) {
        if (!isMounted) return;
        console.error('Error getting research status:', error);
        toast.error('Failed to get research status');
      }
    };

    getStatus();

    return () => {
      isMounted = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [requestId, isClosed]);

  if (!requestId || isClosed) return null;

  const closeResearchHandler = async () => {
    setIsClosed(true);
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/tasks/close-research`, {
        requestId
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      onClose();
    } catch (error) {
      console.error('Error closing research:', error);
      toast.error('Failed to close research');
    }
  }

  const downloadFile = () => {
    window.location.href = downloadLink;
    if (onDownload) onDownload();
  }

  return (
    <div>
      {
        status ? status[0] === 'COMPLETED' ? (
          <div className="flex items-center gap-2 text-white space-between">
            <button
              onClick={downloadFile}
              className="inline-flex items-center gap-2 px-4 py-2 cursor-pointer bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Results

            </button>
            <div className="cursor-pointer" onClick={closeResearchHandler}><XCircle /></div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-white space-between">
            <span className="w-5 h-5 rounded-full bg-red-500 big-status-dot flex-none"></span>
            <p className="m-auto">Researching {topic ? `"${topic}"` : '...'}</p>
            <div className="cursor-pointer" onClick={closeResearchHandler}><XCircle /></div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-white">
            <span className="w-2 h-2 rounded-full bg-red-500 status-dot"></span>
            <p>Checking Status...</p>
          </div>
        )
      }
    </div>
  )
}
