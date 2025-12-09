import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import './TaskList.css';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from "date-fns";
import Footer from '../components/Footer';
import KanbanView from '../components/KanbanView/KanbanView';
import ViewToggle from '../components/ViewToggle/ViewToggle';
import { createColumnHelper } from '@tanstack/react-table';
import EnhancedDataTable from '../components/DataTable/EnhancedDataTable';

function TaskDetails() {
    const [user, setUser] = useState(null);
    const [filteredTasks, setFilteredTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [myTaskDetails, setMyTaskDetails] = useState([]);
    const [taskTitleFilter, setTaskTitleFilter] = useState('');
    const [searchParams] = useSearchParams();
    const status = searchParams.get("status");
    const [statusFilter, setStatusFilter] = useState(status);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'kanban'
    const navigate = useNavigate();

    // Table state - Default sorting by due date (most recent first)
    const [sorting, setSorting] = useState([{ id: 'duedate', desc: true }]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

    const columnHelper = createColumnHelper();

    // Add stream skeleton styles
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
        const styleId = 'skeleton-stream-styles-tasks';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = streamSkeletonStyles;
            document.head.appendChild(style);
        }
    }, []);

    useEffect(() => {
        fetchUserData();
        fetchMyTaskDetails();
    }, []);

    const fetchUserData = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMyTaskDetails = async () => {
        setIsLoading(true);
        try {
            // Prepare sorting parameters for the backend
            const params = new URLSearchParams();

            // Always include sorting parameters (default or user-selected)
            if (sorting.length > 0) {
                params.append('sort_by', sorting[0].id);
                params.append('sort_order', sorting[0].desc ? 'desc' : 'asc');
            } else {
                // Fallback to default sorting if somehow sorting is empty
                params.append('sort_by', 'duedate');
                params.append('sort_order', 'desc');
            }

            const result = await axios.post(`${process.env.REACT_APP_API_URL}/tasks/filtered-tasks?${params.toString()}`, {
                statusFilter: statusFilter,
                textFilter: taskTitleFilter,
            },
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );

            if (result && result.data) {
                if (result.data.tasks) {
                    // Transform tasks for the data table
                    const transformedTasks = result.data.tasks.map(task => ({
                        id: task.id,
                        title: task.title,
                        description: task.description,
                        duedate: task.duedate,
                        priority: task.priority || "Medium",
                        meeting_owner_name: task.meeting_owner_name || "Unassigned",
                        assignee_name: task.assignee_name || "Unassigned",
                        status: task.status || "Pending",
                        onClick: () => navigate("/task-details?id=" + task.id)
                    }));
                    setMyTaskDetails(transformedTasks);
                }
            } else {
                console.error('Invalid result:', result);
                setMyTaskDetails([]);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
            setMyTaskDetails([]);
        } finally {
            setIsLoading(false);
        }
    }

    const handleTaskItemClick = (meeting_id) => {
        navigate(`/meeting-detail?id=${meeting_id}&tab=tasks`);
    }

    useEffect(() => {
        console.log(myTaskDetails);
    }, [myTaskDetails])

    useEffect(() => {
        fetchMyTaskDetails();
    }, [statusFilter, taskTitleFilter, sorting])

    const handleViewChange = (view) => {
        setViewMode(view);
    };

    // Handle pagination changes
    const handlePaginationChange = (newPagination) => {
        setPagination(newPagination);
    };

    // Handle sorting changes
    const handleSortingChange = (newSorting) => {
        setSorting(newSorting);
    };

    // Column definitions for EnhancedDataTable
    const columns = [
        columnHelper.accessor('title', {
            header: 'Task Title',
            cell: (info) => (
                <div className="font-bold text-gray-800 cursor-pointer hover:text-blue-600">
                    {info.getValue()}
                </div>
            ),
            enableSorting: true,
        }),
        columnHelper.accessor('description', {
            header: 'Description',
            cell: (info) => (
                <div className="text-gray-600 max-w-xs truncate" title={info.getValue()}>
                    {info.getValue() || 'No description'}
                </div>
            ),
            enableSorting: false,
        }),
        columnHelper.accessor('duedate', {
            header: 'Due Date',
            cell: (info) => (
                <div className="text-gray-600">
                    {info.getValue() ? format(new Date(info.getValue()), 'MM/dd/yyyy') : "—"}
                </div>
            ),
            enableSorting: true,
        }),
        columnHelper.accessor('priority', {
            header: 'Priority',
            cell: (info) => (
                <span className={`priority-badge ${info.getValue()?.toLowerCase() || "medium"}`}>
                    {info.getValue() || "Medium"}
                </span>
            ),
            enableSorting: true,
        }),
        columnHelper.accessor('meeting_owner_name', {
            header: 'Owner',
            cell: (info) => (
                <div className="text-gray-600">
                    {info.getValue() || "Unassigned"}
                </div>
            ),
            enableSorting: true,
        }),
        columnHelper.accessor('assignee_name', {
            header: 'Assignee To',
            cell: (info) => (
                <div className="text-gray-600">
                    {info.getValue() || "Unassigned"}
                </div>
            ),
            enableSorting: true,
        }),
        columnHelper.accessor('status', {
            header: 'Status',
            cell: (info) => (
                <span className={`status-badge ${info.getValue()?.toLowerCase() || "pending"}`}>
                    {info.getValue() || "Pending"}
                </span>
            ),
            enableSorting: true,
        }),
    ];

    // Filter tasks based on search query
    useEffect(() => {
        let filtered = myTaskDetails;

        // Apply search filter if there's a search query
        if (taskTitleFilter) {
            filtered = myTaskDetails.filter(task =>
                task.title?.toLowerCase().includes(taskTitleFilter?.toLowerCase()) ||
                task.description?.toLowerCase().includes(taskTitleFilter?.toLowerCase()) ||
                task.assignee_name?.toLowerCase().includes(taskTitleFilter?.toLowerCase()) ||
                task.meeting_owner_name?.toLowerCase().includes(taskTitleFilter?.toLowerCase()) ||
                task.status?.toLowerCase().includes(taskTitleFilter?.toLowerCase()) ||
                task.priority?.toLowerCase().includes(taskTitleFilter?.toLowerCase())
            );
        }

        setFilteredTasks(filtered);
    }, [myTaskDetails, taskTitleFilter]);

    if (isLoading && !myTaskDetails.length) {
        return <div className="loading">Loading...</div>;
    }

    const findParticipantFromId = (id) => {
        console.log(myTaskDetails)
        return myTaskDetails.participants?.find(participant => participant.id === id) ? myTaskDetails.participants.find(participant => participant.id === id).name : 'Unassigned';
    }

    const checkStatusFilter = (status) => {
        if (statusFilter === 'AllOpen') {
            if (status === 'Pending' || status === 'Assigned' || status === 'In Progress' || status === 'Ready For Review')
                return true;
            else return false;
        } else if (statusFilter === 'AllClose') {
            if (status === 'Completed' || status === 'Rated')
                return true;
            else return false;
        } else {
            return true;
        }
    }

    return (
        <div className="page-container flex flex-col h-screen">
            <Navbar isAuthenticated={true} user={user} />
            <div className="task-list-container overflow-auto flex-1">
                <header className="task-list-header">
                    <h1>
                        My Task
                    </h1>
                </header>

                <div className="filter-options flex flex-col md:flex-row-reverse md:items-center md:space-x-4 gap-4 mt-2">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={taskTitleFilter}
                            onChange={(e) => setTaskTitleFilter(e.target.value)}
                            disabled={isLoading}
                            className="filter-input modern-input border border-gray-300 rounded-lg p-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="absolute left-3 top-2 text-gray-500">🔍</span>
                    </div>
                    <select
                        defaultValue={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        disabled={isLoading}
                        className="filter-select modern-select border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        <option value="">All Statuses</option>
                        <option value="AllOpen">All Open</option>
                        <option value="AllClose">All Closed</option>
                        <option value="Review">Ready For Review</option>
                        <option value="AssignedOpen">Assigned & Open</option>
                        <option value="AssignedClose">Assigned & Close</option>
                    </select>
                </div>

                <div className="view-toggle-container flex justify-center md:justify-start mt-2">
                    <ViewToggle currentView={viewMode} onViewChange={handleViewChange} />
                </div>

                {viewMode === 'kanban' ? (
                    <KanbanView tasks={myTaskDetails} onTaskUpdate={fetchMyTaskDetails} />
                ) : (
                        <section>
                        <div className="tasks-wrapper">
                            <div className="overflow-x-auto">
                                    {/* Desktop view - Enhanced DataTable */}
                                    <div className="hidden md:block">
                                        <EnhancedDataTable
                                            columns={columns}
                                            data={filteredTasks}
                                            pageSize={pagination.pageSize}
                                            showPagination={true}
                                            manualPagination={false} // Client-side pagination since we're filtering locally
                                            manualSorting={true} // Server-side sorting
                                            onPaginationChange={handlePaginationChange}
                                            sorting={sorting}
                                            onSortingChange={handleSortingChange}
                                            isLoading={isLoading}
                                            totalCount={filteredTasks.length}
                                        />
                                    </div>

                                    {/* Mobile view - Keep existing card layout with loading */}
                                    <div className="md:hidden">
                                        <div className="bg-white rounded-lg shadow-md">
                                            {isLoading ? (
                                                // Mobile loading skeleton with stream animation
                                                Array.from({ length: pagination.pageSize }, (_, index) => (
                                                    <div key={`mobile-loading-${index}`} className="border-b border-gray-200 p-4 bg-white rounded-lg shadow-md mb-4">
                                                        <div className="space-y-3">
                                                            <div
                                                                className="h-6 rounded skeleton-stream"
                                                                style={{
                                                                    width: `${75 + (index % 3) * 5}%`,
                                                                    animationDelay: `${index * 0.1}s`
                                                                }}
                                                            ></div>
                                                            <div
                                                                className="h-4 rounded skeleton-stream"
                                                                style={{
                                                                    width: `${60 + (index % 4) * 8}%`,
                                                                    animationDelay: `${(index * 0.1) + 0.2}s`
                                                                }}
                                                            ></div>
                                                            <div
                                                                className="h-4 rounded skeleton-stream"
                                                                style={{
                                                                    width: `${50 + (index % 5) * 6}%`,
                                                                    animationDelay: `${(index * 0.1) + 0.4}s`
                                                                }}
                                                            ></div>
                                                            <div
                                                                className="h-4 rounded skeleton-stream"
                                                                style={{
                                                                    width: `${40 + (index % 3) * 10}%`,
                                                                    animationDelay: `${(index * 0.1) + 0.6}s`
                                                                }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <>
                                                    {filteredTasks
                                                        .slice(
                                                            pagination.pageIndex * pagination.pageSize,
                                                            (pagination.pageIndex + 1) * pagination.pageSize
                                                        )
                                                        .length > 0 ? (
                                                        filteredTasks
                                                            .slice(
                                                                pagination.pageIndex * pagination.pageSize,
                                                                (pagination.pageIndex + 1) * pagination.pageSize
                                                            )
                                                            .map((task) => (
                                                                <div key={task.id} className="border-b border-gray-200 p-4 flex flex-col bg-white rounded-lg shadow-md mb-4 modern-card">
                                                                    <h3 className="font-bold text-gray-800 text-lg">{task.title}</h3>
                                                                    <p className="text-gray-600">Description: <span className="font-semibold">{task.description}</span></p>
                                                                    <p className="text-gray-600">Due Date: <span className="font-semibold">{task.duedate ? format(new Date(task.duedate), 'MM/dd/yyyy') : "—"}</span></p>
                                                                    <p className="text-gray-600">Priority: <span className="font-semibold">{task.priority || "Medium"}</span></p>
                                                                    <p className="text-gray-600">Owner: <span className="font-semibold">{task.meeting_owner_name || "Unassigned"}</span></p>
                                                                    <p className="text-gray-600">Assignee To: <span className="font-semibold">{task.assignee_name || "Unassigned"}</span></p>
                                                                    <p className="text-gray-600">Status: <span className="font-semibold">{task.status || "Pending"}</span></p>
                                                                    <button
                                                                        onClick={() => navigate("/task-details?id=" + task.id)}
                                                                        disabled={isLoading}
                                                                        className="mt-2 bg-blue-500 text-white rounded-lg py-2 px-4 hover:bg-blue-600 transition duration-200 modern-button disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        View Details
                                                                    </button>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="p-4 text-center bg-white rounded-lg shadow-md mb-4 modern-card">
                                                                <p className="text-gray-600">No Assigned Tasks.</p>
                                                            </div>
                                                        )}

                                                        {/* Mobile Pagination */}
                                                        {filteredTasks.length > 0 && (
                                                            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg shadow mt-4">
                                                                <div className="flex-1 text-sm text-gray-700">
                                                                    Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
                                                                    {Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredTasks.length)} of{" "}
                                                                    {filteredTasks.length} results
                                                                </div>
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
                                                                        Page {pagination.pageIndex + 1} of{" "}
                                                                        {Math.ceil(filteredTasks.length / pagination.pageSize)}
                                                                    </span>
                                                                    <button
                                                                        className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        onClick={() => handlePaginationChange({
                                                                            ...pagination,
                                                                            pageIndex: pagination.pageIndex + 1
                                                                        })}
                                                                        disabled={pagination.pageIndex >= Math.ceil(filteredTasks.length / pagination.pageSize) - 1 || isLoading}
                                                                    >
                                                                        Next
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </div>
            <Footer />
        </div>
    );
}

export default TaskDetails;
