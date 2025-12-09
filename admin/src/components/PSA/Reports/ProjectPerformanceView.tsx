import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Calendar, DollarSign, Target, AlertTriangle, CheckCircle, Clock, Filter, Search, Download, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../lib/api';

interface ProjectPerformanceViewProps {
  onBack: () => void;
}

interface PerformanceData {
  id: string;
  name: string;
  description: string;
  status: string;
  methodology: string;
  startDate: string;
  endDate: string;
  overallScore: number;
  budgetVariance: number;
  scheduleVariance: number;
  deliverables: {
    completed: number;
    total: number;
    percentage: number;
  };
  costPerformance: {
    spent: number;
    budget: number;
    projected: number;
  };
  health: 'green' | 'yellow' | 'red';
  timeProgress: number;
  workProgress: number;
}

interface PerformanceReportData {
  summary: {
    totalProjects: number;
    onSchedule: number;
    onBudget: number;
    averageScore: number;
  };
  projects: PerformanceData[];
  budgetPerformance: {
    underBudget: number;
    onBudget: number;
    overBudget: number;
  };
  insights: Array<{
    type: string;
    title: string;
    message: string;
    color: string;
  }>;
}

export default function ProjectPerformanceView({ onBack }: ProjectPerformanceViewProps) {
  const [timeRange, setTimeRange] = useState('current');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [performanceData, setPerformanceData] = useState<PerformanceReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');

  // Fetch performance data from API
  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!companyId) {
        throw new Error('Company ID not found in URL parameters');
      }

      const response = await api.get(`/psa/performance-report/${companyId}`, {
        params: {
          timeRange,
          statusFilter
        }
      });

      if (response.data.success) {
        setPerformanceData(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch performance data');
      }
    } catch (err) {
      console.error('Error fetching performance data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchPerformanceData();
    }
  }, [companyId, timeRange, statusFilter]);

  // Filter data based on search term
  const filteredData = performanceData?.projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) || [];

  // Use filtered data for calculations
  const totalProjects = filteredData.length;
  const onTimeProjects = filteredData.filter(p => p.scheduleVariance >= -10).length;
  const onBudgetProjects = filteredData.filter(p => p.budgetVariance <= 10).length;
  const averageScore = totalProjects > 0 ? 
    Math.round(filteredData.reduce((sum, p) => sum + p.overallScore, 0) / totalProjects) : 0;

  const getVarianceColor = (variance: number) => {
    if (variance <= -10) return 'text-red-600 bg-red-100';
    if (variance <= 10) return 'text-green-600 bg-green-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const exportData = () => {
    if (!performanceData) {
      alert('No data available to export');
      return;
    }

    // Prepare CSV data
    const csvData = [
      // Header row
      [
        'Project Name',
        'Status',
        'Methodology',
        'Start Date',
        'End Date',
        'Overall Score',
        'Budget Variance (%)',
        'Schedule Variance (%)',
        'Deliverables Completed',
        'Deliverables Total',
        'Deliverables Percentage (%)',
        'Cost Spent ($)',
        'Budget ($)',
        'Projected Cost ($)',
        'Health Status',
        'Time Progress (%)',
        'Work Progress (%)'
      ],
      // Data rows
      ...performanceData.projects.map(project => [
        project.name,
        project.status,
        project.methodology,
        project.startDate,
        project.endDate,
        project.overallScore,
        project.budgetVariance,
        project.scheduleVariance,
        project.deliverables.completed,
        project.deliverables.total,
        project.deliverables.percentage,
        project.costPerformance.spent,
        project.costPerformance.budget,
        project.costPerformance.projected,
        project.health,
        project.timeProgress,
        project.workProgress
      ])
    ];

    // Convert to CSV string
    const csvContent = csvData.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `project-performance-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('Project performance data exported successfully!');
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading performance data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-red-600" />
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchPerformanceData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!performanceData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Target className="w-8 h-8 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No performance data available</p>
          </div>
        </div>
      </div>
    );
  }

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
              <h2 className="text-2xl font-bold text-gray-900">Project Performance Report</h2>
              <p className="text-gray-600">Comprehensive analysis of budget, timeline, and deliverable performance</p>
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
              <p className="text-sm text-gray-600">Total Project</p>
              <p className="text-2xl font-bold text-gray-900">{totalProjects}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">On Schedule</p>
              <p className="text-2xl font-bold text-green-600">{onTimeProjects}</p>
              <p className="text-xs text-gray-500">{Math.round((onTimeProjects / totalProjects) * 100)}% of total</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">On Budget</p>
              <p className="text-2xl font-bold text-green-600">{onBudgetProjects}</p>
              <p className="text-xs text-gray-500">{Math.round((onBudgetProjects / totalProjects) * 100)}% of total</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Score</p>
              <p className="text-2xl font-bold text-purple-600">{averageScore}</p>
              <p className="text-xs text-gray-500">Performance Index</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
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
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Performance Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Project</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Overall Score</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Budget Variance</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Schedule Variance</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Deliverables</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Cost Performance</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Health</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(project => (
                <tr key={project.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{project.name}</p>
                        <p className="text-sm text-gray-600 capitalize">{project.status} • {project.methodology}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                        <div 
                          className={`h-2 rounded-full ${
                            project.overallScore >= 80 ? 'bg-green-500' :
                            project.overallScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${project.overallScore}%` }}
                        ></div>
                      </div>
                      <span className="font-medium text-gray-900">{project.overallScore}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getVarianceColor(project.budgetVariance)}`}>
                      {project.budgetVariance > 0 ? '+' : ''}{project.budgetVariance}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getVarianceColor(project.scheduleVariance)}`}>
                      {project.scheduleVariance > 0 ? '+' : ''}{project.scheduleVariance}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center">
                      <span className="font-medium text-gray-900">
                        {project.deliverables.completed}/{project.deliverables.total}
                      </span>
                      <span className="ml-2 text-sm text-gray-600">
                        ({project.deliverables.percentage}%)
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="text-right">
                      <p className="font-medium text-gray-900">${project.costPerformance.spent.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">
                        Budget: ${project.costPerformance.budget.toLocaleString()}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center">
                      {project.health === 'green' && <CheckCircle className="w-5 h-5 text-green-500" />}
                      {project.health === 'yellow' && <Clock className="w-5 h-5 text-yellow-500" />}
                      {project.health === 'red' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
          </div>
        )}
      </div>

      {/* Performance Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Under Budget</span>
              <div className="flex items-center">
                <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${totalProjects > 0 ? (performanceData.budgetPerformance.underBudget / totalProjects) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="font-medium text-gray-900">
                  {performanceData.budgetPerformance.underBudget}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">On Budget</span>
              <div className="flex items-center">
                <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full" 
                    style={{ width: `${totalProjects > 0 ? (performanceData.budgetPerformance.onBudget / totalProjects) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="font-medium text-gray-900">
                  {performanceData.budgetPerformance.onBudget}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Over Budget</span>
              <div className="flex items-center">
                <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{ width: `${totalProjects > 0 ? (performanceData.budgetPerformance.overBudget / totalProjects) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="font-medium text-gray-900">
                  {performanceData.budgetPerformance.overBudget}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Performance Insights</h3>
          <div className="space-y-4">
            {performanceData.insights.map((insight, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                insight.color === 'green' ? 'bg-green-50 border-green-200' :
                insight.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                insight.color === 'red' ? 'bg-red-50 border-red-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <h4 className={`font-medium ${
                  insight.color === 'green' ? 'text-green-900' :
                  insight.color === 'yellow' ? 'text-yellow-900' :
                  insight.color === 'red' ? 'text-red-900' :
                  'text-blue-900'
                }`}>
                  {insight.title}
                </h4>
                <p className={`text-sm mt-1 ${
                  insight.color === 'green' ? 'text-green-800' :
                  insight.color === 'yellow' ? 'text-yellow-800' :
                  insight.color === 'red' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {insight.message}
                </p>
              </div>
            ))}
            
            {performanceData.insights.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Target className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                <p>No specific insights available at this time</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}