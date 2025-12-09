import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import "./styles/global.css";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Calendarview from "./pages/calendarview";
import LearningDashboard from "./pages/LearningDashboard";
import { useSelector, useDispatch } from "react-redux";
import ZoomCallback from "./components/ZoomCallback";
import TeamsCallback from "./components/teamsCallback";
import GmeetCallback from "./components/GmeetCallback";
import LinkedinCallback from "./components/LinkedinCallback";
import { ThemeProvider } from "./context/ThemeContext";
import { StripeProvider } from "./context/StripeContext";
import { ChatPopProvider } from "./context/chatPopContext";
import MeetingDetail from "./pages/MeetingDetail";
import MeetingList from "./pages/MeetingList";
import SetPassword from "./pages/SetPassword";
import Notification from "./pages/Notification";
import ResetPassword from "./pages/ResetPassword";
import TaskList from "./pages/TaskList";
import TaskDashboard from "./pages/TaskDashboard";
import TaskDetails from "./pages/TaskDetails";
import PerformanceCloud from "./pages/PerformanceCloud";
import NotFound from "./pages/NotFound";
import "./index.css";
import CreateMeeting from "./pages/CreateMeeting";
import getSocket from "./libs/socket";
import { addMessage } from "./store/slices/notificationSlice";
import { Loader2 } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import FeedbackManagement from "./pages/FeedbackManagement";
import Unauthorized from "./pages/Unauthorized";
import { addMeeting } from "./store/slices/upcomingMeetingSlice";
import SubscriptionSelect from "./pages/Subscription/SubscriptionSelect";
import WorkflowFormModal from "./components/WorkflowFormModal";
import WorkflowFormPage from "./pages/WorkflowFormPage";
import ApprovalPage from "./pages/ApprovalPage";
import CrmApprovalPage from "./pages/CrmApprovalPage";
import WorkflowInstanceHistory from "./pages/WorkflowInstanceHistory";
import SubscriptionSuccess from "./pages/Subscription/SubscriptionSuccess";
import SubscriptionCancel from "./pages/Subscription/SubscriptionCancel";
import PaymentUpdate from "./pages/Subscription/PaymentUpdate";
import SubscriptionManagement from "./pages/Subscription/SubscriptionManagement";
import FileUploaderDemo from "./pages/FileUploaderDemo"; // Import the new FileUploaderDemo page
import { TourProvider, useTour } from "@reactour/tour";
import ReactTour from "reactour";
import { DashboardPage } from "./LMSAdmin/pages/DashboardPage";
import { ProgressDashboard } from "./LMSAdmin/pages/ProgressDashboard";
import { CoursePage } from "./LMSAdmin/pages/CoursePage";
import CrmOpportunity from "./components/CrmOpportunity";
// import { FloatingAgent } from "./components/MeetingAgent/FloatingAgent";
import useHttp from "./hooks/useHttp";
import PdfProcessingPage from "./pages/PdfProcessingPage";

import PSAMyWork from "./pages/PSAMyWork.js";
import UserStoryWorkspace from "./pages/UserStoryWorkspace.js";
import ProjectOverview from "./pages/ProjectOverview.js";
import ResourceOverview from "./pages/ResourceOverview.js";

import PublicFormPage from "./pages/publicformPage";

 

