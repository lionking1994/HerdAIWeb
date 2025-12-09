import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import "./MeetingsModal.css";

const MeetingsModal = ({ showMeetingsModal, setShowMeetingsModal, meetingsList, isLoading, onRetrieve }) => {
  const [selectedMeetings, setSelectedMeetings] = useState({});

  if (!showMeetingsModal) return null;

  const handleCheckboxChange = (meetingId) => {
    setSelectedMeetings(prev => ({
      ...prev,
      [meetingId]: !prev[meetingId]
    }));
  };

  const handleRetrieve = async () => {
    const selectedIds = Object.entries(selectedMeetings)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);
    const type = meetingsList[0].topic ? meetingsList[0].type==="gmeet" ? "gmeet" : "zoom" : "teams";
    const selectedMeetingList = meetingsList.filter(meeting => selectedIds.includes(`${meeting.id}`));
    onRetrieve(selectedMeetingList, type);
  };

  return (
    <div className="modal-overlay">
      <div className="meeting_modal-container">
        <div className="meeting_modal-content">
          <div className="modal-header">
            <h2>Activities List</h2>
            <button onClick={() => setShowMeetingsModal(false)} className="close-button">
              ✕
            </button>
          </div>
          <div className="meetings-list">
            {isLoading ? (
              <div className="meetings-loading">Loading activities...</div>
            ) : meetingsList?.length === 0 ? (
                <div className="meetings-empty">No activities held in last week.</div>
            ) : (
              meetingsList.map((meeting, index) => (
                <div 
                  key={index} 
                  className="meeting-item"
                  onClick={() => {
                      handleCheckboxChange(meeting.id);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedMeetings[meeting.id] || false}
                    disabled={!meeting.isValid}
                    onChange={(e) => {
                      e.stopPropagation(); // Prevent double triggering when clicking checkbox directly
                      handleCheckboxChange(meeting.id);
                    }}
                    className="meeting-checkbox"
                  />
                  <div className="meeting-details">
                    <h3>{meeting.topic ? meeting.topic : meeting.subject}</h3>
                    <p>Start: {meeting.topic ? new Date(meeting.start_time).toLocaleString() : new Date(meeting.startDateTime).toLocaleString()}</p>
                    <p>End: {meeting.topic ? 
                      new Date(new Date(meeting.start_time).getTime() + meeting.duration * 60000).toLocaleString() 
                      : new Date(meeting.endDateTime).toLocaleString()}</p>
                    <p>Participants: {(meeting.participants?.attendees?.length || 0) + 1}</p>
                    <p>Transcripts: {meeting.isValid ? "A transcript of the meeting exists." : "A transcript of the meeting does not exist."}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="modal-footer">
            <button onClick={handleRetrieve} className="retrieve-button">
              Retrieve
            </button>
            <button onClick={() => setShowMeetingsModal(false)} className="cancel-button">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingsModal; 