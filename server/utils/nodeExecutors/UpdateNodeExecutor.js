const pool = require('../../config/database');
const WorkflowNodeInstance = require('../../models/WorkflowNodeInstance');
const WorkflowInstance = require('../../models/WorkflowInstance');
const Account = require('../../models/crm/Account');
const Opportunity = require('../../models/crm/Opportunity')
const Contact = require('../../models/crm/Contact');
const AccountRelationship = require('../../models/crm/AccountRelationship');
const AccountContact = require('../../models/crm/AccountContact');
const OpportunityContact = require('../../models/crm/OpportunityContact');
const { replaceWorkflowPlaceholders } = require('../workflowPlaceholder');
const { ConversationRole } = require('@aws-sdk/client-bedrock-runtime');

/**
 * UpdateNodeExecutor - Executes update nodes in workflows
 * 
 * This executor handles updating data, records, or workflow state.
 * It can be used to:
 * - Update database records
 * - Modify workflow data
 * - Update external systems
 * - Transform data between nodes
 * 
 * CONFIGURATION OPTIONS:
 * - updateType: 'database', 'workflow', 'external', 'transform'
 * - targetTable: Database table to update (for database updates)
 * - updateFields: Fields to update and their values
 * - conditions: WHERE conditions for database updates
 * - transformRules: Rules for data transformation
 * - externalApi: External API configuration for updates
 */
class UpdateNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      const nodeConfig = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
      
      // Update node instance status to in_progress
      await WorkflowNodeInstance.updateStatus(nodeInstance.id, 'in_progress', data);
      console.log("🤑🤑🤑🤑🤑,", nodeInstance, node, workflowInstance, data)
      // Log update execution start
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Update execution started',
        { 
          updateConfig: nodeConfig.updateConfig,
          updateType: nodeConfig.updateType,
          inputData: data
        }
      );

      // Execute update logic based on update type
      const updateResult = await this.executeUpdate(nodeConfig, data, workflowInstance,nodeInstance);

      // Log update completion
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'Update execution completed',
        { result: updateResult }
      );

      // Update node instance status to completed
      await WorkflowNodeInstance.updateStatus(
        nodeInstance.id,
        'completed',
        data,
        updateResult
      );

      return {
        status: 'completed',
        data: data,
        result: updateResult,
        error: null
      };

    } catch (error) {
      console.error('Update node execution error:', error);
      
      // Update node instance status to failed
      await WorkflowNodeInstance.updateStatus(
        nodeInstance.id,
        'failed',
        data,
        null,
        error.message
      );

      return {
        status: 'failed',
        data: data,
        result: {},
        error: error.message
      };
    }
  }

  async executeUpdate(updateConfig, data, workflowInstance,nodeInstance) {
    try {
      const updateType = updateConfig.updateType || 'workflow';
      
      switch (updateType) {
        case 'task':
          return await this.executeTaskUpdate(updateConfig, data,workflowInstance,nodeInstance);
        case 'database':
          return await this.executeDatabaseUpdate(updateConfig, data, workflowInstance);
        case 'workflow':
          return await this.executeWorkflowUpdate(updateConfig, data, workflowInstance);
        case 'external':
          return await this.executeExternalUpdate(updateConfig, data);
        case 'transform':
          return await this.executeDataTransform(updateConfig, data);
        default:
          throw new Error(`Unknown update type: ${updateType}`);
      }
    } catch (error) {
      console.error('Update execution error:', error);
      throw error;
    }
  }

  async executeTaskUpdate(updateConfig, data, workflowInstance,nodeInstance) {
    try {
      // Get taskId and threadId from workflow instance datad
      const { taskId, threadId, userId } = data;
      
      if (!taskId) {
        throw new Error('Task ID is required for task updates');
      }

      if (!userId) {
        throw new Error('User information is required for task updates');
      }

      const usePreviousNodeData = updateConfig.usePreviousNodeData || false;
      const taskThreadMessage = updateConfig.taskThreadMessage || '';
      let updatedTaskThreadMessage = '';
      console.log("usePreviousNodeData", usePreviousNodeData);
      console.log("taskThreadMessage", taskThreadMessage);
      console.log("workflowInstance", workflowInstance);
      console.log("nodeInstance", nodeInstance);
      
      // Fetch task name to add redirect pattern for notifications
      const taskQuery = await pool.query(
        'SELECT title FROM tasks WHERE id = $1 AND isdeleted = false',
        [taskId]
      );
      const taskName = taskQuery.rows.length > 0 && taskQuery.rows[0].title ? taskQuery.rows[0].title : null;
      
      if (!usePreviousNodeData) {
        updatedTaskThreadMessage = await replaceWorkflowPlaceholders(taskThreadMessage, workflowInstance);
        
        // Add task redirect pattern if not already present in the message
        if (taskName && !updatedTaskThreadMessage.includes(`task '${taskName}'`)) {
          updatedTaskThreadMessage += ` task '${taskName}'`;
        }
      }
      console.log("updatedTaskThreadMessage", updatedTaskThreadMessage);
      
      //Need to get prev node instance and get the node instance result
      const prevNodeInstance = await WorkflowNodeInstance.getPrevNodeInstance(workflowInstance.id, nodeInstance.id);
      
      if (!prevNodeInstance) {
        throw new Error('No previous node instance found');
      }
      
      const prevNodeResult = prevNodeInstance.result;
      
      if (!prevNodeResult) {
        throw new Error('No result found in previous node instance');
      }
      
      // Add new thread to the task
      const threadContent = ! usePreviousNodeData ? updatedTaskThreadMessage : prevNodeInstance.node_type === 'pdfNode' ? prevNodeResult.result : `Your request is ${prevNodeResult.decision === 'approved' ? 'Approved' : 'Rejected'} `;
      const workflow_link = `/workflow-instance-history?instanceId=${workflowInstance.id}`;
      const newThreadQuery = `
        INSERT INTO task_threads (task_id, task_message, user_id, workflow_link, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const { rows: newThread } = await pool.query(newThreadQuery, [
        taskId,
        threadContent,
        1,
        workflow_link
      ]);

      if (newThread.length === 0) {
        throw new Error('Failed to create new thread');
      }

      // Send notification to the user
      const notificationMessage = ! usePreviousNodeData ? updatedTaskThreadMessage : prevNodeInstance.node_type === 'pdfNode' ? 'PDF is ready for review' :`${threadContent}`;
      const redirectUrl = `/task-details?id=${taskId}`;
      
      // Create notification in database
      const { rows: notificationResult } = await pool.query(
        "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          userId,
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
        id: userId,
        notification: {
          id: notificationResult[0].id,
          title: 'Task Update',
          message: notificationMessage,
          type: 'task_update',
          data: {
            taskId: taskId,
            threadId: newThread[0].id,
            redirectUrl: redirectUrl
          },
          created_at: new Date().toISOString()
        }
      };

      console.log('Emitting notification for task update:', socketEvent);
      this.io.emit('notification', socketEvent);

      return {
        type: 'task_update',
        taskId: taskId,
        threadId: newThread[0].id,
        threadContent: ! usePreviousNodeData ? updatedTaskThreadMessage : prevNodeInstance.node_type === 'pdfNode' ? 'PDF is ready for review' : threadContent,
        notificationSent: true,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Task update failed: ${error.message}`);
    }
  }

  async executeDatabaseUpdate(updateConfig, data, workflowInstance) {
    try {
      const { table, method } = updateConfig;
      const { rows : workflows } = await pool.query(`SELECT * FROM workflow_workflows WHERE id = $1`, [workflowInstance.workflow_id]);
      if (!workflows.length) {
        throw new Error('Workflow is required for database updates');
      }
      const tenant_id = workflows[0].company_id;
      console.log("$$$@@@@@@@@@@@@@@@@@@@-----updateConfig", updateConfig);
      console.log("$$$@@@@datadata@@@@@@@@@@@@@@@-----data", JSON.stringify(data.graph_data));
      if (!table) {
        throw new Error('Target table is required for database updates');
      }

      if (!method) {
        throw new Error('method is required for database updates');
      }

      if (!data.graph_data?.visualization?.nodes.length) {
        throw new Error('nodes is required for database updates');
      }
      
      // Validate that we have edges for relationship mapping
      if (!data.graph_data?.visualization?.edges) {
        console.warn('No edges found in graph data. Opportunities may not be linked to accounts.');
      }
      
      // Create a map to store created entities and their IDs
      const createdEntities = new Map();
      
      // Enhanced node processing with better entity mapping
      const nodes = data.graph_data.visualization.nodes;
      const edges = data.graph_data.visualization.edges || [];
      
      console.log(`Processing ${nodes.length} nodes with ${edges.length} edges`);
      
      // First pass: Create all entities and build entity map
      for (const node of nodes) {
        try {
          console.log(`Processing node: ${node.id} (${node.group}: ${node.label})`);
          
          switch (node.group) {
            case 'company':
              if (method === 'insert') {
                const createdAccount = await Account.create(node, tenant_id);
                createdEntities.set(node.id, {
                  type: 'account',
                  id: createdAccount.id,
                  data: createdAccount,
                  node: node
                });
                console.log(`✅ Created account: ${node.label} with ID: ${createdAccount.id}`);
              }
              break;
              
            case 'person':
              if (method === 'insert') {
                const createdContact = await Contact.create(node, tenant_id);
                createdEntities.set(node.id, {
                  type: 'contact',
                  id: createdContact.id,
                  data: createdContact,
                  node: node
                });
                console.log(`✅ Created contact: ${node.label} with ID: ${createdContact.id}`);
              }
              break;
              
            case 'opportunity':
              if (method === 'insert') {
                // Enhanced account linking for opportunities
                const accountId = await this.findAccountForOpportunity(node, createdEntities, edges, tenant_id);
                
                // Get the first stage if no stage is provided
                let stageId = node.stage_id;
                let stageName = node.stage;
                
                if (!stageId) {
                  const firstStage = await pool.query(
                    'SELECT * FROM opportunity_stages WHERE tenant_id = $1 ORDER BY order_index LIMIT 1',
                    [tenant_id]
                  );
                  
                  if (firstStage.rows.length > 0) {
                    stageId = firstStage.rows[0].id;
                    stageName = firstStage.rows[0].name;
                    console.log(`🎯 Setting opportunity to first stage: ${stageName} (ID: ${stageId})`);
                  } else {
                    console.log('⚠️ No stages found for tenant, creating opportunity without stage');
                  }
                }
                
                const opportunityData = {
                  ...node,
                  account_id: accountId,
                  stage_id: stageId,
                  stage: stageName
                };
                
                const createdOpportunity = await Opportunity.create(opportunityData, tenant_id);
                
                // Insert into opportunity_stage_history if stage_id is provided
                if (stageId) {
                  try {
                    await pool.query(
                      `INSERT INTO opportunity_stage_history (
                        opportunity_id, stage_id, from_stage_id, entered_at, tenant_id, created_by
                      ) VALUES ($1, $2, $2, NOW(), $3, $4)`,
                      [
                        createdOpportunity.id,
                        stageId,
                        tenant_id,
                        null // created_by is null for workflow-created opportunities
                      ]
                    );
                    console.log('✅ Stage history recorded for new opportunity (from_stage_id = stage_id for initial stage)');
                  } catch (historyError) {
                    console.warn('⚠️ Failed to record stage history:', historyError.message);
                    // Don't fail the main operation if history recording fails
                  }
                }
                
                createdEntities.set(node.id, {
                  type: 'opportunity',
                  id: createdOpportunity.id,
                  data: createdOpportunity,
                  node: node
                });
                console.log(`✅ Created opportunity: ${node.label} with ID: ${createdOpportunity.id}, account_id: ${accountId}, stage: ${stageName}`);
              }
              break;
              
            default:
              console.log(`⚠️  Skipping node with unknown group: ${node.group}`);
              break;
          }
        } catch (error) {
          console.error(`❌ Error creating ${node.group} node ${node.label}:`, error);
          throw error;
        }
      }
      
      // Second pass: Create relationships based on graph edges
      let createdRelationships = [];
      if (edges.length > 0) {
        try {
          console.log(`🔗 Creating relationships from ${edges.length} edges...`);
          createdRelationships = await this.createRelationshipsFromEdges(
            edges,
            createdEntities,
            tenant_id
          );
        } catch (error) {
          console.error('❌ Error creating relationships from edges:', error);
          // Don't fail the entire operation if relationship creation fails
          console.warn('⚠️  Continuing with entity creation despite relationship creation failure');
        }
      }
      
      // Log summary of created entities and relationships
      const summary = {
        accounts: Array.from(createdEntities.values()).filter(e => e.type === 'account').length,
        contacts: Array.from(createdEntities.values()).filter(e => e.type === 'contact').length,
        opportunities: Array.from(createdEntities.values()).filter(e => e.type === 'opportunity').length,
        relationships: createdRelationships.length
      };
      console.log('📊 Database update summary:', summary);

      return {
        type: 'database_update',
        table: table,
        updatedRows: nodes.length,
        updatedData: nodes,
        createdEntities: Object.fromEntries(createdEntities),
        createdRelationships: createdRelationships,
        summary: summary,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }
  }

  /**
   * Find the appropriate account for an opportunity
   * @param {Object} opportunityNode - The opportunity node
   * @param {Map} createdEntities - Map of created entities
   * @param {Array} edges - Array of edges from graph data
   * @param {string} tenant_id - Tenant ID
   * @returns {string|null} - Account ID or null if not found
   */
  async findAccountForOpportunity(opportunityNode, createdEntities, edges, tenant_id) {
    let accountId = null;
    
    // Method 1: Look for direct edges to accounts
    const directAccountEdges = edges.filter(edge => 
      (edge.from === opportunityNode.id && createdEntities.get(edge.to)?.type === 'account') ||
      (edge.to === opportunityNode.id && createdEntities.get(edge.from)?.type === 'account')
    );
    
    if (directAccountEdges.length > 0) {
      const edge = directAccountEdges[0];
      const accountEntity = createdEntities.get(edge.from === opportunityNode.id ? edge.to : edge.from);
      accountId = accountEntity.id;
      console.log(`🔗 Found account ID ${accountId} for opportunity ${opportunityNode.label} via direct edge`);
      return accountId;
    }
    
    // Method 2: Look for indirect connections through contacts
    const contactEdges = edges.filter(edge => 
      (edge.from === opportunityNode.id && createdEntities.get(edge.to)?.type === 'contact') ||
      (edge.to === opportunityNode.id && createdEntities.get(edge.from)?.type === 'contact')
    );
    
    for (const contactEdge of contactEdges) {
      const contactEntity = createdEntities.get(contactEdge.from === opportunityNode.id ? contactEdge.to : contactEdge.from);
      
      // Look for edges from this contact to accounts
      const contactToAccountEdges = edges.filter(edge => 
        (edge.from === contactEntity.node.id && createdEntities.get(edge.to)?.type === 'account') ||
        (edge.to === contactEntity.node.id && createdEntities.get(edge.from)?.type === 'account')
      );
      
      if (contactToAccountEdges.length > 0) {
        const accountEdge = contactToAccountEdges[0];
        const accountEntity = createdEntities.get(accountEdge.from === contactEntity.node.id ? accountEdge.to : accountEdge.from);
        accountId = accountEntity.id;
        console.log(`🔗 Found account ID ${accountId} for opportunity ${opportunityNode.label} via contact ${contactEntity.node.label}`);
        return accountId;
      }
    }
    
    // Method 3: Try to find by company name in node data
    if (opportunityNode.company_name) {
      try {
        const accounts = await Account.findByTenant(tenant_id);
        const matchingAccount = accounts.find(acc => 
          acc.name && acc.name.toLowerCase() === opportunityNode.company_name.toLowerCase()
        );
        if (matchingAccount) {
          accountId = matchingAccount.id;
          console.log(`🔗 Found account ID ${accountId} for opportunity ${opportunityNode.label} by company name: ${opportunityNode.company_name}`);
          return accountId;
        }
      } catch (error) {
        console.warn(`⚠️  Error searching for account by company name: ${error.message}`);
      }
    }
    
    // Method 4: Try to find by node label (which might be the company name)
    if (opportunityNode.label) {
      try {
        const accounts = await Account.findByTenant(tenant_id);
        const matchingAccount = accounts.find(acc => 
          acc.name && acc.name.toLowerCase() === opportunityNode.label.toLowerCase()
        );
        if (matchingAccount) {
          accountId = matchingAccount.id;
          console.log(`🔗 Found account ID ${accountId} for opportunity ${opportunityNode.label} by label: ${opportunityNode.label}`);
          return accountId;
        }
      } catch (error) {
        console.warn(`⚠️  Error searching for account by label: ${error.message}`);
      }
    }
    
    // Method 5: Look for any account in the graph and use it as fallback
    const accountEntities = Array.from(createdEntities.values()).filter(e => e.type === 'account');
    if (accountEntities.length > 0) {
      accountId = accountEntities[0].id;
      console.log(`🔗 Using fallback account ID ${accountId} for opportunity ${opportunityNode.label}`);
      return accountId;
    }
    
    console.warn(`⚠️  No account found for opportunity: ${opportunityNode.label}. Creating opportunity without account_id.`);
    return null;
  }

  async createRelationshipsFromEdges(edges, createdEntities, tenant_id) {
    const createdRelationships = [];
    
    if (!edges || edges.length === 0) {
      console.log('No edges found for relationship creation');
      return createdRelationships;
    }

    // Validate tenant_id
    if (!tenant_id) {
      throw new Error('Tenant ID is required for relationship creation');
    }

    // Validate createdEntities
    if (!createdEntities || createdEntities.size === 0) {
      console.log('No entities found for relationship creation');
      return createdRelationships;
    }

    console.log(`Creating relationships from ${edges.length} edges`);
    console.log('Available entities:', Array.from(createdEntities.entries()).map(([id, entity]) => 
      `${id}: ${entity.type} (${entity.id}) - Group: ${entity.data?.group || 'unknown'}`
    ));
    console.log('Entity type mapping:', {
      'company': 'account',
      'person': 'contact', 
      'opportunity': 'opportunity'
    });

    // Get existing relationship types for validation
    const existingRelationshipTypes = await this.getExistingRelationshipTypes(tenant_id);

    // Pre-validate all edges to ensure they have valid source and target entities
    const validEdges = edges.filter(edge => {
      const fromEntity = createdEntities.get(edge.from);
      const toEntity = createdEntities.get(edge.to);
      
      if (!fromEntity || !toEntity) {
        console.warn(`⚠️  Skipping invalid edge ${edge.from} -> ${edge.to}: entities not found`);
        return false;
      }
      
      if (!fromEntity.id || !toEntity.id) {
        console.warn(`⚠️  Skipping invalid edge ${edge.from} -> ${edge.to}: missing entity IDs`);
        return false;
      }
      
      return true;
    });

    console.log(`Processing ${validEdges.length} valid edges out of ${edges.length} total edges`);

    for (const edge of validEdges) {
      try {
        console.log(`\n🔗 Processing edge: ${edge.from} -> ${edge.to}`);
        console.log(`   Edge data:`, {
          label: edge.label,
          relationship_type: edge.relationship_type,
          role: edge.role,
          type: edge.type,
          title: edge.title,
          group: edge.group,
          thickness: edge.thickness,
          description: edge.description
        });
        
        const fromEntity = createdEntities.get(edge.from);
        const toEntity = createdEntities.get(edge.to);
        
        // Double-check entities exist (should be guaranteed by pre-validation)
        if (!fromEntity || !toEntity) {
          console.log(`⚠️  Skipping edge ${edge.from} -> ${edge.to}: entities not found in created entities`);
          continue;
        }

        console.log(`✅ Found entities: ${fromEntity.type}:${fromEntity.id} -> ${toEntity.type}:${toEntity.id}`);
        console.log(`   From entity: ${fromEntity.data?.name || fromEntity.data?.label} (${fromEntity.type})`);
        console.log(`   To entity: ${toEntity.data?.name || toEntity.data?.label} (${toEntity.type})`);

        // Validate entity types
        const validTypes = ['account', 'contact', 'opportunity'];
        if (!validTypes.includes(fromEntity.type)) {
          console.error(`🚨 Invalid from entity type: ${fromEntity.type} for entity ${edge.from}`);
          continue;
        }
        if (!validTypes.includes(toEntity.type)) {
          console.error(`🚨 Invalid to entity type: ${toEntity.type} for entity ${edge.to}`);
          continue;
        }

        // Prevent self-relationships
        if (fromEntity.id === toEntity.id) {
          console.warn(`⚠️  Skipping self-relationship for entity ${fromEntity.id}`);
          continue;
        }

        // Parse relationship type from edge data
        const relationshipType = this.parseRelationshipTypeFromEdge(edge, fromEntity, toEntity);
        
        if (!relationshipType) {
          console.warn(`⚠️  Skipping edge ${edge.from} -> ${edge.to}: could not determine relationship type`);
          continue;
        }

        // Enhanced relationship type validation and creation
        const validatedRelationshipType = await this.validateAndCreateRelationshipType(
          relationshipType,
          fromEntity.type,
          toEntity.type,
          tenant_id,
          existingRelationshipTypes
        );

        if (!validatedRelationshipType) {
          console.warn(`⚠️  Skipping edge ${edge.from} -> ${edge.to}: invalid relationship type`);
          continue;
        }

        // Check for existing relationships to prevent duplicates
        const existingRelationship = await this.checkExistingRelationship(
          fromEntity, 
          toEntity, 
          validatedRelationshipType, 
          tenant_id
        );
        
        if (existingRelationship) {
          console.log(`⚠️  Skipping duplicate relationship: ${fromEntity.type}:${fromEntity.id} -> ${toEntity.type}:${toEntity.id} already exists`);
          continue;
        }

        let relationshipResult = null;
        let relationshipModel = 'none';

        // Determine relationship type and create using appropriate model
        if (fromEntity.type === 'account' && toEntity.type === 'account') {
          console.log(`🔗 Creating Account-Account relationship using AccountRelationship model`);
          relationshipModel = 'AccountRelationship';
          
          // Account to Account relationship
          const relationshipData = {
            parent_account_id: fromEntity.id,
            child_account_id: toEntity.id,
            relationship_type: validatedRelationshipType,
            description: edge.description || `Relationship between ${fromEntity.data?.name || 'Account'} and ${toEntity.data?.name || 'Account'}` || 'Account relationship'
          };
          
          console.log(`AccountRelationship data:`, relationshipData);
          relationshipResult = await AccountRelationship.create(relationshipData, tenant_id);
          
        } else if (fromEntity.type === 'account' && toEntity.type === 'contact') {
          console.log(`🔗 Creating Account-Contact relationship using AccountContact model`);
          relationshipModel = 'AccountContact';
          
          // Account to Contact relationship
          const relationshipData = {
            account_id: fromEntity.id,
            contact_id: toEntity.id,
            relationship_type: validatedRelationshipType,
            role: edge.role || 'Employee',
            is_primary: edge.is_primary || false,
            description: edge.description || `Contact relationship between ${fromEntity.data?.name || 'Account'} and ${toEntity.data?.first_name || toEntity.data?.last_name || 'Contact'}`
          };
          
          console.log(`AccountContact data:`, relationshipData);
          relationshipResult = await AccountContact.create(relationshipData, tenant_id);
          
        } else if (fromEntity.type === 'contact' && toEntity.type === 'account') {
          console.log(`🔗 Creating Contact-Account relationship using AccountContact model`);
          relationshipModel = 'AccountContact';
          
          // Contact to Account relationship
          const relationshipData = {
            account_id: toEntity.id,
            contact_id: fromEntity.id,
            relationship_type: validatedRelationshipType,
            role: edge.role || 'Employee',
            is_primary: edge.is_primary || false,
            description: edge.description || `Contact relationship between ${toEntity.data?.name || 'Account'} and ${fromEntity.data?.first_name || fromEntity.data?.last_name || 'Contact'}`
          };
          
          console.log(`AccountContact data:`, relationshipData);
          relationshipResult = await AccountContact.create(relationshipData, tenant_id);
          
        } else if (fromEntity.type === 'contact' && toEntity.type === 'opportunity') {
          console.log(`🔗 Creating Contact-Opportunity relationship using OpportunityContact model`);
          relationshipModel = 'OpportunityContact';
          
          // Contact to Opportunity relationship
          const relationshipData = {
            opportunity_id: toEntity.id,
            contact_id: fromEntity.id,
            role: validatedRelationshipType
          };
          
          console.log(`OpportunityContact data:`, relationshipData);
          relationshipResult = await OpportunityContact.create(relationshipData, tenant_id);
          
        } else if (fromEntity.type === 'opportunity' && toEntity.type === 'contact') {
          console.log(`🔗 Creating Opportunity-Contact relationship using OpportunityContact model`);
          relationshipModel = 'OpportunityContact';
          
          // Opportunity to Contact relationship
          const relationshipData = {
            opportunity_id: fromEntity.id,
            contact_id: toEntity.id,
            role: validatedRelationshipType
          };
          
          console.log(`OpportunityContact data:`, relationshipData);
          relationshipResult = await OpportunityContact.create(relationshipData, tenant_id);
          
        } else if (fromEntity.type === 'opportunity' && toEntity.type === 'account') {
          console.log(`⏭️  Skipping Opportunity-Account relationship (handled via account_id field)`);
          // Opportunity to Account relationship - this is handled by the opportunity's account_id field
          console.log(`Opportunity ${fromEntity.id} already linked to Account ${toEntity.id} via account_id field`);
          continue;
          
        } else if (fromEntity.type === 'account' && toEntity.type === 'opportunity') {
          console.log(`⏭️  Skipping Account-Opportunity relationship (handled via account_id field)`);
          // Account to Opportunity relationship - this is handled by the opportunity's account_id field
          console.log(`Account ${fromEntity.id} already linked to Opportunity ${toEntity.id} via account_id field`);
          continue;
          
        } else {
          console.log(`⚠️  Skipping unsupported relationship: ${fromEntity.type} -> ${toEntity.type}`);
          continue;
        }

        // Safety check: Ensure we never call AccountRelationship.create for non-account relationships
        if (relationshipModel === 'AccountRelationship' && (fromEntity.type !== 'account' || toEntity.type !== 'account')) {
          console.error(`🚨 CRITICAL ERROR: Attempted to use AccountRelationship model for ${fromEntity.type} -> ${toEntity.type} relationship`);
          console.error(`This should never happen. Entity types: from=${fromEntity.type}, to=${toEntity.type}`);
          continue;
        }

        // Additional validation: Ensure model matches entity types
        if (relationshipModel === 'AccountContact' && !((fromEntity.type === 'account' && toEntity.type === 'contact') || (fromEntity.type === 'contact' && toEntity.type === 'account'))) {
          console.error(`🚨 CRITICAL ERROR: Attempted to use AccountContact model for ${fromEntity.type} -> ${toEntity.type} relationship`);
          continue;
        }
        
        if (relationshipModel === 'OpportunityContact' && !((fromEntity.type === 'contact' && toEntity.type === 'opportunity') || (fromEntity.type === 'opportunity' && toEntity.type === 'contact'))) {
          console.error(`🚨 CRITICAL ERROR: Attempted to use OpportunityContact model for ${fromEntity.type} -> ${toEntity.type} relationship`);
          continue;
        }

        // Add the created relationship to our results
        if (relationshipResult) {
          let relationshipInfo = {
            id: relationshipResult.id,
            from: `${fromEntity.type}:${fromEntity.id}`,
            to: `${toEntity.type}:${toEntity.id}`,
            type: validatedRelationshipType,
            description: edge.description || `Relationship between ${fromEntity.type} and ${toEntity.type}`,
            model: relationshipModel,
            created_at: new Date().toISOString()
          };

          // Add specific fields based on relationship type
          if (fromEntity.type === 'account' && toEntity.type === 'account') {
            relationshipInfo.parent_account_id = relationshipResult.parent_account_id;
            relationshipInfo.child_account_id = relationshipResult.child_account_id;
          } else if (fromEntity.type === 'account' && toEntity.type === 'contact') {
            relationshipInfo.role = relationshipResult.role;
            relationshipInfo.account_id = relationshipResult.account_id;
            relationshipInfo.contact_id = relationshipResult.contact_id;
          } else if (fromEntity.type === 'contact' && toEntity.type === 'account') {
            relationshipInfo.role = relationshipResult.role;
            relationshipInfo.account_id = relationshipResult.account_id;
            relationshipInfo.contact_id = relationshipResult.contact_id;
          } else if (fromEntity.type === 'contact' && toEntity.type === 'opportunity') {
            relationshipInfo.role = relationshipResult.role;
            relationshipInfo.opportunity_id = relationshipResult.opportunity_id;
            relationshipInfo.contact_id = relationshipResult.contact_id;
          } else if (fromEntity.type === 'opportunity' && toEntity.type === 'contact') {
            relationshipInfo.role = relationshipResult.role;
            relationshipInfo.opportunity_id = relationshipResult.opportunity_id;
            relationshipInfo.contact_id = relationshipResult.contact_id;
          }

          createdRelationships.push(relationshipInfo);
          
          console.log(`✅ Created relationship using ${relationshipModel}: ${fromEntity.type}:${fromEntity.id} -> ${toEntity.type}:${toEntity.id} (${validatedRelationshipType})`);
          console.log(`   Relationship ID: ${relationshipResult.id}`);
          console.log(`   Relationship details:`, relationshipInfo);
        } else {
          console.log(`⚠️  Relationship creation returned null for: ${fromEntity.type}:${fromEntity.id} -> ${toEntity.type}:${toEntity.id} using ${relationshipModel}`);
        }

      } catch (error) {
        console.error(`Error creating relationship for edge ${edge.from} -> ${edge.to}:`, error);
        // Continue with other relationships instead of failing completely
        console.error(`Full error details:`, error);
      }
    }

    console.log(`Successfully created ${createdRelationships.length} relationships`);
    return createdRelationships;
  }

  /**
   * Parse relationship type from edge data
   * @param {Object} edge - The edge object from graph data
   * @param {Object} fromEntity - The source entity
   * @param {Object} toEntity - The target entity
   * @returns {string|null} - The parsed relationship type or null if not found
   */
  parseRelationshipTypeFromEdge(edge, fromEntity, toEntity) {
    // Priority order for relationship type sources
    const relationshipTypeSources = [
      edge.relationship_type,
      edge.role,
      edge.type,
      edge.label,
      edge.title,
      edge.group
    ];

    // Find the first non-empty relationship type
    for (const source of relationshipTypeSources) {
      if (source && typeof source === 'string' && source.trim() !== '') {
        console.log(`📝 Found relationship type source: ${source}`);
        
        // Map the edge label to a standard relationship type
        const mappedType = this.mapEdgeLabelToRelationshipType(source, fromEntity.type, toEntity.type);
        if (mappedType) {
          console.log(`✅ Parsed and mapped relationship type: ${source} -> ${mappedType}`);
          return mappedType;
        }
      }
    }

    // If no explicit relationship type found, infer from entity types
    const inferredType = this.inferRelationshipType(fromEntity, toEntity);
    if (inferredType) {
      console.log(`🔍 Inferred relationship type: ${inferredType}`);
      return inferredType;
    }

    console.warn(`⚠️  Could not parse relationship type from edge data:`, edge);
    return null;
  }

  /**
   * Infer relationship type based on entity types
   * @param {Object} fromEntity - The source entity
   * @param {Object} toEntity - The target entity
   * @returns {string|null} - The inferred relationship type or null
   */
  inferRelationshipType(fromEntity, toEntity) {
    const fromType = fromEntity.type;
    const toType = toEntity.type;

    // Define default relationship types for each entity combination
    const defaultTypes = {
      'account-account': 'parent_child',
      'account-contact': 'employs',
      'contact-account': 'employed_by',
      'contact-opportunity': 'Influencer',
      'opportunity-contact': 'Influencer'
    };

    const key = `${fromType}-${toType}`;
    const defaultType = defaultTypes[key];

    if (defaultType) {
      console.log(`🎯 Inferred default relationship type for ${fromType} -> ${toType}: ${defaultType}`);
      return defaultType;
    }

    console.warn(`⚠️  No default relationship type defined for ${fromType} -> ${toType}`);
    return null;
  }

  /**
   * Map edge label to standard relationship type
   * @param {string} edgeLabel - The label from the edge
   * @param {string} fromEntityType - The source entity type
   * @param {string} toEntityType - The target entity type
   * @returns {string} - The mapped relationship type
   */
  mapEdgeLabelToRelationshipType(edgeLabel, fromEntityType, toEntityType) {
    if (!edgeLabel) return null;

    const label = edgeLabel.toLowerCase().trim();
    
    // Define mapping rules for common edge labels
    const labelMappings = {
      // Account-Contact mappings
      'works at': 'employs',
      'employed by': 'employs',
      'employee': 'employs',
      'manager': 'employs',
      'director': 'employs',
      'executive': 'employs',
      'owner': 'employs',
      'founder': 'employs',
      'co-founder': 'employs',
      'president': 'employs',
      'ceo': 'employs',
      'cto': 'employs',
      'cfo': 'employs',
      'vice president': 'employs',
      'vp': 'employs',
      'head of': 'employs',
      'lead': 'employs',
      'specialist': 'employs',
      'analyst': 'employs',
      'decision maker': 'employs',
      'advisor': 'employs',
      'consultant': 'employs',
      'vendor': 'employs',
      'stakeholder': 'employs',
      
      // Account-Account mappings
      'parent company': 'parent_child',
      'child company': 'parent_child',
      'subsidiary': 'parent_child',
      'sister company': 'parent_child',
      'holding company': 'parent_child',
      'affiliate': 'parent_child',
      'branch': 'parent_child',
      'division': 'parent_child',
      'department': 'parent_child',
      'partner': 'partner',
      'competitor': 'competitor',
      'supplier': 'supplier',
      'customer': 'customer',
      
      // Contact-Opportunity mappings
      'targets': 'Influencer',
      'supports': 'Influencer',
      'demonstrates': 'Influencer',
      'engages': 'Influencer',
      'focuses on': 'Influencer',
      'focus on': 'Influencer',
      'influencer': 'Influencer',
      'decision maker': 'Decision Maker',
      'champion': 'Champion',
      'user': 'User',
      'technical contact': 'Technical Contact',
      'economic buyer': 'Economic Buyer',
      'owner': 'Owner',
      'stakeholder': 'Stakeholder',
      'team member': 'Team Member',
      'project manager': 'Project Manager',
      'sponsor': 'Sponsor'
    };

    // Check for exact match
    if (labelMappings[label]) {
      console.log(`🔄 Mapped edge label "${edgeLabel}" to relationship type "${labelMappings[label]}"`);
      return labelMappings[label];
    }

    // Check for partial matches
    for (const [pattern, mappedType] of Object.entries(labelMappings)) {
      if (label.includes(pattern) || pattern.includes(label)) {
        console.log(`🔄 Partial match: mapped edge label "${edgeLabel}" to relationship type "${mappedType}"`);
        return mappedType;
      }
    }

    // If no mapping found, return the original label
    console.log(`📝 No mapping found for edge label "${edgeLabel}", using as-is`);
    return edgeLabel;
  }

  /**
   * Get existing relationship types from database for validation
   * @param {string} tenantId - The tenant ID
   * @returns {Object} - Object containing existing relationship types by category
   */
  async getExistingRelationshipTypes(tenantId) {
    try {
      const existingTypes = {
        'account-account': [],
        'account-contact': [],
        'contact-opportunity': []
      };

      // Get account-account relationship types
      const accountResult = await pool.query(
        'SELECT DISTINCT relationship_type FROM account_relationships WHERE tenant_id = $1 AND relationship_type IS NOT NULL AND relationship_type != \'\'',
        [tenantId]
      );
      existingTypes['account-account'] = accountResult.rows.map(row => row.relationship_type);

      // Get account-contact relationship types
      const accountContactResult = await pool.query(
        'SELECT DISTINCT relationship_type FROM account_contacts WHERE tenant_id = $1 AND relationship_type IS NOT NULL AND relationship_type != \'\'',
        [tenantId]
      );
      existingTypes['account-contact'] = accountContactResult.rows.map(row => row.relationship_type);

      // Get contact-opportunity relationship types
      const contactOpportunityResult = await pool.query(
        'SELECT DISTINCT role FROM opportunity_contacts WHERE tenant_id = $1 AND role IS NOT NULL AND role != \'\'',
        [tenantId]
      );
      existingTypes['contact-opportunity'] = contactOpportunityResult.rows.map(row => row.role);

      return existingTypes;
    } catch (error) {
      console.error('Error fetching existing relationship types:', error);
      return {
        'account-account': [],
        'account-contact': [],
        'contact-opportunity': []
      };
    }
  }

  /**
   * Validate and create relationship type if it doesn't exist
   * @param {string} relationshipType - The relationship type to validate
   * @param {string} fromEntityType - The source entity type
   * @param {string} toEntityType - The target entity type
   * @param {string} tenantId - The tenant ID
   * @param {Object} existingTypes - Existing relationship types
   * @returns {string|null} - Validated relationship type or null if invalid
   */
  async validateAndCreateRelationshipType(relationshipType, fromEntityType, toEntityType, tenantId, existingTypes) {
    try {
      if (!relationshipType || typeof relationshipType !== 'string') {
        console.warn('Invalid relationship type provided');
        return null;
      }

      const key = `${fromEntityType}-${toEntityType}`;
      const existingTypeList = existingTypes[key] || [];

      // If relationship type already exists, use it
      if (existingTypeList.includes(relationshipType)) {
        console.log(`✅ Using existing relationship type: ${relationshipType}`);
        return relationshipType;
      }

      // Validate against predefined valid types
      const validation = this.validateRelationshipType(relationshipType, fromEntityType, toEntityType);
      
      if (validation.isValid) {
        console.log(`✅ Using valid relationship type: ${relationshipType}`);
        return relationshipType;
      }

      // If invalid, use default type
      console.warn(`⚠️  Invalid relationship type '${relationshipType}' for ${fromEntityType} -> ${toEntityType}. Using default: '${validation.type}'`);
      return validation.type;

    } catch (error) {
      console.error('Error validating relationship type:', error);
      return null;
    }
  }

  /**
   * Check if a relationship already exists between two entities
   * @param {Object} fromEntity - The source entity
   * @param {Object} toEntity - The target entity
   * @param {string} relationshipType - The type of relationship
   * @param {string} tenantId - The tenant ID
   * @returns {Object|null} - Existing relationship or null if none exists
   */
  async checkExistingRelationship(fromEntity, toEntity, relationshipType, tenantId) {
    try {
      if (fromEntity.type === 'account' && toEntity.type === 'account') {
        // Check AccountRelationship table
        const result = await pool.query(
          `SELECT * FROM account_relationships 
           WHERE tenant_id = $1 
           AND ((parent_account_id = $2 AND child_account_id = $3) OR (parent_account_id = $3 AND child_account_id = $2))
           AND relationship_type = $4`,
          [tenantId, fromEntity.id, toEntity.id, relationshipType]
        );
        return result.rows[0] || null;
        
      } else if ((fromEntity.type === 'account' && toEntity.type === 'contact') || 
                 (fromEntity.type === 'contact' && toEntity.type === 'account')) {
        // Check AccountContact table
        const accountId = fromEntity.type === 'account' ? fromEntity.id : toEntity.id;
        const contactId = fromEntity.type === 'contact' ? fromEntity.id : toEntity.id;
        
        const result = await pool.query(
          `SELECT * FROM account_contacts 
           WHERE tenant_id = $1 
           AND account_id = $2 
           AND contact_id = $3
           AND relationship_type = $4`,
          [tenantId, accountId, contactId, relationshipType]
        );
        return result.rows[0] || null;
        
      } else if ((fromEntity.type === 'contact' && toEntity.type === 'opportunity') || 
                 (fromEntity.type === 'opportunity' && toEntity.type === 'contact')) {
        // Check OpportunityContact table
        const opportunityId = fromEntity.type === 'opportunity' ? fromEntity.id : toEntity.id;
        const contactId = fromEntity.type === 'contact' ? fromEntity.id : toEntity.id;
        
        const result = await pool.query(
          `SELECT * FROM opportunity_contacts 
           WHERE tenant_id = $1 
           AND opportunity_id = $2 
           AND contact_id = $3
           AND role = $4`,
          [tenantId, opportunityId, contactId, relationshipType]
        );
        return result.rows[0] || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error checking existing relationship:', error);
      return null;
    }
  }

  /**
   * Validate relationship type against supported types
   * @param {string} relationshipType - The relationship type to validate
   * @param {string} fromEntityType - The source entity type
   * @param {string} toEntityType - The target entity type
   * @returns {Object} - Object with isValid flag and default type if invalid
   */
  validateRelationshipType(relationshipType, fromEntityType, toEntityType) {
    // Define valid relationship types for each entity combination
    const validTypes = {
      'account-account': [
        'parent_child', 'subsidiary', 'partner', 'competitor', 'supplier', 'customer',
        'parent company', 'child company', 'sister company', 'holding company',
        'affiliate', 'branch', 'division', 'department'
      ],
      'account-contact': [
        'employs', 'decision_maker', 'advisor', 'consultant', 'vendor', 'stakeholder',
        'works at', 'employed by', 'employee', 'manager', 'director', 'executive',
        'owner', 'founder', 'co-founder', 'president', 'ceo', 'cto', 'cfo',
        'vice president', 'vp', 'head of', 'lead', 'specialist', 'analyst'
      ],
      'contact-account': [
        'employed_by', 'represents', 'advises', 'consults_for', 'stakeholder_of',
        'works at', 'employed by', 'employee', 'manager', 'director', 'executive',
        'owner', 'founder', 'co-founder', 'president', 'ceo', 'cto', 'cfo',
        'vice president', 'vp', 'head of', 'lead', 'specialist', 'analyst'
      ],
      'contact-opportunity': [
        'Influencer', 'Decision Maker', 'Champion', 'User', 'Technical Contact', 'Economic Buyer',
        'influencer', 'decision maker', 'champion', 'user', 'technical contact', 'economic buyer',
        'owner', 'stakeholder', 'team member', 'project manager', 'sponsor',
        'targets', 'supports', 'demonstrates', 'engages', 'focuses on'
      ],
      'opportunity-contact': [
        'Influencer', 'Decision Maker', 'Champion', 'User', 'Technical Contact', 'Economic Buyer',
        'influencer', 'decision maker', 'champion', 'user', 'technical contact', 'economic buyer',
        'owner', 'stakeholder', 'team member', 'project manager', 'sponsor',
        'targets', 'supports', 'demonstrates', 'engages', 'focuses on'
      ]
    };

    const key = `${fromEntityType}-${toEntityType}`;
    const validTypeList = validTypes[key] || [];
    
    // Case-insensitive comparison
    const normalizedRelationshipType = relationshipType.toLowerCase();
    const normalizedValidTypes = validTypeList.map(type => type.toLowerCase());
    
    if (normalizedValidTypes.includes(normalizedRelationshipType)) {
      // Return the original case from valid types if it matches
      const matchingType = validTypeList.find(type => type.toLowerCase() === normalizedRelationshipType);
      return { isValid: true, type: matchingType || relationshipType };
    }

    // Return default type based on entity combination
    const defaultTypes = {
      'account-account': 'parent_child',
      'account-contact': 'employs',
      'contact-account': 'employed_by',
      'contact-opportunity': 'Influencer',
      'opportunity-contact': 'Influencer'
    };

    const defaultType = defaultTypes[key] || 'related';
    
    return { 
      isValid: false, 
      type: defaultType,
      message: `Invalid relationship type '${relationshipType}' for ${fromEntityType} -> ${toEntityType}. Using default: '${defaultType}'`
    };
  }

  async executeWorkflowUpdate(updateConfig, data, workflowInstance) {
    try {
      const { updateFields, mergeStrategy = 'replace' } = updateConfig;
      
      if (!updateFields) {
        throw new Error('Update fields are required for workflow updates');
      }

      let updatedData = { ...workflowInstance.data };

      // Apply update based on merge strategy
      switch (mergeStrategy) {
        case 'replace':
          updatedData = { ...updatedData, ...updateFields };
          break;
        case 'merge':
          updatedData = this.deepMerge(updatedData, updateFields);
          break;
        case 'append':
          // For arrays, append new items
          Object.keys(updateFields).forEach(key => {
            if (Array.isArray(updatedData[key]) && Array.isArray(updateFields[key])) {
              updatedData[key] = [...updatedData[key], ...updateFields[key]];
            } else {
              updatedData[key] = updateFields[key];
            }
          });
          break;
        default:
          updatedData = { ...updatedData, ...updateFields };
      }

      // Update workflow instance data
      await WorkflowInstance.updateStatus(
        workflowInstance.id,
        workflowInstance.status,
        workflowInstance.current_node_id,
        updatedData
      );

      return {
        type: 'workflow_update',
        updatedFields: Object.keys(updateFields),
        mergeStrategy,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Workflow update failed: ${error.message}`);
    }
  }

  async executeExternalUpdate(updateConfig, data) {
    try {
      const { externalApi, updatePayload } = updateConfig;
      
      if (!externalApi || !externalApi.url) {
        throw new Error('External API configuration is required for external updates');
      }

      const axios = require('axios');
      
      // Prepare request config
      const requestConfig = {
        method: externalApi.method || 'PUT',
        url: externalApi.url,
        headers: {
          'Content-Type': 'application/json',
          ...externalApi.headers
        }
      };

      // Add authentication if provided
      if (externalApi.authentication) {
        if (externalApi.authentication.type === 'bearer') {
          requestConfig.headers.Authorization = `Bearer ${externalApi.authentication.token}`;
        } else if (externalApi.authentication.type === 'basic') {
          const credentials = Buffer.from(`${externalApi.authentication.username}:${externalApi.authentication.password}`).toString('base64');
          requestConfig.headers.Authorization = `Basic ${credentials}`;
        }
      }

      // Add payload
      if (updatePayload) {
        requestConfig.data = updatePayload;
      }

      // Make the API call
      const response = await axios(requestConfig);

      return {
        type: 'external_update',
        url: externalApi.url,
        method: requestConfig.method,
        status: response.status,
        responseData: response.data,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`External update failed: ${error.message}`);
    }
  }

  async executeDataTransform(updateConfig, data) {
    try {
      const { transformRules, outputFormat } = updateConfig;
      
      if (!transformRules) {
        throw new Error('Transform rules are required for data transformation');
      }

      let transformedData = { ...data };

      // Apply transformation rules
      Object.keys(transformRules).forEach(targetField => {
        const rule = transformRules[targetField];
        
        switch (rule.type) {
          case 'field_mapping':
            transformedData[targetField] = data[rule.sourceField];
            break;
          case 'concatenation':
            const values = rule.fields.map(field => data[field] || '');
            transformedData[targetField] = values.join(rule.separator || ' ');
            break;
          case 'calculation':
            const result = this.evaluateCalculation(rule.formula, data);
            transformedData[targetField] = result;
            break;
          case 'formatting':
            transformedData[targetField] = this.formatValue(data[rule.sourceField], rule.format);
            break;
          case 'conditional':
            transformedData[targetField] = this.evaluateCondition(data, rule.condition, rule.trueValue, rule.falseValue);
            break;
          default:
            console.warn(`Unknown transform rule type: ${rule.type}`);
        }
      });

      return {
        type: 'data_transform',
        transformedFields: Object.keys(transformRules),
        outputFormat,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Data transformation failed: ${error.message}`);
    }
  }

  deepMerge(target, source) {
    const result = { ...target };
    
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });
    
    return result;
  }

  evaluateCalculation(formula, data) {
    try {
      // Simple calculation evaluation - replace field names with values
      let evaluatedFormula = formula;
      Object.keys(data).forEach(field => {
        const regex = new RegExp(`\\b${field}\\b`, 'g');
        evaluatedFormula = evaluatedFormula.replace(regex, data[field] || 0);
      });
      
      // Evaluate the formula (basic arithmetic operations)
      return eval(evaluatedFormula);
    } catch (error) {
      console.warn(`Calculation evaluation failed: ${error.message}`);
      return 0;
    }
  }

  formatValue(value, format) {
    try {
      switch (format.type) {
        case 'date':
          return new Date(value).toLocaleDateString(format.locale || 'en-US');
        case 'number':
          return Number(value).toLocaleString(format.locale || 'en-US');
        case 'currency':
          return new Intl.NumberFormat(format.locale || 'en-US', {
            style: 'currency',
            currency: format.currency || 'USD'
          }).format(value);
        case 'uppercase':
          return String(value).toUpperCase();
        case 'lowercase':
          return String(value).toLowerCase();
        default:
          return value;
      }
    } catch (error) {
      console.warn(`Value formatting failed: ${error.message}`);
      return value;
    }
  }

  evaluateCondition(data, condition, trueValue, falseValue) {
    try {
      const { field, operator, value } = condition;
      const fieldValue = data[field];
      
      let result = false;
      switch (operator) {
        case 'equals':
          result = fieldValue === value;
          break;
        case 'not_equals':
          result = fieldValue !== value;
          break;
        case 'greater_than':
          result = Number(fieldValue) > Number(value);
          break;
        case 'less_than':
          result = Number(fieldValue) < Number(value);
          break;
        case 'contains':
          result = String(fieldValue).includes(String(value));
          break;
        case 'starts_with':
          result = String(fieldValue).startsWith(String(value));
          break;
        case 'ends_with':
          result = String(fieldValue).endsWith(String(value));
          break;
        default:
          result = false;
      }
      
      return result ? trueValue : falseValue;
    } catch (error) {
      console.warn(`Condition evaluation failed: ${error.message}`);
      return falseValue;
    }
  }
}

module.exports = UpdateNodeExecutor; 
