import React from 'react';
import { Info } from 'lucide-react';

interface CostCalculationTooltipProps {
  children: React.ReactNode;
  projectedTotalCost: number;
  totalWeeklyCost: number;
  totalWeeks: number;
  resources: Array<{
    name: string;
    weeklyCost: number;
    allocationPercentage: number;
    hourlyRate: number;
    hoursPerWeek: number;
  }>;
}

export default function CostCalculationTooltip({ 
  children, 
  projectedTotalCost, 
  totalWeeklyCost, 
  totalWeeks, 
  resources 
}: CostCalculationTooltipProps) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-80">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 mb-3">
            <Info className="w-4 h-4 text-blue-300" />
            <span className="font-semibold text-blue-300">Projected Total Calculation</span>
          </div>
          
          <div className="space-y-1">
            <div className="text-gray-300 text-xs">Formula: Total Weekly Cost × Total Project Weeks</div>
            <div className="text-gray-300 text-xs">
              ${totalWeeklyCost.toLocaleString()} × {totalWeeks.toFixed(1)} weeks = ${projectedTotalCost.toLocaleString()}
            </div>
          </div>

          <div className="border-t border-gray-700 pt-2 mt-2">
            <div className="text-xs text-gray-300 mb-2">Weekly Cost Breakdown:</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {resources.map((resource, index) => (
                <div key={index} className="text-xs">
                  <span className="text-gray-400">{resource.name}:</span>
                  <span className="ml-1 text-white">
                    ${resource.hourlyRate}/hr × {resource.hoursPerWeek * (resource.allocationPercentage / 100)}hrs × {resource.allocationPercentage}% = ${resource.weeklyCost.toFixed(2)}/week
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-700 pt-2 mt-2">
            <div className="text-xs text-gray-300">
              <div>Total Weekly Cost: ${totalWeeklyCost.toLocaleString()}</div>
              <div>Project Duration: {totalWeeks.toFixed(1)} weeks</div>
              <div className="text-green-300 font-semibold">Projected Total: ${projectedTotalCost.toLocaleString()}</div>
            </div>
          </div>
        </div>
        
        {/* Arrow pointing down */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
}
