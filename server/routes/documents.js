const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const uploadFile = require('../middleware/upload_file');
const documentController = require('../controllers/documentController');

// Document comment routes
router.get('/comments/:documentId', authenticateToken, documentController.getDocumentComments);
router.post('/add-comment', authenticateToken, uploadFile.single('file'), documentController.addDocumentComment);
router.post('/update-comment', authenticateToken, documentController.updateDocumentComment);
router.post('/delete-comment', authenticateToken, documentController.deleteDocumentComment);

// User search for tagging in comments
router.get('/users/search', authenticateToken, documentController.searchUsers);

// Document section tagging routes
router.get('/section-tags/:documentId', authenticateToken, documentController.getSectionTags);

// Document highlight routes
router.post('/add-highlight', authenticateToken, documentController.addDocumentHighlight);
router.get('/highlights/:documentId', authenticateToken, documentController.getDocumentHighlights);

// Comment notification routes
router.get('/notifications', authenticateToken, documentController.getUserCommentNotifications);
router.post('/mark-notification-read', authenticateToken, documentController.markNotificationAsRead);


module.exports = router;
