const express = require('express');
const router = express.Router();
const { authenticateToken, verifyApiKey } = require('../middleware/auth');
const taskController = require('../controllers/taskController');
const uploadFile = require('../middleware/upload_file');

// Message thread routes
router.post('/insert-message-task', authenticateToken, uploadFile.single('file'), taskController.uploadFileToTask);
router.post('/update-message', authenticateToken, taskController.updateMessage);
router.post('/delete-message', authenticateToken, taskController.deleteMessage);

router.get('/similar-users/:taskId', authenticateToken, taskController.getSimilarTaskUsers);
router.post('/request-help', authenticateToken, taskController.requestHelp);
router.post('/generate-tasks', authenticateToken, taskController.generateTasks);
router.post('/search-similar', authenticateToken, taskController.searchSimilarTasks);
router.post('/create', authenticateToken, taskController.createTask);
router.delete('/delete/:taskId', authenticateToken, taskController.deleteTask);
router.put('/update', authenticateToken, taskController.updateTask);
router.post('/invite-user', authenticateToken, taskController.inviteUser);
router.post('/remove-participants', authenticateToken, taskController.removeParticipants);
router.get('/get-my-tasks', authenticateToken, taskController.getMyTasks);
router.get('/get-my-performance-cloud', authenticateToken, taskController.getMyPerformanceCloud);
router.get('/get-user-performance-cloud', authenticateToken, taskController.getUserPerformanceCloud);
router.post('/get-task-details', authenticateToken, taskController.getTaskById);
router.get('/get-count-my-tasks', authenticateToken, taskController.countMyTasks);
router.get('/get-count-assigned-tasks', authenticateToken, taskController.countAssignedTasks);
router.post('/filtered-tasks', authenticateToken, taskController.getFilteredTask);
router.post('/filtered-reviewtasks', authenticateToken, taskController.getFilteredReviewTask);
router.post('/filtered-opentasks', authenticateToken, taskController.getFilteredopenTask);
router.put('/update-status', authenticateToken, taskController.updateTaskStatus);
router.post('/tasksData', taskController.statisticTask);
router.post('/tasksRatingData', taskController.statisticTaskRating);
router.post('/taskReviewStatistic', taskController.taskReviewStatistic);
router.post('/costData', taskController.getCostData);
router.post('/ai-help', authenticateToken, taskController.getAIHelp);
router.post('/get-task-review-details', authenticateToken, taskController.getTaskReviewDetails);
router.post('/past-open-tasks', authenticateToken, taskController.getPastOpenTasks);
router.post('/update-due-date', authenticateToken, taskController.updateTaskDueDate);
router.get('/top-assignees', authenticateToken, taskController.topAssignees);
router.get('/get-previous-research', authenticateToken, taskController.getPreviousResearch);
router.post('/delete-research', authenticateToken, taskController.deleteResearch);
router.get('/assignee-tasks/:assigneeId', authenticateToken, taskController.assigneeTasks);
router.post('/score-tasks', authenticateToken, taskController.scoreTasks);
router.post('/get-monthly-review-rating-ytd', authenticateToken, taskController.getMonthlyReviewRatingYTD);
router.post('/top-non-aligned-meetings', taskController.getTopNonAlignedMeetings);
router.post('/top-rated-users', taskController.getTopRatedUsers);
router.post('/favourite',authenticateToken, taskController.setThreadFavourite);
router.get('/get-favourite-threads', authenticateToken, taskController.getFavouriteThreads);

//public API
router.post('/todo-task', verifyApiKey, taskController.getTodoTaskRest);
router.post('/get-return-help', verifyApiKey, taskController.getReturnHelpRest);
router.post('/create-task', verifyApiKey, taskController.createTaskRest);
router.post('/get-return-help-with-title', verifyApiKey, taskController.getReturnHelpOnlyTaskTitleRest);
router.post('/start-research', verifyApiKey, taskController.startResearchRest);
router.post('/get-research-status', authenticateToken, taskController.getStatusResearch);
router.post('/close-research', authenticateToken, taskController.closeResearch);
router.post('/get-research-closed', authenticateToken, taskController.getResearchClosed);
router.post('/getSummaryOpenTasks', authenticateToken, taskController.getSummaryOpenTasks);
router.post('/get-time-on-tasks-ai-estimates', authenticateToken, taskController.getTimeOnTasksWithAIEstimates);
router.get('/priority-work', authenticateToken, taskController.getPriorityWork);
router.post('/get-task-helper', authenticateToken, taskController.getTaskHelper);
router.post('/auto-schedule-task', authenticateToken, taskController.autoScheduleTask);
router.post('/match-workflow-to-task', authenticateToken, taskController.matchWorkflowToTask);


module.exports = router;

// Thread recommendation route
const threadRecommendationController = require('../controllers/threadRecommendationController');
router.post('/thread-recommendation', authenticateToken, threadRecommendationController.getThreadRecommendation);
