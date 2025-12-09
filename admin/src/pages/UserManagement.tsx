import { useState, useEffect } from 'react';
import axios from 'axios';
import { User } from '../types';
import { Search, CheckCircle, XCircle, BarChart3, Users } from 'lucide-react';
import {
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import UserProfileDrawer from '../components/UserProfileDrawer';
import AccountConsolidationModal from '../components/AccountConsolidationModal';
import { Switch } from '@headlessui/react';
import { toast } from 'react-toastify';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EnhancedDataTable } from '../components/DataTable'; // Import the EnhancedDataTable

interface CompanyRole {
  id: string;
  name: string;
  description: string;
}

interface ExtendedUser extends User {
  isEditing?: boolean;
  company_role_name?: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<ExtendedUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'enabled' | 'disabled'>('enabled');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const company = searchParams.get('company');
  const [subscriptionFilter, setSubscriptionFilter] = useState<'all' | 'active' | 'nonactive'>('all');
  const [companyRoles, setCompanyRoles] = useState<CompanyRole[]>([]);
  const { user: currentUser } = useAuth();
  const columnHelper = createColumnHelper<ExtendedUser>();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  
  // Modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveUser, setApproveUser] = useState<User | null>(null);
  
  // Consolidation modal state
  const [showConsolidationModal, setShowConsolidationModal] = useState(false);

