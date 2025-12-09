import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import UserProfileDrawer from '../UserProfileDrawer';
import AvatarPop from '../AvatarPop';

const ApprovalNode = ({ nodeInstance, onApproval, isSubmitting = false, isApproval = '' }) => {
  const { result, status, node_name } = nodeInstance;
  const [approvedUser, setApprovedUser] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  useEffect(() => {
    const fetchApprovedUser = async () => {
      if (!result?.approverId) return;
      
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/users/get`,
          {
            method: 'POST',
            body: JSON.stringify({ userId: result.approverId }),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }
        );
        if (response.ok) {
          const userData = await response.json();
          console.log('Fetched approved user:', userData);
          setApprovedUser(userData.user);
        } else {
          console.error('Failed to fetch approved user:', response.status);
        }
      } catch (error) {
        console.error('Error fetching approved user:', error);
      }
    };
    
    fetchApprovedUser();
  }, [result?.approverId]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {node_name || 'Approval Required'}
        </h3>
        <p className="text-sm text-gray-600">
          Manual approval decision and workflow control
        </p>
      </div>
      
      {/* Approval Status */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${
            status === 'completed' 
              ? result?.decision === 'approved' ? 'bg-green-500' : 'bg-red-500'
              : 'bg-blue-500'
          }`}></div>
          <span className="font-medium text-gray-900">
            Status: {status === 'completed' ? 'Completed' : 'Pending'}
          </span>
        </div>
        
        {status === 'completed' && result && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                result.decision === 'approved' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {result.decision === 'approved' ? 'Approved' : 'Rejected'}
              </span>
              {result.approverName && (
                <span className="text-sm text-gray-600">
                  by {result.approverName}
                </span>
              )}
              {approvedUser && (
                <AvatarPop id={approvedUser.id} />
              )}
                                
            </div>
            {result.comments && (
              <div className="mt-2 p-2 bg-white rounded border-l-4 border-blue-200">
                <div className="text-sm text-gray-700">
                  <strong>Comments:</strong> {result.comments}
                </div>
              </div>
            )}
            {result.timestamp && (
              <div className="text-xs text-gray-500 mt-2">
                {formatDate(result.timestamp)}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Approval Actions - Only show if pending */}
      {status === 'waiting_user_input' && onApproval && (
        <div className="border-t pt-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Take Action</h4>
          <div className="flex space-x-3">
            <button
              onClick={() => onApproval('approved')}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {(isSubmitting && isApproval === 'approved') ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Approve</span>
              )}
            </button>
            <button
              onClick={() => onApproval('rejected')}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {(isSubmitting && isApproval === 'rejected') ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Reject</span>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Raw Data */}
      {/*result && (
        <div className="mt-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Approval Details</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )*/}
    </div>
  );
};

export default ApprovalNode;
