import { useState, useEffect } from 'react';
import { BarChart3, Download, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import ResourceUtilizationView from '../../components/PSA/Reports/ResourceUtilizationView';
import ProjectPerformanceView from '../../components/PSA/Reports/ProjectPerformanceView';
import SkillsGapView from '../../components/PSA/Reports/SkillsGapView';
import FinancialSummaryView from '../../components/PSA/Reports/FinancialSummaryView';
import CertificationTrackerView from '../../components/PSA/Reports/CertificationTrackerView';
import CapacityPlanningView from '../../components/PSA/Reports/CapacityPlanningView';

// Types for reports data
interface ReportsData {
  resourceUtilization: {
    assignedResources: number;
    totalResources: number;
    assignedPercentage: number;
    benchResources: number;
    benchPercentage: number;
  };
  projectHealth: {
    healthy: number;
    atRisk: number;
    critical: number;
    total: number;
  };
  unstaffedResources: Array<{
    id: string;
    name: string;
    department: string;
    location: string;
    availability: number;
    hourlyRate: number;
    currency: string;
    daysUnstaffed: number;
  }>;
  expiringCertifications: Array<{
    certificationId: string;
    certificationName: string;
    resourceName: string;
    resourceEmail: string;
    expirationDate: string;
    status: string;
    daysUntilExpiry: number;
  }>;
  dateRange: {
    startDate: string;
    endDate: string;
    range: string;
  };
}

export default function Reports() {
  const [dateRange, setDateRange] = useState('ytd');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [showUtilizationView, setShowUtilizationView] = useState(false);
  const [showPerformanceView, setShowPerformanceView] = useState(false);
  const [showSkillsGapView, setShowSkillsGapView] = useState(false);
  const [showFinancialView, setShowFinancialView] = useState(false);
  const [showCertificationView, setShowCertificationView] = useState(false);
  const [showCapacityView, setShowCapacityView] = useState(false);
  const [reportsData, setReportsData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');

  // Fetch reports data from API
  const fetchReportsData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!companyId) {
        throw new Error('Company ID not found in URL parameters');
      }

      // Build query parameters
      let queryParams = `dateRange=${dateRange}`;
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        queryParams += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }

      const response = await api.get(`/psa/reports/${companyId}?${queryParams}`);

      if (response.data.success) {
        setReportsData(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch reports data');
      }
    } catch (err) {
      console.error('Error fetching reports data:', err);
      setError('Failed to fetch reports data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when component mounts or dateRange changes
  useEffect(() => {
    if (companyId) {
      fetchReportsData();
    }
  }, [companyId, dateRange, customStartDate, customEndDate]);

  // Handle date range change
  const handleDateRangeChange = (newDateRange: string) => {
    setDateRange(newDateRange);
    setShowCustomRange(newDateRange === 'custom');
    
    // Set default custom dates if switching to custom
    if (newDateRange === 'custom' && !customStartDate && !customEndDate) {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      setCustomStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
      setCustomEndDate(today.toISOString().split('T')[0]);
    }
  };

  const generateReport = (type: string) => {
    console.log(`Generating ${type} report...`);
    
    if (!reportsData) {
      alert('No data available to export');
      return;
    }

    try {
      let exportData;
      let filename;
      
      switch (type) {
        case 'resource-utilization':
          exportData = {
            reportType: 'Resource Utilization',
            generatedAt: new Date().toISOString(),
            dateRange: reportsData.dateRange,
            data: {
              assignedResources: reportsData.resourceUtilization.assignedResources,
              totalResources: reportsData.resourceUtilization.totalResources,
              assignedPercentage: reportsData.resourceUtilization.assignedPercentage,
              benchResources: reportsData.resourceUtilization.benchResources,
              benchPercentage: reportsData.resourceUtilization.benchPercentage,
              unstaffedResources: reportsData.unstaffedResources
            }
          };
          filename = `resource-utilization-report-${new Date().toISOString().split('T')[0]}.json`;
          break;
          
        case 'project-health':
          exportData = {
            reportType: 'Project Health Summary',
            generatedAt: new Date().toISOString(),
            dateRange: reportsData.dateRange,
            data: {
              healthy: reportsData.projectHealth.healthy,
              atRisk: reportsData.projectHealth.atRisk,
              critical: reportsData.projectHealth.critical,
              total: reportsData.projectHealth.total
            }
          };
          filename = `project-health-report-${new Date().toISOString().split('T')[0]}.json`;
          break;
          
        case 'comprehensive':
          exportData = {
            reportType: 'Comprehensive Reports',
            generatedAt: new Date().toISOString(),
            dateRange: reportsData.dateRange,
            data: reportsData
          };
          filename = `comprehensive-reports-${new Date().toISOString().split('T')[0]}.json`;
          break;
          
        default:
          exportData = {
            reportType: type,
            generatedAt: new Date().toISOString(),
            dateRange: reportsData.dateRange,
            data: reportsData
          };
          filename = `${type}-report-${new Date().toISOString().split('T')[0]}.json`;
      }

      // Create and download the file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log(`${type} report exported successfully!`);
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to export report. Please try again.');
    }
  };

  // Use real data or fallback to empty arrays
  const unstaffedResources = reportsData?.unstaffedResources || [];
  const expiringCerts = reportsData?.expiringCertifications || [];
  const metrics = reportsData ? {
    assignedResources: reportsData.resourceUtilization.assignedResources,
    totalResources: reportsData.resourceUtilization.totalResources,
    benchPercentage: reportsData.resourceUtilization.benchPercentage,
    projectHealth: {
      green: reportsData.projectHealth.healthy,
      yellow: reportsData.projectHealth.atRisk,
      red: reportsData.projectHealth.critical
    }
  } : {
    assignedResources: 0,
    totalResources: 0,
    benchPercentage: 0,
    projectHealth: { green: 0, yellow: 0, red: 0 }
  };

  // If showing utilization view, render that instead
  if (showUtilizationView) {
    return (
      <ResourceUtilizationView
        onBack={() => setShowUtilizationView(false)}
      />
    );
  }

  // If showing performance view, render that instead
  if (showPerformanceView) {
    return (
      <ProjectPerformanceView
        onBack={() => setShowPerformanceView(false)}
      />
    );
  }

  // If showing skills gap view, render that instead
  if (showSkillsGapView) {
    return (
      <SkillsGapView
        onBack={() => setShowSkillsGapView(false)}
      />
    );
  }

  // If showing financial view, render that instead
  if (showFinancialView) {
    return (
      <FinancialSummaryView
        onBack={() => setShowFinancialView(false)}
      />
    );
  }

  // If showing certification view, render that instead
  if (showCertificationView) {
    return (
      <CertificationTrackerView
        onBack={() => setShowCertificationView(false)}
      />
    );
  }

  // If showing capacity view, render that instead
  if (showCapacityView) {
    return (
      <CapacityPlanningView
        onBack={() => setShowCapacityView(false)}
      />
    );
  }
  return (
    <div className="psa-page-container">
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
                <p className="text-gray-600">Comprehensive insights and data analysis</p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <select
                value={dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="30d">Last 30 Days</option>
                <option value="qtd">Quarter to Date</option>
                <option value="ytd">Year to Date</option>
                <option value="custom">Custom Range</option>
              </select>
              
              {showCustomRange && (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    disabled={loading}
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    disabled={loading}
                  />
                </div>
              )}
              
              <button
                onClick={() => generateReport('comprehensive')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
                disabled={loading}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading reports data...</p>
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
                      onClick={fetchReportsData}
                      className="mt-2 text-red-600 hover:text-red-500 font-medium"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          {!loading && !error && reportsData && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Resource Utilization</h3>
                <button
                  onClick={() => generateReport('resource-utilization')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Export Data
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Assigned Resources</h4>
                    <p className="text-sm text-gray-600">Currently working on projects</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{metrics.assignedResources}</p>
                    <p className="text-sm text-gray-600">
                      {Math.round((metrics.assignedResources / metrics.totalResources) * 100)}% of total
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Bench Resources</h4>
                    <p className="text-sm text-gray-600">Available for new assignments</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-yellow-600">
                      {metrics.totalResources - metrics.assignedResources}
                    </p>
                    <p className="text-sm text-gray-600">{metrics.benchPercentage}% bench rate</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Project Health Summary</h3>
                <button
                  onClick={() => generateReport('project-health')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Export Data
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                    <span className="font-medium text-gray-900">Healthy Projects</span>
                  </div>
                  <span className="text-xl font-bold text-green-600">{metrics.projectHealth.green}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full mr-3"></div>
                    <span className="font-medium text-gray-900">At Risk Projects</span>
                  </div>
                  <span className="text-xl font-bold text-yellow-600">{metrics.projectHealth.yellow}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-red-500 rounded-full mr-3"></div>
                    <span className="font-medium text-gray-900">Critical Projects</span>
                  </div>
                  <span className="text-xl font-bold text-red-600">{metrics.projectHealth.red}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Unstaffed Resources (30+ Days)</h3>
                <span className="text-sm text-gray-500">{unstaffedResources.length} resources</span>
              </div>

              <div className="space-y-3">
                {unstaffedResources.slice(0, 5).map(resource => (
                  <div key={resource.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{resource.name}</h4>
                      <p className="text-sm text-gray-600">{resource.department} • {resource.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">{resource.availability}% Available</p>
                      <p className="text-xs text-gray-500">${resource.hourlyRate}/hour</p>
                    </div>
                  </div>
                ))}
              </div>

              {unstaffedResources.length > 5 && (
                <div className="mt-4 text-center">
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    View All {unstaffedResources.length} Resources
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Expiring Certifications</h3>
                <span className="text-sm text-gray-500">{expiringCerts.length} certifications</span>
              </div>

              <div className="space-y-3">
                {expiringCerts.map((cert, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{cert.certificationName}</h4>
                      <p className="text-sm text-gray-600">{cert.resourceName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-yellow-600">Expires Soon</p>
                      <p className="text-xs text-gray-500">
                        {new Date(cert.expirationDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Available Reports</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <h4 className="font-medium text-gray-900 mb-2">Resource Utilization Report</h4>
                <p className="text-sm text-gray-600 mb-4">Detailed breakdown of resource allocation and availability</p>
                <button
                  onClick={() => setShowUtilizationView(true)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  View Online Report
                </button>
              </div>

              <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <h4 className="font-medium text-gray-900 mb-2">Project Performance Report</h4>
                <p className="text-sm text-gray-600 mb-4">Analysis of project timelines, budgets, and deliverables</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPerformanceView(true)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    View Online Report
                  </button>
                </div>
              </div>

              <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <h4 className="font-medium text-gray-900 mb-2">Skills Gap Analysis</h4>
                <p className="text-sm text-gray-600 mb-4">Identify skill gaps and training opportunities</p>
                <button
                  onClick={() => setShowSkillsGapView(true)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  View Online Report
                </button>
              </div>

              <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <h4 className="font-medium text-gray-900 mb-2">Financial Summary</h4>
                <p className="text-sm text-gray-600 mb-4">Revenue, costs, and profitability analysis</p>
                <button
                  onClick={() => setShowFinancialView(true)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  View Online Report
                </button>
              </div>

              <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <h4 className="font-medium text-gray-900 mb-2">Certification Tracker</h4>
                <p className="text-sm text-gray-600 mb-4">Monitor certification status and renewal schedules</p>
                <button
                  onClick={() => setShowCertificationView(true)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  View Online Report
                </button>
              </div>

              <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <h4 className="font-medium text-gray-900 mb-2">Capacity Planning</h4>
                <p className="text-sm text-gray-600 mb-4">Forecast resource needs and availability</p>
                <button
                  onClick={() => setShowCapacityView(true)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  View Online Report
                </button>
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}