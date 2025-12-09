const pool = require('../../config/database');
const WorkflowNodeInstance = require('../../models/WorkflowNodeInstance');
const WorkflowInstance = require('../../models/WorkflowInstance');
const { sendEmail } = require('../email');

class ApprovalNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeConfig = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
      
      // Update node instance status to in_progress
      await WorkflowNodeInstance.updateStatus(nodeInstance.id, 'in_progress', data);
      
      // Determine approver
      console.log("determineApprover",nodeConfig, workflowInstance);
      const approver = nodeConfig.approvers[0];
      console.log("😷😷approver : ", approver);
      
      if (!approver) {
        throw new Error('No approver found for approval node');
      }

      console.log("approver : ", approver);
      // Create approval record
      let approvalRecord;
      if (approver.id && !String(approver.id).startsWith('email_')) {
        // If approver exists in database, create approval record
        const approvalQuery = `
          INSERT INTO workflow_approvals (workflow_instance_id, workflow_node_instance_id, approver_id, status, node_type)
          VALUES ($1, $2, $3, 'pending', 'approvalNode')
          RETURNING *
        `;
        const { rows } = await pool.query(approvalQuery, [
          workflowInstance.id,
          nodeInstance.id,
          approver.id
        ]);
        approvalRecord = rows[0];
      } else {
        // If approver doesn't exist in database, create a temporary approval record
        approvalRecord = {
          id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          workflow_instance_id: workflowInstance.id,
          workflow_node_instance_id: nodeInstance.id,
          approver_id: approver.email, // Store email instead of ID
          status: 'pending',
          node_type: 'approvalNode'
        };
      }

      // Send socket event to frontend for approval
      const approvalEvent = {
        type: 'workflow_approval_required',
        workflowInstanceId: workflowInstance.id,
        nodeInstanceId: nodeInstance.id,
        nodeId: node.node_id,
        approvalId: approvalRecord.id,
        approvalConfig: {
          title: nodeConfig.label || 'Approval Required',
          description: nodeConfig.description || '',
          approver: approver,
          dueDate: nodeConfig.dueDate,
          priority: nodeConfig.priority || 'medium'
        },
        workflowData: workflowInstance.data,
        nodeData: data
      };

      // Find previous node instance
      const previousNodeInstance = await this.findPreviousNodeInstance(workflowInstance.id, node.node_id);
      
      // Emit to approver (only if they have a database ID)
      if (approver.id) {
        const notificationMessage = 'Please approve the workflow.';
        const redirectUrl = `/approval?id=${nodeInstance.id}`;
        console.log('😎😎😎', node.config.approvers[0]);
        // Create notification in database
        const { rows: notificationResult } = await pool.query(
          "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [
            node.config.approvers[0].id,
            false,
            notificationMessage,
            false,
            redirectUrl,
            new Date()
          ]
        );
        
        // Send notification via socket
        const socketEvent = {
          type: 'notification',
          id: node.config.approvers[0].id,
          notification: {
            id: notificationResult[0].id,
            title: 'Workflow Approval Required',
            message: notificationMessage,
            type: 'workflow_approval',
            data: {
              workflowInstanceId: workflowInstance.id,
              nodeInstanceId: nodeInstance.id,
              nodeId: node.node_id,
              approvalTitle: nodeConfig.label || 'Approval Required',
              approvalDescription: nodeConfig.description || '',
              redirectUrl: redirectUrl
            },
            created_at: new Date().toISOString()
          }
        };
  
        console.log('Emitting notification for workflow approval:', socketEvent);
        this.io.emit('notification', socketEvent);
      }

      // Send email notification to approver
      console.log('Sending approval email to approver:', approver.email);     
      await this.sendApprovalEmail(approver, approvalEvent, nodeConfig);

      // Log approval request
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Approval requested',
        { approver: approver.id || approver.email, approvalId: approvalRecord.id }
      );

      // Update node instance status to waiting_user_input
      await WorkflowNodeInstance.updateStatus(nodeInstance.id, 'waiting_user_input', data, {});

      // Return waiting status
      return {
        status: 'waiting_user_input',
        data: data,
        result: {},
        error: null
      };

    } catch (error) {
      console.error('Approval node execution error:', error);
      return {
        status: 'failed',
        data: data,
        result: {},
        error: error.message
      };
    }
  }

  async handleApprovalDecision(workflowInstanceId, nodeInstanceId, approvalId, decision, comments, approverId, approverName) {
    try {
      // Log form submission
      await WorkflowNodeInstance.logExecution(
        workflowInstanceId,
        nodeInstanceId,
        'info',
        'Form submitted',
        { decision, comments, approverId }
      );

      // Update node instance with form data
      const result = await WorkflowNodeInstance.updateStatus(nodeInstanceId, 'completed', { decision, comments, approverId }, {decision, comments, approverId, approverName});
      console.log("---result 87---",result);

      // Get workflow instance and node information
      const workflowInstance = await WorkflowInstance.findById(workflowInstanceId);
      
      if (!workflowInstance) {
        throw new Error('Workflow instance not found');
      }

      // Get the completed node instance to find the node_id
      const nodeInstance = await WorkflowNodeInstance.findById(nodeInstanceId);
      if (!nodeInstance) {
        throw new Error('Node instance not found');
      }

      // Get the node configuration
      const { rows: nodes } = await pool.query(
        'SELECT * FROM workflow_nodes WHERE id = $1',
        [nodeInstance.workflow_node_id]
      );

      if (nodes.length === 0) {
        throw new Error('Node not found');
      }

      const node = nodes[0];

      // Find and execute next node
      await this.executeNextNode(node.node_id, workflowInstance, { decision, comments, approverId });

      return {
        status: 'completed',
        data: { decision, comments, approverId },
        result: { approvalId: approvalId, timestamp: new Date().toISOString() },
        error: null
      };

    } catch (error) {
      console.error('Form submission error:', error);
      return {
        status: 'failed',
        data: formData,
        result: {},
        error: error.message
      };
    }
  }

  async executeNextNode(currentNodeId, workflowInstance, nodeResult = {}) {
    try {
      // Get workflow connections
      const { rows: connections } = await pool.query(
        'SELECT * FROM workflow_connections WHERE from_node_id = $1',
        [currentNodeId]
      );

      if (connections.length === 0) {
        // No next node, workflow completed
        await WorkflowInstance.updateStatus(
          workflowInstance.id,
          'completed',
          null,
          { ...workflowInstance.data, ...nodeResult }
        );

        await WorkflowNodeInstance.logExecution(
          workflowInstance.id,
          null,
          'info',
          'Workflow execution completed',
          { finalResult: nodeResult }
        );
        return;
      }

      // Get the next node
      const nextConnection = connections[0]; // Assuming single connection for now
      const { rows: nextNodes } = await pool.query(
        'SELECT * FROM workflow_nodes WHERE node_id = $1',
        [nextConnection.to_node_id]
      );

      if (nextNodes.length === 0) {
        throw new Error('Next node not found');
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
        'active',
        nextNode.node_id,
        { ...workflowInstance.data, ...nodeResult }
      );

      // Execute next node using workflow executor
      const WorkflowExecutor = require('../workflowExecutor');
      const workflowExecutor = new WorkflowExecutor(this.io);
      await workflowExecutor.executeNode(nextNodeInstance, nextNode, workflowInstance, nodeResult);

    } catch (error) {
      console.error('Error executing next node:', error);
      throw error;
    }
  }

  async sendApprovalEmail(approver, approvalEvent, nodeConfig) {
    try {
      if (!approver.email) {
        console.warn('No email address found for approver:', approver.id);
        return;
      }

      console.log('Preparing to send approval email to:', approver.email);
      console.log('😢😢😢😢😢😢,', approvalEvent);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      // Get the workflow definition
      const { rows: workflows } = await pool.query(
        // "SELECT * FROM workflow_workflows WHERE id = $1",
        `SELECT
          w.* 
        FROM
          workflow_workflows w
          LEFT JOIN workflow_instances wi ON wi.workflow_id = w.
          ID LEFT JOIN workflow_node_instances wn ON wn.workflow_instance_id = wi.ID 
        WHERE
          wn.ID = $1`,
        [approvalEvent.nodeInstanceId]
      );

      if (workflows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Workflow not found" });
      }

      const workflow = workflows[0];

      const aprovalLink = `${frontendUrl}/approval?id=${approvalEvent.nodeInstanceId}`;
      
      const subject = `Approval Required: ${approvalEvent.approvalConfig.title}`;

      const html = `      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Approval Required</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.7; 
            color: #1f2937; 
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%);
            min-height: 100vh;
            padding: 20px 0;
            font-weight: 400;
          }
          .container { 
            max-width: 650px; 
            margin: 0 auto; 
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            overflow: hidden;
            border: 1px solid #e5e7eb;
          }
          .header { 
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            padding: 45px 35px;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            pointer-events: none;
          }
          .header h1 { 
            font-size: 32px; 
            font-weight: 800; 
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            position: relative;
            z-index: 1;
            letter-spacing: -0.025em;
          }
          .header p { 
            font-size: 18px; 
            opacity: 0.95;
            margin: 0;
            font-weight: 500;
            position: relative;
            z-index: 1;
          }
          .content { 
            padding: 45px 35px; 
            background: #ffffff;
          }
          .approval-title { 
            display: flex;
            font-size: 28px; 
            font-weight: 700; 
            color: #111827;
            margin-bottom: 24px;
            line-height: 1.3;
            letter-spacing: -0.025em;
          }
          .info-grid {
            display: grid;
            gap: 20px;
            margin-bottom: 40px;
          }
          .info-item {
            align-items: center;
            gap: 16px;
            padding: 20px;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 16px;
            border-left: 5px solid #4f46e5;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .info-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          }
          .info-label {
            font-weight: 700;
            color: #374151;
            min-width: 90px;
            font-size: 15px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .info-value {
            color: #111827;
            flex: 1;
            font-weight: 500;
            font-size: 16px;
          }
          .priority { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 25px; 
            font-size: 13px; 
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .priority.high { 
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); 
            color: #dc2626; 
            border: 1px solid #fecaca;
          }
          .priority.medium { 
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); 
            color: #d97706; 
            border: 1px solid #fed7aa;
          }
          .priority.low { 
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); 
            color: #059669; 
            border: 1px solid #bbf7d0;
          }
          .cta-section {
            text-align: center;
            margin: 45px 0;
            padding: 40px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 20px;
            border: 2px dashed #cbd5e0;
            position: relative;
          }
          .cta-section::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(135deg, #4f46e5, #7c3aed, #ec4899);
            border-radius: 20px;
            z-index: -1;
            opacity: 0.1;
          }
          .cta-button { 
            display: inline-block; 
            padding: 18px 36px; 
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white; 
            text-decoration: none; 
            border-radius: 14px; 
            font-weight: 700;
            font-size: 17px;
            transition: all 0.3s ease;
            box-shadow: 0 8px 25px rgba(79, 70, 229, 0.4);
            letter-spacing: 0.025em;
            position: relative;
            overflow: hidden;
          }
          .cta-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
          }
          .cta-button:hover::before {
            left: 100%;
          }
          .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(79, 70, 229, 0.6);
            background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
          }
          .cta-text {
            margin-top: 20px;
            color: #6b7280;
            font-size: 15px;
            line-height: 1.6;
            font-weight: 500;
          }
          .footer { 
            margin-top: 40px; 
            padding: 30px 35px;
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
            border-top: 1px solid #e5e7eb;
            text-align: center;
          }
          .footer p { 
            font-size: 14px; 
            color: #6b7280;
            margin-bottom: 10px;
            font-weight: 500;
          }
          .footer p:last-child {
            margin-bottom: 0;
          }
          .icon {
            font-size: 28px;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
          }
          .description {
            color: #4b5563;
            margin-bottom: 28px;
            line-height: 1.7;
            font-size: 16px;
            font-weight: 500;
            background: #f9fafb;
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #4f46e5;
          }
          @media (max-width: 640px) {
            .container { margin: 10px; border-radius: 16px; }
            .header, .content { padding: 30px 25px; }
            .header h1 { font-size: 26px; }
            .approval-title { font-size: 24px; }
            .cta-button { padding: 16px 28px; font-size: 16px; }
            .cta-section { padding: 30px 25px; }
            .info-item { padding: 16px; }
            .footer { padding: 25px 25px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>
              <span class="icon">🔔</span>
              Approval Required
            </h1>
            <p>Hello ${approver.name || approver.email}</p>
          </div>
          
          <div class="content">
            <h2 class="approval-title">${approvalEvent.approvalConfig.title} ( ${approvalEvent.workflowInstanceId} )</h2> 
            
            ${approvalEvent.approvalConfig.description ? `<div class="description">${approvalEvent.approvalConfig.description}</div>` : ''}
            
            <div class="info-grid">
              <div class="info-item">
                <div>  
                  <span class="info-label">Workflow:</span>
                  <span class="info-value">${workflow.name || 'Unnamed Workflow'}</span>
                </div>
                <div>
                  <span class="info-label">Date/Time:</span>
                  <span class="info-value">${new Date().toLocaleDateString()}</span>
                </div>     
              </div>             
 
              ${approvalEvent.approvalConfig.dueDate ? `
              <div class="info-item">
                <span class="info-label">Due Date:</span>
                <span class="info-value">${new Date(approvalEvent.approvalConfig.dueDate).toLocaleDateString()}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="cta-section">
              <a href="${aprovalLink}" class="cta-button">
                Review & Approve
              </a>
              <p class="cta-text">
                Click the button above to review the full details and make your approval decision
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from your workflow system</p>
            <p>If you have any questions, please contact your system administrator</p>
          </div>
        </div>
      </body>
      </html>`;

      await sendEmail({
        to: approver.email,
        subject: subject,
        html: html
      });

      console.log(`Approval email sent to ${approver.email} for approval ID: ${approvalEvent.approvalId}`);

    } catch (error) {
      console.error('Error sending approval email:', error);
      // Don't throw error to avoid breaking the workflow execution
    }
  }

  async sendApprovalDecisionEmail(workflowInstance, decision, comments, approverId) {
    try {
      // Get workflow creator/assignee to notify about the decision
      const notifyUserId = workflowInstance.created_by || workflowInstance.assigned_to;
      
      if (!notifyUserId) {
        console.warn('No user to notify about approval decision');
        return;
      }

      // Get user details
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [notifyUserId]
      );

      if (rows.length === 0) {
        console.warn('User not found for approval decision notification');
        return;
      }

      const user = rows[0];
      
      if (!user.email) {
        console.warn('No email address found for user:', user.id);
        return;
      }

      const subject = `Workflow Approval ${decision.charAt(0).toUpperCase() + decision.slice(1)}: ${workflowInstance.name}`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Approval Decision</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .content { background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; }
            .status { display: inline-block; padding: 8px 16px; border-radius: 6px; font-weight: bold; margin: 10px 0; }
            .status.approved { background-color: #d4edda; color: #155724; }
            .status.rejected { background-color: #f8d7da; color: #721c24; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📋 Approval Decision</h2> 
              <p>Hello ${user.name || user.email},</p>
            </div>
            
            <div class="content">
              <h3>Workflow: ${workflowInstance.name}</h3>
              
              <div class="status ${decision}">
                ${decision.charAt(0).toUpperCase() + decision.slice(1)}
              </div>
              
              ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
              
              <p><strong>Decision made by:</strong> ${approverId}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
              
              <p>The workflow will now proceed based on this decision.</p>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from your workflow system.</p>
              <p>If you have any questions, please contact your system administrator.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: user.email,
        subject: subject,
        html: html
      });

      console.log(`Approval decision email sent to ${user.email} for workflow: ${workflowInstance.name}`);

    } catch (error) {
      console.error('Error sending approval decision email:', error);
      // Don't throw error to avoid breaking the workflow execution
    }
  }

  async findPreviousNodeInstance(workflowInstanceId, currentNodeId) {
    try {
      // Get workflow connections to find the previous node
      const { rows: connections } = await pool.query(
        'SELECT * FROM workflow_connections WHERE to_node_id = $1',
        [currentNodeId]
      );

      if (connections.length === 0) {
        console.log('No previous node found for current node:', currentNodeId);
        return null;
      }

      // Get the previous node ID (assuming single connection for now)
      const previousNodeId = connections[0].from_node_id;

      // Find the node instance for the previous node in this workflow instance
      const { rows: nodeInstances } = await pool.query(
        `SELECT wni.* 
         FROM workflow_node_instances wni
         JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
         WHERE wni.workflow_instance_id = $1 AND wn.node_id = $2
         ORDER BY wni.created_at DESC
         LIMIT 1`,
        [workflowInstanceId, previousNodeId]
      );

      if (nodeInstances.length === 0) {
        console.log('No previous node instance found for node:', previousNodeId);
        return null;
      }

      return nodeInstances[0];
    } catch (error) {
      console.error('Error finding previous node instance:', error);
      return null;
    }
  }

}

module.exports = ApprovalNodeExecutor; 