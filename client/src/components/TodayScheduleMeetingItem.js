import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addMeeting } from '../store/slices/upcomingMeetingSlice';
import { addResearch } from "../store/slices/upcomingResearchSlice";
import axios from 'axios';
import { motion } from 'framer-motion';
import { Tooltip } from './Tooltip';
import { AlertTriangle } from 'lucide-react';

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.3
    }
  })
};

const TodayScheduleMeetingItem = ({ item }) => {
  const [meeting, setMeeting] = useState(item);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isLoadingForResearch, setIsLoadingForResearch] = useState(false);

  const handlePrepMeeting = (meeting) => {
    console.log('handlePrepMeeting...');
    console.log(meeting);
    try {
      dispatch(addMeeting({
        id: meeting?.id,
        title: meeting?.title
      }));
    } catch (error) {
      console.log(error);
    }
  };

  const handleGetResarchTopic = async (meeting) => {
    if (isLoadingForResearch) return;

    setIsLoadingForResearch(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/meeting/get-research-topic`,
        { meetingId: meeting?.id },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.status === 200) {
        const data = response.data;
        setMeeting(prev => ({ ...prev, research_topic: data.research_topic }));
      }
    } catch (error) {
      console.error('Error fetching research:', error);
    } finally {
      setIsLoadingForResearch(false);
    }
  };

  useEffect(() => {
    console.log(meeting);
  }, [meeting]);

  const handleUpcomingResearch = (meeting) => {
    dispatch(addResearch({ research_topic: meeting.research_topic }));
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate estimated cost (same as MeetingDetail.js)
  const durationHours = meeting?.duration ? meeting.duration / 60 : 0;
  const totalCPH = meeting?.participants?.reduce((sum, participant) => sum + (participant.est_cph || 0), 0) || 0;
  const estimatedCost = totalCPH * durationHours;

  return (
    <>
      <motion.div
        key={meeting?.id}
        className="w-full flex items-center gap-3 p-2 rounded-lg bg-[#ebf5ff] hover:bg-[#e6f2ff] transition-colors cursor-pointer"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
      >
        <div
          onClick={() => { handlePrepMeeting(meeting); }}
          className="flex flex-col items-center justify-center bg-[#2563EB] text-white w-24 h-14 rounded-md"
        >
          <span className="text-sm">
            {formatTime(meeting?.schedule_datetime_local)}
          </span>
        </div>

        <div className="flex justify-between items-center flex-1 px-2">
          <div className="min-w-0">
            <p
              onClick={() => navigate(`/meeting-detail?id=${meeting.id}`)}
              className="font-medium text-[#1e293b] underline flex items-center gap-6"
            >
              {meeting?.title}
              {meeting?.agendaReason && (
                <Tooltip text={meeting?.agendaReason}>
                  
                  <span className="no-underline text-yellow-500 text-base cursor-pointer"><AlertTriangle className="text-yellow-500 w-6 h-6" /></span>
                  {/* If you prefer image: */}
                  {/* <img src="/warning_icon.png" alt="Warning" className="w-4 h-4 ml-1" /> */}
                </Tooltip>
              )}
            </p>
            <p className="text-sm text-[#64748b] flex gap-2">
              {meeting?.duration} {meeting?.duration === 1 ? 'min' : 'mins'}
            </p>
          </div>
        </div>
              {/* Estimated Cost Display - Only show if company allows it */}
              {meeting?.show_cost_estimates && (
                  <div className="flex flex-col items-end justify-center min-w-[100px] mr-2">
                      <span className="text-base text-gray-700 font-semibold">Est cost: ${estimatedCost.toFixed(0)}</span>
                  </div>
              )}
        <div className='flex gap-2 mr-1'>
          <div
            onClick={() => { handlePrepMeeting(meeting); }}
            className="h-full flex flex-col items-center justify-center"
          >
            <img
              src={'/chat_icon.png'}
              alt="Meeting Icon"
              className="w-[30px] h-[30px] md:h-10 md:w-10 object-cover rounded-full m-auto"
            />
          </div>
          <a 
            href={meeting?.join_url} 
            target="_blank" 
            className="px-4 py-2 text-sm text-blue-600 font-semibold border-2 border-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all duration-200 ease-in-out shadow-sm hover:shadow-md"
          > 
            Join
          </a>
        </div>
      </motion.div>
    </>
  );
};

export default TodayScheduleMeetingItem;
