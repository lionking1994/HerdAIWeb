import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const TaskDrawer = ({ isOpen, onClose, tasks, title = "Past Open Tasks" }) => {
  
  useEffect(()=>{
    console.log(isOpen);
  },[isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 z-[600000]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-[600001] overflow-y-auto"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Tasks Content */}
              <div className="space-y-6">
                {tasks.map((task) => (
                  <div key={task.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-start space-x-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                        <p className="text-gray-600 mt-1">{task.description}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <span className="font-medium mr-2">Meeting:</span>
                        {task.meeting_title}
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium mr-2">Date:</span>
                        {format(new Date(task.meeting_date), 'PPpp')}
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium mr-2">Assigned to:</span>
                        {task.assignee_name}
                      </div>
                      <div className="flex items-center mt-2 gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          task.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                          task.status === 'Ready For Review' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.status}
                        </span>
                        <div className="flex items-center">
                          <span className="font-medium mr-2">Priority:</span>
                          <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${task.priority?.toLowerCase() === 'high' ? 'bg-red-100 text-red-800' :
                            task.priority?.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              task.priority?.toLowerCase() === 'low' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                            {task.priority || 'Medium'}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No tasks found
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TaskDrawer;







