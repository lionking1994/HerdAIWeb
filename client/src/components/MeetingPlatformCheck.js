import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MeetingPlatformCheck.css';
import axios from "axios";

const MeetingPlatformCheck = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasEnrollments, setHasEnrollments] = useState(false);
  const [isMeetingPlatformConnected, setIsMeetingPlatformConnected] = useState(false);
  const [enrollmentsLoaded, setEnrollmentsLoaded] = useState(false);
  const [hasBeenShown, setHasBeenShown] = useState(false);
  const navigate = useNavigate();

  // Check if modal has been shown before
  useEffect(() => {
    const modalShownKey = `meeting-platform-check-shown-${user?.id || 'anonymous'}`;
    const hasShown = localStorage.getItem(modalShownKey) === 'true';
    setHasBeenShown(hasShown);
  }, [user]);

  // Check meeting platform connection
  useEffect(() => {
    if (user) {
      const isConnected = user.use_zoom || user.use_teams || user?.googleUser?.is_connected;
      setIsMeetingPlatformConnected(!!isConnected);
    }
  }, [user]);

  // Check if user has course enrollments
  useEffect(() => {
    const checkUserEnrollments = async () => {
      if (user && user.id) {
        try {
          const token = localStorage.getItem("token");
          const response = await axios.get(
            `${process.env.REACT_APP_API_URL}/lms/user/${user.id}/enrollments`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          
          if (response.data && response.data.enrollments && response.data.enrollments.length > 0) {
            setHasEnrollments(true);
          } else {
            setHasEnrollments(false);
          }
        } catch (error) {
          console.error("Error checking user enrollments:", error);
          setHasEnrollments(false);
        } finally {
          setEnrollmentsLoaded(true);
        }
      } else {
        setEnrollmentsLoaded(true);
      }
    };

    checkUserEnrollments();
  }, [user]);

  // Helper function to determine if any buttons would be rendered
  const shouldShowAnyButtons = () => {
    const showConnectButton = !isMeetingPlatformConnected;
    const showLearningButton = hasEnrollments;
    return showConnectButton || showLearningButton;
  };

  // Determine when to show the modal - only after both checks are complete, if buttons would be shown, and if not shown before
  useEffect(() => {
    if (user && enrollmentsLoaded && !hasBeenShown) {
      // Show modal only if there are buttons to display and it hasn't been shown before
      if (shouldShowAnyButtons()) {
        setIsOpen(true);
      }
    }
  }, [user, isMeetingPlatformConnected, hasEnrollments, enrollmentsLoaded, hasBeenShown]);


  const handleClose = () => {
    setIsOpen(false);
    // Mark modal as shown for this user
    const modalShownKey = `meeting-platform-check-shown-${user?.id || 'anonymous'}`;
    localStorage.setItem(modalShownKey, 'true');
    setHasBeenShown(true);
  };

  const handleConnectClick = () => {
    navigate('/profile?tab=connections');
    setIsOpen(false);
    // Mark modal as shown for this user
    const modalShownKey = `meeting-platform-check-shown-${user?.id || 'anonymous'}`;
    localStorage.setItem(modalShownKey, 'true');
    setHasBeenShown(true);
  };

  const handleLearningDashboardClick = () => {
    navigate('/lms/dashboard');
    setIsOpen(false);
    // Mark modal as shown for this user
    const modalShownKey = `meeting-platform-check-shown-${user?.id || 'anonymous'}`;
    localStorage.setItem(modalShownKey, 'true');
    setHasBeenShown(true);
  };

  // Don't render if modal shouldn't be open, if no buttons would be shown, or if already been shown
  if (!isOpen || !shouldShowAnyButtons() || hasBeenShown) return null;

  return (
    <div className="meeting-platform-check-overlay">
      <div className="meeting-platform-check-modal">
        <button className="meeting-platform-check-close" onClick={handleClose}>×</button>
        <div className="meeting-platform-check-content">
          <h3>Welcome to GETHERD</h3>
          
          {/* Conditional messages based on connection and course status */}
          {!isMeetingPlatformConnected && hasEnrollments && (
            <p>Please connect to a platform below with the "Click here to connect" button and take our online learning with the "Let's Learn" button below!</p>
          )}
          
          {isMeetingPlatformConnected && hasEnrollments && (
            <p>One or more learning courses is available, please use the button below to learn more!</p>
          )}
          
          {!isMeetingPlatformConnected && !hasEnrollments && (
            <p>Please connect to a platform below with the "Click here to connect" button</p>
          )}
          
          <div className="flex gap-4 flex-wrap justify-center">
            {/* Show connect button for scenarios 1 and 3 (not connected) */}
            {!isMeetingPlatformConnected && (
              <button
                className="meeting-platform-check-connect-btn"
                onClick={handleConnectClick}
              >
                Click here to connect
              </button>
            )}
            
            {/* Show learning button for scenarios 1 and 2 (has courses) */}
            {hasEnrollments && (
              <button
                className="meeting-platform-check-connect-btn"
                onClick={handleLearningDashboardClick}
              >
                Let's Learn
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingPlatformCheck;