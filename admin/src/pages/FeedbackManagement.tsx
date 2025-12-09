import { useState, useEffect } from 'react';
import React from 'react';
import axios from 'axios';
import { DataTable } from '../components/DataTable';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'react-toastify';
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useReactTable, getCoreRowModel, getPaginationRowModel, getFilteredRowModel, ColumnDef } from '@tanstack/react-table';
import FeedbackDrawer from '../components/FeedbackDrawer'; // uses Feedback type local to component

type FeedbackStatus = 'pending' | 'approved' | 'rejected' | 'completed'| 'pr ready';

export interface IFeedback {
  id: string;
  subject: string;
  details: string;
  url: string;
  status: FeedbackStatus;
  date_time: string;
  user_name: string;
  user_email: string;
  user_avatar: string;
  company_name?: string;
  page_id?: string;
  page_name?: string;
  attachment?: string;
  attachment_original_name?: string;
  pr_link: string;
}

interface FeedbackStats {
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  prReady:number
}

// Custom Select components for reusability
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ children, className, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={` bg-white relative flex w-full cursor-default select-none items-center rounded-sm py-2.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

const StatusDropdown = ({ currentStatus, onStatusChange, feedbackId }: {
  currentStatus: FeedbackStatus;
  onStatusChange: (feedbackId: string, newStatus: FeedbackStatus) => void;
  feedbackId: string;
}) => {
  return (
    <select
      value={currentStatus}
      onChange={(e) => onStatusChange(feedbackId, e.target.value as FeedbackStatus)}
      className="block w-full px-3 py-1.5 text-sm border rounded-md 
                focus:outline-none focus:ring-2 focus:ring-blue-500
                bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
    >
      <option value="pending">Pending</option>
      <option value="approved">Approved</option>
      <option value="rejected">Rejected</option>
      <option value="completed">Completed</option>
      <option value="pr ready">Pr ready</option>
    </select>
  );
};

const FeedbackManagement = () => {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<IFeedback[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<IFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [totalFeedbacks, setTotalFeedbacks] = useState(0);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [stats, setStats] = useState<FeedbackStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
    prReady:0
  });
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ subject: string; details: string; url: string }>({ subject: '', details: '', url: '' });

  const openEdit = (fb: IFeedback) => {
    setEditingId(fb.id);
    setEditForm({ subject: fb.subject, details: fb.details, url: fb.url || '' });
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/feedback/update/${editingId}`,
        {
          subject: editForm.subject,
          details: editForm.details,
          url: editForm.url || null
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      toast.success('Feedback updated successfully');
      closeEdit();
      await fetchFeedback();
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast.error('Failed to update feedback');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/feedback/stats`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchFeedback = async () => {
    setIsLoading(true);
    try {
      const endpoint = `${import.meta.env.VITE_API_BASE_URL}/feedback/all`;

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        params: {
          page: pagination.pageIndex + 1,
          per_page: pagination.pageSize,
          filter: globalFilter || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          page_id: selectedPageId || undefined
        }
      });

      setFeedbacks(response.data.data);
      setTotalFeedbacks(response.data.total);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error('Failed to fetch feedback data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
    fetchStats();
  }, [user?.role, statusFilter, pagination.pageIndex, pagination.pageSize, globalFilter, selectedPageId]);

  const handleStatusUpdate = async (feedbackId: string, newStatus: FeedbackStatus) => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/feedback/update-status`,
        {
          feedbackId,
          status: newStatus
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      // Refresh the feedback list and stats
      await fetchFeedback();
      await fetchStats();

      toast.success(`Feedback status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating feedback status:', error);
      toast.error('Failed to update feedback status');
    }
  };

  const columns = [
    {
      header: 'Subject',
      accessorKey: 'subject',
      cell: (row: { getValue: () => string; row: { original: IFeedback } }) => (
        <div className="max-w-[150px] sm:max-w-[200px] truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
          onClick={() => {
            setSelectedFeedback(row.row.original);
            setIsDrawerOpen(true);
          }}>
          {row.row.original.subject}
        </div>
      )
    },
    {
      header: 'User',
      cell: (row: { row: { original: IFeedback } }) => {
        const { user_name, user_email, user_avatar, company_name } = row.row.original;
        return (
          <div className="flex items-center gap-2 min-w-[200px]">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full overflow-hidden flex-shrink-0">
              {user_avatar ? <img
                src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${user_avatar}`}
                alt={user_name}
                className="h-full w-full object-cover"
              /> : <div className="h-full w-full bg-gray-200 rounded-full flex items-center justify-center">
                  {user_name.toUpperCase().charAt(0)}
              </div>
              }
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate">{user_name}</div>
              <div className="text-xs sm:text-sm text-gray-500 truncate">{user_email}</div>
              {company_name && (
                <div className="text-xs text-gray-400 truncate">{company_name}</div>
              )}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Details',
      accessorKey: 'details',
      cell: (row: { row: { original: IFeedback } }) => (
        <div className="max-w-[150px] sm:max-w-[300px] truncate" title={row.row.original.details}>
          {row.row.original.details}
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row: { row: { original: IFeedback } }) => {
        const status = row.row.original.status as FeedbackStatus;
        const isPlatformAdmin = user?.role === 'padmin';

        if (isPlatformAdmin) {
          return (
            <div className="flex items-center gap-2">
              <StatusDropdown
                currentStatus={status}
                onStatusChange={handleStatusUpdate}
                feedbackId={row.row.original.id}
              />
              <Badge variant={
                status === 'approved' ? 'success' :
                  status === 'rejected' ? 'destructive' :
                    status === 'completed' ? 'outline' : 'default'
              }>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
            </div>
          );
        }

        return (
          <Badge variant={
            status === 'approved' ? 'success' :
              status === 'rejected' ? 'destructive' :
                status === 'completed' ? 'outline' : 'default'
          }>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      }
    },
    {
      header: 'Date Time',
      accessorKey: 'date_time',
      cell: (row: { row: { original: IFeedback } }) => (
        <div className="min-w-[100px] text-xs sm:text-sm">
          {new Date(row.row.original.date_time).toLocaleDateString()}
        </div>
      )
    },
    {
      header: 'Actions',
      cell: (row: { row: { original: IFeedback } }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openEdit(row.row.original)}>Edit</Button>
        </div>
      )
    }
  ];

  const table = useReactTable({
    data: feedbacks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    pageCount: Math.ceil(totalFeedbacks / pagination.pageSize),
    manualPagination: true,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
  });

  return (
    <div className="container mx-auto p-6 h-full overflow-auto">
      {/* Stats Section */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Pending', value: stats.pending, color: 'bg-yellow-100 text-yellow-800' },
          { label: 'Approved', value: stats.approved, color: 'bg-green-100 text-green-800' },
          { label: 'Rejected', value: stats.rejected, color: 'bg-red-100 text-red-800' },
          { label: 'Pr ready', value: stats.prReady, color: 'bg-yellow-100 text-yellow-800' },
          { label: 'Completed', value: stats.completed, color: 'bg-blue-100 text-blue-800' }
        ].map((stat) => (
          <Button
            key={stat.label}
            variant="outline"
            className={`${stat.color} hover:opacity-80 h-full ${statusFilter === stat.label.toLowerCase() ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => {
              setStatusFilter(stat.label.toLowerCase());
              setPagination({ ...pagination, pageIndex: 0 });
            }}
          >
            <div className="flex flex-col items-center w-full">
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm">{stat.label}</div>
            </div>
          </Button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex justify-end gap-4 mb-6">
        <Input
          placeholder="Search feedback..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />

        {/* <SelectPrimitive.Root value={statusFilter} onValueChange={setStatusFilter}>
          <SelectPrimitive.Trigger className="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <span className="flex items-center gap-2">
              <span>Filter by Status</span>
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80">
              <SelectPrimitive.Viewport className="p-1">
                <SelectPrimitive.Item value="all" className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>All Status</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
                {['pending', 'approved', 'rejected', 'completed'].map((status) => (
                  <SelectPrimitive.Item
                    key={status}
                    value={status}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root> */}

        {selectedPageId && (
          <Button
            variant="outline"
            onClick={() => setSelectedPageId(null)}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear Page Filter
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2">Loading feedbacks...</span>
            </div>
          ) : (
              <DataTable
                columns={columns as ColumnDef<IFeedback>[]}
                data={feedbacks}
              />
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-2 py-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">
            Page{' '}
            <strong>
              {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </strong>
          </span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => {
              table.setPageSize(Number(e.target.value));
            }}
            className="px-2 py-1 rounded border"
          >
            {[5, 10, 20, 30, 40, 50].map(pageSize => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-gray-700">
          Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
          {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalFeedbacks)} of{' '}
          {totalFeedbacks} results
        </div>
      </div>

      {/* IFeedback Details Drawer */}
      <FeedbackDrawer
        feedback={selectedFeedback as IFeedback}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onStatusChange={handleStatusUpdate}
        isPlatformAdmin={user?.role === 'padmin'}
        setSelectedFeedback={setSelectedFeedback}
      />

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Feedback</h3>
              <button onClick={closeEdit} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Subject</label>
                <Input
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Details</label>
                <textarea
                  value={editForm.details}
                  onChange={(e) => setEditForm({ ...editForm, details: e.target.value })}
                  placeholder="Details"
                  className="w-full min-h-[120px] px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">URL</label>
                <Input
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  placeholder="https://example.com/path"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={closeEdit}>Cancel</Button>
              <Button className="bg-blue-500 hover:bg-blue-600" onClick={saveEdit} disabled={!editForm.subject || !editForm.details || !editForm.url}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackManagement;








