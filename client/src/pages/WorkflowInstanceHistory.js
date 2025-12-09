import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import {
  Loader2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { loginSuccess, loginFailure } from "../store/slices/authSlice";
import "./WorkflowInstanceHistory.css";
import AvatarPop from "../components/AvatarPop";

const WorkflowInstanceHistory = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const instanceId = searchParams.get("instanceId");
  const dispatch = useDispatch();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workflowInstance, setWorkflowInstance] = useState(null);
  const [workflowHistory, setWorkflowHistory] = useState([]);

  useEffect(() => {
    if (!instanceId) {
      setError("Missing workflow instance ID");
      setIsLoading(false);
      return;
    }

    fetchWorkflowInstanceData();
  }, [instanceId]);

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

  const fetchWorkflowInstanceData = async () => {
    try {
      const token = localStorage.getItem("token");

      // For testing purposes, you can uncomment this to use sample data
      // if (instanceId === 'test') {
      //   setWorkflowInstance({
      //     id: 'test',
      //     workflow_name: 'Sample Workflow',
      //     status: 'completed',
      //     created_at: new Date().toISOString(),
      //     started_at: new Date(Date.now() - 3600000).toISOString(),
      //     completed_at: new Date().toISOString(),
      //     assigned_to: 'John Doe'
      //   });
      //   setWorkflowHistory([
      //     {
      //       id: 1,
      //       title: 'Form Submission',
      //       description: 'User submitted form data',
      //       status: 'completed',
      //       timestamp: new Date(Date.now() - 1800000).toISOString(),
      //       result: { formData: { name: 'Test Company', email: 'test@example.com' } }
      //     },
      //     {
      //       id: 2,
      //       title: 'AI Analysis',
      //       description: 'AI processed the submitted data',
      //       status: 'completed',
      //       timestamp: new Date(Date.now() - 900000).toISOString(),
      //       result: { analysis: 'Company analysis completed' }
      //     }
      //   ]);
      //   setIsLoading(false);
      //   return;
      // }

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/workflow/instances/${instanceId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setWorkflowInstance(response.data.workflowInstance);
        setWorkflowHistory(response.data.history || []);
      } else {
        setError(
          response.data.message || "Failed to load workflow instance data"
        );
      }
    } catch (error) {
      console.error("Error fetching workflow instance data:", error);
      setError("Error loading workflow instance data");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "pending":
      case "waiting_user_input":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "in_progress":
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
      case "waiting_user_input":
        return "bg-yellow-100 text-yellow-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Workflow Instance History
          </h1>
          <p className="text-gray-600">Instance ID: {instanceId}</p>
        </div>

        {/* Instance Overview */}
        {workflowInstance && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Instance Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Workflow Name
                </h3>
                <p className="text-lg font-medium text-gray-900">
                  {workflowInstance.workflow_name || "Unknown Workflow"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Status
                </h3>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(workflowInstance.status)}
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(
                      workflowInstance.status
                    )}`}
                  >
                    {workflowInstance.status}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Created
                </h3>
                <p className="text-lg font-medium text-gray-900">
                  {formatDate(workflowInstance.created_at)}
                </p>
              </div>
              {workflowInstance.started_at && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    Started
                  </h3>
                  <p className="text-lg font-medium text-gray-900">
                    {formatDate(workflowInstance.started_at)}
                  </p>
                </div>
              )}
              {workflowInstance.completed_at && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    Completed
                  </h3>
                  <p className="text-lg font-medium text-gray-900">
                    {formatDate(workflowInstance.completed_at)}
                  </p>
                </div>
              )}
              {workflowInstance.assigned_to && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    Assigned To
                  </h3>
                  <p className="text-lg font-medium text-gray-900">
                    {workflowInstance.assigned_to}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workflow History */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Execution History
          </h2>

          {workflowHistory.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No history available
              </h3>
              <p className="text-gray-600">
                No execution history has been recorded for this workflow
                instance.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {workflowHistory.map((event, index) => (
                <div
                  key={event.id || index}
                  className="flex items-start space-x-4"
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(event.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {event.title ||
                            event.node_name ||
                            `Step ${index + 1}`}
                        </h3>
                        {event.node_type === "approvalNode" &&
                          event.result.approverId && (
                            <AvatarPop id={event.result.approverId} />
                          )}
                      </div>
                      <span
                        className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(
                          event.status
                        )}`}
                      >
                        {event.status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                      {event.description || event.node_type || "Workflow step"}
                    </p>

                    <div className="text-sm text-gray-500">
                      {event.timestamp && (
                        <span>Executed: {formatDate(event.timestamp)}</span>
                      )}
                    </div>

                    {event.error_message && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">
                          <strong>Error:</strong> {event.error_message}
                        </p>
                      </div>
                    )}

                    {event.status === "waiting_user_input" &&
                      event.node_type === "formNode" && (
                        <div className="mt-3">
                          <button
                            onClick={() =>
                              navigate(
                                `/workflow-form?workflowInstanceId=${instanceId}&nodeInstanceId=${
                                  event.id || index
                                }&nodeId=${event.node_id || event.id || index}`
                              )
                            }
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
                          >
                            Complete Form
                          </button>
                        </div>
                      )}

                    {event.status === "waiting_user_input" &&
                      event.node_type === "approvalNode" && (
                        <div className="mt-3">
                          <button
                            onClick={() => navigate(`/approval?id=${event.id}`)}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200"
                          >
                            Review Approval
                          </button>
                        </div>
                      )}

                    {event.result && Object.keys(event.result).length > 0 && (
                      <div className="mt-3">
                        {event.result.result &&
                          (event.node_type === "pdfNode" ? (
                            <div className="mt-3 flex justify-center">
                              {/* Download Button */}
                              <button
                                onClick={() => {
                                  window.open(event.result.result, "_blank");
                                }}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 cursor-pointer"
                              >
                                Download PDF
                              </button>
                            </div>
                          ) : event.result.resultType === "image" ? (
                            <div className="mt-3 flex justify-center">
                              <img
                                src={event.result.result && event.result.result.includes('https') 
                                  ? event.result.result 
                                  : `${process.env.REACT_APP_API_URL}${event.result.result}`}
                                alt="Generated Image"
                                className="w-1/2 h-auto"
                              />
                            </div>
                          ) : null)}
                        {event.result.promptType == "prompt" &&
                          (event.result.resultType == "ppt" ? (
                            <div className="mt-3 flex justify-center">
                              {/* Download Button */}
                              <button
                                onClick={() => {
                                  window.open(
                                    `${process.env.REACT_APP_API_URL}${event.result.result}`,
                                    "_blank"
                                  );
                                }}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 cursor-pointer"
                              >
                                Download PPT
                              </button>
                            </div>
                          ) : event.result.resultType == "csv" ? (
                            <div className="mt-3 flex justify-center">
                              {/* Download Button */}
                              <button
                                onClick={() => {
                                  window.open(
                                    `${process.env.REACT_APP_API_URL}${event.result.result}`,
                                    "_blank"
                                  );
                                }}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 cursor-pointer"
                              >
                                Download CSV
                              </button>
                            </div>
                          ) : null)}
                        <details className="text-sm">
                          <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
                            View Results
                          </summary>
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(event.result, null, 2)}
                            </pre>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default WorkflowInstanceHistory;
