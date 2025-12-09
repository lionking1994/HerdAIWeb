const pool = require('../../config/database');
const { getTenantId } = require('../../utils/crm');

/**
 * Get template associated with an opportunity
 * GET /api/crm/opportunities/:opportunityId/template
 */
exports.getOpportunityTemplate = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const tenantId = await getTenantId(req);

    if (!opportunityId) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity ID is required'
      });
    }

    // Get template association with full template details
    const query = `
      SELECT 
        ot.id as association_id,
        ot.opportunity_id,
        ot.template_id,
        ot.notes,
        ot.attached_at,
        ot.attached_by,
        pt.name as template_name,
        pt.description as template_description,
        pt.category,
        pt.type,
        pt.estimated_cost,
        pt.budget_hours,
        pt.resource_count,
        pt.resource_details,
        pt.all_required_skills,
        pt.duration_weeks,
        pt.created_at as template_created_at,
        u.name as attached_by_name
      FROM opportunity_templates ot
      INNER JOIN psa_project_templates pt ON ot.template_id = pt.id
      LEFT JOIN users u ON ot.attached_by = u.id
      WHERE ot.opportunity_id = $1 AND ot.tenant_id = $2
    `;

    const result = await pool.query(query, [opportunityId, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No template found for this opportunity'
      });
    }

    const template = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        associationId: template.association_id,
        opportunityId: template.opportunity_id,
        templateId: template.template_id,
        notes: template.notes,
        attachedAt: template.attached_at,
        attachedBy: template.attached_by,
        attachedByName: template.attached_by_name,
        template: {
          id: template.template_id,
          name: template.template_name,
          description: template.template_description,
          category: template.category,
          type: template.type,
          estimatedCost: parseFloat(template.estimated_cost) || 0,
          budgetHours: template.budget_hours || 0,
          resourceCount: template.resource_count || 0,
          resourceDetails: template.resource_details || [],
          allRequiredSkills: template.all_required_skills || [],
          durationWeeks: template.duration_weeks || 0,
          createdAt: template.template_created_at
        }
      }
    });

  } catch (error) {
    console.error('Error fetching opportunity template:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching template',
      error: error.message
    });
  }
};

/**
 * Remove a specific template from an opportunity
 * DELETE /api/crm/opportunities/:opportunityId/templates/:templateId
 */
exports.removeSpecificTemplate = async (req, res) => {
  try {
    const { opportunityId, templateId } = req.params;
    const tenantId = await getTenantId(req);

    if (!opportunityId || !templateId) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity ID and Template ID are required'
      });
    }

    // Check if association exists
    const existingCheck = await pool.query(
      'SELECT id FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2 AND tenant_id = $3',
      [opportunityId, templateId, tenantId]
    );

    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template association not found'
      });
    }

    // Delete the association
    await pool.query(
      'DELETE FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2 AND tenant_id = $3',
      [opportunityId, templateId, tenantId]
    );

    res.json({
      success: true,
      message: 'Template removed successfully'
    });

  } catch (error) {
    console.error('Error removing template:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing template',
      error: error.message
    });
  }
};

/**
 * Get all templates associated with an opportunity
 * GET /api/crm/opportunities/:opportunityId/templates
 */
