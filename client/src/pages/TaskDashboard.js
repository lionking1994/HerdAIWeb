import React, { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { format, differenceInDays } from 'date-fns'
import { createColumnHelper } from '@tanstack/react-table'
import EnhancedDataTable from '../components/DataTable/EnhancedDataTable'
import {
  Search,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  Filter,
  ArrowUp,
  ArrowDown,
  BarChart2,
  Loader2,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import KanbanView from '../components/KanbanView/KanbanView'
import ViewToggle from '../components/ViewToggle/ViewToggle'
import { toast } from 'react-toastify'
import GenerateScoreButton from '../components/GenerateScoreButton/GenerateScoreButton'

const TaskDashboard = () => {
  const [user, setUser] = useState(null)
  const [tasks, setTasks] = useState([])
  const [filteredTasks, setFilteredTasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [taskThemes, setTaskThemes] = useState([])
  const [searchParams] = useSearchParams()
  const status = searchParams.get('status')
  const [statusFilter, setStatusFilter] = useState(status || 'all')
  const [viewMode, setViewMode] = useState('list') // 'list' or 'kanban'
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [selectedTaskReason, setSelectedTaskReason] = useState(null)
  const navigate = useNavigate()

  // Metrics state
  const [metrics, setMetrics] = useState({
    dueTodayAndPastDue: 0,
    dueNext30Days: 0,
    assignedAndPastDue: 0,
    totalOpenTasks: 0,
    highAlignmentScore: 0,
    mediumAlignmentScore: 0,
    poorAlignmentScore: 0,
    highPriority: 0,
  })

  // Table state - Default sorting by due date (most recent first)
  const [sorting, setSorting] = useState([{ id: 'duedate', desc: true }])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const columnHelper = createColumnHelper()

  // Add this with the other state declarations at the top
  const [isGeneratingScore, setIsGeneratingScore] = useState(false)

  // Add this state to track loading states for individual tasks
  const [loadingTasks, setLoadingTasks] = useState({})

  useEffect(() => {
    fetchUserData()
    fetchTasks()
  }, [])

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTasks = async () => {
    setIsLoading(true)
    try {
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

      const result = await axios.post(
        `${
          process.env.REACT_APP_API_URL
        }/tasks/filtered-tasks?${params.toString()}`,
        {
          statusFilter: statusFilter === 'all' ? '' : statusFilter,
          textFilter: searchQuery,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )

      if (result && result.data) {
        if (result.data.tasks) {
          // Transform tasks for the data table
          const transformedTasks = result.data.tasks.map((task) => {
            const dueDate = task.duedate ? new Date(task.duedate) : null
            const today = new Date()
            const daysOpen = dueDate ? differenceInDays(today, dueDate) : 0

            return {
              id: task.id,
              title: task.title,
              description: task.description,
              duedate: task.duedate,
              daysOpen: daysOpen,
              priority: task.priority || 'Medium',
              meeting_owner_name: task.meeting_owner_name || 'Unassigned',
              assignee_name: task.assignee_name || 'Unassigned',
              status: task.status || 'Pending',
              category: task.category || 'Other',
              alignment_score: task.alignment_score || 0,
              alignment_reason: task.alignment_reason || null,
            }
          })

          setTasks(transformedTasks)

          // Extract themes from tasks (categories)
          const themes = [
            ...new Set(transformedTasks.map((task) => task.category)),
          ].filter(Boolean)
          setTaskThemes(themes)

          // Calculate metrics
          calculateMetrics(transformedTasks)
        }
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateMetrics = (taskList) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const in30Days = new Date()
    in30Days.setDate(today.getDate() + 30)
    const dueTodayAndPastDueList = taskList.filter((task) => {
      if (!task.duedate) return false
      const dueDate = new Date(task.duedate)
      dueDate.setHours(0, 0, 0, 0)
      return (
        dueDate <= today &&
        task.status !== 'Completed' &&
        task.status !== 'Rated'
      )
    })
    console.log('dueTodayAndPastDueList:', dueTodayAndPastDueList)
    const dueTodayAndPastDue = dueTodayAndPastDueList.length

    const dueNext30DaysList = taskList.filter((task) => {
      if (!task.duedate) return false
      const dueDate = new Date(task.duedate)
      dueDate.setHours(0, 0, 0, 0)
      return (
        dueDate > today &&
        dueDate <= in30Days &&
        task.status !== 'Completed' &&
        task.status !== 'Rated'
      )
    })
    console.log('dueNext30DaysList:', dueNext30DaysList)
    const dueNext30Days = dueNext30DaysList.length

    const assignedAndPastDueList = taskList.filter((task) => {
      if (!task.duedate) return false
      const dueDate = new Date(task.duedate)
      dueDate.setHours(0, 0, 0, 0)
      return (
        dueDate < today &&
        (task.status === 'Assigned' ||
          task.status === 'In Progress' ||
          task.status === 'Ready for Review')
      )
    })
    console.log('assignedAndPastDueList:', assignedAndPastDueList)
    const assignedAndPastDue = assignedAndPastDueList.length

    const totalOpenTasksList = taskList.filter((task) => {
      return task.status !== 'Completed' && task.status !== 'Rated'
    })
    console.log('totalOpenTasksList:', totalOpenTasksList)
    const totalOpenTasks = totalOpenTasksList.length

    const highAlignmentScore = taskList.filter(
      (task) => task.alignment_score >= 80 &&
      task.status !== 'Completed' &&
      task.status !== 'Rated'
    ).length
    const mediumAlignmentScore = taskList.filter(
      (task) => task.alignment_score >= 50 && task.alignment_score < 80 &&
      task.status !== 'Completed' &&
      task.status !== 'Rated'
    ).length
    const poorAlignmentScore = taskList.filter(
      (task) => task.alignment_score > 0 && task.alignment_score < 50 &&
      task.status !== 'Completed' &&
      task.status !== 'Rated'
    ).length
    const highPriorityList = taskList.filter(
      (task) => task.priority?.toLowerCase() === 'high' &&
      task.status !== 'Completed' &&
      task.status !== 'Rated'
    )
    const highPriority = highPriorityList.length

    setMetrics({
      dueTodayAndPastDue,
      dueNext30Days,
      assignedAndPastDue,
      totalOpenTasks,
      highAlignmentScore,
      mediumAlignmentScore,
      poorAlignmentScore,
      highPriority,
    })
  }

  // Filter tasks based on search query and active filter
  useEffect(() => {
    let filtered = tasks

    // Apply search filter if there's a search query
    if (searchQuery) {
      filtered = tasks.filter(
        (task) =>
          task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.assignee_name
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          task.meeting_owner_name
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          task.status?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.priority?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply status filter
    if (activeFilter !== 'all') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const in30Days = new Date()
      in30Days.setDate(today.getDate() + 30)

      switch (activeFilter) {
        case 'dueNext30Days':
          filtered = filtered.filter((task) => {
            if (!task.duedate) return false
            const dueDate = new Date(task.duedate)
            dueDate.setHours(0, 0, 0, 0)
            return (
              dueDate > today &&
              dueDate <= in30Days &&
              task.status !== 'Completed' &&
              task.status !== 'Rated'
            )
          })
          console.log('dueNext30Days filtered tasks:', filtered)
          break
        case 'totalOpenTasks':
          filtered = filtered.filter((task) => {
            return task.status !== 'Completed' && task.status !== 'Rated'
          })
          console.log('totalOpenTasks filtered tasks:', filtered)
          break
        case 'dueToday':
          filtered = filtered.filter((task) => {
            if (!task.duedate) return false
            const dueDate = new Date(task.duedate)
            dueDate.setHours(0, 0, 0, 0)
            return dueDate.getTime() === today.getTime()
          })
          console.log('dueToday filtered tasks:', filtered)
          break
        case 'pastDue':
          filtered = filtered.filter((task) => {
            if (!task.duedate) return false
            const dueDate = new Date(task.duedate)
            dueDate.setHours(0, 0, 0, 0)
            return (
              dueDate <= today &&
              task.status !== 'Completed' &&
              task.status !== 'Rated'
            )
          })
          console.log('pastDue filtered tasks:', filtered)
          break
        case 'assignedToMe':
          filtered = filtered.filter(
            (task) =>
              task.assignee_name === user?.name &&
              task.status !== 'Completed' &&
              task.status !== 'Rated'
          )
          console.log('assignedToMe filtered tasks:', filtered)
          break
        case 'assignedToOthers':
          filtered = filtered.filter(
            (task) =>
              task.assignee_name !== user?.name &&
              task.assignee_name !== 'Unassigned' &&
              task.status !== 'Completed' &&
              task.status !== 'Rated'
          )
          console.log('assignedToOthers filtered tasks:', filtered)
          break
        case 'assignedAndPastDue':
          filtered = filtered.filter((task) => {
            if (!task.duedate) return false
            const dueDate = new Date(task.duedate)
            dueDate.setHours(0, 0, 0, 0)
            return (
              dueDate < today &&
              (task.status === 'Assigned' ||
                task.status === 'In Progress' ||
                task.status === 'Ready for Review')
            )
          })
          console.log('assignedAndPastDue filtered tasks:', filtered)
          break
        case 'today':
          filtered = filtered.filter((task) => {
            if (!task.duedate) return false
            const dueDate = new Date(task.duedate)
            dueDate.setHours(0, 0, 0, 0)
            return dueDate.getTime() === today.getTime()
          })
          break

        case 'this-week':
          const startOfWeek = new Date(today)
          startOfWeek.setDate(today.getDate() - today.getDay())
          startOfWeek.setHours(0, 0, 0, 0)
          const endOfWeek = new Date(startOfWeek)
          endOfWeek.setDate(startOfWeek.getDate() + 7)
          filtered = filtered.filter((task) => {
            if (!task.duedate) return false
            const dueDate = new Date(task.duedate)
            return dueDate >= startOfWeek && dueDate < endOfWeek
          })
          break

        case 'this-month':
          const startOfMonth = new Date(
            today.getFullYear(),
            today.getMonth(),
            1
          )
          const endOfMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            1
          )
          filtered = filtered.filter((task) => {
            if (!task.duedate) return false
            const dueDate = new Date(task.duedate)
            return dueDate >= startOfMonth && dueDate < endOfMonth
          })
          break

        case 'this-qtr':
          const currentMonth = today.getMonth() // 0-indexed
          const quarterStartMonth = currentMonth - (currentMonth % 3)
          const startOfQuarter = new Date(
            today.getFullYear(),
            quarterStartMonth,
            1
          )
          const endOfQuarter = new Date(
            today.getFullYear(),
            quarterStartMonth + 3,
            1
          )
          filtered = filtered.filter((task) => {
            if (!task.duedate) return false
            const dueDate = new Date(task.duedate)
            return dueDate >= startOfQuarter && dueDate < endOfQuarter
          })
          break

        case 'highAlignment':
          filtered = filtered.filter((task) => task.alignment_score >= 80 &&
          task.status !== 'Completed' &&
          task.status !== 'Rated')
          break

        case 'mediumAlignment':
          filtered = filtered.filter(
            (task) => task.alignment_score >= 50 && task.alignment_score < 80 &&
            task.status !== 'Completed' &&
            task.status !== 'Rated'
          )
          break

        case 'poorAlignment':
          filtered = filtered.filter(
            (task) => task.alignment_score > 0 && task.alignment_score < 50 &&
            task.status !== 'Completed' &&
            task.status !== 'Rated'
          )
          break

        case 'highPriority':
          filtered = filtered.filter(
            (task) => task.priority?.toLowerCase() === 'high' &&
            task.status !== 'Completed' &&
            task.status !== 'Rated'
          )
          console.log('highPriority filtered tasks:', filtered)
          break

        default:
          break
      }
    }

    setFilteredTasks(filtered)
  }, [tasks, searchQuery, activeFilter, user])

  // Handle pagination changes
  const handlePaginationChange = (newPagination) => {
    setPagination(newPagination)
  }

  // Handle sorting changes
  const handleSortingChange = (newSorting) => {
    setSorting(newSorting)
    fetchTasks()
  }

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
  }

  // Handle filter button click
  const handleFilterClick = (filter) => {
    setActiveFilter(filter)
  }

  // Handle metric card click
  const handleMetricClick = (filter) => {
    setActiveFilter(filter)
  }

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode)
  }

  const handleChangeAlignmentScore = (taskId, newScore, newReason) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              alignment_score: newScore,
              alignment_reason: newReason,
            }
          : task
      )
    )
  }

  const handleGenerateAlignmentScore = async (taskId) => {
    try {
      // Set loading state for this specific task
      setLoadingTasks((prev) => ({ ...prev, [taskId]: true }))

      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/score-tasks`,
        { taskId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (response.data.success) {
        // Update the task with the new score and reason
        handleChangeAlignmentScore(
          taskId,
          response.data.data.score,
          response.data.data.reason
        )
        toast.success('Alignment score generated successfully')
      } else {
        if (response.data.errorCode === 2) {
          toast.error('No company objectives found')
        } else {
          toast.error('Failed to generate alignment score')
        }
      }
    } catch (error) {
      console.error('Error generating alignment score:', error)
      toast.error('Failed to generate alignment score')
    } finally {
      // Clear loading state for this specific task
      setLoadingTasks((prev) => ({ ...prev, [taskId]: false }))
    }
  }

  // Column definitions for EnhancedDataTable
  const columns = [
    columnHelper.accessor('title', {
      header: 'Task Title',
      cell: (info) => (
        <div
          className="font-bold text-gray-800 cursor-pointer hover:text-blue-600"
          onClick={() => navigate('/task-details?id=' + info.row.original.id)}
        >
          {info.getValue()}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: (info) => (
        <div
          className="text-gray-600 max-w-xs truncate"
          title={info.getValue()}
        >
          {info.getValue() || 'No description'}
        </div>
      ),
      enableSorting: false,
    }),
    columnHelper.accessor('duedate', {
      header: 'Due Date',
      cell: (info) => (
        <div className="text-gray-600">
          {info.getValue()
            ? format(new Date(info.getValue()), 'MM/dd/yyyy')
            : '—'}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('daysOpen', {
      header: 'Days Open',
      cell: (info) => (
        <div
          className={`text-gray-600 ${
            info.getValue() > 7 ? 'text-red-600 font-semibold' : ''
          }`}
        >
          {info.getValue() > 0 ? info.getValue() : 0}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: (info) => {
        const priority = info.getValue()?.toLowerCase() || 'medium'
        const priorityStyles = {
          high: 'bg-red-100 text-red-800',
          medium: 'bg-yellow-100 text-yellow-800',
          low: 'bg-green-100 text-green-800',
        }
        return (
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${priorityStyles[priority]}`}
          >
            {info.getValue() || 'Medium'}
          </span>
        )
      },
      enableSorting: true,
    }),
    columnHelper.accessor('assignee_name', {
      header: 'Assigned To',
      cell: (info) => (
        <div className="text-gray-600">{info.getValue() || 'Unassigned'}</div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('alignment_score', {
      header: 'Alignment Score',
      cell: (info) => {
        const task = info.row.original
        return (
          <GenerateScoreButton
            taskId={task.id}
            onClick={() =>
              handleShowReasonModal(task.alignment_score, task.alignment_reason)
            }
            isLoading={loadingTasks[task.id] || false}
            onGenerateScore={handleGenerateAlignmentScore}
            alignmentScore={task.alignment_score}
            alignmentReason={task.alignment_reason}
          />
        )
      },
      enableSorting: true,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const status =
          info.getValue()?.toLowerCase().replace(/\s+/g, '') || 'pending'
        const statusStyles = {
          pending: 'bg-indigo-100 text-indigo-800',
          assigned: 'bg-blue-100 text-blue-800',
          inprogress: 'bg-yellow-100 text-yellow-800',
          readyforreview: 'bg-purple-100 text-purple-800',
          completed: 'bg-green-100 text-green-800',
          rated: 'bg-green-100 text-green-800',
        }
        return (
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusStyles[status]}`}
          >
            {info.getValue() || 'Pending'}
          </span>
        )
      },
      enableSorting: true,
    }),
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const handleShowReasonModal = (score, reason) => {
    setSelectedTaskReason({
      score: score,
      reason: reason,
    })
    setShowReasonModal(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar isAuthenticated={true} user={user} />
      <div className="flex-grow mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 mb-6">
          {/* Key Metrics Section */}
          <div className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
              {/* Past Due */}
              <div className="col-span-1">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:transform hover:-translate-y-1 cursor-pointer ${
                    activeFilter === 'pastDue'
                      ? 'ring-2 ring-red-600 bg-red-50'
                      : ''
                  }`}
                  onClick={() => handleMetricClick('pastDue')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        Past Due
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-gray-800">
                        {metrics.dueTodayAndPastDue}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* High Alignment Score */}
              <div className="col-span-1">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:transform hover:-translate-y-1 cursor-pointer ${
                    activeFilter === 'highAlignment'
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : ''
                  }`}
                  onClick={() => handleMetricClick('highAlignment')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                      <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        High Alignment
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-gray-800">
                        {metrics.highAlignmentScore}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Medium Alignment Score */}
              <div className="col-span-1">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:transform hover:-translate-y-1 cursor-pointer ${
                    activeFilter === 'mediumAlignment'
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : ''
                  }`}
                  onClick={() => handleMetricClick('mediumAlignment')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                      <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        Medium Alignment
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-gray-800">
                        {metrics.mediumAlignmentScore}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Poor Alignment Score */}
              <div className="col-span-1">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:transform hover:-translate-y-1 cursor-pointer ${
                    activeFilter === 'poorAlignment'
                      ? 'ring-2 ring-orange-600 bg-orange-50'
                      : ''
                  }`}
                  onClick={() => handleMetricClick('poorAlignment')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-100 rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        Poor Alignment
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-gray-800">
                        {metrics.poorAlignmentScore}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* High Priority */}
              <div className="col-span-1">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:transform hover:-translate-y-1 cursor-pointer ${
                    activeFilter === 'highPriority'
                      ? 'ring-2 ring-gray-600 bg-gray-50'
                      : ''
                  }`}
                  onClick={() => handleMetricClick('highPriority')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-100 rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        High Importance
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-gray-800">
                        {metrics.highPriority}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex justify-center mb-6">
            <div className="relative w-full max-w-md">
              <input
                type="text"
                placeholder="Search tasks..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  ></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Assigned To Filters */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
              <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                Assigned to:
              </p>
              <div className="flex gap-2">
                <button
                  className={`px-3 py-1.5 border-2 rounded-lg text-sm font-bold cursor-pointer transition-all ${
                    activeFilter === 'assignedToMe'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleFilterClick('assignedToMe')}
                >
                  To Me
                </button>
                <button
                  className={`px-3 py-1.5 border-2 rounded-lg text-sm font-bold cursor-pointer transition-all ${
                    activeFilter === 'assignedToOthers'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleFilterClick('assignedToOthers')}
                >
                  Assigned to Others
                </button>
              </div>
            </div>
          </div>

          {/* Due Date Filters */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
              <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                Due:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-bold cursor-pointer transition-all ${
                    activeFilter === 'today'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleFilterClick('today')}
                >
                  Today
                </button>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-bold cursor-pointer transition-all ${
                    activeFilter === 'this-week'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleFilterClick('this-week')}
                >
                  This Week
                </button>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-bold cursor-pointer transition-all ${
                    activeFilter === 'this-month'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleFilterClick('this-month')}
                >
                  This Month
                </button>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-bold cursor-pointer transition-all ${
                    activeFilter === 'this-qtr'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleFilterClick('this-qtr')}
                >
                  This Quarter
                </button>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-bold cursor-pointer transition-all ${
                    activeFilter === 'all'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleFilterClick('all')}
                >
                  All
                </button>
              </div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex justify-center mb-6">
            <ViewToggle
              currentView={viewMode}
              onViewChange={handleViewModeChange}
            />
          </div>

          {/* Content Section */}
          <div className="rounded-xl shadow-sm overflow-hidden w-full">
            {viewMode === 'kanban' ? (
              <KanbanView tasks={filteredTasks} onTaskUpdate={fetchTasks} />
            ) : (
              <>
                {/* Desktop Table */}
                <div className="w-full overflow-x-auto hidden md:block">
                  <EnhancedDataTable
                    columns={columns}
                    data={filteredTasks}
                    sorting={sorting}
                    onSortingChange={handleSortingChange}
                    pagination={pagination}
                    onPaginationChange={handlePaginationChange}
                    isLoading={isLoading}
                    showPagination={true}
                    totalCount={filteredTasks.length}
                  />
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden">
                  <div className="space-y-4">
                    {isLoading ? (
                      // Mobile loading skeleton
                      Array.from(
                        { length: pagination.pageSize },
                        (_, index) => (
                          <div
                            key={`mobile-loading-${index}`}
                            className="bg-white rounded-lg shadow-md p-4 border border-gray-200"
                          >
                            <div className="space-y-3">
                              <div
                                className="h-6 bg-gray-200 rounded animate-pulse"
                                style={{
                                  width: `${75 + (index % 3) * 5}%`,
                                }}
                              ></div>
                              <div
                                className="h-4 bg-gray-200 rounded animate-pulse"
                                style={{
                                  width: `${60 + (index % 4) * 8}%`,
                                }}
                              ></div>
                              <div
                                className="h-4 bg-gray-200 rounded animate-pulse"
                                style={{
                                  width: `${50 + (index % 5) * 6}%`,
                                }}
                              ></div>
                              <div
                                className="h-4 bg-gray-200 rounded animate-pulse"
                                style={{
                                  width: `${40 + (index % 3) * 10}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        )
                      )
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
                            .map((task) => (
                              <div
                                key={task.id}
                                className="bg-white rounded-lg shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow"
                              >
                                <div className="space-y-3">
                                  <h3 className="font-bold text-gray-800 text-lg leading-tight">
                                    {task.title}
                                  </h3>
                                  
                                  <div className="grid grid-cols-1 gap-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Description:</span>
                                      <span className="font-medium text-right max-w-[60%] truncate">
                                        {task.description || 'No description'}
                                      </span>
                                    </div>
                                    
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Due Date:</span>
                                      <span className="font-medium">
                                        {task.duedate
                                          ? format(new Date(task.duedate), 'MM/dd/yyyy')
                                          : '—'}
                                      </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Priority:</span>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        task.priority?.toLowerCase() === 'high' 
                                          ? 'bg-red-100 text-red-800'
                                          : task.priority?.toLowerCase() === 'medium'
                                          ? 'bg-yellow-100 text-yellow-800'
                                          : 'bg-green-100 text-green-800'
                                      }`}>
                                        {task.priority || 'Medium'}
                                      </span>
                                    </div>
                                    
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Owner:</span>
                                      <span className="font-medium text-right max-w-[60%] truncate">
                                        {task.meeting_owner_name || 'Unassigned'}
                                      </span>
                                    </div>
                                    
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Assignee:</span>
                                      <span className="font-medium text-right max-w-[60%] truncate">
                                        {task.assignee_name || 'Unassigned'}
                                      </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Status:</span>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        task.status?.toLowerCase() === 'completed' || task.status?.toLowerCase() === 'rated'
                                          ? 'bg-green-100 text-green-800'
                                          : task.status?.toLowerCase() === 'in progress'
                                          ? 'bg-yellow-100 text-yellow-800'
                                          : task.status?.toLowerCase() === 'assigned'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {task.status || 'Pending'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <button
                                    onClick={() => navigate('/task-details?id=' + task.id)}
                                    disabled={isLoading}
                                    className="w-full mt-3 bg-blue-500 text-white rounded-lg py-3 px-4 hover:bg-blue-600 transition duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    View Details
                                  </button>
                                </div>
                              </div>
                            ))
                        ) : (
                          <div className="bg-white rounded-lg shadow-md p-8 text-center border border-gray-200">
                            <p className="text-gray-600">No tasks found matching your criteria.</p>
                          </div>
                        )}

                        {/* Mobile Pagination */}
                        {filteredTasks.length > 0 && (
                          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="text-sm text-gray-700 text-center sm:text-left">
                                Showing{' '}
                                <span className="font-medium">
                                  {pagination.pageIndex * pagination.pageSize + 1}
                                </span>
                                {' '}-{' '}
                                <span className="font-medium">
                                  {Math.min(
                                    (pagination.pageIndex + 1) * pagination.pageSize,
                                    filteredTasks.length
                                  )}
                                </span>
                                {' '}of{' '}
                                <span className="font-medium">{filteredTasks.length}</span>
                                {' '}results
                              </div>
                              
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
                                  onClick={() =>
                                    handlePaginationChange({
                                      ...pagination,
                                      pageIndex: pagination.pageIndex - 1,
                                    })
                                  }
                                  disabled={pagination.pageIndex === 0 || isLoading}
                                >
                                  Previous
                                </button>
                                
                                <span className="text-sm text-gray-700 px-2">
                                  Page {pagination.pageIndex + 1} of{' '}
                                  {Math.ceil(filteredTasks.length / pagination.pageSize)}
                                </span>
                                
                                <button
                                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
                                  onClick={() =>
                                    handlePaginationChange({
                                      ...pagination,
                                      pageIndex: pagination.pageIndex + 1,
                                    })
                                  }
                                  disabled={
                                    pagination.pageIndex >=
                                      Math.ceil(filteredTasks.length / pagination.pageSize) - 1 ||
                                    isLoading
                                  }
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
      
      {/* Reason Modal */}
      {showReasonModal && selectedTaskReason && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowReasonModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Alignment Reason
              </h3>
              <button
                onClick={() => setShowReasonModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-gray-700 mb-2">
                Task: {selectedTaskReason.title}
              </h4>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-600">Alignment Score:</span>
                <span className="font-semibold text-blue-600">
                  {selectedTaskReason.score}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <h5 className="font-medium text-gray-700 mb-2">Reason:</h5>
              <p className="text-gray-600 text-sm leading-relaxed">
                {selectedTaskReason.reason}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowReasonModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskDashboard
