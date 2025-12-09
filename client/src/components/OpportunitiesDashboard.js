import React, { useState, useEffect } from 'react'
import {
  Search,
  Handshake,
  FileText,
  Calendar,
  DollarSign,
  BookOpen,
  Plus,
} from 'lucide-react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const OpportunitiesDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [opportunities, setOpportunities] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 4,
  })

  useEffect(() => {
    fetchOpportunities()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Get current user ID and company ID from localStorage or context

  // Fetch opportunities from API
  const fetchOpportunities = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/crm/dashboard/opportunities`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!response.data?.success) {
        throw new Error('Failed to fetch opportunities')
      }

      const { opportunities } = response.data.data
      setOpportunities(opportunities)
    } catch (error) {
      console.error('Error fetching opportunities:', error)
      setError(error.message || 'Failed to fetch opportunities')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredOpportunities = opportunities.filter((opportunity) => {
    const searchLower = searchTerm.toLowerCase()

    const basicMatch =
      opportunity.name.toLowerCase().includes(searchLower) ||
      (opportunity.description &&
        opportunity.description.toLowerCase().includes(searchLower)) ||
      (opportunity.account_name &&
        opportunity.account_name.toLowerCase().includes(searchLower)) ||
      (opportunity.amount &&
        opportunity.amount.toString().toLowerCase().includes(searchLower))

    const contactMatch =
      opportunity.related_contacts &&
      opportunity.related_contacts.some(
        (contact) =>
          (contact.first_name &&
            contact.first_name.toLowerCase().includes(searchLower)) ||
          (contact.last_name &&
            contact.last_name.toLowerCase().includes(searchLower)) ||
          (contact.email &&
            contact.email.toLowerCase().includes(searchLower)) ||
          (contact.title &&
            contact.title.toLowerCase().includes(searchLower)) ||
          (contact.first_name &&
            contact.last_name &&
            `${contact.first_name} ${contact.last_name}`
              .toLowerCase()
              .includes(searchLower))
      )

    return basicMatch || contactMatch
  })

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Calculate pagination based on opportunities
  const totalPages = Math.ceil(opportunities.length / pagination.pageSize);
  const startItem = pagination.pageIndex * pagination.pageSize + 1;
  const endItem = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    opportunities.length
  );

  // Slice opportunities for current page
  const paginatedOpportunities = filteredOpportunities.slice(
    pagination.pageIndex * pagination.pageSize,
    (pagination.pageIndex + 1) * pagination.pageSize
  );

  // Pagination change handler
  const handlePaginationChange = (newPagination) => {
    setPagination(newPagination);
  };

  // Always render the card structure, even when there's an error or no data
  return (
    <div className="h-full flex flex-col">

      <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search opportunities, clients, amounts, or contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500 shadow-sm transition-all duration-200 hover:shadow-md"
          />
        </div>

        {/* Content */}
        <div className="bg-gray-50/30 flex-1 overflow-auto">
          {/* Modern Search Bar */}

          {/* Content based on state */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin"></div>
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              </div>
              <p className="text-gray-600 mt-4 font-medium">
                Loading opportunities...
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Please wait while we fetch your data
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Unable to Load Opportunities
              </h3>
              <p className="text-gray-600 text-center mb-4">{error}</p>
              <button
                onClick={fetchOpportunities}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Try Again
              </button>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Handshake className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                No Opportunities Yet
              </h3>
              {/* <p className="text-gray-600 text-center mb-4">
              You don't have any opportunities at the moment. Create your first
              opportunity to get started.
            </p> */}
              {/* <button
              onClick={() => navigate('/crm/opportunities/new')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Opportunity
            </button> */}
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                No Results Found
              </h3>
              <p className="text-gray-600 text-center mb-4">
                No opportunities match your search criteria. Try adjusting your
                search terms.
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOpportunities.map((opportunity) => (
                <div
                  key={opportunity.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Handshake className="w-4 h-4 text-blue-600" />
                        <h3
                          className="font-normal text-blue-500 underline text-lg cursor-pointer hover:text-blue-700"
                          onClick={async () => {
                            navigate(
                              `/crm/opportunities/${opportunity.id}?company=${opportunity.tenant_id}`
                            )
                          }}
                        >
                          {opportunity.name}
                        </h3>
                      </div>

                      <p className="text-gray-600 text-xs mb-3 line-clamp-2">
                        {opportunity.description}
                      </p>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="text-gray-700 font-medium text-base">
                            {opportunity.formatted_amount ||
                              formatCurrency(opportunity.amount)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="text-gray-700 text-base">
                            {formatDate(opportunity.expected_close_date)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex items-center gap-1 text-gray-500">
                          <FileText className="w-3 h-3" />
                          <span className="text-xs">
                            {opportunity.account_name}
                          </span>
                        </div>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500 text-xs">
                          stage:{' '}
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${opportunity.stage_color ||
                              'bg-gray-100 text-gray-800'
                              }`}
                          >
                            {opportunity.stage_name || 'Not set'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Document Icon */}
                    <div className="ml-4 flex-shrink-0">
                      <button
                        onClick={async () => {
                          navigate(
                            `/crm/opportunities/${opportunity.id}?company=${opportunity.tenant_id}`
                          )
                        }}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        title="View opportunity details"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer - only show when there are opportunities */}
          {opportunities.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Showing {filteredOpportunities.length} of {opportunities.length}{' '}
                open opportunities
              </p>
              <p className="text-xs text-gray-400 text-center mt-1">
                (Order by closing date, then by amount)
              </p>
              <div className="mt-2 text-center">
                <p className="text-xs text-gray-500">
                  Total Value:{' '}
                  {opportunities
                    .reduce(
                      (sum, opp) =>
                        sum + (opp.amount ? parseFloat(opp.amount) : 0),
                      0
                    )
                    .toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Controls - Exact same UI as the image */}
      {opportunities.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg mt-0 border-t border-gray-200">
          {/* Left side - Showing X to Y of Z results */}
          <div className="flex-1 text-sm text-gray-700">
            Showing {startItem} to {endItem} of {opportunities.length} results
          </div>

          {/* Center - Navigation controls */}
          <div className="flex items-center space-x-2">
            <button
              className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handlePaginationChange({
                ...pagination,
                pageIndex: pagination.pageIndex - 1
              })}
              disabled={pagination.pageIndex === 0 || isLoading}
            >
              Previous
            </button>

            <span className="text-sm text-gray-700">
              Page {pagination.pageIndex + 1} of {totalPages}
            </span>

            <button
              className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handlePaginationChange({
                ...pagination,
                pageIndex: pagination.pageIndex + 1
              })}
              disabled={pagination.pageIndex >= totalPages - 1 || isLoading}
            >
              Next
            </button>
          </div>

          {/* Right side - Show X dropdown */}
          <div className="flex items-center space-x-2 ml-4">
            <span className="text-sm text-gray-700">Show</span>
            <select
              value={pagination.pageSize}
              onChange={(e) => {
                const newPageSize = parseInt(e.target.value);
                setPagination({
                  pageIndex: 0, // Reset to first page when changing page size
                  pageSize: newPageSize
                });
              }}
              className="px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={4}>4</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

export default OpportunitiesDashboard
