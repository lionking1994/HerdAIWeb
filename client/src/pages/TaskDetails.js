import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import getSocket from "../libs/socket";
import Navbar from "../components/Navbar";
import {
  FaCheck,
  FaCheckCircle,
  FaFile,
  FaPaperPlane,
  FaRobot,
  FaTimes,
  FaTimesCircle,
  FaEye,
  FaDownload,
  FaReply,
  FaHashtag,
  FaRegStar,
  FaStar,
  FaPlay,
} from "react-icons/fa";
import { Rating } from "@smastrom/react-rating";
import { toast } from "react-toastify";
import "@smastrom/react-rating/style.css";
import Footer from "../components/Footer";
import "./TaskDetails.css";
import UserProfileDrawer from "../components/UserProfileDrawer";
import TaskReassignmentPopup from "../components/TaskReassignmentPopup";
import TaskOwnerReassignmentPopup from "../components/TaskOwnerReassignmentPopup";
import { X } from "lucide-react";
import AvatarPop from "../components/AvatarPop";
import DocumentPreview from "../components/DocumentPreview";
import ThreadMessageMenu from "../components/ThreadMessageMenu";
import ThreadReplyPreview from "../components/ThreadReplyPreview";
import ThreadFooter from "../components/ThreadFooter";
import UserSuggestions from "../components/UserSuggestions";
import WorkflowFormModal from "../components/WorkflowFormModal";

const Star = (
  <path d="M62 25.154H39.082L32 3l-7.082 22.154H2l18.541 13.693L13.459 61L32 47.309L50.541 61l-7.082-22.152L62 25.154z" />
);

