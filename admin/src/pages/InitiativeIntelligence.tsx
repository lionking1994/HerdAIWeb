import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import axios from 'axios';
import { Search, Clock, DollarSign, Users, X, CheckCircle2 } from 'lucide-react';
import { Bubble } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { useSearchParams } from 'react-router-dom';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

interface Initiative {
  id: number;
  name: string;          // category name
  taskCount: number;     // x-axis
  cost: number;          // bubble size
  timeSpent: number;     // y-axis (hours)
  peopleCount: number;   // tooltip/cards
}

interface ScatterDataPoint {
  x: number;
  y: number;
  r: number;
  initiative: Initiative;
}

const PALETTE = [
  'rgba(59, 130, 246, 0.7)',   // blue-500
  'rgba(16, 185, 129, 0.7)',   // emerald-500
  'rgba(234, 179, 8, 0.7)',    // amber-500
  'rgba(244, 63, 94, 0.7)',    // rose-500
  'rgba(99, 102, 241, 0.7)',   // indigo-500
  'rgba(139, 92, 246, 0.7)',   // violet-500
  'rgba(236, 72, 153, 0.7)',   // pink-500
  'rgba(34, 197, 94, 0.7)',    // green-500
  'rgba(14, 165, 233, 0.7)',   // sky-500
  'rgba(245, 158, 11, 0.7)',   // orange-500
];

const toBorder = (rgba: string) => rgba.replace(/0\.7\)$/, '1)'); // make solid border from fill

