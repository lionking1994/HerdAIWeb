import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from "react-redux";
import axios from 'axios';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CompanyAnalysisGraph from '../components/CompanyAnalysisGraph';
import { FormNode, AgentNode, ApprovalNode, CrmApprovalNode, GenericNode, TriggerNode } from '../components/WorkflowNodes';
import { loginSuccess, loginFailure } from "../store/slices/authSlice";
import './ApprovalPage.css';

const CrmApprovalPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  
  const approveInstanceId = searchParams.get('id');
  const dispatch = useDispatch();
  
  const [activeTab, setActiveTab] = useState('company-details');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproval, setIsApproval] = useState('');
  const [nodeInstances, setNodeInstances] = useState([]);

  useEffect(() => {
    if (!approveInstanceId) {
      setError('Missing workflow instance ID');
      setIsLoading(false);
      return;
    }

    fetchWorkflowData();
  }, [approveInstanceId]);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const userData = await response.json();
        dispatch(loginSuccess(userData));
      } else if (response.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      dispatch(loginFailure(error.message));
    }
  };

  useEffect(() => {
    if (!user) {
      fetchUserData();
    }
  }, []);

  const fetchWorkflowData = async () => {
    try {
      // For testing purposes, use sample data
      // In production, this would be an API call
      const token = localStorage.getItem('token');
      
      // // Simulate API delay
      // await new Promise(resolve => setTimeout(resolve, 1000));
      
      // // Use sample data for now
      // setWorkflowData(sampleWorkflowData);
      
      // Uncomment this for real API integration:
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/workflow/approval/${approveInstanceId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setWorkflowData(response.data.workflow);
        // Set node instances for dynamic tabs
        if (response.data.workflow.nodeInstances) {
          setNodeInstances(response.data.workflow.nodeInstances);
          // Set first node as active tab if available and no legacy tabs are set
          if (response.data.workflow.nodeInstances.length > 0 && activeTab === 'company-details') {
            setActiveTab(`node-${response.data.workflow.nodeInstances[0].id}`);
          }
        }
      } else {
        setError('Failed to load workflow data');
      }
      
    } catch (error) {
      console.error('Error fetching workflow data:', error);
      setError('Error loading workflow data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproval = async (decision, approvalData = null, comments = '') => {
    setIsSubmitting(true);
    setIsApproval(decision);
    try {
      const token = localStorage.getItem('token');
      
      // Prepare the request payload
      let payload = {
        decision,
        comments
      };

      // Handle both old format (crmItems array) and new format (approvalData object)
      if (approvalData) {
        if (Array.isArray(approvalData)) {
          // Old format: approvalData is an array of selectedCrmItems
          payload.selectedCrmItems = approvalData;
        } else {
          // New format: approvalData is an object with selectedCrmItems and assignedSellers
          payload.selectedCrmItems = approvalData.selectedCrmItems || [];
          payload.assignedSellers = approvalData.assignedSellers || {};
        }
      }
      
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/workflow/instances/${approveInstanceId}/crm-approve`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        await fetchWorkflowData();
        toast.success(`Workflow ${decision} successfully`);
      } else {
        toast.error(response.data.error || `Failed to ${decision} workflow`);
      }
    } catch (error) {
      console.error('Error submitting CRM approval:', error);
      toast.error(`Error ${decision}ing workflow`);
    } finally {
      setIsSubmitting(false);
      setIsApproval('');
    }
  };

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

  // Debug log
  useEffect(() => {
    console.log("🤬🤬🤬 workflowData:", workflowData);
  }, [workflowData]);  

  const renderNodeComponent = (nodeInstance) => {
    const { node_type } = nodeInstance;
    
    switch (node_type) {
      case 'triggerNode':
        return <TriggerNode nodeInstance={nodeInstance} />;
      case 'formNode':
        return <FormNode nodeInstance={nodeInstance} />;
      case 'agentNode':
        return <AgentNode nodeInstance={nodeInstance} aiNodes={workflowData?.aiGeneratedNodes}/>;
      case 'approvalNode':
        return <ApprovalNode nodeInstance={nodeInstance} onApproval={handleApproval} isSubmitting={isSubmitting} isApproval={isApproval} />;
      case 'crmApprovalNode':
        return <CrmApprovalNode nodeInstance={nodeInstance} onApproval={handleApproval} isSubmitting={isSubmitting} isApproval={isApproval} />;
      default:
        return <GenericNode nodeInstance={nodeInstance} />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar isAuthenticated={true} user={user} />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar isAuthenticated={true} user={user} />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-500 mb-4">{error}</div>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar isAuthenticated={true} user={user} />

      <div className="flex-grow container mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Workflow: {workflowData?.workflow?.title || 'CRM Approval Workflow'}
              </h1>
              <p className="text-indigo-600 text-lg">- CRM Approval Required</p>
            </div>
            {approveInstanceId && (
              <button
                onClick={() => navigate(`/workflow-instance-history?instanceId=${workflowData?.workflow.id}`)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                View Instance History
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 overflow-x-auto">
            {/* <button
              onClick={() => setActiveTab('company-details')}
              className={`px-6 py-3 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'company-details'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-blue-200 hover:bg-gray-50'
              }`}
            >
              Company Details
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-6 py-3 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'insights'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-blue-200 hover:bg-gray-50'
              }`}
            >
              Insights
            </button>
            <button
              onClick={() => setActiveTab('workflow-history')}
              className={`px-6 py-3 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'workflow-history'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-blue-200 hover:bg-gray-50'
              }`}
            >
              Workflow History
            </button> */}
            
            {/* Dynamic node tabs */}
            {nodeInstances.map((nodeInstance) => (
              <button
                key={nodeInstance.id}
                onClick={() => setActiveTab(`node-${nodeInstance.id}`)}
                className={`px-6 py-3 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
                  activeTab === `node-${nodeInstance.id}`
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-indigo-200 hover:bg-gray-50'
                }`}
              >
                {nodeInstance.node_name || `${nodeInstance.node_type} Node`}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white border border-indigo-200 rounded-b-lg">
          {activeTab === 'company-details' && (
            <div className="p-6">
              <div className="space-y-4">
                {workflowData.forminfo && Object.keys(workflowData.forminfo).map(forminfo => (
                  <div key={forminfo} className="flex items-center space-x-3">
                    <span className="font-semibold text-gray-900">{forminfo}:</span>
                    <span className="text-gray-700">{workflowData.forminfo[forminfo]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'insights' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {`${workflowData?.insights?.companyAnalysis?.companyName || 'Unknown'}: Comprehensive Company Analysis`}
                </h3>
                <p className="text-sm text-gray-600">
                  {workflowData?.insights?.companyAnalysis?.subtitle || 'Interactive visualization of multinational technology company enabling 4th Industrial Revolution applications'}
                </p>
              </div>
              
              {/* Main Visualization Area */}
              <div className="lg:col-span-2">
                <CompanyAnalysisGraph companyData={workflowData?.insights?.companyAnalysis} />
              </div>
            </div>
          )}
          
          {activeTab === 'workflow-history' && (
            <div className="p-6">
              {/* Overall Approval Summary */}
              {workflowData?.approvalDetails && workflowData.approvalDetails.length > 0 && (
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <h3 className="text-lg font-semibold text-indigo-900 mb-3">Approval Summary</h3>
                  <div className="space-y-3">
                    {workflowData.approvalDetails.map((approval, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                            approval.decision === 'approved' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {approval.decision === 'approved' ? 'Approved' : 'Rejected'}
                          </span>
                          {approval.approver && (
                            <span className="text-gray-700">
                              by <span className="font-medium">{approval.approver.name}</span>
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            {formatDate(approval.timestamp)}
                          </div>
                          {approval.comments && (
                            <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                              "{approval.comments}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                {workflowData?.workflowHistory?.map((event, index) => (
                  <div key={event.id || index} className="flex items-start space-x-4">
                    <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                      event.type === 'approvalNode' && event.approvalInfo 
                        ? event.approvalInfo.decision === 'approved' 
                          ? 'bg-green-500' 
                          : event.approvalInfo.decision === 'reject' 
                            ? 'bg-red-500' 
                            : 'bg-indigo-600'
                        : 'bg-indigo-600'
                    }`}></div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {event.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        Date/Time: {formatDate(event.timestamp)}
                      </div>
                      {event.type === 'approvalNode' && event.approvalInfo && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              event.approvalInfo.decision === 'approved' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {event.approvalInfo.decision === 'approved' ? 'Approved' : 'Rejected'}
                            </span>
                            {event.approvalInfo.approverName && (
                              <span className="text-sm text-gray-600">
                                by {event.approvalInfo.approverName}
                            </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {event.type === 'approval_required' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApproval('approved')}
                          disabled={isSubmitting ||  workflowData?.node_instance?.status == "completed" || workflowData?.node_instance?.status == "failed"}
                          className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {(isSubmitting && isApproval == 'approved') ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleApproval('reject')}
                          disabled={isSubmitting || workflowData?.node_instance?.status == "completed" || workflowData?.node_instance?.status == "failed"}
                          className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {(isSubmitting && isApproval == 'reject') ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Show approval status if already processed */}
                {workflowData?.workflow?.status !== 'pending_approval' && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        workflowData.workflow.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="font-medium text-gray-900">
                        Workflow {workflowData.workflow.status}
                      </span>
                      {/* {workflowData.approval?.timestamp && (
                        <span className="text-sm text-gray-500">
                          - {formatDate(workflowData.approval.timestamp)}
                        </span>
                      )} */}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Dynamic Node Tabs */}
          {activeTab.startsWith('node-') && (() => {
            const nodeId = activeTab.replace('node-', '');
            const nodeInstance = nodeInstances.find(node => node.id.toString() === nodeId);
            return nodeInstance ? renderNodeComponent(nodeInstance) : (
              <div className="p-6">
                <div className="text-center text-gray-500">
                  <p>Node not found</p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CrmApprovalPage; 