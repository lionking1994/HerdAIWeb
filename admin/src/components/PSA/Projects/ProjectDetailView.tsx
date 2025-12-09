import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Search, Users, Calendar, DollarSign, AlertCircle, CheckCircle, Clock, TrendingUp, TrendingDown, Edit2, Trash2, Target, LayoutTemplate } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import { Project, ProjectCostAnalysis, Resource } from '../Dashboard/types';
import api from '../../../lib/api';
import AddBacklogItemModal from './AddBacklogItemModal';
import EpicManagementModal from './EpicManagementModal';
import FeatureManagementModal from './FeatureManagementModal';
import StoryDetailModal from './StoryDetailModal';
import CreateSprintModal from './CreateSprintModal';
import VelocityChart from './VelocityChart';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import CreateProgramIncrementModal from './CreateProgramIncrementModal';
import CostCalculationTooltip from './CostCalculationTooltip';
import NewProjectModal from './NewProjectModal';
import ResourceEditModal from '../Resources/ResourceEditModal';
import SaveAsTemplatePreviewModal from '../Templates/SaveAsTemplatePreviewModal';
import StoryHoverTooltip from './StoryHoverTooltip';
import GanttView from './GanttView';

interface ProjectDetailViewProps {
  project: Project;
  onBack: () => void;
  onStoryUpdate?: () => void; // Callback to refresh story progress
  companyId: string; // Add companyId prop
  onProjectUpdate?: () => void; // Callback to refresh project data from parent
}

interface BacklogItem {
  id: string;
  title: string;
  description: string;
  type: 'epic' | 'feature' | 'story';
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints?: number; // Made optional for epics
  assigneeId?: string;
  assigneeDetails?: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    role?: string;
  } | null;
  tags: string[];
  acceptanceCriteria: string[];
  requiredSkills?: string[]; // Array of skill names
  parentId?: string; // For linking features to epics, stories to features
  parentName?: string; // Name of the parent item (epic name for features, feature name for stories)
  children?: BacklogItem[]; // Child items (features for epics, stories for features)
  businessValue?: number; // Business value for epics
  sprintId?: string | null; // Sprint assignment
}

