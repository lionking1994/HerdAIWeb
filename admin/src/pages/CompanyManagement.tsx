import { useState, useEffect } from 'react';
import axios from 'axios';
import { Company } from '../types';
import { Search, Building2, Users, Calendar, CheckCircle, XCircle } from 'lucide-react';
import {
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { Switch } from '@headlessui/react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { EnhancedDataTable } from '../components/DataTable'; // Import the EnhancedDataTable

interface ExtendedCompany extends Company {
  isEditing?: boolean;
  admin_name?: string;
  admin_email?: string;
  domain?: string;
  total_users?: number;
  total_meetings?: number;
  total_tasks?: number;
  default_cph?: number;
  available_licenses?: number;
  total_purchased_licenses?: number;
}

const CompanyManagement = () => {
  const [companies, setCompanies] = useState<ExtendedCompany[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<ExtendedCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const { user } = useAuth();
  const [company_domain, setCompanyDomain] = useState('');
  const columnHelper = createColumnHelper<ExtendedCompany>();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  useEffect(() => {
    if (user) {
      setCompanyDomain(user.email.split('@')[1]);
    }
  }, [user]);

  const handleCompanyClick = (company: ExtendedCompany) => {
    if (user?.role !== 'padmin' && user?.role !== 'dev' && company_domain !== company.domain) return;
    window.location.href = `${import.meta.env.VITE_ADMIN_SUBPATH}/?company=${company.id}`;
  };

  // Fix the columns by properly typing them
  const columns: any[] = [
    columnHelper.accessor('name' as const, {
      header: 'Company Name',
      cell: (info) => {
        const company = info.row.original;
        const canAccess = (user?.role === 'padmin' || user?.role === 'dev') || company_domain === company.domain;
        return (
          <button
            onClick={() => handleCompanyClick(company)}
            disabled={!canAccess}
            className={`flex items-center text-left ${canAccess
              ? "text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
              : "text-gray-600 dark:text-gray-300 cursor-not-allowed"
              }`}
          >
            <Building2 className={`h-4 w-4 mr-2 ${canAccess ? "text-indigo-600" : "text-gray-600 dark:text-gray-300"}`} />
            {info.getValue()}
          </button>
        );
      },
    }),
    columnHelper.accessor('domain' as const, {
      header: 'Domain',
      cell: (info) => (
        <div className="text-gray-600 dark:text-gray-300">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('admin_name' as const, {
      header: 'Admin',
      cell: (info) => (
        <div className="text-gray-600 dark:text-gray-300">
          {info.getValue() || 'Not assigned'}
        </div>
      ),
    }),
    columnHelper.accessor('admin_email' as const, {
      header: 'Admin Email',
      cell: (info) => (
        <div className="text-gray-600 dark:text-gray-300">
          {info.getValue() || 'N/A'}
        </div>
      ),
    }),
    columnHelper.accessor('total_users' as const, {
      header: 'Total Users',
      cell: (info) => (
        <div className="flex items-center text-gray-600 dark:text-gray-300">
          <Users className="h-4 w-4 mr-2 text-indigo-500" />
          {info.getValue() || 0}
        </div>
      ),
    }),
    columnHelper.accessor('total_meetings' as const, {
      header: 'Total Activities',
      cell: (info) => (
        <div className="flex items-center text-gray-600 dark:text-gray-300">
          <Calendar className="h-4 w-4 mr-2 text-indigo-500" />
          {info.getValue() || 0}
        </div>
      ),
    }),
    columnHelper.accessor('total_tasks' as const, {
      header: 'Total Tasks',
      cell: (info) => (
        <div className="flex items-center text-gray-600 dark:text-gray-300">
          <Calendar className="h-4 w-4 mr-2 text-indigo-500" />
          {info.getValue() || 0}
        </div>
      ),
    }),
    columnHelper.accessor('default_cph' as const, {
      header: 'Default CPH',
      cell: (info) => (
        <div className="flex items-center text-gray-600 dark:text-gray-300">
          <span className="mr-1">$</span>{info.getValue() !== undefined && info.getValue() !== null ? info.getValue() : 'N/A'}
        </div>
      ),
    }),
    columnHelper.accessor('available_licenses' as const, {
      header: 'Available Licenses',
      cell: (info) => (
        <div className="text-gray-900 dark:text-gray-100 font-semibold text-center">
          {info.getValue() ?? 0}
        </div>
      ),
    }),
    columnHelper.accessor('total_purchased_licenses' as const, {
      header: 'Total Purchased',
      cell: (info) => (
        <div className="text-gray-900 dark:text-gray-100 font-semibold text-center">
          {info.getValue() ?? 0}
        </div>
      ),
    }),
  ];

  // Add enabled column conditionally after defining base columns
  const allColumns = user?.role === 'padmin'
    ? [...columns, columnHelper.accessor('enabled' as const, {
        header: 'Status',
        cell: (info) => {
          const company = info.row.original;
          return (
            <div className="flex items-center">
              <Switch
                checked={company.enabled}
                onChange={() => handleToggleEnabled(company)}
                className={`${company.enabled ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2`}
              >
                <span className="sr-only">Enable company</span>
                <span
                  className={`${company.enabled ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </Switch>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                {company.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          );
        },
        enableSorting: true,
    })]
    : columns;

  // Update sorting change handler
  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting);
    // Apply sorting to filtered companies
    // applyFiltersAndSorting();
  };

  // Filter and sort companies locally
  const applyFiltersAndSorting = () => {
    let filtered = companies;
    console.log(globalFilter)
    // Apply global filter
    if (globalFilter) {
      filtered = companies.filter(company =>
        company.name.toLowerCase().includes(globalFilter.toLowerCase()) ||
        company.domain?.toLowerCase().includes(globalFilter.toLowerCase()) ||
        company.admin_name?.toLowerCase().includes(globalFilter.toLowerCase()) ||
        company.admin_email?.toLowerCase().includes(globalFilter.toLowerCase())
      );
    }

    // Apply sorting
    if (sorting.length > 0) {
      const sort = sorting[0];
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sort.id as keyof ExtendedCompany];
        const bValue = b[sort.id as keyof ExtendedCompany];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = aValue < bValue ? -1 : 1;
        return sort.desc ? -comparison : comparison;
      });
    }

    setFilteredCompanies(filtered);
  };

  // Keep the original API calls
  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/company`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Fetch statistics for each company
      const companiesWithStats = await Promise.all(
        response.data.companies.map(async (company: ExtendedCompany) => {
          try {
            const statsResponse = await axios.get(
              `${import.meta.env.VITE_API_BASE_URL}/company/stats/${company.id}`,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            
            if (statsResponse.data.success) {
              return {
                ...company,
                total_users: statsResponse.data.stats.total_users,
                total_meetings: statsResponse.data.stats.total_meetings,
                total_tasks: statsResponse.data.stats.total_tasks
              };
            }
            return company;
          } catch (error) {
            console.error(`Failed to fetch stats for company ${company.id}:`, error);
            return company;
          }
        })
      );

      setCompanies(companiesWithStats);
      applyFiltersAndSorting();
      setError(null);
    } catch (err) {
      setError('Failed to fetch companies');
      console.error(err);
      toast.error('Failed to fetch companies');
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filters and sorting whenever companies, globalFilter, or sorting changes
  useEffect(() => {
    applyFiltersAndSorting();
  }, [companies, globalFilter, sorting]);

  // Keep the original toggle enabled API call
  const handleToggleEnabled = async (company: ExtendedCompany) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/company/${company.id}/toggle-enabled`,
        { enabled: !company.enabled },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setCompanies(companies.map(c => 
        c.id === company.id ? { ...c, enabled: !c.enabled } : c
      ));

      toast.success(`Company ${company.enabled ? 'disabled' : 'enabled'} successfully`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update company status');
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

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

  // Define appropriate column widths for company data
  const columnWidths = {
    'name': 'w-1/5 min-w-[180px]',           // Company Name
    'domain': 'w-1/6 min-w-[140px]',         // Domain
    'admin_name': 'w-1/6 min-w-[140px]',     // Admin Name
    'admin_email': 'w-1/4 min-w-[200px]',    // Admin Email (needs more space)
    'total_users': 'w-[120px]',               // Total Users (fixed small width)
    'total_meetings': 'w-[150px]',           // Total Activities (fixed small width) 
    'total_tasks': 'w-[120px]',               // Total Tasks (fixed small width)
    'default_cph': 'w-[120px]',               // Default CPH (fixed small width)
    'available_licenses': 'w-[140px]',        // Available Licenses (fixed width)
    'total_purchased_licenses': 'w-[140px]',  // Total Purchased (fixed width)
    'enabled': 'w-[135px]'                   // Status (fixed width for switch)
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header Section */}
      <div className="flex-none p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Company Management
          </h1>
          <div className="flex w-full sm:w-96">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search companies..."
                disabled={isLoading}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 
                  border border-gray-300 dark:border-gray-600 rounded-md
                  text-sm text-gray-900 dark:text-white 
                  placeholder-gray-500 
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
                  transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Scroll */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="p-6 space-y-4">
            {/* Desktop view - Use client-side pagination with custom column widths */}
            <div className="hidden md:block overflow-x-auto">
              <EnhancedDataTable
                columns={allColumns}
                data={filteredCompanies}
                pageSize={pagination.pageSize}
                showPagination={true}
                manualPagination={false} // Client-side pagination
                manualSorting={false} // Client-side sorting handled by table
                sorting={sorting}
                onSortingChange={handleSortingChange}
                isLoading={isLoading}
                totalCount={filteredCompanies.length}
                columnWidths={columnWidths} // Pass custom column widths
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
                      <div className="flex justify-between items-center">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : filteredCompanies
                .slice(
                  pagination.pageIndex * pagination.pageSize,
                  (pagination.pageIndex + 1) * pagination.pageSize
                )
                  .map((company) => {
                  const canAccess = (user?.role === 'padmin' || user?.role === 'dev') || company_domain === company.domain;

                  return (
                    <div
                      key={company.id}
                      className="bg-white dark:bg-gray-800 shadow rounded-lg p-4"
                    >
                      <div className="flex flex-col space-y-2">
                        <div className="flex justify-between items-start">
                          <button
                            onClick={() => handleCompanyClick(company)}
                            disabled={!canAccess}
                            className={`text-lg font-medium ${canAccess
                              ? "text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                              : "text-gray-600 dark:text-gray-300"
                              }`}
                          >
                            <div className="flex items-center">
                              <Building2 className={`h-5 w-5 mr-2 ${canAccess ? "text-indigo-600" : "text-gray-600"}`} />
                              {company.name}
                            </div>
                          </button>
                          {user?.role === 'padmin' && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {company.enabled ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {company.domain}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          Admin: {company.admin_name || 'Not assigned'}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {company.total_users || 0}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {company.total_meetings || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Mobile Pagination */}
              {!isLoading && filteredCompanies.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
                    {Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredCompanies.length)} of{" "}
                    {filteredCompanies.length} results
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
                      {Math.ceil(filteredCompanies.length / pagination.pageSize)}
                    </span>
                    <button
                      className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                      onClick={() => handlePaginationChange({
                        ...pagination,
                        pageIndex: pagination.pageIndex + 1
                      })}
                      disabled={pagination.pageIndex >= Math.ceil(filteredCompanies.length / pagination.pageSize) - 1}
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
    </div>
  );
};

export default CompanyManagement;
