import { Deal, PipelineStage } from '../types/index';

export const salesReps = [
  'Sarah Johnson', 'Mike Chen', 'Emily Rodriguez', 'David Kim', 
  'Jessica Brown', 'Alex Thompson', 'Maria Garcia', 'James Wilson'
];

export const geographies = [
  'North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East & Africa'
];

export const states = [
  'California', 'New York', 'Texas', 'Florida', 'Illinois', 'Pennsylvania',
  'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'New Jersey', 'Virginia'
];

export const products = [
  'Enterprise Software', 'Cloud Services', 'Consulting', 'Support Package',
  'Training Program', 'Custom Development', 'API License', 'Mobile App'
];

export const companies = [
  'TechCorp Inc', 'Global Systems', 'Innovation Labs', 'Digital Solutions',
  'Future Enterprises', 'Smart Technologies', 'NextGen Corp', 'Advanced Systems',
  'Cloud Dynamics', 'Data Insights', 'Mobile First', 'AI Innovations',
  'Secure Networks', 'Scale Solutions', 'Growth Partners', 'Elite Services'
];

const getRandomDate = (daysAgo: number, variance: number = 30) => {
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - daysAgo);
  const varianceMs = variance * 24 * 60 * 60 * 1000;
  const randomVariance = (Math.random() - 0.5) * varianceMs;
  return new Date(baseDate.getTime() + randomVariance);
};

