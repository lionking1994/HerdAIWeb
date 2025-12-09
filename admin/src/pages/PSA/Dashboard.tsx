import { useState, useEffect } from 'react';
import { Users, FolderKanban, TrendingUp, AlertTriangle, Award, Clock, ChevronUp, MapPin, Star, Loader2 } from 'lucide-react';
import MetricCard from '../../components/PSA/Dashboard/MetricCard';
import ProjectHealthChart from '../../components/PSA/Dashboard/ProjectHealthChart';
import UtilizationTrendChart from '../../components/PSA/Dashboard/UtilizationTrendChart';
import ResourceEditModal from '../../components/PSA/Resources/ResourceEditModal';
import { useToast } from '../../hooks/useToast';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { Resource } from '../../components/PSA/Dashboard/types';

// Dashboard data types
interface DashboardData {
  keyMetrics: {
    totalResources: { value: number; change: number; trend: string };
    assignedResources: { value: number; trend: string };
    benchPercentage: { value: number; change: number; trend: string };
    activeProjects: { value: number; trend: string };
    unstaffedProjects: { value: number; trend: string };
    expiringCertifications: { value: number; trend: string };
  };
  projectHealth: {
    healthy: number;
    atRisk: number;
    critical: number;
    overallScore: number;
  };
  utilization: {
    current: number;
    bench: number;
    trend: Array<{
      date: string;
      utilization: number;
      bench: number;
    }>;
  };
  recentActivity: Array<{
    type: string;
    message: string;
    timeAgo: string;
    color: string;
  }>;
}

