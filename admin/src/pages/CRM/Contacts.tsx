import { useState, useEffect, useCallback } from 'react';
import { useDeferredValue } from 'react';
import { ColumnDef, SortingState } from '@tanstack/react-table';
import { Contact } from '../../types/crm';
import { createCRMService } from '../../services/crm/crmService';
import CrmPaginationTable from '../../components/CRM/CrmPaginationTable';
import ContactForm from '../../components/CRM/ContactForm';
import SearchBar from '../../components/CRM/SearchBar';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import ConfirmationModal from '../../components/ui/confirmation-modal';

export default function Contacts() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; contact: Contact | null }>({ isOpen: false, contact: null });
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null); // Add loading state for delete button
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const { showSuccess, showError } = useToast();

  // Create CRM service instance
  const crmService = companyId ? createCRMService(companyId) : null;

  const loadContacts = useCallback(async (page = currentPage, size = pageSize, search = deferredSearchTerm) => {
    if (!crmService) return;
    
    try {
      setIsLoading(true);
      const response = await crmService.getContacts(search, {
        page: page,
        limit: size
      });
      
      // Handle both old format (array) and new format (object with pagination)
      if (Array.isArray(response)) {
        setContacts(response);
        setTotalCount(response.length);
      } else {
        const paginatedResponse = response as { data: Contact[]; pagination: { pages: number; total: number } };
        setContacts(paginatedResponse.data || []);
        setTotalCount(paginatedResponse.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
      setContacts([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [crmService, currentPage, pageSize, deferredSearchTerm]);

  useEffect(() => {
    if (companyId) {
      setCurrentPage(1); // Reset to first page when search changes
      loadContacts();
    }
  }, [deferredSearchTerm, companyId]);

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setShowForm(true);
  };

  const handleDelete = async (contact: Contact) => {
    // Set loading state for this specific contact
    setDeletingContactId(contact.id);

    try {
      setDeleteModal({ isOpen: true, contact });
    } finally {
      // Clear loading state
      setDeletingContactId(null);
    }
  };

  const confirmDelete = async () => {
    if (!crmService || !deleteModal.contact) return;

    try {
      await crmService.deleteContact(deleteModal.contact.id);
      await loadContacts();
      showSuccess('Contact deleted successfully');
    } catch (error: unknown) {
      console.error('Failed to delete contact:', error);

      // Extract server error message if available
      let errorMessage = 'Failed to delete contact. Please try again.';
      const err = error as { response?: { data?: { message?: string } }; message?: string };

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      showError(errorMessage);
    } finally {
      setDeleteModal({ isOpen: false, contact: null });
    }
  };

  const handleCreate = () => {
    setEditingContact(undefined);
    setShowForm(true);
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadContacts(page, pageSize, deferredSearchTerm);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    loadContacts(1, newPageSize, deferredSearchTerm);
  };

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting);
    // You can implement sorting logic here if needed
    // For now, we'll just update the state
  };

  const handlePaginationChange = (pagination: { pageIndex: number; pageSize: number }) => {
    setCurrentPage(pagination.pageIndex + 1);
    setPageSize(pagination.pageSize);
    loadContacts(pagination.pageIndex + 1, pagination.pageSize, deferredSearchTerm);
  };

  const handleSubmit = async (contactData: Partial<Contact>) => {
    if (!crmService) return;

    try {
      setIsSubmitting(true);
      if (editingContact) {
        await crmService.updateContact(editingContact.id, contactData);
        showSuccess('Contact updated successfully');
      } else {
        await crmService.createContact(contactData as Omit<Contact, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>);
        showSuccess('Contact created successfully');
      }
      setShowForm(false);
      await loadContacts();
    } catch (error: unknown) {
      console.error('Failed to save contact:', error);

      // Extract server error message if available
      let errorMessage = 'Failed to save contact. Please try again.';
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

  const columns: ColumnDef<Contact>[] = [
    {
      id: 'first_name',
      accessorKey: 'first_name',
      header: 'First Name',
      cell: ({ row }) => row.getValue('first_name'),
    },
    {
      id: 'last_name',
      accessorKey: 'last_name',
      header: 'Last Name',
      cell: ({ row }) => row.getValue('last_name'),
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
      id: 'title',
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => row.getValue('title') || '-',
    },
    {
      id: 'department',
      accessorKey: 'department',
      header: 'Department',
      cell: ({ row }) => row.getValue('department') || '-',
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
            disabled={deletingContactId === row.original.id}
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(row.original)}
            className={`text-sm font-medium flex items-center space-x-2 ${deletingContactId === row.original.id
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-red-600 hover:text-red-800'
              }`}
            disabled={deletingContactId === row.original.id}
          >
            {deletingContactId === row.original.id ? (
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
    first_name: '150px',
    last_name: '150px',
    email: '200px',
    phone: '150px',
    title: '150px',
    department: '150px',
    created_at: '120px',
    actions: '150px',
  };

  return (
    <div className="p-6 crm-page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Add Contact
        </button>
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search contacts..."
      />

      <CrmPaginationTable
        columns={columns}
        data={contacts}
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
        <ContactForm
          contact={editingContact}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          isSubmitting={isSubmitting}
          existingContacts={contacts}
        />
      )}

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, contact: null })}
        onConfirm={confirmDelete}
        title="Delete Contact"
        description={`Are you sure you want to delete "${deleteModal.contact?.first_name} ${deleteModal.contact?.last_name}" from contacts?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}