const generateMovementHistory = (stage: PipelineStage, createdAt: Date) => {
  const stages: PipelineStage[] = ['lead', 'qualified', 'proposal', 'negotiation'];
  const currentStageIndex = stages.indexOf(stage);
  const history = [];
  
  let currentDate = new Date(createdAt);
  
  for (let i = 0; i <= currentStageIndex; i++) {
    if (i > 0) {
      currentDate = new Date(currentDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
      history.push({
        fromStage: stages[i - 1],
        toStage: stages[i],
        movedAt: currentDate
      });
    }
  }
  
  // Add some back-and-forth movement for some deals
  if (Math.random() > 0.7 && currentStageIndex > 1) {
    const backStage = stages[Math.max(0, currentStageIndex - 1)];
    currentDate = new Date(currentDate.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000);
    history.push({
      fromStage: stage,
      toStage: backStage,
      movedAt: currentDate
    });
    
    currentDate = new Date(currentDate.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000);
    history.push({
      fromStage: backStage,
      toStage: stage,
      movedAt: currentDate
    });
  }
  
  return history;
};

export const mockDeals: Deal[] = [
  // Lead stage deals
  {
    id: '1',
    title: 'Enterprise Platform Migration',
    company: companies[0],
    value: 750000,
    stage: 'lead',
    salesRep: salesReps[0],
    geography: geographies[0],
    state: states[0],
    product: products[0],
    createdAt: getRandomDate(5),
    lastActivity: getRandomDate(2),
    movementHistory: [],
    priority: 'high',
    probability: 15
  },
  {
    id: '2',
    title: 'Cloud Infrastructure Setup',
    company: companies[1],
    value: 450000,
    stage: 'lead',
    salesRep: salesReps[1],
    geography: geographies[1],
    state: states[1],
    product: products[1],
    createdAt: getRandomDate(12),
    lastActivity: getRandomDate(8),
    movementHistory: [],
    priority: 'medium',
    probability: 10
  },
  {
    id: '3',
    title: 'Digital Transformation',
    company: companies[2],
    value: 320000,
    stage: 'lead',
    salesRep: salesReps[2],
    geography: geographies[2],
    state: states[2],
    product: products[2],
    createdAt: getRandomDate(3),
    lastActivity: getRandomDate(1),
    movementHistory: [],
    priority: 'high',
    probability: 20
  },
  
  // Qualified stage deals
  {
    id: '4',
    title: 'API Integration Project',
    company: companies[3],
    value: 280000,
    stage: 'qualified',
    salesRep: salesReps[3],
    geography: geographies[0],
    state: states[3],
    product: products[6],
    createdAt: getRandomDate(25),
    lastActivity: getRandomDate(3),
    movementHistory: generateMovementHistory('qualified', getRandomDate(25)),
    priority: 'medium',
    probability: 35
  },
  {
    id: '5',
    title: 'Mobile App Development',
    company: companies[4],
    value: 180000,
    stage: 'qualified',
    salesRep: salesReps[4],
    geography: geographies[1],
    state: states[4],
    product: products[7],
    createdAt: getRandomDate(18),
    lastActivity: getRandomDate(1),
    movementHistory: generateMovementHistory('qualified', getRandomDate(18)),
    priority: 'high',
    probability: 40
  },
  {
    id: '6',
    title: 'Training and Support Package',
    company: companies[5],
    value: 95000,
    stage: 'qualified',
    salesRep: salesReps[0],
    geography: geographies[3],
    state: states[5],
    product: products[4],
    createdAt: getRandomDate(45),
    lastActivity: getRandomDate(15),
    movementHistory: generateMovementHistory('qualified', getRandomDate(45)),
    priority: 'low',
    probability: 25
  },
  
  // Proposal stage deals
  {
    id: '7',
    title: 'Enterprise Security Suite',
    company: companies[6],
    value: 650000,
    stage: 'proposal',
    salesRep: salesReps[5],
    geography: geographies[0],
    state: states[6],
    product: products[0],
    createdAt: getRandomDate(35),
    lastActivity: getRandomDate(2),
    movementHistory: generateMovementHistory('proposal', getRandomDate(35)),
    priority: 'high',
    probability: 60
  },
  {
    id: '8',
    title: 'Data Analytics Platform',
    company: companies[7],
    value: 420000,
    stage: 'proposal',
    salesRep: salesReps[6],
    geography: geographies[2],
    state: states[7],
    product: products[1],
    createdAt: getRandomDate(28),
    lastActivity: getRandomDate(4),
    movementHistory: generateMovementHistory('proposal', getRandomDate(28)),
    priority: 'medium',
    probability: 55
  },
  
  // Negotiation stage deals
  {
    id: '9',
    title: 'Custom ERP Implementation',
    company: companies[8],
    value: 890000,
    stage: 'negotiation',
    salesRep: salesReps[7],
    geography: geographies[0],
    state: states[8],
    product: products[5],
    createdAt: getRandomDate(42),
    lastActivity: getRandomDate(1),
    movementHistory: generateMovementHistory('negotiation', getRandomDate(42)),
    priority: 'high',
    probability: 80
  },
  {
    id: '10',
    title: 'Cloud Migration Services',
    company: companies[9],
    value: 340000,
    stage: 'negotiation',
    salesRep: salesReps[1],
    geography: geographies[1],
    state: states[9],
    product: products[1],
    createdAt: getRandomDate(38),
    lastActivity: getRandomDate(2),
    movementHistory: generateMovementHistory('negotiation', getRandomDate(38)),
    priority: 'medium',
    probability: 75
  },
  
  // Closed Won deals
  {
    id: '11',
    title: 'AI Chatbot Integration',
    company: companies[10],
    value: 125000,
    stage: 'closed-won',
    salesRep: salesReps[2],
    geography: geographies[0],
    state: states[10],
    product: products[0],
    createdAt: getRandomDate(60),
    lastActivity: getRandomDate(5),
    movementHistory: generateMovementHistory('negotiation', getRandomDate(60)),
    priority: 'medium',
    probability: 100
  },
  {
    id: '12',
    title: 'Support Contract Renewal',
    company: companies[11],
    value: 85000,
    stage: 'closed-won',
    salesRep: salesReps[3],
    geography: geographies[1],
    state: states[11],
    product: products[3],
    createdAt: getRandomDate(75),
    lastActivity: getRandomDate(7),
    movementHistory: generateMovementHistory('negotiation', getRandomDate(75)),
    priority: 'low',
    probability: 100
  }
];