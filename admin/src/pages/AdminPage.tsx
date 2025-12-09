// import React, { useState, useEffect } from 'react';
// import { Plus, Edit, Trash2, Upload, Brain, BarChart3, Link, FileText, X, Users } from 'lucide-react';
// import { Course, Video, VideoDocument } from '../types';
// import { adminService } from '../services/adminService';
// import { useAuth } from '../hooks/useAuth';
// import { VideoUpload } from '../components/Video/VideoUpload';
// import { VideoList } from '../components/Video/VideoList';
// import { DocumentUpload } from '../components/Video/DocumentUpload';
// import { DocumentList } from '../components/Video/DocumentList';
// // import { RoleSelector } from '../components/Course/RoleSelector';

// export function AdminPage() {
//   const { user } = useAuth();
//   const [courses, setCourses] = useState<Course[]>([]);
//   const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
//   const [videos, setVideos] = useState<Video[]>([]);
//   const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
//   const [videoDocuments, setVideoDocuments] = useState<VideoDocument[]>([]);
//   const [showCreateCourse, setShowCreateCourse] = useState(false);
//   const [showAddVideo, setShowAddVideo] = useState(false);
//   const [showVideoUpload, setShowVideoUpload] = useState(false);
//   const [showDocumentUpload, setShowDocumentUpload] = useState(false);
//   const [showVideoDetails, setShowVideoDetails] = useState(false);
//   const [showRoleSelector, setShowRoleSelector] = useState(false);
//   const [uploadMethod, setUploadMethod] = useState<'upload' | 'url'>('upload');
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     if (user) {
//       loadCourses();
//     }
//   }, [user]);

//   useEffect(() => {
//     if (selectedCourse) {
//       loadVideos(selectedCourse.id);
//     }
//   }, [selectedCourse]);

//   useEffect(() => {
//     if (selectedVideo) {
//       loadVideoDocuments(selectedVideo.id);
//     }
//   }, [selectedVideo]);

//   const loadVideoDocuments = async (videoId: string) => {
//     try {
//       const documents = await adminService.getVideoDocuments(videoId);
//       setVideoDocuments(documents);
//     } catch (error) {
//       console.error('Error loading video documents:', error);
//     }
//   };

//   const loadCourses = async () => {
//     try {
//       const coursesData = await adminService.getAdminCourses();
//       setCourses(coursesData);
//       if (coursesData.length > 0 && !selectedCourse) {
//         setSelectedCourse(coursesData[0]);
//       }
//     } catch (error) {
//       console.error('Error loading courses:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const loadVideos = async (courseId: string) => {
//     try {
//       const videosData = await adminService.getCourseVideos(courseId);
//       setVideos(videosData);
//     } catch (error) {
//       console.error('Error loading videos:', error);
//     }
//   };

//   const handleCreateCourse = async (formData: FormData) => {
//     const title = formData.get('title') as string;
//     const description = formData.get('description') as string;

//     try {
//       const newCourse = await adminService.createCourse({
//         title,
//         description
//       });

//       setCourses(prev => [newCourse, ...prev]);
//       setSelectedCourse(newCourse);
//       setShowCreateCourse(false);
//     } catch (error) {
//       console.error('Error creating course:', error);
//     }
//   };

//   const handleVideoUpload = async (videoUrl: string, duration: number, title: string, description: string) => {
//     if (!selectedCourse) return;

//     try {
//       const newVideo = await adminService.createVideo(selectedCourse.id, {
//         title,
//         description,
//         video_url: videoUrl,
//         duration
//       });

//       // Update course totals
//       await adminService.updateCourse(selectedCourse.id, {
//         title: selectedCourse.title,
//         description: selectedCourse.description,
//         thumbnail_url: selectedCourse.thumbnail_url
//       });

//       loadVideos(selectedCourse.id);
//       loadCourses();
//       setShowVideoUpload(false);
//       setShowAddVideo(false);
//     } catch (error) {
//       console.error('Error adding video:', error);
//     }
//   };

//   const handleAddVideo = async (formData: FormData) => {
//     if (!selectedCourse) return;

//     const title = formData.get('title') as string;
//     const description = formData.get('description') as string;
//     const videoUrl = formData.get('videoUrl') as string;

//     // Use a default duration of 0 for URL videos - will be updated when video is played
//     handleVideoUpload(videoUrl, 0, title, description);
//   };

//   const handleDocumentUpload = async (documentUrl: string, fileName: string, fileSize: number, fileType: string, title: string, description: string) => {
//     if (!selectedVideo) return;

//     try {
//       const newDocument = await adminService.createDocument(selectedVideo.id, {
//         title,
//         description,
//         file_url: documentUrl,
//         file_type: fileType,
//         file_size: fileSize
//       });

//       setVideoDocuments(prev => [...prev, newDocument]);
//       setShowDocumentUpload(false);
//     } catch (error) {
//       console.error('Error uploading document:', error);
//     }
//   };

//   const handleDocumentReorder = async (reorderedDocuments: VideoDocument[]) => {
//     try {
//       // Update order_index for all documents
//       const updates = reorderedDocuments.map((doc, index) => ({
//         id: doc.id,
//         order_index: index
//       }));

//       await adminService.reorderDocuments(updates);
//       setVideoDocuments(reorderedDocuments);
//     } catch (error) {
//       console.error('Error reordering documents:', error);
//     }
//   };

//   const handleDeleteDocument = async (documentId: string) => {
//     if (!confirm('Are you sure you want to delete this document?')) return;

//     try {
//       await adminService.deleteDocument(documentId);
//       setVideoDocuments(prev => prev.filter(doc => doc.id !== documentId));
//     } catch (error) {
//       console.error('Error deleting document:', error);
//     }
//   };

//   const handleVideoReorder = async (reorderedVideos: Video[]) => {
//     try {
//       // Update order_index for all videos
//       const updates = reorderedVideos.map((video, index) => ({
//         id: video.id,
//         order_index: index
//       }));

//       // Use the first video's ID for the reorder endpoint
//       if (updates.length > 0) {
//         await adminService.reorderVideos(updates[0].id, updates);
//       }
//       setVideos(reorderedVideos);
//     } catch (error) {
//       console.error('Error reordering videos:', error);
//     }
//   };

//   const handleDeleteVideo = async (videoId: string) => {
//     if (!confirm('Are you sure you want to delete this video?')) return;

//     try {
//       await adminService.deleteVideo(videoId);
//       loadVideos(selectedCourse!.id);
//       loadCourses();
//     } catch (error) {
//       console.error('Error deleting video:', error);
//     }
//   };

//   const handlePublishCourse = async (courseId: string) => {
//     try {
//       await adminService.publishCourse(courseId);
//       loadCourses();
//     } catch (error) {
//       console.error('Error publishing course:', error);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
//           <p className="text-gray-600">Loading admin panel...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         {/* Header */}
//         <div className="flex items-center justify-between mb-8">
//           <div>
//             <h1 className="text-3xl font-bold text-gray-900">Course Management</h1>
//             <p className="text-gray-600">Create and manage your courses</p>
//           </div>
//           <button
//             onClick={() => setShowCreateCourse(true)}
//             className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
//           >
//             <Plus className="h-5 w-5" />
//             <span>New Course</span>
//           </button>
//         </div>

//         <div className="grid lg:grid-cols-3 gap-8">
//           {/* Course List */}
//           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
//             <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Courses</h2>
//             <div className="space-y-3">
//               {courses.map((course) => (
//                 <button
//                   key={course.id}
//                   onClick={() => setSelectedCourse(course)}
//                   className={`w-full text-left p-3 rounded-lg border transition-colors ${
//                     selectedCourse?.id === course.id
//                       ? 'border-indigo-500 bg-indigo-50'
//                       : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
//                   }`}
//                 >
//                   <h3 className="font-medium text-gray-900 mb-1">{course.title}</h3>
//                   <div className="flex items-center justify-between text-sm text-gray-500">
//                     <span>{course.total_videos} videos</span>
//                     <span className={`px-2 py-1 rounded-full text-xs ${
//                       course.is_published 
//                         ? 'bg-green-100 text-green-800' 
//                         : 'bg-yellow-100 text-yellow-800'
//                     }`}>
//                       {course.is_published ? 'Published' : 'Draft'}
//                     </span>
//                   </div>
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* Course Details */}
//           <div className="lg:col-span-2 space-y-6">
//             {selectedCourse ? (
//               <>
//                 {/* Course Info */}
//                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
//                   <div className="flex items-center justify-between mb-4">
//                     <h2 className="text-xl font-bold text-gray-900">{selectedCourse.title}</h2>
//                     <div className="flex items-center space-x-2">
//                       <button
//                         onClick={() => setShowRoleSelector(true)}
//                         className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 transition-colors flex items-center space-x-1"
//                         title="Manage course access roles"
//                       >
//                         <Users className="h-4 w-4" />
//                         <span>Roles</span>
//                       </button>
//                       {!selectedCourse.is_published && (
//                         <button
//                           onClick={() => handlePublishCourse(selectedCourse.id)}
//                           className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors"
//                         >
//                           Publish
//                         </button>
//                       )}
//                       <button className="text-gray-500 hover:text-gray-700">
//                         <Edit className="h-5 w-5" />
//                       </button>
//                     </div>
//                   </div>
//                   <p className="text-gray-600 mb-4">{selectedCourse.description}</p>
//                   <div className="grid grid-cols-3 gap-4 text-center">
//                     <div>
//                       <p className="text-2xl font-bold text-indigo-600">{selectedCourse.total_videos}</p>
//                       <p className="text-sm text-gray-500">Videos</p>
//                     </div>
//                     <div>
//                       <p className="text-2xl font-bold text-indigo-600">
//                         {Math.floor(selectedCourse.total_duration / 3600)}h {Math.floor((selectedCourse.total_duration % 3600) / 60)}m
//                       </p>
//                       <p className="text-sm text-gray-500">Duration</p>
//                     </div>
//                     <div>
//                       <p className="text-2xl font-bold text-indigo-600">
//                         {selectedCourse.is_published ? 'Live' : 'Draft'}
//                       </p>
//                       <p className="text-sm text-gray-500">Status</p>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Videos */}
//                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
//                   <div className="flex items-center justify-between mb-4">
//                     <h3 className="text-lg font-semibold text-gray-900">Course Videos</h3>
//                     <div className="flex items-center space-x-2">
//                       <button
//                         onClick={() => {
//                           setUploadMethod('upload');
//                           setShowVideoUpload(true);
//                         }}
//                         className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2 text-sm"
//                       >
//                         <Upload className="h-4 w-4" />
//                         <span>Upload Video</span>
//                       </button>
//                       <button
//                         onClick={() => {
//                           setUploadMethod('url');
//                           setShowAddVideo(true);
//                         }}
//                         className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2 text-sm"
//                       >
//                         <Link className="h-4 w-4" />
//                         <span>Add URL</span>
//                       </button>
//                     </div>
//                   </div>

