import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Download, ExternalLink, Search, Calendar, Users, FileText } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { EnhancedDataTable } from '../components/DataTable';

interface Meeting {
  id: number;
  title: string;
  description: string | null;
  datetime: string;
  participant_count: number;
  task_count: number;
  transcription_link: string | null;
  organizer_name: string;
  organizer_email: string;
}

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const Meetings: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const [searchParams] = useSearchParams();
  const columnHelper = createColumnHelper<Meeting>();

  // Server-side pagination state
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo | null>(null);

  // Server-side sorting state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'datetime', desc: true }
  ]);

  // Use refs to track current values to avoid stale closures
  const currentSortingRef = useRef(sorting);
  const currentPaginationRef = useRef(pagination);
  const currentSearchRef = useRef(globalFilter);

  // Update refs when state changes
  useEffect(() => {
    currentSortingRef.current = sorting;
  }, [sorting]);

  useEffect(() => {
    currentPaginationRef.current = pagination;
  }, [pagination]);

  useEffect(() => {
    currentSearchRef.current = globalFilter;
  }, [globalFilter]);

  const companyId = searchParams.get('company');

  const handleDownloadTranscript = async (meeting: Meeting) => {
    try {
      const blob = new Blob([meeting.transcription_link as string], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${meeting.title}_transcript.txt`;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading transcript:', error);
    }
  };

  const handleViewMeeting = (meetingId: number) => {
    window.location.href = `/meeting-detail?id=${meetingId}`;
  };

  // Define columns
  const columns = [
    columnHelper.accessor('title' as const, {
      header: 'Title',
      cell: (info) => (
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {info.getValue()}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('description' as const, {
      header: 'Description',
      cell: (info) => (
        <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 max-w-xs">
          {info.getValue() || 'No description'}
        </div>
      ),
      enableSorting: false,
    }),
    columnHelper.accessor('datetime' as const, {
      header: 'Date & Time',
      cell: (info) => (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {format(new Date(info.getValue()), 'PPp')}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('organizer_name' as const, {
      header: 'Organizer',
      cell: (info) => (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {info.getValue()}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('participant_count' as const, {
      header: 'Participants',
      cell: (info) => (
        <div className="flex items-center text-gray-600 dark:text-gray-300">
          <Users className="h-4 w-4 mr-2 text-indigo-500" />
          {info.getValue()}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('task_count' as const, {
      header: 'Tasks',
      cell: (info) => (
        <div className="flex items-center text-gray-600 dark:text-gray-300">
          <FileText className="h-4 w-4 mr-2 text-indigo-500" />
          {info.getValue()}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const meeting = info.row.original;
        return (
          <div className="flex space-x-2">
            <button
              onClick={() => handleViewMeeting(meeting.id)}
              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
              title="View Meeting"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            {meeting.transcription_link && (
              <button
                onClick={() => handleDownloadTranscript(meeting)}
                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                title="Download Transcript"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      },
    }),
  ];

  // Define column widths
  const columnWidths = {
    'title': 'w-1/5 min-w-[180px]',
    'description': 'w-1/4 min-w-[200px]',
    'datetime': 'w-1/6 min-w-[160px]',
    'organizer_name': 'w-1/6 min-w-[140px]',
    'participant_count': 'w-[120px]',
    'task_count': 'w-[100px]',
    'actions': 'w-[100px]'
  };

  // Simplified fetch function without useCallback to prevent infinite loops
  const fetchMeetings = async (
    page: number = 1,
    pageSize: number = 10,
    sortBy: string = 'datetime',
    sortOrder: string = 'desc',
    search: string = ''
  ) => {
    if (!companyId) return;

    setIsLoading(true);
    try {
      console.log('Fetching meetings with params:', { page, pageSize, sortBy, sortOrder, search });

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/meeting/company-meetings/${companyId}`,
        {
          page: Number(page),
          pageSize: Number(pageSize),
          sortBy,
          sortOrder,
          search: search.trim()
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setMeetings(response.data.meetings);
        setPaginationInfo(response.data.pagination);

        // Update sorting state to match server response
        if (response.data.sorting) {
          // const newSorting: SortingState = [{
          //   id: response.data.sorting.sortBy,
          //   desc: response.data.sorting.sortOrder === 'desc'
          // }];
          // setSorting(newSorting);
        }
      } else {
        throw new Error(response.data.message || 'Failed to fetch meetings');
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setMeetings([]);
      setPaginationInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sorting changes - simplified without useCallback
  const handleSortingChange = (newSorting: SortingState) => {
    console.log('Sorting changed:', newSorting);

    setSorting(newSorting);

  };

  // Handle pagination changes - simplified without useCallback
  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    console.log('Pagination changed:', newPagination);

    const safePageIndex = Math.max(0, parseInt(String(newPagination.pageIndex)) || 0);
    const safePageSize = Math.max(1, parseInt(String(newPagination.pageSize)) || 10);

    const safePagination = {
      pageIndex: safePageIndex,
      pageSize: safePageSize
    };

    setPagination(safePagination);

    // Get current sort parameters
    const currentSort = sorting.length > 0 ? sorting[0] : { id: 'datetime', desc: true };

    fetchMeetings(
      safePageIndex + 1, // Convert to 1-based page number
      safePageSize,
      currentSort.id,
      currentSort.desc ? 'desc' : 'asc',
      globalFilter
    );
  };

  // Handle search with debouncing - no dependencies on fetchMeetings
  useEffect(() => {
    if (!companyId) return;

    const timeoutId = setTimeout(() => {
      console.log('Search triggered:', globalFilter);

      // Reset to first page when searching
      setPagination(prev => ({ ...prev, pageIndex: 0 }));

      const currentSort = currentSortingRef.current.length > 0
        ? currentSortingRef.current[0]
        : { id: 'datetime', desc: true };

      fetchMeetings(
        1, // Always start from page 1 when searching
        currentPaginationRef.current.pageSize,
        currentSort.id,
        currentSort.desc ? 'desc' : 'asc',
        globalFilter
      );
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [globalFilter, companyId]); // Only depend on globalFilter and companyId

  // Initial load - only depends on companyId
  useEffect(() => {
    if (companyId) {
      console.log('Initial load for company:', companyId);
      fetchMeetings(1, 10, 'datetime', 'desc', '');
    }
  }, [companyId]);

  const handleSearch = () => {
    console.log('Manual search triggered');
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
    const currentSort = sorting.length > 0 ? sorting[0] : { id: 'datetime', desc: true };

    fetchMeetings(
      1,
      pagination.pageSize,
      currentSort.id,
      currentSort.desc ? 'desc' : 'asc',
      globalFilter
    );
  };

  // Handle mobile pagination
  const handleMobilePagination = (direction: 'prev' | 'next') => {
    if (!paginationInfo) return;

    let newPageIndex = pagination.pageIndex;

    if (direction === 'prev' && paginationInfo.hasPreviousPage) {
      newPageIndex = Math.max(0, pagination.pageIndex - 1);
    } else if (direction === 'next' && paginationInfo.hasNextPage) {
      newPageIndex = pagination.pageIndex + 1;
    }

    if (newPageIndex !== pagination.pageIndex) {
      handlePaginationChange({
        pageIndex: newPageIndex,
        pageSize: pagination.pageSize
      });
    }
  };

  useEffect(() => {
    fetchMeetings(
      1,
      pagination.pageSize,
      sorting.length > 0 ? sorting[0].id : 'datetime',
      sorting.length > 0 ? sorting[0].desc ? 'desc' : 'asc' : 'desc',
      globalFilter
    );
  }, [sorting]);
  
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header Section */}
      <div className="flex-none p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Activities
            </h1>
            {paginationInfo && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Showing {((paginationInfo.currentPage - 1) * paginationInfo.pageSize) + 1} to{" "}
                {Math.min(paginationInfo.currentPage * paginationInfo.pageSize, paginationInfo.totalCount)} of{" "}
                {paginationInfo.totalCount} activities
              </p>
            )}
          </div>
          <div className="flex w-full sm:w-96">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                placeholder="Search activities..."
                disabled={isLoading}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 
                  border border-gray-300 dark:border-gray-600 rounded-l-md
                  text-sm text-gray-900 dark:text-white 
                  placeholder-gray-500 
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
                  transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium
                rounded-r-md hover:bg-indigo-700 
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 
                transition-colors duration-200
                flex items-center justify-center
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content with Scroll */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="p-6 space-y-4">
            {/* Desktop view */}
            <div className="hidden md:block overflow-x-auto">
              <EnhancedDataTable
                columns={columns}
                data={meetings}
                pageSize={pagination.pageSize}
                showPagination={true}
                manualPagination={true}
                manualSorting={true}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                isLoading={isLoading}
                totalCount={paginationInfo?.totalCount || 0}
                columnWidths={columnWidths}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                pageCount={paginationInfo?.totalPages || 0}
              />
            </div>

            {/* Mobile view */}
            <div className="md:hidden space-y-4">
              {isLoading ? (
                Array.from({ length: Math.min(pagination.pageSize, 5) }, (_, index) => (
                  <div key={`mobile-loading-${index}`} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
                    <div className="animate-pulse">
                      <div className="flex justify-between items-start mb-2">
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                      </div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="flex justify-between items-center">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                        <div className="flex space-x-2">
                          <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : meetings.length > 0 ? (
                meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="bg-white dark:bg-gray-800 shadow rounded-lg p-4"
                  >
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {meeting.title}
                        </h3>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewMeeting(meeting.id)}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                          >
                            <ExternalLink className="h-5 w-5" />
                          </button>
                          {meeting.transcription_link && (
                            <button
                              onClick={() => handleDownloadTranscript(meeting)}
                              className="text-green-600 hover:text-green-900 dark:text-green-400"
                            >
                              <Download className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {meeting.description || 'No description'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Organized by: {meeting.organizer_name}
                      </div>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="h-4 w-4 mr-1" />
                        {format(new Date(meeting.datetime), 'PPp')}
                      </div>
                      <div className="flex items-center justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {meeting.participant_count} participants
                          </div>
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-1" />
                            {meeting.task_count} tasks
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 dark:text-gray-400">
                    {globalFilter ? 'No activities found matching your search.' : 'No activities found.'}
                  </div>
                </div>
              )}

              {/* Mobile Pagination */}
              {!isLoading && paginationInfo && paginationInfo.totalCount > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    Showing {((paginationInfo.currentPage - 1) * paginationInfo.pageSize) + 1} to{" "}
                    {Math.min(paginationInfo.currentPage * paginationInfo.pageSize, paginationInfo.totalCount)} of{" "}
                    {paginationInfo.totalCount} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                      onClick={() => handleMobilePagination('prev')}
                      disabled={!paginationInfo.hasPreviousPage || isLoading}
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Page {paginationInfo.currentPage} of {paginationInfo.totalPages}
                    </span>
                    <button
                      className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                      onClick={() => handleMobilePagination('next')}
                      disabled={!paginationInfo.hasNextPage || isLoading}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Meetings;
