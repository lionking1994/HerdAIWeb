import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Users, X, Phone, MapPin, NotebookPen, Loader2, FolderKanban, CheckSquare, Calendar, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import PerformanceCloudPopup from "./performanceCloudPopup";
import AddTaskwithoutMeeting from "./addTaskwithoutMeeting";

const UserProfileDrawer = ({ user, isOpen, onClose }) => {
  const navigate = useNavigate();

  const [openWorkView, setOpenWorkView] = useState(false);
  const [openAddTask, setOpenAddTask] = useState(false);
  const [summaryOpenTasks, setSummaryOpenTasks] = useState("");
  const [lastMeetings, setLastMeetings] = useState([]);
  const [isSummaryOpenTasksloading, setIsSummaryOpenTasksloading] =
    useState(true);
  const [isLastMeetingloading, setIsLastMeetingloading] = useState(true);
  const [showFull, setShowFull] = useState(false);
  
  // Assigned Projects State
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);

  const fetchSummaryOpenTasks = useCallback(async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/getSummaryOpenTasks`,
        { userId: user.id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.success) {
        // handle the summary
        console.log("Task Summary:", response.data.summary);
        setSummaryOpenTasks(response.data.summary);
      } else {
        console.error("Failed to fetch task summary");
      }

      setIsSummaryOpenTasksloading(false);
    } catch (error) {
      console.error("Error fetching task summary:", error);

      setIsSummaryOpenTasksloading(false);
    }
  }, [user]);

  const fetchLastMeetings = useCallback(async () => {
    if (!user) return;
    try {
      setIsLastMeetingloading(true);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/meeting/getLastThreeMeetings`,
        {
          assigned_id: user.id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.success) {
        setLastMeetings(response.data.lastMeetings);
      } else {
        console.log("Failed to fetch meetings");
      }
    } catch (err) {
      console.error("Error fetching meetings:", err);
      console.log("An error occurred");
    } finally {
      setIsLastMeetingloading(false);
    }
  }, [user]);

  // Fetch assigned projects
  const fetchAssignedProjects = useCallback(async () => {
    try {
      setIsProjectsLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/crm/dashboard/projects`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.success) {
        setAssignedProjects(response.data.data.projects || []);
      } else {
        console.error("Failed to fetch assigned projects");
        setAssignedProjects([]);
      }
    } catch (error) {
      console.error("Error fetching assigned projects:", error);
      setAssignedProjects([]);
    } finally {
      setIsProjectsLoading(false);
    }
  }, []);
  
  // Fetch data when drawer opens
  useEffect(() => {
    if (isOpen && user) {
      fetchSummaryOpenTasks();
      fetchLastMeetings();
      fetchAssignedProjects();
    }
  }, [isOpen, user, fetchSummaryOpenTasks, fetchLastMeetings, fetchAssignedProjects]);

  if (!user) return null;

  const handleRowClick = (meetingId) => {
    navigate(`/meeting-detail?id=${meetingId}`);
  };

  const handleProjectClick = (project) => {
    console.log("Project clicked:", project);
    // Navigate to User Story Workspace - using the first story ID
    if (project.first_story_id) {
      navigate(`/psa/story/${project.first_story_id}`);
    } else {
      // Fallback to project page if no story ID available
      navigate(`/psa/project/${project.project_id}`);
    }
  };

  const openView = () => {
    // setOpenWorkView(true);
    navigate(`/performance-cloud?id=${user.id}`);
  };
  const openTask = () => {
    setOpenAddTask(true);
  };
  const onCloseWorkView = () => {
    setOpenWorkView(false);
  };
  const onCloseAddTask = () => {
    setOpenAddTask(false);
  };
  const processTasks = (tasks) => {
    return tasks.split('\n').map((line, index) => {
      if (line.startsWith('- ')) {
        // You can add custom markup or classes here
        return (<p class="task-line">{line}</p>)
      }
      return line;
    })
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[500000]"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-[600001] overflow-y-auto"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  User Profile
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Profile Content */}
              <div className="space-y-6">
                {/* Avatar and Name */}
                <div className="flex items-center space-x-4">
                  <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {user.avatar ? (
                      <img
                        src={`${process.env.REACT_APP_API_URL}/avatars/${user.avatar}`}
                        alt={user.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-semibold text-gray-500">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {user.name}
                    </h3>
                    <a
                      href={`mailto:${user.email}`}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {user.email}
                    </a>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {user.phone && (
                    <div className="flex items-center text-sm">
                      <Phone className="h-5 w-5 text-gray-400 mr-3" />
                      <a
                        href={`tel:${user.phone}`}
                        className="text-gray-600 hover:text-blue-600"
                      >
                        {user.phone}
                      </a>
                    </div>
                  )}
                  {user.location && (
                    <div className="flex items-center text-sm">
                      <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                      <span className="text-gray-600">{user.location}</span>
                    </div>
                  )}
                  {/* {user.bio && (
                    <div className="flex items-start text-sm">
                      <NotebookPen className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                      <span className="text-gray-600">{user.bio}</span>
                    </div>
                  )} */}

                  {user.bio && (
                    <div className="flex items-start text-sm">
                      <NotebookPen className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                      <span className="text-gray-600">
                        {(() => {
                          const words = user.bio.trim().split(/\s+/);
                          const isLong = words.length > 100;
                          const displayed = isLong && !showFull
                            ? words.slice(0, 100).join(" ") + "..."
                            : user.bio;

                          return (
                            <>
                              {displayed}
                              {isLong && (
                                <button
                                  onClick={() => setShowFull(!showFull)}
                                  className="ml-2 text-blue-500 hover:underline"
                                >
                                  {showFull ? "less" : "more"}
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </span>
                    </div>
                  )}

                  {user.company_role_name && (
                    <div className="flex items-start text-sm">
                      <Users className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                      <span className="text-gray-600">
                        {user.company_role_name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="w-full text-center px-4  space-y-4">
                  <button
                    onClick={openView}
                    className=" w-full border-2 border-blue-400 px-4 py-2 text-center rounded-lg hover:border-blue-600 hover:border-3"
                  >
                    View My work
                  </button>
                  <button
                    onClick={openTask}
                    className=" w-full border-2 border-blue-400 px-4 py-2 text-center rounded-lg hover:border-blue-600 hover:border-3"
                  >
                    Add Task
                  </button>
                </div>              
               

                {summaryOpenTasks ? (
                  <div className="flex items-start text-sm bg-gray-50 rounded-lg p-4">
                    <span className="text-gray-600 text-left">
                      {/* <ReactMarkdown>{summaryOpenTasks}</ReactMarkdown> */}
                      {processTasks(summaryOpenTasks)}
                    </span>
                  </div>
                ) : isSummaryOpenTasksloading ? (
                  <>loading ...</>
                ) : (
                  <></>
                )}

                  {/* Assigned Projects Section */}
                   {isProjectsLoading ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <FolderKanban className="w-4 h-4 mr-2 text-purple-600" />
                      Assigned Projects
                    </h4>
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                      <span className="ml-2 text-sm text-gray-600">Loading projects...</span>
                    </div>
                  </div>
                ) : assignedProjects.length > 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <FolderKanban className="w-4 h-4 mr-2 text-purple-600" />
                      Assigned Projects
                    </h4>
                    <div className="space-y-3">
                      {assignedProjects.map((project) => (
                                <div
                                  key={project.project_id}
                                  className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer"
                                  onClick={() => handleProjectClick(project)}
                                >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <FolderKanban className="w-4 h-4 text-purple-600" />
                                <h5 className="font-medium text-gray-900 text-sm">
                                  {project.project_title}
                                </h5>
                              </div>
                              
                              <p className="text-gray-600 text-xs mb-2 line-clamp-2">
                                {project.description}
                              </p>

                              <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1">
                                  <CheckSquare className="w-3 h-3 text-green-600" />
                                  <span className="text-gray-700">
                                    {project.assigned_stories_count} Stories
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-orange-600" />
                                  <span className="text-gray-700">
                                    {project.active_stories_count || 0} Active
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="ml-2 flex-shrink-0">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleProjectClick(project);
                                        }}
                                        className="p-1 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors duration-200"
                                        title="View project details"
                                      >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {lastMeetings.length ? (
                  <div className="flex items-start text-sm bg-gray-50 rounded-lg p-4">
                    <span className="text-gray-600 text-left">
                      {lastMeetings?.map((meeting) => (
                        <div
                          key={meeting.id}
                          className="border-b border-gray-200 p-4 bg-white rounded-lg shadow-md mb-4"
                        >
                          <div className="flex justify-between items-start">
                            <h3
                              className="font-bold text-gray-800 text-lg cursor-pointer hover:text-blue-600"
                              onClick={() => handleRowClick(meeting.id)}
                            >
                              {meeting.title}
                            </h3>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <div className="text-sm text-gray-600">
                              <span>
                                {new Date(meeting.datetime).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => handleRowClick(meeting.id)}
                              className="bg-blue-500 text-white rounded-lg py-1 px-3 text-sm hover:bg-blue-600 transition duration-200"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      ))}
                    </span>
                  </div>
                ) : isLastMeetingloading ? (
                  <>loading ...</>
                ) : (
                  <></>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
      <PerformanceCloudPopup
        isOpen={openWorkView}
        onClose={onCloseWorkView}
        user={user}
      />
      <AddTaskwithoutMeeting
        isOpen={openAddTask}
        onClose={onCloseAddTask}
        user={user}
      />
    </AnimatePresence>
  );
};

export default UserProfileDrawer;
