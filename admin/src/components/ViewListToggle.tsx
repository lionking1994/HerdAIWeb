import React from "react";
import { FaList, FaTable } from "react-icons/fa";
import "./ViewToggle.css";

type ViewMode = "list" | "table";

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ currentView, onViewChange }) => {
  return (
    <div className="view-toggle">
      <button
        className={`toggle-button ${currentView === "list" ? "active" : ""}`}
        onClick={() => onViewChange("list")}
        aria-label="List View"
      >
        <FaList className="toggle-icon" />
        <span>List</span>
      </button>

      <button
        className={`toggle-button ${currentView === "table" ? "active" : ""}`}
        onClick={() => onViewChange("table")}
        aria-label="Table View"
      >
        <FaTable className="toggle-icon" />
        <span>Table</span>
      </button>
    </div>
  );
};

export default ViewToggle;
