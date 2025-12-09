import { useState, useEffect } from 'react';
import { ArrowLeft, Users, TrendingUp, Target, AlertTriangle, CheckCircle, BarChart3, Download, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface CapacityPlanningViewProps {
  onBack: () => void;
}

interface CapacityPlanningData {
  currentCapacity: {
    totalResources: number;
    assignedResources: number;
    availableResources: number;
    totalCapacityHours: number;
    availableCapacityHours: number;
    utilizationRate: number;
  };
  demand: {
    totalStories: number;
    unassignedStories: number;
    assignedStories: number;
  };
  gapAnalysis: {
    gap: number;
    surplus: number;
    status: string;
  };
  futureProjections: Array<{
    period: string;
    demand: number;
    capacity: number;
  }>;
  futureGap: number;
  skillCapacity: Array<{
    skillId: string;
    skillName: string;
    skillCategory: string;
    skillDescription: string;
    totalCapacity: number;
    availableCapacity: number;
    demand: number;
    gap: number;
    utilization: number;
    status: string;
  }>;
  recommendations: Array<{
    type: string;
    priority: string;
    message: string;
    impact: string;
  }>;
  filters: {
    departments: Array<{ id: string; name: string }>;
    timeHorizon: string;
    department: string;
    search: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function CapacityPlanningView({ onBack }: CapacityPlanningViewProps) {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  
  const [timeHorizon, setTimeHorizon] = useState('6months');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<CapacityPlanningData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch capacity planning data from API
  const fetchCapacityPlanningData = async () => {
    console.log('CapacityPlanningView - fetchCapacityPlanningData called');
    console.log('Company ID from URL:', companyId);
    
    if (!companyId) {
      console.error('Company ID not found in URL parameters');
      setError('Company ID is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        timeHorizon,
        page: '1',
        limit: '50'
      });

      const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/psa/reports/capacity-planning/${companyId}?${params}`;
      console.log('API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log('API Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('API Response data:', result);
      
      if (result.success) {
        setData(result.data);
        console.log('Capacity planning data set successfully');
      } else {
        console.error('API returned error:', result.message);
        setError(result.message || 'Failed to fetch capacity planning data');
      }
    } catch (err) {
      console.error('Error fetching capacity planning data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchCapacityPlanningData();
  }, [companyId, timeHorizon]);

  const exportData = () => {
    if (!data) return;
    
    const exportData = {
      timeHorizon,
      currentCapacity: data.currentCapacity,
      demand: data.demand,
      gapAnalysis: data.gapAnalysis,
      futureProjections: data.futureProjections,
      skillCapacity: data.skillCapacity,
      recommendations: data.recommendations,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capacity-planning-${timeHorizon}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-gray-600">Loading capacity planning data...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchCapacityPlanningData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show no data state
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">No capacity planning data found for the selected filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors mr-4"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center">
            <BarChart3 className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Capacity Planning</h2>
              <p className="text-gray-600">Forecast resource needs and availability</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <select
            value={timeHorizon}
            onChange={(e) => setTimeHorizon(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="3months">3 Months</option>
            <option value="6months">6 Months</option>
            <option value="12months">12 Months</option>
          </select>
          <button 
            onClick={exportData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Plan
          </button>
        </div>
      </div>


      {/* Current Capacity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Capacity</p>
              <p className="text-2xl font-bold text-gray-900">{data.currentCapacity.totalCapacityHours}h</p>
              <p className="text-xs text-gray-500">per week</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Utilization</p>
              <p className="text-2xl font-bold text-green-600">
                {data.currentCapacity.totalCapacityHours - data.currentCapacity.availableCapacityHours}h
              </p>
              <p className="text-xs text-gray-500">{data.currentCapacity.utilizationRate}% utilized</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Available Capacity</p>
              <p className="text-2xl font-bold text-yellow-600">{data.currentCapacity.availableCapacityHours}h</p>
              <p className="text-xs text-gray-500">ready for assignment</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Future Gap</p>
              <p className="text-2xl font-bold text-red-600">
                {data.futureGap > 0 ? `+${data.futureGap}` : data.futureGap}h
              </p>
              <p className="text-xs text-gray-500">
                {data.futureProjections[data.futureProjections.length - 1]?.period || 'future'}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Demand vs Capacity Projection */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Demand vs Capacity Projection</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Demand</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Capacity</span>
            </div>
          </div>
        </div>
        
        <div className="relative h-64">
          <div className="absolute inset-0 flex items-end justify-between space-x-2">
            {data.futureProjections.map((projection, index) => {
              const maxValue = Math.max(...data.futureProjections.map(p => Math.max(p.demand, p.capacity)), 1); // Ensure maxValue is at least 1
              const hasGap = projection.demand > projection.capacity;
              
              // Debug logging
              if (index === 0) {
                console.log('Chart data:', data.futureProjections);
                console.log('Max value:', maxValue);
              }
              
              // Convert period to actual month names
              const getMonthName = (period: string) => {
                if (period === 'Current') return 'Current';
                const monthNumber = parseInt(period.replace('Month ', ''));
                const currentDate = new Date();
                const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthNumber, 1);
                return targetDate.toLocaleDateString('en-US', { month: 'short' });
              };
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full relative mb-2" style={{ height: '200px' }}>
                    {/* Demand bar (blue) - left side */}
                    <div 
                      className="absolute bottom-0 w-1/2 bg-blue-500 rounded-t-lg opacity-90"
                      style={{ 
                        height: `${Math.max((projection.demand / maxValue) * 100, 3)}%`, // Minimum 3% height for visibility
                        left: 0,
                        minHeight: '6px' // Ensure minimum visible height
                      }}
                      title={`Demand: ${projection.demand}`}
                    ></div>
                    {/* Capacity bar (green) - right side */}
                    <div 
                      className="absolute bottom-0 w-1/2 bg-green-500 rounded-t-lg opacity-90"
                      style={{ 
                        height: `${Math.max((projection.capacity / maxValue) * 100, 3)}%`, // Minimum 3% height for visibility
                        right: 0,
                        minHeight: '6px' // Ensure minimum visible height
                      }}
                      title={`Capacity: ${projection.capacity}`}
                    ></div>
                    {/* Gap indicator (red dashed) - only when demand > capacity */}
                    {hasGap && (
                      <div 
                        className="absolute w-1/2 bg-red-200 border-2 border-red-400 border-dashed"
                        style={{ 
                          height: `${((projection.demand - projection.capacity) / maxValue) * 100}%`,
                          bottom: `${(projection.capacity / maxValue) * 100}%`,
                          left: 0
                        }}
                      ></div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 text-center">{getMonthName(projection.period)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Skill-Based Capacity Analysis */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Skill-Based Capacity Analysis</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Skill</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Total Capacity</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Available</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Current Demand</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Gap/Surplus</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Utilization</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.skillCapacity.map((skill) => {
                const gap = skill.gap;
                const utilization = skill.utilization;
                const status = skill.status;
                
                return (
                  <tr key={skill.skillId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium text-gray-900">
                      <div>
                        <div className="font-semibold">{skill.skillName}</div>
                        <div className="text-sm text-gray-500">{skill.skillCategory}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center text-gray-900">{skill.totalCapacity}h</td>
                    <td className="py-4 px-4 text-center text-gray-900">{skill.availableCapacity}h</td>
                    <td className="py-4 px-4 text-center text-gray-900">
                      <div>
                        <div className="font-medium">{skill.demand}h</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`font-medium ${
                        gap > 0 ? 'text-red-600' : gap < 0 ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {gap > 0 ? '+' : ''}{gap}h
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`h-2 rounded-full ${
                              utilization >= 90 ? 'bg-red-500' :
                              utilization >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{utilization}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        status === 'shortage' ? 'bg-red-100 text-red-800' :
                        status === 'surplus' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Capacity Recommendations</h3>
          <div className="space-y-4">
            {data.recommendations.length > 0 ? (
              data.recommendations.map((rec, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                rec.priority === 'high' ? 'bg-red-50 border-red-200' :
                rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-start">
                  {rec.priority === 'high' ? (
                    <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  )}
                  <div>
                    <h4 className={`font-medium ${
                      rec.priority === 'high' ? 'text-red-900' :
                      rec.priority === 'medium' ? 'text-yellow-900' :
                      'text-blue-900'
                    }`}>
                      {rec.message}
                    </h4>
                    <p className={`text-sm mt-1 ${
                      rec.priority === 'high' ? 'text-red-800' :
                      rec.priority === 'medium' ? 'text-yellow-800' :
                      'text-blue-800'
                    }`}>
                      Impact: {rec.impact}
                    </p>
                  </div>
                </div>
              </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p>No specific recommendations at this time.</p>
                <p className="text-sm">Your capacity planning looks well-balanced!</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Planning Timeline</h3>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900">Immediate (0-30 days)</h4>
              <p className="text-sm text-blue-800 mt-1">
                Optimize current resource allocation and identify quick wins
              </p>
            </div>
            
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-medium text-yellow-900">Short-term (1-3 months)</h4>
              <p className="text-sm text-yellow-800 mt-1">
                Begin recruitment for critical skill gaps and plan training programs
              </p>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-900">Long-term (3-6 months)</h4>
              <p className="text-sm text-green-800 mt-1">
                Scale team capacity and establish sustainable growth patterns
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}