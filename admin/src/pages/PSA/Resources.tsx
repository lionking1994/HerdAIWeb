import { useState, useEffect } from 'react';
import { Search, Plus, Users } from 'lucide-react';
import api from '../../lib/api';
import ResourceCard from '../../components/PSA/Resources/ResourceCard';
import ResourceEditModal from '../../components/PSA/Resources/ResourceEditModal';
import { mockResources } from '../../components/PSA/Dashboard/Data/mockData';
import { Resource } from '../../components/PSA/Dashboard/types';
import { useSearchParams } from 'react-router-dom';


export default function Resources() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterAvailability, setFilterAvailability] = useState('all');
  const [resources, setResources] = useState<Resource[]>([]);
  const [companyRoles, setCompanyRoles] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');

  // Comment out t variable
  // const t = '';

  // Fetch company roles from API
  const fetchCompanyRoles = async () => {
    try {
      if (!companyId) return;
      
      const response = await api.get(`/psa/companyroles/${companyId}`);
      if (response.data.success) {
        setCompanyRoles(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching company roles:', err);
    }
  };

  // Fetch resources from API
  useEffect(() => {
    const fetchResources = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!companyId) {
          throw new Error('Company ID not found in URL parameters');
        }

        const response = await api.get(
          `/psa/resources?companyId=${companyId}`
        );

        if (response.data.success) {
          // Transform API data to match Resource interface
          const transformedResources = response.data.resources.map((apiResource: any) => {
            try {
              // Handle null resource data
              const resource = apiResource.resource;
              
              return {
                id: apiResource.id.toString(),
                userId: apiResource.id.toString(),
                user: {
                  id: apiResource.id.toString(),
                  name: apiResource.name || 'Unknown',
                  email: apiResource.email || '',
                  role: apiResource.role || 'user',
                  avatar: apiResource.avatar || '',
                },
                skills: apiResource.skills?.map((skill: any) => ({
                  skillId: skill.skill_id || '',
                  skill: {
                    id: skill.skill_id || '',
                    name: skill.skill_name || 'Unknown Skill',
                    category: skill.skill_category || 'General',
                    description: skill.skill_description || '',
                  },
                  proficiencyLevel: skill.proficiency_level as 1 | 2 | 3 | 4 | 5 || 1,
                  yearsExperience: skill.years_experience || 0,
                  lastUsed: skill.last_used || new Date().toISOString().split('T')[0],
                })) || [],
                certifications: apiResource.certifications?.map((cert: any) => ({
                  certificationId: cert.certification_id || '',
                  certification: {
                    id: cert.certification_id || '',
                    name: cert.certification_name || 'Unknown Certification',
                    issuingOrganization: cert.issuing_organization || 'Unknown',
                    expirationDate: cert.expiration_date || '',
                    description: cert.certification_description || '',
                  },
                  dateObtained: cert.date_obtained || '',
                  expirationDate: cert.expiration_date || '',
                  status: cert.cert_status as 'active' | 'expired' | 'expiring_soon' || 'active',
                })) || [],
                availability: resource?.availability ? 
                  parseInt(String(resource.availability).replace('%', '')) : 0,
                hourlyRate: parseFloat(resource?.hourly_rate) || 0,
                location: resource?.location || 'Not specified',
                department: resource?.department?.name || 'Not assigned',
                departmentId: resource?.department?.id || null,
                performanceRating: parseFloat(resource?.performance_rating) || 0,
                isActive: resource?.is_active !== false,
                hireDate: resource?.hire_date || new Date().toISOString(),
                totalProjectHours: 0, // This would need to be calculated from project data
                successfulProjects: 0, // This would need to be calculated from project data
                activeProjects: apiResource.activeProjects || [],
                resource: resource, // Preserve the original resource object
              };
            } catch (error) {
              console.error('Error transforming resource:', error, apiResource);
              // Return a safe fallback resource
              return {
                id: apiResource.id?.toString() || 'unknown',
                userId: apiResource.id?.toString() || 'unknown',
                user: {
                  id: apiResource.id?.toString() || 'unknown',
                  name: apiResource.name || 'Unknown User',
                  email: apiResource.email || '',
                  role: 'user',
                  avatar: '',
                },
                skills: [],
                certifications: [],
                availability: 0,
                hourlyRate: 0,
                location: 'Not specified',
                department: 'Not assigned',
                performanceRating: 0,
                isActive: false,
                hireDate: new Date().toISOString(),
                totalProjectHours: 0,
                successfulProjects: 0,
                activeProjects: [],
                resource: null, // No resource data available
              };
            }
          });

          setResources(transformedResources);
        } else {
          throw new Error(response.data.message || 'Failed to fetch resources');
        }
      } catch (err) {
        console.error('Error fetching resources:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch resources');
        // Fallback to mock data on error
        setResources(mockResources);
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
    fetchCompanyRoles();
  }, [companyId]);

  // Use API company roles data instead of extracting from resources
  const departmentOptions = [
    { id: 'all', name: 'All Departments' },
    ...companyRoles.map(role => ({ id: role.id, name: role.name }))
  ];

  const filteredResources = resources.filter(resource => {
    try {
      const matchesSearch = resource.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resource.skills?.some(skill => skill.skill?.name?.toLowerCase().includes(searchTerm.toLowerCase())) || false;
      
      // For department filtering, we need to check if the resource's department matches the selected department ID
      // Since we don't have department ID in the Resource interface, we'll match by department name for now
      const matchesDepartment = filterDepartment === 'all' || 
        resource.department === filterDepartment;
      
      const matchesAvailability = filterAvailability === 'all' ||
        (filterAvailability === 'available' && resource.availability > 0) ||
        (filterAvailability === 'assigned' && resource.availability === 0);

      return matchesSearch && matchesDepartment && matchesAvailability;
    } catch (error) {
      console.error('Error filtering resource:', error, resource);
      return false;
    }
  });

  const handleResourceSelect = (resource: Resource) => {
    setSelectedResource(resource);
    setShowEditModal(true);
  };

  const handleResourceSave = async (updatedResource: Resource) => {
    // Close modal first
    setShowEditModal(false);
    setSelectedResource(null);
    
    // Show loader and refresh all resources
    setLoading(true);
    
    try {
      // Call GET API to refresh all resources
      const response = await api.get(`/psa/resources?companyId=${companyId}`);
      
      if (response.data.success) {
        // Transform API data to match Resource interface
        const transformedResources = response.data.resources.map((apiResource: any) => {
          return {
            id: apiResource.id.toString(),
            userId: apiResource.id.toString(),
            user: {
              id: apiResource.id.toString(),
              name: apiResource.name,
              email: apiResource.email,
              role: apiResource.role as any
            },
            department: apiResource.resource?.department_name || apiResource.resource?.department?.name || '',
            departmentId: apiResource.resource?.department_id || null,
            location: apiResource.resource?.location || '',
            hourlyRate: parseFloat(apiResource.resource?.hourly_rate || '0'),
            availability: parseFloat(apiResource.resource?.availability || '0'),
            performanceRating: parseFloat(apiResource.resource?.performance_rating || '0'),
            isActive: apiResource.resource?.is_active || true,
            hireDate: apiResource.resource?.hire_date || '',
            totalProjectHours: 0,
            successfulProjects: 0,
            skills: apiResource.skills.map((existing: any) => ({
              skillId: existing.skill_id,
              skill: {
                id: existing.skill_id,
                name: existing.skill_name,
                category: existing.skill_category,
                description: existing.skill_description
              },
              proficiencyLevel: existing.proficiency_level as any,
              yearsExperience: existing.years_experience,
              lastUsed: existing.last_used ? existing.last_used.split('T')[0] : undefined
            })),
            certifications: apiResource.certifications.map((existing: any) => ({
              certificationId: existing.certification_id,
              certification: {
                id: existing.certification_id,
                name: existing.certification_name,
                issuingOrganization: existing.issuing_organization,
                description: existing.certification_description,
                expirationDate: existing.expiration_date
              },
              dateObtained: existing.date_obtained ? existing.date_obtained.split('T')[0] : '',
              expirationDate: existing.expiration_date ? existing.expiration_date.split('T')[0] : undefined,
              status: existing.cert_status as any,
              certificateNumber: existing.certificate_number || undefined,
              verificationUrl: existing.verification_url || undefined
            })),
            activeProjects: apiResource.activeProjects || [],
            resource: {
              resource_id: apiResource.resource?.resource_id || '',
              employment_type: apiResource.resource?.employment_type,
              level: apiResource.resource?.level,
              cost_center: apiResource.resource?.cost_center,
              working_days: apiResource.resource?.working_days,
              hours_per_week: apiResource.resource?.hours_per_week
            }
          };
        });
        
        // Update resources with fresh data from server
        setResources(transformedResources);
        console.log('All resources refreshed with fresh server data');
      }
    } catch (error) {
      console.error('Error refreshing resources:', error);
      setError('Failed to refresh resources');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="psa-page-container">
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading resources...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="psa-page-container">
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Resources</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Resource Management</h2>
                <p className="text-gray-600">Manage team members and their assignments</p>
              </div>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add Resource
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search resources by name or skills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-4">
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {departmentOptions.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>

                <select
                  value={filterAvailability}
                  onChange={(e) => setFilterAvailability(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Availability</option>
                  <option value="available">Available</option>
                  <option value="assigned">Fully Assigned</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredResources.map(resource => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onSelect={handleResourceSelect}
                  companyId={companyId || undefined}
                />
              ))}
            </div>

            {filteredResources.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No resources found</h3>
                <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
              </div>
            )}
          </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Allocation</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Available</span>
                  <span className="font-semibold text-green-600">
                    {resources.filter(r => r.availability > 0).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fully Assigned</span>
                  <span className="font-semibold text-blue-600">
                    {resources.filter(r => r.availability === 0).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Average Utilization</span>
                  <span className="font-semibold text-gray-900">
                    {resources.length > 0 ? Math.round(resources.reduce((acc, r) => acc + (100 - r.availability), 0) / resources.length) : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Distribution</h3>
              <div className="space-y-3">
                {(() => {
                  // Get all unique skills from resources
                  const allSkills = resources.flatMap(r => r.skills.map(s => s.skill.name));
                  const uniqueSkills = [...new Set(allSkills)];
                  const topSkills = uniqueSkills.slice(0, 3); // Show top 3 skills
                  
                  return topSkills.map(skill => {
                    const count = resources.filter(r =>
                      r.skills.some(s => s.skill.name === skill)
                    ).length;
                    return (
                      <div key={skill} className="flex justify-between">
                        <span className="text-gray-600">{skill}</span>
                        <span className="font-semibold text-gray-900">{count}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Certification Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Active</span>
                  <span className="font-semibold text-green-600">
                    {resources.reduce((acc, r) =>
                      acc + r.certifications.filter(c => c.status === 'active').length, 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Expiring Soon</span>
                  <span className="font-semibold text-yellow-600">
                    {resources.reduce((acc, r) =>
                      acc + r.certifications.filter(c => c.status === 'expiring_soon').length, 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Expired</span>
                  <span className="font-semibold text-red-600">
                    {resources.reduce((acc, r) =>
                      acc + r.certifications.filter(c => c.status === 'expired').length, 0
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

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
      </div>
    </div>
  );
}