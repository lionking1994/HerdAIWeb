// import React, { useState, useEffect } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import { ArrowLeft, Edit, User, Building, Briefcase } from 'lucide-react';

// import { useCompanyId } from '../../hooks/useCompanyId';
// import { useToast } from '../../hooks/useToast';
// import axios from 'axios';
// import './OpportunityDetail.css';

// interface OpportunityData {
//   opportunity: {
//     id: string;
//     name: string;
//     amount: number;
//     stage: string;
//     probability: number;
//     lead_source: string;
//     expected_close_date: string;
//     actual_close_date: string;
//     description: string;
//     stage_weight?: number;
//   };
//   account: {
//     id: string;
//     name: string;
//     account_type: string;
//     industry: string;
//     website: string;
//     email: string;
//     phone: string;
//     description: string;
//   };
//   owner: {
//     id: string;
//     name: string;
//     email: string;
//     phone: string;
//     location: string;
//     bio: string;
//     avatar?: string;
//     department?: string;
//     job_title?: string;
//   };
// }

// const OpportunityDetail = () => {
//   const { id } = useParams();
//   const navigate = useNavigate();

//   const companyId = useCompanyId();
//   const { showError, showSuccess } = useToast();
//   const [opportunityData, setOpportunityData] = useState<OpportunityData | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
  

//   // Fetch opportunity data from API
//   useEffect(() => {
//     let isMounted = true;

//     const fetchOpportunityDetail = async () => {
//       try {
//         if (!isMounted) return;
        
//         console.log('🔍 Fetching opportunity detail for ID:', id, 'Company ID:', companyId);
//         setIsLoading(true);
//         setError(null);
        
//         const token = localStorage.getItem('token');
//         if (!token) {
//           throw new Error('Authentication token not found');
//         }

//         const apiUrl = `http://localhost:5000/api/crm/opportunities/${id}/detail?company=${companyId}`;
//         console.log('🌐 API URL:', apiUrl);
//         console.log('🔑 Token:', token ? 'Present' : 'Missing');
//         console.log('🏢 Company ID:', companyId);
        
//         const response = await axios.get(apiUrl, {
//           headers: { 
//             Authorization: `Bearer ${token}`
//           }
//         });

//         if (response.data.success && isMounted) {
//           console.log('✅ Opportunity data fetched successfully:', response.data.data);
//           console.log('🔍 Owner data:', response.data.data.owner);
//           console.log('🔍 Account data:', response.data.data.account);
//           setOpportunityData(response.data.data);
//         } else if (isMounted) {
//           throw new Error(response.data.message || 'Failed to fetch opportunity details');
//         }
//       } catch (error: any) {
//         if (isMounted) {
//           console.error('❌ Error fetching opportunity detail:', error);
//           const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch opportunity details';
//           setError(errorMessage);
//           showError('Failed to load opportunity details');
//         }
//       } finally {
//         if (isMounted) {
//           setIsLoading(false);
//         }
//       }
//     };

//     console.log('🔍 useEffect triggered with:');
//     console.log('  - ID:', id);
//     console.log('  - Company ID:', companyId);
//     console.log('  - Type of Company ID:', typeof companyId);
//     console.log('  - Company ID length:', companyId ? companyId.length : 'undefined');
    
//     if (id && companyId) {
//       console.log('🚀 Starting API call with ID:', id, 'Company ID:', companyId);
//       fetchOpportunityDetail();
//     } else {
//       console.log('⏳ Waiting for ID or Company ID. ID:', id, 'Company ID:', companyId);
//     }

