import React, { useState, useEffect } from 'react';
import { X, Building, User, CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';

const ResearchProgressModal = ({ 
  isOpen, 
  onClose, 
  companyName, 
  contactName,
  onResearchComplete,
  // Real progress data props
  companyProgress = 0,
  contactProgress = 0,
  companyStatus = 'pending',
  contactStatus = 'pending',
  currentStep = 'company'
}) => {
  const [localCompanyProgress, setLocalCompanyProgress] = useState(0);
  const [localContactProgress, setLocalContactProgress] = useState(0);
  const [localCompanyStatus, setLocalCompanyStatus] = useState('pending');
  const [localContactStatus, setLocalContactStatus] = useState('pending');
  const [localCurrentStep, setLocalCurrentStep] = useState('company');

  useEffect(() => {
    if (!isOpen) return;

    // Always use real progress data from parent
    setLocalCompanyProgress(companyProgress);
    setLocalContactProgress(contactProgress);
    setLocalCompanyStatus(companyStatus);
    setLocalContactStatus(contactStatus);
    setLocalCurrentStep(currentStep);
    
    console.log('🔄 ResearchProgressModal: Updated with real progress data:', {
      companyProgress,
      contactProgress,
      companyStatus,
      contactStatus,
      currentStep
    });
    
    // Check if research is complete
    if (companyStatus === 'completed' && contactStatus === 'completed') {
      console.log('✅ Research completed! Triggering completion callback...');
      setTimeout(() => {
        onResearchComplete();
      }, 1000);
    }
  }, [isOpen, onResearchComplete, companyProgress, contactProgress, companyStatus, contactStatus, currentStep]);

  // Real research progress - no simulation needed

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In Progress';
      case 'error':
        return 'Error';
      default:
        return 'Pending';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'in-progress':
        return 'text-blue-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  // Calculate overall progress
  const overallProgress = Math.round((localCompanyProgress + localContactProgress) / 2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Research in Progress</h2>
              <p className="text-gray-600">Gathering insights for {companyName} and {contactName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Research Stats */}
        <div className="flex gap-6 p-6 pb-4">
          <div className="flex items-center space-x-3 flex-1">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg">
              <Building className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500">Company Research</span>
              <span className={`text-lg font-semibold ${getStatusColor(localCompanyStatus)}`}>
                {getStatusText(localCompanyStatus)}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 flex-1">
            <div className="flex items-center justify-center w-10 h-10 bg-green-50 rounded-lg">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500">Contact Research</span>
              <span className={`text-lg font-semibold ${getStatusColor(localContactStatus)}`}>
                {getStatusText(localContactStatus)}
              </span>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex items-center justify-between">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" 
              style={{ width: `${overallProgress}%` }}
            ></div>
            <span className="text-sm font-semibold text-gray-900">{overallProgress}%</span>

          </div>
        </div>

        {/* Company Research Progress */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-blue-600" />
              <span className="text-lg font-semibold text-gray-900">Company Research</span>
            </div>
            {getStatusIcon(localCompanyStatus)}
          </div>
          
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${localCompanyProgress}%` }}
              ></div>
            </div>
            <span className="text-sm font-semibold text-gray-900 min-w-[3rem]">{localCompanyProgress}%</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${localCurrentStep === 'company' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}>
              <span className="text-lg">🔍</span>
              <span className="text-sm font-medium">Researching</span>
            </div>
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${localCompanyStatus === 'completed' ? 'bg-green-50 text-green-700' : 'text-gray-500'}`}>
              <span className="text-lg">📊</span>
              <span className="text-sm font-medium">Analyzing</span>
            </div>
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${localCompanyStatus === 'completed' ? 'bg-green-50 text-green-700' : 'text-gray-500'}`}>
              <span className="text-lg">✅</span>
              <span className="text-sm font-medium">Complete</span>
            </div>
          </div>
        </div>

        {/* Contact Research Progress */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-green-600" />
              <span className="text-lg font-semibold text-gray-900">Contact Research</span>
            </div>
            {getStatusIcon(localContactStatus)}
          </div>
          
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${localContactProgress}%` }}
              ></div>
            </div>
            <span className="text-sm font-semibold text-gray-900 min-w-[3rem]">{localContactProgress}%</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${localCurrentStep === 'contact' ? 'bg-green-50 text-green-700' : 'text-gray-500'}`}>
              <span className="text-lg">🔍</span>
              <span className="text-sm font-medium">Researching</span>
            </div>
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${localContactStatus === 'completed' ? 'bg-green-50 text-green-700' : 'text-gray-500'}`}>
              <span className="text-lg">📊</span>
              <span className="text-sm font-medium">Analyzing</span>
            </div>
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${localContactStatus === 'completed' ? 'bg-green-50 text-green-700' : 'text-gray-500'}`}>
              <span className="text-lg">✅</span>
              <span className="text-sm font-medium">Complete</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center p-6 pt-4 border-t border-gray-200 bg-gray-50">
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Research powered by ResearchBy.ai
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Real-time progress updates every 5 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResearchProgressModal;
