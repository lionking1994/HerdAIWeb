import { useState, useEffect } from 'react';
import { ArrowLeft, Star, TrendingUp, AlertTriangle, Users, Target, Search, Download } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface SkillsGapViewProps {
  onBack: () => void;
}

export default function SkillsGapView({ onBack }: SkillsGapViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [gapFilter, setGapFilter] = useState('all');
  const [skillGaps, setSkillGaps] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');

  console.log('SkillsGapView component mounted');
  console.log('Company ID from URL:', companyId);

  // Fetch skills gap analysis from API on component mount
  useEffect(() => {
    console.log('Component mounted, fetching data...');
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        
        console.log('Token:', token ? 'Found' : 'Not found');
        console.log('Company ID from URL:', companyId);
        
        if (!companyId) {
          console.error('Company ID not found in URL parameters');
          setIsLoading(false);
          return;
        }

        const params = new URLSearchParams({
          category: 'all',
          search: '',
          page: '1',
          limit: '100'
        });

        const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/psa/reports/skills-gap/${companyId}?${params}`;
        console.log('API URL:', apiUrl);

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        console.log('API Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('API Response data:', data);
          if (data.success) {
            setSkillGaps(data.data.skillGaps);
            setSummary(data.data.summary);
            setCategories(data.data.filters.categories);
          }
        } else {
          const errorData = await response.json();
          console.error('API Error:', errorData);
        }
      } catch (error) {
        console.error('Error fetching skills gap analysis:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [companyId]); // Run when companyId changes

  // Fetch skills gap analysis from API when filters change
  useEffect(() => {
    if (!companyId) return; // Don't fetch if no companyId
    
    const fetchSkillsGapAnalysis = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        
        if (!companyId) {
          console.error('Company ID not found');
          setIsLoading(false);
          return;
        }

        const params = new URLSearchParams({
          category: categoryFilter,
          search: searchTerm,
          page: '1',
          limit: '100'
        });

        console.log('Fetching skills gap analysis for company:', companyId);
        console.log('API URL:', `${import.meta.env.VITE_API_BASE_URL}/psa/reports/skills-gap/${companyId}?${params}`);

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/reports/skills-gap/${companyId}?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        console.log('API Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('API Response data:', data);
          if (data.success) {
            setSkillGaps(data.data.skillGaps);
            setSummary(data.data.summary);
            setCategories(data.data.filters.categories);
          }
        } else {
          const errorData = await response.json();
          console.error('API Error:', errorData);
        }
      } catch (error) {
        console.error('Error fetching skills gap analysis:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkillsGapAnalysis();
  }, [companyId, categoryFilter, searchTerm]);

  // Filter skill gaps based on gap severity (search and category filtering is done on backend)
  const filteredGaps = skillGaps.filter(skill => {
    const matchesGap = gapFilter === 'all' || 
      (gapFilter === 'critical' && skill.severity === 'critical') ||
      (gapFilter === 'high' && skill.severity === 'high') ||
      (gapFilter === 'surplus' && skill.severity === 'surplus');
    
    return matchesGap;
  });
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'surplus': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const exportData = () => {
    console.log('Exporting skills gap analysis...');
    alert('Skills gap analysis exported successfully!');
  };

  // Summary statistics from API
  const criticalGaps = summary.criticalGaps || 0;
  const highGaps = summary.highGaps || 0;
  const surplusSkills = summary.surplusSkills || 0;
  const totalGap = summary.totalGap || 0;

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
            <Star className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Skills Gap Analysis</h2>
              <p className="text-gray-600">Identify skill shortages and training opportunities</p>
            </div>
          </div>
        </div>
        <button 
          onClick={exportData}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Analysis
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical Gaps</p>
              <p className="text-2xl font-bold text-red-600">{criticalGaps}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Priority Gaps</p>
              <p className="text-2xl font-bold text-orange-600">{highGaps}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Surplus Skills</p>
              <p className="text-2xl font-bold text-green-600">{surplusSkills}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Gap</p>
              <p className="text-2xl font-bold text-purple-600">{totalGap}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Analysis */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-4">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <select
              value={gapFilter}
              onChange={(e) => setGapFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Gaps</option>
              <option value="critical">Critical</option>
              <option value="high">High Priority</option>
              <option value="surplus">Surplus</option>
            </select>
          </div>
        </div>

        {/* Skills Gap Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading skills gap analysis...</p>
              </div>
            </div>
          ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Skill</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Category</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Demand</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Supply</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Gap</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Avg Proficiency</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Severity</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {filteredGaps.map(skill => (
                <tr key={skill.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                        <Star className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{skill.name}</p>
                        <p className="text-sm text-gray-600">{skill.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-lg text-sm">
                      {skill.category}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center font-medium text-gray-900">{skill.demand}</td>
                  <td className="py-4 px-4 text-center font-medium text-gray-900">{skill.supply}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`font-medium ${skill.gap > 0 ? 'text-red-600' : skill.gap < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                      {skill.gap > 0 ? '+' : ''}{skill.gap}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${(skill.avgProficiency / 5) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{skill.avgProficiency.toFixed(1)}/5</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(skill.severity)}`}>
                      {skill.severity.charAt(0).toUpperCase() + skill.severity.slice(1)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center text-sm">
                    {skill.severity === 'critical' && 'Urgent hiring needed'}
                    {skill.severity === 'high' && 'Plan recruitment'}
                    {skill.severity === 'medium' && 'Training opportunity'}
                    {skill.severity === 'surplus' && 'Consider reallocation'}
                    {skill.severity === 'low' && 'Monitor demand'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Actions</h3>
          <div className="space-y-4">
            {skillGaps.filter(s => s.severity === 'critical').slice(0, 3).map(skill => (
              <div key={skill.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-900">{skill.name}</h4>
                <p className="text-sm text-red-800 mt-1">
                  Critical shortage: {skill.gap} additional resources needed
                </p>
              </div>
            ))}
            
            {skillGaps.filter(s => s.severity === 'high').slice(0, 2).map(skill => (
              <div key={skill.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <h4 className="font-medium text-orange-900">{skill.name}</h4>
                <p className="text-sm text-orange-800 mt-1">
                  High priority: Plan recruitment for {skill.gap} resources
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Opportunities</h3>
          <div className="space-y-4">
            {skillGaps.filter(s => s.supply > 0 && s.avgProficiency < 4).slice(0, 5).map(skill => (
              <div key={skill.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900">{skill.name}</h4>
                <p className="text-sm text-blue-800 mt-1">
                  {skill.supply} resources could benefit from advanced training
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}