function TaskDetails() {
  const dispatch = useDispatch();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myTaskDetail, setMyTaskDetail] = useState({});
  const [meetingDetail, setMeetingDetail] = useState();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const doc_id = searchParams.get("doc_id");
  const doc_name = searchParams.get("doc_name");
  const comment = searchParams.get("comment");
  const [message, setMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [firstTime, setFirstTime] = useState(true);
  const [userStatus, setUserStatus] = useState();
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [similarTaskUsers, setSimilarTaskUsers] = useState([]);
  const navigate = useNavigate();
  const [isLoadingAiRecommendation, setIsLoadingAiRecommendation] =
    useState(false);
  const [aiRecommendation, setAiRecommendation] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageForReview, setMessageForReview] = useState("");
  const [rateForReview, setRateForReview] = useState(null);
  const [isReassignmentPopupOpen, setIsReassignmentPopupOpen] = useState(false);
  const [isOwnerReassignmentPopupOpen, setIsOwnerReassignmentPopupOpen] =
    useState(false);
  const [isGeneratingScore, setIsGeneratingScore] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState("");
  const [previewFileName, setPreviewFileName] = useState("");
  const [replyToThread, setReplyToThread] = useState(null);
  const [editingThread, setEditingThread] = useState(null);
  const [highlightedThreadId, setHighlightedThreadId] = useState(null);
  const [commentId, setCommentId] = useState(null);
  const [isRecommendLoading, setIsRecommendLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [error, setError] = useState(null);
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [finalFileName, setFinalFileName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isFavouriteModalOpen, setIsFavouriteModalOpen] = useState(false);
  const [favouriteInput, setFavouriteInput] = useState("");
  const [selectedThread, setSelectedThread] = useState(null);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);

  const messageInputRef = useRef(null);
  const userSuggestionsRef = useRef(null);

  const requestAIHelp = async (taskId) => {
    setIsLoadingAiRecommendation(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/ai-help`,
        {
          taskId: taskId,
          title: myTaskDetail.title,
          description: myTaskDetail.description,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setAiRecommendation(response.data.data.response);
      }
    } catch (error) {
      console.error("Error requesting AI help:", error);
      // toast.error('Failed to get AI assistance');
    } finally {
      setIsLoadingAiRecommendation(false);
    }
  };

  const handlePreview = (fileUrl, fileName, comment) => {
    setPreviewFileUrl(fileUrl);
    setCommentId(comment);
    console.log("comment", comment);
    setPreviewFileName(fileName);
    setIsPreviewOpen(true);
  };

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      setMyTaskDetail({});
      setMeetingDetail(undefined);
      setFirstTime(true);

      const fetchData = async () => {
        await fetchUserData();
        await fetchMyTaskDetail(id);
      };
      fetchData();
    }
    if (doc_id && comment && doc_name) {
      handlePreview(
        `${process.env.REACT_APP_API_URL}/files/${doc_id}`,
        doc_name,
        comment
      );
      //   <DocumentPreview
      //   isOpen={isPreviewOpen}
      //   onClose={() => setIsPreviewOpen(false)}
      //   documentUrl={previewFileUrl}
      //   documentTitle={previewFileName}
      //   taskId={id}
      // />
    }
  }, [id]);

  useEffect(() => {
    if (firstTime && myTaskDetail.status) {
      console.log("this is first time", JSON.stringify(myTaskDetail));
      if (myTaskDetail.status == "Assigned") handleInProgress();
      if (myTaskDetail.meeting_id) fetchMeetingDetails();
      setFirstTime(false);
    }
  }, [myTaskDetail]);

  useEffect(() => {
    if (user && myTaskDetail.id) {
      fetchSimilarTaskUsers();
      requestAIHelp(id);
    }
  }, [user, myTaskDetail, id]);

  useEffect(() => {
    // if (meetingDetail)
    if (myTaskDetail.status === "In Progress") {
      if (myTaskDetail.assigned_id === user.id) {
        // if (meetingDetail.is_owner) {
        setUserStatus(1);
        // } else {
        //   setUserStatus(2);
        // }
      } else {
        // if (meetingDetail.is_owner) {
        setUserStatus(3);
        // } else {
        //   setUserStatus(4);
        // }
      }
    } else if (myTaskDetail.status === "Ready For Review") {
      if (
        myTaskDetail.assigned_id === user.id &&
        (myTaskDetail.owner_id === myTaskDetail.assigned_id ||
          meetingDetail?.org_id === myTaskDetail.assigned_id)
      ) {
        setUserStatus(4);
      } else if (myTaskDetail.assigned_id === user.id) {
        // if (meetingDetail.is_owner) {
        setUserStatus(5);
        // } else {
        //   setUserStatus(6);
        // }
      } else {
        // if (meetingDetail.is_owner) {
        setUserStatus(7);
        // } else {
        //   setUserStatus(8);
        // }
      }
    } else if (myTaskDetail.status === "Completed") {
      if (
        myTaskDetail.assigned_id === user.id &&
        (myTaskDetail.owner_id === myTaskDetail.assigned_id ||
          meetingDetail?.org_id === myTaskDetail.assigned_id)
      ) {
        setUserStatus(8);
      } else if (myTaskDetail.assigned_id === user.id) {
        // if (meetingDetail.is_owner) {
        setUserStatus(9);
        // } else {
        //   setUserStatus(10);
        // }
      } else {
        // if (meetingDetail.is_owner) {
        setUserStatus(11);
        // } else {
        //   setUserStatus(12);
        // }
      }
    } else if (myTaskDetail.status === "Rated") {
      if (myTaskDetail.assignee_id === user.id) {
        // if (meetingDetail.is_owner) {
        setUserStatus(13);
        // } else {
        //   setUserStatus(14);
        // }
      } else {
        // if (meetingDetail.is_owner) {
        setUserStatus(15);
        // } else {
        //   setUserStatus(16);
        // }
      }
    }
  }, [myTaskDetail]);

  const handleInProgress = async () => {
    try {
      console.log("handleInProgress");
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/tasks/update-status`,
        {
          id: myTaskDetail.id,
          status: "In Progress",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        setMyTaskDetail({ ...myTaskDetail, status: response.data.task.status });
      }
    } catch (error) {
      toast.error("Failed to update task status");
      console.error("Error submitting review:", error);
    }
  };

  const fetchMeetingDetails = async () => {
    try {
      const token = localStorage.getItem("token");

      const { data } = await axios.get(
        `${process.env.REACT_APP_API_URL}/meeting/meeting_details`,
        {
          params: { meetingId: myTaskDetail.meeting_id },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (data.success) {
        setMeetingDetail(data.meeting);
      }
    } catch (error) {
      console.error("Error fetching meeting details:", error);
    } finally {
      setIsLoading(false);
    }
  };
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
        setUser(userData);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRecommendation = async (thread) => {
    if (isRecommendLoading) return;

    setIsRecommendLoading(true);
    setError(null);

    try {
      if (
        thread.reply_from == null &&
        thread.workflow_link &&
        (thread.task_message == "Your request is Approved" ||
          thread.task_message == "Your request is Rejected" || thread.id == 1) 
      ) {
        setRecommendation("Go to Workflow Details");
      } else {
        const token = localStorage.getItem("token");
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/tasks/thread-recommendation`,
          {
            task_id: thread.task_id,
            threadMessage: thread.task_message,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data.success) {
          setRecommendation(response.data.recommendation);
        } else {
          setError("Failed to get recommendation");
        }
      }
    } catch (error) {
      console.error("Error getting thread recommendation:", error);
      setError("An error occurred while getting recommendation");
    } finally {
      setIsRecommendLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    setUploadMessage(message);
    setSelectedFile(file);
    setIsModalOpen(true);
    setFinalFileName("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);

    const originalName = file.name;
    // const ext = originalName.split('.').pop();
    const baseName = originalName.replace(/\.[^/.]+$/, "");

    setEditedName(baseName);
    setFinalFileName(`${baseName}`);
  };

  const handleCloseModal = () => {
    setFinalFileName("");
    setIsModalOpen(false);
    setSelectedFile(null);
  };

  const fetchMyTaskDetail = async (currentTaskId = id) => {
    try {
      const result = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/get-task-details`,
        { taskId: currentTaskId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (result.data.success) {
        const tasks = result.data.task.threads
        .map((thread) => {
          if (
            thread.reply_from == null &&
            thread.workflow_link
          ) {
            return { ...thread, recommendation: "Go to Workflow Details" };
          }
          else return thread;
        })
          .sort(
            (a, b) => new Date(a.task_created_at) - new Date(b.task_created_at)
          );
          console.log("test : ", tasks );
        const lastthread = tasks[tasks.length - 1];

        await getRecommendation(lastthread);
        setMyTaskDetail({...result.data.task, threads: tasks});
      } else {
        navigate("/404");
      }
    } catch (error) {
      console.error("Error fetching task details:", error);
      navigate("/404");
    }
  };

  const handleSendMessage = async (upload = false) => {
    const upMessage = upload ? uploadMessage : message;
    if (!upMessage.trim()) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // If we're editing a message, use a different endpoint
      if (editingThread) {
        const token = localStorage.getItem("token");
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/tasks/update-message`,
          {
            threadId: editingThread.task_threads_id,
            message: upMessage,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data.success) {
          toast.success("Message updated successfully");
          setEditingThread(null);
          setMessage("");
          // Refresh task details to update the thread list
          await fetchMyTaskDetail(id);
        }
      } else {
        console.log("insert-message-task", upMessage, "send message");
        // Regular message or reply
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("taskId", myTaskDetail.id);
        formData.append("message", upMessage);
        formData.append("customFileName", finalFileName);
        // formData.append('message', uploadMessage);
        formData.append(
          "reply_from",
          replyToThread ? replyToThread.task_threads_id : null
        );

        // Add mentioned users if any
        if (mentionedUsers.length > 0) {
          formData.append("mentionedUsers", JSON.stringify(mentionedUsers));
        }

        const token = localStorage.getItem("token");

        await axios.post(
          `${process.env.REACT_APP_API_URL}/tasks/insert-message-task`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            },
          }
        );

        // Clear the message input and reset state
        setMessage("");
        setUploadMessage("");
        setSelectedFile(null);
        setIsModalOpen(false);
        setReplyToThread(null);
        setMentionedUsers([]); // Clear mentioned users
        setFinalFileName("");

        // Refresh task details to update the thread list
        await fetchMyTaskDetail(id);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsUploading(false);
    }
  };
  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        userSuggestionsRef.current &&
        !userSuggestionsRef.current.contains(event.target)
      ) {
        setShowUserSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const getPriorityColor = (priority) => {
    const colors = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-green-100 text-green-800",
    };
    return colors[priority?.toLowerCase()] || colors.medium;
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      inprogress: "bg-blue-100 text-blue-800",
    };
    return colors[status?.toLowerCase()] || colors.pending;
  };

  const formatFileSize = (size) => {
    if (!size) return "0 B";
    if (size < 1024) return `${size} B`;
    else if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    else return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleReviewClick = async () => {
    const token = localStorage.getItem("token");
    if (message) await handleSendMessage(false);
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/tasks/update-status`,
      {
        ...myTaskDetail,
        taskId: myTaskDetail.id,
        meetingId: myTaskDetail.meeting_id,
        status:
          myTaskDetail.status === "Ready For Review"
            ? "In Progress"
            : "Ready For Review",
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    setMyTaskDetail((prev) => {
      return { ...prev, status: "Ready For Review" };
    });
  };

  const handleCompleteClick = async () => {
    const token = localStorage.getItem("token");
    await handleSendMessage(false);
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/tasks/update-status`,
      {
        ...myTaskDetail,
        taskId: myTaskDetail.id,
        meetingId: myTaskDetail.meeting_id,
        status: "Completed",
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (response.data.success) {
      setMyTaskDetail({ ...myTaskDetail, status: response.data.task.status });
    }
  };

  const handleCantComplete = async () => {
    const token = localStorage.getItem("token");
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/tasks/update-status`,
      {
        ...myTaskDetail,
        taskId: myTaskDetail.id,
        meetingId: myTaskDetail.meeting_id,
        status: "In Progress",
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (response.data.success) {
      setMyTaskDetail({ ...myTaskDetail, status: response.data.task.status });
    }
  };

  const handleFavouriteClick = (threadId, currentStatus, originalName) => {
    if (!currentStatus) {
      setFavouriteInput(originalName);
      setSelectedThread({ threadId, currentStatus, originalName });
      setIsFavouriteModalOpen(true); // open modal
    } else {
      // directly unfavourite without modal
      updateFavourite(threadId, currentStatus, originalName);
    }
  };
  const updateFavourite = async (threadId, currentStatus, originalName) => {
    try {
      const token = localStorage.getItem("token");
      let customName = originalName;

      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/favourite`,
        {
          threadId,
          isFavourite: !currentStatus,
          favouriteFileName: customName,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.data.success) {
        // Update local state with new favourite status
        setMyTaskDetail((prev) => ({
          ...prev,
          threads: prev.threads.map((thread) =>
            thread.task_threads_id === threadId
              ? { ...thread, is_favourite_doc: !currentStatus }
              : thread
          ),
        }));
      }
    } catch (err) {
      console.error("Failed to update favorite:", err);
    }
  };

  // Handle @ mention
  const handleMessageChange = async (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    // Get cursor position
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);

    // Check for @ mentions
    const lastAtSymbolIndex = newMessage.lastIndexOf("@", cursorPos);

    // Handle @ mentions
    if (lastAtSymbolIndex !== -1) {
      const textAfterAt = newMessage.substring(
        lastAtSymbolIndex + 1,
        cursorPos
      );

      // If there's text after @ and no space, show suggestions
      if (textAfterAt && !textAfterAt.includes(" ")) {
        try {
          const token = localStorage.getItem("token");
          // const response = await axios.post(
          //   `${process.env.REACT_APP_API_URL}/tasks/search-users`,
          //   {
          //     params: { query: textAfterAt },
          //     headers: { Authorization: `Bearer ${token}` },
          //   }
          // );

          const response = await axios.get(
            `${process.env.REACT_APP_API_URL}/documents/users/search`,
            {
              params: { query: textAfterAt, taskId: myTaskDetail.id },
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.data.success) {
            setUserSuggestions(response.data.users || []);
            setShowUserSuggestions(true);
          }
        } catch (error) {
          console.error("Error fetching user suggestions:", error);
        }
      } else {
        setShowUserSuggestions(false);
      }
    } else {
      setShowUserSuggestions(false);
    }
  };

  const handleSelectUser = (user) => {
    // Check if we're in the main message or upload message
    const isUploadMessage = document.activeElement?.value === uploadMessage;
    const currentMessage = isUploadMessage ? uploadMessage : message;
    const lastAtSymbolIndex = currentMessage.lastIndexOf("@", cursorPosition);

    if (lastAtSymbolIndex !== -1) {
      const beforeAt = currentMessage.substring(0, lastAtSymbolIndex);
      const afterCursor = currentMessage.substring(cursorPosition);

      // Replace the @mention with the selected user
      const newMessage = `${beforeAt}@${user.name
        .split(" ")[0]
        .toLowerCase()} ${afterCursor}`;

      if (isUploadMessage) {
        setUploadMessage(newMessage);
      } else {
        setMessage(newMessage);
      }

      // Add to mentioned users if not already included
      if (!mentionedUsers.some((u) => u.id === user.id)) {
        setMentionedUsers([
          ...mentionedUsers,
          {
            id: user.id,
            username: user.name,
            name: user.name,
            avatar: user.avatar,
            email: user.email,
            bio: user.bio,
            phone: user.phone,
            location: user.location,
          },
        ]);
      }
    }

    setShowUserSuggestions(false);
    if (isUploadMessage) {
      document.activeElement?.focus();
    } else {
      messageInputRef.current?.focus();
    }
  };

  const handleUploadMessageChange = async (e) => {
    const newMessage = e.target.value;
    setUploadMessage(newMessage);

    // Get cursor position
    const cursorPos = e.target.selectionStart;

    // Check for @ mentions
    const lastAtSymbolIndex = newMessage.lastIndexOf("@", cursorPos);

    // Handle @ mentions
    if (lastAtSymbolIndex !== -1) {
      const textAfterAt = newMessage.substring(
        lastAtSymbolIndex + 1,
        cursorPos
      );

      // If there's text after @ and no space, show suggestions
      if (textAfterAt && !textAfterAt.includes(" ")) {
        try {
          const token = localStorage.getItem("token");

          const response = await axios.get(
            `${process.env.REACT_APP_API_URL}/documents/users/search`,
            {
              params: { query: textAfterAt, taskId: myTaskDetail.id },
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.data.success) {
            setUserSuggestions(response.data.users || []);
            setShowUserSuggestions(true);
          }
        } catch (error) {
          console.error("Error fetching user suggestions:", error);
        }
      } else {
        setShowUserSuggestions(false);
      }
    } else {
      setShowUserSuggestions(false);
    }
  };

  const handleRating = async () => {
    try {
      const token = localStorage.getItem("token");
      if (messageForReview === "") {
        toast("A review is required.");
        return;
      }
      if (rateForReview === 0) {
        toast("Please select a rating between 1 and 5");
        return;
      }
      console.log(myTaskDetail);
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/tasks/update`,
        {
          ...myTaskDetail,
          taskId: myTaskDetail.id,
          meetingId: myTaskDetail.meeting_id,
          assigned_id: myTaskDetail.assigned_id,
          assigned_name: myTaskDetail.assigned_name,
          rate: rateForReview,
          review: messageForReview,
          status: "Rated",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        setMyTaskDetail({
          ...myTaskDetail,
          review: messageForReview,
          rate: rateForReview,
          status: response.data.task.status,
        });
      }
    } catch (error) {
      console.error("Error submitting review:", error);
    }
  };
  const handleCloseReviewModal = () => {
    setIsReviewModalOpen(false);
  };

  const handleTitleClick = () => {
    if (myTaskDetail.meeting_id) {
      navigate(`/meeting-detail?id=${myTaskDetail.meeting_id}`);
    }
  };

  const fetchSimilarTaskUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/tasks/similar-users/${myTaskDetail.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSimilarTaskUsers(response.data);
    } catch (error) {
      console.error("Error fetching similar task users:", error);
      toast.error("Failed to fetch potential helpers");
    } finally {
    }
  };

  const requestHelp = async (helperId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/request-help`,
        {
          taskId: myTaskDetail.id,
          helperId: helperId,
          taskTitle: myTaskDetail.title,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Help request sent successfully");
    } catch (error) {
      console.error("Error requesting help:", error);
      toast.error("Failed to send help request");
    }
  };

  const handleShowHelpUser = (task) => {
    const user = {
      id: task.assigneeId,
      name: task.assigneeName,
      avatar: task.assigneeAvatar,
      email: task.assigneeEmail,
      bio: task.assigneeBio,
      phone: task.assigneePhone,
      location: task.assigneeLocation,
    };
    setSelectedUser(user);
    setIsDrawerOpen(true);
  };

  const handleAssigneeClick = () => {
    // Only meeting owner can reassign tasks
    if (
      (meetingDetail && meetingDetail.is_owner) ||
      user.id == myTaskDetail.owner_id
    ) {
      setIsReassignmentPopupOpen(true);
    }
  };

  const handleOwnerClick = () => {
    // Only meeting owner or task owner can change the task owner
    if (
      (meetingDetail && meetingDetail.is_owner) ||
      (user && myTaskDetail.owner_id && user.id === myTaskDetail.owner_id)
    ) {
      setIsOwnerReassignmentPopupOpen(true);
    }
  };

  const handleAssigneeChange = (userId, userName) => {
    setMyTaskDetail((prev) => ({
      ...prev,
      assigned_id: userId,
      assigned_name: userName,
    }));
    fetchMyTaskDetail();
  };

  const handleOwnerChange = (userId, userName) => {
    setMyTaskDetail((prev) => ({
      ...prev,
      owner_id: userId,
      owner_name: userName,
    }));
    fetchMyTaskDetail();
  };

  const handleGenerateScore = async () => {
    try {
      setIsGeneratingScore(true);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/score-tasks`,
        { taskId: myTaskDetail.id },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setMyTaskDetail({
          ...myTaskDetail,
          alignment_score: response.data.data.score,
          alignment_reason: response.data.data.reason,
        });
        toast.success("Alignment score generated successfully");
        setShowScoreModal(true);
      }
    } catch (error) {
      toast.error("Failed to generate alignment score");
      console.error("Error generating alignment score:", error);
    } finally {
      setIsGeneratingScore(false);
    }
  };

  const handleDeleteTask = async () => {
    try {
      setIsDeletingTask(true);
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `${process.env.REACT_APP_API_URL}/tasks/delete/${myTaskDetail.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success("Task was deleted successfully!");
        navigate(`/task-dashboard`);
      }
    } catch (error) {
      toast.error("Failed to delete task");
      console.error("Error Delete task:", error);
    } finally {
      setIsDeletingTask(false);
    }
  };

  const handleStartWorkflow = async () => {
    if (!selectedWorkflow) {
      toast.error("Please select a workflow");
      return;
    }

    setIsStartingWorkflow(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/workflow/webhook`,
        {
          workflowName: selectedWorkflow.name,
          basic_data: {
            taskId: id,
            taskTitle: myTaskDetail.title,
            taskDescription: myTaskDetail.description,
            assignedTo: myTaskDetail.assigned_name,
            owner: myTaskDetail.owner_name,
            companyId: meetingDetail?.company_id,
          },
        }
      );

      if (response.data.success) {
        setIsWorkflowModalOpen(false);
        setSelectedWorkflow(null);
      } else {
        toast.error("Failed to start workflow");
      }
    } catch (error) {
      console.error("Error starting workflow:", error);
      toast.error("Error starting workflow");
    } finally {
      setIsStartingWorkflow(false);
    }
  };

  // Handle reply to a thread
  const handleReplyToThread = (thread) => {
    setReplyToThread(thread);
    // Focus on the message input
    document.current?.focus();
  };

  // Cancel reply
  const handleCancelReply = () => {
    setReplyToThread(null);
  };

  // Handle edit thread message
  const handleEditThread = (thread) => {
    setEditingThread(thread);
    setMessage(thread.task_message);
    // Focus on the message input
    document.current?.focus();
  };

  // Handle delete thread message
  const handleDeleteThread = async (thread) => {
    if (!window.confirm("Are you sure you want to delete this message?"))
      return;

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/delete-message`,
        { threadId: thread.task_threads_id },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success("Message deleted successfully");
        // Refresh task details to update the thread list
        await fetchMyTaskDetail(id);
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  // Scroll to a specific thread when replying
  const scrollToThread = (threadId) => {
    console.log("thread ID", threadId);
    setHighlightedThreadId(threadId);
    setTimeout(() => {
      const element = document.getElementById(`thread-${threadId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // Remove highlight after a delay
      setTimeout(() => setHighlightedThreadId(null), 3000);
    }, 100);
  };

  const renderMentions = (content, mentioned_users) => {
    if (!content) return content;

    // Split content into parts, including mentions
    const parts = content.split(/ (?=@)| /);

    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        // Find the user with username matching the mention (case-insensitive)
        const username = part.slice(1); // remove '@'
        const user = mentioned_users?.find(
          (u) =>
            u.username.split(" ")[0].toLowerCase() === username.toLowerCase()
        );

        if (user) {
          return (
            <span
              key={index}
              className="inline-block px-1 py-0.5 text-blue-700 rounded cursor-pointer"
              onClick={() => {
                console.log(user);
                setSelectedUser(user);
                setIsDrawerOpen(true);
              }}
            >
              {part}
            </span>
          );
        } else {
          // If no matching user found, render normally
          return (
            <span
              key={index}
              className="inline-block px-1 py-0.5 text-gray-700 rounded"
            >
              {`${part} `}
            </span>
          );
        }
      }
      return `${part} `;
    });
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <Navbar isAuthenticated={true} user={user} />
      <div className="flex-1 overflow-auto">
        <main className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Header */}
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Task Details
            </h1>
          </header>

          {/* Task Details Card */}
          <div className="bg-white rounded-lg shadow-sm mb-6 overflow-hidden">
            <div className="p-4 sm:p-6">
              {/* Title and Description */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-blue-900 font-medium">Task:</p>
                    <h2
                      className="text-xl font-semibold text-gray-900 "
                      // onClick={handleTitleClick}
                    >
                      {`${myTaskDetail.title}`}
                    </h2>
                  </div>

                  {myTaskDetail.meeting_title && (
                    <div className="flex items-center space-x-2 mt-2">
                      <p className="text-blue-900 font-medium">
                        Meeting:{" "}
                        <span
                          className="text-sm text-blue-600 font-semibold underline cursor-pointer"
                          onClick={handleTitleClick}
                        >
                          {myTaskDetail.meeting_title}
                        </span>
                      </p>
                    </div>
                  )}

                  <div></div>
                  <p className="mt-2 text-gray-600">
                    {myTaskDetail.description}
                  </p>
                </div>

                {/* Task Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  {/* Left Column */}
                  <div className="flex flex-col gap-4">
                    {/* Status */}
                    <div>
                      <span className="text-sm text-gray-500">Status</span>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                            myTaskDetail.status
                          )}`}
                        >
                          {myTaskDetail.status}
                        </span>
                      </div>
                    </div>
                    {/* Task Owner */}
                    <div>
                      <span className="text-sm text-gray-500">Task Owner</span>
                      <p
                        className={`mt-1 text-gray-700 ${
                          (meetingDetail && meetingDetail.is_owner) ||
                          (user &&
                            myTaskDetail.owner_id &&
                            user.id === myTaskDetail.owner_id)
                            ? "cursor-pointer hover:text-blue-600"
                            : ""
                        }`}
                        onClick={handleOwnerClick}
                      >
                        {myTaskDetail.owner_name ||
                          myTaskDetail.meeting_owner_name ||
                          "Unassigned"}
                      </p>
                    </div>
                    {/* Due Date */}
                    <div>
                      <span className="text-sm text-gray-500">Due Date</span>
                      <p className="mt-1">
                        {myTaskDetail.duedate
                          ? format(
                              new Date(myTaskDetail.duedate),
                              "MMM dd, yyyy"
                            )
                          : "—"}
                      </p>
                    </div>
                    {/* Category */}
                    <div>
                      <span className="text-sm text-gray-500">Category</span>
                      <p className="mt-1 flex gap-3 flex-wrap">
                        {myTaskDetail.category
                          ? myTaskDetail.category
                              .split(",")
                              .map((category, index) => (
                                <span
                                  key={index}
                                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-medium fit-content"
                                >
                                  {category.trim()}
                                </span>
                              ))
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Middle Column */}
                  <div className="flex flex-col gap-4">
                    {/* Priority */}
                    <div>
                      <span className="text-sm text-gray-500">Priority</span>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(
                            myTaskDetail.priority
                          )}`}
                        >
                          {myTaskDetail.priority}
                        </span>
                      </div>
                    </div>
                    {/* Assigned To */}
                    <div>
                      <span className="text-sm text-gray-500">Assigned To</span>
                      <p
                        className={`mt-1 text-gray-700 ${
                          (meetingDetail && meetingDetail.is_owner) ||
                          user.id == myTaskDetail.owner_id
                            ? "cursor-pointer hover:text-blue-600"
                            : ""
                        }`}
                        onClick={handleAssigneeClick}
                      >
                        {myTaskDetail.assigned_name || "Unassigned"}
                      </p>
                    </div>
                    {/* Average Time */}
                    <div>
                      <span className="text-sm text-gray-500">
                        Est. Completion
                      </span>
                      <p className="mt-1 flex gap-3 flex-wrap">
                        {myTaskDetail.average_time
                          ? myTaskDetail.average_time + " day"
                          : "—"}
                      </p>
                    </div>
                    {/* Alignment Score */}
                    <div>
                      <span className="text-sm text-gray-500">
                        Alignment Score
                      </span>
                      <div className="mt-1">
                        {myTaskDetail.alignment_score ? (
                          <div
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setShowScoreModal(true)}
                          >
                            <div className="flex items-center">
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                  className={`h-2.5 rounded-full ${
                                    myTaskDetail.alignment_score >= 70
                                      ? "bg-green-500"
                                      : myTaskDetail.alignment_score >= 40
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                  }`}
                                  style={{
                                    width: `${myTaskDetail.alignment_score}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="ml-2 text-sm">
                                {myTaskDetail.alignment_score}%
                              </span>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={handleGenerateScore}
                            disabled={isGeneratingScore}
                            className={`$${
                              isGeneratingScore
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-blue-500 bg-blue-600"
                            } text-white px-4 py-2 rounded-md transition duration-200 flex items-center gap-2 cursor-pointer`}
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
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Hours of Work & Est Cost */}
                  <div className="flex flex-col gap-4 items-start">
                    <div>
                      <span className="text-sm text-gray-500">
                        Hours of Work
                      </span>
                      <p className="mt-1 flex gap-3 flex-wrap">
                        {myTaskDetail.estimated_hours !== undefined &&
                        myTaskDetail.estimated_hours !== null
                          ? myTaskDetail.estimated_hours +
                            " hour" +
                            (myTaskDetail.estimated_hours === 1 ? "" : "s")
                          : "—"}
                      </p>
                    </div>
                    {/* Est Cost - Only show if company allows it */}
                    {myTaskDetail.show_cost_estimates && (
                      <div>
                        <span className="text-sm text-gray-500">Est Cost</span>
                        <p className="mt-1 flex gap-3 flex-wrap">
                          {myTaskDetail.estimated_hours !== undefined &&
                          myTaskDetail.estimated_hours !== null &&
                          myTaskDetail.est_cph !== undefined &&
                          myTaskDetail.est_cph !== null
                            ? `$${(
                                parseFloat(myTaskDetail.estimated_hours) *
                                parseFloat(myTaskDetail.est_cph)
                              ).toFixed(2)}`
                            : "—"}
                        </p>
                      </div>
                    )}

                    {/* Delete Task */}
                    <div>
                      {(user?.id == myTaskDetail?.owner_id ||
                        user?.id == meetingDetail?.org_id) && (
                        <button
                          onClick={handleDeleteTask}
                          disabled={isDeletingTask}
                          className={`$${
                            isDeletingTask
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-blue-500 bg-blue-600"
                          } text-white px-4 py-2 rounded-md transition duration-200 flex items-center gap-2 cursor-pointer`}
                        >
                          {isDeletingTask ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Deleting Task...
                            </>
                          ) : (
                            "Delete Task"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rating Section (if task is rated) */}
              {myTaskDetail.status === "Rated" && (
                <div className="bg-gray-100 p-4 rounded-lg mt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Review:
                      </h3>
                      <p className="text-gray-700">{myTaskDetail.review}</p>
                    </div>
                    <div className="flex items-center">
                      <Rating
                        value={myTaskDetail.rate}
                        readOnly
                        className="max-w-[140px]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-6 flex-wrap md:flex-nowrap">
            <div className="w-full md:w-1/2">
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Discussion
                  </h3>

                  <div className="space-y-4">
                    {!myTaskDetail.threads ||
                    myTaskDetail.threads?.length === 0 ? (
                      <p className="text-gray-500">There are no comments.</p>
                    ) : (
                      myTaskDetail.threads
                        .sort(
                          (a, b) =>
                            new Date(a.task_created_at) -
                            new Date(b.task_created_at)
                        )
                        .map((thread, index, threads) => (
                          <div
                            key={index}
                            id={`thread-${thread.task_threads_id}`}
                            className={`flex gap-4 pb-4 border-b border-gray-200 ${
                              thread.id === user.id || thread.id === 1 ? "flex-row-reverse" : ""
                            } ${
                              highlightedThreadId === thread.task_threads_id
                                ? "bg-blue-50 p-2 rounded-lg transition-colors duration-500"
                                : ""
                            }`}
                          >
                            <div className="flex-shrink-0">
                              <AvatarPop participant={thread} />

                              {/* {thread.avatar ? (
                                <img
                                  src={`${process.env.REACT_APP_API_URL}/avatars/${thread.avatar}`}
                                  alt={thread.name}
                                  className="w-10 h-10 rounded-full"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                                  {thread.name.charAt(0)}
                                </div>
                              )} */}
                            </div>
                            <div
                              className={`flex-1 min-w-0 ${
                                thread.id === user.id || thread.id === 1 ? "text-right" : ""
                              }`}
                            >
                              <div
                                className={`flex items-center justify-between ${
                                  thread.id === user.id || thread.id === 1
                                    ? ""
                                    : "flex-row-reverse"
                                } `}
                              >
                                <div
                                  className={`flex items-center space-x-2 ${
                                    thread.id === user.id || thread.id === 1
                                      ? ""
                                      : "flex-row-reverse"
                                  } `}
                                >
                                  <ThreadMessageMenu
                                    thread={thread}
                                    onReply={handleReplyToThread}
                                    onEdit={handleEditThread}
                                    onDelete={handleDeleteThread}
                                    currentUserId={user?.id}
                                  />
                                  {thread.reply_from != -1 && (
                                    <button
                                      onClick={() =>
                                        scrollToThread(thread.reply_from)
                                      }
                                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                                    >
                                      <FaReply className="w-3 h-3 mr-1" />
                                      View original
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-gray-900">
                                  {thread.name}
                                </p>
                              </div>

                              {/* If this is a reply to another message, show the original message */}
                              {/* {thread.reply_from && (
                                <div 
                                  className="mt-1 mb-2 pl-2 border-l-2 border-gray-300 text-xs text-gray-500 cursor-pointer hover:border-blue-400"
                                  onClick={() => scrollToThread(thread.reply_from)}
                                >
                                  Replying to a message
                                </div>
                              )} */}

                              <p className="text-sm text-gray-500">
                                {thread.task_message
                                  .split(/\r\n/)
                                  .map((line, lineIndex) => (
                                    <React.Fragment key={lineIndex}>
                                      {line
                                        .split(/(\s+)/)
                                        .map((part, index) => {
                                          const urlPattern =
                                            /^(https?:\/\/[^\s]+)/;
                                          if (urlPattern.test(part)) {
                                            return (
                                              <a
                                                key={index}
                                                href={part}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 break-all hover:text-blue-800 hover:underline"
                                              >
                                                {part}
                                              </a>
                                            );
                                          }
                                          return renderMentions(
                                            part,
                                            thread.mentioned_users
                                          );
                                        })}
                                      {lineIndex <
                                        thread.task_message.split(/\r\n/)
                                          .length -
                                          1 && <br />}
                                    </React.Fragment>
                                  ))}
                              </p>
                              {thread.is_file && (
                                // Replace the simple download link with a file card that has preview and download options
                                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div className="p-2 bg-blue-100 rounded-md">
                                        <FaFile className="w-5 h-5 text-blue-600" />
                                      </div>
                                      <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-[250px]">
                                        {thread.task_file_origin_name}
                                      </span>
                                    </div>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() =>
                                          handlePreview(
                                            `${process.env.REACT_APP_API_URL}/files/${thread.task_file}`,
                                            thread.task_file_origin_name,
                                            null
                                          )
                                        }
                                        className="cursor-pointer p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                        title="Preview"
                                      >
                                        <FaEye className="w-4 h-4" />
                                      </button>
                                      <a
                                        href={`${process.env.REACT_APP_API_URL}/files/${thread.task_file}`}
                                        download={thread.task_file_origin_name}
                                        className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                        title="Download"
                                      >
                                        <FaDownload className="w-4 h-4" />
                                      </a>
                                      <button
                                        onClick={() =>
                                          handleFavouriteClick(
                                            thread.task_threads_id,
                                            thread.is_favourite_doc,
                                            thread.task_file_origin_name
                                          )
                                        }
                                        className=" cursor-pointer text-yellow-500 hover:scale-110 transition-transform"
                                        title={
                                          thread.is_favourite_doc
                                            ? "Unfavourite"
                                            : "Mark as Favourite"
                                        }
                                      >
                                        {thread.is_favourite_doc ? (
                                          <FaStar size={16} />
                                        ) : (
                                          <FaRegStar size={16} />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <ThreadFooter
                                thread={thread}
                                currentUser={user}
                                isRecommend={
                                  threads.length == index + 1 ? true : false
                                }
                                isRecommendLoading={isRecommendLoading}
                                recommendation={recommendation}
                                error={error}
                              />
                            </div>
                          </div>
                        ))
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="mt-4 flex gap-2 items-center flex-col sm:flex-row">
                    <div className="w-full">
                      {/* Show reply preview if replying to a message */}
                      <ThreadReplyPreview
                        replyToThread={replyToThread}
                        onCancelReply={handleCancelReply}
                      />

                      {editingThread && (
                        <div className="mb-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200 flex justify-between items-center">
                          <span className="text-sm text-yellow-700">
                            Editing message
                          </span>
                          <button
                            onClick={() => {
                              setEditingThread(null);
                              setMessage("");
                            }}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <div className="relative">
                        <textarea
                          ref={messageInputRef}
                          value={message}
                          onChange={handleMessageChange}
                          placeholder={
                            myTaskDetail.status !== "Rated" &&
                            myTaskDetail.status !== "Completed" &&
                            myTaskDetail.status !== "Ready For Review"
                              ? "Type your message... Use @ to mention users"
                              : ""
                          }
                          disabled={
                            myTaskDetail.status === "Rated" ||
                            myTaskDetail.status === "Completed" ||
                            myTaskDetail.status === "Ready For Review"
                          }
                          className="flex-1 w-full min-h-[80px] p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />

                        {/* User suggestions for @mentions */}
                        <UserSuggestions
                          suggestions={userSuggestions}
                          isVisible={showUserSuggestions}
                          onSelectUser={handleSelectUser}
                          suggestionsRef={userSuggestionsRef}
                          prefix="@"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex gap-[10px] flex-col">
                        <div className="flex gap-2 justify-center">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="file"
                              onChange={handleFileUpload}
                              className="hidden"
                              disabled={
                                myTaskDetail.status === "Rated" ||
                                myTaskDetail.status === "Completed" ||
                                myTaskDetail.status === "Ready For Review"
                              }
                            />
                            <span
                              className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                myTaskDetail.status === "Rated" ||
                                myTaskDetail.status === "Completed" ||
                                myTaskDetail.status === "Ready For Review"
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <FaFile className="w-5 h-5" />
                            </span>
                          </label>
                          <button
                            onClick={() => handleSendMessage(false)}
                            disabled={
                              !message.trim() ||
                              myTaskDetail.status === "Rated" ||
                              myTaskDetail.status === "Completed" ||
                              myTaskDetail.status === "Ready For Review"
                            }
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            <FaPaperPlane className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        {(userStatus === 6 ||
                          userStatus === 2 ||
                          userStatus === 1) && (
                          <div className="">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                onClick={() => handleReviewClick()}
                                checked={
                                  myTaskDetail.status === "Ready For Review"
                                }
                              />
                              <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
                              <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                                Ready for review
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                      {(userStatus === 7 || userStatus === 4) && (
                        <div className="">
                          <label className="inline-flex items-center cursor-pointer">
                            <button
                              onClick={() => handleCompleteClick()}
                              className="cursor-pointer px-4 py-2 bg-blue-600 w-full flex text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <FaCheckCircle className="w-5 h-5" />
                              <span className="ms-3 w-full text-sm font-medium text-gray-900 dark:text-gray-300 text-white">
                                Review
                              </span>
                            </button>
                          </label>
                        </div>
                      )}
                      {(userStatus === 5 || userStatus === 4) && (
                        <div className="flex flex-col gap-2">
                          <div className="text-blue-500 text-center">
                            {userStatus !== 4 && `Submitted for review`}
                          </div>
                          <label className="inline-flex items-center cursor-pointer">
                            <button
                              onClick={() => handleCantComplete()}
                              className="px-4 py-2 bg-blue-600 flex text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <FaTimesCircle className="w-5 h-5" />
                              <span className="cursor-pointer ms-3 w-full text-sm font-medium text-gray-900 dark:text-gray-300 text-white">
                                Cancel Review
                              </span>
                            </button>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Help Task */}
            <div className="md:w-1/2 w-full">
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Task Help
                  </h3>

                  {/* AI Help Section */}
                  <div className="mb-6">
                    {/* <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium text-gray-900">Need help with this task?</h4>
                      <button
                        onClick={requestAIHelp}
                        disabled={isLoadingAiRecommendation}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {isLoadingAiRecommendation ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Getting Help...
                          </>
                        ) : (
                          'Get AI Help'
                        )}
                      </button>
                    </div> */}

                    {/* {aiRecommendation && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="prose max-w-none">
                          {aiRecommendation}
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(aiRecommendation);
                              toast.success('Response copied to clipboard');
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Copy to clipboard
                          </button>
                        </div>
                      </div>
                    )} */}
                  </div>

                  {/* Related Tasks and AI Help Section */}
                  <div
                    className={`mb-6 space-y-6 ${
                      !similarTaskUsers.similarTasks ? "none" : ""
                    }`}
                  >
                    {/* Related Tasks Section */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        Similar Tasks
                      </h4>
                      <div className="space-y-3">
                        {similarTaskUsers.similarTasks?.map((task, index) => (
                          <div
                            key={index}
                            className="bg-gray-50 rounded-lg p-4"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div
                                className="text-blue-600 hover:text-blue-800 font-bold block cursor-pointer underline"
                                onClick={() =>
                                  navigate(`/task-details?id=${task.id}`)
                                }
                              >
                                {task.title}
                              </div>
                              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                Match: {task.matchScore}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {task.description}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                  Rating: {task.rate}★
                                </span>
                                <span className="text-sm text-gray-500">
                                  Status: {task.status}
                                </span>
                                <div
                                  onClick={() => handleShowHelpUser(task)}
                                  className="text-sm text-blue-500 cursor-pointer"
                                >
                                  Assignee: {task.assigneeName}
                                </div>
                              </div>
                            </div>
                            {task.review && (
                              <div className="mt-2 p-2 bg-white rounded border border-gray-100">
                                <p className="text-sm text-gray-600 italic">
                                  <span className="font-medium">Review:</span> "
                                  {task.review}"
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                        {(!similarTaskUsers.similarTasks ||
                          similarTaskUsers.similarTasks.length === 0) && (
                          <div className="text-center text-gray-500 py-4">
                            No similar tasks found.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Recommendation Section */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <FaRobot className="w-5 h-5 text-purple-600" />
                        <h4 className="text-lg font-semibold text-gray-900">
                          AI Recommendations
                        </h4>
                      </div>
                      {isLoadingAiRecommendation ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                        </div>
                      ) : aiRecommendation ? (
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-wrap text-gray-700 bg-purple-50 rounded-lg p-4">
                            {aiRecommendation}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-600 text-sm">
                          AI recommendations will appear here to help you with
                          this task.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {(userStatus === 11 || userStatus === 8) && isReviewModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0004]">
          <div className="bg-white rounded-lg p-4 shadow-lg relative max-w-md w-full mx-4">
            {/* Review Section as Modal */}
            <div className="mt-4">
              <div className="flex mb-4 items-center">
                <h2 className="text-xl font-semibold text-gray-900">Review</h2>
                <span className="ml-2 text-sm text-gray-500">(Required)</span>
              </div>
              <div className="flex flex-col gap-4 w-full justify-center mt-3 p-4 bg-gray-100 rounded-lg shadow-md border border-gray-300">
                <div className="flex items-center gap-2 flex-col w-full">
                  <textarea
                    value={messageForReview}
                    onChange={(e) => setMessageForReview(e.target.value)}
                    placeholder="Type your review..."
                    className="flex-1 min-h-[80px] w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="flex gap-3">
                    <Rating
                      value={rateForReview}
                      onChange={(selectedValue) => {
                        setRateForReview(selectedValue);
                      }}
                      className="max-w-[140px]"
                    />
                    <button
                      onClick={handleRating}
                      className="px-4 py-2 cursor-pointer bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 ease-in-out shadow-md"
                    >
                      <FaCheck className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* End of Review Section */}
            <button
              onClick={handleCloseReviewModal}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      {isFavouriteModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0004] z-50">
          <div className="bg-white rounded-lg p-4 shadow-lg relative max-w-sm w-full mx-4">
            <button
              onClick={() => setIsFavouriteModalOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              <FaTimes className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold mb-2">Add to Favorites</h2>
            <input
              type="text"
              className="w-full border p-2 rounded"
              value={favouriteInput}
              onChange={(e) => setFavouriteInput(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
                onClick={() => setIsFavouriteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={async () => {
                  await updateFavourite(
                    selectedThread.threadId,
                    selectedThread.currentStatus,
                    favouriteInput.trim()
                  );

                  setIsFavouriteModalOpen(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal for file upload confirmation */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0004]">
          <div className="bg-white rounded-lg p-4 shadow-lg relative max-w-md w-full mx-4">
            <button
              onClick={handleCloseModal}
              disabled={isUploading}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 disabled:opacity-50"
            >
              <FaTimes className="w-5 h-5" />
            </button>
            +<h2 className="text-lg font-semibold">Upload File</h2>
            <div className="mt-2 flex items-center">
              <div className="w-20 h-20 flex items-center justify-center bg-blue-100 rounded-lg">
                {isUploading ? (
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                ) : (
                  <FaFile className="w-10 h-10 text-blue-600" />
                )}
              </div>
              <div className="ml-2">
                {selectedFile && (
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <input
                        className="border p-1 text-sm rounded"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const ext = selectedFile.name.split(".").pop();
                            setFinalFileName(`${editedName}`);
                            setIsEditingName(false);
                          }
                        }}
                        onBlur={() => {
                          const ext = selectedFile.name.split(".").pop();
                          setFinalFileName(`${editedName}`);
                          setIsEditingName(false);
                        }}
                        autoFocus
                      />
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          {finalFileName ||
                            setFinalFileName(selectedFile.name.split(".")[0])}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            // Remove the extension when entering edit mode
                            setEditedName(finalFileName);

                            setIsEditingName(true);
                          }}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          ✏️
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* set here edit icon when user clicks on that icon they can edit the existing name  */}
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedFile?.size)}
                </p>
              </div>
            </div>
            {isUploading && (
              <div className="mt-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-blue-700">
                    Uploading...
                  </span>
                  <span className="text-sm font-medium text-blue-700">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-2 items-center">
              <div className="flex-1 relative">
                <textarea
                  value={uploadMessage}
                  onChange={handleUploadMessageChange}
                  placeholder="Type your message... Use @ to mention users"
                  disabled={isUploading}
                  className="w-full min-h-[80px] p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                />
                {/* User suggestions for @mentions */}
                <UserSuggestions
                  suggestions={userSuggestions}
                  isVisible={showUserSuggestions}
                  onSelectUser={handleSelectUser}
                  suggestionsRef={userSuggestionsRef}
                  prefix="@"
                />
              </div>
              <button
                onClick={() => handleSendMessage(true)}
                disabled={!uploadMessage.trim() || isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <FaPaperPlane className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <UserProfileDrawer
        user={selectedUser}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      <TaskReassignmentPopup
        isOpen={isReassignmentPopupOpen}
        onClose={() => setIsReassignmentPopupOpen(false)}
        taskId={myTaskDetail.id}
        currentAssignee={myTaskDetail.assigned_name}
        onAssigneeChange={handleAssigneeChange}
        meetingId={myTaskDetail.meeting_id}
        myTaskDetail={myTaskDetail}
      />

      <TaskOwnerReassignmentPopup
        isOpen={isOwnerReassignmentPopupOpen}
        onClose={() => setIsOwnerReassignmentPopupOpen(false)}
        taskId={myTaskDetail.id}
        currentOwner={myTaskDetail.owner_name}
        onOwnerChange={handleOwnerChange}
        meetingId={myTaskDetail.meeting_id}
        myTaskDetail={myTaskDetail}
      />

      {showScoreModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0004]">
          <div className="bg-white rounded-lg p-4 shadow-lg relative max-w-md w-full mx-4">
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
                    className={`${
                      myTaskDetail.alignment_score >= 70
                        ? "text-green-600"
                        : myTaskDetail.alignment_score >= 40
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {myTaskDetail.alignment_score}%
                  </span>
                </div>
                <p className="text-gray-700">{myTaskDetail.alignment_reason}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <DocumentPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        documentUrl={previewFileUrl}
        documentTitle={previewFileName}
        taskId={id}
        commentId={commentId || null}
      />

      <Footer />
    </div>
  );
}

export default TaskDetails;
