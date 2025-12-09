import React, { useContext, useEffect, useState, useRef } from "react";
import { Bot, X } from "lucide-react";
import { cn } from "../../libs/utils";
import { AgentFrame } from "./AgentFrame";
import { useDispatch, useSelector } from "react-redux";
import { loginFailure, loginSuccess } from "../../store/slices/authSlice";
import { useNavigate, useLocation } from "react-router-dom";
import { ChatPopContext } from "../../context/chatPopContext";

const sizeMap = {
  sm: "w-6 h-6 sm:w-8 sm:h-8",
  md: "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12",
  lg: "w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14",
};

export const FloatingAgent = ({ className, size = "md" }) => {
  console.log("🔍 FloatingAgent component rendered - START");

  const { popOpen, setPopOpen, PopMsg } = useContext(ChatPopContext);
  const [isOpen, setIsOpen] = useState(false); // Default to closed
  const user = useSelector((state) => state.auth.user);
  const [isHovered, setIsHovered] = useState(false);
  const upcomingMeeting = useSelector((state) => state.upcomingMeeting);
  const upcomingResearch = useSelector((state) => state.upcomingResearch);
  const createMeeting = useSelector((state) => state.createMeeting);
  const discussTask = useSelector((state) => state.discussTask);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Use ref to track if we've already handled dashboard visit for this user
  const dashboardHandledRef = useRef(new Set());

  console.log("🔍 FloatingAgent state:", {
    isOpen,
    user: !!user,
    location: location.pathname,
    popOpen,
    hasVisited: user
      ? localStorage.getItem(`hasVisitedDashboard_${user.id}`)
      : null,
    manuallyClosed: user
      ? localStorage.getItem(`userManuallyClosed_${user.id}`)
      : null,
    userId: user?.id,
  });

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);

    if (!newState) {
      // User manually closed the agent
      if (user) {
        const userManuallyClosedKey = `userManuallyClosed_${user.id}`;
        localStorage.setItem(userManuallyClosedKey, "true");
        console.log("🔍 User manually closed FloatingAgent");
      }
    } else {
      // User manually opened the agent
      if (user) {
        const userManuallyClosedKey = `userManuallyClosed_${user.id}`;
        localStorage.removeItem(userManuallyClosedKey);
        console.log("🔍 User manually opened FloatingAgent");
      }
    }

    setPopOpen(false); // Close pop context when toggling
  };

  // SIMPLE LOGIC: Auto-open only on first dashboard visit after login
  useEffect(() => {
    console.log("🔍 Route changed to:", location.pathname);
    console.log("🔍 User state:", !!user);

    if (location.pathname === "/dashboard" && user) {
      // Use ref to prevent multiple executions for the same user
      const userKey = `hasVisitedDashboard_${user.id}`;
      const userManuallyClosedKey = `userManuallyClosed_${user.id}`;

      // Check if we've already handled this user's dashboard visit
      if (dashboardHandledRef.current.has(user.id)) {
        console.log("🔍 Already handled dashboard visit for user:", user.id);
        return;
      }

      const hasVisitedDashboard = localStorage.getItem(userKey);
      const userManuallyClosed = localStorage.getItem(userManuallyClosedKey);

      console.log("🔍 Dashboard visit check:", {
        userKey,
        hasVisited: hasVisitedDashboard,
        manuallyClosed: userManuallyClosed,
        userId: user.id,
        currentIsOpen: isOpen,
      });

      // Check if user manually closed the agent in this session
      if (userManuallyClosed) {
        console.log(
          "🔍 User manually closed FloatingAgent - keeping it closed"
        );
        if (isOpen) setIsOpen(false);
      } else if (!hasVisitedDashboard) {
        // First time visiting dashboard - auto-open
        console.log("🔍 FIRST TIME on dashboard - auto-opening FloatingAgent");
        if (!isOpen) setIsOpen(true);
        localStorage.setItem(userKey, "true");
        console.log("🔍 Set", userKey, "to true");
      } else {
        // Not first time - keep closed
        console.log("🔍 Not first time - keeping FloatingAgent closed");
        if (isOpen) setIsOpen(false);
      }

      // Mark this user as handled
      dashboardHandledRef.current.add(user.id);
      console.log("🔍 Marked user as handled:", user.id);
    } else if (location.pathname !== "/dashboard") {
      // On other routes, close the FloatingAgent
      console.log(
        "🔍 On other route:",
        location.pathname,
        "- closing FloatingAgent"
      );
      if (isOpen) {
        setIsOpen(false);
      }
    }
  }, [location.pathname, user]); // Removed isOpen to prevent infinite loops

  // Handle popOpen from context (Dashboard + icon clicks)
  useEffect(() => {
    if (popOpen && user) {
      console.log("🔍 popOpen triggered - opening FloatingAgent");
      setIsOpen(true);
      const userManuallyClosedKey = `userManuallyClosed_${user.id}`;
      localStorage.removeItem(userManuallyClosedKey); // Reset manual close state
    }
  }, [popOpen, user]);

  // Handle Redux state changes to open agent
  useEffect(() => {
    if (
      (upcomingMeeting.meeting_id ||
        upcomingResearch.research_topic ||
        createMeeting.meeting_topic ||
        discussTask.task_title) &&
      user
    ) {
      console.log("🔍 Redux state change - opening FloatingAgent");
      setIsOpen(true);
      const userManuallyClosedKey = `userManuallyClosed_${user.id}`;
      localStorage.removeItem(userManuallyClosedKey); // Reset manual close state
    }
  }, [upcomingMeeting, upcomingResearch, createMeeting, discussTask, user]);

  // Handle user login/logout to reset flags
  useEffect(() => {
    if (user) {
      console.log("🔍 User logged in - checking if should reset flags");
      // When user logs in, check if we need to reset the dashboard visit flag
      // This ensures fresh behavior on each login
      const userKey = `hasVisitedDashboard_${user.id}`;
      const hasVisitedDashboard = localStorage.getItem(userKey);
      if (hasVisitedDashboard) {
        console.log(
          "🔍 User logged in but has visited dashboard - keeping flag:",
          userKey
        );
      } else {
        console.log(
          "🔍 User logged in and no dashboard visit flag - ready for first visit:",
          userKey
        );
      }
    } else {
      console.log("🔍 User logged out - should clear flags in authSlice");
      // Reset the ref when user logs out
      dashboardHandledRef.current.clear();
      console.log("🔍 Reset dashboard handled ref");
    }
  }, [user]);

  // Fetch user data if not available
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (window.location.pathname.includes("reset-password") || window.location.pathname.includes("set-password")) {
          return;
        }
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
      if (
        window.location.pathname.includes("reset-password") ||
        window.location.pathname.includes("set-password") ||
        window.location.pathname.includes("/public/")
      ) {
        return;
      }
      fetchUserData();
    }
  }, [user, dispatch, navigate]);

  if (
    window.location.pathname.includes("reset-password") ||
    window.location.pathname.includes("set-password") ||
    window.location.pathname.includes("/public/")
  ) {
    return null;
  }

  return (
    <>
      {user && (
        <>
          <button
            onClick={handleToggle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              "fixed bottom-3 right-3 sm:bottom-4 sm:right-4 md:bottom-6 md:right-6 z-[101]",
              "rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
              "transition-all duration-300 ease-in-out",
              "flex items-center justify-center",
              "bg-gradient-to-r from-violet-500 to-fuchsia-500",
              "hover:from-violet-600 hover:to-fuchsia-600",
              "text-white backdrop-blur-sm",
              "border border-white/20",
              sizeMap[size],
              isOpen ? "rotate-180 scale-110" : "rotate-0 scale-100",
              "hover:shadow-[0_8px_30px_rgba(147,51,234,0.3)]",
              "active:scale-95",
              className
            )}
            aria-label={isOpen ? "Close agent" : "Open agent"}
          >
            <div
              className={cn(
                "absolute transform transition-all duration-200",
                isHovered && !isOpen ? "scale-110" : "scale-100"
              )}
            >
              {isOpen ? (
                <X
                  className={cn(
                    size === "sm" && "h-3 w-3 sm:h-4 sm:w-4",
                    size === "md" && "h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6",
                    size === "lg" && "h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7"
                  )}
                />
              ) : (
                <Bot
                  className={cn(
                    size === "sm" && "h-3 w-3 sm:h-4 sm:w-4",
                    size === "md" && "h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6",
                    size === "lg" && "h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7"
                  )}
                />
              )}
            </div>
          </button>

          <AgentFrame
            isOpen={isOpen}
            onClose={() => {
              setIsOpen(false);
              if (user) {
                const userManuallyClosedKey = `userManuallyClosed_${user.id}`;
                localStorage.setItem(userManuallyClosedKey, "true"); // Track that user manually closed
              }
              setPopOpen(false);
            }}
            user={user}
          />
        </>
      )}
    </>
  );
};
