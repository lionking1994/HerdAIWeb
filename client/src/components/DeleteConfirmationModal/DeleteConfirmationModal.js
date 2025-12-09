import "./DeleteConfirmationModal.css";

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, taskTitle, taskSubTitle }) => {
  return (
    <div className={`modal ${isOpen ? "show" : ""}`}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Confirm Delete</h2>
          <button
            className="modal-close-button"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body">
          <p>{taskTitle}</p>
          <p className="task-title-preview">{taskSubTitle}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal; 