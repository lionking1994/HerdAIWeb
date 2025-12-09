const pool = require('../../config/database');
const { getTenantId, getOrCreateTenant, getTenant } = require('../../utils/crm');
const { sendEmail } = require('../../utils/email')
// const { opportunities_stages_node } = require('../companyStrategyController')

// Create new opportunity
const createOpportunity = async (req, res) => {
  try {
    const opportunityData = req.body;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Creating opportunity for tenant ID:', tenantId);

    // Validation
    if (!opportunityData.name || !opportunityData.account_id) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity name and account ID are required'
      });
    }

    // Check if account belongs to tenant
    const accountExists = await pool.query(
      'SELECT * FROM accounts WHERE id = $1 AND tenant_id = $2',
      [opportunityData.account_id, tenantId]
    );

    if (accountExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Get the first stage if no stage is provided
    let stageId = opportunityData.stage_id;
    let stageName = opportunityData.stage;
    let probability_weight = opportunityData.probability;


    if (!stageId) {
      const firstStage = await pool.query(
        'SELECT * FROM opportunity_stages WHERE tenant_id = $1 ORDER BY order_index LIMIT 1',
        [tenantId]
      );

      if (firstStage.rows.length > 0) {
        stageId = firstStage.rows[0].id;
        stageName = firstStage.rows[0].name;
        probability_weight = firstStage.rows[0].weight_percentage
        console.log(`🎯 Setting opportunity to first stage: ${stageName} (ID: ${stageId})`);
      } else {
        console.log('⚠️ No stages found for tenant, creating opportunity without stage');
      }
    }
    else {
      const userStage = await pool.query(
        'SELECT * FROM opportunity_stages WHERE id = $1 ORDER BY order_index LIMIT 1',
        [stageId]
      );
      probability_weight = userStage.rows[0].weight_percentage;
      stageName = userStage.rows[0].name
    }

    // Create opportunity
    const newOpportunity = await pool.query(
      `INSERT INTO opportunities (
        tenant_id, name, account_id, amount, stage, stage_id, expected_close_date,
        actual_close_date, probability, description, lead_source, meeting_id, custom_fields, created_by, updated_by, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        tenantId, opportunityData.name, opportunityData.account_id,
        opportunityData.amount || null, stageName, stageId,
        opportunityData.expected_close_date || null, opportunityData.actual_close_date || null,
        probability_weight || null, opportunityData.description || '', opportunityData.lead_source || null,
        opportunityData.meeting_id || null, opportunityData.custom_fields || null, req.user?.id || null, req.user?.id || null,
        opportunityData?.owner_id || null  // owner_id is now INTEGER (user ID)
      ]
    );

    // Insert into opportunity_stage_history if stage_id is provided
    if (opportunityData.stage_id) {
      try {
        await pool.query(
          `INSERT INTO opportunity_stage_history (
            opportunity_id, stage_id, from_stage_id, entered_at, tenant_id, created_by
          ) VALUES ($1, $2, $2, NOW(), $3, $4)`,
          [
            newOpportunity.rows[0].id,
            opportunityData.stage_id,
            tenantId,
            req.user?.id || null
          ]
        );
        console.log('✅ Stage history recorded for new opportunity (from_stage_id = stage_id for initial stage)');
      } catch (historyError) {
        console.warn('⚠️ Failed to record stage history:', historyError.message);
        // Don't fail the main operation if history recording fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Opportunity created successfully',
      data: newOpportunity.rows[0]
    });

  } catch (error) {
    console.error('Error creating opportunity:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get all opportunities with pagination and search
const getOpportunities = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, filters = {} } = req.query;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching opportunities for tenant ID:', tenantId);

    const offset = (page - 1) * limit;

    let query = `
      SELECT o.*, 
        a.name as account_name,
        s.name as stage_name,
        s.weight_percentage
      FROM opportunities o
      LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $1
      LEFT JOIN opportunity_stages s ON o.stage_id = s.id AND s.tenant_id = $1
      WHERE o.tenant_id = $1
    `;

    let params = [tenantId];
    let paramCount = 1;

    // Add search functionality
    if (search) {
      paramCount++;
      query += ` AND (
        o.name ILIKE $${paramCount} OR 
        o.description ILIKE $${paramCount} OR
        a.name ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Add filters
    if (filters.stage_id) {
      paramCount++;
      query += ` AND o.stage_id = $${paramCount}`;
      params.push(filters.stage_id);
    }

    if (filters.account_id) {
      paramCount++;
      query += ` AND o.account_id = $${paramCount}`;
      params.push(filters.account_id);
    }

    if (filters.min_amount) {
      paramCount++;
      query += ` AND o.amount >= $${paramCount}`;
      params.push(parseFloat(filters.min_amount));
    }

    if (filters.max_amount) {
      paramCount++;
      query += ` AND o.amount <= $${paramCount}`;
      params.push(parseFloat(filters.max_amount));
    }

    if (filters.expected_close_date_from) {
      paramCount++;
      query += ` AND o.expected_close_date >= $${paramCount}`;
      params.push(filters.expected_close_date_from);
    }

    if (filters.expected_close_date_to) {
      paramCount++;
      query += ` AND o.expected_close_date <= $${paramCount}`;
      params.push(filters.expected_close_date_to);
    }

    // Add ordering and pagination
    query += ` ORDER BY o.expected_close_date ASC`;

    // Only add LIMIT and OFFSET if limit is not -1
    if (parseInt(limit) !== -1) {
      paramCount++;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(parseInt(limit), offset);
    }

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM opportunities WHERE tenant_id = $1';
    let countParams = [tenantId];

    if (search) {
      countQuery += ` AND (
        name ILIKE $2 OR 
        description ILIKE $2 OR
        account_id IN (SELECT id FROM accounts WHERE tenant_id = $1 AND name ILIKE $2)
      )`;
      countParams.push(`%${search}%`);
    }

    console.log('🔍 Count Query:', countQuery);
    console.log('🔍 Count Params:', countParams);

    const countResult = await pool.query(countQuery, countParams);
    console.log('🔍 Count Result:', countResult.rows);

    // Handle case when no opportunities exist for this tenant
    if (!countResult.rows || countResult.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }

    const total = parseInt(countResult.rows[0].count);
    console.log('🔍 Total count:', total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: parseInt(limit) === -1 ? 1 : Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get opportunity by ID
const getOpportunityById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching opportunity ID:', id, 'for tenant ID:', tenantId);

    const result = await pool.query(
      `SELECT o.*, 
        a.name as account_name,
        s.name as stage_name
      FROM opportunities o
      LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $1
      LEFT JOIN opportunity_stages s ON o.stage_id = s.id AND s.tenant_id = $1
      WHERE o.id = $2 AND o.tenant_id = $1`,
      [tenantId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching opportunity:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update opportunity
const updateOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Updating opportunity ID:', id, 'for tenant ID:', tenantId);

    // Check if opportunity exists and belongs to tenant
    const existingOpportunity = await pool.query(
      'SELECT * FROM opportunities WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingOpportunity.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    // Check if account belongs to tenant (if account_id is being updated)
    if (updateData.account_id && updateData.account_id !== existingOpportunity.rows[0].account_id) {
      const accountExists = await pool.query(
        'SELECT * FROM accounts WHERE id = $1 AND tenant_id = $2',
        [updateData.account_id, tenantId]
      );

      if (accountExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Account not found'
        });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && key !== 'tenant_id' && key !== 'created_at') {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Add updated_by and updated_at
    updateFields.push(`updated_by = $${paramCount}`);
    updateFields.push(`updated_at = NOW()`);
    values.push(req.user?.id || null);

    // Add WHERE clause parameters
    values.push(id, tenantId);

    const updateQuery = `
      UPDATE opportunities 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1} AND tenant_id = $${paramCount + 2}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    // Insert into opportunity_stage_history if stage_id changed
    if (updateData.stage_id && updateData.stage_id !== existingOpportunity.rows[0].stage_id) {
      try {
        const userStage = await pool.query(
          'SELECT * FROM opportunity_stages WHERE id = $1 ORDER BY order_index LIMIT 1',
          [updateData.stage_id]
        );
        const updateQuery1 = `
        UPDATE opportunities 
        SET stage = $1, stage_id=$2, probability=$3
        WHERE id = $4 AND tenant_id = $5
        `;

        await pool.query(updateQuery1,
          [userStage.rows[0].name, userStage.rows[0].id, userStage.rows[0].weight_percentage,
            id, tenantId]);

        await pool.query(
          `INSERT INTO opportunity_stage_history (
            opportunity_id, stage_id, from_stage_id, entered_at, tenant_id, created_by
          ) VALUES ($1, $2, $3, NOW(), $4, $5)`,
          [
            id,
            updateData.stage_id,
            existingOpportunity.rows[0].stage_id, // from_stage_id = current stage before update
            tenantId,
            req.user?.id || null
          ]
        );
        console.log('✅ Stage history recorded for stage change (from_stage_id = previous stage)');
      } catch (historyError) {
        console.warn('⚠️ Failed to record stage history:', historyError.message);
        // Don't fail the main operation if history recording fails
      }
    }

    res.json({
      success: true,
      message: 'Opportunity updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating opportunity:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Check opportunity relationships before deletion
const checkOpportunityRelations = async (req, res) => {
  try {
    const { id } = req.params;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Checking relationships for opportunity ID:', id, 'tenant ID:', tenantId);

    // Check if opportunity exists and belongs to tenant
    const existingOpportunity = await pool.query(
      'SELECT * FROM opportunities WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingOpportunity.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    // Check related data
    const relatedData = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM opportunity_contacts WHERE opportunity_id = $1) as contact_count`,
      [id]
    );

    const contactCount = parseInt(relatedData.rows[0].contact_count);

    res.json({
      success: true,
      data: {
        opportunity_id: id,
        contact_count: contactCount,
        has_related_data: contactCount > 0
      }
    });

  } catch (error) {
    console.error('Error checking opportunity relationships:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Delete opportunity
const deleteOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { forceDelete = false } = req.query; // New parameter for force deletion

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Deleting opportunity ID:', id, 'for tenant ID:', tenantId, 'forceDelete:', forceDelete);

    // Check if opportunity exists and belongs to tenant
    const existingOpportunity = await pool.query(
      'SELECT * FROM opportunities WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingOpportunity.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    // Check if opportunity has related data
    const hasRelatedData = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM opportunity_contacts WHERE opportunity_id = $1) as contact_count`,
      [id]
    );

    const contactCount = parseInt(hasRelatedData.rows[0].contact_count);

    if (contactCount > 0 && !forceDelete) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete opportunity with related contacts',
        data: {
          contact_count: contactCount,
          suggestion: 'Use forceDelete=true to proceed with deletion'
        }
      });
    }

    // Delete opportunity (CASCADE will handle related records)
    await pool.query(
      'DELETE FROM opportunities WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    res.json({
      success: true,
      message: contactCount > 0
        ? `Opportunity deleted successfully. ${contactCount} related contact(s) were also removed.`
        : 'Opportunity deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting opportunity:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get opportunity pipeline
const getOpportunityPipeline = async (req, res) => {
  try {
    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching opportunity pipeline for tenant ID:', tenantId);

    // Get all stages for this tenant
    const stages = await pool.query(
      'SELECT * FROM opportunity_stages WHERE tenant_id = $1 ORDER BY order_index',
      [tenantId]
    );

    // Get opportunities grouped by stage
    const pipeline = await Promise.all(
      stages.rows.map(async (stage) => {
        const opportunities = await pool.query(
          `SELECT o.*, a.name as account_name
           FROM opportunities o
           LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $1
           WHERE o.stage_id = $2 AND o.tenant_id = $1
           ORDER BY o.expected_close_date ASC`,
          [tenantId, stage.id]
        );

        return {
          stage,
          opportunities: opportunities.rows
        };
      })
    );

    res.json({
      success: true,
      data: pipeline
    });

  } catch (error) {
    console.error('Error fetching opportunity pipeline:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get opportunity with relationships
const getOpportunityWithRelations = async (req, res) => {
  try {
    const { id } = req.params;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching opportunity relationships ID:', id, 'for tenant ID:', tenantId);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Check if opportunity exists and belongs to tenant
    const opportunityExists = await pool.query(
      'SELECT * FROM opportunities WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (opportunityExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    // Get related contacts
    const contacts = await pool.query(
      `SELECT oc.*, c.first_name, c.last_name, c.email, c.phone 
       FROM opportunity_contacts oc 
       JOIN contacts c ON oc.contact_id = c.id 
       WHERE oc.opportunity_id = $1 AND oc.tenant_id = $2`,
      [id, tenantId]
    );

    // Get related account
    const account = await pool.query(
      `SELECT a.* FROM accounts a 
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [opportunityExists.rows[0].account_id, tenantId]
    );

    res.json({
      success: true,
      data: {
        opportunity: opportunityExists.rows[0],
        contacts: contacts.rows,
        account: account.rows[0] || null
      }
    });

  } catch (error) {
    console.error('Error fetching opportunity relationships:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Search opportunities
const searchOpportunities = async (req, res) => {
  try {
    const { query, filters = {}, limit = 50, offset = 0 } = req.body;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Searching opportunities for tenant ID:', tenantId);

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchTerm = `%${query.trim()}%`;

    let sqlQuery = `
      SELECT 
        o.*,
        a.name as account_name,
        s.name as stage_name
      FROM opportunities o
      LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $1
      LEFT JOIN opportunity_stages s ON o.stage_id = s.id AND s.tenant_id = $1
      WHERE o.tenant_id = $1 AND (
        o.name ILIKE $2 OR 
        o.description ILIKE $2
      )
    `;

    let params = [tenantId, searchTerm];
    let paramCount = 2;

    // Add filters
    if (filters.stage_id) {
      paramCount++;
      sqlQuery += ` AND o.stage_id = $${paramCount}`;
      params.push(filters.stage_id);
    }

    if (filters.account_id) {
      paramCount++;
      sqlQuery += ` AND o.account_id = $${paramCount}`;
      params.push(filters.account_id);
    }

    // Add ordering and pagination
    sqlQuery += ` ORDER BY o.expected_close_date ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(sqlQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
      }
    });

  } catch (error) {
    console.error('Error searching opportunities:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Add stage history entry manually (for drag & drop functionality)
const addStageHistoryEntry = async (req, res) => {
  try {
    const { id: opportunityId } = req.params;
    const { stage_id } = req.body;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Adding stage history for opportunity ID:', opportunityId, 'tenant ID:', tenantId);

    if (!stage_id) {
      return res.status(400).json({
        success: false,
        message: 'stage_id is required'
      });
    }

    // Check if opportunity exists and belongs to tenant
    const opportunityExists = await pool.query(
      'SELECT * FROM opportunities WHERE id = $1 AND tenant_id = $2',
      [opportunityId, tenantId]
    );

    if (opportunityExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    const old_stage_name = opportunityExists.rows[0].stage

    // Check if the new stage exists and belongs to tenant
    const stageExists = await pool.query(
      'SELECT id FROM opportunity_stages WHERE id = $1 AND tenant_id = $2',
      [stage_id, tenantId]
    );

    if (stageExists.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Stage not found'
      });
    }

    // Insert into opportunity_stage_history
    const historyEntry = await pool.query(
      `INSERT INTO opportunity_stage_history (
        opportunity_id, stage_id, from_stage_id, entered_at, tenant_id, created_by, reason
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6)
      RETURNING *`,
      [
        opportunityId,
        stage_id,                                    // stage_id = new stage from request
        opportunityExists.rows[0].stage_id,          // from_stage_id = existing stage from database
        tenantId,
        req.user?.id || null,
        null
      ]
    );

    // Update the opportunity's current stage
    await pool.query(
      'UPDATE opportunities SET stage_id = $1, stage = (SELECT name FROM opportunity_stages WHERE id = $1), updated_at = NOW(), updated_by = $2, reason=$3 WHERE id = $4',
      [stage_id, req.user?.id || null, null, opportunityId]
    );

    // try {
    //   opportunities_stages_node(opportunityId);
    //   console.log("✅ Opportunity node graph updated");
    // } catch (graphError) {
    //   console.error("⚠️ Error updating opportunity node graph:", graphError);
    // }
    // console.log('✅ Stage history entry added successfully');

    //   try {
    //     const ownerQuery =
    //       `SELECT u.id AS user_id, u.name AS user_name, u.email AS user_email, o.id AS opportunity_id, o.name AS title,
    //     o.stage, a.id AS account_id, a.email AS account_email, c.id AS contact_id, c.email AS contact_email
    //     FROM public.opportunities o
    //     JOIN public.users u 
    //     ON o.owner_id = u.id
    //     LEFT JOIN public.accounts a       
    //     ON o.account_id = a.id
    //     LEFT JOIN public.opportunity_contacts oc 
    //     ON oc.opportunity_id = o.id
    //     LEFT JOIN public.contacts c 
    //     ON oc.contact_id = c.id
    //     WHERE o.id = $1 
    //     AND o.tenant_id = $2;
    //     `;

    //     const opportunity_details = await pool.query(ownerQuery, [opportunityId, tenantId]);


    //     if (opportunity_details.rows.length > 0) {
    //       const email = new Set();

    //       opportunity_details.rows.forEach(row => {
    //         if (row.user_email) email.add(row.user_email)
    //         if (row.account_email) email.add(row.account_email)
    //         if (row.contact_email) email.add(row.contact_email)
    //       })

    //       const emailList = [...email];
    //       const opportunity_detail = opportunity_details.rows[0];

    //       const emailSubject = `Opportunity Stage Updated: ${opportunity_details.title}`;
    //       const emailBody = `
    //         <!DOCTYPE html>
    //           <html>
    //             <head>
    //               <style>
    //                  body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    //                 .header { text-align: center; padding: 20px; background: linear-gradient(to right, #f8f9fa, #e9ecef); }
    //                 .logo { margin-bottom: 10px; }
    //                 .content { padding: 30px; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    //                 h2 { color: #1B73E8; margin-top: 30px; font-size: 20px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
    //                 .section-divider { border-top: 1px solid #e0e0e0; margin: 20px 0; }
    //                 .cta-button { display: inline-block; padding: 12px 24px; background: #1B73E8; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    //                 .cta-button:hover { background: #1557b0; }
    //                 .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    //                 .meeting-title { font-size: 20px; font-weight: bold; margin: 15px 0 5px 0; }
    //               </style>
    //             </head>
    //           <body>
    //         <div class="header">
    //           <img src="https://herdai.s3.us-east-1.amazonaws.com/assets/images/herd_email_logo.webp" alt="Herd AI" width="120" class="logo" />


    //         <div class="content">
    //         <div class="meeting-title">
    //         The opportunity <strong>${opportunity_detail.title}</strong> has been moved.
    //         </div>

    //         <p>
    //         <strong>From:</strong> ${old_stage_name || "N/A"} <br/>
    //         <strong>To:</strong> ${opportunity_detail.stage}
    //         </p>

    //         <div class="section-divider"></div>

    //         <center>
    //         <a href="${process.env.FRONTEND_URL}/crm/opportunities/${opportunityId}?company=${tenantId}"  class="cta-button">
    //         View Opportunity Details
    //       </a>
    //     </center>
    //   </div>

    //       <div class="footer">
    //       <p>This email was sent by Herd AI. Please do not reply to this email.</p>
    //     </div>
    //   </body>
    // </html>
    //     `;
    //       for (const email of emailList) {
    //         await sendEmail({
    //           to: email,
    //           subject: emailSubject,
    //           html: emailBody,
    //         });
    //         console.log(`📧 Email sent to: ${email}`);
    //       }

    //       await pool.query(
    //         `UPDATE opportunity_stage_history 
    //          SET email_processing = $1 
    //          WHERE id = $2`,
    //         [emailList.join(","), historyEntry.rows[0].id]
    //       );
    //       console.log(`📌 Stored emails in stage history: ${emailList.join(",")}`);
    //     }
    //   } catch (emailError) {
    //     console.error("⚠️ Error sending stage update email:", emailError);
    //   }

    res.json({
      success: true,
      message: 'Stage history entry added successfully',
      data: {
        history_entry: historyEntry.rows[0],
        opportunity_updated: true
      }
    });

  } catch (error) {
    console.error('Error adding stage history entry:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get opportunity detail with related data
// const getOpportunityDetail = async (req, res) => {
//   console.log('🚀 getOpportunityDetail controller called!');

//   try {
//     const { id } = req.params;

//     // Debug: Log all request details
//     console.log('🔍 Request details:');
//     console.log('  - Params:', req.params);
//     console.log('  - Query:', req.query);
//     console.log('  - Body:', req.body);
//     console.log('  - Headers:', req.headers);
//     console.log('  - User:', req.user);

//     // Get tenant ID from request
//     const tenantId = await getTenantId(req);
//     console.log('🔍 Fetching opportunity detail ID:', id, 'for tenant ID:', tenantId);

//     // Check if opportunity exists and belongs to tenant
//     const opportunityExists = await pool.query(
//       'SELECT * FROM opportunities WHERE id = $1 AND tenant_id = $2',
//       [id, tenantId]
//     );

//     if (opportunityExists.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'Opportunity not found'
//       });
//     }

//          // Fetch comprehensive opportunity data with joins
//      const result = await pool.query(`
//        SELECT 
//          o.*,
//          s.name as stage_name,
//          s.weight_percentage as stage_weight,

//          -- Account Information
//          a.name as account_name,
//          a.description as account_description,
//          a.account_type,
//          a.industry,
//          a.account_type,
//          a.website,
//          a.phone as account_phone,
//          a.email as account_email,

//          -- Opportunity Owner Information (from users table)
//          u.name as owner_name,
//          u.email as owner_email,
//          u.phone as owner_phone,
//          u.location as owner_location,
//          u.bio as owner_bio,
//          u.avatar as owner_avatar


//        FROM opportunities o
//        LEFT JOIN opportunity_stages s ON o.stage_id = s.id AND s.tenant_id = $2
//        LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $2
//        LEFT JOIN users u ON o.owner_id = u.id
//        WHERE o.id = $1 AND o.tenant_id = $2
//      `, [id, tenantId]);

//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'Opportunity detail not found'
//       });
//     }

//               // Fetch related contacts from opportunity_contacts table
//      const relatedContactsQuery = await pool.query(`
//        SELECT 
//          c.id,
//          c.first_name,
//          c.last_name,
//          c.email,
//          c.phone,
//          c.title,
//          c.address1 as location,
//          oc.role as contact_role
//        FROM opportunity_contacts oc
//        LEFT JOIN contacts c ON oc.contact_id = c.id AND c.tenant_id = $2
//        WHERE oc.opportunity_id = $1 AND oc.tenant_id = $2
//        ORDER BY c.first_name ASC
//      `, [id, tenantId]);

//     console.log('🔍 Found related contacts:', relatedContactsQuery.rows.length);
//     console.log('📋 Related contacts data:', relatedContactsQuery.rows);

//     // u.department as owner_department,
//     // u.job_title as owner_job_title
//     const opportunityData = result.rows[0];

//          // Transform data to match frontend structure
//      const transformedData = {
//        opportunity: {
//          id: opportunityData.id,
//          name: opportunityData.name,
//          amount: opportunityData.amount,
//          stage: opportunityData.stage_name || opportunityData.stage,
//          probability: opportunityData.probability,
//          lead_source: opportunityData.lead_source,
//          expected_close_date: opportunityData.expected_close_date,
//          actual_close_date: opportunityData.actual_close_date,
//          description: opportunityData.description,
//          stage_weight: opportunityData.stage_weight
//        },
//        account: {
//          id: opportunityData.account_id,
//          name: opportunityData.account_name,
//          account_type: opportunityData.account_type,
//          industry: opportunityData.industry,
//          website: opportunityData.website,
//          email: opportunityData.account_email,
//          phone: opportunityData.account_phone,
//          description: opportunityData.account_description
//        },
//        owner: {
//          id: opportunityData.owner_id,
//          name: opportunityData.owner_name,
//          email: opportunityData.owner_email,
//          phone: opportunityData.owner_phone,
//          location: opportunityData.owner_location,
//          bio: opportunityData.owner_bio,
//          avatar: opportunityData.owner_avatar,
//          department: opportunityData.owner_department,
//          job_title: opportunityData.owner_job_title
//        },
//                                related_contacts: relatedContactsQuery.rows.map(contact => ({
//           id: contact.id,
//           name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed Contact',
//           email: contact.email,
//           phone: contact.phone,
//           title: contact.title,
//           department: null, // contacts table doesn't have department field
//           location: contact.location,
//           bio: null, // contacts table doesn't have bio field
//           avatar: null, // contacts table doesn't have avatar field
//           role: contact.contact_role,
//           is_primary: false // opportunity_contacts table doesn't have is_primary field
//         }))
//      };

//     res.json({
//       success: true,
//       message: 'Opportunity detail fetched successfully',
//       data: transformedData
//     });

//   } catch (error) {
//     console.error('Error fetching opportunity detail:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message || 'Internal server error'
//     });
//   }
// };

const getOpportunityDetail = async (req, res) => {
  console.log('🚀 getOpportunityDetail controller called!');

  try {
    const { id } = req.params;

    // Get tenant ID from request
    const tenantId = await getTenantId(req);
    console.log('🔍 Fetching opportunity detail ID:', id, 'for tenant ID:', tenantId);

    // Check if opportunity exists and belongs to tenant
    const opportunityExists = await pool.query(
      'SELECT * FROM opportunities WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (opportunityExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    // Fetch comprehensive opportunity data with joins
    const result = await pool.query(`
       SELECT
         o.*,
         s.name as stage_name,
         s.weight_percentage as stage_weight,
         
         -- Account Information
         a.name as account_name,
         a.description as account_description,
         a.account_type,
         a.industry,
         a.account_type,
         a.website,
         a.phone as account_phone,
         a.email as account_email,
        
         
         -- Opportunity Owner Information (from users table)
         u.name as owner_name,
         u.email as owner_email,
         u.phone as owner_phone,
         u.location as owner_location,
         u.bio as owner_bio,
         u.avatar as owner_avatar,

        c.mobile_phone AS contact_mobile_number
       
         
       FROM opportunities o
       LEFT JOIN opportunity_stages s ON o.stage_id = s.id AND s.tenant_id = $2
       LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $2
       LEFT JOIN users u ON o.owner_id = u.id
       LEFT JOIN opportunity_contacts oc ON o.id = oc.opportunity_id
	     LEFT JOIN contacts c ON oc.contact_id = c.id
       WHERE o.id = $1 AND o.tenant_id = $2
     `, [id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity detail not found'
      });
    }

    // Fetch related contacts from opportunity_contacts table with users data
    const relatedContactsQuery = await pool.query(`
       SELECT
       oc.created_at,
         c.id,
         oc.id as opport_contactid,
         c.first_name,
         c.last_name,
         c.email,
         c.phone,
         c.mobile_phone,
         c.department,
         c.title,
         c.address1 as location,
         c.address2 as location2,
         c.state as state,
         c.city as city,
         c.zip as zip,
         c.country as country,
         oc.role as contact_role,
                   -- Users table se additional fields (null if no match)
          u.name as user_name,
          u.id as user_id,
          u.bio as user_bio,
          u.avatar as user_avatar,
          u.location as user_location
       FROM opportunity_contacts oc
       LEFT JOIN contacts c ON oc.contact_id = c.id AND c.tenant_id = $2
       LEFT JOIN users u ON c.email = u.email
       WHERE oc.opportunity_id = $1 AND oc.tenant_id = $2
       ORDER BY c.first_name ASC
     `, [id, tenantId]);

    console.log('🔍 Found related contacts:', relatedContactsQuery.rows.length);
    console.log('📋 Related contacts data:', relatedContactsQuery.rows);

    // Check if research exists for this opportunity
    console.log('🔍 Checking research status for opportunity:', id);
    const researchQuery = await pool.query(
      `SELECT 
        id,
        status,
        progress,
        company_research_file,
        contact_research_file,
        opportunity_research_file,
        research_data,
        started_at,
        completed_at
       FROM crm_research 
       WHERE opportunity_id = $1 AND tenant_id = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [id, tenantId]
    );

    let researchInfo = null;
    if (researchQuery.rows.length > 0) {
      const research = researchQuery.rows[0];
      const hasCompanyFile = research.company_research_file && research.company_research_file !== '';
      const hasContactFile = research.contact_research_file && research.contact_research_file !== '';
      const hasOpportunityFile = research.opportunity_research_file && research.opportunity_research_file !== '';
      const isCompleted = hasCompanyFile || hasContactFile || hasOpportunityFile;

      researchInfo = {
        exists: true,
        status: isCompleted ? 'completed' : 'in_progress',
        research_id: research.id,
        has_company_file: hasCompanyFile,
        has_contact_file: hasContactFile,
        has_opportunity_file: hasOpportunityFile,
        is_completed: isCompleted,
        progress: research.progress || 0,
        started_at: research.started_at,
        completed_at: research.completed_at,
        message: isCompleted ? 'Research completed successfully' : 'Research in progress'
      };

      console.log('✅ Research found:', researchInfo);
    } else {
      researchInfo = {
        exists: false,
        status: 'not_started',
        message: 'No research found'
      };
      console.log('⚠️ No research found for opportunity');
    }

    // u.department as owner_department,
    // u.job_title as owner_job_title
    const opportunityData = result.rows[0];

    // Transform data to match frontend structure
    const transformedData = {
      opportunity: {
        id: opportunityData.id,
        name: opportunityData.name,
        amount: opportunityData.amount,
        stage: opportunityData.stage_name || opportunityData.stage,
        probability: opportunityData.probability,
        lead_source: opportunityData.lead_source,
        expected_close_date: opportunityData.expected_close_date,
        actual_close_date: opportunityData.actual_close_date,
        description: opportunityData.description,
        stage_weight: opportunityData.stage_weight,
        tenant_id: opportunityData.tenant_id,
        stage_id: opportunityData.stage_id,
        account_id: opportunityData.account_id,
        node_json: opportunityData.node_json,
        research_data: opportunityData.research_data,
      },
      account: {
        id: opportunityData.account_id,
        name: opportunityData.account_name,
        account_type: opportunityData.account_type,
        industry: opportunityData.industry,
        website: opportunityData.website,
        email: opportunityData.account_email,
        phone: opportunityData.account_phone,
        description: opportunityData.account_description,
      },
      owner: {
        id: opportunityData.owner_id,
        name: opportunityData.owner_name,
        email: opportunityData.owner_email,
        phone: opportunityData.owner_phone,
        location: opportunityData.owner_location,
        bio: opportunityData.owner_bio,
        avatar: opportunityData.owner_avatar,
        department: opportunityData.owner_department,
        job_title: opportunityData.owner_job_title,
      },
      related_contacts: relatedContactsQuery.rows.map((contact) => ({
        id: contact.id,
        opport_contactid: contact.opport_contactid,
        name:
          `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
          "Unnamed Contact",
        email: contact.email,
        created_at: contact.created_at,
        phone: contact.phone,
        mobile: contact.mobile_phone,
        title: contact.title,
        location: contact.location,
        role: contact.contact_role,
        department: contact.department,
        location2: contact.location2,
        state: contact.state,
        city: contact.city,
        zip: contact.zip,
        country: contact.country,
        // Mix of contacts and users table fields
        bio: contact.user_bio || null,
        avatar: contact.user_avatar || null,
        department: contact.department || null,
        job_title: null,
        user_location: contact.user_location || null,
        user_id: contact.user_id,
        is_primary: false,
      })),
    };


    res.json({
      success: true,
      message: 'Opportunity detail fetched successfully',
      data: {
        ...transformedData,
        research: researchInfo
      }
    });

  } catch (error) {
    console.error('Error fetching opportunity detail:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

const getOwnerOpportunities = async (req, res) => {
  try {
    const { tenantId, owner_id, email_Type } = req.query
    const clientTime = req.body.time;

    if (!tenantId || !owner_id) {
      return res.status(400).json({ success: false, message: "tenantId and owner_id are required" });
    }
    console.log('🔍 Fetching opportunities for tenant ID:', tenantId, 'and owner ID:', owner_id);
    let wherequery = '';
    if (email_Type === 'sent') {
      wherequery = 'LOWER(em.sender) = LOWER(u.email)'
    }
    else {
      wherequery=`( 
       LOWER(em.to_recipients::text) ILIKE '%' || LOWER(u.email) || '%'
      OR LOWER(em.cc_recipients::text) ILIKE '%' || LOWER(u.email) || '%')`
    }

    let query = `
  SELECT em.*,
         t.prompt,
         t.name AS template_name
  FROM email_messages em
  JOIN users u ON u.id = $1
  LEFT JOIN templates t ON em.template_id = t.id
  WHERE ${wherequery}
  AND em.isdeleted = false
`;

    const result = await pool.query(query, [owner_id]);

    const serverNow = new Date();
    const clientNow = clientTime ? new Date(clientTime) : serverNow;
    const offsetMs = clientNow.getTime() - serverNow.getTime();
    const offsetMsWithUTC = offsetMs + (0 - serverNow.getTimezoneOffset()) * 60000;

    const emaildatalist = result.rows.map((row) => {
      const utcDateStart = new Date(row.received_at);
      const localDateStart = new Date(utcDateStart.getTime() + offsetMsWithUTC);
      return {
        ...row,
        received_at: localDateStart,
        created_at: localDateStart,
      }
    })

    res.json({
      success: true,
      data: emaildatalist,
    });

  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

const deleteOwnerOpportunities = async (req, res) => {
  try {
    const { emailId } = req.query

    if (!emailId) {
      return res.status(400).json({ success: false, message: "emailId is required" });
    }
    console.log('🔍 deleting opportunities for tenant ID:', emailId);
    let query = `
      UPDATE email_messages
      SET isdeleted = TRUE
      WHERE id = $1
      RETURNING *;
    `;

    const result = await pool.query(query, [emailId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: "Email marked as deleted",
    });

  } catch (error) {
    console.error('Error deleting opportunities:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

const stageHistoryDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userid = req.user.id;

    const historyQuery = await pool.query(
      `SELECT 
    osh.opportunity_id AS opportunity_id,
    osh.stage_id AS stage_id,
    osh.tenant_id AS company_id,
    osh.created_by AS user_id,
    osh.from_stage_id AS moved_from,
    osh.email_processing,
    osh.reason,
    osh.entered_at,
    os_current.name AS current_stage_name,
    os_previous.name AS previous_stage_name,
	  u.name AS user_name
    FROM public.opportunity_stage_history AS osh
    LEFT JOIN public.opportunity_stages AS os_current 
    ON osh.stage_id = os_current.id
    LEFT JOIN public.opportunity_stages AS os_previous 
    ON osh.from_stage_id = os_previous.id 
    LEFT JOIN public.users AS u
    ON osh.created_by = u.id
    WHERE osh.opportunity_id = $1
    AND osh.created_by = $2
    AND osh.reason is NOT NULL
    ORDER BY osh.entered_at DESC
    `,
      [id, userid]
    );
    return res.status(200).json({
      success: true,
      data: historyQuery.rows
    })
  } catch (err) {
    console.error("Error fetching stage history details:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching stage history details",
      error: err.message,
    });
  }
}

module.exports = {
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
  getOpportunityDetail,
  getOpportunityPipeline,
  getOpportunityWithRelations,
  searchOpportunities,
  checkOpportunityRelations,
  addStageHistoryEntry,
  getOwnerOpportunities,
  deleteOwnerOpportunities,
  stageHistoryDetails
};