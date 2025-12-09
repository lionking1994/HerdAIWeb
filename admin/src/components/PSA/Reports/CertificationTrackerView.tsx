import { useState, useEffect } from 'react';
import { ArrowLeft, Award, AlertTriangle, CheckCircle, Clock, Calendar, Search, Download } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../lib/api';

interface CertificationTrackerViewProps {
  onBack: () => void;
}

interface CertificationData {
  id: string;
  certificationId: string;
  certification: {
    id: string;
    name: string;
    issuingOrganization: string;
    description: string;
    validityPeriodMonths: number;
  };
  resourceId: string;
  resourceName: string;
  department: string;
  location: string;
  email: string;
  avatar: string;
  dateObtained: string;
  expirationDate: string;
  status: string;
  certificateNumber: string;
  verificationUrl: string;
  daysRemaining: number | null;
  isExpired: boolean;
  hourlyRate: number;
  currency: string;
}

interface CertificationTrackerResponse {
  certifications: CertificationData[];
  summary: {
    totalCertifications: number;
    activeCertifications: number;
    expiringSoon: number;
    expiredCertifications: number;
    complianceRate: number;
  };
  filters: {
    status: string;
    department: string;
    search: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function CertificationTrackerView({ onBack }: CertificationTrackerViewProps) {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [data, setData] = useState<CertificationTrackerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch certification tracker data
  const fetchCertificationData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching certification data for companyId:', companyId);

      if (!companyId) {
        throw new Error('Company ID not found in URL parameters');
      }

      const params = new URLSearchParams({
        status: statusFilter,
        department: departmentFilter,
        search: searchTerm,
        page: '1',
        limit: '100'
      });

      const url = `/psa/reports/certification-tracker/${companyId}?${params}`;
      console.log('API URL:', url);

      const response = await api.get(url);
      console.log('API Response:', response.data);

      if (response.data.success) {
        setData(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch certification tracker data');
      }
    } catch (err) {
      console.error('Error fetching certification tracker data:', err);
      setError('Failed to fetch certification tracker data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount and when filters change
  useEffect(() => {
    if (companyId) {
      fetchCertificationData();
    }
  }, [companyId, statusFilter, departmentFilter]);

  // Debounced search to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (companyId) {
        fetchCertificationData();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading certification data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchCertificationData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No certification data available</p>
        </div>
      </div>
    );
  }

  const { certifications, summary, filters } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100 border-green-200';
      case 'expiring_soon': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'expired': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'expiring_soon': return Clock;
      case 'expired': return AlertTriangle;
      default: return Award;
    }
  };

  const getDaysRemainingColor = (days: number | null) => {
    if (days === null) return 'text-gray-600';
    if (days < 0) return 'text-red-600';
    if (days <= 30) return 'text-red-600';
    if (days <= 90) return 'text-yellow-600';
    return 'text-green-600';
  };

