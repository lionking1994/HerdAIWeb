import React, { useState } from 'react';
import { Deal } from '../types/index';
import { formatCurrency, getPriorityColor, calculateDealAnalytics } from '../utils/analytics';
import { DealTooltip } from './DealTooltip'
import { Building2, DollarSign, User, Calendar, TrendingUp } from 'lucide-react';
import {useSearchParams } from 'react-router-dom';
interface DealCardProps {
  deal: Deal;
  onDragStart: (e: React.DragEvent, deal: Deal) => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, onDragStart }) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const analytics = calculateDealAnalytics(deal);
    const [searchParams] = useSearchParams();
    const companyId = searchParams.get('company');

  const handleMouseEnter = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
    setTooltipVisible(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setTooltipVisible(false);
  };

  const getStageProgress = () => {
    const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed-won'];
    const currentIndex = stages.indexOf(deal.stage);
    return ((currentIndex + 1) / stages.length) * 100;
  };

  return (
    <>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, deal)}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-move hover:shadow-md transition-all duration-200 hover:scale-[1.02] group"
      >
        {/* Priority and Risk Indicators */}
        <div className="flex items-center justify-between mb-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(deal.priority)}`}>
            {deal.priority.toUpperCase()}
          </span>
          {analytics.stagnationRisk === 'high' && (
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="High stagnation risk"></div>
          )}
        </div>

        {/* Deal Title and Company */}
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2"
           onClick={()=>window.location.href = `https://app.getherd.ai/crm/opportunities/${deal.id}?company=${companyId}`}
          >
            {deal.title}
          </h3>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Building2 className="w-3 h-3" />
            <span>{deal.company}</span>
          </div>
        </div>

        {/* Value and Probability */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-bold text-green-600">{formatCurrency(deal.value)}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-blue-600" />
            <span className="text-xs font-medium text-blue-600">{deal.probability}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${getStageProgress()}%` }}
            ></div>
          </div>
        </div>

        {/* Sales Rep and Days */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>{deal.salesRep.split(' ')[0]}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{analytics.daysInStage}d in stage</span>
          </div>
        </div>

        {/* Activity Level Indicator */}
        <div className="mt-2 flex justify-end">
          <div className={`w-2 h-2 rounded-full ${analytics.activityLevel === 'high' ? 'bg-green-400' :
              analytics.activityLevel === 'medium' ? 'bg-yellow-400' : 'bg-red-400'
            }`} title={`${analytics.activityLevel} activity level`}></div>
        </div>
      </div>

      <DealTooltip
        deal={deal}
        analytics={analytics}
        isVisible={tooltipVisible}
        position={mousePosition}
      />
    </>
  );
};