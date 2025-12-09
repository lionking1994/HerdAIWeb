import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { format, endOfMonth, addMonths, startOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './KanbanView.css';
import { toast } from 'react-toastify';


const KanbanView = ({ tasks, onTaskUpdate }) => {
  const navigate = useNavigate();
  const [columns, setColumns] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  // Generate columns for the next 12 months
  useEffect(() => {
    const generateColumns = () => {
      const newColumns = {};
      const today = new Date();
      
      // Create 12 columns for the next 12 months
      for (let i = 0; i < 12; i++) {
        const monthDate = addMonths(today, i);
        const columnId = format(monthDate, 'yyyy-MM');
        const columnTitle = format(monthDate, 'MMMM yyyy');
        
        newColumns[columnId] = {
          id: columnId,
          title: columnTitle,
          date: monthDate,
          tasks: []
        };
      }
      
      return newColumns;
    };
    
    setColumns(generateColumns());
  }, []);

  // Distribute tasks to columns based on due date
  useEffect(() => {
    if (tasks && tasks.length > 0 && Object.keys(columns).length > 0) {
      const newColumns = { ...columns };
      
      // Reset all columns' tasks
      Object.keys(newColumns).forEach(columnId => {
        newColumns[columnId].tasks = [];
      });
      
      // Distribute tasks to appropriate columns
      tasks.forEach(task => {
        if (task.duedate) {
          const dueDate = new Date(task.duedate);
          const columnId = format(dueDate, 'yyyy-MM');
          
          // Check if the column exists (it might be outside our 12-month range)
          if (newColumns[columnId]) {
            newColumns[columnId].tasks.push(task);
          } else {
            // If due date is outside our range, put it in the first column
            const firstColumnId = Object.keys(newColumns)[0];
            newColumns[firstColumnId].tasks.push(task);
          }
        } else {
          // If no due date, put it in the first column
          const firstColumnId = Object.keys(newColumns)[0];
          newColumns[firstColumnId].tasks.push(task);
        }
      });
      
      setColumns(newColumns);
    }
  }, [tasks, columns]);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    // If dropped outside a droppable area
    if (!destination) return;

    // If dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;

    // Find the source and destination columns
    const sourceColumn = columns[source.droppableId];
    const destColumn = columns[destination.droppableId];

    // Find the task that was dragged
    const draggedTask = sourceColumn.tasks.find(task => task.id.toString() === draggableId);
    
    if (!draggedTask) return;

    // Create new arrays for the source and destination columns
    const newSourceTasks = Array.from(sourceColumn.tasks);
    const newDestTasks = source.droppableId === destination.droppableId 
      ? newSourceTasks 
      : Array.from(destColumn.tasks);

    // Remove the task from the source column
    newSourceTasks.splice(source.index, 1);

    // Add the task to the destination column
    if (source.droppableId === destination.droppableId) {
      newSourceTasks.splice(destination.index, 0, draggedTask);
    } else {
      newDestTasks.splice(destination.index, 0, draggedTask);
    }

    // Update the columns state
    const newColumns = {
      ...columns,
      [source.droppableId]: {
        ...sourceColumn,
        tasks: newSourceTasks
      }
    };

    if (source.droppableId !== destination.droppableId) {
      newColumns[destination.droppableId] = {
        ...destColumn,
        tasks: newDestTasks
      };

      // Calculate new due date (end of the destination month)
      const destDate = new Date(destColumn.date);
      const newDueDate = endOfMonth(destDate);

      // Update the task's due date
      setIsUpdating(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/tasks/update-due-date`,
          {
            id: draggedTask.id,
            duedate: format(newDueDate, 'yyyy-MM-dd')
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.data.success) {
          // Notify parent component about the update
          if (onTaskUpdate) {
            onTaskUpdate();
          }
        }
      } catch (error) {
        toast(error.response?.data?.error || 'Failed to update task due date');
        console.error('Error updating task due date:', error);
      } finally {
        setIsUpdating(false);
      }
    }

    setColumns(newColumns);
  };

  const handleTaskClick = (taskId) => {
    navigate(`/task-details?id=${taskId}`);
  };

  return (
    <div className="kanban-container">
      {isUpdating && (
        <div className="updating-overlay">
          <div className="updating-spinner"></div>
          <p>Updating task...</p>
        </div>
      )}
      
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kanban-board">
          {Object.values(columns).map(column => (
            <div key={column.id} className="kanban-column">
              <h3 className="column-title">{column.title}</h3>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    className={`task-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {column.tasks.map((task, index) => (
                      <Draggable
                        key={task.id.toString()}
                        draggableId={task.id.toString()}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            className={`kanban-card ${snapshot.isDragging ? 'dragging' : ''}`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => handleTaskClick(task.id)}
                          >
                            <div className="card-header">
                              <h4 className="card-title">{task.title}</h4>
                              <span className={`status-badge ${task.status?.toLowerCase() || "pending"}`}>
                                {task.status || "Pending"}
                              </span>
                            </div>
                            <p className="card-description">{task.description}</p>
                            <div className="card-footer">
                              <div className="card-meta">
                                <span className="due-date">
                                  {task.duedate ? format(new Date(task.duedate), 'MM/dd/yyyy') : "No due date"}
                                </span>
                                <span className={`priority-badge ${task.priority?.toLowerCase() || "medium"}`}>
                                  {task.priority || "Medium"}
                                </span>
                              </div>
                              <div className="card-assignee">
                                <span className="assignee-label">Assigned to:</span>
                                <span className="assignee-name">{task.assignee_name || "Unassigned"}</span>
                              </div>
                              <div className="card-owner">
                                <span className="owner-label">Owner:</span>
                                <span className="owner-name">{task.meeting_owner_name || "Unassigned"}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {column.tasks.length === 0 && (
                      <div className="empty-column">No tasks for this month</div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default KanbanView;

