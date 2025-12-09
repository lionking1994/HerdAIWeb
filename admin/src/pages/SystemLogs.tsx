import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Logs } from '../types';

interface ExtendedLog extends Logs {
  isEditing?: boolean;
}

const SystemLogs = () => {
  const [logs, setLogs] = useState<ExtendedLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0);
  const [globalFilter, setGlobalFilter] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  });
  const [toDate, setToDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  });
  const columnHelper = createColumnHelper<ExtendedLog>();
  const columns = [
    columnHelper.accessor('username', {
      header: 'Username',
      cell: (info) => (
        <div className="text-gray-600 dark:text-gray-300">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('method', {
      header: 'Method',
      cell: (info) => (
        <div className="text-gray-600 dark:text-gray-300">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('url', {
      header: 'URL',
      cell: (info) => (
        <div className="text-gray-600 dark:text-gray-300">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <div className="text-gray-600 dark:text-gray-300">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('message', {
      header: 'Message',
      cell: (info) => (
        <div className="text-gray-600 dark:text-gray-300">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('timestamp', {
      header: 'Time',
      cell: (info) => {
        const timestamp = info.getValue();
        const localTime = new Date(timestamp).toLocaleString();
        return (
          <div className="text-gray-600 dark:text-gray-300">
            {localTime}
          </div>
        );
      },
    })
  ];

  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    pageCount: Math.ceil(totalLogs / 10), // Use the same value as initialState.pagination.pageSize
    manualPagination: true,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/system-logs/all`, 
        {
          params: {
            page: table.getState().pagination.pageIndex + 1,
            per_page: table.getState().pagination.pageSize,
            filter: globalFilter,
            from_date: fromDate,
            to_date: toDate,
          },
          headers: { Authorization: `Bearer ${token}` }
        });
      setLogs(response.data.logs);
      setTotalLogs(response.data.pagination.totalItems);
    } catch (err) {
      console.error(err);
      setLogs([]);
      setTotalLogs(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [table.getState().pagination.pageIndex, table.getState().pagination.pageSize, fromDate, toDate]);




  // useEffect(() => {
  //   if (error) {
  //     toast.error(error, {
  //       position: "top-right",
  //       autoClose: 3000,
  //       hideProgressBar: false,
  //       closeOnClick: true,
  //       pauseOnHover: true,
  //       draggable: true,
  //     });
  //   }
  // }, [error]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header Section */}
      <div className="flex-none p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            System Logs
          </h1>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto sm:items-center">
            {/* Date filters */}
            <div className="flex gap-2">
              <div className="relative">
                <input
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 
                    border border-gray-300 dark:border-gray-600 rounded-md
                    text-sm text-gray-900 dark:text-white 
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
                    transition-colors duration-200"
                />
              </div>
              <span className="text-gray-500 dark:text-gray-400 self-center">to</span>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 
                    border border-gray-300 dark:border-gray-600 rounded-md
                    text-sm text-gray-900 dark:text-white 
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
                    transition-colors duration-200"
                />
              </div>
            </div>
            
            {/* Search Bar with Button */}
            <div className="flex w-full sm:w-96">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder="Search system logs..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 
                    border border-gray-300 dark:border-gray-600 rounded-l-md
                    text-sm text-gray-900 dark:text-white 
                    placeholder-gray-500 
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
                    transition-colors duration-200"
                />
              </div>
              <button
                onClick={() => fetchLogs()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium
                  rounded-r-md hover:bg-indigo-700 
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 
                  transition-colors duration-200
                  flex items-center justify-center"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Scroll */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="p-6 space-y-4">
            {/* Desktop view */}
            <div className="hidden md:block overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-sm rounded-lg">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    {table.getHeaderGroups().map(headerGroup => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                          <th
                            key={header.id}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {table.getRowModel().rows.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">{row.getValue('username')}</td>
                        <td className="px-6 py-4">{row.getValue('method')}</td>
                        <td className="px-6 py-4">{row.getValue('url')}</td>
                        <td className="px-6 py-4">{row.getValue('status')}</td>
                        <td className="px-6 py-4">{row.getValue('message')}</td>
                        <td className="px-6 py-4">{new Date(row.getValue('timestamp')).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Mobile view */}
            <div className="md:hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {table.getRowModel().rows.map(row => (
                    <div
                      key={row.id}
                      className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{row.getValue('username')}</div>
                        
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Method</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{row.getValue('method')}</div>
                        
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">URL</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100 break-all">{row.getValue('url')}</div>
                        
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{row.getValue('status')}</div>
                        
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Message</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{row.getValue('message')}</div>
                        
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Time</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {new Date(row.getValue('timestamp')).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage() || isLoading}
                      className="p-2 rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                    >
                      <ChevronFirst size={16} />
                    </button>
                    <button
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage() || isLoading}
                      className="p-2 rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage() || isLoading}
                      className="p-2 rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                      disabled={!table.getCanNextPage() || isLoading}
                      className="p-2 rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                    >
                      <ChevronLast size={16} />
                    </button>
                  </div>

                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Page{' '}
                    <span className="font-medium">{table.getState().pagination.pageIndex + 1}</span>
                    {' '}of{' '}
                    <span className="font-medium">{table.getPageCount()}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemLogs;