const InitiativeIntelligence = () => {
  const selectedQuarter = useSelector((state: RootState) => state.quarter.currentQuarter);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [filteredInitiatives, setFilteredInitiatives] = useState<Initiative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams] = useSearchParams();
  const company = searchParams.get('company');

  // category color map & selection
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // quarter parsing helpers
  const getQuarterNumber = (quarterString: string): number => parseInt(quarterString.charAt(1), 10);
  const getYearFromQuarter = (quarterString: string): number => parseInt(quarterString.split('/')[1], 10);
  const isYTDQuarter = (quarterString: string): boolean => quarterString.startsWith('YTD');

  // Fetch data
  useEffect(() => {
    const fetchInitiativeData = async () => {
      if (!selectedQuarter) return;

      setIsLoading(true);
      setError(null);

      try {
        const year = getYearFromQuarter(selectedQuarter);
        const isYTD = isYTDQuarter(selectedQuarter);

        const payload: any = { year, company, isYTD };
        if (!isYTD) {
          const q = getQuarterNumber(selectedQuarter);
          if (![1, 2, 3, 4].includes(q)) {
            setError('Invalid quarter in selectedQuarter');
            setIsLoading(false);
            return;
          }
          payload.quat = q; // backend expects 'quat'
        }

        const baseUrl = import.meta.env.VITE_API_BASE_URL;
        if (!baseUrl) {
          setError('API base URL is not configured.');
          setIsLoading(false);
          return;
        }

        const response = await axios.post(
          `${baseUrl}/initiative/initiative-intelligence`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const { success, initiatives: raw } = response.data || {};

        if (!success || !Array.isArray(raw)) {
          setError('Failed to fetch initiative data');
          setInitiatives([]);
          setFilteredInitiatives([]);
          return;
        }

        // Map backend aggregation → Initiative[]
        const parsed: Initiative[] = raw.map((item: any, idx: number) => ({
          id: idx + 1,
          name: String(item.category ?? 'Uncategorized'),
          taskCount: Number(item.task_count ?? 0),
          timeSpent: Number(item.total_time_hours ?? 0),
          cost: Number(item.total_cost ?? 0),
          peopleCount: Number(item.people_count ?? 0),
        }));

        setInitiatives(parsed);
        setFilteredInitiatives(parsed);
      } catch (err) {
        console.error('Error fetching initiative data:', err);
        setError('An error occurred while fetching initiative data');
        setInitiatives([]);
        setFilteredInitiatives([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitiativeData();
  }, [company, selectedQuarter]);

  // Build stable color map whenever categories change
  useEffect(() => {
    const cats = Array.from(new Set(initiatives.map(i => i.name))).sort((a, b) =>
      a.localeCompare(b)
    );
    const map: Record<string, string> = {};
    cats.forEach((cat, idx) => {
      map[cat] = PALETTE[idx % PALETTE.length];
    });
    setCategoryColors(map);
  }, [initiatives]);

  // Category counts (for chips)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    initiatives.forEach(i => {
      counts[i.name] = (counts[i.name] || 0) + i.taskCount;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [initiatives]);

  // Apply search + category filter
  useEffect(() => {
    const s = searchTerm.trim().toLowerCase();
    const selected = new Set(selectedCategories);
    let data = initiatives;

    if (selected.size > 0) {
      data = data.filter(i => selected.has(i.name));
    }
    if (s) {
      data = data.filter(i => i.name.toLowerCase().includes(s));
    }
    setFilteredInitiatives(data);
  }, [searchTerm, initiatives, selectedCategories]);

  // Chart data
  const prepareChartData = () => {
    const data = filteredInitiatives.map(i => {
      const maxCost = Math.max(...initiatives.map(i => i.cost));
      const radius = Math.sqrt(i.cost / maxCost) * 40 + 5;
      return {
        x: i.taskCount,
        y: i.timeSpent,
        r: isFinite(radius) ? radius : 3,
        initiative: i
      } as ScatterDataPoint;
    });

    const bg = filteredInitiatives.map(i => categoryColors[i.name] || 'rgba(100,100,100,0.7)');
    const border = bg.map(toBorder);

    return {
      datasets: [
        {
          label: 'Initiatives',
          data,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
        },
      ],
    };
  };
  
  // Chart options
  const chartOptions = {
    scales: {
      x: {
        title: {
          display: true,
          text: 'Number of Tasks',
          font: { size: 14, weight: 'bold' }
        },
        beginAtZero: true,
        ticks: { precision: 0 },
        afterDataLimits: (scale: any) => {
          let tickSpacing = 1;

          // Agar stepSize manually defined hai
          if (scale.options?.ticks?.stepSize) {
            tickSpacing = scale.options.ticks.stepSize;
          }
          // Agar chart.js ne auto step calculate kiya hai
          else if (scale._defaultStepSize) {
            tickSpacing = scale._defaultStepSize;
          }
          // Fallback: approx spacing (range / 5)
          else {
            tickSpacing = (scale.max - scale.min) / 10 || 1;
          }

          scale.max = scale.max + tickSpacing; // ek aur cell add
        }
      },
      y: {
        title: {
          display: true,
          text: 'Time Spent (hours)',
          font: { size: 14, weight: 'bold' }
        },
        beginAtZero: true,
        afterDataLimits: (scale: any) => {
          let tickSpacing = 1;

          if (scale.options?.ticks?.stepSize) {
            tickSpacing = scale.options.ticks.stepSize;
          } else if (scale._defaultStepSize) {
            tickSpacing = scale._defaultStepSize;
          } else {
            tickSpacing = (scale.max - scale.min) / 5 || 1;
          }

          scale.max = scale.max + tickSpacing; // ek aur cell add
        }
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const dataPoint = context.raw as ScatterDataPoint;
            const i = dataPoint.initiative;
            return [
              `Category: ${i.name}`,
              `Tasks: ${i.taskCount}`,
              `Cost: $${i.cost.toFixed(2)}`,
              `Time: ${i.timeSpent.toFixed(2)} hours`,
              `People: ${i.peopleCount}`
            ];
          }
        }
      },
      legend: { display: false }
    },
    maintainAspectRatio: false,
  };


  const ChartSkeleton = () => (
    <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4 animate-pulse h-[500px] flex flex-col">
      <div className="h-4 bg-gray-300/20 rounded w-1/3 mb-4"></div>
      <div className="h-full bg-gray-300/20 rounded"></div>
    </div>
  );

  // Category chip component
  const CategoryChip = ({ name, count }: { name: string; count: number }) => {
    const active = selectedCategories.includes(name);
    const color = categoryColors[name] || 'rgba(100,100,100,0.7)';
    const border = toBorder(color);
    return (
      <button
        type="button"
        onClick={() => {
          setSelectedCategories(prev => {
            if (prev.includes(name)) return prev.filter(c => c !== name);
            return [...prev, name];
          });
        }}
        className={`flex items-center gap-2 px-3 py-1 rounded-full border transition
          ${active ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}
        `}
        style={{ borderColor: border, borderWidth: 1 }}
        title={`${name} (${count})`}
      >
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: color, border: `1px solid ${border}` }}
        />
        <span className="text-sm whitespace-nowrap">{name}</span>
        <span className="text-xs opacity-70">({count})</span>
        {active ? <CheckCircle2 size={14} /> : null}
      </button>
    );
  };

  const InitiativeListItem = ({ initiative }: { initiative: Initiative }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{initiative.name}</h3>
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: categoryColors[initiative.name] || 'rgba(100,100,100,0.7)' }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
          <DollarSign className="h-4 w-4 mr-1 text-green-500" />
          <span>${initiative.cost.toFixed(2)}</span>
        </div>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
          <Clock className="h-4 w-4 mr-1 text-blue-500" />
          <span>{initiative.timeSpent.toFixed(1)}h</span>
        </div>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
          <span className="mr-1 font-bold">#</span>
          <span>{initiative.taskCount} tasks</span>
        </div>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
          <Users className="h-4 w-4 mr-1 text-purple-500" />
          <span>{initiative.peopleCount} people</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex-none p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Initiative Intelligence
          </h1>
          <div className="flex w-full sm:w-96">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search categories..."
                disabled={isLoading}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 
                  border border-gray-300 dark:border-gray-600 rounded-md
                  text-sm text-gray-900 dark:text-white 
                  placeholder-gray-500 
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
                  transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category chips row */}
      <div className="flex-none px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Categories:</span>
          {categoryCounts.map(({ name, count }) => (
            <CategoryChip key={name} name={name} count={count} />
          ))}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategories(categoryCounts.map(c => c.name))}
              className="px-3 py-1 text-xs rounded-md border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              title="Select all categories"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className="px-3 py-1 text-xs rounded-md border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center gap-1"
              title="Clear selection"
            >
              <X size={12} /> Clear
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="p-6 space-y-6">
            {/* Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Initiative Scatter Chart
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Number of tasks (x), time spent (y), bubble size = cost. Colors correspond to categories.
              </p>
              <div className="h-[500px] w-full">
                {isLoading ? (
                  <ChartSkeleton />
                ) : error ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-red-500">{error}</p>
                  </div>
                ) : filteredInitiatives.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500 dark:text-gray-400">No initiative data available</p>
                  </div>
                ) : (
                  <Bubble data={prepareChartData()} options={chartOptions} />
                )}
              </div>
            </div>

            {/* Cards */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Initiative Details
              </h2>
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 animate-pulse">
                      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg">
                  {error}
                </div>
              ) : filteredInitiatives.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 p-4 rounded-lg text-center">
                  No initiatives found
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredInitiatives.map((initiative) => (
                    <InitiativeListItem key={initiative.id} initiative={initiative} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitiativeIntelligence;
