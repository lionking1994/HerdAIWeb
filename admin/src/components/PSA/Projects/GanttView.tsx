import React, { useState, useEffect } from 'react';
import { Users, Move, Star, FileText } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import { Project, Resource } from '../Dashboard/types';
import api from '../../../lib/api';

interface GanttViewProps {
  project: Project;
  companyId: string;
  onStoryUpdate?: () => void;
}

interface WorkItem {
  id: string;
  title: string;
  description: string;
  type: 'epic' | 'feature' | 'story';
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints?: number;
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
  requiredSkills?: string[];
  parentId?: string;
  parentName?: string;
  children?: WorkItem[];
  businessValue?: number;
  sprintId?: string | null;
  startDate?: string;
  endDate?: string;
  clientName?: string;
  clientId?: string;
}

interface Sprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  goal?: string;
  velocity?: number;
  commitment?: number;
  efficiency?: number;
}

interface ProgramIncrement {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  duration_weeks: number;
  pi_capacity: number;
  current_commitment: number;
}

export default function GanttView({ project, companyId, onStoryUpdate }: GanttViewProps) {
  const { showSuccess, showError } = useToast();
  
  // State management
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [programIncrements, setProgramIncrements] = useState<ProgramIncrement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View controls
  const [viewType, setViewType] = useState<'all' | 'epic' | 'feature' | 'story'>('all');
  const [timeScale, setTimeScale] = useState<'monthly' | 'sprint' | 'pi'>('monthly');
  
  // Drag and drop
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedResource, setDraggedResource] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverResource, setDragOverResource] = useState<string | null>(null);
  const [dragOverStory, setDragOverStory] = useState<string | null>(null);
  
  // Hover states
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredResource, setHoveredResource] = useState<string | null>(null);
  
  // Selected story for resource matching and client highlighting
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  
  // Month navigation state
  const [currentViewMonth, setCurrentViewMonth] = useState<Date>(new Date());

  // Fetch all data
  useEffect(() => {
    fetchGanttData();
  }, [project.id, companyId]);


  const fetchGanttData = async () => {
    try {
      setLoading(true);
      
      const [workItemsRes, resourcesRes, sprintsRes, piRes] = await Promise.all([
        fetchWorkItems(),
        fetchResources(),
        fetchSprints(),
        fetchProgramIncrements()
      ]);

      setWorkItems(workItemsRes);
      setResources(resourcesRes);
      setSprints(sprintsRes);
      setProgramIncrements(piRes);
      
    } catch (error) {
      console.error('Error fetching Gantt data:', error);
      showError('Failed to load Gantt view data');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkItems = async (): Promise<WorkItem[]> => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/${project.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const workItems = data.data.all.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            type: item.type,
            status: item.status || 'backlog',
            priority: item.priority || 'medium',
            storyPoints: (() => {
              const points = item.story_points;
              if (typeof points === 'string') {
                // Remove any non-numeric characters and convert to number
                const numericValue = parseFloat(points.replace(/[^\d.]/g, ''));
                return isNaN(numericValue) ? (item.type === 'epic' ? undefined : 1) : numericValue;
              }
              return points || (item.type === 'epic' ? undefined : 1);
            })(),
            assigneeId: item.assignee_id || '',
            assigneeDetails: item.assignee_details || null,
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
            sprintId: item.sprint_id || null,
            businessValue: item.business_value || undefined,
            clientName: project.client?.name || 'No Client',
            clientId: project.client?.id || null,
            children: []
          }));          
        
          return workItems;
        }
      }
      return [];
    } catch (error) {
      console.error('Error fetching work items:', error);
      return [];
    }
  };

  const fetchResources = async (): Promise<Resource[]> => {
    try {
      const response = await api.get(`/psa/resources?companyId=${companyId}`);
      if (response.data.success) {
        return response.data.resources.map((apiResource: any) => {
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
            location: resource?.location || '',
            department: resource?.department?.name || '',
            departmentId: resource?.department?.id || null,
            performanceRating: parseFloat(resource?.performance_rating) || 0,
            isActive: resource?.is_active !== false,
            hireDate: resource?.hire_date || '',
            totalProjectHours: resource?.total_project_hours || 0,
            successfulProjects: resource?.successful_projects || 0,
            activeProjects: [],
            resource: resource
          };
        });
      }
      return [];
    } catch (error) {
      console.error('Error fetching resources:', error);
      return [];
    }
  };

  const fetchSprints = async (): Promise<Sprint[]> => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/sprints/${project.id}`,
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
          return data.sprints || [];
        }
      }
      return [];
    } catch (error) {
      console.error('Error fetching sprints:', error);
      return [];
    }
  };

  const fetchProgramIncrements = async (): Promise<ProgramIncrement[]> => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/program-increments/${project.id}`,
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
          return data.programIncrements || [];
        }
      }
      return [];
    } catch (error) {
      console.error('Error fetching program increments:', error);
      return [];
    }
  };

  // Calculate skill match percentage
  const calculateSkillMatch = (storySkills: string[], resourceSkills: any[]): number => {
    if (!storySkills || storySkills.length === 0) return 0;
    
    const resourceSkillNames = resourceSkills.map(s => s.skill.name);
    const matches = storySkills.filter(skill => resourceSkillNames.includes(skill));
    return Math.round((matches.length / storySkills.length) * 100);
  };

  // Get skill match for selected story
  const getSkillMatchForStory = (storyId: string, resourceSkills: any[]): number => {
    const story = workItems.find(item => item.id === storyId);
    if (!story || !story.requiredSkills) return 0;
    return calculateSkillMatch(story.requiredSkills, resourceSkills);
  };

  // Calculate skill match percentage for a specific resource and story
  const getSkillMatchPercentage = (resourceId: string, storyId: string): number => {
    const resource = resources.find(r => r.id === resourceId);
    const story = workItems.find(s => s.id === storyId);
    
    if (!resource || !story || !story.requiredSkills || story.requiredSkills.length === 0) {
      return 0;
    }
    
    const resourceSkills = resource.skills.map(skill => skill.skill.name.toLowerCase());
    const storySkills = story.requiredSkills.map(skill => skill.toLowerCase());
    
    const matchingSkills = storySkills.filter(storySkill => 
      resourceSkills.some(resourceSkill => 
        resourceSkill.includes(storySkill) || storySkill.includes(resourceSkill)
      )
    );
    
    return Math.round((matchingSkills.length / storySkills.length) * 100);
  };

  // Get matching skills between resource and story
  const getMatchingSkills = (resourceId: string, storyId: string): string[] => {
    const resource = resources.find(r => r.id === resourceId);
    const story = workItems.find(s => s.id === storyId);
    
    if (!resource || !story || !story.requiredSkills || story.requiredSkills.length === 0) {
      return [];
    }
    
    const resourceSkills = resource.skills.map(skill => skill.skill.name);
    const storySkills = story.requiredSkills;
    
    return storySkills.filter(storySkill => 
      resourceSkills.some(resourceSkill => 
        resourceSkill.toLowerCase().includes(storySkill.toLowerCase()) || 
        storySkill.toLowerCase().includes(resourceSkill.toLowerCase())
      )
    );
  };

  // Check if resource profile is complete (has skills)
  const isResourceProfileComplete = (resource: Resource): boolean => {
    return resource.skills && resource.skills.length > 0;
  };

  // Check if resource is assigned to selected story
  const isResourceAssignedToSelectedStory = (resourceId: string): boolean => {
    if (!selectedStory) return false;
    const story = workItems.find(item => item.id === selectedStory);
    const resource = resources.find(r => r.id === resourceId);
    
    // Check by ID first
    const isAssignedById = String(story?.assigneeId) === String(resourceId);
    
    // Check by name as fallback (in case assignment is done by name)
    const isAssignedByName = story?.assigneeDetails?.name === resource?.user.name;
    
    return isAssignedById || isAssignedByName;
  };

  // Get assigned and available resources
  const getAssignedResources = () => {
    return resources.filter(resource => 
      project.resources.some(projectResource => projectResource.id === resource.id)
    );
  };

  // Check if resource has any matching skills with project stories
  const hasMatchingSkillsWithProject = (resource: Resource): boolean => {
    // Get all stories from the project
    const projectStories = workItems.filter(item => item.type === 'story');
    
    if (projectStories.length === 0) return true; // If no stories, show all resources
    
    // Check if resource has at least one skill that matches any story
    return projectStories.some(story => {
      if (!story.requiredSkills || story.requiredSkills.length === 0) return true;
      
      const resourceSkills = resource.skills.map(skill => skill.skill.name.toLowerCase());
      const storySkills = story.requiredSkills.map(skill => skill.toLowerCase());
      
      return storySkills.some(storySkill => 
        resourceSkills.some(resourceSkill => 
          resourceSkill.includes(storySkill) || storySkill.includes(resourceSkill)
        )
      );
    });
  };

  const getAvailableResources = () => {
    const assignedIds = project.resources.map(r => r.id);
    const availableResources = resources.filter(resource => {
      // Must not be assigned to project
      const notAssigned = !assignedIds.includes(resource.id);
      
      // Must have complete profile (has skills)
      const hasCompleteProfile = resource.skills && resource.skills.length > 0;
      
      // Must have at least one skill matching project stories
      const hasMatchingSkills = hasMatchingSkillsWithProject(resource);
      
      return notAssigned && hasCompleteProfile && hasMatchingSkills;
    });
    
    // Debug logging   
    
    return availableResources;
  };

  // Filter work items based on view type
  const getFilteredWorkItems = () => {
    if (viewType === 'all') return workItems;
    return workItems.filter(item => item.type === viewType);
  };

  // Build hierarchy
  const buildHierarchy = (items: WorkItem[]): WorkItem[] => {
    const itemMap = new Map<string, WorkItem>();
    const rootItems: WorkItem[] = [];

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

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId);
    setDraggedItem(itemId);
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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, sprintId: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');

    setDraggedItem(null);
    setDragOverColumn(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/item/${itemId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            sprint_id: sprintId === 'backlog' ? null : sprintId
          }),
        }
      );

      if (response.ok) {
        showSuccess('Story moved successfully');
        await fetchGanttData();
        if (onStoryUpdate) onStoryUpdate();
      } else {
        showError('Failed to move story');
      }
    } catch (error) {
      console.error('Error moving story:', error);
      showError('Failed to move story');
    }
  };

  // Resource drag handlers
  const handleResourceDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleResourceDragEnter = (e: React.DragEvent, resourceId: string) => {
    e.preventDefault();
    setDragOverResource(resourceId);
  };

  const handleResourceDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverResource(null);
    }
  };

  const handleResourceDrop = async (e: React.DragEvent, resourceId: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');

    setDraggedItem(null);
    setDragOverResource(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/item/${itemId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            assignee_id: resourceId
          }),
        }
      );

      if (response.ok) {
        showSuccess('Story assigned to resource successfully');
        await fetchGanttData();
        if (onStoryUpdate) onStoryUpdate();
      } else {
        showError('Failed to assign story to resource');
      }
    } catch (error) {
      console.error('Error assigning story to resource:', error);
      showError('Failed to assign story to resource');
    }
  };

  // Resource drag start handler
  const handleResourceDragStart = (e: React.DragEvent, resourceId: string) => {
    e.dataTransfer.setData('text/plain', resourceId);
    e.dataTransfer.setData('application/resource', 'true'); // Mark as resource drag
    setDraggedResource(resourceId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Resource drag end handler - clears drag state when drag ends anywhere
  const handleResourceDragEnd = () => {
    setDraggedResource(null);
  };

  // Story drag handlers for resource assignment
  const handleStoryDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleStoryDragEnter = (e: React.DragEvent, storyId: string) => {
    e.preventDefault();
    setDragOverStory(storyId);
  };

  const handleStoryDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverStory(null);
    }
  };

  const handleStoryDrop = async (e: React.DragEvent, storyId: string) => {
    e.preventDefault();
    const resourceId = e.dataTransfer.getData('text/plain');
    const isResourceDrag = e.dataTransfer.getData('application/resource') === 'true';

    setDragOverStory(null);

    // Only proceed if it's a resource drag
    if (!isResourceDrag) return;

    // Additional check: ensure we're dropping on a story
    const story = workItems.find(item => item.id === storyId);
    if (!story || story.type !== 'story') {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/psa/backlog/item/${storyId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            assignee_id: resourceId
          }),
        }
      );

      if (response.ok) {
        const resource = resources.find(r => r.id === resourceId);
        const story = workItems.find(item => item.id === storyId);
        showSuccess(`Resource ${resource?.user.name} assigned to story "${story?.title}" successfully`);
        await fetchGanttData();
        if (onStoryUpdate) onStoryUpdate();
      } else {
        showError('Failed to assign resource to story');
      }
    } catch (error) {
      console.error('Error assigning resource to story:', error);
      showError('Failed to assign resource to story');
    }
  };

  // Get work items for a specific time period (month or PI)
  const getWorkItemsForPeriod = (periodId: string, periodType: 'month' | 'pi') => {
    const period = getTimelineColumns().find(col => col.id === periodId);
    if (!period) return [];

    const filteredItems = workItems.filter(item => {
      if (periodType === 'month') {
        // For monthly view, check if item's sprint falls within this month
        if (item.sprintId) {
          const itemSprint = sprints.find(s => s.id === item.sprintId);
          if (itemSprint) {
            const sprintStart = new Date(itemSprint.start_date);
            const sprintEnd = new Date(itemSprint.end_date);
            const monthStart = new Date(period.startDate);
            const monthEnd = new Date(period.endDate);
            
            // Check if sprint overlaps with this month
            const overlaps = sprintStart <= monthEnd && sprintEnd >= monthStart;           
            return overlaps;
          }
        }
        return false;
      } else if (periodType === 'pi') {
        // For PI view, check if item's sprint belongs to this PI
        if (item.sprintId) {
          const itemSprint = sprints.find(s => s.id === item.sprintId);
          if (itemSprint) {
            const piStart = new Date(period.startDate);
            const piEnd = new Date(period.endDate);
            const sprintStart = new Date(itemSprint.start_date);
            const sprintEnd = new Date(itemSprint.end_date);
            
            return sprintStart <= piEnd && sprintEnd >= piStart;
          }
        }
        return false;
      }
      return false;
    });
    
    return filteredItems;
  };

  // Get timeline columns based on time scale
  const getTimelineColumns = () => {
    switch (timeScale) {
      case 'sprint':
        return sprints.map(sprint => ({
          id: sprint.id,
          name: sprint.name,
          startDate: sprint.start_date,
          endDate: sprint.end_date,
          type: 'sprint'
        }));
      case 'pi':
        return programIncrements.map(pi => ({
          id: pi.id,
          name: pi.name,
          startDate: pi.start_date,
          endDate: pi.end_date,
          type: 'pi'
        }));
      default: // monthly
        const months = [];
        // Show 3 months: previous month, current month, next month
        const currentMonth = new Date(currentViewMonth);
        const startMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
        const endMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0);
        
        for (let d = new Date(startMonth); d <= endMonth; d.setMonth(d.getMonth() + 1)) {
          months.push({
            id: `month-${d.getFullYear()}-${d.getMonth()}`,
            name: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            startDate: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
            endDate: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString(),
            type: 'month'
          });
        }
        return months;
    }
  };

   // Render work item row
   const renderWorkItemRow = (item: WorkItem, level: number = 0) => {
     // Calculate indentation based on hierarchy level and item type
     let indentClass = '';
     
     // Force stories to have more indentation regardless of hierarchy
     if (item.type === 'story') {
       // Stories should always be more indented than features
       indentClass = 'ml-16'; // Force 16px indent for all stories
     } else if (level === 0) {
       // Root level items (non-stories)
       if (item.type === 'epic') {
         indentClass = ''; // No indentation for epics
       } else if (item.type === 'feature') {
         indentClass = 'ml-8'; // Features indented under epics
       }
     } else {
       // Child items (non-stories) - use level-based indentation
       const levelIndent = level * 8;
       indentClass = levelIndent > 0 ? `ml-${levelIndent}` : '';
     }
    const getTypeIcon = () => {
      switch (item.type) {
        case 'epic': return <Star className="w-4 h-4 text-purple-600" />;
        case 'feature': return <FileText className="w-4 h-4 text-blue-600" />;
        case 'story': return <Users className="w-4 h-4 text-green-600" />;
        default: return <Users className="w-4 h-4 text-gray-600" />;
      }
    };

    const getStatusColor = () => {
      switch (item.status) {
        case 'done': return 'bg-green-200 border-green-300 text-green-800';
        case 'in_progress': return 'bg-blue-200 border-blue-300 text-blue-800';
        case 'review': return 'bg-yellow-200 border-yellow-300 text-yellow-800';
        case 'backlog': return 'bg-gray-200 border-gray-300 text-gray-800';
        default: return 'bg-gray-200 border-gray-300 text-gray-800';
      }
    };
    
    return (
       <div key={item.id} className="border-b border-gray-100">
         <div 
           className={`${indentClass} flex items-center py-2 hover:bg-gray-50 transition-colors ${
             item.type === 'story' ? 'cursor-pointer' : 'cursor-not-allowed'
           } ${
             item.type === 'story' && dragOverStory === item.id ? 'bg-blue-50 border-2 border-dashed border-blue-400' : ''
           }`}
           onClick={() => item.type === 'story' ? setSelectedStory(item.id) : undefined}
           onMouseEnter={() => setHoveredItem(item.id)}
           onMouseLeave={() => setHoveredItem(null)}
           onDragOver={item.type === 'story' ? handleStoryDragOver : undefined}
           onDragEnter={item.type === 'story' ? (e) => handleStoryDragEnter(e, item.id) : undefined}
           onDragLeave={item.type === 'story' ? handleStoryDragLeave : undefined}
           onDrop={item.type === 'story' ? (e) => handleStoryDrop(e, item.id) : undefined}
         >
         <div className="w-80 flex items-center">
           <div className="mr-2">{getTypeIcon()}</div>
           <div className="flex-1">
             <h4 className="font-medium text-gray-900 text-xs">{item.title}</h4>
             <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
            <div className="flex items-center mt-1 space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                item.type === 'epic' ? 'bg-purple-100 text-purple-800' :
                item.type === 'feature' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }`}>
                {item.type}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                item.priority === 'critical' ? 'bg-red-100 text-red-800' :
                item.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {item.priority}
              </span>
               {item.assigneeDetails && (
                 <span 
                   className={`px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 transition-colors ${
                     item.type === 'story' ? 'cursor-pointer hover:bg-indigo-200' : 'cursor-not-allowed'
                   }`}
                   onClick={() => item.type === 'story' ? setSelectedStory(item.id) : undefined}
                   title={item.type === 'story' ? "Click to highlight matching resources" : "Only stories can be selected"}
                 >
                   {item.assigneeDetails.name}
                 </span>
               )}
              {selectedResource && item.type === 'story' && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  getSkillMatchPercentage(selectedResource, item.id) >= 80 ? 'bg-green-100 text-green-800' :
                  getSkillMatchPercentage(selectedResource, item.id) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {getSkillMatchPercentage(selectedResource, item.id)}% match
                </span>
              )}
            </div>
          </div>
          {item.storyPoints && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded ml-2">
              {item.storyPoints} pts
            </span>
          )}
        </div>
        
        {/* Timeline bars */}
        <div className="flex-1 flex items-center h-10 relative">
          {getTimelineColumns().map(column => {
            const isInColumn = item.sprintId === column.id || 
              (timeScale === 'monthly' && item.sprintId &&
               sprints.find(s => s.id === item.sprintId && 
                 new Date(s.start_date) <= new Date(column.endDate) &&
                 new Date(s.end_date) >= new Date(column.startDate)));
            
            // Remove ALL vertical partitions from main timeline area
            const shouldShowBorder = false;
            
            // For Monthly and PI views, show tiles instead of individual bars
            const shouldShowTile = (timeScale === 'monthly' || timeScale === 'pi') && 
              ((timeScale === 'monthly' && item.sprintId && 
                sprints.find(s => s.id === item.sprintId && 
                  new Date(s.start_date) <= new Date(column.endDate) &&
                  new Date(s.end_date) >= new Date(column.startDate))) ||
               (timeScale === 'pi' && item.sprintId && 
                sprints.find(s => s.id === item.sprintId && 
                  new Date(s.start_date) <= new Date(column.endDate) &&
                  new Date(s.end_date) >= new Date(column.startDate))));
            
            return (
              <div
                key={column.id}
                className={`flex-1 h-full relative group ${shouldShowBorder ? 'border-r border-gray-200' : ''}`}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnter(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {dragOverColumn === column.id && (
                  <div className="absolute inset-0 bg-blue-100 border-2 border-dashed border-blue-400 rounded"></div>
                )}
                
                 {/* Show tiles for Monthly and PI views */}
                 {shouldShowTile && (
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className={`w-full h-8 rounded ${getStatusColor()} flex items-center justify-center text-xs font-medium text-gray-700 shadow-sm border transition-all ${
                       item.type === 'story' ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed'
                     }`}
                          onClick={() => item.type === 'story' ? setSelectedStory(item.id) : undefined}
                          onMouseEnter={() => setHoveredItem(item.id)}
                          onMouseLeave={() => setHoveredItem(null)}>
                       <span className="truncate px-2">
                         {item.title.length > 15 ? item.title.substring(0, 15) + '...' : item.title}
                       </span>
                     </div>
                   </div>
                 )}
                
                {/* Show individual bars for Sprint view */}
                {timeScale === 'sprint' && isInColumn && (
                  <div
                    draggable={item.type === 'story'}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    className={`absolute top-1 left-1 right-1 h-8 rounded cursor-pointer transition-all shadow-sm border ${getStatusColor()} ${draggedItem === item.id ? 'opacity-50 scale-95' : 'hover:shadow-md'}`}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div className="flex items-center justify-center h-full text-xs font-medium text-gray-700 px-2">
                      {item.type === 'story' && <Move className="w-3 h-3 mr-1" />}
                      <span className="truncate">
                        {item.title.length > 12 ? item.title.substring(0, 12) + '...' : item.title}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
         </div>
       </div>
    );
  };

  // Render resource card
  const renderResourceCard = (resource: Resource, isAssigned: boolean = false) => {
    const skillMatch = selectedStory ? 
      getSkillMatchForStory(selectedStory, resource.skills) : 0;
    const isAssignedToSelectedStory = isResourceAssignedToSelectedStory(resource.id);
    const isProfileComplete = isResourceProfileComplete(resource);
    const isDraggable = isProfileComplete;

    return (
      <div
        key={resource.id}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleResourceDragStart(e, resource.id) : undefined}
        onDragEnd={isDraggable ? handleResourceDragEnd : undefined}
         className={`flex items-center p-1 rounded-md border transition-all ${
          isDraggable ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
        } ${
          isAssigned 
            ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
        } ${hoveredResource === resource.id ? 'ring-1 ring-blue-400' : ''} ${
          selectedStory && skillMatch >= 50 ? 'ring-1 ring-green-400 bg-green-50' : ''
        } ${dragOverResource === resource.id ? 'ring-1 ring-purple-400 bg-purple-50' : ''} ${
          isAssignedToSelectedStory ? 'ring-1 ring-orange-400 bg-orange-50' : ''
        } ${selectedResource === resource.id ? 'ring-1 ring-indigo-400 bg-indigo-50' : ''} ${
          draggedResource === resource.id ? 'opacity-50 scale-95' : ''
        }`}
        onMouseEnter={() => setHoveredResource(resource.id)}
        onMouseLeave={() => setHoveredResource(null)}
        onClick={() => {
          if (selectedResource === resource.id) {
            setSelectedResource(null); // Deselect if already selected
          } else {
            setSelectedResource(resource.id); // Select this resource
          }
        }}
        onDragOver={isDraggable ? handleResourceDragOver : undefined}
        onDragEnter={isDraggable ? (e) => handleResourceDragEnter(e, resource.id) : undefined}
        onDragLeave={isDraggable ? handleResourceDragLeave : undefined}
        onDrop={isDraggable ? (e) => handleResourceDrop(e, resource.id) : undefined}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
          {resource.user.avatar ? (
            <img 
              src={resource.user.avatar} 
              alt={resource.user.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to initial letter if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-sm">${resource.user.name.charAt(0).toUpperCase()}</div>`;
                }
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
              {resource.user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="ml-2 flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-xs truncate">{resource.user.name}</h4>
          <p className="text-xs text-gray-500 truncate">{resource.department}</p>
          {selectedStory && skillMatch > 0 && (
            <div className="mt-1">
              <div className="text-xs text-green-600 font-medium">
                {skillMatch}% match
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                <div 
                  className="bg-green-600 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${skillMatch}%` }}
                ></div>
              </div>
              {/* Show matching skills */}
              {getMatchingSkills(resource.id, selectedStory).length > 0 && (
                <div className="mt-1">
                  <div className="text-xs text-gray-500 mb-1">Skills:</div>
                  <div className="flex flex-wrap gap-1">
                    {getMatchingSkills(resource.id, selectedStory).slice(0, 2).map((skill, index) => (
                      <span 
                        key={index}
                        className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                    {getMatchingSkills(resource.id, selectedStory).length > 2 && (
                      <span className="text-xs text-gray-500">+{getMatchingSkills(resource.id, selectedStory).length - 2}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-gray-900">{resource.availability}%</div>
          <div className="text-xs text-gray-500">avail</div>
          {isAssigned && (
            <div className="text-xs text-blue-600 font-medium">Assigned</div>
          )}
          {selectedStory && skillMatch >= 50 && (
            <div className="text-xs text-green-600 font-medium">Good Match</div>
          )}
          {isAssignedToSelectedStory && (
            <div className="text-xs text-orange-600 font-medium">Assigned</div>
          )}
          {!isProfileComplete && (
            <div className="text-xs text-red-600 font-medium">Incomplete</div>
          )}
          {dragOverResource === resource.id && (
            <div className="text-xs text-purple-600 font-medium">Drop here</div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading Gantt View...</span>
      </div>
    );
  }

  const assignedResources = getAssignedResources();
  const availableResources = getAvailableResources();
  const filteredWorkItems = getFilteredWorkItems();
  const hierarchicalItems = buildHierarchy(filteredWorkItems);
  const timelineColumns = getTimelineColumns();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Agile Gantt Chart</h2>
          <p className="text-sm text-gray-600">{project.name}</p>
        </div>
        
        {/* Filters */}
        <div className="flex items-center space-x-4">
          <select
            value={viewType}
            onChange={(e) => setViewType(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">All Items</option>
            <option value="epic">Epics</option>
            <option value="feature">Features</option>
            <option value="story">Stories</option>
          </select>
          
           <div className="flex bg-gray-100 rounded-lg p-1">
             <button
               onClick={() => setTimeScale('monthly')}
               className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                 timeScale === 'monthly' 
                   ? 'bg-white text-gray-900 shadow-sm' 
                   : 'text-gray-600 hover:text-gray-900'
               }`}
             >
               Monthly
             </button>
             <button
               onClick={() => setTimeScale('sprint')}
               className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                 timeScale === 'sprint' 
                   ? 'bg-white text-gray-900 shadow-sm' 
                   : 'text-gray-600 hover:text-gray-900'
               }`}
             >
               Sprint
             </button>
             <button
               onClick={() => setTimeScale('pi')}
               className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                 timeScale === 'pi' 
                   ? 'bg-white text-gray-900 shadow-sm' 
                   : 'text-gray-600 hover:text-gray-900'
               }`}
             >
               PI
             </button>
           </div>
          
          {/* Month Navigation Controls - Only show for Monthly view */}
          {timeScale === 'monthly' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  const newMonth = new Date(currentViewMonth);
                  newMonth.setMonth(newMonth.getMonth() - 1);
                  setCurrentViewMonth(newMonth);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                title="Previous Month"
              >
                ←
              </button>
              <span className="px-3 py-2 text-sm font-medium text-gray-700 min-w-[120px] text-center">
                {currentViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => {
                  const newMonth = new Date(currentViewMonth);
                  newMonth.setMonth(newMonth.getMonth() + 1);
                  setCurrentViewMonth(newMonth);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                title="Next Month"
              >
                →
              </button>
              <button
                onClick={() => setCurrentViewMonth(new Date())}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                title="Current Month"
              >
                Today
              </button>
            </div>
          )}
        </div>
      </div>

       {/* Resource Section */}
       <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
         <div className="flex items-center mb-2">
           <Users className="w-4 h-4 text-blue-600 mr-2" />
           <h3 className="text-base font-semibold text-gray-900">Resources</h3>
         </div>
         <p className="text-xs text-gray-600 mb-2">
           Click a story to highlight matching resources, drag stories to assign resources, or drag resources to assign stories.
           {selectedStory && (
             <button
               onClick={() => setSelectedStory(null)}
               className="ml-2 text-blue-600 hover:text-blue-800 text-xs underline"
             >
               Clear selection
             </button>
           )}
         </p>
         {selectedResource && (
           <div className="mb-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
             <p className="text-xs text-indigo-800">
               Showing skill matches for {resources.find(r => r.id === selectedResource)?.user.name}. 
               <button
                 onClick={() => setSelectedResource(null)}
                 className="ml-2 text-indigo-600 hover:text-indigo-800 text-xs underline"
               >
                 Click again to deselect.
               </button>
             </p>
           </div>
         )}
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
           {/* Assigned Resources */}
           <div>
             <h4 className="font-medium text-gray-900 mb-1 text-xs">Project Team</h4>
             <div className="space-y-0.5">
               {assignedResources.map(resource => renderResourceCard(resource, true))}
             </div>
           </div>
           
           {/* Available Resources */}
           <div>
             <h4 className="font-medium text-gray-900 mb-1 text-xs">Available Resources (NOT ON PROJECT)</h4>
             <div className="space-y-0.5">
               {availableResources.map(resource => renderResourceCard(resource, false))}
             </div>
           </div>
         </div>
         
         {/* Required Skills Section */}
         {selectedStory && (
           <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
             <div className="text-xs font-medium text-purple-800 mb-1">
               Required Skills for '{workItems.find(item => item.id === selectedStory)?.title}':
             </div>
             <div className="flex flex-wrap gap-1">
               {workItems.find(item => item.id === selectedStory)?.requiredSkills?.map((skill, index) => (
                 <span 
                   key={index}
                   className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full font-medium"
                 >
                   {skill}
                 </span>
               )) || (
                 <span className="text-xs text-purple-600 italic">No specific skills required</span>
               )}
             </div>
           </div>
         )}
       </div>

       {/* Legend */}
       <div className="bg-white rounded-lg border border-gray-200 p-3 my-0 mb-0">
        <div className="flex items-center space-x-6">
          <h3 className="text-sm font-medium text-gray-700">Status Legend:</h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-200 border border-green-300 rounded"></div>
            <span className="text-xs text-gray-600">Done</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-200 border border-blue-300 rounded"></div>
            <span className="text-xs text-gray-600">In Progress</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-200 border border-yellow-300 rounded"></div>
            <span className="text-xs text-gray-600">Review</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-200 border border-gray-300 rounded"></div>
            <span className="text-xs text-gray-600">Backlog</span>
          </div>
        </div>
      </div>

       {/* Gantt Chart */}
       <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
         {/* Timeline Header */}
         <div className="flex border-b border-gray-200 bg-gray-50">
           <div className="w-80 p-3 border-r border-gray-200">
             <h3 className="font-medium text-gray-900 text-sm">Work Items</h3>
           </div>
           <div className="flex-1 flex">
             {timelineColumns.map(column => {
               // Remove vertical partitions for Sprint and Monthly views
               const shouldShowBorder = timeScale === 'pi';
               
               return (
                 <div key={column.id} className={`flex-1 p-3 text-center ${shouldShowBorder ? 'border-r border-gray-200' : ''}`}>
                   <div className="font-medium text-gray-900 text-xs">{column.name}</div>
                   <div className="text-xs text-gray-500">
                     {new Date(column.startDate).toLocaleDateString()} - {new Date(column.endDate).toLocaleDateString()}
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
        
        {/* Work Items */}
        <div className="max-h-96 overflow-y-auto">
          {hierarchicalItems.map(item => {
            const renderItem = (workItem: WorkItem, level: number = 0) => (
              <React.Fragment key={workItem.id}>
                {renderWorkItemRow(workItem, level)}
                {workItem.children && workItem.children.map(child => renderItem(child, level + 1))}
              </React.Fragment>
            );
            return renderItem(item);
          })}
        </div>
        
         {/* Summary Row for Monthly and PI views */}
         {(timeScale === 'monthly' || timeScale === 'pi') && (
           <div className="border-t border-gray-200 bg-gray-50">
             <div className="flex">
               <div className="w-80 p-3 border-r border-gray-200">
                 <h4 className="font-medium text-gray-900 text-xs">Summary</h4>
               </div>
               <div className="flex-1 flex">
                 {timelineColumns.map(column => {
                   const periodItems = getWorkItemsForPeriod(column.id, timeScale === 'monthly' ? 'month' : 'pi');
                   const totalPoints = periodItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
                   const doneItems = periodItems.filter(item => item.status === 'done').length;
                   const inProgressItems = periodItems.filter(item => item.status === 'in_progress').length;
                   
                   return (
                     <div key={column.id} className="flex-1 p-3 text-center">
                       <div className="text-xs font-medium text-gray-900">
                         {periodItems.length} items
                       </div>
                       <div className="text-xs text-gray-600">
                         {totalPoints} pts
                       </div>
                       <div className="text-xs text-gray-500 mt-1">
                         {doneItems} done, {inProgressItems} in progress
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           </div>
         )}
      </div>

      {/* Hover Tooltip */}
      {hoveredItem && (
        <div className="fixed bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-50 pointer-events-none max-w-sm">
          {(() => {
            const item = workItems.find(i => i.id === hoveredItem);
            if (!item) return null;
            
            return (
              <div>
                <div className="flex items-center mb-2">
                  <div className="mr-2">
                    {item.type === 'epic' ? <Star className="w-4 h-4 text-purple-600" /> :
                     item.type === 'feature' ? <FileText className="w-4 h-4 text-blue-600" /> :
                     <Users className="w-4 h-4 text-green-600" />}
                  </div>
                  <h4 className="font-medium text-gray-900">{item.title}</h4>
                </div>
                
                {/* Description */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Description:</p>
                  <p className="text-sm text-gray-600">{item.description || 'No description available'}</p>
                </div>
                
                {/* Required Skills */}
                {item.requiredSkills && item.requiredSkills.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">Required Skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {item.requiredSkills.map(skill => (
                        <span key={skill} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Type:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.type === 'epic' ? 'bg-purple-100 text-purple-800' :
                      item.type === 'feature' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {item.type}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Priority:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      item.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                  
                  {item.storyPoints && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Story Points:</span>
                      <span className="text-sm font-medium text-gray-900">{item.storyPoints}</span>
                    </div>
                  )}
                  
                  {item.clientName && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Client:</span>
                      <span className="text-sm text-gray-900">{item.clientName}</span>
                    </div>
                  )}
                  
                  {item.assigneeDetails && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Assigned to:</span>
                      <span className="text-sm text-gray-900">{item.assigneeDetails.name}</span>
                    </div>
                  )}
                  
                  {item.sprintId && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Sprint:</span>
                      <span className="text-sm text-gray-900">
                        {sprints.find(s => s.id === item.sprintId)?.name || 'Unknown Sprint'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