//     // Cleanup function to prevent memory leaks and multiple API calls
//     return () => {
//       console.log('🧹 Cleaning up useEffect for ID:', id);
//       isMounted = false;
//     };
//   }, [id, companyId]); // Removed showError from dependencies

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat('en-US', {
//       style: 'currency',
//       currency: 'USD',
//       minimumFractionDigits: 0,
//       maximumFractionDigits: 0,
//     }).format(amount);
//   };

//   const formatDate = (dateString: string) => {
//     if (!dateString) return 'Not set';
//     return new Date(dateString).toLocaleDateString('en-US', {
//       month: 'numeric',
//       day: 'numeric',
//       year: 'numeric'
//     });
//   };

//   const getStageProgress = (stage: string) => {
//     const stages = ['Prospecting', 'Qualification', 'Negotiating', 'Closed'];
//     const currentIndex = stages.indexOf(stage);
//     return ((currentIndex + 1) / stages.length) * 100;
//   };



//   const handleResearch = () => {
//     // TODO: Implement ResearchBy.ai integration
//     showSuccess('Research functionality will be implemented with ResearchBy.ai');
//   };

//   const handleBack = () => {
//     navigate('/crm/opportunities');
//   };

//   if (isLoading) {
//     return (
//       <div className="min-h-screen bg-gray-50">
//         <div className="flex items-center justify-center min-h-screen">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
//         </div>
//       </div>
//     );
//   }

//   if (error || !opportunityData) {
//     return (
//       <div className="min-h-screen bg-gray-50">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//           <div className="text-center">
//             <div className="text-red-600 text-6xl mb-4">⚠️</div>
//             <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Opportunity</h1>
//             <p className="text-gray-600 mb-6">{error || 'Failed to load opportunity details'}</p>
//             <button
//               onClick={handleBack}
//               className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
//             >
//               Go Back
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   const { opportunity, account, owner } = opportunityData;
  
//   // Debug: Log current data state
//   console.log('🎯 Current render data:', { opportunity, account, owner });

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <div className="opportunity-header">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
//           <div className="flex items-center justify-between">
//             <div className="flex items-center space-x-4">
//               <button
//                 onClick={handleBack}
//                 className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
//               >
//                 <ArrowLeft className="w-5 h-5" />
//               </button>
//               <h1 className="text-2xl font-bold text-gray-900">{opportunity.name}</h1>
//             </div>
//             <button
//               onClick={handleResearch}
//               className="research-button flex items-center space-x-3 px-6 py-3 text-white rounded-lg transition-all"
//             >
//               <div className="research-icon w-5 h-5">
//                 <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
//                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
//                   <path d="M12 4c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8-8-3.59-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
//                 </svg>
//               </div>
//               <span>Research</span>
//             </button>

//           </div>
//         </div>
//       </div>

//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
//           {/* Left Column */}
//           <div className="space-y-8">
            
//             {/* Opportunity Details Card */}
//             <div className="opportunity-card p-6">
//               <div className="flex items-center justify-between mb-6">
//                 <div className="flex items-center space-x-2">
//                   <Briefcase className="w-5 h-5 text-blue-600" />
//                   <h2 className="text-xl font-semibold text-gray-900">Opportunity Details</h2>
//                 </div>
//                 <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
//                   <Edit className="w-4 h-4" />
//                 </button>
//               </div>
              
//               <div className="space-y-6">
//                 {/* Amount */}
//                 <div className="flex items-center justify-between">
//                   <span className="text-2xl font-bold text-green-600">
//                     {formatCurrency(opportunity.amount)}
//                   </span>
//                 </div>

//                 {/* Stage Progress */}
//                 <div>
//                   <div className="flex items-center justify-between mb-2">
//                     <span className="text-sm font-medium text-gray-700">Stage</span>
//                     <span className="text-sm text-gray-500">{opportunity.stage}</span>
//                   </div>
//                   <div className="w-full bg-gray-200 rounded-full h-2">
//                     <div 
//                       className="bg-blue-600 h-2 rounded-full transition-all duration-300"
//                       style={{ width: `${getStageProgress(opportunity.stage)}%` }}
//                     ></div>
//                   </div>
//                   <div className="flex justify-between text-xs text-gray-500 mt-1">
//                     <span>Prospecting</span>
//                     <span>Qualification</span>
//                     <span>Negotiating</span>
//                     <span>Closed</span>
//                   </div>
//                 </div>

//                 {/* Other Details */}
//                 <div className="grid grid-cols-2 gap-4">
//                   <div>
//                     <span className="text-sm text-gray-500">Probability</span>
//                     <p className="text-sm font-medium text-gray-900">{opportunity.probability}% Likely</p>
//                   </div>
//                   <div>
//                     <span className="text-sm text-gray-500">Lead Source</span>
//                     <p className="text-sm font-medium text-gray-900">{opportunity.lead_source}</p>
//                   </div>
//                   <div>
//                     <span className="text-sm text-gray-500">Expected Close</span>
//                     <p className="text-sm font-medium text-gray-900">{formatDate(opportunity.expected_close_date)}</p>
//                   </div>
//                   <div>
//                     <span className="text-sm text-gray-500">Actual Close</span>
//                     <p className="text-sm font-medium text-gray-900">{formatDate(opportunity.actual_close_date)}</p>
//                   </div>
//                 </div>

//                 {/* Description */}
//                 <div>
//                   <span className="text-sm text-gray-500">Description</span>
//                   <p className="text-sm text-gray-900 mt-1">{opportunity.description}</p>
//                 </div>
//               </div>
//             </div>

//             {/* Company Information Card - Basic View */}
//             <div className="opportunity-card p-6">
//               <div className="flex items-center space-x-2 mb-6">
//                 <Building className="w-5 h-5 text-blue-600" />
//                 <h2 className="text-xl font-semibold text-gray-900">Company Information</h2>
//               </div>
              
//               <div className="space-y-6">
//                 {/* Company Header */}
//                 <div className="flex items-center space-x-4">
//                   <div className="company-avatar w-12 h-12 rounded-full flex items-center justify-center">
//                     <Building className="w-6 h-6 text-blue-600" />
//                   </div>
//                   <div>
//                     <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
//                     <p className="text-sm text-gray-500">{account.industry} Company</p>
//                   </div>
//                 </div>

//                 {/* Basic Info */}
//                 <div className="grid grid-cols-2 gap-4">
//                   <div>
//                     <span className="text-sm text-gray-500">Website</span>
//                     <p className="text-sm font-medium text-blue-600">{account.website}</p>
//                   </div>
//                   <div>
//                     <span className="text-sm text-gray-500">Type</span>
//                     <p className="text-sm font-medium text-blue-600">{account.account_type}</p>
//                   </div>
//                   <div>
//                     <span className="text-sm text-gray-500">Industry</span>
//                     <p className="text-sm font-medium text-gray-900">{account.industry}</p>
//                   </div>
//                   <div>
//                     <span className="text-sm text-gray-500">Email</span>
//                     <p className="text-sm font-medium text-gray-900">{account.email}</p>
//                   </div>
//                   <div>
//                     <span className="text-sm text-gray-500">Phone</span>
//                     <p className="text-sm font-medium text-gray-900">{account.phone}</p>
//                   </div>
//                 </div>

//                 {/* Description */}
//                 {account.description && (
//                   <div>
//                     <span className="text-sm text-gray-500">Description</span>
//                     <p className="text-sm text-gray-900 mt-1">{account.description}</p>
//                   </div>
//                 )}


//               </div>
//             </div>
//           </div>

//           {/* Right Column */}
//           <div className="space-y-8">
            
//             {/* Key Contact Card - Basic View */}
//             <div className="opportunity-card p-6">
//               <div className="flex items-center space-x-2 mb-6">
//                 <User className="w-5 h-5 text-blue-600" />
//                 <h2 className="text-xl font-semibold text-gray-900">Key Contact</h2>
//               </div>
              
//               {owner && owner.id ? (
//                 <div className="space-y-6">
//                   {/* Contact Header */}
//                   <div className="flex items-center space-x-4">
//                     <div className="contact-avatar w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg">
//                       {owner.name ? 
//                         owner.name.split(' ').map(word => word.charAt(0)).join('').toUpperCase() : 
//                         'UO'
//                       }
//                     </div>
//                     <div>
//                       <h3 className="text-lg font-semibold text-gray-900">{owner.name || 'Unnamed Contact'}</h3>
//                       {/* <p className="text-sm text-gray-500">{owner.job_title || 'Contact'}</p> */}
//                       {owner.bio && (
//                         <p className="text-sm text-gray-700 mt-1">{owner.bio}</p>
//                       )}
//                     </div>
//                   </div>

//                   {/* Contact Details */}
//                   <div className="space-y-3">
//                     {owner.email && (
//                       <div>
//                         <span className="text-sm text-gray-500">Email</span>
//                         <p className="text-sm font-medium text-gray-900">{owner.email}</p>
//                       </div>
//                     )}
//                     {owner.phone && (
//                       <div>
//                         <span className="text-sm text-gray-500">Phone</span>
//                         <p className="text-sm font-medium text-gray-900">{owner.phone}</p>
//                       </div>
//                     )}
//                     {owner.location && (
//                       <div>
//                         <span className="text-sm text-gray-500">Location</span>
//                         <p className="text-sm font-medium text-gray-900">{owner.location}</p>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               ) : (
//                 <div className="text-center py-8">
//                   <div className="text-gray-400 text-6xl mb-4">👤</div>
//                   <p className="text-gray-500">No contact assigned to this opportunity</p>
//                 </div>
//               )}
//             </div>


//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default OpportunityDetail;
