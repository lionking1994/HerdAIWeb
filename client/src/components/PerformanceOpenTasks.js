import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { format } from "date-fns";

const PerformanceOpenTasks = ({ userId }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('open'); // 'open' or 'overdue'
    const navigate = useNavigate();

    useEffect(() => {
        fetchOpenTasks();
    }, []);

    const fetchOpenTasks = async () => {
        try {
            setLoading(true);
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/tasks/filtered-opentasks`,
                { statusFilter: 'AllOpen', textFilter: '', userId: userId },
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );

            if (response && response.data && response.data.tasks) {
                // Sort by due date and take first 10
                const sortedTasks = response.data.tasks
                    .sort((a, b) => {
                        if (!a.duedate && !b.duedate) return 0;
                        if (!a.duedate) return 1;
                        if (!b.duedate) return -1;
                        return new Date(a.duedate) - new Date(b.duedate);
                    })
                    .slice(0, 10);

                setTasks(sortedTasks);
            }
        } catch (error) {
            console.error("Error fetching open tasks:", error);
            toast.error('Failed to fetch open tasks');
        } finally {
            setLoading(false);
        }
    };

    const navigateToTask = (taskId) => {
        navigate(`/task-details?id=${taskId}`);
    };

    const isOverdue = (dueDate) => {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
    };

    const formatDueDate = (dueDate) => {
        if (!dueDate) return 'No due date';
        try {
            const date = new Date(dueDate);
            const now = new Date();
            const diffTime = date - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                return `${Math.abs(diffDays)} days overdue`;
            } else if (diffDays === 0) {
                return 'Due today';
            } else if (diffDays === 1) {
                return 'Due tomorrow';
            } else {
                return `Due in ${diffDays} days`;
            }
        } catch {
            return 'Invalid date';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority?.toLowerCase()) {
            case 'high': return 'bg-red-100 text-red-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'low': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'bg-gray-100 text-gray-800';
            case 'assigned': return 'bg-blue-100 text-blue-800';
            case 'in progress': return 'bg-purple-100 text-purple-800';
            case 'ready for review': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const filteredTasks = activeTab === 'open'
        ? tasks
        : tasks.filter(task => isOverdue(task.duedate));

    const TaskItem = ({ task, index }) => (
        <motion.div
            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all group ${isOverdue(task.duedate)
                ? 'bg-red-50 border-red-200 hover:shadow-md'
                : 'bg-white border-gray-200 hover:shadow-md'
                }`}
            onClick={() => navigateToTask(task.id)}
        >
            <div className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center mr-3 ${isOverdue(task.duedate) ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                {isOverdue(task.duedate) ? (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                ) : (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {task.title || 'Untitled Task'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span className={isOverdue(task.duedate) ? 'text-red-600 font-medium' : ''}>
                            {formatDueDate(task.duedate)}
                        </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority || 'Medium'}
                    </span>
                </div>
            </div>

            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </motion.div>
    );

    const openTasksCount = tasks.length;
    const overdueTasksCount = tasks.filter(task => isOverdue(task.duedate)).length;

    return (
        <motion.div
            className="h-full flex flex-col"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                        Open Tasks
                    </h2>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1">
                    <button
                        onClick={() => setActiveTab('open')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'open'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                    >
                        All Open ({openTasksCount})
                    </button>
                    <button
                        onClick={() => setActiveTab('overdue')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                    >
                        Overdue ({overdueTasksCount})
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    // Loading skeleton
                    Array.from({ length: 5 }, (_, index) => (
                        <div key={`skeleton-${index}`} className="animate-pulse">
                            <div className="flex items-center p-3 bg-gray-100 rounded-lg">
                                <div className="w-8 h-8 bg-gray-300 rounded-md mr-3"></div>
                                <div className="flex-1">
                                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : filteredTasks.length === 0 ? (
                    <motion.div
                        className="flex flex-col items-center justify-center h-full text-center py-8"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            {activeTab === 'overdue' ? (
                                <AlertCircle className="w-8 h-8 text-red-400" />
                            ) : (
                                <CheckSquare className="w-8 h-8 text-gray-400" />
                            )}
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {activeTab === 'overdue' ? 'No Overdue Tasks' : 'No Open Tasks'}
                        </h3>
                        <p className="text-gray-500 text-sm">
                            {activeTab === 'overdue'
                                ? 'Great job! You have no overdue tasks.'
                                : 'All caught up! No open tasks at the moment.'}
                        </p>
                    </motion.div>
                ) : (
                    filteredTasks.map((task, index) => (
                        <TaskItem key={task.id} task={task} index={index} />
                    ))
                )}
            </div>
        </motion.div>
    );
};

export default PerformanceOpenTasks; 