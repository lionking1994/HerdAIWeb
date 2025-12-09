import React from 'react';
import { PipelineStage as StageType, Deal } from '../types/index';
import { DealCard } from './DealCard';
import { formatCurrency } from '../utils/analytics';

interface PipelineStageProps {
  stage: StageType;
  stageId:string;
  title: string;
  deals: Deal[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stage: StageType, stageId:string) => void;
  onDragStart: (e: React.DragEvent, deal: Deal) => void;
  color: string;
}

export const PipelineStageComponent: React.FC<PipelineStageProps> = ({
  stage,
  stageId,
  title,
  deals,
  onDragOver,
  onDrop,
  onDragStart,
  color
}) => {
  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);
  const averageValue = deals.length > 0 ? totalValue / deals.length : 0;

  return (
    <div className="flex-1 min-w-72">
      <div className={`${color} rounded-lg p-4 mb-4`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-white">{title}</h3>
          <span className="bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-sm font-medium">
            {deals.length}
          </span>
        </div>
        <div className="text-white text-opacity-90 text-sm">
          <div>Total: {formatCurrency(totalValue)}</div>
          {deals.length > 0 && (
            <div>Avg: {formatCurrency(averageValue)}</div>
          )}
        </div>
      </div>

      <div
        className="min-h-96 bg-gray-50 rounded-lg p-3 border-2 border-dashed border-gray-300 transition-colors hover:border-gray-400"
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, stage, stageId)}
      >
        <div className="space-y-3">
          {deals.map(deal => (
            <DealCard
              key={deal.id}
              deal={deal}
              onDragStart={onDragStart}
            />
          ))}
          {deals.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p>No deals in this stage</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};