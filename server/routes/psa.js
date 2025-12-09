const express = require('express');
const router = express.Router();
const { authenticateToken, isCompanyAdmin } = require('../middleware/auth');
const psaController = require('../controllers/psaController');
const timeLogController = require('../controllers/timeLogController');
const uploadFile = require('../middleware/upload_file');

// Create a new company role
router.post('/createProject/:companyId', authenticateToken, isCompanyAdmin, psaController.createProject);
router.get('/getProject/:companyId', authenticateToken, isCompanyAdmin, psaController.getProject)
router.get('/project/:projectId', authenticateToken, psaController.getProjectById)
router.put('/updateProject/:companyId/:projectId',authenticateToken, isCompanyAdmin, psaController.updateProject);
router.delete('/deleteProject/:companyId/:projectId', authenticateToken, isCompanyAdmin, psaController.deleteProject)
router.get('/companyresources/:companyId', authenticateToken, isCompanyAdmin, psaController.getCompanyResources);
router.get('/companyroles/:companyId', authenticateToken, isCompanyAdmin, psaController.getCompanyRoles);

//project Templates
router.post('/createProjectTemplate/:projectId', authenticateToken, isCompanyAdmin, psaController.createProjectTemplate)
router.get('/getProjectTemplate/:projectId', authenticateToken, isCompanyAdmin, psaController.getProjectTemplate)

//project Backlogs
router.post('/createProjectHierarchy/:projectId', authenticateToken, isCompanyAdmin, psaController.createProjectHierarchy)
router.get('/backlog/:projectId', authenticateToken, isCompanyAdmin, psaController.getProjectBacklogItems)
router.get('/backlog/item/:itemId', authenticateToken, isCompanyAdmin, psaController.getBacklogItemById)
router.put('/backlog/item/:itemId', authenticateToken, isCompanyAdmin, psaController.updateBacklogItem)
router.put('/backlog/item/:itemId/status', authenticateToken, isCompanyAdmin, psaController.updateBacklogItemStatus)
router.delete('/backlog/item/:itemId', authenticateToken, isCompanyAdmin, psaController.deleteBacklogItem)

//Sprints
router.post('/createSprint', authenticateToken, psaController.createSprint)
router.get('/sprints', authenticateToken, psaController.getAllSprints) // Get all sprints for company
router.get('/sprints/:projectId', authenticateToken, psaController.getProjectSprints)
router.get('/sprints/pi/:piId', authenticateToken, psaController.getSprintsByPI)
router.put('/sprints/:sprintId/velocity', authenticateToken, psaController.updateSprintVelocity)

//My Stories (for individual users)
router.get('/my-stories', authenticateToken, psaController.getUserStories)

//User Story Detail Workspace
router.get('/story/:storyId', authenticateToken, psaController.getStoryDetail)

//Story Discussions
router.get('/story/:storyId/discussions', authenticateToken, psaController.getStoryDiscussions)
router.post('/story/:storyId/discussions', authenticateToken, uploadFile.single('file'), psaController.addStoryDiscussion)
router.put('/story/:storyId/discussions/:commentId', authenticateToken, psaController.updateStoryDiscussion)
router.delete('/story/:storyId/discussions/:commentId', authenticateToken, psaController.deleteStoryDiscussion)

//PSA Dashboard
router.get('/dashboard', authenticateToken, isCompanyAdmin, psaController.getPSADashboard)
router.get('/dashboard/metrics/:companyId', authenticateToken, isCompanyAdmin, psaController.getDashboardMetricDetails)

//Reports & Analytics
router.get('/reports/:companyId', authenticateToken, isCompanyAdmin, psaController.getReportsData)
router.get('/reports/resource-utilization/:companyId', authenticateToken, isCompanyAdmin, psaController.getResourceUtilizationReport)
router.get('/reports/certification-tracker/:companyId', authenticateToken, isCompanyAdmin, psaController.getCertificationTracker)
router.get('/reports/skills-gap/:companyId', authenticateToken, isCompanyAdmin, psaController.getSkillsGapAnalysis)
router.get('/reports/capacity-planning/:companyId', authenticateToken, isCompanyAdmin, psaController.getCapacityPlanning)
router.get('/reports/quarterly-utilization/:companyId', authenticateToken, isCompanyAdmin, psaController.getQuarterlyUtilizationTrends)

//Resources
router.get('/resources', authenticateToken, psaController.getAllResources);
router.get('/resource-overview/:resourceId', authenticateToken, psaController.getResourceOverview);
router.get('/resources/:resourceId', authenticateToken, psaController.getResourceById);
router.post('/resources/:userId/:companyId', authenticateToken, psaController.updateResource);
router.get('/departments', authenticateToken, psaController.getAllDepartments);

