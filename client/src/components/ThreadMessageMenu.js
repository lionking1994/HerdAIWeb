import React, { useState, useRef, useEffect } from 'react';
import { FaEllipsisV, FaReply, FaEdit, FaTrash } from 'react-icons/fa';

const ThreadMessageMenu = ({ thread, onReply, onEdit, onDelete, currentUserId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Check if the current user is the author of the message
  const isAuthor = thread.id === currentUserId || thread.userId === currentUserId;

  // Close the menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggleMenu}
        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
        aria-label="Message options"
      >
        <FaEllipsisV className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className={`absolute z-10 ${isAuthor ? "left-0" : "right-0"} mt-1 bg-white rounded-lg shadow-lg p-2 border border-gray-200 w-36`}>
          <button
            onClick={() => {
              onReply(thread);
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center"
          >
            <FaReply className="mr-2 text-gray-600" />
            Reply
          </button>
          
          {isAuthor && (
            <>
              <button
                onClick={() => {
                  onEdit(thread);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center"
              >
                <FaEdit className="mr-2 text-gray-600" />
                Edit
              </button>
              <button
                onClick={() => {
                  onDelete(thread);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center"
              >
                <FaTrash className="mr-2 text-gray-600" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ThreadMessageMenu;

