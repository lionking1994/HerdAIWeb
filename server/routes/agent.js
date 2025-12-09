const express = require('express')
const router = express.Router()
const { authenticateToken, verifyApiKey } = require('../middleware/auth')

const agentController = require('../controllers/agentController')

router.get(
  '/remind/task',
  authenticateToken,
  agentController.getAllAssignedTask
)
router.get('/history', authenticateToken, agentController.getChatHistory)
router.post('/message', authenticateToken, agentController.saveMessage)
router.get('/sessionid', authenticateToken, agentController.getSessionId)
router.put(
  '/refresh-session',
  authenticateToken,
  agentController.refreshSession
)
router.post(
  '/upcoming-meeting-alert-check',
  authenticateToken,
  agentController.upcomingMeetingAlertCheck
)
router.post(
  '/parse-meeting-data',
  authenticateToken,
  agentController.parseMeetingData
)
router.get(
  '/available-voices',
  authenticateToken,
  agentController.getAvailableVoices
)

// Add new agent update routes
router.post(
  '/update',
  authenticateToken,
  agentController.uploadAgentProfile,
  agentController.updateAgent
)
router.get('/profile', authenticateToken, agentController.getAgent)
router.post('/test-my-agent', authenticateToken, agentController.testMyAgent)
router.get('/meetings/:id', verifyApiKey, agentController.getAgentMeeting)

module.exports = router
