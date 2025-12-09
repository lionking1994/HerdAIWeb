import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, MessageSquare, Clock, ChevronRight, ChevronLeft, ChevronRightIcon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

interface Feedback {
  id: number;
  subject: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  attachment?: string;
  attachment_file?: boolean;
  attachment_original_name?: string;
  created_at: string;
  date_time: string;
  user_name: string;
  user_email: string;
  user_avatar: string;
}

interface User {
  role: 'padmin' | 'dev' | string;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

interface FeedbackDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFeedback: Feedback | null;
  setSelectedFeedback: React.Dispatch<React.SetStateAction<Feedback | null>>;
  user: User | null;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data: Feedback[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

const slideVariants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: { type: "spring", damping: 25, stiffness: 200 } },
  exit: { x: '100%', transition: { type: "spring", damping: 25, stiffness: 200 } }
};

export default function FeedbackDrawer({ 
  isOpen, 
  onClose, 
  selectedFeedback, 
  setSelectedFeedback, 
  user 
}: FeedbackDrawerProps) {
  const location = useLocation();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    per_page: 5,
    total: 0,
    total_pages: 0
  });

  const fetchFeedbacks = async (page: number = 1): Promise<void> => {
    setIsLoading(true);
    try {
      const currentPath = window.location.pathname;
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/feedback/all?page=${page}&per_page=${pagination.per_page}&path=${currentPath}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data: ApiResponse = await response.json();
      setFeedbacks(data.data);
      setPagination({
        page: data.page,
        per_page: data.per_page,
        total: data.total,
        total_pages: data.total_pages
      });
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFeedbacks();
    }
  }, [isOpen, location.pathname]);

  const handlePageChange = (newPage: number): void => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      fetchFeedbacks(newPage);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleStatusUpdate = async (feedbackId: number, newStatus: Feedback['status']): Promise<void> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/feedback/update-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ feedbackId, status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        setFeedbacks(feedbacks.map(feedback =>
          feedback.id === feedbackId
            ? { ...feedback, status: newStatus }
            : feedback
        ));

        if (selectedFeedback?.id === feedbackId) {
          setSelectedFeedback(prev => prev ? { ...prev, status: newStatus } : null);
        }

        toast.success(`Status updated to ${newStatus}`);
      } else {
        throw new Error(data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update feedback status');
    }
  };

  const getStatusBadgeColor = (status: Feedback['status']): string => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const renderStatusActions = (feedback: Feedback): JSX.Element | null => {
    if (user?.role === 'padmin' && feedback.status === 'pending') {
      return (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => handleStatusUpdate(feedback.id, 'approved')}
            className="px-4 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => handleStatusUpdate(feedback.id, 'rejected')}
            className="px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
          >
            Reject
          </button>
        </div>
      );
    }

    if (user?.role === 'dev' && feedback.status === 'approved') {
      return (
        <button
          onClick={() => handleStatusUpdate(feedback.id, 'completed')}
          className="px-4 py-2 mt-4 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors w-full"
        >
          Mark as Completed
        </button>
      );
    }

    return null;
  };

  const renderAttachment = (feedback: Feedback): JSX.Element | null => {
    if (!feedback.attachment) return null;

    const fileUrl = `${import.meta.env.VITE_API_BASE_URL}/files/${feedback.attachment}`;

    return (
      <div className="mt-4 mb-6">
        <div className="relative group">
          <img
            src={fileUrl}
            alt="feedback_image"
            className="max-w-full w-auto rounded-lg border border-gray-200 dark:border-gray-700"
          />
        </div>
      </div>
    );
  };

  const renderPagination = (): JSX.Element => (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={() => handlePageChange(pagination.page - 1)}
        disabled={pagination.page === 1}
        className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 
                 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 
                 dark:hover:bg-gray-700 rounded-md transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Page {pagination.page} of {pagination.total_pages}
      </span>
      <button
        onClick={() => handlePageChange(pagination.page + 1)}
        disabled={pagination.page === pagination.total_pages}
        className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 
                 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 
                 dark:hover:bg-gray-700 rounded-md transition-colors"
      >
        Next
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );


  const renderFeedbackList = () => (
      <motion.div
        key="list"
        initial={{ x: selectedFeedback ? '-100%' : 0 }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 flex flex-col"
      >
        <div className="flex items-center justify-between p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold dark:text-white">
            Feedback for {window.location.pathname}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-12 h-12 mb-2" />
              <p>No feedback yet for this page</p>
            </div>
          ) : (
            feedbacks.map(feedback => (
              <motion.div
                key={feedback.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedFeedback(feedback)}
                className="p-5 bg-white dark:bg-gray-800 rounded-xl mb-3 cursor-pointer 
                         hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200
                         border border-gray-100 dark:border-gray-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">{feedback.subject}</h3>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
                  {feedback.details}
                </p>
                {feedback.attachment_file && (
                  <div className="mb-3">
                    {/\.(jpg|jpeg|png|gif|webp)$/i.test(feedback.attachment) ? (
                      <div className="relative h-20 w-20 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                        <img
                          src={`${import.meta.env.VITE_API_BASE_URL}/files/${feedback.attachment}`}
                          alt={'feedback_image'}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs truncate">{feedback.attachment_original_name}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(feedback.created_at || new Date())}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(feedback.status)}`}>
                    {feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1)}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
        {!isLoading && feedbacks.length > 0 && renderPagination()}
      </motion.div>
    );

const renderFeedbackDetail = () => (
    <motion.div
      key="detail"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="h-full bg-white dark:bg-gray-900 flex flex-col"
    >
      <div className="flex items-center justify-between p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedFeedback(null)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          <h2 className="text-xl font-semibold dark:text-white">Feedback Detail</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {selectedFeedback && (
        <div className="p-6 h-full overflow-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${selectedFeedback.user_avatar}`}
                  alt={selectedFeedback.user_name}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <h4 className="font-medium dark:text-white">{selectedFeedback.user_name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedFeedback.user_email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                <Clock className="w-4 h-4" />
                <span>{formatDate(selectedFeedback.date_time)}</span>
              </div>
            </div>
          </div>
          <div className="w-full justify-between items-center mb-6 flex">
            <h3 className="text-xl font-semibold dark:text-white">
              {selectedFeedback.subject}
            </h3>

            <span className={`px-3 py-1 rounded-full ${getStatusBadgeColor(selectedFeedback.status)}`}>
              {selectedFeedback.status.charAt(0).toUpperCase() + selectedFeedback.status.slice(1)}
            </span>
          </div>
          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {selectedFeedback.details}
            </p>
            {renderStatusActions(selectedFeedback)}
            {renderAttachment(selectedFeedback)}
          </div>



        </div>
      )}
    </motion.div>
  );



  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />
          <motion.div
            variants={slideVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed right-0 top-0 h-screen w-screen max-w-md bg-gray-50 dark:bg-gray-900 
                     shadow-2xl z-50 overflow-hidden border-l border-gray-200 dark:border-gray-700"
          >
            <AnimatePresence mode="wait">
              {selectedFeedback ? renderFeedbackDetail() : renderFeedbackList()}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}