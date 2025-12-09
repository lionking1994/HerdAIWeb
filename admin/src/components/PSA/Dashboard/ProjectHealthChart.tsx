import React from 'react';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface ProjectHealthChartProps {
  health: {
    green: number;
    yellow: number;
    red: number;
  };
}

export default function ProjectHealthChart({ health }: ProjectHealthChartProps) {
  const total = health.green + health.yellow + health.red;
  const greenPercent = total > 0 ? (health.green / total) * 100 : 0;
  const yellowPercent = total > 0 ? (health.yellow / total) * 100 : 0;
  const redPercent = total > 0 ? (health.red / total) * 100 : 0;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Project Health</h3>
        <span className="text-2xl font-bold text-gray-700">{total}</span>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
            <span className="text-gray-700 font-medium">Healthy</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-900 font-semibold mr-3">{health.green}</span>
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${greenPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-yellow-500 mr-3" />
            <span className="text-gray-700 font-medium">At Risk</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-900 font-semibold mr-3">{health.yellow}</span>
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full" 
                style={{ width: `${yellowPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
            <span className="text-gray-700 font-medium">Critical</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-900 font-semibold mr-3">{health.red}</span>
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-red-500 h-2 rounded-full" 
                style={{ width: `${redPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Overall Health Score</span>
          <span className="font-semibold">
            {total > 0 ? Math.round((greenPercent + yellowPercent * 0.5) / 1) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}