//Clients
router.get('/clients', authenticateToken, psaController.getCompanyClients);

//Skills and Certifications
router.get('/skills', authenticateToken, psaController.getAllSkills);
router.post('/skills', authenticateToken, psaController.createSkill);
router.put('/skills/:skillId', authenticateToken, psaController.updateSkill);
router.delete('/skills/:skillId', authenticateToken, psaController.deleteSkill);

router.get('/certifications', authenticateToken, psaController.getAllCertifications);
router.post('/certifications', authenticateToken, psaController.createCertification);
router.put('/certifications/:certificationId', authenticateToken, psaController.updateCertification);
router.delete('/certifications/:certificationId', authenticateToken, psaController.deleteCertification);

// Resource-specific Skills and Certifications
router.delete('/resource-skills/:resourceId/:skillId', authenticateToken, psaController.deleteResourceSkill);
router.delete('/resource-certifications/:resourceId/:certificationId', authenticateToken, psaController.deleteResourceCertification);

//Template Management
router.get('/templates/company/:companyId', authenticateToken, isCompanyAdmin, psaController.getAllTemplates);
router.get('/templates/item/:templateId', authenticateToken, psaController.getTemplateById);
router.post('/templates/:companyId', authenticateToken, isCompanyAdmin, psaController.createTemplate);
router.post('/templates/hierarchical/:companyId', authenticateToken, isCompanyAdmin, psaController.createHierarchicalTemplate);
router.put('/templates/hierarchical/:templateId', authenticateToken, psaController.updateHierarchicalTemplate);
router.put('/templates/:templateId', authenticateToken, psaController.updateTemplate);
router.delete('/templates/:templateId', authenticateToken, psaController.deleteTemplate);
router.post('/templates/:templateId/create-project', authenticateToken, psaController.createProjectFromTemplate);
router.post('/templates/:templateId/create-hierarchical-project', authenticateToken, psaController.createProjectFromHierarchicalTemplate);

// Project to Template Conversion
router.get('/projects/:projectId/extract-template-data', authenticateToken, isCompanyAdmin, psaController.extractProjectTemplateData);
router.post('/projects/:projectId/save-as-template', authenticateToken, isCompanyAdmin, psaController.saveProjectAsTemplate);

// Cost Analysis
router.get('/projects/:companyId/cost-summaries', authenticateToken, isCompanyAdmin, psaController.getAllProjectsCostSummaries);
router.get('/projects/:companyId/:projectId/cost-analysis', authenticateToken, isCompanyAdmin, psaController.getProjectCostAnalysis);

// Performance Reports
router.get('/performance-report/:companyId', authenticateToken, isCompanyAdmin, psaController.getProjectPerformanceReport);

// Financial Reports
router.get('/financial-summary/:companyId', authenticateToken, isCompanyAdmin, psaController.getFinancialSummaryReport);

// Story Progress APIs
router.get('/projects/:companyId/story-progress', authenticateToken, isCompanyAdmin, psaController.getAllProjectsStoryProgress);
router.get('/projects/:projectId/story-progress', authenticateToken, isCompanyAdmin, psaController.getProjectStoryProgress);

// Program Increment Routes
router.post('/program-increments', authenticateToken, isCompanyAdmin, psaController.createProgramIncrement);
router.get('/program-increments/:projectId', authenticateToken, isCompanyAdmin, psaController.getProgramIncrements);
router.put('/program-increments/:id', authenticateToken, isCompanyAdmin, psaController.updateProgramIncrement);
router.delete('/program-increments/:id', authenticateToken, isCompanyAdmin, psaController.deleteProgramIncrement);

// AI Acceptance Criteria Generation
router.post('/generate-acceptance-criteria', authenticateToken, psaController.generateAcceptanceCriteria);

// Time Logging Routes
router.post('/story/:storyId/time-logs', authenticateToken, timeLogController.createTimeLog);
router.get('/story/:storyId/time-logs', authenticateToken, timeLogController.getTimeLogs);
router.put('/time-logs/:logId', authenticateToken, timeLogController.updateTimeLog);
router.delete('/time-logs/:logId', authenticateToken, timeLogController.deleteTimeLog);

// PSA Emoji Reactions Routes
router.post('/emoji-reactions/add', authenticateToken, psaController.addPSAEmojiReaction);
router.post('/emoji-reactions/remove', authenticateToken, psaController.removePSAEmojiReaction);
router.get('/emoji-reactions/:comment_id', authenticateToken, psaController.getPSAEmojiReactions);

module.exports = router;
