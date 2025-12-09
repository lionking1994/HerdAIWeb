import React, { useEffect, useState, useRef, useMemo, useContext } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'
import { TourProvider, useTour } from '@reactour/tour'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import DashboardHeader from '../components/DashboardHeader'
import TodaysSchedule from '../components/TodaysSchedule'
import TopAssignees from '../components/TopAssignees'
import PreviousResearch from '../components/PreviousResearch'
import OpenTasks from '../components/OpenTasks'
import Navbar from '../components/Navbar'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { loginFailure, loginSuccess } from '../store/slices/authSlice'
import Footer from '../components/Footer'
import UserProfileDrawer from '../components/UserProfileDrawer'
import MeetingPlatformCheck from '../components/MeetingPlatformCheck'
import DashboardSearch from '../components/DashboardSearch'
import { tourSteps, tourStyles, TOUR_STORAGE_KEYS } from '../config/tourConfig'
import FavouriteDocuments from '../components/FavouriteDocuments'
import {
  Search,
  Settings,
  Plus,
  Calendar,
  Users,
  CheckSquare,
  FileText,
  BookOpen,
  GripVertical,
  PlusIcon,
  TargetIcon,
} from 'lucide-react'
import WorkflowDashboardWidget from '../components/WorkflowDashboardWidget'
import OpportunitiesDashboard from '../components/OpportunitiesDashboard'
import ProjectsDashboard from '../components/ProjectsDashboard.js'
import PriorityWork from '../components/PriorityWork'
import { ChatPopContext } from '../context/chatPopContext'
import useHttp from '../hooks/useHttp';

// Add CSS for drag and drop
const dragDropStyles = `
  .dashboard-card-dragging {
    transform: rotate(2deg) scale(1.02);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    z-index: 1000;
  }

  .dashboard-card-placeholder {
    background: rgba(59, 130, 246, 0.1);
    border: 2px dashed rgba(59, 130, 246, 0.5);
    border-radius: 1rem;
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'dashboard-drag-drop-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = dragDropStyles
    document.head.appendChild(style)
  }
}

// Utility functions
const getPlatformIcon = (platform) => {
  switch (platform.toLowerCase()) {
    case 'teams':
      return '👥'
    case 'zoom':
      return '🎥'
    default:
      return '📅'
  }
}

const formatDateTime = (datetime) => {
  return new Date(datetime).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
}

// Card configuration for drag and drop
const defaultCardOrder = [
  {
    id: 'priority-work',
    title: 'Priority Work',
    subtitle: 'New This Week, High Priority, High Score',
    icon: TargetIcon,
    gradient: 'from-blue-600 to-blue-700',
    component: PriorityWork,
    className: 'priority-work',
    fullWidth: true,
    isWorkflow: false,
  },
  {
    id: 'todays-schedule',
    title: "Today's Schedule",
    subtitle: 'View and manage your daily meetings',
    icon: Calendar,
    gradient: 'from-orange-600 to-orange-700',
    component: TodaysSchedule,
    className: 'tour-todays-schedule',
  },
  {
    id: 'top-assignees',
    title: 'Top Tasks',
    subtitle: 'Track team performance and assignments',
    icon: Users,
    gradient: 'from-gray-500 to-gray-600',
    component: TopAssignees,
    className: 'tour-top-assignees',
  },
  {
    id: 'open-tasks',
    title: 'Tasks',
    subtitle: 'Manage and track your open tasks',
    icon: null,
    gradient: null,
    component: OpenTasks,
    className: 'tour-open-tasks',
    isWorkflow: true,
  },
  {
    id: 'favourite-documents',
    title: 'Favorite Documents',
    subtitle: 'Access your frequently used documents',
    icon: FileText,
    gradient: 'from-green-400 to-green-500',
    component: FavouriteDocuments,
    className: 'favourite-documents',
  },
  {
    id: 'previous-research',
    title: 'Previous Research',
    subtitle: 'Review your past research and findings',
    icon: BookOpen,
    gradient: 'from-purple-400 to-purple-500',
    component: PreviousResearch,
    className: 'tour-previous-research',
  },
  {
    id: 'workflow-widget',
    title: 'Workflows',
    subtitle: 'Manage and track your workflow progress',
    icon: null,
    gradient: null,
    component: WorkflowDashboardWidget,
    className: 'workflow-dashboard-widget',
    isWorkflow: true,
  },
  {
    id: 'opportunities',
    title: 'Opportunities',
    subtitle: 'Your open opportunities',
    icon: TargetIcon,
    // gradient: 'from-teal-400 to-cyan-500',
    gradient: 'from-sky-400 via-blue-500 to-violet-500',
    component: OpportunitiesDashboard,
    className: 'opportunities-dashboard',
  },
  {
    id: 'projects-dashboard',
    title: 'Projects: User Stories Assigned',
    subtitle: 'Track your project assignments and story progress',
    icon: TargetIcon,
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    component: ProjectsDashboard,
    className: 'projects-dashboard',
  },
]

// Reusable Dashboard Card Component
const DashboardCard = ({
  card,
  index,
  userProfile,
  setUserProfile,
  setShowProfileDrawer,
}) => {
  const IconComponent = card.icon
  const navigate = useNavigate()
  const { setPopMsg, setPopOpen } = useContext(ChatPopContext)

  if (card.isWorkflow) {
    return (
      <motion.div variants={itemVariants} className={card.className}>
        {React.createElement(card.component)}
      </motion.div>
    )
  }

  return (
    <motion.div variants={itemVariants} className={card.className}>
      <motion.div
        className="bg-white rounded-2xl shadow-lg border border-gray-100 h-[500px] overflow-hidden flex flex-col"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={`bg-gradient-to-r ${card.gradient} px-6 py-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm cursor-pointer"
                onClick={() => {
                  if (card.id === 'todays-schedule') {
                    navigate('/calendarview') // ✅ navigate works here
                  }
                }}
              >
                {card.icon && <card.icon className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white">
                  {card.title}
                </h2>
                <p className="text-white/80 text-sm mt-1">{card.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(card.title === "Today's Schedule" ||
                card.title === 'Previous Research' ||
                card.title === 'Top Tasks') && (
                <div
                  className="w-12 h-12 bg-white rounded-full flex items-center justify-center cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation() // prevent drag/click interference
                    console.log('Plus icon clicked')
                    if (card.title === "Today's Schedule") {
                      setPopMsg('Create a meeting')
                      setPopOpen(true)
                    } else if (card.title === 'Previous Research') {
                      setPopMsg('create research')
                      setPopOpen(true)
                    } else if (card.title === 'Top Tasks') {
                      setPopMsg(
                        ' create a new task and needs to ask for the user and task details'
                      )
                      setPopOpen(true)
                    }
                  }}
                >
                  <PlusIcon className="w-6 h-6 text-black" />
                </div>
              )}

              <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                <GripVertical className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-50/30 flex-1 overflow-hidden">
          <div className="h-full">
            {card.id === 'top-assignees'
              ? React.createElement(card.component, {
                  onSetUserProfile: setUserProfile,
                  onSetIsProfileDrawerOpen: setShowProfileDrawer,
                })
              : React.createElement(card.component)}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

