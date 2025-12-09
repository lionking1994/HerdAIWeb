import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../store/slices/authSlice";
import "./Navbar.css";
import { FaRegBell } from "react-icons/fa";
import axios from 'axios';
import { addMessage } from '../store/slices/notificationSlice'
import { toast } from 'react-toastify';
import { MessageSquare } from 'lucide-react';
import { setLocation } from '../store/slices/locationSlice';
import FeedbackDrawer from './Feedback/FeedbackDrawer';
import { useStripe } from "../context/StripeContext";

function Navbar({ isAuthenticated, user, onOpenAuthModal }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const hamburgerButtonRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [isNewNotification, setIsNewNotification] = useState(false);
  const [isNewNotificationCount, setIsNewNotificationCount] = useState(0)
  const notification = useSelector(state => state.notification.message);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);
  const [isFeedbackDrawerOpen, setIsFeedbackDrawerOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const { checkSubscriptionStatus, subscriptionStatus } = useStripe();

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  const getNavButtonClass = (path, baseClass = "nav-link-btn") => {
    return `${baseClass} ${isActivePath(path) ? 'nav-active' : ''}`;
  };

  const getDropdownButtonClass = (path) => {
    return `dropdown-nav-item ${isActivePath(path) ? 'dropdown-nav-active' : ''}`;
  };

  useEffect(() => {
    if (notification.message) {
      toast(notification.message);
      setIsNewNotification(true);
      dispatch(addMessage(''));
    }
  }, [notification]);

  function requestNotificationPermission() {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted');
        }
      });
    }
  }

  useEffect(() => {
    requestNotificationPermission();
    checkSubscriptionStatus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target) &&
        hamburgerButtonRef.current &&
        !hamburgerButtonRef.current.contains(event.target)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    getIsNewNotification();

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getIsNewNotification = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/notification/is-new-notification`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setIsNewNotification(response.data.isNews)
        setIsNewNotificationCount(response.data.count)
        localStorage.setItem('notificationCount', response.data.count)

      }
    } catch (error) {

      console.error("Error fetching notifications:", error);
      toast.error(`Failed to fetch notifications`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      if (error.response?.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
      }
    }
  }

  const handleSignOut = () => {
    dispatch(logout());
    navigate("/");
    setShowUserMenu(false);
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setShowUserMenu(false);
    setIsMobileMenuOpen(prev => !prev);
  };

  useEffect(() => {
    const fetchFeedbackCount = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/feedback/stats?path=${window.location.pathname}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // Set count based on user role
        if (user?.role === 'padmin') {
          setPendingFeedbackCount(response.data.pending);
        } else if (user?.role === 'dev') {
          setPendingFeedbackCount(response.data.approved);
        }
      } catch (error) {
        console.error("Error fetching feedback count:", error);
        toast.error(`Failed to fetch feedback count`, {
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
    };

    if (user?.role === 'padmin' || user?.role === 'dev') {
      fetchFeedbackCount();
    }
  }, [user?.role]);

  const handleFeedbackClick = () => {
    dispatch(setLocation(window.location.pathname));
    setIsFeedbackDrawerOpen(true);
  };

  return (
    <>
      <nav className="sticky nav-bar">
        <div className="nav-logo" onClick={() => navigate("/")}>
          <img src="/logo.png" alt="GetHerd Logo" className="nav-logo-img" />
        </div>

        {/* Mobile Icons */}
        <div className="mobile-only md:hidden flex gap-5">
          {(user?.role === 'padmin' || user?.role === 'dev') && (
            <button
              className="mobile-menu-button relative"
              onClick={handleFeedbackClick}
            >
              <MessageSquare size={20} style={{ cursor: "pointer" }} />
              {pendingFeedbackCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingFeedbackCount}
                </span>
              )}
            </button>
          )}

          <button
            className="mobile-menu-button tour-notifications"
            onClick={() => navigate("/notification")}
          >
            <FaRegBell style={{ cursor: "pointer" }} />
            {isNewNotification && (
              <span style={{ fontSize: "0.9rem" }}>({isNewNotificationCount})</span>
            )}
          </button>
          <button className="mobile-menu-button" onClick={toggleMobileMenu} ref={hamburgerButtonRef}>
            <span className={`hamburger ${isMobileMenuOpen ? "active" : ""}`}></span>
          </button>
        </div>

        {/* Desktop Navigation */}
        <div className={`nav-right ${isMobileMenuOpen ? "mobile-open" : ""}`} ref={mobileMenuRef}>
          {isAuthenticated ? (
            <div className="user-profile">
              {/* Mobile Menu Items */}
              {isMobileMenuOpen ? (
                <div className="mobile-user-info">
                  <div className="user-info-container">
                    {user?.avatar ? (
                      <img
                        src={`${process.env.REACT_APP_API_URL}/avatars/${user.avatar}`}
                        alt={user?.name || "Profile"}
                        className="user-avatar"
                      />
                    ) : (
                      <div className="user-avatar-placeholder">
                        {user?.name?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                    )}
                    <div className="user-info">
                      <strong className="user-name">
                        {user?.name || "User"}
                      </strong>
                    </div>
                  </div>
                  <div className="mobile-menu-items">
                    <button
                      onClick={() => navigate("/meeting-list")}
                      data-tour="activities-nav"
                      className={getDropdownButtonClass("/meeting-list")}
                    >
                      Activities
                    </button>
                    <button
                      onClick={() => navigate("/lms/dashboard")}
                      className={getDropdownButtonClass("/lms/dashboard")}
                    >
                      Let's Learn
                    </button>
                    <button
                      onClick={() => navigate("/profile")}
                      className={getDropdownButtonClass("/profile")}
                      data-tour="profile-nav"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => navigate("/subscription/manage")}
                      className={getDropdownButtonClass("/subscription/manage")}
                    >
                      Subscription
                    </button>
                    <button
                      onClick={() => navigate("/performance-cloud")}
                      data-tour="performance-nav"
                      className={getDropdownButtonClass("/performance-cloud")}
                    >
                      My Performance
                    </button>
                    <button
                      onClick={() => navigate("/notification")}
                      className={getDropdownButtonClass("/notification")}
                    >
                      Notification
                    </button>
                    <button
                      onClick={() => navigate("/task-dashboard")}
                      data-tour="tasks-nav"
                      className={getDropdownButtonClass("/task-dashboard")}
                    >
                      Tasks
                    </button>
                    <button
                      onClick={() => navigate("/calendarview")}
                      className={getDropdownButtonClass("/calendarview")}
                    >
                      Calendar
                    </button>
                    {(user.role == 'padmin' || user.role == 'cadmin' || user.role == 'dev') && <button
                      onClick={() => document.location.href = document.location.origin + "/admin?token=" + localStorage.getItem("token")}
                    >
                      Platform Admin
                    </button>}

                    <button onClick={handleSignOut} className="sign-out-btn">
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                /* Desktop Menu Items */
                <div className="user-menu-container desktop-only" ref={menuRef}>
                  <div className="nav-buttons-row">
                    {user?.role === 'padmin' ? (
                      <button
                        className="nav-link-btn relative flex items-center gap-2"
                        onClick={handleFeedbackClick}
                      >
                        <span>Feedback</span>
                        {pendingFeedbackCount > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                            {pendingFeedbackCount}
                          </span>
                        )}
                      </button>
                    ) : user?.role === 'dev' ? (
                      <button
                        className="nav-link-btn relative flex items-center gap-2"
                        onClick={handleFeedbackClick}
                      >
                        <span>Feedback</span>
                        {pendingFeedbackCount > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                            {pendingFeedbackCount}
                          </span>
                        )}
                      </button>
                    ) : (<></>)}
                    <button
                      className={getNavButtonClass("/meeting-list")}
                      onClick={() => navigate("/meeting-list")}
                      data-tour="activities-nav"
                    >
                      Activities
                    </button>
                    <button
                      className={getNavButtonClass("/lms/dashboard")}
                      onClick={() => navigate("/lms/dashboard")}
                    >
                      Let's Learn
                    </button>
                    <button
                      className={getNavButtonClass("/performance-cloud")}
                      onClick={() => navigate("/performance-cloud")}
                      data-tour="performance-nav"
                    >
                      My Performance
                    </button>
                    <button
                      className={getNavButtonClass("/task-dashboard")}
                      onClick={() => navigate("/task-dashboard")}
                      data-tour="tasks-nav"
                    >
                      Tasks
                    </button>
                    <button
                      className="nav-link-btn tour-notifications"
                      style={{ position: "relative" }}
                      onClick={() => navigate("/notification")}
                    >
                      <FaRegBell style={{ cursor: "pointer" }} />
                      {isNewNotification && (
                        <span style={{ fontSize: "0.9rem" }}>({isNewNotificationCount})</span>
                      )}
                    </button>
                    <button
                      className="user-menu-trigger"
                      onClick={() => setShowUserMenu(!showUserMenu)}
                    >
                      {user?.avatar ? (
                        <img
                          src={`${process.env.REACT_APP_API_URL}/avatars/${user.avatar}`}
                          alt="Profile"
                          className="user-avatar"
                        />
                      ) : (
                        <div className="user-avatar-placeholder">
                          {user?.name?.charAt(0) || "U"}
                        </div>
                      )}
                      <div>
                        <span className="user-name">{user?.name || "User"}</span>
                      </div>
                      <i className="arrow-down"></i>
                    </button>
                  </div>

                  {showUserMenu && (
                    <div className="user-menu">
                      <div className="user-menu-header">
                        <div className="user-info">
                          <strong>{user?.name}</strong>
                        </div>
                      </div>
                      <div className="user-menu-items">
                        <button
                          onClick={() => navigate("/meeting-list")}
                          data-tour="activities-nav"
                          className={getDropdownButtonClass("/meeting-list")}
                        >
                          Activities
                        </button>
                        <button
                          onClick={() => navigate("/lms/dashboard")}
                          className={getDropdownButtonClass("/lms/dashboard")}
                        >
                          Let's Learn
                        </button>
                        <button
                          onClick={() => navigate("/profile")}
                          className={getDropdownButtonClass("/profile")}
                          data-tour="profile-nav"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => navigate("/subscription/manage")}
                          className={getDropdownButtonClass("/subscription/manage")}
                        >
                          Subscription
                        </button>
                        <button
                          onClick={() => navigate("/performance-cloud")}
                          data-tour="performance-nav"
                          className={getDropdownButtonClass("/performance-cloud")}
                        >
                          My Performance
                        </button>
                        <button
                          onClick={() => navigate("/notification")}
                          className={getDropdownButtonClass("/notification")}
                        >
                          Notification
                        </button>
                        <button
                          onClick={() => navigate("/task-dashboard")}
                          data-tour="tasks-nav"
                          className={getDropdownButtonClass("/task-dashboard")}
                        >
                          Tasks
                        </button>
                        <button
                          onClick={() => navigate("/calendarview")}
                          className={getDropdownButtonClass("/calendarview")}
                        >
                          Calendar
                        </button>
                        {(user.role === 'padmin' || user.role === 'cadmin' || user.role === 'dev') && <button
                          onClick={() => {
                            if (user.role === 'cadmin') {
                              document.location.href = document.location.origin + "/admin?token=" + localStorage.getItem("token") + "&company=" + user.company_id
                            } else
                              document.location.href = document.location.origin + "/admin?token=" + localStorage.getItem("token")
                          }}
                        >
                          {user.role === 'padmin' ? 'Platform Admin' : 'Company Admin'}
                        </button>}
                        <div className="menu-divider"></div>
                        <button onClick={handleSignOut} className="sign-out-btn">
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="nav-auth-buttons">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenAuthModal("signin");
                }}
                className="nav-btn mobile-nav-btn"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenAuthModal("signup");
                }}
                className="nav-btn nav-btn-primary mobile-nav-btn"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>

      </nav>
      <div className="w-full bg-[#ef3322]">
        <div className={`h-full flex justify-center items-center py-2 px-4  ${!subscriptionStatus.subscriptionNeeded ? 'bg-[#40b137]' : 'bg-[#d10909]'}`}>
          <div className={` text-white text-center `}>
            <div className="flex gap-2 cursor-pointer"
              onClick={() => navigate(subscriptionStatus.hasActiveSubscription ? '/subscription/manage' : '/subscription/select')}>
              {subscriptionStatus.hasActiveSubscription ? (
                <div className="underline active text-[16px] font-bold">Active Subscription</div>
              ) : (
                <div className="underline free text-[16px] font-bold">Free Plan</div>
              )}

              {!subscriptionStatus.hasActiveSubscription && <div className="text-[14px] font-bold">
                ({subscriptionStatus.subscriptionThreshold} of {subscriptionStatus.meetingCount >= 1000
                  ? `${(subscriptionStatus.meetingCount / 1000).toFixed(1)}k `
                  : `${subscriptionStatus.meetingCount}`
                } used)
              </div>
              }
            </div>
          </div>
        </div>
      </div>
      <FeedbackDrawer
        isOpen={isFeedbackDrawerOpen}
        onClose={() => setIsFeedbackDrawerOpen(false)}
        selectedFeedback={selectedFeedback}
        setSelectedFeedback={setSelectedFeedback}
        user={user}
      />
    </>
  );
}

export default Navbar;