  const exportData = () => {
    if (!data) return;
    
    // Create CSV data
    const csvHeaders = [
      'Certification', 'Issuing Organization', 'Resource Name', 'Department', 'Location',
      'Status', 'Date Obtained', 'Expiration Date', 'Days Remaining', 'Certificate Number'
    ];
    
    const csvData = certifications.map(cert => [
      cert.certification.name,
      cert.certification.issuingOrganization,
      cert.resourceName,
      cert.department,
      cert.location,
      cert.status,
      cert.dateObtained,
      cert.expirationDate || 'No expiration',
      cert.daysRemaining !== null ? cert.daysRemaining : 'N/A',
      cert.certificateNumber || 'N/A'
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `certification-tracker-${new Date().toISOString().split('T')[0]}.csv`;
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
            <Award className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Certification Tracker</h2>
              <p className="text-gray-600">Monitor certification status and renewal schedules</p>
            </div>
          </div>
        </div>
        <button 
          onClick={exportData}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Certifications</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalCertifications}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">{summary.activeCertifications}</p>
              <p className="text-xs text-gray-500">{summary.complianceRate}% of total</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.expiringSoon}</p>
              <p className="text-xs text-gray-500">Require attention</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expired</p>
              <p className="text-2xl font-bold text-red-600">{summary.expiredCertifications}</p>
              <p className="text-xs text-gray-500">Need renewal</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Certification List */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search certifications or resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expiring_soon">Expiring Soon</option>
              <option value="expired">Expired</option>
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Departments</option>
              {/* Department filter temporarily disabled - API doesn't return departments */}
            </select>
          </div>
        </div>

        {/* Certification Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Certification</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Resource</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Status</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Obtained</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Expires</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Days Remaining</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Action Required</th>
              </tr>
            </thead>
            <tbody>
              {certifications.map((cert, index) => {
                const StatusIcon = getStatusIcon(cert.status);
                return (
                  <tr key={`${cert.resourceId}-${cert.certificationId}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center mr-3">
                          <Award className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{cert.certification.name}</p>
                          <p className="text-sm text-gray-600">{cert.certification.issuingOrganization}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">                      
                        <div>
                          <p className="font-medium text-gray-900">{cert.resourceName}</p>
                          <p className="text-sm text-gray-600">{cert.department} • {cert.location}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center">
                        <StatusIcon className="w-4 h-4 mr-2" />
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(cert.status)}`}>
                          {cert.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center text-gray-900">
                      {new Date(cert.dateObtained).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-center text-gray-900">
                      {cert.expirationDate ? new Date(cert.expirationDate).toLocaleDateString() : 'No expiration'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {cert.daysRemaining !== null ? (
                        <span className={`font-medium ${getDaysRemainingColor(cert.daysRemaining)}`}>
                          {cert.isExpired ? `${Math.abs(cert.daysRemaining)} days overdue` : 
                           cert.daysRemaining === 0 ? 'Expires today' :
                           `${cert.daysRemaining} days`}
                        </span>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {cert.isExpired && (
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                          Renew Now
                        </span>
                      )}
                      {cert.daysRemaining !== null && cert.daysRemaining <= 30 && cert.daysRemaining > 0 && (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                          Plan Renewal
                        </span>
                      )}
                      {cert.daysRemaining !== null && cert.daysRemaining <= 90 && cert.daysRemaining > 30 && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                          Monitor
                        </span>
                      )}
                      {(cert.daysRemaining === null || cert.daysRemaining > 90) && (
                        <span className="text-gray-500 text-xs">No action</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {certifications.length === 0 && (
          <div className="text-center py-12">
            <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No certifications found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
          </div>
        )}
      </div>

      {/* Renewal Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Renewals (Next 90 Days)</h3>
          <div className="space-y-3">
            {certifications.filter(cert => 
              cert.daysRemaining !== null && 
              cert.daysRemaining > 0 && 
              cert.daysRemaining <= 90
            ).slice(0, 5).length > 0 ? (
              certifications.filter(cert => 
                cert.daysRemaining !== null && 
                cert.daysRemaining > 0 && 
                cert.daysRemaining <= 90
              ).slice(0, 5).map((cert, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">{cert.certification.name}</h4>
                    <p className="text-sm text-gray-600">{cert.resourceName}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${getDaysRemainingColor(cert.daysRemaining)}`}>
                      {cert.daysRemaining} days
                    </p>
                    <p className="text-xs text-gray-500">
                      {cert.expirationDate ? new Date(cert.expirationDate).toLocaleDateString() : 'No expiry'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No upcoming renewals in the next 90 days</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Certification Insights</h3>
          <div className="space-y-4">
            {summary.expiringSoon > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-medium text-yellow-900">Renewal Reminders</h4>
                <p className="text-sm text-yellow-800 mt-1">
                  {summary.expiringSoon} certifications require renewal planning
                </p>
              </div>
            )}
            
            {summary.expiredCertifications > 0 && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-900">Expired Certifications</h4>
                <p className="text-sm text-red-800 mt-1">
                  {summary.expiredCertifications} certifications have expired and need immediate attention
                </p>
              </div>
            )}
            
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-900">Compliance Rate</h4>
              <p className="text-sm text-green-800 mt-1">
                {summary.complianceRate}% of certifications are currently active
              </p>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900">Certification Overview</h4>
              <p className="text-sm text-blue-800 mt-1">
                {summary.totalCertifications} total certifications
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}