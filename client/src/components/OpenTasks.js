import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckSquare, Clock, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { format } from 'date-fns'
import { createColumnHelper } from '@tanstack/react-table'
import EnhancedDataTable from './DataTable/EnhancedDataTable'
import { useSelector } from 'react-redux'
import useHttp from '../hooks/useHttp'  
const OpenTasks = () => {
  const [openTasks, setOpenTasks] = useState([])
  const [reviewTasks, setReviewTasks] = useState([])
  const [filteredTasks, setFilteredTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('open') // 'open' or 'review'
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const { sendRequest } = useHttp();
  // Table state - Default sorting by due date (most recent first)
  const [sorting, setSorting] = useState([{ id: 'duedate', desc: true }])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 5, // Smaller page size for component
  })

  const columnHelper = createColumnHelper()

  // Add stream skeleton styles
  const streamSkeletonStyles = `
    .skeleton-stream-opentasks {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: stream-opentasks 1.5s infinite;
    }

    @keyframes stream-opentasks {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  `

  // Inject styles
  useEffect(() => {
    const styleId = 'skeleton-stream-styles-opentasks'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = streamSkeletonStyles
      document.head.appendChild(style)
    }
  }, [])

  useEffect(() => {
    fetchOpenTasks()
    fetchReviewTasks()
  }, [sorting]) // Re-fetch when sorting changes

  // Filter tasks based on active tab
  useEffect(() => {
    if (activeTab === 'open') {
      setFilteredTasks(openTasks)
    } else if (activeTab === 'review') {
      setFilteredTasks(reviewTasks)
    }
    // Reset pagination when switching tabs
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [activeTab, openTasks, reviewTasks, user?.id])

  const fetchOpenTasks = async () => {
    try {
      setLoading(true)

      // Prepare sorting parameters for the backend
      const params = new URLSearchParams()

      // Always include sorting parameters (default or user-selected)
      if (sorting.length > 0) {
        params.append('sort_by', sorting[0].id)
        params.append('sort_order', sorting[0].desc ? 'desc' : 'asc')
      } else {
        // Fallback to default sorting if somehow sorting is empty
        params.append('sort_by', 'duedate')
        params.append('sort_order', 'desc')
      }

      const response = await sendRequest({
        url: `${
          process.env.REACT_APP_API_URL
        }/tasks/filtered-opentasks?${params.toString()}`,
        method: 'POST',
        body: {
          statusFilter: 'AllOpen',
          textFilter: '',
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        }
      })
      console.log("response", response)
      if (response && response.tasks) {
          // Transform tasks for the data table
          const openTasks = response.tasks.filter(
            (task) =>
              (task.status || '').toLowerCase() !==
              'ready for review'.toLowerCase()
          )
          const transformedTasks = openTasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            duedate: task.duedate,
            priority: task.priority || 'Medium',
            meeting_owner_name: task.meeting_owner_name || 'Unassigned',
            assignee_name: task.assignee_name || 'Unassigned',
            assigned_id: task.assigned_id, // Add assigned_id for review filtering
            status: task.status || 'Pending',
            onClick: () => navigate(`/task-details?id=${task.id}`),
          }))
          console.log("transformedTasks", transformedTasks)
          setOpenTasks(transformedTasks)
      } else if (response.status === 403) {
        localStorage.removeItem('token')
        navigate('/')
      }
    } catch (error) {
      console.error('Error fetching open tasks:', error)
      toast.error(`Failed to fetch open tasks`, {
        autoClose: 5000,
        position: 'top-right',
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: 'colored',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchReviewTasks = async () => {
    try {
      setLoading(true)

      // Prepare sorting parameters for the backend
      const params = new URLSearchParams()

      // Always include sorting parameters (default or user-selected)
      if (sorting.length > 0) {
        params.append('sort_by', sorting[0].id)
        params.append('sort_order', sorting[0].desc ? 'desc' : 'asc')
      } else {
        // Fallback to default sorting if somehow sorting is empty
        params.append('sort_by', 'duedate')
        params.append('sort_order', 'desc')
      }

      const response = await sendRequest({
        url: `${
          process.env.REACT_APP_API_URL
        }/tasks/filtered-reviewtasks?${params.toString()}`,
        method: 'POST',  
        body: {
          statusFilter: 'Ready For Review',
          textFilter: '',
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        }
      })

      if (response && response.tasks) {
          // Transform tasks for the data table
          const transformedTasks = response.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            duedate: task.duedate,
            priority: task.priority || 'Medium',
            meeting_owner_name: task.meeting_owner_name || 'Unassigned',
            assignee_name: task.assignee_name || 'Unassigned',
            assigned_id: task.assigned_id, // Add assigned_id for review filtering
            status: task.status || 'Pending',
            onClick: () => navigate(`/task-details?id=${task.id}`),
          }))
          setReviewTasks(transformedTasks)
      } else if (response.status === 403) {
        localStorage.removeItem('token')
        navigate('/')
      }
    } catch (error) {
      console.error('Error fetching review tasks:', error)
      toast.error(`Failed to fetch review tasks`, {
        autoClose: 5000,
        position: 'top-right',
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: 'colored',
      })
    } finally {
      setLoading(false)
    }
  }
  const navigateTask = async (taskId) => {
    navigate(`/task-details?id=${taskId}`)
  }

  // Handle pagination changes
  const handlePaginationChange = (newPagination) => {
    setPagination(newPagination)
  }

  // Handle sorting changes
  const handleSortingChange = (newSorting) => {
    setSorting(newSorting)
  }

  // Column definitions for EnhancedDataTable
  const columns = [
    columnHelper.accessor('title', {
      header: 'Task Title',
      cell: (info) => (
        <div
          className="flex items-center gap-2 cursor-pointer hover:text-blue-600"
          onClick={() => navigateTask(info.row.original.id)}
        >
          <div className="w-6 h-6 bg-[#f1f5f9] rounded-md flex items-center justify-center">
            <CheckSquare size={14} className="text-primary-600" />
          </div>
          <span className="font-medium text-[#1e293b]">{info.getValue()}</span>
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('duedate', {
      header: 'Due Date',
      cell: (info) => (
        <div className="flex items-center gap-1 text-[#475569]">
          <Clock size={14} />
          <span>
            {info.getValue()
              ? format(new Date(info.getValue()), 'MM/dd/yyyy')
              : 'No Due Date'}
          </span>
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <motion.span
          className="flex items-center gap-1 text-sm font-medium text-[#475569] bg-[#f1f5f9] px-2 py-1 rounded-full inline-block"
          whileHover={{ scale: 1.05 }}
        >
          {info.getValue()}
        </motion.span>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: (info) => (
        <span
          className={`priority-badge ${
            info.getValue()?.toLowerCase() || 'medium'
          }`}
        >
          {info.getValue() || 'Medium'}
        </span>
      ),
      enableSorting: true,
    }),
  ]

  // Get counts for tabs
  const openTasksCount = openTasks.length
  const reviewTasksCount = reviewTasks.length

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg border border-gray-100 h-[500px] tour-open-tasks overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="h-full flex flex-col">
        <div className="bg-gradient-to-r from-blue-400 to-blue-500 px-6 py-2">
          {/* Enhanced Task Header - Similar to Workflow Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Enhanced Icon */}
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <CheckSquare className="w-6 h-6 text-white" />
              </div>

              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white">Tasks</h2>
                <p className="text-blue-100 text-sm mt-1">
                  Manage and track your open tasks
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === 'open'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}
                onClick={() => setActiveTab('open')}
              >
                Open Tasks ({openTasksCount})
              </button>

              <div className="w-px h-8 bg-white/30"></div>

              <button
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === 'review'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}
                onClick={() => setActiveTab('review')}
              >
                Review ({reviewTasksCount})
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50/30 flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <motion.div
                className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : filteredTasks.length === 0 ? (
            <motion.div
              className="flex flex-col items-center justify-center h-full px-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="w-24 h-24 bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1] rounded-full flex items-center justify-center mb-6"
                initial={{ rotateY: 0 }}
                animate={{ rotateY: 360 }}
                transition={{
                  duration: 2,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
              >
                <CheckSquare size={32} className="text-[#64748b]" />
              </motion.div>

              <motion.h3
                className="text-xl font-semibold text-[#1e293b] mb-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {activeTab === 'open' ? 'No Open Tasks' : 'No Tasks to Review'}
              </motion.h3>

              <motion.p
                className="text-[#64748b] text-center mb-6 max-w-sm"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {activeTab === 'open'
                  ? "Great job! You've completed all your tasks. Take a moment to celebrate your productivity!"
                  : 'All tasks have been reviewed. Great work staying on top of everything!'}
              </motion.p>

              <motion.div
                className="flex items-center gap-2 text-sm text-[#64748b]"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <FileText size={16} />
                <span>
                  {activeTab === 'open'
                    ? 'All tasks completed'
                    : 'All tasks reviewed'}
                </span>
              </motion.div>
            </motion.div>
          ) : (
            <div className="h-full">
              {/* Desktop view - Enhanced DataTable */}
              <div className="md:block h-full overflow-x-auto overflow-y-auto">
                <EnhancedDataTable
                  columns={columns}
                  data={filteredTasks}
                  pageSize={pagination.pageSize}
                  showPagination={true}
                  manualPagination={false} // Client-side pagination
                  manualSorting={true} // Server-side sorting
                  onPaginationChange={handlePaginationChange}
                  sorting={sorting}
                  onSortingChange={handleSortingChange}
                  isLoading={loading}
                  totalCount={filteredTasks.length}
                />
              </div>

              {/* Mobile view - Enhanced card layout with pagination */}
              <div className="md:hidden h-full flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    // Mobile loading skeleton with stream animation
                    Array.from({ length: pagination.pageSize }, (_, index) => (
                      <div
                        key={`mobile-loading-${index}`}
                        className="border-b border-gray-200 p-4 bg-white rounded-lg shadow-md mb-4"
                      >
                        <div className="space-y-3">
                          <div
                            className="h-6 rounded skeleton-stream-opentasks"
                            style={{
                              width: `${75 + (index % 3) * 5}%`,
                              animationDelay: `${index * 0.1}s`,
                            }}
                          ></div>
                          <div
                            className="h-4 rounded skeleton-stream-opentasks"
                            style={{
                              width: `${60 + (index % 2) * 10}%`,
                              animationDelay: `${index * 0.1 + 0.1}s`,
                            }}
                          ></div>
                          <div
                            className="h-3 rounded skeleton-stream-opentasks"
                            style={{
                              width: `${40 + (index % 4) * 5}%`,
                              animationDelay: `${index * 0.1 + 0.2}s`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      {filteredTasks.slice(
                        pagination.pageIndex * pagination.pageSize,
                        (pagination.pageIndex + 1) * pagination.pageSize
                      ).length > 0 ? (
                        filteredTasks
                          .slice(
                            pagination.pageIndex * pagination.pageSize,
                            (pagination.pageIndex + 1) * pagination.pageSize
                          )
                          .map((task, index) => (
                            <motion.div
                              key={task.id}
                              className="border-b border-[#f1f5f9] last:border-0 p-4 hover:bg-[#f8fafc] transition-colors cursor-pointer"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                delay: index * 0.05,
                                duration: 0.3,
                              }}
                              onClick={() => navigateTask(task.id)}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-[#f1f5f9] rounded-md flex items-center justify-center mt-1">
                                  <CheckSquare
                                    size={14}
                                    className="text-primary-600"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-[#1e293b] truncate">
                                    {task.title}
                                  </h3>
                                  <div className="flex items-center gap-4 mt-2 text-sm text-[#64748b]">
                                    <div className="flex items-center gap-1">
                                      <Clock size={12} />
                                      <span>
                                        {task.duedate
                                          ? format(
                                              new Date(task.duedate),
                                              'MM/dd/yyyy'
                                            )
                                          : 'No Due Date'}
                                      </span>
                                    </div>
                                    <span className="bg-[#f1f5f9] px-2 py-1 rounded-full text-xs">
                                      {task.status}
                                    </span>
                                  </div>
                                  <div className="mt-1">
                                    <span
                                      className={`priority-badge ${
                                        task.priority?.toLowerCase() || 'medium'
                                      } text-xs`}
                                    >
                                      {task.priority || 'Medium'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-[#64748b]">No open tasks found.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Mobile Pagination */}
                {filteredTasks.length > pagination.pageSize && (
                  <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg mt-4 border-t border-gray-200">
                    <div className="flex-1 text-sm text-gray-700">
                      Showing {pagination.pageIndex * pagination.pageSize + 1}{' '}
                      to{' '}
                      {Math.min(
                        (pagination.pageIndex + 1) * pagination.pageSize,
                        filteredTasks.length
                      )}{' '}
                      of {filteredTasks.length} results
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() =>
                          handlePaginationChange({
                            ...pagination,
                            pageIndex: pagination.pageIndex - 1,
                          })
                        }
                        disabled={pagination.pageIndex === 0 || loading}
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-700">
                        Page {pagination.pageIndex + 1} of{' '}
                        {Math.ceil(filteredTasks.length / pagination.pageSize)}
                      </span>
                      <button
                        className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() =>
                          handlePaginationChange({
                            ...pagination,
                            pageIndex: pagination.pageIndex + 1,
                          })
                        }
                        disabled={
                          pagination.pageIndex >=
                            Math.ceil(
                              filteredTasks.length / pagination.pageSize
                            ) -
                              1 || loading
                        }
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default OpenTasks

// import React, { useEffect, useState } from 'react';
// import { motion } from 'framer-motion';
// import { CheckSquare, Clock, FileText } from 'lucide-react';
// import { useNavigate } from 'react-router-dom';
// import axios from 'axios';
// import { toast } from 'react-toastify';
// import { format } from "date-fns";
// import { createColumnHelper } from '@tanstack/react-table';
// import EnhancedDataTable from './DataTable/EnhancedDataTable';
// import { useSelector } from 'react-redux';

// const OpenTasks = ({ activeTab, onCountsChange }) => {
//   const [openTasks, setOpenTasks] = useState([]);
//   const [reviewTasks, setReviewTasks] = useState([]);
//   const [filteredTasks, setFilteredTasks] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const navigate = useNavigate();
//   const { user } = useSelector(state => state.auth);

//   // Table state - Default sorting by due date (most recent first)
//   const [sorting, setSorting] = useState([{ id: 'duedate', desc: true }]);
//   const [pagination, setPagination] = useState({
//     pageIndex: 0,
//     pageSize: 5, // Smaller page size for component
//   });

//   const columnHelper = createColumnHelper();

//   // Add stream skeleton styles
//   const streamSkeletonStyles = `
//     .skeleton-stream-opentasks {
//       background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
//       background-size: 200% 100%;
//       animation: stream-opentasks 1.5s infinite;
//     }

//     @keyframes stream-opentasks {
//       0% {
//         background-position: 200% 0;
//       }
//       100% {
//         background-position: -200% 0;
//       }
//     }
//   `;

//   // Inject styles
//   useEffect(() => {
//     const styleId = 'skeleton-stream-styles-opentasks';
//     if (!document.getElementById(styleId)) {
//       const style = document.createElement('style');
//       style.id = styleId;
//       style.textContent = streamSkeletonStyles;
//       document.head.appendChild(style);
//     }
//   }, []);

//   useEffect(() => {
//     fetchOpenTasks();
//     fetchReviewTasks();
//   }, [sorting]); // Re-fetch when sorting changes

//   // Notify parent about counts whenever lists change
//   useEffect(() => {
//     if (typeof onCountsChange === 'function') {
//       onCountsChange({ open: openTasks.length, review: reviewTasks.length });
//     }
//   }, [openTasks, reviewTasks, onCountsChange]);

//   // Filter tasks based on active tab
//   useEffect(() => {
//     if (activeTab === 'open') {
//       setFilteredTasks(openTasks);
//     } else if (activeTab === 'review') {
//       setFilteredTasks(reviewTasks);
//     }
//     // Reset pagination when switching tabs
//     setPagination(prev => ({ ...prev, pageIndex: 0 }));
//   }, [activeTab, openTasks, reviewTasks, user?.id]);

//   const fetchOpenTasks = async () => {
//     try {
//       setLoading(true);

//       // Prepare sorting parameters for the backend
//       const params = new URLSearchParams();

//       // Always include sorting parameters (default or user-selected)
//       if (sorting.length > 0) {
//         params.append('sort_by', sorting[0].id);
//         params.append('sort_order', sorting[0].desc ? 'desc' : 'asc');
//       } else {
//         // Fallback to default sorting if somehow sorting is empty
//         params.append('sort_by', 'duedate');
//         params.append('sort_order', 'desc');
//       }

//       const response = await axios.post(`${process.env.REACT_APP_API_URL}/tasks/filtered-opentasks?${params.toString()}`, {
//         statusFilter: 'AllOpen',
//         textFilter: '',
//       },
//         {
//           headers: {
//             Authorization: `Bearer ${localStorage.getItem('token')}`
//           }
//         }
//       );

//       if (response && response.data) {
//         if (response.data.tasks) {
//           // Transform tasks for the data table
//           const transformedTasks = response.data.tasks.map(task => ({
//             id: task.id,
//             title: task.title,
//             description: task.description,
//             duedate: task.duedate,
//             priority: task.priority || "Medium",
//             meeting_owner_name: task.meeting_owner_name || "Unassigned",
//             assignee_name: task.assignee_name || "Unassigned",
//             assigned_id: task.assigned_id, // Add assigned_id for review filtering
//             status: task.status || "Pending",
//             onClick: () => navigate(`/task-details?id=${task.id}`)
//           }));
//           setOpenTasks(transformedTasks);
//         }
//       } else if (response.status === 403) {
//         localStorage.removeItem("token");
//         navigate("/");
//       }
//     } catch (error) {
//       console.error("Error fetching open tasks:", error);
//       toast.error(`Failed to fetch open tasks`, {
//         autoClose: 5000,
//         position: "top-right",
//         hideProgressBar: false,
//         closeOnClick: true,
//         pauseOnHover: true,
//         draggable: true,
//         progress: undefined,
//         theme: "colored",
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchReviewTasks = async () => {
//     try {
//       setLoading(true);

//       // Prepare sorting parameters for the backend
//       const params = new URLSearchParams();

//       // Always include sorting parameters (default or user-selected)
//       if (sorting.length > 0) {
//         params.append('sort_by', sorting[0].id);
//         params.append('sort_order', sorting[0].desc ? 'desc' : 'asc');
//       } else {
//         // Fallback to default sorting if somehow sorting is empty
//         params.append('sort_by', 'duedate');
//         params.append('sort_order', 'desc');
//       }

//       const response = await axios.post(`${process.env.REACT_APP_API_URL}/tasks/filtered-reviewtasks?${params.toString()}`, {
//         statusFilter: 'Ready For Review',
//         textFilter: '',
//       },
//         {
//           headers: {
//             Authorization: `Bearer ${localStorage.getItem('token')}`
//           }
//         }
//       );

//       if (response && response.data) {
//         if (response.data.tasks) {
//           // Transform tasks for the data table
//           const transformedTasks = response.data.tasks.map(task => ({
//             id: task.id,
//             title: task.title,
//             description: task.description,
//             duedate: task.duedate,
//             priority: task.priority || "Medium",
//             meeting_owner_name: task.meeting_owner_name || "Unassigned",
//             assignee_name: task.assignee_name || "Unassigned",
//             assigned_id: task.assigned_id, // Add assigned_id for review filtering
//             status: task.status || "Pending",
//             onClick: () => navigate(`/task-details?id=${task.id}`)
//           }));
//           setReviewTasks(transformedTasks);
//         }
//       } else if (response.status === 403) {
//         localStorage.removeItem("token");
//         navigate("/");
//       }
//     } catch (error) {
//       console.error("Error fetching review tasks:", error);
//       toast.error(`Failed to fetch review tasks`, {
//         autoClose: 5000,
//         position: "top-right",
//         hideProgressBar: false,
//         closeOnClick: true,
//         pauseOnHover: true,
//         draggable: true,
//         progress: undefined,
//         theme: "colored",
//       });
//     } finally {
//       setLoading(false);
//     }
//   };
//   const navigateTask = async (taskId) => {
//     navigate(`/task-details?id=${taskId}`);
//   }

//   // Handle pagination changes
//   const handlePaginationChange = (newPagination) => {
//     setPagination(newPagination);
//   };

//   // Handle sorting changes
//   const handleSortingChange = (newSorting) => {
//     setSorting(newSorting);
//   };

//   // Column definitions for EnhancedDataTable
//   const columns = [
//     columnHelper.accessor('title', {
//       header: 'Task Title',
//       cell: (info) => (
//         <div className="flex items-center gap-2 cursor-pointer hover:text-blue-600" onClick={() => navigateTask(info.row.original.id)}>
//           <div className="w-6 h-6 bg-[#f1f5f9] rounded-md flex items-center justify-center">
//             <CheckSquare size={14} className="text-primary-600" />
//           </div>
//           <span className="font-medium text-[#1e293b]">{info.getValue()}</span>
//         </div>
//       ),
//       enableSorting: true,
//     }),
//     columnHelper.accessor('duedate', {
//       header: 'Due Date',
//       cell: (info) => (
//         <div className="flex items-center gap-1 text-[#475569]">
//           <Clock size={14} />
//           <span>
//             {info.getValue() ? format(new Date(info.getValue()), 'MM/dd/yyyy') : "No Due Date"}
//           </span>
//         </div>
//       ),
//       enableSorting: true,
//     }),
//     columnHelper.accessor('status', {
//       header: 'Status',
//       cell: (info) => (
//         <motion.span
//           className="flex items-center gap-1 text-sm font-medium text-[#475569] bg-[#f1f5f9] px-2 py-1 rounded-full inline-block"
//           whileHover={{ scale: 1.05 }}
//         >
//           {info.getValue()}
//         </motion.span>
//       ),
//       enableSorting: true,
//     }),
//     columnHelper.accessor('priority', {
//       header: 'Priority',
//       cell: (info) => (
//         <span className={`priority-badge ${info.getValue()?.toLowerCase() || "medium"}`}>
//           {info.getValue() || "Medium"}
//         </span>
//       ),
//       enableSorting: true,
//     }),
//   ];

//   return (
//     <div className="h-full flex flex-col">

//       <div className="flex-1 p-3 overflow-hidden">
//         {loading ? (
//           <div className="flex items-center justify-center h-full">
//             <motion.div
//               className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
//               animate={{ rotate: 360 }}
//               transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
//             />
//           </div>
//         ) : filteredTasks.length === 0 ? (
//           <motion.div
//             className="flex flex-col items-center justify-center h-full px-6"
//             initial={{ opacity: 0, scale: 0.9 }}
//             animate={{ opacity: 1, scale: 1 }}
//             transition={{ duration: 0.5 }}
//           >
//             <motion.div
//               className="w-24 h-24 bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1] rounded-full flex items-center justify-center mb-6"
//               initial={{ rotateY: 0 }}
//               animate={{ rotateY: 360 }}
//               transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 }}
//             >
//               <CheckSquare size={32} className="text-[#64748b]" />
//             </motion.div>

//               <motion.h3
//                 className="text-xl font-semibold text-[#1e293b] mb-2"
//                 initial={{ y: 20, opacity: 0 }}
//                 animate={{ y: 0, opacity: 1 }}
//                 transition={{ delay: 0.2 }}
//               >
//                 {activeTab === 'open' ? 'No Open Tasks' : 'No Tasks to Review'}
//               </motion.h3>

//               <motion.p
//                 className="text-[#64748b] text-center mb-6 max-w-sm"
//                 initial={{ y: 20, opacity: 0 }}
//                 animate={{ y: 0, opacity: 1 }}
//                 transition={{ delay: 0.3 }}
//               >
//                 {activeTab === 'open'
//                   ? "Great job! You've completed all your tasks. Take a moment to celebrate your productivity!"
//                   : "All tasks have been reviewed. Great work staying on top of everything!"
//                 }
//               </motion.p>

//               <motion.div
//                 className="flex items-center gap-2 text-sm text-[#64748b]"
//                 initial={{ y: 20, opacity: 0 }}
//                 animate={{ y: 0, opacity: 1 }}
//                 transition={{ delay: 0.4 }}
//               >
//                 <FileText size={16} />
//                 <span>{activeTab === 'open' ? 'All tasks completed' : 'All tasks reviewed'}</span>
//               </motion.div>
//             </motion.div>
//         ) : (
//               <div className="h-full overflow-hidden">
//                 {/* Desktop view - Enhanced DataTable */}
//                 <div className="hidden md:block h-full">
//                   <EnhancedDataTable
//                     columns={columns}
//                     data={filteredTasks}
//                     pageSize={pagination.pageSize}
//                     showPagination={true}
//                     manualPagination={false} // Client-side pagination
//                     manualSorting={true} // Server-side sorting
//                     onPaginationChange={handlePaginationChange}
//                     sorting={sorting}
//                     onSortingChange={handleSortingChange}
//                     isLoading={loading}
//                     totalCount={filteredTasks.length}
//                   />
//                 </div>

//                 {/* Mobile view - Enhanced card layout with pagination */}
//                 <div className="md:hidden h-full flex flex-col">
//                   <div className="flex-1 overflow-y-auto">
//                     {loading ? (
//                       // Mobile loading skeleton with stream animation
//                       Array.from({ length: pagination.pageSize }, (_, index) => (
//                         <div key={`mobile-loading-${index}`} className="border-b border-gray-200 p-4 bg-white rounded-lg shadow-md mb-4">
//                           <div className="space-y-3">
//                             <div
//                               className="h-6 rounded skeleton-stream-opentasks"
//                               style={{
//                                 width: `${75 + (index % 3) * 5}%`,
//                                 animationDelay: `${index * 0.1}s`
//                               }}
//                             ></div>
//                             <div
//                               className="h-4 rounded skeleton-stream-opentasks"
//                               style={{
//                                 width: `${60 + (index % 2) * 10}%`,
//                                 animationDelay: `${index * 0.1 + 0.1}s`
//                               }}
//                             ></div>
//                             <div
//                               className="h-3 rounded skeleton-stream-opentasks"
//                               style={{
//                                 width: `${40 + (index % 4) * 5}%`,
//                                 animationDelay: `${index * 0.1 + 0.2}s`
//                               }}
//                             ></div>
//                           </div>
//                         </div>
//                       ))
//                     ) : (
//                       <>
//                         {filteredTasks
//                           .slice(
//                             pagination.pageIndex * pagination.pageSize,
//                             (pagination.pageIndex + 1) * pagination.pageSize
//                           )
//                           .length > 0 ? (
//                           filteredTasks
//                             .slice(
//                               pagination.pageIndex * pagination.pageSize,
//                               (pagination.pageIndex + 1) * pagination.pageSize
//                             )
//                             .map((task, index) => (
//                               <motion.div
//                                 key={task.id}
//                                 className="border-b border-[#f1f5f9] last:border-0 p-4 hover:bg-[#f8fafc] transition-colors cursor-pointer"
//                                 initial={{ opacity: 0, y: 10 }}
//                                 animate={{ opacity: 1, y: 0 }}
//                                 transition={{ delay: index * 0.05, duration: 0.3 }}
//                                 onClick={() => navigateTask(task.id)}
//                               >
//                                 <div className="flex items-start gap-3">
//                                   <div className="w-6 h-6 bg-[#f1f5f9] rounded-md flex items-center justify-center mt-1">
//                                     <CheckSquare size={14} className="text-primary-600" />
//                                   </div>
//                                   <div className="flex-1 min-w-0">
//                                     <h3 className="font-medium text-[#1e293b] truncate">{task.title}</h3>
//                                     <div className="flex items-center gap-4 mt-2 text-sm text-[#64748b]">
//                                       <div className="flex items-center gap-1">
//                                         <Clock size={12} />
//                                         <span>{task.duedate ? format(new Date(task.duedate), 'MM/dd/yyyy') : "No Due Date"}</span>
//                                       </div>
//                                       <span className="bg-[#f1f5f9] px-2 py-1 rounded-full text-xs">{task.status}</span>
//                                     </div>
//                                     <div className="mt-1">
//                                       <span className={`priority-badge ${task.priority?.toLowerCase() || "medium"} text-xs`}>
//                                         {task.priority || "Medium"}
//                                       </span>
//                                     </div>
//                                   </div>
//                                 </div>
//                               </motion.div>
//                             ))
//                           ) : (
//                             <div className="p-4 text-center">
//                               <p className="text-[#64748b]">No open tasks found.</p>
//                             </div>
//                           )}
//                       </>
//                     )}
//                   </div>

//                   {/* Mobile Pagination */}
//                   {filteredTasks.length > pagination.pageSize && (
//                     <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg mt-4 border-t border-gray-200">
//                       <div className="flex-1 text-sm text-gray-700">
//                         Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
//                         {Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredTasks.length)} of{" "}
//                         {filteredTasks.length} results
//                       </div>
//                       <div className="flex items-center space-x-2">
//                         <button
//                           className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
//                           onClick={() => handlePaginationChange({
//                             ...pagination,
//                             pageIndex: pagination.pageIndex - 1
//                           })}
//                           disabled={pagination.pageIndex === 0 || loading}
//                         >
//                           Previous
//                         </button>
//                         <span className="text-sm text-gray-700">
//                           Page {pagination.pageIndex + 1} of{" "}
//                           {Math.ceil(filteredTasks.length / pagination.pageSize)}
//                         </span>
//                         <button
//                           className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
//                           onClick={() => handlePaginationChange({
//                             ...pagination,
//                             pageIndex: pagination.pageIndex + 1
//                           })}
//                           disabled={pagination.pageIndex >= Math.ceil(filteredTasks.length / pagination.pageSize) - 1 || loading}
//                         >
//                           Next
//                         </button>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default OpenTasks;