function AppRoutes() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { sendRequest } = useHttp();
  console.log("location", location.pathname);
  // const { user } = useSelector((state) => state.auth);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const tokenExpired = useSelector((state) => state.auth.tokenExpired);
  const dispatch = useDispatch();

  function showBrowserNotification(body, options = {}) {
    if (Notification.permission === "granted") {
      new Notification("GetHerd.ai", {
        body: body,
        icon: "/logo192.png",
        ...options,
      });
    }
  }

  useEffect(() => {
    // Handle auth callback
    const params = new URLSearchParams(location.search);
    let token = params.get("token");
    if (window.location.pathname.includes("reset-password") || window.location.pathname.includes("set-password") || window.location.pathname.includes("/public/pdf") || window.location.pathname.includes("/public/form")) {
      setIsLoading(false);
      return;
    }
    console.log("params", params, token);
    if (token) {
      console.log("url---", token);
      localStorage.setItem("token", token);
      fetchUserData(token).then(() => {
        navigate("/dashboard");
      });
    } else {
      token = localStorage.getItem("token");
      console.log("fetch---", token);
      fetchUserData(token);
    }
  }, [location, navigate, dispatch]);

  useEffect(() => {
    console.log("user-app", user);
    if (!user) return;
    getSocket().off("notification");
    getSocket().on("notification", (msg) => {
      console.log("Notification received:", msg);

      // Handle regular notifications
      if (msg.id === user.id) {
        if (msg.type === "workflow_notification") {
          toast.info(msg.notificationText);
          return;
        }

        dispatch(addMessage(msg));

        // Handle workflow form notifications (sent as separate socket event)
        if (
          msg.type === "notification" &&
          msg.notification &&
          msg.notification.type === "workflow_form"
        ) {
          const notification = msg.notification;
          toast.info(
            <div>
              <div className="font-semibold">{notification.title}</div>
              <div className="text-sm">{notification.message}</div>
              <button
                onClick={() => {
                  window.location.href = notification.data.redirectUrl;
                }}
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Open Form
              </button>
            </div>,
            {
              autoClose: false,
              closeOnClick: false,
              draggable: true,
              position: "top-right",
            }
          );
        }

        if (
          msg.type === "notification" &&
          msg.notification &&
          (msg.notification.type === "workflow_approval" ||
            msg.notification.type === "workflow_crm_approval")
        ) {
          const notification = msg.notification;
          toast.info(
            <div>
              <div className="font-semibold">{notification.title}</div>
              <div className="text-sm">{notification.message}</div>
              <button
                onClick={() => {
                  window.location.href = notification.data.redirectUrl;
                }}
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Goto Approval
              </button>
            </div>,
            {
              autoClose: false,
              closeOnClick: false,
              draggable: true,
              position: "top-right",
            }
          );
        }

        if (
          msg.type === "notification" &&
          msg.notification &&
          msg.notification.type === "task_update"
        ) {
          const notification = msg.notification;
          toast.info(
            <div>
              <div className="font-semibold">{notification.title}</div>
              <div className="text-sm">{notification.message}</div>
              <button
                onClick={() => {
                  window.location.href = notification.data.redirectUrl;
                }}
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Go to Task Details Page
              </button>
            </div>,
            {
              autoClose: false,
              closeOnClick: false,
              draggable: true,
              position: "top-right",
            }
          );
        }

        if (
          msg.type === "notification" &&
          msg.notification &&
          msg.notification.type === "workflow_pdf_process"
        ) {
          const notification = msg.notification;
          toast.info(
            <div>
              <div className="font-semibold">{notification.title}</div>
              <div className="text-sm">{notification.message}</div>
              <button
                onClick={() => {
                  window.location.href = notification.data.redirectUrl;
                }}
                className="mt-2 px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
              >
                Process PDF
              </button>
            </div>,
            {
              autoClose: false,
              closeOnClick: false,
              draggable: true,
              position: "top-right",
            }
          );
        }
      }
    });
    getSocket().off("upcoming-meeting-alert");
    getSocket().on("upcoming-meeting-alert", (msg) => {
      if (!user || !msg) return;

      if (user.id === msg.org_id) {
        toast(`Activity is in 30mins, Activity Title: ${msg.title}`);
        showBrowserNotification(
          `Activity is in 30mins, Activity Title: ${msg.title}`
        );

        try {
          // const checkMeeting = async () => {
          // const response = await fetch(`${process.env.REACT_APP_API_URL}/agent/upcoming-meeting-alert-check`, {
          //   method: 'POST',
          //   headers: {
          //     'Content-Type': 'application/json',
          //     'Authorization': `Bearer ${localStorage.getItem('token')}`
          //   },
          //   body: JSON.stringify({
          //     meetingId: msg.id
          //   })
          // });

          // const data = await response.json();
          // if (!data.exists) {
          // Don't clear chat window, just add the preparation message

          // }
          // }
          // checkMeeting();
          dispatch(
            addMeeting({
              ...msg,
              preserveChat: true, // Add this flag
            })
          );
        } catch (error) {
          console.error("Socket event handler error:", error);
        }
      }
    });

    // Note: Workflow form events are now handled by individual components using Redux
  }, [user]);

  // useEffect(() => {
  //   const token = localStorage.getItem('token');
  //   fetchUserData(token);
  // }, []);

  const fetchUserData = async (token) => {
    try {
      if (!token) return;

      const response = await sendRequest({
        url: `${process.env.REACT_APP_API_URL}/auth/profile`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      window.localStorage.setItem("user", JSON.stringify(response));
      setUser(response);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsLoading(false);
    }
  };
  if (
    tokenExpired &&
    isAuthenticated &&
    location.pathname !== "/reset-password" &&
    location.pathname !== "/public/pdf" &&
    location.pathname !== "/public/form"
  ) {
    return <Navigate to="/" />;
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />}
        />
        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/onboarding"
          element={isAuthenticated ? <Onboarding /> : <Navigate to="/" />}
        />
        <Route
          path="/profile"
          element={isAuthenticated ? <Profile /> : <Navigate to="/" />}
        />
        <Route
          path="/calendarview"
          element={isAuthenticated ? <Calendarview /> : <Navigate to="/" />}
        />
        <Route
          path="/learning-dashboard"
          element={
            isAuthenticated ? <LearningDashboard /> : <Navigate to="/" />
          }
        />
        <Route
          path="/notification"
          element={isAuthenticated ? <Notification /> : <Navigate to="/" />}
        />
        <Route
          path="/meeting-detail"
          element={isAuthenticated ? <MeetingDetail /> : <Navigate to="/" />}
        />
        <Route
          path="/zoom-callback"
          element={isAuthenticated ? <ZoomCallback /> : <Navigate to="/" />}
        />
        <Route
          path="/teams-callback"
          element={isAuthenticated ? <TeamsCallback /> : <Navigate to="/" />}
        />
        <Route
          path="/gmeet-callback"
          element={isAuthenticated ? <GmeetCallback /> : <Navigate to="/" />}
        />
        <Route
          path="/linkedin-callback"
          element={isAuthenticated ? <LinkedinCallback /> : <Navigate to="/" />}
        />
        <Route
          path="/meeting-list"
          element={isAuthenticated ? <MeetingList /> : <Navigate to="/" />}
        />
        <Route path="/set-password" element={<SetPassword />} />
        <Route
          path="/task-list"
          element={isAuthenticated ? <TaskList /> : <Navigate to="/" />}
        />
        <Route
          path="/task-dashboard"
          element={isAuthenticated ? <TaskDashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/task-details"
          element={isAuthenticated ? <TaskDetails /> : <Navigate to="/" />}
        />
        <Route
          path="/create-meeting"
          element={isAuthenticated ? <CreateMeeting /> : <Navigate to="/" />}
        />
        <Route
          path="/performance-cloud"
          element={isAuthenticated ? <PerformanceCloud /> : <Navigate to="/" />}
        />
        <Route
          path="/404"
          element={isAuthenticated ? <NotFound /> : <Navigate to="/" />}
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/feedback"
          element={
            isAuthenticated ? <FeedbackManagement /> : <Navigate to="/" />
          }
        />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route
          path="/subscription/select"
          element={
            isAuthenticated ? <SubscriptionSelect /> : <Navigate to="/" />
          }
        />
        <Route
          path="/subscription/success"
          element={
            isAuthenticated ? <SubscriptionSuccess /> : <Navigate to="/" />
          }
        />
        <Route
          path="/subscription/cancel"
          element={
            isAuthenticated ? <SubscriptionCancel /> : <Navigate to="/" />
          }
        />
        <Route
          path="/subscription/manage"
          element={
            isAuthenticated ? <SubscriptionManagement /> : <Navigate to="/" />
          }
        />
        <Route
          path="/subscription/payment-update"
          element={isAuthenticated ? <PaymentUpdate /> : <Navigate to="/" />}
        />
        <Route
          path="/file-uploader-demo"
          element={isAuthenticated ? <FileUploaderDemo /> : <Navigate to="/" />}
        />
        <Route
          path="/workflow-form"
          element={isAuthenticated ? <WorkflowFormPage /> : <Navigate to="/" />}
        />
        <Route
          path="/approval"
          element={isAuthenticated ? <ApprovalPage /> : <Navigate to="/" />}
        />
        <Route
          path="/crm-approval"
          element={isAuthenticated ? <CrmApprovalPage /> : <Navigate to="/" />}
        />
        <Route
          path="/workflow-instance-history"
          element={
            isAuthenticated ? <WorkflowInstanceHistory /> : <Navigate to="/" />
          }
        />
        <Route path="*" element={<Navigate to="/404" />} />

        <Route
          path="/lms/dashboard"
          element={
            isAuthenticated ? (
              <DashboardPage user={user} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/lms/courses/:courseId"
          element={
            isAuthenticated ? <CoursePage user={user} /> : <Navigate to="/" />
          }
        />
        <Route
          path="/lms/progress"
          element={
            isAuthenticated ? (
              <ProgressDashboard user={user} />
            ) : (
              <Navigate to="/" />
            )
          }
        />

        <Route
          path="/crm/opportunities/:id"
          element={
            isAuthenticated ? (
              <CrmOpportunity user={user} />
            ) : (
              <Navigate to="/" />
            )
          }
        />

        <Route
          path="/public/pdf"
          element={<PdfProcessingPage />}
        />
        <Route
          path="/public/form"
          element={<PublicFormPage />}
        />
        {/* PSA Routes */}
        <Route
          path="/psa/my-work"
          element={isAuthenticated ? <PSAMyWork /> : <Navigate to="/" />}
        />
        <Route
          path="/psa/story/:storyId"
          element={isAuthenticated ? <UserStoryWorkspace /> : <Navigate to="/" />}
        />
        <Route
          path="/psa/project/:projectId"
          element={isAuthenticated ? <ProjectOverview /> : <Navigate to="/" />}
        />
        <Route
          path="/psa/resource-overview/:resourceId"
          element={isAuthenticated ? <ResourceOverview /> : <Navigate to="/" />}
        />
      </Routes>

      {/* Workflow Form Modal */}
      <WorkflowFormModal />
      {/* <div className="min-h-screen bg-gray-50">
        <Header />
        <Routes>
          <Route path="/" element={user ? <Navigate to="/LMSAdmin/dashboard" replace /> : <HomePage />} />
          <Route path="/register" element={user ? <Navigate to="/LMSAdmin/dashboard" replace /> : < />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/course/:courseId"
            element={
              <ProtectedRoute>
                <CoursePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <ProgressDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div> */}
    </>
  );
}

function App() {
  const hash = window.location.hash.substring(1);
  if (hash) {
    localStorage.setItem("hash", hash);
  }

  return (
    <ThemeProvider>
      <StripeProvider>
        <Provider store={store}>
          <ChatPopProvider>
            <div className="absolute">
              <ToastContainer />
            </div>
            <div>
              <Router>
                <AppRoutes />
                {/* <FloatingAgent />   // removed from here and added in  footer.js*/}
              </Router>
            </div>
          </ChatPopProvider>
        </Provider>
      </StripeProvider>
    </ThemeProvider>
  );
}

export default App;
