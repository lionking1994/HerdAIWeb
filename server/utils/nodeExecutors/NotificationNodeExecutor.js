const WorkflowNodeInstance = require("../../models/WorkflowNodeInstance");
const pool = require("../../config/database");
const { sendEmail } = require("../email");
const { replaceWorkflowPlaceholders } = require("../workflowPlaceholder");

class NotificationNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeConfig =
        typeof node.config === "string" ? JSON.parse(node.config) : node.config;

      // Log notification execution start
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        "info",
        "Notification execution started",
        { notificationConfig: nodeConfig.notificationConfig }
      );

      // Send notification
      const notificationResult = await this.sendNotification(
        nodeConfig,
        data,
        workflowInstance
      );

      // Log notification completion
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        "info",
        "Notification sent successfully",
        { result: notificationResult }
      );

      return {
        status: "completed",
        data: data,
        result: notificationResult,
        error: null,
      };
    } catch (error) {
      console.error("Notification node execution error:", error);
      return {
        status: "failed",
        data: data,
        result: {},
        error: error.message,
      };
    }
  }

  // Resolve placeholders like {{form1.receiver}} or {{pdf1.result.url}}
  async resolvePlaceholders(input, workflowInstance) {
    if (Array.isArray(input)) {
      const resolved = await Promise.all(
        input.map((item) => this.resolvePlaceholders(item, workflowInstance))
      );
      return resolved;
    }

    if (typeof input !== "string") {
      return input;
    }

    const placeholderRegex = /\{\{\s*([^}]+?)\s*\}\}/g; // matches {{ token }}

    const uniqueTokens = new Set();
    let match;
    while ((match = placeholderRegex.exec(input)) !== null) {
      uniqueTokens.add(match[1]);
    }

    let output = input;
    for (const token of uniqueTokens) {
      const value = await this.resolveToken(token, workflowInstance);
      const stringValue =
        typeof value === "object" ? JSON.stringify(value) : value ?? "";
      output = output.replace(
        new RegExp(`\\{\\{\\s*${this.escapeRegex(token)}\\s*\\}\}`, "g"),
        String(stringValue)
      );
    }

    return output;
  }

  async resolveToken(token, workflowInstance) {
    // token: nodeId.path1.path2 or nodeId.result or nodeId.data.field
    const parts = token.split(".");
    if (parts.length === 0) return "";

    const nodeId = parts[0];
    const rest = parts.slice(1); // may be ["receiver"] or ["result", "url"]

    // First try to find by the actual node_id
    let nodeInstance = await WorkflowNodeInstance.findByInstanceAndNodeId(
      workflowInstance.id,
      nodeId
    );

    // If not found, try to find by logicalId (e.g., "form1", "pdf1")
    if (!nodeInstance) {
      nodeInstance = await WorkflowNodeInstance.findByInstanceAndLogicalId(
        workflowInstance.id,
        nodeId
      );
    }

    if (!nodeInstance) return "";

    // Parse JSON fields if needed
    const data = this.safeParseJSON(nodeInstance.data);
    const result = this.safeParseJSON(nodeInstance.result);
    const config = this.safeParseJSON(nodeInstance.node_config);

    if (rest.length === 0) {
      // If no path, prefer result then data
      return result ?? data ?? "";
    }

    let baseKey = rest[0];
    let path = rest.slice(1);

    let baseObj;
    if (baseKey === "result") {
      baseObj = result;
    } else if (baseKey === "data") {
      baseObj = data;
    } else if (baseKey === "config") {
      baseObj = config;
    } else {
      // Default to data.<rest>
      baseObj = data;
      path = rest; // include the first segment as field under data
    }

    if (baseObj == null) return "";

    return this.getValueByPath(baseObj, path);
  }

  getValueByPath(obj, pathSegments) {
    try {
      return pathSegments.reduce(
        (acc, key) => (acc != null ? acc[key] : undefined),
        obj
      );
    } catch {
      return undefined;
    }
  }

  safeParseJSON(value) {
    if (value == null) return null;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value; // could already be primitive/string
    }
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async sendNotification(notificationConfig, data, workflowInstance) {
    try {
      const {
        notificationType,
        emailTags = [],
        emailTitle = "",
        emailBody = "",
        selectedUsers = [],
        notificationText = "",
      } = notificationConfig;

      // Resolve placeholders for email type
      if (notificationType === "email") {
        const resolvedEmailTags = await replaceWorkflowPlaceholders(
          emailTags,
          workflowInstance
        );
        const resolvedEmailTitle = await replaceWorkflowPlaceholders(
          emailTitle,
          workflowInstance
        );
        const resolvedEmailBody = await replaceWorkflowPlaceholders(
          emailBody,
          workflowInstance
        );

        return await this.sendEmailNotification(
          resolvedEmailTags,
          resolvedEmailTitle,
          resolvedEmailBody,
          data
        );
      } else if (notificationType === "application") {
        // Optionally interpolate notificationText as well
        const resolvedNotificationText = await replaceWorkflowPlaceholders(
          notificationText,
          workflowInstance
        );
        return await this.sendInAppNotification(
          selectedUsers,
          resolvedNotificationText,
          data
        );
      } else {
        throw new Error(`Unsupported notification type: ${notificationType}`);
      }
    } catch (error) {
      throw new Error(`Notification sending failed: ${error.message}`);
    }
  }

  async determineRecipients(recipients, workflowInstance) {
    const recipientList = [];

    for (const recipient of recipients) {
      if (recipient.type === "user" && recipient.userId) {
        recipientList.push({ type: "user", id: recipient.userId });
      } else if (recipient.type === "role" && recipient.role) {
        // Find users with this role
        const { rows } = await pool.query(
          "SELECT id FROM users WHERE role = $1",
          [recipient.role]
        );
        rows.forEach((user) => {
          recipientList.push({ type: "user", id: user.id });
        });
      } else if (recipient.type === "workflow_assignee") {
        if (workflowInstance.assigned_to) {
          recipientList.push({
            type: "user",
            id: workflowInstance.assigned_to,
          });
        }
      }
    }

    return recipientList;
  }

  async sendEmailNotification(emailTags, emailTitle, emailBody, data) {
    const subject = emailTitle || "Workflow Notification";
    const html = emailBody || undefined;
    const text = html ? undefined : emailBody || "";

    console.log(emailTags, emailTitle, emailBody, data);

    for (const recipient of emailTags) {
      await sendEmail({
        to: recipient,
        subject,
        html,
        text,
      });
    }

    return {
      type: "email",
      recipients: emailTags.length,
      subject,
      message: emailBody,
      sent: true,
      timestamp: new Date().toISOString(),
    };
  }

  async sendInAppNotification(selectedUsers, notificationText, data) {
    selectedUsers.forEach((recipient) => {
      const socketEvent = {
        type: "workflow_notification",
        id: recipient,
        notificationText,
      };

      this.io.emit("notification", socketEvent);
    });

    return {
      type: "in_app",
      recipients: selectedUsers.length,
      notificationText,
      sent: true,
      timestamp: new Date().toISOString(),
    };
  }

  async sendSmsNotification(recipients, message, data) {
    return {
      type: "sms",
      recipients: recipients.length,
      message,
      sent: true,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = NotificationNodeExecutor;
