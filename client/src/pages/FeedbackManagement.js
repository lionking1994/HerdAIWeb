import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Loader2, ChevronDown, Check, X, ExternalLink } from 'lucide-react';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import { useDispatch, useSelector } from 'react-redux';
import Footer from '../components/Footer';
import { motion, AnimatePresence } from 'framer-motion';

const FeedbackManagement = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [totalFeedbacks, setTotalFeedbacks] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    completed: 0
  });
  const [pages, setPages] = useState([]);


  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/feedback/stats`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to fetch stats');
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    if(!user) {
      fetchUserData();
    }
    fetchStats();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchFeedbacks = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/feedback/all`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        params: {
          page: pageIndex + 1,
          per_page: pageSize,
          filter: searchQuery || undefined,
          status: user?.role === 'dev'
            ? (statusFilter === 'all' ? ['approved', 'completed'] : statusFilter)
            : (statusFilter !== 'all' ? statusFilter : undefined),
          page_id: selectedPageId || undefined
        }
      });
      setFeedbacks(response.data.data);
      setTotalFeedbacks(response.data.total);
    } catch (error) {
      toast.error('Failed to fetch feedback data');
      console.error('Error fetching feedback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (feedbackId, newStatus) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/feedback/update-status`,
        {
          feedbackId,
          status: newStatus
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        // Update the feedbacks list
        setFeedbacks(feedbacks.map(feedback =>
          feedback.id === feedbackId
            ? { ...feedback, status: newStatus }
            : feedback
        ));

        // Update selected feedback if drawer is open
        if (selectedFeedback && selectedFeedback.id === feedbackId) {
          setSelectedFeedback({ ...selectedFeedback, status: newStatus });
        }
        fetchStats()
        // Show success message
        toast.success(`Feedback status updated to ${newStatus}`);

        // Close drawer if status was updated from there
        if (isDrawerOpen) {
          setIsDrawerOpen(false);
        }
      }
    } catch (error) {
      console.error('Error updating feedback status:', error);
      toast.error('Failed to update feedback status');
    }
  };

  useEffect(() => {
    if (user && user.role)
      fetchFeedbacks();
  }, [user, pageIndex, pageSize, statusFilter, searchQuery, selectedPageId]);

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800'
  };

  const fetchPages = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/pages`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setPages(response.data);
    } catch (error) {
      toast.error('Failed to fetch pages');
      console.error('Error fetching pages:', error);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  // Status filter options based on role
  const getStatusFilterOptions = () => {
    if (user?.role === 'dev') {
      return [
        { value: 'approved', label: 'Approved' }
      ];
    }

    if (user?.role === 'padmin') {
      return [
        { value: 'all', label: 'All Status' },
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'completed', label: 'Completed' }
      ];
    }

    return [];
  };

  // Stats display based on role
  const getStatsToShow = () => {
    if (user?.role === 'dev') {
      return [
        { label: 'Approved', value: stats.approved, color: 'bg-green-100 text-green-800' },
        { label: 'Completed', value: stats.completed, color: 'bg-blue-100 text-blue-800' }
      ];
    }

    return [
      { label: 'Pending', value: stats.pending, color: 'bg-yellow-100 text-yellow-800' },
      { label: 'Approved', value: stats.approved, color: 'bg-green-100 text-green-800' },
      { label: 'Rejected', value: stats.rejected, color: 'bg-red-100 text-red-800' },
      { label: 'Completed', value: stats.completed, color: 'bg-blue-100 text-blue-800' }
    ];
  };

  // Modify the status column in the table to show appropriate buttons based on role
  // const renderStatusCell = (feedback) => {
  //   // For platform admin viewing pending feedback
  //   if (user?.role === 'padmin' && feedback.status === 'pending') {
  //     return (
  //       <div className="flex gap-2">
  //         <button
  //           onClick={() => handleStatusUpdate(feedback.id, 'approved')}
  //           className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200"
  //         >
  //           Approve
  //         </button>
  //         <button
  //           onClick={() => handleStatusUpdate(feedback.id, 'rejected')}
  //           className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full hover:bg-red-200"
  //         >
  //           Reject
  //         </button>
  //       </div>
  //     );
  //   }

  //   For developer viewing approved feedback
  //   if (user?.role === 'dev' && feedback.status === 'approved') {
  //     return (
  //       <button
  //         onClick={() => handleStatusUpdate(feedback.id, 'completed')}
  //         className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200"
  //       >
  //         Mark Complete
  //       </button>
  //     );
  //   }

  //   // Default status badge
  //   return (
  //     <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[feedback.status]}`}>
  //       {feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1)}
  //     </span>
  //   );
  // };

  return (
    <div className='w-screen h-screen flex flex-col overflow-auto'>
      <Navbar isAuthenticated={true} user={user} />
      <div className="container mx-auto px-4 py-8 flex-1 w-full h-full overflow-auto">
        {/* Stats Section */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {user?.role === 'dev' ? (
            <>
              <button
                key="Approved"
                variant="outline"
                className="bg-green-100 text-green-800 hover:opacity-80"
                onClick={() => {
                  setStatusFilter('approved');
                  setPageIndex(0);
                }}
              >
                <div className="text-lg font-semibold">{stats.approved}</div>
                <div className="text-sm">Approved</div>
              </button>
              <button
                key="Completed"
                variant="outline"
                className="bg-blue-100 text-blue-800 hover:opacity-80"
                onClick={() => {
                  setStatusFilter('completed');
                  setPageIndex(0);
                }}
              >
                <div className="text-lg font-semibold">{stats.completed}</div>
                <div className="text-sm">Completed</div>
              </button>
            </>
          ) : (
            // Existing stats buttons for other roles
            getStatsToShow().map((stat) => (
              <button
                key={stat.label}
                variant="outline"
                className={`${stat.color} hover:opacity-80`}
                onClick={() => {
                  setStatusFilter(stat.label.toLowerCase());
                  setPageIndex(0);
                }}
              >
                <div className="text-lg font-semibold">{stat.value}</div>
                <div className="text-sm">{stat.label}</div>
              </button>
            ))
          )}
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedPageId ? 'Page Feedback' : 'All Feedback'}
          </h1>
          <p className="mt-2 text-gray-600">
            {selectedPageId ? 'View feedback for selected page' : 'View and manage feedback'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          {
            (user && user.role === 'padmin') && <select
            value={selectedPageId || ''}
            onChange={(e) => {
              setSelectedPageId(e.target.value || null);
              setPageIndex(0);
            }}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All Pages</option>
            {pages.map(page => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
          }
          <input
            type="text"
            placeholder="Search feedback..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {getStatusFilterOptions().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {selectedPageId && (
            <button
              onClick={() => setSelectedPageId(null)}
              className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Clear Page Filter
            </button>
          )}
        </div>

        {/* Feedback List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            {feedbacks.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No feedback</h3>
                <p className="mt-1 text-sm text-gray-500">No feedback found for the current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                          </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {feedbacks.map((feedback) => (
                      <tr key={feedback.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedFeedback(feedback);
                              setIsDrawerOpen(true);
                            }}
                            className="text-violet-600 hover:text-violet-900">{feedback.subject}</button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user?.role === 'dev' && feedback.status === 'approved' ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleStatusUpdate(feedback.id, 'completed')}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200"
                              >
                                Mark Complete
                              </button>
                            </div>
                          ) : user?.role === 'padmin' && feedback.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleStatusUpdate(feedback.id, 'approved')}
                                className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(feedback.id, 'rejected')}
                                className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full hover:bg-red-200"
                              >
                                Reject
                              </button>
                              </div>
                          ) : (
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[feedback.status]}`}>
                              {feedback.status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {new Date(feedback.date_time).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">
              Showing {pageIndex * pageSize + 1} to {Math.min((pageIndex + 1) * pageSize, totalFeedbacks)} of {totalFeedbacks} results
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageIndex(prev => Math.max(0, prev - 1))}
              disabled={pageIndex === 0}
              className="px-3 py-1 border rounded-md disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPageIndex(prev => prev + 1)}
              disabled={(pageIndex + 1) * pageSize >= totalFeedbacks}
              className="px-3 py-1 border rounded-md disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {/* Feedback Detail Drawer */}
        <AnimatePresence>
          {isDrawerOpen && selectedFeedback && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="fixed inset-0 bg-[#0004] z-40"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl z-50 overflow-y-auto"
              >
                <div className="p-6 pt-[100px]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Feedback Details</h2>
                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                    >
                      <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {user?.role === 'padmin' && selectedFeedback?.status === 'pending' && (
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => handleStatusUpdate(selectedFeedback.id, 'approved')}
                          className="flex-1 px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(selectedFeedback.id, 'rejected')}
                          className="flex-1 px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {user?.role === 'dev' && selectedFeedback?.status === 'approved' && (
                      <div className="flex mb-4">
                        <button
                          onClick={() => handleStatusUpdate(selectedFeedback.id, 'completed')}
                          className="flex-1 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          Mark as Completed
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-4">
                      <img
                        src={`${process.env.REACT_APP_API_URL}/avatars/${selectedFeedback.user_avatar}`}
                        alt={selectedFeedback.user_name}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <h3 className="font-semibold">{selectedFeedback.user_name}</h3>
                        <p className="text-sm text-gray-500">{selectedFeedback.user_email}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Subject</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{selectedFeedback.subject}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Details</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{selectedFeedback.details}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Page URL</h4>
                        <a 
                          href={selectedFeedback.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {selectedFeedback.url}
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Status</h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          selectedFeedback.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          selectedFeedback.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {selectedFeedback.status.charAt(0).toUpperCase() + selectedFeedback.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  );
};

export default FeedbackManagement;






















