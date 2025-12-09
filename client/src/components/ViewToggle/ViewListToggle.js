import React from 'react';
import { FaList, FaTable } from 'react-icons/fa';
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
        className={`toggle-button ${currentView === 'table' ? 'active' : ''}`}
        onClick={() => onViewChange('table')}
        aria-label="Table View"
      >
        <FaTable className="toggle-icon" />
        <span>Table</span>
      </button>
    </div>
  );
};

export default ViewToggle;
