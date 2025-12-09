import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, PlayCircle, CheckCircle, X } from 'lucide-react';

export function CourseCard({ course, progress = 0, isEnrolled = false, onExitCourse }) {
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const handleExitCourse = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to exit this course? Your progress will be lost.')) {
      onExitCourse?.(course.id);
    }
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {isEnrolled && onExitCourse && (
        <div className="relative">
          <button
            onClick={handleExitCourse}
            className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
            title="Exit Course"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="aspect-video bg-gradient-to-br from-indigo-500 to-purple-600 relative">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlayCircle className="h-16 w-16 text-white opacity-80" />
          </div>
        )}
        {isEnrolled && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
            <div className="w-full bg-gray-300 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-white text-xs mt-1">{Math.round(progress)}% complete</p>
          </div>
        )}
      </div>

      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{course.title}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">{course.description}</p>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center space-x-1">
            <PlayCircle className="h-4 w-4" />
            <span>{course.total_videos} videos</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(course.total_duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Link to={`/course/${course.id}`} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
            {isEnrolled ? 'Continue Learning' : 'View Course'}
          </Link>
          {isEnrolled && progress === 100 && (
            <div className="flex items-center space-x-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Completed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