//                   <VideoList
//                     videos={videos}
//                     onReorder={handleVideoReorder}
//                     onDelete={handleDeleteVideo}
//                    onEdit={(video) => {
//                      setSelectedVideo(video);
//                      setShowVideoDetails(true);
//                    }}
//                   />
//                 </div>
//               </>
//             ) : (
//               <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
//                 <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
//                 <h3 className="text-lg font-medium text-gray-900 mb-2">No course selected</h3>
//                 <p className="text-gray-600">Select a course from the list to manage its content.</p>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//      {/* Role Selector Modal */}
//      {showRoleSelector && selectedCourse && (
//        <RoleSelector
//          courseId={selectedCourse.id}
//          onClose={() => setShowRoleSelector(false)}
//          onUpdate={() => {
//            loadCourses();
//            setShowRoleSelector(false);
//          }}
//        />
//      )}

//      {/* Video Details Modal */}
//      {showVideoDetails && selectedVideo && (
//        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
//            <div className="p-6">
//              <div className="flex items-center justify-between mb-6">
//                <h3 className="text-lg font-semibold text-gray-900">
//                  Manage Video: {selectedVideo.title}
//                </h3>
//                <button
//                  onClick={() => {
//                    setShowVideoDetails(false);
//                    setSelectedVideo(null);
//                  }}
//                  className="text-gray-400 hover:text-gray-600"
//                >
//                  <X className="h-6 w-6" />
//                </button>
//              </div>