exports.getOpportunityTemplates = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const tenantId = await getTenantId(req);

    if (!opportunityId) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity ID is required'
      });
    }

    // Get all template associations with full template details
    const query = `
      SELECT 
        ot.id as association_id,
        ot.opportunity_id,
        ot.template_id,
        ot.notes,
        ot.attached_at,
        ot.attached_by,
        pt.name as template_name,
        pt.description as template_description,
        pt.category,
        pt.type,
        pt.estimated_cost,
        pt.budget_hours,
        pt.resource_count,
        pt.resource_details,
        pt.all_required_skills,
        pt.duration_weeks,
        pt.created_at as template_created_at,
        u.name as attached_by_name
      FROM opportunity_templates ot
      INNER JOIN psa_project_templates pt ON ot.template_id = pt.id
      LEFT JOIN users u ON ot.attached_by = u.id
      WHERE ot.opportunity_id = $1 AND ot.tenant_id = $2
      ORDER BY ot.attached_at ASC
    `;

    const result = await pool.query(query, [opportunityId, tenantId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          templates: [],
          aggregated: {
            totalCost: 0,
            totalHours: 0,
            uniqueResources: 0,
            allSkills: []
          }
        }
      });
    }

    // Process templates and calculate aggregated data
    const templates = [];
    let totalCost = 0;
    let totalHours = 0;
    const allResources = new Set();
    const allSkills = new Set();

    for (const templateData of result.rows) {
      // Parse JSON fields safely
      let resourceDetails = [];
      let requiredSkills = [];
      
      try {
        resourceDetails = templateData.resource_details 
          ? (typeof templateData.resource_details === 'string' 
             ? JSON.parse(templateData.resource_details) 
             : templateData.resource_details)
          : [];
      } catch (e) {
        console.warn('Failed to parse resource_details:', templateData.resource_details);
        resourceDetails = [];
      }
      
      try {
        requiredSkills = templateData.all_required_skills 
          ? (typeof templateData.all_required_skills === 'string' 
             ? JSON.parse(templateData.all_required_skills) 
             : templateData.all_required_skills)
          : [];
      } catch (e) {
        console.warn('Failed to parse all_required_skills:', templateData.all_required_skills);
        requiredSkills = [];
      }

      // Add to aggregated data
      totalCost += parseFloat(templateData.estimated_cost) || 0;
      totalHours += templateData.budget_hours || 0;
      
      // Collect unique resources
      resourceDetails.forEach(resource => {
        if (resource.user_id) {
          allResources.add(resource.user_id);
        }
      });

      // Collect all skills
      requiredSkills.forEach(skill => {
        allSkills.add(skill);
      });

      templates.push({
        associationId: templateData.association_id,
        opportunityId: templateData.opportunity_id,
        templateId: templateData.template_id,
        notes: templateData.notes,
        attachedAt: templateData.attached_at,
        attachedBy: templateData.attached_by,
        attachedByName: templateData.attached_by_name,
        template: {
          id: templateData.template_id,
          name: templateData.template_name,
          description: templateData.template_description,
          category: templateData.category,
          type: templateData.type,
          estimatedCost: parseFloat(templateData.estimated_cost) || 0,
          budgetHours: templateData.budget_hours || 0,
          resourceCount: templateData.resource_count || 0,
          resourceDetails: resourceDetails,
          allRequiredSkills: requiredSkills,
          durationWeeks: templateData.duration_weeks || 0,
          createdAt: templateData.template_created_at
        }
      });
    }

    res.json({
      success: true,
      data: {
        templates: templates,
        aggregated: {
          totalCost: totalCost,
          totalHours: totalHours,
          uniqueResources: allResources.size,
          allSkills: Array.from(allSkills)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching opportunity templates:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching templates',
      error: error.message
    });
  }
};

/**
 * Remove a specific template from an opportunity
 * DELETE /api/crm/opportunities/:opportunityId/templates/:templateId
 */
exports.removeSpecificTemplate = async (req, res) => {
  try {
    const { opportunityId, templateId } = req.params;
    const tenantId = await getTenantId(req);

    if (!opportunityId || !templateId) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity ID and Template ID are required'
      });
    }

    // Check if association exists
    const existingCheck = await pool.query(
      'SELECT id FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2 AND tenant_id = $3',
      [opportunityId, templateId, tenantId]
    );

    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template association not found'
      });
    }

    // Delete the association
    await pool.query(
      'DELETE FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2 AND tenant_id = $3',
      [opportunityId, templateId, tenantId]
    );

    res.json({
      success: true,
      message: 'Template removed successfully'
    });

  } catch (error) {
    console.error('Error removing template:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing template',
      error: error.message
    });
  }
};

/**
 * Attach a template to an opportunity
 * POST /api/crm/opportunities/:opportunityId/template
 */
