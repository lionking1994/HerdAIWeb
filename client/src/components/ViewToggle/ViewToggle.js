import React from 'react';
import { FaList, FaColumns } from 'react-icons/fa';
import './ViewToggle.css';

const ViewToggle = ({ currentView, onViewChange }) => {
  return (
    <div className="view-toggle">
      <button 
        className={`toggle-button ${currentView === 'list' ? 'active' : ''}`}
        onClick={() => onViewChange('list')}
        aria-label="List View"
      >
        <FaList className="toggle-icon" />
        <span>List</span>
      </button>
      <button 
        className={`toggle-button ${currentView === 'kanban' ? 'active' : ''}`}
        onClick={() => onViewChange('kanban')}
        aria-label="Kanban View"
      >
        <FaColumns className="toggle-icon" />
        <span>Kanban</span>
      </button>
    </div>
  );
};

export default ViewToggle;