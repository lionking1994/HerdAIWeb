const pool = require("../config/database");

exports.createProject = async (req, res) => {
  try {
    const { id: userId } = req.user;          // from auth middleware
    const { companyId } = req.params;         // from route params

    const {
      name,
      description,
      type,
      methodology,
      client,
      start_date,
      end_date,
      budget_hours,
      assigned_resources = []  // Array of assigned resources
    } = req.body;

    // Extract resource data from assigned_resources array
    const resourceUserIds = assigned_resources.map(r => parseInt(r.resource_user_id));
    const resourceRoles = assigned_resources.map(r => r.role);
    const resourceAllocations = assigned_resources.map(r => r.allocation_percentage);

    const result = await pool.query(
      `INSERT INTO psa_projects (
        name,
        description,
        type,
        methodology,
        client_id,
        start_date,
        end_date,
        budget_hours,
        company_id,
        user_id,
        resource_user_ids,
        resource_roles,
        resource_allocations
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        name,
        description,
        type,
        methodology,
        client,
        start_date,
        end_date,
        budget_hours,
        companyId,
        userId,
        resourceUserIds,
        resourceRoles,
        resourceAllocations
      ]
    );

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error creating project:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating project",
      error: error.message
    });
  }
};

exports.getProject = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { companyId } = req.params;

    const result = await pool.query(
      `SELECT 
        p.*,
        c.id as client_id,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone
       FROM psa_projects p
       LEFT JOIN accounts c ON p.client_id = c.id
       WHERE p.company_id = $1 AND p.user_id = $2 AND p.is_deleted = false
       ORDER BY p.created_at DESC`,
      [companyId, userId]
    );

    // Transform the result to include client object
    const projects = result.rows.map(project => ({
      ...project,
      client: project.client_id ? {
        id: project.client_id,
        name: project.client_name,
        email: project.client_email,
        phone: project.client_phone
      } : null
    }));

    res.status(200).json({
      success: true,
      projects: projects,
    });
  } catch (error) {
    console.error("❌ Error fetching projects:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching projects",
    });
  }
};

// Get single project by ID with comprehensive details
exports.getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    // Get project details
    const projectQuery = `
      SELECT 
        p.*,
        c.id as client_id,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        creator.name as created_by_name,
        creator.email as created_by_email
      FROM psa_projects p
      LEFT JOIN accounts c ON p.client_id = c.id
      LEFT JOIN users creator ON p.created_by::VARCHAR = creator.id::VARCHAR
      WHERE p.id = $1 AND p.is_deleted = false
    `;
    const projectResult = await pool.query(projectQuery, [projectId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    // Get assigned resources
    let assignedResources = [];
    if (project.resource_user_ids && project.resource_user_ids.length > 0) {
      const usersQuery = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.avatar,
          r.title as role_title,
          r.location,
          r.hourly_rate,
          r.currency
        FROM users u
        LEFT JOIN psa_resources r ON u.id = r.user_id
        WHERE u.id = ANY($1)
        ORDER BY u.name ASC
      `;
      const usersResult = await pool.query(usersQuery, [project.resource_user_ids]);
      
      assignedResources = usersResult.rows.map((user, index) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: project.resource_roles ? project.resource_roles[index] : 'member',
        allocation: project.resource_allocations ? project.resource_allocations[index] : 0,
        title: user.role_title,
        location: user.location,
        hourlyRate: user.hourly_rate,
        currency: user.currency
      }));
    }

    // Get backlog items summary
    const backlogQuery = `
      SELECT 
        type,
        status,
        COUNT(*) as count
      FROM psa_backlog_items 
      WHERE project_id = $1 AND is_deleted = false
      GROUP BY type, status
    `;
    const backlogResult = await pool.query(backlogQuery, [projectId]);

    // Process backlog summary
    const backlogSummary = {
      epics: 0,
      features: 0,
      stories: 0,
      statusBreakdown: {
        backlog: 0,
        in_progress: 0,
        review: 0,
        done: 0
      }
    };

    backlogResult.rows.forEach(row => {
      if (row.type === 'epic') backlogSummary.epics += parseInt(row.count);
      if (row.type === 'feature') backlogSummary.features += parseInt(row.count);
      if (row.type === 'story') backlogSummary.stories += parseInt(row.count);
      
      if (row.status === 'backlog') backlogSummary.statusBreakdown.backlog += parseInt(row.count);
      if (row.status === 'in_progress') backlogSummary.statusBreakdown.in_progress += parseInt(row.count);
      if (row.status === 'review') backlogSummary.statusBreakdown.review += parseInt(row.count);
      if (row.status === 'done') backlogSummary.statusBreakdown.done += parseInt(row.count);
    });

    // Get complete work breakdown hierarchy
    const workBreakdownQuery = `
      WITH RECURSIVE work_hierarchy AS (
        -- Base case: Get all top-level items (epics)
        SELECT 
          bi.id,
          bi.title,
          bi.description,
          bi.type,
          bi.status,
          bi.priority,
          bi.story_points,
          bi.parent_id,
          bi.hierarchy_level,
          0 as level_depth,
          ARRAY[bi.id] as path
        FROM psa_backlog_items bi
        WHERE bi.project_id = $1 
          AND bi.is_deleted = false 
          AND bi.parent_id IS NULL
          AND bi.type = 'epic'
        
        UNION ALL
        
        -- Recursive case: Get children
        SELECT 
          bi.id,
          bi.title,
          bi.description,
          bi.type,
          bi.status,
          bi.priority,
          bi.story_points,
          bi.parent_id,
          bi.hierarchy_level,
          wh.level_depth + 1,
          wh.path || bi.id
        FROM psa_backlog_items bi
        INNER JOIN work_hierarchy wh ON bi.parent_id = wh.id
        WHERE bi.is_deleted = false
      )
      SELECT 
        wh.id,
        wh.title,
        wh.description,
        wh.type,
        wh.status,
        wh.priority,
        wh.story_points,
        wh.parent_id,
        wh.level_depth,
        COUNT(child.id) as sub_items_count,
        CASE 
          WHEN wh.type = 'epic' THEN COUNT(child.id) FILTER (WHERE child.type = 'feature')
          WHEN wh.type = 'feature' THEN COUNT(child.id) FILTER (WHERE child.type = 'story')
          ELSE 0
        END as child_count_by_type
      FROM work_hierarchy wh
      LEFT JOIN psa_backlog_items child ON child.parent_id = wh.id AND child.is_deleted = false
      GROUP BY wh.id, wh.title, wh.description, wh.type, wh.status, wh.priority, wh.story_points, wh.parent_id, wh.level_depth, wh.hierarchy_level, wh.path
      ORDER BY wh.path, wh.hierarchy_level ASC
    `;
    const workBreakdownResult = await pool.query(workBreakdownQuery, [projectId]);

    // Calculate progress percentage
    const totalItems = backlogSummary.epics + backlogSummary.features + backlogSummary.stories;
    const completedItems = backlogSummary.statusBreakdown.done;
    const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    // Calculate budget utilization based on actual resource costs (similar to cost analysis API)
    const budgetHours = project.budget_hours || 0;
    const currentDate = new Date();
    const projectStartDate = new Date(project.start_date);
    const projectEndDate = new Date(project.end_date);
    
    // Calculate weeks elapsed
    const weeksElapsed = Math.max(0, (currentDate - projectStartDate) / (7 * 24 * 60 * 60 * 1000));
    
    // Calculate actual spent cost based on resource allocations
    let totalSpentCost = 0;
    if (project.resource_user_ids && project.resource_user_ids.length > 0) {
      // Get resource hourly rates
      const resourceRatesQuery = `
        SELECT 
          u.id,
          r.hourly_rate,
          r.hours_per_week,
          r.currency
        FROM users u
        LEFT JOIN psa_resources r ON u.id = r.user_id
        WHERE u.id = ANY($1)
      `;
      const resourceRatesResult = await pool.query(resourceRatesQuery, [project.resource_user_ids]);
      
      // Calculate spent cost for each resource
      resourceRatesResult.rows.forEach((resource, index) => {
        const allocationPercentage = project.resource_allocations ? project.resource_allocations[index] : 0;
        const hourlyRate = parseFloat(resource.hourly_rate) || 0;
        const hoursPerWeek = resource.hours_per_week || 40;
        
        const weeklyCost = (allocationPercentage / 100) * hoursPerWeek * hourlyRate;
        const spentCost = weeklyCost * weeksElapsed;
        totalSpentCost += spentCost;
      });
    }
    
    const budgetUtilization = budgetHours > 0 ? Math.round((totalSpentCost / budgetHours) * 100) : 0;

    // Transform project data
    const projectData = {
      ...project,
      client: project.client_id ? {
        id: project.client_id,
        name: project.client_name,
        email: project.client_email,
        phone: project.client_phone
      } : null,
      createdBy: {
        name: project.created_by_name,
        email: project.created_by_email
      },
      assignedResources,
      backlogSummary,
      workBreakdown: workBreakdownResult.rows,
      progressPercentage,
      budgetUtilization,
      totalItems,
      completedItems,
      budgetHours,
      spentCost: Math.round(totalSpentCost * 100) / 100,
      remainingCost: Math.round((budgetHours - totalSpentCost) * 100) / 100,
      weeksElapsed: Math.round(weeksElapsed * 100) / 100
    };

    res.status(200).json({
      success: true,
      data: projectData,
    });
  } catch (error) {
    console.error("Error fetching project details:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching project details",
      error: error.message,
    });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.params.companyId;  // ✅ same as create
    const { projectId } = req.params;

    const {
      project_title,
      description,
      project_type,
      methodology,
      client,
      start_date,
      end_date,
      budget_hours,
      assigned_resources = []  // Array of assigned resources
    } = req.body;

    // Extract resource data from assigned_resources array
    
    const resourceUserIds = assigned_resources.map(r => parseInt(r.resource_user_id));
    const resourceRoles = assigned_resources.map(r => r.role);
    const resourceAllocations = assigned_resources.map(r => {
      const allocation = r.allocation_percentage;
      // Ensure allocation is a valid number, default to 0 if null/undefined
      return allocation !== null && allocation !== undefined ? parseInt(allocation) : 0;
    });    

    const result = await pool.query(
      `
      UPDATE psa_projects 
      SET name = $1, description = $2, type = $3, methodology = $4, client_id = $5, 
          start_date = $6, end_date = $7, budget_hours = $8, company_id = $9, 
          resource_user_ids = $10, resource_roles = $11, resource_allocations = $12,
          updated_at = NOW()
      WHERE id = $13 AND user_id = $14
      RETURNING * 
      `,
      [
        project_title,
        description,
        project_type,
        methodology,
        client,
        start_date,
        end_date,
        budget_hours,
        companyId,   // ✅ consistent with create
        resourceUserIds,
        resourceRoles,
        resourceAllocations,
        projectId,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Project not found or not authorized" });
    }

    res.status(200).json({ success: true, project: result.rows[0] });

  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const { companyId, projectId } = req.params;

    const result = await pool.query(
      `UPDATE psa_projects
       SET is_active = FALSE, is_deleted = TRUE
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [projectId, companyId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    res.status(200).json({ success: true, project: result.rows[0] });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getCompanyResources = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Get all users for the company
    const usersQuery = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.avatar,
        u.created_at AS user_created_at
      FROM users u
      INNER JOIN company_roles cu ON u.company_role = cu.id
      INNER JOIN company c ON cu.company_id = c.id
      WHERE cu.company_id = $1 AND u.status = 'enabled'
      ORDER BY u.name ASC
    `;
    const usersResult = await pool.query(usersQuery, [companyId]);
    const users = usersResult.rows;

    if (users.length === 0) {
      return res.status(200).json({
        success: true,
        resources: [],
        message: "No users found for this company",
      });
    }

    const userIds = users.map((u) => u.id);

    // Get resources
    const resourcesQuery = `
      SELECT
        r.id AS resource_id,
        r.user_id,
        r.organization_id,
        r.department_id,
        r.manager_id,
        r.employee_id,
        r.title,
        r.level,
        r.employment_type,
        r.location,
        r.timezone,
        r.hours_per_week,
        r.start_time,
        r.end_time,
        r.working_days,
        r.hourly_rate,
        r.currency,
        r.cost_center,
        COALESCE(
          (SELECT SUM(
             CASE 
               WHEN array_position(p.resource_user_ids, r.user_id) IS NOT NULL 
               THEN COALESCE(p.resource_allocations[array_position(p.resource_user_ids, r.user_id)], 0)
               ELSE 0 
             END
           )
           FROM psa_projects p
           WHERE r.user_id = ANY(p.resource_user_ids)
             AND p.is_active = true
             AND p.is_deleted = false
             AND p.company_id = $2
          ), 0
        ) AS availability,
        r.performance_rating,
        r.utilization_target,
        r.hire_date,
        r.is_active,
        r.is_deleted,
        r.created_at AS resource_created_at,
        r.updated_at AS resource_updated_at,

        cr.name AS department_name,
        cr.description AS department_description,
        o.name AS organization_name,
        o.type AS organization_type,

        m.title AS manager_title,
        mu.name AS manager_name,
        mu.email AS manager_email
      FROM psa_resources r
      LEFT JOIN company_roles cr ON r.department_id = cr.id
      LEFT JOIN psa_organizations o ON r.organization_id = o.id
      LEFT JOIN psa_resources m ON r.manager_id = m.id
      LEFT JOIN users mu ON m.user_id = mu.id
      WHERE r.user_id = ANY($1) AND r.is_deleted = false
    `;
    const resourcesResult = await pool.query(resourcesQuery, [userIds, companyId]);
    const resources = resourcesResult.rows;

    // Get skills
    const skillsQuery = `
      SELECT
        rs.resource_id,
        rs.proficiency_level,
        rs.years_experience,
        rs.last_used,
        rs.certified_date,
        s.id AS skill_id,
        s.name AS skill_name,
        s.category AS skill_category,
        s.description AS skill_description
      FROM psa_resource_skills rs
      JOIN psa_skills s ON rs.skill_id = s.id
      WHERE rs.resource_id = ANY($1) AND rs.is_deleted = false
    `;
    const skillsResult = await pool.query(skillsQuery, [resources.map(r => r.resource_id)]);

    // Get certifications
    const certificationsQuery = `
      SELECT
        rc.resource_id,
        rc.date_obtained,
        rc.expiration_date,
        rc.status AS cert_status,
        rc.certificate_number,
        rc.verification_url,
        c.id AS certification_id,
        c.name AS certification_name,
        c.issuing_organization,
        c.description AS certification_description,
        c.validity_period_months
      FROM psa_resource_certifications rc
      JOIN psa_certifications c ON rc.certification_id = c.id
      WHERE rc.resource_id = ANY($1) AND rc.is_deleted = false
    `;
    const certificationsResult = await pool.query(certificationsQuery, [resources.map(r => r.resource_id)]);

    const skills = skillsResult.rows;
    const certifications = certificationsResult.rows;

    // Merge user + resource + skills + certs
    const resourcesWithData = users.map((user) => {
      const resource = resources.find((r) => r.user_id === user.id);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        user_created_at: user.user_created_at,
        resource: resource ? {
          ...resource,
          department: {
            id: resource.department_id,
            name: resource.department_name,
            description: resource.department_description,
          },
          organization: {
            id: resource.organization_id,
            name: resource.organization_name,
            type: resource.organization_type,
          },
          manager: resource.manager_id
            ? {
              id: resource.manager_id,
              title: resource.manager_title,
              name: resource.manager_name,
              email: resource.manager_email,
            }
            : null,
        } : null,
        skills: skills.filter(s => s.resource_id === resource?.resource_id),
        certifications: certifications.filter(c => c.resource_id === resource?.resource_id),
      };
    });

    res.status(200).json({
      success: true,
      resources: resourcesWithData,
      total: resourcesWithData.length,
    });
  } catch (error) {
    console.error("Error fetching company resources:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.createProjectTemplate = async (req, res) => {
  try {
    const userId = req.user.id; // Authenticated user
    const { projectId } = req.params;

    const {
      title,
      description,
      item_type,
      category,
      priority,
      story_points,
      required_skills,
      tags,
      acceptance_criteria,
      definition_of_done,
      created_by // explicitly from frontend (if different than userId)
    } = req.body;

    const result = await pool.query(
      `INSERT INTO psa_project_templates (
        name,
        description,
        type,
        category,
        priority,
        story_points,
        required_skills,
        acceptance_criteria,
        definition_of_done,
        tags,
        created_by,
        project_id,
        user_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        title,
        description,
        item_type,
        category,
        priority || 'medium',
        story_points || 1,
        required_skills || [],
        acceptance_criteria || [],
        definition_of_done || [],
        tags || [],
        created_by,
        projectId,
        userId
      ]
    );

    res.status(201).json({ success: true, template: result.rows[0] });
  } catch (error) {
    console.error("Error creating project template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getProjectTemplate = async (req, res) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.projectId;

    const result = await pool.query(
      `SELECT 
     id,
     name ,
     description,
     type,
     category,
     priority,
     story_points,
     required_skills,
     acceptance_criteria,
     definition_of_done,
     created_by,
     project_id,
     user_id,
     created_at
   FROM psa_project_templates
   WHERE project_id = $1 AND user_id = $2
   ORDER BY created_at DESC`,
      [projectId, userId]
    );

    const normalized = result.rows.map(row => ({
      id: row.id,
      title: row.name,
      description: row.description,
      type: row.type,
      status: row.status || 'backlog',
      priority: row.priority,
      storyPoints: row.story_points,
      tags: row.tags || [],
      acceptanceCriteria: row.acceptance_criteria || [],
      children: []
    }));
    res.status(200).json({ success: true, templates: normalized });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createProjectHierarchy = async (req, res) => {
  try {
    const {
      title,
      description,
      type,          // 'epic', 'feature', or 'story'
      priority,
      storyPoints,
      parent_id,     // optional, parent epic id for features, parent feature id for stories
      acceptance_criteria,
      definition_of_done,
      tags,
      assignee_id,
      sprint_id,
      projectId,
      project_id,
      business_value,
      success_metrics,
      user_persona,
      estimated_hours,
      required_skills
    } = req.body;

    // Use projectId from params if not in body
    const actualProjectId = projectId || project_id;

    if (!actualProjectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    // Determine hierarchy level based on type
    const hierarchyLevel = type === 'epic' ? 1 :
      type === 'feature' ? 2 : 3;

    // Validate business value for Epic
    if (type === 'epic' && (!business_value || business_value <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Business value is required for Epic and must be greater than 0'
      });
    }

    // Validate parent relationship
    if (type === 'feature' && parent_id) {
      // Check if parent is an Epic
      const parentCheck = await pool.query(
        `SELECT id, type FROM psa_backlog_items 
         WHERE id = $1 AND project_id = $2 AND is_deleted = false`,
        [parent_id, actualProjectId]
      );
      if (parentCheck.rows.length === 0 || parentCheck.rows[0].type !== 'epic') {
        return res.status(400).json({
          success: false,
          message: 'Feature must have a valid Epic as parent'
        });
      }
    }

    if (type === 'story' && parent_id) {
      // Check if parent is a Feature
      const parentCheck = await pool.query(
        `SELECT id, type FROM psa_backlog_items 
         WHERE id = $1 AND project_id = $2 AND is_deleted = false`,
        [parent_id, actualProjectId]
      );
      if (parentCheck.rows.length === 0 || parentCheck.rows[0].type !== 'feature') {
        return res.status(400).json({
          success: false,
          message: 'Story must have a valid Feature as parent'
        });
      }
    }

    // Check for duplicate item with same title, parent, and type
    const duplicateCheck = await pool.query(
      `SELECT id FROM psa_backlog_items 
       WHERE project_id = $1 AND parent_id = $2 AND title = $3 AND type = $4 AND is_deleted = false`,
      [actualProjectId, parent_id || null, title, type]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `A ${type} with this title already exists under the same parent`
      });
    }

    // Insert into backlog items table
    const backlogResult = await pool.query(
      `INSERT INTO psa_backlog_items
       (project_id, parent_id, title, description, type, hierarchy_level, 
        priority, story_points, estimated_hours, assignee_id, sprint_id, acceptance_criteria, 
        definition_of_done, tags, business_value, success_metrics, user_persona, required_skills)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
   RETURNING *`,
      [
        actualProjectId,
        parent_id || null,
        title,
        description,
        type,
        hierarchyLevel,
        priority || 'medium',
        storyPoints || 1,
        estimated_hours || null,
        assignee_id || null,
        sprint_id || null,
        acceptance_criteria || [],
        definition_of_done || [],
        tags || [],
        business_value || null,
        success_metrics || null,
        user_persona || null,
        required_skills || []
      ]
    );

    // If a new story is created, check if parent should be moved to backlog
    if (type === 'story') {
      await checkParentForBacklog(backlogResult.rows[0].id);
    }

    // After creating any backlog item, trigger a refresh of backlog data
    // This ensures frontend gets updated data immediately

    return res.json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} created successfully`,
      data: backlogResult.rows[0],
      // Include project ID so frontend knows which project to refresh
      projectId: actualProjectId,
      // Flag to indicate that backlog data should be refreshed
      refreshBacklog: true
    });
  } catch (err) {
    console.error('❌ Error in createProjectHierarchy:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating backlog item',
      error: err.message
    });
  }
};

exports.getAllResources = async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Get all users for the company
    const usersQuery = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.avatar,
        u.created_at AS user_created_at
      FROM users u
      INNER JOIN company_roles cu ON u.company_role = cu.id
      INNER JOIN company c ON cu.company_id = c.id
      WHERE cu.company_id = $1 AND u.status = 'enabled'
      ORDER BY u.name ASC
    `;
    const usersResult = await pool.query(usersQuery, [companyId]);
    const users = usersResult.rows;

    if (users.length === 0) {
      return res.status(200).json({
        success: true,
        resources: [],
        message: "No users found for this company",
      });
    }

    const userIds = users.map((u) => u.id);

    // Get resources with calculated availability from project allocations
    const resourcesQuery = `
      SELECT
        r.id AS resource_id,
        r.user_id,
        r.organization_id,
        r.department_id,
        r.manager_id,
        r.employee_id,
        r.title,
        r.level,
        r.employment_type,
        r.location,
        r.timezone,
        r.hours_per_week,
        r.start_time,
        r.end_time,
        r.working_days,
        r.hourly_rate,
        r.currency,
        r.cost_center,
        COALESCE(
          (SELECT SUM(
             CASE 
               WHEN array_position(p.resource_user_ids, r.user_id) IS NOT NULL 
               THEN COALESCE(p.resource_allocations[array_position(p.resource_user_ids, r.user_id)], 0)
               ELSE 0 
             END
           )
           FROM psa_projects p
           WHERE r.user_id = ANY(p.resource_user_ids)
             AND p.is_active = true
             AND p.is_deleted = false
             AND p.company_id = $2
          ), 0
        ) AS availability,
        r.performance_rating,
        r.utilization_target,
        r.hire_date,
        r.is_active,
        r.is_deleted,
        r.created_at AS resource_created_at,
        r.updated_at AS resource_updated_at,
 
        cr.name AS department_name,
        cr.description AS department_description,
        o.name AS organization_name,
        o.type AS organization_type,
 
        m.title AS manager_title,
        mu.name AS manager_name,
        mu.email AS manager_email
      FROM psa_resources r
      LEFT JOIN company_roles cr ON r.department_id = cr.id
      LEFT JOIN psa_organizations o ON r.organization_id = o.id
      LEFT JOIN psa_resources m ON r.manager_id = m.id
      LEFT JOIN users mu ON m.user_id = mu.id
      WHERE r.user_id = ANY($1) AND r.is_deleted = false
    `;
    const resourcesResult = await pool.query(resourcesQuery, [userIds, companyId]);
    const resources = resourcesResult.rows;

    // Get skills
    const skillsQuery = `
      SELECT
        rs.resource_id,
        rs.proficiency_level,
        rs.years_experience,
        rs.last_used,
        rs.certified_date,
        s.id AS skill_id,
        s.name AS skill_name,
        s.category AS skill_category,
        s.description AS skill_description
      FROM psa_resource_skills rs
      JOIN psa_skills s ON rs.skill_id = s.id
      WHERE rs.resource_id = ANY($1) AND rs.is_deleted = false
    `;
    const skillsResult = await pool.query(skillsQuery, [resources.map(r => r.resource_id)]);

    // Get certifications
    const certificationsQuery = `
      SELECT
        rc.resource_id,
        rc.date_obtained,
        rc.expiration_date,
        rc.status AS cert_status,
        rc.certificate_number,
        rc.verification_url,
        c.id AS certification_id,
        c.name AS certification_name,
        c.issuing_organization,
        c.description AS certification_description,
        c.validity_period_months
      FROM psa_resource_certifications rc
      JOIN psa_certifications c ON rc.certification_id = c.id
      WHERE rc.resource_id = ANY($1) AND rc.is_deleted = false
    `;
    const certificationsResult = await pool.query(certificationsQuery, [resources.map(r => r.resource_id)]);

    // Get active projects for each resource
    const activeProjectsQuery = `
      SELECT DISTINCT
        p.id AS project_id,
        p.name AS project_name,
        p.resource_user_ids,
        p.resource_roles,
        p.resource_allocations
      FROM psa_projects p
      WHERE p.is_active = true
        AND p.resource_user_ids IS NOT NULL
        AND array_length(p.resource_user_ids, 1) > 0
    `;
    const activeProjectsResult = await pool.query(activeProjectsQuery);
    const activeProjects = activeProjectsResult.rows;

    const skills = skillsResult.rows;
    const certifications = certificationsResult.rows;

    // Merge user + resource + skills + certs + active projects
    const resourcesWithData = users.map((user) => {
      const resource = resources.find((r) => r.user_id === user.id);
      
      // Find active projects for this user
      const userActiveProjects = activeProjects.filter(project => 
        project.resource_user_ids && project.resource_user_ids.includes(user.id)
      ).map(project => ({
        id: project.project_id,
        name: project.project_name,
        role: project.resource_roles ? 
          project.resource_roles[project.resource_user_ids.indexOf(user.id)] || 'member' : 
          'member',
          allocation: project.resource_allocations ? project.resource_allocations[project.resource_user_ids.indexOf(user.id)] || 0 : 0
      }));

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        user_created_at: user.user_created_at,
        resource: resource ? {
          ...resource,
          department: {
            id: resource.department_id,
            name: resource.department_name,
            description: resource.department_description,
          },
          organization: {
            id: resource.organization_id,
            name: resource.organization_name,
            type: resource.organization_type,
          },
          manager: resource.manager_id
            ? {
              id: resource.manager_id,
              title: resource.manager_title,
              name: resource.manager_name,
              email: resource.manager_email,
            }
            : null,
        } : null,
        skills: skills.filter(s => s.resource_id === resource?.resource_id),
        certifications: certifications.filter(c => c.resource_id === resource?.resource_id),
        activeProjects: userActiveProjects,
      };
    });

    res.status(200).json({
      success: true,
      resources: resourcesWithData,
      total: resourcesWithData.length,
    });
  } catch (error) {
    console.error("Error fetching resources:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get single resource with PSA data
exports.getResourceById = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const resourceQuery = `
      SELECT
        u.id AS user_id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.avatar,
        u.created_at AS user_created_at,
 
        r.id AS resource_id,
        r.user_id,
        r.organization_id,
        r.department_id,
        r.manager_id,
        r.employee_id,
        r.title,
        r.level,
        r.employment_type,
        r.location,
        r.timezone,
        r.hours_per_week,
        r.start_time,
        r.end_time,
        r.working_days,
        r.hourly_rate,
        r.currency,
        r.cost_center,
        COALESCE(
          (SELECT SUM(
             CASE 
               WHEN array_position(p.resource_user_ids, r.user_id) IS NOT NULL 
               THEN COALESCE(p.resource_allocations[array_position(p.resource_user_ids, r.user_id)], 0)
               ELSE 0 
             END
           )
           FROM psa_projects p
           WHERE r.user_id = ANY(p.resource_user_ids)
             AND p.is_active = true
             AND p.is_deleted = false
             AND p.company_id = $2
          ), 0
        ) AS availability,
        r.performance_rating,
        r.utilization_target,
        r.hire_date,
        r.is_active,
        r.is_deleted,
        r.created_at AS resource_created_at,
        r.updated_at AS resource_updated_at,
 
        cr.name AS department_name,
        cr.description AS department_description,
        o.name AS organization_name,
        o.type AS organization_type,
 
        m.title AS manager_title,
        mu.name AS manager_name,
        mu.email AS manager_email
      FROM users u
      INNER JOIN company_roles cu ON u.company_role = cu.id
      INNER JOIN company c ON cu.company_id = c.id
      LEFT JOIN psa_resources r ON u.id = r.user_id
      LEFT JOIN company_roles cr ON r.department_id = cr.id
      LEFT JOIN psa_organizations o ON r.organization_id = o.id
      LEFT JOIN psa_resources m ON r.manager_id = m.id
      LEFT JOIN users mu ON m.user_id = mu.id
      WHERE r.id = $1 AND cu.company_id = $2 AND u.status = 'enabled' AND (r.is_deleted = false OR r.is_deleted IS NULL)
    `;
    const resourceResult = await pool.query(resourceQuery, [resourceId, companyId]);  
    
    // Debug: Check what resource_ids exist in psa_resources table
    const debugQuery = `SELECT r.id, r.user_id, u.name FROM psa_resources r LEFT JOIN users u ON r.user_id = u.id WHERE r.is_deleted = false LIMIT 5`;
    const debugResult = await pool.query(debugQuery);
    
    if (resourceResult.rows.length === 0) {     
      
      // Try to find by user_id as fallback
      const fallbackQuery = `
        SELECT
          u.id AS user_id,
          u.name,
          u.email,
          u.role,
          u.status,
          u.avatar,
          u.created_at AS user_created_at,
   
          r.id AS resource_id,
          r.user_id,
          r.organization_id,
          r.department_id,
          r.manager_id,
          r.employee_id,
          r.title,
          r.level,
          r.employment_type,
          r.location,
          r.timezone,
          r.hours_per_week,
          r.start_time,
          r.end_time,
          r.working_days,
          r.hourly_rate,
          r.currency,
          r.cost_center,
          COALESCE(
            (SELECT SUM(
               CASE 
                 WHEN array_position(p.resource_user_ids, r.user_id) IS NOT NULL 
                 THEN COALESCE(p.resource_allocations[array_position(p.resource_user_ids, r.user_id)], 0)
                 ELSE 0 
               END
             )
             FROM psa_projects p
             WHERE r.user_id = ANY(p.resource_user_ids)
               AND p.is_active = true
               AND p.is_deleted = false
               AND p.company_id = $2
            ), 0
          ) AS availability,
          r.performance_rating,
          r.utilization_target,
          r.hire_date,
          r.is_active,
          r.is_deleted,
          r.created_at AS resource_created_at,
          r.updated_at AS resource_updated_at,
   
          cr.name AS department_name,
          cr.description AS department_description,
          o.name AS organization_name,
          o.type AS organization_type,
   
          m.title AS manager_title,
          mu.name AS manager_name,
          mu.email AS manager_email
        FROM users u
        INNER JOIN company_roles cu ON u.company_role = cu.id
        INNER JOIN company c ON cu.company_id = c.id
        LEFT JOIN psa_resources r ON u.id = r.user_id
        LEFT JOIN company_roles cr ON r.department_id = cr.id
        LEFT JOIN psa_organizations o ON r.organization_id = o.id
        LEFT JOIN psa_resources m ON r.manager_id = m.id
        LEFT JOIN users mu ON m.user_id = mu.id
        WHERE u.id = $1 AND cu.company_id = $2 AND u.status = 'enabled' AND (r.is_deleted = false OR r.is_deleted IS NULL)
      `;
      
      const fallbackResult = await pool.query(fallbackQuery, [resourceId, companyId]);
      
      if (fallbackResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Resource not found" });
      }
      
      const resource = fallbackResult.rows[0];      
      // Continue with skills and certifications using fallback result
      const skillsQuery = `
        SELECT
          s.id,
          s.name,
          s.category,
          s.description,
          rs.proficiency_level,
          rs.years_experience,
          rs.last_used
        FROM psa_skills s
        JOIN psa_resource_skills rs ON s.id = rs.skill_id
        WHERE rs.resource_id = $1 AND rs.is_deleted = false
      `;
      const skillsResult = await pool.query(skillsQuery, [resource.resource_id]);

      // Certifications
      const certsQuery = `
        SELECT
          c.id,
          c.name,
          c.issuing_organization,
          c.description,
          rc.date_obtained,
          rc.expiration_date,
          rc.status,
          rc.certificate_number,
          rc.verification_url
        FROM psa_certifications c
        JOIN psa_resource_certifications rc ON c.id = rc.certification_id
        WHERE rc.resource_id = $1 AND rc.is_deleted = false
      `;
      const certsResult = await pool.query(certsQuery, [resource.resource_id]);

      res.status(200).json({
        success: true,
        data: { ...resource, skills: skillsResult.rows, certifications: certsResult.rows },
      });
      return;
    }

    const resource = resourceResult.rows[0];

    // Skills
    const skillsQuery = `
      SELECT
        s.id,
        s.name,
        s.category,
        s.description,
        rs.proficiency_level,
        rs.years_experience,
        rs.last_used
      FROM psa_skills s
      JOIN psa_resource_skills rs ON s.id = rs.skill_id
      WHERE rs.resource_id = $1 AND rs.is_deleted = false
    `;
    const skillsResult = await pool.query(skillsQuery, [resource.resource_id]);

    // Certifications
    const certsQuery = `
      SELECT
        c.id,
        c.name,
        c.issuing_organization,
        c.description,
        rc.date_obtained,
        rc.expiration_date,
        rc.status,
        rc.certificate_number,
        rc.verification_url
      FROM psa_certifications c
      JOIN psa_resource_certifications rc ON c.id = rc.certification_id
      WHERE rc.resource_id = $1 AND rc.is_deleted = false
    `;
    const certsResult = await pool.query(certsQuery, [resource.resource_id]);

    res.status(200).json({
      success: true,
      data: { ...resource, skills: skillsResult.rows, certifications: certsResult.rows },
    });
  } catch (error) {
    console.error("Error fetching resource:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.updateResource = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { userId, companyId } = req.params;
    const {
      resourceId,
      employeeId,
      employmentType,
      level,
      hourlyRate,
      costCenter,
      workingDays,
      hoursPerWeek,
      availability,
      performanceRating = 0, // Default to 0 if not provided
      departmentId,
      location,
      skills = [],
      certifications = []
    } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        error: "MISSING_USER_ID"
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
        error: "MISSING_COMPANY_ID"
      });
    }

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: "Department is required",
        error: "MISSING_DEPARTMENT"
      });
    }

    if (!location || location.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Location is required",
        error: "MISSING_LOCATION"
      });
    }

    if (!hourlyRate || hourlyRate <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid hourly rate is required",
        error: "INVALID_HOURLY_RATE"
      });
    }


    // First, handle the main resource update/insert
    let actualResourceId = resourceId;

    if (!actualResourceId) {
      // Check if resource exists for this user
      const existingRes = await client.query(
        `SELECT id FROM psa_resources WHERE user_id = $1 AND is_deleted = false`,
        [userId]
      );

      if (existingRes.rows.length > 0) {
        actualResourceId = existingRes.rows[0].id;
        // Update existing resource
        await client.query(
          `UPDATE psa_resources SET
            employee_id=$2, employment_type=$3, level=$4, hourly_rate=$5,
            cost_center=$6, working_days=$7, hours_per_week=$8,
            performance_rating=$9, department_id=$10, location=$11,
            updated_at=now()
           WHERE id=$1`,
          [actualResourceId, employeeId, employmentType, level, hourlyRate, costCenter, workingDays, hoursPerWeek, performanceRating, departmentId, location]
        );
      } else {
        // Insert new resource
        const ins = await client.query(
          `INSERT INTO psa_resources (
            user_id, employee_id, employment_type, level, hourly_rate,
            cost_center, working_days, hours_per_week, performance_rating,
            department_id, location
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          RETURNING id`,
          [userId, employeeId, employmentType, level, hourlyRate, costCenter, workingDays, hoursPerWeek, performanceRating, departmentId, location]
        );
        actualResourceId = ins.rows[0].id;
      }
    } else {
      // Update existing resource with provided resourceId
      await client.query(
        `UPDATE psa_resources SET
          employee_id=$2, employment_type=$3, level=$4, hourly_rate=$5,
          cost_center=$6, working_days=$7, hours_per_week=$8,
          performance_rating=$9, department_id=$10, location=$11,
          updated_at=now()
         WHERE id=$1`,
        [actualResourceId, employeeId, employmentType, level, hourlyRate, costCenter, workingDays, hoursPerWeek, performanceRating, departmentId, location]
      );
    }

    // ✅ Skills flow - Clean up existing skills first, then add new ones
    // Delete all existing skills for this resource to prevent duplicates
    await client.query(
      `DELETE FROM psa_resource_skills WHERE resource_id = $1`,
      [actualResourceId]
    );

    // Add all skills from payload
    for (const skill of skills) {
      const skillId = skill.id;

      if (!skillId) {
        continue;
      }

      // Verify skill exists in database
      const skillCheck = await client.query(
        `SELECT id FROM psa_skills WHERE id = $1 AND is_deleted = false`,
        [skillId]
      );

      if (skillCheck.rows.length === 0) {
        continue;
      }
      
      const safeDate = (date) => date && date.trim() !== "" ? date : null;

      // Insert new skill
      await client.query(
        `INSERT INTO psa_resource_skills
         (resource_id, skill_id, proficiency_level, years_experience, last_used)
         VALUES ($1, $2, $3, $4, $5)`,
        [actualResourceId, skillId, skill.proficiency_level, skill.years_experience, safeDate(skill.last_used)]
      );
    }

    // ✅ Certifications flow - Clean up existing certifications first, then add new ones
    // Delete all existing certifications for this resource to prevent duplicates
    await client.query(
      `DELETE FROM psa_resource_certifications WHERE resource_id = $1`,
      [actualResourceId]
    );

    // Add all certifications from payload
    for (const cert of certifications) {
      const certId = cert.id;

      if (!certId) {
        continue;
      }

      // Verify certification exists in database
      const certCheck = await client.query(
        `SELECT id FROM psa_certifications WHERE id = $1 AND is_deleted = false`,
        [certId]
      );

      if (certCheck.rows.length === 0) {
        continue;
      }

      // Insert new certification
      await client.query(
        `INSERT INTO psa_resource_certifications
         (resource_id, certification_id, date_obtained, expiration_date, status, certificate_number, verification_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [actualResourceId, certId, 
         cert.date_obtained && cert.date_obtained.trim() !== "" ? cert.date_obtained : null, 
         cert.expiration_date && cert.expiration_date.trim() !== "" ? cert.expiration_date : null, 
         cert.status, cert.certificate_number, cert.verification_url]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, message: "Resource updated successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating resource:", error);

    // Handle specific database errors
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({
        success: false,
        message: "A resource with this information already exists",
        error: "DUPLICATE_RESOURCE"
      });
    } else if (error.code === '23503') { // Foreign key constraint violation
      res.status(400).json({
        success: false,
        message: "Invalid reference to related data",
        error: "INVALID_REFERENCE"
      });
    } else if (error.code === '23502') { // Not null constraint violation
      res.status(400).json({
        success: false,
        message: "Required field is missing",
        error: "MISSING_REQUIRED_FIELD"
      });
    } else if (error.code === '23514') { // Check constraint violation
      res.status(400).json({
        success: false,
        message: "Invalid value provided",
        error: "INVALID_VALUE"
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Internal server error occurred while updating resource",
        error: "INTERNAL_SERVER_ERROR"
      });
    }
  } finally {
    client.release();
  }
};

