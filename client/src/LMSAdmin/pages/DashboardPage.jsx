import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, Clock, TrendingUp, Search, X } from 'lucide-react';
import { CourseCard } from '../components/Course/CourseCard';
import DashboardHeader from '../../components/DashboardHeader';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export function DashboardPage({ user }) {
  // Properly destructure user from props
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  // Utility function to deduplicate courses by ID
  const deduplicateCourses = (courseList) => {
    return courseList.filter((course, index, self) => 
      index === self.findIndex((c) => c.id === course.id)
    );
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim() && searchQuery.trim().length >= 2) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 300); // Add 300ms debounce to prevent too many API calls

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const performSearch = async (query) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const userId = user?.user?.id || user?.id;
      
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/lms/dashboard/search?q=${encodeURIComponent(query.trim())}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(userId ? { 'x-user-id': userId } : {}),
        },
      });
      
      if (!resp.ok) {
        throw new Error(`Search request failed with status: ${resp.status}`);
      }
      
      const results = await resp.json();
      
      // Ensure results is always an array and deduplicate
      const coursesArray = Array.isArray(results) ? results : [];
      setSearchResults(deduplicateCourses(coursesArray));
      
    } catch (error) {
      console.error('Error searching courses:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = user?.user?.id || user?.id;
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/lms/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        cache: 'no-store',
      });
      if (!resp.ok) throw new Error('Failed to load dashboard data');
      const data = await resp.json();
      setEnrollments(Array.isArray(data.enrollments) ? data.enrollments : []);
      
      // Deduplicate courses by ID to prevent any duplicates from backend
      const coursesArray = Array.isArray(data.courses) ? data.courses : [];
      const uniqueCourses = coursesArray.filter((course, index, self) => 
        index === self.findIndex((c) => c.id === course.id)
      );
      setCourses(uniqueCourses);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create enrollment lookup for better performance
  const enrollmentLookup = new Set(enrollments.map(e => e.course_id));
  
  // Filter and deduplicate enrolled courses
  const enrolledCourses = deduplicateCourses(
    courses.filter(course => enrollmentLookup.has(course.id))
  );

  // Filter and deduplicate available courses (not enrolled)
  const availableCourses = deduplicateCourses(
    courses.filter(course => !enrollmentLookup.has(course.id))
  );

  const getEnrollmentProgress = (courseId) => {
    const enrollment = enrollments.find(e => e.course_id === courseId);
    const progress = enrollment?.progress_percentage || 0;
    // Cap progress at 100% to handle any legacy incorrect data
    return Math.min(100, Math.max(0, progress));
  };

  const handleExitCourse = async (courseId) => {
    try {
      const token = localStorage.getItem('token');
      const userId = user?.user?.id || user?.id;
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/lms/dashboard/exit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        body: JSON.stringify({ courseId }),
      });
      if (!resp.ok) throw new Error('Exit course failed');
      // Update local state immediately for better UX
      setEnrollments((prev) => prev.filter((e) => e.course_id !== courseId));
    } catch (error) {
      console.error('Error exiting course:', error);
      alert('Failed to exit course. Please try again.');
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container flex flex-col h-screen">
      <Navbar
        isAuthenticated={true}
        user={user}
      />
      <div className="w-full overflow-auto flex-1">
        <DashboardHeader userName={user?.user?.name} onStartTour={false} showTourButton={false} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {user?.name || 'Learner'}!
            </h1>
            {/* <p className="text-gray-600">Continue your learning journey</p> */}

            {/* Search Bar */}
            <div className="mt-6 max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Search courses... (minimum 2 characters)"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="bg-indigo-100 rounded-lg p-3">
                  <BookOpen className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Enrolled Courses</p>
                  <p className="text-2xl font-bold text-gray-900">{enrolledCourses.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-lg p-3">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {enrollments.filter(e => e.completed_at).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="bg-orange-100 rounded-lg p-3">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">In Progress</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {enrollments.filter(e => !e.completed_at && e.progress_percentage > 0).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Search Results for "{searchQuery}"
                </h2>
                {isSearching && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    <span className="text-sm">Searching...</span>
                  </div>
                )}
              </div>

              {!isSearching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
                  <p className="text-gray-600">
                    Try adjusting your search terms or browse available courses below.
                  </p>
                </div>
              )}

              {!isSearching && searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Type at least 2 characters</h3>
                  <p className="text-gray-600">
                    Enter at least 2 characters to start searching for courses.
                  </p>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.map((course) => (
                    <CourseCard
                      key={`search-${course.id}`}
                      course={course}
                      progress={getEnrollmentProgress(course.id)}
                      isEnrolled={enrollments.some(e => e.course_id === course.id)}
                      onExitCourse={handleExitCourse}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Continue Learning Section */}
          {!searchQuery && enrolledCourses.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Continue Learning</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrolledCourses.map((course) => (
                  <CourseCard
                    key={`enrolled-${course.id}`}
                    course={course}
                    progress={getEnrollmentProgress(course.id)}
                    isEnrolled={true}
                    onExitCourse={handleExitCourse}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available Courses Section */}
          {!searchQuery && availableCourses.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Discover New Courses</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableCourses.slice(0, 6).map((course) => (
                  <CourseCard
                    key={`available-${course.id}`}
                    course={course}
                    isEnrolled={false}
                  />
                ))}
              </div>
              {availableCourses.length > 6 && (
                <div className="text-center mt-8">
                  <Link
                    to="/lms/courses"
                    className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    View All Courses
                  </Link>
                </div>
              )}
            </div>
          )}
          {/* Empty State */}
          {!searchQuery && enrolledCourses.length === 0 && availableCourses.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No courses available</h3>
              <p className="text-gray-600 mb-6">
                Get started by exploring our course catalog or creating your first course.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/lms/admin"
                  className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create Course
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}


