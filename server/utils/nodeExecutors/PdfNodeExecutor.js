const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
const pool = require("../../config/database");
const WorkflowNodeInstance = require("../../models/WorkflowNodeInstance");
const WorkflowInstance = require("../../models/WorkflowInstance");
const { sendEmail } = require("../email");
const puppeteer = require("puppeteer");
const { replaceWorkflowPlaceholders } = require("../workflowPlaceholder");

const s3 = new AWS.S3();

class PdfNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  interpolate(template = "", data = {}) {
    if (!template) return "";
    return template.replace(/{{\s*([\w\.]+)\s*}}/g, (m, key) => {
      const parts = key.split(".");
      let value = data;
      for (const part of parts) {
        value = value?.[part];
      }
      return value !== undefined ? value : m;
    });
  }

  async sendApprovalEmail(approver, approvalEvent, nodeConfig) {
    try {
      const emailTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>PDF Approval Required</h2>
          <p>Hello ${approver.name || approver.email},</p>
          <p>You have been assigned to review and approve a PDF document in the workflow.</p>
          <p><strong>Workflow:</strong> ${approvalEvent.workflowName}</p>
          <p><strong>Document:</strong> ${
            approvalEvent.documentName || "PDF Document"
          }</p>
          <p>Please log in to your account to review and approve the document.</p>
          <p>This approval is required to continue the workflow process.</p>
        </div>
      `;

      await sendEmail({
        to: approver.email,
        subject: "PDF Approval Required - Action Needed",
        html: emailTemplate,
      });
    } catch (error) {
      console.error("Error sending PDF approval email:", error);
    }
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeConfig =
        typeof node.config === "string" ? JSON.parse(node.config) : node.config;

      return await this.handlePdfProcess(
        nodeInstance,
        node,
        workflowInstance,
        data,
        nodeConfig
      );
    } catch (error) {
      console.error("PDF node execution error:", error);
      return {
        status: "failed",
        data: data,
        result: {},
        error: error.message,
      };
    }
  }

  async handlePdfProcess(
    nodeInstance,
    node,
    workflowInstance,
    data,
    nodeConfig
  ) {
    try {
      // First generate the PDF but don't complete the node yet
      await WorkflowNodeInstance.updateStatus(
        nodeInstance.id,
        "in_progress",
        data
      );

      const enrichedData = {
        ...data,
        date: new Date().toISOString().slice(0, 10),
      };

      // Check if we should send a public magic link email
      const shouldSendPublicLink =
        nodeConfig.sendPublicLink || nodeConfig.publicEmail;

      const publicEmail = await replaceWorkflowPlaceholders(
        nodeConfig.publicEmail,
        workflowInstance
      );

      console.log("🥶🥶🥶publicEmail", publicEmail);

      const configuredExpiresInMinutes = Number(nodeConfig.expiresInMinutes);
      const defaultExpirySeconds = 7 * 24 * 60 * 60; // 7 days
      const expiresInSeconds = configuredExpiresInMinutes
        ? configuredExpiresInMinutes * 60
        : defaultExpirySeconds;
      const expiresInLabel = configuredExpiresInMinutes
        ? `${configuredExpiresInMinutes} minutes`
        : "7 days";

      if (shouldSendPublicLink && publicEmail) {
        try {
          // Generate magic link token
          const token = jwt.sign(
            {
              purpose: "pdf_magic_link",
              nodeInstanceId: nodeInstance.id,
              email: publicEmail,
            },
            process.env.JWT_SECRET,
            { expiresIn: expiresInSeconds }
          );

          const publicLink = `${
            process.env.CLIENT_URL
          }/public/pdf?magic_token=${encodeURIComponent(token)}`;

          // Send email to external user
          await sendEmail({
            to: publicEmail,
            subject:
              nodeConfig.emailSubject ||
              "Action Required: Review and Sign Document",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Document Review Required</h2>
                <p>Hello,</p>
                <p>You have been requested to review and complete a document. Please click the secure link below to access the document:</p>
                <p style="margin: 20px 0;">
                  <a href="${publicLink}" 
                     style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Review Document
                  </a>
                </p>
                <p><strong>Important:</strong></p>
                <ul>
                  <li>This link will expire in ${expiresInLabel}</li>
                  <li>Please complete the document review as soon as possible</li>
                  <li>If you have any questions, please contact the person who sent you this request</li>
                </ul>
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">${publicLink}</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
              </div>
            `,
          });

          console.log(`Public PDF magic link sent to: ${publicEmail}`);
        } catch (emailError) {
          console.error("Error sending public PDF magic link:", emailError);
          // Don't fail the entire process if email fails
        }
      }

      // Update node instance status to waiting_user_input
      await WorkflowNodeInstance.updateStatus(
        nodeInstance.id,
        "waiting_user_input",
        data,
        {}
      );

      // Return waiting status
      return {
        status: "waiting_user_input",
        data: data,
        result: {},
        error: null,
      };
    } catch (error) {
      console.error("PDF approval node execution error:", error);
      return {
        status: "failed",
        data: data,
        result: {},
        error: error.message,
      };
    }
  }

  async handlePdfSubmission(
    nodeInstanceId,
    workflowInstanceId,
    formData,
    user
  ) {
    try {
      console.log("Handling PDF submission:", {
        nodeInstanceId,
        workflowInstanceId,
        formData,
        user,
      });

      // Get the node instance
      const { rows: nodeInstanceRows } = await pool.query(
        "SELECT * FROM workflow_node_instances WHERE id = $1",
        [nodeInstanceId]
      );

      if (nodeInstanceRows.length === 0) {
        throw new Error("Node instance not found");
      }

      const nodeInstance = nodeInstanceRows[0];

      // Get the workflow instance
      const { rows: workflowInstanceRows } = await pool.query(
        "SELECT * FROM workflow_instances WHERE id = $1",
        [workflowInstanceId]
      );

      if (workflowInstanceRows.length === 0) {
        throw new Error("Workflow instance not found");
      }

      const workflowInstance = workflowInstanceRows[0];

      // Update the node instance with the form data
      const updatedData = {
        ...nodeInstance.data,
        ...formData,
        submittedBy: user.email || user.name || "Unknown",
        submittedAt: new Date().toISOString(),
      };

      await WorkflowNodeInstance.updateStatus(
        nodeInstanceId,
        "completed",
        updatedData,
        formData
      );

      // Log the submission
      await WorkflowNodeInstance.logExecution(
        workflowInstanceId,
        nodeInstanceId,
        "info",
        "PDF form submitted successfully",
        { formData, user: user.email || user.name }
      );

      return {
        status: "success",
        data: updatedData,
        result: formData,
        error: null,
      };
    } catch (error) {
      console.error("Error handling PDF submission:", error);
      return {
        status: "failed",
        data: formData,
        result: {},
        error: error.message,
      };
    }
  }

  async executeNextNode(currentNodeId, workflowInstance, nodeResult = {}) {
    try {
      // Get workflow connections
      const { rows: connections } = await pool.query(
        "SELECT * FROM workflow_connections WHERE from_node_id = $1",
        [currentNodeId]
      );

      if (connections.length === 0) {
        // No next node, workflow completed
        await WorkflowInstance.updateStatus(
          workflowInstance.id,
          "completed",
          null,
          { ...workflowInstance.data, ...nodeResult }
        );

        await WorkflowNodeInstance.logExecution(
          workflowInstance.id,
          null,
          "info",
          "Workflow execution completed",
          { finalResult: nodeResult }
        );
        return;
      }

      // Get the next node
      const nextConnection = connections[0]; // Assuming single connection for now
      const { rows: nextNodes } = await pool.query(
        "SELECT * FROM workflow_nodes WHERE node_id = $1",
        [nextConnection.to_node_id]
      );

      if (nextNodes.length === 0) {
        throw new Error("Next node not found");
      }

      const nextNode = nextNodes[0];

      // Create next node instance
      const nextNodeInstance = await WorkflowNodeInstance.create(
        workflowInstance.id,
        nextNode.id,
        nextNode.node_id,
        workflowInstance.assigned_to,
        nextNode.type
      );

      // Update workflow instance current node
      await WorkflowInstance.updateStatus(
        workflowInstance.id,
        "active",
        nextNode.node_id,
        { ...workflowInstance.data, ...nodeResult }
      );

      // Execute next node using workflow executor
      const WorkflowExecutor = require("../workflowExecutor");
      const workflowExecutor = new WorkflowExecutor(this.io);
      await workflowExecutor.executeNode(
        nextNodeInstance,
        nextNode,
        workflowInstance,
        nodeResult
      );
    } catch (error) {
      console.error("Error executing next node:", error);
      throw error;
    }
  }
}

module.exports = PdfNodeExecutor;
