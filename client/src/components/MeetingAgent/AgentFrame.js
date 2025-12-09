import React, { useState, useEffect, useRef, useContext } from 'react'
import {
  Bot,
  X,
  Maximize2,
  Minimize2,
  RefreshCcw,
  Copy,
  Download,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  FileText,
  TrendingUp,
  UserCheck,
  Bell,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import axios from 'axios'
import './AgentFrame.css'
import UserProfileDrawer from '../UserProfileDrawer'
import TaskDrawer from '../TaskDrawer/TaskDrawer'
import MeetingPopup from './MeetingPopup'
import { toast } from 'react-toastify'
import { AgentResearchItem } from './AgentResearchItem'
import { useDispatch, useSelector } from 'react-redux'
import { addMeeting } from '../../store/slices/upcomingMeetingSlice'
import { addResearch } from '../../store/slices/upcomingResearchSlice'
import { addcreatemeeting } from '../../store/slices/createMeetingSlice'
import { addTask } from '../../store/slices/discussTaskSlice'
import { ChatPopContext } from '../../context/chatPopContext'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
// import { use } from '../../../../server/routes/auth';

// Daily Reminder Component
const DailyReminder = ({ data, user, onClose }) => {
  const navigate = useNavigate()
  const [expandedSections, setExpandedSections] = useState({
    tasks: false,
    opportunities: false,
    approvals: false,
  })

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  // Navigation functions for the three cards
  const navigateToTasks = () => {
    window.location.href = '/task-list'
  }

  const navigateToOpportunities = () => {
    // Navigate to dashboard with opportunities section highlighted
    window.location.href = '/dashboard?section=opportunities'
  }

  const navigateToApprovals = () => {
    window.location.href = '/approval'
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'in progress':
        return 'bg-blue-500'
      case 'ready for review':
        return 'bg-yellow-500'
      case 'assigned':
        return 'bg-purple-500'
      case 'completed':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'No due date'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getCompanyId = async () => {
    try {
      // First try to get from user object
      const userData = localStorage.getItem('user')
      const user = JSON.parse(userData)
      if (userData) {
        console.log('🔍 Full User Object:', user)

        // Try different possible field names for company/tenant ID
        const companyId =
          user.company_id || user.tenant_id || user.companyId || user.tenantId

        if (companyId) {
          return companyId
        }

        console.log(
          '⚠️ No company ID found in user object. Available fields:',
          Object.keys(user)
        )
      }

      const token = localStorage.getItem('token')
      const companyData = await axios.get(
        `${process.env.REACT_APP_API_URL}/company/get-company?companyRoleId=${user?.company_role}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      return companyData?.data?.companyRole?.company_id
    } catch (error) {
      console.error('Error parsing user company data:', error)
    }
  }
  const companyId = getCompanyId()

  console.log(companyId, 'iuygjhgbn23487878448', getCompanyId())
  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-2xl p-2 sm:p-3 md:p-4 lg:p-5 mb-3 sm:mb-4 relative daily-reminder-glow">
      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-1 right-1 sm:top-2 sm:right-2 p-1 sm:p-1.5 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-full transition-all duration-200 hover:scale-110"
        >
          <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" />
        </button>
      )}

      {/* Header */}
      <div className="text-center mb-2 sm:mb-3 md:mb-4">
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
          Here's your daily overview for{' '}
        </p>
      </div>

      {/* Stats Overview */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-3 mb-2 sm:mb-3 md:mb-3 lg:mb-4">
        {['tasks', 'opportunities', 'approvals'].map((section) => (
          <div
            key={section}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 md:p-3.5 lg:p-4 border border-white/20 dark:border-gray-700/50 shadow-md hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer group overflow-hidden"
            onClick={() => toggleSection(section)}
            title={`Click to expand/collapse ${section.replace(/^\w/, (c) =>
              c.toUpperCase()
            )} section`}
          >
            <div className="flex flex-col items-center text-center h-full justify-center space-y-1 sm:space-y-1.5 md:space-y-2">
              <div
                className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gradient-to-r
      ${
        section === 'tasks'
          ? 'from-blue-500 to-indigo-600'
          : section === 'opportunities'
          ? 'from-emerald-500 to-green-600'
          : 'from-orange-500 to-red-600'
      }
      rounded-xl flex items-center justify-center shadow-lg`}
              >
                {section === 'tasks' ? (
                  <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                ) : section === 'opportunities' ? (
                  <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                ) : (
                  <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                )}
              </div>

              <p className="text-[5px] sm:text-[7px] md:text-[8px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide leading-tight truncate max-w-full">
                {section === 'tasks'
                  ? 'Open Tasks'
                  : section === 'opportunities'
                  ? 'Opportunities'
                  : 'Pending Approvals'}
              </p>

              <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate max-w-full">
                {section === 'tasks'
                  ? data?.openTask?.length || 0
                  : section === 'opportunities'
                  ? data?.openOpportunity?.length || 0
                  : data?.approveList?.length || 0}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tasks Section */}
      {data?.openTask && data.openTask.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <div
            className="flex items-center justify-between p-3 sm:p-4 lg:p-5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-700/50 shadow-lg cursor-pointer hover:shadow-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300"
            onClick={(e) => {
              e.stopPropagation()
              // navigateToTasks()
              toggleSection('tasks')
            }}
            title="Click to navigate to tasks page"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-white">
                  Open Tasks
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                  {data.openTask.length} tasks require your attention
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* <ExternalLink
                className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500"
                title="Click to navigate to tasks page"
              /> */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSection('tasks')
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Expand/Collapse"
              >
                {expandedSections.tasks ? (
                  <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {expandedSections.tasks && (
            <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
              {data.openTask.slice(0, 5).map((task, index) => (
                <div
                  key={task.id}
                  className="group bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 p-3 sm:p-4 daily-reminder-item"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/task-details?id=${task?.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm sm:text-base font-semibold transition duration-200 underline hover:underline-offset-4 truncate block"
                      >
                        <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                            {task.description}
                          </p>
                        )}
                      </Link>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4 flex-shrink-0">
                      <span
                        className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-semibold text-white ${getStatusColor(
                          task.status
                        )}`}
                      >
                        {task.status}
                      </span>
                      {task.priority && (
                        <span
                          className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-semibold text-white ${getPriorityColor(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500 dark:text-gray-400 gap-1 sm:gap-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Due: {formatDate(task.duedate)}</span>
                      </div>
                      {task.estimated_hours && (
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          <span>{task.estimated_hours}h</span>
                        </div>
                      )}
                      {task.category && (
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                          {task.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span className="truncate">
                        {task.owner_name || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {data.openTask.length > 5 && (
                <div className="text-center pt-2">
                  <button
                    // onClick={navigateToTasks}
                    className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium underline hover:underline-offset-4 transition-colors"
                  >
                    View all {data.openTask.length} tasks →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Opportunities Section */}
      {data?.openOpportunity && data.openOpportunity.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <div
            className="flex items-center justify-between p-3 sm:p-4 lg:p-5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-700/50 shadow-lg cursor-pointer hover:shadow-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-300"
            onClick={(e) => {
              e.stopPropagation()
              // navigateToOpportunities()
              toggleSection('opportunities')
            }}
            title="Click to navigate to opportunities page"
          >
            <div className="flex  items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-white">
                  Open Opportunities
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                  {data.openOpportunity.length} opportunities in pipeline
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* <ExternalLink
                className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500"
                title="Click to navigate to opportunities page"
              /> */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSection('opportunities')
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Expand/Collapse"
              >
                {expandedSections.opportunities ? (
                  <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {expandedSections.opportunities && (
            <div className="mt-3 cursor-pointer sm:mt-4 space-y-2 sm:space-y-3">
              {data.openOpportunity.slice(0, 5).map((opp, index) => (
                <div
                  key={opp.opp_id}
                  className="group cursor-pointer bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 p-3 sm:p-4 daily-reminder-item"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  <div className="flex cursor-pointer items-start justify-between mb-2 sm:mb-3">
                    <div className="flex-1 min-w-0">
                      <h4
                        className="text-sm cursor-pointer sm:text-base font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate"
                        onClick={async () =>
                          navigate(
                            `/crm/opportunities/${
                              opp?.opp_id
                            }?company=${await getCompanyId()}`
                          )
                        }
                      >
                        {opp.opp_name}
                      </h4>
                      {opp.opp_description && (
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                          {opp.opp_description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4 flex-shrink-0">
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-semibold">
                        {opp.stage_name}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500 dark:text-gray-400 gap-1 sm:gap-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          ${parseFloat(opp.amount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          Close: {formatDate(opp.expected_close_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                          {opp.probability}% probability
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs truncate">
                        {opp.lead_source || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {data.openOpportunity.length > 5 && (
                <div className="text-center pt-2">
                  <button
                    // onClick={navigateToOpportunities}
                    className="text-emerald-600 hover:text-emerald-800 text-xs sm:text-sm font-medium underline hover:underline-offset-4 transition-colors"
                  >
                    View all {data.openOpportunity.length} opportunities →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Approvals Section */}
      {data?.approveList && data.approveList.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <div
            className="flex items-center justify-between p-3 sm:p-4 lg:p-5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-700/50 shadow-lg cursor-pointer hover:shadow-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all duration-300"
            onClick={(e) => {
              e.stopPropagation()
              // navigateToApprovals()
              toggleSection('approvals')
            }}
            title="Click to navigate to approvals page"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-white">
                  Pending Approvals
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                  {data.approveList.length} items awaiting your approval
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* <ExternalLink
                className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500"
                title="Click to navigate to approvals page"
              /> */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSection('approvals')
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Expand/Collapse"
              >
                {expandedSections.approvals ? (
                  <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {expandedSections.approvals && (
            <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
              {data.approveList.slice(0, 5).map((approval, index) => {
                console.log(approval, 'ugvbjhgfcvbhugyvbjhugv')
                return (
                  <div
                    key={approval.id}
                    className="group bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 p-3 sm:p-4 daily-reminder-item"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      animationFillMode: 'both',
                    }}
                  >
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/approval?id=${approval.workflow_instance_id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm sm:text-base font-semibold transition duration-200 underline hover:underline-offset-4 truncate block"
                        >
                          {approval.workflow_name}
                        </Link>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-2">
                          Workflow approval required
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4 flex-shrink-0">
                        <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-semibold">
                          {approval.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500 dark:text-gray-400 gap-1 sm:gap-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            Created: {formatDate(approval.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                            ID: {approval.workflow_definition_id}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-orange-500" />
                        <span>Action Required</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {data.approveList.length > 5 && (
                <div className="text-center pt-2">
                  <button
                    // onClick={navigateToApprovals}
                    className="text-orange-600 hover:text-orange-800 text-xs sm:text-sm font-medium underline hover:underline-offset-4 transition-colors"
                  >
                    View all {data.approveList.length} approvals →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center pt-3 sm:pt-4 border-t border-white/20 dark:border-gray-700/50">
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          Have a productive day! 🚀
        </p>
      </div>
    </div>
  )
}

const convertJoinUrlToLink = (text) => {
  // Regex to match markdown link format: [text](url)
  const markdownLinkRegex = /\[(.*?)\]\((https?:\/\/.*?)\)/
  const match = text.match(markdownLinkRegex)

  if (match) {
    const [fullMatch, linkText, url] = match
    const parts = text.split(fullMatch)

    return (
      <>
        {parts[0]}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {linkText}
        </a>
        {parts[1]}
      </>
    )
  }

  return text
}

const Message = React.memo(
  ({
    message,
    index,
    type,
    onCopy,
    onDownload,
    onSetRequestId,
    onSetSelectedUser,
    onSetIsDrawerOpen,
    onSetIsTaskDrawerOpen,
    onSetPastTasks,
    onSetShowMeetingPopup,
    setIsLoading,
    setMeetingData,
    setShowMeetingPopup,
    sendMessageToAgent,
    analyzeAndHandleMeetingPattern,
    isMeetingLoading,
    setMessages,
  }) => {
    const handlePastTasksClick = async (meetingInfo) => {
      const data = meetingInfo.split(',')
      const meetingId = data[0]
      const userId = data[1]
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/tasks/past-open-tasks`,
          {
            meetingId: meetingId,
            userId: userId,
          },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        )

        if (response.data.success) {
          onSetPastTasks(response.data.tasks)
          onSetIsTaskDrawerOpen(true)
        }
      } catch (error) {
        console.error('Error fetching past tasks:', error)
        toast.error('Failed to fetch past tasks')
      }
    }

    // Filter consecutive underscores (2 or more) from text content
    const filterUnderscores = (text) => {
      if (typeof text === 'string') {
        return text.replace(/__+/g, '')
      }
      return text
    }

    const parseMessage = (text) => {
      if (!text) return text

      // Split text into lines
      const lines = text.split('\n')

      // Process each line
      const processedLines = lines.map((line) => {
        // Handle markdown headers (###)
        if (line.startsWith('###')) {
          const headerText = line.replace(/^###\s*/, '')
          return (
            <h3 className="text-lg font-bold my-2">
              {parseUserPlaceholder(filterUnderscores(headerText), text)}
            </h3>
          )
        }

        // Handle bullet points (-)
        if (line.trim().startsWith('-')) {
          const bulletText = line.replace(/^-\s*/, '')
          return (
            <div className="flex items-start space-x-2 ml-4 my-1">
              <span className="mt-1.5">•</span>
              <span>
                {parseUserPlaceholder(filterUnderscores(bulletText), text)}
              </span>
            </div>
          )
        }

        // If no special formatting, wrap in p tag
        return (
          <p className="my-2">
            {parseUserPlaceholder(filterUnderscores(line), text)}
          </p>
        )
      })

      return processedLines
    }

    const parseUserPlaceholder = (text, fullMessage) => {
      if (!text) return text

      // First analyze and handle the PrePopulateMeeting pattern
      const processedText = analyzeAndHandleMeetingPattern(
        text,
        onSetShowMeetingPopup,
        fullMessage,
        isMeetingLoading
      )

      // If the result is not a string (i.e., it's a React element), return it directly
      if (typeof processedText !== 'string') {
        return processedText
      }

      // Continue with other pattern processing...
      // Match request ID pattern
      const requestIdRegex = /<REQUEST_ID>(.*?)<\/REQUEST_ID>/
      const requestIdMatch = processedText.match(requestIdRegex)

      if (requestIdMatch) {
        const [fullMatch, requestId] = requestIdMatch
        const parts1 = text.split(fullMatch)

        // Just set the request ID, don't poll here
        onSetRequestId(requestId)

        return (
          <>
            <div className="flex items-center gap-2">
              <span>Researching your request</span>
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            </div>
          </>
        )
      }
      console.log(text)
      // Handle PrePopulateMeeting tags
      const meetingRegex = /<PrePopulateMeeting>(.*?)<\/PrePopulateMeeting>/
      const meetingMatch = text.match(meetingRegex)

      if (meetingMatch) {
        const [fullMatch] = meetingMatch
        const parts = text.split(fullMatch)

        return (
          <>
            {parts[0]}
            <button
              onClick={() => onSetShowMeetingPopup(true)}
              className="inline-flex items-center gap-2 px-4 py-2 my-2 cursor-pointer bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
            >
              <Calendar className="w-4 h-4" />
              Schedule Meeting
            </button>
            {parts[1] || ''}
          </>
        )
      }

      const regex = /<Research_Topic>\{(.+?)\} Yes\?\s*<\/Research_Topic>/i
      const researchMatch = text.match(regex)

      if (researchMatch) {
        console.log(text)
        const cleanedText = filterUnderscores(
          text
            .replace(
              /<Research_Topic>\{(.+?)\} Yes\?\s*<\/Research_Topic>/i,
              ''
            )
            .trim()
        )

        return (
          <div className="flex items-center gap-2 my-2">
            {cleanedText && (
              <span className="text-gray-700">{cleanedText}</span>
            )}
            <button
              className="underline text-blue-600 cursor-pointer hover:text-blue-800 font-semibold"
              onClick={() =>
                sendMessageToAgent(
                  `Help with this topic on Research "${researchMatch[1].trim()}"`
                )
              }
            >
              Yes
            </button>
          </div>
        )
      }

      // Handle user profile tags
      const userRegex = /<USER_ID>(.*?)\[(\d+)\]<\/USER_ID>/g
      const parts = []
      let lastIndex = 0
      let match

      while ((match = userRegex.exec(text)) !== null) {
        // Add text before the user tag
        if (match.index > lastIndex) {
          parts.push(
            filterUnderscores(
              convertJoinUrlToLink(text.substring(lastIndex, match.index))
            )
          )
        }

        // Extract user info
        const [fullMatch, userName, userId] = match

        // Add the user link
        parts.push(
          <button
            key={match.index}
            onClick={async () => {
              try {
                const response = await axios.post(
                  `${process.env.REACT_APP_API_URL}/users/get`,
                  { userId: userId },
                  {
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                  }
                )
                onSetSelectedUser(response.data.user)
                onSetIsDrawerOpen(true)
              } catch (error) {
                console.error('Error fetching user:', error)
                toast.error(
                  error.response?.data?.error || 'Failed to fetch user'
                )
              }
            }}
            className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            {filterUnderscores(userName)}
          </button>
        )

        lastIndex = match.index + fullMatch.length
      }

      // First handle past task count
      if (text.includes('[PAST_MEETING_COUNT]')) {
        const regex =
          /\[PAST_MEETING_COUNT\](\d+)\[\/PAST_MEETING_COUNT\]\(([^\)]+)\)/
        const match = text.match(regex)

        if (match) {
          const [fullMatch, count, meetingId] = match
          const beforeText = text.substring(0, text.indexOf(fullMatch))
          const afterText = text.substring(
            text.indexOf(fullMatch) + fullMatch.length
          )

          // Parse the surrounding text for markdown
          const parsedBeforeText = parseUserPlaceholder(beforeText)
          const parsedAfterText = parseUserPlaceholder(afterText)

          return (
            <p>
              {parsedBeforeText}
              <button
                onClick={() => handlePastTasksClick(meetingId)}
                className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 cursor-pointer"
              >
                {filterUnderscores(count)} tasks
              </button>
              {parsedAfterText}
            </p>
          )
        }
      }

      // Add remaining text and handle other formatting (like bold)
      if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex)
        // Handle bold text in remaining content
        const boldRegex = /\*\*(.*?)\*\*/g
        let boldMatch
        let boldLastIndex = 0
        const boldParts = []

        while ((boldMatch = boldRegex.exec(remainingText)) !== null) {
          if (boldMatch.index > boldLastIndex) {
            boldParts.push(
              convertJoinUrlToLink(
                remainingText.substring(boldLastIndex, boldMatch.index)
              )
            )
          }
          boldParts.push(
            <strong key={boldMatch.index}>
              {convertJoinUrlToLink(boldMatch[1])}
            </strong>
          )
          boldLastIndex = boldMatch.index + boldMatch[0].length
        }

        if (boldLastIndex < remainingText.length) {
          boldParts.push(
            convertJoinUrlToLink(remainingText.substring(boldLastIndex))
          )
        }

        parts.push(...boldParts)
      }

      return parts.length > 0 ? <>{parts}</> : convertJoinUrlToLink(text)
    }

    // Clean the message text by removing special tags
    const cleanMessage = (text) => {
      if (!text) return text

      // Remove PREPARE_MEETING tags
      return text.replace(/\[PREPARE_MEETING\].*?\[\/PREPARE_MEETING\]\s*/g, '')
      // Note: We don't remove PrePopulateMeeting tags here because we want to process them in parseUserPlaceholder
    }

    return (
      <>
        <div
          key={`message-${message.id || index}-${message.type}`}
          className={`flex items-start gap-1.5 sm:gap-2 ${
            message.type === 'user' ? 'flex-row-reverse' : ''
          }`}
        >
          {message.type === 'agent' && (
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </div>
          )}
          <div className="flex flex-col">
            <div
              className={`rounded-lg shadow-sm ${
                message.type === 'user'
                  ? 'bg-violet-500 text-white ml-auto'
                  : 'bg-white p-0'
              }`}
            >
              <pre
                style={{ background: '#0000' }}
                className={`text-xs sm:text-sm ${
                  message.type === 'user'
                    ? 'text-white'
                    : 'text-gray-800 break-words'
                }`}
              >
                {parseMessage(cleanMessage(message.message))}
              </pre>
            </div>
            <div className="flex gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
              {message.type !== 'user' && (
                <>
                  <Copy
                    size={12}
                    className="sm:w-3.5 sm:h-3.5 w-3 h-3 text-gray-500 hover:text-gray-700 cursor-pointer"
                    onClick={() => onCopy(message.message)}
                  />
                  <Download
                    size={12}
                    className="sm:w-3.5 sm:h-3.5 w-3 h-3 text-gray-500 hover:text-gray-700 cursor-pointer"
                    onClick={() => onDownload(message.message)}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }
)

export const AgentFrame = ({ isOpen, onClose, user }) => {
  const { PopMsg, setPopMsg } = useContext(ChatPopContext)

  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [inputMessage, setInputMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef(null)
  const upcomingMeeting = useSelector((state) => state.upcomingMeeting)
  const upcomingResearch = useSelector((state) => state.upcomingResearch)
  const createMeeting = useSelector((state) => state.createMeeting)
  const discussTask = useSelector((state) => state.discussTask)
  const [requestId, setRequestId] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [pastTasks, setPastTasks] = useState(null)
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false)
  const [currentRequestId, setCurrentRequestId] = useState(null)
  const dispatch = useDispatch()
  const [showMeetingPopup, setShowMeetingPopup] = useState(false)
  const [meetingData, setMeetingData] = useState({
    title: '',
    description: '',
    attendees: [],
  })
  const [showMeetingButton, setShowMeetingButton] = useState(false)
  const [isMeetingLoading, setIsMeetingLoading] = useState(false)
  // Add state to track research-related messages
  const [researchMessageIds, setResearchMessageIds] = useState(new Set())
  // Add state to track if research is active
  const [isResearchActive, setIsResearchActive] = useState(false)

  // Daily Reminder State
  const [dailyReminderData, setDailyReminderData] = useState(null)
  const [showDailyReminder, setShowDailyReminder] = useState(false)
  const [isDailyReminderLoading, setIsDailyReminderLoading] = useState(false)

  const handleCopy = (message) => {
    navigator.clipboard.writeText(message)
    toast.success('Message copied to clipboard')
  }

  function showBrowserNotification(body, options = {}) {
    if (Notification.permission === 'granted') {
      new Notification('GetHerd.ai', {
        body: body,
        icon: '/logo192.png',
        ...options,
      })
    }
  }

  useEffect(() => {
    if (createMeeting.meeting_topic) {
      // Updated property access
      dispatch(
        addcreatemeeting({
          meeting_topic: '',
        })
      )
    }
  }, [createMeeting])

  useEffect(() => {
    if (discussTask.task_title) {
      // Updated property access
      dispatch(
        addTask({
          task_title: '',
        })
      )
    }
  }, [discussTask])

  useEffect(() => {
    if (upcomingResearch.research_topic) {
      // Updated property access
      dispatch(
        addResearch({
          research_topic: '',
        })
      )
    }
  }, [upcomingResearch])

  useEffect(() => {
    if (upcomingMeeting.meeting_id) {
      // Updated property access
      dispatch(
        addMeeting({
          id: null,
          title: '',
        })
      )
    }
  }, [upcomingMeeting])

  const handleDownload = (message) => {
    const blob = new Blob([message], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-recommendation-${
      new Date().toISOString().split('T')[0]
    }.txt`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  useEffect(() => {
    getCurrentRequestId()
    fetchChatHistory()
    setIsLoading(true)
  }, [])

  // Fetch daily reminder when component mounts and user is available
  useEffect(() => {
    if (user?.id && shouldShowDailyReminder()) {
      // Delay the daily reminder to show after initial chat loads
      const timer = setTimeout(() => {
        fetchDailyReminder()
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [user])

  // Remove the auto-hide useEffect - daily reminder will stay visible all day

  const getCurrentRequestId = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/agent/sessionid`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )
      setCurrentRequestId(response.data.sessionId)
      if (response.data.isNewSession) {
        initChat(response.data.sessionId)
      }
    } catch {
      toast.error('Failed to get current request ID')
    }
  }

  const initChat = async (requestId) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/agent/message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            message: 'init',
            type: 'system',
            requestId: requestId,
          }),
        }
      )

      // const responseDailyReminderMsg = await fetch(
      //   `${process.env.REACT_APP_API_URL}/agent/remind/task?userId=${user?.id}`,
      //   {
      //     method: 'GET',
      //     headers: {
      //       'Content-Type': 'application/json',
      //       Authorization: `Bearer ${localStorage.getItem('token')}`,
      //     },
      //     body: JSON.stringify({
      //       message: 'init',
      //       type: 'system',
      //       requestId: requestId,
      //     }),
      //   }
      // )

      // console.log(responseDailyReminderMsg, 'responseDailyReminderMsg')
      setIsLoading(false)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let currentMessage = ''
      let tempMessage = null
      let buffer = ''

      // Add temporary message container
      setMessages((prev) => {
        const newMessage = {
          message: '',
          type: 'agent',
          id: Date.now(),
        }
        tempMessage = newMessage
        return [...prev, newMessage]
      })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })

        // Process chunk immediately
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              switch (data.type) {
                case 'start':
                  currentMessage = ''
                  break
                case 'chunk':
                  // Update message immediately with each chunk
                  currentMessage += data.content
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempMessage.id
                        ? { ...msg, message: currentMessage }
                        : msg
                    )
                  )
                  break
                case 'error':
                  setMessages((prev) => [
                    ...prev,
                    { message: `Error: ${data.error}`, type: 'agent' },
                  ])
                  break
                case 'end':
                  break
              }
            } catch (e) {
              // Handle incomplete JSON in chunk
              buffer += line + '\n'
              if (buffer.includes('\n')) {
                try {
                  const data = JSON.parse(buffer.slice(6))
                  if (data.type === 'chunk') {
                    currentMessage += data.content
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === tempMessage.id
                          ? { ...msg, message: currentMessage }
                          : msg
                      )
                    )
                  }
                  buffer = ''
                } catch (e) {
                  // Keep accumulating buffer if JSON is still incomplete
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error initializing chat:', error)
      setMessages((prev) => [
        ...prev,
        { message: `Error: ${error.message}`, type: 'agent' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  const fetchChatHistory = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/agent/history`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )
      if (response.data.success) {
        if (response.data.messages.length) {
          setMessages(response.data.messages)
          // Force scroll after messages are set
          setTimeout(scrollToBottom, 100)
        }
      }
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching chat history:', error)
      toast.error('Failed to fetch chat history')
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (upcomingMeeting.meeting_id) {
      console.log('upcomingMeeting:', upcomingMeeting)
      const handleMessage = async () => {
        await refreshSession()
        const message = `[PREPARE_MEETING]${upcomingMeeting.meeting_id}[/PREPARE_MEETING]
          Help me prepare for the upcoming meeting: "${upcomingMeeting.meeting_title}".`
        await sendMessageToAgent(message)
      }
      handleMessage()
    }
  }, [upcomingMeeting])

  useEffect(() => {
    if (createMeeting.meeting_topic) {
      console.log('createMeeting:', createMeeting)
      const handleMessage = async () => {
        await refreshSession()
        const message = `${createMeeting.meeting_topic}`
        await sendMessageToAgent(message)
      }
      handleMessage()
    }
  }, [createMeeting])

  useEffect(() => {
    if (discussTask.task_title) {
      console.log('discussTask:', discussTask)
      const handleMessage = async () => {
        await refreshSession()
        const message = `${discussTask.task_title}`
        await sendMessageToAgent(message)
      }
      handleMessage()
    }
  }, [discussTask])

  useEffect(() => {
    if (upcomingResearch.research_topic) {
      console.log('upcomingResearch:', upcomingResearch)
      const handleMessage = async () => {
        await refreshSession()
        const message = `
        Help with this topic on Research "${upcomingResearch.research_topic}"`
        await sendMessageToAgent(message)
      }
      handleMessage()
    }
  }, [upcomingResearch])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim()) return
    await sendMessageToAgent(inputMessage)
    setInputMessage('')
  }

  useEffect(() => {
    const send = async () => {
      if (PopMsg && PopMsg !== '') {
        await sendMessageToAgent(PopMsg)
        setPopMsg('')
      }
    }

    send()
  }, [PopMsg])

  const sendMessageToAgent = async (message) => {
    const newMessage = { message: message, type: 'user', id: Date.now() }
    setMessages((prev) => [...prev, newMessage])
    setIsLoading(true)

    // Check if this is a research-related message
    const isResearchMessage =
      message.toLowerCase().includes('research') ||
      message.toLowerCase().includes('help with this topic on research')

    if (isResearchMessage) {
      setResearchMessageIds((prev) => new Set([...prev, newMessage.id]))
      setIsResearchActive(true)
    }

    console.log('Sending message:', message)

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/agent/message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            message: message,
            type: 'user',
            requestId: currentRequestId,
          }),
        }
      )

      // Check if it's a schedule meeting request with immediate response
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        const jsonResponse = await response.json()

        if (jsonResponse.type === 'schedule_meeting') {
          console.log('Detected meeting scheduling request')

          // Show the meeting scheduling popup
          setShowMeetingPopup(true)

          // Add a simple acknowledgment message
          const acknowledgmentMessage = {
            message:
              "I'll help you schedule a meeting. Please fill out the form that just appeared.",
            type: 'agent',
          }
          setMessages((prev) => [...prev, acknowledgmentMessage])

          setIsLoading(false)
          return
        }
      }

      // Continue with normal SSE handling for non-schedule meeting requests
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let currentMessage = ''
      let tempMessage = null

      // Add temporary message container
      setMessages((prev) => {
        const newMessage = {
          message: '',
          type: 'agent',
          id: Date.now(),
        }
        tempMessage = newMessage

        // If this is a research-related conversation, track the agent message too
        if (isResearchMessage) {
          setResearchMessageIds((prev) => new Set([...prev, newMessage.id]))
        }

        return [...prev, newMessage]
      })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        let buffer = chunk

        // Process complete lines from buffer
        let newlineIndex
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex)
          buffer = buffer.slice(newlineIndex + 1)

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              switch (data.type) {
                case 'start':
                  currentMessage = ''
                  break
                case 'chunk':
                  currentMessage += data.content
                  setMessages((prev) =>
                    prev.map((msg) => {
                      return msg.id === tempMessage.id
                        ? { ...msg, message: currentMessage }
                        : msg
                    })
                  )
                  setIsLoading(false)
                  break
                case 'error':
                  setMessages((prev) => [
                    ...prev,
                    { message: `Error: ${data.error}`, type: 'agent' },
                  ])
                  break
                case 'end':
                  // Handle any special end-of-message processing
                  break
                default:
                  break
              }
            } catch (e) {
              console.warn('JSON parse error, skipping chunk:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages((prev) => [
        ...prev,
        { message: `Error: ${error.message}`, type: 'agent' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }
  console.log('process.env.REACT_APP_API_URL', process.env.REACT_APP_API_URL)
  console.log('localStorage.getItem(token)', localStorage.getItem('token'))
  const refreshSession = async () => {
    setMessages([])
    try {
      const result = await axios.put(
        `${process.env.REACT_APP_API_URL}/agent/refresh-session`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )
      console.log('result', result)
      setCurrentRequestId(result.data.sessionId)
      await initChat(result.data.sessionId)
      setRequestId(null)
    } catch (error) {
      console.error('Error refreshing session:', error)
      toast.error('Failed to refresh session')
    }
  }

  // Function to fetch daily reminder data
  const fetchDailyReminder = async () => {
    if (!user?.id) return

    setIsDailyReminderLoading(true)
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/agent/remind/task?userId=${user.id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setDailyReminderData(data.data)
          setShowDailyReminder(true)

          // Show browser notification if there are items
          const totalItems =
            (data.data.openTask?.length || 0) +
            (data.data.openOpportunity?.length || 0) +
            (data.data.approveList?.length || 0)

          if (totalItems > 0) {
            showBrowserNotification(
              `You have ${totalItems} items requiring attention today!`,
              {
                tag: 'daily-reminder',
                requireInteraction: true,
              }
            )
          }
        }
      }
    } catch (error) {
      console.error('Error fetching daily reminder:', error)
      // Don't show error toast for daily reminder as it's not critical
    } finally {
      setIsDailyReminderLoading(false)
    }
  }

  // Check if daily reminder should be shown (once per day)
  const shouldShowDailyReminder = () => {
    const lastShown = localStorage.getItem('lastDailyReminderDate')
    const today = new Date().toDateString()

    // if (lastShown !== today) {
    localStorage.setItem('lastDailyReminderDate', today)
    return true
    // }
    // return false;
  }

  // Function to handle closing research and selectively delete research-related messages
  const handleCloseResearch = () => {
    // Remove only research-related messages
    setMessages((prev) => prev.filter((msg) => !researchMessageIds.has(msg.id)))

    // Clear research tracking
    setResearchMessageIds(new Set())
    setIsResearchActive(false)
    setRequestId(null)
  }
  if (!isOpen) return null

  const handleMeetingSubmit = (formData) => {
    // Close the popup
    setShowMeetingPopup(false)

    // Prepare attendees list for the message
    const attendeesList =
      formData.attendees && formData.attendees.length > 0
        ? `\nAttendees: ${formData.attendees
            .map((a) => `${a.name} (${a.email})`)
            .join(', ')}`
        : '\nAttendees: No attendees'

    // Send the collected data to the agent
    const detailsMessage = `I want to schedule a meeting with the following details:
Title: ${formData.title}
Description: ${formData.description}${attendeesList}

Please create this meeting for me.`

    sendMessageToAgent(detailsMessage)
  }

  // Add a function to parse meeting data using AI
  const parseMeetingDataWithAI = async (messageText) => {
    try {
      setIsMeetingLoading(true)

      // Send the message to the backend for AI parsing
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/agent/parse-meeting-data`,
        {
          message: messageText.message || messageText,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )

      if (response.data.success) {
        // Pre-fill the meeting data with only title, description, and attendees
        const parsedData = response.data.meetingData
        setMeetingData({
          title: parsedData.title || '',
          description: parsedData.description || '',
          attendees: parsedData.attendees || [],
        })

        // Show the meeting popup
        setShowMeetingPopup(true)
      } else {
        toast(response.data.message)
        console.warn('Failed to parse meeting data:', response.data.message)
      }
    } catch (error) {
      console.error('Error parsing meeting data:', error)
      toast(error.response?.data?.error || 'Failed to parse meeting data')
    } finally {
      setIsMeetingLoading(false)
    }
  }

  // Function to analyze and handle the PrePopulateMeeting pattern
  const analyzeAndHandleMeetingPattern = (
    text,
    setShowMeetingPopupFn,
    message,
    isMeetingLoading
  ) => {
    // Check if the text contains the PrePopulateMeeting pattern
    const meetingRegex = /<PrePopulateMeeting>(.*?)<\/PrePopulateMeeting>/
    const meetingMatch = text.match(meetingRegex)

    if (meetingMatch) {
      // Extract any data between the tags (if present)
      const meetingData = meetingMatch[1] || ''

      // Log for debugging
      console.log('PrePopulateMeeting pattern detected', { meetingData })

      // Remove the pattern from the text and replace with a button
      const parts = text.split(meetingMatch[0])

      return (
        <>
          {parts[0]}
          <button
            onClick={() => parseMeetingDataWithAI(message)}
            disabled={isMeetingLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 my-2 cursor-pointer text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 ${
              isMeetingLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600'
            }`}
          >
            {isMeetingLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                Schedule Meeting
              </>
            )}
          </button>
          {parts[1] || ''}
        </>
      )
    }

    return text
  }

  return (
    <>
      <div
        className={`
      fixed z-40
      bg-white rounded-2xl
      shadow-[0_8px_30px_rgb(0,0,0,0.12)]
      border border-gray-100
      flex flex-col
      transition-all duration-300 ease-in-out
      overflow-hidden
      z-[1020010]

      /* Mobile First Design */
      bottom-[70px] right-2 left-2
      mx-2
      max-h-[70vh]

      /* Small screens */
      sm:bottom-[70px] sm:right-3 sm:left-3
      sm:mx-3
      sm:max-h-[75vh]

      /* Tablet and Desktop */
      md:right-4
      md:max-h-[80vh]
      ${
        isExpanded
          ? 'md:left-4 md:top-20 md:bottom-20 md:w-auto '
          : 'md:left-auto md:bottom-20 md:w-[350px] lg:w-[400px] xl:w-[450px] md:mx-0 md:mb-0'
      }

      ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
    `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-2 sm:p-3 lg:p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800">
                AI Assistant
              </h3>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {isLoading ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 status-dot"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    Online
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={toggleExpand}
              className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              aria-label={isExpanded ? 'Minimize window' : 'Maximize window'}
            >
              {isExpanded ? (
                <Minimize2
                  size={16}
                  className="w-6 h-6 text-gray-600"
                />
              ) : (
                <Maximize2
                  size={16}
                  className="w-6 h-6 text-gray-600"
                />
              )}
            </button>
            <button
              onClick={() => {
                setRequestId(null) // Stop polling
                setResearchMessageIds(new Set()) // Clear research tracking
                setIsResearchActive(false) // Re-enable input
                refreshSession() // Existing logic
              }}
              className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Clear chat session"
            >
              <RefreshCcw
                size={16}
                className="w-6 h-6 text-gray-600"
              />
            </button>
            <button
              onClick={onClose}
              className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={24} className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Chat container */}
        <div
          className={`overflow-auto h-[250px] sm:h-[300px] ${
            isExpanded ? 'md:h-[400px]' : 'md:h-[400px] lg:h-[500px]'
          }`}
        >
          {isDrawerOpen && (
            <div className="h-[300px] sm:h-[500px] fixed bg-[#AAA0] w-full overflow-hidden">
              <UserProfileDrawer
                user={selectedUser}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
              />
            </div>
          )}

          {/* Meeting Popup Component */}
          {showMeetingPopup && (
            <div className="h-[300px] sm:h-[500px] fixed bg-[#AAA0] w-full overflow-hidden z-[200]">
              <MeetingPopup
                isOpen={showMeetingPopup}
                onClose={() => setShowMeetingPopup(false)}
                meetingData={meetingData}
                setMeetingData={setMeetingData}
                onSubmit={handleMeetingSubmit}
              />
            </div>
          )}

          {isTaskDrawerOpen && (
            <div className="h-[300px] sm:h-[500px] fixed bg-[#AAA0] w-full overflow-hidden">
              <TaskDrawer
                isOpen={isTaskDrawerOpen}
                onClose={() => setIsTaskDrawerOpen(false)}
                tasks={pastTasks}
              />
            </div>
          )}

          <div>
            {requestId && (
              <div className="flex justify-center p-2 absolute bg-[#AAA] min-h-[48px] sm:min-h-[52px] w-full z-10 top-[75px]">
                {
                  <AgentResearchItem
                    requestId={requestId}
                    onClose={handleCloseResearch}
                    onResearchComplete={() => {
                      setMessages((prev) => {
                        return prev.map((msg) =>
                          msg.message &&
                          msg.message
                            .toLowerCase()
                            .includes('researching your request')
                            ? {
                                ...msg,
                                message:
                                  'Research completed! You can download the results from the download button above.',
                              }
                            : msg
                        )
                      })
                      // Re-enable input when research is completed
                      setIsResearchActive(false)
                    }}
                    onDownload={() => {
                      // Re-enable input when user downloads results
                      setIsResearchActive(false)
                    }}
                  />
                }
              </div>
            )}
            <div
              className={`space-y-2 sm:space-y-3 max-w-[800px] mx-auto p-2 sm:p-3 lg:p-4 ${
                requestId ? 'mt-[50px]' : ''
              }`}
            >
              {/* Daily Reminder Component */}
              {showDailyReminder && dailyReminderData && (
                <div className="animate-in slide-in-from-top-4 duration-500 daily-reminder-enter">
                  <DailyReminder
                    data={dailyReminderData}
                    user={user}
                    onClose={() => setShowDailyReminder(false)}
                  />
                </div>
              )}

              {messages.map((message, index) => {
                if (
                  (isLoading && index === messages.length - 1) ||
                  (message.message === '' && index === 0)
                ) {
                  // console.log('Loading...', message, index)
                  return (
                    <div className="flex items-start gap-1.5 sm:gap-2">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div className="bg-white p-1.5 sm:p-2 rounded-lg rounded-tl-none shadow-sm">
                        <div className="flex gap-1">
                          <div
                            className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gray-300 animate-bounce"
                            style={{ animationDelay: '0ms' }}
                          />
                          <div
                            className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gray-300 animate-bounce"
                            style={{ animationDelay: '150ms' }}
                          />
                          <div
                            className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gray-300 animate-bounce"
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <Message
                    key={`message-${message.id || index}-${message.type}`}
                    message={message}
                    index={index}
                    onCopy={handleCopy}
                    onDownload={handleDownload}
                    onSetRequestId={setRequestId}
                    onSetSelectedUser={setSelectedUser}
                    onSetIsDrawerOpen={setIsDrawerOpen}
                    onSetIsTaskDrawerOpen={setIsTaskDrawerOpen}
                    onSetPastTasks={setPastTasks}
                    onSetShowMeetingPopup={setShowMeetingPopup}
                    setIsLoading={setIsLoading}
                    setMeetingData={setMeetingData}
                    setShowMeetingPopup={setShowMeetingPopup}
                    sendMessageToAgent={sendMessageToAgent}
                    analyzeAndHandleMeetingPattern={
                      analyzeAndHandleMeetingPattern
                    }
                    isMeetingLoading={isMeetingLoading}
                    setMessages={setMessages}
                  />
                )
              })}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input area */}
        <form
          onSubmit={handleSubmit}
          className="p-2 sm:p-3 lg:p-4 border-t border-gray-100 bg-white"
        >
          <div className="flex items-center gap-2 max-w-[800px] mx-auto">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                isResearchActive
                  ? 'Research in progress... Input disabled'
                  : 'Type your message...'
              }
              disabled={isLoading || isResearchActive}
              className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent ${
                isLoading || isResearchActive
                  ? 'opacity-50 cursor-not-allowed bg-gray-100'
                  : ''
              }`}
            />
            <button
              type="submit"
              disabled={isLoading || isResearchActive}
              className={`p-1 sm:p-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full text-white hover:opacity-90 transition-opacity ${
                isLoading || isResearchActive
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4 rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
