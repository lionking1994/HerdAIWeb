import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, FileText, Download, Loader2, X } from 'lucide-react';
import { cn } from '../libs/utils';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';


const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.3
    }
  })
};

const PreviousResearch = () => {
  const [pastResearches, setPastResearches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingFiles, setDownloadingFiles] = useState(new Set());
  const [deletingFiles, setDeletingFiles] = useState(new Set());
  const navigate = useNavigate();

  // Table state - Same as FavouriteDocuments component
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 5, // Same page size as FavouriteDocuments
  });

  useEffect(() => {
    fetchResearches();
  }, []);

  const fetchResearches = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/tasks/get-previous-research`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPastResearches(data.researches);
        console.log('Previous research loaded:', data.researches?.length); // Debug log
      } else if (response.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
      }
    } catch (error) {
      console.error("Error fetching research:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkFileExists = async (filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/files/check/${filename}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check file existence');
      }

      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  };

  const handleDownload = async (research) => {
    const requestId = research.request_id;

    // Prevent multiple simultaneous downloads of the same file
    if (downloadingFiles.has(requestId)) {
      return;
    }

    try {
      setDownloadingFiles(prev => new Set(prev).add(requestId));
      let filename;
      if (research.source === 'research') {
        filename = `research-${requestId}.docx`;
        // Show loading toast
        const loadingToast = toast.loading('Checking file availability...');

        // Check if file exists
        const fileExists = await checkFileExists(filename);

        // Dismiss loading toast
        toast.dismiss(loadingToast);

        if (!fileExists) {
          toast.error('Research file not found. The file may have been moved or deleted.');
          return;
        }
      }
      else {
        filename = research.research_file
      }

      // File exists, proceed with download
      toast.success('File found! Opening download...');
      const downloadUrl = `${process.env.REACT_APP_API_URL}/files/${filename}`;
      window.open(downloadUrl, '_blank');

    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download research file. Please try again.');
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleDelete = async (research, e) => {
    e.stopPropagation(); // Prevent triggering the download

    const requestId = research.request_id;
    const source = research.source;

    // Prevent multiple simultaneous deletions of the same file
    if (deletingFiles.has(requestId)) {
      return;
    }

    try {
      setDeletingFiles(prev => new Set(prev).add(requestId));

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/delete-research`,
        { requestId, source },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Research deleted successfully');
        // Refetch the research data to maintain the 5-item limit
        fetchResearches();
        // Reset to first page if current page becomes empty
        if (pastResearches.slice(
          pagination.pageIndex * pagination.pageSize,
          (pagination.pageIndex + 1) * pagination.pageSize
        ).length === 1 && pagination.pageIndex > 0) {
          setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex - 1 }));
        }
      } else {
        toast.error(response.data.message || 'Failed to delete research');
      }
    } catch (error) {
      console.error('Error deleting research:', error);
      if (error.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
      } else {
        toast.error('Failed to delete research. Please try again.');
      }
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  // Handle pagination changes - Same as FavouriteDocuments component
  const handlePaginationChange = (newPagination) => {
    setPagination(newPagination);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : pastResearches && pastResearches.length > 0 ? (
          <>
            {pastResearches
              .slice(
                pagination.pageIndex * pagination.pageSize,
                (pagination.pageIndex + 1) * pagination.pageSize
              )
              .map((item, index) => (
                <motion.div
                  key={item.id}
                  className="relative flex items-center justify-between p-3 rounded-lg hover:bg-[#f8fafc] transition-colors border border-gray-100 cursor-pointer"
                  custom={index}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ scale: 1.01 }}
                  onClick={() => handleDownload(item)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <FileText size={20} className="text-purple-500" />
                    </div>
                    <div>
                      <p className="font-medium text-[#1e293b]">{item.topic}</p>
                      <p className="text-sm text-[#64748b]">
                        Completed: {new Date(item.created_at).toDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-1">
                    {downloadingFiles.has(item.request_id) ? (
                      <div className="w-8 h-8 flex items-center justify-center">
                        <Loader2 size={18} className="animate-spin text-purple-500" />
                      </div>
                    ) : (
                      item.research_file && (
                        <button
                          className="p-2 rounded-full hover:bg-purple-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item);
                          }}
                          title={item.source === 'research' ? " " : "Download Company Research"}
                        >

                          <Download size={18} className="text-purple-600" />
                        </button>
                      )
                    )}

                    {item.contact_research_file && (
                      <button
                        className="p-2 rounded-full hover:bg-blue-100 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const cleanFile = item.contact_research_file
                          const fileUrl = `${process.env.REACT_APP_API_URL}/files/${cleanFile}`;
                          window.open(fileUrl, "_blank");
                        }}
                        title="Download Contact Research"
                      >

                        <Download size={18} className="text-blue-600" />
                      </button>
                    )}


                    {deletingFiles.has(item.request_id) ? (
                      <div className="w-8 h-8 flex items-center justify-center">
                        <Loader2 size={18} className="animate-spin text-red-500" />
                      </div>
                    ) : (
                      <button
                        className="p-2 rounded-full hover:bg-red-100 transition-colors"
                        onClick={(e) => handleDelete(item, e)}
                        title="Delete research"
                      >
                        <X size={18} className="text-red-600" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText size={40} className="text-gray-300 mb-2" />
            <p className="text-gray-500">No previous research found</p>
          </div>
        )}
      </div>

      {/* Pagination Controls - Always show when there are documents */}
      {pastResearches.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg mt-4 border-t border-gray-200">
          <div className="flex-1 text-sm text-gray-700">
            Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
            {Math.min((pagination.pageIndex + 1) * pagination.pageSize, pastResearches.length)} of{" "}
            {pastResearches.length} results
          </div>
          <div className="flex items-center space-x-2">
            <button
              className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handlePaginationChange({
                ...pagination,
                pageIndex: pagination.pageIndex - 1
              })}
              disabled={pagination.pageIndex === 0 || isLoading}
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {pagination.pageIndex + 1} of{" "}
              {Math.ceil(pastResearches.length / pagination.pageSize)}
            </span>
            <button
              className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handlePaginationChange({
                ...pagination,
                pageIndex: pagination.pageIndex + 1
              })}
              disabled={pagination.pageIndex >= Math.ceil(pastResearches.length / pagination.pageSize) - 1 || isLoading}
            >
              Next
            </button>
            {/* Page Size Selector Dropdown */}
            <div className="flex items-center space-x-2 ml-4">
              <span className="text-sm text-gray-700">Show</span>
              <select
                value={pagination.pageSize}
                onChange={(e) => {
                  const newPageSize = parseInt(e.target.value);
                  setPagination({
                    pageIndex: 0, // Reset to first page when changing page size
                    pageSize: newPageSize
                  });
                }}
                className="px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviousResearch;