const DashboardContent = () => {
  const { user } = useSelector((state) => state.auth)
  const [workflows, setWorkflows] = useState([])
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const bodyRef = useRef(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [meetings, setMeetings] = useState([])
  const [teamsCount, setTeamsCount] = useState(0)
  const [zoomCount, setZoomCount] = useState(0)

  const [selectedUser, setSelectedUser] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const [userProfile, setUserProfile] = useState(null)
  const [showProfileDrawer, setShowProfileDrawer] = useState(false)

  // Tab navigation state for Tasks
  const [activeTab, setActiveTab] = useState('open')
  const [openTasksCount, setOpenTasksCount] = useState(0)
  const [reviewTasksCount, setReviewTasksCount] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const { sendRequest } = useHttp();

  // PSA Projects widget state
  const [hasAssignedStories, setHasAssignedStories] = useState(false)

  // Card order state for drag and drop
  const [cardOrder, setCardOrder] = useState(() => {
    const savedOrder = localStorage.getItem('dashboard-card-order')
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder)
        // Map the saved order back to the full card objects with component references
        return parsedOrder.map((savedCard) => {
          const originalCard = defaultCardOrder.find(
            (card) => card.id === savedCard.id
          )
          return originalCard || savedCard
        })
      } catch (error) {
        console.error('Error parsing saved card order:', error)
        return defaultCardOrder
      }
    }
    return defaultCardOrder
  })

  // Tour related state
  const { setIsOpen, setCurrentStep } = useTour()
  const [shouldStartTour, setShouldStartTour] = useState(false)
  const [tourCompleted, setTourCompleted] = useState(false)

  // Check if user has completed tour
  const hasCompletedTour = () => {
    return localStorage.getItem(TOUR_STORAGE_KEYS.COMPLETED) === 'true'
  }

  // Update tour completion state
  useEffect(() => {
    setTourCompleted(hasCompletedTour())
  }, [])

  // Listen for tour completion changes
  useEffect(() => {
    const checkTourCompletion = () => {
      setTourCompleted(hasCompletedTour())
    }

    // Check periodically for tour completion
    const interval = setInterval(checkTourCompletion, 1000)

    return () => clearInterval(interval)
  }, [])

  // Start tour for first-time users
  const startTour = () => {
    setCurrentStep(0)
    setIsOpen(true)
  }

  // Handle tour completion
  const handleTourComplete = () => {
    localStorage.setItem(TOUR_STORAGE_KEYS.COMPLETED, 'true')
    localStorage.removeItem(TOUR_STORAGE_KEYS.LAST_STEP)
  }

  // Drag and drop handlers
  const handleDragEnd = (result) => {
    if (!result.destination) return

    // Reorder only within the visible list
    const visible = Array.from(visibleCardOrder)
    const [moved] = visible.splice(result.source.index, 1)
    visible.splice(result.destination.index, 0, moved)

    // Merge back with hidden cards to preserve full order
    const hiddenIds = new Set(
      cardOrder
        .filter(
          (c) => c.id === 'workflow-widget' && (workflows?.length || 0) === 0
        )
        .map((c) => c.id)
    )

    const merged = []
    let vIdx = 0
    for (const c of cardOrder) {
      if (hiddenIds.has(c.id)) {
        merged.push(c)
      } else {
        merged.push(visible[vIdx++])
      }
    }

    setCardOrder(merged)

    const cardIds = merged.map((card) => ({ id: card.id }))

    console.log('jkhhdeff')
    localStorage.setItem('dashboard-card-order', JSON.stringify(cardIds))
  }

  // Reset card order to default
  const resetCardOrder = () => {
    setCardOrder(defaultCardOrder)
    localStorage.removeItem('dashboard-card-order')
  }

  // Check if user has assigned stories in projects
  const checkUserProjectAssignments = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/crm/dashboard/projects`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data?.success) {
        setHasAssignedStories(response.data.data.has_assigned_stories)
      }
    } catch (error) {
      console.error('Error checking project assignments:', error)
      setHasAssignedStories(false)
    }
  }

  // Compute the list of cards to render based on workflow availability
  const visibleCardOrder = useMemo(() => {
    const shouldHideWorkflow = (workflows?.length || 0) === 0
    // Opportunities will be hidden by the component itself if no open opportunities exist
    const shouldHideProjects = !hasAssignedStories

    return cardOrder.filter(
      (card) => 
        !(shouldHideWorkflow && card.id === 'workflow-widget') &&
        !(shouldHideProjects && card.id === 'projects-dashboard')
    )
  }, [cardOrder, workflows, hasAssignedStories])

  useEffect(() => {
    if (!user) {
      fetchUserData()
    }
    getMeetingList()
    fetchTaskCounts()
    fetchInitialWorkflows()
    checkUserProjectAssignments()
  }, [])

  // Check project assignments when user is loaded
  useEffect(() => {
    if (user) {
      checkUserProjectAssignments()
    }
  }, [user])

  // Separate effect for tour to ensure it triggers when user data is loaded
  useEffect(() => {
    // Start tour for new users after a delay
    if (!hasCompletedTour() && user) {
      const tourTimer = setTimeout(() => {
        setShouldStartTour(true)
        startTour()
      }, 3000)

      return () => clearTimeout(tourTimer)
    }
  }, [user])

  const getMeetingList = async () => {
    const token = localStorage.getItem('token')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/meeting/meeting_all_list`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      if (response.data.success && response.data.meetings) {
        setMeetings(response.data.meetings)
        const teamsCount = response.data.meetings.filter(
          (meeting) => meeting.platform.toLowerCase() === 'teams'
        ).length
        const zoomCount = response.data.meetings.filter(
          (meeting) => meeting.platform.toLowerCase() === 'zoom'
        ).length
        setTeamsCount(teamsCount)
        setZoomCount(zoomCount)
      }
    } catch (error) {
      console.error('Error fetching meetings:', error)
      if (error.response?.status === 403) {
        localStorage.removeItem('token')
        navigate('/')
      }
    }
  }

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token')
      const userData = await sendRequest({
        url: `${process.env.REACT_APP_API_URL}/auth/profile`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      dispatch(loginSuccess(userData))
      console.log('userData from dashboard', userData)
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Fetch task counts for tab navigation
  const fetchTaskCounts = async () => {
    try {
      const token = localStorage.getItem('token')

      // Fetch open tasks count
      const openResponse = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/filtered-opentasks`,
        {
          statusFilter: 'AllOpen',
          textFilter: '',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (openResponse.data.success && openResponse.data.tasks) {
        setOpenTasksCount(openResponse.data.tasks.length)
      }

      // Fetch review tasks count
      const reviewResponse = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/filtered-reviewtasks`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (reviewResponse.data.success && reviewResponse.data.tasks) {
        setReviewTasksCount(reviewResponse.data.tasks.length)
      }
    } catch (error) {
      console.error('Error fetching task counts:', error)
    }
  }

  // Seed workflows for visibility (small payload)
  const fetchInitialWorkflows = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/workflow/user/workflow?status=&page=1&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.data?.success && Array.isArray(response.data.workflows)) {
        setWorkflows(response.data.workflows)
      } else {
        setWorkflows([])
      }
    } catch (e) {
      setWorkflows([])
    }
  }

  const formattedCurrentTime = lastUpdated.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  })

  // Format last updated time
  const formattedLastUpdated = lastUpdated.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  console.log(workflows, '1241427845', workflows?.length)
  return (
    <div className="h-screen bg-[#f1f5f9] flex flex-col" ref={bodyRef}>
      <Navbar isAuthenticated={true} user={user} />
      <div className="flex-1 overflow-auto w-full pb-10">
        <DashboardHeader
          userName={user?.name}
          onStartTour={startTour}
          showTourButton={tourCompleted}
          onResetLayout={resetCardOrder}
        />

        <motion.div
          className="mx-auto px-4 sm:px-6 lg:px-8 mt-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="tour-search-bar">
            <DashboardSearch />
          </motion.div>

          {/* Static grid disabled; using Drag & Drop grid below */}
          {false && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Today's Schedule - Burnt Orange */}
              <motion.div
                variants={itemVariants}
                className="tour-todays-schedule flex"
              >
                <motion.div
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 min-h-[500px] overflow-hidden flex-1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-2">
                    <div className="flex items-center justify-between">
                      {/* <div className="flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                          <Calendar className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-lg md:text-xl font-semibold text-white">
                            Today's Schedule
                          </h2>
                          <p className="text-orange-100 text-xs md:text-sm mt-0.5">
                            View and manage your daily meetings
                          </p>
                        </div>
                      </div> */}

                      {/* View Calendar Button and Time Info - Right side */}
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          onClick={() => navigate('/calendar')}
                          className="px-2.5 py-1.5 text-xs md:text-sm bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors font-medium border border-white/30"
                        >
                          View Calendar
                        </button>

                        <div className="text-right text-white">
                          <div className="text-xs md:text-sm font-semibold">
                            {formattedCurrentTime}
                          </div>
                          <div className="text-orange-100 text-[10px] md:text-xs text-left">
                            Last updated: {formattedLastUpdated}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-gray-50/30 h-full">
                    <TodaysSchedule />
                  </div>
                </motion.div>
              </motion.div>

              {/* Top Tasks - Light Gray */}
              <motion.div
                variants={itemVariants}
                className="tour-top-assignees"
              >
                <motion.div
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 min-h-[500px] overflow-hidden flex flex-col"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="bg-gradient-to-r from-gray-500 to-gray-600 px-6 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                          <Users className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-lg md:text-xl font-semibold text-white">
                            Top Tasks
                          </h2>
                          <p className="text-gray-100 text-xs md:text-sm mt-0.5">
                            Track team performance and assignments
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-gray-50/30 h-full flex-1">
                    <TopAssignees
                      onSetUserProfile={setUserProfile}
                      onSetIsProfileDrawerOpen={setShowProfileDrawer}
                    />
                  </div>
                </motion.div>
              </motion.div>

              {/* Open Tasks - Light Blue */}
              <motion.div variants={itemVariants} className="tour-open-tasks">
                <motion.div
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 min-h-[500px] overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="bg-gradient-to-r from-blue-400 to-blue-500 px-6 py-2">
                    <div className="flex items-center justify-between">
                      {/* <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <CheckSquare className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg md:text-xl font-semibold text-white">
                          Tasks
                        </h2>
                        <p className="text-blue-100 text-xs md:text-sm mt-0.5">
                          Manage and track your open tasks
                        </p>
                      </div>
                    </div> */}

                      {/* Tab Navigation - Moved to right side */}
                      {/* <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setActiveTab('open')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === 'open'
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'text-blue-100 hover:text-white hover:bg-white/10'
                          }`}
                      >
                        Open Tasks ({openTasksCount})
                      </button>
                      <span className="text-blue-200 mx-1">|</span>
                      <button
                        onClick={() => setActiveTab('review')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === 'review'
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'text-blue-100 hover:text-white hover:bg-white/10'
                          }`}
                      >
                        Review ({reviewTasksCount})
                      </button>
                    </div> */}
                    </div>
                  </div>
                  <div className="p-6 bg-gray-50/30 h-full">
                    <OpenTasks
                      activeTab={activeTab}
                      onCountsChange={({ open, review }) => {
                        setOpenTasksCount(open)
                        setReviewTasksCount(review)
                      }}
                    />
                  </div>
                </motion.div>
              </motion.div>

              {/* Favorite Documents - Light Green */}
              <motion.div
                variants={itemVariants}
                className="favourite-documents"
              >
                <motion.div
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 min-h-[500px] overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="bg-gradient-to-r from-green-400 to-green-500 px-6 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                          <FileText className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-lg md:text-xl font-semibold text-white">
                            Favorite Documents
                          </h2>
                          <p className="text-green-100 text-xs md:text-sm mt-0.5">
                            Access your frequently used documents
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-gray-50/30 h-full">
                    <FavouriteDocuments />
                  </div>
                </motion.div>
              </motion.div>

              {/* Previous Research - Light Purple */}
              <motion.div
                variants={itemVariants}
                className="tour-previous-research"
              >
                <motion.div
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 min-h-[500px] overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="bg-gradient-to-r from-purple-400 to-purple-500 px-6 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                          <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-lg md:text-xl font-semibold text-white">
                            Previous Research
                          </h2>
                          <p className="text-purple-100 text-xs md:text-sm mt-0.5">
                            Review your past research and findings
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-gray-50/30 h-full">
                    <PreviousResearch />
                  </div>
                </motion.div>
              </motion.div>

              {/* Workflow Dashboard Widget */}
              {workflows?.length >= 1 && (
                <motion.div
                  variants={itemVariants}
                  className="workflow-dashboard-widget"
                >
                  <WorkflowDashboardWidget
                    workflows={workflows}
                    setWorkflows={setWorkflows}
                  />
                </motion.div>
              )}

              {/* Top Tasks - Light Gray */}
              <motion.div
                variants={itemVariants}
                className="opportunities-dashboard"
              >
                <motion.div
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 min-h-[500px] overflow-hidden flex flex-col"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="bg-gradient-to-r from-gray-500 to-gray-600 px-6 py-2 md:py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                          <Users className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-lg md:text-xl font-semibold text-white">
                            Opportunities
                          </h2>
                          <p className="text-gray-100 text-xs md:text-sm mt-0.5">
                            Track team performance and assignments
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className=" bg-gray-50/30 h-full">
                    <OpportunitiesDashboard />
                    {/* <TopAssignees
                      onSetUserProfile={setUserProfile}
                      onSetIsProfileDrawerOpen={setShowProfileDrawer}
                    /> */}
                  </div>
                </motion.div>
              </motion.div>
            </div>
          )}
          {/* Drag and Drop Cards Section */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="dashboard-cards">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="flex flex-col md:flex-row md:flex-wrap gap-6"
                >
                  {visibleCardOrder.map((card, index) => (
                    <Draggable
                      key={card.id}
                      draggableId={card.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`w-full ${card.fullWidth ? 'md:w-full' : 'md:w-[calc(50%-12px)]'} ${
                            snapshot.isDragging
                              ? 'dashboard-card-dragging z-50'
                              : ''
                          }`}
                        >
                          <DashboardCard
                            card={card}
                            index={index}
                            userProfile={userProfile}
                            setUserProfile={setUserProfile}
                            setShowProfileDrawer={setShowProfileDrawer}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </motion.div>
      </div>

      <Footer />

      {/* User Profile Drawer */}
      {showProfileDrawer && userProfile && (
        <UserProfileDrawer
          user={userProfile}
          isOpen={showProfileDrawer}
          onClose={() => setShowProfileDrawer(false)}
        />
      )}

      {user && <MeetingPlatformCheck user={user} />}
    </div>
  )
}

function Dashboard() {
  const handleTourComplete = () => {
    localStorage.setItem(TOUR_STORAGE_KEYS.COMPLETED, 'true')
    localStorage.removeItem(TOUR_STORAGE_KEYS.LAST_STEP)
  }

  return (
    <TourProvider
      steps={tourSteps}
      styles={tourStyles}
      onClickClose={({ setIsOpen }) => {
        handleTourComplete()
        setIsOpen(false)
      }}
      onClickMask={({ setIsOpen, currentStep, steps }) => {
        if (currentStep === steps.length - 1) {
          handleTourComplete()
        }
        setIsOpen(false)
      }}
    >
      <DashboardContent />
    </TourProvider>
  )
}

export default Dashboard