export default function Dashboard() {
  const { showError, showSuccess } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  
  // ResourceEditModal state
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [companyRoles, setCompanyRoles] = useState<any[]>([]);

  // Fetch dashboard data from API
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      if (!companyId) {
        throw new Error('Company ID not found in URL parameters');
      }

      // Fetch both dashboard data and quarterly utilization trends
      const [dashboardResponse, quarterlyResponse] = await Promise.all([
        api.get(`/psa/dashboard?companyId=${companyId}`),
        api.get(`/psa/reports/quarterly-utilization/${companyId}`)
      ]);
      
      if (dashboardResponse.data.success && quarterlyResponse.data.success) {
        const dashboardData = dashboardResponse.data.data;
        const quarterlyData = quarterlyResponse.data.data;
        
        // Update utilization trend with quarterly data
        dashboardData.utilization.trend = quarterlyData.quarters;
        
        setDashboardData(dashboardData);
        console.log('✅ Dashboard data with quarterly trends fetched successfully:', dashboardData);
      } else {
        throw new Error(dashboardResponse.data.message || quarterlyResponse.data.message || 'Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      showError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch company roles for ResourceEditModal
  const fetchCompanyRoles = async () => {
    try {
      if (!companyId) return;
      
      const response = await api.get(`/psa/companyroles/${companyId}`);
      if (response.data.success) {
        setCompanyRoles(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching company roles:', error);
    }
  };

  // Handle resource selection for editing
  const handleResourceSelect = async (resourceData: any) => {
    try {
      // Show loading state
      setLoading(true);
      
      // Call GET resource by ID API to get detailed data including skills, certifications, department
      console.log('Resource data from Dashboard:', resourceData);
      console.log('Using resource_id:', resourceData.resource_id);
      
      const response = await api.get(`/psa/resources/${resourceData.resource_id}?companyId=${companyId}`);
      
      if (response.data.success) {
        const detailedResource = response.data.data;
        
        // Transform detailed API resource data to Resource interface
        const resource: Resource = {
          id: detailedResource.resource_id.toString(),
          userId: detailedResource.user_id.toString(),
          user: {
            id: detailedResource.user_id.toString(),
            name: detailedResource.name,
            email: detailedResource.email,
            role: detailedResource.role as any
          },
          department: detailedResource.department_name || '',
          departmentId: detailedResource.department_id || null,
          location: detailedResource.location || '',
          hourlyRate: parseFloat(detailedResource.hourly_rate || '0'),
          availability: parseFloat(detailedResource.availability || '0'),
          performanceRating: parseFloat(detailedResource.performance_rating || '0'),
          isActive: true,
          hireDate: detailedResource.hire_date || '',
          totalProjectHours: 0,
          successfulProjects: 0,
          skills: detailedResource.skills.map((existing: any) => ({
            skillId: existing.id,
            skill: {
              id: existing.id,
              name: existing.name,
              category: existing.category,
              description: existing.description
            },
            proficiencyLevel: existing.proficiency_level as any,
            yearsExperience: existing.years_experience,
            lastUsed: existing.last_used ? existing.last_used.split('T')[0] : undefined
          })),
          certifications: detailedResource.certifications.map((existing: any) => ({
            certificationId: existing.id,
            certification: {
              id: existing.id,
              name: existing.name,
              issuingOrganization: existing.issuing_organization,
              description: existing.description,
              expirationDate: existing.expiration_date
            },
            dateObtained: existing.date_obtained ? existing.date_obtained.split('T')[0] : '',
            expirationDate: existing.expiration_date ? existing.expiration_date.split('T')[0] : undefined,
            status: existing.status as any,
            certificateNumber: existing.certificate_number || undefined,
            verificationUrl: existing.verification_url || undefined
          })),
          activeProjects: resourceData.assignedProjects || [],
          resource: {
            resource_id: detailedResource.resource_id || '',
            employment_type: detailedResource.employment_type,
            level: detailedResource.level,
            cost_center: detailedResource.cost_center,
            working_days: detailedResource.working_days,
            hours_per_week: detailedResource.hours_per_week
          }
        };
        
        console.log('Detailed resource data loaded:', resource);
        setSelectedResource(resource);
        setShowEditModal(true);
      } else {
        throw new Error(response.data.message || 'Failed to fetch resource details');
      }
    } catch (error) {
      console.error('Error fetching resource details:', error);
      showError('Failed to load resource details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle resource save
  const handleResourceSave = async (updatedResource: Resource) => {
    try {
      console.log('Resource updated:', updatedResource);
      
      // Close the modal
      setShowEditModal(false);
      setSelectedResource(null);
      
      // Refresh dashboard data to show updated information
      await fetchDashboardData();
      
      // Show success message
      showSuccess('Resource updated successfully!');
      console.log('✅ Resource updated successfully and dashboard refreshed');
    } catch (error) {
      console.error('❌ Error refreshing dashboard after resource update:', error);
      showError('Resource updated but failed to refresh dashboard. Please refresh manually.');
    }
  };

  // Load dashboard data and company roles on component mount
  useEffect(() => {
    fetchDashboardData();
    fetchCompanyRoles();
  }, [companyId]);

  const handleMetricClick = (metricType: string) => {
    if (activeMetric === metricType) {
      setActiveMetric(null);
    } else {
      setActiveMetric(metricType);
      // Fetch details if not already loaded
      if (!metricDetails[metricType]) {
        fetchMetricDetails(metricType);
      }
    }
  };

  const [metricDetails, setMetricDetails] = useState<{[key: string]: any[]}>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchMetricDetails = async (metricType: string) => {
    try {
      setLoadingDetails(true);
      
      if (!companyId) {
        throw new Error('Company ID not found in URL parameters');
      }

      const response = await api.get(`/psa/dashboard/metrics/${companyId}?metricType=${metricType}`);
      
      if (response.data.success) {
        setMetricDetails(prev => ({
          ...prev,
          [metricType]: response.data.data
        }));
        console.log(`✅ ${metricType} details fetched successfully:`, response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch metric details');
      }
    } catch (error) {
      console.error(`❌ Error fetching ${metricType} details:`, error);
      showError(`Failed to load ${metricType} details. Please try again.`);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getMetricDetails = (metricType: string) => {
    const titles = {
      'total-resources': 'All Resources',
      'assigned-resources': 'Assigned Resources',
      'bench-percentage': 'Bench Resources',
      'active-projects': 'Active Projects',
      'unstaffed-projects': 'Unstaffed Projects',
      'expiring-certifications': 'Expiring Certifications'
    };

    return {
      title: titles[metricType as keyof typeof titles] || '',
      data: metricDetails[metricType] || []
    };
  };

  const renderDetailItem = (item: any) => {
    if (item.type === 'resource') {
      return (
        <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-4">
              {item.avatar ? (
                <img 
                  src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${item.avatar}`} 
                  alt={item.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <Users className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleResourceSelect(item);
                }}
                className="font-medium text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
              >
                {item.name}
              </button>
              <div className="flex items-center text-sm text-gray-600 space-x-4">
                <span>{item.department}</span>
                <div className="flex items-center">
                  <MapPin className="w-3 h-3 mr-1" />
                  {item.location}
                </div>
                {item.assignedProjects && item.assignedProjects.length > 0 && (
                  <div className="flex items-center flex-wrap gap-2">
                    <FolderKanban className="w-3 h-3 mr-1" />
                    {item.assignedProjects.map((project: any, index: number) => (
                      <div key={project.id} className="flex items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navigate to project details in the same tab
                            const url = companyId 
                              ? `/admin/psa/projects?company=${companyId}&project=${project.id}`
                              : `/admin/psa/projects?project=${project.id}`;
                            window.location.href = url;
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {project.name}
                        </button>
                        <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{project.role}</span>
                        {index < item.assignedProjects.length - 1 && <span className="mx-1 text-gray-400">•</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <div className="text-center">
              <p className="font-medium text-gray-900">{item.availability}%</p>
              <p className="text-gray-600">Booked</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900">${item.hourlyRate}</p>
              <p className="text-gray-600">Per Hour</p>
            </div>
            <div className="text-center">
              <div className="flex items-center">
                <Star className="w-4 h-4 text-yellow-500 mr-1" />
                <p className="font-medium text-gray-900">{item.performanceRating}</p>
              </div>
              <p className="text-gray-600">Rating</p>
            </div>
          </div>
        </div>
      );
    } else if (item.type === 'project') {
      const getHealthColor = (health: string) => {
        switch (health) {
          case 'green': return 'text-green-600 bg-green-100';
          case 'yellow': return 'text-yellow-600 bg-yellow-100';
          case 'red': return 'text-red-600 bg-red-100';
          default: return 'text-gray-600 bg-gray-100';
        }
      };

      return (
        <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center mr-4">
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{item.name}</h4>
              <div className="flex items-center text-sm text-gray-600 space-x-4">
                <span className="capitalize">{item.methodology}</span>
                <span>Due: {new Date(item.endDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getHealthColor(item.health)}`}>
              {item.health.toUpperCase()}
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900">{item.progress}%</p>
              <p className="text-gray-600">Complete</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900">{item.resourceCount}</p>
              <p className="text-gray-600">Resources</p>
            </div>
          </div>
        </div>
      );
    } else if (item.type === 'certification') {
      return (
        <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center mr-4">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{item.certificationName}</h4>
              <div className="flex items-center text-sm text-gray-600 space-x-4">
                <span>{item.resourceName}</span>
                <span>{item.department}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <div className="text-center">
              <p className="font-medium text-gray-900">{item.issuingOrg}</p>
              <p className="text-gray-600">Issuing Org</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-red-600">
                {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString() : 'N/A'}
              </p>
              <p className="text-gray-600">Expires</p>
            </div>
          </div>
        </div>
      );
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="psa-page-container">
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading dashboard data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!dashboardData) {
    return (
      <div className="psa-page-container">
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-red-600" />
              <p className="text-gray-600 mb-4">Failed to load dashboard data</p>
              <button
                onClick={fetchDashboardData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="psa-page-container">
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-6">
          {/* Header with refresh button */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">PSA Dashboard</h1>
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div onClick={() => handleMetricClick('total-resources')} className="cursor-pointer">
              <MetricCard
                title="Total Resources"
                value={dashboardData.keyMetrics.totalResources.value}
                icon={Users}
                color="blue"
                change={{ value: dashboardData.keyMetrics.totalResources.change, type: dashboardData.keyMetrics.totalResources.trend === 'up' ? 'increase' : 'decrease' }}
              />
            </div>
            <div onClick={() => handleMetricClick('assigned-resources')} className="cursor-pointer">
              <MetricCard
                title="Assigned Resources"
                value={dashboardData.keyMetrics.assignedResources.value}
                icon={FolderKanban}
                color="green"
              />
            </div>
            <div onClick={() => handleMetricClick('bench-percentage')} className="cursor-pointer">
              <MetricCard
                title="Bench Percentage"
                value={`${dashboardData.keyMetrics.benchPercentage.value}%`}
                icon={TrendingUp}
                color="yellow"
                change={{ value: dashboardData.keyMetrics.benchPercentage.change, type: dashboardData.keyMetrics.benchPercentage.trend === 'up' ? 'increase' : 'decrease' }}
              />
            </div>
            <div onClick={() => handleMetricClick('active-projects')} className="cursor-pointer">
              <MetricCard
                title="Active Projects"
                value={dashboardData.keyMetrics.activeProjects.value}
                icon={FolderKanban}
                color="purple"
              />
            </div>
            <div onClick={() => handleMetricClick('unstaffed-projects')} className="cursor-pointer">
              <MetricCard
                title="Unstaffed Projects"
                value={dashboardData.keyMetrics.unstaffedProjects.value}
                icon={AlertTriangle}
                color="red"
              />
            </div>
            <div onClick={() => handleMetricClick('expiring-certifications')} className="cursor-pointer">
              <MetricCard
                title="Expiring Certifications"
                value={dashboardData.keyMetrics.expiringCertifications.value}
                icon={Award}
                color="indigo"
              />
            </div>
          </div>

          {/* Metric Details Section */}
          {activeMetric && (
            <div className="bg-white rounded-xl p-6 border border-gray-200 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {getMetricDetails(activeMetric).title}
                  </h3>
                  <span className="ml-3 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                    {getMetricDetails(activeMetric).data.length} items
                  </span>
                </div>
                <button
                  onClick={() => setActiveMetric(null)}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span className="mr-2 text-sm">Hide Details</span>
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loadingDetails ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                    <p>Loading details...</p>
                  </div>
                ) : getMetricDetails(activeMetric).data.length > 0 ? (
                  getMetricDetails(activeMetric).data.map(renderDetailItem)
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle className="w-6 h-6 text-gray-400" />
                    </div>
                    <p>No items found for this metric</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProjectHealthChart 
              health={{
                green: dashboardData.projectHealth.healthy,
                yellow: dashboardData.projectHealth.atRisk,
                red: dashboardData.projectHealth.critical
              }} 
            />
            <UtilizationTrendChart data={dashboardData.utilization.trend} isQuarterly={true} />
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {dashboardData.recentActivity.length > 0 ? (
                dashboardData.recentActivity.map((activity, index) => (
                  <div key={index} className={`flex items-center p-3 rounded-lg ${
                    activity.color === 'blue' ? 'bg-blue-50' :
                    activity.color === 'yellow' ? 'bg-yellow-50' :
                    activity.color === 'green' ? 'bg-green-50' : 'bg-gray-50'
                  }`}>
                    <Clock className={`w-5 h-5 mr-3 ${
                      activity.color === 'blue' ? 'text-blue-500' :
                      activity.color === 'yellow' ? 'text-yellow-500' :
                      activity.color === 'green' ? 'text-green-500' : 'text-gray-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900">{activity.message}</p>
                      <p className="text-sm text-gray-600">{activity.timeAgo}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* ResourceEditModal */}
      {showEditModal && selectedResource && (
        <ResourceEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedResource(null);
          }}
          resource={selectedResource}
          onSave={handleResourceSave}
          companyId={companyId || undefined}
          companyRoles={companyRoles}
        />
      )}
    </div>
  );
}