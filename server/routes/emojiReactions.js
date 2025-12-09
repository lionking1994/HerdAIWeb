const express = require('express');
const router = express.Router();
const emojiReactionController = require('../controllers/emojiReactionController');
const { authenticateToken } = require('../middleware/auth');

// Add an emoji reaction to a task thread
router.post('/add', authenticateToken, emojiReactionController.addEmojiReaction);

// Remove an emoji reaction from a task thread
router.post('/remove', authenticateToken, emojiReactionController.removeEmojiReaction);

// Get all emoji reactions for a task thread
router.get('/:threadId', authenticateToken, emojiReactionController.getEmojiReactions);

// Get all emoji reactions for multiple task threads
router.post('/multiple', authenticateToken, emojiReactionController.getMultipleThreadReactions);

module.exports = router;