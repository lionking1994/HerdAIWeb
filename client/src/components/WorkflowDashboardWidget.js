import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'

const WorkflowDashboardWidget = () => {
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)

  // Workflow related state
  const [workflows, setWorkflows] = useState([])
  const [workflowLoading, setWorkflowLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalWorkflows, setTotalWorkflows] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [status, setStatus] = useState('')
  const [openWorkflowCount, setOpenWorkflowCount] = useState(0)
  const [approveWorkflowCount, setApproveWorkflowCount] = useState(0)
  const [templates, setTemplates] = useState([])

  // Search modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [searchFormData, setSearchFormData] = useState({
    formField: '',
    fieldValue: '',
    workflowType: '',
    approver: ''
  })
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  
  // Search pagination state
  const [searchCurrentPage, setSearchCurrentPage] = useState(1)
  const [searchPageSize, setSearchPageSize] = useState(10)
  const [searchTotalResults, setSearchTotalResults] = useState(0)
  const [searchTotalPages, setSearchTotalPages] = useState(0)

  const fetchWorkflows = async (page = currentPage, limit = pageSize) => {
    try {
      setWorkflowLoading(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/workflow/user/workflow?status=${status}&page=${page}&limit=${limit}&userId=${user?.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.data.success && response.data.workflows) {
        const transformedWorkflows = response.data.workflows.map(
          (workflow) => ({
            id: workflow.id || workflow.workflow_id,
            name: workflow.name || workflow.workflow_name,
            status: workflow?.status,
            description: workflow.description || workflow.workflow_description,
            isActive: workflow.is_active || workflow.status === 'active',
            steps:
              workflow?.nodes?.length ||
              workflow?.steps ||
              workflow.workflow_steps ||
              [],
            CurrentNodeInstanceId: workflow?.currentStep?.node_instance_id,
            CurrentStatusName: workflow?.currentStep?.node_name,
            CurrentNodeType: workflow?.currentStep?.node_type,
            CurrentNodeId: workflow?.currentStep?.node_id,
            version: workflow.version || workflow.workflow_version || '1.0',
            createdAt: workflow.created_at || workflow.createdAt,
            updatedAt: workflow.updated_at || workflow.updatedAt,
            completed_at: workflow?.completed_at ?? null,
          })
        )

        setOpenWorkflowCount(response.data?.TotalWorkflowCount || 0)
        setApproveWorkflowCount(response.data?.ApprovedWorkflowsCount || 0)
        setWorkflows(transformedWorkflows)

        if (response.data.pagination) {
          setTotalWorkflows(response.data.pagination.total)
          setTotalPages(response.data.pagination.totalPages)
          setCurrentPage(response.data.pagination.page)
          setPageSize(response.data.pagination.limit)
        }
      } else {
        setWorkflows([])
        setTotalWorkflows(0)
        setTotalPages(0)
      }
    } catch (error) {
      console.error('Error fetching workflows:', error)
      setWorkflows([])
      setTotalWorkflows(0)
      setTotalPages(0)
    } finally {
      setWorkflowLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/template?companyId=${user.company_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.data.success && response.data.templates) {
        const transformedTemplates = response.data.templates.map(
          (template) => ({
            id: template.id || template.template_id,
            name: template.name || template.template_name,
            description: template.description || template.template_description,
            isActive: template.is_active || template.status === 'active',
            steps: template.steps || template.template_steps || [],

            version: template.version || template.template_version || '1.0',
            createdAt: template.created_at || template.createdAt,
            updatedAt: template.updated_at || template.updatedAt,
            completed_at: template?.completed_at ?? null,
          })
        )
        setTemplates(transformedTemplates)
      } else {
        setTemplates([])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      setTemplates([])
    }
  }

  // Search workflows function
  const searchWorkflows = async (page = searchCurrentPage, limit = searchPageSize) => {
    try {
      setSearchLoading(true)
      const token = localStorage.getItem('token')
      
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/workflow/user/workflow?page=${page}&limit=${limit}&userId=${user?.id}&fieldValue=${searchFormData.fieldValue}&approver=${searchFormData.approver}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.data.success) {
        setSearchResults(response.data.workflows || [])
        
        // Handle pagination data
        if (response.data.pagination) {
          setSearchTotalResults(response.data.pagination.total)
          setSearchTotalPages(response.data.pagination.totalPages)
          setSearchCurrentPage(response.data.pagination.page)
          setSearchPageSize(response.data.pagination.limit)
        } else {
          setSearchTotalResults(response.data.workflows?.length || 0)
          setSearchTotalPages(1)
        }
      } else {
        setSearchResults([])
        setSearchTotalResults(0)
        setSearchTotalPages(0)
      }
    } catch (error) {
      console.error('Error searching workflows:', error)
      setSearchResults([])
      setSearchTotalResults(0)
      setSearchTotalPages(0)
    } finally {
      setSearchLoading(false)
    }
  }

  // Perform new search (resets pagination)
  const performNewSearch = () => {
    setSearchCurrentPage(1)
    searchWorkflows(1, searchPageSize)
  }

  // Reset search form
  const resetSearchForm = () => {
    setSearchFormData({
      formField: '',
      fieldValue: '',
      fieldType: '',
      approver: ''
    })
    setSearchResults([])
    setSearchCurrentPage(1)
    setSearchTotalResults(0)
    setSearchTotalPages(0)
  }

  // Search pagination handlers
  const handleSearchPageChange = (newPage) => {
    setSearchCurrentPage(newPage)
    searchWorkflows(newPage, searchPageSize)
  }

  const handleSearchPageSizeChange = (newPageSize) => {
    setSearchPageSize(newPageSize)
    setSearchCurrentPage(1)
    searchWorkflows(1, newPageSize)
  }



  

  // Pagination handlers
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    fetchWorkflows(newPage, pageSize)
  }

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    setCurrentPage(1)
    fetchWorkflows(1, newPageSize)
  }

  // Workflow action handlers
  const handleCreateWorkflow = () => {
    window.open('/workflow-builder', '_blank')
  }

  const handleEditWorkflow = (workflow) => {
    window.open(`/workflow-builder?workflow=${workflow.id}`, '_blank')
  }

  const handleDuplicateWorkflow = (workflow) => {
    window.open(`/workflow-builder?duplicate=${workflow.id}`, '_blank')
  }

  const handleToggleWorkflow = async (workflow) => {
    console.log('Toggle workflow:', workflow.id)
  }

  const handleDeleteWorkflow = async (workflow) => {
    console.log('Delete workflow:', workflow.id)
  }

  // Fetch workflows when component mounts or status changes
  useEffect(() => {
    fetchWorkflows()
    fetchTemplates()
    // fetchWorkflowCounts();
  }, [status])

  return (
    <>
      {/* Search Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <img
                      src={'/magnifying-glass.png'}
                      alt="Search"
                      className="w-5 h-5 filter brightness-0 invert"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Search Workflow Records</h2>
                    <p className="text-blue-100 text-sm">Search workflows by form data, type, or approver with pagination</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSearchModalOpen(false)}
                  className="text-white hover:text-blue-100 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Search Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
                  <input
                    type="text"
                    placeholder="Enter the value to search for"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={searchFormData.fieldValue}
                    onChange={(e) => setSearchFormData({...searchFormData, fieldValue: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approver
                  </label>
                  <input
                    type="text"
                    placeholder="Enter approver name or email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={searchFormData.approver}
                    onChange={(e) => setSearchFormData({...searchFormData, approver: e.target.value})}
                  />
                </div>
              </div>

              {/* Search Actions */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={performNewSearch}
                    disabled={searchLoading}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {searchLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <img src={'/magnifying-glass.png'} alt="Search" className="w-4 h-4 filter brightness-0 invert" />
                    )}
                    Search Workflows
                  </button>
                  
                  <button
                    onClick={resetSearchForm}
                    className="px-4 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Search Results */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Search Results ({searchTotalResults} total)
                  {searchTotalPages > 1 && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      • Page {searchCurrentPage} of {searchTotalPages}
                    </span>
                  )}
                </h3>
                
                {searchLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                    <p className="mt-3 text-gray-600">Searching workflows...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {Object.values(searchFormData).some(val => val) ? 
                      'No workflows found matching your search criteria' : 
                      'Enter search criteria to find workflows'
                    }
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {searchResults.map((workflow, index) => (
                        <motion.div
                          key={workflow.id}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-800 mb-1">{workflow.name}</h4>
                              <div className="flex flex-wrap gap-2 text-sm">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                  ID: {workflow.id}
                                </span>
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                                  {workflow.status}
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full">
                                  {new Date(workflow.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                navigate(`/approval?id=${workflow.id}`)
                                setIsSearchModalOpen(false)
                              }}
                              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              View
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Search Pagination */}
                    {searchTotalPages > 1 && (
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          {/* Results Summary */}
                          <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                            <span className="font-medium text-gray-700">
                              Showing {(searchCurrentPage - 1) * searchPageSize + 1} to{' '}
                              {Math.min(searchCurrentPage * searchPageSize, searchTotalResults)} of{' '}
                              {searchTotalResults} results
                            </span>
                          </div>

                          {/* Pagination Controls */}
                          <div className="flex items-center space-x-3">
                            <button
                              className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                              disabled={searchCurrentPage <= 1}
                              onClick={() => handleSearchPageChange(searchCurrentPage - 1)}
                            >
                              <svg
                                className="w-4 h-4 mr-1 inline"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 19l-7-7 7-7"
                                />
                              </svg>
                              Previous
                            </button>
                            
                            <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg font-medium text-sm">
                              Page {searchCurrentPage} of {searchTotalPages}
                            </div>
                            
                            <button
                              className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                              disabled={searchCurrentPage >= searchTotalPages}
                              onClick={() => handleSearchPageChange(searchCurrentPage + 1)}
                            >
                              Next
                              <svg
                                className="w-4 h-4 ml-1 inline"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          </div>

                          {/* Items Per Page Selector */}
                          <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
                            <span className="text-sm text-gray-600 font-medium">Show</span>
                            <select
                              className="px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                              value={searchPageSize}
                              onChange={(e) => handleSearchPageSizeChange(Number(e.target.value))}
                            >
                              <option value="5">5</option>
                              <option value="10">10</option>
                              <option value="25">25</option>
                              <option value="50">50</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <motion.div
        className="bg-white rounded-2xl shadow-lg border border-gray-100 h-[500px] tour-workflow-widget overflow-hidden flex flex-col"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2">
          {/* Enhanced Workflow Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Enhanced Icon */}
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <img
                  src={'/workflow_icon.png'}
                  alt="Workflow"
                  className="w-6 h-6 filter brightness-0 invert"
                />
              </div>

              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white">Workflows</h2>
                <p className="text-blue-100 text-sm mt-1">
                  Manage and track your workflow progress
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="flex items-center gap-2 cursor-pointer bg-white/20 rounded-xl p-2 hover:bg-white/30 transition-colors"
                title="Search workflows"
              >
                <img
                  src={'/magnifying-glass.png'}
                  alt="Search"
                  className="w-6 h-6 invert"
                />
              </button>
              
              <button
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  status === ''
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}
                onClick={() => {
                  setStatus('')
                  setCurrentPage(1)
                }}
              >
                Open ({openWorkflowCount})
              </button>

              <div className="w-px h-8 bg-white/30"></div>

              <button
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  status === 'completed'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}
                onClick={() => {
                  setStatus('completed')
                  setCurrentPage(1)
                }}
              >
                Approve ({approveWorkflowCount})
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50/30 flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4">
          {/* Workflow Listing */}
          {workflowLoading ? (
            <div className="text-center py-16">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto shadow-lg"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 animate-ping"></div>
              </div>
              <p className="mt-4 text-gray-600 font-medium">
                Loading workflows...
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Please wait while we fetch your data
              </p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No workflows found
              </h3>
              <p className="text-gray-500 text-sm">
                Create your first workflow to get started
              </p>
            </div>
          ) : (
            <>
              {workflows.map((workflow, index) => (
                <motion.div
                  key={workflow.id}
                  className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-xl shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300 p-5 group mb-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Gear icon with circular arrow */}
                      <div className="w-10 h-10 text-blue-600 flex-shrink-0 flex items-center justify-center">
                        <img
                          src={'/gear.png'}
                          alt="Gear"
                          className="w-[20px] h-[20px]"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* <div className="mb-1">
                          <p className="font-semibold text-[#1e293b]">{workflow.name}</p>
                        </div> */}

                        <div className="mb-1">
                          <Link
                            to={workflow?.CurrentNodeType === "approval" ? `/approval?id=${workflow?.CurrentNodeInstanceId}` : `/workflow-instance-history?instanceId=${workflow?.id}`}
                            className="text-blue-600 hover:text-blue-800 font-semibold transition duration-200 underline hover:underline-offset-4"
                          >
                            {workflow.name}
                          </Link>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Submitted:
                            {new Date(workflow.createdAt).toLocaleDateString(
                              'en-US'
                            )}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                            </svg>
                            Record ID: {workflow.id}
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              workflow?.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : workflow?.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : workflow?.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : workflow?.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {/* Step: {workflow?.status === "active" ? "Approval" : workflow?.status === "completed" ? "Completed" : workflow?.status === "approved" ? "Approved" : workflow?.status === "failed" ? "Failed" : "Approval Pending"} */}
                            Step: {workflow?.steps}
                          </span>

                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              workflow?.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : workflow?.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : workflow?.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : workflow?.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {/* Step: {workflow?.status === "active" ? "Approval" : workflow?.status === "completed" ? "Completed" : workflow?.status === "approved" ? "Approved" : workflow?.status === "failed" ? "Failed" : "Approval Pending"} */}
                            Current Node: {workflow?.CurrentStatusName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced action button */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => {
                          navigate(
                            `/workflow-instance-history?instanceId=${workflow.id}`
                          )
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        title="View workflow details"
                      >
                        <img
                          src={'/doc-search.png'}
                          alt="Document Search"
                          className="w-6 h-6"
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </>
          )}
          </div>

          {/* Enhanced Pagination Section - Moved outside scrollable area */}
          {workflows.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200 bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                {/* Results Summary - Left side */}
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="font-medium text-gray-700">
                    Showing {(currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, totalWorkflows)} of{' '}
                    {totalWorkflows} results
                  </span>
                </div>

                {/* Pagination Controls - Middle */}
                <div className="flex items-center space-x-3">
                  <button
                    className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <svg
                      className="w-4 h-4 mr-1 inline"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    Previous
                  </button>
                  <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium text-sm">
                    Page {currentPage} of {totalPages}
                  </div>
                  <button
                    className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Next
                    <svg
                      className="w-4 h-4 ml-1 inline"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>

                {/* Items Per Page Selector - Right side */}
                <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="text-sm text-gray-600 font-medium">Show</span>
                  <select
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}

export default WorkflowDashboardWidget
