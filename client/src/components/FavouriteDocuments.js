import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, FileText, Loader2, X, Download } from 'lucide-react';
import axios from 'axios';
import { format } from "date-fns";
import { useSelector } from 'react-redux';
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

const FavouriteDocuments = () => {
  const [openTasks, setOpenTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState(new Set());
  const { user } = useSelector(state => state.auth);

  // Pagination state - Same as the image
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 4, // Default page size as shown in image
  });

  useEffect(() => {
    fetchFavouriteThreads();
  }, []);

  const fetchFavouriteThreads = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/tasks/get-favourite-threads`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success && response.data.favouriteThreads) {
        const transformed = response.data.favouriteThreads.map((item, index) => ({
          id: index,
          title: item.custom_name || item.task_file_origin_name || 'Untitled Document',
          createdBy: item.name || 'Unknown',
          date: item.created_at,
          thread_id: item.thread_id,
          task_file: item.task_file
        }));

        setOpenTasks(transformed);
        console.log('Favourite threads loaded:', transformed.length); // Debug log
      }
    } catch (error) {
      console.error("Error fetching favorite threads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (fileName) => {
    const downloadUrl = `${process.env.REACT_APP_API_URL}/files/${fileName}`;
    window.open(downloadUrl, '_blank');
  };

  const handleUnFavouriteClick = async (threadId) => {
    if (removingIds.has(threadId)) return;

    try {
      setRemovingIds(prev => new Set(prev).add(threadId));

      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/favourite`,
        {
          threadId,
          isFavourite: false,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (res.data.success) {
        toast.success("Removed from favorites");
        setOpenTasks(prev => prev.filter(thread => thread.thread_id !== threadId));
        // Reset to first page if current page becomes empty
        if (openTasks.slice(
          pagination.pageIndex * pagination.pageSize,
          (pagination.pageIndex + 1) * pagination.pageSize
        ).length === 1 && pagination.pageIndex > 0) {
          setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex - 1 }));
        }
      }
    } catch (err) {
      console.error("Failed to unfavorite:", err);
      toast.error("Error removing from favorites");
    } finally {
      setRemovingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(threadId);
        return newSet;
      });
    }
  };

  // Handle pagination changes
  const handlePaginationChange = (newPagination) => {
    setPagination(newPagination);
  };

  // Calculate pagination values
  const totalPages = Math.ceil(openTasks.length / pagination.pageSize);
  const startItem = pagination.pageIndex * pagination.pageSize + 1;
  const endItem = Math.min((pagination.pageIndex + 1) * pagination.pageSize, openTasks.length);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : openTasks.length > 0 ? (
          <>
            {openTasks
              .slice(
                pagination.pageIndex * pagination.pageSize,
                (pagination.pageIndex + 1) * pagination.pageSize
              )
              .map((item, index) => (
            <motion.div
              key={item.thread_id}
              className="relative flex items-center justify-between p-2 rounded-lg hover:bg-[#f8fafc] transition-colors border border-gray-100 cursor-pointer"
              custom={index}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.01 }}
              onClick={() => handleDownload(item.task_file)}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <FileText size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-[#1e293b]">{item.title}</p>
                  <p className="text-sm text-[#64748b]">
                    Created By: {item.createdBy} | Date: {format(new Date(item.date), 'MM/dd/yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Download Button */}
                <button
                  className="p-2 rounded-full hover:bg-green-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(item.task_file);
                  }}
                  title="Download"
                >
                  <Download size={18} className="text-green-600" />
                </button>

                {/* Unfavourite Button */}
                <button
                  className="p-2 rounded-full hover:bg-red-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering download
                    handleUnFavouriteClick(item.thread_id);
                  }}
                  title="Remove from favorites"
                  disabled={removingIds.has(item.thread_id)}
                >
                  {removingIds.has(item.thread_id) ? (
                    <Loader2 size={18} className="animate-spin text-red-500" />
                  ) : (
                    <X size={18} className="text-red-600" />
                  )}
                </button>
              </div>
            </motion.div>
            ))}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText size={40} className="text-gray-300 mb-2" />
            <p className="text-gray-500">No favorite document found</p>
          </div>
        )}
      </div>

      {/* Pagination Controls - Exact same UI as the image */}
      {openTasks.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg mt-0 border-t border-gray-200">
          {/* Left side - Showing X to Y of Z results */}
          <div className="flex-1 text-sm text-gray-700">
            Showing {startItem} to {endItem} of {openTasks.length} results
          </div>
          
          {/* Center - Navigation controls */}
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
              Page {pagination.pageIndex + 1} of {totalPages}
              </span>
            
            <button
              className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handlePaginationChange({
                ...pagination,
                pageIndex: pagination.pageIndex + 1
              })}
              disabled={pagination.pageIndex >= totalPages - 1 || isLoading}
            >
              Next
            </button>
            </div>
          
          {/* Right side - Show X dropdown */}
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
              <option value={4}>4</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default FavouriteDocuments;
