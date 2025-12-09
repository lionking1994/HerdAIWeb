// Sample workflow data for testing the approval page
export const sampleWorkflowData = {
  workflow: {
    id: 'wf_123456',
    title: 'Customer Onboarding',
    status: 'pending_approval',
    createdAt: '2025-07-31T15:45:00Z',
    updatedAt: '2025-07-31T15:56:00Z'
  },
  company: {
    name: 'ABC Firm',
    website: 'abc.com',
    revenue: '$5m',
    description: 'What an amazing company that specializes in innovative solutions for the modern business landscape.',
  },
  workflowHistory: [
    {
      id: 'event_1',
      type: 'workflow_started',
      title: 'Workflow Started: Task Thread',
      description: 'Customer onboarding workflow initiated',
      timestamp: '2025-07-31T15:45:00Z',
      status: 'completed'
    },
    {
      id: 'event_2',
      type: 'api_call',
      title: 'API Called: CoreSignal',
      description: 'Company data enrichment completed',
      timestamp: '2025-07-31T15:56:00Z',
      status: 'completed'
    },
    {
      id: 'event_3',
      type: 'approval_required',
      title: 'Approval Required',
      description: 'Manual approval needed for customer onboarding',
      timestamp: null,
      status: 'pending'
    }
  ],
  insights: {
    companyAnalysis: {
      "revenue": {
        "annualRevenueUSD": 13108000000
    },
    "industry": "Telecommunications",
    "companyName": "Lumen",
    "description": "Lumen connects the world. We digitally connect people, data and applications – quickly, securely and effortlessly. Everything we do at Lumen takes advantage of our network strength. From metro connectivity to long-haul data transport to our edge cloud, security, and managed service capabilities, we meet our customers’ needs today and as they build for tomorrow.",
    "key_executives": [
        {
            "name": "Phil Koretz",
            "position": "Senior Director, Sales Enablement Strategy"
        },
        {
            "name": "Lauren Fisher",
            "position": "Large Enterprise Account Director"
        },
        {
            "name": "Greg Baum",
            "position": "Director Solutions Architecture"
        },
        {
            "name": "Jeff Winkelmann",
            "position": "Account Director, Public Safety"
        },
        {
            "name": "Ronak Merchant",
            "position": "Director - Strategic Analytics"
        },
        {
            "name": "Bridget Mcandrew",
            "position": "Director Product Operations"
        },
        {
            "name": "Frank Mestas",
            "position": "Director Of Operations"
        },
        {
            "name": "Julie Johnson",
            "position": "Account Director"
        },
        {
            "name": "Tara Acton",
            "position": "Claims Director Associate General Counsel"
        }
    ]
    }
  }
};

// Additional sample data for different scenarios
export const sampleWorkflowDataApproved = {
  ...sampleWorkflowData,
  workflow: {
    ...sampleWorkflowData.workflow,
    status: 'approved'
  },
  approval: {
    ...sampleWorkflowData.approval,
    status: 'approved',
    timestamp: '2025-07-31T16:30:00Z'
  }
};

export const sampleWorkflowDataRejected = {
  ...sampleWorkflowData,
  workflow: {
    ...sampleWorkflowData.workflow,
    status: 'rejected'
  },
  approval: {
    ...sampleWorkflowData.approval,
    status: 'rejected',
    timestamp: '2025-07-31T16:30:00Z'
  }
};

// Sample data for different company types
export const sampleWorkflowDataStartup = {
  ...sampleWorkflowData,
  company: {
    name: 'TechStartup Inc',
    website: 'techstartup.io',
    revenue: '$500k',
    description: 'An innovative startup focused on AI-powered solutions for small businesses.',
    industry: 'Software',
    size: '10-50 employees',
    location: 'Austin, TX'
  },
  contact: {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah@techstartup.io',
    phone: '+1 (555) 987-6543',
    title: 'Founder & CEO',
    linkedin: 'linkedin.com/in/sarahjohnson'
  }
};

export const sampleWorkflowDataEnterprise = {
  ...sampleWorkflowData,
  company: {
    name: 'Global Enterprises Ltd',
    website: 'globalenterprises.com',
    revenue: '$50m',
    description: 'A multinational corporation with operations in 25+ countries.',
    industry: 'Manufacturing',
    size: '1000+ employees',
    location: 'New York, NY'
  },
  contact: {
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'michael.chen@globalenterprises.com',
    phone: '+1 (555) 456-7890',
    title: 'VP of Operations',
    linkedin: 'linkedin.com/in/michaelchen'
  }
}; 