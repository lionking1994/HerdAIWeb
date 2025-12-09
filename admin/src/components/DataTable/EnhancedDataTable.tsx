import React, { useEffect, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface ColumnWidthConfig {
  [key: string]: string;
}

interface EnhancedDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageSize?: number;
  showPagination?: boolean;
  manualPagination?: boolean;
  pageCount?: number;
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  manualSorting?: boolean;
  isLoading?: boolean;
  totalCount?: number;
  columnWidths?: ColumnWidthConfig;
   pagination?: { pageIndex: number; pageSize: number };
}

export function EnhancedDataTable<TData, TValue>({
  columns,
  data,
  pageSize = 30,
  showPagination = true,
  manualPagination = false,
  pageCount,
  onPaginationChange,
  sorting: externalSorting,
  onSortingChange: externalOnSortingChange,
  manualSorting = false,
  isLoading = false,
  totalCount = 0,
  columnWidths,
  pagination: externalPagination,
}: EnhancedDataTableProps<TData, TValue>) {
  const [internalPagination, setInternalPagination] = useState({
    pageIndex: 0,
    pageSize: pageSize,
  });
  
  // Use external pagination if provided, otherwise use internal
  const pagination = externalPagination !== undefined ? externalPagination : internalPagination;

  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const sorting = externalSorting !== undefined ? externalSorting : internalSorting;
  const onSortingChange = externalOnSortingChange || ((updater: any) => {
    const newSorting = typeof updater === 'function' ? updater(internalSorting) : updater;
    setInternalSorting(newSorting);
  });

  // Sync internal pagination when external pagination changes
  useEffect(() => {
    if (externalPagination !== undefined) {
      setInternalPagination(externalPagination);
    }
  }, [externalPagination]);

  useEffect(() => {
    console.log(sorting);
  }, [sorting]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange,
    state: {
      sorting,
      pagination,
    },
    manualPagination,
    manualSorting,
    pageCount: pageCount,
    getPaginationRowModel: getPaginationRowModel(),
    // onPaginationChange: (updatedPagination) => {
    //   setPagination(updatedPagination);
    //   if (onPaginationChange) {
    //     onPaginationChange(updatedPagination as { pageIndex: number; pageSize: number });
    //   }
    // },
    onPaginationChange: (updater) => {
  const updated = typeof updater === 'function'
    ? updater(pagination)
    : updater;

  console.log("Calling onPaginationChange with:", updated);
  
  // Only update internal state if we're not using external pagination
  if (externalPagination === undefined) {
    setInternalPagination(updated);
  }

  if (onPaginationChange) {
    onPaginationChange(updated);
  }
},
  });

  // Default width calculation with support for custom widths
  const getHeaderWidth = (headerId: string) => {
    if (columnWidths && columnWidths[headerId]) {
      return columnWidths[headerId];
    }

    // Default fallback widths
    if (headerId.includes('name')) return 'w-1/4 min-w-[200px]';
    if (headerId.includes('email')) return 'w-1/6 min-w-[250px]';
    if (headerId.includes('role')) return 'w-1/6 min-w-[150px]';
    if (headerId.includes('status')) return 'w-1/6 min-w-[120px]';
    if (headerId.includes('actions')) return 'w-1/4 min-w-[300px]';
    if (headerId.includes('subject')) return 'w-1/3 min-w-[200px]';
    if (headerId.includes('body')) return 'w-1/4 min-w-[250px]';
    if (headerId.includes('received_at')) return 'w-1/5 min-w-[150px]';
    if (headerId.includes('sender')) return 'w-1/3 min-w-[120px]';
    return 'w-auto min-w-[100px]';
  };

  return (
    <div className="rounded-md border border-gray-200 flex flex-col h-full">
      <div className="overflow-x-auto flex-1">
        <Table className="w-full" style={{ tableLayout: 'fixed' }}>
          <TableHeader className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b border-gray-200">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead 
                      key={header.id}
                      className={`py-3 px-4 text-left font-medium text-gray-700 ${getHeaderWidth(header.id)}`}
                      style={{
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {header.column.getCanSort() && (
                          <span className="text-gray-400 flex-shrink-0">
                            {{
                              asc: " ↑",
                              desc: " ↓",
                            }[header.column.getIsSorted() as string] ?? " ⇅"}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Show loading rows while maintaining column widths
              Array.from({ length: pageSize }, (_, index) => (
                <TableRow key={`loading-${index}`} className="border-b border-gray-200">
                  {table.getHeaderGroups()[0]?.headers.map((header, colIndex) => {
                    // Vary skeleton width for more realistic loading
                    const getSkeletonWidth = (headerId: string, index: number) => {
                      const baseWidths = ['w-3/4', 'w-2/3', 'w-4/5', 'w-1/2'];
                      if (headerId.includes('status') || headerId.includes('enabled')) return 'w-16'; // Fixed width for status
                      return baseWidths[index % baseWidths.length];
                    };

                    return (
                      <TableCell
                        key={`loading-cell-${colIndex}`}
                        className={`py-4 px-4 ${getHeaderWidth(header.id)}`}
                      >
                        <div className="animate-pulse">
                          <div className={`h-4 bg-gray-200 rounded ${getSkeletonWidth(header.id, index)}`}></div>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`
                    border-b border-gray-200 
                    ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    hover:bg-blue-50 transition-colors
                  `}
                >
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <TableCell
                        key={cell.id}
                        className={`py-3 px-4 text-gray-700 ${getHeaderWidth(cell.column.id)}`}
                      >
                        <div className="truncate">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-gray-500"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex-1 text-sm text-gray-700">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
              </div>
            ) : (
              <>
                  Showing{" "}
                  <span className="font-medium">
                    {manualPagination
                      ? (table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1)
                      : (table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1)
                    }
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {manualPagination
                      ? Math.min(
                        (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                        totalCount
                      )
                      : Math.min(
                        (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                        data.length
                      )
                    }
                  </span>{" "}
                of <span className="font-medium">{manualPagination ? totalCount : data.length}</span> results
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            
            <button
              className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage() || isLoading}
            >
              Previous
            </button>
            <span className="text-sm text-gray-700 flex-none">
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
              ) : (
                <>
                  Page <span className="font-medium">{table.getState().pagination.pageIndex + 1}</span> of{" "}
                  <span className="font-medium">{table.getPageCount()}</span>
                </>
              )}
            </span>
            <button
              className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage() || isLoading}
            >
              Next
            </button>
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              value={table.getState().pagination.pageSize}
              // onChange={(e) => {
              //   table.setPageSize(Number(e.target.value));
              // }}
              // disabled={isLoading}

              onChange={(e) => {
                console.log("Dropdown changed");
  const newPageSize = Number(e.target.value);
  const newPagination = {
    pageIndex: 0, // Always reset to page 1 when page size changes
    pageSize: newPageSize,
  };

  table.setPageSize(newPageSize);
  table.setPageIndex(0); // Reset internal table page to 1
  console.log('onPaginationChange',onPaginationChange)

  if (onPaginationChange) {
      console.log("Calling onPaginationChange with:", newPagination);
      onPaginationChange(newPagination);
  }
  else if (externalPagination === undefined) {
    // fallback for uncontrolled mode   
    setInternalPagination(newPagination);
  }
}}
            >
              {[10, 20, 30, 50, 100].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  Show {pageSize}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

