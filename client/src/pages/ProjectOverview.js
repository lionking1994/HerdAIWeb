import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  FolderOpen,
  Star,
  Circle,
  Leaf,
  BarChart3,
  Target,
  Activity,
  Bell,
  ChevronDown,
  Search
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const ProjectOverview = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchProjectDetails()
    fetchUserData()
  }, [projectId])

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      setUser(response.data)
    } catch (error) {
      console.error('Error fetching user data:', error)
    }
  }

  const fetchProjectDetails = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/psa/project/${projectId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.data.success) {
        setProject(response.data.data)
      } else {
        setError('Failed to fetch project details')
      }
    } catch (error) {
      console.error('Error fetching project details:', error)
      setError('Error loading project details')
    } finally {
      setLoading(false)
    }
  }

  const getHealthColor = (health) => {
    switch (health?.toLowerCase()) {
      case 'green':
        return 'text-green-600'
      case 'yellow':
        return 'text-yellow-600'
      case 'red':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'review':
        return 'bg-orange-100 text-orange-800'
      case 'done':
        return 'bg-green-100 text-green-800'
      case 'backlog':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project details...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Project Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The requested project could not be found.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isAuthenticated={true} user={user} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-gray-600">{project.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Project Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Details</h2>
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Health Status</p>
                      <p className={`text-sm font-bold ${getHealthColor(project.health)}`}>
                        {project.health || 'Green'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Budget</p>
                      <p className="text-sm font-bold text-green-600">${project.budgetHours || 0}</p>
                      <p className="text-xs text-gray-500">
                        ${project.spentCost || 0} used ({project.budgetUtilization || 0}%)
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Right Column */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Timeline</p>
                      <p className="text-sm font-bold text-gray-900">
                        {formatDate(project.start_date)} - {formatDate(project.end_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Activity className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Overall Complete</p>
                      <p className="text-sm font-bold text-purple-600">{project.progressPercentage || 0}%</p>
                      <p className="text-xs text-gray-500">
                        {project.completedItems || 0} of {project.totalItems || 0} pts
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Progress</span>
                  <span className="text-sm font-medium text-gray-900">{project.progressPercentage || 0}% complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${project.progressPercentage || 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Assigned Resources */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Assigned Resources</h2>
              <div className="space-y-4">
                {project.assignedResources?.length > 0 ? (
                  project.assignedResources.map((resource, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                        {resource.avatar ? (
                          <img
                            src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/avatars/${resource.avatar}`}
                            alt={resource.name}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              // Fallback to default icon if image fails to load
                              e.currentTarget.style.display = 'none';
                              const fallbackElement = e.currentTarget.nextElementSibling;
                              if (fallbackElement) {
                                fallbackElement.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium ${resource.avatar ? 'hidden' : ''}`}
                          style={{ display: resource.avatar ? 'none' : 'flex' }}
                        >
                          {resource.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{resource.name}</div>
                        <div className="text-sm text-gray-500">{resource.role || resource.title}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">{resource.allocation || 0}% allocated</div>
                        <div className="text-xs text-gray-500">${resource.hourlyRate || 0}/hr</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No resources assigned</p>
                )}
              </div>
            </div>

            {/* Work Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Work Breakdown</h2>
              <p className="text-sm text-gray-500 mb-4">Complete hierarchy of epics, features, and user stories</p>
              <div className="space-y-4">
                {project.workBreakdown?.length > 0 ? (
                  project.workBreakdown.map((item, index) => (
                    <div 
                      key={index} 
                      className={`border border-gray-200 rounded-lg p-4 ${
                        item.level_depth > 0 ? 'ml-6 border-l-2 border-l-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {item.type === 'epic' ? (
                            <Star className="h-4 w-4 text-red-500" />
                          ) : item.type === 'feature' ? (
                            <Circle className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Leaf className="h-4 w-4 text-green-500" />
                          )}
                          <h3 className="font-semibold text-gray-900">{item.title}</h3>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {item.type}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
                            {item.priority}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{item.story_points || 0} pts</span>
                        {item.type === 'epic' && item.child_count_by_type > 0 && (
                          <span className="text-blue-600 cursor-pointer">{item.child_count_by_type} features</span>
                        )}
                        {item.type === 'feature' && item.child_count_by_type > 0 && (
                          <span className="text-green-600 cursor-pointer">{item.child_count_by_type} stories</span>
                        )}
                        {item.sub_items_count > 0 && (
                          <span className="text-gray-600">{item.sub_items_count} total items</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No work items found</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
              <div className="space-y-3">
                {/* Epics */}
                <div className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <Star className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-medium text-gray-900">Epics</span>
                  </div>
                  <span className="text-sm font-bold text-red-600">{project.backlogSummary?.epics || 0}</span>
                </div>
                
                {/* Features */}
                <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <Circle className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900">Features</span>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{project.backlogSummary?.features || 0}</span>
                </div>
                
                {/* User Stories */}
                <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <Leaf className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-gray-900">User Stories</span>
                  </div>
                  <span className="text-sm font-bold text-green-600">{project.backlogSummary?.stories || 0}</span>
                </div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h2>
              <div className="space-y-3">
                {Object.entries(project.backlogSummary?.statusBreakdown || {}).map(([status, count]) => (
                  <div key={status} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</span>
                      <span className="text-sm font-medium text-gray-900">{count} stories</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          status === 'done' ? 'bg-green-500' :
                          status === 'review' ? 'bg-orange-500' :
                          status === 'in_progress' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`}
                        style={{ width: `${(count / (project.totalItems || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget Utilization */}
            <div className="bg-blue-600 rounded-xl p-6 text-white">
              <h2 className="text-lg font-semibold mb-4">Budget Utilization</h2>
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">{project.budgetUtilization || 0}%</div>
                <div className="text-blue-100 text-sm mb-4">of budget used</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Budgeted:</span>
                    <span>${project.budgetHours || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Actual:</span>
                    <span>${project.spentCost || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining:</span>
                    <span>${project.remainingCost || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default ProjectOverview
