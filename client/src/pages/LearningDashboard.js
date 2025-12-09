import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaGraduationCap, FaCheckCircle, FaSpinner, FaPlay, FaSearch } from 'react-icons/fa';
import './LearningDashboard.css';

const LearningDashboard = () => {
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [completedCourses, setCompletedCourses] = useState([]);
  const [inProgressCourses, setInProgressCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/courses/user`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // For now, we'll use sample data since the API might not be implemented yet
      const sampleData = {
        enrolled: [
          {
            id: 1,
            title: 'GetHerd Introduction',
            description: 'This course introduces new users to GetHerd',
            progress: 0,
            thumbnail: '/course-thumbnails/getherd-intro.jpg',
            videoCount: 1,
            duration: '2m',
            status: 'in_progress'
          }
        ],
        available: [
          {
            id: 2,
            title: 'Advanced Features',
            description: 'Learn about advanced features and capabilities of the platform',
            thumbnail: '/course-thumbnails/advanced-features.jpg',
            videoCount: 5,
            duration: '25m',
            status: 'available'
          },
          {
            id: 3,
            title: 'Productivity Tips',
            description: 'Maximize your productivity with these essential tips',
            thumbnail: '/course-thumbnails/productivity.jpg',
            videoCount: 3,
            duration: '15m',
            status: 'available'
          }
        ],
        completed: []
      };

      // Use API data when available, otherwise use sample data
      const coursesData = response.data?.courses || sampleData;
      
      setEnrolledCourses(coursesData.enrolled || []);
      setAvailableCourses(coursesData.available || []);
      setCompletedCourses(coursesData.completed || []);
      
      // Filter in-progress courses
      setInProgressCourses(
        (coursesData.enrolled || []).filter(course => course.progress > 0 && course.progress < 100)
      );
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Failed to fetch courses');
      
      // Use sample data if API fails
      setEnrolledCourses([
        {
          id: 1,
          title: 'GetHerd Introduction',
          description: 'This course introduces new users to GetHerd',
          progress: 0,
          thumbnail: '/course-thumbnails/getherd-intro.jpg',
          videoCount: 1,
          duration: '2m',
          status: 'in_progress'
        }
      ]);
      
      setAvailableCourses([
        {
          id: 2,
          title: 'Advanced Features',
          description: 'Learn about advanced features and capabilities of the platform',
          thumbnail: '/course-thumbnails/advanced-features.jpg',
          videoCount: 5,
          duration: '25m',
          status: 'available'
        },
        {
          id: 3,
          title: 'Productivity Tips',
          description: 'Maximize your productivity with these essential tips',
          thumbnail: '/course-thumbnails/productivity.jpg',
          videoCount: 3,
          duration: '15m',
          status: 'available'
        }
      ]);
      
      setCompletedCourses([]);
      setInProgressCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueCourse = (courseId) => {
    // Navigate to course content page
    window.location.href = `/course/${courseId}`;
  };

  const handleEnrollCourse = async (courseId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/courses/enroll`,
        { courseId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      toast.success('Successfully enrolled in course');
      fetchCourses(); // Refresh course data
    } catch (error) {
      console.error('Error enrolling in course:', error);
      toast.error('Failed to enroll in course');
      
      // For demo purposes, move the course from available to enrolled
      const course = availableCourses.find(c => c.id === courseId);
      if (course) {
        course.progress = 0;
        course.status = 'in_progress';
        setEnrolledCourses([...enrolledCourses, course]);
        setAvailableCourses(availableCourses.filter(c => c.id !== courseId));
      }
    }
  };

  const filteredAvailableCourses = availableCourses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="learning-dashboard">
      <div className="learning-dashboard-header">
        <h1>Learning Dashboard</h1>
        <p>Continue your learning journey with GetHerd</p>
      </div>

      {loading ? (
        <div className="loading-container">
          <FaSpinner className="spinner" />
          <p>Loading courses...</p>
        </div>
      ) : (
        <>
          {/* Progress Summary */}
          <div className="progress-summary">
            <div className="progress-card">
              <div className="progress-icon enrolled">
                <FaGraduationCap />
              </div>
              <div className="progress-details">
                <h3>Enrolled Courses</h3>
                <p className="progress-count">{enrolledCourses.length}</p>
              </div>
            </div>
            
            <div className="progress-card">
              <div className="progress-icon in-progress">
                <FaSpinner />
              </div>
              <div className="progress-details">
                <h3>In Progress</h3>
                <p className="progress-count">{inProgressCourses.length}</p>
              </div>
            </div>
            
            <div className="progress-card">
              <div className="progress-icon completed">
                <FaCheckCircle />
              </div>
              <div className="progress-details">
                <h3>Completed</h3>
                <p className="progress-count">{completedCourses.length}</p>
              </div>
            </div>
          </div>

          {/* Continue Learning Section */}
          {enrolledCourses.length > 0 && (
            <div className="dashboard-section">
              <h2>Continue Learning</h2>
              <div className="courses-grid">
                {enrolledCourses.map(course => (
                  <div key={course.id} className="course-card">
                    <div className="course-thumbnail">
                      {course.thumbnail ? (
                        <img src={course.thumbnail} alt={course.title} />
                      ) : (
                        <div className="default-thumbnail">
                          <FaGraduationCap />
                        </div>
                      )}
                      <div className="course-progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${course.progress || 0}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="course-details">
                      <h3>{course.title}</h3>
                      <p>{course.description}</p>
                      <div className="course-meta">
                        <span>{course.videoCount} videos</span>
                        <span>{course.duration}</span>
                      </div>
                      <button 
                        className="continue-button"
                        onClick={() => handleContinueCourse(course.id)}
                      >
                        <FaPlay /> Continue Learning
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Courses Section */}
          <div className="dashboard-section">
            <div className="section-header">
              <h2>Available Courses</h2>
              <div className="search-container">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
            
            {filteredAvailableCourses.length > 0 ? (
              <div className="courses-grid">
                {filteredAvailableCourses.map(course => (
                  <div key={course.id} className="course-card">
                    <div className="course-thumbnail">
                      {course.thumbnail ? (
                        <img src={course.thumbnail} alt={course.title} />
                      ) : (
                        <div className="default-thumbnail">
                          <FaGraduationCap />
                        </div>
                      )}
                    </div>
                    <div className="course-details">
                      <h3>{course.title}</h3>
                      <p>{course.description}</p>
                      <div className="course-meta">
                        <span>{course.videoCount} videos</span>
                        <span>{course.duration}</span>
                      </div>
                      <button 
                        className="enroll-button"
                        onClick={() => handleEnrollCourse(course.id)}
                      >
                        Enroll Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-courses">
                <p>No courses match your search criteria.</p>
              </div>
            )}
          </div>

          {/* Completed Courses Section */}
          {completedCourses.length > 0 && (
            <div className="dashboard-section">
              <h2>Completed Courses</h2>
              <div className="courses-grid">
                {completedCourses.map(course => (
                  <div key={course.id} className="course-card completed-course">
                    <div className="course-thumbnail">
                      {course.thumbnail ? (
                        <img src={course.thumbnail} alt={course.title} />
                      ) : (
                        <div className="default-thumbnail">
                          <FaGraduationCap />
                        </div>
                      )}
                      <div className="completed-badge">
                        <FaCheckCircle />
                      </div>
                    </div>
                    <div className="course-details">
                      <h3>{course.title}</h3>
                      <p>{course.description}</p>
                      <div className="course-meta">
                        <span>{course.videoCount} videos</span>
                        <span>{course.duration}</span>
                      </div>
                      <button 
                        className="review-button"
                        onClick={() => handleContinueCourse(course.id)}
                      >
                        Review Course
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LearningDashboard;

