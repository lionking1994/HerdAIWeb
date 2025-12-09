import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import MeetingItem from './TodayScheduleMeetingItem';
import axios from 'axios';


const TodaysSchedule = () => {
  const [todayScheduleList, setTodayScheduleList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Poll interval in milliseconds (default: 2 minutes)
  const POLL_INTERVAL = 40000;

  useEffect(() => {
    fetchTodaysSchedule();

    const dataInterval = setInterval(() => {
      fetchTodaysSchedule();
    }, POLL_INTERVAL);

    // Clean up all intervals on unmount
    return () => {
      clearInterval(dataInterval);
    };
  }, []);

  const navigateToCalendar = () => {
    navigate('/calendarView');
  };

  const fetchTodaysSchedule = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const reuslt = await axios.post(
        `${process.env.REACT_APP_API_URL}/meeting/todays-schedule`,
        {
          time: new Date().toLocaleString(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (reuslt.status === 200) {
        const transformedMeetings = reuslt.data.meetings.map((meeting) => ({
          ...meeting,
          datetime: new Date(meeting.datetime), // ✅ Convert string to Date object
          agendaReason: meeting.agenda_reason || "No agenda available",
        }));
        console.log("API Result:", reuslt.data.meetings);

        setTodayScheduleList(transformedMeetings);
        setLastUpdated(new Date());
      } else if (reuslt.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
      }
    } catch (error) {
      console.error("Error fetching today's schedule:", error);
    } finally {
      setIsLoading(false);
    }
  };


  // Format current time with timezone for header


  return (
    <div className="h-full flex flex-col">
    

      <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full space-x-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 border-t-transparent"></div>
          </div>
        ) : todayScheduleList && todayScheduleList.length > 0 ? (
          todayScheduleList.map((item, index) => (
            <MeetingItem key={item.id || index} item={item} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center min-h-[140px]">
            <p className="text-gray-500">No meetings scheduled for today</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodaysSchedule;
