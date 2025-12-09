const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  isCompanyAdmin,
  isAdmin,
} = require("../middleware/auth");
const workflowController = require("../controllers/workflowController");
const uploadPdf = require("../middleware/uploadPdf"); // Add this import

// Public PDF magic link endpoints (no auth)
router.post("/pdf-magic/send", workflowController.sendPdfMagicLink);
router.get("/pdf-magic/validate", workflowController.validatePdfMagicToken);
router.get("/pdf-node-data", workflowController.getPdfNodeDataPublic);
router.post(
  "/pdf-magic/complete/:id",
  uploadPdf.single("pdf"),
  workflowController.completePdfNodePublic
);

// Public form magic link endpoints (no auth)
router.get("/public-form-config", workflowController.getPublicFormConfig);
router.post("/public-form-submit", workflowController.submitPublicForm);
router.post("/form-magic/send", workflowController.sendFormMagicLink);

router.get("/user/workflow", workflowController.getUserAllWorkflows);
router.post("/workflows", workflowController.addWorkflow);
router.get("/workflows", workflowController.getCompanyWorkflows);
router.get("/workflows/:id", workflowController.getWorkflow);
router.get("/company_workflows/:id", workflowController.getCompanyWorkflow);
router.put("/workflows/:id", workflowController.updateWorkflow);
router.patch(
  "/workflows/:id/toggle",
  authenticateToken,
  workflowController.toggleWorkflow
);
router.delete("/workflows/:id", workflowController.deleteWorkflow);
router.post("/workflows/:id/execute", workflowController.executeWorkflow);
router.get(
  "/workflow-node-instance/:id",
  workflowController.getWorkflowNodeInstance
);

router.post("/webhook", authenticateToken, workflowController.webhook);

// Form configuration route
router.get("/form-config", workflowController.getFormConfig);

// Workflow instances routes
router.get("/instances", workflowController.getWorkflowInstances);
router.get("/instances/:id", workflowController.getWorkflowInstance);
router.get("/instances/:id/status", workflowController.getWorkflowStatus);

// Company-specific workflow instances routes
router.get(
  "/company-instances",
  workflowController.getCompanyWorkflowInstances
);
router.get(
  "/company-instance-counts",
  workflowController.getWorkflowInstanceCounts
);
router.delete("/instances/:id", workflowController.deleteWorkflowInstance);

// Form submission route
router.post(
  "/instances/:id/submit-form",
  authenticateToken,
  workflowController.submitForm
);

// Approval decision route
router.post(
  "/instances/:id/approve",
  authenticateToken,
  workflowController.submitApproval
);

// CRM Approval decision route
router.post(
  "/instances/:id/crm-approve",
  authenticateToken,
  workflowController.submitCrmApproval
);

router.get("/crm-data", workflowController.getCrmData);

// // Direct approval via email link route
// router.get('/instances/:id/approve/email/:email', workflowController.directApproval);

// Direct approval via approval ID route
router.get("/approval/:approvalId", workflowController.directApprovalById);

router.post("/update-url", authenticateToken, workflowController.updateUrl);

// PDF completion route
router.post(
  "/pdf-complete",
  uploadPdf.single("pdf"), // Add this middleware
  workflowController.completePdfNode
);

router.post("/pdf-signature/:id", workflowController.savePdfSignature);

module.exports = router;