//organization_id
exports.getAllDepartments = async (req, res) => {
  try {
    const { organizationId } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    const query = `
      SELECT
        id,
        name,
        description,
        organization_id,
        is_active,
        created_at,
        updated_at
      FROM psa_departments
      WHERE organization_id = $1 AND is_deleted = false
      ORDER BY name ASC
    `;

    const result = await pool.query(query, [organizationId]);

    res.status(200).json({
      success: true,
      departments: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get all clients for a company
exports.getCompanyClients = async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const query = `
      SELECT
        id,
        name,
        email,
        phone,        
        created_at,
        updated_at
      FROM accounts
      WHERE tenant_id = $1
      ORDER BY name ASC
    `;

    const result = await pool.query(query, [companyId]);

    res.status(200).json({
      success: true,
      clients: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching company clients:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ========================================================
// BACKLOG ITEMS MANAGEMENT APIs
// ========================================================

// Get all backlog items for a project
exports.getProjectBacklogItems = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type, status, assignee_id } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    let query = `
      SELECT 
        bi.id,
        bi.project_id,
        bi.parent_id,
        bi.title,
        bi.description,
        bi.type,
        bi.hierarchy_level,
        bi.status,
        bi.priority,
        bi.story_points,
        bi.estimated_hours,
        bi.actual_hours,
        bi.sprint_id,
        bi.acceptance_criteria,
        bi.definition_of_done,
        bi.tags,
        bi.business_value,
        bi.success_metrics,
        bi.user_persona,
        bi.required_skills,
        bi.assignee_id,
        bi.created_by,
        bi.is_deleted,
        bi.created_at,
        bi.updated_at
        
      FROM psa_backlog_items bi
      WHERE bi.project_id = $1 AND bi.is_deleted = false
    `;

    const queryParams = [projectId];
    let paramCount = 1;

    // Add filters
    if (type) {
      paramCount++;
      query += ` AND bi.type = $${paramCount}`;
      queryParams.push(type);
    }

    if (status) {
      paramCount++;
      query += ` AND bi.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (assignee_id) {
      paramCount++;
      query += ` AND bi.assignee_id = $${paramCount}`;
      queryParams.push(assignee_id);
    }

    query += ` ORDER BY bi.hierarchy_level ASC, bi.created_at DESC`;

    const result = await pool.query(query, queryParams);

    // Get project's assigned resources
    const projectQuery = `
      SELECT 
        p.resource_user_ids,
        p.resource_roles,
        p.resource_allocations
      FROM psa_projects p
      WHERE p.id = $1
    `;
    const projectResult = await pool.query(projectQuery, [projectId]);

    let assignedResources = [];
    if (projectResult.rows.length > 0 && projectResult.rows[0].resource_user_ids) {
      const userIds = projectResult.rows[0].resource_user_ids;
      const roles = projectResult.rows[0].resource_roles || [];
      const allocations = projectResult.rows[0].resource_allocations || [];

      // Get user details for assigned resources
      const usersQuery = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.role,
          u.avatar
        FROM users u
        WHERE u.id = ANY($1)
        ORDER BY u.name ASC
      `;
      const usersResult = await pool.query(usersQuery, [userIds]);

      assignedResources = usersResult.rows.map((user, index) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        project_role: roles[index] || 'member',
        allocation: allocations[index] || 0
      }));
    }

    // Get all unique assignee IDs from backlog items
    const assigneeIds = [...new Set(result.rows.map(item => item.assignee_id).filter(id => id))];
    
    // Fetch assignee details for all assigned users
    let assigneeDetails = {};
    if (assigneeIds.length > 0) {
      const assigneeQuery = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.avatar,
          u.role
        FROM users u
        WHERE u.id = ANY($1)
      `;
      const assigneeResult = await pool.query(assigneeQuery, [assigneeIds]);
      
      // Create a map of assignee details
      assigneeResult.rows.forEach(assignee => {
        assigneeDetails[assignee.id] = {
          id: assignee.id,
          name: assignee.name,
          email: assignee.email,
          avatar: assignee.avatar,
          role: assignee.role
        };
      });
    }

    // Process acceptance_criteria to ensure proper JSON format and add assignee details
    const processedRows = result.rows.map(item => {
      let processedItem = { ...item };
      
      // Add assignee details if assignee_id exists
      if (item.assignee_id && assigneeDetails[item.assignee_id]) {
        processedItem.assignee_details = assigneeDetails[item.assignee_id];
      } else {
        processedItem.assignee_details = null;
      }
      
      // Fix acceptance_criteria if it's malformed JSON
      if (item.acceptance_criteria && typeof item.acceptance_criteria === 'string') {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(item.acceptance_criteria);
          processedItem.acceptance_criteria = parsed;
        } catch (parseError) {
          // If parsing fails, check if it's malformed array format
          const trimmed = item.acceptance_criteria.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            // It's malformed - missing array brackets
            try {
              // Try to fix by adding array brackets
              const fixed = '[' + trimmed.slice(1, -1) + ']';
              const parsed = JSON.parse(fixed);
              processedItem.acceptance_criteria = parsed;
            } catch (fixError) {
              processedItem.acceptance_criteria = [];
            }
          } else {
            processedItem.acceptance_criteria = [];
          }
        }
      }
      
      return processedItem;
    });

    res.status(200).json({
      success: true,
      data: {
        all: processedRows,
        epics: processedRows.filter(item => item.type === 'epic'),
        features: processedRows.filter(item => item.type === 'feature'),
        stories: processedRows.filter(item => item.type === 'story'),
        total: processedRows.length,
        assignedResources
      }
    });
  } catch (error) {
    console.error("Error fetching project backlog items:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get specific backlog item by ID
exports.getBacklogItemById = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    const query = `
      SELECT 
        bi.id,
        bi.project_id,
        bi.parent_id,
        bi.title,
        bi.description,
        bi.type,
        bi.hierarchy_level,
        bi.status,
        bi.priority,
        bi.story_points,
        bi.estimated_hours,
        bi.actual_hours,
        bi.sprint_id,
        bi.acceptance_criteria,
        bi.definition_of_done,
        bi.tags,
        bi.business_value,
        bi.success_metrics,
        bi.user_persona,
        bi.required_skills,
        bi.assignee_id,
        bi.created_by,
        bi.is_deleted,
        bi.created_at,
        bi.updated_at
        
      FROM psa_backlog_items bi
      WHERE bi.id = $1 AND bi.is_deleted = false
    `;

    const result = await pool.query(query, [itemId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Backlog item not found",
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error fetching backlog item:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Helper function: Bottom-up status check (Story → Feature → Epic)
// Helper function: Check if parent should be moved to backlog based on child status
const checkParentForBacklog = async (itemId) => {
  try {
    const item = await pool.query('SELECT * FROM psa_backlog_items WHERE id = $1', [itemId]);
    if (item.rows.length === 0) return;
    
    const currentItem = item.rows[0];
    
    if (currentItem.parent_id) {
      const parent = await pool.query('SELECT * FROM psa_backlog_items WHERE id = $1', [currentItem.parent_id]);
      if (parent.rows.length === 0) return;
      
      const parentItem = parent.rows[0];
      
      // Get all siblings
      const siblings = await pool.query(
        'SELECT * FROM psa_backlog_items WHERE parent_id = $1 AND is_deleted = false',
        [currentItem.parent_id]
      );
      
      // Check if any child is in backlog
      const hasBacklogChild = siblings.rows.some(sibling => sibling.status === 'backlog');
      
      if (hasBacklogChild && parentItem.status !== 'backlog') {        
        // Update parent to backlog
        await pool.query(
          'UPDATE psa_backlog_items SET status = $1, is_complete = $2 WHERE id = $3',
          ['backlog', false, currentItem.parent_id]
        );
        
        // Recursively check grandparent
        await checkParentForBacklog(currentItem.parent_id);
      } }
  } catch (error) {
    console.error('Error in checkParentForBacklog:', error);
  }
};

const checkParentStatus = async (itemId) => {
  try {
    const item = await pool.query('SELECT * FROM psa_backlog_items WHERE id = $1', [itemId]);
    if (item.rows.length === 0) return;
    
    const currentItem = item.rows[0];
    
    if (currentItem.parent_id) {
      const parent = await pool.query('SELECT * FROM psa_backlog_items WHERE id = $1', [currentItem.parent_id]);
      if (parent.rows.length === 0) return;
      
      const parentItem = parent.rows[0];
      
      // Get all siblings
      const siblings = await pool.query(
        'SELECT * FROM psa_backlog_items WHERE parent_id = $1 AND is_deleted = false',
        [currentItem.parent_id]
      );
      
      // For Epics: Use "alone feature" status (feature that makes Epic alone)
      if (parentItem.type === 'epic') {        
        
        // Get all features
        const features = siblings.rows.filter(sibling => sibling.type === 'feature');
        
        // Group features by status
        const statusGroups = {};
        features.forEach(feature => {
          if (!statusGroups[feature.status]) {
            statusGroups[feature.status] = [];
          }
          statusGroups[feature.status].push(feature);
        });       
    
        
        // Find the "alone" feature (only one feature in its status group)
        const aloneFeature = Object.values(statusGroups).find(group => group.length === 1)?.[0];
        
        if (aloneFeature) {          
          // Check if ALL features have the same status (including single feature case)
          if (features.length >= 1 && features.every(f => f.status === aloneFeature.status)) {            
            // Only update epic if it's different from current status
            if (parentItem.status !== aloneFeature.status) {
              await pool.query(
                'UPDATE psa_backlog_items SET status = $1, is_complete = $2 WHERE id = $3',
                [aloneFeature.status, aloneFeature.status === 'done', currentItem.parent_id]
              );      
            
              // If Epic is completed, update PI business value realization
              if (aloneFeature.status === 'done') {
                await updatePIBusinessValueRealization(parentItem.id);
              }
              
              // Recursively check grandparent
              await checkParentStatus(currentItem.parent_id);
            }
          } 
        } else {
          // Only update epic status if ALL features have the same status
          if (features.length > 0 && features.every(f => f.status === features[0].status)) {
            const commonStatus = features[0].status;
          
            
            // Only update epic if it's different from current status
            if (parentItem.status !== commonStatus) {
              await pool.query(
                'UPDATE psa_backlog_items SET status = $1, is_complete = $2 WHERE id = $3',
                [commonStatus, commonStatus === 'done', currentItem.parent_id]
              );             
            
              
              // Update PI business value realization only when epic is completed
              if (commonStatus === 'done') {
                await updatePIBusinessValueRealization(parentItem.id);
              }
              
              await checkParentStatus(currentItem.parent_id);
            } 
          } }
      } else {
        // For Features: Check if all siblings have same status (existing logic)
        const allSameStatus = siblings.rows.every(sibling => sibling.status === currentItem.status);
        
        if (allSameStatus) {
          // Update parent status
          await pool.query(
            'UPDATE psa_backlog_items SET status = $1, is_complete = $2 WHERE id = $3',
            [currentItem.status, currentItem.status === 'done', currentItem.parent_id]
          );
          
          // If Epic is completed, update PI business value realization
          if (currentItem.status === 'done' && parentItem.type === 'epic') {
            await updatePIBusinessValueRealization(parentItem.id);
          }
          
          // Recursively check grandparent
          await checkParentStatus(currentItem.parent_id);
        }
      }
    }
  } catch (error) {
    console.error('Error in checkParentStatus:', error);
  }
};

// Helper function: Update PI business value realization when Epic completes
const updatePIBusinessValueRealization = async (epicId) => {
  try {
    // Get Epic business value
    const epic = await pool.query(
      'SELECT business_value, project_id FROM psa_backlog_items WHERE id = $1',
      [epicId]
    );
    
    if (epic.rows.length === 0) return;
    
    const epicBusinessValue = epic.rows[0].business_value || 0;
    const projectId = epic.rows[0].project_id;
    
    // Find PI for this project
    const pi = await pool.query(
      'SELECT id FROM psa_program_increments WHERE project_id = $1 AND is_deleted = false ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    
    if (pi.rows.length > 0) {
      const piId = pi.rows[0].id;
      
      // Note: Business value tracking will be added when the database schema is updated
      // TODO: Add realized_business_value and business_value_completion_percentage columns to psa_program_increments table
    }
  } catch (error) {
    console.error('Error in updatePIBusinessValueRealization:', error);
  }
};

// Helper function: Top-down status cascade (Epic → Feature → Story)
const cascadeChildStatus = async (itemId, newStatus) => {
  try {
    const children = await pool.query(
      'SELECT * FROM psa_backlog_items WHERE parent_id = $1 AND is_deleted = false',
      [itemId]
    );
    
    for (const child of children.rows) {
      // Update child status
      await pool.query(
        'UPDATE psa_backlog_items SET status = $1, is_complete = $2 WHERE id = $3',
        [newStatus, newStatus === 'done', child.id]
      );
      
      // Recursively update grandchildren
      await cascadeChildStatus(child.id, newStatus);
    }
  } catch (error) {
    console.error('Error in cascadeChildStatus:', error);
  }
};

// Update backlog item
// Update backlog item status (for drag-drop functionality)
exports.updateBacklogItemStatus = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status } = req.body;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Validate status values
    const validStatuses = ['backlog', 'in_progress', 'review', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(', '),
      });
    }

    const query = `
      UPDATE psa_backlog_items 
      SET status = $1, is_complete = $2, updated_at = NOW()
      WHERE id = $3 AND is_deleted = false
      RETURNING *
    `;

    const result = await pool.query(query, [status, status === 'done', itemId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Backlog item not found or already deleted",
      });
    }

    // Bottom-up: Check parent status
    await checkParentStatus(itemId);
    
    // Special case: If item is moved to backlog, check if parent should also go to backlog
    if (status === 'backlog') {
      await checkParentForBacklog(itemId);
    }
    
    // Top-down: Cascade to children
    await cascadeChildStatus(itemId, status);

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating backlog item status:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get PSA Dashboard Data
exports.getPSADashboard = async (req, res) => {
  try {
    const { companyId } = req.query;
    const { id: userId } = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // 1. Get Total Resources (all users in the company)
    const totalResourcesQuery = `
      SELECT COUNT(*) as total_resources
      FROM users u
      INNER JOIN company_roles cr ON u.company_role = cr.id
      WHERE cr.company_id = $1 AND u.status = 'enabled'
    `;
    const totalResourcesResult = await pool.query(totalResourcesQuery, [companyId]);
    const totalResources = parseInt(totalResourcesResult.rows[0].total_resources);
    // 2. Get Assigned Resources (users assigned to active projects)
    const assignedResourcesQuery = `
      SELECT COUNT(DISTINCT u.id) as assigned_resources
      FROM users u
      INNER JOIN company_roles cr ON u.company_role = cr.id
      INNER JOIN psa_projects p ON u.id = ANY(p.resource_user_ids)
      WHERE cr.company_id = $1 
        AND p.is_active = true
        AND u.status = 'enabled'
    `;
    const assignedResourcesResult = await pool.query(assignedResourcesQuery, [companyId]);
    const assignedResources = parseInt(assignedResourcesResult.rows[0].assigned_resources);

    // 3. Calculate Bench Percentage
    const benchPercentage = totalResources > 0 ?
      Math.round(((totalResources - assignedResources) / totalResources) * 100) : 0;

    // 4. Get Active Projects
    const activeProjectsQuery = `
      SELECT COUNT(*) as active_projects
      FROM psa_projects
      WHERE company_id = $1 AND is_active = true
    `;
    const activeProjectsResult = await pool.query(activeProjectsQuery, [companyId]);
    const activeProjects = parseInt(activeProjectsResult.rows[0].active_projects);

    // 5. Get Unstaffed Projects (projects with no assigned resources)
    const unstaffedProjectsQuery = `
      SELECT COUNT(*) as unstaffed_projects
      FROM psa_projects
      WHERE company_id = $1 
        AND is_active = true 
        AND is_deleted = false
        AND (resource_user_ids IS NULL 
        OR array_length(resource_user_ids, 1) IS NULL
        OR array_length(resource_user_ids, 1) = 0)
    `;
    const unstaffedProjectsResult = await pool.query(unstaffedProjectsQuery, [companyId]);
    const unstaffedProjects = parseInt(unstaffedProjectsResult.rows[0].unstaffed_projects);

    // 6. Get Expiring Certifications (within next 30 days) - Count unique user-certification combinations
    const expiringCertificationsQuery = `
      SELECT COUNT(DISTINCT CONCAT(u.id, '-', rc.certification_id)) as expiring_certifications
      FROM psa_resource_certifications rc
      INNER JOIN psa_resources r ON rc.resource_id = r.id
      INNER JOIN users u ON r.user_id = u.id
      INNER JOIN company_roles cr ON u.company_role = cr.id
      WHERE cr.company_id = $1 
        AND rc.is_deleted = false
        AND rc.expiration_date IS NOT NULL
        AND rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
        AND rc.expiration_date > CURRENT_DATE
    `;
    const expiringCertificationsResult = await pool.query(expiringCertificationsQuery, [companyId]);
    const expiringCertifications = parseInt(expiringCertificationsResult.rows[0].expiring_certifications);

    // 7. Get Project Health Data
    const projectHealthQuery = `
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN health = 'green' THEN 1 END) as healthy_projects,
        COUNT(CASE WHEN health = 'yellow' THEN 1 END) as at_risk_projects,
        COUNT(CASE WHEN health = 'red' THEN 1 END) as critical_projects
      FROM psa_projects
      WHERE company_id = $1 AND is_active = true
    `;
    const projectHealthResult = await pool.query(projectHealthQuery, [companyId]);
    const healthData = projectHealthResult.rows[0];

    // Calculate overall health score
    const totalProjects = parseInt(healthData.total_projects);
    const healthyProjects = parseInt(healthData.healthy_projects);
    const atRiskProjects = parseInt(healthData.at_risk_projects);
    const criticalProjects = parseInt(healthData.critical_projects);

    const overallHealthScore = totalProjects > 0 ?
      Math.round(((healthyProjects * 100) + (atRiskProjects * 50) + (criticalProjects * 0)) / totalProjects) : 0;

    // 8. Get Utilization Data (based on user assignment)
    const assignedUtilization = totalResources > 0 ? 
      Math.round((assignedResources / totalResources) * 100) : 0;
    const currentBench = 100 - assignedUtilization;


    // 9. Get Recent Activity
    const recentActivityQuery = `
      (
        SELECT 
          'project_staffing' as type,
          'New project "' || p.name || '" requires staffing' as message,
          p.created_at as activity_date,
          'blue' as color
        FROM psa_projects p
        WHERE p.company_id = $1 
          AND p.is_active = true 
          AND (p.resource_user_ids IS NULL OR array_length(p.resource_user_ids, 1) = 0)
          AND p.created_at >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY p.created_at DESC
        LIMIT 3
      )
      UNION ALL
      (
        SELECT 
          'certification_expiry' as type,
          u.name || '''s ' || c.name || ' certification expires in ' || 
          (rc.expiration_date - CURRENT_DATE) || ' days' as message, 
          rc.expiration_date as activity_date,
          'yellow' as color
        FROM psa_resource_certifications rc
        INNER JOIN psa_resources r ON rc.resource_id = r.id
        INNER JOIN psa_certifications c ON rc.certification_id = c.id
        INNER JOIN users u ON r.user_id = u.id
        INNER JOIN company_roles cr ON u.company_role = cr.id
        WHERE cr.company_id = $1 
          AND rc.is_deleted = false
          AND rc.expiration_date IS NOT NULL
          AND rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
          AND rc.expiration_date > CURRENT_DATE
        ORDER BY rc.expiration_date ASC
        LIMIT 3
      )
      UNION ALL
      (
        SELECT 
          'resource_assignment' as type,
          u.name || ' assigned to ' || p.name as message,
          p.updated_at as activity_date,
          'green' as color
        FROM psa_projects p
        INNER JOIN users u ON u.id = ANY(p.resource_user_ids)
        INNER JOIN company_roles cr ON u.company_role = cr.id
        WHERE cr.company_id = $1 
          AND p.is_active = true
          AND p.updated_at >= CURRENT_DATE - INTERVAL '7 days'
          AND u.status = 'enabled'
        ORDER BY p.updated_at DESC
        LIMIT 3
      )
      ORDER BY activity_date DESC
      LIMIT 10
    `;
    const recentActivityResult = await pool.query(recentActivityQuery, [companyId]);
    const recentActivity = recentActivityResult.rows.map(activity => ({
      type: activity.type,
      message: activity.message,
      timeAgo: getTimeAgo(activity.activity_date),
      color: activity.color
    }));

    // 10. Get Utilization Trend Data (last 6 months with actual historical data)
    const currentDate = new Date();
    const utilizationTrend = [];
    
    // Generate last 6 months with proper dates
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      // Query for users assigned to projects during this month
      const monthUtilizationQuery = `
        SELECT 
          COUNT(DISTINCT u.id) as assigned_count,
          (SELECT COUNT(*) 
           FROM users u2
           INNER JOIN company_roles cr2 ON u2.company_role = cr2.id
           WHERE cr2.company_id = $1 AND u2.status = 'enabled'
          ) as total_count
        FROM users u
        INNER JOIN company_roles cr ON u.company_role = cr.id
        INNER JOIN psa_projects p ON u.id = ANY(p.resource_user_ids)
        WHERE cr.company_id = $1 
          AND p.is_active = true
          AND u.status = 'enabled'
          AND (
            (p.created_at <= $3 AND (p.end_date IS NULL OR p.end_date >= $2))
            OR (p.updated_at >= $2 AND p.updated_at <= $3)
          )
      `;
      
      const monthResult = await pool.query(monthUtilizationQuery, [companyId, monthStart, monthEnd]);
      const assignedCount = parseInt(monthResult.rows[0].assigned_count);
      const totalCount = parseInt(monthResult.rows[0].total_count);
      const utilization = totalCount > 0 ? Math.round((assignedCount / totalCount) * 100) : 0;
      const bench = 100 - utilization;
      
      utilizationTrend.push({
        date: monthStart.toISOString(),
        utilization: utilization,
        bench: bench
      });
    }

    // Compile dashboard data
    const dashboardData = {
      keyMetrics: {
        totalResources: {
          value: totalResources,
          change: 8.2, // This would be calculated based on historical data
          trend: 'up'
        },
        assignedResources: {
          value: assignedResources,
          trend: 'stable'
        },
        benchPercentage: {
          value: benchPercentage,
          change: -5.3, // This would be calculated based on historical data
          trend: 'down'
        },
        activeProjects: {
          value: activeProjects,
          trend: 'stable'
        },
        unstaffedProjects: {
          value: unstaffedProjects,
          trend: 'up'
        },
        expiringCertifications: {
          value: expiringCertifications,
          trend: 'up'
        }
      },
      projectHealth: {
        healthy: healthyProjects,
        atRisk: atRiskProjects,
        critical: criticalProjects,
        overallScore: overallHealthScore
      },
      utilization: {
        current: assignedUtilization,
        bench: currentBench,
        trend: utilizationTrend
      },
      recentActivity: recentActivity
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error("Error fetching PSA dashboard data:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const activityDate = new Date(date);
  const diffInHours = Math.floor((now - activityDate) / (1000 * 60 * 60));

  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours} hours ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} days ago`;

  const diffInWeeks = Math.floor(diffInDays / 7);
  return `${diffInWeeks} weeks ago`;
}

// Get detailed lists for dashboard metrics
exports.getDashboardMetricDetails = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { metricType } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    if (!metricType) {
      return res.status(400).json({
        success: false,
        message: "Metric type is required",
      });
    }

    let data = [];

    switch (metricType) {
      case 'total-resources':
        // Get all resources with their details
        const allResourcesQuery = `
          SELECT 
            u.id,
            r.id as resource_id,
            u.name,
            u.email,
            u.avatar,
            COALESCE(
              (SELECT GREATEST(0,SUM(
                CASE 
                  WHEN array_position(p.resource_user_ids, u.id) IS NOT NULL 
                  THEN COALESCE(p.resource_allocations[array_position(p.resource_user_ids, u.id)], 0)
                  ELSE 0 
                END
              ))
              FROM psa_projects p
              WHERE u.id = ANY(p.resource_user_ids)
                AND p.is_active = true
                AND p.is_deleted = false
                AND p.company_id = $1
              ), 100
            ) AS availability,
            r.hourly_rate,
            r.performance_rating,
            cr2.name as department_name,
            r.location
          FROM users u
          INNER JOIN company_roles cr ON u.company_role = cr.id
          LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
          LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
          WHERE cr.company_id = $1 AND u.status = 'enabled'
          ORDER BY u.name ASC
        `;
        const allResourcesResult = await pool.query(allResourcesQuery, [companyId]);
        data = allResourcesResult.rows.map(resource => ({
          type: 'resource',
          id: resource.id,
          resource_id: resource.resource_id, // Use actual resource_id from query
          name: resource.name,
          email: resource.email,
          avatar: resource.avatar,
          department: resource.department_name || 'Unknown',
          location: resource.location || 'Not specified',
          availability: resource.availability || 0,
          hourlyRate: resource.hourly_rate || 0,
          performanceRating: resource.performance_rating || 0
        }));
        break;

      case 'assigned-resources':
        // Get assigned resources with their project details
        const assignedResourcesQuery = `
          SELECT 
            u.id,
            r.id,
            u.name,
            u.email,
            u.avatar,
            COALESCE(
              (SELECT GREATEST(0, 100 - SUM(
                 CASE 
                   WHEN array_position(p2.resource_user_ids, u.id) IS NOT NULL 
                   THEN COALESCE(p2.resource_allocations[array_position(p2.resource_user_ids, u.id)], 0)
                   ELSE 0 
                 END
               ))
               FROM psa_projects p2
               WHERE u.id = ANY(p2.resource_user_ids)
                 AND p2.is_active = true
                 AND p2.is_deleted = false
                 AND p2.company_id = $1
              ), 100
            ) AS availability,
            r.hourly_rate,
            r.performance_rating,
            cr2.name as department_name,
            r.location,
            -- Collect all projects for this user
            COALESCE(
              (SELECT array_agg(
                json_build_object(
                  'id', p.id,
                  'name', p.name,
                  'role', 
                  CASE 
                    WHEN p.resource_roles IS NOT NULL AND array_length(p.resource_roles, 1) > 0 THEN
                      p.resource_roles[array_position(p.resource_user_ids, u.id)]
                    ELSE 'member'
                  END
                )
              )
              FROM psa_projects p
              WHERE u.id = ANY(p.resource_user_ids)
                AND p.is_active = true
                AND p.is_deleted = false
                AND p.company_id = $1
              ), '{}'
            ) as assigned_projects
          FROM users u
          INNER JOIN company_roles cr ON u.company_role = cr.id
          LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
          LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
          WHERE cr.company_id = $1 
            AND u.status = 'enabled'
            AND EXISTS (
              SELECT 1 FROM psa_projects p 
              WHERE u.id = ANY(p.resource_user_ids)
                AND p.is_active = true
                AND p.is_deleted = false
                AND p.company_id = $1
            )
          ORDER BY u.name ASC
        `;
        const assignedResourcesResult = await pool.query(assignedResourcesQuery, [companyId]);
        data = assignedResourcesResult.rows.map(resource => {
          return {
            type: 'resource',
            id: resource.id,
            resource_id: resource.id,
            name: resource.name,
            email: resource.email,
            avatar: resource.avatar,
            department: resource.department_name || 'Unknown',
            location: resource.location || 'Not specified',
            availability: resource.availability || 0,
            hourlyRate: resource.hourly_rate || 0,
            performanceRating: resource.performance_rating || 0,
            assignedProjects: resource.assigned_projects || []
          };
        });
        break;

      case 'bench-percentage':
        // Get bench resources (not assigned to any active project)
        const benchResourcesQuery = `
          SELECT 
            u.id,
            u.name,
            u.email,
            u.avatar,
            0 AS availability,
            r.hourly_rate,
            r.performance_rating,
            cr2.name as department_name,
            r.location
          FROM users u
          INNER JOIN company_roles cr ON u.company_role = cr.id
          LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
          LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
          WHERE cr.company_id = $1 
            AND u.status = 'enabled'
            AND NOT EXISTS (
              SELECT 1
              FROM psa_projects p
              WHERE u.id = ANY(p.resource_user_ids)
                AND p.company_id = $1
                AND p.is_active = true
                AND p.is_deleted = false
            )
          ORDER BY u.name ASC
        `;
        const benchResourcesResult = await pool.query(benchResourcesQuery, [companyId]);
        data = benchResourcesResult.rows.map(resource => ({
          type: 'resource',
          id: resource.id,
          name: resource.name,
          email: resource.email,
          avatar: resource.avatar,
          department: resource.department_name || 'Unknown',
          location: resource.location || 'Not specified',
          availability: resource.availability || 0,
          hourlyRate: resource.hourly_rate || 0,
          performanceRating: resource.performance_rating || 0
        }));
        break;

      case 'active-projects':
        // Get active projects with their details
        const activeProjectsQuery = `
          SELECT 
            p.id,
            p.name,
            p.description,
            p.methodology,
            p.health,
            p.start_date,
            p.end_date,
            p.budget_hours,
            p.actual_hours,
            COUNT(DISTINCT u.id) as resource_count
          FROM psa_projects p
          LEFT JOIN users u ON u.id = ANY(p.resource_user_ids)
          LEFT JOIN company_roles cr ON u.company_role = cr.id
          WHERE p.company_id = $1 
            AND p.is_active = true
            AND p.is_deleted = false
            AND (u.status = 'enabled' OR u.id IS NULL)
          GROUP BY p.id, p.name, p.description, p.methodology, p.health, p.start_date, p.end_date, p.budget_hours, p.actual_hours
          ORDER BY p.created_at DESC
        `;
        const activeProjectsResult = await pool.query(activeProjectsQuery, [companyId]);
        data = activeProjectsResult.rows.map(project => {
          const progress = project.budget_hours > 0 ? 
            Math.round((project.actual_hours / project.budget_hours) * 100) : 0;
          
          return {
            type: 'project',
            id: project.id,
            name: project.name,
            description: project.description,
            methodology: project.methodology,
            health: project.health || 'green',
            startDate: project.start_date,
            endDate: project.end_date,
            progress: Math.min(progress, 100),
            resourceCount: parseInt(project.resource_count)
          };
        });
        break;

      case 'unstaffed-projects':
        // Get unstaffed projects
        const unstaffedProjectsQuery = `
          SELECT 
            p.id,
            p.name,
            p.description,
            p.methodology,
            p.health,
            p.start_date,
            p.end_date,
            p.budget_hours,
            p.actual_hours
          FROM psa_projects p
          WHERE p.company_id = $1 
            AND p.is_active = true 
            AND p.is_deleted = false
            AND (p.resource_user_ids IS NULL 
            OR array_length(p.resource_user_ids, 1) IS NULL
            OR array_length(p.resource_user_ids, 1) = 0)
          ORDER BY p.created_at DESC
        `;
        const unstaffedProjectsResult = await pool.query(unstaffedProjectsQuery, [companyId]);
        data = unstaffedProjectsResult.rows.map(project => {
          const progress = project.budget_hours > 0 ? 
            Math.round((project.actual_hours / project.budget_hours) * 100) : 0;
          
          return {
            type: 'project',
            id: project.id,
            name: project.name,
            description: project.description,
            methodology: project.methodology,
            health: project.health || 'red',
            startDate: project.start_date,
            endDate: project.end_date,
            progress: Math.min(progress, 100),
            resourceCount: 0
          };
        });
        break;

      case 'expiring-certifications':
        // Get expiring certifications
          const expiringCertificationsQuery = `
            SELECT DISTINCT ON (u.id, c.id)
              rc.id,
              c.name as certification_name,
              u.name as resource_name,
              u.email as resource_email,
              c.issuing_organization,
              rc.expiration_date,
              cr2.name as department_name
            FROM psa_resource_certifications rc
            INNER JOIN psa_resources r ON rc.resource_id = r.id
            INNER JOIN psa_certifications c ON rc.certification_id = c.id
            INNER JOIN users u ON r.user_id = u.id
            INNER JOIN company_roles cr ON u.company_role = cr.id
            LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
            WHERE cr.company_id = $1 
              AND rc.is_deleted = false
              AND rc.expiration_date IS NOT NULL
              AND rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
              AND rc.expiration_date > CURRENT_DATE
              AND u.status = 'enabled'
            ORDER BY u.id, c.id, rc.expiration_date ASC
          `;
        const expiringCertificationsResult = await pool.query(expiringCertificationsQuery, [companyId]);
        data = expiringCertificationsResult.rows.map(cert => ({
          type: 'certification',
          id: cert.id,
          certificationName: cert.certification_name,
          resourceName: cert.resource_name,
          resourceEmail: cert.resource_email,
          issuingOrg: cert.issuing_organization,
          expirationDate: cert.expiration_date,
          department: cert.department_name || 'Unknown'
        }));
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid metric type",
        });
    }

    res.status(200).json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error("Error fetching dashboard metric details:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching metric details",
      error: error.message
    });
  }
};

exports.updateBacklogItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const {
      title,
      description,
      status,
      priority,
      story_points,
      estimated_hours,
      actual_hours,
      assignee_id,
      sprint_id,
      acceptance_criteria,
      definition_of_done,
      tags,
      business_value,
      success_metrics,
      user_persona,
      required_skills
    } = req.body;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    if (title !== undefined) {
      paramCount++;
      updateFields.push(`title = $${paramCount}`);
      updateValues.push(title);
    }

    if (description !== undefined) {
      paramCount++;
      updateFields.push(`description = $${paramCount}`);
      updateValues.push(description);
    }

    if (status !== undefined) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
    }

    if (priority !== undefined) {
      paramCount++;
      updateFields.push(`priority = $${paramCount}`);
      updateValues.push(priority);
    }

    if (story_points !== undefined) {
      paramCount++;
      updateFields.push(`story_points = $${paramCount}`);
      updateValues.push(parseInt(story_points) || 0);
    }

    if (estimated_hours !== undefined) {
      paramCount++;
      updateFields.push(`estimated_hours = $${paramCount}`);
      updateValues.push(estimated_hours ? parseFloat(estimated_hours) : null);
    }

    if (actual_hours !== undefined) {
      paramCount++;
      updateFields.push(`actual_hours = $${paramCount}`);
      updateValues.push(actual_hours ? parseFloat(actual_hours) : null);
    }

    if (assignee_id !== undefined) {
      paramCount++;
      updateFields.push(`assignee_id = $${paramCount}`);
      updateValues.push(assignee_id ? parseInt(assignee_id) : null);
    }

    if (sprint_id !== undefined) {
      paramCount++;
      updateFields.push(`sprint_id = $${paramCount}`);
      updateValues.push(sprint_id);
    }

    if (acceptance_criteria !== undefined) {
      paramCount++;
      updateFields.push(`acceptance_criteria = $${paramCount}`);
      updateValues.push(Array.isArray(acceptance_criteria) ? acceptance_criteria : []);
    }

    if (definition_of_done !== undefined) {
      paramCount++;
      updateFields.push(`definition_of_done = $${paramCount}`);
      updateValues.push(Array.isArray(definition_of_done) ? definition_of_done : []);
    }

    if (tags !== undefined) {
      paramCount++;
      updateFields.push(`tags = $${paramCount}`);
      updateValues.push(Array.isArray(tags) ? tags : []);
    }

    if (business_value !== undefined) {
      // Validate business value for Epic
      if (business_value <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Business value must be greater than 0'
        });
      }
      
      paramCount++;
      updateFields.push(`business_value = $${paramCount}`);
      updateValues.push(business_value);
    }

    if (success_metrics !== undefined) {
      paramCount++;
      updateFields.push(`success_metrics = $${paramCount}`);
      updateValues.push(success_metrics);
    }

    if (user_persona !== undefined) {
      paramCount++;
      updateFields.push(`user_persona = $${paramCount}`);
      updateValues.push(user_persona);
    }

    if (required_skills !== undefined) {
      paramCount++;
      updateFields.push(`required_skills = $${paramCount}`);
      updateValues.push(Array.isArray(required_skills) ? required_skills : []);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    // Add updated_at (no parameter needed) and itemId
    updateFields.push(`updated_at = NOW()`);
    paramCount++;
    updateValues.push(itemId);

    const query = `
      UPDATE psa_backlog_items 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND is_deleted = false
      RETURNING *
    `;

    const result = await pool.query(query, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Backlog item not found or already deleted",
      });
    }

    res.status(200).json({
      success: true,
      message: "Backlog item updated successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating backlog item:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Delete backlog item (soft delete)
exports.deleteBacklogItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    // First, check if the item exists and get its type
    const checkQuery = `
      SELECT id, type, title, parent_id
      FROM psa_backlog_items 
      WHERE id = $1 AND is_deleted = false
    `;
    
    const checkResult = await pool.query(checkQuery, [itemId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Backlog item not found or already deleted",
      });
    }

    const item = checkResult.rows[0];

    // If it's an epic, also soft delete all its children (features and stories)
    // If it's a feature, also soft delete all its children (stories)
    let deleteQuery;
    let deleteParams;

    if (item.type === 'epic') {
      // Delete epic and all its children
      deleteQuery = `
        UPDATE psa_backlog_items 
        SET is_deleted = true, updated_at = NOW()
        WHERE (id = $1 OR parent_id = $1 OR parent_id IN (
          SELECT id FROM psa_backlog_items WHERE parent_id = $1
        ))
        RETURNING id, type, title
      `;
      deleteParams = [itemId];
    } else if (item.type === 'feature') {
      // Delete feature and all its children (stories)
      deleteQuery = `
        UPDATE psa_backlog_items 
        SET is_deleted = true, updated_at = NOW()
        WHERE (id = $1 OR parent_id = $1)
        RETURNING id, type, title
      `;
      deleteParams = [itemId];
    } else {
      // Delete only the story
      deleteQuery = `
        UPDATE psa_backlog_items 
        SET is_deleted = true, updated_at = NOW()
        WHERE id = $1
        RETURNING id, type, title
      `;
      deleteParams = [itemId];
    }

    const result = await pool.query(deleteQuery, deleteParams);

    res.status(200).json({
      success: true,
      message: `${item.type.charAt(0).toUpperCase() + item.type.slice(1)} "${item.title}" and related items deleted successfully`,
      data: {
        deletedItems: result.rows,
        deletedCount: result.rows.length
      }
    });
  } catch (error) {
    console.error("Error deleting backlog item:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ========================================================
// REPORTS & ANALYTICS API
// ========================================================

// Get comprehensive reports data for the dashboard
// exports.getReportsData = async (req, res) => {
//   try {
//     const { companyId } = req.params;
//     const { dateRange = 'ytd' } = req.query;

//     if (!companyId) {
//       return res.status(400).json({
//         success: false,
//         message: "Company ID is required",
//       });
//     }

//     // Calculate date range based on parameter
//     let startDate, endDate;
//     const currentDate = new Date();
    
//     switch (dateRange) {
//       case '30d':
//         startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
//         endDate = currentDate;
//         break;
//       case 'qtd':
//         const quarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1);
//         startDate = quarterStart;
//         endDate = currentDate;
//         break;
//       case 'ytd':
//         startDate = new Date(currentDate.getFullYear(), 0, 1);
//         endDate = currentDate;
//         break;
//       default:
//         startDate = new Date(currentDate.getFullYear(), 0, 1);
//         endDate = currentDate;
//     }

//     // 1. Resource Utilization Data
//     const resourceUtilizationQuery = `
//       WITH total_resources AS (
//         SELECT COUNT(*) as total_count
//         FROM users u
//         INNER JOIN company_roles cr ON u.company_role = cr.id
//         WHERE cr.company_id = $1
//       ),
//       assigned_resources AS (
//         SELECT COUNT(DISTINCT u.id) as assigned_count
//         FROM users u
//         INNER JOIN company_roles cr ON u.company_role = cr.id
//         INNER JOIN psa_projects p ON u.id = ANY(p.resource_user_ids)
//         WHERE cr.company_id = $1 
//           AND p.is_active = true
//           AND p.is_deleted = false
//       )
//       SELECT 
//         tr.total_count as total_resources,
//         ar.assigned_count as assigned_resources,
//         (tr.total_count - ar.assigned_count) as bench_resources,
//         CASE 
//           WHEN tr.total_count > 0 THEN ROUND((ar.assigned_count::float / tr.total_count) * 100)
//           ELSE 0 
//         END as assigned_percentage,
//         CASE 
//           WHEN tr.total_count > 0 THEN ROUND(((tr.total_count - ar.assigned_count)::float / tr.total_count) * 100)
//           ELSE 0 
//         END as bench_percentage
//       FROM total_resources tr, assigned_resources ar
//     `;
//     const resourceUtilizationResult = await pool.query(resourceUtilizationQuery, [companyId]);
//     const resourceUtilization = resourceUtilizationResult.rows[0];

//     // 2. Project Health Data
//     const projectHealthQuery = `
//       SELECT 
//         COUNT(*) as total_projects,
//         COUNT(CASE WHEN health = 'green' THEN 1 END) as healthy_projects,
//         COUNT(CASE WHEN health = 'yellow' THEN 1 END) as at_risk_projects,
//         COUNT(CASE WHEN health = 'red' THEN 1 END) as critical_projects
//       FROM psa_projects
//       WHERE company_id = $1 
//         AND is_active = true 
//         AND is_deleted = false
//     `;
//     const projectHealthResult = await pool.query(projectHealthQuery, [companyId]);
//     const projectHealth = projectHealthResult.rows[0];

//     // 3. Unstaffed Resources (30+ days)
//     const unstaffedResourcesQuery = `
//       SELECT 
//         u.id,
//         u.name,
//         u.email,
//         r.title as department,
//         r.location,
//         r.availability,
//         r.hourly_rate,
//         r.currency,
//         COALESCE(
//           (SELECT MAX(pp.updated_at) 
//            FROM psa_projects pp 
//            WHERE u.id = ANY(pp.resource_user_ids) 
//              AND pp.is_active = true 
//              AND pp.is_deleted = false
//           ), 
//           r.created_at
//         ) as last_assignment_date
//       FROM users u
//       INNER JOIN company_roles cr ON u.company_role = cr.id
//       LEFT JOIN psa_resources r ON u.id = r.user_id
//       WHERE cr.company_id = $1 
//         AND r.is_deleted = false
//         AND (
//           u.id NOT IN (
//             SELECT DISTINCT unnest(resource_user_ids) 
//             FROM psa_projects 
//             WHERE is_active = true 
//               AND is_deleted = false
//               AND resource_user_ids IS NOT NULL
//           )
//           OR u.id IN (
//             SELECT DISTINCT unnest(resource_user_ids) 
//             FROM psa_projects 
//             WHERE is_active = true 
//               AND is_deleted = false
//               AND resource_user_ids IS NOT NULL
//               AND updated_at < NOW() - INTERVAL '30 days'
//           )
//         )
//       ORDER BY r.availability DESC, u.name ASC
//       LIMIT 10
//     `;
//     const unstaffedResourcesResult = await pool.query(unstaffedResourcesQuery, [companyId]);
//     const unstaffedResources = unstaffedResourcesResult.rows.map(resource => ({
//       id: resource.id,
//       name: resource.name,
//       department: resource.department || 'Unknown',
//       location: resource.location || 'Unknown',
//       availability: resource.availability || 0,
//       hourlyRate: resource.hourly_rate || 0,
//       currency: resource.currency || 'USD',
//       daysUnstaffed: Math.floor((new Date() - new Date(resource.last_assignment_date)) / (1000 * 60 * 60 * 24))
//     }));

//     // 4. Expiring Certifications (within next 30 days)
//     const expiringCertificationsQuery = `
//       SELECT 
//         c.id as certification_id,
//         c.name as certification_name,
//         u.name as resource_name,
//         u.email as resource_email,
//         rc.expiration_date,
//         rc.status as cert_status,
//         ROUND((rc.expiration_date - CURRENT_DATE)::numeric) as days_until_expiry
//       FROM psa_resource_certifications rc
//       INNER JOIN psa_certifications c ON rc.certification_id = c.id
//       INNER JOIN psa_resources r ON rc.resource_id = r.id
//       INNER JOIN users u ON r.user_id = u.id
//       INNER JOIN company_roles cr ON u.company_role = cr.id
//       WHERE cr.company_id = $1 
//         AND rc.is_deleted = false
//         AND rc.expiration_date IS NOT NULL
//         AND rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
//         AND rc.expiration_date > CURRENT_DATE
//       ORDER BY rc.expiration_date ASC
//       LIMIT 10
//     `;
//     const expiringCertificationsResult = await pool.query(expiringCertificationsQuery, [companyId]);
//     const expiringCertifications = expiringCertificationsResult.rows.map(cert => ({
//       certificationId: cert.certification_id,
//       certificationName: cert.certification_name,
//       resourceName: cert.resource_name,
//       resourceEmail: cert.resource_email,
//       expirationDate: cert.expiration_date,
//       status: cert.cert_status,
//       daysUntilExpiry: cert.days_until_expiry
//     }));

//     // Compile the reports data
//     const reportsData = {
//       resourceUtilization: {
//         assignedResources: parseInt(resourceUtilization.assigned_resources),
//         totalResources: parseInt(resourceUtilization.total_resources),
//         assignedPercentage: parseInt(resourceUtilization.assigned_percentage),
//         benchResources: parseInt(resourceUtilization.bench_resources),
//         benchPercentage: parseInt(resourceUtilization.bench_percentage)
//       },
//       projectHealth: {
//         healthy: parseInt(projectHealth.healthy_projects),
//         atRisk: parseInt(projectHealth.at_risk_projects),
//         critical: parseInt(projectHealth.critical_projects),
//         total: parseInt(projectHealth.total_projects)
//       },
//       unstaffedResources: unstaffedResources,
//       expiringCertifications: expiringCertifications,
//       dateRange: {
//         startDate: startDate.toISOString(),
//         endDate: endDate.toISOString(),
//         range: dateRange
//       }
//     };

//     res.status(200).json({
//       success: true,
//       data: reportsData
//     });

//   } catch (error) {
//     console.error("Error fetching reports data:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while fetching reports data",
//       error: error.message
//     });
//   }
// };

exports.getReportsData = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { dateRange = 'ytd', startDate: customStartDate, endDate: customEndDate } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // ---------------- Date Range ----------------
    let startDate, endDate;
    const currentDate = new Date();

    if (dateRange === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    } else {
      switch (dateRange) {
        case "30d":
          startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          endDate = currentDate;
          break;
        case "qtd":
          const quarterStart = new Date(
            currentDate.getFullYear(),
            Math.floor(currentDate.getMonth() / 3) * 3,
            1
          );
          startDate = quarterStart;
          endDate = currentDate;
          break;
        case "ytd":
          startDate = new Date(currentDate.getFullYear(), 0, 1);
          endDate = currentDate;
          break;
        default:
          startDate = new Date(currentDate.getFullYear(), 0, 1);
          endDate = currentDate;
      }
    }

    // ---------------- 1. Resource Utilization ----------------
    const resourceUtilizationQuery = `
      WITH total_resources AS (
        SELECT COUNT(*) as total_count
        FROM users u
        INNER JOIN company_roles cr ON u.company_role = cr.id
        WHERE cr.company_id = $1 AND u.status = 'enabled'
      ),
      assigned_resources AS (
        SELECT COUNT(DISTINCT u.id) as assigned_count
        FROM users u
        INNER JOIN company_roles cr ON u.company_role = cr.id
        INNER JOIN psa_projects p ON u.id = ANY(p.resource_user_ids)
        WHERE cr.company_id = $1 
          AND p.company_id = $1
          AND p.is_active = true
          AND p.is_deleted = false
          AND u.status = 'enabled'
          AND p.created_at >= $2
          AND p.created_at <= $3
      )
      SELECT 
        tr.total_count as total_resources,
        ar.assigned_count as assigned_resources,
        (tr.total_count - ar.assigned_count) as bench_resources,
        CASE 
          WHEN tr.total_count > 0 THEN ROUND((ar.assigned_count::float / tr.total_count) * 100)
          ELSE 0 
        END as assigned_percentage,
        CASE 
          WHEN tr.total_count > 0 THEN ROUND(((tr.total_count - ar.assigned_count)::float / tr.total_count) * 100)
          ELSE 0 
        END as bench_percentage
      FROM total_resources tr, assigned_resources ar
    `;
    const resourceUtilizationResult = await pool.query(resourceUtilizationQuery, [companyId, startDate, endDate]);
    const resourceUtilization = resourceUtilizationResult.rows[0];

    // ---------------- 2. Project Health ----------------
    const projectHealthQuery = `
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN health = 'green' THEN 1 END) as healthy_projects,
        COUNT(CASE WHEN health = 'yellow' THEN 1 END) as at_risk_projects,
        COUNT(CASE WHEN health = 'red' THEN 1 END) as critical_projects
      FROM psa_projects
      WHERE company_id = $1 
        AND is_active = true 
        AND is_deleted = false
        AND created_at >= $2
        AND created_at <= $3
    `;
    const projectHealthResult = await pool.query(projectHealthQuery, [companyId, startDate, endDate]);
    const projectHealth = projectHealthResult.rows[0];

    // ---------------- 3. Unstaffed Resources ----------------
    const unstaffedResourcesQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        r.title as department,
        r.location,
        -- For unstaffed resources, availability should be 100% (not utilization)
        CASE 
          WHEN NOT EXISTS (
            SELECT 1
            FROM psa_projects p
            WHERE u.id = ANY(p.resource_user_ids)
              AND p.company_id = $1
              AND p.is_active = true
              AND p.is_deleted = false
          ) THEN 100  -- Unstaffed = 100% available
          ELSE COALESCE(
            (SELECT SUM(
               CASE 
                 WHEN array_position(p.resource_user_ids, u.id) IS NOT NULL 
                 THEN COALESCE(p.resource_allocations[array_position(p.resource_user_ids, u.id)], 0)
                 ELSE 0 
               END
             )
             FROM psa_projects p
             WHERE u.id = ANY(p.resource_user_ids)
               AND p.is_active = true
               AND p.is_deleted = false
               AND p.company_id = $1
            ), 0
          )  -- Staffed = utilization percentage
        END AS availability,
        r.hourly_rate,
        r.currency,
        COALESCE(
          (SELECT MAX(pp.updated_at) 
           FROM psa_projects pp 
           WHERE u.id = ANY(pp.resource_user_ids) 
             AND pp.company_id = $1
             AND pp.is_active = true 
             AND pp.is_deleted = false
          ), 
          r.created_at
        ) as last_assignment_date
      FROM users u
      INNER JOIN company_roles cr ON u.company_role = cr.id
      LEFT JOIN psa_resources r 
        ON u.id = r.user_id 
       AND r.is_deleted = false
        WHERE cr.company_id = $1 
        AND u.status = 'enabled'
        AND (
          NOT EXISTS (
            SELECT 1
            FROM psa_projects p
            WHERE u.id = ANY(p.resource_user_ids)
              AND p.company_id = $1
              AND p.is_active = true
              AND p.is_deleted = false
              AND p.created_at >= $2
              AND p.created_at <= $3
          )
          OR EXISTS (
            SELECT 1
            FROM psa_projects p
            WHERE u.id = ANY(p.resource_user_ids)
              AND p.company_id = $1
              AND p.is_active = true
              AND p.is_deleted = false
              AND p.created_at >= $2
              AND p.created_at <= $3
              AND p.updated_at < NOW() - INTERVAL '30 days'
          )
        )
      ORDER BY availability DESC NULLS LAST, u.name ASC
      LIMIT 10
    `;
    const unstaffedResourcesResult = await pool.query(unstaffedResourcesQuery, [companyId, startDate, endDate]);
    const unstaffedResources = unstaffedResourcesResult.rows.map(resource => ({
      id: resource.id,
      name: resource.name,
      department: resource.department || "Unknown",
      location: resource.location || "Unknown",
      availability: resource.availability || 0,
      hourlyRate: resource.hourly_rate || 0,
      currency: resource.currency || "USD",
      daysUnstaffed: resource.last_assignment_date 
        ? Math.floor((new Date() - new Date(resource.last_assignment_date)) / (1000 * 60 * 60 * 24)) 
        : null
    }));

    // ---------------- 4. Expiring Certifications ----------------
    const expiringCertificationsQuery = `
      SELECT 
        c.id as certification_id,
        c.name as certification_name,
        u.name as resource_name,
        u.email as resource_email,
        rc.expiration_date,
        rc.status as cert_status,
        ROUND((rc.expiration_date - CURRENT_DATE)::numeric) as days_until_expiry
      FROM psa_resource_certifications rc
      INNER JOIN psa_certifications c ON rc.certification_id = c.id
      INNER JOIN psa_resources r ON rc.resource_id = r.id AND r.is_deleted = false
      INNER JOIN users u ON r.user_id = u.id
      INNER JOIN company_roles cr ON u.company_role = cr.id
      WHERE cr.company_id = $1 
        AND rc.is_deleted = false
        AND rc.expiration_date IS NOT NULL
        AND rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
        AND rc.expiration_date > CURRENT_DATE
        AND rc.created_at >= $2
        AND rc.created_at <= $3
      ORDER BY rc.expiration_date ASC
      LIMIT 10
    `;
    const expiringCertificationsResult = await pool.query(expiringCertificationsQuery, [companyId, startDate, endDate]);
    const expiringCertifications = expiringCertificationsResult.rows.map(cert => ({
      certificationId: cert.certification_id,
      certificationName: cert.certification_name,
      resourceName: cert.resource_name,
      resourceEmail: cert.resource_email,
      expirationDate: cert.expiration_date,
      status: cert.cert_status,
      daysUntilExpiry: cert.days_until_expiry
    }));

    // ---------------- Final Response ----------------
    const reportsData = {
      resourceUtilization: {
        assignedResources: parseInt(resourceUtilization.assigned_resources),
        totalResources: parseInt(resourceUtilization.total_resources),
        assignedPercentage: parseInt(resourceUtilization.assigned_percentage),
        benchResources: parseInt(resourceUtilization.bench_resources),
        benchPercentage: parseInt(resourceUtilization.bench_percentage)
      },
      projectHealth: {
        healthy: parseInt(projectHealth.healthy_projects),
        atRisk: parseInt(projectHealth.at_risk_projects),
        critical: parseInt(projectHealth.critical_projects),
        total: parseInt(projectHealth.total_projects)
      },
      unstaffedResources,
      expiringCertifications,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        range: dateRange
      }
    };

    res.status(200).json({
      success: true,
      data: reportsData,
    });
  } catch (error) {
    console.error("Error fetching reports data:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching reports data",
      error: error.message,
    });
  }
};

// ========================================================
// RESOURCE UTILIZATION REPORT API
// ========================================================

// Get detailed resource utilization report
// ========================================================
// CERTIFICATION TRACKER API
// ========================================================

// Get certification tracker data
// exports.getCertificationTracker = async (req, res) => {
//   try {
//     console.log('Certification tracker API called with params:', req.params);
//     console.log('Query params:', req.query);
    
//     const { companyId } = req.params;
//     const { 
//       status = 'all', 
//       department = 'all', 
//       search = '',
//       page = 1,
//       limit = 50
//     } = req.query;

//     if (!companyId) {
//       console.log('No companyId provided');
//       return res.status(400).json({
//         success: false,
//         message: "Company ID is required",
//       });
//     }

//     console.log('Processing certification tracker for companyId:', companyId);

//     // Build dynamic WHERE conditions
//     let whereConditions = ['cr.company_id = $1'];
//     let queryParams = [companyId];
//     let paramCount = 1;

//     // Department filter
//     if (department !== 'all') {
//       paramCount++;
//       whereConditions.push(`d.id = $${paramCount}`);
//       queryParams.push(department);
//     }

//     // Search filter
//     if (search) {
//       paramCount++;
//       whereConditions.push(`(c.name ILIKE $${paramCount} OR u.name ILIKE $${paramCount} OR c.issuing_organization ILIKE $${paramCount})`);
//       queryParams.push(`%${search}%`);
//     }

//     // Status filter
//     if (status !== 'all') {
//       paramCount++;
//       whereConditions.push(`(
//         CASE 
//           WHEN rc.expiration_date IS NULL THEN 'active'
//           WHEN rc.expiration_date < CURRENT_DATE THEN 'expired'
//           WHEN rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
//           ELSE 'active'
//         END = $${paramCount}
//       )`);
//       queryParams.push(status);
//     }

//     // Main query to get certification data
//     const certificationQuery = `
//       WITH certification_data AS (
//         SELECT 
//           rc.id as certification_record_id,
//           rc.resource_id,
//           rc.certification_id,
//           rc.date_obtained,
//           rc.expiration_date,
//           rc.status as cert_status,
//           rc.certificate_number,
//           rc.verification_url,
//           rc.created_at as cert_created_at,
//           rc.updated_at as cert_updated_at,
          
//           -- Certification details
//           c.name as certification_name,
//           c.issuing_organization,
//           c.description as certification_description,
//           c.validity_period_months,
          
//           -- Resource details
//           r.id as psa_resource_id,
//           r.user_id,
//           r.location,
//           r.hourly_rate,
//           r.currency,
          
//           -- User details
//           u.id as user_id,
//           u.name as user_name,
//           u.email as user_email,
//           u.avatar,
          
//           -- Department details
//           cr2.name as department_name,
//           d.description as department_description,
          
//           -- Calculate days remaining and status
//           CASE 
//             WHEN rc.expiration_date IS NULL THEN NULL
//             ELSE (rc.expiration_date - CURRENT_DATE)::INTEGER
//           END as days_remaining,
          
//           CASE 
//             WHEN rc.expiration_date IS NULL THEN 'active'
//             WHEN rc.expiration_date < CURRENT_DATE THEN 'expired'
//             WHEN rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
//             ELSE 'active'
//           END as calculated_status
          
//         FROM psa_resource_certifications rc
//         INNER JOIN psa_certifications c ON rc.certification_id = c.id
//         INNER JOIN psa_resources r ON rc.resource_id = r.id
//         INNER JOIN users u ON r.user_id = u.id
//         INNER JOIN company_roles cr ON u.company_role = cr.id
//         LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
//         WHERE ${whereConditions.join(' AND ')}
//           AND rc.is_deleted = false
//           AND c.is_deleted = false
//           AND r.is_deleted = false
//       )
//       SELECT 
//         certification_record_id,
//         psa_resource_id,
//         certification_id,
//         date_obtained,
//         expiration_date,
//         cert_status,
//         certificate_number,
//         verification_url,
//         cert_created_at,
//         cert_updated_at,
//         certification_name,
//         issuing_organization,
//         certification_description,
//         validity_period_months,
//         location,
//         hourly_rate,
//         currency,
//         user_id,
//         user_name,
//         user_email,
//         avatar,
//         department_name,
//         department_description,
//         days_remaining,
//         calculated_status
//       FROM certification_data
//       ORDER BY 
//         CASE 
//           WHEN days_remaining < 0 THEN 1  -- Expired first
//           WHEN days_remaining IS NULL THEN 2  -- Never expiring second
//           WHEN days_remaining <= 30 THEN 3  -- Expiring soon third
//           ELSE 4  -- Active last
//         END,
//         days_remaining ASC,
//         user_name ASC
//       LIMIT $` + (paramCount + 1) + ` OFFSET $` + (paramCount + 2) + `
//     `;

//     // Add pagination parameters
//     paramCount++;
//     queryParams.push(parseInt(limit));
//     paramCount++;
//     queryParams.push((parseInt(page) - 1) * parseInt(limit));

//     const certificationResult = await pool.query(certificationQuery, queryParams);
//     const certifications = certificationResult.rows;

//     // Get total count for pagination
//     const countQuery = `
//       SELECT COUNT(*) as total_count
//       FROM psa_resource_certifications rc
//       INNER JOIN psa_certifications c ON rc.certification_id = c.id
//       INNER JOIN psa_resources r ON rc.resource_id = r.id
//       INNER JOIN users u ON r.user_id = u.id
//       INNER JOIN company_roles cr ON u.company_role = cr.id
//       LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
//       WHERE ${whereConditions.join(' AND ')}
//         AND rc.is_deleted = false
//         AND c.is_deleted = false
//         AND r.is_deleted = false
//     `;
//     const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
//     const totalCount = parseInt(countResult.rows[0].total_count);

//     // Calculate summary statistics
//     const summaryQuery = `
//       WITH certification_stats AS (
//         SELECT 
//           CASE 
//             WHEN rc.expiration_date IS NULL THEN 'active'
//             WHEN rc.expiration_date < CURRENT_DATE THEN 'expired'
//             WHEN rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
//             ELSE 'active'
//           END as status
//         FROM psa_resource_certifications rc
//         INNER JOIN psa_certifications c ON rc.certification_id = c.id
//         INNER JOIN psa_resources r ON rc.resource_id = r.id
//         INNER JOIN users u ON r.user_id = u.id
//         INNER JOIN company_roles cr ON u.company_role = cr.id
//         LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
//         WHERE ${whereConditions.join(' AND ')}
//           AND rc.is_deleted = false
//           AND c.is_deleted = false
//           AND r.is_deleted = false
//       )
//       SELECT 
//         COUNT(*) as total_certifications,
//         COUNT(CASE WHEN status = 'active' THEN 1 END) as active_certifications,
//         COUNT(CASE WHEN status = 'expiring_soon' THEN 1 END) as expiring_soon,
//         COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_certifications
//       FROM certification_stats
//     `;
//     const summaryResult = await pool.query(summaryQuery, queryParams.slice(0, -2));
//     const summary = summaryResult.rows[0];

//     // Get department list for filters
//     const departmentsQuery = `
//       SELECT DISTINCT d.id as department_id, cr2.name as department_name
//       FROM psa_resource_certifications rc
//       INNER JOIN psa_resources r ON rc.resource_id = r.id
//       INNER JOIN users u ON r.user_id = u.id
//       INNER JOIN company_roles cr ON u.company_role = cr.id
//       LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
//       WHERE cr.company_id = $1 AND d.id IS NOT NULL
//       ORDER BY d.name ASC
//     `;
//     const departmentsResult = await pool.query(departmentsQuery, [companyId]);
//     const departments = departmentsResult.rows.map(row => ({
//       id: row.department_id,
//       name: row.department_name
//     }));

//     // Get upcoming renewals (next 90 days)
//     const upcomingRenewalsQuery = `
//       SELECT 
//         rc.id as certification_record_id,
//         c.name as certification_name,
//         u.name as user_name,
//         rc.expiration_date,
//         (rc.expiration_date - CURRENT_DATE)::INTEGER as days_remaining
//       FROM psa_resource_certifications rc
//       INNER JOIN psa_certifications c ON rc.certification_id = c.id
//       INNER JOIN psa_resources r ON rc.resource_id = r.id
//       INNER JOIN users u ON r.user_id = u.id
//       INNER JOIN company_roles cr ON u.company_role = cr.id
//       WHERE cr.company_id = $1
//         AND rc.is_deleted = false
//         AND c.is_deleted = false
//         AND r.is_deleted = false
//         AND rc.expiration_date IS NOT NULL
//         AND rc.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
//       ORDER BY rc.expiration_date ASC
//       LIMIT 5
//     `;
//     const upcomingRenewalsResult = await pool.query(upcomingRenewalsQuery, [companyId]);
//     const upcomingRenewals = upcomingRenewalsResult.rows;

//     // Format response data
//     const formattedCertifications = certifications.map(cert => ({
//       id: cert.certification_record_id,
//       certificationId: cert.certification_id,
//       certification: {
//         id: cert.certification_id,
//         name: cert.certification_name,
//         issuingOrganization: cert.issuing_organization,
//         description: cert.certification_description,
//         validityPeriodMonths: cert.validity_period_months
//       },
//       resourceId: cert.psa_resource_id,
//       resourceName: cert.user_name,
//       department: cert.department_name || 'Unknown',
//       location: cert.location || 'Unknown',
//       email: cert.user_email,
//       avatar: cert.avatar,
//       dateObtained: cert.date_obtained,
//       expirationDate: cert.expiration_date,
//       status: cert.calculated_status,
//       certificateNumber: cert.certificate_number,
//       verificationUrl: cert.verification_url,
//       daysRemaining: cert.days_remaining,
//       isExpired: cert.days_remaining !== null && cert.days_remaining < 0,
//       hourlyRate: cert.hourly_rate || 0,
//       currency: cert.currency || 'USD'
//     }));

//     const response = {
//       certifications: formattedCertifications,
//       summary: {
//         totalCertifications: parseInt(summary.total_certifications),
//         activeCertifications: parseInt(summary.active_certifications),
//         expiringSoon: parseInt(summary.expiring_soon),
//         expiredCertifications: parseInt(summary.expired_certifications),
//         complianceRate: summary.total_certifications > 0 ? 
//           Math.round((summary.active_certifications / summary.total_certifications) * 100) : 0
//       },
//       upcomingRenewals: upcomingRenewals.map(renewal => ({
//         id: renewal.certification_record_id,
//         certificationName: renewal.certification_name,
//         resourceName: renewal.user_name,
//         expirationDate: renewal.expiration_date,
//         daysRemaining: renewal.days_remaining
//       })),
//       filters: {
//         departments: departments,
//         status: status,
//         department: department,
//         search: search
//       },
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total: totalCount,
//         totalPages: Math.ceil(totalCount / parseInt(limit))
//       }
//     };

//     res.status(200).json({
//       success: true,
//       data: response
//     });

//   } catch (error) {
//     console.error("Error fetching certification tracker data:", error);
//     console.error("Error details:", error.message);
//     console.error("Error stack:", error.stack);
//     res.status(500).json({
//       success: false,
//       message: "Server error while fetching certification tracker data",
//       error: error.message
//     });
//   }
// };

exports.getCertificationTracker = async (req, res) => {
  try {  

    const { companyId } = req.params;
    const { 
      status = 'all', 
      department = 'all', 
      search = '',
      page = 1,
      limit = 50
    } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    let whereConditions = ['cr.company_id = $1'];
    let queryParams = [companyId];
    let paramCount = 1;

    // Department filter (by ID, safer than name)
    if (department !== 'all') {
      paramCount++;
      whereConditions.push(`cr2.id = $${paramCount}`);
      queryParams.push(department);
    }

    // Status filter (active, expired, expiring_soon)
    if (status !== 'all') {
      paramCount++;
      whereConditions.push(`(
        CASE 
          WHEN rc.expiration_date IS NULL THEN 'active'
          WHEN rc.expiration_date < CURRENT_DATE THEN 'expired'
          WHEN rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          ELSE 'active'
        END = $${paramCount}
      )`);
      queryParams.push(status);
    }

    // Search filter
    if (search) {
      paramCount++;
      whereConditions.push(`(
        c.name ILIKE $${paramCount} OR 
        u.name ILIKE $${paramCount} OR 
        c.issuing_organization ILIKE $${paramCount}
      )`);
      queryParams.push(`%${search}%`);
    }

    // Main query
    const certificationQuery = `
      WITH certification_data AS (
        SELECT 
          rc.id as certification_record_id,
          rc.resource_id,
          rc.certification_id,
          rc.date_obtained,
          rc.expiration_date,
          rc.status as cert_status,
          rc.certificate_number,
          rc.verification_url,
          rc.created_at as cert_created_at,
          rc.updated_at as cert_updated_at,

          -- Certification
          c.name as certification_name,
          c.issuing_organization,
          c.description as certification_description,
          c.validity_period_months,

          -- Resource
          r.id as resource_id,
          r.user_id,
          r.location,
          r.hourly_rate,
          r.currency,

          -- User
          u.id as user_id,
          u.name as user_name,
          u.email as user_email,
          u.avatar,

          -- Department
          cr2.id as department_id,
          cr2.name as department_name,
          cr2.description as department_description,

          -- Days + Status
          CASE 
            WHEN rc.expiration_date IS NULL THEN NULL
            ELSE (rc.expiration_date - CURRENT_DATE)::INTEGER
          END as days_remaining,

          CASE 
            WHEN rc.expiration_date IS NULL THEN 'active'
            WHEN rc.expiration_date < CURRENT_DATE THEN 'expired'
            WHEN rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE 'active'
          END as calculated_status
          
        FROM psa_resource_certifications rc
        INNER JOIN psa_certifications c ON rc.certification_id = c.id AND c.is_deleted = false
        INNER JOIN psa_resources r ON rc.resource_id = r.id AND r.is_deleted = false
        INNER JOIN users u ON r.user_id = u.id
        INNER JOIN company_roles cr ON u.company_role = cr.id
        LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
        WHERE ${whereConditions.join(' AND ')}
          AND rc.is_deleted = false
      )
      SELECT *
      FROM certification_data
      ORDER BY 
        CASE 
          WHEN days_remaining < 0 THEN 1 -- expired
          WHEN days_remaining IS NOT NULL AND days_remaining <= 30 THEN 2 -- expiring soon
          WHEN days_remaining IS NULL THEN 4 -- no expiry (active forever)
          ELSE 3 -- active
        END,
        days_remaining ASC,
        user_name ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    // Pagination
    queryParams.push(parseInt(limit));
    queryParams.push((parseInt(page) - 1) * parseInt(limit));

    const certificationResult = await pool.query(certificationQuery, queryParams);
    const certifications = certificationResult.rows;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM psa_resource_certifications rc
      INNER JOIN psa_certifications c ON rc.certification_id = c.id AND c.is_deleted = false
      INNER JOIN psa_resources r ON rc.resource_id = r.id AND r.is_deleted = false
      INNER JOIN users u ON r.user_id = u.id
      INNER JOIN company_roles cr ON u.company_role = cr.id
      LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
      WHERE ${whereConditions.join(' AND ')}
        AND rc.is_deleted = false
    `;
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].total_count);

    // ✅ Same summary query as before (kept unchanged)
    const summaryQuery = `
      WITH certification_stats AS (
        SELECT 
          CASE 
            WHEN rc.expiration_date IS NULL THEN 'active'
            WHEN rc.expiration_date < CURRENT_DATE THEN 'expired'
            WHEN rc.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE 'active'
          END as status
        FROM psa_resource_certifications rc
        INNER JOIN psa_certifications c ON rc.certification_id = c.id AND c.is_deleted = false
        INNER JOIN psa_resources r ON rc.resource_id = r.id AND r.is_deleted = false
        INNER JOIN users u ON r.user_id = u.id
        INNER JOIN company_roles cr ON u.company_role = cr.id
        LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
        WHERE ${whereConditions.join(' AND ')}
          AND rc.is_deleted = false
      )
      SELECT 
        COUNT(*) as total_certifications,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_certifications,
        COUNT(CASE WHEN status = 'expiring_soon' THEN 1 END) as expiring_soon,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_certifications
      FROM certification_stats
    `;
    const summaryResult = await pool.query(summaryQuery, queryParams.slice(0, -2));
    const summary = summaryResult.rows[0];

    // Format response
    const formattedCertifications = certifications.map(cert => ({
      id: cert.certification_record_id,
      certificationId: cert.certification_id,
      certification: {
        id: cert.certification_id,
        name: cert.certification_name,
        issuingOrganization: cert.issuing_organization,
        description: cert.certification_description,
        validityPeriodMonths: cert.validity_period_months
      },
      resourceId: cert.resource_id,
      resourceName: cert.user_name,
      department: cert.department_name || 'Unknown',
      location: cert.location || 'Unknown',
      email: cert.user_email,
      avatar: cert.avatar,
      dateObtained: cert.date_obtained,
      expirationDate: cert.expiration_date,
      status: cert.calculated_status,
      certificateNumber: cert.certificate_number,
      verificationUrl: cert.verification_url,
      daysRemaining: cert.days_remaining,
      isExpired: cert.days_remaining !== null && cert.days_remaining < 0,
      hourlyRate: cert.hourly_rate || 0,
      currency: cert.currency || 'USD'
    }));

    res.status(200).json({
      success: true,
      data: {
        certifications: formattedCertifications,
        summary: {
          totalCertifications: parseInt(summary.total_certifications),
          activeCertifications: parseInt(summary.active_certifications),
          expiringSoon: parseInt(summary.expiring_soon),
          expiredCertifications: parseInt(summary.expired_certifications),
          complianceRate: summary.total_certifications > 0 ? 
            Math.round((summary.active_certifications / summary.total_certifications) * 100) : 0
        },
        filters: {
          departments: [], // you can fetch departments as in old code if needed
          status,
          department,
          search
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error("Error fetching certification tracker data:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching certification tracker data",
      error: error.message
    });
  }
};


// Get all skills
exports.getAllSkills = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id,
        s.name,
        s.category,
        s.description,
        s.is_active,
        s.created_at,
        s.updated_at,
        COALESCE(COUNT(rs.resource_id), 0) as people_count
      FROM psa_skills s
      LEFT JOIN psa_resource_skills rs ON s.id = rs.skill_id
      WHERE s.is_deleted = false
      GROUP BY s.id, s.name, s.category, s.description, s.is_active, s.created_at, s.updated_at
      ORDER BY s.category ASC, s.name ASC
    `;

    const result = await pool.query(query);

    res.status(200).json({
      success: true,
      skills: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching skills:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching skills",
      error: error.message,
    });
  }
};

// Get all certifications
exports.getAllCertifications = async (req, res) => {
  try {
    const query = `
      SELECT
        c.id AS certification_id,
        c.name,
        c.description,
        MIN(rc.date_obtained) AS first_obtained,
        MAX(rc.expiration_date) AS latest_expiration,
        COUNT(rc.id) AS people_count
      FROM psa_certifications c
      LEFT JOIN psa_resource_certifications rc
        ON c.id = rc.certification_id
      WHERE c.is_deleted = false
      GROUP BY c.id, c.name, c.description
      ORDER BY c.name ASC
    `;

    const result = await pool.query(query);

    res.status(200).json({
      success: true,
      certifications: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching certifications:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching certifications",
      error: error.message,
    });
  }
};

// Get Skills Gap Analysis
exports.getSkillsGapAnalysis = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { 
      category = 'all',
      search = '',
      page = 1,
      limit = 50
    } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Build dynamic WHERE conditions
    let whereConditions = ['s.is_deleted = false'];
    let queryParams = [];
    let paramCount = 0;

    // Category filter
    if (category !== 'all') {
      paramCount++;
      whereConditions.push(`s.category = $${paramCount}`);
      queryParams.push(category);
    }

    // Search filter
    if (search) {
      paramCount++;
      whereConditions.push(`(s.name ILIKE $${paramCount} OR s.description ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    // Main query to get skills gap analysis
    const skillsGapQuery = `
      WITH all_skills AS (
        -- Get all skills first
        SELECT 
          s.id as skill_id,
          s.name as skill_name,
          s.category as skill_category,
          s.description as skill_description
        FROM psa_skills s
        WHERE ${whereConditions.join(' AND ')}
      ),
      skill_demand AS (
        -- Calculate demand: skills required in active projects
        SELECT 
          s.id as skill_id,
          COUNT(DISTINCT bi.id) as demand_count
        FROM psa_skills s
        LEFT JOIN psa_backlog_items bi ON s.name = ANY(bi.required_skills)
        LEFT JOIN psa_projects p ON bi.project_id = p.id
        WHERE ${whereConditions.join(' AND ')}
          AND p.company_id = $${paramCount + 1}
          AND p.is_active = true
          AND p.is_deleted = false
          AND bi.is_deleted = false
        GROUP BY s.id
      ),
      skill_supply AS (
        -- Calculate supply: resources with skills
        SELECT 
          s.id as skill_id,
          COUNT(DISTINCT rs.resource_id) as supply_count,
          AVG(rs.proficiency_level) as avg_proficiency,
          SUM(rs.years_experience) as total_experience
        FROM psa_skills s
        LEFT JOIN psa_resource_skills rs ON s.id = rs.skill_id
        LEFT JOIN psa_resources r ON rs.resource_id = r.id
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN company_roles cr ON u.company_role = cr.id
        WHERE ${whereConditions.join(' AND ')}
          AND cr.company_id = $${paramCount + 1}
          AND rs.is_deleted = false
          AND r.is_deleted = false
          AND u.status = 'enabled'
        GROUP BY s.id
      ),
      skill_gaps AS (
        -- Calculate gaps and severity
        SELECT 
          s.skill_id,
          s.skill_name,
          s.skill_category,
          s.skill_description,
          COALESCE(sd.demand_count, 0) as demand,
          COALESCE(ss.supply_count, 0) as supply,
          COALESCE(ss.avg_proficiency, 0) as avg_proficiency,
          COALESCE(ss.total_experience, 0) as total_experience,
          (COALESCE(sd.demand_count, 0) - COALESCE(ss.supply_count, 0)) as gap,
          CASE 
            WHEN (COALESCE(sd.demand_count, 0) - COALESCE(ss.supply_count, 0)) > 3 THEN 'critical'
            WHEN (COALESCE(sd.demand_count, 0) - COALESCE(ss.supply_count, 0)) > 1 THEN 'high'
            WHEN (COALESCE(sd.demand_count, 0) - COALESCE(ss.supply_count, 0)) > 0 THEN 'medium'
            WHEN (COALESCE(sd.demand_count, 0) - COALESCE(ss.supply_count, 0)) < -2 THEN 'surplus'
            ELSE 'low'
          END as severity
        FROM all_skills s
        LEFT JOIN skill_demand sd ON s.skill_id = sd.skill_id
        LEFT JOIN skill_supply ss ON s.skill_id = ss.skill_id
      )
      SELECT 
        skill_id,
        skill_name,
        skill_category,
        skill_description,
        demand,
        supply,
        gap,
        avg_proficiency,
        total_experience,
        severity,
        CASE 
          WHEN demand > 0 THEN ((gap::float / demand) * 100)::numeric(10,2)
          ELSE 0 
        END as gap_percentage
      FROM skill_gaps
      ORDER BY 
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          WHEN 'surplus' THEN 5
        END,
        gap DESC,
        skill_name ASC
      LIMIT $${paramCount + 2} OFFSET $${paramCount + 3}
    `;

    // Add pagination parameters
    queryParams.push(companyId, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const skillsGapResult = await pool.query(skillsGapQuery, queryParams);
    const skillGaps = skillsGapResult.rows;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM psa_skills s
      WHERE ${whereConditions.join(' AND ')}
    `;
    const countResult = await pool.query(countQuery, queryParams.slice(0, -3)); // Remove pagination and companyId
    const totalCount = parseInt(countResult.rows[0].total_count);

    // Calculate summary statistics
    const summaryQuery = `
      WITH skill_demand AS (
        SELECT 
          s.id as skill_id,
          COUNT(DISTINCT bi.id) as demand_count
        FROM psa_skills s
        LEFT JOIN psa_backlog_items bi ON s.name = ANY(bi.required_skills)
        LEFT JOIN psa_projects p ON bi.project_id = p.id
        WHERE ${whereConditions.join(' AND ')}
          AND p.company_id = $${paramCount + 1}
          AND p.is_active = true
          AND p.is_deleted = false
          AND bi.is_deleted = false
        GROUP BY s.id
      ),
      skill_supply AS (
        SELECT 
          s.id as skill_id,
          COUNT(DISTINCT rs.resource_id) as supply_count
        FROM psa_skills s
        LEFT JOIN psa_resource_skills rs ON s.id = rs.skill_id
        LEFT JOIN psa_resources r ON rs.resource_id = r.id
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN company_roles cr ON u.company_role = cr.id
        WHERE ${whereConditions.join(' AND ')}
          AND cr.company_id = $${paramCount + 1}
          AND rs.is_deleted = false
          AND r.is_deleted = false
        GROUP BY s.id
      ),
      skill_gaps AS (
        SELECT 
          (COALESCE(sd.demand_count, 0) - COALESCE(ss.supply_count, 0)) as gap,
          CASE 
            WHEN (COALESCE(sd.demand_count, 0) - COALESCE(ss.supply_count, 0)) > 3 THEN 'critical'
            WHEN (COALESCE(sd.demand_count, 0) - COALESCE(ss.supply_count, 0)) > 1 THEN 'high'
            WHEN (COALESCE(sd.demand_count, 0) - COALESCE(ss.supply_count, 0)) > 0 THEN 'medium'
            WHEN (COALESCE(sd.demand_count, 0) - COALESCE(ss.supply_count, 0)) < -2 THEN 'surplus'
            ELSE 'low'
          END as severity
        FROM skill_demand sd
        FULL OUTER JOIN skill_supply ss ON sd.skill_id = ss.skill_id
      )
      SELECT 
        COUNT(*) as total_skills,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_gaps,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_gaps,
        COUNT(CASE WHEN severity = 'surplus' THEN 1 END) as surplus_skills,
        SUM(CASE WHEN gap > 0 THEN gap ELSE 0 END) as total_gap
      FROM skill_gaps
    `;
    const summaryResult = await pool.query(summaryQuery, queryParams.slice(0, -2)); // Remove pagination
    const summary = summaryResult.rows[0];

    // Get categories for filters
    const categoriesQuery = `
      SELECT DISTINCT category
      FROM psa_skills
      WHERE is_deleted = false
      ORDER BY category ASC
    `;
    const categoriesResult = await pool.query(categoriesQuery);
    const categories = categoriesResult.rows.map(row => row.category);

    // Format response data
    const formattedSkillGaps = skillGaps.map(skill => ({
      id: skill.skill_id,
      name: skill.skill_name,
      category: skill.skill_category,
      description: skill.skill_description,
      demand: parseInt(skill.demand),
      supply: parseInt(skill.supply),
      gap: parseInt(skill.gap),
      gapPercentage: parseFloat(skill.gap_percentage),
      avgProficiency: parseFloat(skill.avg_proficiency),
      totalExperience: parseFloat(skill.total_experience),
      severity: skill.severity
    }));

    const response = {
      skillGaps: formattedSkillGaps,
      summary: {
        totalSkills: parseInt(summary.total_skills),
        criticalGaps: parseInt(summary.critical_gaps),
        highGaps: parseInt(summary.high_gaps),
        surplusSkills: parseInt(summary.surplus_skills),
        totalGap: parseInt(summary.total_gap)
      },
      filters: {
        categories: categories,
        category: category,
        search: search
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("Error fetching skills gap analysis:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching skills gap analysis",
      error: error.message
    });
  }
};

exports.getResourceUtilizationReport = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { 
      timeRange = 'current', 
      department = 'all', 
      search = '',
      page = 1,
      limit = 50
    } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Calculate date range based on timeRange parameter
    let startDate, endDate;
    const currentDate = new Date();

    switch (timeRange) {
      case 'current':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        break;
      case 'last30':
        startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = currentDate;
        break;
      case 'quarter':
        const quarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1);
        startDate = quarterStart;
        endDate = currentDate;
        break;
      case 'year':
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        endDate = currentDate;
        break;
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }

    // Build dynamic WHERE conditions
    let whereConditions = ['cr.company_id = $1'];
    let queryParams = [companyId];
    let paramCount = 1;

    // Department filter
    if (department !== 'all') {
      paramCount++;
      whereConditions.push(`cr2.id = $${paramCount}`);
      queryParams.push(department);
    }

    // Search filter
    if (search) {
      paramCount++;
      whereConditions.push(`(u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR cr2.name ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    // Main query to get resource utilization data
    const resourceUtilizationQuery = `
      WITH resource_assignments AS (
        SELECT 
          u.id as user_id,
          u.name,
          u.email,
          u.avatar,
          r.id as resource_id,
          COALESCE(cr2.name, 'Unknown') as department,
          COALESCE(r.location, 'Unknown') as location,
          COALESCE(r.hourly_rate, 0) as hourly_rate,
          COALESCE(r.currency, 'USD') as currency,
          COALESCE(r.hours_per_week, 40) as hours_per_week,
          cr2.name as department_name,
          cr2.description as department_description,
          -- Calculate actual total allocation from database allocations
          COALESCE(
            (SELECT SUM(
              CASE 
                WHEN array_position(p.resource_user_ids, u.id) IS NOT NULL 
                THEN COALESCE(p.resource_allocations[array_position(p.resource_user_ids, u.id)], 0)
                ELSE 0 
              END
            )
            FROM psa_projects p
            WHERE u.id = ANY(p.resource_user_ids)
              AND p.company_id = $1
              AND p.is_active = true 
              AND p.is_deleted = false
            ), 0
          ) as total_allocation,
          -- Count actual assigned projects
          COALESCE(
            (SELECT COUNT(DISTINCT p.id)
             FROM psa_projects p
             WHERE u.id = ANY(p.resource_user_ids)
               AND p.company_id = $1
               AND p.is_active = true 
               AND p.is_deleted = false
            ), 0
          ) as assigned_projects_count,
          -- Get project details with actual allocation percentages
          COALESCE(
            (SELECT array_agg(
              json_build_object(
                'id', p.id,
                'name', p.name,
                'allocation', COALESCE(p.resource_allocations[array_position(p.resource_user_ids, u.id)], 0),
                'role', 
                CASE 
                  WHEN p.resource_roles IS NOT NULL AND array_length(p.resource_roles, 1) > 0 THEN
                    p.resource_roles[array_position(p.resource_user_ids, u.id)]
                  ELSE 'member'
                END
              )
             )
             FROM psa_projects p
             WHERE u.id = ANY(p.resource_user_ids)
               AND p.company_id = $1
               AND p.is_active = true 
               AND p.is_deleted = false
            ), '{}'
          ) as assigned_projects
        FROM users u
        INNER JOIN company_roles cr ON u.company_role = cr.id
        LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
        LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
        WHERE ${whereConditions.join(' AND ')} AND u.status = 'enabled'
      )
      SELECT 
        user_id,
        name,
        email,
        avatar,
        resource_id,
        department,
        location,
        hourly_rate,
        currency,
        hours_per_week,
        department_name,
        department_description,
        total_allocation,
        assigned_projects_count,
        assigned_projects,
        -- Calculate utilization percentage (same as total_allocation, capped at 100%)
        LEAST(total_allocation, 100) as utilization,
        -- Calculate billable hours based on actual hours per week
        ROUND((LEAST(total_allocation, 100) / 100.0) * hours_per_week) as billable_hours,
        -- Calculate weekly revenue
        ROUND((LEAST(total_allocation, 100) / 100.0) * hours_per_week * hourly_rate) as weekly_revenue,
        -- Calculate bench time (100% - utilization)
        (100 - LEAST(total_allocation, 100)) as bench_time
      FROM resource_assignments
      ORDER BY utilization DESC, name ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    // Add pagination parameters
    queryParams.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const resourceResult = await pool.query(resourceUtilizationQuery, queryParams);
    const resources = resourceResult.rows;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM users u
      INNER JOIN company_roles cr ON u.company_role = cr.id
      LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
      LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
      WHERE ${whereConditions.join(' AND ')} AND u.status = 'enabled'
    `;
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2)); // Remove pagination params
    const totalCount = parseInt(countResult.rows[0].total_count);

    // Calculate summary statistics
    const summaryQuery = `
      WITH resource_stats AS (
        SELECT 
          u.id,
          COALESCE(
            (SELECT SUM(
              CASE 
                WHEN array_position(p.resource_user_ids, u.id) IS NOT NULL 
                THEN COALESCE(p.resource_allocations[array_position(p.resource_user_ids, u.id)], 0)
                ELSE 0 
              END
            )
            FROM psa_projects p
            WHERE u.id = ANY(p.resource_user_ids)
              AND p.company_id = $1
              AND p.is_active = true 
              AND p.is_deleted = false
            ), 0
          ) as total_allocation,
          COALESCE(r.hourly_rate, 0) as hourly_rate,
          COALESCE(r.hours_per_week, 40) as hours_per_week
        FROM users u
        INNER JOIN company_roles cr ON u.company_role = cr.id
        LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
        LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
        WHERE ${whereConditions.join(' AND ')} AND u.status = 'enabled'
      )
      SELECT 
        COUNT(*) as total_resources,
        ROUND(AVG(LEAST(total_allocation, 100))) as average_utilization,
        SUM(ROUND((LEAST(total_allocation, 100) / 100.0) * hours_per_week * hourly_rate)) as total_weekly_revenue,
        COUNT(CASE WHEN LEAST(total_allocation, 100) < 60 THEN 1 END) as bench_resources,
        COUNT(CASE WHEN LEAST(total_allocation, 100) >= 90 THEN 1 END) as over_utilized,
        COUNT(CASE WHEN LEAST(total_allocation, 100) >= 80 AND LEAST(total_allocation, 100) < 90 THEN 1 END) as optimal_utilized,
        COUNT(CASE WHEN LEAST(total_allocation, 100) >= 60 AND LEAST(total_allocation, 100) < 80 THEN 1 END) as under_utilized,
        COUNT(CASE WHEN LEAST(total_allocation, 100) < 60 THEN 1 END) as available_resources
      FROM resource_stats
    `;
    const summaryResult = await pool.query(summaryQuery, queryParams.slice(0, -2));
    const summary = summaryResult.rows[0];

    // Get department list for filters
    const departmentsQuery = `
      SELECT DISTINCT cr2.name as department_name
      FROM users u
      INNER JOIN company_roles cr ON u.company_role = cr.id
      LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
      LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
      WHERE cr.company_id = $1 AND cr2.name IS NOT NULL
      ORDER BY cr2.name ASC
    `;
    const departmentsResult = await pool.query(departmentsQuery, [companyId]);
    const departments = departmentsResult.rows.map(row => row.department_name);

    // Format response data
    const formattedResources = resources.map(resource => ({
      id: resource.user_id,
      name: resource.name,
      email: resource.email,
      avatar: resource.avatar ? `${process.env.API_URL || 'http://localhost:5000'}/avatars/${resource.avatar}` : null,
      department: resource.department_name || resource.department || 'Unknown',
      location: resource.location || 'Unknown',
      utilization: Math.round(resource.utilization),
      hourlyRate: resource.hourly_rate || 0,
      currency: resource.currency || 'USD',
      hoursPerWeek: resource.hours_per_week || 40,
      billableHours: resource.billable_hours,
      weeklyRevenue: resource.weekly_revenue,
      assignedProjects: resource.assigned_projects_count,
      assignedProjectsList: resource.assigned_projects,
      benchTime: Math.round(resource.bench_time),
      status: resource.utilization >= 90 ? 'over-utilized' :
              resource.utilization >= 80 ? 'optimal' :
              resource.utilization >= 60 ? 'under-utilized' : 'available'
    }));

    const response = {
      resources: formattedResources,
      summary: {
        totalResources: parseInt(summary.total_resources),
        averageUtilization: Math.round(summary.average_utilization || 0),
        totalWeeklyRevenue: Math.round(summary.total_weekly_revenue || 0),
        benchResources: parseInt(summary.bench_resources),
        overUtilized: parseInt(summary.over_utilized),
        optimalUtilized: parseInt(summary.optimal_utilized),
        underUtilized: parseInt(summary.under_utilized),
        availableResources: parseInt(summary.available_resources)
      },
      distribution: {
        overUtilized: parseInt(summary.over_utilized),
        optimal: parseInt(summary.optimal_utilized),
        underUtilized: parseInt(summary.under_utilized),
        available: parseInt(summary.available_resources)
      },
      filters: {
        departments: departments,
        timeRange: timeRange,
        department: department,
        search: search
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      },
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        range: timeRange
      }
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("Error fetching resource utilization report:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching resource utilization report",
      error: error.message
    });
  }
};

// Get User Stories for My Work Page
// ========================================================

const getUserStories = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to get all stories assigned to the current user
    const query = `
      SELECT 
        bi.id,
        bi.title,
        bi.description,
        bi.type,
        bi.status,
        bi.priority,
        bi.story_points,
        bi.created_at,
        bi.updated_at,
        bi.parent_id,
        bi.sprint_id,
        p.name as project_name,
        p.description as project_description,
        p.methodology,
        p.end_date as project_end_date,
        s.name as sprint_name,
        s.start_date as sprint_start_date,
        s.end_date as sprint_end_date,
        s.status as sprint_status,
        s.end_date as due_date,
        CASE 
          WHEN s.end_date < NOW() AND bi.status NOT IN ('done', 'completed', 'cancelled') 
          THEN EXTRACT(DAY FROM NOW() - s.end_date)::INTEGER
          ELSE 0 
        END as overdue_days,
        parent_bi.title as feature_title,
        (SELECT COUNT(*) FROM psa_story_discussions WHERE story_id = bi.id AND is_deleted = false) as comment_count,
        bi.tags,
        bi.acceptance_criteria,
        CASE 
          WHEN bi.updated_at > NOW() - INTERVAL '24 hours' AND bi.updated_at > bi.created_at 
          THEN true
          WHEN EXISTS (
            SELECT 1 FROM psa_story_discussions 
            WHERE story_id = bi.id 
            AND created_at > NOW() - INTERVAL '24 hours'
            AND is_deleted = false
          )
          THEN true
          ELSE false
        END as has_unread_updates
      FROM psa_backlog_items bi
      LEFT JOIN psa_projects p ON bi.project_id = p.id
      LEFT JOIN psa_sprints s ON (
        CASE 
          WHEN bi.sprint_id IS NOT NULL THEN bi.sprint_id = s.id
          ELSE s.project_id = bi.project_id AND s.id = (
            SELECT id FROM psa_sprints 
            WHERE project_id = bi.project_id 
            AND is_deleted = false 
            AND status != 'completed'
            ORDER BY start_date DESC 
            LIMIT 1
          )
        END
      )
      LEFT JOIN psa_backlog_items parent_bi ON bi.parent_id = parent_bi.id
      WHERE bi.assignee_id = $1
        AND bi.type = 'story'
        AND bi.is_deleted = false
        AND p.is_active = true
        AND p.is_deleted = false
      ORDER BY 
        CASE bi.status
          WHEN 'in_progress' THEN 1
          WHEN 'review' THEN 2
          WHEN 'done' THEN 3
          WHEN 'completed' THEN 3
          WHEN 'backlog' THEN 4
          ELSE 5
        END,
        bi.priority DESC,
        s.end_date ASC NULLS LAST
      
    `;

    const result = await pool.query(query, [parseInt(userId)]);

    // Calculate summary statistics
    const stories = result.rows;
    const stats = {
      total: stories.length,
      in_progress: stories.filter(s => s.status === 'in_progress').length,
      in_review: stories.filter(s => s.status === 'review').length,
      completed: stories.filter(s => s.status === 'done').length,
      overdue: stories.filter(s => s.overdue_days > 0).length,
      unread_count: stories.filter(s => s.has_unread_updates === true).length
    };

    res.json({
      success: true,
      data: {
        stories: stories,
        summary_stats: stats,
        total_count: stories.length
      }
    });

  } catch (error) {
    console.error('Error fetching user stories:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: error.message
    });
  }
};

// Get Quarterly Utilization Trends
// ========================================================

exports.getQuarterlyUtilizationTrends = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;

    // Generate 7 quarters: 3 previous, current, 3 future
    const quarters = [];
    
    // Previous 3 quarters
    for (let i = 3; i >= 1; i--) {
      const quarterDate = new Date(currentDate);
      quarterDate.setMonth(currentDate.getMonth() - (i * 3));
      const year = quarterDate.getFullYear();
      const quarter = Math.floor(quarterDate.getMonth() / 3) + 1;
      
      quarters.push({
        year,
        quarter,
        label: `Q${quarter} ${year}`,
        startDate: new Date(year, (quarter - 1) * 3, 1),
        endDate: new Date(year, quarter * 3, 0),
        type: 'historical'
      });
    }

    // Current quarter
    quarters.push({
      year: currentYear,
      quarter: currentQuarter,
      label: `Q${currentQuarter} ${currentYear}`,
      startDate: new Date(currentYear, (currentQuarter - 1) * 3, 1),
      endDate: new Date(currentYear, currentQuarter * 3, 0),
      type: 'current'
    });

    // Next 3 quarters
    for (let i = 1; i <= 3; i++) {
      const quarterDate = new Date(currentDate);
      quarterDate.setMonth(currentDate.getMonth() + (i * 3));
      const year = quarterDate.getFullYear();
      const quarter = Math.floor(quarterDate.getMonth() / 3) + 1;
      
      quarters.push({
        year,
        quarter,
        label: `Q${quarter} ${year}`,
        startDate: new Date(year, (quarter - 1) * 3, 1),
        endDate: new Date(year, quarter * 3, 0),
        type: 'projected'
      });
    }

    // Calculate utilization for each quarter
    const quarterlyData = [];

    for (const quarter of quarters) {
      let utilization = 0;
      let bench = 100;

      if (quarter.type === 'historical') {
        // For historical quarters, calculate actual utilization during that quarter
        const utilizationQuery = `
          WITH resource_utilization AS (
            SELECT 
              u.id as user_id,
              COALESCE(
                (SELECT SUM(
                  CASE 
                    WHEN array_position(p.resource_user_ids, u.id) IS NOT NULL 
                    THEN COALESCE(p.resource_allocations[array_position(p.resource_user_ids, u.id)], 0)
                    ELSE 0 
                  END
                )
                FROM psa_projects p
                WHERE u.id = ANY(p.resource_user_ids)
                  AND p.company_id = $1
                  AND p.is_active = true 
                  AND p.is_deleted = false
                  AND (
                    (p.start_date <= $2 AND p.end_date >= $3) OR
                    (p.start_date >= $2 AND p.start_date <= $3) OR
                    (p.end_date >= $2 AND p.end_date <= $3)
                  )
                ), 0
              ) as total_allocation
            FROM users u
            INNER JOIN company_roles cr ON u.company_role = cr.id
            LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
            WHERE cr.company_id = $1 AND u.status = 'enabled'
          )
          SELECT 
            COUNT(*) as total_resources,
            ROUND(AVG(LEAST(total_allocation, 100))) as average_utilization
          FROM resource_utilization
        `;

        const result = await pool.query(utilizationQuery, [
          companyId,
          quarter.startDate.toISOString(),
          quarter.endDate.toISOString()
        ]);

        if (result.rows.length > 0) {
          utilization = result.rows[0].average_utilization || 0;
          bench = 100 - utilization;
        }
      } else if (quarter.type === 'current') {
        // For current quarter, calculate utilization based on projects active RIGHT NOW
        const currentUtilizationQuery = `
          WITH resource_utilization AS (
            SELECT 
              u.id as user_id,
              COALESCE(
                (SELECT SUM(
                  CASE 
                    WHEN array_position(p.resource_user_ids, u.id) IS NOT NULL 
                    THEN COALESCE(p.resource_allocations[array_position(p.resource_user_ids, u.id)], 0)
                    ELSE 0 
                  END
                )
                FROM psa_projects p
                WHERE u.id = ANY(p.resource_user_ids)
                  AND p.company_id = $1
                  AND p.is_active = true 
                  AND p.is_deleted = false
                  AND p.start_date <= NOW()
                  AND p.end_date >= NOW()
                ), 0
              ) as total_allocation
            FROM users u
            INNER JOIN company_roles cr ON u.company_role = cr.id
            LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
            WHERE cr.company_id = $1 AND u.status = 'enabled'
          )
          SELECT 
            COUNT(*) as total_resources,
            ROUND(AVG(LEAST(total_allocation, 100))) as average_utilization
          FROM resource_utilization
        `;

        const result = await pool.query(currentUtilizationQuery, [companyId]);      
        
        // Debug: Check what projects are currently active
        const debugQuery = `
          SELECT 
            p.id,
            p.name,
            p.start_date,
            p.end_date,
            p.is_active,
            p.resource_user_ids,
            p.resource_allocations
          FROM psa_projects p
          WHERE p.company_id = $1
            AND p.is_active = true 
            AND p.is_deleted = false
            AND p.start_date <= NOW()
            AND p.end_date >= NOW()
        `;
        
        const debugResult = await pool.query(debugQuery, [companyId]);       

        if (result.rows.length > 0) {
          utilization = result.rows[0].average_utilization || 0;
          bench = 100 - utilization;
        } 
      } else {
        // For projected quarters, calculate based on project end dates and financial projections
        const projectionQuery = `
          WITH project_projections AS (
            SELECT 
              p.id,
              p.name,
              p.end_date,
              p.budget_hours,
              p.resource_user_ids,
              p.resource_allocations,
              CASE 
                WHEN p.end_date >= $2 AND p.end_date <= $3 THEN 1
                ELSE 0
              END as is_active_in_quarter
            FROM psa_projects p
            WHERE p.company_id = $1
              AND p.is_active = true 
              AND p.is_deleted = false
              AND p.end_date >= $2
          ),
          resource_projections AS (
            SELECT 
              u.id as user_id,
              COALESCE(
                (SELECT SUM(
                  CASE 
                    WHEN array_position(pp.resource_user_ids, u.id) IS NOT NULL 
                    THEN COALESCE(pp.resource_allocations[array_position(pp.resource_user_ids, u.id)], 0) * pp.is_active_in_quarter
                    ELSE 0 
                  END
                )
                FROM project_projections pp
                WHERE u.id = ANY(pp.resource_user_ids)
                ), 0
              ) as projected_allocation
            FROM users u
            INNER JOIN company_roles cr ON u.company_role = cr.id
            WHERE cr.company_id = $1 AND u.status = 'enabled'
          )
          SELECT 
            COUNT(*) as total_resources,
            ROUND(AVG(LEAST(projected_allocation, 100))) as projected_utilization
          FROM resource_projections
        `;

        const result = await pool.query(projectionQuery, [
          companyId,
          quarter.startDate.toISOString(),
          quarter.endDate.toISOString()
        ]);

        if (result.rows.length > 0) {
          utilization = result.rows[0].projected_utilization || 0;
          bench = 100 - utilization;
        }
      }

      quarterlyData.push({
        date: quarter.startDate.toISOString(),
        label: quarter.label,
        utilization: Math.round(utilization),
        bench: Math.round(bench),
        type: quarter.type,
        year: quarter.year,
        quarter: quarter.quarter
      });
    }

    res.status(200).json({
      success: true,
      data: {
        quarters: quarterlyData,
        currentQuarter: {
          year: currentYear,
          quarter: currentQuarter,
          label: `Q${currentQuarter} ${currentYear}`
        },
        summary: {
          currentUtilization: quarterlyData.find(q => q.type === 'current')?.utilization || 0,
          currentBench: quarterlyData.find(q => q.type === 'current')?.bench || 100,
          averageHistoricalUtilization: quarterlyData.filter(q => q.type === 'historical').length > 0 ? 
            Math.round(
              quarterlyData
                .filter(q => q.type === 'historical')
                .reduce((sum, q) => sum + q.utilization, 0) / quarterlyData.filter(q => q.type === 'historical').length
            ) : 0,
          projectedUtilization: quarterlyData.filter(q => q.type === 'projected').length > 0 ?
            Math.round(
              quarterlyData
                .filter(q => q.type === 'projected')
                .reduce((sum, q) => sum + q.utilization, 0) / quarterlyData.filter(q => q.type === 'projected').length
            ) : 0
        }
      }
    });

  } catch (error) {
    console.error("Error fetching quarterly utilization trends:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching quarterly utilization trends",
      error: error.message
    });
  }
};

// Get Capacity Planning Analysis
// ========================================================
// TEMPLATE MANAGEMENT APIs
// ========================================================

// Get all templates for a company
exports.getAllTemplates = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { 
      type = 'all',
      category = 'all',
      priority = 'all',
      search = '',
      page = 1,
      limit = 50
    } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Build dynamic WHERE conditions
    let whereConditions = ['pt.company_id = $1', 'pt.is_deleted = false'];
    let queryParams = [companyId];
    let paramCount = 1;

    // Type filter
    if (type !== 'all') {
      paramCount++;
      whereConditions.push(`pt.type = $${paramCount}`);
      queryParams.push(type);
    }

    // Category filter
    if (category !== 'all') {
      paramCount++;
      whereConditions.push(`pt.category = $${paramCount}`);
      queryParams.push(category);
    }

    // Priority filter
    if (priority !== 'all') {
      paramCount++;
      whereConditions.push(`pt.priority = $${paramCount}`);
      queryParams.push(priority);
    }

    // Search filter
    if (search) {
      paramCount++;
      whereConditions.push(`(pt.name ILIKE $${paramCount} OR pt.description ILIKE $${paramCount} OR pt.category ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    // Main query to get templates
    const templatesQuery = `
      SELECT 
        pt.id,
        pt.name,
        pt.description,
        pt.type,
        pt.category,
        pt.estimated_hours,
        pt.story_points,
        pt.required_skills,
        pt.acceptance_criteria,
        pt.definition_of_done,
        pt.priority,
        pt.tags,
        pt.usage_count,
        pt.is_active,
        pt.created_at,
        pt.updated_at,
        pt.created_by,
        pt.user_id,
        pt.company_id,
        pt.project_id,
        pt.parent_id,
        pt.estimated_cost,
        pt.budget_hours,
        pt.resource_count,
        pt.resource_details,
        pt.all_required_skills,
        pt.duration_weeks,
        u.name as created_by_name
      FROM psa_project_templates pt
      LEFT JOIN users u ON pt.created_by = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY pt.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    // Add pagination parameters
    queryParams.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const templatesResult = await pool.query(templatesQuery, queryParams);
    const templates = templatesResult.rows;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM psa_project_templates pt
      WHERE ${whereConditions.join(' AND ')}
    `;
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].total_count);

    // Get categories for filters
    const categoriesQuery = `
      SELECT DISTINCT category
      FROM psa_project_templates
      WHERE company_id = $1 AND is_deleted = false
      ORDER BY category ASC
    `;
    const categoriesResult = await pool.query(categoriesQuery, [companyId]);
    const categories = categoriesResult.rows.map(row => row.category);

    // Calculate template statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_templates,
        COUNT(CASE WHEN type = 'epic' THEN 1 END) as epic_templates,
        COUNT(CASE WHEN type = 'feature' THEN 1 END) as feature_templates,
        COUNT(CASE WHEN type = 'story' THEN 1 END) as story_templates,
        COUNT(CASE WHEN type = 'task' THEN 1 END) as task_templates,
        COUNT(CASE WHEN type = 'bug' THEN 1 END) as bug_templates
      FROM psa_project_templates
      WHERE company_id = $1 AND is_deleted = false
    `;
    const statsResult = await pool.query(statsQuery, [companyId]);
    const stats = statsResult.rows[0];

    // Format response data and calculate stats for each template
    const formattedTemplates = await Promise.all(templates.map(async (template) => {
      let stats = null;
      
      // Calculate stats for ALL templates (both project-based and manually created)
      try {
        // Get all items for this template (epics, features, stories) - RECURSIVE!
        const itemsQuery = `
          WITH RECURSIVE template_hierarchy AS (
            -- Base case: the template itself
            SELECT * FROM psa_project_templates 
            WHERE id = $1 AND company_id = $2 AND is_deleted = false
            
            UNION ALL
            
            -- Recursive case: all children
            SELECT pt.* FROM psa_project_templates pt
            INNER JOIN template_hierarchy th ON pt.parent_id = th.id
            WHERE pt.company_id = $2 AND pt.is_deleted = false
          )
          SELECT * FROM template_hierarchy
        `;
        const itemsResult = await pool.query(itemsQuery, [template.id, template.company_id]);
        const items = itemsResult.rows;
        
        // Debug logging for template stats calculation       
        
        // Calculate stats
        const totalStoryPoints = items.reduce((sum, item) => sum + (item.story_points || 0), 0);
        const totalEstimatedHours = items.reduce((sum, item) => sum + (item.estimated_hours || 0), 0);
        const effectiveHours = totalEstimatedHours > 0 ? totalEstimatedHours : totalStoryPoints * 8;
        
        // Collect unique skills from all items
        const allSkills = new Set();
        items.forEach(item => {
          if (item.required_skills && Array.isArray(item.required_skills)) {
            item.required_skills.forEach(skill => allSkills.add(skill));
          }
        });       
       
        
        let totalResources = 0;
        let estimatedCost = 0;
        
        // Use the projected total from database if available, otherwise calculate
        if (template.estimated_cost && template.estimated_cost > 0) {
          // Use the projected total that was saved when creating the template
          estimatedCost = template.estimated_cost;
          totalResources = template.resource_count || 0;          
         
        } else {
          // Fallback: Calculate cost using old logic for templates without projected total
          if (template.project_id) {
            const projectQuery = `SELECT resource_user_ids FROM psa_projects WHERE id = $1`;
            const projectResult = await pool.query(projectQuery, [template.project_id]);
            totalResources = projectResult.rows[0]?.resource_user_ids?.length || 0;
            
            // Calculate cost if resources exist
            if (totalResources > 0 && projectResult.rows[0]?.resource_user_ids) {
              const resourcesQuery = `
                SELECT r.hourly_rate 
                FROM psa_resources r 
                WHERE r.user_id = ANY($1) AND r.is_deleted = false
              `;
              const resourcesResult = await pool.query(resourcesQuery, [projectResult.rows[0].resource_user_ids]);
              
              if (resourcesResult.rows.length > 0) {
                const avgHourlyRate = resourcesResult.rows.reduce((sum, r) => 
                  sum + (parseFloat(r.hourly_rate) || 0), 0
                ) / resourcesResult.rows.length;
                estimatedCost = effectiveHours * avgHourlyRate;
              }
            }
          } else {
            // For manually created templates, calculate estimated cost using company's average hourly rate
            const avgRateQuery = `
              SELECT AVG(CAST(r.hourly_rate AS DECIMAL)) as avg_rate
              FROM psa_resources r
              INNER JOIN users u ON r.user_id = u.id
              INNER JOIN company_roles cr ON u.company_role = cr.id
              WHERE cr.company_id = $1 
                AND r.is_deleted = false 
                AND r.hourly_rate IS NOT NULL
                AND r.hourly_rate != '0'
            `;
            const avgRateResult = await pool.query(avgRateQuery, [template.company_id]);
            const avgHourlyRate = parseFloat(avgRateResult.rows[0]?.avg_rate) || 0;
            
            if (avgHourlyRate > 0) {
              estimatedCost = effectiveHours * avgHourlyRate;
            }
            
            // Estimate resources needed based on skills required
            totalResources = allSkills.size > 0 ? allSkills.size : 1;
          }
        }
        
        stats = {
          totalResources,
          totalSkills: allSkills.size,
          estimatedCost: Math.round(estimatedCost * 100) / 100,
          effectiveHours
        };
      } catch (error) {
        console.error(`Error calculating stats for template ${template.id}:`, error);
      }
      
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        category: template.category,
        estimatedHours: template.estimated_hours || 0,
        storyPoints: template.story_points || 1,
        requiredSkills: template.required_skills || [],
        acceptanceCriteria: template.acceptance_criteria || [],
        definitionOfDone: template.definition_of_done || [],
        priority: template.priority || 'medium',
        tags: template.tags || [],
        usageCount: template.usage_count || 0,
        isActive: template.is_active,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        createdBy: template.created_by,
        createdByName: template.created_by_name,
        userId: template.user_id,
        companyId: template.company_id,
        projectId: template.project_id,
        parentId: template.parent_id,
        // New columns for CRM opportunity integration
        estimatedCost: parseFloat(template.estimated_cost) || 0,
        budgetHours: template.budget_hours || 0,
        resourceCount: template.resource_count || 0,
        resourceDetails: template.resource_details || [],
        allRequiredSkills: template.all_required_skills || [],
        durationWeeks: template.duration_weeks || 0,
        stats
      };
    }));

    const response = {
      templates: formattedTemplates,
      stats: {
        totalTemplates: parseInt(stats.total_templates),
        epicTemplates: parseInt(stats.epic_templates),
        featureTemplates: parseInt(stats.feature_templates),
        storyTemplates: parseInt(stats.story_templates),
        taskTemplates: parseInt(stats.task_templates),
        bugTemplates: parseInt(stats.bug_templates)
      },
      filters: {
        categories: categories,
        type: type,
        category: category,
        priority: priority,
        search: search
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching templates",
      error: error.message
    });
  }
};

// Get single template by ID
exports.getTemplateById = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { companyId } = req.query;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: "Template ID is required",
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const templateQuery = `
      SELECT 
        pt.id,
        pt.name,
        pt.description,
        pt.type,
        pt.category,
        pt.estimated_hours,
        pt.story_points,
        pt.required_skills,
        pt.acceptance_criteria,
        pt.definition_of_done,
        pt.priority,
        pt.tags,
        pt.usage_count,
        pt.is_active,
        pt.created_at,
        pt.updated_at,
        pt.created_by,
        pt.user_id,
        pt.company_id,
        pt.project_id,
        pt.parent_id,
        pt.estimated_cost,
        pt.budget_hours,
        pt.resource_count,
        pt.resource_details,
        pt.all_required_skills,
        pt.duration_weeks,
        u.name as created_by_name
      FROM psa_project_templates pt
      LEFT JOIN users u ON pt.created_by = u.id
      WHERE pt.id = $1 AND pt.company_id = $2
    `;

    const templateResult = await pool.query(templateQuery, [templateId, companyId]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    const template = templateResult.rows[0];

    const formattedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      type: template.type,
      category: template.category,
      estimatedHours: template.estimated_hours || 0,
      storyPoints: template.story_points || 1,
      requiredSkills: template.required_skills || [],
      acceptanceCriteria: template.acceptance_criteria || [],
      definitionOfDone: template.definition_of_done || [],
      priority: template.priority || 'medium',
      tags: template.tags || [],
      usageCount: template.usage_count || 0,
      isActive: template.is_active,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      createdBy: template.created_by,
      createdByName: template.created_by_name,
      userId: template.user_id,
      companyId: template.company_id,
      projectId: template.project_id,
      parentId: template.parent_id
    };

    // If this is a hierarchical template (parent template), fetch its children
    // Check if it has epics as children or if it's marked as hierarchical
    const hasEpicChildren = await pool.query(
      `SELECT COUNT(*) as count FROM psa_project_templates WHERE parent_id = $1 AND type = 'epic' AND company_id = $2`,
      [templateId, companyId]
    );
    
    if (template.type === 'hierarchical' || !template.parent_id || hasEpicChildren.rows[0].count > 0) {
      // Get ALL child templates recursively (epics, features, stories)
      const childrenQuery = `
        WITH RECURSIVE template_hierarchy AS (
          -- Base case: direct children of the main template
          SELECT 
            pt.id,
            pt.name,
            pt.description,
            pt.type,
            pt.category,
            pt.estimated_hours,
            pt.story_points,
            pt.required_skills,
            pt.acceptance_criteria,
            pt.definition_of_done,
            pt.priority,
            pt.tags,
            pt.usage_count,
            pt.is_active,
            pt.created_at,
            pt.updated_at,
            pt.created_by,
            pt.user_id,
            pt.company_id,
            pt.project_id,
            pt.parent_id,
            u.name as created_by_name,
            1 as level
          FROM psa_project_templates pt
          LEFT JOIN users u ON pt.created_by = u.id
          WHERE pt.parent_id = $1 AND pt.company_id = $2
          
          UNION ALL
          
          -- Recursive case: children of children
          SELECT 
            pt.id,
            pt.name,
            pt.description,
            pt.type,
            pt.category,
            pt.estimated_hours,
            pt.story_points,
            pt.required_skills,
            pt.acceptance_criteria,
            pt.definition_of_done,
            pt.priority,
            pt.tags,
            pt.usage_count,
            pt.is_active,
            pt.created_at,
            pt.updated_at,
            pt.created_by,
            pt.user_id,
            pt.company_id,
            pt.project_id,
            pt.parent_id,
            u.name as created_by_name,
            th.level + 1
          FROM psa_project_templates pt
          LEFT JOIN users u ON pt.created_by = u.id
          INNER JOIN template_hierarchy th ON pt.parent_id = th.id
          WHERE pt.company_id = $2 AND th.level < 3
        )
        SELECT * FROM template_hierarchy
        ORDER BY level, type, created_at
      `;

      const childrenResult = await pool.query(childrenQuery, [templateId, companyId]);
      const children = childrenResult.rows;

      // Build hierarchical structure
      const epics = children.filter(child => child.type === 'epic');
      const features = children.filter(child => child.type === 'feature');
      const stories = children.filter(child => child.type === 'story');

      // Build epics with their features and stories
      const epicsWithChildren = epics.map(epic => {
        const epicFeatures = features.filter(f => f.parent_id === epic.id);
        const featuresWithStories = epicFeatures.map(feature => {
          const featureStories = stories.filter(s => s.parent_id === feature.id);
          return {
            id: feature.id,
            name: feature.name,
            description: feature.description,
            type: feature.type,
            category: feature.category,
            estimatedHours: feature.estimated_hours || 0,
            storyPoints: feature.story_points || 0,
            requiredSkills: feature.required_skills || [],
            acceptanceCriteria: feature.acceptance_criteria || [],
            definitionOfDone: feature.definition_of_done || [],
            priority: feature.priority || 'medium',
            tags: feature.tags || [],
            stories: featureStories.map(story => ({
              id: story.id,
              name: story.name,
              description: story.description,
              type: story.type,
              category: story.category,
              estimatedHours: story.estimated_hours || 0,
              storyPoints: story.story_points || 0,
              requiredSkills: story.required_skills || [],
              acceptanceCriteria: story.acceptance_criteria || [],
              definitionOfDone: story.definition_of_done || [],
              priority: story.priority || 'medium',
              tags: story.tags || []
            }))
          };
        });

        return {
          id: epic.id,
          name: epic.name,
          description: epic.description,
          type: epic.type,
          category: epic.category,
          estimatedHours: epic.estimated_hours || 0,
          storyPoints: epic.story_points || 0,
          requiredSkills: epic.required_skills || [],
          acceptanceCriteria: epic.acceptance_criteria || [],
          definitionOfDone: epic.definition_of_done || [],
          priority: epic.priority || 'medium',
          tags: epic.tags || [],
          features: featuresWithStories
        };
      });

      // Add hierarchical structure to the template
      formattedTemplate.epics = epicsWithChildren;
      formattedTemplate.type = 'hierarchical'; // Ensure it's marked as hierarchical     
    }

    res.status(200).json({
      success: true,
      data: formattedTemplate
    });

  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching template",
      error: error.message
    });
  }
};

// Create new template
exports.createTemplate = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { id: userId } = req.user;
    const {
      name,
      description,
      type,
      category,
      estimatedHours = 0,
      storyPoints = 1,
      requiredSkills = [],
      acceptanceCriteria = [],
      definitionOfDone = [],
      priority = 'medium',
      tags = []
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    if (!name || !description || !type || !category) {
      return res.status(400).json({
        success: false,
        message: "Name, description, type, and category are required",
      });
    }

    // Validate type
    const validTypes = ['epic', 'feature', 'story', 'task', 'bug'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be one of: " + validTypes.join(', '),
      });
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority. Must be one of: " + validPriorities.join(', '),
      });
    }

    const templateQuery = `
      INSERT INTO psa_project_templates (
        name,
        description,
        type,
        category,
        estimated_hours,
        story_points,
        required_skills,
        acceptance_criteria,
        definition_of_done,
        priority,
        tags,
        created_by,
        user_id,
        company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const templateResult = await pool.query(templateQuery, [
      name,
      description,
      type,
      category,
      estimatedHours,
      storyPoints,
      requiredSkills,
      acceptanceCriteria,
      definitionOfDone,
      priority,
      tags,
      userId,
      userId,
      companyId
    ]);

    const template = templateResult.rows[0];

    const formattedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      type: template.type,
      category: template.category,
      estimatedHours: template.estimated_hours || 0,
      storyPoints: template.story_points || 1,
      requiredSkills: template.required_skills || [],
      acceptanceCriteria: template.acceptance_criteria || [],
      definitionOfDone: template.definition_of_done || [],
      priority: template.priority || 'medium',
      tags: template.tags || [],
      usageCount: template.usage_count || 0,
      isActive: template.is_active,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      createdBy: template.created_by,
      userId: template.user_id,
      companyId: template.company_id,
      projectId: template.project_id
    };

    res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: formattedTemplate
    });

  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating template",
      error: error.message
    });
  }
};

// Create hierarchical template
exports.createHierarchicalTemplate = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { id: userId } = req.user;
    const {
      templateName,
      templateDescription,
      category,
      epics
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    if (!templateName || !templateDescription || !category) {
      return res.status(400).json({
        success: false,
        message: "Template name, description, and category are required",
      });
    }

    if (!epics || !Array.isArray(epics) || epics.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one epic is required",
      });
    }

    // Validate epics structure
    for (const epic of epics) {
      if (!epic.name || !epic.description) {
        return res.status(400).json({
          success: false,
          message: "All epics must have a name and description",
        });
      }
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const createdTemplates = [];

      // Create epic templates first
      for (const epic of epics) {
        const epicQuery = `
          INSERT INTO psa_project_templates (
            name,
            description,
            type,
            category,
            estimated_hours,
            priority,
            definition_of_done,
            tags,
            created_by,
            user_id,
            company_id,
            parent_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `;

        const epicResult = await client.query(epicQuery, [
          epic.name,
          epic.description,
          'epic',
          category,
          epic.estimatedHours || 0,
          epic.priority || 'medium',
          epic.definitionOfDone || [],
          epic.tags || [],
          userId,
          userId,
          companyId,
          null // Epic has no parent
        ]);

        const epicTemplate = epicResult.rows[0];
        createdTemplates.push(epicTemplate);

        // Create feature templates for this epic
        if (epic.features && Array.isArray(epic.features)) {
          for (const feature of epic.features) {
            if (!feature.name || !feature.description) {
              continue; // Skip invalid features
            }

            const featureQuery = `
              INSERT INTO psa_project_templates (
                name,
                description,
                type,
                category,
                estimated_hours,
                priority,
                definition_of_done,
                tags,
                created_by,
                user_id,
                company_id,
                parent_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              RETURNING *
            `;

            const featureResult = await client.query(featureQuery, [
              feature.name,
              feature.description,
              'feature',
              category,
              feature.estimatedHours || 0,
              feature.priority || 'medium',
              feature.definitionOfDone || [],
              feature.tags || [],
              userId,
              userId,
              companyId,
              epicTemplate.id // Feature's parent is the epic
            ]);

            const featureTemplate = featureResult.rows[0];
            createdTemplates.push(featureTemplate);

            // Create story templates for this feature
            if (feature.stories && Array.isArray(feature.stories)) {
              for (const story of feature.stories) {
                if (!story.name || !story.description) {
                  continue; // Skip invalid stories
                }

                const storyQuery = `
                  INSERT INTO psa_project_templates (
                    name,
                    description,
                    type,
                    category,
                    estimated_hours,
                    story_points,
                    priority,
                    required_skills,
                    acceptance_criteria,
                    definition_of_done,
                    tags,
                    created_by,
                    user_id,
                    company_id,
                    parent_id
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                  RETURNING *
                `;

                const storyResult = await client.query(storyQuery, [
                  story.name,
                  story.description,
                  'story',
                  category,
                  story.estimatedHours || 0,
                  story.storyPoints || 1,
                  story.priority || 'medium',
                  story.requiredSkills || [],
                  story.acceptanceCriteria || [],
                  story.definitionOfDone || [],
                  story.tags || [],
                  userId,
                  userId,
                  companyId,
                  featureTemplate.id // Story's parent is the feature
                ]);

                const storyTemplate = storyResult.rows[0];
                createdTemplates.push(storyTemplate);
              }
            }
          }
        }
      }

      await client.query('COMMIT');

      // Format the response
      const formattedTemplates = createdTemplates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        category: template.category,
        estimatedHours: template.estimated_hours || 0,
        storyPoints: template.story_points || 1,
        requiredSkills: template.required_skills || [],
        acceptanceCriteria: template.acceptance_criteria || [],
        definitionOfDone: template.definition_of_done || [],
        priority: template.priority || 'medium',
        tags: template.tags || [],
        usageCount: template.usage_count || 0,
        isActive: template.is_active,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        createdBy: template.created_by,
        userId: template.user_id,
        companyId: template.company_id,
        projectId: template.project_id,
        parentId: template.parent_id
      }));

      res.status(201).json({
        success: true,
        message: `Hierarchical template created successfully with ${createdTemplates.length} items`,
        data: {
          templateName,
          templateDescription,
          category,
          totalItems: createdTemplates.length,
          epicsCount: epics.length,
          templates: formattedTemplates
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error("Error creating hierarchical template:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating hierarchical template",
      error: error.message
    });
  }
};

// Update template
exports.updateTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { companyId } = req.query;
    const { id: userId } = req.user;
    const {
      name,
      description,
      type,
      category,
      estimatedHours,
      storyPoints,
      requiredSkills,
      acceptanceCriteria,
      definitionOfDone,
      priority,
      tags,
      isActive
    } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: "Template ID is required",
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(name);
    }

    if (description !== undefined) {
      paramCount++;
      updateFields.push(`description = $${paramCount}`);
      updateValues.push(description);
    }

    if (type !== undefined) {
      paramCount++;
      updateFields.push(`type = $${paramCount}`);
      updateValues.push(type);
    }

    if (category !== undefined) {
      paramCount++;
      updateFields.push(`category = $${paramCount}`);
      updateValues.push(category);
    }

    if (estimatedHours !== undefined) {
      paramCount++;
      updateFields.push(`estimated_hours = $${paramCount}`);
      updateValues.push(estimatedHours);
    }

    if (storyPoints !== undefined) {
      paramCount++;
      updateFields.push(`story_points = $${paramCount}`);
      updateValues.push(storyPoints);
    }

    if (requiredSkills !== undefined) {
      paramCount++;
      updateFields.push(`required_skills = $${paramCount}`);
      updateValues.push(Array.isArray(requiredSkills) ? requiredSkills : []);
    }

    if (acceptanceCriteria !== undefined) {
      paramCount++;
      updateFields.push(`acceptance_criteria = $${paramCount}`);
      updateValues.push(Array.isArray(acceptanceCriteria) ? acceptanceCriteria : []);
    }

    if (definitionOfDone !== undefined) {
      paramCount++;
      updateFields.push(`definition_of_done = $${paramCount}`);
      updateValues.push(Array.isArray(definitionOfDone) ? definitionOfDone : []);
    }

    if (priority !== undefined) {
      paramCount++;
      updateFields.push(`priority = $${paramCount}`);
      updateValues.push(priority);
    }

    if (tags !== undefined) {
      paramCount++;
      updateFields.push(`tags = $${paramCount}`);
      updateValues.push(Array.isArray(tags) ? tags : []);
    }

    if (isActive !== undefined) {
      paramCount++;
      updateFields.push(`is_active = $${paramCount}`);
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    // Add updated_at and templateId
    updateFields.push(`updated_at = NOW()`);
    paramCount++;
    updateValues.push(templateId);
    paramCount++;
    updateValues.push(companyId);

    const updateQuery = `
      UPDATE psa_project_templates 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount - 1} AND company_id = $${paramCount} AND is_deleted = false
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, updateValues);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Template not found or not authorized",
      });
    }

    const template = updateResult.rows[0];

    const formattedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      type: template.type,
      category: template.category,
      estimatedHours: template.estimated_hours || 0,
      storyPoints: template.story_points || 1,
      requiredSkills: template.required_skills || [],
      acceptanceCriteria: template.acceptance_criteria || [],
      definitionOfDone: template.definition_of_done || [],
      priority: template.priority || 'medium',
      tags: template.tags || [],
      usageCount: template.usage_count || 0,
      isActive: template.is_active,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      createdBy: template.created_by,
      userId: template.user_id,
      companyId: template.company_id,
      projectId: template.project_id
    };

    res.status(200).json({
      success: true,
      message: "Template updated successfully",
      data: formattedTemplate
    });

  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating template",
      error: error.message
    });
  }
};

// Delete template
exports.deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { companyId } = req.query;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: "Template ID is required",
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const deleteQuery = `
      UPDATE psa_project_templates 
      SET is_deleted = true, updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND is_deleted = false
      RETURNING *
    `;

    const deleteResult = await pool.query(deleteQuery, [templateId, companyId]);

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Template not found or not authorized",
      });
    }

    res.status(200).json({
      success: true,
      message: "Template deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting template",
      error: error.message
    });
  }
};

// Extract project data for template preview
exports.extractProjectTemplateData = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { companyId } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Get project details
    const projectQuery = `
      SELECT * FROM psa_projects 
      WHERE id = $1 AND company_id = $2 AND is_deleted = false
    `;
    const projectResult = await pool.query(projectQuery, [projectId, companyId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    // Get all backlog items
    const itemsQuery = `
      SELECT * FROM psa_backlog_items 
      WHERE project_id = $1 AND is_deleted = false
      ORDER BY hierarchy_level, created_at
    `;
    const itemsResult = await pool.query(itemsQuery, [projectId]);
    const items = itemsResult.rows;

    // Build hierarchical structure
    const epics = items.filter(item => item.type === 'epic');
    const features = items.filter(item => item.type === 'feature');
    const stories = items.filter(item => item.type === 'story');

    // Group features under epics and stories under features
    const hierarchicalEpics = epics.map(epic => {
      const epicFeatures = features.filter(f => f.parent_id === epic.id);
      const featuresWithStories = epicFeatures.map(feature => {
        const featureStories = stories.filter(s => s.parent_id === feature.id);
        return {
          ...feature,
          stories: featureStories.map(story => ({
            id: story.id,
            name: story.title,
            description: story.description,
            type: story.type,
            priority: story.priority,
            storyPoints: story.story_points,
            estimatedHours: story.estimated_hours,
            requiredSkills: story.required_skills || [],
            acceptanceCriteria: story.acceptance_criteria || [],
            definitionOfDone: story.definition_of_done || [],
            tags: story.tags || []
          }))
        };
      });

      return {
        id: epic.id,
        name: epic.title,
        description: epic.description,
        type: epic.type,
        priority: epic.priority,
        storyPoints: epic.story_points,
        estimatedHours: epic.estimated_hours,
        requiredSkills: epic.required_skills || [],
        acceptanceCriteria: epic.acceptance_criteria || [],
        definitionOfDone: epic.definition_of_done || [],
        tags: epic.tags || [],
        features: featuresWithStories.map(feature => ({
          id: feature.id,
          name: feature.title,
          description: feature.description,
          type: feature.type,
          priority: feature.priority,
          storyPoints: feature.story_points,
          estimatedHours: feature.estimated_hours,
          requiredSkills: feature.required_skills || [],
          acceptanceCriteria: feature.acceptance_criteria || [],
          definitionOfDone: feature.definition_of_done || [],
          tags: feature.tags || [],
          stories: feature.stories
        }))
      };
    });

    // Auto-generate template info
    const totalFeatures = features.length;
    const totalStories = stories.length;
    
    // Calculate number of resources
    const totalResources = project.resource_user_ids ? project.resource_user_ids.length : 0;
    
    // Collect all unique skills from all backlog items
    const allSkills = new Set();
    items.forEach(item => {
      if (item.required_skills && Array.isArray(item.required_skills)) {
        item.required_skills.forEach(skill => allSkills.add(skill));
      }
    });
    const totalSkills = allSkills.size;
    
    // Calculate estimated cost based on story points and average hourly rate
    const totalStoryPoints = items.reduce((sum, item) => sum + (item.story_points || 0), 0);
    const totalEstimatedHours = items.reduce((sum, item) => sum + (item.estimated_hours || 0), 0);
    
    // If no estimated hours, use story points (1 story point = 8 hours as default)
    const effectiveHours = totalEstimatedHours > 0 ? totalEstimatedHours : totalStoryPoints * 8;
    
    // Get resource details for PROJECTED TOTAL calculation (same as cost analysis)
    let estimatedCost = 0; // This will be the PROJECTED TOTAL
    let avgHourlyRate = 0;
    
    if (project.resource_user_ids && project.resource_user_ids.length > 0) {
      const resourcesQuery = `
        SELECT r.hourly_rate, r.hours_per_week, r.currency
        FROM psa_resources r
        WHERE r.user_id = ANY($1) AND r.is_deleted = false
      `;
      const resourcesResult = await pool.query(resourcesQuery, [project.resource_user_ids]);
      
    
      if (resourcesResult.rows.length > 0) {
        // Calculate PROJECTED TOTAL using same logic as cost analysis
        const currentDate = new Date();
        const projectStartDate = new Date(project.start_date);
        const projectEndDate = new Date(project.end_date);
        
        // Calculate weeks elapsed and remaining
        const weeksElapsed = Math.max(0, (currentDate - projectStartDate) / (7 * 24 * 60 * 60 * 1000));
        const totalWeeks = (projectEndDate - projectStartDate) / (7 * 24 * 60 * 60 * 1000);
        const weeksRemaining = Math.max(0, totalWeeks - weeksElapsed);
        
        // Calculate total projected cost (spent + remaining)
        let totalProjectedCost = 0;
        resourcesResult.rows.forEach((resource, index) => {
          const allocationPercentage = project.resource_allocations && project.resource_allocations[index] 
            ? project.resource_allocations[index] 
            : 100;
          const hoursPerWeek = resource.hours_per_week || 40;
          const hourlyRate = parseFloat(resource.hourly_rate) || 0;
          const weeklyCost = (allocationPercentage / 100) * hoursPerWeek * hourlyRate;
          const totalCost = weeklyCost * totalWeeks; // Total cost for entire project duration
          totalProjectedCost += totalCost;
        });
        
        estimatedCost = Math.round(totalProjectedCost * 100) / 100; // Round to 2 decimal places
        avgHourlyRate = resourcesResult.rows.reduce((sum, r) => sum + (parseFloat(r.hourly_rate) || 0), 0) / resourcesResult.rows.length;
        
      } 
    } 
    
    const templateData = {
      name: `${project.name} Template`,
      description: `${project.description} - Template containing ${epics.length} epics, ${totalFeatures} features, and ${totalStories} stories`,
      category: project.category || 'Development',
      epics: hierarchicalEpics,
      stats: {
        totalEpics: epics.length,
        totalFeatures: totalFeatures,
        totalStories: totalStories,
        totalResources: totalResources,
        totalSkills: totalSkills,
        totalStoryPoints: totalStoryPoints,
        totalEstimatedHours: totalEstimatedHours,
        effectiveHours: effectiveHours, // Actual hours used for calculation
        avgHourlyRate: Math.round(avgHourlyRate * 100) / 100, // Average hourly rate
        estimatedCost: Math.round(estimatedCost * 100) / 100 // Round to 2 decimal places
      }
    };

    res.status(200).json({
      success: true,
      data: templateData
    });

  } catch (error) {
    console.error("Error extracting project template data:", error);
    res.status(500).json({
      success: false,
      message: "Server error while extracting project template data",
      error: error.message
    });
  }
};

// Save project as template
exports.saveProjectAsTemplate = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { companyId } = req.query;
    const { id: userId } = req.user;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Get project details
    const projectQuery = `
      SELECT * FROM psa_projects 
      WHERE id = $1 AND company_id = $2 AND is_deleted = false
    `;
    const projectResult = await pool.query(projectQuery, [projectId, companyId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    // Get all backlog items
    const itemsQuery = `
      SELECT * FROM psa_backlog_items 
      WHERE project_id = $1 AND is_deleted = false
      ORDER BY hierarchy_level, created_at
    `;
    const itemsResult = await pool.query(itemsQuery, [projectId]);
    const items = itemsResult.rows;

    // Build hierarchical structure
    const epics = items.filter(item => item.type === 'epic');
    const features = items.filter(item => item.type === 'feature');
    const stories = items.filter(item => item.type === 'story');

    // Group features under epics and stories under features
    const hierarchicalEpics = epics.map(epic => {
      const epicFeatures = features.filter(f => f.parent_id === epic.id);
      const featuresWithStories = epicFeatures.map(feature => {
        const featureStories = stories.filter(s => s.parent_id === feature.id);
        return {
          name: feature.title,
          description: feature.description,
          priority: feature.priority,
          storyPoints: feature.story_points,
          estimatedHours: feature.estimated_hours,
          requiredSkills: feature.required_skills || [],
          acceptanceCriteria: feature.acceptance_criteria || [],
          definitionOfDone: feature.definition_of_done || [],
          tags: feature.tags || [],
          stories: featureStories.map(story => ({
            name: story.title,
            description: story.description,
            priority: story.priority,
            storyPoints: story.story_points,
            estimatedHours: story.estimated_hours,
            requiredSkills: story.required_skills || [],
            acceptanceCriteria: story.acceptance_criteria || [],
            definitionOfDone: story.definition_of_done || [],
            tags: story.tags || []
          }))
        };
      });

      return {
        name: epic.title,
        description: epic.description,
        priority: epic.priority,
        storyPoints: epic.story_points,
        estimatedHours: epic.estimated_hours,
        requiredSkills: epic.required_skills || [],
        acceptanceCriteria: epic.acceptance_criteria || [],
        definitionOfDone: epic.definition_of_done || [],
        tags: epic.tags || [],
        features: featuresWithStories
      };
    });

    // Auto-generate template info
    const totalFeatures = features.length;
    const totalStories = stories.length;
    
    const templateData = {
      templateName: `${project.name} Template`,
      templateDescription: `${project.description} - Template containing ${epics.length} epics, ${totalFeatures} features, and ${totalStories} stories`,
      category: project.category || 'Development',
      epics: hierarchicalEpics
    };

    // ========== NEW: Calculate cost and resource details for template ==========
    
    // 1. Calculate total budget hours from all backlog items
    const totalEstimatedHours = items.reduce((sum, item) => sum + (item.estimated_hours || 0), 0);
    const totalStoryPoints = items.reduce((sum, item) => sum + (item.story_points || 0), 0);
    
    // Use estimated hours if available, otherwise calculate from story points (1 point = 8 hours)
    const budgetHours = totalEstimatedHours > 0 ? totalEstimatedHours : totalStoryPoints * 8;
        
    // 2. Collect all unique skills from backlog items
    const allSkillsSet = new Set();
    items.forEach(item => {
      if (item.required_skills && Array.isArray(item.required_skills)) {
        item.required_skills.forEach(skill => allSkillsSet.add(skill));
      }
    });
    const allRequiredSkills = Array.from(allSkillsSet);
    
    // 3. Calculate duration in weeks
    let durationWeeks = 0;
    if (project.start_date && project.end_date) {
      const startDate = new Date(project.start_date);
      const endDate = new Date(project.end_date);
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      durationWeeks = Math.ceil(diffDays / 7);
    }
    
    // 4. Get resource details and calculate PROJECTED TOTAL (same as cost analysis)
    let resourceCount = 0;
    let estimatedCost = 0; // This will be the PROJECTED TOTAL
    let resourceDetails = [];
    
    if (project.resource_user_ids && project.resource_user_ids.length > 0) {
      resourceCount = project.resource_user_ids.length;
      
      // Fetch resource information with detailed cost calculation
      try {
        const resourcesQuery = `
          SELECT 
            u.id,
            u.name,
            r.hourly_rate,
            r.hours_per_week,
            r.currency
          FROM users u
          LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
          WHERE u.id = ANY($1)
        `;
        const resourcesResult = await pool.query(resourcesQuery, [project.resource_user_ids]);
        
        // Build resource details array
        resourceDetails = resourcesResult.rows.map((resource, index) => {
          const role = project.resource_roles && project.resource_roles[index] 
            ? project.resource_roles[index] 
            : 'Team Member';
          const allocation = project.resource_allocations && project.resource_allocations[index]
            ? project.resource_allocations[index]
            : 100;
          const hourlyRate = parseFloat(resource.hourly_rate) || 0;
          const hoursPerWeek = resource.hours_per_week || 40;
          
          return {
            user_id: resource.id,
            name: resource.name,
            role: role,
            allocation: allocation,
            hourly_rate: hourlyRate,
            hours_per_week: hoursPerWeek,
            currency: resource.currency || 'USD'
          };
        });
        
        // Calculate PROJECTED TOTAL using same logic as cost analysis
        const currentDate = new Date();
        const projectStartDate = new Date(project.start_date);
        const projectEndDate = new Date(project.end_date);
        
        // Calculate weeks elapsed and remaining
        const weeksElapsed = Math.max(0, (currentDate - projectStartDate) / (7 * 24 * 60 * 60 * 1000));
        const totalWeeks = (projectEndDate - projectStartDate) / (7 * 24 * 60 * 60 * 1000);
        const weeksRemaining = Math.max(0, totalWeeks - weeksElapsed);
        
        // Calculate total projected cost (spent + remaining)
        let totalProjectedCost = 0;
        resourceDetails.forEach((resource, index) => {
          const allocationPercentage = project.resource_allocations[index] || 0;
          const weeklyCost = (allocationPercentage / 100) * resource.hours_per_week * resource.hourly_rate;
          const totalCost = weeklyCost * totalWeeks; // Total cost for entire project duration
          totalProjectedCost += totalCost;
        });
        
        estimatedCost = Math.round(totalProjectedCost * 100) / 100; // Round to 2 decimal places
        
       
      } catch (resourceError) {
        console.error('⚠️  Error fetching resource details:', resourceError.message);
        // Continue with 0 cost if resource fetch fails
      }
    }
    
    // ========== END: Template calculations ==========

    // Use existing createHierarchicalTemplate logic
    const dbClient = await pool.connect();
    try {
      await dbClient.query("BEGIN");

      // Insert main template record WITH NEW COST/RESOURCE FIELDS
      const templateQuery = `
        INSERT INTO psa_project_templates (
          name,
          description,
          type,
          category,
          estimated_hours,
          priority,
          definition_of_done,
          tags,
          created_by,
          user_id,
          company_id,
          parent_id,
          project_id,
          estimated_cost,
          budget_hours,
          resource_count,
          resource_details,
          all_required_skills,
          duration_weeks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `;

      const templateResult = await dbClient.query(templateQuery, [
        templateData.templateName,
        templateData.templateDescription,
        'epic', // Main template type
        templateData.category,
        budgetHours, // estimated_hours (now uses calculated value)
        'medium', // priority
        [], // definition_of_done
        [], // tags
        userId, // created_by
        userId, // user_id
        companyId, // company_id
        null, // parent_id
        projectId, // project_id - IMPORTANT: Link to original project!
        estimatedCost, // NEW: estimated_cost
        budgetHours, // NEW: budget_hours
        resourceCount, // NEW: resource_count
        JSON.stringify(resourceDetails), // NEW: resource_details (JSONB)
        allRequiredSkills, // NEW: all_required_skills (array)
        durationWeeks // NEW: duration_weeks
      ]);

      const mainTemplate = templateResult.rows[0];

      // Create separate query for child items (epics, features) without cost/resource columns
      const childItemQuery = `
        INSERT INTO psa_project_templates (
          name,
          description,
          type,
          category,
          estimated_hours,
          priority,
          definition_of_done,
          tags,
          created_by,
          user_id,
          company_id,
          parent_id,
          project_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      // Insert epics, features, and stories
      for (const epic of templateData.epics) {
        // Insert epic
        const epicResult = await dbClient.query(childItemQuery, [
          epic.name,
          epic.description,
          'epic',
          templateData.category,
          epic.estimatedHours || 0,
          epic.priority || 'medium',
          epic.definitionOfDone || [],
          epic.tags || [],
          userId,
          userId,
          companyId,
          mainTemplate.id,
          projectId // project_id for child epic
        ]);

        const createdEpic = epicResult.rows[0];

        // Insert features
        if (epic.features && epic.features.length > 0) {
          for (const feature of epic.features) {
            const featureResult = await dbClient.query(childItemQuery, [
              feature.name,
              feature.description,
              'feature',
              templateData.category,
              feature.estimatedHours || 0,
              feature.priority || 'medium',
              feature.definitionOfDone || [],
              feature.tags || [],
              userId,
              userId,
              companyId,
              createdEpic.id,
              projectId // project_id for feature
            ]);

            const createdFeature = featureResult.rows[0];

            // Insert stories
            if (feature.stories && feature.stories.length > 0) {
              for (const story of feature.stories) {
                const storyQuery = `
                  INSERT INTO psa_project_templates (
                    name,
                    description,
                    type,
                    category,
                    estimated_hours,
                    story_points,
                    priority,
                    required_skills,
                    acceptance_criteria,
                    definition_of_done,
                    tags,
                    created_by,
                    user_id,
                    company_id,
                    parent_id,
                    project_id
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                  RETURNING *
                `;
                
                await dbClient.query(storyQuery, [
                  story.name,
                  story.description,
                  'story',
                  templateData.category,
                  story.estimatedHours || 0,
                  story.storyPoints || 1,
                  story.priority || 'medium',
                  story.requiredSkills || [],
                  story.acceptanceCriteria || [],
                  story.definitionOfDone || [],
                  story.tags || [],
                  userId,
                  userId,
                  companyId,
                  createdFeature.id,
                  projectId // project_id for story
                ]);
              }
            }
          }
        }
      }

      await dbClient.query("COMMIT");

      res.status(201).json({
        success: true,
        message: "Project saved as template successfully",
        data: {
          templateId: mainTemplate.id,
          templateName: templateData.templateName,
          epicsCount: epics.length,
          featuresCount: totalFeatures,
          storiesCount: totalStories,
          // NEW: Include cost and resource details
          estimatedCost: estimatedCost,
          budgetHours: budgetHours,
          resourceCount: resourceCount,
          resourceDetails: resourceDetails,
          allRequiredSkills: allRequiredSkills,
          durationWeeks: durationWeeks
        }
      });

    } catch (error) {
      await dbClient.query("ROLLBACK");
      throw error;
    } finally {
      dbClient.release();
    }

  } catch (error) {
    console.error("Error saving project as template:", error);
    res.status(500).json({
      success: false,
      message: "Server error while saving project as template",
      error: error.message
    });
  }
};

// Create project from hierarchical template
exports.createProjectFromHierarchicalTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { companyId } = req.query;
    const { id: userId } = req.user;
    const {
      projectName,
      projectDescription,
      projectType = 'development',
      methodology = 'agile',
      client,
      startDate,
      endDate,
      budgetHours,
      epics // Array of epics with their features and stories
    } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: "Template ID is required",
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    if (!projectName || !projectDescription) {
      return res.status(400).json({
        success: false,
        message: "Project name and description are required",
      });
    }

    if (!epics || !Array.isArray(epics) || epics.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Epics data is required for hierarchical template",
      });
    }

    const dbClient = await pool.connect();
    try {
      await dbClient.query("BEGIN");

      // Get template details to check if it has a linked project
      const templateQuery = `SELECT project_id FROM psa_project_templates WHERE id = $1`;
      const templateResult = await dbClient.query(templateQuery, [templateId]);
      const template = templateResult.rows[0];
      
      // Initialize resource arrays
      let resourceUserIds = [];
      let resourceRoles = [];
      let resourceAllocations = [];
      
      // If template was created from a project, get its resources
      if (template && template.project_id) {
        const originalProjectQuery = `
          SELECT resource_user_ids, resource_roles 
          FROM psa_projects 
          WHERE id = $1 AND is_deleted = false
        `;
        const originalProjectResult = await dbClient.query(originalProjectQuery, [template.project_id]);
        
        if (originalProjectResult.rows.length > 0) {
          const originalProject = originalProjectResult.rows[0];
          resourceUserIds = originalProject.resource_user_ids || [];
          resourceRoles = originalProject.resource_roles || [];
          
          // Set 100% allocation for all resources
          resourceAllocations = resourceUserIds.map(() => 100);          
         
        }
      }

      // Create the project
      const projectQuery = `
        INSERT INTO psa_projects (
          name,
          description,
          type,
          methodology,
          client_id,
          start_date,
          end_date,
          budget_hours,
          company_id,
          user_id,
          resource_user_ids,
          resource_roles,
          resource_allocations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const projectResult = await dbClient.query(projectQuery, [
        projectName,
        projectDescription,
        projectType,
        methodology,
        client || null,
        startDate || null,
        endDate || null,
        budgetHours || null,
        companyId,
        userId,
        resourceUserIds, // Auto-assigned resources from template
        resourceRoles, // Auto-assigned roles from template
        resourceAllocations // 100% allocation for all
      ]);

      const project = projectResult.rows[0];
      const createdItems = [];

      // Create backlog items from hierarchical template data
      const backlogQuery = `
        INSERT INTO psa_backlog_items (
          project_id,
          parent_id,
          title,
          description,
          type,
          hierarchy_level,
          priority,
          story_points,
          estimated_hours,
          required_skills,
          acceptance_criteria,
          definition_of_done,
          tags,
          assignee_id,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;

      // Process each epic and its children
      for (const epic of epics) {
        // Create epic
        const epicResult = await dbClient.query(backlogQuery, [
          project.id,
          null, // parent_id for epic
          epic.name,
          epic.description,
          'epic',
          1, // hierarchy_level
          epic.priority || 'medium',
          epic.storyPoints || 1,
          epic.estimatedHours || 0,
          epic.requiredSkills || [],
          epic.acceptanceCriteria || [],
          epic.definitionOfDone || [],
          epic.tags || [],
          null, // assignee_id
          userId
        ]);

        const createdEpic = epicResult.rows[0];
        createdItems.push(createdEpic);

        // Create features for this epic
        if (epic.features && epic.features.length > 0) {
          for (const feature of epic.features) {
            const featureResult = await dbClient.query(backlogQuery, [
              project.id,
              createdEpic.id, // parent_id for feature
              feature.name,
              feature.description,
              'feature',
              2, // hierarchy_level
              feature.priority || 'medium',
              feature.storyPoints || 1,
              feature.estimatedHours || 0,
              feature.requiredSkills || [],
              feature.acceptanceCriteria || [],
              feature.definitionOfDone || [],
              feature.tags || [],
              null, // assignee_id
              userId
            ]);

            const createdFeature = featureResult.rows[0];
            createdItems.push(createdFeature);

            // Create stories for this feature
            if (feature.stories && feature.stories.length > 0) {
              for (const story of feature.stories) {
                const storyResult = await dbClient.query(backlogQuery, [
                  project.id,
                  createdFeature.id, // parent_id for story
                  story.name,
                  story.description,
                  'story',
                  3, // hierarchy_level
                  story.priority || 'medium',
                  story.storyPoints || 1,
                  story.estimatedHours || 0,
                  story.requiredSkills || [],
                  story.acceptanceCriteria || [],
                  story.definitionOfDone || [],
                  story.tags || [],
                  null, // assignee_id
                  userId
                ]);

                const createdStory = storyResult.rows[0];
                createdItems.push(createdStory);
              }
            }
          }
        }
      }

      await dbClient.query("COMMIT");

      const formattedProject = {
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        methodology: project.methodology,
        clientId: project.client_id,
        startDate: project.start_date,
        endDate: project.end_date,
        budgetHours: project.budget_hours,
        companyId: project.company_id,
        userId: project.user_id,
        status: project.status,
        progress: project.progress,
        resourceUserIds: project.resource_user_ids || [],
        resourceRoles: project.resource_roles || [],
        resourceAllocations: project.resource_allocations || [],
        createdAt: project.created_at,
        updatedAt: project.updated_at
      };

      const formattedBacklogItems = createdItems.map(item => ({
        id: item.id,
        projectId: item.project_id,
        parentId: item.parent_id,
        title: item.title,
        description: item.description,
        type: item.type,
        hierarchyLevel: item.hierarchy_level,
        priority: item.priority,
        storyPoints: item.story_points,
        estimatedHours: item.estimated_hours,
        requiredSkills: item.required_skills || [],
        acceptanceCriteria: item.acceptance_criteria || [],
        definitionOfDone: item.definition_of_done || [],
        tags: item.tags || [],
        assigneeId: item.assignee_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      res.status(201).json({
        success: true,
        message: "Project created successfully from hierarchical template",
        data: {
          project: formattedProject,
          backlogItems: formattedBacklogItems,
          template: {
            id: templateId,
            name: projectName,
            type: 'hierarchical',
            category: epics[0].category || 'Development'
          }
        }
      });

    } catch (error) {
      await dbClient.query("ROLLBACK");
      throw error;
    } finally {
      dbClient.release();
    }

  } catch (error) {
    console.error("Error creating project from hierarchical template:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating project from hierarchical template",
      error: error.message
    });
  }
};

// Create project from template
exports.createProjectFromTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { companyId } = req.query;
    const { id: userId } = req.user;
    const {
      projectName,
      projectDescription,
      projectType = 'development',
      methodology = 'agile',
      client,
      startDate,
      endDate,
      budgetHours
    } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: "Template ID is required",
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    if (!projectName || !projectDescription) {
      return res.status(400).json({
        success: false,
        message: "Project name and description are required",
      });
    }

    const dbClient = await pool.connect();
    try {
      await dbClient.query("BEGIN");

      // Get template details
      const templateQuery = `
        SELECT * FROM psa_project_templates 
        WHERE id = $1 AND company_id = $2 AND is_deleted = false
      `;
      const templateResult = await dbClient.query(templateQuery, [templateId, companyId]);

      if (templateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Template not found",
        });
      }

      const template = templateResult.rows[0];

      // Create the project
      const projectQuery = `
        INSERT INTO psa_projects (
          name,
          description,
          type,
          methodology,
          client_id,
          start_date,
          end_date,
          budget_hours,
          company_id,
          user_id,
          resource_user_ids,
          resource_roles,
          resource_allocations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const projectResult = await dbClient.query(projectQuery, [
        projectName,
        projectDescription,
        projectType,
        methodology,
        client || null,
        startDate || null,
        endDate || null,
        budgetHours || null,
        companyId,
        userId,
        [], // No initial resources
        [],
        []
      ]);

      const project = projectResult.rows[0];

      // Always create Epic -> Feature -> Story structure regardless of template type
      const defaultStructure = [
        {
          type: 'epic',
          title: 'Sample Epic',
          description: 'This is a sample epic created from template. You can edit this description.',
          hierarchyLevel: 1,
          parentId: null
        },
        {
          type: 'feature',
          title: 'Sample Feature',
          description: 'This is a sample feature created from template. You can edit this description.',
          hierarchyLevel: 2,
          parentId: null // Will be updated after epic is created
        },
        {
          type: 'story',
          title: 'Sample Story',
          description: 'This is a sample story created from template. You can edit this description.',
          hierarchyLevel: 3,
          parentId: null // Will be updated after feature is created
        }
      ];

      const createdItems = [];

      // Create backlog items based on the structure
      const backlogQuery = `
        INSERT INTO psa_backlog_items (
          project_id,
          parent_id,
          title,
          description,
          type,
          hierarchy_level,
          priority,
          story_points,
          estimated_hours,
          required_skills,
          acceptance_criteria,
          definition_of_done,
          tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      let parentId = null;
      
      for (let i = 0; i < defaultStructure.length; i++) {
        const item = defaultStructure[i];
        
        const result = await dbClient.query(backlogQuery, [
          project.id,
          parentId,
          item.title,
          item.description,
          item.type,
          item.hierarchyLevel,
          template.priority,
          template.story_points,
          template.estimated_hours,
          template.required_skills,
          template.acceptance_criteria,
          template.definition_of_done,
          template.tags
        ]);

        const createdItem = result.rows[0];
        createdItems.push(createdItem);
        
        // Set parent for next item
        parentId = createdItem.id;
      }

      // Update template usage count
      const updateUsageQuery = `
        UPDATE psa_project_templates 
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE id = $1
      `;
      await dbClient.query(updateUsageQuery, [templateId]);

      await dbClient.query("COMMIT");

      // Format response
      const formattedProject = {
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        methodology: project.methodology,
        clientId: project.client_id,
        startDate: project.start_date,
        endDate: project.end_date,
        budgetHours: project.budget_hours,
        companyId: project.company_id,
        userId: project.user_id,
        resourceUserIds: project.resource_user_ids || [],
        resourceRoles: project.resource_roles || [],
        resourceAllocations: project.resource_allocations || [],
        createdAt: project.created_at,
        updatedAt: project.updated_at
      };

      const formattedBacklogItems = createdItems.map(item => ({
        id: item.id,
        projectId: item.project_id,
        parentId: item.parent_id,
        title: item.title,
        description: item.description,
        type: item.type,
        hierarchyLevel: item.hierarchy_level,
        priority: item.priority,
        storyPoints: item.story_points,
        estimatedHours: item.estimated_hours,
        requiredSkills: item.required_skills || [],
        acceptanceCriteria: item.acceptance_criteria || [],
        definitionOfDone: item.definition_of_done || [],
        tags: item.tags || [],
        assigneeId: item.assignee_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      res.status(201).json({
        success: true,
        message: "Project created successfully from template",
        data: {
          project: formattedProject,
          backlogItems: formattedBacklogItems,
          template: {
            id: template.id,
            name: template.name,
            type: template.type,
            category: template.category
          }
        }
      });

    } catch (error) {
      await dbClient.query("ROLLBACK");
      throw error;
    } finally {
      dbClient.release();
    }

  } catch (error) {
    console.error("Error creating project from template:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating project from template",
      error: error.message
    });
  }
};

exports.getCapacityPlanning = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { 
      timeHorizon = '6months',
      department = 'all',
      page = 1,
      limit = 50
    } = req.query;   
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Build dynamic WHERE conditions
    let whereConditions = ['cr.company_id = $1'];
    let queryParams = [companyId];
    let paramCount = 1;

    // Department filter
    if (department !== 'all') {
      paramCount++;
      whereConditions.push(`cr2.id = $${paramCount}`);
      queryParams.push(department);
    }

    // Calculate date range based on timeHorizon parameter
    let startDate, endDate;
    const currentDate = new Date();
    
    switch (timeHorizon) {
      case '3months':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 3, 0);
        break;
      case '6months':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 6, 0);
        break;
      case '12months':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 12, 0);
        break;
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 6, 0);
    }

    // Add time horizon parameters (format as YYYY-MM-DD strings for PostgreSQL DATE columns)
    const formatDate = (date) => date.toISOString().split("T")[0];
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);    
    
    // Push start & end first, remember their positions
    paramCount++;
    const startDateIndex = paramCount;
    queryParams.push(startDateStr); // e.g. "2025-09-01"
    
    paramCount++;
    const endDateIndex = paramCount;
    queryParams.push(endDateStr);   // e.g. "2026-02-28"

    // Main query to get capacity planning data
    const capacityPlanningQuery = `
      WITH       resource_capacity AS (
        -- Calculate current capacity (assigned resources) within time horizon
        SELECT 
          COUNT(DISTINCT r.id) as total_resources,
          COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN r.id END) as assigned_resources,
          COUNT(DISTINCT CASE WHEN p.id IS NULL THEN r.id END) as available_resources,
          COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN COALESCE(r.hours_per_week, 40) ELSE 0 END), 0) as total_capacity_hours,
          COALESCE(SUM(CASE WHEN p.id IS NULL THEN COALESCE(r.hours_per_week, 40) ELSE 0 END), 0) as available_capacity_hours
        FROM psa_resources r
        JOIN users u ON r.user_id = u.id
        JOIN company_roles cr ON u.company_role = cr.id
        LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
        LEFT JOIN psa_projects p ON u.id = ANY(p.resource_user_ids) 
          AND p.company_id = $1 
          AND p.is_active = true 
          AND p.is_deleted = false
          AND (p.start_date <= $${endDateIndex} OR p.start_date IS NULL)
          AND (p.end_date >= $${startDateIndex} OR p.end_date IS NULL)
        WHERE ${whereConditions.join(' AND ')}
          AND r.is_deleted = false
          AND u.status = 'enabled'
      ),
      story_demand AS (
        -- Calculate demand (unassigned stories with required skills) within time horizon
        SELECT 
          COUNT(DISTINCT bi.id) as total_stories,
          COUNT(DISTINCT CASE WHEN bi.assignee_id IS NULL AND bi.required_skills IS NOT NULL AND array_length(bi.required_skills, 1) > 0 THEN bi.id END) as unassigned_stories_with_skills,
          COUNT(DISTINCT CASE WHEN bi.assignee_id IS NOT NULL THEN bi.id END) as assigned_stories
        FROM psa_backlog_items bi
        JOIN psa_projects p ON bi.project_id = p.id
        WHERE p.company_id = $1 
          AND p.is_active = true 
          AND p.is_deleted = false
          AND bi.is_deleted = false
          AND (p.start_date <= $${endDateIndex} OR p.start_date IS NULL)
          AND (p.end_date >= $${startDateIndex} OR p.end_date IS NULL)
      ),
      skill_capacity AS (
        -- Calculate skill-based capacity and demand within time horizon
        SELECT 
          s.id as skill_id,
          s.name as skill_name,
          s.category as skill_category,
          s.description as skill_description,
          -- Total capacity for this skill (all resources who have it)
          SUM(COALESCE(r.hours_per_week, 40)) as total_skill_capacity,
          -- Available capacity for this skill (unassigned resources who have it)
          SUM(CASE WHEN p.id IS NULL THEN COALESCE(r.hours_per_week, 40) ELSE 0 END) as available_skill_capacity,
          -- Demand for this skill (unassigned stories that require it) - converted to hours
          COUNT(DISTINCT CASE WHEN bi.assignee_id IS NULL AND s.name = ANY(bi.required_skills) THEN bi.id END) * 40 as skill_demand_hours
        FROM psa_skills s
        LEFT JOIN psa_resource_skills rs ON s.id = rs.skill_id AND rs.is_deleted = false
        LEFT JOIN psa_resources r ON rs.resource_id = r.id AND r.is_deleted = false
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN company_roles cr ON u.company_role = cr.id
        LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
        LEFT JOIN psa_projects p ON u.id = ANY(p.resource_user_ids) 
          AND p.company_id = $1 
          AND p.is_active = true 
          AND p.is_deleted = false
          AND (p.start_date <= $${endDateIndex} OR p.start_date IS NULL)
          AND (p.end_date >= $${startDateIndex} OR p.end_date IS NULL)
        LEFT JOIN psa_backlog_items bi ON s.name = ANY(bi.required_skills)
        LEFT JOIN psa_projects bp ON bi.project_id = bp.id
        WHERE s.is_deleted = false
          AND (cr.company_id = $1 OR cr.company_id IS NULL)
          AND (bp.company_id = $1 OR bp.company_id IS NULL)
          AND (bp.is_active = true OR bp.is_active IS NULL)
          AND (bp.is_deleted = false OR bp.is_deleted IS NULL)
          AND (bi.is_deleted = false OR bi.is_deleted IS NULL)
          AND (bp.start_date <= $${endDateIndex} OR bp.start_date IS NULL)
          AND (bp.end_date >= $${startDateIndex} OR p.end_date IS NULL)
        GROUP BY s.id, s.name, s.category, s.description
        HAVING COUNT(DISTINCT r.id) > 0 OR COUNT(DISTINCT bi.id) > 0
      ),
      skill_demand_corrected AS (
        -- Calculate demand for ALL required skills in stories (regardless of assignee skills)
        SELECT 
          s.id as skill_id,
          s.name as skill_name,
          -- Count ALL stories that require this skill
          COUNT(DISTINCT bi.id) as skill_demand_stories,
          COUNT(DISTINCT bi.id) * 40 as skill_demand_hours
        FROM psa_skills s
        LEFT JOIN psa_backlog_items bi ON s.name = ANY(bi.required_skills)
        LEFT JOIN psa_projects p ON bi.project_id = p.id
        WHERE s.is_deleted = false
          AND p.company_id = $1
          AND p.is_active = true
          AND p.is_deleted = false
          AND bi.is_deleted = false
          AND bi.required_skills IS NOT NULL
          AND array_length(bi.required_skills, 1) > 0
          AND (p.start_date <= $${endDateIndex} OR p.start_date IS NULL)
          AND (p.end_date >= $${startDateIndex} OR p.end_date IS NULL)
        GROUP BY s.id, s.name
      )
      SELECT 
        rc.total_resources,
        rc.assigned_resources,
        rc.available_resources,
        rc.total_capacity_hours,
        rc.available_capacity_hours,
        sd.total_stories,
        sd.unassigned_stories_with_skills,
        sd.assigned_stories,
        sc.skill_id,
        sc.skill_name,
        sc.skill_category,
        sc.skill_description,
        sc.total_skill_capacity,
        sc.available_skill_capacity,
        COALESCE(sdc.skill_demand_stories, 0) as skill_demand_stories,
        COALESCE(sdc.skill_demand_hours, 0) as skill_demand_hours,
        (COALESCE(sdc.skill_demand_hours, 0) - sc.available_skill_capacity) as skill_gap,
        CASE 
          WHEN sc.total_skill_capacity > 0 THEN 
            ROUND(((sc.total_skill_capacity - sc.available_skill_capacity) / sc.total_skill_capacity) * 100)
          ELSE 0 
        END as skill_utilization
      FROM resource_capacity rc, story_demand sd
      LEFT JOIN skill_capacity sc ON true
      LEFT JOIN skill_demand_corrected sdc ON sc.skill_id = sdc.skill_id
      ORDER BY sc.skill_name ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    // Add pagination parameters
    queryParams.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));   

    const capacityResult = await pool.query(capacityPlanningQuery, queryParams);
    const capacityData = capacityResult.rows;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM psa_skills s
      WHERE s.is_deleted = false
    `;
    const countResult = await pool.query(countQuery);
    const totalCount = parseInt(countResult.rows[0].total_count);

    // Calculate summary statistics
    const summaryQuery = `
      WITH       resource_capacity AS (
        SELECT 
          COUNT(DISTINCT r.id) as total_resources,
          COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN r.id END) as assigned_resources,
          COUNT(DISTINCT CASE WHEN p.id IS NULL THEN r.id END) as available_resources,
          COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN COALESCE(r.hours_per_week, 40) ELSE 0 END), 0) as total_capacity_hours,
          COALESCE(SUM(CASE WHEN p.id IS NULL THEN COALESCE(r.hours_per_week, 40) ELSE 0 END), 0) as available_capacity_hours
        FROM psa_resources r
        JOIN users u ON r.user_id = u.id
        JOIN company_roles cr ON u.company_role = cr.id
        LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
        LEFT JOIN psa_projects p ON u.id = ANY(p.resource_user_ids) 
          AND p.company_id = $1 
          AND p.is_active = true 
          AND p.is_deleted = false
          AND (p.start_date <= $${endDateIndex} OR p.start_date IS NULL)
          AND (p.end_date >= $${startDateIndex} OR p.end_date IS NULL)
        WHERE ${whereConditions.join(' AND ')}
          AND r.is_deleted = false
      ),
      story_demand AS (
        SELECT 
          COUNT(DISTINCT bi.id) as total_stories,
          COUNT(DISTINCT CASE WHEN bi.assignee_id IS NULL AND bi.required_skills IS NOT NULL AND array_length(bi.required_skills, 1) > 0 THEN bi.id END) as unassigned_stories_with_skills,
          COUNT(DISTINCT CASE WHEN bi.assignee_id IS NOT NULL THEN bi.id END) as assigned_stories
        FROM psa_backlog_items bi
        JOIN psa_projects p ON bi.project_id = p.id
        WHERE p.company_id = $1 
          AND p.is_active = true 
          AND p.is_deleted = false
          AND bi.is_deleted = false
          AND (p.start_date <= $${endDateIndex} OR p.start_date IS NULL)
          AND (p.end_date >= $${startDateIndex} OR p.end_date IS NULL)
      )
      SELECT 
        rc.total_resources,
        rc.assigned_resources,
        rc.available_resources,
        rc.total_capacity_hours,
        rc.available_capacity_hours,
        sd.total_stories,
        sd.unassigned_stories_with_skills,
        sd.assigned_stories
      FROM resource_capacity rc, story_demand sd
    `;
    const summaryResult = await pool.query(summaryQuery, queryParams.slice(0, -2));
    const summary = summaryResult.rows[0];

    // Calculate utilization rate
    const utilizationRate = summary.total_capacity_hours > 0 ? 
      Math.round(((summary.total_capacity_hours - summary.available_capacity_hours) / summary.total_capacity_hours) * 100) : 0;

    // Calculate gap analysis
    const totalGap = summary.unassigned_stories_with_skills - summary.available_resources;
    const gapStatus = totalGap > 0 ? 'shortage' : totalGap < 0 ? 'surplus' : 'balanced';

    // Format skill capacity data
    const skillCapacity = capacityData.map(skill => ({
      skillId: skill.skill_id,
      skillName: skill.skill_name,
      skillCategory: skill.skill_category,
      skillDescription: skill.skill_description,
      totalCapacity: parseInt(skill.total_skill_capacity) || 0,
      availableCapacity: parseInt(skill.available_skill_capacity) || 0,
      demand: parseInt(skill.skill_demand_hours) || 0, // Now in hours
      demandStories: parseInt(skill.skill_demand_stories) || 0, // Count of stories
      gap: parseInt(skill.skill_gap) || 0,
      utilization: parseInt(skill.skill_utilization) || 0,
      status: skill.skill_gap > 20 ? 'shortage' : skill.skill_gap < -20 ? 'surplus' : 'balanced'
    }));

    // Generate recommendations
    const recommendations = [];
    
    // Overall capacity recommendations
    if (totalGap > 0) {
      const resourcesNeeded = Math.ceil(totalGap / 40);
      recommendations.push({
        type: 'hiring',
        priority: 'high',
        message: `Hire ${resourcesNeeded} additional resources`,
        impact: `Close ${Math.round(totalGap)} hour capacity gap`
      });
    }

    // Skill-specific recommendations
    skillCapacity.forEach(skill => {
      if (skill.gap > 20) {
        recommendations.push({
          type: 'skill',
          priority: skill.gap > 40 ? 'high' : 'medium',
          message: `${skill.skillName} skill shortage detected`,
          impact: `${Math.round(skill.gap)} hour weekly gap`
        });
      }
    });

    // Get department list for filters
    const departmentsQuery = `
      SELECT DISTINCT cr2.id as department_id, cr2.name as department_name
      FROM psa_resources r
      JOIN users u ON r.user_id = u.id
      JOIN company_roles cr ON u.company_role = cr.id
      LEFT JOIN company_roles cr2 ON r.department_id = cr2.id
      WHERE cr.company_id = $1 AND cr2.id IS NOT NULL
      ORDER BY cr2.name ASC
    `;
    const departmentsResult = await pool.query(departmentsQuery, [companyId]);
    const departments = departmentsResult.rows.map(row => ({
      id: row.department_id,
      name: row.department_name
    }));

    // Calculate future projections based on time horizon
    const getFutureProjections = () => {
      const currentDemand = parseInt(summary.unassigned_stories_with_skills);
      const currentCapacity = parseInt(summary.total_capacity_hours);
      const months = timeHorizon === '3months' ? 3 : timeHorizon === '12months' ? 12 : 6;
      
      const projections = [
        { period: 'Current', demand: currentDemand, capacity: currentCapacity }
      ];
      
      for (let i = 1; i <= months; i++) {
        const demandGrowth = 1 + (i * 0.05); // 5% growth per month
        let capacityGrowth = 0;
        
        // Add new hires based on time horizon
        if (timeHorizon === '3months') {
          capacityGrowth = i >= 2 ? 80 : 0; // New hire after 2 months for 3-month view
        } else if (timeHorizon === '6months') {
          capacityGrowth = i >= 3 ? 80 : 0; // New hire after 3 months
          capacityGrowth += i >= 5 ? 80 : 0; // Another hire after 5 months
        } else if (timeHorizon === '12months') {
          capacityGrowth = i >= 3 ? 80 : 0; // New hire after 3 months
          capacityGrowth += i >= 6 ? 80 : 0; // Another hire after 6 months
          capacityGrowth += i >= 9 ? 80 : 0; // Another hire after 9 months
        }
        
        projections.push({
          period: `Month ${i}`,
          demand: Math.round(currentDemand * demandGrowth),
          capacity: currentCapacity + capacityGrowth
        });
      }
      
      return projections;
    };

    const futureProjections = getFutureProjections();
    const futureGap = futureProjections[futureProjections.length - 1].demand - futureProjections[futureProjections.length - 1].capacity;

    // Format response data
    const response = {
      currentCapacity: {
        totalResources: parseInt(summary.total_resources),
        assignedResources: parseInt(summary.assigned_resources),
        availableResources: parseInt(summary.available_resources),
        totalCapacityHours: parseInt(summary.total_capacity_hours),
        availableCapacityHours: parseInt(summary.available_capacity_hours),
        utilizationRate: utilizationRate
      },
      demand: {
        totalStories: parseInt(summary.total_stories),
        unassignedStories: parseInt(summary.unassigned_stories_with_skills),
        assignedStories: parseInt(summary.assigned_stories)
      },
      gapAnalysis: {
        gap: totalGap,
        surplus: totalGap < 0 ? Math.abs(totalGap) : 0,
        status: gapStatus
      },
      futureProjections: futureProjections,
      futureGap: futureGap,
      skillCapacity: skillCapacity,
      recommendations: recommendations,
      filters: {
        departments: departments,
        timeHorizon: timeHorizon,
        department: department
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("Error fetching capacity planning data:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching capacity planning data",
      error: error.message
    });
  }
};

// Create Sprint
exports.createSprint = async (req, res) => {
  try {
    const { project_id, name, goal, start_date, end_date, capacity, commitment, team_member_ids, pi_id } = req.body;

    // Validate required fields
    if (!project_id || !name || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: project_id, name, start_date, end_date'
      });
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Validate sprint duration (1-4 weeks)
    const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const durationWeeks = Math.ceil(durationDays / 7);
    
    if (durationWeeks < 1 || durationWeeks > 4) {
      return res.status(400).json({
        success: false,
        message: 'Sprint duration must be between 1 and 4 weeks'
      });
    }

    // Create sprint
    const sprintQuery = `
      INSERT INTO psa_sprints (
        project_id, name, goal, start_date, end_date, 
        capacity, commitment, status, pi_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'planning', $8)
      RETURNING *
    `;

    const sprintValues = [
      project_id,
      name,
      goal || null,
      start_date,
      end_date,
      capacity || 0,
      commitment || 0,
      pi_id || null
    ];

    const sprintResult = await pool.query(sprintQuery, sprintValues);
    const sprint = sprintResult.rows[0];

    // If team members are provided, you can add them to sprint assignments
    // This would require a psa_sprint_assignments table
    // For now, we'll just return the sprint

    res.status(201).json({
      success: true,
      message: 'Sprint created successfully',
      data: sprint
    });

  } catch (error) {
    console.error('Error in createSprint:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating sprint',
      error: error.message
    });
  }
};

// Get Sprints for a Project
exports.getProjectSprints = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    // Get sprints for the project with PI information
    const sprintsQuery = `
      SELECT 
        s.*,
        pi.name as pi_name,
        pi.description as pi_description,
        pi.status as pi_status,
        COUNT(bi.id) as total_stories,
        COALESCE(SUM(CASE WHEN bi.status = 'done' THEN bi.story_points ELSE 0 END), 0) as completed_story_points,
        COALESCE(SUM(bi.story_points), 0) as total_story_points
      FROM psa_sprints s
      LEFT JOIN psa_program_increments pi ON s.pi_id = pi.id AND pi.is_deleted = false
      LEFT JOIN psa_backlog_items bi ON s.project_id = bi.project_id 
        AND bi.type = 'story'
        AND bi.is_deleted = false
      WHERE s.project_id = $1 AND s.is_deleted = false
      GROUP BY s.id, s.project_id, s.name, s.goal, s.start_date, s.end_date, 
               s.status, s.capacity, s.commitment, s.velocity, s.is_deleted, 
               s.created_at, s.updated_at, s.pi_id, pi.name, pi.description, pi.status
      ORDER BY s.start_date ASC
    `;

    const sprintsResult = await pool.query(sprintsQuery, [projectId]);
    const sprints = sprintsResult.rows;

    // Calculate velocity for each sprint
    const sprintsWithVelocity = sprints.map(sprint => {
      const velocity = parseInt(sprint.completed_story_points) || 0;
      const commitment = parseInt(sprint.commitment) || 0;
      const totalStoryPoints = parseInt(sprint.total_story_points) || 0;
      
      // Calculate efficiency based on commitment vs velocity
      // Efficiency should be: (completed / planned) * 100
      // If commitment is 0 or very low compared to velocity, use total story points as base
      let efficiency = 0;
      if (commitment > 0 && commitment >= velocity) {
        // Normal case: commitment is reasonable
        efficiency = Math.round((velocity / commitment) * 100);
      } else if (totalStoryPoints > 0) {
        // Fallback: use total story points as base
        efficiency = Math.round((velocity / totalStoryPoints) * 100);
      }

      return {
        ...sprint,
        velocity,
        efficiency,
        completed_story_points: parseInt(sprint.completed_story_points) || 0,
        total_story_points: parseInt(sprint.total_story_points) || 0,
        total_stories: parseInt(sprint.total_stories) || 0
      };
    });

    res.json({
      success: true,
      sprints: sprintsWithVelocity
    });

  } catch (error) {
    console.error('Error in getProjectSprints:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sprints',
      error: error.message
    });
  }
};

// Get All Sprints for Company
exports.getAllSprints = async (req, res) => {
  try {
    const { company } = req.query;
    
    if (!company) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    const companyId = parseInt(company);

    // Get all sprints for the company (join through projects table)
    const query = `
      SELECT 
        s.id,
        s.name,
        s.goal,
        s.start_date,
        s.end_date,
        s.capacity,
        s.commitment,
        s.status,
        s.created_at,
        s.updated_at,
        s.project_id,
        s.pi_id,
        p.name as project_name,
        pi.name as pi_name
      FROM psa_sprints s
      LEFT JOIN psa_projects p ON s.project_id = p.id
      LEFT JOIN psa_program_increments pi ON s.pi_id = pi.id
      WHERE p.company_id = $1 AND s.is_deleted = false
      ORDER BY s.start_date DESC
    `;

    const result = await pool.query(query, [companyId]);

    res.json({
      success: true,
      sprints: result.rows
    });

  } catch (error) {
    console.error('Error in getAllSprints:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sprints',
      error: error.message
    });
  }
};

// Update Sprint Velocity
exports.updateSprintVelocity = async (req, res) => {
  try {
    const { sprintId } = req.params;

    if (!sprintId) {
      return res.status(400).json({
        success: false,
        message: 'Sprint ID is required'
      });
    }

    // Calculate actual velocity based on completed stories
    const velocityQuery = `
      SELECT 
        s.id,
        s.project_id,
        COALESCE(SUM(CASE WHEN bi.status = 'done' THEN bi.story_points ELSE 0 END), 0) as actual_velocity
      FROM psa_sprints s
      LEFT JOIN psa_backlog_items bi ON s.project_id = bi.project_id 
        AND bi.type = 'story'
        AND bi.is_deleted = false
      WHERE s.id = $1 AND s.is_deleted = false
      GROUP BY s.id, s.project_id
    `;

    const velocityResult = await pool.query(velocityQuery, [sprintId]);
    
    if (velocityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found'
      });
    }

    const actualVelocity = parseInt(velocityResult.rows[0].actual_velocity) || 0;

    // Update sprint velocity
    const updateQuery = `
      UPDATE psa_sprints 
      SET velocity = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [actualVelocity, sprintId]);
    const updatedSprint = updateResult.rows[0];

    res.json({
      success: true,
      message: 'Sprint velocity updated successfully',
      data: {
        ...updatedSprint,
        velocity: actualVelocity
      }
    });

  } catch (error) {
    console.error('Error in updateSprintVelocity:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating sprint velocity',
      error: error.message
    });
  }
};

// Create Skill
exports.createSkill = async (req, res) => {
  try {
    const { name, description, category } = req.body;

    if (!name || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, description, category'
      });
    }

    // Validate category - check if it's not empty and has reasonable length
    if (category.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Category cannot be empty'
      });
    }

    if (category.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Category name is too long (maximum 100 characters)'
      });
    }

    const skillQuery = `
      INSERT INTO psa_skills (name, description, category)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const skillValues = [name.trim(), description.trim(), category.trim()];
    
    const skillResult = await pool.query(skillQuery, skillValues);
    const skill = skillResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Skill created successfully',
      data: skill
    });

  } catch (error) {
    console.error('Error in createSkill:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Server error while creating skill';
    if (error.message.includes('psa_skills_category_check')) {
      errorMessage = 'Invalid category value. Please use a valid category name.';
    } else if (error.message.includes('duplicate key')) {
      errorMessage = 'A skill with this name already exists.';
    } else if (error.message.includes('violates check constraint')) {
      errorMessage = 'Invalid data provided. Please check your input values.';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
};

// Update Skill
exports.updateSkill = async (req, res) => {
  try {
    const { skillId } = req.params;
    const { name, description, category } = req.body;

    if (!skillId) {
      return res.status(400).json({
        success: false,
        message: 'Skill ID is required'
      });
    }

    const skillQuery = `
      UPDATE psa_skills 
      SET name = $1, description = $2, category = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const skillValues = [name, description, category, skillId];
    const skillResult = await pool.query(skillQuery, skillValues);

    if (skillResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    res.json({
      success: true,
      message: 'Skill updated successfully',
      data: skillResult.rows[0]
    });

  } catch (error) {
    console.error('Error in updateSkill:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating skill',
      error: error.message
    });
  }
};

// Delete Skill
exports.deleteSkill = async (req, res) => {
  try {
    const { skillId } = req.params;

    if (!skillId) {
      return res.status(400).json({
        success: false,
        message: 'Skill ID is required'
      });
    }

    // Check if skill is being used by any resources
    const usageQuery = `
      SELECT COUNT(*) as count 
      FROM psa_resource_skills 
      WHERE skill_id = $1
    `;
    const usageResult = await pool.query(usageQuery, [skillId]);

    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete skill that is assigned to resources'
      });
    }

    const deleteQuery = `
      UPDATE psa_skills 
      SET is_deleted = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const deleteResult = await pool.query(deleteQuery, [skillId]);

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    res.json({
      success: true,
      message: 'Skill deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteSkill:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting skill',
      error: error.message
    });
  }
};

// Create Certification
// exports.createCertification = async (req, res) => {
//   try {
//     const { name, description, category, validity_period_months, external_link } = req.body;

//     if (!name || !description || !category) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: name, description, category'
//       });
//     }

//     const certQuery = `
//       INSERT INTO psa_certifications (name, description, issuing_organization, validity_period_months, external_link)
//       VALUES ($1, $2, $3, $4, $5)
//       RETURNING *
//     `;

//     const certValues = [name, description, category, validity_period_months || null, external_link || null];
//     const certResult = await pool.query(certQuery, certValues);
//     const certification = certResult.rows[0];

//     res.status(201).json({
//       success: true,
//       message: 'Certification created successfully',
//       data: certification
//     });

//   } catch (error) {
//     console.error('Error in createCertification:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while creating certification',
//       error: error.message
//     });
//   }
// };

exports.createCertification = async (req, res) => {
  try {
    const { name, description, validity_period_months } = req.body;
 
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, description'
      });
    }
 
    const dateObtained = new Date(); // current date
    let expirationDate = null;
 
    if (validity_period_months) {
      expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + validity_period_months);
    }
 
    const status = 'active'; // default status
 
    const certQuery = `
      INSERT INTO psa_resource_certifications (name, description, date_obtained, expiration_date, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
 
    const certValues = [name, description, dateObtained, expirationDate, status];
 
    const certResult = await pool.query(certQuery, certValues);
    const certification = certResult.rows[0];
 
    res.status(201).json({
      success: true,
      message: 'Certification created successfully',
      data: certification
    });
 
  } catch (error) {
    console.error('Error in createCertification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating certification',
      error: error.message
    });
  }
};

// Update Certification
exports.updateCertification = async (req, res) => {
  try {
    const { certificationId } = req.params;
    const { name, description, category, validity_period_months, external_link } = req.body;

    if (!certificationId) {
      return res.status(400).json({
        success: false,
        message: 'Certification ID is required'
      });
    }

    const certQuery = `
      UPDATE psa_certifications 
      SET name = $1, description = $2, issuing_organization = $3, validity_period_months = $4, external_link = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

    const certValues = [name, description, category, validity_period_months || null, external_link || null, certificationId];
    const certResult = await pool.query(certQuery, certValues);

    if (certResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certification not found'
      });
    }

    res.json({
      success: true,
      message: 'Certification updated successfully',
      data: certResult.rows[0]
    });

  } catch (error) {
    console.error('Error in updateCertification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating certification',
      error: error.message
    });
  }
};

// Delete Certification
// exports.deleteCertification = async (req, res) => {
//   try {
//     const { certificationId } = req.params;

//     if (!certificationId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Certification ID is required'
//       });
//     }

//     // Check if certification is being used by any resources
//     const usageQuery = `
//       SELECT COUNT(*) as count 
//       FROM psa_resource_certifications 
//       WHERE certification_id = $1
//     `;
//     const usageResult = await pool.query(usageQuery, [certificationId]);

//     if (parseInt(usageResult.rows[0].count) > 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot delete certification that is assigned to resources'
//       });
//     }

//     // const deleteQuery = `
//     //   UPDATE psa_certifications 
//     //   SET is_deleted = true, updated_at = NOW()
//     //   WHERE id = $1
//     //   RETURNING *
//     // `;
//      const deleteQuery = `
//       UPDATE psa_resource_certifications 
//       SET is_deleted = true, updated_at = NOW()
//       WHERE certification_id = $1
//       RETURNING *
//     `;

//     const deleteResult = await pool.query(deleteQuery, [certificationId]);

//     if (deleteResult.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'Certification not found'
//       });
//     }

//     res.json({
//       success: true,
//       message: 'Certification deleted successfully'
//     });

//   } catch (error) {
//     console.error('Error in deleteCertification:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while deleting certification',
//       error: error.message
//     });
//   }
// };

exports.deleteCertification = async (req, res) => {
  try {
    const { certificationId } = req.params;
 
    if (!certificationId) {
      return res.status(400).json({
        success: false,
        message: 'Certification ID is required'
      });
    }
 
    // Check if certification is being used by any resources
    const usageQuery = `
      SELECT COUNT(*) as count
      FROM psa_resource_certifications
      WHERE certification_id = $1 AND is_deleted = false
    `;
    const usageResult = await pool.query(usageQuery, [certificationId]);
 
    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete certification that is assigned to resources'
      });
    }
 
    // Delete from master certifications table
    const deleteQuery = `
      UPDATE psa_certifications
      SET is_deleted = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
 
    const deleteResult = await pool.query(deleteQuery, [certificationId]);
 
    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certification not found'
      });
    }
 
    res.json({
      success: true,
      message: 'Certification deleted successfully'
    });
 
  } catch (error) {
    console.error('Error in deleteCertification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting certification',
      error: error.message
    });
  }
};

// Get Company Roles for Department Dropdown
// ========================================================
exports.getCompanyRoles = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    const query = `
      SELECT 
        id,
        name,
        description,
        hierarchy_position,
        parent_role_id,
        hierarchy_level
      FROM company_roles
      WHERE company_id = $1
      ORDER BY hierarchy_position ASC, name ASC
    `;

    const result = await pool.query(query, [companyId]);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error in getCompanyRoles:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching company roles',
      error: error.message
    });
  }
};

// Get All Projects Cost Summaries (Efficient batch API)
// ========================================================
exports.getAllProjectsCostSummaries = async (req, res) => {
  try {
    const { companyId } = req.params;

    // Get all projects with their resource allocations
    const projectsQuery = `
      SELECT 
        p.id, p.name, p.budget_hours,
        p.resource_user_ids, p.resource_allocations,
        p.start_date, p.end_date
      FROM psa_projects p
      WHERE p.company_id = $1 AND p.is_deleted = false
      ORDER BY p.created_at DESC
    `;
    
    const projectsResult = await pool.query(projectsQuery, [companyId]);
    const projects = projectsResult.rows;

    if (projects.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Get all resources for all projects in one query
    const allProjectIds = projects.map(p => p.id);
    const resourcesQuery = `
      SELECT 
        p.id as project_id,
        u.id as user_id,
        r.hourly_rate,
        r.hours_per_week,
        p.resource_allocations
      FROM psa_projects p
      CROSS JOIN LATERAL unnest(p.resource_user_ids) AS resource_user_id
      INNER JOIN users u ON u.id = resource_user_id
      INNER JOIN company_roles cr ON u.company_role = cr.id
      LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
      WHERE p.id = ANY($1) 
        AND p.company_id = $2
        AND u.status = 'enabled'
    `;
    
    const resourcesResult = await pool.query(resourcesQuery, [allProjectIds, companyId]);
    const resources = resourcesResult.rows;

    // Group resources by project
    const resourcesByProject = resources.reduce((acc, resource) => {
      if (!acc[resource.project_id]) {
        acc[resource.project_id] = [];
      }
      acc[resource.project_id].push(resource);
      return acc;
    }, {});

    // Calculate cost summaries for all projects
    const currentDate = new Date();
    const costSummaries = projects.map(project => {
      const projectResources = resourcesByProject[project.id] || [];
      
      // Calculate weeks elapsed (using same calculation as detail API)
      const projectStartDate = new Date(project.start_date);
      const weeksElapsed = Math.max(0, (currentDate - projectStartDate) / (7 * 24 * 60 * 60 * 1000));

      // Calculate total spent
      const totalSpent = projectResources.reduce((sum, resource, index) => {
        const allocationPercentage = project.resource_allocations[index] || 0;
        const hourlyRate = parseFloat(resource.hourly_rate) || 0;
        const hoursPerWeek = resource.hours_per_week || 40;
        
        const weeklyCost = (allocationPercentage / 100) * hoursPerWeek * hourlyRate;
        return sum + (weeklyCost * weeksElapsed);
      }, 0);

      const budgetAmount = project.budget_hours;
      const budgetRemaining = Math.max(0, budgetAmount - totalSpent);
      const costProgress = budgetAmount > 0 ? Math.min((totalSpent / budgetAmount) * 100, 100) : 0;

      return {
        projectId: project.id,
        budgetAmount,
        totalSpent: Math.round(totalSpent * 100) / 100,
        budgetRemaining: Math.round(budgetRemaining * 100) / 100,
        costProgress: Math.round(costProgress * 100) / 100
      };
    });

    res.json({
      success: true,
      data: costSummaries
    });

  } catch (error) {
    console.error('Error in getAllProjectsCostSummaries:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching projects cost summaries',
      error: error.message
    });
  }
};

// Get Project Cost Analysis
// ========================================================
exports.getProjectCostAnalysis = async (req, res) => {
  try {
    const { companyId, projectId } = req.params;
    const { timeHorizon = 12 } = req.query; // months

    // Get project details with resource allocations
    const projectQuery = `
      SELECT 
        p.id, p.name, p.description, p.start_date, p.end_date, p.budget_hours,
        p.resource_user_ids, p.resource_roles, p.resource_allocations,
        p.created_at, p.updated_at
      FROM psa_projects p
      WHERE p.id = $1 AND p.company_id = $2 AND p.is_deleted = false
    `;
    
    const projectResult = await pool.query(projectQuery, [projectId, companyId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const project = projectResult.rows[0];
    
    // Get resource details with hourly rates
    const resourceQuery = `
      SELECT 
        u.id as user_id,
        r.id as resource_id,
        u.name,
        u.email,
        r.hourly_rate,
        r.hours_per_week,
        r.currency,
        p.resource_roles,
        p.resource_allocations
      FROM users u
      INNER JOIN company_roles cr ON u.company_role = cr.id
      LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
      CROSS JOIN psa_projects p
      WHERE p.id = $1 
        AND p.company_id = $2
        AND u.id = ANY(p.resource_user_ids)
        AND u.status = 'enabled'
    `;
    
    const resourceResult = await pool.query(resourceQuery, [projectId, companyId]);
    const resources = resourceResult.rows;

    // Calculate costs
    const currentDate = new Date();
    const projectStartDate = new Date(project.start_date);
    const projectEndDate = new Date(project.end_date);
    
    // Calculate weeks elapsed and remaining (using same calculation as batch API)
    const weeksElapsed = Math.max(0, (currentDate - projectStartDate) / (7 * 24 * 60 * 60 * 1000));
    const totalWeeks = (projectEndDate - projectStartDate) / (7 * 24 * 60 * 60 * 1000);
    const weeksRemaining = Math.max(0, totalWeeks - weeksElapsed);

    // Calculate resource costs
    const resourceCosts = resources.map((resource, index) => {
      const allocationPercentage = project.resource_allocations[index] || 0;
      const hourlyRate = parseFloat(resource.hourly_rate) || 0;
      const hoursPerWeek = resource.hours_per_week || 40;
      
      const weeklyCost = (allocationPercentage / 100) * hoursPerWeek * hourlyRate;
      const totalCost = weeklyCost * weeksElapsed;
      const remainingCost = weeklyCost * weeksRemaining;
      
      return {
        userId: resource.user_id,
        resourceId: resource.resource_id,
        name: resource.name,
        email: resource.email,
        role: project.resource_roles[index] || 'Member',
        allocationPercentage,
        hourlyRate,
        hoursPerWeek,
        weeklyCost: Math.round(weeklyCost * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        remainingCost: Math.round(remainingCost * 100) / 100,
        currency: resource.currency || 'USD'
      };
    });

    // Calculate totals
    const totalWeeklyCost = resourceCosts.reduce((sum, resource) => sum + resource.weeklyCost, 0);
    const totalSpent = resourceCosts.reduce((sum, resource) => sum + resource.totalCost, 0);
    const totalRemaining = resourceCosts.reduce((sum, resource) => sum + resource.remainingCost, 0);
    const totalProjectCost = totalSpent + totalRemaining;

    // Calculate progress based on cost
    const budgetAmount = project.budget_hours; // Using budget_hours as budget amount
    const costProgress = budgetAmount > 0 ? Math.min((totalSpent / budgetAmount) * 100, 100) : 0;
    const budgetRemaining = Math.max(0, budgetAmount - totalSpent);

    // Calculate time-based progress
    const timeProgress = totalWeeks > 0 ? Math.min((weeksElapsed / totalWeeks) * 100, 100) : 0;

    // Cost efficiency metrics
    const costEfficiency = weeksElapsed > 0 ? totalSpent / weeksElapsed : 0;
    const projectedTotalCost = totalWeeklyCost * totalWeeks;
    const budgetVariance = budgetAmount - projectedTotalCost;
    const budgetVariancePercentage = budgetAmount > 0 ? (budgetVariance / budgetAmount) * 100 : 0;

    res.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          startDate: project.start_date,
          endDate: project.end_date,
          budgetAmount,
          weeksElapsed,
          weeksRemaining,
          totalWeeks
        },
        costs: {
          totalWeeklyCost: Math.round(totalWeeklyCost * 100) / 100,
          totalSpent: Math.round(totalSpent * 100) / 100,
          totalRemaining: Math.round(totalRemaining * 100) / 100,
          totalProjectCost: Math.round(totalProjectCost * 100) / 100,
          budgetRemaining: Math.round(budgetRemaining * 100) / 100
        },
        progress: {
          costProgress: Math.round(costProgress * 100) / 100,
          timeProgress: Math.round(timeProgress * 100) / 100,
          costEfficiency: Math.round(costEfficiency * 100) / 100
        },
        budget: {
          projectedTotalCost: Math.round(projectedTotalCost * 100) / 100,
          budgetVariance: Math.round(budgetVariance * 100) / 100,
          budgetVariancePercentage: Math.round(budgetVariancePercentage * 100) / 100,
          isOverBudget: budgetVariance < 0
        },
        resources: resourceCosts
      }
    });

  } catch (error) {
    console.error('Error in getProjectCostAnalysis:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching project cost analysis',
      error: error.message
    });
  }
};

// Get Project Performance Report Data
// ========================================================
exports.getProjectPerformanceReport = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { timeRange = 'current', statusFilter = 'all' } = req.query;

    // Get all projects with their basic information
    const projectsQuery = `
      SELECT 
        p.id, p.name, p.description, p.methodology,
        p.start_date, p.end_date, p.budget_hours,
        p.resource_user_ids, p.resource_roles, p.resource_allocations,
        p.created_at, p.updated_at,
        CASE 
          WHEN p.is_active = true THEN 'active'
          ELSE 'inactive'
        END as status
      FROM psa_projects p
      WHERE p.company_id = $1 AND p.is_deleted = false
      ORDER BY p.created_at DESC
    `;
    
    const projectsResult = await pool.query(projectsQuery, [companyId]);
    const projects = projectsResult.rows;

    if (projects.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: {
            totalProjects: 0,
            onSchedule: 0,
            onBudget: 0,
            averageScore: 0
          },
          projects: [],
          budgetPerformance: {
            underBudget: 0,
            onBudget: 0,
            overBudget: 0
          },
          insights: []
        }
      });
    }

    // Get cost summaries for all projects
    const allProjectIds = projects.map(p => p.id);
    const costSummariesQuery = `
      SELECT 
        p.id as project_id,
        p.name,
        p.budget_hours,
        p.resource_user_ids,
        p.resource_allocations,
        p.start_date,
        p.end_date,
        SUM(
          CASE 
            WHEN r.hourly_rate IS NOT NULL AND r.hours_per_week IS NOT NULL 
            THEN r.hourly_rate * r.hours_per_week * (p.resource_allocations[array_position(p.resource_user_ids, u.id)] / 100.0)
            ELSE 0 
          END
        ) as weekly_cost
      FROM psa_projects p
      CROSS JOIN LATERAL unnest(p.resource_user_ids) AS resource_user_id
      INNER JOIN users u ON u.id = resource_user_id
      INNER JOIN company_roles cr ON u.company_role = cr.id
      LEFT JOIN psa_resources r ON u.id = r.user_id AND r.is_deleted = false
      WHERE p.id = ANY($1) 
        AND p.company_id = $2
        AND u.status = 'enabled'
      GROUP BY p.id, p.name, p.budget_hours, p.resource_user_ids, p.resource_allocations, p.start_date, p.end_date
    `;
    
    const costResult = await pool.query(costSummariesQuery, [allProjectIds, companyId]);
    const costData = costResult.rows;

    // Get story progress for all projects
    const storyProgressQuery = `
      SELECT 
        p.id as project_id,
        COUNT(CASE WHEN bli.status = 'done' AND bli.type = 'story' THEN 1 END) as completed_stories,
        COUNT(CASE WHEN bli.type = 'story' THEN 1 END) as total_stories,
        CASE 
          WHEN COUNT(CASE WHEN bli.type = 'story' THEN 1 END) > 0 
          THEN COUNT(CASE WHEN bli.status = 'done' AND bli.type = 'story' THEN 1 END) * 100.0 / COUNT(CASE WHEN bli.type = 'story' THEN 1 END)
          ELSE 0 
        END as completion_percentage
      FROM psa_projects p
      LEFT JOIN psa_backlog_items bli ON p.id = bli.project_id AND bli.is_deleted = false
      WHERE p.id = ANY($1) AND p.company_id = $2
      GROUP BY p.id
    `;
    
    const storyResult = await pool.query(storyProgressQuery, [allProjectIds, companyId]);
    const storyData = storyResult.rows;

    // Calculate performance metrics for each project
    const currentDate = new Date();
    const performanceData = projects.map(project => {
      const costInfo = costData.find(c => c.project_id === project.id);
      const storyInfo = storyData.find(s => s.project_id === project.id);
      
      const startDate = new Date(project.start_date);
      const endDate = new Date(project.end_date);
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsedTime = Math.max(0, currentDate.getTime() - startDate.getTime());
      const timeProgress = totalDuration > 0 ? Math.min((elapsedTime / totalDuration) * 100, 100) : 0;
      
      const weeklyCost = parseFloat(costInfo?.weekly_cost || 0);
      const totalWeeks = totalDuration > 0 ? totalDuration / (7 * 24 * 60 * 60 * 1000) : 0;
      const weeksElapsed = Math.max(0, elapsedTime / (7 * 24 * 60 * 60 * 1000));
      
      const totalSpent = weeklyCost * weeksElapsed;
      const projectedTotalCost = weeklyCost * totalWeeks;
      const budgetAmount = parseFloat(project.budget_hours || 0); // budget_hours is already the budget amount
      
      const budgetVariance = budgetAmount > 0 ? ((totalSpent - budgetAmount) / budgetAmount) * 100 : 0;
      const scheduleVariance = timeProgress > 0 ? ((storyInfo?.completion_percentage || 0) - timeProgress) : 0;
      
      const completedStories = parseInt(storyInfo?.completed_stories || 0);
      const totalStories = parseInt(storyInfo?.total_stories || 0);
      const deliverableProgress = totalStories > 0 ? (completedStories / totalStories) * 100 : 0;
      
      // Calculate performance scores
      const budgetScore = budgetVariance <= 0 ? 100 : Math.max(0, 100 - Math.abs(budgetVariance));
      const scheduleScore = Math.abs(scheduleVariance) <= 10 ? 100 : Math.max(0, 100 - Math.abs(scheduleVariance));
      const deliverableScore = deliverableProgress;
      const overallScore = (budgetScore + scheduleScore + deliverableScore) / 3;
      
      // Determine health status
      let health = 'green';
      if (overallScore < 60 || budgetVariance > 20 || scheduleVariance < -20) {
        health = 'red';
      } else if (overallScore < 80 || budgetVariance > 10 || scheduleVariance < -10) {
        health = 'yellow';
      }
      
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        methodology: project.methodology,
        startDate: project.start_date,
        endDate: project.end_date,
        overallScore: Math.round(overallScore),
        budgetVariance: Math.round(budgetVariance),
        scheduleVariance: Math.round(scheduleVariance),
        deliverables: {
          completed: completedStories,
          total: totalStories,
          percentage: Math.round(deliverableProgress)
        },
        costPerformance: {
          spent: Math.round(totalSpent),
          budget: Math.round(budgetAmount),
          projected: Math.round(projectedTotalCost)
        },
        health: health,
        timeProgress: Math.round(timeProgress),
        workProgress: Math.round(deliverableProgress)
      };
    });

    // Calculate summary statistics
    const totalProjects = performanceData.length;
    const onSchedule = performanceData.filter(p => p.scheduleVariance >= -10).length;
    const onBudget = performanceData.filter(p => p.budgetVariance <= 10).length;
    const averageScore = totalProjects > 0 ? 
      Math.round(performanceData.reduce((sum, p) => sum + p.overallScore, 0) / totalProjects) : 0;

    // Budget performance breakdown
    const budgetPerformance = {
      underBudget: performanceData.filter(p => p.budgetVariance < 0).length,
      onBudget: performanceData.filter(p => p.budgetVariance >= 0 && p.budgetVariance <= 10).length,
      overBudget: performanceData.filter(p => p.budgetVariance > 10).length
    };

    // Generate insights
    const insights = [];
    const excellentProjects = performanceData.filter(p => p.overallScore >= 90).length;
    const delayedProjects = performanceData.filter(p => p.scheduleVariance < -20).length;
    const completedProjects = performanceData.filter(p => p.deliverables.percentage === 100).length;
    
    if (excellentProjects > 0) {
      insights.push({
        type: 'excellent',
        title: 'Excellent Performance',
        message: `${excellentProjects} projects are performing exceptionally well`,
        color: 'green'
      });
    }
    
    if (delayedProjects > 0) {
      insights.push({
        type: 'schedule',
        title: 'Schedule Delays',
        message: `${delayedProjects} projects are behind schedule`,
        color: 'yellow'
      });
    }
    
    if (completedProjects > 0) {
      insights.push({
        type: 'deliverables',
        title: 'Deliverables Complete',
        message: `${completedProjects} projects have completed all deliverables`,
        color: 'blue'
      });
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalProjects,
          onSchedule,
          onBudget,
          averageScore
        },
        projects: performanceData,
        budgetPerformance,
        insights
      }
    });

  } catch (error) {
    console.error('Error in getProjectPerformanceReport:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching project performance report',
      error: error.message
    });
  }
};

// Get Project Story Progress
exports.getProjectStoryProgress = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    // Get story progress data for the project
    const storyProgressQuery = `
      SELECT 
        p.id as project_id,
        p.name as project_name,
        p.description,
        p.start_date,
        p.end_date,
        p.budget_hours,
        
        -- Story counts
        COUNT(bi.id) as total_stories,
        COUNT(CASE WHEN bi.status = 'done' THEN 1 END) as completed_stories,
        COUNT(CASE WHEN bi.status = 'in_progress' THEN 1 END) as in_progress_stories,
        COUNT(CASE WHEN bi.status = 'review' THEN 1 END) as review_stories,
        COUNT(CASE WHEN bi.status = 'backlog' THEN 1 END) as backlog_stories,
        
        -- Story points
        COALESCE(SUM(bi.story_points), 0) as total_story_points,
        COALESCE(SUM(CASE WHEN bi.status = 'done' THEN bi.story_points ELSE 0 END), 0) as completed_story_points,
        COALESCE(SUM(CASE WHEN bi.status = 'in_progress' THEN bi.story_points ELSE 0 END), 0) as in_progress_story_points,
        COALESCE(SUM(CASE WHEN bi.status = 'review' THEN bi.story_points ELSE 0 END), 0) as review_story_points,
        COALESCE(SUM(CASE WHEN bi.status = 'backlog' THEN bi.story_points ELSE 0 END), 0) as backlog_story_points,
        
        -- Progress calculation
        CASE 
          WHEN SUM(bi.story_points) > 0 THEN 
            ROUND((SUM(CASE WHEN bi.status = 'done' THEN bi.story_points ELSE 0 END)::float / SUM(bi.story_points)) * 100)
          ELSE 0 
        END as story_progress_percentage

      FROM psa_projects p
      LEFT JOIN psa_backlog_items bi ON p.id = bi.project_id 
        AND bi.type = 'story' 
        AND bi.is_deleted = false
      WHERE p.id = $1 
        AND p.is_active = true 
        AND p.is_deleted = false
      GROUP BY p.id, p.name, p.description, p.start_date, p.end_date, p.budget_hours
    `;

    const result = await pool.query(storyProgressQuery, [projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const storyProgress = result.rows[0];

    // Calculate additional metrics
    const averageStoryPoints = storyProgress.total_stories > 0 ? 
      Math.round((storyProgress.total_story_points / storyProgress.total_stories) * 100) / 100 : 0;
    
    const completionRate = storyProgress.total_stories > 0 ? 
      Math.round((storyProgress.completed_stories / storyProgress.total_stories) * 100) : 0;

    res.json({
      success: true,
      data: {
        projectId: storyProgress.project_id,
        projectName: storyProgress.project_name,
        description: storyProgress.description,
        startDate: storyProgress.start_date,
        endDate: storyProgress.end_date,
        budgetHours: storyProgress.budget_hours,
        
        // Story counts
        totalStories: parseInt(storyProgress.total_stories) || 0,
        completedStories: parseInt(storyProgress.completed_stories) || 0,
        inProgressStories: parseInt(storyProgress.in_progress_stories) || 0,
        reviewStories: parseInt(storyProgress.review_stories) || 0,
        backlogStories: parseInt(storyProgress.backlog_stories) || 0,
        
        // Story points
        totalStoryPoints: parseInt(storyProgress.total_story_points) || 0,
        completedStoryPoints: parseInt(storyProgress.completed_story_points) || 0,
        inProgressStoryPoints: parseInt(storyProgress.in_progress_story_points) || 0,
        reviewStoryPoints: parseInt(storyProgress.review_story_points) || 0,
        backlogStoryPoints: parseInt(storyProgress.backlog_story_points) || 0,
        
        // Progress calculation
        storyProgressPercentage: Math.round((parseFloat(storyProgress.story_progress_percentage) || 0) * 100) / 100,
        
        // Additional metrics
        averageStoryPoints: averageStoryPoints,
        completionRate: completionRate
      }
    });

  } catch (error) {
    console.error('Error in getProjectStoryProgress:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching project story progress',
      error: error.message
    });
  }
};

// Get All Projects Story Progress
exports.getAllProjectsStoryProgress = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    // Get story progress data for all projects
    const storyProgressQuery = `
      SELECT 
        p.id as project_id,
        p.name as project_name,
        p.description,
        p.start_date,
        p.end_date,
        p.budget_hours,
        
        -- Story counts
        COUNT(bi.id) as total_stories,
        COUNT(CASE WHEN bi.status = 'done' THEN 1 END) as completed_stories,
        COUNT(CASE WHEN bi.status = 'in_progress' THEN 1 END) as in_progress_stories,
        COUNT(CASE WHEN bi.status = 'review' THEN 1 END) as review_stories,
        COUNT(CASE WHEN bi.status = 'backlog' THEN 1 END) as backlog_stories,
        
        -- Story points
        COALESCE(SUM(bi.story_points), 0) as total_story_points,
        COALESCE(SUM(CASE WHEN bi.status = 'done' THEN bi.story_points ELSE 0 END), 0) as completed_story_points,
        COALESCE(SUM(CASE WHEN bi.status = 'in_progress' THEN bi.story_points ELSE 0 END), 0) as in_progress_story_points,
        COALESCE(SUM(CASE WHEN bi.status = 'review' THEN bi.story_points ELSE 0 END), 0) as review_story_points,
        COALESCE(SUM(CASE WHEN bi.status = 'backlog' THEN bi.story_points ELSE 0 END), 0) as backlog_story_points,
        
        -- Progress calculation
        CASE 
          WHEN SUM(bi.story_points) > 0 THEN 
            ROUND((SUM(CASE WHEN bi.status = 'done' THEN bi.story_points ELSE 0 END)::float / SUM(bi.story_points)) * 100)
          ELSE 0 
        END as story_progress_percentage

      FROM psa_projects p
      LEFT JOIN psa_backlog_items bi ON p.id = bi.project_id 
        AND bi.type = 'story' 
        AND bi.is_deleted = false
      WHERE p.company_id = $1 
        AND p.is_active = true 
        AND p.is_deleted = false
      GROUP BY p.id, p.name, p.description, p.start_date, p.end_date, p.budget_hours
      ORDER BY p.created_at DESC
    `;

    const result = await pool.query(storyProgressQuery, [companyId]);
    const projects = result.rows;

    // Calculate additional metrics for each project
    const projectsWithMetrics = projects.map(storyProgress => {
      const averageStoryPoints = storyProgress.total_stories > 0 ? 
        Math.round((storyProgress.total_story_points / storyProgress.total_stories) * 100) / 100 : 0;
      
      const completionRate = storyProgress.total_stories > 0 ? 
        Math.round((storyProgress.completed_stories / storyProgress.total_stories) * 100) : 0;

      return {
        projectId: storyProgress.project_id,
        projectName: storyProgress.project_name,
        description: storyProgress.description,
        startDate: storyProgress.start_date,
        endDate: storyProgress.end_date,
        budgetHours: storyProgress.budget_hours,
        
        // Story counts
        totalStories: parseInt(storyProgress.total_stories) || 0,
        completedStories: parseInt(storyProgress.completed_stories) || 0,
        inProgressStories: parseInt(storyProgress.in_progress_stories) || 0,
        reviewStories: parseInt(storyProgress.review_stories) || 0,
        backlogStories: parseInt(storyProgress.backlog_stories) || 0,
        
        // Story points
        totalStoryPoints: parseInt(storyProgress.total_story_points) || 0,
        completedStoryPoints: parseInt(storyProgress.completed_story_points) || 0,
        inProgressStoryPoints: parseInt(storyProgress.in_progress_story_points) || 0,
        reviewStoryPoints: parseInt(storyProgress.review_story_points) || 0,
        backlogStoryPoints: parseInt(storyProgress.backlog_story_points) || 0,
        
        // Progress calculation
        storyProgressPercentage: Math.round((parseFloat(storyProgress.story_progress_percentage) || 0) * 100) / 100,
        
        // Additional metrics
        averageStoryPoints: averageStoryPoints,
        completionRate: completionRate
      };
    });

    res.json({
      success: true,
      data: projectsWithMetrics
    });

  } catch (error) {
    console.error('Error in getAllProjectsStoryProgress:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching projects story progress',
      error: error.message
    });
  }
};

// Get Financial Summary Report Data
// ========================================================
exports.getFinancialSummaryReport = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { timeRange = 'ytd', startDate, endDate } = req.query;

    // Convert companyId to integer since the database expects integer
    const companyIdInt = parseInt(companyId);
    if (isNaN(companyIdInt)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    // Calculate date range
    let dateFilter = '';
    let queryParams = [companyIdInt];
    
    if (startDate && endDate) {
      dateFilter = 'AND p.start_date >= $2 AND p.start_date <= $3';
      queryParams.push(startDate, endDate);
    } else {
      const currentDate = new Date();
      const yearStart = new Date(currentDate.getFullYear(), 0, 1);
      dateFilter = 'AND p.start_date >= $2';
      queryParams.push(yearStart.toISOString().split('T')[0]);
    }

    // Get all projects with their resource allocations and costs
    const projectsQuery = `
      SELECT 
        p.id, p.name, p.description, p.methodology, p.type,
        p.start_date, p.end_date, p.budget_hours,
        p.resource_user_ids, p.resource_roles, p.resource_allocations,
        p.created_at, p.updated_at,
        CASE 
          WHEN p.is_active = true THEN 'active'
          ELSE 'inactive'
        END as status
      FROM psa_projects p
      WHERE p.company_id = $1 AND p.is_deleted = false ${dateFilter}
      ORDER BY p.created_at DESC
    `;
    
    const projectsResult = await pool.query(projectsQuery, queryParams);
    const projects = projectsResult.rows;

    if (projects.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: {
            totalRevenue: 0,
            totalCosts: 0,
            grossProfit: 0,
            profitMargin: 0
          },
          kpis: {
            billableHours: 0,
            averageHourlyRate: 0,
            resourceUtilization: 0,
            revenuePerResource: 0
          },
          revenueByDepartment: {},
          projectProfitability: [],
          monthlyTrends: [],
          insights: []
        }
      });
    }

    // Get detailed cost and revenue data for all projects
    // Get all project IDs - they are UUIDs, not integers
    const allProjectIds = projects.map(p => p.id).filter(id => id);
    
    if (allProjectIds.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: {
            totalRevenue: 0,
            totalCosts: 0,
            grossProfit: 0,
            profitMargin: 0
          },
          kpis: {
            billableHours: 0,
            averageHourlyRate: 0,
            resourceUtilization: 0,
            revenuePerResource: 0
          },
          revenueByDepartment: {},
          projectProfitability: [],
          monthlyTrends: [],
          insights: []
        }
      });
    }

    // Let's try a much simpler query first to isolate the UUID issue
    let financialData = [];
    
    for (const projectId of allProjectIds) {
      // First, let's just get the project data without joins
      const simpleProjectQuery = `
        SELECT 
          p.id as project_id,
          p.name as project_name,
          p.type as project_type,
          p.budget_hours,
          p.resource_user_ids,
          p.resource_allocations,
          p.start_date,
          p.end_date
        FROM psa_projects p
        WHERE p.id = $1
          AND p.company_id = $2
      `;
      
      const projectResult = await pool.query(simpleProjectQuery, [projectId, companyIdInt]);
      
      if (projectResult.rows.length > 0) {
        const project = projectResult.rows[0];
        
        // Now get user data separately if there are resource_user_ids
        if (project.resource_user_ids && project.resource_user_ids.length > 0) {
          for (const userId of project.resource_user_ids) {
            const userQuery = `
              SELECT 
                u.id as user_id,
                u.name as user_name,
                u.email,
                cr.name as department_name
              FROM users u
              INNER JOIN company_roles cr ON u.company_role = cr.id
              WHERE u.id = $1 AND u.status = 'enabled'
            `;
            
            const userResult = await pool.query(userQuery, [userId]);
            
            if (userResult.rows.length > 0) {
              const user = userResult.rows[0];
              
              // Get resource data separately
              const resourceQuery = `
                SELECT 
                  r.hourly_rate,
                  r.hours_per_week,
                  r.currency
                FROM psa_resources r
                WHERE r.user_id = $1 AND r.is_deleted = false
              `;
              
              const resourceResult = await pool.query(resourceQuery, [userId]);
              const resource = resourceResult.rows[0] || {};
              
              // Combine the data
              financialData.push({
                project_id: project.project_id,
                project_name: project.project_name,
                project_type: project.project_type,
                budget_hours: project.budget_hours,
                resource_user_ids: project.resource_user_ids,
                resource_allocations: project.resource_allocations,
                start_date: project.start_date,
                end_date: project.end_date,
                user_id: user.user_id,
                user_name: user.user_name,
                email: user.email,
                department_name: user.department_name,
                hourly_rate: resource.hourly_rate || 0,
                hours_per_week: resource.hours_per_week || 40,
                currency: resource.currency || 'USD'
              });
            }
          }
        }
      }
    }

    // Group financial data by project
    const projectFinancials = {};
    financialData.forEach(item => {
      if (!projectFinancials[item.project_id]) {
        projectFinancials[item.project_id] = {
          projectId: item.project_id,
          projectName: item.project_name,
          projectType: item.project_type,
          budgetHours: item.budget_hours,
          startDate: item.start_date,
          endDate: item.end_date,
          resources: []
        };
      }
      
      projectFinancials[item.project_id].resources.push({
        userId: item.user_id,
        userName: item.user_name,
        email: item.user_email,
        department: item.department_name,
        hourlyRate: parseFloat(item.hourly_rate || 0),
        hoursPerWeek: item.hours_per_week || 40,
        currency: item.currency || 'USD'
      });
    });

    // Calculate financial metrics
    const currentDate = new Date();
    let totalRevenue = 0;
    let totalCosts = 0;
    let totalBillableHours = 0;
    let departmentRevenue = {};
    let projectProfitability = [];
    let monthlyTrends = [];
    let resourceUtilization = 0;
    let totalResources = 0;

    // Calculate monthly trends (last 6 months)
    const monthlyData = {};
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().substring(0, 7); // YYYY-MM
      monthlyData[monthKey] = { revenue: 0, costs: 0, profit: 0 };
    }

    Object.values(projectFinancials).forEach(project => {
      const projectStartDate = new Date(project.startDate);
      const projectEndDate = new Date(project.endDate);
      const totalDuration = projectEndDate.getTime() - projectStartDate.getTime();
      const elapsedTime = Math.max(0, currentDate.getTime() - projectStartDate.getTime());
      const weeksElapsed = Math.max(0, elapsedTime / (7 * 24 * 60 * 60 * 1000));
      const totalWeeks = totalDuration > 0 ? totalDuration / (7 * 24 * 60 * 60 * 1000) : 0;

      let projectRevenue = 0;
      let projectCosts = 0;
      let projectBillableHours = 0;

      project.resources.forEach((resource, index) => {
        const allocationPercentage = projects.find(p => p.id === project.projectId)?.resource_allocations[index] || 0;
        const weeklyCost = (allocationPercentage / 100) * resource.hoursPerWeek * resource.hourlyRate;
        const totalCost = weeklyCost * weeksElapsed;
        const totalRevenue = totalCost * 1.3; // 30% markup for revenue calculation
        const billableHours = (allocationPercentage / 100) * resource.hoursPerWeek * weeksElapsed;

        projectCosts += totalCost;
        projectRevenue += totalRevenue;
        projectBillableHours += billableHours;

        // Department revenue
        departmentRevenue[resource.department] = (departmentRevenue[resource.department] || 0) + totalRevenue;

        // Monthly trends calculation - Only add to months when project is active
        const currentMonth = new Date().toISOString().substring(0, 7);
        const projectStartMonth = projectStartDate.toISOString().substring(0, 7);
        const projectEndMonth = projectEndDate.toISOString().substring(0, 7);
        
        // Only add data for months when the project is actually running
        if (projectStartMonth <= currentMonth && projectEndMonth >= projectStartMonth) {
          const monthlyCost = weeklyCost * 4; // Approximate monthly cost
          const monthlyRevenue = monthlyCost * 1.3;
          
          // Add to current month and previous months if project was running
          for (let i = 0; i < 6; i++) {
            const monthDate = new Date();
            monthDate.setMonth(monthDate.getMonth() - i);
            const monthKey = monthDate.toISOString().substring(0, 7);
            
            if (monthlyData[monthKey] && monthKey >= projectStartMonth && monthKey <= projectEndMonth) {
              monthlyData[monthKey].revenue += monthlyRevenue;
              monthlyData[monthKey].costs += monthlyCost;
              monthlyData[monthKey].profit += (monthlyRevenue - monthlyCost);
            }
          }
        }
      });

      totalRevenue += projectRevenue;
      totalCosts += projectCosts;
      totalBillableHours += projectBillableHours;

      // Project profitability - Round consistently
      const roundedRevenue = Math.round(projectRevenue);
      const roundedCosts = Math.round(projectCosts);
      const roundedProfit = roundedRevenue - roundedCosts; // Calculate profit from rounded values
      const margin = roundedRevenue > 0 ? (roundedProfit / roundedRevenue) * 100 : 0;
      
      projectProfitability.push({
        projectId: project.projectId,
        projectName: project.projectName,
        projectType: project.projectType,
        revenue: roundedRevenue,
        costs: roundedCosts,
        profit: roundedProfit,
        margin: Math.round(margin * 100) / 100,
        status: margin > 20 ? 'green' : margin > 10 ? 'yellow' : 'red',
        billableHours: Math.round(projectBillableHours)
      });

      // Resource utilization calculation
      totalResources += project.resources.length;
    });

    // Calculate KPIs using rounded totals for consistency
    const roundedTotalRevenue = Math.round(totalRevenue);
    const roundedTotalCosts = Math.round(totalCosts);
    const grossProfit = roundedTotalRevenue - roundedTotalCosts;
    const profitMargin = roundedTotalRevenue > 0 ? (grossProfit / roundedTotalRevenue) * 100 : 0;
    const averageHourlyRate = totalBillableHours > 0 ? totalRevenue / totalBillableHours : 0;
    const revenuePerResource = totalResources > 0 ? totalRevenue / totalResources : 0;

    // Convert monthly trends to array
    monthlyTrends = Object.entries(monthlyData).map(([month, data]) => ({
      month: month.substring(5), // Get MM from YYYY-MM
      revenue: Math.round(data.revenue),
      costs: Math.round(data.costs),
      profit: Math.round(data.profit)
    }));

    // Generate insights
    const insights = [];
    const profitableProjects = projectProfitability.filter(p => p.margin > 20).length;
    const lossMakingProjects = projectProfitability.filter(p => p.margin < 0).length;
    const topDepartment = Object.entries(departmentRevenue).reduce((a, b) => a[1] > b[1] ? a : b, ['', 0]);

    if (profitableProjects > 0) {
      insights.push({
        type: 'success',
        title: 'High Profitability',
        message: `${profitableProjects} projects have profit margins above 20%`,
        color: 'green'
      });
    }

    if (lossMakingProjects > 0) {
      insights.push({
        type: 'warning',
        title: 'Loss-Making Projects',
        message: `${lossMakingProjects} projects are currently loss-making`,
        color: 'red'
      });
    }

    if (topDepartment[0]) {
      insights.push({
        type: 'info',
        title: 'Top Revenue Department',
        message: `${topDepartment[0]} generates the highest revenue`,
        color: 'blue'
      });
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue: roundedTotalRevenue,
          totalCosts: roundedTotalCosts,
          grossProfit: grossProfit,
          profitMargin: Math.round(profitMargin * 100) / 100
        },
        kpis: {
          billableHours: Math.round(totalBillableHours),
          averageHourlyRate: Math.round(averageHourlyRate),
          resourceUtilization: Math.round((totalBillableHours / (totalResources * 40 * 52)) * 100), // Assuming 40h/week, 52 weeks/year
          revenuePerResource: Math.round(revenuePerResource)
        },
        revenueByDepartment: Object.fromEntries(
          Object.entries(departmentRevenue).map(([dept, revenue]) => [dept, Math.round(revenue)])
        ),
        projectProfitability: projectProfitability.sort((a, b) => b.profit - a.profit),
        monthlyTrends,
        insights
      }
    });

  } catch (error) {
    console.error('Error in getFinancialSummaryReport:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching financial summary report',
      error: error.message
    });
  }
};

// ========================================================
// PROGRAM INCREMENT MANAGEMENT
// ========================================================

// Helper function to calculate duration in weeks
const calculateDurationInWeeks = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.ceil(diffDays / 7); // Round up to ensure full coverage
};

// Helper function to validate sprint coverage for PI
const validateSprintCoverage = async (piStartDate, piEndDate, sprintIds, coverageThreshold = 80) => {
  if (!sprintIds || sprintIds.length === 0) {
    return { isValid: true, message: 'No sprints selected' };
  }

  // Get sprint details
  const sprintQuery = `
    SELECT id, name, start_date, end_date 
    FROM psa_sprints 
    WHERE id = ANY($1) AND is_deleted = false
    ORDER BY start_date ASC
  `;
  
  const sprintResult = await pool.query(sprintQuery, [sprintIds]);
  const sprints = sprintResult.rows;

  if (sprints.length === 0) {
    return { isValid: false, message: 'No valid sprints found' };
  }

  // Calculate PI duration
  const piDurationWeeks = calculateDurationInWeeks(piStartDate, piEndDate);
  
  // Calculate total sprint duration
  let totalSprintWeeks = 0;
  let gaps = [];
  let overlaps = [];

  // Check for gaps and overlaps
  for (let i = 0; i < sprints.length; i++) {
    const sprint = sprints[i];
    const sprintDuration = calculateDurationInWeeks(sprint.start_date, sprint.end_date);
    totalSprintWeeks += sprintDuration;

    // Check if sprint is within PI timeframe
    // Ensure consistent date parsing by using ISO format
    const sprintStart = new Date(sprint.start_date + 'T00:00:00.000Z');
    const sprintEnd = new Date(sprint.end_date + 'T23:59:59.999Z');
    const piStart = new Date(piStartDate + 'T00:00:00.000Z');
    const piEnd = new Date(piEndDate + 'T23:59:59.999Z');
    
    if (sprintStart < piStart || sprintEnd > piEnd) {
      return { 
        isValid: false, 
        message: `Sprint "${sprint.name}" is outside PI timeframe` 
      };
    }

    // Check for overlaps with next sprint
    if (i < sprints.length - 1) {
      const nextSprint = sprints[i + 1];
      const currentSprintEnd = new Date(sprint.end_date + 'T23:59:59.999Z');
      const nextSprintStart = new Date(nextSprint.start_date + 'T00:00:00.000Z');
      
      if (currentSprintEnd >= nextSprintStart) {
        overlaps.push(`${sprint.name} overlaps with ${nextSprint.name}`);
      }
    }
  }

  // Check for gaps between sprints
  for (let i = 0; i < sprints.length - 1; i++) {
    const currentSprint = sprints[i];
    const nextSprint = sprints[i + 1];
    const currentSprintEnd = new Date(currentSprint.end_date + 'T23:59:59.999Z');
    const nextSprintStart = new Date(nextSprint.start_date + 'T00:00:00.000Z');
    const gapDays = Math.ceil((nextSprintStart - currentSprintEnd) / (1000 * 60 * 60 * 24));
    
    if (gapDays > 1) {
      gaps.push(`${gapDays} days gap between ${currentSprint.name} and ${nextSprint.name}`);
    }
  }

  // Check for gaps at start and end of PI
  if (sprints.length > 0) {
    const firstSprint = sprints[0];
    const lastSprint = sprints[sprints.length - 1];
    
    // Check gap at start
    const firstSprintStart = new Date(firstSprint.start_date + 'T00:00:00.000Z');
    const piStart = new Date(piStartDate + 'T00:00:00.000Z');
    const startGapDays = Math.ceil((firstSprintStart - piStart) / (1000 * 60 * 60 * 24));
    if (startGapDays > 1) {
      gaps.push(`${startGapDays} days gap at PI start`);
    }
    
    // Check gap at end
    const lastSprintEnd = new Date(lastSprint.end_date + 'T23:59:59.999Z');
    const piEnd = new Date(piEndDate + 'T23:59:59.999Z');
    const endGapDays = Math.ceil((piEnd - lastSprintEnd) / (1000 * 60 * 60 * 24));
    if (endGapDays > 1) {
      gaps.push(`${endGapDays} days gap at PI end`);
    }
  }

  // Validate coverage with configurable threshold
  const coveragePercentage = (totalSprintWeeks / piDurationWeeks) * 100;
  
  if (coveragePercentage < coverageThreshold) {
    return { 
      isValid: false, 
      message: `Sprint coverage is only ${coveragePercentage.toFixed(1)}%. Need at least ${coverageThreshold}% coverage.` 
    };
  }

  if (overlaps.length > 0) {
    return { 
      isValid: false, 
      message: `Sprint overlaps detected: ${overlaps.join(', ')}` 
    };
  }

  if (gaps.length > 0) {
    return { 
      isValid: false, 
      message: `Time gaps detected: ${gaps.join(', ')}` 
    };
  }

  return { 
    isValid: true, 
    message: `Sprint coverage: ${coveragePercentage.toFixed(1)}% (${totalSprintWeeks}/${piDurationWeeks} weeks)`,
    coveragePercentage,
    totalSprintWeeks,
    piDurationWeeks
  };
};

// Create Program Increment
const createProgramIncrement = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const {
      project_id,
      name,
      description,
      start_date,
      end_date,
      duration_weeks,
      pi_capacity,
      initial_commitment,
      company_id,
      objectives,
      sprint_ids,
      coverage_threshold
    } = req.body;

    // Validate required fields
    if (!project_id || !name || !description || !start_date || !end_date || !company_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate duration
    if (duration_weeks < 1 || duration_weeks > 6) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be between 1 and 6 weeks'
      });
    }

    // Validate sprint coverage if sprints are provided (strict for create mode)
    if (sprint_ids && sprint_ids.length > 0) {
      const threshold = coverage_threshold || 60; // Default 60% (more flexible)
      const sprintValidation = await validateSprintCoverage(start_date, end_date, sprint_ids, threshold);
      if (!sprintValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: sprintValidation.message
        });
      }
    }

    await client.query('BEGIN');

    // Create Program Increment
    const piQuery = `
      INSERT INTO psa_program_increments (
        project_id, name, description, start_date, end_date, 
        duration_weeks, pi_capacity, initial_commitment, 
        current_commitment, created_by, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)
      RETURNING id
    `;
    
    const piResult = await client.query(piQuery, [
      project_id, name, description, start_date, end_date,
      duration_weeks, pi_capacity || 0, initial_commitment || 0,
      req.user.id, company_id
    ]);

    const piId = piResult.rows[0].id;

    // Note: Business value tracking will be added when the database schema is updated

    // Create objectives if provided
    if (objectives && objectives.length > 0) {
      for (const objective of objectives) {
        const objectiveQuery = `
          INSERT INTO psa_pi_objectives (
            pi_id, title, description, business_value, is_stretch
          ) VALUES ($1, $2, $3, $4, $5)
        `;
        
        await client.query(objectiveQuery, [
          piId,
          objective.title,
          objective.description,
          objective.business_value || 5,
          objective.is_stretch || false
        ]);
      }
    }

    // Assign sprints to PI if provided
    if (sprint_ids && sprint_ids.length > 0) {
      for (const sprintId of sprint_ids) {
        const sprintUpdateQuery = `
          UPDATE psa_sprints 
          SET pi_id = $1, updated_at = NOW()
          WHERE id = $2 AND project_id = $3 AND is_deleted = false
        `;
        
        await client.query(sprintUpdateQuery, [piId, sprintId, project_id]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Program Increment created successfully',
      data: { id: piId }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating Program Increment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating Program Increment',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Get Program Increments for a project
const getProgramIncrements = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { projectId } = req.params;

    const query = `
      SELECT 
        pi.id,
        pi.project_id,
        pi.name,
        pi.description,
        pi.start_date,
        pi.end_date,
        pi.duration_weeks,
        pi.pi_capacity,
        pi.initial_commitment,
        pi.current_commitment,
        pi.status,
        pi.is_deleted,
        pi.created_at,
        pi.updated_at,
        pi.created_by,
        pi.company_id,
        COALESCE(
          json_agg(
            json_build_object(
              'id', obj.id,
              'title', obj.title,
              'description', obj.description,
              'business_value', obj.business_value,
              'is_stretch', obj.is_stretch
            )
          ) FILTER (WHERE obj.id IS NOT NULL),
          '[]'::json
        ) as objectives,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'name', s.name,
              'goal', s.goal,
              'start_date', s.start_date,
              'end_date', s.end_date,
              'capacity', s.capacity,
              'commitment', s.commitment,
              'status', s.status
            )
            ORDER BY s.start_date ASC
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) as sprints
      FROM psa_program_increments pi
      LEFT JOIN psa_pi_objectives obj ON pi.id = obj.pi_id AND obj.is_deleted = false
      LEFT JOIN psa_sprints s ON pi.id = s.pi_id AND s.is_deleted = false
      WHERE pi.project_id = $1 AND pi.is_deleted = false
      GROUP BY pi.id, pi.project_id, pi.name, pi.description, pi.start_date, pi.end_date, 
               pi.duration_weeks, pi.pi_capacity, pi.initial_commitment, pi.current_commitment, 
               pi.status, pi.is_deleted, pi.created_at, pi.updated_at, pi.created_by, pi.company_id
      ORDER BY pi.start_date DESC
    `;

    const result = await client.query(query, [projectId]);

    res.json({
      success: true,
      programIncrements: result.rows
    });

  } catch (error) {
    console.error('Error fetching Program Increments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching Program Increments',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Update Program Increment
const updateProgramIncrement = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const {
      name,
      description,
      start_date,
      end_date,
      duration_weeks,
      pi_capacity,
      current_commitment,
      status,
      sprint_ids,
      coverage_threshold
    } = req.body;

    // Validate sprint coverage if sprints are provided (optional for edit mode)
    let coverageWarning = null;
    if (sprint_ids && sprint_ids.length > 0) {
      const threshold = coverage_threshold || 60; // Default 60% (more flexible for editing)
      const sprintValidation = await validateSprintCoverage(start_date, end_date, sprint_ids, threshold);
      
      if (!sprintValidation.isValid) {
        // For edit mode, show warning but don't block the update
        coverageWarning = sprintValidation.message;
        console.warn(`Sprint coverage warning for PI ${id}: ${coverageWarning}`);
        // Continue with the update instead of returning error
      }
    }

    await client.query('BEGIN');

    // Update Program Increment
    const updateQuery = `
      UPDATE psa_program_increments 
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        duration_weeks = COALESCE($5, duration_weeks),
        pi_capacity = COALESCE($6, pi_capacity),
        current_commitment = COALESCE($7, current_commitment),
        status = COALESCE($8, status),
        updated_at = NOW()
      WHERE id = $9 AND is_deleted = false
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      name, description, start_date, end_date, duration_weeks,
      pi_capacity, current_commitment, status, id
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Program Increment not found'
      });
    }

    // Update sprint assignments if provided
    if (sprint_ids !== undefined) {
      // First, remove all existing sprint assignments for this PI
      await client.query(
        'UPDATE psa_sprints SET pi_id = NULL WHERE pi_id = $1',
        [id]
      );

      // Then assign new sprints if provided
      if (sprint_ids && sprint_ids.length > 0) {
        for (const sprintId of sprint_ids) {
          await client.query(
            'UPDATE psa_sprints SET pi_id = $1, updated_at = NOW() WHERE id = $2 AND is_deleted = false',
            [id, sprintId]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Program Increment updated successfully',
      data: result.rows[0],
      warning: coverageWarning // Include coverage warning if any
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating Program Increment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating Program Increment',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Delete Program Increment
const deleteProgramIncrement = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Soft delete Program Increment
    const deleteQuery = `
      UPDATE psa_program_increments 
      SET is_deleted = true, updated_at = NOW()
      WHERE id = $1 AND is_deleted = false
      RETURNING id
    `;

    const result = await client.query(deleteQuery, [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Program Increment not found'
      });
    }

    // Soft delete associated objectives
    await client.query(`
      UPDATE psa_pi_objectives 
      SET is_deleted = true, updated_at = NOW()
      WHERE pi_id = $1 AND is_deleted = false
    `, [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Program Increment deleted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting Program Increment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting Program Increment',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Delete Resource Skill (from psa_resource_skills table only)
const deleteResourceSkill = async (req, res) => {
  const { resourceId, skillId } = req.params;
  
  try {
    const client = await pool.connect();
    
    // First, get the actual resource_id from psa_resources table using user_id
    const resourceQuery = await client.query(
      `SELECT id FROM psa_resources WHERE user_id = $1`,
      [parseInt(resourceId)]
    );
    
    if (resourceQuery.rows.length === 0) {
      client.release();
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    const actualResourceId = resourceQuery.rows[0].id;
    
    // Now delete from psa_resource_skills table using the actual resource_id
    const result = await client.query(
      `DELETE FROM psa_resource_skills 
       WHERE resource_id = $1 AND skill_id = $2`,
      [actualResourceId, skillId]
    );
    
    client.release();
    
    if (result.rowCount > 0) {
      res.json({
        success: true,
        message: 'Resource skill deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Resource skill not found'
      });
    }
  } catch (error) {
    console.error('Error deleting resource skill:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting resource skill',
      error: error.message
    });
  }
};

// Delete Resource Certification (from psa_resource_certifications table only)
const deleteResourceCertification = async (req, res) => {
  const { resourceId, certificationId } = req.params;
  
  try {
    const client = await pool.connect();
    
    // First, get the actual resource_id from psa_resources table using user_id
    const resourceQuery = await client.query(
      `SELECT id FROM psa_resources WHERE user_id = $1`,
      [parseInt(resourceId)]
    );
    
    if (resourceQuery.rows.length === 0) {
      client.release();
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    const actualResourceId = resourceQuery.rows[0].id;
    
    // Now delete from psa_resource_certifications table using the actual resource_id
    const result = await client.query(
      `DELETE FROM psa_resource_certifications 
       WHERE resource_id = $1 AND certification_id = $2`,
      [actualResourceId, certificationId]
    );
    
    client.release();
    
    if (result.rowCount > 0) {
      res.json({
        success: true,
        message: 'Resource certification deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Resource certification not found'
      });
    }
  } catch (error) {
    console.error('Error deleting resource certification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting resource certification',
      error: error.message
    });
  }
};

// Get Sprints by PI ID
exports.getSprintsByPI = async (req, res) => {
  try {
    const { piId } = req.params;

    if (!piId) {
      return res.status(400).json({
        success: false,
        message: 'PI ID is required'
      });
    }

    const query = `
      SELECT 
        s.*,
        COUNT(bi.id) as total_stories,
        COALESCE(SUM(CASE WHEN bi.status = 'done' THEN bi.story_points ELSE 0 END), 0) as completed_story_points,
        COALESCE(SUM(bi.story_points), 0) as total_story_points
      FROM psa_sprints s
      LEFT JOIN psa_backlog_items bi ON s.project_id = bi.project_id 
        AND bi.type = 'story'
        AND bi.is_deleted = false
      WHERE s.pi_id = $1 AND s.is_deleted = false
      GROUP BY s.id, s.project_id, s.name, s.goal, s.start_date, s.end_date, 
               s.status, s.capacity, s.commitment, s.velocity, s.is_deleted, 
               s.created_at, s.updated_at, s.pi_id
      ORDER BY s.start_date ASC
    `;

    const result = await pool.query(query, [piId]);
    const sprints = result.rows;

    // Calculate velocity for each sprint
    const sprintsWithVelocity = sprints.map(sprint => {
      const velocity = parseInt(sprint.completed_story_points) || 0;
      const commitment = parseInt(sprint.commitment) || 0;
      const totalStoryPoints = parseInt(sprint.total_story_points) || 0;
      
      // Calculate efficiency based on commitment vs velocity
      let efficiency = 0;
      if (commitment > 0 && commitment >= velocity) {
        efficiency = Math.round((velocity / commitment) * 100);
      } else if (totalStoryPoints > 0) {
        efficiency = Math.round((velocity / totalStoryPoints) * 100);
      }

      return {
        ...sprint,
        velocity,
        efficiency,
        completed_story_points: parseInt(sprint.completed_story_points) || 0,
        total_story_points: parseInt(sprint.total_story_points) || 0,
        total_stories: parseInt(sprint.total_stories) || 0
      };
    });

    res.json({
      success: true,
      sprints: sprintsWithVelocity
    });

  } catch (error) {
    console.error('Error fetching sprints by PI:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sprints by PI',
      error: error.message
    });
  }
};

// Export Program Increment functions
exports.createProgramIncrement = createProgramIncrement;
exports.getProgramIncrements = getProgramIncrements;
exports.updateProgramIncrement = updateProgramIncrement;
exports.deleteProgramIncrement = deleteProgramIncrement;

// Update Hierarchical Template
const updateHierarchicalTemplate = async (req, res) => {
  const { templateId } = req.params;
  const { companyId } = req.query;
  const { 
    name, 
    description, 
    category, 
    epics 
  } = req.body;

  try {
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // First, get the main template to verify it exists
      const templateQuery = await client.query(
        `SELECT id FROM psa_project_templates WHERE id = $1 AND company_id = $2`,
        [templateId, companyId]
      );

      if (templateQuery.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      // Update the main template
      await client.query(
        `UPDATE psa_project_templates 
         SET name = $1, description = $2, category = $3, updated_at = NOW()
         WHERE id = $4 AND company_id = $5`,
        [name, description, category, templateId, companyId]
      );

      // Delete existing child templates (epics, features, stories)
      await client.query(
        `DELETE FROM psa_project_templates 
         WHERE parent_id = $1 OR parent_id IN (
           SELECT id FROM psa_project_templates WHERE parent_id = $1
         ) OR parent_id IN (
           SELECT id FROM psa_project_templates WHERE parent_id IN (
             SELECT id FROM psa_project_templates WHERE parent_id = $1
           )
         )`,
        [templateId]
      );

      // Recreate the hierarchical structure
      // Note: Database automatically generates UUIDs for all items (consistent with other APIs)
      for (const epic of epics) {
        // Create epic template
        const epicQuery = `
          INSERT INTO psa_project_templates (
            name, description, type, category, priority, 
            story_points, estimated_hours, required_skills, 
            acceptance_criteria, definition_of_done, tags, 
            usage_count, is_active, created_by, user_id, company_id, project_id, parent_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
            $13, $14, $15, $16, $17, $18
          )
          RETURNING *
        `;
        
        const epicResult = await client.query(epicQuery, [
          epic.name,
          epic.description,
          'epic',
          category,
          epic.priority || 'medium',
          epic.storyPoints || 0,
          epic.estimatedHours || 0,
          Array.isArray(epic.requiredSkills) ? epic.requiredSkills : [],
          Array.isArray(epic.acceptanceCriteria) ? epic.acceptanceCriteria : [],
          Array.isArray(epic.definitionOfDone) ? epic.definitionOfDone : [],
          Array.isArray(epic.tags) ? epic.tags : [],
          0, // usage_count
          true, // is_active
          req.user.id, // created_by
          req.user.id, // user_id
          companyId,
          null, // project_id
          templateId // parent_id
        ]);

        const epicTemplate = epicResult.rows[0];
        const epicId = epicTemplate.id;

        // Create features for this epic
        if (epic.features && epic.features.length > 0) {
          for (const feature of epic.features) {
            const featureQuery = `
              INSERT INTO psa_project_templates (
                name, description, type, category, priority, 
                story_points, estimated_hours, required_skills, 
                acceptance_criteria, definition_of_done, tags, 
                usage_count, is_active, created_by, user_id, company_id, project_id, parent_id
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
                $13, $14, $15, $16, $17, $18
              )
              RETURNING *
            `;
            
            const featureResult = await client.query(featureQuery, [
              feature.name,
              feature.description,
              'feature',
              category,
              feature.priority || 'medium',
              feature.storyPoints || 0,
              feature.estimatedHours || 0,
              Array.isArray(feature.requiredSkills) ? feature.requiredSkills : [],
              Array.isArray(feature.acceptanceCriteria) ? feature.acceptanceCriteria : [],
              Array.isArray(feature.definitionOfDone) ? feature.definitionOfDone : [],
              Array.isArray(feature.tags) ? feature.tags : [],
              0, // usage_count
              true, // is_active
              req.user.id, // created_by
              req.user.id, // user_id
              companyId,
              null, // project_id
              epicId // parent_id
            ]);

            const featureTemplate = featureResult.rows[0];
            const featureId = featureTemplate.id;

            // Create stories for this feature
            if (feature.stories && feature.stories.length > 0) {
              for (const story of feature.stories) {
                const storyQuery = `
                  INSERT INTO psa_project_templates (
                    name, description, type, category, priority, 
                    story_points, estimated_hours, required_skills, 
                    acceptance_criteria, definition_of_done, tags, 
                    usage_count, is_active, created_by, user_id, company_id, project_id, parent_id
                  ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
                    $13, $14, $15, $16, $17, $18
                  )
                  RETURNING *
                `;
                
                const storyResult = await client.query(storyQuery, [
                  story.name,
                  story.description,
                  'story',
                  category,
                  story.priority || 'medium',
                  story.storyPoints || 0,
                  story.estimatedHours || 0,
                  Array.isArray(story.requiredSkills) ? story.requiredSkills : [],
                  Array.isArray(story.acceptanceCriteria) ? story.acceptanceCriteria : [],
                  Array.isArray(story.definitionOfDone) ? story.definitionOfDone : [],
                  Array.isArray(story.tags) ? story.tags : [],
                  0, // usage_count
                  true, // is_active
                  req.user.id, // created_by
                  req.user.id, // user_id
                  companyId,
                  null, // project_id
                  featureId // parent_id
                ]);

                const storyTemplate = storyResult.rows[0];
              }
            }
          }
        }
      }

      await client.query('COMMIT');
      client.release();

      res.status(200).json({
        success: true,
        message: 'Hierarchical template updated successfully',
        data: {
          templateId,
          name,
          description,
          category,
          epicsCount: epics.length
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      throw error;
    }

  } catch (error) {
    console.error('Error updating hierarchical template:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating hierarchical template',
      error: error.message
    });
  }
};

// Export Resource-specific delete functions
exports.deleteResourceSkill = deleteResourceSkill;
exports.deleteResourceCertification = deleteResourceCertification;

// Get User Story Detail for Workspace
const getStoryDetail = async (req, res) => {
  try {
    const { storyId } = req.params;

    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: 'Story ID is required'
      });
    }

    // Query to get comprehensive story details
    const query = `
      SELECT 
        bi.id,
        bi.title,
        bi.description,
        bi.type,
        bi.status,
        bi.priority,
        bi.story_points,
        bi.created_at,
        bi.updated_at,
        bi.parent_id,
        bi.sprint_id,
        bi.project_id,
        bi.acceptance_criteria,
        bi.tags,
        bi.definition_of_done,
        bi.business_value,
        bi.user_persona,
        bi.required_skills,
        p.name as project_name,
        p.description as project_description,
        p.methodology,
        p.end_date as project_end_date,
        s.name as sprint_name,
        s.start_date as sprint_start_date,
        s.end_date as sprint_end_date,
        s.status as sprint_status,
        parent_bi.title as feature_title,
        bi.assignee_id,
        bi.created_by,
        assignee.name as assignee_name,
        assignee.email as assignee_email,
        creator.name as reporter_name,
        creator.email as reporter_email
      FROM psa_backlog_items bi
      LEFT JOIN psa_projects p ON bi.project_id = p.id
      LEFT JOIN psa_sprints s ON (
        CASE 
          WHEN bi.sprint_id IS NOT NULL THEN bi.sprint_id = s.id
          ELSE s.project_id = bi.project_id AND s.id = (
            SELECT id FROM psa_sprints 
            WHERE project_id = bi.project_id 
            AND is_deleted = false 
            AND status != 'completed'
            ORDER BY start_date DESC 
            LIMIT 1
          )
        END
      )
      LEFT JOIN psa_backlog_items parent_bi ON bi.parent_id = parent_bi.id
      LEFT JOIN users assignee ON bi.assignee_id = assignee.id
      LEFT JOIN users creator ON bi.created_by = creator.id
      WHERE bi.id = $1
        AND bi.type = 'story'
        AND bi.is_deleted = false
        AND p.is_active = true
        AND p.is_deleted = false
    `;

    const result = await pool.query(query, [storyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      });
    }

    const story = result.rows[0];

    // Fix malformed JSON fields
    if (typeof story.acceptance_criteria === 'string') {
      try {
        story.acceptance_criteria = JSON.parse(story.acceptance_criteria);
      } catch (e) {
        console.warn('Failed to parse acceptance_criteria as JSON:', story.acceptance_criteria);
        // Handle malformed format like {"item1","item2"}
        const malformedString = story.acceptance_criteria;
        if (malformedString.startsWith('{"') && malformedString.endsWith('"}')) {
          const cleanedString = malformedString.substring(2, malformedString.length - 2);
          story.acceptance_criteria = cleanedString.split('","').map(item => item.trim().replace(/\\"/g, '"'));
        } else {
          story.acceptance_criteria = [story.acceptance_criteria];
        }
      }
    }

    if (typeof story.required_skills === 'string') {
      try {
        story.required_skills = JSON.parse(story.required_skills);
      } catch (e) {
        story.required_skills = [story.required_skills];
      }
    }

    if (typeof story.tags === 'string') {
      try {
        story.tags = JSON.parse(story.tags);
      } catch (e) {
        story.tags = [story.tags];
      }
    }

    // Get discussions/comments for this story
    const discussionsQuery = `
      SELECT 
        id,
        comment_text,
        user_id,
        attachment_filename,
        attachment_url,
        parent_comment_id,
        created_at
      FROM psa_story_discussions 
      WHERE story_id = $1 
        AND is_deleted = false
      ORDER BY created_at ASC
    `;

    const discussionsResult = await pool.query(discussionsQuery, [storyId]);

    // Get team members assigned to this project
    const teamQuery = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.avatar,
        CASE 
          WHEN u.id = $1 THEN 'Assignee'
          WHEN u.id = $2 THEN 'Reporter' 
          ELSE 'Team Member'
        END as role
      FROM users u
      WHERE u.status = 'enabled'
        AND u.id IN (
          SELECT unnest(p.resource_user_ids) 
          FROM psa_projects p 
          WHERE p.id = $3
          UNION ALL
          SELECT $1::integer WHERE $1 IS NOT NULL
          UNION ALL  
          SELECT $2::integer WHERE $2 IS NOT NULL
        )
    `;

    const teamResult = await pool.query(teamQuery, [story.assignee_id, story.created_by, story.project_id]);



    // Let's also debug the resource_user_ids directly
    const debugQuery = `SELECT id, name, resource_user_ids FROM psa_projects WHERE id = $1`;
    const debugResult = await pool.query(debugQuery, [story.project_id]);

    // For now, return discussions WITHOUT user names (we'll need to join with users table)
    // But first create the table structure - so just return basic structure
    const discussions = discussionsResult.rows.map(d => ({
      ...d,
      user_name: 'Template User', // Placeholder
      user_avatar: 'TU'
    }));

    res.json({
      success: true,
      data: {
        story: story,
        discussions: discussions,
        total_discussions: discussions.length,
        team_members: teamResult.rows
      }
    });

  } catch (error) {
    console.error('Error fetching story detail:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: error.message
    });
  }
};

// Story Discussions Controller Functions
const getStoryDiscussions = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: 'Story ID is required'
      });
    }

    // Query to get all discussions for this story with user details
    const query = `
      SELECT 
        sd.id,
        sd.story_id,
        sd.comment_text,
        sd.user_id,
        sd.attachment_filename,
        sd.attachment_url,
        sd.parent_comment_id,
        sd.is_deleted,
        sd.created_at,
        sd.updated_at,
        u.name as user_name,
        u.email as user_email,
        u.avatar as user_avatar
      FROM psa_story_discussions sd
      LEFT JOIN users u ON sd.user_id = u.id
      WHERE sd.story_id = $1 
        AND sd.is_deleted = false
      ORDER BY sd.created_at DESC
    `;

    const result = await pool.query(query, [storyId]);

    const discussions = result.rows.map(discussion => ({
      id: discussion.id,
      comment_text: discussion.comment_text,
      user_id: discussion.user_id,
      user_name: discussion.user_name,
      user_email: discussion.user_email,
      user_avatar: discussion.user_avatar,
      attachment_filename: discussion.attachment_filename,
      attachment_url: discussion.attachment_url,
      parent_comment_id: discussion.parent_comment_id,
      created_at: discussion.created_at,
      updated_at: discussion.updated_at
    }));

    res.json({
      success: true,
      data: {
        discussions: discussions,
        total_count: discussions.length
      }
    });

  } catch (error) {
    console.error('Error fetching story discussions:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: error.message
    });
  }
};

const addStoryDiscussion = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;
    const { 
      comment_text, 
      parent_comment_id = null ,
      customFileName
    } = req.body;

    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: 'Story ID is required'
      });
    }

    if (!comment_text || comment_text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    // First verify that the story exists and user has access to it
    const storyQuery = `
      SELECT bi.id, p.resource_user_ids, bi.assignee_id, bi.created_by
      FROM psa_backlog_items bi
      LEFT JOIN psa_projects p ON bi.project_id = p.id
      WHERE bi.id = $1 
        AND bi.type = 'story'
        AND bi.is_deleted = false
    `;

    const storyResult = await pool.query(storyQuery, [storyId]);

    if (storyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      });
    }

    const story = storyResult.rows[0];

    // Check if user has access to this story (is assigned to the story or is project team member)
    const hasAccess = userId === story.assignee_id || 
                     userId === story.created_by || 
                     (story.resource_user_ids && story.resource_user_ids.includes(userId));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to comment on this story'
      });
    }

    // Insert the new discussion
    const insertQuery = `
      INSERT INTO psa_story_discussions (
        story_id,
        comment_text,
        user_id,
        attachment_filename,
        attachment_url,
        parent_comment_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      storyId,
      comment_text.trim(),
      userId,
      req.file ? customFileName ? customFileName : req.file.originalname : "",
      req.file ? req.file.filename : "",
      parent_comment_id
    ];

    const insertResult = await pool.query(insertQuery, values);
    const newDiscussion = insertResult.rows[0];

    // Fetch user details for the new discussion
    const userQuery = `
      SELECT name, email, avatar 
      FROM users 
      WHERE id = $1
    `;

    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0];

    const responseData = {
      id: newDiscussion.id,
      story_id: newDiscussion.story_id,
      comment_text: newDiscussion.comment_text,
      user_id: newDiscussion.user_id,
      user_name: user.name,
      user_email: user.email,
      user_avatar: user.avatar,
      attachment_filename: newDiscussion.attachment_filename,
      attachment_url: newDiscussion.attachment_url,
      parent_comment_id: newDiscussion.parent_comment_id,
      created_at: newDiscussion.created_at,
      updated_at: newDiscussion.updated_at
    };

    res.status(201).json({
      success: true,
      message: 'Discussion added successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Error adding story discussion:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: error.message
    });
  }
};

// Generate Acceptance Criteria using AI
const generateAcceptanceCriteria = async (req, res) => {
  try {
    const { storyTitle, storyDescription, requiredSkills, companyId, storyPriority } = req.body;
    const userId = req.user.id;

    if (!storyTitle || !storyDescription || !companyId) {
      return res.status(400).json({
        success: false,
        message: "Story title, description, and company ID are required"
      });
    }

    // Get the PSA Acceptance Criteria template
    const templateQuery = `
      SELECT id, name, prompt, platform 
      FROM templates 
      WHERE company_id = $1 AND category = 'psa' AND name ILIKE '%acceptance criteria%'
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const templateResult = await pool.query(templateQuery, [companyId]);
    
    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "PSA Acceptance Criteria template not found. Please create one in Company > Templates."
      });
    }

    const template = templateResult.rows[0];
    
    // Prepare the prompt with story details including priority
    const priority = storyPriority || 'medium';
    const basePrompt = template.prompt
      .replace('{storyTitle}', storyTitle)
      .replace('{storyDescription}', storyDescription)
      .replace('{requiredSkills}', Array.isArray(requiredSkills) ? requiredSkills.join(', ') : requiredSkills || 'Not specified');
    
    // Enhanced prompt with priority-specific instructions
    const formattedPrompt = basePrompt + `

**STORY PRIORITY**: ${priority.toUpperCase()}

**PRIORITY-SPECIFIC INSTRUCTIONS**:
- Generate EXACTLY 3-5 acceptance criteria (not more, not less)
- Focus on the most essential requirements for a ${priority} priority story
- For ${priority} priority: Balance between core functionality and important edge cases
- Prioritize criteria that directly impact user experience and business value

**CRITERIA LIMITS BY PRIORITY**:
- Critical: Focus on core functionality + critical error handling + security
- High: Core functionality + important validation + key error scenarios  
- Medium: Essential functionality + basic validation + common error cases
- Low: Basic functionality + minimal validation

Generate criteria that are appropriate for a ${priority} priority story.`;

    // Get AI model configuration
    const modelQuery = `
      SELECT 
        mo.id as modelid,
        ap.api_key,
        ap.provider
      FROM templates t
      INNER JOIN api_config_models mo ON mo.id = t.platform 
      INNER JOIN api_configurations ap ON ap.id = mo.config_id
      WHERE t.id = $1
    `;
    
    const modelResult = await pool.query(modelQuery, [template.id]);
    
    if (modelResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "AI model configuration not found for this template"
      });
    }

    const modelConfig = modelResult.rows[0];
    
    // Call AI service (using existing pattern from companyStrategyController)
    const aiResponse = await callAIService(formattedPrompt, modelConfig);
    
    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate acceptance criteria",
        error: aiResponse.error
      });
    }

    // Parse JSON response
    let acceptanceCriteria;
    try {
      acceptanceCriteria = JSON.parse(aiResponse.response);
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from response
      const jsonMatch = aiResponse.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        acceptanceCriteria = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to parse AI response as JSON",
          rawResponse: aiResponse.response
        });
      }
    }

    res.status(200).json({
      success: true,
      acceptanceCriteria: acceptanceCriteria.acceptanceCriteria || [],
      summary: acceptanceCriteria.summary || {},
      templateUsed: {
        id: template.id,
        name: template.name
      }
    });

  } catch (error) {
    console.error("Error generating acceptance criteria:", error);
    res.status(500).json({
      success: false,
      message: "Server error while generating acceptance criteria",
      error: error.message
    });
  }
};

// Helper function to call AI service (using existing llmservice pattern)
const callAIService = async (prompt, modelConfig) => {
  try {
    const { provider, api_key, modelid } = modelConfig;
    
    // Use the existing llmservice based on provider
    const { processAI, test_prompt } = require('../utils/llmservice');
    
    let response;
    
    if (provider === 'perplexity') {
      // Use test_prompt for Perplexity with specific model
      const modelQuery = await pool.query(
        `SELECT acm.model FROM api_config_models acm WHERE acm.id = $1`,
        [modelid]
      );
      
      if (modelQuery.rows.length === 0) {
        throw new Error('Model configuration not found');
      }
      
      const model = modelQuery.rows[0].model;
      
      response = await test_prompt(
        '', // system prompt
        prompt, // user prompt  
        2000, // max tokens
        'perplexity', // api
        model // model name
      );
      
      if (!response.status) {
        throw new Error(response.error || 'AI generation failed');
      }
      
      return {
        success: true,
        response: response.preview
      };
      
    } else if (provider === 'claude') {
      // Use processAI for Claude
      response = await processAI('', prompt, 2000);
      
      return {
        success: true,
        response: response
      };
      
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

  } catch (error) {
    console.error("AI Service Error:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get single resource overview with comprehensive details (for Resource Overview page)
exports.getResourceOverview = async (req, res) => {
  try {
    const { resourceId } = req.params;

    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: "Resource ID is required",
      });
    }

    // Get resource details
    const resourceQuery = `
      SELECT 
        r.*,
        u.id as user_id,
        u.name,
        u.email,
        u.avatar,
        u.status as user_status,
        u.created_at as hire_date,
        cr.name as company_role_name
      FROM psa_resources r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN company_roles cr ON u.company_role = cr.id
      WHERE r.id = $1 AND r.is_deleted = false
    `;
    const resourceResult = await pool.query(resourceQuery, [resourceId]);

    if (resourceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    const resource = resourceResult.rows[0];

    // Get resource skills
    const skillsQuery = `
      SELECT 
        rs.id,
        rs.skill_id,
        rs.proficiency_level,
        rs.experience_years,
        rs.last_used_date,
        s.name as skill_name,
        s.description as skill_description,
        s.category as skill_category
      FROM psa_resource_skills rs
      LEFT JOIN psa_skills s ON rs.skill_id = s.id
      WHERE rs.resource_id = $1 AND rs.is_deleted = false
      ORDER BY rs.proficiency_level DESC, s.name ASC
    `;
    const skillsResult = await pool.query(skillsQuery, [resourceId]);

    // Get resource certifications
    const certificationsQuery = `
      SELECT 
        rc.id,
        rc.certification_id,
        rc.obtained_date,
        rc.expiry_date,
        rc.status,
        c.name as certification_name,
        c.issuer,
        c.description as certification_description
      FROM psa_resource_certifications rc
      LEFT JOIN psa_certifications c ON rc.certification_id = c.id
      WHERE rc.resource_id = $1 AND rc.is_deleted = false
      ORDER BY rc.expiry_date ASC
    `;
    const certificationsResult = await pool.query(certificationsQuery, [resourceId]);

    // Get assigned projects
    const projectsQuery = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.status,
        p.start_date,
        p.end_date,
        p.resource_user_ids,
        p.resource_roles,
        p.resource_allocations,
        c.name as client_name
      FROM psa_projects p
      LEFT JOIN accounts c ON p.client_id = c.id
      WHERE p.resource_user_ids @> ARRAY[$1]::integer[]
        AND p.is_deleted = false
        AND p.is_active = true
      ORDER BY p.created_at DESC
    `;
    const projectsResult = await pool.query(projectsQuery, [resource.user_id]);

    // Process assigned projects with allocation info
    const assignedProjects = projectsResult.rows.map(project => {
      const userIndex = project.resource_user_ids.indexOf(resource.user_id);
      const role = project.resource_roles ? project.resource_roles[userIndex] : 'Member';
      const allocation = project.resource_allocations ? project.resource_allocations[userIndex] : 0;
      
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        clientName: project.client_name,
        role,
        allocation
      };
    });

    // Get user stories assigned to this resource
    const storiesQuery = `
      SELECT 
        bi.id,
        bi.title,
        bi.description,
        bi.status,
        bi.priority,
        bi.story_points,
        bi.type,
        p.name as project_name,
        p.id as project_id
      FROM psa_backlog_items bi
      LEFT JOIN psa_projects p ON bi.project_id = p.id
      WHERE bi.assignee_id = $1 
        AND bi.is_deleted = false
        AND p.is_deleted = false
      ORDER BY 
        CASE bi.status 
          WHEN 'in_progress' THEN 1
          WHEN 'review' THEN 2
          WHEN 'backlog' THEN 3
          WHEN 'done' THEN 4
          ELSE 5
        END,
        bi.priority DESC,
        bi.created_at DESC
    `;
    const storiesResult = await pool.query(storiesQuery, [resource.user_id]);

    // Calculate performance metrics
    const totalHours = parseFloat(resource.total_hours) || 0;
    const hourlyRate = parseFloat(resource.hourly_rate) || 0;
    const projectsCount = assignedProjects.length;
    const activeProjectsCount = assignedProjects.filter(p => p.status === 'active').length;
    const storiesInProgress = storiesResult.rows.filter(s => s.status === 'in_progress').length;
    const skillsCount = skillsResult.rows.length;
    const certificationsCount = certificationsResult.rows.length;
    const activeCertificationsCount = certificationsResult.rows.filter(c => c.status === 'active').length;

    // Calculate availability (simplified - can be enhanced based on project allocations)
    const totalAllocation = assignedProjects.reduce((sum, project) => sum + (project.allocation || 0), 0);
    const availability = Math.max(0, 100 - totalAllocation);

    // Calculate performance rating (simplified - can be enhanced with actual ratings)
    const completedStories = storiesResult.rows.filter(s => s.status === 'done').length;
    const totalStories = storiesResult.rows.length;
    const completionRate = totalStories > 0 ? (completedStories / totalStories) * 100 : 0;
    const performanceRating = Math.min(5, Math.max(1, (completionRate / 20) + 3)); // Scale to 1-5

    // Transform resource data
    const resourceData = {
      ...resource,
      skills: skillsResult.rows.map(skill => ({
        id: skill.id,
        skillId: skill.skill_id,
        name: skill.skill_name,
        description: skill.skill_description,
        category: skill.skill_category,
        proficiencyLevel: skill.proficiency_level,
        experienceYears: skill.experience_years,
        lastUsedDate: skill.last_used_date,
        proficiencyLabel: skill.proficiency_level >= 4 ? 'Expert' : 
                         skill.proficiency_level >= 3 ? 'Advanced' : 
                         skill.proficiency_level >= 2 ? 'Intermediate' : 'Beginner'
      })),
      certifications: certificationsResult.rows.map(cert => ({
        id: cert.id,
        certificationId: cert.certification_id,
        name: cert.certification_name,
        issuer: cert.issuer,
        description: cert.certification_description,
        obtainedDate: cert.obtained_date,
        expiryDate: cert.expiry_date,
        status: cert.status,
        statusLabel: cert.status === 'active' ? 'Active' : 
                    cert.status === 'expired' ? 'Expired' : 
                    cert.status === 'expiring_soon' ? 'Expiring Soon' : 'Inactive'
      })),
      assignedProjects,
      userStories: storiesResult.rows.map(story => ({
        id: story.id,
        title: story.title,
        description: story.description,
        status: story.status,
        priority: story.priority,
        storyPoints: story.story_points,
        type: story.type,
        projectName: story.project_name,
        projectId: story.project_id
      })),
      performance: {
        rating: Math.round(performanceRating * 10) / 10,
        totalHours,
        projectsCount,
        activeProjectsCount,
        storiesInProgress,
        completionRate: Math.round(completionRate)
      },
      summary: {
        hireDate: resource.hire_date,
        status: resource.user_status === 'enabled' ? 'Active' : 'Inactive',
        skillsCount,
        certificationsCount,
        activeCertificationsCount,
        activeProjectsCount,
        storiesInProgress
      },
      availability: Math.round(availability),
      hourlyRate,
      currency: resource.currency || 'USD'
    };

    res.status(200).json({
      success: true,
      data: resourceData,
    });
  } catch (error) {
    console.error("Error fetching resource details:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching resource details",
      error: error.message,
    });
  }
};

// Get single resource overview with comprehensive details (for Resource Overview page)
exports.getResourceOverview = async (req, res) => {
  try {
    const { resourceId } = req.params;

    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: "Resource ID is required",
      });
    }

    // Get resource details
    const resourceQuery = `
      SELECT 
        r.*,
        u.id as user_id,
        u.name,
        u.email,
        u.avatar,
        u.status as user_status,
        u.created_at as hire_date,
        cr.name as company_role_name
      FROM psa_resources r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN company_roles cr ON u.company_role = cr.id
      WHERE r.id = $1 AND r.is_deleted = false
    `;
    const resourceResult = await pool.query(resourceQuery, [resourceId]);

    if (resourceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    const resource = resourceResult.rows[0];

    // Get resource skills
    const skillsQuery = `
      SELECT 
        rs.id,
        rs.skill_id,
        rs.proficiency_level,
        rs.years_experience,
        rs.last_used,
        s.name as skill_name,
        s.description as skill_description,
        s.category as skill_category
      FROM psa_resource_skills rs
      LEFT JOIN psa_skills s ON rs.skill_id = s.id
      WHERE rs.resource_id = $1 AND rs.is_deleted = false
      ORDER BY rs.proficiency_level DESC, s.name ASC
    `;
    const skillsResult = await pool.query(skillsQuery, [resourceId]);

    // Get resource certifications
    const certificationsQuery = `
      SELECT 
        rc.id,
        rc.certification_id,
        rc.date_obtained,
        rc.expiration_date,
        rc.status,
        rc.certificate_number,
        rc.verification_url,
        c.name as certification_name,
        c.issuing_organization,
        c.description as certification_description
      FROM psa_resource_certifications rc
      LEFT JOIN psa_certifications c ON rc.certification_id = c.id
      WHERE rc.resource_id = $1 AND rc.is_deleted = false
      ORDER BY rc.expiration_date ASC
    `;
    const certificationsResult = await pool.query(certificationsQuery, [resourceId]);

    // Get assigned projects
    const projectsQuery = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.status,
        p.start_date,
        p.end_date,
        p.resource_user_ids,
        p.resource_roles,
        p.resource_allocations,
        c.name as client_name
      FROM psa_projects p
      LEFT JOIN accounts c ON p.client_id = c.id
      WHERE p.resource_user_ids @> ARRAY[$1]::integer[]
        AND p.is_deleted = false
        AND p.is_active = true
      ORDER BY p.created_at DESC
    `;
    const projectsResult = await pool.query(projectsQuery, [resource.user_id]);

    // Process assigned projects with allocation info
    const assignedProjects = projectsResult.rows.map(project => {
      const userIndex = project.resource_user_ids.indexOf(resource.user_id);
      const role = project.resource_roles ? project.resource_roles[userIndex] : 'Member';
      const allocation = project.resource_allocations ? project.resource_allocations[userIndex] : 0;
      
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        clientName: project.client_name,
        role,
        allocation
      };
    });

    // Get user stories assigned to this resource
    const storiesQuery = `
      SELECT 
        bi.id,
        bi.title,
        bi.description,
        bi.status,
        bi.priority,
        bi.story_points,
        bi.type,
        p.name as project_name,
        p.id as project_id
      FROM psa_backlog_items bi
      LEFT JOIN psa_projects p ON bi.project_id = p.id
      WHERE bi.assignee_id = $1 
        AND bi.is_deleted = false
        AND p.is_deleted = false
      ORDER BY 
        CASE bi.status 
          WHEN 'in_progress' THEN 1
          WHEN 'review' THEN 2
          WHEN 'backlog' THEN 3
          WHEN 'done' THEN 4
          ELSE 5
        END,
        bi.priority DESC,
        bi.created_at DESC
    `;
    const storiesResult = await pool.query(storiesQuery, [resource.user_id]);

    // Calculate performance metrics
    const totalHours = parseFloat(resource.total_hours) || 0;
    const hourlyRate = parseFloat(resource.hourly_rate) || 0;
    const projectsCount = assignedProjects.length;
    const activeProjectsCount = assignedProjects.filter(p => 
      ['active', 'planning', 'in_progress', 'development', 'testing'].includes(p.status)
    ).length;
    const storiesInProgress = storiesResult.rows.filter(s => s.status === 'in_progress').length;
    const skillsCount = skillsResult.rows.length;
    const certificationsCount = certificationsResult.rows.length;
    const activeCertificationsCount = certificationsResult.rows.filter(c => c.status === 'active').length;

    // Calculate availability (simplified - can be enhanced based on project allocations)
    const totalAllocation = assignedProjects.reduce((sum, project) => sum + (project.allocation || 0), 0);
    const availability = Math.max(0, 100 - totalAllocation);

    // Calculate performance rating (simplified - can be enhanced with actual ratings)
    const completedStories = storiesResult.rows.filter(s => s.status === 'done').length;
    const totalStories = storiesResult.rows.length;
    const completionRate = totalStories > 0 ? (completedStories / totalStories) * 100 : 0;
    const performanceRating = Math.min(5, Math.max(1, (completionRate / 20) + 3)); // Scale to 1-5

    // Transform resource data
    const resourceData = {
      ...resource,
      skills: skillsResult.rows.map(skill => ({
        id: skill.id,
        skillId: skill.skill_id,
        name: skill.skill_name,
        description: skill.skill_description,
        category: skill.skill_category,
        proficiencyLevel: skill.proficiency_level,
        experienceYears: skill.years_experience,
        lastUsedDate: skill.last_used,
        proficiencyLabel: skill.proficiency_level >= 4 ? 'Expert' : 
                          skill.proficiency_level >= 3 ? 'Advanced' : 
                          skill.proficiency_level >= 2 ? 'Intermediate' : 'Beginner'
      })),
      certifications: certificationsResult.rows.map(cert => ({
        id: cert.id,
        certificationId: cert.certification_id,
        name: cert.certification_name,
        issuer: cert.issuing_organization,
        description: cert.certification_description,
        obtainedDate: cert.date_obtained,
        expiryDate: cert.expiration_date,
        status: cert.status,
        certificateNumber: cert.certificate_number,
        verificationUrl: cert.verification_url,
        statusLabel: cert.status === 'active' ? 'Active' : 
                    cert.status === 'expired' ? 'Expired' : 
                    cert.status === 'expiring_soon' ? 'Expiring Soon' : 'Inactive'
      })),
      assignedProjects,
      userStories: storiesResult.rows.map(story => ({
        id: story.id,
        title: story.title,
        description: story.description,
        status: story.status,
        priority: story.priority,
        storyPoints: story.story_points,
        type: story.type,
        projectName: story.project_name,
        projectId: story.project_id
      })),
      performance: {
        rating: Math.round(performanceRating * 10) / 10,
        totalHours,
        projectsCount,
        activeProjectsCount,
        storiesInProgress,
        completionRate: Math.round(completionRate)
      },
      summary: {
        hireDate: resource.hire_date,
        status: resource.user_status === 'enabled' ? 'Active' : 'Inactive',
        skillsCount,
        certificationsCount,
        activeCertificationsCount,
        activeProjectsCount,
        storiesInProgress
      },
      availability: Math.round(availability),
      hourlyRate,
      currency: resource.currency || 'USD'
    };

    res.status(200).json({
      success: true,
      data: resourceData,
    });
  } catch (error) {
    console.error("Error fetching resource overview:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching resource overview",
      error: error.message,
    });
  }
};

// PSA Emoji Reactions Functions
exports.addPSAEmojiReaction = async (req, res) => {
  try {
    const { comment_id, emoji } = req.body;
    const user_id = req.user.id;
 
    // Check if user already reacted with this emoji
    const existingReaction = await pool.query(
      'SELECT id FROM psa_emoji_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3',
      [comment_id, user_id, emoji]
    );

    if (existingReaction.rows.length > 0) {
      return res.json({ success: false, message: 'Already reacted with this emoji' });
    }

    // Add new reaction
    const result = await pool.query(
      'INSERT INTO psa_emoji_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3) RETURNING *',
      [comment_id, user_id, emoji]
    );

    res.json({ success: true, reaction: result.rows[0] });
  } catch (error) {
    console.error('Error adding PSA emoji reaction:', error);
    console.error('Error details:', error.message, error.code);
    res.status(500).json({ success: false, message: 'Failed to add emoji reaction', error: error.message });
  }
};

exports.removePSAEmojiReaction = async (req, res) => {
  try {
    const { comment_id, emoji } = req.body;
    const user_id = req.user.id;

    const result = await pool.query(
      'DELETE FROM psa_emoji_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3 RETURNING *',
      [comment_id, user_id, emoji]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'Reaction not found' });
    }

    res.json({ success: true, message: 'Reaction removed' });
  } catch (error) {
    console.error('Error removing PSA emoji reaction:', error);
    res.status(500).json({ success: false, message: 'Failed to remove emoji reaction' });
  }
};

exports.getPSAEmojiReactions = async (req, res) => {
  try {
    const { comment_id } = req.params;

    const result = await pool.query(
      `SELECT 
        per.emoji,
        per.user_id,
        u.name,
        u.avatar,
        per.created_at
      FROM psa_emoji_reactions per
      JOIN users u ON per.user_id = u.id
      WHERE per.comment_id = $1
      ORDER BY per.created_at ASC`,
      [comment_id]
    );

    res.json({ success: true, reactions: result.rows });
  } catch (error) {
    console.error('Error fetching PSA emoji reactions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reactions' });
  }
};

// Update PSA Story Discussion Comment
exports.updateStoryDiscussion = async (req, res) => {
  try {
    const { storyId, commentId } = req.params;
    const { comment_text } = req.body;
    const user_id = req.user.id;

    // Check if comment exists and belongs to user
    const commentCheck = await pool.query(
      'SELECT id, user_id FROM psa_story_discussions WHERE id = $1 AND story_id = $2',
      [commentId, storyId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (commentCheck.rows[0].user_id !== user_id) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this comment' });
    }

    // Update comment
    const result = await pool.query(
      'UPDATE psa_story_discussions SET comment_text = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [comment_text, commentId]
    );

    res.json({ success: true, comment: result.rows[0] });
  } catch (error) {
    console.error('Error updating PSA story discussion:', error);
    res.status(500).json({ success: false, message: 'Failed to update comment' });
  }
};

// Delete PSA Story Discussion Comment
exports.deleteStoryDiscussion = async (req, res) => {
  try {
    const { storyId, commentId } = req.params;
    const user_id = req.user.id;

    // Check if comment exists and belongs to user
    const commentCheck = await pool.query(
      'SELECT id, user_id FROM psa_story_discussions WHERE id = $1 AND story_id = $2',
      [commentId, storyId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (commentCheck.rows[0].user_id !== user_id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    // Delete comment
    await pool.query(
      'DELETE FROM psa_story_discussions WHERE id = $1',
      [commentId]
    );

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting PSA story discussion:', error);
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
};

// Export My Work functions
exports.getUserStories = getUserStories;
exports.getStoryDetail = getStoryDetail;
exports.getStoryDiscussions = getStoryDiscussions;
exports.addStoryDiscussion = addStoryDiscussion;
exports.generateAcceptanceCriteria = generateAcceptanceCriteria;

// Export Template functions
exports.updateHierarchicalTemplate = updateHierarchicalTemplate;

