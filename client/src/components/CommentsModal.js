import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

const CommentsModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  decision, 
  isLoading = false 
}) => {
  const [comments, setComments] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!comments.trim()) {
      return; // Don't submit if comments are empty
    }
    onSubmit(comments);
  };

  const handleClose = () => {
    setComments('');
    onClose();
  };

  if (!isOpen) return null;

  const isApproval = decision === 'approved';
  const title = isApproval ? 'Approve Workflow' : 'Reject Workflow';
  const buttonText = isApproval ? 'Approve' : 'Reject';
  const buttonClass = isApproval 
    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        {/* Modal */}
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-lg">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {title}
                  </h3>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={isLoading}
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="mt-2">
                  <p className="text-sm text-gray-500 mb-4">
                    Please provide comments for your {decision} decision. This information will be recorded in the workflow history.
                  </p>
                  
                  <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                      <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-2">
                        Comments <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="comments"
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your comments here..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        disabled={isLoading || !comments.trim()}
                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${buttonClass}`}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          buttonText
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentsModal;
