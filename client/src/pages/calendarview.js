import React, { useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import format from "date-fns/format";
import parse from "date-fns/parse";
import { useDispatch, useSelector } from 'react-redux';
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import Navbar from "../components/Navbar";
import { loginFailure, loginSuccess } from '../store/slices/authSlice';
import Footer from "../components/Footer";
import axios from "axios";
import { useNavigate } from "react-router-dom";


const Calendarview = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const locales = {
    "en-US": require("date-fns/locale/en-US"),
  };
  const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
  });
  const [myEventsList, setMyEventsList] = useState([]);
  // Fetch AI Summary
  const fetchAiSummary = async () => {
    const token = localStorage.getItem("token");
    try {
       setLoadingSummary(true);
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/calendar/get-upcoming-meetings-understand-schedule`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.ai_summary);
      } else {
        console.error("Failed to fetch AI summary");
      }
    } catch (err) {
      console.error("Error fetching AI summary:", err);
    }
    finally {
    setLoadingSummary(false);
  }
  };
  const fetchAllMeetings = async () => {
    const token = localStorage.getItem("token");
    //get user meeting through getherd DB
    let userAllMeeting = [];
    try {
      const responseTeams = await fetch(
        `${process.env.REACT_APP_API_URL}/calendar/get-All-Upcoming-Meeting`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (responseTeams.ok) {
        const data = await responseTeams.json();
        userAllMeeting = data.upcomingMeeting.map((meeting) => ({
          title: meeting.subject,
          start: new Date(meeting.start),
          end: new Date(meeting.end),
          id: meeting.id, // Assuming each meeting has a unique ID
        }));
      } else if (responseTeams.status === 403) {
        userAllMeeting = [];
      }
    } catch (error) {
      userAllMeeting = [];
    }
    setMyEventsList(userAllMeeting);
    console.log("Combined Events:", userAllMeeting);
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

  const handleEventClick = (event) => {
    if (!event.id) {
      console.error("Event ID is missing:", event);
      return;
    }
    navigate(`/meeting-detail?id=${event.id}`);
  };
  useEffect(() => {
    if (user) {
      fetchAiSummary();
      fetchAllMeetings();
    }
  }, [user]);

  useEffect(() => {
    
    if (!user) {
      fetchUserData();
    }
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <Navbar isAuthenticated={true} user={user} />
      <h2
        className="text-center text-2xl font-bold my-4"
        style={{ marginBottom: 0 }}
      >
        Calendar View
      </h2>
      {loadingSummary && (
  <div className="text-center text-gray-500 my-4">Loading summary...</div>
)}
      {aiSummary && (
        <div className="bg-blue-50 shadow rounded-xl mx-4 p-6 my-4 flex flex-col sm:flex-row sm:justify-between sm:items-start">
          {/* LEFT SECTION */}
          <div className="sm:w-2/3">
            {/* Capability */}
            <div className="flex items-center mb-2">
              <div className="text-sm text-gray-500">Capability</div>
              <div className="ml-2 w-32">
                <div className="bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full"
                    style={{ width: `${aiSummary.capability_score}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {aiSummary.capability_score}%
                </div>
              </div>
            </div>

            {/* Primary Focus */}
            <div className="mt-4">
              <div className="flex items-center mb-1">
                <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center mr-2">
                  <svg
                    className="w-4 h-4 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 
                       10-4.48 10-10S17.52 2 12 2zm0 18
                       c-4.41 0-8-3.59-8-8s3.59-8 8-8
                       8 3.59 8 8-3.59 8-8 8zm0-14
                       c-3.31 0-6 2.69-6 6s2.69 6 6 6
                       6-2.69 6-6-2.69-6-6-6zm0 10
                       c-2.21 0-4-1.79-4-4s1.79-4 4-4
                       4 1.79 4 4-1.79 4-4 4z"
                    />
                  </svg>
                </div>
                <div className="text-sm font-semibold text-gray-600">
                  Primary Focus
                </div>
              </div>
              <div className="text-lg font-bold text-blue-600">
                {aiSummary.primary_focus}
              </div>
              <div className="text-sm text-gray-500">
                Secondary: {aiSummary.secondary_focus}
              </div>
            </div>

            {/* Key Themes */}
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-600 mb-2">
                Key Themes
              </div>
              <div className="flex flex-wrap gap-2">
                {aiSummary.key_themes.map((theme, idx) => (
                  <span
                    key={idx}
                    className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SECTION */}
          <div className="sm:w-1/3 mt-6 sm:mt-0">
            <div className="text-sm font-semibold text-purple-700 flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Prep Research
            </div>
            <ul className="mt-2 text-sm text-purple-600 space-y-1">
              {aiSummary.key_research_areas.map((item, idx) => (
                <li key={idx} className="list-disc list-inside">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex-1 px-4">
        <Calendar
          localizer={localizer}
          events={myEventsList}
          startAccessor="start"
          endAccessor="end"
          defaultView="month"
          views={["month", "week", "day", "agenda"]}
          style={{ height: 600 }}
          popup={true}
          onSelectEvent={handleEventClick} // <<--- Add this line
        />
      </div>
      <Footer />
    </div>
  );
};

export default Calendarview;
