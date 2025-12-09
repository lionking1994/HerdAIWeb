import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import axios from 'axios';
import { 
  User, 
  Mail, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Star, 
  Award, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Lightbulb,
  GraduationCap,
  BarChart3,
  Activity,
  Circle,
  Leaf,
  ChevronRight
} from 'lucide-react';

const ResourceOverview = () => {
  const { resourceId } = useParams();
  const navigate = useNavigate();
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    fetchResourceDetails();
    fetchUserData();
  }, [resourceId]);

  const fetchUserData = async () => {
    try {
      setUserLoading(true);
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await axios.get(
        `${apiUrl}/auth/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setUserLoading(false);
    }
  };

  const fetchResourceDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await axios.get(
        `${apiUrl}/psa/resource-overview/${resourceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setResource(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch resource details');
      }
    } catch (error) {
      console.error('Error fetching resource details:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
      case 'expired': return 'text-red-600 bg-red-100';
      case 'expiring_soon': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getProficiencyColor = (level) => {
    if (level >= 4) return 'bg-green-500';
    if (level >= 3) return 'bg-blue-500';
    if (level >= 2) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getProficiencyLabelColor = (level) => {
    if (level >= 4) return 'text-green-600 bg-green-100';
    if (level >= 3) return 'text-blue-600 bg-blue-100';
    if (level >= 2) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />);
    }

    if (hasHalfStar) {
      stars.push(<Star key="half" className="h-4 w-4 text-yellow-400 fill-current opacity-50" />);
    }

    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />);
    }

    return stars;
  };

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar isAuthenticated={true} user={user} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading resource details...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar isAuthenticated={true} user={user} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar isAuthenticated={true} user={user} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Resource Not Found</h2>
            <p className="text-gray-600">The requested resource could not be found.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isAuthenticated={true} user={user} />
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                {resource.avatar ? (
                  <img 
                    src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/avatars/${resource.avatar}`}
                    alt={resource.name}
                    className="w-16 h-16 rounded-lg object-cover"
                    onError={(e) => {
                      // Fallback to default icon if image fails to load
                      e.currentTarget.style.display = 'none';
                      const fallbackElement = e.currentTarget.nextElementSibling;
                      if (fallbackElement) {
                        fallbackElement.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div 
                  className={`w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center ${resource.avatar ? 'hidden' : ''}`}
                  style={{ display: resource.avatar ? 'none' : 'flex' }}
                >
                  <span className="text-2xl font-bold text-white">
                    {resource.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{resource.name}</h1>
                <div className="flex items-center space-x-4 mt-2">
                  <div className="flex items-center space-x-1 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">{resource.email}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-600">
                    <User className="h-4 w-4" />
                    <span className="text-sm">{resource.company_role_name || 'Team Member'}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{resource.location || 'Not specified'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                resource.availability >= 75 ? 'bg-green-100 text-green-800' :
                resource.availability >= 50 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {resource.availability}% Available
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Skills & Expertise */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Lightbulb className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Skills & Expertise</h2>
              </div>
              {resource.skills?.length > 0 ? (
                <div className="space-y-4">
                  {resource.skills.map((skill, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                          <p className="text-sm text-gray-600">{skill.description}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProficiencyLabelColor(skill.proficiencyLevel)}`}>
                          {skill.proficiencyLabel}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                        <span>{skill.experienceYears} years experience</span>
                        <span>Last used: {formatDate(skill.lastUsedDate)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getProficiencyColor(skill.proficiencyLevel)}`}
                            style={{ width: `${(skill.proficiencyLevel / 5) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">{skill.proficiencyLevel}/5</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No skills found</p>
              )}
            </div>

            {/* Certifications */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Certifications</h2>
              </div>
              {resource.certifications?.length > 0 ? (
                <div className="space-y-4">
                  {resource.certifications.map((cert, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{cert.name}</h3>
                          <p className="text-sm text-gray-600">{cert.issuer}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cert.status)}`}>
                          {cert.statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Obtained: {formatDate(cert.obtainedDate)}</span>
                        <span>Expires: {formatDate(cert.expiryDate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No certifications found</p>
              )}
            </div>

            {/* User Stories in Progress */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <User className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">User Stories in Progress</h2>
              </div>
              {resource.userStories?.length > 0 ? (
                <div className="space-y-4">
                  {resource.userStories.slice(0, 5).map((story, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{story.title}</h3>
                          <p className="text-sm text-gray-600">{story.projectName}</p>
                        </div>
                        <div className="flex space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(story.priority)}`}>
                            {story.priority}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(story.status)}`}>
                            {story.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{story.storyPoints || 0} pts</span>
                        <span className="capitalize">{story.type}</span>
                      </div>
                    </div>
                  ))}
                  {resource.userStories.length > 5 && (
                    <p className="text-sm text-gray-500 text-center">
                      And {resource.userStories.length - 5} more stories...
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No user stories found</p>
              )}
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            {/* Performance */}
            <div className="bg-blue-600 rounded-xl p-6 text-white">
              <h2 className="text-lg font-semibold mb-4">Performance</h2>
              
              {/* Rating Section */}
              <div className="mb-6">
                <div className="text-sm mb-2">Rating</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {renderStars(resource.performance?.rating || 0)}
                  </div>
                  <div className="text-2xl font-bold">{resource.performance?.rating || 0}</div>
                </div>
              </div>

              {/* Metrics */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Hours</span>
                  <span className="text-sm font-semibold">{resource.performance?.totalHours || 0}h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Projects</span>
                  <span className="text-sm font-semibold">{resource.performance?.projectsCount || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Hourly Rate</span>
                  <span className="text-sm font-semibold">${resource.hourlyRate || 0}</span>
                </div>
              </div>
            </div>

            {/* Assigned Projects */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Assigned Projects</h2>
              </div>
              {resource.assignedProjects?.length > 0 ? (
                <div className="space-y-3">
                  {resource.assignedProjects.map((project, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">{project.name}</h3>
                          <p className="text-xs text-gray-600">{project.clientName}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>{project.role}</span>
                        <span>{project.allocation}% allocated</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div
                          className="bg-blue-500 h-1 rounded-full"
                          style={{ width: `${Math.min(project.allocation || 0, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No assigned projects</p>
              )}
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Hire Date:</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(resource.summary?.hireDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`text-sm font-medium ${resource.summary?.status === 'Active' ? 'text-green-600' : 'text-gray-600'}`}>
                    {resource.summary?.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Skills:</span>
                  <span className="text-sm font-medium text-gray-900">{resource.summary?.skillsCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Certifications:</span>
                  <span className="text-sm font-medium text-gray-900">{resource.summary?.certificationsCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Projects:</span>
                  <span className="text-sm font-medium text-gray-900">{resource.summary?.activeProjectsCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Stories In Progress:</span>
                  <span className="text-sm font-medium text-gray-900">{resource.summary?.storiesInProgress || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ResourceOverview;
