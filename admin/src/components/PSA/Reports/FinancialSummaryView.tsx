import React, { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, PieChart, BarChart3, Calendar, Download, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../lib/api';

interface FinancialSummaryViewProps {
  onBack: () => void;
}

interface FinancialSummaryData {
  summary: {
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
    profitMargin: number;
  };
  kpis: {
    billableHours: number;
    averageHourlyRate: number;
    resourceUtilization: number;
    revenuePerResource: number;
  };
  revenueByDepartment: Record<string, number>;
  projectProfitability: Array<{
    projectId: string;
    projectName: string;
    projectType: string;
    revenue: number;
    costs: number;
    profit: number;
    margin: number;
    status: 'green' | 'yellow' | 'red';
    billableHours: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    revenue: number;
    costs: number;
    profit: number;
  }>;
  insights: Array<{
    type: string;
    title: string;
    message: string;
    color: string;
  }>;
}

export default function FinancialSummaryView({ onBack }: FinancialSummaryViewProps) {
  const [timeRange, setTimeRange] = useState('ytd');
  const [viewType, setViewType] = useState('summary');
  const [financialData, setFinancialData] = useState<FinancialSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');

  // Fetch financial data from API
  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!companyId) {
        throw new Error('Company ID not found in URL parameters');
      }

      const response = await api.get(`/psa/financial-summary/${companyId}`, {
        params: {
          timeRange
        }
      });

      if (response.data.success) {
        setFinancialData(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch financial data');
      }
    } catch (err) {
      console.error('Error fetching financial data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch financial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchFinancialData();
    }
  }, [companyId, timeRange]);

  const exportData = () => {
    if (!financialData) {
      alert('No data available to export');
      return;
    }

    // Prepare CSV data
    const csvData = [
      // Header row
      [
        'Project Name',
        'Project Type',
        'Revenue ($)',
        'Costs ($)',
        'Profit ($)',
        'Margin (%)',
        'Status',
        'Billable Hours'
      ],
      // Data rows
      ...financialData.projectProfitability.map(project => [
        project.projectName,
        project.projectType,
        project.revenue,
        project.costs,
        project.profit,
        project.margin,
        project.status,
        project.billableHours
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
    link.setAttribute('download', `financial-summary-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('Financial summary data exported successfully!');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading financial data...</p>
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Financial Data</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={fetchFinancialData}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!financialData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">No financial data available</p>
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
            <DollarSign className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Financial Summary</h2>
              <p className="text-gray-600">Revenue, costs, and profitability analysis</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="30d">Last 30 Days</option>
            <option value="qtd">Quarter to Date</option>
            <option value="ytd">Year to Date</option>
            <option value="custom">Custom Range</option>
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(financialData.summary.totalRevenue)}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600">+12.5%</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Costs</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(financialData.summary.totalCosts)}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-red-500 mr-1" />
                <span className="text-sm text-red-600">+8.3%</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Gross Profit</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(financialData.summary.grossProfit)}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600">+18.7%</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Profit Margin</p>
              <p className="text-2xl font-bold text-purple-600">{financialData.summary.profitMargin.toFixed(1)}%</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600">+2.1%</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <PieChart className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Revenue</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Costs</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Profit</span>
            </div>
          </div>
        </div>
        
        <div className="relative h-64">
          <div className="absolute inset-0 flex items-end justify-between space-x-2">
            {financialData.monthlyTrends.map((data, index) => {
              const maxValue = Math.max(...financialData.monthlyTrends.map(d => d.revenue));
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full relative mb-2" style={{ height: '200px' }}>
                    <div 
                      className="absolute bottom-0 w-full bg-green-500 rounded-t-lg opacity-80"
                      style={{ height: `${(data.revenue / maxValue) * 100}%` }}
                    ></div>
                    <div 
                      className="absolute bottom-0 w-full bg-red-500 rounded-t-lg opacity-60"
                      style={{ height: `${(data.costs / maxValue) * 100}%` }}
                    ></div>
                    <div 
                      className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg"
                      style={{ height: `${(data.profit / maxValue) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500">{data.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Department</h3>
          <div className="space-y-3">
            {Object.entries(financialData.revenueByDepartment)
              .sort(([,a], [,b]) => b - a)
              .map(([dept, revenue]) => {
                const percentage = (revenue / financialData.summary.totalRevenue) * 100;
                return (
                  <div key={dept} className="flex items-center justify-between">
                    <span className="text-gray-700">{dept}</span>
                    <div className="flex items-center">
                      <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="font-medium text-gray-900 w-20 text-right">
                        {formatCurrency(revenue)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Performance Indicators</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Billable Hours</span>
              <span className="font-medium text-gray-900">{Math.round(financialData.kpis.billableHours).toLocaleString()}h</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Average Hourly Rate</span>
              <span className="font-medium text-gray-900">${Math.round(financialData.kpis.averageHourlyRate)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Resource Utilization</span>
              <span className="font-medium text-gray-900">{Math.round(financialData.kpis.resourceUtilization)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Revenue per Resource</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(financialData.kpis.revenuePerResource)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Project Profitability */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Profitability</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Project</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Revenue</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Costs</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Profit</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Margin</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody>
              {financialData.projectProfitability.map(project => (
                <tr key={project.projectId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{project.projectName}</p>
                      <p className="text-sm text-gray-600 capitalize">{project.projectType}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(project.revenue)}
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(project.costs)}
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-green-600">
                    {formatCurrency(project.profit)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                      project.margin >= 25 ? 'bg-green-100 text-green-800' :
                      project.margin >= 15 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {project.margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      project.status === 'green' ? 'bg-green-100 text-green-800' :
                      project.status === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {project.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}