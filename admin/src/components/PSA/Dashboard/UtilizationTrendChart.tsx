import React from 'react';

interface UtilizationTrendChartProps {
  data: Array<{
    date: string;
    utilization: number;
    bench: number;
    label?: string;
    type?: 'historical' | 'current' | 'projected';
  }>;
  isQuarterly?: boolean;
}

export default function UtilizationTrendChart({ data, isQuarterly = false }: UtilizationTrendChartProps) {
  const maxValue = 100;
  
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {isQuarterly ? 'Quarterly Utilization Trend' : 'Utilization Trend'}
        </h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-sm text-gray-600">Utilization</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
            <span className="text-sm text-gray-600">Bench</span>
          </div>
        </div>
      </div>
      
      <div className="relative h-64">
        <div className="absolute inset-0 flex items-end justify-between space-x-2">
          {data.map((point, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div className="w-full relative mb-2" style={{ height: '200px' }}>
                <div 
                  className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-300 hover:opacity-80 ${
                    point.type === 'projected' ? 'bg-blue-300 border-2 border-blue-500 border-dashed' :
                    point.type === 'current' ? 'bg-blue-600' : 'bg-blue-500'
                  }`}
                  style={{ height: `${(point.utilization / maxValue) * 100}%` }}
                  title={`${point.label || point.date}: ${point.utilization}% utilization`}
                ></div>
                <div 
                  className={`absolute rounded-t-lg transition-all duration-300 hover:opacity-80 ${
                    point.type === 'projected' ? 'bg-gray-300 border-2 border-gray-500 border-dashed' :
                    point.type === 'current' ? 'bg-gray-500' : 'bg-gray-400'
                  }`}
                  style={{ 
                    height: `${(point.bench / maxValue) * 100}%`,
                    bottom: `${(point.utilization / maxValue) * 100}%`,
                    left: 0,
                    right: 0
                  }}
                  title={`${point.label || point.date}: ${point.bench}% bench`}
                ></div>
              </div>
              <span className="text-xs text-gray-500 transform -rotate-45 origin-top-left">
                {point.label || (isQuarterly ? 
                  new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) :
                  new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                )}
              </span>
            </div>
          ))}
        </div>
        
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">
            {data[data.length - 1]?.utilization || 0}%
          </p>
          <p className="text-sm text-gray-600">Current Utilization</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-600">
            {data[data.length - 1]?.bench || 0}%
          </p>
          <p className="text-sm text-gray-600">Current Bench</p>
        </div>
      </div>

      {/* Legend for quarterly data */}
      {isQuarterly && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-center space-x-6 text-xs text-gray-600">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
              <span>Historical</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-600 rounded mr-2"></div>
              <span>Current</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-300 border-2 border-blue-500 border-dashed rounded mr-2"></div>
              <span>Projected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}