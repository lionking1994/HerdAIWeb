import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Users, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-toastify';

const MeetingPopup = ({ isOpen, onClose, meetingData, setMeetingData, onSubmit }) => {
  const [isAttendeeDropdownOpen, setIsAttendeeDropdownOpen] = useState(false);
  const [availableAttendees, setAvailableAttendees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Initialize attendees array if it's undefined
  useEffect(() => {
    if (!meetingData.attendees) {
      setMeetingData({
        ...meetingData,
        attendees: []
      });
    }
  }, [meetingData]);

  // Load available attendees when dropdown is opened
  useEffect(() => {
    if (isAttendeeDropdownOpen) {
      fetchAvailableAttendees();
    }
  }, [isAttendeeDropdownOpen, searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsAttendeeDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!meetingData) return null;

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(meetingData);
  };

  // Fetch available attendees from the server
  const fetchAvailableAttendees = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!searchTerm.trim()) {
        return;
      }
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/users/searchAgent`, {
        term: searchTerm,
        curEmails: meetingData.attendees.map(a => a.email)
      },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        // Filter out users who are already added as attendees
        const existingEmails = new Set((meetingData.attendees || []).map(a => a.email?.toLowerCase()));
        const filteredResults = response.data.users.filter(
          user => !existingEmails.has(user.email?.toLowerCase())
        );

        setAvailableAttendees(filteredResults);
      } else {
        setAvailableAttendees([]);
      }
    } catch (error) {
      toast.error('Failed to fetch available attendees');
      console.error('Error fetching available attendees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add attendee to the meeting
  const addAttendee = (attendee) => {
    setMeetingData({
      ...meetingData,
      attendees: [...(meetingData.attendees || []), attendee]
    });
    setIsAttendeeDropdownOpen(false);
    setSearchTerm('');
  };

  // Add new attendee by email
  const addNewAttendee = () => {
    if (!searchTerm || !searchTerm.includes('@')) return;

    const newAttendee = {
      name: searchTerm.split('@')[0],
      email: searchTerm
    };

    addAttendee(newAttendee);
  };

  // Remove attendee from the meeting
  const removeAttendee = (email) => {
    setMeetingData({
      ...meetingData,
      attendees: (meetingData.attendees || []).filter(a => a.email !== email)
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 z-[600000]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-[600001] overflow-y-auto"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Schedule Meeting</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Meeting Form Content */}
              <div className="space-y-6">
                <form onSubmit={handleSubmit}>
                  {/* Title */}
                  <div className="mb-4">
                    <label htmlFor="meeting-title" className="block text-sm font-medium text-gray-700 mb-1">
                      Meeting Title
                    </label>
                    <input
                      type="text"
                      id="meeting-title"
                      value={meetingData.title}
                      onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })}
                      placeholder="Enter meeting title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="mb-6">
                    <label htmlFor="meeting-description" className="block text-sm font-medium text-gray-700 mb-1">
                      <FileText className="h-4 w-4 inline mr-1" />
                      Description
                    </label>
                    <textarea
                      id="meeting-description"
                      value={meetingData.description}
                      onChange={(e) => setMeetingData({ ...meetingData, description: e.target.value })}
                      placeholder="Enter meeting description or agenda"
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Attendees Section */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Users className="h-4 w-4 inline mr-1" />
                      Attendees
                    </label>

                    {/* Attendee Combobox */}
                    <div className="relative" ref={dropdownRef}>
                      <div className="flex">
                        <div className="relative flex-grow">
                          <input
                            type="text"
                            placeholder="Search or enter email address"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setIsAttendeeDropdownOpen(true)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                          {isLoading && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={addNewAttendee}
                          className="px-3 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Add
                        </button>
                      </div>

                      {/* Dropdown for search results */}
                      {isAttendeeDropdownOpen && (
                        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                          {availableAttendees.length > 0 ? (
                            availableAttendees.map((attendee) => (
                              <div
                                key={attendee.id || attendee.email}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                                onClick={() => addAttendee(attendee)}
                              >
                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-2 text-xs text-blue-600">
                                  {(attendee.name || attendee.email || '').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium">{attendee.name || attendee.email}</div>
                                  {attendee.email && attendee.name !== attendee.email && (
                                    <div className="text-xs text-gray-500">{attendee.email}</div>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            searchTerm && !isLoading ? (
                              <div className="px-4 py-2 text-sm text-gray-700">
                                No results found. Enter a valid email to add a new attendee.
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected attendees */}
                    <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                      {(meetingData.attendees || []).map((attendee, index) => (
                        <div
                          key={attendee.email || `attendee-${index}`}
                          className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md"
                        >
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-2 text-xs text-blue-600">
                              {(attendee.name || attendee.email || '').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{attendee.name || attendee.email}</div>
                              {attendee.name && attendee.email && attendee.name !== attendee.email && (
                                <div className="text-xs text-gray-500">{attendee.email}</div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttendee(attendee.email)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end mt-3 mb-6 space-x-3">
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Create Meeting
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MeetingPopup;



