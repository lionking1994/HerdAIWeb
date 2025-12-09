import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Clock, CheckCircle, Lock, Brain, BookOpen, FileText } from 'lucide-react';
import { VideoPlayer } from '../components/Video/VideoPlayer';
import { QuizComponent } from '../components/Quiz/QuizComponent';
import { DocumentList } from '../components/Video/DocumentList';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export function CoursePage(user) {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const API_BASE = `${process.env.REACT_APP_API_URL}/lms`;
  const token = localStorage.getItem('token');
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  })();
  const userId = storedUser?.user?.id || storedUser?.id;

  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentVideoDocuments, setCurrentVideoDocuments] = useState([]);
  const [progress, setProgress] = useState([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [completedVideos, setCompletedVideos] = useState(new Set());
  const [forceStartFromBeginning, setForceStartFromBeginning] = useState(false);
  const [lastProgressUpdate, setLastProgressUpdate] = useState(null);


  const toAbsoluteUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    try {
      const origin = new URL(process.env.REACT_APP_API_URL).origin;
      return `${origin}${path}`;
    } catch {
      return path;
    }
  };

  useEffect(() => {
    if (courseId && userId) {
      loadCourseData();
    }
  }, [courseId, userId]);

  useEffect(() => {
    if (currentVideo) {
      loadVideoDocuments();
    }
  }, [currentVideo]);

  // Reset the force start flag after a short delay to allow the video to load
  useEffect(() => {
    if (forceStartFromBeginning) {
      const timer = setTimeout(() => {
        setForceStartFromBeginning(false);
      }, 1000); // Reset after 1 second
      return () => clearTimeout(timer);
    }
  }, [forceStartFromBeginning]);

  // Auto-enroll user if not enrolled and course exists
  useEffect(() => {
    if (course && !isEnrolled && !enrollLoading && userId && courseId) {
      handleEnroll();
    }
  }, [course, isEnrolled, enrollLoading, userId, courseId]);

  const loadVideoDocuments = async () => {
    if (!currentVideo) return;
    try {
      const resp = await fetch(`${API_BASE}/public/videos/${currentVideo.id}/documents`);
      if (!resp.ok) throw new Error('Failed to load documents');
      const json = await resp.json();
      setCurrentVideoDocuments(Array.isArray(json.documents) ? json.documents : []);
    } catch (error) {
      console.error('Error loading video documents:', error);
    }
  };

  const loadCourseData = async () => {
    try {
      const resp = await fetch(`${API_BASE}/getCourses/${courseId}?userId=${encodeURIComponent(userId || '')}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(userId ? { 'x-user-id': userId } : {}),
        },
      });
      if (!resp.ok) throw new Error('Failed to load course data');
      const data = await resp.json();

      if (data.course) setCourse(data.course);
      if (Array.isArray(data.videos)) {
        // Sort videos by order_index to ensure proper sequential order
        const sortedVideos = data.videos.sort((a, b) => {
          const aIndex = a.order_index ?? 999999; // Put videos without order_index at the end
          const bIndex = b.order_index ?? 999999;
          return aIndex - bIndex;
        });
        
        setVideos(sortedVideos);
        // if (data.videos.length > 0) setCurrentVideo(data.videos[0]);
        if (data.videos.length > 0) {
          // Map progress by videoId for quick lookup
          const progressMap = new Map(
            data.progress.map(p => [p.video_id, p.completed])
          );
      
          // Find the first video that is NOT completed
          const nextVideo = data.videos.find(video => !progressMap.get(video.id));
      
          // If all completed, fallback to the last video
          setCurrentVideo(nextVideo || data.videos[data.videos.length - 1]);
        }
      }
      setIsEnrolled(!!data.enrollment);
      const progressData = Array.isArray(data.progress) ? data.progress : [];
      setProgress(progressData);
      
      // Initialize completed videos tracking
      const completedVideoIds = progressData
        .filter(p => p.completed)
        .map(p => p.video_id);
      setCompletedVideos(new Set(completedVideoIds));
    } catch (error) {
      console.error('Error loading course data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!userId || !courseId) {
      console.error('Missing userId or courseId for enrollment');
      return;
    }
    
    try {
      setEnrollLoading(true);
      const resp = await fetch(`${API_BASE}/courses/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, courseId }),
      });
      
      if (!resp.ok) {
        const errorData = await resp.text();
        console.error('Enrollment failed:', errorData);
        throw new Error(`Enrollment failed: ${resp.status}`);
      }
      
      // Successfully enrolled
      setIsEnrolled(true);
      
    } catch (error) {
      console.error('Error enrolling in course:', error);
      // Show error message or redirect back to dashboard
      alert('Failed to enroll in course. Please try again.');
      // Optionally redirect back to dashboard
      // navigate('/lms/dashboard');
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleVideoProgress = async (currentTime, duration) => {
    if (!userId || !currentVideo || !courseId) return;
    
    // Validate input parameters
    if (typeof currentTime !== 'number' || isNaN(currentTime) || currentTime < 0) {
      console.warn('Invalid currentTime:', currentTime);
      return;
    }
    if (typeof duration !== 'number' || isNaN(duration) || duration <= 0) {
      console.warn('Invalid duration:', duration);
      return;
    }

    // Throttle progress updates - only save every 5 seconds to avoid overwhelming the API and reduce conflicts
    const now = Date.now();
    const timeSinceLastUpdate = lastProgressUpdate ? now - lastProgressUpdate : Infinity;
    const shouldUpdate = timeSinceLastUpdate >= 5000; // 5 seconds throttle (increased from 3)

    const watchPercentage = (currentTime / duration) * 100;
    const isCompleted = watchPercentage >= 90;
    
    // Don't override completion status if video was already completed via quiz
    const wasAlreadyCompleted = completedVideos.has(currentVideo.id);
    const finalCompletedStatus = wasAlreadyCompleted || isCompleted;

    // Get existing progress to preserve higher watch time
    const existingProgress = getVideoProgress(currentVideo.id);
    const existingWatchTime = existingProgress?.watch_time || 0;
    
    // For YouTube videos, be more conservative about watch time updates to prevent seeking conflicts
    const isYouTube = currentVideo.video_url?.includes('youtube.com') || currentVideo.video_url?.includes('youtu.be');
    
    // Only update watch time if it's significantly higher (more than 2 seconds) to avoid micro-updates
    const timeDifference = currentTime - existingWatchTime;
    const shouldUpdateWatchTime = timeDifference > 2 || currentTime === 0; // Allow reset to 0
    
    const finalWatchTime = shouldUpdateWatchTime ? currentTime : existingWatchTime;

    // For YouTube, be more strict about when to update
    if (isYouTube && !shouldUpdate && !finalCompletedStatus && !shouldUpdateWatchTime) {
      return; // Skip this update for YouTube unless it's been long enough or significant change
    } else if (!isYouTube && !shouldUpdate && !finalCompletedStatus) {
      return; // Original logic for non-YouTube videos
    }

    setLastProgressUpdate(now);

    const requestData = {
      userId,
      courseId,
      videoId: currentVideo.id,
      watchTime: finalWatchTime, // Frontend uses camelCase
      completed: finalCompletedStatus,
      quizScore: null,
    };



    try {
      const response = await fetch(`${API_BASE}/courses/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Progress API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Progress API failed: ${response.status}`);
      }

      const result = await response.json();

      // Use helper function for consistent state updates
      updateVideoCompletion(currentVideo.id, finalCompletedStatus, {
        watch_time: finalWatchTime // Use the higher watch time
      });
    } catch (error) {
      console.error('❌ Error updating progress:', error);
    }
  };

  const handleVideoComplete = async () => {
    if (!currentVideo) return;
    
    const completedVideoId = currentVideo.id; // Store current video ID
    
    try {
      const resp = await fetch(`${API_BASE}/quizzes/${completedVideoId}`);
      if (!resp.ok) throw new Error('Failed to load quiz');
      const json = await resp.json();
      if (json && json.quiz) {
        setCurrentQuiz(json.quiz);
        setShowQuiz(true);
      } else {
        // No quiz, mark as completed and move to next
        updateVideoCompletion(completedVideoId, true);
        moveToNextVideo();
      }
    } catch (error) {
      console.error('Error loading quiz:', error);
      // Mark as completed even if quiz loading fails
      updateVideoCompletion(completedVideoId, true);
      moveToNextVideo();
    }
  };

  const handleQuizComplete = async (score) => {
    if (!userId || !currentVideo || !courseId) return;
    
    const completedVideoId = currentVideo.id; // Store current video ID before it changes
    
    try {
      await fetch(`${API_BASE}/courses/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          userId,
          courseId,
          videoId: completedVideoId,
          watchTime: 0,
          completed: true,
          quizScore: score,
        }),
      });
      
      // Use helper function to ensure consistent state updates
      updateVideoCompletion(completedVideoId, true, {
        quiz_score: score,
        watch_time: 0
      });
      
      setShowQuiz(false);
      moveToNextVideo();
    } catch (error) {
      console.error('Error saving quiz score:', error);
    }
  };

  const moveToNextVideo = () => {
    if (!currentVideo) return;

    const currentIndex = videos.findIndex(v => v.id === currentVideo.id);
    if (currentIndex < videos.length - 1) {
      setCurrentVideo(videos[currentIndex + 1]);
    }
  };

  const selectVideo = (video) => {
    setCurrentVideo(video);
    setShowQuiz(false);
    setForceStartFromBeginning(true); // Force video to start from beginning when manually selected
  };

  const getVideoProgress = (videoId) => {
    const progressData = progress.find(p => p.video_id === videoId);
    return progressData;
  };

  // Helper function to update both progress states consistently
  const updateVideoCompletion = (videoId, isCompleted, additionalData = {}) => {
    const video = videos.find(v => v.id === videoId);
    
    if (isCompleted) {
      setCompletedVideos(prev => new Set([...prev, videoId]));
    }
    
    setProgress(prev => {
      const existing = prev.find(p => p.video_id === videoId);
      if (existing) {
        return prev.map(p =>
          p.video_id === videoId
            ? { ...p, completed: isCompleted, ...additionalData }
            : p
        );
      } else if (isCompleted) {
        return [...prev, {
          id: '',
          user_id: userId,
          course_id: courseId,
          video_id: videoId,
          completed: isCompleted,
          last_watched_at: new Date().toISOString(),
          ...additionalData
        }];
      }
      return prev;
    });
  };

  const isVideoCompleted = (videoId) => {
    // Check both progress array and completedVideos set for consistency
    const videoProgress = getVideoProgress(videoId);
    const isInCompletedSet = completedVideos.has(videoId);
    const result = videoProgress?.completed || isInCompletedSet;
    
    // Debug specific videos (first few)
    const video = videos.find(v => v.id === videoId);
    if (video && video.order_index < 3) {
      console.log(`✅ Completion check for "${video.title}" (order ${video.order_index}):`, {
        videoId,
        progressCompleted: videoProgress?.completed,
        watchTime: videoProgress?.watch_time,
        inCompletedSet: isInCompletedSet,
        finalResult: result
      });
    }
    
    return result;
  };

  const isVideoUnlocked = (video) => {
    // Find the current video's position in the sorted array
    const currentVideoIndex = videos.findIndex(v => v.id === video.id);
    
    // Always unlock the first video (by array position, not order_index)
    if (currentVideoIndex === 0) return true;
    
    // Always unlock completed videos (if CheckCircle is showing, it should be accessible)
    if (isVideoCompleted(video.id)) return true;

    // For incomplete videos, check if previous video is completed
    // Find the actual previous video by array position
    const previousVideo = currentVideoIndex > 0 ? videos[currentVideoIndex - 1] : null;
    const isPreviousCompleted = previousVideo ? isVideoCompleted(previousVideo.id) : false;
    
    // Debug for first few videos
    if (video.order_index < 5) { // Increased to see more videos
      console.log(`🔓 Unlock check for "${video.title}" (order ${video.order_index}):`, {
        videoId: video.id,
        orderIndex: video.order_index,
        currentVideoIndex,
        isVideoCompleted: isVideoCompleted(video.id),
        previousVideo: previousVideo ? {
          id: previousVideo.id,
          title: previousVideo.title,
          orderIndex: previousVideo.order_index,
          arrayIndex: currentVideoIndex - 1,
          isCompleted: isVideoCompleted(previousVideo.id)
        } : null,
        isPreviousCompleted,
        finalUnlockResult: isPreviousCompleted
      });
    }
    
    return isPreviousCompleted;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Course not found</h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-indigo-600 hover:text-indigo-500"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show loading while auto-enrolling
  if (!isEnrolled && (enrollLoading || !course)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {enrollLoading ? 'Enrolling in course...' : 'Loading course...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container flex flex-col h-screen">
      <Navbar
        isAuthenticated={true}
        user={user.user}
      />
      <div className="w-full overflow-auto flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Video Player */}
              {currentVideo && !showQuiz ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <VideoPlayer
                    src={currentVideo.video_url}
                    title={currentVideo.title}
                    onProgress={handleVideoProgress}
                    onComplete={handleVideoComplete}
                    initialTime={(() => {
                      const initialTime = forceStartFromBeginning ? 0 : (getVideoProgress(currentVideo.id)?.watch_time || 0);
                      return initialTime;
                    })()}
                  />
                  <div className="p-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentVideo.title}</h2>
                    <p className="text-gray-600 mb-4">{currentVideo.description}</p>

                    {/* {currentVideo.ai_summary && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Brain className="h-5 w-5 text-blue-600" />
                          <h3 className="font-medium text-blue-900">AI Summary</h3>
                        </div>
                        <p className="text-blue-800 text-sm">{currentVideo.ai_summary}</p>
                      </div>
                    )}

                    {currentVideo.key_points && currentVideo.key_points.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <BookOpen className="h-5 w-5 text-green-600" />
                          <h3 className="font-medium text-green-900">Key Points</h3>
                        </div>
                        <ul className="space-y-2">
                          {currentVideo.key_points.map((point, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span className="text-green-800 text-sm">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )} */}

                    {/* Supporting Documents */}
                    {currentVideoDocuments.length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <FileText className="h-5 w-5 text-gray-600" />
                          <h3 className="font-medium text-gray-900">Supporting Documents</h3>
                        </div>
                        <DocumentList
                          documents={currentVideoDocuments}
                          onReorder={() => { }} // Read-only for students
                          onDelete={() => { }} // Read-only for students
                          canEdit={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) :
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-12 h-12 text-indigo-500"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h2 className="text-lg font-semibold text-gray-800">
                      Video Coming Soon
                    </h2>
                    <p className="text-gray-500 text-sm max-w-sm">
                      The instructor is preparing the video content. Please check back later
                      for updates.
                    </p>
                  </div>
                </div>
              }

              {/* Quiz */}
              {showQuiz && currentQuiz ? (
                <QuizComponent
                  quiz={currentQuiz}
                  onComplete={handleQuizComplete}
                />
              ) : null}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Course Info */}
              {currentVideo ?
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{course.title}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                                              <span className="font-medium">
                         {Math.min(100, Math.round((progress.filter(p => p.completed).length / videos.length) * 100))}%
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                                style={{
                           width: `${Math.min(100, (progress.filter(p => p.completed).length / videos.length) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div> 
                : null
              }

              {/* Video List */}
              {currentVideo ? <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Content</h3>
                <div className="space-y-2">
                  {videos.map((video, index) => {
                    const isCompleted = isVideoCompleted(video.id);
                    const isUnlocked = isVideoUnlocked(video);
                    const isCurrent = currentVideo?.id === video.id;
                    
                    // Temporary debugging for icon issue
                    if (index < 3) { // Only log first 3 videos to avoid spam
                      console.log(`🎯 Video ${index + 1} (${video.title}):`, {
                        id: video.id,
                        orderIndex: video.order_index,
                        isCompleted,
                        isUnlocked,
                        isCurrent,
                        expectedIcon: isCompleted ? 'CheckCircle' : isUnlocked ? 'Play' : 'Lock'
                      });
                    }
                    
                    return (
                      <button
                        key={video.id}
                        onClick={() => isUnlocked && selectVideo(video)}
                        disabled={!isUnlocked}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${isCurrent
                          ? 'border-indigo-500 bg-indigo-50'
                          : isUnlocked
                            ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : isUnlocked ? (
                              <Play className="h-5 w-5 text-gray-400" />
                            ) : (
                              <Lock className="h-5 w-5 text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isUnlocked ? 'text-gray-900' : 'text-gray-400'
                              }`}>
                              {index + 1}. {video.title}
                            </p>
                            <p className={`text-xs ${isUnlocked ? 'text-gray-500' : 'text-gray-300'
                              }`}>
                              {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div> : null}

            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}