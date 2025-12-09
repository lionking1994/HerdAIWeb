import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./CreateMeeting.css";
import axios from 'axios';
import Notification from '../components/Notification';

const CreateMeeting = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingData, setMeetingData] = useState({
    title: "",
    duration: 30, // default duration in minutes
  });
  useEffect(() => {
    fetchUserData();
}, []);

const fetchUserData = async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            const userData = await response.json();
            console.log('User Data:', userData);
            setUser(userData);
            // You might want to fetch actual settings from the backend here
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    } finally {
        setIsLoading(false);
    }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Calculate start and end times based on current time and duration
    const startDateTime = new Date();
    const endDateTime = new Date(startDateTime.getTime() + meetingData.duration * 60000);

    const meetingBody = {
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      subject: meetingData.title,
      isRecordingEnabled: true,
      recordAutomatically: true,
      isTranscriptionEnabled: true,
      allowTranscription: true, // Enable transcription for the meeting
      isTranscriptionActive: true // Automatically start transcription
    };

    try {
      const response = await axios.post(
        'https://graph.microsoft.com/v1.0/me/onlineMeetings',
        meetingBody,
        {
          headers: {
            Authorization: `Bearer ${user.teams_access_token}`, // Assuming accessToken is stored in user object
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('Meeting Created:', response.data);

      const response1 = await axios.get(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${response.data.id}`,
        {
          headers: {
            Authorization: `Bearer ${user.teams_access_token}`, // Pass the access token
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Meeting Details:', response1.data);
      // Send meeting data to backend
      try {
        await axios.post(`${process.env.REACT_APP_API_URL}/teams/create-meeting`, {
          title: meetingData.title,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          teamsData: response.data,
          joinUrl: response.data.joinWebUrl
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      } catch (error) {
        console.error('Error saving meeting to database:', error);
        setNotification({
          type: 'error',
          message: 'Meeting created but failed to save to database'
        });
      }

      setMeetingUrl(response.data.joinWebUrl);
      setShowModal(true);
      setNotification({
        type: 'success',
        message: 'Meeting Created Successfully'
      });
    } catch (error) {
      console.error('Error Creating Meeting:', error.response?.data || error.message);
      if (error.response?.data.error.code === 'InvalidAuthenticationToken') {
        // TODO: Add error handling UI feedback
        setNotification({
            type: 'error',
            message: 'Please connect your Teams account'
          });
        navigate('/profile');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingUrl);
    setNotification({
      type: 'success',
      message: 'Meeting link copied to clipboard'
    });
  };

  return (
    <div className="create-meeting-container">
      <Navbar isAuthenticated={true} user={user} />

      <div className="create-meeting-content">
        <h1 className="page-title">Create New Activity</h1>

        <form onSubmit={handleSubmit} className="meeting-form">
          <div className="form-group">
            <label htmlFor="title">Activity Title</label>
            <div className="form-input-wrapper">
              <input
                type="text"
                id="title"
                placeholder="Enter meeting title"
                value={meetingData.title}
                onChange={(e) =>
                  setMeetingData({ ...meetingData, title: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="duration">Duration (minutes)</label>
            <select
              id="duration"
              value={meetingData.duration}
              onChange={(e) =>
                setMeetingData({
                  ...meetingData,
                  duration: parseInt(e.target.value),
                })
              }
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="create-button" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Activity...' : 'Create Activity'}
          </button>
        </form>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Activity Created Successfully</h2>
            <div className="meeting-link-container">
              <p>Activity Link:</p>
              <input 
                type="text" 
                value={meetingUrl} 
                readOnly 
                className="meeting-link-input"
              />
            </div>
            <div className="modal-buttons">
              <button onClick={handleCopyLink} className="copy-button">
                Copy Link
              </button>
              <button 
                onClick={() => window.open(meetingUrl, '_blank')} 
                className="join-button"
              >
                Join Now
              </button>
              <button 
                onClick={() => setShowModal(false)} 
                className="close-button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default CreateMeeting;
