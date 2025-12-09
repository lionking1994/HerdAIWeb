import React, { useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Users, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';

const Last10Meetings = memo(({ userId }) => {
    const [meetings, setMeetings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchLast10Meetings();
    }, []);

    const fetchLast10Meetings = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem("token");
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/meeting/get-last-10-meetings`,
                { time: new Date().toLocaleString(), userId: userId },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.status === 200) {
                setMeetings(response.data.meetings);
            } else if (response.status === 403) {
                localStorage.removeItem("token");
                navigate("/");
            }
        } catch (error) {
            console.error("Error fetching last 10 meetings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMeetingClick = (meetingId) => {
        navigate(`/meeting-detail?id=${meetingId}`);
    };

    const formatMeetingDate = (dateString) => {
        try {
            return format(new Date(dateString), 'MMM dd, HH:mm');
        } catch {
            return 'Invalid Date';
        }
    };

    const truncateTitle = (title, maxLength = 25) => {
        if (!title) return 'Untitled Meeting';
        return title.length > maxLength ? `${title.substring(0, maxLength)}...` : title;
    };

    const MeetingItem = ({ meeting, index }) => (
        <motion.div
            className="flex items-center p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => handleMeetingClick(meeting.id)}
        >
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <Calendar className="w-5 h-5 text-blue-600" />
            </div>

            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {truncateTitle(meeting.title)}
                </h3>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatMeetingDate(meeting.datetime)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{meeting.participants_count || 0}</span>
                    </div>
                    {meeting.duration && (
                        <span>{meeting.duration}min</span>
                    )}
                </div>
            </div>

            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </motion.div>
    );

    return (
        <motion.div
            className="h-full flex flex-col"
        >
            <div className="p-4 border-b border-gray-200">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Last 10 Meetings
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading ? (
                    // Loading skeleton
                    Array.from({ length: 5 }, (_, index) => (
                        <div key={`skeleton-${index}`} className="animate-pulse">
                            <div className="flex items-center p-3 bg-gray-100 rounded-lg">
                                <div className="w-10 h-10 bg-gray-300 rounded-lg mr-3"></div>
                                <div className="flex-1">
                                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : meetings.length === 0 ? (
                    <motion.div
                        className="flex flex-col items-center justify-center h-full text-center py-8"
                    >
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Calendar className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Meetings</h3>
                        <p className="text-gray-500 text-sm">
                            Your recent meetings will appear here once you start having them.
                        </p>
                    </motion.div>
                ) : (
                    meetings.map((meeting, index) => (
                        <MeetingItem key={meeting.id} meeting={meeting} index={index} />
                    ))
                )}
            </div>
        </motion.div>
    );
});

Last10Meetings.displayName = 'Last10Meetings';

export default Last10Meetings; 