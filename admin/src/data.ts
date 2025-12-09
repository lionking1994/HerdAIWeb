import { User, Company, FeedbackItem, ChartData } from './types';

export const users: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'Admin',
    status: 'active',
    company: 'Acme Inc',
    lastLogin: '2025-03-15T10:30:00',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    role: 'Manager',
    status: 'active',
    company: 'Globex Corp',
    lastLogin: '2025-03-14T16:45:00',
  },
  {
    id: '3',
    name: 'Robert Johnson',
    email: 'robert.johnson@example.com',
    role: 'User',
    status: 'inactive',
    company: 'Acme Inc',
    lastLogin: '2025-02-28T09:15:00',
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily.davis@example.com',
    role: 'User',
    status: 'active',
    company: 'Initech',
    lastLogin: '2025-03-15T08:20:00',
  },
  {
    id: '5',
    name: 'Michael Wilson',
    email: 'michael.wilson@example.com',
    role: 'Manager',
    status: 'active',
    company: 'Globex Corp',
    lastLogin: '2025-03-14T14:10:00',
  },
];

export const companies: Company[] = [
  {
    id: '1',
    name: 'Acme Inc',
    industry: 'Technology',
    employees: 250,
    status: 'active',
    subscription: 'Enterprise',
    joinedDate: '2023-01-15',
  },
  {
    id: '2',
    name: 'Globex Corp',
    industry: 'Manufacturing',
    employees: 500,
    status: 'active',
    subscription: 'Enterprise',
    joinedDate: '2022-11-03',
  },
  {
    id: '3',
    name: 'Initech',
    industry: 'Finance',
    employees: 150,
    status: 'active',
    subscription: 'Professional',
    joinedDate: '2023-06-22',
  },
  {
    id: '4',
    name: 'Umbrella Corp',
    industry: 'Healthcare',
    employees: 300,
    status: 'inactive',
    subscription: 'Enterprise',
    joinedDate: '2022-08-10',
  },
  {
    id: '5',
    name: 'Stark Industries',
    industry: 'Technology',
    employees: 1000,
    status: 'active',
    subscription: 'Enterprise',
    joinedDate: '2021-12-05',
  },
];

export const feedbackWords: FeedbackItem[] = [

];

export const meetingsData: ChartData = {
  labels: [
    'Jan',
    'Feb',
    'Mar',
  ],
  datasets: [
    {
      label: 'Number of Activities',
      data: [0, 0, 0],
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
    },
  ],
};

export const tasksData: ChartData = {
  labels: [
    'Jan',
    'Feb',
    'Mar',
  ],
  datasets: [
    {
      label: 'Number of Tasks',
      data: [0, 0, 0],
      borderColor: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
    },
  ],
};

export const taskRatingData: ChartData = {
  labels: ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent'],
  datasets: [
    {
      label: 'Task Ratings',
      data: [0, 0, 0, 0, 0],
      backgroundColor: [
        'rgba(239, 68, 68, 0.7)',
        'rgba(249, 115, 22, 0.7)',
        'rgba(234, 179, 8, 0.7)',
        'rgba(34, 197, 94, 0.7)',
        'rgba(59, 130, 246, 0.7)',
      ],
      borderWidth: 1,
    },
  ],
};

export const usersGrowthData: ChartData = {
  labels: [
    'Jan',
    'Feb',
    'Mar',
  ],
  datasets: [
    {
      label: 'Total System Users',
      data: [0, 0, 0], // Array of feedback counts for each month
      borderColor: '#8B5CF6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
    },
  ],
};
