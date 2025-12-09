import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  Calendar,
  CheckSquare,
  Users,
  Clock,
  MapPin,
  Mail,
  Phone,
  X,
  WorkflowIcon,
  BookOpenCheck,
  Handshake,
  FolderOpen,
  UserCheck,
  FileText,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { debounce } from 'lodash'
import axios from 'axios'
import UserProfileDrawer from './UserProfileDrawer'
import { toast } from 'react-toastify'

// Custom CSS for enhanced scrollbar and effects
const customStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #3b82f6, #06b6d4);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #2563eb, #0891b2);
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .backdrop-blur-md {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .group:hover .group-hover\\:bg-clip-text {
    background-clip: text;
    -webkit-background-clip: text;
  }
`

const DashboardSearch = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState('all')
  const [searchResults, setSearchResults] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [downloadingFiles, setDownloadingFiles] = useState(new Set())
  // Search types configuration
  const searchTypes = [
    { id: 'all', label: 'All', icon: Search },
    { id: 'meeting', label: 'Meetings', icon: Calendar },
    { id: 'task', label: 'Tasks', icon: CheckSquare },
    { id: 'user', label: 'People', icon: Users },
    { id: 'workflow', label: 'Workflow', icon: WorkflowIcon },
    { id: 'research_request', label: 'Research', icon: BookOpenCheck },
    { id: 'opportunity', label: 'Opportunities', icon: Handshake },
    { id: 'project', label: 'Projects', icon: FolderOpen },
    { id: 'resource', label: 'Resources', icon: UserCheck },
    { id: 'user_story', label: 'User Stories', icon: FileText },
  ]

  // Updated search function based on your implementation
  const handleSearch = async (query) => {
    if (query.trim().length < 2) {
      setSearchResults({})
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    setIsLoading(true)
    const token = localStorage.getItem('token')

    try {
      const response = await axios.get(
        `${
          process.env.REACT_APP_API_URL
        }/search/search?query=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.data.success) {
        setSearchResults(response.data.results)
      }
    } catch (error) {
      console.error('Search error:', error)
      if (error.response?.status === 403) {
        localStorage.removeItem('token')
        navigate('/')
      }
      setSearchResults({})
    } finally {
      setIsSearching(false)
      setIsLoading(false)
    }
  }

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query) => {
      handleSearch(query)
    }, 300),
    []
  )

  // Handle search input changes
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      debouncedSearch(searchQuery)
    } else {
      setSearchResults({})
      setIsSearching(false)
    }
  }, [searchQuery, debouncedSearch])

  // Get filtered results based on search type
  const getFilteredResults = () => {
    if (!searchResults || Object.keys(searchResults).length === 0) {
      return {}
    }

    if (searchType === 'all') {
      return searchResults
    } else {
      return {
        [searchType]: searchResults[searchType] || [],
      }
    }
  }

  const checkFileExists = async (filename) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/files/check/${filename}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to check file existence')
      }

      const data = await response.json()
      return data.exists
    } catch (error) {
      console.error('Error checking file existence:', error)
      return false
    }
  }

  const handleDownload = async (research) => {
    const requestId = research.request_id

    // Prevent multiple simultaneous downloads of the same file
    if (downloadingFiles.has(requestId)) {
      return
    }

    try {
      setDownloadingFiles((prev) => new Set(prev).add(requestId))

      const filename = `research-${requestId}.docx`

      // Show loading toast
      const loadingToast = toast.loading('Checking file availability...')

      // Check if file exists
      const fileExists = await checkFileExists(filename)

      // Dismiss loading toast
      toast.dismiss(loadingToast)

      if (!fileExists) {
        toast.error(
          'Research file not found. The file may have been moved or deleted.'
        )
        return
      }

      // File exists, proceed with download
      toast.success('File found! Opening download...')
      const downloadUrl = `${process.env.REACT_APP_API_URL}/files/${filename}`
      window.open(downloadUrl, '_blank')
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('Failed to download research file. Please try again.')
    } finally {
      setDownloadingFiles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(requestId)
        return newSet
      })
    }
  }

  const filteredResults = getFilteredResults()
  const totalResults = Object.values(filteredResults).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  )

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
  // Handle item click
  const handleItemClick = async (item, type) => {
    console.log(type, 'hfbdf', item)
    if (type === 'meeting') {
      navigate(`/meeting-detail?id=${item.id}`)
    } else if (type === 'research_request') {
      await handleDownload(item)
    } else if (type === 'workflow') {
      navigate(`/approval?id=${item.id}`)
    } else if (type === 'task') {
      navigate(`/task-details?id=${item.id}`)
    } else if (type === 'opportunity') {
      console.log(type, 'hfbdf1', item)
      navigate(`/crm/opportunities/${item?.id}?company=${await getCompanyId()}`)
    } else if (type === 'user') {
      const user = {
        id: item.id,
        name: item.title || item.name,
        email: item.additionalInfo || item.email,
        bio: item.description || item.bio,
        avatar: item.ownerAvatar || item.avatar,
        phone: item.phone,
        location: item.location,
      }
      setSelectedUser(user)
      setIsDrawerOpen(true)
    } else if (type === 'project') {
      // Navigate to Project Overview page
      navigate(`/psa/project/${item.id}`)
    } else if (type === 'resource') {
      // Navigate to Resource Overview page
      navigate(`/psa/resource-overview/${item.id}`)
    } else if (type === 'user_story') {
      // Navigate to User Story Workspace page
      navigate(`/psa/story/${item.id}`)
    }
  }

  // Clear search
  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults({})
    setIsSearching(false)
  }

  // Handle search input change
  const handleInputChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
  }

  // Render search results
  const renderSearchResults = () => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Searching...</p>
        </div>
      )
    }

    if (totalResults === 0 && searchQuery.length >= 2) {
      return <></>
    }
    console.log(filteredResults)

    return (
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        <div className="space-y-6">
          {Object.entries(filteredResults).map(([type, items]) => {
            if (!Array.isArray(items) || !items.length) return null

            // const typeConfig = {
            //   meeting: {
            //     icon: Calendar,
            //     emoji: '📅',
            //     gradient: 'from-blue-500 to-cyan-500',
            //     bgGradient: 'from-blue-50 to-cyan-50',
            //     darkBgGradient: 'from-blue-900/20 to-cyan-900/20',
            //     borderColor: 'border-blue-200',
            //     darkBorderColor: 'dark:border-blue-700',
            //     hoverBorderColor: 'hover:border-blue-300',
            //     darkHoverBorderColor: 'dark:hover:border-blue-600',
            //     iconColor: 'text-blue-600',
            //     darkIconColor: 'dark:text-blue-400',
            //   },
            //   task: {
            //     icon: CheckSquare,
            //     emoji: '✅',
            //     gradient: 'from-emerald-500 to-green-500',
            //     bgGradient: 'from-emerald-50 to-green-50',
            //     darkBgGradient: 'from-emerald-900/20 to-green-900/20',
            //     borderColor: 'border-emerald-200',
            //     darkBorderColor: 'dark:border-emerald-700',
            //     hoverBorderColor: 'hover:border-emerald-300',
            //     darkHoverBorderColor: 'dark:hover:border-emerald-600',
            //     iconColor: 'text-emerald-600',
            //     darkIconColor: 'dark:text-emerald-400',
            //   },
            //   user: {
            //     icon: Users,
            //     emoji: '👤',
            //     gradient: 'from-purple-500 to-pink-500',
            //     bgGradient: 'from-purple-50 to-pink-50',
            //     darkBgGradient: 'from-purple-900/20 to-pink-900/20',
            //     borderColor: 'border-purple-200',
            //     darkBorderColor: 'dark:border-purple-700',
            //     hoverBorderColor: 'hover:border-purple-300',
            //     darkHoverBorderColor: 'dark:hover:border-purple-600',
            //     iconColor: 'text-purple-600',
            //     darkIconColor: 'dark:text-purple-400',
            //   },
            //   workflow: {
            //     icon: WorkflowIcon,
            //     emoji: '🔗',
            //     gradient: 'from-orange-500 to-red-500',
            //     bgGradient: 'from-orange-50 to-red-50',
            //     darkBgGradient: 'from-orange-900/20 to-red-900/20',
            //     borderColor: 'border-orange-200',
            //     darkBorderColor: 'dark:border-orange-700',
            //     hoverBorderColor: 'hover:border-orange-300',
            //     darkHoverBorderColor: 'dark:hover:border-orange-600',
            //     iconColor: 'text-orange-600',
            //     darkIconColor: 'dark:text-orange-400',
            //   },
            //   research_request: {
            //     icon: BookOpenCheck,
            //     emoji: '📚',
            //     gradient: 'from-indigo-500 to-purple-500',
            //     bgGradient: 'from-indigo-50 to-purple-50',
            //     darkBgGradient: 'from-indigo-900/20 to-purple-900/20',
            //     borderColor: 'border-indigo-200',
            //     darkBorderColor: 'dark:border-indigo-700',
            //     hoverBorderColor: 'hover:border-indigo-300',
            //     darkHoverBorderColor: 'dark:hover:border-indigo-600',
            //     iconColor: 'text-indigo-600',
            //     darkIconColor: 'dark:text-indigo-400',
            //   },
            //   opportunities: {
            //     icon: Handshake,
            //     emoji: '🤝',
            //     gradient: 'from-indigo-500 to-purple-500',
            //     bgGradient: 'from-indigo-50 to-purple-50',
            //     darkBgGradient: 'from-indigo-900/20 to-purple-900/20',
            //     borderColor: 'border-indigo-200',
            //     darkBorderColor: 'dark:border-indigo-700',
            //     hoverBorderColor: 'hover:border-indigo-300',
            //     darkHoverBorderColor: 'dark:hover:border-indigo-600',
            //     iconColor: 'text-indigo-600',
            //     darkIconColor: 'dark:text-indigo-400',
            //   },
            // }

            const typeConfig = {
              meeting: {
                icon: Calendar,
                emoji: '📅',
                gradient: 'from-blue-500 to-cyan-500',
                bgGradient: 'from-blue-50 to-cyan-50',
                darkBgGradient: 'from-blue-900/20 to-cyan-900/20',
                borderColor: 'border-blue-200',
                darkBorderColor: 'dark:border-blue-700',
                hoverBorderColor: 'hover:border-blue-300',
                darkHoverBorderColor: 'dark:hover:border-blue-600',
                iconColor: 'text-blue-600',
                darkIconColor: 'dark:text-blue-400',
              },
              opportunity: {
                icon: Handshake,
                emoji: '🤝',
                gradient: 'from-indigo-500 to-purple-500',
                bgGradient: 'from-indigo-50 to-purple-50',
                darkBgGradient: 'from-indigo-900/20 to-purple-900/20',
                borderColor: 'border-indigo-200',
                darkBorderColor: 'dark:border-indigo-700',
                hoverBorderColor: 'hover:border-indigo-300',
                darkHoverBorderColor: 'dark:hover:border-indigo-600',
                iconColor: 'text-indigo-600',
                darkIconColor: 'dark:text-indigo-400',
              },
              research_request: {
                icon: BookOpenCheck,
                emoji: '📚',
                gradient: 'from-indigo-500 to-purple-500',
                bgGradient: 'from-indigo-50 to-purple-50',
                darkBgGradient: 'from-indigo-900/20 to-purple-900/20',
                borderColor: 'border-indigo-200',
                darkBorderColor: 'dark:border-indigo-700',
                hoverBorderColor: 'hover:border-indigo-300',
                darkHoverBorderColor: 'dark:hover:border-indigo-600',
                iconColor: 'text-indigo-600',
                darkIconColor: 'dark:text-indigo-400',
              },
              task: {
                icon: CheckSquare,
                emoji: '✅',
                gradient: 'from-emerald-500 to-green-500',
                bgGradient: 'from-emerald-50 to-green-50',
                darkBgGradient: 'from-emerald-900/20 to-green-900/20',
                borderColor: 'border-emerald-200',
                darkBorderColor: 'dark:border-emerald-700',
                hoverBorderColor: 'hover:border-emerald-300',
                darkHoverBorderColor: 'dark:hover:border-emerald-600',
                iconColor: 'text-emerald-600',
                darkIconColor: 'dark:text-emerald-400',
              },
              user: {
                icon: Users,
                emoji: '👤',
                gradient: 'from-purple-500 to-pink-500',
                bgGradient: 'from-purple-50 to-pink-50',
                darkBgGradient: 'from-purple-900/20 to-pink-900/20',
                borderColor: 'border-purple-200',
                darkBorderColor: 'dark:border-purple-700',
                hoverBorderColor: 'hover:border-purple-300',
                darkHoverBorderColor: 'dark:hover:border-purple-600',
                iconColor: 'text-purple-600',
                darkIconColor: 'dark:text-purple-400',
              },
              workflow: {
                icon: WorkflowIcon,
                emoji: '🔗',
                gradient: 'from-orange-500 to-red-500',
                bgGradient: 'from-orange-50 to-red-50',
                darkBgGradient: 'from-orange-900/20 to-red-900/20',
                borderColor: 'border-orange-200',
                darkBorderColor: 'dark:border-orange-700',
                hoverBorderColor: 'hover:border-orange-300',
                darkHoverBorderColor: 'dark:hover:border-orange-600',
                iconColor: 'text-orange-600',
                darkIconColor: 'dark:text-orange-400',
              },
              project: {
                icon: FolderOpen,
                emoji: '📁',
                gradient: 'from-teal-500 to-cyan-500',
                bgGradient: 'from-teal-50 to-cyan-50',
                darkBgGradient: 'from-teal-900/20 to-cyan-900/20',
                borderColor: 'border-teal-200',
                darkBorderColor: 'dark:border-teal-700',
                hoverBorderColor: 'hover:border-teal-300',
                darkHoverBorderColor: 'dark:hover:border-teal-600',
                iconColor: 'text-teal-600',
                darkIconColor: 'dark:text-teal-400',
              },
              resource: {
                icon: UserCheck,
                emoji: '👥',
                gradient: 'from-violet-500 to-purple-500',
                bgGradient: 'from-violet-50 to-purple-50',
                darkBgGradient: 'from-violet-900/20 to-purple-900/20',
                borderColor: 'border-violet-200',
                darkBorderColor: 'dark:border-violet-700',
                hoverBorderColor: 'hover:border-violet-300',
                darkHoverBorderColor: 'dark:hover:border-violet-600',
                iconColor: 'text-violet-600',
                darkIconColor: 'dark:text-violet-400',
              },
              user_story: {
                icon: FileText,
                emoji: '📝',
                gradient: 'from-amber-500 to-orange-500',
                bgGradient: 'from-amber-50 to-orange-50',
                darkBgGradient: 'from-amber-900/20 to-orange-900/20',
                borderColor: 'border-amber-200',
                darkBorderColor: 'dark:border-amber-700',
                hoverBorderColor: 'hover:border-amber-300',
                darkHoverBorderColor: 'dark:hover:border-amber-600',
                iconColor: 'text-amber-600',
                darkIconColor: 'dark:text-amber-400',
              },
            }

            const config = typeConfig[type]
            if (!config) return null

            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="relative"
              >
                {/* Category Header with Glassmorphism */}
                <div
                  className={`relative mb-6 p-4 ml-6 mr-6 mt-2 rounded-2xl bg-gradient-to-r ${config.bgGradient} dark:${config.darkBgGradient} backdrop-blur-sm border ${config.borderColor} ${config.darkBorderColor} shadow-lg`}
                >
                  <div className="absolute inset-0 bg-white/30 dark:bg-black/20 rounded-2xl"></div>
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`relative p-3 rounded-xl bg-gradient-to-br ${config.gradient} shadow-lg transform hover:scale-110 transition-transform duration-300`}
                      >
                        <config.icon className="w-6 h-6 text-white" />
                        <div className="absolute inset-0 bg-white/20 rounded-xl"></div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 capitalize">
                          {type === 'research_request'
                            ? 'Previous Research'
                            : type}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {items.length} item{items.length !== 1 ? 's' : ''}{' '}
                          found
                        </p>
                      </div>
                    </div>
                    <div
                      className={`px-4 py-2 rounded-full bg-gradient-to-r ${config.gradient} text-white font-semibold text-sm shadow-lg transform hover:scale-105 transition-transform duration-200`}
                    >
                      {items.length}
                    </div>
                  </div>
                </div>

                {/* Items Grid */}
                {/* <div className="grid gap-4 ml-12 mr-12">
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{
                        delay: index * 0.1,
                        duration: 0.4,
                        ease: "easeOut",
                        type: "spring",
                        stiffness: 100
                      }}
                      whileHover={{
                        scale: 1.02,
                        y: -2,
                        transition: { duration: 0.2 }
                      }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleItemClick(item, type)}
                      className={`group relative p-6 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border ${config.borderColor} ${config.darkBorderColor} ${config.hoverBorderColor} ${config.darkHoverBorderColor} hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden`}
                    >

                      <div className={`absolute inset-0 bg-gradient-to-r ${config.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-2xl`}></div>


                      <div className="relative">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} shadow-md`}>
                              <config.icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-lg font-bold text-gray-900 dark:text-white truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-700 dark:group-hover:from-white dark:group-hover:to-gray-300 transition-all duration-300">
                                {item.title || item.name}
                              </h4>
                            </div>
                          </div>


                          <div className={`opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 p-2 rounded-full bg-gradient-to-r ${config.gradient} shadow-lg`}>
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        </div>

                        {item.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                            {item.description}
                          </p>
                        )}


                        <div className="flex items-center space-x-6 text-xs">
                          {type === 'meeting' && (
                            <>
                              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                <Clock className="w-3 h-3" />
                                <span className="font-medium">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}</span>
                              </div>
                              {item.additionalInfo && (
                                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
                                  <span className="font-medium">{item.additionalInfo} min</span>
                                </div>
                              )}
                            </>
                          )}

                          {type === 'user' && (
                            <>
                              {(item.additionalInfo || item.email) && (
                                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                  <Mail className="w-3 h-3" />
                                  <span className="font-medium truncate max-w-32">{item.additionalInfo || item.email}</span>
                                </div>
                              )}
                              {item.location && (
                                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">
                                  <MapPin className="w-3 h-3" />
                                  <span className="font-medium">{item.location}</span>
                                </div>
                              )}
                            </>
                          )}

                          {type === 'task' && item.dueDate && (
                            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                              <Clock className="w-3 h-3" />
                              <span className="font-medium">Due {new Date(item.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div> */}

                <div className="grid gap-3 ml-12 mr-12">
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{
                        delay: index * 0.1,
                        duration: 0.4,
                        ease: 'easeOut',
                        type: 'spring',
                        stiffness: 100,
                      }}
                      whileHover={{
                        scale: 1.02,
                        y: -2,
                        transition: { duration: 0.2 },
                      }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleItemClick(item, type)}
                      className={`group relative p-2 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border ${config.borderColor} ${config.darkBorderColor} ${config.hoverBorderColor} ${config.darkHoverBorderColor} hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden`}
                    >
                      {/* Hover Effect Background */}
                      <div
                        className={`absolute inset-0 bg-gradient-to-r ${config.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-xl`}
                      ></div>

                      {/* Content */}
                      <div className="relative">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div
                              className={`p-1.5 rounded-md bg-gradient-to-br ${config.gradient} shadow`}
                            >
                              <config.icon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-700 dark:group-hover:from-white dark:group-hover:to-gray-300 transition-all duration-300">
                                {item.title || item.name}
                              </h4>
                            </div>
                          </div>

                          <div
                            className={`opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 p-1 rounded-full bg-gradient-to-r ${config.gradient} shadow-md`}
                          >
                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                          </div>
                        </div>

                        {item.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2 leading-tight">
                            {item.description}
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center space-x-2 text-[10px]">
                          {type === 'meeting' && (
                            <>
                              <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                <Clock className="w-3 h-3" />
                                <span className="font-medium">
                                  {item.createdAt
                                    ? new Date(
                                        item.createdAt
                                      ).toLocaleDateString()
                                    : 'N/A'}
                                </span>
                              </div>
                              {item.additionalInfo && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
                                  <span className="font-medium">
                                    {item.additionalInfo} min
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {type === 'user' && (
                            <>
                              {(item.additionalInfo || item.email) && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                  <Mail className="w-3 h-3" />
                                  <span className="font-medium truncate max-w-28">
                                    {item.additionalInfo || item.email}
                                  </span>
                                </div>
                              )}
                              {item.location && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">
                                  <MapPin className="w-3 h-3" />
                                  <span className="font-medium">
                                    {item.location}
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {type === 'task' && item.dueDate && (
                            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                              <Clock className="w-3 h-3" />
                              <span className="font-medium">
                                Due{' '}
                                {new Date(item.dueDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}

                          {type === 'opportunity' && (
                            <>
                              {item.stage && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                  <span className="font-medium truncate max-w-28">
                                    {item.stage}
                                  </span>
                                </div>
                              )}

                              {item.amount && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                  💰
                                  <span className="font-medium">
                                    ${parseFloat(item.amount).toLocaleString()}
                                  </span>
                                </div>
                              )}

                              {item.expected_close_date && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                  <Clock className="w-3 h-3" />
                                  <span className="font-medium">
                                    Closes{' '}
                                    {new Date(
                                      item.expected_close_date
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {type === 'project' && (
                            <>
                              {item.additionalInfo && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                                  <span className="font-medium truncate max-w-28">
                                    {item.additionalInfo}
                                  </span>
                                </div>
                              )}
                              {item.dateField && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
                                  <Clock className="w-3 h-3" />
                                  <span className="font-medium">
                                    {new Date(item.dateField).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {type === 'resource' && (
                            <>
                              {item.additionalInfo && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                                  <span className="font-medium truncate max-w-28">
                                    {item.additionalInfo}
                                  </span>
                                </div>
                              )}
                              {item.dateField && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                  <Clock className="w-3 h-3" />
                                  <span className="font-medium">
                                    {new Date(item.dateField).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {type === 'user_story' && (
                            <>
                              {item.additionalInfo && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                  <span className="font-medium truncate max-w-28">
                                    {item.additionalInfo}
                                  </span>
                                </div>
                              )}
                              {item.dateField && (
                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                                  <Clock className="w-3 h-3" />
                                  <span className="font-medium">
                                    {new Date(item.dateField).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{customStyles}</style>
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Search Input */}
        <div className="relative tour-search-bar">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Search for meetings, tasks, or people... (min 2 characters)"
            value={searchQuery}
            onChange={handleInputChange}
            className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
            </button>
          )}
        </div>

        {/* Search Results */}
        <AnimatePresence mode="wait">{renderSearchResults()}</AnimatePresence>

        {/* Results Summary */}
        {searchQuery.length >= 2 && totalResults > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "
              {searchQuery}" (showing up to 5 per category)
            </p>
          </div>
        )}
      </motion.div>
      <UserProfileDrawer
        user={selectedUser}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  )
}

export default DashboardSearch
