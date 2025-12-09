import React, { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from './ui/badge';
import { toast } from 'react-toastify';
import axios from 'axios';
import {IFeedback} from '../pages/FeedbackManagement';


type FeedbackStatus = 'pending' | 'approved' | 'rejected' | 'completed' ;

interface FeedbackDrawerProps {
  feedback: IFeedback | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (feedbackId: string, status: 'approved' | 'rejected' | 'pending' | 'completed') => void;
  isPlatformAdmin?: boolean;
  // setTaskId: (taskId: string) => void;
  setSelectedFeedback: React.Dispatch<React.SetStateAction<IFeedback | null>>
}

const FeedbackDrawer: React.FC<FeedbackDrawerProps> = ({
  feedback: initialFeedback,  // rename prop to initialFeedback
  isOpen,
  onClose,
  onStatusChange,
  isPlatformAdmin,
  setSelectedFeedback
}) => {
  // Add local state to track feedback
  const [feedback, setFeedback] = useState<IFeedback | null>(initialFeedback);
  // const [taskId, setTaskId] = useState(null);
  const [codegenStatus, setCodegenStatus] = useState<string | null>(null);


  // Update local state when prop changes
  useEffect(() => {
    setFeedback(initialFeedback);
  }, [initialFeedback]);

  // Wrap the status change handler
  const handleStatusChange = async (feedbackId: string, newStatus: FeedbackStatus) => {
    try {
      await onStatusChange?.(feedbackId, newStatus);
      // Update local state after successful change
      setFeedback(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Define checkCodegenStatus first
  const checkCodegenStatus = useCallback(async (currentTaskId: string, feedbackId: string) => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/codegen/status/${currentTaskId}?feedbackId=${feedbackId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.data;
      if (data.status === 'COMPLETE') {
        // Remove from localStorage
        const inProgressFeedbacks = JSON.parse(localStorage.getItem('inProgressCodegen') || '{}');
        delete inProgressFeedbacks[feedbackId];
        localStorage.setItem('inProgressCodegen', JSON.stringify(inProgressFeedbacks));

        // Refresh feedback data to get updated PR link
        const updatedFeedback = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/feedback/get-feedback-details-by-id/${feedbackId}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        ).then(res => res.data);

        setSelectedFeedback(updatedFeedback.feedback);
        setCodegenStatus(null); // Reset status when complete
        // setTaskId(null); // Reset taskId when complete
      }
      else {
        setCodegenStatus(data.status);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }, [feedback]);

  useEffect(() => {
    setCodegenStatus(null);
    // setTaskId(null);
  }, [feedback]);

  // Then use it in useEffect
  useEffect(() => {
    let statusInterval: NodeJS.Timeout | null = null;
    if (feedback) {
      const inProgressFeedbacks = JSON.parse(localStorage.getItem('inProgressCodegen') || '{}');
      if (inProgressFeedbacks[feedback.id] && feedback.status != 'pr ready') {
        // Only start if no PR link

        // setTaskId(inProgressFeedbacks[feedback.id]);
        setCodegenStatus('ACTIVE');

        // Initial check
        checkCodegenStatus(inProgressFeedbacks[feedback.id], feedback.id);

        // Set up interval for continuous checking
        statusInterval = setInterval(() => {
          if (codegenStatus !== 'COMPLETE') { // Only continue if not complete
            checkCodegenStatus(inProgressFeedbacks[feedback.id], feedback.id);
          }
          else {
            // clear the interval when complete
            if (statusInterval) {
              clearInterval(statusInterval);
            }
          }
        }, 5000);
      }
    }

    // // Cleanup interval when component unmounts or feedback changes
    return () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [feedback, checkCodegenStatus, codegenStatus]);

  const renderAttachment = (feedback: IFeedback) => {
    if (!feedback.attachment) return null;

    const fileUrl = `${import.meta.env.VITE_API_BASE_URL}/files/${feedback.attachment}`;

    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Attachment</h4>
        <div className="relative group">
          <img
            src={fileUrl}
            alt={feedback.attachment_original_name || "Feedback attachment"}
            className="max-w-full rounded-lg border border-gray-200 dark:border-gray-700"
          />
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200"
          >
            <div className="opacity-0 group-hover:opacity-100 bg-white dark:bg-gray-800 px-3 py-2 rounded-md shadow-lg">
              <span className="text-sm font-medium">View Full Size</span>
            </div>
          </a>
        </div>
        {feedback.attachment_original_name && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {feedback.attachment_original_name}
          </p>
        )}
      </div>
    );
  };

  const startCodegen = async () => {

    try {
      const token = localStorage.getItem('token');
      if (!feedback) return toast.error('No feedback selected');
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/codegen/start`,
        { feedback: feedback },
        {
          headers: { Authorization: `Bearer ${token}` }
        },
      );

      const data = await response.data;
      // setTaskId(data.taskId);
      setCodegenStatus('ACTIVE');

      // Store in localStorage
      const inProgressFeedbacks = JSON.parse(localStorage.getItem('inProgressCodegen') || '{}');
      inProgressFeedbacks[feedback.id] = data.taskId;
      localStorage.setItem('inProgressCodegen', JSON.stringify(inProgressFeedbacks));
    } catch (error) {
      console.error('Error starting codegen:', error);
      toast.error('Failed to start code generation');
    }
  };


  const renderCodegenButton = () => {
    if (!feedback) return null;

    if (feedback.status === 'pr ready') {
      return (
        <a
          href={feedback.pr_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex cursor-pointer items-center text-blue-600 hover:underline"
        >
          Show PR <ExternalLink className="ml-1 w-4 h-4" />
        </a>)

    }

    if (codegenStatus === 'ACTIVE') {
      return (
        <div className="mt-4 flex items-center gap-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-b-transparent" />
          <span>Generating code...</span>
        </div>
      );
    }
    if (feedback.status === 'approved') {
      return (
        <button
          onClick={startCodegen}
          className="mt-4 px-4 py-2 bg-violet-100 text-violet-800 rounded-md 
                       hover:bg-violet-200 transition-colors flex items-center gap-2"
        >
          <Code className="w-4 h-4" />
          Code for me
        </button>
      );
    }
  };


  if (!feedback) return null;


  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl z-50 overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Feedback Details</h2>
                <p className='text-gray-500 text-xs'>Id: {feedback.id}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${feedback.user_avatar}`}
                    alt={feedback.user_name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <h3 className="font-semibold">{feedback.user_name}</h3>
                    <p className="text-sm text-gray-500">{feedback.user_email}</p>
                    {isPlatformAdmin && (
                      <p className="text-xs text-gray-400">{feedback.company_name}</p>
                    )}
                  </div>
                </div>
                <div className='flex items-center gap-3 mb-4'>
                  {/* {feedback.status === 'pr ready' && (
                    <a
                      href={feedback.pr_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:underline"
                    >
                      Show PR <ExternalLink className="ml-1 w-4 h-4" />
                    </a>)} */}
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Subject</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{feedback.subject}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Details</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{feedback.details}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Page URL</h4>
                    <a
                      href={feedback.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {feedback.url}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {isPlatformAdmin && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-2">Update Status</h4>
                    <select
                      value={feedback.status}
                      onChange={(e) => handleStatusChange(feedback.id, e.target.value as FeedbackStatus)}
                      className="block w-full px-3 py-2 text-sm border rounded-md 
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="completed">Completed</option>
                      <option value="pr ready">Pr ready</option>
                    </select>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Current Status</h4>
                    <Badge variant={
                      feedback.status === 'approved' ? 'success' :
                        feedback.status === 'rejected' ? 'destructive' :
                          feedback.status === 'completed' ? 'outline' : 'default'
                    }>
                      {feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1)}
                    </Badge>
                  </div>
                  {renderCodegenButton()}

                </div>
                {renderAttachment(feedback)}

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FeedbackDrawer;


