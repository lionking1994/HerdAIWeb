import React, { useEffect, useState } from "react";
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

const EnhancedDataTable = ({
    columns,
    data,
    pageSize = 5,
    showPagination = true,
    manualPagination = false,
    pageCount,
    onPaginationChange,
    sorting: externalSorting,
    onSortingChange: externalOnSortingChange,
    manualSorting = false,
    isLoading = false,
    totalCount = 0,
}) => {
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: pageSize,
    });

    const [internalSorting, setInternalSorting] = useState([]);
    const sorting = externalSorting !== undefined ? externalSorting : internalSorting;
    const onSortingChange = externalOnSortingChange || setInternalSorting;

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
        onPaginationChange: (updatedPagination) => {
            setPagination(updatedPagination);
            if (onPaginationChange) {
                onPaginationChange(updatedPagination);
            }
        },
    });

    // Stream skeleton animation styles
    const streamSkeletonStyles = `
        .skeleton-stream {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: stream 1.5s infinite;
        }
        
        @keyframes stream {
            0% {
                background-position: 200% 0;
            }
            100% {
                background-position: -200% 0;
            }
        }
    `;

    // Inject styles
    useEffect(() => {
        const styleId = 'skeleton-stream-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = streamSkeletonStyles;
            document.head.appendChild(style);
        }
    }, []);

    // Define column widths to maintain consistent sizing
    const getColumnWidth = (headerId) => {
        // Map column IDs to consistent widths
        const columnWidths = {
            'title': 'w-1/4 min-w-[200px]',
            'organizer': 'w-1/6 min-w-[150px]',
            'dateTime': 'w-1/5 min-w-[180px]',
            'duration': 'w-1/8 min-w-[100px]',
            'platform': 'w-1/8 min-w-[100px]',
            'participantCount': 'w-1/8 min-w-[120px]',
            'summary': 'w-1/3 min-w-[200px]',
            'remove': 'w-[30px] min-w-[30px]', // ✅ narrower column

        };

        return columnWidths[headerId] || 'w-auto min-w-[100px]';
    };

    return (
        <div className="rounded-md border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className={`py-2 px-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 ${getColumnWidth(header.id)}`}
                                        onClick={header.column.getToggleSortingHandler()}
                                        style={{
                                            width: header.id === 'title' ? '25%' :
                                                header.id === 'organizer' ? '16.67%' :
                                                    header.id === 'dateTime' ? '20%' :
                                                        header.id === 'duration' ? '12.5%' :
                                                            header.id === 'platform' ? '12.5%' :
                                                                header.id === 'participantCount' ? '12.5%' :
                                                                    header.id === 'summary' ? '33.33%' : 'auto'
                                        }}
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
                                                    }[header.column.getIsSorted()] ?? " ⇅"}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            // Loading skeleton with consistent column widths
                            Array.from({ length: pageSize }, (_, index) => (
                                <tr key={`loading-${index}`}>
                                    {table.getHeaderGroups()[0]?.headers.map((header, colIndex) => {
                                        // Get skeleton width based on column type
                                        const getSkeletonWidth = (headerId, rowIndex) => {
                                            const patterns = {
                                                'title': ['w-4/5', 'w-3/4', 'w-5/6'],
                                                'organizer': ['w-2/3', 'w-3/4', 'w-1/2'],
                                                'dateTime': ['w-5/6', 'w-4/5', 'w-3/4'],
                                                'duration': ['w-1/2', 'w-2/3', 'w-3/4'],
                                                'platform': ['w-1/2', 'w-2/3', 'w-3/4'],
                                                'participantCount': ['w-1/3', 'w-1/2', 'w-2/3'],
                                                'summary': ['w-5/6', 'w-3/4', 'w-4/5'],
                                            };

                                            const patternArray = patterns[headerId] || ['w-2/3', 'w-3/4', 'w-1/2'];
                                            return patternArray[rowIndex % patternArray.length];
                                        };

                                        return (
                                            <td
                                                key={`loading-cell-${colIndex}`}
                                                className={`py-4 px-4 ${getColumnWidth(header.id)}`}
                                                style={{
                                                    width: header.id === 'title' ? '25%' :
                                                        header.id === 'organizer' ? '16.67%' :
                                                            header.id === 'dateTime' ? '20%' :
                                                                header.id === 'duration' ? '12.5%' :
                                                                    header.id === 'platform' ? '12.5%' :
                                                                        header.id === 'participantCount' ? '12.5%' :
                                                                            header.id === 'summary' ? '33.33%' : 'auto'
                                                }}
                                            >
                                                <div
                                                    className={`h-4 rounded skeleton-stream ${getSkeletonWidth(header.id, index)}`}
                                                    style={{
                                                        animationDelay: `${(colIndex * 0.1)}s`
                                                    }}
                                                ></div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row, index) => (
                                <tr
                                    key={row.id}
                                    className={`
                                        ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                        hover:bg-blue-50 transition-colors cursor-pointer
                                    `}
                                    onClick={() => row.original.onClick && row.original.onClick()}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className={`py-3 px-4 text-gray-700 ${getColumnWidth(cell.column.id)}`}
                                            style={{
                                                width: cell.column.id === 'title' ? '25%' :
                                                    cell.column.id === 'organizer' ? '16.67%' :
                                                        cell.column.id === 'dateTime' ? '20%' :
                                                            cell.column.id === 'duration' ? '12.5%' :
                                                                cell.column.id === 'platform' ? '12.5%' :
                                                                    cell.column.id === 'participantCount' ? '12.5%' :
                                                                        cell.column.id === 'summary' ? '33.33%' : 'auto'
                                            }}
                                        >
                                            <div className="truncate">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="h-24 text-center text-gray-500"
                                >
                                    No results.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showPagination && (
                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 flex-shrink-0">
                    <div className="flex-1 text-sm text-gray-700">
                        {isLoading ? (
                            <div className="h-4 rounded skeleton-stream w-48"></div>
                        ) : (
                            <>
                                Showing{" "}
                                <span className="font-medium">
                                    {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                                </span>{" "}
                                to{" "}
                                <span className="font-medium">
                                    {Math.min(
                                        (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                                        manualPagination ? totalCount : data.length
                                    )}
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
                        <span className="text-sm text-gray-700">
                            {isLoading ? (
                                <div className="h-4 rounded skeleton-stream w-20"></div>
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
                        <div className="flex items-center space-x-2 ml-4">
                            <span className="text-sm text-gray-700">Show</span>
                            <select
                                className="px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                value={table.getState().pagination.pageSize}
                                onChange={(e) => {
                                    table.setPageSize(Number(e.target.value));
                                }}
                                disabled={isLoading}
                            >
                                {[5, 10, 20, 30, 50, 100].map((pageSize) => (
                                    <option key={pageSize} value={pageSize}>
                                        {pageSize}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnhancedDataTable; 