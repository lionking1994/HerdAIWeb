import React, { useState } from 'react';
import { X, Building, User, TrendingUp, Users, DollarSign, Globe, Award, FileText, ExternalLink, Clock } from 'lucide-react';
import './ResearchModal.css';

const EnhancedViewModal = ({ 
  isOpen, 
  onClose, 
  companyName, 
  contactName,
  researchData 
}) => {
  const [activeTab, setActiveTab] = useState('company');

  if (!isOpen) return null;

  // Use real research data from API, with fallbacks only for missing fields
  const data = researchData || {
    company: {
      overview: {
        name: companyName,
        industry: 'Technology',
        founded: '2020',
        employees: '50-100',
        headquarters: 'San Francisco, CA',
        description: 'Company information not available'
      },
      financials: {
        revenue: 'Not available',
        funding: 'Not available',
        valuation: 'Not available',
        growth: 'Not available'
      },
      market: {
        size: 'Not available',
        trends: ['Not available'],
        competitors: ['Not available']
      },
      executives: []
    },
    contact: {
      background: {
        name: contactName,
        title: 'Not available',
        company: companyName,
        experience: 'Not available',
        education: 'Not available'
      },
      skills: ['Not available'],
      linkedin: {
        connections: 'Not available',
        endorsements: 'Not available',
        recommendations: 'Not available'
      },
      insights: ['Not available']
    },
    recommendations: {
      priority: 'Medium',
      next_steps: [],
      success_metrics: []
    }
  };

  console.log('🔍 EnhancedViewModal received data:', data);

  const renderCompanyTab = () => (
    <div className="space-y-6">
      {/* Company Overview */}
      <div className="research-card">
        <div className="card-header">
          <Building className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Company Overview</h3>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">Industry</span>
              <p className="text-sm font-medium">{data.company.overview.industry || 'Not available'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Founded</span>
              <p className="text-sm font-medium">{data.company.overview.founded || 'Not available'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Employees</span>
              <p className="text-sm font-medium">{data.company.overview.employees || 'Not available'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Headquarters</span>
              <p className="text-sm font-medium">{data.company.overview.headquarters || 'Not available'}</p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500">Description</span>
            <p className="text-sm text-gray-900 mt-1">{data.company.overview.description || 'No description available'}</p>
          </div>
        </div>
      </div>

      {/* Financials */}
      <div className="research-card">
        <div className="card-header">
          <DollarSign className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold">Financial Information</h3>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">Revenue</span>
              <p className="text-sm font-medium text-green-600">{data.company.financials.revenue || 'Not available'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Funding</span>
              <p className="text-sm font-medium">{data.company.financials.funding || 'Not available'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Valuation</span>
              <p className="text-sm font-medium">{data.company.financials.valuation || 'Not available'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Growth</span>
              <p className="text-sm font-medium text-green-600">{data.company.financials.growth || 'Not available'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Market Analysis */}
      <div className="research-card">
        <div className="card-header">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold">Market Analysis</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div>
              <span className="text-sm text-gray-500">Market Size</span>
              <p className="text-sm font-medium">{data.company.market.size || 'Not available'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Key Trends</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {data.company.market.trends && data.company.market.trends.length > 0 ? (
                  data.company.market.trends.map((trend, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {trend}
                    </span>
                  ))
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    No trends available
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500">Competitors</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {data.company.market.competitors && data.company.market.competitors.length > 0 ? (
                  data.company.market.competitors.map((competitor, index) => (
                    <span key={index} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                      {competitor}
                    </span>
                  ))
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    No competitors available
                  </span>
                )}
              </div>
            </div>
            {data.company.market.market_position && (
              <div>
                <span className="text-sm text-gray-500">Market Position</span>
                <p className="text-sm font-medium text-blue-600">{data.company.market.market_position}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Strategic Focus */}
      {data.company.strategic_focus && data.company.strategic_focus.length > 0 && (
        <div className="research-card">
          <div className="card-header">
            <Globe className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Strategic Focus Areas</h3>
          </div>
          <div className="card-content">
            <div className="flex flex-wrap gap-2">
              {data.company.strategic_focus.map((focus, index) => (
                <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  {focus}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Executives */}
      <div className="research-card">
        <div className="card-header">
          <Users className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold">Key Executives</h3>
        </div>
        <div className="card-content">
          <div className="space-y-3">
            {data.company.executives && data.company.executives.length > 0 ? (
              data.company.executives.map((exec, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{exec.name}</p>
                    <p className="text-xs text-gray-500">{exec.title} • {exec.experience}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No executive information available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContactTab = () => (
    <div className="space-y-6">
      {/* Contact Background */}
      <div className="research-card">
        <div className="card-header">
          <User className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold">Contact Background</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div>
              <span className="text-sm text-gray-500">Current Role</span>
              <p className="text-sm font-medium">{data.contact.background.title || 'Not available'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Experience</span>
              <p className="text-sm font-medium">{data.contact.background.experience || 'Not available'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Education</span>
              <p className="text-sm font-medium">{data.contact.background.education || 'Not available'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="research-card">
        <div className="card-header">
          <Award className="w-5 h-5 text-yellow-600" />
          <h3 className="text-lg font-semibold">Skills & Expertise</h3>
        </div>
        <div className="card-content">
          <div className="flex flex-wrap gap-2">
            {data.contact.skills && data.contact.skills.length > 0 ? (
              data.contact.skills.map((skill, index) => (
                <span key={index} className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
                  {skill}
                </span>
              ))
            ) : (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                No skills available
              </span>
            )}
          </div>
        </div>
      </div>

      {/* LinkedIn Insights */}
      <div className="research-card">
        <div className="card-header">
          <ExternalLink className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">LinkedIn Profile</h3>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <span className="text-sm text-gray-500">Connections</span>
              <p className="text-lg font-semibold text-blue-600">{data.contact.linkedin.connections || 'Not available'}</p>
            </div>
            <div className="text-center">
              <span className="text-sm text-gray-500">Endorsements</span>
              <p className="text-lg font-semibold text-green-600">{data.contact.linkedin.endorsements || 'Not available'}</p>
            </div>
            <div className="text-center">
              <span className="text-sm text-gray-500">Recommendations</span>
              <p className="text-lg font-semibold text-purple-600">{data.contact.linkedin.recommendations || 'Not available'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="research-card">
        <div className="card-header">
          <FileText className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold">Key Insights</h3>
        </div>
        <div className="card-content">
          <div className="space-y-3">
            {data.contact.insights && data.contact.insights.length > 0 ? (
              data.contact.insights.map((insight, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-900">{insight}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No insights available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Communication Preferences */}
      {data.contact.communication_preferences && data.contact.communication_preferences.length > 0 && (
        <div className="research-card">
          <div className="card-header">
            <User className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Communication Preferences</h3>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {data.contact.communication_preferences.map((preference, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-900">{preference}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderRecommendationsTab = () => (
    <div className="space-y-6">
      {/* Research Summary */}
      {data.opportunity?.summary && (
        <div className="research-card">
          <div className="card-header">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Research Summary</h3>
          </div>
          <div className="card-content">
            <p className="text-sm text-gray-900">{data.opportunity.summary}</p>
          </div>
        </div>
      )}

      {/* Priority Level */}
      <div className="research-card">
        <div className="card-header">
          <TrendingUp className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold">Priority Level</h3>
        </div>
        <div className="card-content">
          <div className="flex items-center space-x-3">
            <span className={`priority-badge priority-${data.recommendations?.priority?.toLowerCase() || 'medium'}`}>
              {data.recommendations?.priority || 'Medium'} Priority
            </span>
            <span className="text-sm text-gray-600">
              Based on company size, contact role, and opportunity value
            </span>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="research-card">
        <div className="card-header">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Recommended Next Steps</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            {data.recommendations?.next_steps && data.recommendations.next_steps.length > 0 ? (
              data.recommendations.next_steps.map((step, index) => {
                // Handle both string format (from API) and object format (from transformed data)
                const stepData = typeof step === 'string' ? { action: step } : step;
                return (
                  <div key={index} className="step-card">
                    <div className="step-header">
                      <span className="step-number">{index + 1}</span>
                      <h4 className="step-title">{stepData.action}</h4>
                    </div>
                    <div className="step-details">
                      <div className="step-meta">
                        <span className="meta-item">
                          <Clock className="w-4 h-4" />
                          {stepData.timeline || 'Within 1 week'}
                        </span>
                        <span className="meta-item">
                          <TrendingUp className="w-4 h-4" />
                          {stepData.impact || 'High'}
                        </span>
                      </div>
                      <div className="step-message">
                        <span className="message-label">Key Message:</span>
                        <p className="message-text">
                          {stepData.key_message || `Focus on ${stepData.action.toLowerCase()} to advance this opportunity`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No specific recommendations available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Opportunity Insights */}
      {/* {data.opportunity?.insights && data.opportunity.insights.length > 0 && (
        <div className="research-card">
          <div className="card-header">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Opportunity Insights</h3>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {data.opportunity.insights.map((insight, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-900">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )} */}

      {/* Success Metrics */}
      <div className="research-card">
        <div className="card-header">
          <Award className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold">Success Metrics</h3>
        </div>
        <div className="card-content">
          <div className="space-y-3">
            {data.recommendations?.success_metrics && data.recommendations.success_metrics.length > 0 ? (
              data.recommendations.success_metrics.map((metric, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-900">{metric}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Award className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No success metrics defined</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content research-modal enhanced-view-modal">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center space-x-3">
            <div className="research-icon w-6 h-6">
              <Building className="w-full h-full" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Research Results</h2>
              <p className="text-sm text-gray-600">
                {data.company.overview.name} • {data.contact.background.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs-section">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('company')}
              className={`tab-button ${activeTab === 'company' ? 'active' : ''}`}
            >
              <Building className="w-4 h-4 mr-2" />
              Company Research
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              className={`tab-button ${activeTab === 'contact' ? 'active' : ''}`}
            >
              <User className="w-4 h-4 mr-2" />
              Contact Research
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`tab-button ${activeTab === 'recommendations' ? 'active' : ''}`}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Next Steps
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="modal-body">
          {activeTab === 'company' && renderCompanyTab()}
          {activeTab === 'contact' && renderContactTab()}
          {activeTab === 'recommendations' && renderRecommendationsTab()}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedViewModal;

