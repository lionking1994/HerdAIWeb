import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { 
  MousePointer,
  Globe,
  Activity,
  RefreshCw,
  Clock,
  Target,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import ChartCard from '../components/ChartCard';
import { useSearchParams, useNavigate } from 'react-router-dom';

const pageNamesPerPath = {
  'dashboard': 'Dashboard',
  'meeting-list': 'Activity List',
  'meeting-detail': 
  {
    '': 'Activity Details',
    'details':'Acitivity Details',
    'participants':'Activity Participants',
    'tasks':'Activity Tasks',
  },
  'performance-cloud': 'Performance Cloud',
  'task-dashboard': 'Task Dashboard',
  'task-details': 'Task Details',
  'notification': 'Notification',
  'calendarview': 'Calendar View',
  'subscription/manage': 'Subscription Management',
  'subscription/select': 'Subscription Select',
  'profile': {
    '': 'Profile General',
    'general': 'Profile General',
    'security': 'Profile Security',
    'connections': 'Profile Connections',
    'my-agent': 'My Agents',
  },
};



interface TrackingStats {
  total_actions: number;
  page_views: number;
  clicks: number;
  mouse_movements: number;
  scrolls: number;
  keypresses: number;
  visibility_changes: number;
  unique_sessions: number;
  unique_urls: number;
  total_time_spent: number;
  avg_time_on_page?: number;
  avg_session_duration?: number;
}

interface TimeMetrics {
  averageTimeOnPage: number;
  averageTimeOnSite: number;
  totalSessions: number;
  totalPageViews: number;
  timeByPage: Record<string, number>;
  totalTimeByPage: Record<string, number>;
  totalTimeSpent: number;
}



interface Analytics {
  totalPaths: number;
  totalMouseMovements: number;
  totalClicks: number;
  pathFrequency: Record<string, number>;
  clicksByPath: Record<string, number>;
  movementsByPath: Record<string, number>;
  mostVisitedPath: string;
  mostClickedPath: string;
}

const UserAnalytics: React.FC = () => {
  const [trackingStats, setTrackingStats] = useState<TrackingStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [dateRange, setDateRange] = useState<string>('today');
  const [isLoading, setIsLoading] = useState(true);
  const [activityTimeline, setActivityTimeline] = useState<Record<string, number>>({
    '0:00': 0, '1:00': 0, '2:00': 0, '3:00': 0, '4:00': 0, '5:00': 0, '6:00': 0, '7:00': 0, '8:00': 0, '9:00': 0, '10:00': 0, '11:00': 0,
    '12:00': 0, '13:00': 0, '14:00': 0, '15:00': 0, '16:00': 0, '17:00': 0, '18:00': 0, '19:00': 0, '20:00': 0, '21:00': 0, '22:00': 0, '23:00': 0
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>('');
  const [recentClickActivity, setRecentClickActivity] = useState<{
    created_at: string;
    url: string;
    element_tag: string;
    element_id?: string;
    position_x: number;
    position_y: number;
  }[]>([]);
  const [timeMetrics, setTimeMetrics] = useState<TimeMetrics | null>(null);
  const [analyticsData, setAnalyticsData] = useState<{
    chartData: {
      topPages: { labels: string[], datasets: Array<{ label: string; data: number[]; backgroundColor: string; borderColor: string; borderWidth: number }> };
      topPagesByTime: { labels: string[], datasets: Array<{ label: string; data: number[]; backgroundColor: string; borderColor: string; borderWidth: number }> };
      monthlyAvgTime: { labels: string[], datasets: Array<{ label: string; data: number[]; backgroundColor: string; borderColor: string; borderWidth: number }> };
      topUsers: { labels: string[], datasets: Array<{ label: string; data: number[]; backgroundColor: string; borderColor: string; borderWidth: number }> };
      monthOverMonth: { labels: string[], datasets: Array<{ label: string; data: number[]; backgroundColor: string; borderColor: string; borderWidth: number; fill?: boolean; tension?: number }> };
    };
    recentClickActivity: {
      created_at: string;
      url: string;
      element_tag: string;
      element_id?: string;
      position_x: number;
      position_y: number;
    }[];
  } | null>(null);


  // Get userId from URL parameters
  const urlUserId = searchParams.get('userId');

  useEffect(() => {
    // If there's a userId in the URL, use it and fetch user details
    if (urlUserId) {
      fetchUserDetails(urlUserId);
    }
    // Initial data loading is now handled by the dateRange useEffect
  }, [urlUserId]);

  const getPageName = (path: string) => {
    try {
      // Handle both full URLs and pathnames
      let pageName: string;
      let tab: string = '';
      
      if (path.startsWith('http://') || path.startsWith('https://')) {
        // Full URL - extract pathname and query params
        const uri = new URL(path);
        pageName = uri.pathname.split('/').pop() || '';
        tab = uri.searchParams.get('tab') || '';
      } else {
        // Pathname - extract the last part
        pageName = path.split('/').pop() || path;
        tab = '';
      }
      
      const pathNameObj = pageNamesPerPath[pageName as keyof typeof pageNamesPerPath];
      console.log(pathNameObj, typeof pathNameObj)
      
      if (pathNameObj) {
        if (typeof pathNameObj === 'object') {
          return pathNameObj[tab as keyof typeof pathNameObj] || pathNameObj[''] || pageName;
        } else {
          return pathNameObj;
        }
      } else {
        return pageName || path;
      }
    } catch {
      // If URL parsing fails, return the original path
      return path;
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        if (userData.success) {
          setUserName(userData.user.name);
        }
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const loadTrackingData = async (userId?: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Prepare query parameters
      const params = new URLSearchParams();
      if (userId && userId !== 'all') {
        params.append('user_id', userId);
      }
      // Always send date_range parameter except for 'all' time
      if (dateRange && dateRange !== 'all') {
        params.append('date_range', dateRange);
      }
      
      // Single API call - backend handles filtering and analytics calculation
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user-analytics/tracking-data?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          
          setTrackingStats(result.data.stats || null);
          
          // Use analytics data from backend
          setAnalytics(result.data.analytics || {
            totalPaths: 0,
            totalMouseMovements: 0,
            totalClicks: 0,
            pathFrequency: {},
            clicksByPath: {},
            movementsByPath: {},
            mostVisitedPath: '',
            mostClickedPath: ''
          });
          setActivityTimeline(result.data.activityTimeline || {});
          // Store recent click activity from backend
          setRecentClickActivity(result.data.recentClickActivity || []);
          // Store time metrics from backend
          setTimeMetrics(result.data.timeMetrics || null);
          setAnalyticsData(result.data); // Store the full analyticsData object
        } else {
          throw new Error('Failed to fetch analytics data');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading tracking data:', error);
      // Fallback to empty data
      setTrackingStats(null);
      setAnalytics({
        totalPaths: 0,
        totalMouseMovements: 0,
        totalClicks: 0,
        pathFrequency: {},
        clicksByPath: {},
        movementsByPath: {},
        mostVisitedPath: '',
        mostClickedPath: ''
      });
    } finally {
      setIsLoading(false);
    }
  };

  
  
  useEffect(() => {
    const getDataFilteredByDateRange = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        
        // Prepare query parameters
        const params = new URLSearchParams();
        if (urlUserId && urlUserId !== 'all') {
          params.append('user_id', urlUserId);
        }
        // Always send date_range parameter except for 'all' time
        if (dateRange && dateRange !== 'all') {
          params.append('date_range', dateRange);
        }
        
        // Single API call - backend handles filtering and analytics calculation
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user-analytics/tracking-data?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result.success) {
            console.log('API Response for dateRange:', dateRange, ':', result.data);

            setTrackingStats(result.data.stats || null);
            
            // Use analytics data from backend
            setAnalytics(result.data.analytics || {
              totalPaths: 0,
              totalMouseMovements: 0,
              totalClicks: 0,
              pathFrequency: {},
              clicksByPath: {},
              movementsByPath: {},
              mostVisitedPath: '',
              mostClickedPath: ''
            });
            setActivityTimeline(result.data.activityTimeline || {});
            // Store recent click activity from backend
            setRecentClickActivity(result.data.recentClickActivity || []);
            // Store time metrics from backend
            setTimeMetrics(result.data.timeMetrics || null);
            setAnalyticsData(result.data); // Store the full analyticsData object
          } else {
            throw new Error('Failed to fetch analytics data');
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error loading tracking data:', error);
        // Fallback to empty data
        setTrackingStats(null);
        setAnalytics({
          totalPaths: 0,
          totalMouseMovements: 0,
          totalClicks: 0,
          pathFrequency: {},
          clicksByPath: {},
          movementsByPath: {},
          mostVisitedPath: '',
          mostClickedPath: ''
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    getDataFilteredByDateRange();
  }, [dateRange, urlUserId]);
  
  // Chart data functions - now using pre-calculated data from backend
  const getTopPagesByTimeChartData = () => {
    // Use pre-calculated data from backend
    if (!analyticsData?.chartData?.topPagesByTime) {
      return { labels: [], datasets: [] };
    }
    console.log('Top Pages by Time Chart Data:', analyticsData.chartData.topPagesByTime);
    return {
      labels: analyticsData.chartData.topPagesByTime.labels.map((label) => getPageName(label)),
      datasets: analyticsData.chartData.topPagesByTime.datasets
    };
  };

  const getMonthlyAvgTimeInAppChartData = () => {
    // Use pre-calculated data from backend
    if (!analyticsData?.chartData?.monthlyAvgTime) {
      return { labels: [], datasets: [] };
    }
    return analyticsData.chartData.monthlyAvgTime;
  };

  const getTopUsersByTimeChartData = () => {
    // Use pre-calculated data from backend
    if (!analyticsData?.chartData?.topUsers) {
      return { labels: [], datasets: [] };
    }
    return analyticsData.chartData.topUsers;
  };

  const getMonthOverMonthAvgTimeChartData = () => {
    // Use pre-calculated data from backend
    if (!analyticsData?.chartData?.monthOverMonth) {
      return { labels: [], datasets: [] };
    }
    return analyticsData.chartData.monthOverMonth;
  };

  const getPageVisitsAndClicksChartData = () => {
    if (!analytics) return { labels: [], datasets: [] };

    console.log('Analytics data for Page Visits and Clicks:', {
      pathFrequency: analytics.pathFrequency,
      clicksByPath: analytics.clicksByPath,
      dateRange: dateRange
    });

    const pathEntries = Object.entries(analytics.pathFrequency)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10); // Top 10 paths

    return {
      labels: pathEntries.map(([path]) => getPageName(path)),
      datasets: [
        {
          label: 'Page Visits',
          data: pathEntries.map(([,count]) => count as number),
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 1
        },
        {
          label: 'Page Clicks',
          data: pathEntries.map(([path]) => analytics.clicksByPath[path] || 0),
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 1
        }
      ]
    };
  };

  const getClicksByPageChartData = () => {
    if (!analytics) return { labels: [], datasets: [] };

    const clickEntries = Object.entries(analytics.clicksByPath)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10); // Top 10 paths
      
    return {
      labels: clickEntries.map(([path]) => getPageName(path)),
      datasets: [{
        label: 'Clicks',
        data: clickEntries.map(([,count]) => count as number),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1
      }]
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }



  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              {urlUserId && (
                <div className="flex items-center mb-2">
                  <Button
                    onClick={() => navigate('/user-management')}
                    variant="outline"
                    size="sm"
                    className="flex items-center mr-3"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Users
                  </Button>
                </div>
              )}
              <h1 className="text-3xl font-bold text-gray-900">
                {urlUserId && userName ? `${userName}'s Analytics` : 'User Analytics'}
              </h1>
              <p className="text-gray-600 mt-1">
                {urlUserId ? `Track ${userName}'s behavior and website interactions` : 'Track user behavior and website interactions'}
              </p>
              <div className="flex space-x-3">
              <Button
                onClick={() => loadTrackingData(urlUserId || undefined)}
                variant="outline"
                className="flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 bg-white"
            >
              <option value="today">Today</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trackingStats?.total_actions || 0}</div>
              <p className="text-xs text-muted-foreground">
                {trackingStats?.unique_sessions || 0} unique sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Page Views</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trackingStats?.page_views || 0}</div>
              <p className="text-xs text-muted-foreground">
                {trackingStats?.unique_urls || 0} unique URLs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Click Events</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trackingStats?.clicks || 0}</div>
              <p className="text-xs text-muted-foreground">
                {trackingStats?.mouse_movements || 0} mouse movements
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Visited</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold truncate">
                {analytics?.mostVisitedPath ? (
                  <a
                    href={analytics.mostVisitedPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline cursor-pointer"
                  >
                    {analytics.mostVisitedPath}
                  </a>
                ) : 'No data'}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics?.pathFrequency[analytics?.mostVisitedPath] || 0} visits
              </p>
            </CardContent>
          </Card>

          {/* New Cards: Avg Time in App, Avg Sessions Per User Per Day, Avg Time on Page */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Time in App</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {timeMetrics?.averageTimeOnSite ? `${Math.round(timeMetrics.averageTimeOnSite / 1000 / 60)}min ${Math.round((timeMetrics.averageTimeOnSite / 1000) % 60)}sec` : '0min 0sec'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Sessions Per User Per Day</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {/* Placeholder: replace with actual calculation if available */}
                {trackingStats?.unique_sessions ? (trackingStats.unique_sessions / (dateRange === 'today' ? 1 : 7)).toFixed(1) : '0'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Time on Page</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {timeMetrics?.averageTimeOnPage ? `${Math.round(timeMetrics.averageTimeOnPage / 1000 / 60)}min ${Math.round((timeMetrics.averageTimeOnPage / 1000) % 60)}sec` : '0min 0sec'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts: 3x2 grid for six analytics charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ChartCard title="Top Pages with Most Time (Top 5)" chartData={getTopPagesByTimeChartData()} type="bar" />
          <ChartCard title="Monthly Avg Time in App" chartData={getMonthlyAvgTimeInAppChartData()} type="bar" />
          <ChartCard title="Top 5 Users (by Time in App)" chartData={getTopUsersByTimeChartData()} type="bar" />
          <ChartCard title="Month Over Month Avg Time in App Per Person" chartData={getMonthOverMonthAvgTimeChartData()} type="line" />
          <ChartCard title="Page Visits and Page Clicks" chartData={getPageVisitsAndClicksChartData()} type="bar" />
          <ChartCard title="Clicks by Page" chartData={getClicksByPageChartData()} type="bar" />
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Recent Click Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Path
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Target
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentClickActivity.map((click, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(click.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <Badge variant="outline">
                          {click.url && click.url.length > 30 ? click.url.substring(0, 30) + '...' : click.url || 'unknown'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="font-medium">{click.element_tag || 'unknown'}</span>
                        {click.element_id && (
                          <span className="text-blue-600">#{click.element_id}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ({click.position_x}, {click.position_y})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentClickActivity.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No click data available for the selected filters.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserAnalytics; 
