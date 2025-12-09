import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginSuccess, loginFailure } from "../store/slices/authSlice";
import Navbar from "../components/Navbar";
import "./Notification.css";
import axios from "axios";
import Footer from "../components/Footer";
import EnhancedDataTable from "../components/DataTable/EnhancedDataTable";

function Notification() {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showShowMoreButton, setShowShowMoreButton] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 10;
  const notificationRefs = useRef({});

  useEffect(() => {
    if (!user) {
      fetchUserData();
    }
    const notificationCountLimit = localStorage.getItem("notificationCount");
    // getNotificationList(0, 5);
    // getNotificationList(0, notificationCountLimit);
    getNotificationList();
  }, []);

  // Helper function to extract meeting/task info from notification link
  const getRelatedInfo = (link) => {
    if (!link) return { type: "General", icon: "fas fa-bell" };

    if (link.includes("meeting-detail")) {
      return { type: "Meeting", icon: "fas fa-calendar" };
    } else if (link.includes("task-details")) {
      return { type: "Task", icon: "fas fa-tasks" };
    } else {
      return { type: "General", icon: "fas fa-bell" };
    }
  };

  // Helper function to extract task ID from notification message
  const extractTaskInfo = (notification) => {
    // Try to extract task ID from the notification link first
    if (notification.link && notification.link.includes("task-details")) {
      const taskIdMatch = notification.link.match(/id=(\d+)/);
      if (taskIdMatch) {
        return { taskId: taskIdMatch[1] };
      }
    }

    // If no link or can't extract from link, try to extract from message
    // This is for cases where we might need to fetch the task ID based on task name
    const taskMatch = notification.notification.match(/task '([^']+)'/);
    const meetingMatch = notification.notification.match(/meeting '([^']+)'/);

    if (taskMatch && meetingMatch) {
      return {
        taskName: taskMatch[1],
        meetingName: meetingMatch[1],
      };
    }

    return null;
  };

  // Helper function to extract meeting ID from notification
  const extractMeetingInfo = (notification) => {
    if (notification.link && notification.link.includes("meeting-detail")) {
      const meetingIdMatch = notification.link.match(/id=(\d+)/);
      if (meetingIdMatch) {
        return { meetingId: meetingIdMatch[1] };
      }
    }
    return null;
  };

  const extractCommentInfo = (notification) => {
    if (notification.link && notification.link.includes("task-details?id=")) {
      const commentIdMatch = notification.link;
      if (commentIdMatch) {
        return { commentId: commentIdMatch };
      }
    }
    return null;
  };

  // Function to get meeting ID from task ID
  const getMeetingIdFromTaskId = async (taskId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/get-task-details`,
        {
          taskId: taskId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success && response.data.task) {
        return response.data.task.meeting_id;
      }
      return null;
    } catch (error) {
      console.error("Error fetching task details:", error);
      return null;
    }
  };

  // Function to handle task navigation
  const handleTaskNavigation = async (taskInfo) => {
    if (taskInfo.taskId) {
      // Direct task ID available
      navigate(`/task-details?id=${taskInfo.taskId}`);
    } else if (taskInfo.taskName && taskInfo.meetingName) {
      // Need to find task ID based on name and meeting
      // You might need to implement an API endpoint for this
      console.log(
        "Navigate to task:",
        taskInfo.taskName,
        "in meeting:",
        taskInfo.meetingName
      );
      // For now, we could search for tasks or implement a search endpoint
    }
  };

  // Function to handle meeting navigation
  const handleMeetingNavigation = async (meetingInfo, taskInfo = null) => {
    if (meetingInfo.meetingId) {
      // Direct meeting ID available
      navigate(`/meeting-detail?id=${meetingInfo.meetingId}`);
    } else if (taskInfo && taskInfo.taskId) {
      // Get meeting ID from task ID
      const meetingId = await getMeetingIdFromTaskId(taskInfo.taskId);
      if (meetingId) {
        navigate(`/meeting-detail?id=${meetingId}`);
      }
    } else if (taskInfo && taskInfo.meetingName) {
      // Could implement a search for meeting by name
      console.log("Navigate to meeting:", taskInfo.meetingName);
    }
  };

  // Function to handle task navigation
  const handleCommentNavigation = async (commentInfo) => {
    if (commentInfo) {
      // Direct task ID available
      navigate(`${commentInfo.commentId}`);
    }
  };

  // Function to handle approval navigation
  const handleApprovalNavigation = async (notification) => {
    if (notification.link) {
      // Navigate to the approval link
      navigate(notification.link);
    }
  };

  // Helper function to format notification message with clickable elements
  const formatNotificationMessage = (notification) => {
    // Fix missing "a" in the message
    let message = notification.notification;
    if (message.includes("sent you message")) {
      message = message.replace("sent you message", "sent you a message");
    }

    // Handle approval requests with clickable links
    const approvalMatch = message.match(/Please approve '([^']+)'/);
    if (approvalMatch && notification.link) {
      console.log("requestName", approvalMatch[1]);
      const requestName = approvalMatch[1];
      message = message.replace(
        /Please approve '([^']+)'/,
        `Please approve <span class="clickable-approval" data-notification-id="${notification.id}">${requestName}</span>`
      );
    }

    // Parse the message to make task and meeting clickable
    const taskMatch = message.match(/task '([^']+)'/);
    const meetingMatch = message.match(/meeting '([^']+)'/);
    const meetingtitleMatch = message.match(/to meet-'([^']+)'/);
    const commentMatch = message.match(/comment-on '([^']+)'/);

    if (message.includes("Please review and complete the PDF document.")) {
      return `Please review and complete the PDF document. <span class="clickable-form" data-notification-id="${notification.id}" data-link="${notification.link}">Click here</span>`;
    }

    if (
      message.includes(
        "Please complete the required form to continue the workflow."
      )
    ) {
      return `Please complete the required form to continue the workflow. <span class="clickable-form" data-notification-id="${notification.id}" data-link="${notification.link}">Click here</span>`;
    }

    if (message.includes("Please approve the workflow.")) {
      return `Please approve the workflow. <span class="clickable-approval" data-notification-id="${notification.id}" data-link="${notification.link}">Click here</span>`;
    }

    if (message.includes("Your request is Approved")) {
      return `Your request is Approved. <span class="clickable-update" data-notification-id="${notification.id}" data-link="${notification.link}">Click here</span>`;
    }

    if (taskMatch) {
      const taskName = taskMatch[1];

      // Replace the message parts with clickable elements
      message = message.replace(
        /task '([^']+)'/,
        `task: <span class="clickable-task" data-task="${taskName}" data-notification-id="${notification.id}">"${taskName}"</span>`
      );
    }

    if (meetingMatch) {
      const meetingName = meetingMatch[1];

      message = message.replace(
        /of meeting '([^']+)'/,
        `for meeting <span class="clickable-meeting" data-meeting="${meetingName}" data-notification-id="${notification.id}">"${meetingName}"</span>`
      );
    }

    if (meetingtitleMatch) {
      const meetingTitle = meetingtitleMatch[1];

      message = message.replace(
        /to meet-'([^']+)'/,
        `for meeting <span class="clickable-meeting" data-meeting="${meetingTitle}" data-notification-id="${notification.id}">"${meetingTitle}"</span>`
      );
    }

    if (commentMatch) {
      const docTitle = commentMatch[1];
      message = message.replace(
        /comment-on '([^']+)'/,
        `comment on <span class="clickable-comment" data-comment="${docTitle}" data-notification-id="${notification.id}">"${docTitle}"</span>`
      );
    }
    return message;
  };

  const handleNavigate = (link) => {
    navigate(link);
  };

  // Effect to add click listeners using event delegation
  useEffect(() => {
    const handleClick = (e) => {
      const target = e.target;

      // Check if the clicked element has any of our clickable classes
      if (target.classList.contains("clickable-task")) {
        e.preventDefault();
        e.stopPropagation();
        const notificationId = target.getAttribute("data-notification-id");
        const taskName = target.getAttribute("data-task");
        const notification = notifications.find((n) => n.id == notificationId);
        if (notification) {
          const taskInfo = extractTaskInfo(notification);
          console.log(`Task clicked for notification ${notificationId}`);
          handleTaskNavigation(taskInfo || { taskName });
        }
      } else if (target.classList.contains("clickable-meeting")) {
        e.preventDefault();
        e.stopPropagation();
        const notificationId = target.getAttribute("data-notification-id");
        const meetingName = target.getAttribute("data-meeting");
        const notification = notifications.find((n) => n.id == notificationId);
        if (notification) {
          const meetingInfo = extractMeetingInfo(notification);
          const taskInfo = extractTaskInfo(notification);
          console.log(`Meeting clicked for notification ${notificationId}`);
          handleMeetingNavigation(
            meetingInfo || {},
            taskInfo || { meetingName }
          );
        }
      } else if (target.classList.contains("clickable-comment")) {
        e.preventDefault();
        e.stopPropagation();
        const notificationId = target.getAttribute("data-notification-id");
        const commentName = target.getAttribute("data-comment");
        const notification = notifications.find((n) => n.id == notificationId);
        if (notification) {
          const commentInfo = extractCommentInfo(notification);
          console.log(`Comment clicked for notification ${notificationId}`);
          handleCommentNavigation(commentInfo || { commentName });
        }
      } else if (target.classList.contains("clickable-approval")) {
        e.preventDefault();
        e.stopPropagation();
        const notificationId = target.getAttribute("data-notification-id");
        const notification = notifications.find((n) => n.id == notificationId);
        if (notification) {
          console.log(`Approval clicked for notification ${notificationId}`);
          handleApprovalNavigation(notification);
        }
      } else if (target.classList.contains("clickable-form")) {
        e.preventDefault();
        e.stopPropagation();
        const notificationId = target.getAttribute("data-notification-id");
        const link = target.getAttribute("data-link");
        console.log(`Form clicked, navigating to: ${link}`);
        if (link) {
          handleNavigate(link);
        }
      } else if (target.classList.contains("clickable-update")) {
        e.preventDefault();
        e.stopPropagation();
        const notificationId = target.getAttribute("data-notification-id");
        const link = target.getAttribute("data-link");
        console.log(`Update clicked, navigating to: ${link}`);
        if (link) {
          handleNavigate(link);
        }
      }
    };

    // Add event listener to the notification container
    const notificationContainer = document.querySelector(".notification-list");
    if (notificationContainer) {
      notificationContainer.addEventListener("click", handleClick);
    }

    return () => {
      // Clean up event listener
      if (notificationContainer) {
        notificationContainer.removeEventListener("click", handleClick);
      }
    };
  }, [notifications]);

  // Helper function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRemoveNotificationItem = async (id) => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/notification/remove`,
        {
          notificationId: id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setNotifications((prev) =>
          prev.filter((notification) => notification.id !== id)
        );
      }
    } catch (error) {
      console.error("Error removing notification:", error);
      if (error.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
      }
    }
  };

  // const getNotificationList = async (offset = 0, limit = 5) => {
  const getNotificationList = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/notification`,
        {},
        // {
        //   offset: offset,
        //   limit: limit,
        // },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success && response.data.notifications) {
        console.log(response.data.notifications);
        setNotifications(response.data.notifications);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      if (error.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
      }
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

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  const paginatedNotifications = notifications.slice(
    pageIndex * pageSize,
    (pageIndex + 1) * pageSize
  );

  const columns = [
    {
      accessorKey: "notification",
      header: "Notification",
      cell: (info) => (
        <span
          dangerouslySetInnerHTML={{
            __html: formatNotificationMessage(info.row.original),
          }}
        />
      ),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: (info) => formatDate(info.getValue()),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: (info) => getRelatedInfo(info.row.original.link).type,
    },
    {
      accessorKey: "action",
      header: "Remove",
      cell: (info) => (
        <i
          className="fas fa-times cursor-pointer text-red-600"
          onClick={() => handleRemoveNotificationItem(info.row.original.id)}
        ></i>
      ),
    },
  ];

  return (
    <div className="page-container flex flex-col">
      <Navbar
        isAuthenticated={isAuthenticated}
        user={user}
        onOpenAuthModal={() => navigate("/")}
      />

      <div className="notification-container flex-1 overflow-auto">
        <header className="notification-header">
          <h1>Notifications</h1>
        </header>
        {/* <div className="notification-list">
          {notifications.length > 0 ? (
            notifications.map((notification) => {
              const relatedInfo = getRelatedInfo(notification.link);
           
              return (
                <div key={notification.id} className="notification-item">
                  <div className="notification-content">
                    <div className="notification-message flex gap-2">
                      <span className="notification-type">
                        {relatedInfo.type}
                      </span>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: formatNotificationMessage(notification),
                        }}
                      ></span>
                    </div>
                    <div className="notification-meta">
                      <span className="notification-date">
                        {formatDate(notification.created_at)}
                      </span>
                    </div>
                  </div>
                  <div
                    className="notification-remove"
                    onClick={() => {
                      handleRemoveNotificationItem(notification.id);
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </div>
                  {!notification.checked && (
                    <div className="notification-new-badge"></div>
                  )}
                </div>
              );
            })
          ) : (
            <p style={{ textAlign: "center" }}>No notification.</p>
          )}
        </div> */}

        <div className="notification-list">
          {notifications.length > 0 ? (
            <>
              {paginatedNotifications.map((notification) => {
                const relatedInfo = getRelatedInfo(notification.link);
                return (
                  <div
                    key={notification.id}
                    className="notification-item shadow-md rounded-lg p-4 bg-white mb-4"
                  >
                    <div className="notification-content">
                      <div className="notification-message flex gap-2">
                        <span className="notification-type font-semibold">
                          {relatedInfo.type}
                        </span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: formatNotificationMessage(notification),
                          }}
                        ></span>
                      </div>
                      <div className="notification-meta text-sm text-gray-500 mt-1">
                        {formatDate(notification.created_at)}
                      </div>
                    </div>
                    <div className="notification-actions flex justify-between items-center mt-2">
                      <div>
                        {!notification.checked && (
                          <div className="notification-new-badge w-2 h-2 bg-red-500 rounded-full inline-block"></div>
                        )}
                      </div>
                      <i
                        className="fas fa-times text-red-600 cursor-pointer"
                        onClick={() =>
                          handleRemoveNotificationItem(notification.id)
                        }
                      ></i>
                    </div>
                  </div>
                );
              })}

              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4 px-4 text-sm text-gray-600">
                <div>
                  Showing {pageIndex * pageSize + 1} to{" "}
                  {Math.min((pageIndex + 1) * pageSize, notifications.length)}{" "}
                  of {notifications.length} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setPageIndex((prev) => Math.max(prev - 1, 0))
                    }
                    disabled={pageIndex === 0}
                    className={`px-3 py-1 border rounded ${
                      pageIndex === 0
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    Previous
                  </button>
                  <span>
                    Page {pageIndex + 1} of{" "}
                    {Math.ceil(notifications.length / pageSize)}
                  </span>
                  <button
                    onClick={() =>
                      setPageIndex((prev) =>
                        (prev + 1) * pageSize < notifications.length
                          ? prev + 1
                          : prev
                      )
                    }
                    disabled={
                      (pageIndex + 1) * pageSize >= notifications.length
                    }
                    className={`px-3 py-1 border rounded ${
                      (pageIndex + 1) * pageSize >= notifications.length
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-gray-500">No notifications.</p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default Notification;
