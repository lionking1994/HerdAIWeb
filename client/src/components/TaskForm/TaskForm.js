import { useState, useEffect, useCallback } from "react";
import "./TaskForm.css";


const TaskForm = ({ task, onSave, onCancel, renderAssigneeSelect, noMeeting , onSimilarTaskRequested, similarTasks = [], isFetchingSimilarTasks = false  }) => {

  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description,
    dueDate: new Date().toISOString().split('T')[0],
    priority: task.priority,
    assigned_id: task.assigned_id,
    status: 'Pending',
    average_time: task.average_time || 0, // <-- new
    estimated_hours: task.estimated_hours || 0, // <-- new
  });

  const [error, setError] = useState({});
  const [loading, setLoading] = useState(false);

  // Trigger search when title or description changes
  useEffect(() => {
    if (formData.title && formData.description) {
      console.log('formData.title', formData.title);
      console.log('formData.description', formData.description);
      onSimilarTaskRequested(formData.title, formData.description);
    }
  }, [formData.title, formData.description]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError({}); // Clear error if validation passes
    setLoading(true); // Set loading to true before API call
    await onSave(formData); // Assuming onSave is an async function
    setLoading(false); // Set loading to false after API call
  };




  return (
    <form onSubmit={handleSubmit} className="task-form">

      <div className="task-form-group">
        <label className="form-label-task" htmlFor="new-task-title">Title</label>
        <div className="form-input-wrapper flex flex-col">
          <input
            id="new-task-title"
            type="text"
            className="form-control"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="task-form-group">
        <label className="form-label-task" htmlFor="new-task-description">Description</label>
        <div className="form-input-wrapper flex flex-col">
          <textarea
            id="new-task-description"
            className="form-control"
            value={formData.description}
            required
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows="4"
          />
          {/* Similar Tasks Button */}
          {(formData.title && formData.description) && (
            <div className="mt-2">
              {isFetchingSimilarTasks ? (
                <div className="flex items-center text-gray-500 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                  Searching for similar tasks...
                </div>
              ) : similarTasks.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onSimilarTaskRequested && onSimilarTaskRequested(formData.title, formData.description, true)}
                  className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200"
                >
                  <i className="fas fa-search mr-2"></i>
                  View {similarTasks.length} similar task{similarTasks.length !== 1 ? 's' : ''}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="task-form-group">
        <label className="form-label-task" htmlFor="new-task-due-date">Due Date</label>
        <div className="form-input-wrapper">
          <input
            id="new-task-due-date"
            type="date"
            min={new Date(Date.now() - 86400000).toISOString().split('T')[0]}
            className="form-control"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />
        </div>
      </div>

      {/* New fields for Est Completion Time and Hours of Work */}
      {/* <div className="task-form-group">
        <label className="form-label-task" htmlFor="new-task-average-time">Est Completion Time (days)</label>
        <div className="form-input-wrapper">
          <input
            id="new-task-average-time"
            type="number"
            min="1"
            step="1"
            className="form-control"
            value={formData.average_time}
            onChange={(e) => setFormData({ ...formData, average_time: e.target.value })}
            placeholder="e.g. 3"
            required
          />
        </div>
      </div>
      <div className="task-form-group">
        <label className="form-label-task" htmlFor="new-task-estimated-hours">Hours of Work</label>
        <div className="form-input-wrapper">
          <input
            id="new-task-estimated-hours"
            type="number"
            min="0"
            step="0.1"
            className="form-control"
            value={formData.estimated_hours}
            onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
            placeholder="e.g. 2.5"
            required
          />
        </div>
      </div> */}

        <div className="task-form-group form-group-half">
          <label className="form-label-task" htmlFor="new-task-priority">Priority</label>
          <div className="form-input-wrapper">
            <select
              id="new-task-priority"
              className="form-control"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>
      {noMeeting ? null:renderAssigneeSelect((value) => { setFormData({ ...formData, assigned_id: value }) })}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Task'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default TaskForm; 