exports.attachTemplateToOpportunity = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { templateId, notes } = req.body;
    const tenantId = await getTenantId(req);
    const userId = req.user?.id;

    if (!opportunityId) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity ID is required'
      });
    }

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }

    // Check if opportunity exists
    const oppCheck = await pool.query(
      'SELECT id FROM opportunities WHERE id = $1 AND tenant_id = $2',
      [opportunityId, tenantId]
    );

    if (oppCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    // Check if template exists
    const templateCheck = await pool.query(
      'SELECT id, name FROM psa_project_templates WHERE id = $1',
      [templateId]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check if this specific template is already attached to this opportunity
    const existingCheck = await pool.query(
      'SELECT id FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2',
      [opportunityId, templateId]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This template is already attached to this opportunity.',
        existingTemplateId: existingCheck.rows[0].id
      });
    }

    // Insert new association
    const insertQuery = `
      INSERT INTO opportunity_templates (
        opportunity_id,
        template_id,
        tenant_id,
        notes,
        attached_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      opportunityId,
      templateId,
      tenantId,
      notes || null,
      userId
    ]);

    // Fetch full template details
    const templateDetails = await pool.query(`
      SELECT 
        pt.*,
        ot.notes,
        ot.attached_at,
        u.name as attached_by_name
      FROM psa_project_templates pt
      LEFT JOIN opportunity_templates ot ON pt.id = ot.template_id AND ot.opportunity_id = $1
      LEFT JOIN users u ON ot.attached_by = u.id
      WHERE pt.id = $2
    `, [opportunityId, templateId]);

    const template = templateDetails.rows[0];

    res.status(201).json({
      success: true,
      message: 'Template attached to opportunity successfully',
      data: {
        associationId: result.rows[0].id,
        opportunityId: opportunityId,
        templateId: templateId,
        notes: notes,
        attachedAt: result.rows[0].attached_at,
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          estimatedCost: parseFloat(template.estimated_cost) || 0,
          budgetHours: template.budget_hours || 0,
          resourceCount: template.resource_count || 0,
          resourceDetails: template.resource_details || [],
          allRequiredSkills: template.all_required_skills || [],
          durationWeeks: template.duration_weeks || 0
        }
      }
    });

  } catch (error) {
    console.error('Error attaching template to opportunity:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while attaching template',
      error: error.message
    });
  }
}


/**
 * Remove a specific template from an opportunity
 * DELETE /api/crm/opportunities/:opportunityId/templates/:templateId
 */
exports.removeSpecificTemplate = async (req, res) => {
  try {
    const { opportunityId, templateId } = req.params;
    const tenantId = await getTenantId(req);

    if (!opportunityId || !templateId) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity ID and Template ID are required'
      });
    }

    // Check if association exists
    const existingCheck = await pool.query(
      'SELECT id FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2 AND tenant_id = $3',
      [opportunityId, templateId, tenantId]
    );

    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template association not found'
      });
    }

    // Delete the association
    await pool.query(
      'DELETE FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2 AND tenant_id = $3',
      [opportunityId, templateId, tenantId]
    );

    res.json({
      success: true,
      message: 'Template removed successfully'
    });

  } catch (error) {
    console.error('Error removing template:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing template',
      error: error.message
    });
  }
};

/**
 * Update/replace template for an opportunity
 * PUT /api/crm/opportunities/:opportunityId/template
 */
exports.updateOpportunityTemplate = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { templateId, notes } = req.body;
    const tenantId = await getTenantId(req);

    if (!opportunityId) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity ID is required'
      });
    }

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }

    // Check if association exists
    const existingCheck = await pool.query(
      'SELECT id FROM opportunity_templates WHERE opportunity_id = $1 AND tenant_id = $2',
      [opportunityId, tenantId]
    );

    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No template association found for this opportunity. Use POST to create one.'
      });
    }

    // Check if new template exists
    const templateCheck = await pool.query(
      'SELECT id, name FROM psa_project_templates WHERE id = $1',
      [templateId]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Update the association
    const updateQuery = `
      UPDATE opportunity_templates
      SET template_id = $1,
          notes = $2,
          attached_at = NOW()
      WHERE opportunity_id = $3 AND tenant_id = $4
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      templateId,
      notes || null,
      opportunityId,
      tenantId
    ]);

    // Fetch full template details
    const templateDetails = await pool.query(`
      SELECT 
        pt.*,
        ot.notes,
        ot.attached_at,
        u.name as attached_by_name
      FROM psa_project_templates pt
      LEFT JOIN opportunity_templates ot ON pt.id = ot.template_id AND ot.opportunity_id = $1
      LEFT JOIN users u ON ot.attached_by = u.id
      WHERE pt.id = $2
    `, [opportunityId, templateId]);

    const template = templateDetails.rows[0];

    res.status(200).json({
      success: true,
      message: 'Template updated successfully',
      data: {
        associationId: result.rows[0].id,
        opportunityId: opportunityId,
        templateId: templateId,
        notes: notes,
        attachedAt: result.rows[0].attached_at,
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          estimatedCost: parseFloat(template.estimated_cost) || 0,
          budgetHours: template.budget_hours || 0,
          resourceCount: template.resource_count || 0,
          resourceDetails: template.resource_details || [],
          allRequiredSkills: template.all_required_skills || [],
          durationWeeks: template.duration_weeks || 0
        }
      }
    });

  } catch (error) {
    console.error('Error updating opportunity template:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating template',
      error: error.message
    });
  }
};

