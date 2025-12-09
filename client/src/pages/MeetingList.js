import React, { useState, useEffect, act } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { createColumnHelper } from "@tanstack/react-table";
import Navbar from "../components/Navbar";
import EnhancedDataTable from "../components/DataTable/EnhancedDataTable";
import axios from "axios";
import { loginSuccess, loginFailure } from "../store/slices/authSlice";
import Footer from "../components/Footer";
import { toast } from "react-toastify";
import ViewListToggle from "../components/ViewToggle/ViewListToggle";
import {
  Calendar,
  AlertTriangle,
  Users,
  Filter,
  BarChart2,
} from "lucide-react";

const MeetingList = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const tabParam = queryParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabParam || "total");
  const [searchQuery, setSearchQuery] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [filteredMeetings, setFilteredMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const [anyMeetingPlatformConnected, setAnyMeetingPlatformConnected] =
    useState(true);
  const [viewMode, setViewMode] = useState("list"); // 'list' or 'table'
  const [activeFilter, setActiveFilter] = useState("all");

  // Metrics state
  const [metrics, setMetrics] = useState({
    totalMeetingsToday: 0,
    meetingsWithoutTasks: 0,
    pastDueTasks: 0,
    poorAlignment: 0,
  });

  // Table state - Default sorting by date (most recent first)
  const [sorting, setSorting] = useState([{ id: "dateTime", desc: true }]);
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
    const styleId = "skeleton-stream-styles-mobile";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = streamSkeletonStyles;
      document.head.appendChild(style);
    }
  }, []);

  const handleRowClick = (meetingId) => {
    navigate(`/meeting-detail?id=${meetingId}`);
  };

  const truncateSummary = (summary) => {
    const maxLength = 50;
    return summary && summary.length > maxLength
      ? `${summary.substring(0, maxLength)}...`
      : summary || "No summary available";
  };

  // Column definitions
  const columns = [
    columnHelper.accessor("title", {
      header: "Title",
      cell: (info) => (
        <div
          className="font-bold text-gray-800 cursor-pointer hover:text-blue-600"
          onClick={() => handleRowClick(info.row.original.id)}
        >
          {info.getValue()}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor("organizer", {
      header: "Organizer",
      cell: (info) => <div className="text-gray-600">{info.getValue()}</div>,
      enableSorting: true,
    }),
    columnHelper.accessor("dateTime", {
      header: "Date & Time",
      cell: (info) => (
        <div className="text-gray-600">
          {new Date(info.getValue()).toLocaleString()}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor("duration", {
      header: "Duration",
      cell: (info) => (
        <div className="text-gray-600">{info.getValue()} min</div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor("platform", {
      header: "Platform",
      cell: (info) => (
        <div className="text-gray-600 capitalize">{info.getValue()}</div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor("participantCount", {
      header: "Participants",
      cell: (info) => <div className="text-gray-600">{info.getValue()}</div>,
      enableSorting: true,
    }),
    columnHelper.accessor("summary", {
      header: "Summary",
      cell: (info) => (
        <div
          className="text-gray-600 max-w-xs truncate"
          title={info.getValue()}
        >
          {truncateSummary(info.getValue())}
        </div>
      ),
      enableSorting: false,
    }),
  ];

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const userData = await response.json();
        dispatch(loginSuccess(userData));
      } else if (response.status === 403) {
        localStorage.removeItem("token");
        navigate("/");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      dispatch(loginFailure(error.message));
    }
  };

  useEffect(() => {
    if (!user) {
      fetchUserData();
    }
  }, []);

  // Check for tab parameter in URL
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tabParam = queryParams.get("tab");

    if (tabParam && ["total", "own", "today"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location]);

  // Fetch meetings from your API with sorting parameters
  const fetchMeetings = async () => {
    const token = localStorage.getItem("token");
    setIsLoading(true);
    try {
      // Prepare sorting parameters for the backend
      const params = new URLSearchParams();

      // Always include sorting parameters (default or user-selected)
      if (sorting.length > 0) {
        params.append("sort_by", sorting[0].id);
        params.append("sort_order", sorting[0].desc ? "desc" : "asc");
      } else {
        // Fallback to default sorting if somehow sorting is empty
        params.append("sort_by", "dateTime");
        params.append("sort_order", "desc");
      }

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL
        }/meeting/meeting_all_list?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success && response.data.meetings) {
        setAnyMeetingPlatformConnected(
          response.data.anyMeetingPlatformConnected
        );
        const transformedMeetings = response.data.meetings.map((meeting) => ({
          id: meeting.id,
          title: meeting.title,
          organizer: meeting.organizer || "Unknown",
          dateTime: meeting.datetime,
          duration: meeting.duration,
          platform: meeting.platform,
          participantCount: meeting.participant_count || 0,
          summary: meeting.summary || "No summary available",
          hasTasks: meeting.tasks_count, // Placeholder - replace with actual data when available
          completed_tasks_count: meeting.completed_tasks_count,
          due_past_tasks_count: meeting.due_past_tasks_count,
          alignmentScore: meeting.strategy_score, // Placeholder - replace with actual data when available
          onClick: () => handleRowClick(meeting.id),
          agendaScore: meeting.agenda_score || 0,
          agendaReason: meeting.agenda_reason || "No agenda available",
        }));

        setMeetings(transformedMeetings);

        // Calculate metrics
        calculateMetrics(transformedMeetings);
      }
    } catch (error) {
      toast.error("Failed to fetch meetings");
      console.error("Error fetching meetings:", error);
      setMeetings([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate metrics for KPI cards
  const calculateMetrics = (meetingsList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total meetings today
    const totalMeetingsTodayList = meetingsList.filter((meeting) => {
      const meetingDate = new Date(meeting.dateTime);
      return meetingDate >= today && meetingDate < tomorrow;
    });
    const totalMeetingsToday = totalMeetingsTodayList.length;

    // Meetings without tasks
    const meetingsWithoutTasksList = meetingsList.filter(
      (meeting) => meeting.hasTasks == "0"
    );
    const meetingsWithoutTasks = meetingsWithoutTasksList.length;

    // Past due tasks - placeholder for now
    const meetingpastduetaskList = meetingsList.filter((meeting) => meeting.due_past_tasks_count != "0");
    const pastDueTasks = meetingpastduetaskList.length; // Replace with actual data when available

    // Poor alignment (60% or below)
    const poorAlignmentList = meetingsList.filter(
      (meeting) => meeting.alignmentScore <= 60
    );
    const poorAlignment = poorAlignmentList.length;

    const poorAgendaList = meetingsList.filter(
      (meeting) => meeting.agendaScore !== null && meeting.agendaScore < 30
    );
    const poorAgenda = poorAgendaList.length;


    setMetrics({
      totalMeetingsToday,
      meetingsWithoutTasks,
      pastDueTasks,
      poorAlignment,
      poorAgenda
    });
  };

  // Filter meetings based on activeTab and searchQuery
  useEffect(() => {
    let filtered = meetings;
    const now = new Date();
    // Apply tab filter
    if (activeTab === "own" && user) {
      filtered = meetings.filter((meeting) => meeting.organizer === user.name);
    } else if (activeTab === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      filtered = meetings.filter((meeting) => {
        const meetingDate = new Date(meeting.dateTime);
        return meetingDate >= today && meetingDate < tomorrow;
      });
    }

    // Apply active filter (KPI filter)
    if (activeFilter !== "all") {
      switch (activeFilter) {
        case "today":
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          filtered = filtered.filter((meeting) => {
            const meetingDate = new Date(meeting.dateTime);
            return meetingDate >= today && meetingDate < tomorrow;
          });
          break;
        case "no-tasks":
          filtered = meetings.filter((meeting) => meeting.hasTasks == "0");
          break;
        case "past-due":
          // This is a placeholder - replace with actual logic when available
          filtered = meetings.filter((meeting) => meeting.due_past_tasks_count != "0");
          break;
        case "poor-alignment":
          filtered = meetings.filter((meeting) => meeting.alignmentScore <= 60);
          break;
        case "this-week":
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 7);
          filtered = filtered.filter((meeting) => {
            const meetingDate = new Date(meeting.dateTime);
            return meetingDate >= startOfWeek && meetingDate < endOfWeek;
          });
          break;
        case "this-month":
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          filtered = filtered.filter((meeting) => {
            const meetingDate = new Date(meeting.dateTime);
            return meetingDate >= startOfMonth && meetingDate < endOfMonth;
          });
          break;
        case "this-qtr":
          const currentMonth = now.getMonth(); // 0-indexed
          const quarterStartMonth = currentMonth - (currentMonth % 3);
          const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1);
          const endOfQuarter = new Date(now.getFullYear(), quarterStartMonth + 3, 1);
          filtered = filtered.filter((meeting) => {
            const meetingDate = new Date(meeting.dateTime);
            return meetingDate >= startOfQuarter && meetingDate < endOfQuarter;
          });
          break;
        case "poor-agenda":
          filtered = meetings.filter((meeting) => meeting.agendaScore !== null && meeting.agendaScore < 30);

        default:
          break;
      }
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (meeting) =>
          meeting.title?.toLowerCase().includes(searchQuery?.toLowerCase()) ||
          meeting.organizer
            ?.toLowerCase()
            .includes(searchQuery?.toLowerCase()) ||
          meeting.summary?.toLowerCase().includes(searchQuery?.toLowerCase()) ||
          meeting.duration?.toString().includes(searchQuery) ||
          meeting.platform?.toLowerCase().includes(searchQuery?.toLowerCase())
      );
    }

    setFilteredMeetings(filtered);
  }, [meetings, activeTab, searchQuery, user, activeFilter]);

  // Fetch data when component mounts or sorting changes
  useEffect(() => {
    if (user) {
      fetchMeetings();
    }
  }, [user, sorting]);

  // Handle pagination changes
  const handlePaginationChange = (newPagination) => {
    setPagination(newPagination);
  };

  // Handle sorting changes
  const handleSortingChange = (newSorting) => {
    setSorting(newSorting);
  };

  // Handle filter button click
  const handleFilterClick = (filter) => {
    setActiveFilter(filter === activeFilter ? "all" : filter);
  };

  // Handle metric card click
  const handleKpiCardClick = (filterType) => {
    setActiveFilter(filterType);
  };

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  // Handle search
  const handleSearch = () => {
    // Search is handled by the filtering effect above
  };

  return (
    <>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Navbar isAuthenticated={true} user={user} />
        <div className="flex-grow container mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">

            {/* KPI Cards */}
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <div className="w-[250px]">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer' ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => handleKpiCardClick('all')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-6 w-6 text-blue-600" />
                    </div>

                    <div className="ml-3">
                      <p className="text-sm font-medium font-bold text-gray-900">
                        All Activites
                      </p>
                      <p className="text-xl font-bold text-gray-800">
                        {meetings.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>


              {/* <div 
                className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${activeFilter === 'today' ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => handleKpiCardClick('today')}
              >
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">
                      Today's Meetings
                    </p>
                    <p className="text-xl font-bold text-gray-800">
                      {metrics.totalMeetingsToday}
                    </p>
                  </div>
                </div>
              </div> */}

              <div className="w-[250px]">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${activeFilter === 'no-tasks' ? 'ring-2 ring-amber-500' : ''}`}
                  onClick={() => handleKpiCardClick('no-tasks')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertTriangle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium font-bold text-gray-900">
                        {/* Meetings Without Tasks */}
                        Without Tasks
                      </p>
                      <p className="text-xl font-bold text-gray-800">
                        {metrics.meetingsWithoutTasks}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-[250px]">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${activeFilter === 'past-due' ? 'ring-2 ring-red-500' : ''}`}
                  onClick={() => handleKpiCardClick('past-due')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium font-bold text-gray-900">
                        {/* Past Due Tasks */}
                        Has Past Due Tasks
                      </p>
                      <p className="text-xl font-bold text-gray-800">
                        {metrics.pastDueTasks}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-[250px]">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${activeFilter === 'poor-alignment' ? 'ring-2 ring-purple-500' : ''}`}
                  onClick={() => handleKpiCardClick('poor-alignment')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <BarChart2 className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium font-bold text-gray-900">
                        {/* Poor Alignment */}
                        Poor Alignment Score
                      </p>
                      <p className="text-xl font-bold text-gray-800">
                        {metrics.poorAlignment}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-[250px]">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${activeFilter === 'agenda-score' ? 'ring-2 ring-purple-500' : ''}`}
                  onClick={() => handleKpiCardClick('agenda-score')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <BarChart2 className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium font-bold text-gray-900">
                        Poor Agenda
                      </p>
                      <p className="text-xl font-bold text-gray-800">
                        {metrics.poorAgenda}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Bar - Centered */}
            <div className="flex justify-center mb-6">
              <div className="relative w-full max-w-md">
                <input
                  type="text"
                  placeholder="Search meetings..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6">
              <div className="flex justify-center items-center gap-2 mb-4">
                <p className="text-sm font-medium font-bold text-gray-900 whitespace-nowrap mr-5 -ml-[60px]">Timing:</p>

                {/* {activeFilter !== "all" && (
                  <button
                    className="px-3 py-1.5 border rounded-lg text-sm font-medium cursor-pointer transition-all bg-red-100 border-red-200 text-red-600 hover:bg-red-200"
                    onClick={() => setActiveFilter("all")}
                  >
                    Clear Filter
                  </button>
                )} */}
                {/* <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium cursor-pointer transition-all ${
                    activeFilter === "all"
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => handleFilterClick("all")}
                >
                  All
                </button> */}
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium font-bold cursor-pointer transition-all ${activeFilter === "today"
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  onClick={() => handleFilterClick("today")}
                >
                  Today
                </button>
                {/* <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium cursor-pointer transition-all ${
                    activeFilter === "no-tasks"
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => handleFilterClick("no-tasks")}
                >
                  No Tasks
                </button> */}
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium font-bold cursor-pointer transition-all ${activeFilter === "this-week"
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  onClick={() => handleFilterClick("this-week")}
                >
                  This week
                </button>
                {/* <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium cursor-pointer transition-all ${
                    activeFilter === "past-due"
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => handleFilterClick("past-due")}
                >
                  Past Due
                </button> */}
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium font-bold cursor-pointer transition-all ${activeFilter === "this-month"
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  onClick={() => handleFilterClick("this-month")}
                >
                  This Month
                </button>
                {/* <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium cursor-pointer transition-all ${
                    activeFilter === "poor-alignment"
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => handleFilterClick("poor-alignment")}
                >
                  Poor Alignment
                </button> */}
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium font-bold cursor-pointer transition-all ${activeFilter === "this-qtr"
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  onClick={() => handleFilterClick("this-qtr")}
                >
                  This Qtr
                </button>

                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium font-bold cursor-pointer transition-all ${activeFilter === "all"
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  onClick={() => handleFilterClick("all")}
                >
                  All
                </button>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex justify-center mb-4">
              <ViewListToggle
                currentView={viewMode}
                onViewChange={handleViewModeChange}
              />
            </div>

            <div className="overflow-x-auto">
              {/* Desktop view - Enhanced DataTable */}
              <div
                className={`${viewMode === "table" ? "block" : "hidden"
                  } `}
              >
                <EnhancedDataTable
                  columns={columns}
                  data={filteredMeetings}
                  pageSize={pagination.pageSize}
                  showPagination={true}
                  manualPagination={false} // Client-side pagination since we're filtering locally
                  manualSorting={true} // Server-side sorting
                  onPaginationChange={handlePaginationChange}
                  sorting={sorting}
                  onSortingChange={handleSortingChange}
                  isLoading={isLoading}
                  totalCount={filteredMeetings.length}
                />
              </div>

              {/* List view - Card layout */}
              <div className={`${viewMode === "list" ? "block" : "hidden"}`}>
                <div className="bg-white rounded-lg shadow-md">
                  {isLoading ? (
                    // Loading skeleton with stream animation
                    Array.from({ length: pagination.pageSize }, (_, index) => (
                      <div
                        key={`mobile-loading-${index}`}
                        className="border-b border-gray-200 p-4 bg-white rounded-lg shadow-md mb-4"
                      >
                        <div className="space-y-3">
                          <div
                            className="h-6 rounded skeleton-stream"
                            style={{
                              width: `${75 + (index % 3) * 5}%`,
                              animationDelay: `${index * 0.1}s`,
                            }}
                          ></div>
                          <div
                            className="h-4 rounded skeleton-stream"
                            style={{
                              width: `${60 + (index % 4) * 8}%`,
                              animationDelay: `${index * 0.1 + 0.2}s`,
                            }}
                          ></div>
                          <div
                            className="h-4 rounded skeleton-stream"
                            style={{
                              width: `${50 + (index % 5) * 6}%`,
                              animationDelay: `${index * 0.1 + 0.4}s`,
                            }}
                          ></div>
                          <div className="flex justify-between items-center">
                            <div
                              className="h-4 rounded skeleton-stream"
                              style={{
                                width: "30%",
                                animationDelay: `${index * 0.1 + 0.6}s`,
                              }}
                            ></div>
                            <div
                              className="h-4 rounded skeleton-stream"
                              style={{
                                width: "25%",
                                animationDelay: `${index * 0.1 + 0.8}s`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      {filteredMeetings.slice(
                        pagination.pageIndex * pagination.pageSize,
                        (pagination.pageIndex + 1) * pagination.pageSize
                      ).length > 0 ? (
                        filteredMeetings
                          .slice(
                            pagination.pageIndex * pagination.pageSize,
                            (pagination.pageIndex + 1) * pagination.pageSize
                          )
                          .map((meeting) => (
                            <div
                              key={meeting.id}
                              className="border-b border-gray-200 p-4 bg-white rounded-lg shadow-md mb-4"
                            >
                              <div className="flex justify-between items-start">
                                <h3
                                  className="font-bold text-gray-900 text-lg cursor-pointer hover:text-blue-600"
                                  onClick={() => handleRowClick(meeting.id)}
                                >
                                  {meeting.title}
                                </h3>
                                <span className="text-l text-gray-500 ">
                                  {meeting.alignmentScore || 0}%
                                </span>
                              </div>
                              <p className="text-gray-600 mt-1">
                                {truncateSummary(meeting.summary)}
                              </p>
                              <div className="flex justify-between items-center mt-2">
                                <div className="text-sm text-gray-600">
                                  <span>
                                    {new Date(
                                      meeting.dateTime
                                    ).toLocaleString()}
                                  </span>
                                  <span className="mx-2">•</span>
                                  <span>
                                    {meeting.participantCount} attendees
                                  </span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                                <div className="text-sm text-gray-600">
                                  <span>
                                    {meeting.hasTasks - meeting.completed_tasks_count || 0} open tasks
                                  </span>
                                  <span className="mx-2">•</span>
                                  <span>
                                    {meeting.completed_tasks_count || 0} completed
                                    tasks
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleRowClick(meeting.id)}
                                  className="bg-blue-500 text-white rounded-lg py-1 px-3 text-sm hover:bg-blue-600 transition duration-200"
                                >
                                  Details
                                </button>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          No meetings found for this filter
                        </div>
                      )}

                      {/* Pagination */}
                      {filteredMeetings.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg shadow mt-4">
                          <div className="flex-1 text-sm text-gray-700">
                            Showing{" "}
                            {pagination.pageIndex * pagination.pageSize + 1} to{" "}
                            {Math.min(
                              (pagination.pageIndex + 1) * pagination.pageSize,
                              filteredMeetings.length
                            )}{" "}
                            of {filteredMeetings.length} results
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() =>
                                handlePaginationChange({
                                  ...pagination,
                                  pageIndex: pagination.pageIndex - 1,
                                })
                              }
                              disabled={pagination.pageIndex === 0 || isLoading}
                            >
                              Previous
                            </button>
                            <span className="text-sm text-gray-700">
                              Page {pagination.pageIndex + 1} of{" "}
                              {Math.ceil(
                                filteredMeetings.length /
                                pagination.pageSize
                              )}
                            </span>
                            <button
                              className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() =>
                                handlePaginationChange({
                                  ...pagination,
                                  pageIndex: pagination.pageIndex + 1,
                                })
                              }
                              disabled={
                                pagination.pageIndex >=
                                Math.ceil(
                                  filteredMeetings.length /
                                  pagination.pageSize
                                ) -
                                1 || isLoading
                              }
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
        </div>
        <Footer />
      </div>
    </>
  );
};

export default MeetingList;
