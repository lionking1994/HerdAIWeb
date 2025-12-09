import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, Clock, Workflow, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import useHttp from '../hooks/useHttp';


const PriorityWork = () => {
  const [priorityTasks, setPriorityTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [helpers, setHelpers] = useState({}); // Store helpers for each task
  const [loadingHelpers, setLoadingHelpers] = useState({});
  const [schedulingTasks, setSchedulingTasks] = useState({});
  const [matchingWorkflows, setMatchingWorkflows] = useState({});
  const navigate = useNavigate();
  const { sendRequest } = useHttp();

  useEffect(() => {
    fetchPriorityWork();
  }, []);

  const fetchPriorityWork = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await sendRequest({
        url: `${process.env.REACT_APP_API_URL}/tasks/priority-work`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.success) {
        setPriorityTasks(response.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching priority work:', error);
      toast.error('Failed to load priority work tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleGetHelper = async (taskId) => {
    if (helpers[taskId]) {
      // Helper already fetched, open task and mention them
      handleConnectToTask(taskId, helpers[taskId]);
      return;
    }

    try {
      setLoadingHelpers((prev) => ({ ...prev, [taskId]: true }));
      const token = localStorage.getItem('token');
      const response = await sendRequest({
        url: `${process.env.REACT_APP_API_URL}/tasks/get-task-helper`,
        method: 'POST',
        body: { taskId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.success && response.helper) {
        setHelpers((prev) => ({ ...prev, [taskId]: response.helper }));
        handleConnectToTask(taskId, response.helper);
      } else {
        toast.info('No similar task history found to suggest a helper');
      }
    } catch (error) {
      console.error('Error fetching helper:', error);
      toast.error('Failed to find helper');
    } finally {
      setLoadingHelpers((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const handleConnectToTask = (taskId, helper) => {
    // Navigate to task details and mention the helper
    navigate(`/task-details?id=${taskId}&mention=${helper.assignee_id}&name=${encodeURIComponent(helper.assignee_name)}`);
  };

  const handleAutoSchedule = async (taskId) => {
    try {
      setSchedulingTasks((prev) => ({ ...prev, [taskId]: true }));
      const token = localStorage.getItem('token');
      const response = await sendRequest({
        url: `${process.env.REACT_APP_API_URL}/tasks/auto-schedule-task`,
        method: 'POST',
        body: { taskId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.success) {
        toast.success('Task scheduled on your calendar successfully!');
      } else {
        toast.error(response.message || 'Failed to schedule task');
      }
    } catch (error) {
      console.error('Error auto-scheduling task:', error);
      toast.error('Failed to schedule task on calendar');
    } finally {
      setSchedulingTasks((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const handleMatchWorkflow = async (taskId) => {
    if (matchingWorkflows[taskId]) {
      // Already matched, show workflows
      toast.info(`Found ${matchingWorkflows[taskId].length} matching workflow(s)`);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await sendRequest({
        url: `${process.env.REACT_APP_API_URL}/tasks/match-workflow-to-task`,
        method: 'POST',
        body: { taskId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.success && response.workflows && response.workflows.length > 0) {
        setMatchingWorkflows((prev) => ({ ...prev, [taskId]: response.workflows }));
        
        // Add comment to task thread about matched workflow
        const bestMatch = response.workflows[0];
        toast.success(`Matched workflow: ${bestMatch.name}. Adding to task comments...`);
        
        // TODO: Add workflow info to task comments thread
        // This would require calling the task thread API to add a comment
      } else {
        toast.info('No matching workflows found for this task');
      }
    } catch (error) {
      console.error('Error matching workflow:', error);
      toast.error('Failed to match workflow');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No Due Date';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  const isPastDue = (dueDate) => {
    if (!dueDate) return false;
    try {
      return new Date(dueDate) < new Date();
    } catch {
      return false;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Assigned': 'bg-blue-100 text-blue-800',
      'In Progress': 'bg-purple-100 text-purple-800',
      'Ready For Review': 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'High': 'bg-red-100 text-red-800',
      'Medium': 'bg-orange-100 text-orange-800',
      'Low': 'bg-gray-100 text-gray-800',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!priorityTasks || priorityTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center min-h-[200px]">
        <p className="text-gray-500">No priority work tasks found</p>
        <p className="text-sm text-gray-400 mt-2">
          Tasks created this week with high priority or high alignment score will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[150px]">
                Title
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[200px]">
                Description
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[100px]">
                Due Date
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[100px]">
                Status
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[70px]">
                Score
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[100px]">
                Due
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[100px]">
                Connect.
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[120px]">
                Auto Schedule
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[100px]">
                Workflow
              </th>
            </tr>
          </thead>
          <tbody>
            {priorityTasks.map((task) => (
              <motion.tr
                key={task.id}
                className="hover:bg-gray-50 transition-colors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <td className="border-b border-gray-100 px-3 py-2">
                  <button
                    onClick={() => navigate(`/task-details?id=${task.id}`)}
                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <LinkIcon className="w-3 h-3" />
                    {task.title || 'Untitled Task'}
                  </button>
                </td>
                <td className="border-b border-gray-100 px-3 py-2 text-gray-600 max-w-xs">
                  <div className="truncate" title={task.description}>
                    {task.description || 'No description'}
                  </div>
                </td>
                <td className="border-b border-gray-100 px-3 py-2">
                  {formatDate(task.duedate)}
                </td>
                <td className="border-b border-gray-100 px-3 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                </td>
                <td className="border-b border-gray-100 px-3 py-2">
                  {task.score ? (
                    <span className="font-semibold">{Math.round(task.score)}%</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="border-b border-gray-100 px-3 py-2">
                  {task.duedate && (
                    <span className={isPastDue(task.duedate) ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                      {isPastDue(task.duedate) ? 'Past Due' : formatDate(task.duedate)}
                    </span>
                  )}
                </td>
                <td className="border-b border-gray-100 px-3 py-2">
                  <button
                    onClick={() => handleGetHelper(task.id)}
                    disabled={loadingHelpers[task.id]}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-xs whitespace-nowrap"
                    title="This should be with the person that can help the most on this task - from all task history. When clicked, open task and @ mention the person for help"
                  >
                    <User className="w-3 h-3" />
                    {loadingHelpers[task.id] ? '...' : helpers[task.id] ? helpers[task.id].assignee_name : 'Connect'}
                  </button>
                </td>
                <td className="border-b border-gray-100 px-3 py-2">
                  <button
                    onClick={() => handleAutoSchedule(task.id)}
                    disabled={schedulingTasks[task.id]}
                    className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-xs whitespace-nowrap"
                    title="This will add a spot On your calendar to work this task, should link back to the task and use the estimated time to complete"
                  >
                    <Calendar className="w-3 h-3" />
                    {schedulingTasks[task.id] ? 'Scheduling...' : 'Auto Schedule'}
                  </button>
                </td>
                <td className="border-b border-gray-100 px-3 py-2">
                  <button
                    onClick={() => handleMatchWorkflow(task.id)}
                    className="px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center gap-1 text-xs whitespace-nowrap"
                    title="This will try and match a workflow to the task based on the title and description - add to comments thread once it is kicked off"
                  >
                    <Workflow className="w-3 h-3" />
                    Workflow
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PriorityWork;