export default function ProjectDetailView({ project, onBack, onStoryUpdate, companyId, onProjectUpdate }: ProjectDetailViewProps) {
  const { showSuccess, showError } = useToast();
  const [currentProject, setCurrentProject] = useState<Project>(project);
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'epic' | 'feature' | 'story'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'backlog' | 'in_progress' | 'review' | 'done'>('all');
  const [filterSprint, setFilterSprint] = useState<string>(''); // Will be set to current sprint ID
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'hierarchy' | 'sprint' | 'program-increment' | 'gantt'>('kanban');
  const [costAnalysis, setCostAnalysis] = useState<ProjectCostAnalysis | null>(null);
  const [loadingCostAnalysis, setLoadingCostAnalysis] = useState(false);
  const [selectedEpic, setSelectedEpic] = useState<BacklogItem | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<BacklogItem | null>(null);
  const [showEpicModal, setShowEpicModal] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [selectedStory, setSelectedStory] = useState<BacklogItem | null>(null);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [assignedResources, setAssignedResources] = useState<any[]>([]);
  const [companyResources, setCompanyResources] = useState<Resource[]>([]);
  const [loadingCompanyResources, setLoadingCompanyResources] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  // Removed changedItems state as we're not using faded logic anymore
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [sprintData, setSprintData] = useState<any[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<BacklogItem | null>(null);
  const [showCreatePIModal, setShowCreatePIModal] = useState(false);
  const [showEditPIModal, setShowEditPIModal] = useState(false);
  const [showDeletePIModal, setShowDeletePIModal] = useState(false);
  const [editingPI, setEditingPI] = useState<any>(null);
  const [deletingPI, setDeletingPI] = useState<any>(null);
  const [programIncrements, setProgramIncrements] = useState<any[]>([]);
  
  // Save as Template state
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [templatePreviewData, setTemplatePreviewData] = useState<any>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<BacklogItem | null>(null);
  const [epicEditMode, setEpicEditMode] = useState<'epic' | 'feature' | null>(null);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  
  // ResourceEditModal state
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showResourceEditModal, setShowResourceEditModal] = useState(false);
  const [companyRoles, setCompanyRoles] = useState<any[]>([]);

  // Story hover tooltip state
  const [hoveredStory, setHoveredStory] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

   const fetchSprintData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/sprints/${currentProject.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSprintData(data.sprints || []);
        }
      }
    } catch (error) {
      console.error('Error fetching sprint data:', error);
    }
  };

  const fetchProgramIncrements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/program-increments/${currentProject.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProgramIncrements(data.programIncrements || []);
        }
      }
    } catch (error) {
      console.error('Error fetching program increments:', error);
    }
  };

  const handleEditPI = (pi: any) => {
    setEditingPI(pi);
    setShowEditPIModal(true);
  };

  const handleDeletePI = (pi: any) => {
    setDeletingPI(pi);
    setShowDeletePIModal(true);
  };

  const confirmDeletePI = async () => {
    if (!deletingPI) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/program-increments/${deletingPI.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showSuccess('Program Increment deleted successfully');
          fetchProgramIncrements(); // Refresh the list
          setShowDeletePIModal(false);
          setDeletingPI(null);
        } else {
          showError(data.message || 'Failed to delete Program Increment');
        }
      } else {
        showError('Failed to delete Program Increment');
      }
    } catch (error) {
      console.error('Error deleting Program Increment:', error);
      showError('Failed to delete Program Increment');
    } finally {
      setIsDeleting(false);
    }
  };

   const fetchCompanyResources = async () => {
    try {
      setLoadingCompanyResources(true);
      const token = localStorage.getItem('token');
      
      if (!token || !companyId) {
        console.error('Missing token or company ID');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/resources?companyId=${companyId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.resources) {
          // Transform the API response to match the Resource interface
          const transformedResources = data.resources.map((resource: any) => ({
            id: resource.resource?.resource_id?.toString() || resource.id,
            userId: resource.id.toString(),
            user: {
              id: resource.id.toString(),
              name: resource.name,
              email: resource.email,
              role: resource.role
            },
            department: resource.resource?.department?.name || '',
            departmentId: resource.resource?.department?.id || null,
            location: resource.resource?.location || '',
            hourlyRate: parseFloat(resource.resource?.hourly_rate || '0'),
            availability: parseFloat(resource.resource?.availability || '0'),
            performanceRating: parseFloat(resource.resource?.performance_rating || '0'),
            isActive: resource.resource?.is_active !== false,
            hireDate: resource.resource?.hire_date || '',
            totalProjectHours: resource.resource?.total_project_hours || 0,
            successfulProjects: resource.resource?.successful_projects || 0,
            skills: resource.skills?.map((skill: any) => ({
              skillId: skill.skill_id,
              skill: {
                id: skill.skill_id,
                name: skill.skill_name,
                category: skill.skill_category,
                description: skill.skill_description
              },
              proficiencyLevel: skill.proficiency_level,
              yearsExperience: skill.years_experience,
              lastUsed: skill.last_used
            })) || [],
            certifications: resource.certifications?.map((cert: any) => ({
              certificationId: cert.certification_id,
              certification: {
                id: cert.certification_id,
                name: cert.certification_name,
                provider: cert.certification_provider,
                description: cert.certification_description
              },
              issueDate: cert.issue_date,
              expiryDate: cert.expiry_date,
              status: cert.status
            })) || [],
            resource: resource.resource // Preserve the original resource object
          }));
          setCompanyResources(transformedResources);
        }
      }
    } catch (error) {
      console.error('Error fetching company resources:', error);
    } finally {
      setLoadingCompanyResources(false);
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
      console.log('Resource data from Project Detail:', resourceData);
      console.log('Using resource_id:', resourceData.resourceId);
      
      const response = await api.get(`/psa/resources/${resourceData.resourceId}?companyId=${companyId}`);
      
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
          activeProjects: [],
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
        setShowResourceEditModal(true);
      } else {
        throw new Error(response.data.message || 'Failed to fetch resource details');
      }
    } catch (error) {
      console.error('Error fetching resource details:', error);
      showError('Failed to load resource details. Please try again.');
    }
  };

  // Handle resource save
  const handleResourceSave = async (updatedResource: Resource) => {
    try {
      console.log('Resource updated:', updatedResource);
      
      // Close the modal
      setShowResourceEditModal(false);
      setSelectedResource(null);
      
      // Refresh cost analysis to show updated information
      await fetchCostAnalysis();
      
      // Show success message
      showSuccess('Resource updated successfully!');
      console.log('✅ Resource updated successfully and cost analysis refreshed');
    } catch (error) {
      console.error('❌ Error refreshing cost analysis after resource update:', error);
      showError('Resource updated but failed to refresh cost analysis. Please refresh manually.');
    }
  };

  const refreshAllData = async () => {
    // Refresh all local data when project is updated
    await Promise.all([
      fetchBacklogItems(),
      fetchCostAnalysis(),
      fetchSprintData(),
      fetchProgramIncrements(),
      fetchCompanyResources()
    ]);
  };

  const fetchBacklogItems = async () => {
     try {
       const token = localStorage.getItem('token');
       const resp = await fetch(
         `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/${currentProject.id}`,
         {
           method: 'GET',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${token}`,
           },
         }
       );
       
       if (!resp.ok) throw new Error(`Error fetching backlog items: ${resp.status}`);
       
      const data = await resp.json();
      
      console.log('🔍 Raw API response for backlog items:', {
        success: data.success,
        dataLength: data.data?.all?.length,
        sampleItem: data.data?.all?.[0] ? {
          id: data.data.all[0].id,
          title: data.data.all[0].title,
          acceptance_criteria: data.data.all[0].acceptance_criteria,
          acceptance_criteria_type: typeof data.data.all[0].acceptance_criteria
        } : null
      });
      
      if (data.success && data.data) {
         const mappedItems: BacklogItem[] = data.data.all.map((item: any) => ({
           id: item.id,
           title: item.title,
           description: item.description,
           type: item.type,
           status: item.status || 'backlog',
           priority: item.priority || 'medium',
           storyPoints: item.story_points || (item.type === 'epic' ? undefined : 1),
           assigneeId: item.assignee_id || '',
           assigneeDetails: item.assignee_details || null, // Include assignee details from API
           tags: Array.isArray(item.tags) ? item.tags : 
             (typeof item.tags === 'string' ? 
               (() => { try { return JSON.parse(item.tags); } catch { return []; } })() : []),
           acceptanceCriteria: Array.isArray(item.acceptance_criteria) ? item.acceptance_criteria : 
             (typeof item.acceptance_criteria === 'string' ? 
               (() => { 
                 try { 
                   const parsed = JSON.parse(item.acceptance_criteria);
                   return Array.isArray(parsed) ? parsed : [];
                 } catch { 
                   return []; 
                 } 
               })() : []),
           requiredSkills: Array.isArray(item.required_skills) ? item.required_skills : 
             (typeof item.required_skills === 'string' ? 
               (() => { try { return JSON.parse(item.required_skills); } catch { return []; } })() : []),
           parentId: item.parent_id,
           parentName: undefined, // Will be populated below
           businessValue: item.business_value || undefined,
           sprintId: item.sprint_id || null, // Sprint assignment
           children: []
         }));

         // Populate parent names
         const itemMap = new Map(mappedItems.map(item => [item.id, item]));
         mappedItems.forEach(item => {
           if (item.parentId && itemMap.has(item.parentId)) {
             const parent = itemMap.get(item.parentId)!;
             item.parentName = parent.title;
           }
         });

         // Remove duplicates based on title, parent, and type
         const uniqueItems = mappedItems.reduce((acc: BacklogItem[], current) => {
           const existing = acc.find(item => 
             item.title === current.title && 
             item.parentId === current.parentId && 
             item.type === current.type
           );
           
           if (!existing) {
             acc.push(current);
           } else {
             // Keep the newer one (higher created_at timestamp)
             const currentTime = new Date(current.id).getTime(); // Using ID as timestamp proxy
             const existingTime = new Date(existing.id).getTime();
             
             if (currentTime > existingTime) {
               const index = acc.findIndex(item => item.id === existing.id);
               acc[index] = current;
             }
           }
           
           return acc;
         }, []);

         console.log('📊 Mapped backlog items:', {
           totalItems: uniqueItems.length,
           sampleMappedItem: uniqueItems[0] ? {
             id: uniqueItems[0].id,
             title: uniqueItems[0].title,
             acceptanceCriteria: uniqueItems[0].acceptanceCriteria,
             acceptanceCriteriaType: typeof uniqueItems[0].acceptanceCriteria,
             acceptanceCriteriaLength: Array.isArray(uniqueItems[0].acceptanceCriteria) ? uniqueItems[0].acceptanceCriteria.length : 'not array'
           } : null
         });

         setBacklogItems(uniqueItems);
        
        // Don't reset changed items - keep dual display logic intact
        // setChangedItems(new Set());
         
         // Store assigned resources for assignee dropdown
         if (data.data.assignedResources) {
           setAssignedResources(data.data.assignedResources);
         }
         
         console.log("🆕 Backlog items updated (duplicates removed)");
       }
     } catch (err) {
       console.error("🚨 Error fetching backlog items:", err);
     }
   };

  // Update currentProject when project prop changes
  useEffect(() => {
    setCurrentProject(project);
  }, [project]);

  useEffect(() => {
    fetchBacklogItems();
    fetchSprintData();
    fetchProgramIncrements();
    fetchCostAnalysis();
    fetchCompanyResources();
    fetchCompanyRoles();
  }, [currentProject.id]);

  // Set default sprint filter to current sprint when sprint data loads
  useEffect(() => {
    if (sprintData.length > 0 && !filterSprint) {
      const now = new Date();
      const currentSprint = sprintData.find(sprint => {
        const start = new Date(sprint.start_date);
        const end = new Date(sprint.end_date);
        return sprint.status === 'active' && now >= start && now <= end;
      });
      
      if (currentSprint) {
        console.log('🎯 Auto-selecting current sprint:', currentSprint.name, currentSprint.id);
        setFilterSprint(currentSprint.id);
      } else {
        // If no current sprint, default to 'all'
        setFilterSprint('all');
      }
    }
  }, [sprintData]);


  const getHealthColor = (health: string) => {
    switch (health) {
      case 'green': return 'text-green-600 bg-green-100';
      case 'yellow': return 'text-yellow-600 bg-yellow-100';
      case 'red': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'green': return CheckCircle;
      case 'yellow': return Clock;
      case 'red': return AlertCircle;
      default: return Clock;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'epic': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'feature': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'story': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

const filteredItems = (backlogItems ?? []).filter(item => {
  if (!item) return false; // ignore undefined/null items

  const matchesType = filterType === 'all' || item.type === filterType;
  const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
  const matchesSearch =
    (item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
    (item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
    (item.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ?? false);
  
  // Sprint filter logic
  let matchesSprint = true;
  if (filterSprint && filterSprint !== 'all') {
    matchesSprint = item.sprintId === filterSprint;
  }

  return matchesType && matchesStatus && matchesSearch && matchesSprint;
});



  // Build hierarchical structure for display
  const buildHierarchy = (items: BacklogItem[]): BacklogItem[] => {
    const itemMap = new Map<string, BacklogItem>();
    const rootItems: BacklogItem[] = [];

    // First pass: create map of all items
    items.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    // Second pass: build hierarchy
    items.forEach(item => {
      const mappedItem = itemMap.get(item.id)!;
      if (item.parentId && itemMap.has(item.parentId)) {
        const parent = itemMap.get(item.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(mappedItem);
      } else {
        rootItems.push(mappedItem);
      }
    });

    return rootItems;
  };

  // Build hierarchy from ALL items (not filtered) to maintain complete tree structure
  const hierarchicalItems = buildHierarchy(filteredItems ?? []);

  const getItemsByStatus = (targetStatus: string) => {
    const laneRoots: BacklogItem[] = [];

    const findRoots = (items: BacklogItem[]) => {
      items.forEach(item => {
        // Condition 1: Item's status matches the target lane's status
        if (item.status === targetStatus) {
          // Condition 2: It's a top-level item for THIS lane
          // It's top-level if it has no parent, OR its parent is in a different status
          const parent = item.parentId ? filteredItems.find(p => p.id === item.parentId) : undefined;
          if (!parent || parent.status !== targetStatus) {
            laneRoots.push(item);
          }
        }

        // Recursively check children, even if parent's status doesn't match
        // because a child might be a root for a different lane
        if (item.children && item.children.length > 0) {
          findRoots(item.children);
        }
      });
    };

    findRoots(hierarchicalItems); // Start traversal from the project's root items

    return laneRoots;
  };

  const HealthIcon = getHealthIcon(currentProject.health);
  
  // Function to reset changed items (call when needed)
  // const resetChangedItems = () => {
  //   setChangedItems(new Set());
  // };
  
  // Fetch cost analysis
  const fetchCostAnalysis = async () => {
    if (!currentProject.id) return;
    
    setLoadingCostAnalysis(true);
    try {
      const token = localStorage.getItem('token');
      const companyId = new URLSearchParams(window.location.search).get('company');
      
      if (!token || !companyId) {
        showError('Authentication required');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/projects/${companyId}/${currentProject.id}/cost-analysis`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch cost analysis');
      }

      const data = await response.json();
      if (data.success) {
        setCostAnalysis(data.data);
      } else {
        showError(data.message || 'Failed to fetch cost analysis');
      }
    } catch (error) {
      console.error('Error fetching cost analysis:', error);
      showError('Failed to fetch cost analysis');
    } finally {
      setLoadingCostAnalysis(false);
    }
  };

  // Use story-based progress if available, otherwise fall back to cost-based, then hours-based
  const progressPercentage = currentProject.storyProgress ? 
    currentProject.storyProgress.storyProgressPercentage : 
    (currentProject.costSummary ? 
      currentProject.costSummary.costProgress : 
      (costAnalysis ? 
        costAnalysis.progress.costProgress : 
        (currentProject.budgetHours > 0 ? Math.min((currentProject.actualHours / currentProject.budgetHours) * 100, 100) : 0)
      )
    );

  const handleDragStart = (e: React.DragEvent, item: BacklogItem) => {
    e.dataTransfer.setData('text/plain', item.id);
    setDraggedItem(item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only clear if we're leaving the column entirely, not just moving to a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');

    // Clear drag states
    setDraggedItem(null);
    setDragOverColumn(null);

    // Set loading state
    setStatusUpdating(itemId);

    try {
      // Update local state immediately for better UX
      setBacklogItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, status: newStatus as any } : item
      ));

      // Call the new status update API
      const token = localStorage.getItem('token');
      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/item/${itemId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: newStatus
          }),
        }
      );

      if (resp.ok) {
        showSuccess(`Item moved to ${newStatus.replace('_', ' ')}`);
        
        // Refresh backlog items to get updated statuses (including cascaded changes)
        await fetchBacklogItems();
        // Notify parent to refresh story progress
        if (onStoryUpdate) {
          onStoryUpdate();
        }
      } else {
        // Revert local state if API call failed
        setBacklogItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, status: 'backlog' as any } : item
        ));
        const errorResult = await resp.json();
        showError(errorResult.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('🚨 Error updating status:', error);
      // Revert local state if API call failed
      setBacklogItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, status: 'backlog' as any } : item
      ));
      showError('Failed to update status. Please try again.');
    } finally {
      // Clear loading state
      setStatusUpdating(null);
    }
  };

   const handleAddBacklogItem = async (newItem: Omit<BacklogItem, 'id' | 'status'>) => {
     try {
       setIsCreating(true); 

       // Check for duplicate items with same title and parent
       const existingItem = backlogItems.find(item => 
         item.title === newItem.title && 
         item.parentId === newItem.parentId && 
         item.type === newItem.type
       );
       
       if (existingItem) {
         showError(`A ${newItem.type} with this title already exists!`);
         setIsCreating(false);
         return;
       }

      const token = localStorage.getItem('token');
      if (!currentProject.id) {
      
        return;
      }

      const payload = {
        title: newItem.title,
        description: newItem.description,
        type: newItem.type,
        priority: newItem.priority,
        storyPoints: newItem.storyPoints,
        assignee_id: newItem.assigneeId,
        sprint_id: newItem.sprintId,
        tags: newItem.tags,
        acceptance_criteria: newItem.acceptanceCriteria,
        parent_id: newItem.parentId,
        project_id: currentProject.id,
        ...(newItem.businessValue !== undefined && { business_value: newItem.businessValue })
      };

      console.log('Payload being sent to API:', payload);

      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/createProjectHierarchy/${currentProject.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!resp.ok) {
        const errorResult = await resp.json();
        console.error('API Error Response:', errorResult);
        throw new Error(`Error creating backlog item: ${resp.status} - ${errorResult.message || 'Unknown error'}`);
      }

      const result = await resp.json();
       if (result.success) {
         // Close modal first
         setShowAddItemModal(false);
         
         // Show success toast
         showSuccess(`${newItem.type.charAt(0).toUpperCase() + newItem.type.slice(1)} created successfully!`);
         
         // Refresh backlog items to get real data
         await fetchBacklogItems();
         
         // If backend suggests refreshing all data, do it
         if (result.refreshBacklog) {
           console.log('🔄 Backend suggests refreshing all data, calling refreshAllData...');
           await refreshAllData();
         }
        
       } else {
         // Handle backend duplicate error
         showError(result.message || "Failed to create backlog item");
       }
    } catch (error) {
      console.error("🚨 Error creating backlog item:", error);
      showError("Failed to create backlog item. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Save as Template handlers
  const handleSaveAsTemplate = async () => {
    try {
      setIsSavingTemplate(true);
      const response = await api.get(`/psa/projects/${currentProject.id}/extract-template-data`, {
        params: { companyId }
      });
      
      setTemplatePreviewData(response.data.data);
      setShowSaveAsTemplateModal(true);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to extract project data';
      showError(errorMessage);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleConfirmSaveTemplate = async () => {
    try {
      setIsSavingTemplate(true);
      await api.post(`/psa/projects/${currentProject.id}/save-as-template`, {}, {
        params: { companyId }
      });
      
      showSuccess('Project saved as template successfully!');
      setShowSaveAsTemplateModal(false);
      setTemplatePreviewData(null);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to save project as template';
      showError(errorMessage);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleItemClick = (item: BacklogItem) => {
    console.log('🔍 Item clicked:', {
      id: item.id,
      title: item.title,
      type: item.type,
      acceptanceCriteria: item.acceptanceCriteria,
      acceptanceCriteriaType: typeof item.acceptanceCriteria,
      acceptanceCriteriaLength: Array.isArray(item.acceptanceCriteria) ? item.acceptanceCriteria.length : 'not array'
    });
    
    if (item.type === 'epic') {
      setSelectedEpic(item);
      setShowEpicModal(true);
    } else if (item.type === 'feature') {
      // Find parent epic for the feature
      let parentEpicName = '';
      if (item.parentId) {
        const parentEpic = backlogItems.find(epic => epic.id === item.parentId);
        if (parentEpic) {
          parentEpicName = parentEpic.title;
        }
      }
      
      // Create feature with parent epic name
      const featureWithEpic = {
        ...item,
        parentName: parentEpicName
      };
      
      setSelectedFeature(featureWithEpic);
      setShowFeatureModal(true);
    } else if (item.type === 'story') {
      // Find parent epic for the story
      let parentEpicName = '';
      if (item.parentId) {
        const parentFeature = backlogItems.find(feature => feature.id === item.parentId);
        if (parentFeature && parentFeature.parentId) {
          const parentEpic = backlogItems.find(epic => epic.id === parentFeature.parentId);
          if (parentEpic) {
            parentEpicName = parentEpic.title;
          }
        }
      }
      
      // Create story with parent epic name
      const storyWithEpic = {
        ...item,
        parentEpicName
      };
      
      console.log('📝 Story with epic created:', {
        id: storyWithEpic.id,
        title: storyWithEpic.title,
        acceptanceCriteria: storyWithEpic.acceptanceCriteria,
        acceptanceCriteriaType: typeof storyWithEpic.acceptanceCriteria,
        acceptanceCriteriaLength: Array.isArray(storyWithEpic.acceptanceCriteria) ? storyWithEpic.acceptanceCriteria.length : 'not array'
      });
      
      setSelectedStory(storyWithEpic);
      setShowStoryModal(true);
    }
  };

  const handleUpdateEpic = async (updatedEpic: BacklogItem) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/item/${updatedEpic.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: updatedEpic.title,
            description: updatedEpic.description,
            status: updatedEpic.status,
            priority: updatedEpic.priority,
            story_points: updatedEpic.storyPoints,
            assignee_id: updatedEpic.assigneeId,
            tags: updatedEpic.tags,
            acceptance_criteria: updatedEpic.acceptanceCriteria,
          }),
        }
      );

      if (resp.ok) {
        setBacklogItems(prev => prev?.map(item =>
          item.id === updatedEpic.id ? updatedEpic : item
        ));
        console.log('✅ Epic updated successfully');
      }
    } catch (error) {
      console.error('🚨 Error updating epic:', error);
    }
  };

   const handleAddFeature = async (newFeature: Omit<BacklogItem, 'id' | 'status'>) => {
     try {
       // Check for duplicate feature with same title and parent
       const existingFeature = backlogItems.find(item => 
         item.title === newFeature.title && 
         item.parentId === newFeature.parentId && 
         item.type === 'feature'
       );
       
       if (existingFeature) {
         showError("A feature with this title already exists under this epic!");
         return;
       }

       const token = localStorage.getItem('token');
      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/createProjectHierarchy/${currentProject.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: newFeature.title,
            description: newFeature.description,
            type: 'feature',
            priority: newFeature.priority,
            storyPoints: newFeature.storyPoints,
            assignee_id: newFeature.assigneeId,
            tags: newFeature.tags,
            acceptance_criteria: newFeature.acceptanceCriteria,
            parent_id: newFeature.parentId,
            project_id: currentProject.id
          }),
        }
      );

       if (resp.ok) {
         const result = await resp.json();
         if (result.success && result.data) {
           const mappedFeature: BacklogItem = {
             id: result.data.id,
             title: result.data.title,
             description: result.data.description,
             type: result.data.type,
             status: result.data.status || 'backlog',
             priority: result.data.priority || 'medium',
             storyPoints: result.data.story_points || 1,
             assigneeId: result.data.assignee_id || '',
             tags: Array.isArray(result.data.tags) ? result.data.tags : 
               (typeof result.data.tags === 'string' ? 
                 (() => { try { return JSON.parse(result.data.tags); } catch { return []; } })() : []),
             acceptanceCriteria: Array.isArray(result.data.acceptance_criteria) ? result.data.acceptance_criteria : 
               (typeof result.data.acceptance_criteria === 'string' ? 
                 (() => { 
                 try { 
                   const parsed = JSON.parse(result.data.acceptance_criteria);
                   return Array.isArray(parsed) ? parsed : [];
                 } catch { 
                   return []; 
                 } 
               })() : []),
             parentId: result.data.parent_id,
             children: []
           };

           // Add to main list and update parent's children in one operation
           setBacklogItems(prev => {
             const updatedItems = [...prev, mappedFeature];
             return updatedItems.map(item => 
               item.id === newFeature.parentId 
                 ? { ...item, children: [...(item.children || []), mappedFeature] }
                 : item
             );
           });

           // Update the selected epic's children if it's the parent
           if (selectedEpic && selectedEpic.id === newFeature.parentId) {
             setSelectedEpic(prev => prev ? ({
               ...prev,
               children: [...(prev.children || []), mappedFeature]
             }) : null);
           }
          
          // Show success toast
          showSuccess('Feature created successfully!');
          
          // If backend suggests refreshing all data, do it
          if (result.refreshBacklog) {
            console.log('🔄 Backend suggests refreshing all data, calling refreshAllData...');
            await refreshAllData();
          }
         } else {
           // Handle backend duplicate error
           showError(result.message || "Failed to create feature");
         }
       } else {
         const result = await resp.json();
         showError(result.message || "Failed to create feature");
       }
    } catch (error) {
      console.error('🚨 Error adding feature:', error);
      showError("Failed to create feature. Please try again.");
    }
  };

  const handleRemoveFeature = (featureId: string) => {
    // Find the item to delete
    const findItem = (items: BacklogItem[], targetId: string): BacklogItem | null => {
      for (const item of items) {
        if (item.id === targetId) return item;
        if (item.children) {
          const found = findItem(item.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const itemToDelete = findItem(backlogItems, featureId);
    if (itemToDelete) {
      setItemToDelete(itemToDelete);
      setShowDeleteModal(true);
    }
  };

  const handleUpdateFeature = async (updatedFeature: BacklogItem) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/item/${updatedFeature.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: updatedFeature.title,
            description: updatedFeature.description,
            status: updatedFeature.status,
            priority: updatedFeature.priority,
            story_points: updatedFeature.storyPoints,
            assignee_id: updatedFeature.assigneeId,
            tags: updatedFeature.tags,
            acceptance_criteria: updatedFeature.acceptanceCriteria,
          }),
        }
      );

      if (resp.ok) {
        setBacklogItems(prev => prev?.map(item =>
          item.id === updatedFeature.id ? updatedFeature : item
        ));
        console.log('✅ Feature updated successfully');
        
        // Refresh backlog items to get updated statuses (including cascaded changes)
        await fetchBacklogItems();
        
        // Notify parent to refresh story progress
        if (onStoryUpdate) {
          onStoryUpdate();
        }
      }
    } catch (error) {
      console.error('🚨 Error updating feature:', error);
    }
  };

   const handleAddStory = async (newStory: Omit<BacklogItem, 'id' | 'status'>) => {
     try {
       // Check for duplicate story with same title and parent
       const existingStory = backlogItems.find(item => 
         item.title === newStory.title && 
         item.parentId === newStory.parentId && 
         item.type === 'story'
       );
       
       if (existingStory) {
         showError("A story with this title already exists under this feature!");
         return;
       }

       const token = localStorage.getItem('token');
      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/createProjectHierarchy/${currentProject.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: newStory.title,
            description: newStory.description,
            type: 'story',
            priority: newStory.priority,
            storyPoints: newStory.storyPoints,
            assignee_id: newStory.assigneeId,
            tags: newStory.tags,
            acceptance_criteria: newStory.acceptanceCriteria,
            required_skills: newStory.requiredSkills,
            parent_id: newStory.parentId,
            project_id: currentProject.id
          }),
        }
      );

       if (resp.ok) {
         const result = await resp.json();
         if (result.success && result.data) {
           const mappedStory: BacklogItem = {
             id: result.data.id,
             title: result.data.title,
             description: result.data.description,
             type: result.data.type,
             status: result.data.status || 'backlog',
             priority: result.data.priority || 'medium',
             storyPoints: result.data.story_points || 1,
             assigneeId: result.data.assignee_id || '',
             tags: Array.isArray(result.data.tags) ? result.data.tags : 
               (typeof result.data.tags === 'string' ? 
                 (() => { try { return JSON.parse(result.data.tags); } catch { return []; } })() : []),
             acceptanceCriteria: Array.isArray(result.data.acceptance_criteria) ? result.data.acceptance_criteria : 
               (typeof result.data.acceptance_criteria === 'string' ? 
                 (() => { 
                 try { 
                   const parsed = JSON.parse(result.data.acceptance_criteria);
                   return Array.isArray(parsed) ? parsed : [];
                 } catch { 
                   return []; 
                 } 
               })() : []),
             requiredSkills: Array.isArray(result.data.required_skills) ? result.data.required_skills : 
               (typeof result.data.required_skills === 'string' ? 
                 (() => { try { return JSON.parse(result.data.required_skills); } catch { return []; } })() : []),
             parentId: result.data.parent_id,
             children: []
           };

           // Add to main list and update parent's children in one operation
           setBacklogItems(prev => {
             const updatedItems = [...prev, mappedStory];
             return updatedItems.map(item => 
               item.id === newStory.parentId 
                 ? { ...item, children: [...(item.children || []), mappedStory] }
                 : item
             );
           });

           // Update the selected feature's children if it's the parent
           if (selectedFeature && selectedFeature.id === newStory.parentId) {
             setSelectedFeature(prev => prev ? ({
               ...prev,
               children: [...(prev.children || []), mappedStory]
             }) : null);
           }
          
          // Show success toast
          showSuccess('Story created successfully!');
          
          // If backend suggests refreshing all data, do it
          if (result.refreshBacklog) {
            console.log('🔄 Backend suggests refreshing all data, calling refreshAllData...');
            await refreshAllData();
          }
         } else {
           // Handle backend duplicate error
           showError(result.message || "Failed to create story");
         }
       } else {
         const result = await resp.json();
         showError(result.message || "Failed to create story");
       }
    } catch (error) {
      console.error('🚨 Error adding story:', error);
      showError("Failed to create story. Please try again.");
    }
  };

  const handleRemoveStory = (storyId: string) => {
    // Find the item to delete
    const findItem = (items: BacklogItem[], targetId: string): BacklogItem | null => {
      for (const item of items) {
        if (item.id === targetId) return item;
        if (item.children) {
          const found = findItem(item.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const itemToDelete = findItem(backlogItems, storyId);
    if (itemToDelete) {
      setItemToDelete(itemToDelete);
      setShowDeleteModal(true);
    }
  };

  const handleUpdateStory = async (updatedStory: BacklogItem) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/item/${updatedStory.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: updatedStory.title,
            description: updatedStory.description,
            status: updatedStory.status,
            priority: updatedStory.priority,
            story_points: updatedStory.storyPoints,
            assignee_id: updatedStory.assigneeId,
            sprint_id: updatedStory.sprintId,
            tags: updatedStory.tags,
            acceptance_criteria: updatedStory.acceptanceCriteria,
            required_skills: updatedStory.requiredSkills,
          }),
        }
      );

      if (resp.ok) {
        setBacklogItems(prev => prev?.map(item =>
          item.id === updatedStory.id ? updatedStory : item
        ));
        console.log('✅ Story updated successfully');
        
        // Refresh backlog items to get updated statuses (including cascaded changes)
        await fetchBacklogItems();
        
        // Notify parent to refresh story progress
        if (onStoryUpdate) {
          onStoryUpdate();
        }
      }
    } catch (error) {
      console.error('🚨 Error updating story:', error);
    }
  };

  // Handle edit item
  const handleEditItem = (item: BacklogItem) => {
    if (item.type === 'epic') {
      // Task 1: Edit Epic - hide feature and story tabs
      setItemToEdit(item);
      setShowEditModal(true);
    } else if (item.type === 'feature') {
      // Check if feature is linked to an epic
      const findParentEpic = (items: BacklogItem[], featureId: string): BacklogItem | null => {
        for (const item of items) {
          if (item.type === 'epic' && item.children) {
            const foundFeature = item.children.find(child => child.id === featureId);
            if (foundFeature) return item;
          }
        }
        return null;
      };

      const parentEpic = findParentEpic(backlogItems, item.id);
      if (parentEpic) {
        // Task 2: Feature linked to epic - open epic management modal with feature data
        setSelectedEpic(parentEpic);
        setEpicEditMode('feature');
        setEditingItem(item);
        setShowEpicModal(true);
      } else {
        // Task 3: Feature not linked to epic - open regular edit modal with only feature tab
        setItemToEdit(item);
        setShowEditModal(true);
      }
    } else {
      // Story - open regular edit modal
      setItemToEdit(item);
      setShowEditModal(true);
    }
  };

  // Handle update epic in epic management modal
  const handleUpdateEpicInModal = async (updatedEpic: BacklogItem) => {
    try {
      const token = localStorage.getItem('token');
      const companyId = new URLSearchParams(window.location.search).get('company');
      
      if (!token || !companyId) {
        showError('Authentication required');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/item/${updatedEpic.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: updatedEpic.title,
            description: updatedEpic.description,
            type: updatedEpic.type,
            priority: updatedEpic.priority,
            story_points: updatedEpic.storyPoints,
            assignee_id: updatedEpic.assigneeId,
            tags: updatedEpic.tags,
            acceptance_criteria: updatedEpic.acceptanceCriteria,
            parent_id: updatedEpic.parentId,
            business_value: updatedEpic.businessValue,
            company_id: companyId,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showSuccess('Epic updated successfully');
          
          // Update the item in the local state
          const updateItemInState = (items: BacklogItem[]): BacklogItem[] => {
            return items.map(item => {
              if (item.id === updatedEpic.id) {
                return { ...item, ...updatedEpic };
              }
              if (item.children) {
                return { ...item, children: updateItemInState(item.children) };
              }
              return item;
            });
          };

          setBacklogItems(prev => updateItemInState(prev || []));
          
          // Refresh backlog items to get updated statuses (including cascaded changes)
          await fetchBacklogItems();
          
          // Close the epic modal
          setShowEpicModal(false);
          setSelectedEpic(null);
          setEpicEditMode(null);
          setEditingItem(null);
        } else {
          showError(result.message || 'Failed to update epic');
        }
      } else {
        showError('Failed to update epic');
      }
    } catch (error) {
      console.error('Error updating epic:', error);
      showError('Failed to update epic. Please try again.');
    }
  };

  // Handle update feature in epic management modal
  const handleUpdateFeatureInEpic = async (updatedFeature: BacklogItem) => {
    try {
      const token = localStorage.getItem('token');
      const companyId = new URLSearchParams(window.location.search).get('company');
      
      if (!token || !companyId) {
        showError('Authentication required');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/item/${updatedFeature.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: updatedFeature.title,
            description: updatedFeature.description,
            type: updatedFeature.type,
            priority: updatedFeature.priority,
            story_points: updatedFeature.storyPoints,
            assignee_id: updatedFeature.assigneeId,
            tags: updatedFeature.tags,
            acceptance_criteria: updatedFeature.acceptanceCriteria,
            parent_id: updatedFeature.parentId,
            company_id: companyId,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showSuccess('Feature updated successfully');
          
          // Update the item in the local state
          const updateItemInState = (items: BacklogItem[]): BacklogItem[] => {
            return items.map(item => {
              if (item.id === updatedFeature.id) {
                return { ...item, ...updatedFeature };
              }
              if (item.children) {
                return { ...item, children: updateItemInState(item.children) };
              }
              return item;
            });
          };

          setBacklogItems(prev => updateItemInState(prev || []));
          
          // Close the epic modal
          setShowEpicModal(false);
          setSelectedEpic(null);
          setEpicEditMode(null);
          setEditingItem(null);
        } else {
          showError(result.message || 'Failed to update feature');
        }
      } else {
        showError('Failed to update feature');
      }
    } catch (error) {
      console.error('Error updating feature:', error);
      showError('Failed to update feature. Please try again.');
    }
  };

  // Handle update item (generic for all types)
  const handleUpdateItem = async (updatedItem: BacklogItem) => {
    // Set loading state
    setStatusUpdating(updatedItem.id);
    
    try {
      const token = localStorage.getItem('token');
      const companyId = new URLSearchParams(window.location.search).get('company');
      
      if (!token || !companyId) {
        showError('Authentication required');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/item/${updatedItem.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: updatedItem.title,
            description: updatedItem.description,
            type: updatedItem.type,
            priority: updatedItem.priority,
            story_points: updatedItem.storyPoints,
            assignee_id: updatedItem.assigneeId,
            tags: updatedItem.tags,
            acceptance_criteria: updatedItem.acceptanceCriteria,
            parent_id: updatedItem.parentId,
            business_value: updatedItem.businessValue,
            company_id: companyId,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showSuccess(`${updatedItem.type.charAt(0).toUpperCase() + updatedItem.type.slice(1)} updated successfully`);
          
          // Update the item in the local state
          const updateItemInState = (items: BacklogItem[]): BacklogItem[] => {
            return items.map(item => {
              if (item.id === updatedItem.id) {
                return { ...item, ...updatedItem };
              }
              if (item.children) {
                return { ...item, children: updateItemInState(item.children) };
              }
              return item;
            });
          };

          setBacklogItems(prev => updateItemInState(prev || []));
          setShowEditModal(false);
          setItemToEdit(null);
        } else {
          showError(result.message || 'Failed to update item');
        }
      } else {
        showError('Failed to update item');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      showError('Failed to update item. Please try again.');
    } finally {
      // Clear loading state
      setStatusUpdating(null);
    }
  };

  // Handle delete item
  const handleDeleteItem = (item: BacklogItem) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  // Confirm delete item
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

   
    setIsDeleting(true);
    try {
      const response = await api.delete(`/psa/backlog/item/${itemToDelete.id}`);

      
      if (response.data.success) {
        showSuccess(response.data.message);
        
        // Remove the item and its children from the state
        const removeItemAndChildren = (items: BacklogItem[], targetId: string): BacklogItem[] => {
          return items.filter(item => {
            if (item.id === targetId) return false;
            if (item.children) {
              item.children = removeItemAndChildren(item.children, targetId);
            }
            return true;
          });
        };

        setBacklogItems(prev => removeItemAndChildren(prev || [], itemToDelete.id));
        
        // Close any open modals
        setShowEpicModal(false);
        setShowFeatureModal(false);
        setShowStoryModal(false);
        setSelectedEpic(null);
        setSelectedFeature(null);
        setSelectedStory(null);
        setShowDeleteModal(false);
        setItemToDelete(null);
      } else {
        showError(response.data.message || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      showError('Failed to delete item. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderHierarchyView = () => {
    const rootItems = hierarchicalItems.filter(item => !item.parentId);

    const renderHierarchyItem = (item: BacklogItem, level: number = 0) => {
      const indentClass = level > 0 ? `ml-${level * 6}` : '';
      const typeIcon = item.type === 'epic' ? '📚' : item.type === 'feature' ? '🎯' : '📝';

      return (
        <div key={item.id} className={`${indentClass} mb-2`}>
          <div
            className={`bg-white rounded-lg p-4 border border-gray-200 shadow-sm transition-shadow ${
              item.type === 'epic' || item.type === 'feature' 
                ? 'cursor-pointer hover:shadow-md'
                : ''
              }`}
            onClick={() => handleItemClick(item)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-lg mr-3">{typeIcon}</span>
                <div>
                  <h4 className="font-medium text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(item.type)}`}>
                  {item.type}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(item.priority)}`}>
                  {item.priority}
                </span>
                {item.storyPoints && <span className="text-xs text-gray-500">{item.storyPoints} pts</span>}
                {item.businessValue && <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">{item.businessValue} BV</span>}
                {item.children && item.children.length > 0 && (
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                    {item.children.length} {item.type === 'epic' ? 'features' : 'stories'}
                  </span>
                )}
              </div>
            </div>

            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Render children */}
          {item.children && item.children.map(child => renderHierarchyItem(child, level + 1))}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        {rootItems.map(item => renderHierarchyItem(item))}
      </div>
    );
  };

  const renderSprintView = () => {
    // Use real data from backlogItems - all stories (including those with parents)
    // In sprint view, we want to show all stories regardless of hierarchy
    const stories = filteredItems.filter(item => item.type === 'story');
    
    // Debug: Log the data to understand what's happening
    console.log('🔍 Sprint View Debug:', {
      totalBacklogItems: backlogItems.length,
      filteredItems: filteredItems.length,
      stories: stories.length,
      sprintData: sprintData.length,
      realSprints: sprintData,
      allStories: filteredItems.filter(item => item.type === 'story'),
      storiesWithParent: filteredItems.filter(item => item.type === 'story' && item.parentId)
    });
    
    // Calculate total story points
    const totalStoryPoints = stories.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    const completedStoryPoints = stories
      .filter(item => item.status === 'done')
      .reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    
    // Calculate velocity metrics
    const inProgressStoryPoints = stories
      .filter(item => item.status === 'in_progress')
      .reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    
    const backlogStoryPoints = stories
      .filter(item => item.status === 'backlog')
      .reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    
    // Calculate completion percentage
    const completionPercentage = totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0;
    
    // Use real sprint data from API instead of hardcoded data
    const realSprints = sprintData.length > 0 ? sprintData : [];
    
    // Calculate average velocity from real sprint data
    const averageVelocity = realSprints.length > 0 
      ? Math.round(realSprints.reduce((sum, sprint) => sum + (sprint.velocity || 0), 0) / realSprints.length)
      : 0;
    
    // Use real sprint data for story counts if available
    const realTotalStories = realSprints.length > 0 
      ? realSprints.reduce((sum, sprint) => sum + (sprint.total_stories || 0), 0)
      : stories.length;
    
    const realCompletedStories = realSprints.length > 0 
      ? realSprints.reduce((sum, sprint) => sum + (sprint.completed_story_points || 0), 0)
      : completedStoryPoints;
    
    const realTotalStoryPoints = realSprints.length > 0 
      ? realSprints.reduce((sum, sprint) => sum + (sprint.total_story_points || 0), 0)
      : totalStoryPoints;
    
    // Create sprint-like organization based on status for display
    // Note: Sprints only contain stories, not epics or features
    const sprints = [
      {
        id: 'completed-sprint',
        name: 'Completed Stories',
        startDate: 'Project Start',
        endDate: 'Current',
        status: 'completed',
        goal: 'Stories that have been completed and delivered',
        capacity: totalStoryPoints,
        completed: completedStoryPoints,
        items: stories.filter(item => item.status === 'done'),
        velocity: completedStoryPoints,
        commitment: completedStoryPoints,
        efficiency: completedStoryPoints > 0 ? Math.round((completedStoryPoints / completedStoryPoints) * 100) : 0
      },
      {
        id: 'active-sprint',
        name: 'Current Sprint',
        startDate: 'Current',
        endDate: 'Ongoing',
        status: 'active',
        goal: 'Stories currently being worked on by the team',
        capacity: totalStoryPoints,
        completed: completedStoryPoints,
        items: stories.filter(item => item.status === 'in_progress'),
        velocity: inProgressStoryPoints,
        commitment: inProgressStoryPoints,
        efficiency: inProgressStoryPoints > 0 ? Math.round((inProgressStoryPoints / inProgressStoryPoints) * 100) : 0
      },
      {
        id: 'backlog-sprint',
        name: 'Sprint Backlog',
        startDate: 'Future',
        endDate: 'TBD',
        status: 'planned',
        goal: 'Stories planned for upcoming sprints',
        capacity: totalStoryPoints,
        completed: completedStoryPoints,
        items: stories.filter(item => item.status === 'backlog'),
        velocity: backlogStoryPoints,
        commitment: backlogStoryPoints,
        efficiency: backlogStoryPoints > 0 ? Math.round((backlogStoryPoints / backlogStoryPoints) * 100) : 0
      }
    ];

    const getSprintStatusColor = (status: string) => {
      switch (status) {
        case 'completed': return 'bg-green-100 text-green-800';
        case 'active': return 'bg-blue-100 text-blue-800';
        case 'planned': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    // Calculate progress for each sprint based on actual data
    const calculateSprintProgress = (sprintItems: BacklogItem[]) => {
      const sprintStoryPoints = sprintItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
      const completedSprintPoints = sprintItems
        .filter(item => item.status === 'done')
        .reduce((sum, item) => sum + (item.storyPoints || 0), 0);
      return {
        total: sprintStoryPoints,
        completed: completedSprintPoints,
        percentage: sprintStoryPoints > 0 ? Math.round((completedSprintPoints / sprintStoryPoints) * 100) : 0
      };
    };

    return (
      <div className="space-y-6">
        {/* Project Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Sprint Progress</h4>
            <div className="text-sm text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
              📝 Stories Only - Epics & Features are managed in Hierarchy View
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{realTotalStories}</div>
              <div className="text-sm text-gray-600">Total Stories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stories.filter(item => item.status === 'done').length}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stories.filter(item => item.status === 'in_progress').length}
              </div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {stories.filter(item => item.status === 'backlog').length}
              </div>
              <div className="text-sm text-gray-600">Backlog</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
              <div>
                <span className="block text-xs text-gray-500">Total Story Points</span>
                <span className="font-semibold text-lg">{realTotalStoryPoints}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-500">Completed</span>
                <span className="font-semibold text-lg text-green-600">{completedStoryPoints}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-500">In Progress</span>
                <span className="font-semibold text-lg text-yellow-600">{inProgressStoryPoints}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-500">Backlog</span>
                <span className="font-semibold text-lg text-gray-600">{backlogStoryPoints}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Project Velocity: <span className="font-semibold text-blue-600">{completedStoryPoints} story points</span></span>
                <span className="text-gray-600">Avg Velocity: <span className="font-semibold text-blue-600">{averageVelocity} story points</span></span>
                <span className="text-gray-600">Completion: <span className="font-semibold text-green-600">{totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0}%</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Velocity Chart */}
        {sprintData.length > 0 && (
          <VelocityChart sprints={sprintData} />
        )}

        {/* Real Sprint Data Section */}
        {realSprints.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Actual Sprints</h4>
              <div className="text-sm text-gray-500 bg-green-50 px-3 py-1 rounded-full">
                📊 Real Sprint Data from API
              </div>
            </div>
            
            <div className="space-y-4">
              {realSprints.map(sprint => (
                <div key={sprint.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h5 className="text-md font-semibold text-gray-900 mr-3">{sprint.name}</h5>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          sprint.status === 'completed' ? 'bg-green-100 text-green-800' :
                          sprint.status === 'active' ? 'bg-blue-100 text-blue-800' :
                          sprint.status === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {sprint.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{sprint.goal}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                        <span>📅 {new Date(sprint.start_date).toLocaleDateString()} - {new Date(sprint.end_date).toLocaleDateString()}</span>
                        <span>📊 {sprint.completed_story_points}/{sprint.total_story_points} story points</span>
                        <span>📝 {sprint.total_stories} stories</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="font-semibold text-gray-900">Velocity</div>
                          <div className="text-lg font-bold text-blue-600">{sprint.velocity || 0}</div>
                          <div>story points</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3">
                          <div className="font-semibold text-gray-900">Commitment</div>
                          <div className="text-lg font-bold text-purple-600">{sprint.commitment || 0}</div>
                          <div>story points</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="font-semibold text-gray-900">Efficiency</div>
                          <div className="text-lg font-bold text-green-600">{sprint.efficiency || 0}%</div>
                          <div>completion rate</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sprint Sections */}
        {sprints.map(sprint => {
          const progress = calculateSprintProgress(sprint.items);
          return (
            <div key={sprint.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <h4 className="text-lg font-semibold text-gray-900 mr-3">{sprint.name}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSprintStatusColor(sprint.status)}`}>
                      {sprint.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{sprint.goal}</p>
                  
                  <div className="flex items-center space-x-6 text-sm text-gray-500 mb-4">
                    <span>📅 {sprint.startDate} - {sprint.endDate}</span>
                    <span>📊 {progress.completed}/{progress.total} story points</span>
                    <span>📈 {progress.percentage}% complete</span>
                    <span>📝 {sprint.items.length} items</span>
                  </div>
                  
                  {/* Velocity Metrics */}
                  <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="font-semibold text-gray-900">Velocity</div>
                      <div className="text-lg font-bold text-blue-600">{sprint.velocity || progress.completed}</div>
                      <div>story points completed</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="font-semibold text-gray-900">Commitment</div>
                      <div className="text-lg font-bold text-purple-600">{sprint.commitment || progress.total}</div>
                      <div>story points planned</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="font-semibold text-gray-900">Efficiency</div>
                      <div className="text-lg font-bold text-green-600">
                        {sprint.efficiency || (progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0)}%
                      </div>
                      <div>completion rate</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Sprint Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sprint.items.map(item => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium text-gray-900 text-sm">{item.title}</h5>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs mb-3 line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {item.type}
                      </span>
                      {item.storyPoints && (
                        <span className="text-purple-700">{item.storyPoints} pts</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderProgramIncrementView = () => {
    return (
      <div className="space-y-6">
        {/* Header with Create PI Button */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">Program Increments</h4>
            <p className="text-sm text-gray-600">Plan and track 1-6 week Program Increments with objectives and capacity planning</p>
          </div>
          <button
            onClick={() => setShowCreatePIModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Program Increment
          </button>
        </div>

        {/* Program Increments List */}
        {programIncrements.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Program Increments Yet</h3>
            <p className="text-gray-600 mb-4">Create your first Program Increment to start planning 8-12 week cycles</p>
            <button
              onClick={() => setShowCreatePIModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Program Increment
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programIncrements.map((pi) => (
              <div key={pi.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h5 className="font-semibold text-gray-900">{pi.name}</h5>
                    <p className="text-sm text-gray-600">{pi.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      pi.status === 'planning' ? 'bg-blue-100 text-blue-800' :
                      pi.status === 'active' ? 'bg-green-100 text-green-800' :
                      pi.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {pi.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <button
                      onClick={() => handleEditPI(pi)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Edit Program Increment"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600 hover:text-blue-600" />
                    </button>
                    <button
                      onClick={() => handleDeletePI(pi)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Delete Program Increment"
                    >
                      <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-600" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-medium">{pi.duration_weeks} weeks</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Capacity</span>
                    <span className="font-medium">{pi.pi_capacity} pts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Commitment</span>
                    <span className="font-medium">{pi.current_commitment} pts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Start Date</span>
                    <span className="font-medium">{new Date(pi.start_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">End Date</span>
                    <span className="font-medium">{new Date(pi.end_date).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">
                      {pi.status === 'completed' ? '100%' : 
                       pi.status === 'active' ? '50%' : 
                       pi.status === 'review' ? '75%' : '0%'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${pi.status === 'completed' ? '100' : 
                                pi.status === 'active' ? '50' : 
                                pi.status === 'review' ? '75' : '0'}%` 
                      }}
                    ></div>
                  </div>
                </div>

                {/* Objectives and Sprints Count */}
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Objectives</span>
                    <span className="font-medium">{pi.objectives?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Sprints</span>
                    <span className="font-medium">{pi.sprints?.length || 0}</span>
                  </div>
                </div>

                {/* Associated Sprints */}
                {pi.sprints && pi.sprints.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm font-medium text-gray-700 mb-2">Associated Sprints</div>
                    <div className="space-y-2">
                      {pi.sprints.map((sprint: any) => (
                        <div key={sprint.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg p-2">
                          <div>
                            <div className="font-medium text-gray-900">{sprint.name}</div>
                            <div className="text-gray-500">
                              {new Date(sprint.start_date).toLocaleDateString()} - {new Date(sprint.end_date).toLocaleDateString()}
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            sprint.status === 'completed' ? 'bg-green-100 text-green-800' :
                            sprint.status === 'active' ? 'bg-blue-100 text-blue-800' :
                            sprint.status === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {sprint.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBacklogItem = (item: BacklogItem, level: number = 0) => {
    const indentClass = level > 0 ? `ml-${level * 4}` : '';
    const borderClass = level > 0 ? 'border-l-2 border-gray-200 pl-4' : '';

    return (
      <div key={item.id} className={`${indentClass} ${borderClass}`}>
        <div
          draggable={statusUpdating !== item.id}
          onDragStart={(e) => handleDragStart(e, item)}
          className={`bg-white rounded-lg p-4 border border-gray-200 shadow-sm transition-all duration-200 mb-2 relative ${
            draggedItem === item.id 
              ? 'opacity-50 scale-95 rotate-2 hover:shadow-md' 
              : statusUpdating === item.id
                ? 'opacity-60 cursor-not-allowed'
              : item.type === 'epic' || item.type === 'feature'
                  ? 'cursor-pointer hover:border-blue-300 hover:shadow-md'
                  : 'cursor-pointer hover:border-green-300 hover:shadow-md'
          }`}
          onClick={() => statusUpdating !== item.id && handleItemClick(item)}
          onMouseEnter={(e) => {
            if (item.type === 'story') {
              const rect = e.currentTarget.getBoundingClientRect();
              setHoverPosition({
                x: rect.left + rect.width / 2, // Center of the card
                y: rect.top
              });
              setHoveredStory(item.id);
            }
          }}
          onMouseLeave={() => {
            setHoveredStory(null);
          }}
        >
          {/* Loading Overlay */}
          {statusUpdating === item.id && (
            <div className="absolute inset-0 bg-white bg-opacity-75 rounded-lg flex items-center justify-center z-10">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600">Updating...</span>
              </div>
            </div>
          )}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center">
              {level > 0 && (
                <div className="w-4 h-4 bg-gray-300 rounded-full mr-2 flex items-center justify-center">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                </div>
              )}
              <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{item.title}</h4>
            </div>
            <div className="flex items-center space-x-1 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (statusUpdating !== item.id) {
                    handleEditItem(item);
                  }
                }}
                disabled={statusUpdating === item.id}
                className={`p-1 rounded-lg transition-colors ${
                  statusUpdating === item.id 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-gray-100'
                }`}
                title={statusUpdating === item.id ? "Updating..." : "Edit item"}
              >
                <Edit2 className={`w-3 h-3 ${
                  statusUpdating === item.id 
                    ? 'text-gray-400' 
                    : 'text-gray-500 hover:text-blue-600'
                }`} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (statusUpdating !== item.id) {
                    handleDeleteItem(item);
                  }
                }}
                disabled={statusUpdating === item.id}
                className={`p-1 rounded-lg transition-colors ${
                  statusUpdating === item.id 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-red-100'
                }`}
                title={statusUpdating === item.id ? "Updating..." : "Delete item"}
              >
                <Trash2 className={`w-3 h-3 ${
                  statusUpdating === item.id 
                    ? 'text-gray-400' 
                    : 'text-gray-500 hover:text-red-600'
                }`} />
              </button>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(item.type)}`}>
                {item.type}
              </span>
            </div>
          </div>

          <p className="text-gray-600 text-xs mb-3 line-clamp-2">{item.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(item.priority)}`}>
                {item.priority}
              </span>
              {item.storyPoints && <span className="text-xs text-gray-500">{item.storyPoints} pts</span>}
              {item.businessValue && <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">{item.businessValue} BV</span>}
              {item.children && item.children.length > 0 && (
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  {item.children.length} {item.type === 'epic' ? 'features' : 'stories'}
                </span>
              )}
            </div>
            {item.assigneeId && (
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {item.assigneeId}
                </span>
              </div>
            )}
          </div>

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.slice(0, 3).map(tag => (
                <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                  {tag}
                </span>
              ))}
              {item.tags.length > 3 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                  +{item.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Render children with increased indentation - only if they have the same status */}
        {item.children && item.children
          .filter(child => child.status === item.status)
          .map(child => renderBacklogItem(child, level + 1))}
      </div>
    );
  };

  const kanbanColumns = [
    { id: 'backlog', title: 'Backlog', color: 'bg-gray-50 border-gray-200' },
    { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50 border-blue-200' },
    { id: 'review', title: 'Review', color: 'bg-yellow-50 border-yellow-200' },
    { id: 'done', title: 'Done', color: 'bg-green-50 border-green-200' }
  ];

  const typeStats = {
    epics: backlogItems.filter(item => item.type === 'epic').length,
    features: backlogItems.filter(item => item.type === 'feature').length,
    stories: backlogItems.filter(item => item.type === 'story').length,
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
          <div>
            <h1 
              className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => setShowEditProjectModal(true)}
              title="Click to edit project"
            >
              {currentProject.name}
            </h1>
            <p className="text-sm text-gray-500">ID: {currentProject.id}</p>
            <p className="text-gray-600">{currentProject.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`flex items-center px-3 py-1 rounded-lg text-sm font-medium ${getHealthColor(currentProject.health)}`}>
            <HealthIcon className="w-4 h-4 mr-2" />
            {currentProject.health.toUpperCase()}
          </div>
          <button
            onClick={() => setShowAddItemModal(true)}
            disabled={isCreating}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </>
            )}
          </button>
          <button
            onClick={handleSaveAsTemplate}
            disabled={isSavingTemplate}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingTemplate ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Extracting...
              </>
            ) : (
              <>
                <LayoutTemplate className="w-4 h-4 mr-2" />
                Save as Template
              </>
            )}
          </button>
        </div>
      </div>

      {/* Project Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Progress</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(progressPercentage)}%</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Team Size</p>
              <p className="text-2xl font-bold text-gray-900">{project.resources.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Budget Used</p>
              <p className="text-2xl font-bold text-gray-900">
                {project.costSummary ? 
                  `$${project.costSummary.totalSpent.toLocaleString()}` : 
                  (costAnalysis ? 
                    `$${costAnalysis.costs.totalSpent.toLocaleString()}` : 
                    `$${project.actualHours.toLocaleString()}`
                  )
                }
              </p>
              {(project.costSummary || costAnalysis) && (
                <p className="text-xs text-gray-500 mt-1">
                  Remaining: ${project.costSummary ? 
                    project.costSummary.budgetRemaining.toLocaleString() : 
                    (costAnalysis ? costAnalysis.costs.budgetRemaining.toLocaleString() : '0')
                  }
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Days Left</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.max(0, Math.ceil((new Date(project.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {project.storyProgress && (
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Story Points</p>
                <p className="text-2xl font-bold text-gray-900">
                  {project.storyProgress.completedStoryPoints} / {project.storyProgress.totalStoryPoints}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {project.storyProgress.storyProgressPercentage}% Complete
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cost Analysis Section */}
      {loadingCostAnalysis ? (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading cost analysis...</span>
          </div>
        </div>
      ) : costAnalysis && (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Cost Analysis</h2>
            <div className="flex items-center space-x-2">
              {costAnalysis.budget.isOverBudget ? (
                <div className="flex items-center text-red-600">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">Over Budget</span>
                </div>
              ) : (
                <div className="flex items-center text-green-600">
                  <TrendingDown className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">On Track</span>
                </div>
              )}
            </div>
          </div>

          {/* Cost Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Weekly Cost</p>
                  <p className="text-2xl font-bold text-blue-900">
                    ${costAnalysis.costs.totalWeeklyCost.toLocaleString()}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Total Spent</p>
                  <p className="text-2xl font-bold text-green-900">
                    ${costAnalysis.costs.totalSpent.toLocaleString()}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600 font-medium">Remaining Budget</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    ${costAnalysis.costs.budgetRemaining.toLocaleString()}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </div>

            <CostCalculationTooltip
              projectedTotalCost={costAnalysis.budget.projectedTotalCost}
              totalWeeklyCost={costAnalysis.costs.totalWeeklyCost}
              totalWeeks={costAnalysis.project.totalWeeks}
              resources={costAnalysis.resources}
            >
              <div className="bg-purple-50 rounded-lg p-4 cursor-help">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Projected Total</p>
                    <p className="text-2xl font-bold text-purple-900">
                      ${costAnalysis.budget.projectedTotalCost.toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-400" />
                </div>
              </div>
            </CostCalculationTooltip>
          </div>

          {/* Resource Cost Breakdown */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Resource Cost Breakdown</h3>
            <div className="space-y-3">
              {costAnalysis.resources.map((resource) => (
                <div key={resource.userId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResourceSelect(resource);
                        }}
                        className="font-medium text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
                      >
                        {resource.name}
                      </button>
                      <p className="text-sm text-gray-600">{resource.role} • {resource.allocationPercentage}% allocation</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${resource.weeklyCost.toLocaleString()}/week</p>
                    <p className="text-sm text-gray-600">${resource.hourlyRate}/hour × {resource.hoursPerWeek * (resource.allocationPercentage / 100)}h</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Budget Variance */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Budget Variance</h4>
                <p className="text-sm text-gray-600">
                  {costAnalysis.budget.budgetVariancePercentage > 0 ? 'Under budget by' : 'Over budget by'} {Math.abs(costAnalysis.budget.budgetVariancePercentage).toFixed(1)}%
                </p>
              </div>
              <div className={`text-2xl font-bold ${costAnalysis.budget.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                ${Math.abs(costAnalysis.budget.budgetVariance).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">Project Backlog</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <button
                  onClick={() => setFilterType(filterType === 'epic' ? 'all' : 'epic')}
                  className={`px-2 py-1 rounded-lg transition-colors hover:shadow-sm cursor-pointer ${
                    filterType === 'epic' 
                      ? 'bg-purple-200 text-purple-900 shadow-sm' 
                      : 'bg-purple-100 text-purple-800 hover:bg-purple-150'
                  }`}
                >
                  {typeStats.epics} Epics
                </button>
                <button
                  onClick={() => setFilterType(filterType === 'feature' ? 'all' : 'feature')}
                  className={`px-2 py-1 rounded-lg transition-colors hover:shadow-sm cursor-pointer ${
                    filterType === 'feature' 
                      ? 'bg-blue-200 text-blue-900 shadow-sm' 
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-150'
                  }`}
                >
                  {typeStats.features} Features
                </button>
                <button
                  onClick={() => setFilterType(filterType === 'story' ? 'all' : 'story')}
                  className={`px-2 py-1 rounded-lg transition-colors hover:shadow-sm cursor-pointer ${
                    filterType === 'story' 
                      ? 'bg-green-200 text-green-900 shadow-sm' 
                      : 'bg-green-100 text-green-800 hover:bg-green-150'
                  }`}
                >
                  {typeStats.stories} Stories
                </button>
              </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'kanban'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Kanban Board
              </button>
               <button
                onClick={() => setViewMode('gantt')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'gantt'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Gantt View
              </button>
              <button
                onClick={() => setViewMode('hierarchy')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'hierarchy'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Hierarchy View
              </button>
              <button
                onClick={() => setViewMode('sprint')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'sprint'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Sprint View
              </button>
              <button
                onClick={() => setViewMode('program-increment')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'program-increment'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Program Increment
              </button>              
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search backlog..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Types</option>
              <option value="epic">Epics</option>
              <option value="feature">Features</option>
              <option value="story">Stories</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Status</option>
              <option value="backlog">Backlog</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>

            <select
              value={filterSprint}
              onChange={(e) => setFilterSprint(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-blue-50 border-blue-300"
            >
              <option value="all">All Sprints</option>
              {sprintData.map(sprint => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Content */}
        {viewMode === 'kanban' ? (
          /* Kanban Board */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {kanbanColumns.map(column => (
              <div
                key={column.id}
                className={`rounded-lg border-2 border-dashed p-4 min-h-[600px] transition-all duration-200 ${
                  dragOverColumn === column.id 
                    ? `${column.color} border-blue-400 bg-blue-100 scale-105` 
                    : column.color
                }`}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnter(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{column.title}</h3>
                  <span className="bg-white text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                    {getItemsByStatus(column.id).length}
                  </span>
                </div>

                <div className="space-y-3">
                  {getItemsByStatus(column.id).map(item => renderBacklogItem(item, 0))}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'hierarchy' ? (
          /* Hierarchy View */
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Project Hierarchy</h3>
              <p className="text-gray-600 text-sm">
                View the complete Epic → Feature → Story breakdown for this project
              </p>
            </div>
            {renderHierarchyView()}
          </div>
        ) : viewMode === 'sprint' ? (
          /* Sprint View */
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Sprint View</h3>
                <button
                  onClick={() => setShowSprintModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Sprint
                </button>
              </div>
              <p className="text-gray-600 text-sm">
                Track sprint progress with stories only. Epics and features are managed in the Hierarchy View.
              </p>
            </div>
            {renderSprintView()}
          </div>
        ) : viewMode === 'gantt' ? (
          /* Gantt View */
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Gantt View</h3>
              <p className="text-gray-600 text-sm">
                Visualize project timeline with resource allocation and sprint planning.
              </p>
            </div>
            <GanttView 
              project={currentProject}
              companyId={companyId}
              onStoryUpdate={onStoryUpdate}
            />
          </div>
        ) : (
          /* Program Increment View */
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Program Increment View</h3>
              <p className="text-gray-600 text-sm">
                Plan and track Program Increments with objectives and capacity planning.
              </p>
            </div>
            {renderProgramIncrementView()}
          </div>
        )}
      </div>

     {currentProject.id && (
  <AddBacklogItemModal
    isOpen={showAddItemModal}
    onClose={() => setShowAddItemModal(false)}
    onSubmit={handleAddBacklogItem}
    projectId={currentProject.id}
    assignedResources={assignedResources}
    allBacklogItems={backlogItems}
    companyId={companyId}
  />
)}

{project.id && (
  <CreateSprintModal
    isOpen={showSprintModal}
    onClose={() => setShowSprintModal(false)}
    projectId={currentProject.id}
    onSprintCreated={() => {
      // Refresh sprint data and backlog items
      fetchSprintData();
      fetchBacklogItems();
    }}
  />
)}

{project.id && (
  <CreateProgramIncrementModal
    isOpen={showCreatePIModal}
    onClose={() => setShowCreatePIModal(false)}
    projectId={currentProject.id}
    onSuccess={() => {
      // Refresh program increments data
      fetchProgramIncrements();
    }}
  />
)}

{project.id && editingPI && (
  <CreateProgramIncrementModal
    isOpen={showEditPIModal}
    onClose={() => {
      setShowEditPIModal(false);
      setEditingPI(null);
    }}
    projectId={currentProject.id}
    editingPI={editingPI}
    onSuccess={() => {
      // Refresh program increments data
      fetchProgramIncrements();
      setEditingPI(null);
    }}
  />
)}

{/* Delete PI Confirmation Modal */}
{showDeletePIModal && deletingPI && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl max-w-md w-full">
      <div className="p-6">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Program Increment</h3>
            <p className="text-sm text-gray-600">This action cannot be undone</p>
          </div>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700">
            Are you sure you want to delete <span className="font-semibold">"{deletingPI.name}"</span>?
          </p>
          <p className="text-sm text-gray-500 mt-2">
            This will permanently delete the Program Increment and all its objectives.
          </p>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={() => {
              setShowDeletePIModal(false);
              setDeletingPI(null);
            }}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirmDeletePI}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </>
            ) : (
              'Delete Program Increment'
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}



      {selectedEpic && (
        <EpicManagementModal
          isOpen={showEpicModal}
          onClose={() => {
            setShowEpicModal(false);
            setSelectedEpic(null);
             setEpicEditMode(null);
             setEditingItem(null);
          }}
          epic={selectedEpic}
          onUpdateEpic={handleUpdateEpic}
          onAddFeature={handleAddFeature}
          onRemoveFeature={handleRemoveFeature}
           onEditEpic={handleUpdateEpicInModal}
           onEditFeature={handleUpdateFeatureInEpic}
          project_id={currentProject.id}
          assignedResources={assignedResources}
          onRefresh={fetchBacklogItems}
           editMode={epicEditMode}
           editingItem={editingItem}
           setEditMode={setEpicEditMode}
           setEditingItem={setEditingItem}
        />
      )}

      {selectedFeature && (
        <FeatureManagementModal
          isOpen={showFeatureModal}
          onClose={() => {
            setShowFeatureModal(false);
            setSelectedFeature(null);
          }}
          feature={selectedFeature}
          onUpdateFeature={handleUpdateFeature}
          onAddStory={handleAddStory}
          onRemoveStory={handleRemoveStory}
          onEditFeature={handleEditItem}
          onEditStory={handleEditItem}
          assignedResources={assignedResources}
        />
      )}

      {selectedStory && (
        <StoryDetailModal
          isOpen={showStoryModal}
          onClose={() => {
            setShowStoryModal(false);
            setSelectedStory(null);
          }}
          story={selectedStory}
          onUpdateStory={handleUpdateStory}
          assignedResources={assignedResources}
          companyId={companyId}
          projectId={currentProject.id}
        />
      )}

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        itemType={itemToDelete?.type || 'story'}
        itemTitle={itemToDelete?.title || ''}
        isDeleting={isDeleting}
      />

      {itemToEdit && (
        <AddBacklogItemModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setItemToEdit(null);
          }}
          onSubmit={async () => {}} // Not used in edit mode
          onUpdate={handleUpdateItem}
          projectId={currentProject.id}
          editItem={itemToEdit}
          assignedResources={assignedResources}
          allBacklogItems={backlogItems}
          companyId={companyId}
        />
      )}

      <NewProjectModal
        isOpen={showEditProjectModal}
        onClose={() => setShowEditProjectModal(false)}
        onSubmit={async (updatedProject) => {
          // Handle project update - refresh all data         
          setShowEditProjectModal(false);
          
          // Refresh local data
          await refreshAllData();
          
          // Refresh parent project data
          if (onProjectUpdate) {
            onProjectUpdate();
          }
          
          showSuccess('Project updated successfully!');
        }}
        onRefresh={async () => {
          // Refresh project data
          await refreshAllData();
          
          // Refresh parent project data
          if (onProjectUpdate) {
            onProjectUpdate();
          }
        }}
        companyId={companyId}
        companyResources={companyResources}
        loadingResources={loadingCompanyResources}
        editingProject={currentProject}
        isEditMode={true}
      />

      {/* ResourceEditModal */}
      {showResourceEditModal && selectedResource && (
        <ResourceEditModal
          isOpen={showResourceEditModal}
          onClose={() => {
            setShowResourceEditModal(false);
            setSelectedResource(null);
          }}
          resource={selectedResource}
          onSave={handleResourceSave}
          companyId={companyId || undefined}
          companyRoles={companyRoles}
        />
      )}

      {/* Save as Template Preview Modal */}
      <SaveAsTemplatePreviewModal
        isOpen={showSaveAsTemplateModal}
        onClose={() => {
          setShowSaveAsTemplateModal(false);
          setTemplatePreviewData(null);
        }}
        onConfirm={handleConfirmSaveTemplate}
        templateData={templatePreviewData}
        isLoading={isSavingTemplate}
      />

      {/* Story Hover Tooltip */}
      {hoveredStory && (
        <StoryHoverTooltip
          storyId={hoveredStory}
          assigneeId={backlogItems.find(item => item.id === hoveredStory)?.assigneeId}
          assigneeDetails={backlogItems.find(item => item.id === hoveredStory)?.assigneeDetails}
          isVisible={!!hoveredStory}
          position={hoverPosition}
        />
      )}
    </div>
  );
}