/**
 * Remove a specific template from an opportunity
 * DELETE /api/crm/opportunities/:opportunityId/templates/:templateId
 */
exports.removeSpecificTemplate = async (req, res) => {
  try {
    const { opportunityId, templateId } = req.params;
    const tenantId = await getTenantId(req);

    if (!opportunityId || !templateId) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity ID and Template ID are required'
      });
    }

    // Check if association exists
    const existingCheck = await pool.query(
      'SELECT id FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2 AND tenant_id = $3',
      [opportunityId, templateId, tenantId]
    );

    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template association not found'
      });
    }

    // Delete the association
    await pool.query(
      'DELETE FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2 AND tenant_id = $3',
      [opportunityId, templateId, tenantId]
    );

    res.json({
      success: true,
      message: 'Template removed successfully'
    });

  } catch (error) {
    console.error('Error removing template:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing template',
      error: error.message
    });
  }
};

/**
 * Remove template from an opportunity
 * DELETE /api/crm/opportunities/:opportunityId/template
 */
exports.removeOpportunityTemplate = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const tenantId = await getTenantId(req);

    if (!opportunityId) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity ID is required'
      });
    }

    // Check if association exists
    const existingCheck = await pool.query(
      'SELECT id, template_id FROM opportunity_templates WHERE opportunity_id = $1 AND tenant_id = $2',
      [opportunityId, tenantId]
    );

    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No template association found for this opportunity'
      });
    }

    // Delete the association
    await pool.query(
      'DELETE FROM opportunity_templates WHERE opportunity_id = $1 AND tenant_id = $2',
      [opportunityId, tenantId]
    );

    res.status(200).json({
      success: true,
      message: 'Template removed from opportunity successfully',
      data: {
        opportunityId: opportunityId,
        removedTemplateId: existingCheck.rows[0].template_id
      }
    });

  } catch (error) {
    console.error('Error removing opportunity template:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing template',
      error: error.message
    });
  }
};

/**
 * Remove a specific template from an opportunity
 * DELETE /api/crm/opportunities/:opportunityId/templates/:templateId
 */
exports.removeSpecificTemplate = async (req, res) => {
  try {
    const { opportunityId, templateId } = req.params;
    const tenantId = await getTenantId(req);

    if (!opportunityId || !templateId) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity ID and Template ID are required'
      });
    }

    // Check if association exists
    const existingCheck = await pool.query(
      'SELECT id FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2 AND tenant_id = $3',
      [opportunityId, templateId, tenantId]
    );

    if (existingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template association not found'
      });
    }

    // Delete the association
    await pool.query(
      'DELETE FROM opportunity_templates WHERE opportunity_id = $1 AND template_id = $2 AND tenant_id = $3',
      [opportunityId, templateId, tenantId]
    );

    res.json({
      success: true,
      message: 'Template removed successfully'
    });

  } catch (error) {
    console.error('Error removing template:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing template',
      error: error.message
    });
  }
};
