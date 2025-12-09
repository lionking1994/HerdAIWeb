import "./EditTaskModal.css";


const EditTaskModal = ({
  isOpen,
  onClose,
  editingTask,
  setEditingTask,
  onSave,
  isUpdatingTask,
  renderAssigneeSelect,
  isOwner
}) => {

  return (
    <div className={`modal ${isOpen ? "show" : ""}`}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Edit Task</h2>
          <button
            className="modal-close-button"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label-task" htmlFor="task-title">
              Task Title
            </label>
            <div className="form-input-wrapper">
              <input
                id="task-title"
                type="text"
                disabled={!isOwner}
                className="form-control"
                value={editingTask?.title || ""}
                onChange={(e) =>
                  setEditingTask({ ...editingTask, title: e.target.value })
                }
                placeholder="Enter task title"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label-task" htmlFor="task-description">
              Description
            </label>
            <div className="form-input-wrapper">
              <textarea
                id="task-description"
                className="form-control"
                disabled={!isOwner}
                value={editingTask?.description || ""}
                onChange={(e) =>
                  setEditingTask({ ...editingTask, description: e.target.value })
                }
                placeholder="Enter task description"
                rows="3"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label-task" htmlFor="task-due-date">
              Due Date
            </label>
            <div className="form-input-wrapper">
              <input
                id="task-due-date"
                type="date"
                disabled={!isOwner}
                className="form-control"
                min={new Date(Date.now() - 86400000).toISOString().split('T')[0]}
                value={editingTask?.duedate ? new Date(editingTask.duedate).toISOString().split('T')[0] : ""}
                onChange={(e) =>
                  setEditingTask({ ...editingTask, duedate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="form-row">
          <div className="form-group  form-group-half">
            <label className="form-label-task" htmlFor="task-priority">
              Priority
              </label>

              <div className="form-input-wrapper">
                <select
                  id="task-priority"
                  className="form-control"
                  value={editingTask?.priority || "Medium"}
                  disabled={!isOwner}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, priority: e.target.value })
                  }
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
            </div>
            </div>
          </div>
          {renderAssigneeSelect((value) => setEditingTask({ ...editingTask, assigned_id: value }), editingTask.assigned_id)}
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={isUpdatingTask}
          >
            {isUpdatingTask ? (
              <>
                <div className="loading-indicator"></div>
                <span>Saving...</span>
              </>
            ) : (
              "Save Changes"
            )}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTaskModal; 
