import React, { useState, useEffect } from 'react';
import { X, Users, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { EnhancedDataTable } from './DataTable';
import { createColumnHelper, SortingState } from '@tanstack/react-table';

interface AccountConsolidationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConsolidationAccount {
  id: string;
  name: string;
  email: string;
  status: string;
  openTasksCount: number;
  isSelected: boolean;
  isPrimary: boolean;
}

const AccountConsolidationModal: React.FC<AccountConsolidationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [accounts, setAccounts] = useState<ConsolidationAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [primaryAccount, setPrimaryAccount] = useState<string | null>(null);
  const [selectedAccountDetails, setSelectedAccountDetails] = useState<ConsolidationAccount[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [totalCount, setTotalCount] = useState(0);

  const columnHelper = createColumnHelper<ConsolidationAccount>();

  // Fetch all users for consolidation
  const fetchAccounts = async (pageIndex: number = 0, pageSize: number = 10, sortField?: string, sortOrder?: string, searchKey?: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const offset = pageIndex * pageSize;
      
      const requestBody: {
        offset: number;
        limit: number;
        sortBy?: string;
        sortOrder?: string;
        searchKey?: string;
      } = {
        offset: offset,
        limit: pageSize
      };

      // Add sorting parameters if provided
      if (sortField && sortOrder) {
        requestBody.sortBy = sortField;
        requestBody.sortOrder = sortOrder;
      }

      // Add search key if provided
      if (searchKey) {
        requestBody.searchKey = searchKey;
      }
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/users/consolidation-accounts`,
        requestBody,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const accountsWithTasks = response.data.accounts.map((account: ConsolidationAccount) => ({
        id: account.id,
        name: account.name,
        email: account.email,
        status: account.status,
        openTasksCount: account.openTasksCount || 0,
        isSelected: selectedAccounts.includes(account.id),
        isPrimary: primaryAccount === account.id
      }));

      setAccounts(accountsWithTasks);
      setTotalCount(response.data.total || accountsWithTasks.length);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      toast.error('Failed to fetch accounts for consolidation');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const currentSort = sorting.length > 0 ? sorting[0] : null;
      let sortField = currentSort?.id;
      const sortOrder = currentSort?.desc ? 'desc' : 'asc';
      
      // Map frontend field names to backend field names
      if (sortField === 'openTasksCount') {
        sortField = 'open_tasks_count';
      }
      
      fetchAccounts(pagination.pageIndex, pagination.pageSize, sortField, sortOrder, globalFilter);
    }
  }, [isOpen, sorting, pagination.pageIndex, pagination.pageSize, globalFilter]);

  const handleAccountSelection = (accountId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedAccounts(prev => [...prev, accountId]);
      // Add account details to selectedAccountDetails
      const account = accounts.find(acc => acc.id === accountId);
      if (account) {
        setSelectedAccountDetails(prev => [...prev, account]);
      }
    } else {
      setSelectedAccounts(prev => prev.filter(id => id !== accountId));
      setSelectedAccountDetails(prev => prev.filter(acc => acc.id !== accountId));
      // If deselected account was primary, clear primary selection
      if (primaryAccount === accountId) {
        setPrimaryAccount(null);
      }
    }

    setAccounts(prev => prev.map(account => 
      account.id === accountId 
        ? { ...account, isSelected }
        : account
    ));
  };

  const handlePrimaryAccountSelection = (accountId: string) => {
    if (!selectedAccounts.includes(accountId)) {
      toast.error('Primary account must be selected first');
      return;
    }

    setPrimaryAccount(accountId);
    setAccounts(prev => prev.map(account => ({
      ...account,
      isPrimary: account.id === accountId
    })));
  };

  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    // Don't trigger API call, just update local pagination state
    setPagination(newPagination);
  };

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting);
  };

  // Define table columns
  const columns = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => (
        <div className="text-left text-gray-900 dark:text-white">
          {info.getValue()}
        </div>
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
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          info.getValue() === 'enabled'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}>
          {info.getValue() === 'enabled' ? 'Active' : 'Inactive'}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const account = info.row.original;
        return (
          <div className="flex items-center space-x-2 min-w-[400px]">
            <button
              onClick={() => handleAccountSelection(account.id, !account.isSelected)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                account.isSelected
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {account.isSelected ? 'Selected' : 'Select'}
            </button>
            {account.isSelected && !account.isPrimary && (
              <button
                onClick={() => handlePrimaryAccountSelection(account.id)}
                className="px-3 py-1 text-sm font-medium text-indigo-600 bg-indigo-100 border border-indigo-300 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-700 dark:hover:bg-indigo-800 whitespace-nowrap"
              >
                Set as Primary
              </button>
            )}
            {account.isPrimary && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 whitespace-nowrap">
                Primary
              </span>
            )}
          </div>
        );
      },
    }),
  ];

  const handleConsolidate = async () => {
    if (selectedAccounts.length < 2) {
      toast.error('Please select at least 2 accounts to consolidate');
      return;
    }

    if (!primaryAccount) {
      toast.error('Please select a primary account');
      return;
    }

    setIsConsolidating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/users/consolidate-accounts`,
        {
          selectedAccountIds: selectedAccounts,
          primaryAccountId: primaryAccount
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        toast.success('Accounts consolidated successfully');
        onClose();
        // Reset state
        setSelectedAccounts([]);
        setPrimaryAccount(null);
        setSelectedAccountDetails([]);
        setAccounts([]);
      } else {
        toast.error(response.data.error || 'Failed to consolidate accounts');
      }
    } catch (error: unknown) {
      console.error('Consolidation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to consolidate accounts';
      toast.error(errorMessage);
    } finally {
      setIsConsolidating(false);
    }
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Consolidate Accounts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Consolidation Process
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Select multiple accounts to consolidate into one primary account. 
                  All open tasks from inactive accounts will be reassigned to the primary account.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="flex w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search users..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 
                  border border-gray-300 dark:border-gray-600 rounded-md
                  text-sm text-gray-900 dark:text-white 
                  placeholder-gray-500 
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
                  transition-colors duration-200"
              />
            </div>
          </div>
        </div>

        {/* Selected Users Tags */}
        {selectedAccountDetails.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Selected Users:
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedAccountDetails
                .map((account) => (
                  <div
                    key={account.id}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      account.isPrimary
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                    }`}
                  >
                    <span className="mr-2">
                      {account.name} {account.isPrimary && '(Primary)'}
                    </span>
                    <button
                      onClick={() => handleAccountSelection(account.id, false)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Select Accounts to Consolidate
          </h3>
          
          {/* Desktop view - EnhancedDataTable with skeleton loading */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[800px]">
              <EnhancedDataTable
                columns={columns}
                data={accounts}
                pageSize={pagination.pageSize}
                showPagination={true}
                manualPagination={true}
                manualSorting={true}
                pageCount={Math.ceil(totalCount / pagination.pageSize)}
                onPaginationChange={handlePaginationChange}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                isLoading={isLoading}
                totalCount={totalCount}
              />
            </div>
          </div>

          {/* Mobile view - Skeleton loading */}
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
            ) : accounts
              .slice(
                pagination.pageIndex * pagination.pageSize,
                (pagination.pageIndex + 1) * pagination.pageSize
              )
              .map((account: ConsolidationAccount) => (
                <div
                  key={account.id}
                  className="bg-white dark:bg-gray-800 shadow rounded-lg p-4"
                >
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="text-lg font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        account.status === 'enabled'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {account.status === 'enabled' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {account.email}
                    </div>
                    <div className="flex items-center justify-end mt-2 space-x-2 flex-wrap">
                      <button
                        onClick={() => handleAccountSelection(account.id, !account.isSelected)}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                          account.isSelected
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {account.isSelected ? 'Selected' : 'Select'}
                      </button>
                      {account.isSelected && !account.isPrimary && (
                        <button
                          onClick={() => handlePrimaryAccountSelection(account.id)}
                          className="px-3 py-1 text-sm font-medium text-indigo-600 bg-indigo-100 border border-indigo-300 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-700 dark:hover:bg-indigo-800 whitespace-nowrap"
                        >
                          Set as Primary
                        </button>
                      )}
                      {account.isPrimary && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 whitespace-nowrap">
                          Primary
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

            {/* Mobile Pagination */}
            {!isLoading && accounts.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                  Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
                  {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount)} of{" "}
                  {totalCount} results
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
                    {Math.ceil(totalCount / pagination.pageSize)}
                  </span>
                  <button
                    className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                    onClick={() => handlePaginationChange({
                      ...pagination,
                      pageIndex: pagination.pageIndex + 1
                    })}
                    disabled={pagination.pageIndex >= Math.ceil(totalCount / pagination.pageSize) - 1}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedAccountDetails.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Consolidation Summary
            </h4>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{selectedAccountDetails.length} accounts selected</span>
              </div>
              {primaryAccount && (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Primary account: {selectedAccountDetails.find(a => a.id === primaryAccount)?.name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isConsolidating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleConsolidate}
            disabled={selectedAccounts.length < 2 || !primaryAccount || isConsolidating}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConsolidating ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Consolidating...</span>
              </div>
            ) : (
              'Consolidate Accounts'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountConsolidationModal; 