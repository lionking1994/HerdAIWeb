import { useState, useEffect, useCallback } from 'react';
import { useDeferredValue } from 'react';
import { ColumnDef, SortingState } from '@tanstack/react-table';
import { Opportunity } from '../../types/crm';
import { createCRMService } from '../../services/crm/crmService';
import CrmPaginationTable from '../../components/CRM/CrmPaginationTable';
import OpportunityForm from '../../components/CRM/OpportunityForm';
import SearchBar from '../../components/CRM/SearchBar';
import { formatCurrency } from '../../lib/crm/api';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import ConfirmationModal from '../../components/ui/confirmation-modal';

export default function Opportunities() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; opportunity: Opportunity | null }>({ isOpen: false, opportunity: null });
  const [detailedDeleteModal, setDetailedDeleteModal] = useState<{
    isOpen: boolean;
    opportunity: Opportunity | null;
    relatedData: unknown;
    message: string
  }>({ isOpen: false, opportunity: null, relatedData: null, message: '' });
  const [deletingOpportunityId, setDeletingOpportunityId] = useState<string | null>(null); // Add loading state for delete button

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);

  const { showSuccess, showError } = useToast();

  // Create CRM service instance
  const crmService = companyId ? createCRMService(companyId) : null;

  const loadOpportunities = useCallback(async (page = currentPage, size = pageSize, search = deferredSearchTerm) => {
    if (!crmService) return;

    try {
      setIsLoading(true);
      const response = await crmService.getOpportunities(search, {
        page: page,
        limit: size
      });

      // Handle both old format (array) and new format (object with pagination)
      if (Array.isArray(response)) {
        setOpportunities(response);
        setTotalCount(response.length);
      } else {
        const paginatedResponse = response as { data: Opportunity[]; pagination: { pages: number; total: number } };
        setOpportunities(paginatedResponse.data || []);
        setTotalCount(paginatedResponse.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to load opportunities:', error);
      setOpportunities([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [crmService, currentPage, pageSize, deferredSearchTerm]);

  useEffect(() => {
    if (companyId) {
      setCurrentPage(1); // Reset to first page when search changes
      loadOpportunities();
    }
  }, [deferredSearchTerm, companyId]);

  const handleEdit = (opportunity: Opportunity) => {
    setEditingOpportunity(opportunity);
    setShowForm(true);
  };

  const handleDelete = async (opportunity: Opportunity) => {
    try {
      // Set loading state for this specific opportunity
      setDeletingOpportunityId(opportunity.id);

      // First check if opportunity has related data
      const relatedData = await crmService?.checkOpportunityRelations(opportunity.id);

      if (relatedData?.data?.has_related_data) {
        // Show detailed confirmation modal
        setDetailedDeleteModal({
          isOpen: true,
          opportunity,
          relatedData: relatedData.data,
          message: `This opportunity has ${relatedData.data.contact_count} related contact(s). Deleting will also remove these relationships.`
        });
      } else {
        // No related data, show normal delete confirmation
        setDeleteModal({ isOpen: true, opportunity });
      }
    } catch (error: unknown) {
      console.error('Failed to check opportunity relationships:', error);
      // Fallback to normal delete confirmation
      setDeleteModal({ isOpen: true, opportunity });
    } finally {
      // Clear loading state
      setDeletingOpportunityId(null);
    }
  };

  const confirmDelete = async () => {
    if (!crmService || !deleteModal.opportunity) return;

    try {
      await crmService.deleteOpportunity(deleteModal.opportunity.id);
      await loadOpportunities();
      showSuccess('Opportunity deleted successfully');
    } catch (error: unknown) {
      console.error('Failed to delete opportunity:', error);

      // Extract server error message if available
      let errorMessage = 'Failed to delete opportunity. Please try again.';

      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
        errorMessage = String(error.response.data.message);
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }

      showError(errorMessage);
    } finally {
      setDeleteModal({ isOpen: false, opportunity: null });
    }
  };

  const confirmDetailedDelete = async () => {
    if (!crmService || !detailedDeleteModal.opportunity) return;

    try {
      // Use forceDelete=true to bypass the relationship check
      await crmService.deleteOpportunity(detailedDeleteModal.opportunity.id, true);
      await loadOpportunities();
      showSuccess('Opportunity and related data deleted successfully');
    } catch (error: unknown) {
      console.error('Failed to delete opportunity:', error);

      let errorMessage = 'Failed to delete opportunity. Please try again.';

      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
        errorMessage = String(error.response.data.message);
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }

      showError(errorMessage);
    } finally {
      setDetailedDeleteModal({ isOpen: false, opportunity: null, relatedData: null, message: '' });
    }
  };

  const handleCreate = () => {
    setEditingOpportunity(undefined);
    setShowForm(true);
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadOpportunities(page, pageSize, deferredSearchTerm);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
    loadOpportunities(1, newPageSize, deferredSearchTerm);
  };

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting);
    // For now, we'll just update the state. In a full implementation,
    // you might want to send sorting parameters to the backend
  };

  const handlePaginationChange = (pagination: { pageIndex: number; pageSize: number }) => {
    const page = pagination.pageIndex + 1; // Convert from 0-based to 1-based
    setCurrentPage(page);
    setPageSize(pagination.pageSize);
    loadOpportunities(page, pagination.pageSize, deferredSearchTerm);
  };

  const handleSubmit = async (opportunityData: Partial<Opportunity>) => {
    if (!crmService) return;

    try {
      setIsSubmitting(true);
      if (editingOpportunity) {
        await crmService.updateOpportunity(editingOpportunity.id, opportunityData);
        showSuccess('Opportunity updated successfully');
      } else {
        await crmService.createOpportunity(opportunityData as Omit<Opportunity, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>);
        showSuccess('Opportunity created successfully');
      }
      setShowForm(false);
      await loadOpportunities();
    } catch (error: unknown) {
      console.error('Failed to save opportunity:', error);

      // Extract server error message if available
      let errorMessage = 'Failed to save opportunity. Please try again.';

      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
        errorMessage = String(error.response.data.message);
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }

      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<Opportunity>[] = [
   {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) =>(
        <a
        href={`${window.location.origin}/crm/opportunities/${row.original.id}?company=${companyId}`}
        target="_blank"
          className="text-left text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {row.getValue('name')}
        </a>
      ),
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const amount = row.getValue('amount');
        return amount ? formatCurrency(amount as number) : '-';
      },
    },
    {
      id: 'stage',
      accessorKey: 'stage',
      header: 'Stage',
      cell: ({ row }) => row.getValue('stage') || '-',
    },
    {
      id: 'weight_percentage',
      accessorKey: 'weight_percentage',
      header: 'Probability',
      cell: ({ row }) => {
        const probability = row.getValue('weight_percentage');
        return probability ? `${probability}%` : '-';
      },
    },
    {
      id: 'expected_close_date',
      accessorKey: 'expected_close_date',
      header: 'Expected Close Date',
      cell: ({ row }) => {
        const date = row.getValue('expected_close_date');
        return date ? new Date(date as string).toLocaleDateString() : 'Not set';
      },
    },
    {
      id: 'actual_close_date',
      accessorKey: 'actual_close_date',
      header: 'Actual Close Date',
      cell: ({ row }) => {
        const date = row.getValue('actual_close_date');
        return date ? new Date(date as string).toLocaleDateString() : 'Not set';
      },
    },
    {
      id: 'lead_source',
      accessorKey: 'lead_source',
      header: 'Lead Source',
      cell: ({ row }) => row.getValue('lead_source') || '-',
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
            disabled={deletingOpportunityId === row.original.id}
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(row.original)}
            className={`text-sm font-medium flex items-center space-x-2 ${deletingOpportunityId === row.original.id
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-red-600 hover:text-red-800'
              }`}
            disabled={deletingOpportunityId === row.original.id}
          >
            {deletingOpportunityId === row.original.id ? (
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

  // Column widths for consistent table layout
  const columnWidths = {
    name: '200px',
    amount: '120px',
    stage: '150px',
    weight_percentage: '100px',
    expected_close_date: '140px',
    actual_close_date: '140px',
    lead_source: '120px',
    created_at: '100px',
    actions: '120px'
  };

  return (
    <div className="p-6 crm-page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Opportunities</h1>
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Add Opportunity
        </button>
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search opportunities..."
      />

      <CrmPaginationTable
        columns={columns}
        data={opportunities}
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
        <OpportunityForm
          opportunity={editingOpportunity}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          isSubmitting={isSubmitting}
          existingOpportunities={opportunities}
        />
      )}

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, opportunity: null })}
        onConfirm={confirmDelete}
        title="Delete Opportunity"
        description={`Are you sure you want to delete "${deleteModal.opportunity?.name}" from opportunities?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Enhanced Delete Confirmation Modal for Related Data */}
      {detailedDeleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDetailedDeleteModal({ isOpen: false, opportunity: null, relatedData: null, message: '' })} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Opportunity: {detailedDeleteModal.opportunity?.name}
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
                onClick={() => setDetailedDeleteModal({ isOpen: false, opportunity: null, relatedData: null, message: '' })}
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