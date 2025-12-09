import { useState, useEffect, useCallback } from 'react';
import { useDeferredValue } from 'react';
import { ColumnDef, SortingState } from '@tanstack/react-table';
import { Account } from '../../types/crm';
import { createCRMService } from '../../services/crm/crmService';
import CrmPaginationTable from '../../components/CRM/CrmPaginationTable';
import AccountForm from '../../components/CRM/AccountForm';
import SearchBar from '../../components/CRM/SearchBar';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import ConfirmationModal from '../../components/ui/confirmation-modal';

export default function Accounts() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; account: Account | null }>({ isOpen: false, account: null });
  const [detailedDeleteModal, setDetailedDeleteModal] = useState<{ 
    isOpen: boolean; 
    account: Account | null; 
    relatedData: { contact_count: number; opportunity_count: number } | null; 
    message: string 
  }>({ isOpen: false, account: null, relatedData: null, message: '' });
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null); // Add loading state for delete button
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const { showSuccess, showError } = useToast();

  // Create CRM service instance
  const crmService = companyId ? createCRMService(companyId) : null;

  const loadAccounts = useCallback(async (page = currentPage, size = pageSize, search = deferredSearchTerm) => {
    if (!crmService) return;
    
    try {
      setIsLoading(true);
      const response = await crmService.getAccounts(search, {
        page: page,
        limit: size
      });
      
      // Handle both old format (array) and new format (object with pagination)
      if (Array.isArray(response)) {
        setAccounts(response);
        setTotalCount(response.length);
      } else {
        const paginatedResponse = response as { data: Account[]; pagination: { pages: number; total: number } };
        setAccounts(paginatedResponse.data || []);
        setTotalCount(paginatedResponse.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setAccounts([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [crmService, currentPage, pageSize, deferredSearchTerm]);

  useEffect(() => {
    if (companyId) {
      setCurrentPage(1); // Reset to first page when search changes
      loadAccounts();
    }
  }, [deferredSearchTerm, companyId]);

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleDelete = async (account: Account) => {
    console.log('🔍 handleDelete called for account:', account.id, account.name);
    
    // Set loading state for this specific account
    setDeletingAccountId(account.id);
    
    try {
      // First check if account has related data
      console.log('🔍 Checking account relationships...');
      const relatedData = await crmService?.checkAccountRelations(account.id);
      console.log('🔍 Related data response:', relatedData);
      
      if (relatedData?.data?.has_related_data) {
        console.log('🔍 Related data found, showing detailed modal');
        // Show detailed confirmation modal
        setDetailedDeleteModal({
          isOpen: true,
          account,
          relatedData: relatedData.data,
          message: `This account has ${relatedData.data.contact_count} related contact(s) and ${relatedData.data.opportunity_count} related opportunity(ies). Deleting will also remove these relationships.`
        });
      } else {
        console.log('🔍 No related data, showing normal delete modal');
        // No related data, show normal delete confirmation
        setDeleteModal({ isOpen: true, account });
      }
    } catch (error: unknown) {
      console.error('❌ Failed to check account relationships:', error);
      const err = error as { response?: { data?: unknown } };
      console.error('❌ Error details:', err.response?.data);
      // Fallback to normal delete confirmation
      setDeleteModal({ isOpen: true, account });
    } finally {
      // Clear loading state
      setDeletingAccountId(null);
    }
  };

  const confirmDelete = async () => {
    if (!crmService || !deleteModal.account) return;
    
    try {
      await crmService.deleteAccount(deleteModal.account.id);
      await loadAccounts();
      showSuccess('Account deleted successfully');
    } catch (error: unknown) {
      console.error('Failed to delete account:', error);
      
      // Extract server error message if available
      let errorMessage = 'Failed to delete account. Please try again.';
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      showError(errorMessage);
    } finally {
      setDeleteModal({ isOpen: false, account: null });
    }
  };

  const confirmDetailedDelete = async () => {
    if (!crmService || !detailedDeleteModal.account) return;
    
    try {
      // Use forceDelete=true to bypass the relationship check
      await crmService.deleteAccount(detailedDeleteModal.account.id, true);
      await loadAccounts();
      showSuccess('Account and related data deleted successfully');
    } catch (error: unknown) {
      console.error('Failed to delete account:', error);
      
      let errorMessage = 'Failed to delete account. Please try again.';
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      showError(errorMessage);
    } finally {
      setDetailedDeleteModal({ isOpen: false, account: null, relatedData: null, message: '' });
    }
  };

  const handleCreate = () => {
    setEditingAccount(undefined);
    setShowForm(true);
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadAccounts(page, pageSize, deferredSearchTerm);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    loadAccounts(1, newPageSize, deferredSearchTerm);
  };

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting);
    // You can implement sorting logic here if needed
    // For now, we'll just update the state
  };

  const handlePaginationChange = (pagination: { pageIndex: number; pageSize: number }) => {
    setCurrentPage(pagination.pageIndex + 1);
    setPageSize(pagination.pageSize);
    loadAccounts(pagination.pageIndex + 1, pagination.pageSize, deferredSearchTerm);
  };

  const handleSubmit = async (accountData: Partial<Account>) => {
    if (!crmService) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      if (editingAccount) {
        await crmService.updateAccount(editingAccount.id, accountData);
        showSuccess('Account updated successfully');
      } else {
        await crmService.createAccount(accountData as Omit<Account, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>);
        showSuccess('Account created successfully');
      }
      setShowForm(false);
      await loadAccounts();
    } catch (error: unknown) {
      console.error('Failed to save account:', error);
      
      // Extract server error message if available
      let errorMessage = 'Failed to save account. Please try again.';
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<Account>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => row.getValue('name'),
    },
    {
      id: 'industry',
      accessorKey: 'industry',
      header: 'Industry',
      cell: ({ row }) => row.getValue('industry') || '-',
    },
    {
      id: 'account_type',
      accessorKey: 'account_type',
      header: 'Type',
      cell: ({ row }) => row.getValue('account_type') || '-',
    },
    {
      id: 'email',
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => row.getValue('email') || '-',
    },
    {
      id: 'phone',
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => row.getValue('phone') || '-',
    },
    {
      id: 'opportunities_percentage',
      accessorKey: 'opportunities_percentage',
      header: 'Opportunity %',
      cell: ({ row }) => row.getValue('opportunities_percentage') || '-',
    },
    {
      id: 'created_at',
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => {
        const date = row.getValue('created_at');
        return date ? new Date(date as string).toLocaleDateString() : '-';
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleEdit(row.original)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            disabled={deletingAccountId === row.original.id}
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(row.original)}
            className={`text-sm font-medium flex items-center space-x-2 ${
              deletingAccountId === row.original.id
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-red-600 hover:text-red-800'
            }`}
            disabled={deletingAccountId === row.original.id}
          >
            {deletingAccountId === row.original.id ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Checking...</span>
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      ),
    },
  ];

  // Column width configuration
  const columnWidths = {
    name: '200px',
    industry: '150px',
    account_type: '120px',
    email: '200px',
    phone: '150px',
    opportunities_percentage: '120px',
    created_at: '120px',
    actions: '150px',
  };

  return (
    <div className="p-6 crm-page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Add Account
        </button>
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search accounts..."
      />

      <CrmPaginationTable
        columns={columns}
        data={accounts}
        pageSize={pageSize}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        totalCount={totalCount}
        columnWidths={columnWidths}
        onPaginationChange={handlePaginationChange}
        isLoading={isLoading}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <div className="crm-page-spacer"></div>
      {showForm && (
        <AccountForm
          account={editingAccount}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          isSubmitting={isSubmitting}
          existingAccounts={accounts}
        />
      )}
      
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, account: null })}
        onConfirm={confirmDelete}
        title="Delete Account"
        description={`Are you sure you want to delete "${deleteModal.account?.name}" from accounts?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Enhanced Delete Confirmation Modal for Related Data */}
      {detailedDeleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDetailedDeleteModal({ isOpen: false, account: null, relatedData: null, message: '' })} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Account: {detailedDeleteModal.account?.name}
              </h3>
              
              <div className="mt-4 space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-yellow-800">
                        Related Data Found
                      </h4>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>{detailedDeleteModal.message}</p>
                        <p className="mt-1 font-medium">These relationships will be automatically removed.</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-700 text-sm">
                  Are you sure you want to proceed with deletion? This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setDetailedDeleteModal({ isOpen: false, account: null, relatedData: null, message: '' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmDetailedDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Yes, Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}