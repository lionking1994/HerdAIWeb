const pool = require('../../config/database');
const WorkflowNodeInstance = require('../../models/WorkflowNodeInstance');
const WorkflowInstance = require('../../models/WorkflowInstance');
const Account = require('../../models/crm/Account');
const Contact = require('../../models/crm/Contact');
const Opportunity = require('../../models/crm/Opportunity');
const AccountContact = require('../../models/crm/AccountContact');
const AccountRelationship = require('../../models/crm/AccountRelationship');
const OpportunityContact = require('../../models/crm/OpportunityContact');

/**
 * CrmUpdateNodeExecutor - Executes CRM update nodes in workflows
 * 
 * This executor handles updating CRM records (accounts, contacts, opportunities)
 * based on workflow data and configuration.
 * 
 * CONFIGURATION OPTIONS:
 * - crmEntity: 'account', 'contact', 'opportunity'
 * - updateMethod: 'create', 'update', 'upsert'
 * - fieldMapping: Object mapping CRM fields to workflow variables
 * - searchCriteria: Criteria to find existing records for updates
 */
class CrmUpdateNodeExecutor {
  constructor(io) {
    this.io = io;
  }

  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      console.log("woiehgowehgowhgwhdo");
      const nodeConfig = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
      
      // Update node instance status to in_progress
      await WorkflowNodeInstance.updateStatus(nodeInstance.id, 'in_progress', data);
      // Log CRM update execution start
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'CRM Update execution started',
        { 
          crmConfig: nodeConfig.crmConfig,
          crmEntity: nodeConfig.crmEntity,
          updateMethod: nodeConfig.updateMethod,
          inputData: data
        }
      );

      // Get tenant ID from workflow
      const { rows: workflows } = await pool.query(
        'SELECT company_id FROM workflow_workflows WHERE id = $1',
        [workflowInstance.workflow_id]
      );
      
      if (workflows.length === 0) {
        throw new Error('Workflow not found');
      }
      
      const tenantId = workflows[0].company_id;
      console.log("skldjfoweihfwoehf:", workflowInstance);
      // Execute CRM update logic
      const updateResult = await this.executeCrmUpdate(nodeConfig, data, workflowInstance, tenantId);

      // Log CRM update completion
      await WorkflowNodeInstance.logExecution(
        workflowInstance.id,
        nodeInstance.id,
        'info',
        'CRM Update execution completed',
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
      console.error('CRM Update node execution error:', error);
      
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


  async executeCrmUpdate(updateConfig, data, workflowInstance, tenantId) {
    try {
      const { rows : workflows } = await pool.query(`SELECT * FROM workflow_workflows WHERE id = $1`, [workflowInstance.workflow_id]);
      if (!workflows.length) {
        throw new Error('Workflow is required for database updates');
      }
      const tenant_id = workflows[0].company_id;
      console.log("$$$@@@@@@@@@@@@@@@@@@@-----updateConfig", updateConfig);
      console.log("$$$@@@@datadata@@@@@@@@@@@@@@@-----data", JSON.stringify(data.graph_data));
      if (!data.graph_data?.visualization?.nodes.length) {
        throw new Error('nodes is required for database updates');
      }
      const workflowData = workflowInstance.data;
      console.log("$$$@@@@@@@@@@@@@@@@@@@-----workflowData", workflowData);
      const crmApprovalItems = workflowData['selectedCrmItems'];
      console.log("$$$@@@@@@@@@@@@@@@@@@@-----crmApprovalItems", crmApprovalItems);
      //crmApprovalItems has list such as ['account', 'contact', 'opportunity']
      // Validate that we have edges for relationship mapping
      if (!data.graph_data?.visualization?.edges) {
        console.warn('No edges found in graph data. Opportunities may not be linked to accounts.');
      }
      
      // Create a map to store created entities and their IDs
      const createdEntities = new Map();
      console.log("1");
      // Enhanced node processing with better entity mapping
      const nodes = data.graph_data.visualization.nodes;
      const edges = data.graph_data.visualization.edges || [];
      console.log("2");
      console.log(`Processing ${nodes.length} nodes with ${edges.length} edges`);
      console.log("3");
      // First pass: Create all entities and build entity map
      for (const node of nodes) {
        console.log("node.id", node.id);
        console.log("crmApprovalItems", crmApprovalItems);
        if(crmApprovalItems.includes(node.id))
          {
          try {
            console.log(`Processing node: ${node.id} (${node.group}: ${node.label})`);
            console.log("4");
            switch (node.group) {
              case 'company':
        
        
                  const createdAccount = await Account.create(node, tenant_id);
                  createdEntities.set(node.id, {
                    type: 'account',
                    id: createdAccount.id,
                    data: createdAccount,
                    node: node
                  });
                  console.log(`✅ Created account: ${node.label} with ID: ${createdAccount.id}`);
          
                break;
                
              case 'person':
    
                  const createdContact = await Contact.create(node, tenant_id);
                  createdEntities.set(node.id, {
                    type: 'contact',
                    id: createdContact.id,
                    data: createdContact,
                    node: node
                  });
                  console.log(`✅ Created contact: ${node.label} with ID: ${createdContact.id}`);
    
                break;
                
              case 'opportunity':

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
      }
      console.log("5");
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
      console.log("6");
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



  async handleAccountUpdate(updateMethod, data, searchCriteria, tenantId) {
    try {
      switch (updateMethod) {
        case 'create':
          return await Account.create(data, tenantId);
          
        case 'update':
          if (!searchCriteria) {
            throw new Error('Search criteria is required for updates');
          }
          const existingAccount = await this.findAccountByCriteria(searchCriteria, tenantId);
          if (!existingAccount) {
            throw new Error('Account not found for update');
          }
          return await Account.update(existingAccount.id, data, tenantId);
          
        case 'upsert':
          if (searchCriteria) {
            const existingAccount = await this.findAccountByCriteria(searchCriteria, tenantId);
            if (existingAccount) {
              return await Account.update(existingAccount.id, data, tenantId);
            }
          }
          return await Account.create(data, tenantId);
          
        default:
          throw new Error(`Unsupported update method: ${updateMethod}`);
      }
    } catch (error) {
      throw new Error(`Account update failed: ${error.message}`);
    }
  }

  async handleContactUpdate(updateMethod, data, searchCriteria, tenantId) {
    try {
      switch (updateMethod) {
        case 'create':
          return await Contact.create(data, tenantId);
          
        case 'update':
          if (!searchCriteria) {
            throw new Error('Search criteria is required for updates');
          }
          const existingContact = await this.findContactByCriteria(searchCriteria, tenantId);
          if (!existingContact) {
            throw new Error('Contact not found for update');
          }
          return await Contact.update(existingContact.id, data, tenantId);
          
        case 'upsert':
          if (searchCriteria) {
            const existingContact = await this.findContactByCriteria(searchCriteria, tenantId);
            if (existingContact) {
              return await Contact.update(existingContact.id, data, tenantId);
            }
          }
          return await Contact.create(data, tenantId);
          
        default:
          throw new Error(`Unsupported update method: ${updateMethod}`);
      }
    } catch (error) {
      throw new Error(`Contact update failed: ${error.message}`);
    }
  }

  async handleOpportunityUpdate(updateMethod, data, searchCriteria, tenantId) {
    console.log("🤬🤬🤬 handleOpportunityUpdate data:", data);
    try {
      switch (updateMethod) {
        case 'create':
          // Get the first stage if no stage is provided
          let stageId = data.stage_id;
          let stageName = data.stage;
          
          if (!stageId) {
            const firstStage = await pool.query(
              'SELECT * FROM opportunity_stages WHERE tenant_id = $1 ORDER BY order_index LIMIT 1',
              [tenantId]
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
            ...data,
            stage_id: stageId,
            stage: stageName
          };
          
          const createdOpportunity = await Opportunity.create(opportunityData, tenantId);
          
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
                  tenantId,
                  null // created_by is null for workflow-created opportunities
                ]
              );
              console.log('✅ Stage history recorded for new opportunity (from_stage_id = stage_id for initial stage)');
            } catch (historyError) {
              console.warn('⚠️ Failed to record stage history:', historyError.message);
              // Don't fail the main operation if history recording fails
            }
          }
          
          return createdOpportunity;
          
        case 'update':
          if (!searchCriteria) {
            throw new Error('Search criteria is required for updates');
          }
          const existingOpportunity = await this.findOpportunityByCriteria(searchCriteria, tenantId);
          if (!existingOpportunity) {
            throw new Error('Opportunity not found for update');
          }
          return await Opportunity.update(existingOpportunity.id, data, tenantId);
          
        case 'upsert':
          if (searchCriteria) {
            const existingOpportunity = await this.findOpportunityByCriteria(searchCriteria, tenantId);
            if (existingOpportunity) {
              return await Opportunity.update(existingOpportunity.id, data, tenantId);
            }
          }
          // Get the first stage if no stage is provided
          let upsertStageId = data.stage_id;
          let upsertStageName = data.stage;
          
          if (!upsertStageId) {
            const firstStage = await pool.query(
              'SELECT * FROM opportunity_stages WHERE tenant_id = $1 ORDER BY order_index LIMIT 1',
              [tenantId]
            );
            
            if (firstStage.rows.length > 0) {
              upsertStageId = firstStage.rows[0].id;
              upsertStageName = firstStage.rows[0].name;
              console.log(`🎯 Setting opportunity to first stage: ${upsertStageName} (ID: ${upsertStageId})`);
            } else {
              console.log('⚠️ No stages found for tenant, creating opportunity without stage');
            }
          }
          
          const upsertOpportunityData = {
            ...data,
            stage_id: upsertStageId,
            stage: upsertStageName
          };
          
          const createdUpsertOpportunity = await Opportunity.create(upsertOpportunityData, tenantId);
          
          // Insert into opportunity_stage_history if stage_id is provided
          if (upsertStageId) {
            try {
              await pool.query(
                `INSERT INTO opportunity_stage_history (
                  opportunity_id, stage_id, from_stage_id, entered_at, tenant_id, created_by
                ) VALUES ($1, $2, $2, NOW(), $3, $4)`,
                [
                  createdUpsertOpportunity.id,
                  upsertStageId,
                  tenantId,
                  null // created_by is null for workflow-created opportunities
                ]
              );
              console.log('✅ Stage history recorded for new opportunity (from_stage_id = stage_id for initial stage)');
            } catch (historyError) {
              console.warn('⚠️ Failed to record stage history:', historyError.message);
              // Don't fail the main operation if history recording fails
            }
          }
          
          return createdUpsertOpportunity;
          
        default:
          throw new Error(`Unsupported update method: ${updateMethod}`);
      }
    } catch (error) {
      throw new Error(`Opportunity update failed: ${error.message}`);
    }
  }

  async findAccountByCriteria(criteria, tenantId) {
    try {
      const { field, operator, value } = criteria;
      
      let query = 'SELECT * FROM accounts WHERE tenant_id = $1';
      const params = [tenantId];
      
      if (field && operator && value !== undefined) {
        query += ` AND ${field} ${this.getSqlOperator(operator)} $2`;
        params.push(value);
      }
      
      const { rows } = await pool.query(query, params);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding account by criteria:', error);
      return null;
    }
  }

  async findContactByCriteria(criteria, tenantId) {
    try {
      const { field, operator, value } = criteria;
      
      let query = 'SELECT * FROM contacts WHERE tenant_id = $1';
      const params = [tenantId];
      
      if (field && operator && value !== undefined) {
        query += ` AND ${field} ${this.getSqlOperator(operator)} $2`;
        params.push(value);
      }
      
      const { rows } = await pool.query(query, params);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding contact by criteria:', error);
      return null;
    }
  }

  async findOpportunityByCriteria(criteria, tenantId) {
    try {
      const { field, operator, value } = criteria;
      
      let query = 'SELECT * FROM opportunities WHERE tenant_id = $1';
      const params = [tenantId];
      
      if (field && operator && value !== undefined) {
        query += ` AND ${field} ${this.getSqlOperator(operator)} $2`;
        params.push(value);
      }
      
      const { rows } = await pool.query(query, params);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding opportunity by criteria:', error);
      return null;
    }
  }

  getSqlOperator(operator) {
    const operatorMap = {
      'equals': '=',
      'not_equals': '!=',
      'greater_than': '>',
      'less_than': '<',
      'greater_than_or_equal': '>=',
      'less_than_or_equal': '<=',
      'contains': 'ILIKE',
      'not_contains': 'NOT ILIKE',
      'starts_with': 'ILIKE',
      'ends_with': 'ILIKE'
    };
    
    return operatorMap[operator] || '=';
  }

  mapWorkflowVariables(mapping, workflowData) {
    const result = {};
    
    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        // Extract variable name from {{variable_name}} format
        const variableName = value.slice(2, -2);
        result[key] = workflowData[variableName] || value;
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
}

module.exports = CrmUpdateNodeExecutor; 