import { useState, useEffect } from 'react';
import { ArrowLeft, Users, TrendingUp, Calendar, Download, Search, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../lib/api';

// Types for API response
interface ResourceUtilizationData {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  department: string;
  location: string;
  availability: number;
  hourlyRate: number;
  currency: string;
  hoursPerWeek: number;
  utilization: number;
  billableHours: number;
  weeklyRevenue: number;
  assignedProjects: number;
  assignedProjectsList: Array<{
    id: string;
    name: string;
    allocation: number;
    role: string;
  }>;
  benchTime: number;
  status: 'over-utilized' | 'optimal' | 'under-utilized' | 'available';
}

interface ResourceUtilizationResponse {
  resources: ResourceUtilizationData[];
  summary: {
    totalResources: number;
    averageUtilization: number;
    totalWeeklyRevenue: number;
    benchResources: number;
    overUtilized: number;
    optimalUtilized: number;
    underUtilized: number;
    availableResources: number;
  };
  distribution: {
    overUtilized: number;
    optimal: number;
    underUtilized: number;
    available: number;
  };
  filters: {
    departments: string[];
    timeRange: string;
    department: string;
    search: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
    range: string;
  };
}

interface ResourceUtilizationViewProps {
  onBack: () => void;
}

export default function ResourceUtilizationView({ onBack }: ResourceUtilizationViewProps) {
  const [timeRange, setTimeRange] = useState('current');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<ResourceUtilizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');

  // Fetch resource utilization data from API
  const fetchResourceUtilizationData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!companyId) {
        throw new Error('Company ID not found in URL parameters');
      }

      const params = new URLSearchParams({
        timeRange,
        department: departmentFilter,
        search: searchTerm,
        page: '1',
        limit: '100'
      });

      const response = await api.get(`/psa/reports/resource-utilization/${companyId}?${params}`);

      if (response.data.success) {
        setData(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch resource utilization data');
      }
    } catch (err) {
      console.error('Error fetching resource utilization data:', err);
      setError('Failed to fetch resource utilization data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when filters change
  useEffect(() => {
    if (companyId) {
      fetchResourceUtilizationData();
    }
  }, [companyId, timeRange, departmentFilter, searchTerm]);

  // Debounced search to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (companyId) {
        fetchResourceUtilizationData();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Use API data or fallback to empty state
  const resources = data?.resources || [];
  const summary = data?.summary || {
    totalResources: 0,
    averageUtilization: 0,
    totalWeeklyRevenue: 0,
    benchResources: 0,
    overUtilized: 0,
    optimalUtilized: 0,
    underUtilized: 0,
    availableResources: 0
  };
  const distribution = data?.distribution || {
    overUtilized: 0,
    optimal: 0,
    underUtilized: 0,
    available: 0
  };
  const departments = data?.filters?.departments || [];

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return 'text-red-600 bg-red-100';
    if (utilization >= 80) return 'text-green-600 bg-green-100';
    if (utilization >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-blue-600 bg-blue-100';
  };

  const getUtilizationStatus = (utilization: number) => {
    if (utilization >= 90) return 'Over-utilized';
    if (utilization >= 80) return 'Optimal';
    if (utilization >= 60) return 'Under-utilized';
    return 'Available';
  };

  const exportData = () => {
    if (!data) return;
    
    // Create CSV data
    const csvHeaders = [
      'Name', 'Email', 'Department', 'Location', 'Utilization %', 'Status', 
      'Billable Hours', 'Projects', 'Weekly Revenue', 'Bench Time %'
    ];
    
    const csvData = resources.map(resource => [
      resource.name,
      resource.email,
      resource.department,
      resource.location,
      resource.utilization,
      resource.status,
      resource.billableHours,
      resource.assignedProjects,
      resource.weeklyRevenue,
      resource.benchTime
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resource-utilization-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors mr-4"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Resource Utilization Report</h2>
              <p className="text-gray-600">Real-time view of resource allocation and utilization</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="current">Current Period</option>
            <option value="last30">Last 30 Days</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button 
            onClick={exportData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Resources</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalResources}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Utilization</p>
              <p className="text-2xl font-bold text-green-600">{summary.averageUtilization}%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Weekly Revenue</p>
              <p className="text-2xl font-bold text-purple-600">${summary.totalWeeklyRevenue.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bench Resources</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.benchResources}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading resource utilization data...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                  <button
                    onClick={fetchResourceUtilizationData}
                    className="mt-2 text-red-600 hover:text-red-500 font-medium"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Utilization Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Resource</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Department</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Utilization</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Billable Hours</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Projects</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Weekly Revenue</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Bench Time</th>
                </tr>
              </thead>
              <tbody>
                {resources.map(resource => (
                  <tr key={resource.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        {resource.avatar ? (
                          <img 
                            src={resource.avatar} 
                            alt={resource.name}
                            className="w-10 h-10 rounded-lg mr-3 object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                            <Users className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{resource.name}</p>
                          <p className="text-sm text-gray-600">{resource.location}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-900">{resource.department}</td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className={`h-2 rounded-full ${
                              resource.utilization >= 90 ? 'bg-red-500' :
                              resource.utilization >= 80 ? 'bg-green-500' :
                              resource.utilization >= 60 ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(resource.utilization, 100)}%` }}
                          ></div>
                        </div>
                        <span className="font-medium text-gray-900">{resource.utilization}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getUtilizationColor(resource.utilization)}`}>
                        {getUtilizationStatus(resource.utilization)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center font-medium text-gray-900">
                      {resource.billableHours}h
                    </td>
                    <td className="py-4 px-4 text-center font-medium text-gray-900">
                      {resource.assignedProjects}
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-gray-900">
                      ${resource.weeklyRevenue.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-sm ${
                        resource.benchTime > 20 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {resource.benchTime}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && resources.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No resources found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
          </div>
        )}
      </div>

      {/* Utilization Insights */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Utilization Distribution</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Over-utilized (90%+)</span>
                <div className="flex items-center">
                  <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{ width: `${summary.totalResources > 0 ? (distribution.overUtilized / summary.totalResources) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="font-medium text-gray-900">
                    {distribution.overUtilized}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Optimal (80-89%)</span>
                <div className="flex items-center">
                  <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${summary.totalResources > 0 ? (distribution.optimal / summary.totalResources) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="font-medium text-gray-900">
                    {distribution.optimal}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Under-utilized (60-79%)</span>
                <div className="flex items-center">
                  <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full" 
                      style={{ width: `${summary.totalResources > 0 ? (distribution.underUtilized / summary.totalResources) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="font-medium text-gray-900">
                    {distribution.underUtilized}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Available (&lt;60%)</span>
                <div className="flex items-center">
                  <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${summary.totalResources > 0 ? (distribution.available / summary.totalResources) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="font-medium text-gray-900">
                    {distribution.available}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900">Optimal Utilization</h4>
                <p className="text-sm text-green-800 mt-1">
                  {distribution.optimal} resources 
                  are operating at optimal utilization levels
                </p>
              </div>
              
              {distribution.overUtilized > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-medium text-red-900">Over-utilization Alert</h4>
                  <p className="text-sm text-red-800 mt-1">
                    {distribution.overUtilized} resources 
                    may be at risk of burnout
                  </p>
                </div>
              )}
              
              {summary.benchResources > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900">Available Capacity</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    {summary.benchResources} resources available for new project assignments
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}