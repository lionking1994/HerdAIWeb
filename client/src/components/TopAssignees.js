import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, UserX2Icon, X, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import UserProfileDrawer from './UserProfileDrawer'; // Make sure this exists
import axios from 'axios';
import { toast } from 'react-toastify';
import useHttp from '../hooks/useHttp';


// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const TopAssignees = ({ onSetUserProfile, onSetIsProfileDrawerOpen }) => {
  const [topAssignees, setTopAssignees] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [assigneeTasks, setAssigneeTasks] = useState([]);
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const navigate = useNavigate();
  const { sendRequest } = useHttp();

  useEffect(() => {
    fetchTopAssignees();
  }, []);

  const fetchTopAssignees = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const data = await sendRequest({
        url: `${process.env.REACT_APP_API_URL}/tasks/top-assignees`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      setTopAssignees(data.assignees);
    } catch (error) {
      console.error('Error fetching top assignees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssigneeTasks = async (assigneeId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/tasks/assignee-tasks/${assigneeId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setAssigneeTasks(data.tasks);
      }
    } catch (error) {
      console.error("Error fetching assignee tasks:", error);
    }
  };

  const handleBarClick = (event) => {
    if (!chartRef.current) return;

    const chart = chartRef.current;
    const activePoints = chart.getElementsAtEventForMode(
      event.nativeEvent,
      'nearest',
      { intersect: true },
      false
    );
    console.log(activePoints)
    if (activePoints.length > 0) {
      const index = activePoints[0].index;
      console.log(index)
      if (topAssignees && index >= 0 && index < topAssignees.length) {
        const assignee = topAssignees[index];
        console.log(assignee)
        if (assignee && assignee.id) {
          setSelectedAssignee(assignee);
          fetchAssigneeTasks(assignee.id);
          setShowTaskPopup(true);
        }
      }
    }
  };

  const handleTaskClick = (taskId) => {
    navigate(`/task-details?id=${taskId}`);
    setShowTaskPopup(false);
  };

  // Chart data and options
  const chartData = {
    labels: topAssignees.map(a => a.name),
    datasets: [
      {
        label: 'Open Tasks',
        data: topAssignees.map(a => a.task_count),
        backgroundColor: 'rgba(37, 99, 235, 0.8)',
        borderColor: 'rgba(37, 99, 235, 1)',
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 30,
      },
    ],
  };

  // Custom label click handler
  const handleLabelClick = async (index) => {
    if (topAssignees && index >= 0 && index < topAssignees.length) {
      const assignee = topAssignees[index];
      if (assignee && assignee.id) {
        try {
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/users/get`, { userId: assignee.id },
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
        onSetUserProfile(response.data.user);
        onSetIsProfileDrawerOpen(true);
        } catch (error) {
          console.error('Error fetching user:', error);
          toast(error.response?.data?.error || 'Failed to fetch user');
        }
      }
    }
  };

  // Custom plugin for clickable labels
  const clickableLabelPlugin = {
    id: 'clickableLabelPlugin',
    afterEvent: (chart, args) => {
      const event = args.event;
      if (event.type === 'click') {
        const xAxis = chart.scales.x;
        if (!xAxis) return;
        const { x, y } = event;
        xAxis.ticks.forEach((tick, i) => {
          const labelX = xAxis.getPixelForTick(i);
          // Check if click is close to label on x axis (within 40px horizontally and 20px vertically)
          if (
            Math.abs(x - labelX) < 40 &&
            y > xAxis.top && y < xAxis.bottom + 20
          ) {
            console.log((i))
            handleLabelClick(i);
          }
        });
      }
    }
  };

  const chartOptions = {
    indexAxis: 'x', // For horizontal bar chart
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return `${context.raw} tasks`;
          }
        }
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          display: false,
        },
        ticks: {
          precision: 0,
          callback: function (value, index) {
            return this.getLabelForValue(value);
          },
          color: '#2563EB',
          font: {
            weight: 'bold',
            size: 14,
          },
        }
      },
      y: {
        grid: {
          display: false,
        },
      },
    }
    // Do not set onClick here, we use plugin
  };

  // Empty state component
  const EmptyState = () => (
    <motion.div
      className="flex flex-col items-center justify-center h-full py-12 px-6"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="w-24 h-24 bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1] rounded-full flex items-center justify-center mb-6"
        initial={{ rotateY: 0 }}
        animate={{ rotateY: 360 }}
        transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 }}
      >
        <Users size={32} className="text-[#64748b]" />
      </motion.div>

      <motion.h3
        className="text-xl font-semibold text-[#1e293b] mb-2"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        No Assignees Found
      </motion.h3>

      <motion.p
        className="text-[#64748b] text-center mb-6 max-w-sm"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Currently there are no team members with open tasks. All work has been completed or no tasks have been assigned yet.
      </motion.p>

      <motion.div
        className="flex items-center gap-2 text-sm text-[#64748b]"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <UserCheck size={16} />
        <span>All tasks completed or unassigned</span>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.div
              className="w-8 h-8 border-2 border-gray-500 border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        ) : (
          <div className="h-full relative min-h-0">
              {(topAssignees && topAssignees.length > 0) ? (
                <div className="h-full w-full min-h-0" onClick={handleBarClick}>
                  <Bar
                    className="h-full w-full"
                    ref={chartRef}
                    data={chartData}
                    options={chartOptions}
                    plugins={[clickableLabelPlugin]}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <EmptyState />
                </div>
              )}
          </div>
        )}
      </div>

      {showTaskPopup && selectedAssignee && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <motion.div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div className="flex items-center gap-3">
                {selectedAssignee.avatar ? (
                  <img
                    src={`${process.env.REACT_APP_API_URL}/avatars/${selectedAssignee.avatar}`}
                    alt={selectedAssignee.name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium border border-blue-200">
                    {selectedAssignee.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedAssignee.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedAssignee.task_count} open tasks
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTaskPopup(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h4 className="text-sm font-medium text-gray-700">Task List</h4>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {assigneeTasks.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {assigneeTasks.map(task => (
                    <li
                      key={task.id}
                      className="p-4 hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => handleTaskClick(task.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{task.title}</div>
                          <div className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</div>
                          {task.duedate && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                              </svg>
                              <span>Due: {new Date(task.duedate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p>Loading tasks...</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowTaskPopup(false)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default TopAssignees;
