const express = require('express');
const router = express.Router();
const lmsController = require('../controllers/lmsController');
const { authenticateToken } = require('../middleware/auth');
const path = require("path");
const multer = require('multer');
const fs = require('fs');
 
//video
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      const uploadPath = path.join(process.cwd(), 'public/videos'); // absolute from project root
      if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
  },
 
  filename: (req, file, cb) => {
      const fileExt = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt}`;
      cb(null, fileName);
  }
});
 
const upload = multer({ 
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit for videos
  }
});
 
//document
const docStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(process.cwd(), 'public/documents');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const fileExt = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt}`;
      cb(null, fileName);
    }
  });
   
const uploadDoc = multer({ storage: docStorage });
 
 
router.get('/dashboard', lmsController.getDashboardData);
router.get('/dashboard/search', authenticateToken, lmsController.searchCourses);
router.post('/dashboard/exit', authenticateToken, lmsController.exitCourse);
 
//dimple's routes
// Get progress dashboard data for a course creator
// GET /api/progress/dashboard/:userId
router.get('/dashboard/:userId', lmsController.getProgressDashboard);
 
// Get progress data for a specific course
// GET /api/progress/course/:courseId
router.get('/course/:courseId', lmsController.getCourseProgress);
 
// Update student progress
// PUT /api/progress/enrollment/:enrollmentId
router.put('/enrollment/:enrollmentId', lmsController.updateStudentProgress);
 
// Get user's enrolled courses
// GET /api/progress/user/:userId/enrollments
router.get('/user/:userId/enrollments', lmsController.getUserEnrollments);
 
// NEW: Get detailed user progress including video progress
// GET /api/progress/user/:userId/course/:courseId/detailed
router.get('/user/:userId/course/:courseId/detailed', lmsController.getUserDetailedProgress);
 
// NEW: Get course analytics with video-level details
// GET /api/progress/course/:courseId/analytics
router.get('/course/:courseId/analytics', lmsController.getCourseAnalytics);
 
// Course Management Routes
router.get('/courses',authenticateToken, lmsController.getAdminCourses);
router.get('/courses/:courseId', authenticateToken, lmsController.getAdminCourseById);
router.post('/courses', authenticateToken, lmsController.createCourse);
router.put('/courses/:courseId', authenticateToken, lmsController.updateCourse);
router.delete('/courses/:courseId', authenticateToken, lmsController.deleteCourse);
router.patch('/courses/:courseId/publish', authenticateToken, lmsController.publishCourse);
router.patch('/courses/:courseId/unpublish', authenticateToken, lmsController.unpublishCourse);
// Course routes
router.get('/getCourses', lmsController.getAllCourses);
router.get('/getCourses/:courseId', lmsController.getCourseById);
router.get('/dashboard/getCourses', lmsController.getDashboardCourses);
router.get('/getCourses/:courseId/progress/:userId', lmsController.getCourseProgress2);
 
// Course enrollment and progress
router.post('/courses/enroll', lmsController.enrollInCourse2);
router.post('/courses/progress', lmsController.updateVideoProgress);
router.delete('/courses/:courseId/exit/:userId', lmsController.exitCourse2);
 
// Video Management Routes
router.get('/courses/:courseId/videos', authenticateToken, lmsController.getCourseVideos);
router.post('/courses/:courseId/videos', authenticateToken, lmsController.createVideo);
router.put('/videos/:videoId', authenticateToken, lmsController.updateVideo);
router.delete('/videos/:videoId', authenticateToken, lmsController.deleteVideo);
router.patch('/videos/:videoId/reorder', authenticateToken, lmsController.reorderVideos);
router.post('/videos/:videoId/ai-content', authenticateToken, lmsController.generateAIContent);
 
// Document Management Routes
router.get('/videos/:videoId/documents', authenticateToken, lmsController.getVideoDocuments);
router.post('/videos/:videoId/documents', authenticateToken, lmsController.createDocument);
router.put('/documents/:documentId', authenticateToken, lmsController.updateDocument);
router.delete('/documents/:documentId', authenticateToken, lmsController.deleteDocument);
router.patch('/documents/reorder', authenticateToken, lmsController.reorderDocuments);
 
router.post('/documents/upload', uploadDoc.single('document'), lmsController.uploadDocument);
 
// Role Management Routes
router.get('/courses/:courseId/roles', authenticateToken, lmsController.getCourseRoles);
router.post('/courses/:courseId/roles', authenticateToken, lmsController.assignCourseRole);
router.delete('/courses/:courseId/roles/:roleId', authenticateToken, lmsController.removeCourseRole);
router.get('/course-role-restrictions/:courseId', authenticateToken, lmsController.getCourseRoleRestrictions);
router.post('/course-role-restrictions/:courseId', authenticateToken,  lmsController.saveCourseRoleRestrictions);
 
// Analytics and Dashboard Routes
router.get('/dashboard/stats', authenticateToken, lmsController.getDashboardStats);
router.get('/dashboard/courses/:courseId/analytics', authenticateToken, lmsController.getCourseAnalytics);
router.get('/dashboard/users', authenticateToken, lmsController.getUserStats);
 
// Bulk Operations
router.post('/courses/:courseId/videos/bulk', lmsController.bulkCreateVideos);
router.post('/videos/:videoId/documents/bulk', lmsController.bulkCreateDocuments);
router.delete('/courses/:courseId/videos/bulk', lmsController.bulkDeleteVideos);
 
// Student-facing public routes (non-auth)
router.get('/public/courses/:courseId', lmsController.getPublicCourse);
// router.get('/courses/:courseId/videos',authenticateToken, lmsController.getPublicCourseVideos);
router.get('/public/videos/:videoId/documents', lmsController.getPublicVideoDocuments);
router.post('/enroll', lmsController.enrollInCourse);
router.post('/progress', lmsController.upsertProgress);
router.put('/progress', lmsController.upsertProgress);
router.get('/quizzes/:videoId', lmsController.getVideoQuiz);
router.get('/debug/user', authenticateToken, (req, res) => {
    res.json({
      tokenPayload: req.user,   // what authenticateToken has set
      headers: req.headers,     // useful to check for x-user-role, etc.
    });
  });
 
  router.post('/upload-video', upload.single('video'), lmsController.uploadVideoFile);
 
 
module.exports = router;