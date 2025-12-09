import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import "./MeetingDetail.css";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import Navbar from "../components/Navbar";
import TaskForm from "../components/TaskForm/TaskForm";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal/DeleteConfirmationModal";
import EditTaskModal from "../components/EditTaskModal/EditTaskModal";
import { loginSuccess, loginFailure } from "../store/slices/authSlice";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Notification from "../components/Notification";
import Footer from "../components/Footer";
import { Maximize2, Minimize2, Loader2 } from "lucide-react";
import { X } from "lucide-react";
import PromptModal from "../components/PromptModal/PromptModal";
import AvatarPop from "../components/AvatarPop"
import UserProfileDrawer from "../components/UserProfileDrawer";
import "../components/ScoreAnalysisModal/ScoreAnalysisModal.css";
import {
  PieChart,
  LineChart,
  BarChart,
  ResponsiveContainer,
  Pie,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  Line,
} from "recharts";
import ExpandableChart from "../components/ExpandableChart";
import { blendColors, darkenColor } from "../utils/colorUtils";
import InteractiveNodeGraph from "../components/InteractiveNodeGraph";

// Similar Tasks Modal Component
const SimilarTasksModal = ({ isOpen, onClose, similarTasks, isLoading }) => {
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  if (!isOpen) return null;
  const handleAssigneeClick = (e, assignee) => {
    e.stopPropagation(); // Prevent navigation to task details
    setSelectedUser(assignee);
    setShowUserProfile(true);
  };
  const closeUserProfile = () => {
    setShowUserProfile(false);
    setSelectedUser(null);
  };
  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Similar Tasks</h2>
            <button
              onClick={onClose}
              className="close-button"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>
          <div className="modal-body">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Finding similar tasks...</span>
              </div>
            ) : similarTasks?.length > 0 ? (
              <div className="space-y-4">
                <p className="text-gray-600 mb-4">Found {similarTasks?.length} similar tasks:</p>
                {similarTasks.map((task, index) => (
                  <div onClick={() => navigate(`/task-details?id=${task.id}`)} key={task.id || index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-blue-500 underline flex-1">{task.title}</h3>
                      {task.similarity && (
                        <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                          {task.similarity}% match
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{task.description}</p>
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      {task.priority && (
                        <span className={`px-2 py-1 rounded-full text-white ${task.priority === 'High' ? 'bg-red-500' :
                          task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}>
                          {task.priority}
                        </span>
                      )}
                      {task.status && (
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                          {task.status}
                        </span>
                      )}
                      {task.rate && (
                        <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                          Rating: {task.rate}/5
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs mb-2">
                      {task.assigneeName && (
                        <button
                          onClick={(e) => handleAssigneeClick(e, {
                            id: task.assigneeId,
                            name: task.assigneeName,
                            email: task.assigneeEmail,
                            bio: task.assigneeBio,
                            avatar: task.assigneeAvatar,
                            phone: task.assigneePhone,
                            location: task.assigneeLocation
                          })}
                          className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                          Assigned to: {task.assigneeName}
                        </button>
                      )}
                      {task.companyName && (
                        <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-800">
                          {task.companyName}
                        </span>
                      )}
                    </div>
                    {task.meetingTitle && (
                      <p className="text-xs text-gray-500 mt-2">From: {task.meetingTitle}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500">
                <i className="fas fa-search text-3xl mb-4"></i>
                <p>No similar tasks found</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* User Profile Drawer */}
      {showUserProfile && selectedUser && (
        <UserProfileDrawer
          user={selectedUser}
          isOpen={showUserProfile}
          onClose={closeUserProfile}
        />
      )}
    </>
  );
};
const AnalyticsCharts = ({ meeting }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];
  // Comment out or remove the actual API call for now
  useEffect(() => {
    const fetchAnalytics = async () => {
      console.log("MeetingAnalytics function is called");
      setIsLoadingAnalytics(true);
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/meeting/meeting-analytics`,
          {
            meetingId: meeting.id,
          },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        console.log(response);
        if (response.data.success) {
          setAnalyticsData(response.data.data);
        }
      } catch (error) {
        toast.error(`Failed to fetch analytics`, {
          autoClose: 5000,
          position: "top-right",
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        console.error("Error fetching analytics:", error);
      } finally {
        setIsLoadingAnalytics(false);
      }
    };
    fetchAnalytics();
  }, [meeting.id]);
  if (isLoadingAnalytics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded-lg shadow-md">
            {/* Header Skeleton */}
            <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-3">
              <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
              <div className="flex gap-2">
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
            {/* Chart Skeleton */}
            <div className="relative h-[300px] flex items-center justify-center">
              {i === 1 && (
                // Pie Chart Skeleton
                <div className="w-48 h-48 rounded-full bg-gray-200 animate-pulse mx-auto"></div>
              )}
              {i === 2 && (
                // Bar Chart Skeleton
                <div className="w-full h-48 flex items-end justify-between gap-2 px-4">
                  {[1, 2, 3, 4].map((bar) => (
                    <div
                      key={bar}
                      className="w-1/5 bg-gray-200 animate-pulse"
                      style={{ height: `${Math.random() * 60 + 20}%` }}
                    ></div>
                  ))}
                </div>
              )}
              {i === 3 && (
                // Line Chart Skeleton
                <div className="w-full h-48 flex items-end relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-[2px] bg-gray-200 animate-pulse"></div>
                  </div>
                  <div
                    className="absolute inset-0 flex items-center"
                    style={{ top: "25%" }}
                  >
                    <div className="w-full h-[2px] bg-gray-200 animate-pulse"></div>
                  </div>
                  <div
                    className="absolute inset-0 flex items-center"
                    style={{ top: "75%" }}
                  >
                    <div className="w-full h-[2px] bg-gray-200 animate-pulse"></div>
                  </div>
                </div>
              )}
              {i === 4 && (
                // Stacked Bar Chart Skeleton
                <div className="w-full h-48 flex items-end justify-between gap-2 px-4">
                  {[1, 2, 3, 4].map((stack) => (
                    <div key={stack} className="w-1/5 flex flex-col gap-[1px]">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className="w-full bg-gray-200 animate-pulse"
                          style={{ height: `${Math.random() * 20 + 10}%` }}
                        ></div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Legend Skeleton */}
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {[1, 2, 3, 4].map((legend) => (
                <div key={legend} className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (
    !analyticsData ||
    !analyticsData.talkTime ||
    !analyticsData.speakerSentiment ||
    !analyticsData.sentimentOverTime ||
    !analyticsData.dominance
  )
    return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <ExpandableChart
        analyticsData={analyticsData.talkTime}
        title="Talk Time Distribution"
      >
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analyticsData.talkTime}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(0)}%)`
              }
            >
              {analyticsData.talkTime && analyticsData.talkTime.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${Math.round(value)}s`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ExpandableChart>
      <ExpandableChart
        analyticsData={analyticsData.speakerSentiment}
        title="Speaker Sentiment Analysis"
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.speakerSentiment}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[-1, 1]} />
            <Tooltip
              formatter={(value) => value.toFixed(2)}
              labelStyle={{ color: "#111827" }}
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            />
            <Bar dataKey="value">
              {analyticsData.speakerSentiment && analyticsData.speakerSentiment.map((entry, index) => {
                // Base color from the COLORS array
                const baseColor = COLORS[index % COLORS.length];
                // Calculate the color based on sentiment
                let color;
                color = blendColors(
                  baseColor,
                  "#4CAF50",
                  index / analyticsData.speakerSentiment.length
                );
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    stroke={darkenColor(color, 0.1)}
                    strokeWidth={1}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ExpandableChart>
      <ExpandableChart
        analyticsData={analyticsData.sentimentOverTime}
        title="Sentiment Over Time"
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analyticsData.sentimentOverTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timeBlock" />
            <YAxis domain={[-1, 1]} />
            <Tooltip />
            <Legend />
            {analyticsData.sentimentOverTime && Object.keys(analyticsData.sentimentOverTime[0])
              .filter((key) => key !== "timeBlock")
              .map((speaker, index) => (
                <Line
                  key={speaker}
                  type="monotone"
                  dataKey={speaker}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </ExpandableChart>
      <ExpandableChart
        analyticsData={analyticsData.dominance}
        title="Activity Dominance"
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.dominance}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timeBlock" />
            <YAxis domain={[0, 100]} />
            <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
            <Legend />
            {analyticsData.dominance && Object.keys(analyticsData.dominance[0])
              .filter((key) => key !== "timeBlock")
              .map((speaker, index) => (
                <Bar
                  key={speaker}
                  dataKey={speaker}
                  stackId="a"
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
          </BarChart>
        </ResponsiveContainer>
      </ExpandableChart>
    </div>
  );
};
const AI_MODELS = {
  claude: {
    name: "Claude",
    models: [{ id: "claude", name: "Claude" }],
  },
  perplexity: {
    name: "Perplexity",
    models: [
      { id: "sonar-pro", name: "Sonar-Reasoning" },
      { id: "sonar-deep-research", name: "Sonar Deep Research" },
    ],
  },
};
const MeetingDetail = () => {
  const [meeting, setMeeting] = useState(null);
  const { user } = useSelector((state) => state.auth);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const id = searchParams.get("id");
  const tab = searchParams.get("tab");
  const [isTranscriptionExpanded, setIsTranscriptionExpanded] = useState(false);
  const [notification, setNotification] = useState(null);
  const [transcriptionContent, setTranscriptionContent] = useState("");
  const [presignedVideoUrl, setPresignedVideoUrl] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTranscription, setEditedTranscription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [activeTab, setActiveTab] = useState(!!tab ? tab : "details");
  const [showIntelligenceGraph, setShowIntelligenceGraph] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [assigneeExistingSearch, setAssigneeExistingSearch] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [isAddingNewUser, setIsAddingNewUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [filteredParticipants, setFilteredParticipants] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [selectedExistingUsers, setSelectedExistingUsers] = useState([]);
  const [isDeleteMeetingModalOpen, setIsDeleteMeetingModalOpen] = useState(false);
  const [isSearchGlobal, setIsSearchGlobal] = useState(false);
  const [assigneeName, setAssigneeName] = useState("");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [transcriptionSearch, setTranscriptionSearch] = useState("");
  const [highlightedContent, setHighlightedContent] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [addingUserForm, setAddingUserForm] = useState({});
  const [isGeneratingScore, setIsGeneratingScore] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreAnalysis, setScoreAnalysis] = useState(null);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptContent, setPromptContent] = useState("");
  const [selectedModel, setSelectedModel] = useState(""); // default to claude
  const [maxTokens, setMaxTokens] = useState(300); // Default value of 300
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [aiModels, setAiModels] = useState({});
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewSuccess, setIsPreviewSuccess] = useState(false);
  const [promptEndpoint, setPromptEndpoint] = useState("summary");
  const [promptSource, setPromptSource] = useState(null); // Store prompt source information
  const [isRemoveParticipantModalOpen, setIsRemoveParticipantModalOpen] = useState(false);
  const [participantToRemove, setParticipantToRemove] = useState(null);
  const [similarTasks, setSimilarTasks] = useState([]);
  const [isFetchingSimilarTasks, setIsFetchingSimilarTasks] = useState(false);
  const [showSimilarTasksModal, setShowSimilarTasksModal] = useState(false);
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [isProcessingImpactRatings, setIsProcessingImpactRatings] = useState(false);



  const dispatch = useDispatch();
  const navigate = useNavigate();
  console.log(tab);
  useEffect(() => {
    if (!user) {
      fetchUserData();
    }
    const fetchAIModels = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/meeting/api_settings`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.data.success) {
          const modelsByProvider = response.data.apiConfigs.reduce(
            (acc, config) => {
              acc[config.provider] = {
                name: config.name,
                models: config.models || [],
              };
              return acc;
            },
            {}
          );
          setAiModels(modelsByProvider);
        }
      } catch (error) {
        toast.error(`Failed to fetch AI models`, {
          autoClose: 5000,
          position: "top-right",
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        console.error("Error fetching AI models:", error);
      }
    };
    fetchAIModels();
  }, []);
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
  const fetchMeetingDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      console.log(id);
      const { data } = await axios.get(
        `${process.env.REACT_APP_API_URL}/meeting/meeting_details`,
        {
          params: { meetingId: id, similarTasks: true },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(data);
      if (data.success) {
        setMeeting(data.meeting);
        if (data.meeting.tasks) {
          setTasks(data.meeting.tasks);
        }
      } else {
        if (data.statusCode === 401) {
          navigate("/unauthorized");
        }
        // setNotification({
        //   type: "error",
        //   message: data.message,
        // });
        else navigate("/404");
      }
    } catch (error) {
      toast.error(`Failed to fetch meeting details`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error fetching meeting details:", error);
      if (error.response?.status === 401) {
        navigate("/unauthorized");
      } else {
        navigate("/404");
      }
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (!id) {
      console.log("ID is undefined, not fetching meeting details");
      return;
    }
    fetchMeetingDetails();
  }, [id]);
  useEffect(() => {
    // if (meeting?.transcription_link && meeting?.platform !== "teams") {
    //   console.log("meeting", meeting?.platform);
    //   const fetchTranscription = async () => {
    //     try {
    //       const token = localStorage.getItem("token");
    //       const response = await axios.get(
    //         `${process.env.REACT_APP_API_URL}/meeting/get-file-url`,
    //         {
    //           params: { videoKey: meeting.transcription_link, type: "json" },
    //           headers: { Authorization: `Bearer ${token}` },
    //         }
    //       );
    //       console.log("response", response.data);
    //       // Response now contains the JSON content directly
    //       console.log("transcription response:", response.data);
    //       setTranscriptionContent(response.data || " ");
    //     } catch (error) {
    //       console.error("Error fetching transcription:", error);
    //       setTranscriptionContent(" ");
    //     }
    //   };
    //   fetchTranscription();
    // } else
    if (meeting?.transcription_link) {
      //&& meeting?.platform === "teams"
      setTranscriptionContent(meeting.transcription_link);
    } else {
      setTranscriptionContent(" ");
    }
  }, [meeting]);
  useEffect(() => {
    if (meeting?.record_link) {
      const fetchPresignedUrl = async () => {
        try {
          const token = localStorage.getItem("token");
          const response = await axios.get(
            `${process.env.REACT_APP_API_URL}/meeting/get-file-url`,
            {
              params: { videoKey: meeting.record_link },
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setPresignedVideoUrl(response.data.url);
        } catch (error) {
          toast.error(`Failed to fetch video URL`, {
            autoClose: 5000,
            position: "top-right",
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
          });
          console.error("Error fetching video URL:", error);
        }
      };
      fetchPresignedUrl();
    }
  }, [meeting]);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollButton(window.pageYOffset > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleSaveTranscription = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem("token");
      await axios.post(
        `${process.env.REACT_APP_API_URL}/meeting/update-transcription`,
        {
          meetingId: id,
          transcription: editedTranscription,
          transcriptionKey: meeting.transcription_link,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Transcription saved successfully");
      setTranscriptionContent(editedTranscription);
      setIsEditMode(false);
    } catch (error) {
      toast.error(`Failed to save transcription`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error saving transcription:", error);
    } finally {
      setIsSaving(false);
    }
  };
  const handleRemoveParticipantClick = (participant) => {
    setParticipantToRemove(participant);
    setIsRemoveParticipantModalOpen(true);
  };
  const confirmRemoveParticipant = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/meeting/remove_participant`,
        {
          meetingId: id,
          userId: participantToRemove.id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        // Update the meeting state by removing the participant
        setMeeting({
          ...meeting,
          participants: meeting.participants.filter(
            (participant) => participant.id !== participantToRemove.id
          ),
        });
        setNotification({
          type: "success",
          message: "Participant removed successfully",
        });
      }
    } catch (error) {
      toast.error(`Failed to remove participant`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error removing participant:", error);
      setNotification({
        type: "error",
        message: "Failed to remove participant",
      });
    } finally {
      // Close the modal and reset the participant to remove
      setIsRemoveParticipantModalOpen(false);
      setParticipantToRemove(null);
    }
  };
  const handleGenerateTasks = async () => {
    try {
      setIsGeneratingTasks(true);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/generate-tasks`,
        {
          transcription: transcriptionContent,
          meetingId: id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setTasks(response.data.tasks);
      toast.success("Tasks generated successfully");
    } catch (error) {
      toast.error(`Failed to generate tasks`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error generating tasks:", error);
    } finally {
      setIsGeneratingTasks(false);
    }
  };
  const handleEditTask = async (task) => {
    setEditingTask({ ...task });
    setAssigneeName(await getAssignedNameFromId(task.assigned_id));
    setIsEditModalOpen(true);
  };
  const handleSaveTask = async () => {
    try {
      setIsUpdatingTask(true);
      const token = localStorage.getItem("token");
      const payload = {
        taskId: editingTask.id,
        meetingId: id,
        ...editingTask,
      };
      if (payload.status !== "Pending" || payload.status !== "Assigned")
        payload.status = undefined;
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/tasks/update`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const updatedTask = response.data.task;
      // Find the old task
      const oldTask = tasks.find((t) => t.id === editingTask.id);
      // Update the tasks list with the edited task
      setTasks(
        tasks.map((task) =>
          task.id === editingTask.id
            ? {
              ...task,
              ...updatedTask,
              assigned_name:
                updatedTask.assigned_name || task.assigned_name,
            }
            : task
        )
      );
      setIsEditModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      toast.error(`Failed to update task`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error updating task:", error);
    } finally {
      setIsUpdatingTask(false);
    }
  };
  const handleDeleteTask = async (taskId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${process.env.REACT_APP_API_URL}/tasks/delete/${taskId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // Update the tasks list after successful deletion
      setTasks(tasks.filter((task) => task.id !== taskId));
    } catch (error) {
      toast.error(`Failed to delete task`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error deleting task:", error);
    }
  };
  const handleAssigneeExistingSearch = async (searchTerm) => {
    setAssigneeExistingSearch(searchTerm);
    if (searchTerm.trim()) {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/users/search`,
          {
            email: searchTerm,
            limit: 10,
            cur_emails: meeting.participants.map((part) => part.email),
            meetingId: meeting.id,
            isAddingUser: true,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.data.users.length) {
          setFilteredParticipants(response.data.users);
        } else {
          setFilteredParticipants({ name: searchTerm, isNewUser: true });
        }
      } catch (error) {
        toast.error(`Failed to fetch users`, {
          autoClose: 5000,
          position: "top-right",
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        console.error("Error fetching users:", error);
      }
    } else {
      setFilteredParticipants(null);
    }
  };
  const handleAssigneeAddSearch = async (searchTerm) => {
    setAssigneeSearch(searchTerm);
    if (searchTerm.trim()) {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/users/search`,
          {
            email: searchTerm,
            limit: 10,
            cur_emails: meeting.participants,
            searchGlobal: isSearchGlobal,
            meetingId: meeting.id,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.data.users.length) {
          setFilteredParticipants(response.data.users);
        } else {
          setFilteredParticipants({ name: searchTerm, isNewUser: true });
        }
      } catch (error) {
        toast.error(`Failed to fetch users`, {
          autoClose: 5000,
          position: "top-right",
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        console.error("Error fetching users:", error);
      }
    } else {
      setFilteredParticipants([]);
    }
  };
  const handleAssigneeSearch = (searchTerm) => {
    setAssigneeSearch(searchTerm);
    const filtered = meeting.participants.filter(
      (participant) =>
        participant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        participant.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredParticipants(filtered);
  };
  const findParticipantFromId = (id) => {
    return meeting.participants.find((participant) => participant.id === id)
      ? meeting.participants.find((participant) => participant.id === id).name
      : "Unassigned";
  };
  const handleAddParticipant = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/invite-user`,
        {
          meetingId: id,
          email: newUserEmail,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log("response: ", response);
      // Update the task assignee
      setIsAddingNewUser(false);
      setNewUserEmail("");
      // Show success message (you'll need to implement this)
      // showSuccessMessage("Invitation sent successfully!");
    } catch (error) {
      toast.error(`Failed to invite user`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error inviting user:", error);
      // Show error message (you'll need to implement this)
      // showErrorMessage("Failed to send invitation");
    }
  };
  const handleAddUser = async () => {
    try {
      console.log(addingUserForm);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/meeting/add_user_to_meeting`,
        {
          meetingId: id,
          email: addingUserForm.assigned_email,
          isNewUser: addingUserForm.isNewUser,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // console.log("response: ", response);
      fetchMeetingDetails();
      setSelectedExistingUsers([]);
      setIsAddUserModalOpen(false);
      // Handle success (e.g., show success message, update state)
      // You may want to refresh the participants list or update the state accordingly
      // console.log("response: ", response);
      // Update the task assignee
      fetchMeetingDetails();
      setSelectedExistingUsers([]);
      setIsAddUserModalOpen(false);
      toast.success("User added successfully");
    } catch (error) {
      toast.error(`Failed to invite user`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error inviting user:", error);
      // Handle error (e.g., show error message)
    }
  };
  const handleDeleteClick = (task) => {
    setTaskToDelete(task);
    setIsDeleteModalOpen(true);
  };
  const confirmDelete = async () => {
    if (taskToDelete) {
      await handleDeleteTask(taskToDelete.id);
      setIsDeleteModalOpen(false);
      setTaskToDelete(null);
    }
  };
  const handleAddTask = async (newTask) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/create`,
        {
          meetingId: id,
          assigned_email: assigneeName,
          ...newTask,
          assigned_id: newTask.assigned_id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setTasks([...tasks, response.data.task]);
      setIsAddTaskModalOpen(false);
      setSimilarTasks([]); // Clear similar tasks
      toast.success("Task added successfully");
    } catch (error) {
      toast.error(`Failed to create task`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error creating task:", error);
    }
  };
  const fetchSimilarTasks = async (title, description) => {
    if (!title.trim() && !description.trim()) {
      setSimilarTasks([]);
      return;
    }
    try {
      setIsFetchingSimilarTasks(true);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/search-similar`,
        {
          title: title.trim(),
          description: description.trim(),
          limit: 3,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        setSimilarTasks(response.data.tasks || []);
      }
    } catch (error) {
      console.error("Error fetching similar tasks:", error);
      setSimilarTasks([]);
    } finally {
      setIsFetchingSimilarTasks(false);
    }
  };
  const handleSaveSummary = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${process.env.REACT_APP_API_URL}/meeting/update-summary`,
        {
          meetingId: id,
          summary: editedSummary,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMeeting({ ...meeting, summary: editedSummary });
      toast.success("Summary saved successfully");
      setIsEditingSummary(false);
    } catch (error) {
      toast.error(`Failed to save summary`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error saving summary:", error);
    }
  };
  const handleDeleteMeeting = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${process.env.REACT_APP_API_URL}/meeting/delete`,
        {
          meetingId: id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // Navigate back or show success message
      navigate("/meeting-list"); // Adjust the navigation as needed
      toast.success("Meeting deleted successfully");
    } catch (error) {
      toast.error(`Failed to delete meeting`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error deleting meeting:", error);
    }
  };
  const fetchScoreAnalysis = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/company-strategy/score-analysis/${meeting.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setScoreAnalysis(response.data);
      setShowScoreModal(true);
    } catch (error) {
      toast.error(`Failed to fetch score analysis`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error fetching score analysis:", error);
    }
  };
  const handleGenerateScore = async () => {
    try {
      setIsGeneratingScore(true);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/company-strategy/score-meeting`,
        { meetingId: meeting.id },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        // Update the meeting state with all the new data
        setMeeting({
          ...meeting,
          strategy_score: response.data.score,
          strategy_explanation: response.data.explanation,
          strategy_analysis: response.data.strategy_analysis,
        });
        toast.success("Alignment score generated successfully");
        // Show the score modal immediately after generating
        setShowScoreModal(true);
      }
    } catch (error) {
      toast.error(`Failed to generate alignment score`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error generating alignment score:", error);
    } finally {
      setIsGeneratingScore(false);
    }
  };
  const fetchPrompt = async (type) => {
    try {
      let endpoint = "";
      if (type === "summary") {
        setPromptEndpoint("summary");
        endpoint = "executive_summary";
      } else if (type === "task") {
        setPromptEndpoint("task");
        endpoint = "task";
      }
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/prompt/${endpoint}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setPromptContent(response.data.prompt);
      setSelectedModel(response.data.modelId);
      setMaxTokens(response.data.maxtokens);
      setPromptSource(response.data.promptSource); // Store prompt source information
      setIsPromptModalOpen(true);
      toast.success("Prompt fetched successfully");
    } catch (error) {
      toast.error(`Failed to fetch prompt`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error fetching prompt:", error);
    }
  };
  const handleUpdatePrompt = async (
    promptContent,
    selectedModel,
    maxTokens
  ) => {
    try {
      let endpoint = "";
      if (promptEndpoint === "summary") {
        endpoint = "executive_summary";
      } else if (promptEndpoint === "task") {
        endpoint = "task";
      }
      const token = localStorage.getItem("token");
      const result = await axios.put(
        `${process.env.REACT_APP_API_URL}/prompt/`,
        {
          prompt_title: endpoint,
          prompt_content: promptContent,
          modelId: selectedModel,
          maxTokens,
          previewContent,
          meeting,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (endpoint === "executive_summary")
        setMeeting({ ...meeting, summary: previewContent });
      else if (endpoint === "task" && result.data.success)
        setTasks(result.data.tasks);
      setIsPromptModalOpen(false);
      setNotification({
        type: "success",
        message: "Prompt updated successfully",
      });
    } catch (error) {
      toast.error(`Failed to update prompt`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error updating prompt:", error);
    }
  };
  const handlePreviewPrompt = async (
    promptContent,
    selectedModel,
    maxTokens
  ) => {
    try {
      setIsPreviewSuccess(false);
      setIsPreviewLoading(true);
      console.log("getModel", selectedModel);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/meeting/preview-prompt`,
        {
          promptEndpoint: promptEndpoint,
          modelId: selectedModel,
          system_prompt: promptContent,
          user_prompt: `Meeting Transcription: ${meeting?.transcription_link}`,
          maxTokens,
          meeting,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 120000, // Increase timeout to 120 seconds
        }
      );
      if (response.data.success) {
        setPreviewContent(response.data.preview);
        setIsPreviewSuccess(true);
        toast.success("Preview generated successfully");
        return response.data.preview; // Return the preview
      } else {
        toast.error(response.data.message || "Failed to generate preview");
        return null;
      }
      // Handle response...
    } catch (error) {
      console.error("Error previewing prompt:", error);
      toast.error(error.response?.data?.message || "Error generating preview");
      return null;
    } finally {
      setIsPreviewLoading(false);
    }
  };
  const handleProcessMeeting = async () => {
    setIsProcessingMeeting(true);
    try {
      console.log("Processing meeting for intelligence graph:", meeting.id);
      const token = localStorage.getItem("token");
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/company-strategy/intelligence`, {
        meetingId: meeting.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Intelligence processing response:", response.data);
      // Update the meeting state with the new graph data and message
      if (response.data.success) {
        setMeeting(prevMeeting => ({
          ...prevMeeting,
          interactive_node_graph_json: typeof response.data.graph_data === 'string'
            ? response.data.graph_data
            : JSON.stringify(response.data.graph_data),
          interactive_message: response.data.graph_message
        }));
      } else {
        toast.error("Error processing meeting for intelligence");
      }
    } catch (error) {
      console.error("Error processing meeting for intelligence:", error);
      toast.error("Failed to process meeting. Please try again.");
    } finally {
      setIsProcessingMeeting(false);
    }
  };

  // const handleProcessImpact = async () => {
  //   setIsProcessingImpact(true);
  //   try {
  //     console.log("Processing meeting for impact analysis:", meeting.id);
  //     const token = localStorage.getItem("token");
  //     const response = await axios.post(`${process.env.REACT_APP_API_URL}/company-strategy/participant-value-analysis`, {
  //       meetingId: meeting.id
  //     }, {
  //       headers: { Authorization: `Bearer ${token}` }
  //     });
  //     console.log("Impact analysis response:", response.data);
  //     // Update the meeting state with the new impact data
  //     if (response.data.success) {
  //       setMeeting(prevMeeting => ({
  //         ...prevMeeting,
  //         impact_analysis_json: typeof response.data.impact_data === 'string'
  //           ? response.data.impact_data
  //           : JSON.stringify(response.data.impact_data),
  //         impact_message: response.data.impact_message
  //       }));
  //       toast.success("Impact analysis processed successfully");
  //     } else {
  //       toast.error("Error processing impact analysis");
  //     }
  //   } catch (error) {
  //     console.error("Error processing impact analysis:", error);
  //     toast.error("Failed to process impact analysis. Please try again.");
  //   } finally {
  //     setIsProcessingImpact(false);
  //   }
  // };


  const handleProcessImpactRatings = async () => {
    setIsProcessingImpactRatings(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/company-strategy/participant-value-analysis`,
        { meetingId: meeting.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success("Impact ratings processed successfully");
        // Reload meeting data to get updated scores
        await fetchMeetingDetails();
      } else {
        toast.error(response.data.error || "Failed to process impact ratings");
      }
    } catch (error) {
      console.error("Error processing impact ratings:", error);
      toast.error("Failed to process impact ratings");
    } finally {
      setIsProcessingImpactRatings(false);
    }
  };


  useEffect(() => {
    console.log(editingTask);
  }, [editingTask]);
  function isHTML(str) {
    const doc = new DOMParser().parseFromString(str, "text/html");
    return Array.from(doc.body.childNodes).some(node => node.nodeType === 1);
  }
  const renderDetailsTab = () => (
    <>
      {!(new Date(meeting.schedule_datetime) < new Date() && !meeting.transcription_link) && <div className="flex items-center mb-[20px] justify-center">
        {meeting.strategy_score ? (
          <>
            <div
              className="text-lg cursor-pointer hover:opacity-80 transition-opacity hover:underline"
              onClick={() => setShowScoreModal(true)}
            >
              <span
                className={`font-semibold ${meeting.strategy_score >= 70
                  ? "text-green-600"
                  : meeting.strategy_score >= 40
                    ? "text-yellow-600"
                    : "text-red-600"
                  }`}
              >
                {meeting.strategy_score}%
              </span>{" "}
              alignment score with company's strategies
            </div>
            {showScoreModal && (
              <div
                className="modal-overlay"
                onClick={() => setShowScoreModal(false)}
              >
                <div
                  className="modal-container"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <h2 className="modal-title">Strategy Alignment Analysis</h2>
                    <button
                      onClick={() => setShowScoreModal(false)}
                      className="close-button"
                      aria-label="Close"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <div className="mt-4">
                    <div className="mb-6">
                      <div className="text-2xl font-bold mb-2 flex items-center gap-2">
                        Score:
                        <span
                          className={`${meeting.strategy_score >= 70
                            ? "text-green-600"
                            : meeting.strategy_score >= 40
                              ? "text-yellow-600"
                              : "text-red-600"
                            }`}
                        >
                          {meeting.strategy_score}%
                        </span>
                      </div>
                      <p className="text-gray-700">
                        {meeting.strategy_explanation}
                      </p>
                    </div>
                    <div className="space-y-4">
                      {meeting.strategy_analysis &&
                        (() => {
                          try {
                            let analysisData;
                            if (typeof meeting.strategy_analysis === "string") {
                              // First parse the outer JSON structure
                              analysisData = JSON.parse(
                                meeting.strategy_analysis
                              );
                            } else {
                              analysisData = meeting.strategy_analysis;
                            }
                            return analysisData.map((analysis, index) => (
                              <div key={index} className="border-t pt-4">
                                <h3 className="text-lg font-semibold mb-2">
                                  {analysis.strategy}
                                </h3>
                                {Array.isArray(analysis.alignment_points) &&
                                  analysis.alignment_points?.length > 0 && (
                                    <div className="mb-3">
                                      <h4 className="font-medium text-green-600 mb-1">
                                        Alignment Points:
                                      </h4>
                                      <ul className="list-disc pl-5 space-y-1">
                                        {analysis.alignment_points.map(
                                          (point, i) => (
                                            <li
                                              key={i}
                                              className="text-green-600"
                                            >
                                              {point}
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                {Array.isArray(analysis.misalignment_points) &&
                                  analysis.misalignment_points.length > 0 && (
                                    <div>
                                      <h4 className="font-medium text-red-600 mb-1">
                                        Misalignment Points:
                                      </h4>
                                      <ul className="list-disc pl-5 space-y-1">
                                        {analysis.misalignment_points.map(
                                          (point, i) => (
                                            <li
                                              key={i}
                                              className="text-red-600"
                                            >
                                              {point}
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                              </div>
                            ));
                          } catch (error) {
                            console.error(
                              "Error parsing strategy analysis:",
                              error
                            );
                            console.log(
                              "Raw strategy_analysis:",
                              meeting.strategy_analysis
                            );
                            return (
                              <div className="text-red-500 p-4">
                                Error displaying strategy analysis. Please try
                                refreshing the page.
                              </div>
                            );
                          }
                        })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={handleGenerateScore}
            disabled={isGeneratingScore}
            className={`${isGeneratingScore
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600"
              } text-white px-4 py-2 rounded-md transition duration-200 flex items-center gap-2`}
          >
            {isGeneratingScore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Score...
              </>
            ) : (
              "Generate Alignment Score"
            )}
          </button>
        )}
      </div>}
      {
        (new Date(meeting.schedule_datetime) < new Date() && !meeting.transcription_link) && (
          <h1 className="bg-blue-500 mb-2 text-center text-white p-2 rounded">
            In progress...
          </h1>
        )
      }
      {meeting.summary && meeting.summary.trim() !== "" && (
        <section className="meeting-summary">
          <div className="flex items-center mb-4">
            <div className="flex space-x-4">
              <button
                onClick={() => setShowIntelligenceGraph(false)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${!showIntelligenceGraph
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
              >
                Executive Summary
              </button>
            </div>
            {(user && user.role === "padmin" || user && user.role === "admin") && (
              <button
                onClick={() => setShowIntelligenceGraph(true)}
                className={`px-4 ml-5 py-2 rounded-lg font-semibold transition-colors ${showIntelligenceGraph
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
              >
                Intelligence / Graph
              </button>
            )}
            {/* {!showIntelligenceGraph && user && user.role === "padmin" && meeting.summary && ( */}
            {user && user.role === "padmin" && meeting.summary && (
              <div
                onClick={(e) => fetchPrompt("summary")}
                className="flex items-center justify-center hover:cursor-pointer p-1 mb-2 rounded-lg transition-all duration-300 group ml-4"
              >
                <img
                  src={`/ai-prompt.png`}
                  alt="AI Prompt"
                  className="w-7 h-7 object-contain group-hover:scale-110 transition-transform duration-300"
                />
              </div>
            )}
          </div>
          {!showIntelligenceGraph ? (
            <>
              {isEditingSummary ? (
                <>
                  <textarea
                    value={editedSummary}
                    onChange={(e) => setEditedSummary(e.target.value)}
                    className="w-full h-24 p-2 border border-gray-300 rounded-md mb-2 min-h-[400px]"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveSummary}
                      className="cursor-pointer bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingSummary(false);
                        setEditedSummary(meeting.summary);
                      }}
                      className="cursor-pointer bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 "
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-full min-h-[400px] p-2 border border-gray-300 rounded-md mb-2 bg-[#eee] overflow-y-auto">
                    <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setIsEditingSummary(true);
                        setEditedSummary(meeting.summary);
                      }}
                      className="cursor-pointer bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                    >
                      <i className="fas fa-pencil-alt mr-2"></i>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(meeting.summary);
                        setNotification({
                          type: "success",
                          message: "Summary copied to clipboard!",
                        });
                      }}
                      className="cursor-pointer bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                    >
                      <i className="fas fa-copy mr-2"></i>
                      Copy
                    </button>
                    <div className="mr-2">
                      {meeting?.api_by_summary}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full relative">
              {meeting.interactive_node_graph_json && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">Meeting Analysis Dashboard</h3>
                  <p className="text-blue-700 text-sm">
                    Interactive visualization of meeting transcript relationships and opportunities.
                    Click on nodes to explore connections, use the controls to zoom and navigate,
                    and export the graph for presentations.
                  </p>
                </div>)}
              <div className="min-h-[600px] border border-gray-300 rounded-md bg-white relative">
                {(() => {
                  try {
                    const graphData = meeting.interactive_node_graph_json
                      ? JSON.parse(meeting.interactive_node_graph_json)
                      : null;
                    console.log('graphData', graphData);
                    console.log('graphData.graph_data', graphData?.graph_data);
                    console.log('graphData.graph_data?.visualization', graphData?.graph_data?.visualization);
                    if (!graphData) {
                      // Check if interactive_message exists and is not empty
                      if (meeting.interactive_message && meeting.interactive_message.trim() !== "") {
                        return (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center">
                              <i className="fas fa-chart-network text-4xl mb-4"></i>
                              <button
                                onClick={handleProcessMeeting}
                                disabled={isProcessingMeeting}
                                className={`px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${isProcessingMeeting
                                  ? 'bg-gray-400 cursor-not-allowed'
                                  : 'bg-blue-500 hover:bg-blue-600'
                                  } text-white absolute top-[10px] right-[10px]`}
                                title="Reprocess meeting to generate interactive graph"
                              >
                                {isProcessingMeeting ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"> </div>
                                    {/* <span className="ml-2">Processing...</span> */}
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-sync-alt"> </i>
                                    {/* Reprocess */}
                                  </>
                                )}
                              </button>
                              <p className="mt-4 mb-4">{meeting.interactive_message}</p>
                            </div>
                          </div>
                        );
                      } else {
                        // Both interactive_node_graph_json and interactive_message are null/empty
                        return (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center">
                              <i className="fas fa-chart-network text-4xl mb-4"></i>
                              <p className="mb-4">No interactive graph data available for this meeting</p>
                              <button
                                onClick={handleProcessMeeting}
                                disabled={isProcessingMeeting}
                                className={`px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${isProcessingMeeting
                                  ? 'bg-gray-400 cursor-not-allowed'
                                  : 'bg-blue-500 hover:bg-blue-600'
                                  } text-white`}
                                title="Reprocess meeting to generate interactive graph"
                              >
                                {isProcessingMeeting ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-sync-alt"></i>
                                    Process Meeting
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      }
                    }
                    return (
                      <InteractiveNodeGraph
                        jsonData={graphData.graph_data || graphData}
                        meetingId={meeting.id}
                        templateId={meeting.template_id}
                        tPrompt={meeting.prompt}
                        template_name={meeting.template_name}
                        onReprocess={handleProcessMeeting}
                        onNodeClick={(node) => {
                          console.log("Node clicked:", node);
                          // You can add custom logic here for node clicks
                        }}
                        onAnnotationChange={(nodeId, annotation, type) => {
                          console.log("Annotation changed:", { nodeId, annotation, type });
                          // You can add custom logic here for annotation changes
                        }}
                        exportFormat="png"
                      />
                    );
                  } catch (error) {
                    console.error("Error parsing interactive graph data:", error);
                    return (
                      <div className="flex items-center justify-center h-full text-red-500">
                        <div className="text-center">
                          <i className="fas fa-exclamation-triangle text-4xl mb-4"></i>
                          <p>Error loading interactive graph data</p>
                          <p className="text-sm text-gray-500 mt-2">Please try refreshing the page</p>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          )}
        </section>
      )}
      {meeting.transcription_link && <AnalyticsCharts meeting={meeting} />}

      {(user && meeting.transcription_link && (user.role === "padmin" || user.role === "admin")) && (
        <div className="mb-5">
          {new Date(meeting.schedule_datetime) < new Date() && !meeting.participants.some(p => p.impact_value_score != null) && (
            <button
              onClick={handleProcessImpactRatings}
              disabled={isProcessingImpactRatings}
              className={`mb-3 px-4 py-2 rounded-md flex items-center gap-2 text-white ${isProcessingImpactRatings ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
                }`}
            >
              {isProcessingImpactRatings ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                'Process Impact Ratings'
              )}
            </button>
          )}

          <div className="overflow-x-auto border border-gray-700 rounded-lg shadow-lg">
            <table className="min-w-full text-sm text-left border-collapse">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-4 py-2 border-b border-gray-700">Participant</th>
                  <th className="px-4 py-2 border-b border-gray-700 text-center">
                    Impact &amp; Value Score
                  </th>
                  <th className="px-4 py-2 border-b border-gray-700">Evidence</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 text-black">
                {meeting?.participants?.map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-800">
                    <td className="px-4 py-2 border-b border-gray-700">{p.name}</td>
                    <td className="px-4 py-2 border-b border-gray-700 text-center">
                      {p.impact_value_score ?? "-"}
                    </td>
                    <td className="px-4 py-2 border-b border-gray-700">
                      {p.impact_score_evidence ?? "No evidence available"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meeting.description && (
        <section className="meeting-summary">
          <h2 className="text-xl font-semibold mb-2">Description</h2>
          <div className="description-content">
            {isHTML(meeting.description) ? (
              <div
                className=""
                dangerouslySetInnerHTML={{
                  __html: isDescriptionExpanded
                    ? meeting.description
                    : meeting.description.split("\n").slice(0, 9).join("\n"),
                }}
              />
            ) : (
              <p className="mb-2 break-words whitespace-pre-line">
                {isDescriptionExpanded
                  ? meeting.description
                  : meeting.description.split("\n").slice(0, 3).join("\n")}
              </p>
            )}
            {meeting.description.split("\n").length > 3 && (
              <button
                className="show-more-btn"
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              >
                {isDescriptionExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        </section>
      )}
      <section className="meeting-meta">
        <div className="meta-item">
          <span>{`Duration: ${Math.floor(meeting.duration)} minutes`}</span>
          {(() => {
            const startDate = new Date(meeting.datetime);
            const durationMinutes = meeting.duration || 0;
            const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
            // Format: 'Jul 2, 2025, 8:00 am to 9:00 am'
            return (
              <span>
                Date: {format(startDate, "PP, p")} to {format(endDate, "p")}
              </span>
            );
          })()}
        </div>
        <div className="meta-item">
          <span>{`Participants: ${meeting.participants.length}`}</span>
        </div>
        <div className="meta-item">
          {(tasks?.length > 0 ||
            !meeting.is_owner ||
            !meeting.transcription_link) && (
              <span>{`Tasks: ${tasks?.length}`}</span>
            )}
          {meeting.is_owner &&
            tasks?.length === 0 &&
            meeting.transcription_link && (
              <button
                className="create-tasks-btn ml-2 w-full"
                onClick={handleGenerateTasks}
                disabled={isGeneratingTasks}
              >
                {isGeneratingTasks ? "Generating..." : "Auto Create"}
              </button>
            )}
        </div>
        {/* Estimated Cost Calculation */}
        <div className="meta-item">
          {/* Calculate cost based on each participant's individual CPH */}
          {meeting.show_cost_estimates && (() => {
            const durationHours = meeting.duration ? meeting.duration / 60 : 0;
            // Sum up each participant's CPH (use 0 if est_cph is null/undefined)
            const totalCPH = meeting.participants.reduce((sum, participant) => {
              return sum + (participant.est_cph || 0);
            }, 0);
            const estimatedCost = totalCPH * durationHours;
            return (
              <span>
                Estimated Cost: <b>${estimatedCost.toFixed(2)}</b>
                {/* {totalCPH > 0 && (
                  <span className="text-xs text-gray-500 ml-2">(Total CPH: ${totalCPH}, Duration: {durationHours.toFixed(2)}h)</span>
                )} */}
              </span>
            );
          })()}
        </div>
      </section>
      {/* {meeting.record_link && (
        <section className="meeting-audio">
          <h2>Audio Recording</h2>
          <audio
            controls
            src={presignedVideoUrl}
            preload="metadata"
            className="audio-player"
          >
            Your browser does not support the audio element.
          </audio>
        </section>
      )} */}
      {meeting.transcription_link && (
        <section className="meeting-transcription">
          <div className="transcription-header flex flex-col sm:flex-row gap-2">
            <h2>Transcription</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Search transcription..."
                  value={transcriptionSearch}
                  onChange={(e) => {
                    setTranscriptionSearch(e.target.value);
                    setIsTranscriptionExpanded(true);
                    setCurrentMatchIndex(0);
                  }}
                  className="px-3 py-2 border rounded-md w-full sm:w-auto pr-10"
                />
                {transcriptionSearch && (
                  <button
                    onClick={findNextMatch}
                    className="absolute right-2 text-gray-600 hover:text-gray-800"
                    title="Find next match"
                  >
                    <i className="fas fa-arrow-down"></i>
                  </button>
                )}
              </div>
              <button
                className="cursor-pointer bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 w-full sm:w-auto flex items-center justify-center"
                onClick={() => {
                  // Create a blob with the transcription content
                  const blob = new Blob([transcriptionContent], {
                    type: "text/plain",
                  });
                  // Create a URL for the blob
                  const url = window.URL.createObjectURL(blob);
                  // Create a temporary anchor element
                  const a = document.createElement("a");
                  a.href = url;
                  // Set the file name - using meeting title or default name
                  a.download = `${meeting.title || "meeting"
                    }_transcription.txt`;
                  // Trigger the download
                  document.body.appendChild(a);
                  a.click();
                  // Clean up
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                }}
              >
                <i className="fas fa-download mx-2"></i>
                <span className="sm:hidden">Download</span>
              </button>
            </div>
          </div>
          <div className="transcription-content">
            {isEditMode ? (
              <>
                <textarea
                  value={editedTranscription}
                  onChange={(e) => setEditedTranscription(e.target.value)}
                  className="transcription-editor"
                />
                <button
                  className="save-btn"
                  onClick={handleSaveTranscription}
                  disabled={isSaving}
                >
                  <span className="button-content">
                    {isSaving ? (
                      <span className="loading-spinner"></span>
                    ) : (
                      "Save"
                    )}
                  </span>
                </button>
              </>
            ) : (
              <>
                {isTranscriptionExpanded ? (
                  <pre
                    className="h-[500px] overflow-y-auto whitespace-pre-wrap text-[#4a5568] bg-[#f8fafc]"
                    dangerouslySetInnerHTML={{ __html: highlightedContent }}
                  />
                ) : (
                  <pre
                    className="whitespace-pre-wrap  text-[#4a5568] bg-[#f8fafc]"
                    dangerouslySetInnerHTML={{
                      __html: highlightSearchText(
                        transcriptionContent.split("\n").slice(0, 6).join("\n"),
                        transcriptionSearch
                      ),
                    }}
                  />
                )}
                {transcriptionContent.split("\n").length > 6 && (
                  <button
                    className="show-more-btn"
                    onClick={() =>
                      setIsTranscriptionExpanded(!isTranscriptionExpanded)
                    }
                  >
                    {isTranscriptionExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      )}
      <div className="settings-section mt-4">
        <div className="w-full flex justify-start ">
          <button
            className="danger-button mt-8 bg-red-500 text-white p-3 rounded-md"
            onClick={() => setIsDeleteMeetingModalOpen(true)}
          >
            Delete Activity
          </button>
        </div>
      </div>
    </>
  );
  const increaseDate = (date) => {
    const newDate = new Date(date);
    return newDate.setDate(newDate.getDate() + 1);
  };
  const renderParticipantsTab = () => (
    <section className="meeting-participants">
      <div className="flex justify-between items-center">
        <h2>Participants</h2>
        <div className="flex flex-row-reverse mb-4 gap-2">
          <button
            className="primary-button create-tasks-btn"
            onClick={() => setIsAddUserModalOpen(true)}
          >
            <i className="fas fa-plus"></i>
            <span className="sm:block hidden">Add User</span>
          </button>
        </div>
      </div>
      {meeting.participants.map((participant) => (
        <div key={participant.id} className=" participant-card justify-between bg-white">
          <div>
            {/* <div className="participant-avatar flex-none">
              {participant.avatar ? (
                <img
                  src={`${process.env.REACT_APP_API_URL}/avatars/${participant.avatar}`}
                  alt={participant.name}
                />
              ) : (
                <div className="flex-none avatar-placeholder ">
                  {participant.name.charAt(0)}
                </div>
              )}
            </div> */}
            <AvatarPop participant={participant} />
            <div className="participant-info">
              <span className="participant-name break-all">
                {participant?.name}
              </span>
              {participant?.role === "organizer" && (
                <span className="owner-badge">Owner</span>
              )}
              {participant?.role === "new_invite" && (
                <span className="invite-badge">Invited</span>
              )}
              {participant?.role === "accepted" && (
                <span className="invite-badge">Accepted</span>
              )}
              {participant?.role === "rejected" && (
                <span className="invite-badge">Declined</span>
              )}
              {(participant?.role === null ||
                participant?.role === "Presenter") && (
                  <span className="existing-participant-badge">Participant</span>
                )}
            </div>
          </div>
          {(user.role === "padmin" || user.id === meeting.org_id) && meeting.org_id !== participant.id && (
            <button
              className="remove-participant-btn"
              onClick={() => handleRemoveParticipantClick(participant)}
              title="Remove participant"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      ))}
    </section>
  );
  const renderTasksTab = () => (
    <section className="meeting-tasks">
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-4">
          <div className="flex flex-row items-center gap-3 w-full sm:w-auto">
            <h2 className="text-xl font-semibold text-gray-800">
              Activity Tasks
            </h2>
            {user.role === "padmin" && (
              <div className="flex items-center">
                <div
                  onClick={(e) => fetchPrompt("task")}
                  className="flex items-center justify-center hover:cursor-pointer p-2 rounded-lg transition-all duration-300 hover:bg-gray-50 active:bg-gray-100"
                >
                  <img
                    src={`/ai-prompt.png`}
                    alt="AI Prompt"
                    className="w-7 h-7 md:w-9 md:h-9 object-contain transition-transform duration-300 hover:scale-110"
                  />
                </div>
              </div>
            )}
          </div>
          {meeting.is_owner && (
            <button
              className="flex items-center justify-center px-4 py-2.5 sm:py-2 w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 min-w-[120px]"
              onClick={() => {
                setEditingTask(null);
                setIsAddTaskModalOpen(true);
              }}
            >
              <i className="fas fa-plus mr-2"></i>
              <span className="text-sm sm:text-base font-medium">
                Add Task
              </span>
            </button>
          )}
        </div>
      </div>
      {tasks?.length > 0 ? (
        <div className="tasks-wrapper">
          <div className="hidden md:block">
            <div className="table-scroll">
              <table className="tasks-table">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Task Title</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Due Date</th>
                    <th className="px-4 py-2">EST Time</th>
                    <th className="px-4 py-2">Priority</th>
                    <th className="px-4 py-2">Assignee</th>
                    <th className="px-4 py-2">Status</th>
                    {meeting.is_owner && (
                      <>
                        <th className="px-4 py-2">
                          <span className="sr-only">Actions</span>
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => (
                    <tr key={index} className="task-row hover:bg-gray-100">
                      <td className="task-title px-4 py-2">
                        <div
                          onClick={() =>
                            navigate("/task-details?id=" + task.id)
                          }
                          className="cursor-pointer hover:text-blue-600 flex flex-col items-center gap-2"
                        >
                          {task.title}
                          {task.similarTasks?.length > 0 && (
                            <span onClick={(e) => {
                              e.stopPropagation();
                              setShowSimilarTasksModal(true);
                              setSimilarTasks(task.similarTasks);
                            }} className="text-xs text-white cursor-pointer rounded-full bg-blue-500 p-2 hover:bg-blue-600 transition-colors">
                              {task.similarTasks?.length} similar tasks
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="task-description px-4 py-2">
                        <div className="description-cell">
                          {task.description}
                        </div>
                      </td>
                      <td className="px-4 py-2  text-center">
                        {task.duedate
                          ? format(increaseDate(task.duedate), "MM/dd/yyyy")
                          : "—"}
                      </td>
                      <td className="px-4 py-2  text-center">
                        {task.average_time ? task.average_time + " day" : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`priority-badge ${task.priority?.toLowerCase() || "medium"
                            } text-sm font-semibold`}
                        >
                          {task.priority || "Medium"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="assignee-cell">
                          {task.assigned_id ? (
                            <span
                              className="assignee-badge text-sm  text-center"
                              style={{ marginTop: 0 }}
                            >
                              {task.assigned_name}
                            </span>
                          ) : (
                            <span className="unassigned ">Unassigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`status-badge ${task.status?.toLowerCase() || "pending"
                            } text-sm font-semibold  text-center`}
                        >
                          {task.status || "Pending"}
                        </span>
                      </td>
                      {meeting.is_owner && (
                        <td className="px-4 py-2">
                          <div className="action-buttons">
                            <>
                              {" "}
                              <button
                                className="icon-button edit-task-btn text-blue-500 hover:text-blue-700 transition duration-200"
                                onClick={() => handleEditTask(task)}
                                title="Edit Task"
                              >
                                <i className="fas fa-pencil-alt"></i>
                              </button>
                              <button
                                className="icon-button delete-task-btn text-red-500 hover:text-red-700 transition duration-200"
                                onClick={() => handleDeleteClick(task)}
                                title="Delete Task"
                              >
                                <i className="fas fa-trash-alt"></i>
                              </button>
                            </>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-0">
              {meeting?.api_by_tasks}
            </div>
          </div>
          <div className="md:hidden">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="border-b border-gray-200 p-4 flex flex-col bg-white rounded-lg shadow-md mb-4 transition-transform transform hover:scale-105"
              >
                <h3
                  onClick={() => navigate("/task-details?id=" + task.id)}
                  className="font-bold text-gray-800 text-lg hover:text-blue-600 cursor-pointer"
                >
                  {task.title}
                </h3>
                <p className="text-gray-600">
                  Description:{" "}
                  <span className="font-semibold break-words">
                    {task.description}
                  </span>
                </p>
                <p className="text-gray-600">
                  Due Date:{" "}
                  <span className="font-semibold">
                    {task.duedate
                      ? format(new Date(task.duedate), "MM/dd/yyyy")
                      : "—"}
                  </span>
                </p>
                <p className="text-gray-600">
                  Priority:{" "}
                  <span className="font-semibold">
                    {task.priority || "Medium"}
                  </span>
                </p>
                <p className="text-gray-600">
                  Assignee:{" "}
                  <span className="font-semibold">
                    {task.assigned_id
                      ? findParticipantFromId(task.assigned_id)
                      : "Unassigned"}
                  </span>
                </p>
                <p className="text-gray-600">
                  Owner:{" "}
                  <span className="font-semibold">
                    {findParticipantFromId(meeting.org_id)}
                  </span>
                </p>
                <p className="text-gray-600">
                  EST Time:{" "}
                  <span className="font-semibold">
                    {task.average_time ? task.average_time + " day" : "—"}
                  </span>
                </p>
                <p className="text-gray-600">
                  Status:{" "}
                  <span className="font-semibold">
                    {task.status || "Pending"}
                  </span>
                </p>
                <div className="flex space-x-2 mt-2">
                  {meeting.is_owner && (
                    <>
                      {" "}
                      <button
                        className="mt-2 bg-blue-500 text-white rounded-lg py-2 px-4 hover:bg-blue-600 transition duration-200 w-full"
                        onClick={() => handleEditTask(task)}
                        title="Edit Task"
                      >
                        <i className="fas fa-pencil-alt"></i>
                      </button>
                      <button
                        className="mt-2 bg-red-500 text-white rounded-lg py-2 px-4 hover:bg-red-600 transition duration-200 w-full"
                        onClick={() => handleDeleteClick(task)}
                        title="Delete Task"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            <div className="ml-0">
              {meeting?.api_by_tasks}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-2 items-center">
          <i className="fas fa-clipboard-list no-tasks-icon flex items-center"></i>
          <p>No tasks yet.</p>
        </div>
      )}
      {isAddTaskModalOpen && (
        <div className="modal show">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Add New Task</h2>
              <button
                className="modal-close-button"
                onClick={() => {
                  setIsAddTaskModalOpen(false);
                  setSimilarTasks([]); // Clear similar tasks when closing
                }}
                aria-label="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <TaskForm
                task={{
                  title: "",
                  description: "",
                  dueDate: new Date().toISOString().split("T")[0] + "T00:00:00",
                  priority: "Medium",
                  status: "Pending",
                  assignee: "",
                }}
                renderAssigneeSelect={renderAssigneeSelect}
                onSave={handleAddTask}
                onCancel={() => {
                  setIsAddTaskModalOpen(false);
                  setSimilarTasks([]); // Clear similar tasks when canceling
                }}
                onSimilarTaskRequested={(title, description, showModal = false) => {
                  if (showModal) {
                    setShowSimilarTasksModal(true);
                  } else {
                    fetchSimilarTasks(title, description);
                  }
                }}
                similarTasks={similarTasks}
                isFetchingSimilarTasks={isFetchingSimilarTasks}
                noMeeting={false}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
  const getAssignedNameFromId = async (id) => {
    const participant = meeting.participants.find(
      (participant) => participant.id === id
    );
    if (participant) {
      return participant.name;
    }
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/users/get`,
        { userId: id },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return response.data.success ? response.data.user.name : "Unknown";
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error(`Failed to fetch users`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
    }
    return "Unknown";
  };
  const renderAssigneeSelect = (setAssignee) => {
    return (
      <div>
        <div className=" flex space-between w-full" htmlFor="task-assignee">
          <div className="flex-1">Assignee</div>
          <div className="flex gap-2">
            <input
              type="checkbox"
              id="search-global"
              checked={isSearchGlobal}
              onChange={() => setIsSearchGlobal((prev) => !prev)}
            />
            <label htmlFor="search-global">Global Search</label>
          </div>
        </div>
        <div>
          <div className="flex gap-2 items-center">
            <div className="assignee-search-container">
              {!editingTask?.assigned_id && (
                <>
                  <input
                    className="assignee-search"
                    style={{ width: "200px" }}
                    placeholder="Search or enter new email"
                    value={assigneeSearch}
                    onChange={(e) => handleAssigneeAddSearch(e.target.value)}
                  />
                  <div className="assignee-dropdown">
                    {assigneeSearch && (
                      <>
                        {filteredParticipants?.isNewUser ? (
                          <div
                            className="assignee-option cursor-pointer hover:bg-gray-100 transition duration-200"
                            onClick={() => {
                              setEditingTask({
                                assigned_id: -1,
                                assigned_email: filteredParticipants.name,
                                ...editingTask,
                                isNewUser: true,
                              });
                              setAssignee(-1);
                              setAssigneeName(filteredParticipants.name);
                              setAssigneeSearch("");
                              setFilteredParticipants([]);
                            }}
                          >
                            <div className="flex flex-col w-full p-2">
                              <span className="font-semibold">
                                {filteredParticipants.name}{" "}
                                <span className="text-[#f30]"> (New User)</span>
                              </span>
                              <span className="text-sm text-gray-600 break-words">
                                ({filteredParticipants.name})
                              </span>
                            </div>
                          </div>
                        ) : (
                          !!filteredParticipants.length &&
                          filteredParticipants.map((participant) => (
                            <div
                              key={participant.id}
                              className="assignee-option cursor-pointer hover:bg-gray-100 transition duration-200"
                              onClick={() => {
                                console.log(
                                  "participant name:" + participant.name
                                );
                                setEditingTask({
                                  ...editingTask,
                                  assigned_id: participant.id,
                                });
                                setAssignee(participant.id);
                                setAssigneeName(participant.name);
                                setAssigneeSearch("");
                                setFilteredParticipants([]);
                              }}
                            >
                              <div className="flex flex-col w-full p-2">
                                <span className="font-semibold">
                                  {participant.name}
                                </span>
                                <span className="text-sm text-gray-600 break-words">
                                  ({participant.email})
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
              <div className="current-assignee">
                {editingTask?.assigned_id ? (
                  <div className="assignee-badge">
                    {assigneeName}
                    <button
                      className="remove-assignee"
                      onClick={() => {
                        setEditingTask({ ...editingTask, assigned_id: "" });
                        setAssigneeSearch("");
                        setAssigneeName("");
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  ""
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  const highlightSearchText = (content, searchTerm) => {
    if (!searchTerm.trim()) return content;
    const regex = new RegExp(`(${searchTerm})`, "gi");
    return content.replace(regex, "<mark>$1</mark>");
  };
  useEffect(() => {
    if (transcriptionContent) {
      const highlighted = highlightSearchText(
        transcriptionContent,
        transcriptionSearch
      );
      setHighlightedContent(highlighted);
    }
  }, [transcriptionSearch, transcriptionContent]);
  const findNextMatch = () => {
    if (!transcriptionSearch) return;
    const matches = document.querySelectorAll("mark");
    if (matches?.length > 0) {
      const nextIndex = (currentMatchIndex + 1) % matches?.length;
      matches[nextIndex].scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setCurrentMatchIndex(nextIndex);
    }
  };
  if (isLoading) return <div className="loading">Loading...</div>;
  if (!meeting) return <div className="loading">Loading...</div>;
  return (
    <div className={`page-container flex flex-col h-screen`}>
      <Navbar isAuthenticated={true} user={user} />
      <div className="flex-1 overflow-auto w-full">
        <div className="meeting-container  ">
          <header className="meeting-header">
            <h1>
              {meeting.title}{" "}
              <span className="platform">({`${meeting.platform.charAt(0).toUpperCase()}${meeting.platform.slice(1).toLowerCase()}`})</span>
            </h1>
          </header>
          <div className="tabs">
            <button
              className={`tab ${activeTab === "details" ? "active" : ""}`}
              onClick={() => {
                setSearchParams((prev) => ({
                  id: searchParams.get("id"),
                  tab: "details",
                }));
                setActiveTab("details");
              }}
            >
              Activity Details
            </button>
            <button
              className={`tab ${activeTab === "participants" ? "active" : ""}`}
              onClick={() => {
                setSearchParams((prev) => ({
                  id: searchParams.get("id"),
                  tab: "participants",
                }));
                setActiveTab("participants");
              }}
            >
              Participants ({meeting.participants?.length})
            </button>
            <button
              className={`tab ${activeTab === "tasks" ? "active" : ""}`}
              onClick={() => {
                setSearchParams((prev) => ({
                  id: searchParams.get("id"),
                  tab: "tasks",
                }));
                setActiveTab("tasks");
              }}
            >
              {`Tasks  (${tasks?.length})`}
            </button>
          </div>
          <div className="tab-content">
            {activeTab === "details" && renderDetailsTab()}
            {activeTab === "participants" && renderParticipantsTab()}
            {activeTab === "tasks" && renderTasksTab()}
          </div>
          {showScrollButton && (
            <button
              className="scroll-to-top"
              onClick={scrollToTop}
              aria-label="Scroll to top"
            >
              ↑
            </button>
          )}
          {isEditModalOpen && (
            <EditTaskModal
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              editingTask={editingTask}
              setEditingTask={setEditingTask}
              onSave={handleSaveTask}
              isUpdatingTask={isUpdatingTask}
              renderAssigneeSelect={renderAssigneeSelect}
              isOwner={meeting.is_owner}
            />
          )}
          {isDeleteModalOpen && (
            <DeleteConfirmationModal
              isOpen={isDeleteModalOpen}
              onClose={() => setIsDeleteModalOpen(false)}
              onConfirm={confirmDelete}
              taskTitle={"Are you sure you want to delete this task?"}
              taskSubTitle={taskToDelete?.title}
            />
          )}
          {isAddUserModalOpen && (
            <div className="modal show">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title">Add User</h2>
                  <button
                    className="modal-close-button"
                    onClick={() => setIsAddUserModalOpen(false)}
                    aria-label="Close"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="">
                  <div className="relative">
                    {addingUserForm && !addingUserForm.assigned_email && (
                      <input
                        type="email"
                        placeholder="Search by email"
                        value={assigneeExistingSearch}
                        onChange={(e) =>
                          handleAssigneeExistingSearch(e.target.value)
                        }
                        className="w-full p-2 border border-gray-300 rounded-md mb-2"
                      />
                    )}
                    {assigneeExistingSearch &&
                      !addingUserForm.assigned_email && (
                        <div className="assignee-dropdown">
                          {filteredParticipants && filteredParticipants.email &&
                            filteredParticipants?.isNewUser ? (
                            <div
                              className="assignee-option cursor-pointer hover:bg-gray-100 transition duration-200"
                              onClick={() => {
                                setAddingUserForm({
                                  assigned_email: filteredParticipants.name,
                                  isNewUser: true,
                                });
                                setAssigneeSearch("");
                                setFilteredParticipants([]);
                              }}
                            >
                              <div className="flex flex-col w-full p-2">
                                <span className="font-semibold">
                                  {filteredParticipants.name}{" "}
                                  <span className="text-[#f30]">
                                    (New User)
                                  </span>
                                </span>
                                <span className="text-sm text-gray-600 break-words">
                                  ({filteredParticipants.name})
                                </span>
                              </div>
                            </div>
                          ) : (
                            filteredParticipants && !!filteredParticipants?.length &&
                            filteredParticipants.map((participant) => (
                              <div
                                key={participant.id}
                                className="assignee-option cursor-pointer hover:bg-gray-100 transition duration-200"
                                onClick={() => {
                                  setAssigneeExistingSearch("");
                                  setFilteredParticipants(null);
                                  setAddingUserForm({
                                    assigned_email: participant.email,
                                    isNewUser: false,
                                  });
                                }}
                              >
                                <div className="flex flex-col w-full p-2">
                                  <span className="font-semibold">
                                    {participant.name}
                                  </span>
                                  <span className="text-sm text-gray-600 break-words">
                                    ({participant.email})
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                  </div>
                  {addingUserForm.assigned_email && (
                    <div className="selected-users my-2 relative">
                      {
                        <span
                          key={addingUserForm.assigned_email}
                          className="badge bg-blue-500 text-white px-2 py-1 rounded-full mr-2"
                        >
                          {addingUserForm.assigned_email}
                          <button
                            className="remove-assignee ml-2 text-white"
                            onClick={() => {
                              setAddingUserForm({
                                assigned_email: "",
                                isNewUser: false,
                              });
                            }}
                          >
                            ×
                          </button>
                        </span>
                      }
                    </div>
                  )}
                  <button className="btn btn-primary" onClick={handleAddUser}>
                    Send Invite
                  </button>
                </div>
              </div>
            </div>
          )}
          {isDeleteMeetingModalOpen && (
            <DeleteConfirmationModal
              isOpen={isDeleteMeetingModalOpen}
              onClose={() => setIsDeleteMeetingModalOpen(false)}
              onConfirm={() => {
                handleDeleteMeeting();
                setIsDeleteMeetingModalOpen(false);
              }}
              taskTitle={"Are you sure you want to delete this meeting?"}
              taskSubTitle={meeting.title}
            />
          )}
        </div>
        {notification && (
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}
        {isPromptModalOpen && (
          <PromptModal
            isOpen={isPromptModalOpen}
            onClose={() => setIsPromptModalOpen(false)}
            title={`Update ${promptEndpoint === "summary" ? "Executive Summary" : "Task"
              } Prompt`}
            initialContent={promptContent}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            maxTokens={maxTokens}
            setMaxTokens={setMaxTokens}
            aiModels={aiModels}
            promptSource={promptSource}
            onPreview={async (content, model, tokens) => {
              // Your preview logic here
              const response = await handlePreviewPrompt(
                content,
                model,
                tokens
              );
              return response;
            }}
            onUpdate={(content, model, tokens) => {
              handleUpdatePrompt(content, model, tokens);
            }}
          />
        )}
        {isRemoveParticipantModalOpen && participantToRemove && (
          <DeleteConfirmationModal
            isOpen={isRemoveParticipantModalOpen}
            onClose={() => {
              setIsRemoveParticipantModalOpen(false);
              setParticipantToRemove(null);
            }}
            onConfirm={confirmRemoveParticipant}
            taskTitle={"Remove Participant"}
            taskSubTitle={`Are you sure you want to remove ${participantToRemove.name} from this activity?`}
          />
        )}
        <SimilarTasksModal
          isOpen={showSimilarTasksModal}
          onClose={() => setShowSimilarTasksModal(false)}
          similarTasks={similarTasks}
          isLoading={isFetchingSimilarTasks}
        />
      </div>
      <Footer />
    </div>
  );
};
export default MeetingDetail;