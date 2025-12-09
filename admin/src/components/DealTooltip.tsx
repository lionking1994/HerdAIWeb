import React from 'react';
import { Deal, DealAnalytics } from '../types/index';
import { formatCurrency, formatDate, getPriorityColor, getStagnationColor } from '../utils/analytics';
import { TrendingDown, TrendingUp, Clock, Activity, AlertTriangle, MapPin, User, Package } from 'lucide-react';
import {useSearchParams, useNavigate } from 'react-router-dom';
interface DealTooltipProps {
  deal: Deal;
  analytics: DealAnalytics;
  isVisible: boolean;
  position: { x: number; y: number };
}

export const DealTooltip: React.FC<DealTooltipProps> = ({ deal, analytics, isVisible, position }) => {
  if (!isVisible) return null;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');

  const getActivityIcon = () => {
    switch (analytics.activityLevel) {
      case 'high': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'medium': return <Activity className="w-4 h-4 text-yellow-500" />;
      case 'low': return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
  };

  const getRiskIcon = () => {
    switch (analytics.stagnationRisk) {
      case 'high': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'medium': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'low': return <TrendingUp className="w-4 h-4 text-green-500" />;
    }
  };

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 pointer-events-none"
      style={{
        left: Math.min(position.x + 10, window.innerWidth - 320),
        top: Math.max(position.y - 10, 10)
      }}
    >
      {/* Header */}
      <div className="border-b border-gray-200 pb-3 mb-3">
        <h3 className="font-semibold text-gray-900 text-lg"
        onClick={()=>navigate(`/crm/opportunities/${deal.id}?company=${companyId}`)}
        >
          {deal.title}
        </h3>
        {/* <p className="text-sm text-gray-600">{deal.company}</p> */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-2xl font-bold text-green-600">{formatCurrency(deal.value)}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(deal.priority)}`}>
            {deal.priority.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Key Details */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">Rep:</span>
          <span className="font-medium">{deal.salesRep}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">Company:</span>
          <span className="font-medium">{deal.company}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">Location:</span>
          <span className="font-medium">{deal.state}, {deal.geography}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">Product:</span>
          <span className="font-medium">{deal.product}</span>
        </div>
      </div>

      {/* Analytics */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <h4 className="font-medium text-gray-900 text-sm">Deal Analytics</h4>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-gray-500">Days in Stage</div>
            <div className="font-semibold text-gray-900">{analytics.daysInStage} days</div>
          </div>
          <div>
            <div className="text-gray-500">Total Pipeline Time</div>
            <div className="font-semibold text-gray-900">{analytics.totalDaysInPipeline} days</div>
          </div>
          <div>
            <div className="text-gray-500">Stage Movements</div>
            <div className="font-semibold text-gray-900">{analytics.movementCount} times</div>
          </div>
          <div>
            <div className="text-gray-500">Probability</div>
            <div className="font-semibold text-gray-900">{deal.probability}%</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div className="flex items-center gap-1">
            {getActivityIcon()}
            <span className="text-xs text-gray-600">
              Activity: {analytics.activityLevel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {getRiskIcon()}
            <span className={`text-xs ${getStagnationColor(analytics.stagnationRisk)}`}>
              Risk: {analytics.stagnationRisk}
            </span>
          </div>
        </div>

        {/* Warnings */}
        {(analytics.stagnationRisk === 'high' || analytics.lastActivityDays > 7) && (
          <div className="bg-red-50 border border-red-200 rounded-md p-2 mt-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-700">
                {analytics.lastActivityDays > 14 && <div>No activity for {analytics.lastActivityDays} days</div>}
                {analytics.daysInStage > 30 && <div>Stuck in stage for {analytics.daysInStage} days</div>}
                {analytics.movementCount > 3 && <div>High movement frequency ({analytics.movementCount} moves)</div>}
              </div>
            </div>
          </div>
        )}

        {/* Last Activity */}
        <div className="text-xs text-gray-500 pt-1">
          Last activity: {formatDate(deal.lastActivity)} ({analytics.lastActivityDays} days ago)
        </div>
      </div>
    </div>
  );
};