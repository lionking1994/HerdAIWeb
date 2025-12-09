import React, { useState } from 'react';
import { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface CrmPaginationTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageSize: number;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  totalCount: number;
  columnWidths?: { [key: string]: string };
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
  isLoading?: boolean;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export function CrmPaginationTable<TData, TValue>({
  columns,
  data,
  pageSize = 20,
  sorting = [],
  onSortingChange,
  totalCount,
  columnWidths = {},
  onPaginationChange,
  isLoading = false,
  currentPage = 1,
  onPageChange,
  onPageSizeChange,
}: CrmPaginationTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>(sorting);
  const [internalPageSize, setInternalPageSize] = useState(pageSize);

  // Calculate pagination values
  const totalPages = Math.ceil(totalCount / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  // Handle sorting changes
  const handleSortingChange = (newSorting: SortingState) => {
    if (onSortingChange) {
      onSortingChange(newSorting);
    } else {
      setInternalSorting(newSorting);
    }
  };

  // Handle page changes
  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    }
    
    if (onPaginationChange) {
      onPaginationChange({ pageIndex: page - 1, pageSize: internalPageSize });
    }
  };

  // Handle page size changes
  const handlePageSizeChange = (newPageSize: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newPageSize);
    } else {
      setInternalPageSize(newPageSize);
    }
    
    if (onPaginationChange) {
      onPaginationChange({ pageIndex: 0, pageSize: newPageSize });
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) {
          pages.push('...');
        }
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push('...');
        }
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  // Apply column widths
  const getColumnStyle = (columnId: string) => {
    const style: React.CSSProperties = {};
    if (columnWidths[columnId]) {
      style.width = columnWidths[columnId];
      style.maxWidth = columnWidths[columnId];
    }
    return style;
  };

  // Get current sorting state
  const currentSorting = onSortingChange ? sorting : internalSorting;

  // Handle column sort
  const handleColumnSort = (columnId: string) => {
    const currentSort = currentSorting.find(sort => sort.id === columnId);
    let newSorting: SortingState = [];

    if (currentSort) {
      if (currentSort.desc) {
        // Currently descending, remove sort
        newSorting = currentSorting.filter(sort => sort.id !== columnId);
      } else {
        // Currently ascending, change to descending
        newSorting = currentSorting.map(sort => 
          sort.id === columnId ? { ...sort, desc: true } : sort
        );
      }
    } else {
      // No current sort, add ascending sort
      newSorting = [{ id: columnId, desc: false }];
    }

    handleSortingChange(newSorting);
  };

  // Get sort direction for a column
  const getSortDirection = (columnId: string) => {
    const sort = currentSorting.find(sort => sort.id === columnId);
    return sort ? (sort.desc ? 'desc' : 'asc') : null;
  };

  // Sort icon component
  const SortIcon = ({ columnId }: { columnId: string }) => {
    const direction = getSortDirection(columnId);
    
    return (
      <span className="ml-2 inline-block">
        {direction === 'asc' ? (
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        ) : direction === 'desc' ? (
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-4" >
      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div 
          className="overflow-x-auto " 
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-gray-50">
              {columns.map((column, index) => (
                <TableHead
                  key={index}
                  style={getColumnStyle(column.id || '')}
                  className={`bg-gray-50 text-gray-900 font-semibold max-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${
                    column.id ? 'cursor-pointer hover:bg-gray-100 select-none' : ''
                  }`}
                  onClick={column.id ? () => handleColumnSort(column.id!) : undefined}
                >
                  <div className="flex items-center">
                    <span className="flex-1">
                      {typeof column.header === 'function' 
                        ? column.header({ column: column as any, header: column.header as any, table: {} as any })
                        : column.header
                      }
                    </span>
                    {column.id && <SortIcon columnId={column.id} />}
                  </div>
                </TableHead>
              ))}
            </TableHeader>
          </Table>
        </div>
        <div className="overflow-x-auto crm-table-scroll" style={{ 
          maxHeight: '350px', 
          overflowY: 'auto'
        } as React.CSSProperties & { '--scrollbar-thumb': string; '--scrollbar-track': string }}>
          <Table>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-gray-500">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-gray-50">
                    {columns.map((column, colIndex) => (
                      <TableCell
                        key={colIndex}
                        style={getColumnStyle(column.id || '')}
                        className="py-3 px-4 max-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                      >
                        {column.cell && typeof column.cell === 'function' ? 
                          column.cell({ 
                            getValue: () => (row as any)[column.id || ''],
                            row: { 
                              original: row, 
                              index: rowIndex,
                              getValue: () => (row as any)[column.id || '']
                            } as any,
                            column: column as any,
                            table: {} as any,
                            cell: {} as any,
                            renderValue: () => (row as any)[column.id || ''],
                          }) 
                          : (row as any)[column.id || '']
                        }
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Controls */}
      {(
        <div className="flex items-center justify-between bg-white px-4 py-3 border-t border-gray-200">
          {/* Results Info */}
          <div className="flex items-center text-sm text-gray-700">
            <span>
              Showing <span className="font-medium">{startItem}</span> to{' '}
              <span className="font-medium">{endItem}</span> of{' '}
              <span className="font-medium">{totalCount}</span> results
            </span>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center space-x-2">
            {/* Page Size Selector */}
            <div className="flex items-center space-x-2">
              <label htmlFor="pageSize" className="text-sm text-gray-700">
                Show:
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-700">per page</span>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center space-x-1">
              {/* Previous Button */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Page Numbers */}
              {getPageNumbers().map((page, index) => (
                <React.Fragment key={index}>
                  {page === '...' ? (
                    <span className="px-3 py-2 text-sm text-gray-500">...</span>
                  ) : (
                    <button
                      onClick={() => handlePageChange(page as number)}
                      disabled={isLoading}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        currentPage === page
                          ? 'text-white bg-blue-600 border border-blue-600'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {page}
                    </button>
                  )}
                </React.Fragment>
              ))}

              {/* Next Button */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CrmPaginationTable;