//              <div className="grid lg:grid-cols-2 gap-6">
//                {/* Video Info */}
//                <div className="space-y-4">
//                  <div className="bg-gray-50 rounded-lg p-4">
//                    <h4 className="font-medium text-gray-900 mb-2">{selectedVideo.title}</h4>
//                    <p className="text-sm text-gray-600 mb-2">{selectedVideo.description}</p>
//                    <div className="text-xs text-gray-500">
//                      Duration: {Math.floor(selectedVideo.duration / 60)}:{(selectedVideo.duration % 60).toString().padStart(2, '0')}
//                    </div>
//                  </div>

//                  <div className="flex justify-center">
//                    <button
//                      onClick={() => setShowDocumentUpload(true)}
//                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
//                    >
//                      <FileText className="h-4 w-4" />
//                      <span>Add Document</span>
//                    </button>
//                  </div>
//                </div>

//                {/* Documents List */}
//                <div>
//                  <h4 className="font-medium text-gray-900 mb-4">Supporting Documents</h4>
//                  <DocumentList
//                    documents={videoDocuments}
//                    onReorder={handleDocumentReorder}
//                    onDelete={handleDeleteDocument}
//                    canEdit={true}
//                  />
//                </div>
//              </div>
//            </div>
//          </div>
//        </div>
//      )}

