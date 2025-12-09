import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-toastify';
import { CheckSquare, Star, Clock, Calendar, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PerformanceMetrics = memo(({ selectedQuarter, userId }) => {
    // Split state variables
    const [openTasks, setOpenTasks] = useState({ count: 0, loading: true });
    const [avgReviewRating, setAvgReviewRating] = useState({ rating: 0, count: 0, loading: true });
    const [timeInMeetings, setTimeInMeetings] = useState({
        percentage: 0,
        totalMeetingHours: 0,
        totalWorkingHours: 0,
        meetingCount: 0,
        loading: true
    });
    const [timeOnTasks, setTimeOnTasks] = useState({
        hours: 0,
        minutes: 0,
        totalEstimatedDays: 0,
        tasksCompleted: 0,
        tasks: [],
        loading: true
    });
    const [monthlyReviewRating, setMonthlyReviewRating] = useState({
        rating: 0,
        count: 0,
        monthlyData: [],
        loading: true
    });

    const fetchOpenTasks = useCallback(async () => {
        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/tasks/filtered-opentasks`,
                { statusFilter: 'AllOpen', textFilter: '', userId: userId },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );

            setOpenTasks({
                count: response.data.tasks?.length || 0,
                loading: false
            });
        } catch (error) {
            console.error('Error fetching open tasks:', error);
            setOpenTasks({ count: 0, loading: false });
        }
    }, []);

    const fetchTimeInMeetings = useCallback(async () => {
        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/meeting/get-time-in-meetings-percentage`,
                { userId: userId },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );

            const data = response.data.data;

            setTimeInMeetings({
                percentage: data.percentage,
                totalMeetingHours: data.totalMeetingHours,
                totalWorkingHours: data.totalWorkingHours,
                meetingCount: data.meetingCount,
                loading: false
            });
        } catch (error) {
            console.error('Error fetching time in meetings:', error);
            setTimeInMeetings({
                percentage: 0,
                totalMeetingHours: 0,
                totalWorkingHours: 0,
                meetingCount: 0,
                loading: false
            });
        }
    }, []);


    const fetchTimeOnTasks = useCallback(async () => {
        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/tasks/get-time-on-tasks-ai-estimates`,
                { userId: userId },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );

            const data = response.data.data;

            setTimeOnTasks({
                hours: data.hours,
                minutes: data.minutes,
                totalEstimatedDays: data.totalEstimatedDays,
                tasksCompleted: data.tasksCompleted,
                tasks: data.tasks,
                loading: false
            });
        } catch (error) {
            console.error('Error fetching time on tasks:', error);
            setTimeOnTasks({
                hours: 0,
                minutes: 0,
                totalEstimatedDays: 0,
                tasksCompleted: 0,
                tasks: [],
                loading: false
            });
        }
    }, []);

    const fetchMonthlyReviewRating = useCallback(async () => {
        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/tasks/get-monthly-review-rating-ytd`,
                { userId: userId },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );

            const monthlyData = response.data.data || [];
            console.log("monthlyData", monthlyData);

            // Calculate overall average rating only from Jan to current month
            const countReviewMonth = monthlyData.reduce((sum, item) => item.average_rating > 0 ? sum + 1 : sum, 0);
            const rating = countReviewMonth > 0
                ? monthlyData.reduce((sum, item) => sum + item.average_rating, 0) / countReviewMonth
                : 0;
            setAvgReviewRating({
                rating: rating,
                count: monthlyData.reduce((sum, item) => sum + item.review_count, 0),
                loading: false
            });
            setMonthlyReviewRating({
                rating: rating,
                count: monthlyData.reduce((sum, item) => sum + item.review_count, 0),
                monthlyData: monthlyData,
                loading: false
            });
        } catch (error) {
            console.error('Error fetching monthly review rating:', error);
            setMonthlyReviewRating({
                rating: 0,
                count: 0,
                monthlyData: [],
                loading: false
            });
        }
    }, []);

    const fetchMetrics = useCallback(async () => {
        try {
            await Promise.all([
                fetchOpenTasks(),
                fetchTimeInMeetings(),
                fetchTimeOnTasks(),
                fetchMonthlyReviewRating()
            ]);
        } catch (error) {
            console.error('Error fetching metrics:', error);
        }
    }, [fetchOpenTasks, fetchTimeInMeetings, fetchTimeOnTasks, fetchMonthlyReviewRating]);

    useEffect(() => {
        fetchMetrics();
    }, [selectedQuarter, fetchMetrics]);

    const MetricCard = memo(({ title, value, icon: Icon, loading, subtitle, color = "bg-blue-500" }) => (
        <div
            className={`${color} text-white p-4 rounded-lg flex justify-between items-center text-center h-full px-6`}
        >
            <div className='flex flex-col items-center justify-center'>
                <Icon className="w-6 h-6 mb-2" />
                <div className="text-lg font-bold">
                    {loading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mx-auto"></div>
                    ) : (
                        value
                    )}
                </div>
            </div>
            <div className="text-xs opacity-90">{title}</div>
        </div>
    ));

    const MonthlyRatingChart = memo(({ data, loading }) => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                </div>
            );
        }

        if (!data || data.length === 0) {
            return (
                <div className="flex items-center justify-center h-full text-white text-sm">
                    No rating data available
                </div>
            );
        }

        return (
            <div className="h-full w-full">
                <div className="flex items-center justify-center mb-2">
                    <BarChart3 className="w-5 h-5 mr-2 text-white" />
                    <span className="text-sm font-semibold text-white">Monthly Review Rating (YTD)</span>
                </div>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                            <XAxis
                                dataKey="month_name"
                                tick={{ fill: 'white', fontSize: 10 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.5)' }}
                            />
                            <YAxis
                                domain={[0, 5]}
                                tick={{ fill: 'white', fontSize: 10 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.5)' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }}
                                formatter={(value, name) => [`${value.toFixed(1)}/5`, 'Rating']}
                                labelFormatter={(label) => `${label}`}
                            />
                            <Line
                                type="monotone"
                                dataKey="rating"
                                stroke="#ffffff"
                                strokeWidth={2}
                                dot={{ fill: '#ffffff', strokeWidth: 2, r: 3 }}
                                activeDot={{ r: 4, fill: '#ffffff' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="text-center mt-2">
                    <span className="text-xs text-white opacity-90">
                        {monthlyReviewRating.count} total reviews • Avg: {monthlyReviewRating.rating.toFixed(1)}/5
                    </span>
                </div>
            </div >
        );
    });

    return (
        <div className="h-full p-4">
            {/* 2x3 Grid Layout */}
            <div className="flex flex-col gap-3 h-full">
                {/* Top Row - 2 columns */}
                <div className="grid grid-cols-2 gap-3">
                    <MetricCard
                        title="Open Tasks"
                        value={openTasks.count}
                        icon={CheckSquare}
                        loading={openTasks.loading}
                        color="bg-orange-500"
                    />
                    <MetricCard
                        title="Avg Review Rating"
                        value={avgReviewRating.loading ? '' : `${avgReviewRating.rating.toFixed(1)}/5`}
                        icon={Star}
                        loading={avgReviewRating.loading}
                        subtitle={`${avgReviewRating.count} reviews`}
                        color="bg-yellow-500"
                    />
                </div>

                {/* Middle Row - 2 columns */}
                <div className="grid grid-cols-2 gap-3">
                    <MetricCard
                        title="Time in Meetings"
                        value={timeInMeetings.loading ? '' : `${timeInMeetings.percentage}%`}
                        icon={Calendar}
                        loading={timeInMeetings.loading}
                        subtitle={`${timeInMeetings.totalMeetingHours}h of ${timeInMeetings.totalWorkingHours}h`}
                        color="bg-green-500"
                    />
                    <MetricCard
                        title="Time on Tasks"
                        value={timeOnTasks.loading ? '' : `${timeOnTasks.hours}h ${timeOnTasks.minutes}m`}
                        icon={Clock}
                        loading={timeOnTasks.loading}
                        subtitle="Today (est.)"
                        color="bg-purple-500"
                    />
                </div>

                {/* Bottom Row - Full width with Chart */}
                <div className="grid grid-cols-1">
                    <motion.div
                        className="bg-indigo-500 text-white p-4 rounded-lg h-full min-h-[300px]"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <MonthlyRatingChart
                            data={monthlyReviewRating.monthlyData}
                            loading={monthlyReviewRating.loading}
                        />
                    </motion.div>
                </div>
            </div>
        </div>
    );
});

PerformanceMetrics.displayName = 'PerformanceMetrics';

export default PerformanceMetrics;