  // Check for approve_new_user action in query string
  useEffect(() => {
    const checkUserStatus = async () => {
    const actionType = searchParams.get('action_type');
    const userId = searchParams.get('user_id');

    //check user is active
    if (actionType === 'approve_new_user' && userId) {
      const result = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/users/get`,  { userId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const user = result.data.user;

      if (user.status === 'enabled') {
        // User is already enabled, remove query params and don't show modal
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('action_type');
        newSearchParams.delete('user_id');
        setSearchParams(newSearchParams);
      }
      else {
        setApproveUser(user);
          setShowApproveModal(true);
        }
      }
    }
    checkUserStatus();
    
  }, [searchParams, users, setSearchParams]);

  const handleApproveUser = async () => {
    if (!approveUser) return;
    
    try {
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/users/update-status`,
        { userId: approveUser.id, status: 'enabled' },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      // Update local state
      setUsers(users.map(user =>
        user.id === approveUser.id
          ? { ...user, status: 'enabled' }
          : user
      ));

      // Close modal
      setShowApproveModal(false);
      setApproveUser(null);

      // Update query string to remove action_type and user_id
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('action_type');
      newSearchParams.delete('user_id');
      setSearchParams(newSearchParams);

      toast.success('User approved successfully');
    } catch (err) {
      toast.error('Failed to approve user');
      console.error(err);
    }
  };

  const handleCloseApproveModal = () => {
    setShowApproveModal(false);
    setApproveUser(null);
    
    // Update query string to remove action_type and user_id
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('action_type');
    newSearchParams.delete('user_id');
    setSearchParams(newSearchParams);
  };

  const handleNameClick = (user: User) => {
    setSelectedUser(user);
    setIsDrawerOpen(true);
  };

  const handleAnalyticsClick = (userId: string) => {
    navigate(`/user-analytics?userId=${userId}`);
  };

  const getRoleDisplayName = (role: string) => {
    switch(role) {
      case 'cadmin': return 'Company Admin';
      case 'padmin': return 'Platform Admin';
      case 'dev': return 'Developer';
      case 'user': 
      default: return 'User';
    }
  };

  const isExecutiveRole = (role: string) => {
    return ['cadmin', 'padmin'].includes(role);
  };
  // Fetch company roles
  const fetchCompanyRoles = async () => {
    if (!company) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/company-roles/${company}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setCompanyRoles(response.data.roles);
    } catch (err) {
      console.error('Failed to fetch company roles:', err);
      toast.error('Failed to fetch company roles');
    }
  };

  useEffect(() => {
    if (company) {
      fetchCompanyRoles();
    }
  }, [company]);

  useEffect(() => {
    console.log(sorting);
  }, [sorting]);

  // Fix the columns order and display logic
  const columns = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => (
        <button
          onClick={() => handleNameClick(info.row.original)}
          className="text-left text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {info.getValue()}
        </button>
      ),
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => (
        <div className="text-gray-600 dark:text-gray-300">
          {info.getValue()}
        </div>
      ),
    }),
    // Only include the system role column if the current user is a platform admin
    ...(currentUser?.role === 'padmin' ? [
      columnHelper.accessor('role', {
        header: 'System Role',
        cell: (info) => {
          const role = info.getValue();
          const user = info.row.original;

          // Only platform admins can change user roles
          return (
            <select
              value={role}
              onChange={(e) => handleRoleChange(user.id, e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="user">User</option>
              <option value="cadmin">Company Admin</option>
              <option value="padmin">Platform Admin</option>
              <option value="dev">Developer</option>
            </select>
          );
        },
        enableSorting: true,
      })
    ] : []),

    // Only show company role column if a company is selected
    ...(company ? [
      columnHelper.accessor('company_role_name', {
        header: 'Company Role',
        cell: () => {

        },
        enableSorting: true,
      })
    ] : []),
    // Always show the status column
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const user = info.row.original;
        return (
          <div className="flex items-center">
            <Switch
              checked={user.status === 'enabled'}
              onChange={() => handleStatusChange(user.id, user.status === 'enabled' ? 'disabled' : 'enabled')}
              className={`${user.status === 'enabled' ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2`}
            >
              <span className="sr-only">Enable user</span>
              <span
                className={`${user.status === 'enabled' ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              {user.status === 'enabled' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        );
      },
      enableSorting: true,
    }),
    // Analytics column
    columnHelper.display({
      id: 'analytics',
      header: 'Analytics',
      cell: (info) => {
        const user = info.row.original;
        return (
          <button
            onClick={() => handleAnalyticsClick(user.id)}
            className="flex items-center justify-center p-2 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
            title="View User Analytics"
          >
            <BarChart3 className="h-5 w-5" />
          </button>
        );
      },
    }),
  ];

  // Update sorting change handler to NOT reset pagination
  const handleSortingChange = (newSorting: SortingState) => {
    console.log('newSorting', newSorting);
    setSorting(newSorting);
    // Don't reset pagination - keep current page when sorting
    // setPagination(prev => ({ ...prev, pageIndex: 0 })); // Remove this line
  };

  // Update fetchUsers to handle all cases properly
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Prepare sorting parameters
      const sortingParams = sorting.length > 0 
        ? {
            sort_by: sorting[0].id,
            sort_order: sorting[0].desc ? 'desc' : 'asc'
          } 
        : {};
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/users/all`,
        {
          page: pagination.pageIndex + 1,
          per_page: pagination.pageSize,
          filter: globalFilter,
          status: statusFilter === 'enabled' ? undefined : statusFilter,
          subscription_status: subscriptionFilter === 'all' ? undefined : subscriptionFilter,
          company: company,
          ...sortingParams,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setUsers(response.data.users.map((user: User) => ({ ...user, isEditing: false })));
      setTotalUsers(response.data.total);
      setError(null);

      // Only go to last page if current page is empty AND we're not on the first page
      // This handles cases where filtering/searching reduces total results
      if (response.data.users.length === 0 && response.data.total > 0 && pagination.pageIndex > 0) {
        const lastPage = Math.max(0, Math.ceil(response.data.total / pagination.pageSize) - 1);
        setPagination(prev => ({ ...prev, pageIndex: lastPage }));
      }
    } catch (err) {
      setError('Failed to fetch users');
      console.error(err);
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a separate effect that handles sorting changes
  useEffect(() => {
    // When sorting changes, fetch data for current page with new sort order
    if (sorting.length > 0) {
      fetchUsers();
    }
  }, [sorting]); // Only trigger when sorting changes

  // Update the main effect to exclude sorting (since it's handled above)
  useEffect(() => {
    fetchUsers();
  }, [
    pagination.pageIndex,
    pagination.pageSize, 
    statusFilter, 
    subscriptionFilter
    // Remove sorting from this effect since it's handled separately
  ]);

  // Add a separate effect for search/filter changes that doesn't reset pagination
  useEffect(() => {
    // Trigger search when globalFilter changes, but keep current page
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [globalFilter]); // Only globalFilter, not pagination

  // Update search button handler to not reset pagination
  const handleSearch = () => {
    // Keep current page when manually triggering search
    fetchUsers();
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/users/update-role`,
        { userId, role: newRole },
      );

      // Update local state
      setUsers(users.map(user =>
        user.id === userId
          ? { ...user, role: newRole }
          : user
      ));

      toast.success('User role updated successfully');
    } catch (err) {
      toast.error('Failed to update user role');
      console.error(err);
    }
  };

  const handleCompanyRoleChange = async (userId: string, companyRoleId: string) => {
    if (!company) return;
    
    try {
      const result = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/users/update-company-role`,
        { user_id: userId, company_role: companyRoleId },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      // Update local state
      setUsers(users.map(user =>
        user.id === userId
          ? { ...user, company_role_name: result.data.company_role_name }
          : user
      ));

      toast.success('User company role updated successfully');
    } catch (err) {
      toast.error('Failed to update user company role');
      console.error(err);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/users/update-status`,
        { userId, status: newStatus },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      setUsers(users.map(user =>
        user.id === userId
          ? { ...user, status: newStatus }
          : user
      ));

      // Close the drawer after successful status update
      setIsDrawerOpen(false);
    } catch (err) {
      setError('Failed to update user status');
      console.error(err);
    }
  };
  useEffect(() => {
    if (error) {
      toast.error(error, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [error]);

  // Add pagination change handler
  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header Section */}
      <div className="flex-none p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              User Management
            </h1>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto sm:items-center">
              {/* Consolidate Button */}
              <button
                onClick={() => setShowConsolidationModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200 flex items-center space-x-2"
              >
                <Users className="h-4 w-4" />
                <span>Consolidate</span>
              </button>
            {/* Status Filter Switch */}
            <div className="flex items-center">
              <Switch
                checked={statusFilter === 'enabled'}
                onChange={() => setStatusFilter(statusFilter === 'enabled' ? 'disabled' : 'enabled')}
                disabled={isLoading}
                className={`
                  relative inline-flex h-9 w-full sm:w-[200px] items-center
                  rounded-full transition-colors duration-200 ease-in-out  w-[200px]
                  ${statusFilter === 'enabled'
                    ? 'bg-indigo-100 dark:bg-indigo-600'
                    : 'bg-indigo-100 dark:bg-indigo-600'}
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span
                  className={`
                    ${statusFilter === 'disabled' ? 'translate-x-[104px]' : 'translate-x-1'}
                    inline-block h-7 w-[92px] transform rounded-full 
                    bg-white dark:bg-indigo-600
                    transition-transform duration-200 ease-in-out
                  `}
                />
                <div className="absolute inset-0 flex items-center justify-between px-4">
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${statusFilter === 'enabled'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-indigo-600 dark:text-indigo-400'
                      }`}>
                      Enabled
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${statusFilter === 'disabled'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-indigo-600 dark:text-indigo-400'
                      }`}>
                      Disabled
                    </span>
                  </div>
                </div>
              </Switch>
            </div>

            {/* Search Bar with Button */}
            <div className="flex w-full sm:w-96">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  placeholder="Search users..."
                  disabled={isLoading}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 
                    border border-gray-300 dark:border-gray-600 rounded-l-md
                    text-sm text-gray-900 dark:text-white 
                    placeholder-gray-500 
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
                    transition-colors duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium
                  rounded-r-md hover:bg-indigo-700 
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 
                  transition-colors duration-200
                  flex items-center justify-center
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Search'
                )}
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={subscriptionFilter === 'active'}
                  onChange={() =>
                    setSubscriptionFilter(subscriptionFilter === 'active' ? 'all' : 'active')
                  }
                  disabled={isLoading}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Active Subscriptions</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={subscriptionFilter === 'nonactive'}
                  onChange={() =>
                    setSubscriptionFilter(subscriptionFilter === 'nonactive' ? 'all' : 'nonactive')
                  }
                  disabled={isLoading}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Nonactive Subscriptions</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Scroll */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="p-6 space-y-4">
            {/* Desktop view - Pass loading state to EnhancedDataTable */}
            <div className="hidden md:block overflow-x-auto">
              <EnhancedDataTable
                columns={columns}
                data={users}
                pageSize={pagination.pageSize}
                showPagination={true}
                manualPagination={true}
                manualSorting={true}
                pageCount={Math.ceil(totalUsers / pagination.pageSize)}
                onPaginationChange={handlePaginationChange}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                isLoading={isLoading}
                totalCount={totalUsers}
              />
            </div>

            {/* Mobile view - Add loading state */}
            <div className="md:hidden space-y-4">
              {isLoading ? (
                // Mobile loading skeleton
                Array.from({ length: pagination.pageSize }, (_, index) => (
                  <div key={`mobile-loading-${index}`} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
                    <div className="animate-pulse">
                      <div className="flex justify-between items-start mb-2">
                        <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-5 bg-gray-200 rounded w-20"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                      <div className="flex justify-end">
                        <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : users
                .slice(
                  pagination.pageIndex * pagination.pageSize,
                  (pagination.pageIndex + 1) * pagination.pageSize
                )
                .map((user, index) => (
                <div
                    key={user.id}
                  className="bg-white dark:bg-gray-800 shadow rounded-lg p-4"
                >
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                      <button
                          onClick={() => handleNameClick(user)}
                        className="text-lg font-medium text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                          {user.name}
                      </button>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isExecutiveRole(user.role)
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                          {getRoleDisplayName(user.role)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                        {user.email}
                    </div>
                    <div className="flex items-center justify-end mt-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                              {user.status !== 'disabled' ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                          </span>
                        </div>
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Mobile Pagination */}
              {!isLoading && users.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
                    {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalUsers)} of{" "}
                    {totalUsers} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                      onClick={() => handlePaginationChange({
                        ...pagination,
                        pageIndex: pagination.pageIndex - 1
                      })}
                      disabled={pagination.pageIndex === 0}
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Page {pagination.pageIndex + 1} of{" "}
                      {Math.ceil(totalUsers / pagination.pageSize)}
                    </span>
                    <button
                      className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                      onClick={() => handlePaginationChange({
                        ...pagination,
                        pageIndex: pagination.pageIndex + 1
                      })}
                      disabled={pagination.pageIndex >= Math.ceil(totalUsers / pagination.pageSize) - 1}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approve User Modal */}
      {showApproveModal && approveUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Approve New User
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to approve {approveUser.name} ({approveUser.email})? 
                This will enable their account and allow them to access the platform.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseApproveModal}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveUser}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Approve User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      <UserProfileDrawer
        user={selectedUser}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onStatusChange={handleStatusChange}
        onRoleChange={handleRoleChange}
        onCompanyRoleChange={handleCompanyRoleChange}
        currentUserRole={currentUser?.role}
      />

      {/* Consolidation Modal */}
      <AccountConsolidationModal
        isOpen={showConsolidationModal}
        onClose={() => setShowConsolidationModal(false)}
      />
    </div>
  );
};

export default UserManagement;
