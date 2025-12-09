import React from 'react';
import { Deal } from '../types/index';
import { calculateQuarterlyForecast, formatCurrency } from '../utils/analytics';
import { TrendingUp, Target, Calendar, DollarSign } from 'lucide-react';

interface QuarterlyForecastProps {
  deals: Deal[];
}

export const QuarterlyForecast: React.FC<QuarterlyForecastProps> = ({ deals }) => {
  const forecast = calculateQuarterlyForecast(deals);
  
  const totalWeightedValue = forecast.reduce((sum, q) => sum + q.weightedValue, 0);
  const totalPipelineValue = forecast.reduce((sum, q) => sum + q.totalValue, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Quarterly Forecast</h2>
            <p className="text-sm text-gray-600">Revenue projections based on deal probability</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalWeightedValue)}</div>
          <div className="text-sm text-gray-500">Weighted Pipeline Value</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {forecast.map((quarter, index) => {
          const isCurrentQuarter = index === 0;
          const confidence = quarter.totalValue > 0 ? (quarter.weightedValue / quarter.totalValue) * 100 : 0;
          
          return (
            <div 
              key={quarter.quarter}
              className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                isCurrentQuarter 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <h3 className={`font-semibold ${isCurrentQuarter ? 'text-blue-900' : 'text-gray-900'}`}>
                    {quarter.quarter}
                  </h3>
                </div>
                {isCurrentQuarter && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                    Current
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <DollarSign className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-gray-600">Weighted Value</span>
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(quarter.weightedValue)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Target className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-600">Pipeline Value</span>
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    {formatCurrency(quarter.totalValue)}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
                    <span>Confidence</span>
                    <span className="font-medium">{Math.round(confidence)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        confidence >= 70 ? 'bg-green-500' :
                        confidence >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(confidence, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-500 pt-1">
                  <span>{quarter.dealCount} deals</span>
                  <span>{quarter.highProbDeals} high prob</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(totalPipelineValue)}
          </div>
          <div className="text-sm text-gray-600">Total Pipeline</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalWeightedValue)}
          </div>
          <div className="text-sm text-gray-600">Weighted Forecast</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {totalPipelineValue > 0 ? Math.round((totalWeightedValue / totalPipelineValue) * 100) : 0}%
          </div>
          <div className="text-sm text-gray-600">Overall Confidence</div>
        </div>
      </div>
    </div>
  );
};