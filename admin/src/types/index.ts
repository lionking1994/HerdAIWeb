export interface Deal {
  id: string;
  title: string;
  company: string;
  value: number;
  stage: PipelineStage;
  stage_id?: string;
  salesRep: string;
  geography: string;
  state: string;
  product: string;
  createdAt: Date;
  lastActivity: Date;
  movementHistory: MovementRecord[];
  priority: 'low' | 'medium' | 'high';
  probability: number;
  weight_percentage?: number;
}

export interface MovementRecord {
  fromStage: PipelineStage;
  toStage: PipelineStage;
  movedAt?: Date;
  reason?: string;
}
export type PipelineStage = string;
//export type PipelineStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';

export interface FilterState {
  geography: string;
  state: string;
  salesRep: string;
  product: string;
  search: string;
}

export interface DealAnalytics {
  daysInStage: number;
  totalDaysInPipeline: number;
  movementCount: number;
  lastActivityDays: number;
  stagnationRisk: 'low' | 'medium' | 'high';
  activityLevel: 'low' | 'medium' | 'high';
}