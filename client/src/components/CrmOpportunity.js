import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, User, Building, Briefcase, TrendingUp, Clock, Plus, CheckCircle, Calendar, Flag, ChevronLeft, ChevronRight, X } from 'lucide-react';
import axios from 'axios';
import './CrmOpportunity.css'
import { toast } from 'react-toastify';
import Navbar from './Navbar';
import Footer from './Footer';
import { useLocation } from "react-router-dom";
import { ChevronUp, ChevronDown } from "lucide-react";
import AvatarPop from './AvatarPop';

// Research Modal Components
import ContactSelectionModal from './ResearchModal/ContactSelectionModal';
import ResearchProgressModal from './ResearchModal/ResearchProgressModal';
import OpportunityForm from './OpportunityFormModel';
import CompanyFormModel from './CompanyFormModel';
import ContactFormModel from './ContactFormModel';
import OpportunityNodeGraph from './OpportunityNodeGraph';

const CrmOpportunity = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  // const companyId = useCompanyId();
  const [opportunityData, setOpportunityData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Research Modal States
  const [showContactSelection, setShowContactSelection] = useState(false);
  const [showResearchProgress, setShowResearchProgress] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [researchData, setResearchData] = useState(null);

  // Real research progress states
  const [companyProgress, setCompanyProgress] = useState(0);
  const [contactProgress, setContactProgress] = useState(0);
  const [companyStatus, setCompanyStatus] = useState('pending');
  const [contactStatus, setContactStatus] = useState('pending');
  const [currentStep, setCurrentStep] = useState('company');
  const [expandBios, setExpandBios] = useState({})

  // Research completion state
  const [isResearchCompleted, setIsResearchCompleted] = useState(false);

  // Download loading states
  const [isDownloadingCompany, setIsDownloadingCompany] = useState(false);
  const [isDownloadingContact, setIsDownloadingContact] = useState(false);
  const [isDownloadingOpportunity, setIsDownloadingOpportunity] = useState(false);

  // Stages state
  const [stages, setStages] = useState([]);
  const [isLoadingStages, setIsLoadingStages] = useState(false);

  // Stage change state
  const [isChangingStage, setIsChangingStage] = useState(false);
  const [currentStage, setCurrentStage] = useState(null);
  const [showStageChangeModal, setShowStageChangeModal] = useState(false);
  const [stageChangeData, setStageChangeData] = useState(null);

  const [editingOpportunity, setEditingOpportunity] = useState();
  const [showFormModal, setShowFormModal] = useState(false);
  const [refreshdata, setrefreshdata] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [selectedRelationShip, setSelectedRelationShip] = useState(null);

  // Company and Contact modal states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedContactForEdit, setSelectedContactForEdit] = useState(null);
  const [isLoadingResearch, setIsLoadingResearch] = useState(false);
  const [isResearchPaused, setIsResearchPaused] = useState(false);
  const [researchRaw, setResearchRaw] = useState(null);
  const [showIntelligenceGraph, setShowIntelligenceGraph] = useState(false);
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [meeting, setMeeting] = useState(null);
  const [stageHistoryData, setStageHistoryData] = useState([]);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const companyId = searchParams.get("company"); // "32726"

  // Task states for opportunity
  const [opportunityTasks, setOpportunityTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskPagination, setTaskPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [taskSortBy, setTaskSortBy] = useState('duedate');
  const [taskSortOrder, setTaskSortOrder] = useState('asc');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium',
    assigned_id: '',
    estimated_hours: ''
  });
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [companyUsers, setCompanyUsers] = useState([]);

  // Function to show stage change confirmation modal
  const showStageChangeConfirmation = (newStageId) => {
    const newStage = stages.find(s => s.id === newStageId);
    const currentStageName = opportunity?.stage || 'Unknown';
    const newStageName = newStage ? newStage.name : 'Unknown Stage';

    setStageChangeData({
      newStageId,
      newStageName,
      currentStageName
    });
    setShowStageChangeModal(true);
  };

  // Function to confirm and execute stage change
  const confirmStageChange = async () => {
    if (!stageChangeData) return;

    try {
      setIsChangingStage(true);

      const opportunityId = opportunityData?.opportunity?.id;

      if (!opportunityId) {
        toast.error('Missing opportunity or company information');
        return;
      }

      console.log('🔄 Changing stage to:', stageChangeData.newStageName, '(', stageChangeData.newStageId, ')');

      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/crm/opportunities/stage-history/${opportunityId}?company=${companyId}`,
        { stage_id: stageChangeData.newStageId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        console.log('✅ Stage changed successfully:', response.data);
        toast.success(`Stage updated to ${stageChangeData.newStageName}!`);

        // Refresh opportunity data to get updated stage
        setrefreshdata(!refreshdata);

        // Also refresh stages to ensure we have latest data
        await fetchStages();
      } else {
        throw new Error(response.data.message || 'Failed to change stage');
      }

    } catch (error) {
      console.error('❌ Error changing stage:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to change stage');
    } finally {
      setIsChangingStage(false);
      setShowStageChangeModal(false);
      setStageChangeData(null);
    }
  };

  const fetchStageHistory = async () => {
    try {
      const opportunityId = id;

      if (!opportunityId) {
        toast.error('Missing opportunity or company information');
        return;
      }

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/crm/opportunities/${opportunityId}/stage-history-details?company=${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        setStageHistoryData(response.data.data); // ← populate the state array
      } else {
        console.error('Failed to fetch stage history:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching stage history:', error);
    }
  };

  // useEffect(() => {
  //   if (opportunityData?.opportunity?.id) {
  //     fetchStageHistory();
  //   }
  // }, [opportunityData?.opportunity?.id]);

  // ==================== TASK FUNCTIONS ====================
  
  // Fetch tasks for this opportunity
  const fetchOpportunityTasks = async (page = 1) => {
    try {
      setIsLoadingTasks(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/crm/opportunities/${id}/tasks`,
        {
          params: {
            page,
            limit: taskPagination.limit,
            sortBy: taskSortBy,
            sortOrder: taskSortOrder
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        setOpportunityTasks(response.data.tasks);
        setTaskPagination(response.data.pagination);
      } else {
        console.error('Failed to fetch tasks:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching opportunity tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Fetch company users for task assignment
  const fetchCompanyUsers = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/users/company-users?company=${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (response.data.success) {
        setCompanyUsers(response.data.users || []);
      }
    } catch (error) {
      console.error('Error fetching company users:', error);
    }
  };

  // Create a new task for this opportunity
  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    if (!newTask.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    try {
      setIsCreatingTask(true);
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/crm/opportunities/${id}/tasks`,
        {
          title: newTask.title,
          description: newTask.description,
          dueDate: newTask.dueDate || null,
          priority: newTask.priority,
          assigned_id: newTask.assigned_id || null,
          estimated_hours: newTask.estimated_hours || null
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        toast.success('Task created successfully');
        setShowAddTaskModal(false);
        setNewTask({
          title: '',
          description: '',
          dueDate: '',
          priority: 'Medium',
          assigned_id: '',
          estimated_hours: ''
        });
        // Refresh tasks list
        fetchOpportunityTasks(1);
      } else {
        toast.error(response.data.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(error.response?.data?.error || 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Handle task sort change
  const handleTaskSort = (field) => {
    if (taskSortBy === field) {
      setTaskSortOrder(taskSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setTaskSortBy(field);
      setTaskSortOrder('asc');
    }
  };

  // Effect to fetch tasks when sort changes
  useEffect(() => {
    if (id && companyId) {
      fetchOpportunityTasks(1);
    }
  }, [taskSortBy, taskSortOrder]);

  // Effect to fetch tasks and users on mount
  useEffect(() => {
    if (id && companyId) {
      fetchOpportunityTasks(1);
      fetchCompanyUsers();
    }
  }, [id, companyId]);

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in progress': 
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rated': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format date for display
  const formatTaskDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Function to cancel stage change
  const cancelStageChange = () => {
    setShowStageChangeModal(false);
    setStageChangeData(null);
  };

  // Function to fetch stages from API
  const fetchStages = async () => {
    try {
      setIsLoadingStages(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/crm/stages?company=${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        // Sort stages by order_index
        const sortedStages = response.data.data.sort((a, b) => a.order_index - b.order_index);
        setStages(sortedStages);
        console.log('✅ Stages fetched successfully:', sortedStages);
      } else {
        console.error('❌ Failed to fetch stages:', response.data.message);
      }
    } catch (error) {
      console.error('❌ Error fetching stages:', error);
    } finally {
      setIsLoadingStages(false);
    }
  };

  // Check research status from opportunity data
  const checkResearchFromOpportunityData = () => {
    if (!opportunityData?.research) {
      console.log('⚠️ No research info in opportunity data');
      setIsResearchCompleted(false);
      return;
    }

    const { exists, is_completed, status } = opportunityData?.research;
    console.log('🔍 Research info from opportunity data:', opportunityData?.research);

    if (exists && is_completed) {
      console.log('✅ Research completed, auto-loading results');
      setIsResearchCompleted(true);

      // We need to determine which contact to use for research results
      let contactToUse = null;

      // Check if related contacts exist (exclude owner for research)
      if (opportunityData?.related_contacts && opportunityData?.related_contacts.length > 0) {
        contactToUse = opportunityData?.related_contacts[0];
      }

      if (contactToUse) {
        console.log('👤 Using contact for research results:', contactToUse.name);
        setSelectedContact(contactToUse);
        // Auto-load research results with the selected contact
        fetchResearchResults(id);
      } else {
        console.log('ℹ️ No contact available for research results - research completed for company and opportunity only');
        // Still mark as completed but don't load results
        setIsResearchCompleted(true);
      }
    } else {
      console.log('⚠️ Research not completed or in progress:', status);
      setIsResearchCompleted(false);
    }
  };

  // Fetch opportunity data from API
  useEffect(() => {
    let isMounted = true;

    const fetchOpportunityDetail = async () => {
      try {
        if (!isMounted) return;

        console.log('🔍 Fetching opportunity detail for ID:', id);
        setIsLoading(true);
        //setError(null);

        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication token not found');
        }

        const apiUrl = `${process.env.REACT_APP_API_URL}/crm/opportunities/${id}/detail?company=${companyId}`;
        console.log('🌐 API URL:', apiUrl);

        const response = await axios.get(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data.success && isMounted) {
          setOpportunityData(response.data.data);



          // Immediately map new research_data format (if present) into existing researchData shape used by UI
          try {
            const apiOpportunity = response.data.data?.opportunity;
            const accountData = response.data.data?.account;
            const rd = apiOpportunity?.research_data;

            if (rd) {
              // keep raw for full rendering
              setResearchRaw(rd);
              const transformed = {
                company: {
                  overview: {
                    name: accountData?.name || '',
                    industry: accountData?.industry || '',
                    founded: rd.company_information?.founded || '',
                    employees: rd.company_information?.employees || '',
                    headquarters: '',
                    description: accountData?.description || ''
                  },
                  financials: {
                    revenue: rd.company_information?.annual_revenue || '',
                    funding: '',
                    market_cap: '',
                    growth: ''
                  },
                  market: {
                    size: rd.company_information?.market_share || '',
                    trends: rd.company_information?.current_challenges || [],
                    competitors: rd.company_information?.key_partnerships || [],
                    market_position: ''
                  },
                  executives: []
                },
                contact: rd.contact_research
                  ? {
                    background: {
                      name: response.data.data?.related_contacts?.[0]?.name || response.data.data?.owner?.name || 'Contact',
                      title: response.data.data?.related_contacts?.[0]?.title || '',
                      company: accountData?.name || '',
                      experience: rd.contact_research?.key_quote || '',
                      education: ''
                    },
                    skills: [],
                    linkedin: {
                      connections: '',
                      endorsements: '',
                      recommendations: ''
                    },
                    insights: rd.contact_research?.leadership_focus || [],
                    user_profile: {},
                    enhanced_expertise: {},
                    enhanced_activities: {},
                    name: response.data.data?.related_contacts?.[0]?.name || response.data.data?.owner?.name || 'Contact'
                  }
                  : undefined,
                recommendations: {
                  next_steps: [
                    ...(rd.opportunity_next_steps?.priority_1
                      ? [rd.opportunity_next_steps.priority_1]
                      : []),
                    ...(rd.opportunity_next_steps?.priority_2
                      ? [rd.opportunity_next_steps.priority_2]
                      : []),
                    ...(rd.opportunity_next_steps?.priority_3
                      ? [rd.opportunity_next_steps.priority_3]
                      : []),
                    ...(rd.opportunity_next_steps?.priority_4
                      ? [rd.opportunity_next_steps.priority_4]
                      : [])
                  ].map((step) => {
                    if (typeof step === 'string') {
                      return {
                        action: step,
                        timeline: 'Within 1 week',
                        impact: 'High',
                        key_message: `Focus on ${step.toLowerCase()} to advance this opportunity`
                      };
                    }
                    // map structured priority objects
                    return {
                      action: step?.focus || step?.name || '',
                      timeline: step?.due_by || 'Within 1 week',
                      impact: step?.focus || 'High',
                      key_message: step?.action || step?.key_message || ''
                    };
                  }),
                  success_metrics: rd.opportunity_next_steps?.success_metrics || [],
                  priority: 'High'
                },
                opportunity: {
                  insights: rd.opportunity_next_steps?.success_metrics || [],
                  summary: ''
                }
              };

              setResearchData(transformed);
              setIsResearchCompleted(true);
              setIsLoadingResearch(false);
              setShowResearchProgress(false);
            } else {
              // Fallback to previous behavior if no research_data present
              setTimeout(() => {
                checkResearchFromOpportunityData();
              }, 100);
            }
          } catch (e) {
            console.error('Error transforming research_data:', e);
          }
        } else if (isMounted) {
          throw new Error(response.data.message || 'Failed to fetch opportunity details');
        }
      } catch (error) {
        if (isMounted) {
          console.error('❌ Error fetching opportunity detail:', error);

          let errorMessage = 'Failed to fetch opportunity details';

          // Handle specific error cases
          if (error.message.includes('Company ID not found')) {
            errorMessage = 'Unable to determine your company context. Please refresh the page or contact support.';
          } else if (error.response?.status === 404) {
            errorMessage = 'Opportunity not found or you do not have access to it.';
          } else if (error.response?.status === 403) {
            errorMessage = 'You do not have permission to view this opportunity.';
          } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.message) {
            errorMessage = error.message;
          }

          // setError(errorMessage);
          toast.error(errorMessage);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (id) {
      fetchOpportunityDetail();
      fetchStageHistory();
    }

    return () => {
      isMounted = false;
    };
  }, [id, refreshdata]);

  // Auto-check research when opportunity data is available
  useEffect(() => {
    if (opportunityData && !isResearchCompleted) {
      console.log('🔍 Opportunity data loaded, checking research status');
      checkResearchFromOpportunityData();
    }
  }, [opportunityData, isResearchCompleted]);

  // Fetch stages when component mounts
  useEffect(() => {
    fetchStages();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStageProgress = (stage) => {
    if (!stages || stages.length === 0) return 0;

    const currentStage = stages.find(s => s.name === stage);
    if (!currentStage) return 0;

    // Calculate progress based on order_index and weight_percentage
    const progress = (currentStage.order_index / stages.length) * 100;
    return Math.min(progress, 100); // Ensure it doesn't exceed 100%
  };

  const getCurrentStageIndex = (stage) => {
    if (!stages || stages.length === 0) return 0;

    const currentStage = stages.find(s => s.name === stage);
    return currentStage ? currentStage.order_index - 1 : 0;
  };

  const handleResearch = () => {

    // Check if there are any contacts available
    const allContacts = [];

    // Add related contacts (exclude owner for research)
    if (opportunityData?.related_contacts) {
      allContacts.push(...opportunityData?.related_contacts);
    }

    console.log(`🔍 Found ${allContacts.length} contacts for research:`, allContacts);

    // If no contacts available, start research for company and opportunity only
    if (allContacts.length === 0) {
      console.log(`ℹ️ No contacts available, starting research for company and opportunity only`);
      toast.error('No contacts available, please add a contact to the opportunity');
      return;
    }

    setIsLoadingResearch(true);
    // If only one contact, auto-select and start research
    if (allContacts.length === 1) {
      console.log(`✅ Auto-selecting single contact: ${allContacts[0].name}`);
      setSelectedContact(allContacts[0]);
      startRealResearch(allContacts[0]); // Use real research instead of mock
    } else if (allContacts.length > 1) {
      // Show contact selection modal
      console.log(`📋 Multiple contacts found, showing selection modal`);
      setShowContactSelection(true);
    }
  };

  // open modal for editing
  const handleEdit = (opportunity) => {
    setSelectedOpportunity(opportunity);
    setSelectedRelationShip(opportunityData?.related_contacts)
    setShowFormModal(true);
  };

  const handleCancel = () => {
    setShowFormModal(false);
    setSelectedOpportunity(null);
  };

  // Company edit handlers
  const handleEditCompany = (company) => {
    setSelectedCompany(company);
    setShowCompanyModal(true);
  };

  const handleCompanyCancel = () => {
    setShowCompanyModal(false);
    setSelectedCompany(null);
  };

  const handleCompanySubmit = (formData) => {
    console.log('Company form submitted:', formData);
    setShowCompanyModal(false);
    setSelectedCompany(null);
    // Refresh opportunity data
    setrefreshdata(!refreshdata);
  };

  // Contact edit handlers
  const handleEditContact = (contact) => {
    if (!contact) {
      toast.error('No contact available to edit');
      return;
    }
    setSelectedContactForEdit(contact);
    setShowContactModal(true);
  };

  const handleContactCancel = () => {
    setShowContactModal(false);
    setSelectedContactForEdit(null);
  };

  const handleContactSubmit = (formData) => {
    console.log('Contact form submitted:', formData);
    setShowContactModal(false);
    setSelectedContactForEdit(null);
    // Refresh opportunity data
    setrefreshdata(!refreshdata);
  };

  const startResearch = (contact) => {
    // This function is now deprecated - use startRealResearch instead
    console.log('⚠️ startResearch called - using startRealResearch instead');
    startRealResearch(contact);
  };

  const handleResearchComplete = () => {
    setShowResearchProgress(false);

    // This function is now only used for fallback scenarios
    // Real research should use fetchResearchResults instead
    console.log('⚠️ handleResearchComplete called - this should not happen with real research');

    // Show a message that research is being processed
    toast.info('Research is being processed. Please wait for results...');
  };

  const startRealResearch = async (contact) => {
    setSelectedContact(contact);
    setShowContactSelection(false);
    setShowResearchProgress(true);

    // Reset progress states
    setCompanyProgress(0);
    setContactProgress(0);
    setCompanyStatus('pending');
    setContactStatus('pending');
    setCurrentStep('company');

    // Reset research completion state
    setIsResearchCompleted(false);
    setResearchData(null);

    try {
      // Get company ID from opportunity data
      const accountId = opportunityData?.account?.id;
      const opportunityId = opportunityData?.opportunity?.id;

      if (!accountId || !opportunityId) {
        throw new Error('Missing company or opportunity information');
      }


      // Log the research request details for debugging
      const researchRequest = {
        companyName: opportunityData?.account.name,
        contactName: contact.name || '',
        contactEmail: contact.email || '',
        opportunityId: opportunityId,
        accountId: accountId,
        contactId: contact.id,
        tenantId: companyId
      };

      // Start research for company and opportunity (contact is optional)
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/crm/research/opportunity`,
        researchRequest,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        console.log('Research started successfully:', response.data);
        // Start polling for research status
        pollResearchStatus(opportunityId);
      } else {
        setIsLoadingResearch(false);
        throw new Error(response.data.message || 'Failed to start research');
      }

    } catch (error) {
      console.error('Error starting research:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to start research');
      setShowResearchProgress(false);
      setIsResearchPaused(true);
    }
  };
  const toggleBio = (id) => {
    setExpandBios((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Poll research status until completion
  const pollResearchStatus = async (opportunityId) => {
    const maxAttempts = 100; // 5 minutes with 5-second intervals
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/crm/research/status/${opportunityId}/${companyId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.data.success) {
          const { company, contact } = response.data.data;

          console.log('📊 Research status update:', { company, contact });

          // Update progress states with real progress data
          if (company.status === 'completed') {
            setCompanyProgress(100);
            setCompanyStatus('completed');
          } else if (company.status === 'in-progress') {
            setCompanyProgress(company.progress || 50);
            setCompanyStatus('in-progress');
          } else {
            setCompanyProgress(company.progress || 0);
            setCompanyStatus(company.status);
          }

          if (contact.status === 'completed') {
            setContactProgress(100);
            setContactStatus('completed');
          } else if (contact.status === 'in-progress') {
            setContactProgress(contact.progress || 50);
            setContactStatus('in-progress');
            setCurrentStep('contact');
          } else {
            setContactProgress(contact.progress || 0);
            setContactStatus(contact.status);
          }

          // Check if both researches are complete
          if (company.status === 'completed' && contact.status === 'completed') {
            console.log('Research completed!');
            // Fetch final results
            setrefreshdata(!refreshdata);
            await fetchResearchResults(opportunityId);
            return;
          }

          // Update progress (you can enhance this with real progress data)
          console.log('Research in progress:', { company: company.status, contact: contact.status });
        }

        attempts++;
        if (attempts < maxAttempts) {
          // Continue polling every 5 seconds
          setTimeout(checkStatus, 10000);
        } else {
          // Timeout - show results anyway
          console.log('Research timeout - fetching available results');
          await fetchResearchResults(opportunityId);
        }

      } catch (error) {
        console.error('Error checking research status:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 10000);
        } else {
          toast.error('Research status check failed');
          setShowResearchProgress(false);
          setIsResearchPaused(true);
        }
      }
    };

    // Start polling
    checkStatus();
  };

  // Fetch research results from API
  const fetchResearchResults = async (opportunityId) => {
    try {
      console.log('🚀 fetchResearchResults called with opportunityId:', opportunityId);
      console.log('👤 Current selectedContact:', selectedContact);


      // Get contact ID from selected contact or fallback to first available contact
      let contactToUse = selectedContact;
      let contactId = null;

      if (!contactToUse) {
        console.log('⚠️ No selectedContact, trying to find fallback contact');

        // Try to get first available contact from opportunity data (exclude owner)
        if (opportunityData?.related_contacts && opportunityData?.related_contacts.length > 0) {
          contactToUse = opportunityData?.related_contacts[0];
          console.log('👤 Using first related contact as fallback:', contactToUse.name);
        }

        if (contactToUse) {
          setSelectedContact(contactToUse);
        }
      }

      // Determine the correct contact ID if contact is available
      if (contactToUse) {
        if (contactToUse.user_id) {
          contactId = contactToUse.user_id;
        } else if (contactToUse.id) {
          contactId = contactToUse.id;
        }

        if (!contactId) {
          console.error('❌ Unable to determine contact ID from contact:', contactToUse);
          throw new Error('Unable to determine contact ID for research results');
        }
      } else {
        console.log('ℹ️ No contact available - will fetch company and opportunity research only');
      }

      console.log('🔍 Fetching research results with:', { opportunityId, companyId, contactId });

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/crm/research/results/${opportunityId}/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          params: {
            ...(contactId && { contactId: contactId }) // Only pass contactId if available
          }
        }
      );

      if (response.data.success) {
        const { opportunity, account, contact } = response.data.data;

        console.log('📊 API Research Data Received:', response.data.data);

        // Transform API data to match expected format
        const researchData = {
          company: {
            overview: {
              name: account.research_data?.name || opportunityData?.account?.name || 'Company Name',
              industry: account.research_data?.overview?.industry || '',
              founded: account.research_data?.overview?.founded || '',
              employees: account.research_data?.overview?.employees || '',
              headquarters: account.research_data?.overview?.headquarters || '',
              description: account.research_data?.overview?.description || ''
            },
            financials: {
              revenue: account.research_data?.financials?.revenue || '',
              funding: account.research_data?.financials?.funding || '',
              valuation: account.research_data?.financials?.market_cap || '',
              growth: account.research_data?.financials?.growth || ''
            },
            market: {
              size: account.research_data?.market?.size || '',
              trends: account.research_data?.market?.trends || [],
              competitors: account.research_data?.market?.competitors || []
            },
            executives: account.research_data?.executives || []
          },
          // Contact data (only if contact research is available)
          ...(contact && contact.research_data && {
            contact: {
              background: {
                name: contact.research_data?.name || selectedContact?.name || 'Contact Name',
                title: contact.research_data?.background?.title || '',
                company: account.research_data?.name || opportunityData?.account?.name || '',
                experience: contact.research_data?.background?.experience || '',
                education: contact.research_data?.background?.education || ''
              },
              skills: contact.research_data?.background?.skills || [],
              linkedin: {
                connections: contact.research_data?.background?.linkedin?.connections || '',
                endorsements: contact.research_data?.background?.linkedin?.endorsements || '',
                recommendations: contact.research_data?.background?.linkedin?.recommendations || ''
              },
              insights: contact.research_data?.insights || [],
              // Enhanced contact data from database
              user_profile: contact.research_data?.user_profile || {},
              enhanced_expertise: contact.research_data?.enhanced_expertise || {},
              enhanced_activities: contact.research_data?.enhanced_activities || {},
              // Contact name for display
              name: contact.research_data?.name || selectedContact?.name || 'Contact Name'
            }
          }),
          // Add recommendations from opportunity research data
          recommendations: {
            priority: 'High',
            next_steps: opportunity.research_data?.next_steps?.map(step => ({
              action: step,
              timeline: 'Within 1 week',
              impact: 'High',
              key_message: `Focus on ${step.toLowerCase()} to advance this opportunity`
            })) || [],
            success_metrics: opportunity.research_data?.insights || []
          },
          // Add opportunity insights
          opportunity: {
            insights: opportunity.research_data?.insights || [],
            summary: opportunity.research_data?.summary || ''
          }
        };

        console.log('🔄 Transformed Research Data:', researchData);
        console.log('📊 Setting research data state...');

        setResearchData(researchData);
        setIsResearchCompleted(true);
        setIsLoadingResearch(false);
        setShowResearchProgress(false);

        console.log('✅ Research data state updated, should now display in UI');
        // toast.success('Research completed successfully!');

      } else {
        setIsLoadingResearch(false);
        throw new Error(response.data.message || 'Failed to fetch research results');
      }

    } catch (error) {
      console.error('Error fetching research results:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to fetch research results');
      setShowResearchProgress(false);

      // Don't fallback to mock data - show error instead
      console.log('API error - not falling back to mock data');
      toast.error('Failed to fetch research results. Please try again.');
    }
  };

  const handleBack = () => {
    navigate('/crm/opportunities');
  };

  const handleFormSubmit = async (formData) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/crm/opportunities/${selectedOpportunity.id}?company=${selectedOpportunity.tenant_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const result = await response.json();
      if (result.success) {
        console.log("✅ Updated:", result.data);
        setShowFormModal(false); // close modal
        setSelectedOpportunity(null);
        setrefreshdata(!refreshdata);
        // 🔄 reload your opportunities list here if needed
      } else {
        console.error("❌ Update failed:", result.message);
      }
    } catch (err) {
      console.error("⚠️ Error updating:", err);
    }
  };

  // Download Company Research Function
  const downloadCompanyResearch = async () => {
    try {
      // Set loading state
      setIsDownloadingCompany(true);

      // Check if we have research data from the API response
      if (!researchData?.company) {
        toast.error('Company research data not available');
        return;
      }

      // We need to get the file information from the research results API
      // Since the download URL is not stored in researchData, we need to fetch it again
      const opportunityId = opportunityData?.opportunity?.id;
      if (!opportunityId) {
        toast.error('Missing opportunity or company information');
        return;
      }

      // Fetch the research results to get the download URL
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/crm/research/results/${opportunityId}/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success && response.data.data.account?.research_results) {
        const companyResearch = response.data.data.account.research_results;

        // Get the download URL from the research data
        const downloadUrl = `${process.env.REACT_APP_API_URL}${companyResearch.download_url.replace('/api', '')}`;

        console.log('🔍 Original download_url from API:', companyResearch.download_url);
        console.log('🔍 Processed download URL:', downloadUrl);
        console.log('🚀 Downloading company research from:', downloadUrl);

        // Add authorization header
        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('Authentication required for download');
          return;
        }

        // Fetch the file with authentication
        const fileResponse = await fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (fileResponse.ok) {
          const blob = await fileResponse.blob();
          const url = window.URL.createObjectURL(blob);

          // Create download link
          const link = document.createElement('a');
          link.href = url;
          link.download = companyResearch.file_name || 'company-research.docx';

          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Cleanup
          window.URL.revokeObjectURL(url);
          toast.success('Company research downloaded successfully!');
        } else {
          throw new Error(`Failed to download file: ${fileResponse.status}`);
        }
      } else {
        throw new Error('Company research data not found');
      }

    } catch (error) {
      console.error('❌ Error downloading company research:', error);
      toast.error('Failed to download company research. Please try again.');
    } finally {
      // Reset loading state
      setIsDownloadingCompany(false);
    }
  };

  // Download Contact Research Function
  const downloadContactResearch = async () => {
    try {
      // Set loading state
      setIsDownloadingContact(true);

      if (!researchData?.contact) {
        toast.error('Contact research data not available');
        return;
      }

      const opportunityId = opportunityData?.opportunity?.id;
      if (!opportunityId) {
        toast.error('Missing opportunity or company information');
        return;
      }

      // Get contact ID from selected contact
      let contactId = null;
      if (selectedContact) {
        if (selectedContact.user_id) {
          contactId = selectedContact.user_id;
        } else if (selectedContact.id) {
          contactId = selectedContact.id;
        }
      }

      if (!contactId) {
        toast.error('Contact information not available');
        return;
      }

      // Fetch the research results to get the download URL
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/crm/research/results/${opportunityId}/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          params: {
            contactId: contactId
          }
        }
      );

      if (response.data.success && response.data.data.contact?.research_results) {
        const contactResearch = response.data.data.contact.research_results;

        // Get the download URL from the research data
        const downloadUrl = `${process.env.REACT_APP_API_URL}${contactResearch.download_url.replace('/api', '')}`;

        console.log('🚀 Downloading contact research from:', downloadUrl);

        // Add authorization header
        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('Authentication required for download');
          return;
        }

        // Fetch the file with authentication
        const fileResponse = await fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (fileResponse.ok) {
          const blob = await fileResponse.blob();
          const url = window.URL.createObjectURL(blob);

          // Create download link
          const link = document.createElement('a');
          link.href = url;
          link.download = contactResearch.file_name || 'contact-research.docx';

          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Cleanup
          window.URL.revokeObjectURL(url);
          toast.success('Contact research downloaded successfully!');
        } else {
          throw new Error(`Failed to download file: ${fileResponse.status}`);
        }
      } else {
        throw new Error('Contact research data not found');
      }

    } catch (error) {
      console.error('❌ Error downloading contact research:', error);
      toast.error('Failed to download contact research. Please try again.');
    } finally {
      // Reset loading state
      setIsDownloadingContact(false);
    }
  };

  // Download Opportunity Research Function
  const downloadOpportunityResearch = async () => {
    try {
      // Set loading state
      setIsDownloadingOpportunity(true);

      // Check if we have research data from the API response
      if (!researchData?.opportunity) {
        toast.error('Opportunity research data not available');
        return;
      }

      // We need to get the file information from the research results API
      // Since the download URL is not stored in researchData, we need to fetch it again
      const opportunityId = opportunityData?.opportunity?.id;

      if (!opportunityId) {
        toast.error('Missing opportunity or company information');
        return;
      }

      // Fetch the research results to get the download URL
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/crm/research/results/${opportunityId}/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success && response.data.data.opportunity_research?.research_results) {
        const opportunityResearch = response.data.data.opportunity_research.research_results;

        // Get the download URL from the research data
        const downloadUrl = `${process.env.REACT_APP_API_URL}${opportunityResearch.download_url.replace('/api', '')}`;

        console.log('🚀 Downloading opportunity research from:', downloadUrl);

        // Add authorization header
        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('Authentication required for download');
          return;
        }

        // Fetch the file with authentication
        const fileResponse = await fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (fileResponse.ok) {
          const blob = await fileResponse.blob();
          const url = window.URL.createObjectURL(blob);

          // Create download link
          const link = document.createElement('a');
          link.href = url;
          link.download = opportunityResearch.file_name || 'opportunity-research.docx';

          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Cleanup
          window.URL.revokeObjectURL(url);
          toast.success('Opportunity research downloaded successfully!');
        } else {
          throw new Error(`Failed to download file: ${fileResponse.status}`);
        }
      } else {
        throw new Error('Opportunity research data not found');
      }

    } catch (error) {
      console.error('❌ Error downloading opportunity research:', error);
      toast.error('Failed to download opportunity research. Please try again.');
    } finally {
      // Reset loading state
      setIsDownloadingOpportunity(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // if (error || !opportunityData) {
  //   return (
  //     <div className="min-h-screen bg-gray-50">
  //       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  //         <div className="text-center">
  //           <div className="text-red-600 text-6xl mb-4">⚠️</div>
  //           <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Opportunity</h1>
  //           <p className="text-gray-600 mb-6">{error || 'Failed to load opportunity details'}</p>
  //           <button
  //             onClick={handleBack}
  //             className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
  //           >
  //             Go Back
  //           </button>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  const { opportunity, account, owner } = opportunityData;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow">
        <Navbar
          isAuthenticated={true}
          user={user}
        />
      </header>
      <main className="flex-1 mt-28 mb-16 overflow-y-auto">
        {/* Header */}
        <div className="opportunity-header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate("/")}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">{opportunity.name}</h1>
              </div>
              <div className="flex items-center space-x-3">
                {isResearchCompleted && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 whitespace-nowrap">
                    ✓ Research Completed
                  </span>
                )}
                {researchData && !isResearchCompleted && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    🔄 Research in Progress
                  </span>
                )}
                <button
                  onClick={handleResearch}
                  disabled={isLoadingResearch}
                  className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-all whitespace-nowrap ${isResearchCompleted
                    ? "bg-green-600 hover:bg-green-700"
                    : isLoadingResearch
                      ? "bg-yellow-500 cursor-wait"
                      : isResearchPaused
                        ? "bg-red-600 hover:bg-red-700"
                        : researchData
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-blue-600 hover:bg-blue-700"
                    }`}
                >
                  <div className="research-icon w-5 h-5">
                    {isLoadingResearch ? (
                      // spinner
                      <svg
                        className="w-5 h-5 animate-spin text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        ></path>
                      </svg>
                    ) : isResearchCompleted ? (
                      // ✅ completed
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    ) : (
                      // ▶ start
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </div>
                  <span>
                    {isLoadingResearch
                      ? "Research in Progress..."
                      : isResearchCompleted
                        ? "Research Again"
                        : isResearchPaused
                          ? "Research Paused"
                          : "Start Research"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow-lg rounded-xl border"> */}
        {/* Header with icon button */}
        {/* <div className="flex justify-end">
                <p className="text-lg font-semibold text-gray-700 text-center flex-1">Node Graph</p>
              <button
                onClick={async () => {
                  setShowIntelligenceGraph(!showIntelligenceGraph);
                }}
                className={`p-2 rounded-full transition-colors ${showIntelligenceGraph
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                title={showIntelligenceGraph ? "Hide Intelligence Graph" : "Show Intelligence Graph"}
              >
                {showIntelligenceGraph ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div> */}

        {/* Body content */}
        {/* {showIntelligenceGraph && (
              <div className="mt-5 flex flex-col items-center w-full px-6">
                <div className="rounded-md bg-white relative w-full max-w-5xl flex items-center justify-center h-auto">
                  {isProcessingMeeting ? (
                    // 🔄 Loader state
                    <div className="text-center text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                      <p>Processing intelligence graph...</p>
                    </div>
                  ) : opportunity?.node_json ? (
                    (() => {
                      try {
                        const graphData = JSON.parse(opportunity.node_json);
                        return (
                          <OpportunityNodeGraph
                            jsonData={graphData.graph_data || graphData}
                            meetingId={opportunity.id}
                            templateId={opportunity.template_id}
                            tPrompt={opportunity.prompt}
                            template_name={opportunity.template_name}
                            exportFormat="png"
                          />
                        );
                      } catch (error) {
                        console.error("Error parsing graph JSON:", error);
                        return (
                          <p className="text-red-500">
                            Error loading interactive graph data
                          </p>
                        );
                      }
                    })()
                  ) : (
                    // ❌ Fallback
                    <p className="text-gray-500">
                      No interactive graph data available for this opportunity
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div> */}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Opportunity Details */}
              <div className="opportunity-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Opportunity Details</h2>
                  </div>
                  <button
                    onClick={() => handleEdit(opportunity)} // ✅ open modal with data
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                </div>

                {showFormModal && (
                  <OpportunityForm
                    opportunity={selectedOpportunity}
                    relationShip={selectedRelationShip}
                    onSubmit={handleFormSubmit}
                    onCancel={() => setShowFormModal(false)}
                    setrefreshdata={setrefreshdata}
                    refreshdata={refreshdata}
                  />
                )}

                <div className="space-y-6">
                  {/* Amount */}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(opportunity.amount)}
                    </span>
                  </div>

                  {/* Stage Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Stage</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{opportunity.stage}</span>
                        {isChangingStage && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${stages.length > 0 ? getStageProgress(opportunity.stage) : 0}%` }}
                      ></div>
                    </div>
                    {isLoadingStages ? (
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Loading stages...</span>
                      </div>
                    ) : stages.length > 0 ? (
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        {stages.map((stage, index) => (
                          <button
                            key={stage.id}
                            onClick={() => showStageChangeConfirmation(stage.id)}
                            disabled={isChangingStage || stage.name === opportunity.stage}
                            className={`px-2 py-1 rounded transition-all duration-200 ${stage.name === opportunity.stage
                              ? 'text-blue-600 font-medium bg-blue-50 cursor-default'
                              : isChangingStage
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer'
                              }`}
                            title={`${stage.name === opportunity.stage ? 'Current Stage' : `Change to ${stage.name}`} (Weight: ${stage.weight_percentage}%)`}
                          >
                            {stage.name}
                            {isChangingStage && stage.name !== opportunity.stage && (
                              <div className="inline-block ml-1 animate-pulse">⏳</div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>No stages available</span>
                      </div>
                    )}
                  </div>

                  {/* Other Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Probability</span>
                      <p className="text-sm font-medium text-gray-900">{opportunity.probability}% Likely</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Lead Source</span>
                      <p className="text-sm font-medium text-gray-900">{opportunity.lead_source}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Expected Close</span>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(opportunity.expected_close_date)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Actual Close</span>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(opportunity.actual_close_date)}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <span className="text-sm text-gray-500">Description</span>
                    <p className="text-sm text-gray-900 mt-1">{opportunity.description}</p>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="opportunity-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <Building className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Company Information</h2>
                    {researchData && researchRaw && Object.keys(researchRaw).length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Research Enhanced
                      </span>
                    )}
                  </div>
                  {/* Edit Company Button */}
                  <button
                    onClick={() => handleEditCompany(account)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    title="Edit Company"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {/* Download Company Research */}
                  {researchData && researchData.company && (
                    <button
                      onClick={() => downloadCompanyResearch()}
                      disabled={isDownloadingCompany}
                      className={`p-2 rounded-lg transition-colors ${isDownloadingCompany
                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                        : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                        }`}
                      title={isDownloadingCompany ? "Downloading..." : "Download Company Research"}
                    >
                      {isDownloadingCompany ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-xs text-gray-500">Downloading...</span>
                        </div>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Company Header */}
                  <div className="flex items-center space-x-4">
                    <div className="company-avatar w-12 h-12 rounded-full flex items-center justify-center">
                      <Building className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                      <p className="text-sm text-gray-500">{account.industry} Company</p>
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Website</span>
                      <p className="text-sm font-medium text-blue-600">
                        {account.website ? (
                          <a
                            href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {account.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Type</span>
                      <p className="text-sm font-medium text-blue-600">{account.account_type}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Industry</span>
                      <p className="text-sm font-medium text-gray-900">{account.industry}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Email</span>
                      <p className="text-sm font-medium text-gray-900">{account.email}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Phone</span>
                      <p className="text-sm font-medium text-gray-900">{account.phone}</p>
                    </div>
                  </div>

                  {account.description && (
                    <div>
                      <span className="text-sm text-gray-500">Description</span>
                      <p className="text-sm text-gray-900 mt-1">{account.description}</p>
                    </div>
                  )}

                  {/* Enhanced Research Data - Show when available */}
                  {(researchData || researchRaw) && researchRaw && Object.keys(researchRaw).length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Research Insights</h3>

                      {/* Company Overview (hide if new company_information exists) */}
                      {!researchRaw?.company_information && researchData?.company?.overview && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Company Overview</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {researchData.company.overview.founded && (
                              <div>
                                <span className="text-sm text-gray-500">Founded</span>
                                <p className="text-sm font-medium text-gray-900">{researchData.company.overview.founded}</p>
                              </div>
                            )}
                            {researchData.company.overview.employees && (
                              <div>
                                <span className="text-sm text-gray-500">Employees</span>
                                <p className="text-sm font-medium text-gray-900">{researchData.company.overview.employees}</p>
                              </div>
                            )}
                            {researchData.company.overview.headquarters && (
                              <div>
                                <span className="text-sm text-gray-500">Headquarters</span>
                                <p className="text-sm font-medium text-gray-900">{researchData.company.overview.headquarters}</p>
                              </div>
                            )}
                            {researchData.company.overview.industry && (
                              <div>
                                <span className="text-sm text-gray-500">Industry</span>
                                <p className="text-sm font-medium text-gray-900">{researchData.company.overview.industry}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Financial Information (hide if new company_information exists) */}
                      {!researchRaw?.company_information && researchData?.company?.financials && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Financial Information</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {researchData.company.financials?.revenue && (
                              <div>
                                <span className="text-sm text-gray-500">Revenue</span>
                                <p className="text-sm font-medium text-green-600">{researchData.company.financials.revenue}</p>
                              </div>
                            )}
                            {researchData.company.financials?.funding && (
                              <div>
                                <span className="text-sm text-gray-500">Funding</span>
                                <p className="text-sm font-medium text-blue-600">{researchData.company.financials.funding}</p>
                              </div>
                            )}
                            {researchData.company.financials?.growth && (
                              <div>
                                <span className="text-sm text-gray-500">Growth</span>
                                <p className="text-sm font-medium text-purple-600">{researchData.company.financials.growth}</p>
                              </div>
                            )}
                            {researchData.company.financials?.market_cap && (
                              <div>
                                <span className="text-sm text-gray-500">Market Cap</span>
                                <p className="text-sm font-medium text-orange-600">{researchData.company.financials.market_cap}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Company Description (hide if new company_information exists) */}
                      {!researchRaw?.company_information && researchData?.company?.overview?.description && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Company Description</h4>
                          <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                            {researchData.company.overview.description}
                          </p>
                        </div>
                      )}

                      {/* Company Information (Raw) - Styled like provided image */}
                      {researchRaw?.company_information && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Company Information</h4>
                          <div className="bg-white rounded-md shadow-sm">
                            {/* Row helper */}
                            {researchRaw.company_information.company && (
                              <div className="flex items-start justify-between px-4 py-2 border-b border-gray-100 last:border-b-0">
                                <span className="text-sm text-gray-500">Company</span>
                                <span className="text-sm font-medium text-gray-900 text-right ml-4">{researchRaw.company_information.company}</span>
                              </div>
                            )}
                            {researchRaw.company_information.annual_revenue && (
                              <div className="flex items-start justify-between px-4 py-2 border-b border-gray-100 last:border-b-0">
                                <span className="text-sm text-gray-500">Annual Revenue</span>
                                <span className="text-sm font-semibold text-orange-600 text-right ml-4">{researchRaw.company_information.annual_revenue}</span>
                              </div>
                            )}
                            {researchRaw.company_information.market_share && (
                              <div className="flex items-start justify-between px-4 py-2 border-b border-gray-100 last:border-b-0">
                                <span className="text-sm text-gray-500">Market Share</span>
                                <span className="text-sm font-medium text-gray-900 text-right ml-4">{researchRaw.company_information.market_share}</span>
                              </div>
                            )}
                            {researchRaw.company_information.employees && (
                              <div className="flex items-start justify-between px-4 py-2 border-b border-gray-100 last:border-b-0">
                                <span className="text-sm text-gray-500">Employees</span>
                                <span className="text-sm font-medium text-gray-900 text-right ml-4">{researchRaw.company_information.employees}</span>
                              </div>
                            )}
                            {researchRaw.company_information.founded && (
                              <div className="flex items-start justify-between px-4 py-2 border-b border-gray-100 last:border-b-0">
                                <span className="text-sm text-gray-500">Founded</span>
                                <span className="text-sm font-medium text-gray-900 text-right ml-4">{researchRaw.company_information.founded}</span>
                              </div>
                            )}
                            {researchRaw.company_information.stock && (
                              <div className="flex items-start justify-between px-4 py-2 border-b border-gray-100 last:border-b-0">
                                <span className="text-sm text-gray-500">Stock</span>
                                <span className="text-sm font-medium text-gray-900 text-right ml-4">{researchRaw.company_information.stock}</span>
                              </div>
                            )}
                            {researchRaw.company_information.digital_sales && (
                              <div className="flex items-start justify-between px-4 py-2 border-b border-gray-100 last:border-b-0">
                                <span className="text-sm text-gray-500">Digital Sales</span>
                                <span className="text-sm font-medium text-gray-900 text-right ml-4">{researchRaw.company_information.digital_sales}</span>
                              </div>
                            )}
                            {researchRaw.company_information.website && (
                              <div className="flex items-start justify-between px-4 py-2">
                                <span className="text-sm text-gray-500">Website</span>
                                <a
                                  href={researchRaw.company_information.website.startsWith('http') ? researchRaw.company_information.website : `https://${researchRaw.company_information.website}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-medium text-orange-600 hover:underline text-right ml-4"
                                >
                                  {researchRaw.company_information.website.replace(/^https?:\/\//, '')}
                                </a>
                              </div>
                            )}
                          </div>

                          {researchRaw.company_information.current_challenges && researchRaw.company_information.current_challenges.length > 0 && (
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold text-gray-700 mb-2">Current Challenges:</h5>
                              <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                                {researchRaw.company_information.current_challenges.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {researchRaw.company_information.strategic_initiatives && (
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold text-gray-700 mb-2">Strategic Initiatives:</h5>
                              <div className="space-y-1 text-sm text-gray-800">
                                {researchRaw.company_information.strategic_initiatives.direct_to_consumer && (
                                  <div>
                                    <span className="font-medium">Direct-to-Consumer:</span> {researchRaw.company_information.strategic_initiatives.direct_to_consumer}
                                  </div>
                                )}
                                {researchRaw.company_information.strategic_initiatives.innovation && (
                                  <div>
                                    <span className="font-medium">Innovation:</span> {researchRaw.company_information.strategic_initiatives.innovation}
                                  </div>
                                )}
                                {researchRaw.company_information.strategic_initiatives.sustainability && (
                                  <div>
                                    <span className="font-medium">Sustainability:</span> {researchRaw.company_information.strategic_initiatives.sustainability}
                                  </div>
                                )}
                                {researchRaw.company_information.strategic_initiatives.digital && (
                                  <div>
                                    <span className="font-medium">Digital:</span> {researchRaw.company_information.strategic_initiatives.digital}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {researchRaw.company_information.key_partnerships && researchRaw.company_information.key_partnerships.length > 0 && (
                            <div className="mt-3">
                              <h5 className="text-sm font-semibold text-gray-700 mb-2">Key Partnerships:</h5>
                              <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                                {researchRaw.company_information.key_partnerships.map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Enhanced Market Analysis */}
                      {researchData?.company?.market && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Market Analysis</h4>
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            {researchData.company.market?.size && (
                              <div>
                                <span className="text-sm text-gray-500">Market Size</span>
                                <p className="text-sm font-medium text-blue-600">{researchData.company.market.size}</p>
                              </div>
                            )}
                            {researchData.company.market?.market_position && (
                              <div>
                                <span className="text-sm text-gray-500">Market Position</span>
                                <p className="text-sm font-medium text-green-600">{researchData.company.market.market_position}</p>
                              </div>
                            )}
                          </div>


                        </div>
                      )}

                      {/* Strategic Focus Areas */}
                      {researchData?.company?.strategic_focus && researchData.company.strategic_focus.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Strategic Focus Areas</h4>
                          <div className="flex flex-wrap gap-2">
                            {researchData.company.strategic_focus.map((focus, index) => (
                              <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                {focus}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Key Contacts */}
              <div className="opportunity-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Key Contacts</h2>
                    {researchData && researchRaw && Object.keys(researchRaw).length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Research Enhanced
                      </span>
                    )}
                  </div>

                  {/* Edit Contact Button */}
                  <button
                    onClick={() => handleEditContact(opportunityData?.related_contacts?.[0])}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    title="Edit Contact"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {/* Download Contact Research */}
                  {researchData && researchData.contact && (
                    <button
                      onClick={() => downloadContactResearch()}
                      disabled={isDownloadingContact}
                      className={`p-2 rounded-lg transition-colors ${isDownloadingContact
                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                        : 'text-blue-800 hover:text-blue-800 hover:bg-blue-50'
                        }`}
                      title={isDownloadingContact ? "Downloading..." : "Download Contact Research"}
                    >
                      {isDownloadingContact ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-xs text-gray-500">Downloading...</span>
                        </div>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>


                {/* Related Contacts */}
                {opportunityData?.related_contacts && opportunityData?.related_contacts.length > 0 && (
                  <div>
                    <div className="space-y-4">
                      {opportunityData?.related_contacts.map((contact, index) => (
                        <div key={contact.id || index}>
                          <div className="flex items-center space-x-4">
                            <div className="contact-avatar w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-green-600">
                              {contact.name
                                ? contact.name
                                  .split(' ')
                                  .map((word) => word.charAt(0))
                                  .join('')
                                  .toUpperCase()
                                : 'RC'}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-base font-medium text-gray-900">
                                {contact.name || 'Unnamed Contact'}
                              </h4>
                              {contact.bio && (
                                <div className="mt-1">
                                  <p
                                    className={`text-sm text-gray-700 whitespace-pre-line ${expandBios[contact.id] ? '' : 'line-clamp-1'
                                      }`}
                                  >
                                    {contact.bio}
                                  </p>
                                  {contact.bio.length > 200 && (
                                    <button
                                      className="text-sm text-blue-600 mt-1 hover:underline"
                                      onClick={() => toggleBio(contact.id)}
                                    >
                                      {expandBios[contact.id] ? 'Show less' : 'Show more'}
                                    </button>
                                  )}
                                </div>
                              )}
                              {contact.title && <p className="text-sm text-gray-600">{contact.title}</p>}
                            </div>
                          </div>

                          {/* Contact Details */}
                          <div className="mt-3 space-y-2">
                            {contact.email && (
                              <div className="flex justify-between text-sm text-gray-700">
                                <span className="font-medium">Email:</span>
                                <span className="text-blue-600 hover:underline">{contact.email}</span>
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex justify-between text-sm text-gray-700">
                                <span className="font-medium">Phone:</span>
                                <span className="text-blue-600 hover:underline">{contact.phone}</span>
                              </div>
                            )}
                            {contact.mobile && contact.mobile !== "Not Provided" && (
                              <div className="flex justify-between text-sm text-gray-700">
                                <span className="font-medium">Mobile:</span>
                                <span className="text-blue-600 hover:underline">
                                  {contact.mobile}
                                </span>
                              </div>
                            )}
                            {contact.location && (
                              <div className="bg-gray-100 p-3 rounded mt-4">
                                <p className="text-sm font-semibold text-gray-700 mb-1">Location</p>
                                <p className="text-sm text-gray-800 whitespace-pre-line">{contact.location}</p>
                              </div>
                            )}

                          </div>
                          {/* Enhanced Contact Research Data - legacy block (hidden when new contact_research exists) */}
                          {!researchRaw?.contact_research && researchData && researchData.contact && researchData.contact.name === contact.name && (
                            <div className="mt-4 border-t pt-4 bg-blue-50 rounded-lg p-4">
                              <div className="flex items-center space-x-2 mb-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <h4 className="text-sm font-semibold text-blue-900">Research Insights for {contact.name}</h4>
                              </div>

                              {/* Professional Background */}
                              {researchData.contact.background && (
                                <div className="mb-4">
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">Professional Background</h5>
                                  <div className="space-y-3">
                                    {researchData.contact.background.title && (
                                      <div>
                                        <span className="text-sm text-gray-600">Current Title</span>
                                        <p className="text-sm font-medium text-gray-900">{researchData.contact.background.title}</p>
                                      </div>
                                    )}
                                    {researchData.contact.background.experience && (
                                      <div>
                                        <span className="text-sm text-gray-600">Experience</span>
                                        <p className="text-sm font-medium text-gray-900">{researchData.contact.background.experience}</p>
                                      </div>
                                    )}
                                    {researchData.contact.background.education && (
                                      <div>
                                        <span className="text-sm text-gray-600">Education</span>
                                        <p className="text-sm font-medium text-gray-900">{researchData.contact.background.education}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Key Expertise */}
                              {researchData.contact.enhanced_expertise && (
                                <div className="mb-4">
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">Key Expertise</h5>
                                  <div className="space-y-3">
                                    {/* Certifications */}
                                    {researchData.contact.enhanced_expertise.certifications && researchData.contact.enhanced_expertise.certifications.length > 0 && (
                                      <div>
                                        <span className="text-sm text-gray-600">Certifications</span>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                          {researchData.contact.enhanced_expertise.certifications.map((cert, index) => (
                                            <span key={index} className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                              {cert}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Projects */}
                                    {researchData.contact.enhanced_expertise.projects && researchData.contact.enhanced_expertise.projects.length > 0 && (
                                      <div>
                                        <span className="text-sm text-gray-600">Key Projects</span>
                                        <div className="space-y-2">
                                          {researchData.contact.enhanced_expertise.projects.slice(0, 2).map((project, index) => (
                                            <div key={index} className="text-sm text-gray-700 bg-white p-2 rounded border">
                                              {project}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Recent Activities */}
                              {researchData.contact.enhanced_activities && (
                                <div className="mb-4">
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">Recent Activities</h5>
                                  <div className="space-y-3">
                                    {/* Recent Tasks */}
                                    {researchData.contact.enhanced_activities.recent_tasks && researchData.contact.enhanced_activities.recent_tasks.length > 0 && (
                                      <div>
                                        <span className="text-sm text-gray-600">Recent Tasks</span>
                                        <div className="space-y-2">
                                          {researchData.contact.enhanced_activities.recent_tasks.slice(0, 3).map((task, index) => (
                                            <div key={index} className="bg-white p-3 rounded-lg border border-blue-200">
                                              <div className="flex items-center justify-between mb-2">
                                                <h6 className="text-sm font-medium text-gray-900">{task.title}</h6>
                                                <span className={`px-2 py-1 text-xs rounded-full ${task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                  task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                  }`}>
                                                  {task.status}
                                                </span>
                                              </div>
                                              {task.description && (
                                                <p className="text-sm text-gray-700 mb-2">{task.description}</p>
                                              )}
                                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                                {task.category && <span>Category: {task.category}</span>}
                                                {task.priority && <span>Priority: {task.priority}</span>}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* LinkedIn Profile */}
                              {researchData.contact.background?.linkedin && (
                                <div className="mb-4">
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">LinkedIn Profile</h5>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-blue-600">{researchData.contact.background.linkedin.connections || '0'}</div>
                                      <span className="text-xs text-gray-500">Connections</span>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-green-600">{researchData.contact.background.linkedin.endorsements || '0'}</div>
                                      <span className="text-xs text-gray-500">Endorsements</span>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-purple-600">{researchData.contact.background.linkedin.recommendations || '0'}</div>
                                      <span className="text-xs text-gray-500">Recommendations</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Key Insights */}
                              {researchData.contact.insights && researchData.contact.insights.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">Key Insights</h5>
                                  <div className="space-y-2">
                                    {researchData.contact.insights.map((insight, index) => (
                                      <div key={index} className="flex items-start space-x-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                                        <p className="text-sm text-gray-900">{insight}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Divider after each contact except the last one */}
                          {index !== opportunityData?.related_contacts.length - 1 && (
                            <hr className="my-4 border-t border-gray-300" />
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Contact Research (Raw) */}
                    {researchRaw?.contact_research && (
                      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
                        <h4 className="text-base font-semibold text-blue-900 mb-4">Contact Research Highlights</h4>
                        {researchRaw.contact_research.key_quote && (
                          <div className="mb-4">
                            <span className="text-sm font-semibold text-blue-800">Key Quote</span>
                            <p className="text-sm text-gray-900 mt-2 leading-relaxed">"{researchRaw.contact_research.key_quote}"</p>
                          </div>
                        )}
                        {researchRaw.contact_research.recent_actions && researchRaw.contact_research.recent_actions.length > 0 && (
                          <div className="mb-4">
                            <span className="text-sm font-semibold text-blue-800">Recent Actions</span>
                            <ul className="list-disc list-inside text-sm text-gray-800 mt-2 space-y-1.5">
                              {researchRaw.contact_research.recent_actions.map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {researchRaw.contact_research.leadership_focus && researchRaw.contact_research.leadership_focus.length > 0 && (
                          <div>
                            <span className="text-sm font-semibold text-blue-800">Leadership Focus</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {researchRaw.contact_research.leadership_focus.map((f, i) => (
                                <span key={i} className="px-3 py-1.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">{f}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}


                  </div>
                )}

                {/* No Contacts Message */}
                {(!opportunityData?.related_contacts || opportunityData?.related_contacts.length === 0) && (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-6xl mb-4">👤</div>
                    <p className="text-gray-500">No contacts assigned to this opportunity</p>
                    <p className="text-sm text-gray-400 mt-2">Research will proceed for company and opportunity only</p>
                  </div>
                )}
              </div>

              {/* ==================== TASKS SECTION ==================== */}
              <div className="opportunity-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Tasks</h2>
                    {taskPagination.total > 0 && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {taskPagination.total}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAddTaskModal(true)}
                    className="text-green-600 hover:text-green-700 font-medium text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Task
                  </button>
                </div>

                {/* Tasks Table - Always show headers */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th 
                          className="text-left py-3 px-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleTaskSort('title')}
                        >
                          Title {taskSortBy === 'title' && (taskSortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Details</th>
                        <th 
                          className="text-left py-3 px-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleTaskSort('duedate')}
                        >
                          Due Date {taskSortBy === 'duedate' && (taskSortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                          className="text-left py-3 px-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleTaskSort('priority')}
                        >
                          Priority {taskSortBy === 'priority' && (taskSortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Assigned To</th>
                        <th 
                          className="text-left py-3 px-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleTaskSort('status')}
                        >
                          Status {taskSortBy === 'status' && (taskSortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingTasks ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center">
                            <div className="flex justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                          </td>
                        </tr>
                      ) : opportunityTasks.length > 0 ? (
                        opportunityTasks.map((task, index) => (
                          <tr
                            key={task.id}
                            className={`border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                            onClick={() => navigate(`/task-details?taskId=${task.id}`)}
                          >
                            <td className="py-3 px-3">
                              <span className="font-medium text-gray-900 hover:text-blue-600">
                                {task.title}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-gray-600 line-clamp-2 max-w-[200px]" title={task.description}>
                                {task.description || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1 text-gray-700">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span>{task.duedate ? formatTaskDate(task.duedate) : '-'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                                {task.priority || 'Medium'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                {task.assigned_name ? (
                                  <>
                                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium">
                                      {task.assigned_name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-gray-700">{task.assigned_name}</span>
                                  </>
                                ) : (
                                  <span className="text-gray-400">Unassigned</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                                {task.status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="py-8 text-center">
                            <div className="text-gray-400 text-4xl mb-3">📋</div>
                            <p className="text-gray-500">No tasks yet</p>
                            <p className="text-sm text-gray-400 mt-1">Click "Add Task" to create your first task</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination and Results Info */}
                {taskPagination.total > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500">
                      Showing {((taskPagination.page - 1) * taskPagination.limit) + 1} - {Math.min(taskPagination.page * taskPagination.limit, taskPagination.total)} of {taskPagination.total} tasks
                    </span>
                    {taskPagination.totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => fetchOpportunityTasks(taskPagination.page - 1)}
                          disabled={taskPagination.page <= 1}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-gray-600 px-2">
                          Page {taskPagination.page} of {taskPagination.totalPages}
                        </span>
                        <button
                          onClick={() => fetchOpportunityTasks(taskPagination.page + 1)}
                          disabled={taskPagination.page >= taskPagination.totalPages}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Next Steps & Actions - Keep as separate card */}
              {researchData && researchRaw && Object.keys(researchRaw).length > 0 && (

                <div className="opportunity-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-orange-600" />
                      <h2 className="text-xl font-semibold text-gray-900">Next Steps & Actions</h2>
                    </div>
                    {/* Download Opportunity Research */}
                    {researchData && researchData.opportunity && (
                      <button
                        onClick={() => downloadOpportunityResearch()}
                        disabled={isDownloadingOpportunity}
                        className={`p-2 rounded-lg transition-colors ${isDownloadingOpportunity
                          ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                          : 'text-orange-600 hover:text-orange-800 hover:bg-orange-50'
                          }`}
                        title={isDownloadingOpportunity ? "Downloading..." : "Download Opportunity Research"}
                      >
                        {isDownloadingOpportunity ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                            <span className="text-xs text-gray-500">Downloading...</span>
                          </div>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="space-y-6">
                    {/* Research Summary */}
                    {researchData.opportunity?.summary && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Research Summary</h3>
                        <p className="text-sm text-gray-900 bg-blue-50 p-3 rounded-lg">
                          {researchData.opportunity.summary}
                        </p>
                      </div>
                    )}

                    {/* Next Steps */}
                    {researchData.recommendations?.next_steps && researchData.recommendations.next_steps.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Recommended Next Steps</h3>
                        <div className="space-y-4">
                          {researchData.recommendations.next_steps.map((step, index) => {
                            const stepData = typeof step === 'string' ? { action: step } : step;
                            return (
                              <div key={index} className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r-lg">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                                    {index + 1}
                                  </span>
                                  <h4 className="text-sm font-semibold text-gray-900">{stepData.action}</h4>
                                </div>
                                <div className="ml-8 space-y-2">
                                  {/* <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <Clock className="w-4 h-4" />
                                  <span>{stepData.timeline || 'Within 1 week'}</span>
                                </div>
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <TrendingUp className="w-4 h-4" />
                                  <span>{stepData.impact || 'High'}</span>
                                </div> */}
                                  <div className="text-sm text-gray-700">
                                    <span className="font-medium"></span> {stepData.key_message || `Focus on ${stepData.action.toLowerCase()} to advance this opportunity`}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quick Wins from research_data */}
                    {researchRaw?.opportunity_next_steps?.quick_wins && researchRaw.opportunity_next_steps.quick_wins.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Wins</h3>
                        <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                          {researchRaw.opportunity_next_steps.quick_wins.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Success Metrics from research_data */}
                    {researchRaw?.opportunity_next_steps?.success_metrics && researchRaw.opportunity_next_steps.success_metrics.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Success Metrics</h3>
                        <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                          {researchRaw.opportunity_next_steps.success_metrics.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  </div>
                </div>

              )}

              <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Recent Updates
                </h2>

                {stageHistoryData.length > 0 ? (
                  stageHistoryData.map((history, index) => (
                    <div
                      key={index}
                      className="mb-4 pb-4 border-b border-gray-200 last:border-b-0"
                    >
                      <div className="flex flex-wrap mb-2 relative group">
                        <span className="text-gray-900">

                          Moved from {history.previous_stage_name} to {history.current_stage_name} {' '}
                          {new Date(history.entered_at).getDate().toString().padStart(2, '0')}/
                          {(new Date(history.entered_at).getMonth() + 1).toString().padStart(2, '0')}/
                          {new Date(history.entered_at).getFullYear()}
                        </span>

                        {/* Tooltip trigger */}
                        <p className="text-blue-600 ml-2 cursor-pointer font-bold underline relative">
                          Reason
                          {/* Tooltip content */}
                          <span className="absolute left-0 top-full mt-1 w-64 bg-gray-800 text-white text-sm rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {history.reason}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center text-gray-900">
                        <span className="text-gray-900">Edit Opportunity: </span>
                        <span className="flex flex-wrap items-center space-x-2 text-gray-900">
                          {new Date(history.entered_at).getDate().toString().padStart(2, '0')}/
                          {(new Date(history.entered_at).getMonth() + 1).toString().padStart(2, '0')}/
                          {new Date(history.entered_at).getFullYear()} {' '}
                          <span className="flex items-center space-x-2 text-blue-600 font-semibold ml-2">
                            <AvatarPop id={history.user_id} size={24} />
                            {/* {history.user_name} */}
                          </span>
                        </span>
                      </div>

                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No stage changes yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Research Modals */}
        <ContactSelectionModal
          isOpen={showContactSelection}
          onClose={() => setShowContactSelection(false)}
          onProceed={startRealResearch}
          opportunityData={opportunityData}
          selectedContact={selectedContact}
          setSelectedContact={setSelectedContact}
        />

        <ResearchProgressModal
          isOpen={showResearchProgress}
          onClose={() => setShowResearchProgress(false)}
          companyName={opportunityData?.account?.name || 'Company'}
          contactName={selectedContact?.name || 'Contact'}
          onResearchComplete={handleResearchComplete}
          companyProgress={companyProgress}
          contactProgress={contactProgress}
          companyStatus={companyStatus}
          contactStatus={contactStatus}
          currentStep={currentStep}
        />

        {/* Stage Change Confirmation Modal */}
        {showStageChangeModal && stageChangeData && (
          //  <div className="fixed inset-0 bg-blur bg-opacity-50 flex items-center justify-center z-50">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">

            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Stage Change</h3>
              </div>

              <div className="mb-6">
                <p className="text-gray-600 mb-3">
                  Are you sure you want to change the opportunity stage?
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Current Stage:</span>
                    <span className="text-sm font-semibold text-gray-900">{stageChangeData.currentStageName}</span>
                  </div>
                  <div className="flex items-center justify-center my-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">New Stage:</span>
                    <span className="text-sm font-semibold text-blue-600">{stageChangeData.newStageName}</span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={cancelStageChange}
                  disabled={isChangingStage}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStageChange}
                  disabled={isChangingStage}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isChangingStage ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Changing...</span>
                    </>
                  ) : (
                    <span>Confirm Change</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Company Edit Modal */}
        {showCompanyModal && (
          <CompanyFormModel
            company={selectedCompany}
            companyId={companyId}
            onSubmit={handleCompanySubmit}
            onCancel={handleCompanyCancel}
            onRefresh={() => setrefreshdata(!refreshdata)}
            isSubmitting={false}
          />
        )}

        {/* Contact Edit Modal */}
        {showContactModal && (
          <ContactFormModel
            contact={selectedContactForEdit}
            companyId={companyId}
            onSubmit={handleContactSubmit}
            onCancel={handleContactCancel}
            onRefresh={() => setrefreshdata(!refreshdata)}
            isSubmitting={false}
          />
        )}

        {/* Add Task Modal */}
        {showAddTaskModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Plus className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Add Task</h3>
                </div>
                <button
                  onClick={() => setShowAddTaskModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Enter task title"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Details
                  </label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                    placeholder="Enter task details"
                  />
                </div>

                {/* Due Date and Priority Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                {/* Assigned To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned To
                  </label>
                  <select
                    value={newTask.assigned_id}
                    onChange={(e) => setNewTask({ ...newTask, assigned_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Select assignee</option>
                    {companyUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estimated Hours */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={newTask.estimated_hours}
                    onChange={(e) => setNewTask({ ...newTask, estimated_hours: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="e.g., 2.5"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddTaskModal(false)}
                    disabled={isCreatingTask}
                    className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingTask || !newTask.title.trim()}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
                  >
                    {isCreatingTask ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Create Task</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
      {/* Next Steps & Actions - Keep as separate card */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow">
        <Footer />
      </footer>
    </div>
  );
};

export default CrmOpportunity;