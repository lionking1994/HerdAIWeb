import React from 'react';

interface VelocityChartProps {
  sprints: Array<{
    id: string;
    name: string;
    velocity: number;
    commitment: number;
    efficiency: number;
    start_date: string;
    end_date: string;
    status: string;
  }>;
}

export default function VelocityChart({ sprints }: VelocityChartProps) {
  if (!sprints || sprints.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sprint Velocity Trend</h3>
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <p>No sprint data available</p>
          <p className="text-sm">Create sprints to see velocity trends</p>
        </div>
      </div>
    );
  }

  // Calculate max value for scaling
  const maxValue = Math.max(
    ...sprints.map(s => Math.max(s.velocity, s.commitment))
  );

  // Calculate average velocity
  const avgVelocity = sprints.reduce((sum, sprint) => sum + sprint.velocity, 0) / sprints.length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Sprint Velocity Trend</h3>
        <div className="text-sm text-gray-600">
          Avg Velocity: <span className="font-semibold text-blue-600">{Math.round(avgVelocity)}</span> story points
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-4">
        {sprints.map((sprint, index) => {
          const velocityHeight = maxValue > 0 ? (sprint.velocity / maxValue) * 100 : 0;
          const commitmentHeight = maxValue > 0 ? (sprint.commitment / maxValue) * 100 : 0;
          
          return (
            <div key={sprint.id} className="flex items-end space-x-2">
              {/* Sprint Info */}
              <div className="w-24 text-xs text-gray-600">
                <div className="font-medium truncate">{sprint.name}</div>
                <div className="text-gray-500">
                  {new Date(sprint.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>

              {/* Chart Bars */}
              <div className="flex-1 flex items-end space-x-1">
                {/* Velocity Bar */}
                <div className="flex-1">
                  <div className="text-xs text-center text-gray-500 mb-1">Velocity</div>
                  <div className="relative">
                    <div 
                      className="bg-blue-500 rounded-t"
                      style={{ height: `${velocityHeight}px`, minHeight: '4px' }}
                    ></div>
                    <div className="text-xs text-center text-blue-600 font-medium mt-1">
                      {sprint.velocity}
                    </div>
                  </div>
                </div>

                {/* Commitment Bar */}
                <div className="flex-1">
                  <div className="text-xs text-center text-gray-500 mb-1">Commitment</div>
                  <div className="relative">
                    <div 
                      className="bg-gray-300 rounded-t"
                      style={{ height: `${commitmentHeight}px`, minHeight: '4px' }}
                    ></div>
                    <div className="text-xs text-center text-gray-600 font-medium mt-1">
                      {sprint.commitment}
                    </div>
                  </div>
                </div>

                {/* Efficiency */}
                <div className="w-16 text-center">
                  <div className="text-xs text-gray-500 mb-1">Efficiency</div>
                  <div className={`text-lg font-bold ${
                    sprint.efficiency >= 80 ? 'text-green-600' :
                    sprint.efficiency >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {sprint.efficiency}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-sm text-gray-600">Velocity (Completed)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-300 rounded"></div>
          <span className="text-sm text-gray-600">Commitment (Planned)</span>
        </div>
      </div>
    </div>
  );
}
