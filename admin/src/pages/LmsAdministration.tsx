import React, { useState, useEffect } from 'react';
import { Plus, Edit, Upload, BarChart3, Link, FileText, X, Users, Trash2 } from 'lucide-react';
import { VideoUpload } from '../components/LmsAdmin/Video/VideoUpload.tsx';
import { VideoList } from '../components/LmsAdmin/Video/VideoList.tsx';
import { DocumentUpload } from '../components/LmsAdmin/Video/DocumentUpload.tsx';
import { DocumentList } from '../components/LmsAdmin/Video/DocumentList.tsx';
import { RoleSelector } from '../components/LmsAdmin/Course/RoleSelector.tsx';
import { useAuth } from '../contexts/AuthContext';
// import Navbar from '../components/Navbar';
import type { Course, Video, VideoDocument } from '../types';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';

export function LmsAdministration() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [videoDocuments, setVideoDocuments] = useState<VideoDocument[]>([]);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showVideoDetails, setShowVideoDetails] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'upload' | 'url'>('upload');
  const [loading, setLoading] = useState(true);
  const [updateCourseModal, setUpdateCourseModal] = useState(false);
  const [updateCourseDetailsForm, setUpdateCourseDetailsForm] = useState({ title: "", description: "" });
  const [isEditingVideo, setIsEditingVideo] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);


  useEffect(() => {
    // if (user) {
    loadCourses();
    // }
  }, [user]);

  useEffect(() => {
    if (selectedCourse) {
      loadVideos(selectedCourse.id);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedVideo) {
      loadVideoDocuments(selectedVideo.id);
    }
  }, [selectedVideo]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const uid = user?.id;
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(uid ? { 'x-user-id': uid } : {}),
      'Content-Type': 'application/json',
    };
  };

  const loadVideoDocuments = async (videoId: string) => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/videos/${videoId}/documents`, {
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error('Failed to load video documents');
      const json = await resp.json();
      setVideoDocuments(Array.isArray(json.documents) ? json.documents : []);
    } catch (error) {
      console.error('Error loading video documents:', error);
    }
  };

  const loadCourses = async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/courses?companyId=${companyId}`, {
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error('Failed to load courses');
      const json = await resp.json();
      const list = Array.isArray(json.courses) ? json.courses : [];
      setCourses(list);
      
      // Handle selectedCourse state based on available courses
      if (list.length > 0) {
        // If no course is selected, or if the selected course no longer exists, select the first one
        if (!selectedCourse || !list.find((course: Course) => course.id === selectedCourse.id)) {
          setSelectedCourse(list[0]);
        }
      } else {
        // No courses available, clear all related state
        setSelectedCourse(null);
        setVideos([]);
        setSelectedVideo(null);
        setVideoDocuments([]);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVideos = async (courseId: string) => {
    console.log("loadvideo api is callsed ----", courseId);
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/courses/${courseId}/videos`, {
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error('Failed to load course videos');
      const json = await resp.json();
      setVideos(Array.isArray(json.videos) ? json.videos : []);
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const handleCreateCourse = async (formData: FormData) => {
    const title = String(formData.get('title') ?? '');
    const description = String(formData.get('description') ?? '');

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/courses`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title, description, thumbnail_url: null,
          companyId: companyId ? parseInt(companyId) : null
        }),
      });
      if (!resp.ok) throw new Error('Failed to create course');
      const json = await resp.json();
      const created = json.course;
      setCourses(prev => (created ? [created, ...prev] : prev));
      if (created) {
        setSelectedCourse(created);
        setUpdateCourseDetailsForm({ title: created.title, description: created.description });
      };
      setShowCreateCourse(false);
    } catch (error) {
      toast.error('Failed to create course');
      console.error('Error creating course:', error);
    }
  };

  const handleUpdateCourse = async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/courses/${selectedCourse?.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: updateCourseDetailsForm.title || "", description: updateCourseDetailsForm?.description || "", thumbnail_url: null }),
      });
      if (!resp.ok) throw new Error('Failed to create course');
      const json = await resp.json();
      const updated = json.course;
      if (updated) setSelectedCourse((prev: any) => ({ ...prev, title: updated.title, description: updated.description }));
      setUpdateCourseDetailsForm({ title: updated.title, description: updated.description });
      await loadCourses();
      setUpdateCourseModal(false);
    } catch (error) {
      toast.error('Failed to update course');
      console.error('Error creating course:', error);
    }
  };

  const handleVideoUpload = async (videoUrl: any, duration: any, title: any, description: any) => {
    // debugger;
    if (!selectedCourse) return;
    console.log("duration", duration)

    try {
      if (isEditingVideo && editingVideo) {
        // Update existing video
        const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/videos/${editingVideo.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ title, description, video_url: videoUrl, duration: duration || 200 }),
        });
        if (!resp.ok) throw new Error('Failed to update video');

        // Optionally regenerate AI metadata
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/videos/${editingVideo.id}/ai-content`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ title, description }),
        });
      } else {
        // Create new video
        const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/courses/${selectedCourse.id}/videos`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ title, description, video_url: videoUrl, duration: 200 }),
        });
        if (!resp.ok) throw new Error('Failed to create video');

        // Optionally generate AI metadata server-side marker (no content fields in schema)
        const createdVideo = await resp.json();
        const videoId = createdVideo?.video?.id;
        if (videoId) {
          await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/videos/${videoId}/ai-content`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ title, description }),
          });
        }
      }

      await loadVideos(selectedCourse.id);
      await loadCourses();
      setShowVideoUpload(false);
      setShowAddVideo(false);
      setIsEditingVideo(false);
      setEditingVideo(null);
    } catch (error) {
      console.error('Error adding/updating video:', error);
    }
  };

  const handleAddVideo = async (formData: any) => {
    if (!selectedCourse) return;

    const title = formData.get('title');
    const description = formData.get('description');
    const videoUrl = formData.get('videoUrl');
    // Get video duration dynamically
    // const duration = await getVideoDuration(videoUrl);
    // console.log("duration=======", duration)
    // Use a default duration of 0 for URL videos - will be updated when video is played
    await handleVideoUpload(videoUrl, 800, title, description);
  };


  const handleDocumentUpload = async (
    documentUrl: string,
    _fileName: string,
    fileSize: number,
    fileType: string,
    title: string,
    description: string
  ) => {
    if (!selectedVideo) return;

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/videos/${selectedVideo.id}/documents`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title,
          description,
          video_url: selectedVideo.video_url,
          file_url: documentUrl,
          file_type: fileType,
          file_size: fileSize,
        }),
      });
      if (!resp.ok) throw new Error('Failed to add document');
      const json = await resp.json();
      const created = json.document;
      setVideoDocuments(prev => (created ? [...prev, created] : prev));
      setShowDocumentUpload(false);
    } catch (error) {
      console.error('Error uploading document:', error);
    }
  };

  const handleDocumentReorder = async (reorderedDocuments: VideoDocument[]) => {
    try {
      const updates = reorderedDocuments.map((doc, index) => ({ id: doc.id, order_index: index }));
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/documents/reorder`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ documents: updates }),
      });
      if (!resp.ok) throw new Error('Failed to reorder documents');
      setVideoDocuments(reorderedDocuments);
    } catch (error) {
      console.error('Error reordering documents:', error);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/documents/${documentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error('Failed to delete document');
      setVideoDocuments(prev => prev.filter(doc => doc.id !== documentId));
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleVideoReorder = async (reorderedVideos: Video[]) => {
    try {
      const updates = reorderedVideos.map((video, index) => ({ id: video.id, order_index: index }));
      const authorizeVideoId = (selectedVideo?.id) || (reorderedVideos[0]?.id);
      if (!authorizeVideoId) return;
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/videos/${authorizeVideoId}/reorder`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ newOrder: updates }),
      });
      if (!resp.ok) throw new Error('Failed to reorder videos');
      setVideos(reorderedVideos);
    } catch (error) {
      console.error('Error reordering videos:', error);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/videos/${videoId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error('Failed to delete video');
      await loadVideos(selectedCourse?.id as string);
      await loadCourses();
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  //to delete course
  const handleDeleteCourse = async (courseId: string) => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/courses/${courseId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error('Failed to delete course');
      
      // Update local state immediately for better UX
      const updatedCourses = courses.filter(course => course.id !== courseId);
      setCourses(updatedCourses);
      
      // Handle selectedCourse state after deletion
      if (selectedCourse?.id === courseId) {
        // If the deleted course was selected, select another course or clear selection
        if (updatedCourses.length > 0) {
          // Try to select the course that was after the deleted one, or the previous one
          const deletedIndex = courses.findIndex(course => course.id === courseId);
          const nextCourse = updatedCourses[deletedIndex] || updatedCourses[deletedIndex - 1] || updatedCourses[0];
          setSelectedCourse(nextCourse);
        } else {
          // No courses left, clear selection
          setSelectedCourse(null);
          setVideos([]);
          setSelectedVideo(null);
          setVideoDocuments([]);
        }
      }
      
      await loadCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Failed to delete course');
    }
  }

  const handlePublishCourse = async (courseId: string) => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/courses/${courseId}/publish`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error('Failed to publish course');
      setSelectedCourse(prev => (prev ? { ...prev, is_published: true } : null));
      await loadCourses();
    } catch (error) {
      toast.error('Failed to publish course');
      console.error('Error publishing course:', error);
    }
  };

  const handleUnPublishCourse = async (courseId: string) => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/courses/${courseId}/unpublish`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw toast.error('Failed to unpublish course');
      setSelectedCourse(prev => (prev ? { ...prev, is_published: false } : null));
      await loadCourses();
    } catch (error) {
      toast.error('Failed to unpublish course');
      console.error('Error publishing course:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="bg-[#f1f5f9] flex flex-col min-h-0 h-full">
      {/* <Navbar isAuthenticated={true} user={user?.user ?? user} /> */}
      {/* <DashboardHeader userName={user?.user?.name} onStartTour={false} showTourButton={false} /> */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Course Management</h1>
            <p className="text-gray-600">Create and manage your courses</p>
          </div>
          <button
            onClick={() => setShowCreateCourse(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>New Course</span>
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Course List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Courses</h2>
            <div className="space-y-3">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourse(course)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedCourse?.id === course.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <div className='flex items-center justify-between mb-2'>
                    <h3 className="font-medium text-gray-900 mb-1">{course.title}</h3>
                    <span 
                      className='text-red-500 p-2 hover:text-red-700 hover:bg-red-200 rounded-full cursor-pointer' 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent course selection when clicking delete
                        if (window.confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
                          handleDeleteCourse(course.id);
                        }
                      }} 
                      title="Delete Course"
                    >
                      <Trash2 size={18} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{course?.total_videos} videos</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${course.is_published
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {course.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Course Details */}
          <div className="lg:col-span-2 space-y-6">
            {selectedCourse && courses.length > 0 ? (
              <>
                {/* Course Info */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">{selectedCourse.title}</h2>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowRoleSelector(true)}
                        className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 transition-colors flex items-center space-x-1"
                        title="Manage course access roles"
                      >
                        <Users className="h-4 w-4" />
                        <span>Roles</span>
                      </button>
                      {!selectedCourse.is_published ? (
                        <button
                          onClick={() => handlePublishCourse(selectedCourse.id)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnPublishCourse(selectedCourse.id)}
                          className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors"
                        >
                          Unpublish
                        </button>
                      )}
                      <button className="text-gray-500 hover:text-gray-700" onClick={() => {
                        if (selectedCourse) {
                          setUpdateCourseDetailsForm({
                            title: selectedCourse.title || '',
                            description: selectedCourse.description || ''
                          });
                        }
                        setUpdateCourseModal(true);
                      }}
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4">{selectedCourse.description}</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-indigo-600">{videos?.length || 0}</p>
                      <p className="text-sm text-gray-500">Videos</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-indigo-600">
                        {Math.floor(selectedCourse.total_duration / 3600)}h {Math.floor((selectedCourse.total_duration % 3600) / 60)}m
                      </p>
                      <p className="text-sm text-gray-500">Duration</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-indigo-600">
                        {selectedCourse.is_published ? 'Live' : 'Draft'}
                      </p>
                      <p className="text-sm text-gray-500">Status</p>
                    </div>
                  </div>
                </div>

                {/* Videos */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Course Videos</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setUploadMethod('upload');
                          setShowVideoUpload(true);
                        }}
                        className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2 text-sm"
                      >
                        <Upload className="h-4 w-4" />
                        <span>Upload Video</span>
                      </button>
                      <button
                        onClick={() => {
                          setUploadMethod('url');
                          setShowAddVideo(true);
                        }}
                        className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2 text-sm"
                      >
                        <Link className="h-4 w-4" />
                        <span>Add URL</span>
                      </button>
                    </div>
                  </div>

                  <VideoList
                    videos={videos}
                    onReorder={handleVideoReorder}
                    onDelete={handleDeleteVideo}
                    onEdit={(video: Video) => {
                      setIsEditingVideo(true);
                      setEditingVideo(video);
                      setUploadMethod('upload');
                      setShowVideoUpload(true);
                    }}
                    onManageDocuments={(video: Video) => {
                      setSelectedVideo(video);
                      setShowVideoDetails(true);
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No course selected</h3>
                <p className="text-gray-600">Select a course from the list to manage its content.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role Selector Modal */}
      {showRoleSelector && selectedCourse && (
        <RoleSelector
          courseId={selectedCourse.id}
          onClose={() => setShowRoleSelector(false)}
          onUpdate={() => {
            loadCourses();
            setShowRoleSelector(false);
          }}
        />
      )}

      {/* Video Details Modal */}
      {showVideoDetails && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Manage Video: {selectedVideo.title}
                </h3>
                <button
                  onClick={() => {
                    setShowVideoDetails(false);
                    setSelectedVideo(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Video Info */}
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">{selectedVideo.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{selectedVideo.description}</p>
                    <div className="text-xs text-gray-500">
                      Duration: {Math.floor(selectedVideo.duration / 60)}:{(selectedVideo.duration % 60).toString().padStart(2, '0')}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowDocumentUpload(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Add Document</span>
                    </button>
                  </div>
                </div>

                {/* Documents List */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Supporting Documents</h4>
                  <DocumentList
                    documents={videoDocuments}
                    onReorder={handleDocumentReorder}
                    onDelete={handleDeleteDocument}
                    canEdit={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocumentUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Add Document</h3>
                <button
                  onClick={() => setShowDocumentUpload(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <DocumentUploadForm
                onUploadComplete={handleDocumentUpload}
                onCancel={() => setShowDocumentUpload(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      {showVideoUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isEditingVideo ? 'Edit Video' : 'Add Video to Course'}
                </h3>
                <button
                  onClick={() => setShowVideoUpload(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <VideoUploadForm
                onUploadComplete={handleVideoUpload}
                onCancel={() => {
                  setShowVideoUpload(false);
                  setIsEditingVideo(false);
                  setEditingVideo(null);
                }}
                editingVideo={isEditingVideo ? editingVideo : null}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Course</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateCourse(new FormData(e.currentTarget));
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course Title
                  </label>
                  <input
                    name="title"
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter course title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe your course"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateCourse(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Video Modal */}
      {showAddVideo && uploadMethod === 'url' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Video by URL</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleAddVideo(new FormData(e.currentTarget));
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Video Title
                  </label>
                  <input
                    name="title"
                    type="text"
                    required
                    defaultValue={editingVideo?.title || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter video title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    required
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe the video content"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Video URL
                  </label>
                  <input
                    name="videoUrl"
                    type="url"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://example.com/video.mp4"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddVideo(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Add Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {updateCourseModal && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Course</h3>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleUpdateCourse();
          }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course Title
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  value={updateCourseDetailsForm?.title || selectedCourse?.title || ''}
                  onChange={(e) => {
                    setUpdateCourseDetailsForm(prev => ({ ...prev, title: e.target.value }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter course title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  required
                  rows={3}
                  value={updateCourseDetailsForm?.description || selectedCourse?.description || ''}
                  onChange={(e) => {
                    setUpdateCourseDetailsForm(prev => ({ ...prev, description: e.target.value }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Describe your course"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => setUpdateCourseModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Update Course
              </button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  );
}


function DocumentUploadForm({ onUploadComplete, onCancel }: {
  onUploadComplete: (documentUrl: string, fileName: string, fileSize: number, fileType: string, title: string, description: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'details' | 'upload'>('details');
  const [documentDetails, setDocumentDetails] = useState<{ title: string; description: string }>({ title: '', description: '' });

  const handleDetailsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setDocumentDetails({
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
    });
    setStep('upload');
  };

  const handleUploadComplete = (documentUrl: string, fileName: string, fileSize: number, fileType: string) => {
    onUploadComplete(documentUrl, fileName, fileSize, fileType, documentDetails.title, documentDetails.description);
  };

  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-1">{documentDetails.title}</h4>
          <p className="text-sm text-gray-600">{documentDetails.description}</p>
        </div>
        <DocumentUpload
          onUploadComplete={handleUploadComplete}
          onCancel={() => setStep('details')}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleDetailsSubmit}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Document Title
          </label>
          <input
            name="title"
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter document title"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            name="description"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Describe the document content"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Next: Upload Document
        </button>
      </div>
    </form>
  );
}

function VideoUploadForm({ onUploadComplete, onCancel, editingVideo }: {
  onUploadComplete: (videoUrl: string, duration: number, title: string, description: string) => void;
  onCancel: () => void;
  editingVideo?: Video | null;
}) {
  const [step, setStep] = useState<'details' | 'upload'>('details');
  const [videoDetails, setVideoDetails] = useState<{ title: string; description: string }>({
    title: editingVideo?.title || '',
    description: editingVideo?.description || ''
  });

  const handleDetailsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setVideoDetails({
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
    });
    setStep('upload');
  };

  const handleUploadComplete = (videoUrl: string, duration: number) => {
    onUploadComplete(videoUrl, duration, videoDetails.title, videoDetails.description);
  };

  // If editing and we have video details, we can skip directly to showing existing data
  // But for video editing, we typically want to allow changing the file too
  const isEditing = !!editingVideo;

  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-1">{videoDetails.title}</h4>
          <p className="text-sm text-gray-600">{videoDetails.description}</p>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-3">
                You are editing an existing video. You can update just the title and description, or also upload a new video file.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    // Update with existing video URL
                    const duration = editingVideo?.duration || 0;
                    const videoUrl = editingVideo?.video_url || '';
                    handleUploadComplete(videoUrl, duration);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes (Keep Current Video)
                </button>
                <div className="text-sm text-gray-600 flex items-center">
                  <span>or upload a new video file below</span>
                </div>
              </div>
            </div>
            <VideoUpload
              onUploadComplete={handleUploadComplete}
              onCancel={() => setStep('details')}
            />
          </div>
        ) : (
          <VideoUpload
            onUploadComplete={handleUploadComplete}
            onCancel={() => setStep('details')}
          />
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleDetailsSubmit}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Title
          </label>
          <input
            name="title"
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter video title"
            defaultValue={editingVideo?.title || ''}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            required
            rows={3}
            defaultValue={editingVideo?.description || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Describe the video content"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {isEditing ? 'Next: Update Video' : 'Next: Upload Video'}
        </button>
      </div>
    </form>
  );
}




export default LmsAdministration;