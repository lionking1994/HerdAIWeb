import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Typography, Box } from "@mui/material";
import axios from "axios";
import { toast } from "react-toastify";
import { Maximize2, Minimize2, Loader2 } from "lucide-react";
import TaskForm from "./TaskForm/TaskForm";
import { useNavigate } from "react-router-dom";


const SimilarTasksModal = ({ isOpen, onClose, similarTasks, isLoading }) => {
  const navigate = useNavigate();
  if (!isOpen) return null;

  return (
    <div className="z-[705] modal-overlay " onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Similar Tasks</h2>
          <button
            onClick={onClose}
            className="close-button"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Finding similar tasks...</span>
            </div>
          ) : similarTasks.length > 0 ? (
            <div className="space-y-4">
              <p className="text-gray-600 mb-4">Found {similarTasks.length} similar tasks:</p>
              {similarTasks.map((task, index) => (
                <div onClick={() => navigate(`/task-details?id=${task.id}`)} key={task.id || index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <h3 className="font-semibold text-blue-500 mb-2 underline">{task.title}</h3>
                  <p className="text-gray-600 text-sm mb-3">{task.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {task.priority && (
                      <span className={`px-2 py-1 rounded-full text-white ${task.priority === 'High' ? 'bg-red-500' :
                        task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}>
                        {task.priority}
                      </span>
                    )}
                    {task.status && (
                      <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                        {task.status}
                      </span>
                    )}
                    {task.assigned_name && (
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                        Assigned to: {task.assigned_name}
                      </span>
                    )}
                  </div>
                  {task.meeting_title && (
                    <p className="text-xs text-gray-500 mt-2">From: {task.meeting_title}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              <i className="fas fa-search text-3xl mb-4"></i>
              <p>No similar tasks found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AddTaskwithoutMeeting = ({ isOpen, onClose, user }) => {

  const [similarTasks, setSimilarTasks] = useState([]);
  const [isFetchingSimilarTasks, setIsFetchingSimilarTasks] = useState(false);
  const [showSimilarTasksModal, setShowSimilarTasksModal] = useState(false);

  const handleAddTask = async (newTask) => {
    console.log("newTask", newTask);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/create`,
        {
          meetingId: null,
          assigned_email: user.name,
          ...newTask,
          assigned_id: user.id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Task added successfully");
      onClose();
    } catch (error) {
      toast.error(`Failed to create task`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      console.error("Error creating task:", error);
    }
  };

  const fetchSimilarTasks = async (title, description) => {
    if (!title.trim() && !description.trim()) {
      setSimilarTasks([]);
      return;
    }

    try {
      setIsFetchingSimilarTasks(true);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/search-similar`,
        {
          title: title.trim(),
          description: description.trim(),
          limit: 3,
          companyId: user?.company_id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setSimilarTasks(response.data.tasks || []);
      }
    } catch (error) {
      console.error("Error fetching similar tasks:", error);
      setSimilarTasks([]);
    } finally {
      setIsFetchingSimilarTasks(false);
    }
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
            className="fixed inset-0 bg-black/50 z-[700000]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl z-[700001] h-[650px] overflow-y-auto w-full max-w-md"
          >
            <div className="flex-1 overflow-auto w-full px-4">
              <Box sx={{ py: 4 }} className="h-full">
                <div className="flex justify-between items-center mb-6">
                  <Typography variant="h4" component="h1">
                    Add New Task
                  </Typography>

                  <div className="relative flex flex-column">
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                    >
                      <X className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                <TaskForm
                  onSimilarTaskRequested={(title, description, showModal = false) => {
                    if (showModal) {
                      setShowSimilarTasksModal(true);
                    } else {
                      fetchSimilarTasks(title, description);
                    }
                  }}
                  similarTasks={similarTasks}
                  isFetchingSimilarTasks={isFetchingSimilarTasks}
                  task={{
                    title: "",
                    description: "",
                    dueDate:
                      new Date().toISOString().split("T")[0] + "T00:00:00",
                    priority: "Medium",
                    status: "Pending",
                    assignee: user,
                  }}
                  onSave={handleAddTask}
                  onCancel={onClose}
                  renderAssigneeSelect={handleAddTask}
                  noMeeting={true}
                />
              </Box>
            </div>
          </motion.div>
          <SimilarTasksModal
          isOpen={showSimilarTasksModal}
          onClose={() => setShowSimilarTasksModal(false)}
          similarTasks={similarTasks}
          isLoading={isFetchingSimilarTasks}
        />
        </>
      )}
    </AnimatePresence>
  );
};

export default AddTaskwithoutMeeting;
