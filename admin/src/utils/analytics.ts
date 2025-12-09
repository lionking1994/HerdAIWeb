import { Deal, DealAnalytics } from '../types/index';

export const calculateDealAnalytics = (deal: Deal): DealAnalytics => {
  const now = new Date();
  const createdAt = new Date(deal.createdAt);
  const lastActivity = new Date(deal.lastActivity);
  
  // Calculate days in current stage
  const lastMovement = deal.movementHistory.length > 0 
    ? new Date(deal.movementHistory[deal.movementHistory.length - 1].movedAt ?? createdAt)
    : createdAt;
  
  const daysInStage = Math.floor((now.getTime() - lastMovement.getTime()) / (1000 * 60 * 60 * 24));
  const totalDaysInPipeline = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const lastActivityDays = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
  const movementCount = deal.movementHistory.length;
  
  // Calculate stagnation risk
  let stagnationRisk: 'low' | 'medium' | 'high' = 'low';
  if (daysInStage > 30 || lastActivityDays > 14) {
    stagnationRisk = 'high';
  } else if (daysInStage > 14 || lastActivityDays > 7) {
    stagnationRisk = 'medium';
  }
  
  // Calculate activity level
  let activityLevel: 'low' | 'medium' | 'high' = 'high';
  if (lastActivityDays > 7) {
    activityLevel = 'low';
  } else if (lastActivityDays > 3) {
    activityLevel = 'medium';
  }
  
  return {
    daysInStage,
    totalDaysInPipeline,
    movementCount,
    lastActivityDays,
    stagnationRisk,
    activityLevel
  };
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(date));
};

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800 border-red-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getStagnationColor = (risk: string): string => {
  switch (risk) {
    case 'high': return 'text-red-600';
    case 'medium': return 'text-yellow-600';
    case 'low': return 'text-green-600';
    default: return 'text-gray-600';
  }
};

export const getQuarterFromDate = (date: Date): string => {
  const month = date.getMonth();
  const year = date.getFullYear();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter} ${year}`;
};

export const getNextQuarters = (count: number = 4): string[] => {
  const quarters = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + (i * 3), 1);
    quarters.push(getQuarterFromDate(futureDate));
  }
  
  return quarters;
};

export const calculateQuarterlyForecast = (deals: Deal[]) => {
  const quarters = getNextQuarters(4);
  const forecast = quarters.map(quarter => ({
    quarter,
    totalValue: 0,
    weightedValue: 0,
    dealCount: 0,
    highProbDeals: 0,
    deals: [] as Deal[]
  }));
  
  // For this demo, we'll distribute deals across quarters based on their stage and creation date
  deals.forEach(deal => {
    if (deal.stage === 'closed-won' || deal.stage === 'closed-lost') return;
    
    // Estimate close date based on stage and creation date
    const createdAt = new Date(deal.createdAt);
    let estimatedCloseDate = new Date(createdAt);
    
    // Add estimated days based on stage
    // switch (deal.stage) {
    //   case 'lead':
    //     estimatedCloseDate.setDate(estimatedCloseDate.getDate() + 90);
    //     break;
    //   case 'qualified':
    //     estimatedCloseDate.setDate(estimatedCloseDate.getDate() + 60);
    //     break;
    //   case 'proposal':
    //     estimatedCloseDate.setDate(estimatedCloseDate.getDate() + 30);
    //     break;
    //   case 'negotiation':
    //     estimatedCloseDate.setDate(estimatedCloseDate.getDate() + 15);
    //     break;
    // }
    
    const quarterKey = getQuarterFromDate(estimatedCloseDate);
    const quarterIndex = quarters.indexOf(quarterKey);
    
    if (quarterIndex !== -1) {
      forecast[quarterIndex].totalValue += deal.value;
      forecast[quarterIndex].weightedValue += deal.value * ((deal.weight_percentage ?? 0)/100);
      forecast[quarterIndex].dealCount += 1;
      forecast[quarterIndex].deals.push(deal);
      
      if (deal.probability >= 70) {
        forecast[quarterIndex].highProbDeals += 1;
      }
    }
  });
  
  return forecast;
};