//      {/* Document Upload Modal */}
//      {showDocumentUpload && (
//        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
//            <div className="p-6">
//              <div className="flex items-center justify-between mb-6">
//                <h3 className="text-lg font-semibold text-gray-900">Add Document</h3>
//                <button
//                  onClick={() => setShowDocumentUpload(false)}
//                  className="text-gray-400 hover:text-gray-600"
//                >
//                  <X className="h-6 w-6" />
//                </button>
//              </div>

//              <DocumentUploadForm
//                onUploadComplete={handleDocumentUpload}
//                onCancel={() => setShowDocumentUpload(false)}
//              />
//            </div>
//          </div>
//        </div>
//      )}

//       {/* Video Upload Modal */}
//       {showVideoUpload && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
//             <div className="p-6">
//               <div className="flex items-center justify-between mb-6">
//                 <h3 className="text-lg font-semibold text-gray-900">Add Video to Course 5</h3>
//                 <button
//                   onClick={() => setShowVideoUpload(false)}
//                   className="text-gray-400 hover:text-gray-600"
//                 >
//                   <X className="h-6 w-6" />
//                 </button>
//               </div>

//               <VideoUploadForm
//                 onUploadComplete={handleVideoUpload}
//                 onCancel={() => setShowVideoUpload(false)}
//               />
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Create Course Modal */}
//       {showCreateCourse && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-xl max-w-md w-full p-6">
//             <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Course</h3>
//             <form onSubmit={(e) => {
//               e.preventDefault();
//               handleCreateCourse(new FormData(e.currentTarget));
//             }}>
//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Course Title
//                   </label>
//                   <input
//                     name="title"
//                     type="text"
//                     required
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
//                     placeholder="Enter course title"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Description
//                   </label>
//                   <textarea
//                     name="description"
//                     required
//                     rows={3}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
//                     placeholder="Describe your course"
//                   />
//                 </div>
//               </div>
//               <div className="flex justify-end space-x-3 mt-6">
//                 <button
//                   type="button"
//                   onClick={() => setShowCreateCourse(false)}
//                   className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
//                 >
//                   Create Course
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* Add Video Modal */}
//       {showAddVideo && uploadMethod === 'url' && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-xl max-w-md w-full p-6">
//             <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Video by URL</h3>
//             <form onSubmit={(e) => {
//               e.preventDefault();
//               handleAddVideo(new FormData(e.currentTarget));
//             }}>
//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Video Title
//                   </label>
//                   <input
//                     name="title"
//                     type="text"
//                     required
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
//                     placeholder="Enter video title"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Description
//                   </label>
//                   <textarea
//                     name="description"
//                     required
//                     rows={2}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
//                     placeholder="Describe the video content"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Video URL
//                   </label>
//                   <input
//                     name="videoUrl"
//                     type="url"
//                     required
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
//                     placeholder="https://example.com/video.mp4"
//                   />
//                 </div>
//               </div>
//               <div className="flex justify-end space-x-3 mt-6">
//                 <button
//                   type="button"
//                   onClick={() => setShowAddVideo(false)}
//                   className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
//                 >
//                   Add Video
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // Video Upload Form Component
// interface VideoUploadFormProps {
//   onUploadComplete: (videoUrl: string, duration: number, title: string, description: string) => void;
//   onCancel: () => void;
// }

