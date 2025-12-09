import React, { useState } from 'react';
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';

const WorkflowApprovalModal = ({ 
  isOpen, 
  onClose, 
  approvalConfig, 
  workflowInstanceId, 
  nodeInstanceId,
  approvalId,
  onDecision 
}) => {
  const [decision, setDecision] = useState('');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!decision) {
      toast.error('Please select a decision');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/workflow/webhook`,
        {
          workflowInstanceId,
          approvalDecision: {
            approvalId,
            decision,
            comments
          }
        }
      );

      if (response.data.success) {
        toast.success(`Approval ${decision} successfully`);
        onDecision && onDecision(decision, comments);
        onClose();
        // Reset form
        setDecision('');
        setComments('');
      } else {
        toast.error('Failed to submit approval decision');
      }
    } catch (error) {
      console.error('Error submitting approval:', error);
      toast.error('Error submitting approval decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setDecision('');
    setComments('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {approvalConfig?.title || 'Approval Required'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {approvalConfig?.description && (
          <div className="mb-6 p-4 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">{approvalConfig.description}</p>
          </div>
        )}

        {approvalConfig?.approver && (
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-700">
              <strong>Assigned to:</strong> {approvalConfig.approver.name || approvalConfig.approver.email}
            </p>
            {approvalConfig.dueDate && (
              <p className="text-sm text-gray-700 mt-1">
                <strong>Due by:</strong> {new Date(approvalConfig.dueDate).toLocaleDateString()}
              </p>
            )}
            {approvalConfig.priority && (
              <p className="text-sm text-gray-700 mt-1">
                <strong>Priority:</strong> 
                <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                  approvalConfig.priority === 'high' ? 'bg-red-100 text-red-800' :
                  approvalConfig.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {approvalConfig.priority}
                </span>
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Decision <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <label className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-green-50 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="approved"
                  checked={decision === 'approved'}
                  onChange={(e) => setDecision(e.target.value)}
                  className="mr-3"
                />
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  <span className="font-medium text-green-700">Approve</span>
                </div>
              </label>
              
              <label className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-red-50 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="rejected"
                  checked={decision === 'rejected'}
                  onChange={(e) => setDecision(e.target.value)}
                  className="mr-3"
                />
                <div className="flex items-center">
                  <XCircle className="w-5 h-5 text-red-500 mr-2" />
                  <span className="font-medium text-red-700">Reject</span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments (Optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any comments about your decision..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!decision || isSubmitting}
              className={`px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                decision === 'approved' 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : decision === 'rejected'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-gray-400'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  {decision === 'approved' && <CheckCircle className="w-4 h-4" />}
                  {decision === 'rejected' && <XCircle className="w-4 h-4" />}
                  {decision ? `${decision.charAt(0).toUpperCase() + decision.slice(1)}` : 'Submit'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkflowApprovalModal; 