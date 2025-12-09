import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Filter,
  CheckSquare,
  Clock,
  AlertCircle,
  Eye,
  Star,
  ChevronRight,
  Calendar,
  Users,
  Target,
  TrendingUp,
  MessageSquare,
  Bell,
  User,
} from 'lucide-react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useSelector } from 'react-redux'

const PSAMyWork = () => {
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const [stories, setStories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [priorityFilter, setPriorityFilter] = useState('All Priority')
  const [projectFilter, setProjectFilter] = useState('All Projects')
  const [availableProjects, setAvailableProjects] = useState([])
  const [overdueFilter, setOverdueFilter] = useState(false)
  const [unreadFilter, setUnreadFilter] = useState(false)
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    inProgress: 0,
    inReview: 0,
    completed: 0,
    overdue: 0,
    unread: 1
  })
  const [error, setError] = useState(null)

  useEffect(() => {
    getUserStories()
  }, [])


  const getUserStories = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const token = localStorage.getItem('token')
      
      // Get user's assigned stories from PSA backend
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/psa/my-stories`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data?.success) {
        const data = response.data.data
        const fetchedStories = data.stories || []
        setStories(fetchedStories)
        
        // Extract unique projects for the dropdown
        const uniqueProjects = [...new Set(fetchedStories.map(story => story.project_name).filter(Boolean))]
        setAvailableProjects(uniqueProjects)
        
        // Use summary stats from API response directly
        const backendStats = data.summary_stats || {}
        const stats = {
          total: backendStats.total || 0,
          inProgress: backendStats.in_progress || 0,
          inReview: backendStats.in_review || 0,
          completed: backendStats.completed || 0,
          overdue: backendStats.overdue || 0,
          unread: backendStats.unread_count || 0
        }
        setSummaryStats(stats)
      }
    } catch (error) {
      console.error('Error fetching user stories:', error)
      setError('Failed to fetch stories.')
    } finally {
      setIsLoading(false)
    }
  }


  const getStatusColor = (status) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'review': return 'bg-orange-100 text-orange-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'backlog': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Just now'
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))
    
    if (diffInHours < 24) {
      return `${diffInHours} hours ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays} days ago`
    }
  }

  const filteredStories = stories.filter(story => {
    const matchesSearch = story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         story.description.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Handle status filtering with support for "done"
    let matchesStatus = false
    if (statusFilter === 'All Status') {
      matchesStatus = true
    } else if (statusFilter === 'done') {
      matchesStatus = story.status === 'done'
    } else if (statusFilter === 'in_progress') {
      matchesStatus = story.status === 'in_progress'
    } else if (statusFilter === 'review') {
      matchesStatus = story.status === 'review'
    } else if (statusFilter === 'backlog') {
      matchesStatus = story.status === 'backlog'
    } else {
      matchesStatus = story.status.toLowerCase() === statusFilter.toLowerCase()
    }
    
    const matchesPriority = priorityFilter === 'All Priority' || 
                           story.priority.toLowerCase() === priorityFilter.toLowerCase()
    const matchesProject = projectFilter === 'All Projects' || 
                          story.project_name === projectFilter
    
    // Overdue filter - check if due_date is in the past and status is not completed
    const matchesOverdue = !overdueFilter || (
      story.due_date && 
      new Date(story.due_date) < new Date() && 
      story.status !== 'done' && 
      story.status !== 'completed'
    )
    
    // Unread filter - check if story has unread updates
    const matchesUnread = !unreadFilter || story.has_unread_updates === true
    
    return matchesSearch && matchesStatus && matchesPriority && matchesProject && matchesOverdue && matchesUnread
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isAuthenticated={true} user={user} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Users className="w-8 h-8 text-purple-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">My Work</h1>
                  <p className="text-gray-600">Wednesday, September 24, 2025</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              {/* <div className="relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">1</span>
              </div> */}
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          {/* User Assignment Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Stories assigned to {user?.name || 'Current User'}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Current Sprint: {stories.length > 0 ? `${stories[0]?.sprint || 'Sprint 1'}` : 'No Active Sprint'}
                </p>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-6 gap-4 mt-6">
            <div 
              onClick={() => {
                setStatusFilter('All Status')
                setOverdueFilter(false)
                setUnreadFilter(false)
              }}
              className={`bg-blue-50 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${statusFilter === 'All Status' && !overdueFilter && !unreadFilter ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Stories</p>
                  <p className="text-2xl font-bold text-blue-700">{summaryStats.total}</p>
                </div>
                <CheckSquare className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            
            <div 
              onClick={() => {
                setStatusFilter('in_progress')
                setOverdueFilter(false)
                setUnreadFilter(false)
              }}
              className={`bg-blue-50 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${statusFilter === 'in_progress' && !overdueFilter && !unreadFilter ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">In Progress</p>
                  <p className="text-2xl font-bold text-blue-700">{summaryStats.inProgress}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            
            <div 
              onClick={() => {
                setStatusFilter('review')
                setOverdueFilter(false)
                setUnreadFilter(false)
              }}
              className={`bg-orange-50 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${statusFilter === 'review' && !overdueFilter && !unreadFilter ? 'ring-2 ring-orange-500' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">In Review</p>
                  <p className="text-2xl font-bold text-orange-700">{summaryStats.inReview}</p>
                </div>
                <Eye className="w-8 h-8 text-orange-500" />
              </div>
            </div>
            
            <div 
              onClick={() => {
                setStatusFilter('done')
                setOverdueFilter(false)
                setUnreadFilter(false)
              }}
              className={`bg-green-50 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${statusFilter === 'done' && !overdueFilter && !unreadFilter ? 'ring-2 ring-green-500' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Completed</p>
                  <p className="text-2xl font-bold text-green-700">{summaryStats.completed}</p>
                </div>
                <CheckSquare className="w-8 h-8 text-green-500" />
              </div>
            </div>
            
            <div 
              onClick={() => {
                setOverdueFilter(!overdueFilter)
                setUnreadFilter(false)
                setStatusFilter('All Status')
              }}
              className={`bg-red-50 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${overdueFilter ? 'ring-2 ring-red-500' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Overdue</p>
                  <p className="text-2xl font-bold text-red-700">{summaryStats.overdue}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            
            <div 
              onClick={() => {
                setUnreadFilter(!unreadFilter)
                setOverdueFilter(false)
                setStatusFilter('All Status')
              }}
              className={`bg-purple-50 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${unreadFilter ? 'ring-2 ring-purple-500' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Unread</p>
                  <p className="text-2xl font-bold text-purple-700">{summaryStats.unread}</p>
                </div>
                <Bell className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center space-x-4 mt-6">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search your stories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="All Status">All Status</option>
              <option value="backlog">Backlog</option>
              <option value="in_progress">In Progress</option>
              <option value="review">In Review</option>
              <option value="done">Done</option>
              {/* <option value="completed">Completed</option> */}
            </select>
            
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="All Priority">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="All Projects">All Projects</option>
              {availableProjects.map(project => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stories List */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      Error Loading Stories
                    </h3>
                    <p className="text-gray-600 text-center mb-4">{error}</p>
                    <button
                      onClick={getUserStories}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center gap-2"
                      disabled={isLoading}
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  filteredStories.map((story) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/psa/story/${story.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{story.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(story.status)}`}>
                        {story.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-4">{story.description}</p>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                      <span className="font-medium">{story.project_name}</span>
                      <span>•</span>
                      <span className="text-blue-600 cursor-pointer hover:underline">{story.sprint_name || 'Backlog'}</span>
                      <span>•</span>
                      <span className="text-blue-600 cursor-pointer hover:underline">{story.feature_title || story.type}</span>
                    </div>
                    
                    <div className="flex items-center space-x-6 text-sm text-gray-600 mb-3">
                      <div className="flex items-center space-x-1">
                        <Target className="w-4 h-4" />
                        <span>{story.story_points} pts</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageSquare className="w-4 h-4" />
                        <span>{story.comment_count || 0} comments</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Due {formatDate(story.due_date)}
                          {story.overdue_days > 0 && (
                            <span className="text-red-500 ml-1">({story.overdue_days} days overdue)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Project ends {formatDate(story.project_end_date)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(story.priority)}`}>
                        {story.priority.toUpperCase()}
                      </span>
                      {story.tags && Array.isArray(story.tags) ? story.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {tag}
                        </span>
                      )) : story.tags ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {story.tags}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          story
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" />
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default PSAMyWork