// // Document Upload Form Component
// interface DocumentUploadFormProps {
//   onUploadComplete: (documentUrl: string, fileName: string, fileSize: number, fileType: string, title: string, description: string) => void;
//   onCancel: () => void;
// }

// function DocumentUploadForm({ onUploadComplete, onCancel }: DocumentUploadFormProps) {
//   const [step, setStep] = useState<'details' | 'upload'>('details');
//   const [documentDetails, setDocumentDetails] = useState({ title: '', description: '' });

//   const handleDetailsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     const formData = new FormData(e.currentTarget);
//     setDocumentDetails({
//       title: formData.get('title') as string,
//       description: formData.get('description') as string,
//     });
//     setStep('upload');
//   };

//   const handleUploadComplete = (documentUrl: string, fileName: string, fileSize: number, fileType: string) => {
//     onUploadComplete(documentUrl, fileName, fileSize, fileType, documentDetails.title, documentDetails.description);
//   };

//   if (step === 'upload') {
//     return (
//       <div className="space-y-4">
//         <div className="bg-gray-50 rounded-lg p-4">
//           <h4 className="font-medium text-gray-900 mb-1">{documentDetails.title}</h4>
//           <p className="text-sm text-gray-600">{documentDetails.description}</p>
//         </div>
//         <DocumentUpload
//           onUploadComplete={handleUploadComplete}
//           onCancel={() => setStep('details')}
//         />
//       </div>
//     );
//   }

//   return (
//     <form onSubmit={handleDetailsSubmit}>
//       <div className="space-y-4">
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-1">
//             Document Title
//           </label>
//           <input
//             name="title"
//             type="text"
//             required
//             className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
//             placeholder="Enter document title"
//           />
//         </div>
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-1">
//             Description (Optional)
//           </label>
//           <textarea
//             name="description"
//             rows={3}
//             className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
//             placeholder="Describe the document content"
//           />
//         </div>
//       </div>
//       <div className="flex justify-end space-x-3 mt-6">
//         <button
//           type="button"
//           onClick={onCancel}
//           className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
//         >
//           Cancel
//         </button>
//         <button
//           type="submit"
//           className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
//         >
//           Next: Upload Document
//         </button>
//       </div>
//     </form>
//   );
// }

// function VideoUploadForm({ onUploadComplete, onCancel }: VideoUploadFormProps) {
//   const [step, setStep] = useState<'details' | 'upload'>('details');
//   const [videoDetails, setVideoDetails] = useState({ title: '', description: '' });

//   const handleDetailsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     const formData = new FormData(e.currentTarget);
//     setVideoDetails({
//       title: formData.get('title') as string,
//       description: formData.get('description') as string,
//     });
//     setStep('upload');
//   };

//   const handleUploadComplete = (videoUrl: string, duration: number) => {
//     onUploadComplete(videoUrl, duration, videoDetails.title, videoDetails.description);
//   };

//   if (step === 'upload') {
//     return (
//       <div className="space-y-4">
//         <div className="bg-gray-50 rounded-lg p-4">
//           <h4 className="font-medium text-gray-900 mb-1">{videoDetails.title}</h4>
//           <p className="text-sm text-gray-600">{videoDetails.description}</p>
//         </div>
//         <VideoUpload
//           onUploadComplete={handleUploadComplete}
//           onCancel={() => setStep('details')}
//         />
//       </div>
//     );
//   }

//   return (
//     <form onSubmit={handleDetailsSubmit}>
//       <div className="space-y-4">
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-1">
//             Video Title
//           </label>
//           <input
//             name="title"
//             type="text"
//             required
//             className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
//             placeholder="Enter video title"
//           />
//         </div>
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-1">
//             Description
//           </label>
//           <textarea
//             name="description"
//             required
//             rows={3}
//             className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
//             placeholder="Describe the video content"
//           />
//         </div>
//       </div>
//       <div className="flex justify-end space-x-3 mt-6">
//         <button
//           type="button"
//           onClick={onCancel}
//           className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
//         >
//           Cancel
//         </button>
//         <button
//           type="submit"
//           className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
//         >
//           Next: Upload Video
//         </button>
//       </div>
//     </form>
//   );
// }