import React, { useState, useEffect } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-toastify';

const TaskOwnerReassignmentPopup = ({ isOpen, onClose, taskId, currentOwner, onOwnerChange, meetingId, myTaskDetail }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userDomain, setUserDomain] = useState('');

  // Extract domain from current user's email
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const userData = await response.json();
          if (userData.email) {
            const domain = userData.email.split('@')[1];
            setUserDomain(domain);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserData();
  }, []);

  // Search for users when search term changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim()) {
        setUsers([]);
        return;
      }

      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/users/search`,
          {
            email: searchTerm,
            limit: 10,
            cur_emails: [],
            searchGlobal: true,
            meetingId: meetingId,
            isAddingUser: true
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.data.success) {
          // Filter users to only include those with the same domain
          // const filteredUsers = response.data.users.filter(user => {
          //   if (!userDomain) return true;
          //   const userEmailDomain = user.email.split('@')[1];
          //   return userEmailDomain === userDomain;
          // });
          
          setUsers(response.data.users);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        toast.error('Failed to search for users');
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      if (searchTerm.trim()) {
        searchUsers();
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, userDomain]);

  const handleAssign = async (userId, userName) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/tasks/update`,
        {
          ...myTaskDetail,
          owner_id: userId,
          owner_name: userName,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success(`Task owner changed to ${userName}`);
        onOwnerChange(userId, userName);
        onClose();
      }
    } catch (error) {
      console.error('Error changing task owner:', error);
      toast.error('Failed to change task owner');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[500000]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl z-[500001] max-h-[80vh] overflow-y-auto w-[90%] max-w-md"
          >
            <div className="p-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">Change Task Owner</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors duration-200"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Search Input */}
              <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search users by name or email..."
                  className="pl-8 pr-3 py-1.5 w-full border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              {/* Current Owner */}
              {currentOwner && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1.5">Current Task Owner</p>
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="font-medium text-blue-800 text-sm">{currentOwner}</p>
                  </div>
                </div>
              )}

              {/* User List */}
              <div className="space-y-1.5 max-h-[35vh] overflow-y-auto">
                {isLoading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  </div>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => handleAssign(user.id, user.name)}
                      className="p-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors duration-200"
                    >
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-2">
                          {user.avatar ? (
                            <img
                              src={`${process.env.REACT_APP_API_URL}/avatars/${user.avatar}`}
                              alt={user.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-base font-semibold text-gray-500">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : searchTerm.trim() ? (
                  <div className="text-center py-3 text-gray-500 text-sm">
                    No users found matching "{searchTerm}"
                  </div>
                ) : (
                  <div className="text-center py-3 text-gray-500 text-sm">
                    Type to search for users
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

export default TaskOwnerReassignmentPopup;
