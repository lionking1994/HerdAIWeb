// Core type definitions for the PSA application

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'manager' | 'resource' | 'client';
    avatar?: string;
  }
  
  export interface Skill {
    id: string;
    name: string;
    category: string;
    description?: string;
  }
  
  export interface Certification {
    id: string;
    name: string;
    issuingOrganization: string;
    expirationDate?: string;
    description?: string;
  }
  
  export interface ResourceSkill {
    skillId: string;
    skill: Skill;
    proficiencyLevel: 1 | 2 | 3 | 4 | 5; // 1=Beginner, 5=Expert
    yearsExperience: number;
    lastUsed?: string;
  }
  
  export interface ResourceCertification {
    certificationId: string;
    certification: Certification;
    dateObtained: string;
    expirationDate?: string;
    status: 'active' | 'expired' | 'expiring_soon';
    certificateNumber?: string;
    verificationUrl?: string;
  }
  
  export interface Resource {
    id: string;
    userId: string;
    user: User;
    skills: ResourceSkill[];
    certifications: ResourceCertification[];
    availability: number; // Percentage available (0-100)
    hourlyRate?: number;
    location: string;
    department: string;
    departmentId?: number | null;
    performanceRating: number; // 1-5 scale
    isActive: boolean;
    hireDate: string;
    totalProjectHours: number;
    successfulProjects: number;
    activeProjects?: ActiveProject[];
    resource?: {
      resource_id: string;
      employment_type?: string;
      level?: string;
      cost_center?: string;
      working_days?: string[];
      hours_per_week?: number;
    };
  }

  export interface ActiveProject {
    id: string;
    name: string;
    role: string;
    allocation: number;
  }
  
  export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    type: 'epic' | 'feature' | 'story';
    category: string;
    estimatedHours: number;
    requiredSkills: string[];
    acceptanceCriteria: string[];
    definitionOfDone: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    isActive: boolean;
  }
  
  export interface Client {
    id: string;
    name: string;
    email: string;
    phone: string;
  }

  export interface Project {
    id: string;
    name: string;
    description: string;
    status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
    health: 'green' | 'yellow' | 'red';
    methodology: 'agile' | 'waterfall';
    startDate: string;
    endDate: string;
    budgetHours: number;
    actualHours: number;
    clientId: string;
    client?: Client;
    managerId: string;
    resources: ProjectResource[];
    resourceUserIds?: number[];
    resourceRoles?: string[];
    resourceAllocations?: number[];
    baseline?: ProjectBaseline;
    changeRequests: ChangeRequest[];
    phases?: ProjectPhase[];
    sprints?: Sprint[];
    costAnalysis?: ProjectCostAnalysis;
    costSummary?: ProjectCostSummary;
    storyProgress?: ProjectStoryProgress;
  }

  export interface ProjectStoryProgress {
    projectId: string;
    projectName: string;
    description: string;
    startDate: string;
    endDate: string;
    budgetHours: number;
    
    // Story counts
    totalStories: number;
    completedStories: number;
    inProgressStories: number;
    reviewStories: number;
    backlogStories: number;
    
    // Story points
    totalStoryPoints: number;
    completedStoryPoints: number;
    inProgressStoryPoints: number;
    reviewStoryPoints: number;
    backlogStoryPoints: number;
    
    // Progress calculation
    storyProgressPercentage: number;
    
    // Additional metrics
    averageStoryPoints: number;
    completionRate: number;
  }

  export interface ProjectCostSummary {
    projectId: string;
    budgetAmount: number;
    totalSpent: number;
    budgetRemaining: number;
    costProgress: number;
  }

  export interface ProjectCostAnalysis {
    project: {
      id: string;
      name: string;
      description: string;
      startDate: string;
      endDate: string;
      budgetAmount: number;
      weeksElapsed: number;
      weeksRemaining: number;
      totalWeeks: number;
    };
    costs: {
      totalWeeklyCost: number;
      totalSpent: number;
      totalRemaining: number;
      totalProjectCost: number;
      budgetRemaining: number;
    };
    progress: {
      costProgress: number;
      timeProgress: number;
      costEfficiency: number;
    };
    budget: {
      projectedTotalCost: number;
      budgetVariance: number;
      budgetVariancePercentage: number;
      isOverBudget: boolean;
    };
    resources: ResourceCost[];
  }

  export interface ResourceCost {
    userId: string;
    name: string;
    email: string;
    role: string;
    allocationPercentage: number;
    hourlyRate: number;
    hoursPerWeek: number;
    weeklyCost: number;
    totalCost: number;
    remainingCost: number;
    currency: string;
  }
  
  export interface ProjectResource {
    id: string;
    projectId: string;
    resourceId: string;
    resource: Resource;
    role: string;
    allocationPercentage: number;
    startDate: string;
    endDate: string;
    hourlyRate: number;
    isActive: boolean;
  }
  
  export interface ProjectBaseline {
    id: string;
    projectId: string;
    version: number;
    approvedDate: string;
    scope: string;
    budgetHours: number;
    timeline: string;
    resources: string[];
    milestones: ProjectMilestone[];
  }
  
  export interface ChangeRequest {
    id: string;
    projectId: string;
    title: string;
    description: string;
    requestedBy: string;
    requestDate: string;
    status: 'pending' | 'approved' | 'rejected' | 'implemented';
    impactAnalysis: {
      hoursDelta: number;
      costDelta: number;
      timelineDelta: number;
      riskLevel: 'low' | 'medium' | 'high';
    };
    approvedBy?: string;
    approvalDate?: string;
  }
  
  export interface ProjectPhase {
    id: string;
    projectId: string;
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
    prerequisites: string[];
    deliverables: string[];
    gateApproval?: boolean;
  }
  
  export interface Sprint {
    id: string;
    projectId: string;
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
    status: 'planning' | 'active' | 'review' | 'retrospective' | 'completed';
    capacity: number;
    velocity: number;
    stories: UserStory[];
  }
  
  export interface UserStory {
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    storyPoints: number;
    priority: number;
    status: 'backlog' | 'in_progress' | 'review' | 'done';
    assigneeId?: string;
    sprintId?: string;
  }
  
  export interface ProjectMilestone {
    id: string;
    projectId: string;
    name: string;
    description: string;
    targetDate: string;
    actualDate?: string;
    status: 'pending' | 'completed' | 'delayed';
    isBaseline: boolean;
  }
  
  export interface DashboardMetrics {
    totalResources: number;
    assignedResources: number;
    benchPercentage: number;
    activeProjects: number;
    projectHealth: {
      green: number;
      yellow: number;
      red: number;
    };
    unstaffedProjects: number;
    expiringCertifications: number;
    utilizationTrend: Array<{
      date: string;
      utilization: number;
      bench: number;
    }>;
  }