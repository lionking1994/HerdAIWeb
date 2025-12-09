const pool = require('../config/database')
const { handleError } = require('../utils/errorHandler')

exports.globalSearch = async (req, res) => {
  const { query = '', limit = 5 } = req.query
  const userId = req.user?.id

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
    })
  }

  if (!query.trim()) {
    return res.json({
      success: true,
      results: {},
    })
  }

  try {
    const userCompanyQuery = `
      SELECT c.id as company_id
      FROM users u
      LEFT JOIN company c ON SPLIT_PART(u.email, '@', 2) = c.domain
      WHERE u.id = $1
    `
    const userCompanyResult = await pool.query(userCompanyQuery, [userId])
    const userCompanyId = userCompanyResult.rows[0]?.company_id

    const sanitizedLimit = Math.min(Math.max(parseInt(limit) || 5, 1), 20)
    const likeQuery = `%${query.trim()}%`

    let meetingsQuery,
      tasksQuery,
      workflowQuery,
      researchQuery,
      queryParams,
      workflowParams,
      researchParams
    let usersQuery, userQueryParams
    let opportunityQuery, opportunityParams
    let projectsQuery, projectsParams
    let resourcesQuery, resourcesParams
    let userStoriesQuery, userStoriesParams

    if (userCompanyId) {
      // Company Users
      meetingsQuery = `
        SELECT m.id, m.title, COALESCE(m.summary, '') as description,
          u.name as owner_name, COALESCE(u.avatar, '') as owner_avatar,
          m.created_at, m.datetime as date_field,
          CAST(m.duration AS VARCHAR) as additional_info,
          CAST(m.id AS VARCHAR) as reference_id,
          'meeting' as type
        FROM meetings m
        JOIN users u ON m.org_id = u.id
        JOIN meeting_participants mp ON m.id = mp.meeting_id
        WHERE (m.title ILIKE $1 OR COALESCE(m.summary, '') ILIKE $1)
          AND m.isdeleted = false
          AND mp.user_id = $2
          AND EXISTS (
            SELECT 1 FROM company c
            WHERE c.id = $3
              AND SPLIT_PART(u.email, '@', 2) = c.domain
          )
        ORDER BY m.created_at DESC
        LIMIT ${sanitizedLimit}
      `

      tasksQuery = `
        SELECT t.id, t.title, COALESCE(t.description, '') as description,
          u.name as owner_name, COALESCE(u.avatar, '') as owner_avatar,
          t.created_at, COALESCE(t.duedate::VARCHAR, '') as date_field,
          COALESCE(t.status, '') as additional_info,
          CAST(t.meeting_id AS VARCHAR) as reference_id,
          'task' as type
        FROM tasks t
        LEFT JOIN meetings m ON t.meeting_id = m.id AND (m.org_id = $2 OR t.assigned_id = $2)
        JOIN users u ON t.assigned_id = u.id
        WHERE (t.title ILIKE $1 OR COALESCE(t.description, '') ILIKE $1)
          AND t.isdeleted = false
          AND EXISTS (
            SELECT 1 FROM company c
            WHERE c.id = $3
              AND SPLIT_PART(u.email, '@', 2) = c.domain
          )
        ORDER BY t.created_at DESC
        LIMIT ${sanitizedLimit}
      `

      // workflowQuery = `
      //   SELECT wi.id, wi.name AS title,
      //     COALESCE(ww.name, '') AS description,
      //     COALESCE(u.name, '') AS owner_name,
      //     COALESCE(u.avatar, '') AS owner_avatar,
      //     wi.created_at, wi.created_at::VARCHAR AS date_field,
      //     wi.status AS additional_info,
      //     CAST(wi.id AS VARCHAR) AS reference_id,
      //     'workflow' AS type
      //   FROM workflow_instances wi
      //   LEFT JOIN workflow_workflows ww ON wi.workflow_id = ww.id
      //   LEFT JOIN users u ON wi.assigned_to = u.id

      //   WHERE (wi.name ILIKE $1 OR COALESCE(ww.name, '') ILIKE $1)
      //     AND (
      //       u.id IS NULL OR EXISTS (
      //         SELECT 1 FROM company c
      //         WHERE c.id = $2 AND SPLIT_PART(u.email, '@', 2) = c.domain
      //       )
      //     )
      //   ORDER BY wi.created_at DESC
      //   LIMIT ${sanitizedLimit}
      // `;

      workflowQuery = `
  SELECT wi.id, wi.name AS title,
    COALESCE(ww.name, '') AS description,
    COALESCE(u.name, '') AS owner_name,
    COALESCE(u.avatar, '') AS owner_avatar,
    wi.created_at, wi.created_at::VARCHAR AS date_field,
    wi.status AS additional_info,
    CAST(wi.id AS VARCHAR) AS reference_id,
    'workflow' AS type
  FROM workflow_instances wi
  LEFT JOIN workflow_workflows ww ON wi.workflow_id = ww.id
  LEFT JOIN users u ON wi.assigned_to = u.id
  WHERE wi.status = 'active' -- ✅ Only include active workflows
    AND (wi.name ILIKE $1 OR COALESCE(ww.name, '') ILIKE $1)
    AND (
      u.id IS NULL OR EXISTS (
        SELECT 1 FROM company c
        WHERE c.id = $2 AND SPLIT_PART(u.email, '@', 2) = c.domain
      )
    )
  ORDER BY wi.created_at DESC
  LIMIT ${sanitizedLimit}
`

      usersQuery = `
        SELECT u.id, u.name as title,
          COALESCE(u.bio, u.email) as description,
          u.name as owner_name, COALESCE(u.avatar, '') as owner_avatar,
          u.created_at, u.created_at::VARCHAR as date_field,
          COALESCE(u.email, '') as additional_info,
          CAST(u.id AS VARCHAR) as reference_id,
          u.phone, u.location, u.bio,
          'user' as type
        FROM users u
        WHERE (u.name ILIKE $1 OR u.email ILIKE $1)
          AND u.status = 'enabled'
          AND EXISTS (
            SELECT 1 FROM company c
            WHERE c.id = $2 AND SPLIT_PART(u.email, '@', 2) = c.domain
          )
        ORDER BY u.created_at DESC
        LIMIT ${sanitizedLimit}
      `

      // NEW: research_requests query for company users
      researchQuery = `
        SELECT id, topic AS title, user_email, created_at,
          topic AS description,
          '' AS owner_name, '' AS owner_avatar,
          created_at::VARCHAR AS date_field,
          '' AS additional_info,
          CAST(id AS VARCHAR) AS reference_id,
          'research_request' AS type
        FROM research_requests
        WHERE topic ILIKE $1
          AND SPLIT_PART(user_email, '@', 2) IN (
            SELECT domain FROM company WHERE id = $2
          )
        ORDER BY created_at DESC
        LIMIT ${sanitizedLimit}
      `
      opportunityQuery = `
      (
  SELECT
    op.id AS opportunity_id,
    op.name AS title,
    COALESCE(op.description, '') AS description,
    COALESCE(u.name, '') AS owner_name,
    COALESCE(u.avatar, '') AS owner_avatar,
    op.created_at,
    op.expected_close_date::VARCHAR AS date_field,
    op.stage AS additional_info,
    CAST(op.id AS VARCHAR) AS reference_id,
    'opportunity' AS type,
    c.id AS contact_id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone
  FROM opportunities op
  LEFT JOIN users u ON op.owner_id = u.id
  LEFT JOIN contacts c ON op.account_id = c.id
  WHERE (
    op.name ILIKE $1
    OR COALESCE(op.description, '') ILIKE $1
    OR CONCAT_WS(' ', c.first_name, c.last_name) ILIKE $1
    OR EXISTS (
      SELECT 1
      FROM opportunity_contacts oc
      JOIN contacts cx ON cx.id = oc.contact_id
      WHERE oc.opportunity_id = op.id
        AND cx.tenant_id = $2
        AND CONCAT_WS(' ', cx.first_name, cx.last_name) ILIKE $1
    )
  )
  AND op.tenant_id = $2
)
ORDER BY created_at DESC
LIMIT ${sanitizedLimit}

      `
      // PSA Projects Query
      projectsQuery = `
        SELECT p.id, p.name as title, COALESCE(p.description, '') as description,
          COALESCE(u.name, '') as owner_name, COALESCE(u.avatar, '') as owner_avatar,
          p.created_at, p.start_date::VARCHAR as date_field,
          COALESCE(p.status, '') as additional_info,
          CAST(p.id AS VARCHAR) as reference_id,
          'project' as type
        FROM psa_projects p
        LEFT JOIN users u ON p.created_by::VARCHAR = u.id::VARCHAR
        WHERE (p.name ILIKE $1 OR COALESCE(p.description, '') ILIKE $1)
          AND p.company_id = $2
          AND p.is_deleted = false
        ORDER BY p.created_at DESC
        LIMIT ${sanitizedLimit}
      `

      // PSA Resources Query
      resourcesQuery = `
        SELECT r.id, u.name as title, COALESCE(r.title, '') as description,
          u.name as owner_name, COALESCE(u.avatar, '') as owner_avatar,
          r.created_at, r.created_at::VARCHAR as date_field,
          COALESCE(r.location, '') as additional_info,
          CAST(r.id AS VARCHAR) as reference_id,
          'resource' as type
        FROM psa_resources r
        INNER JOIN users u ON r.user_id = u.id
        INNER JOIN company_roles cr ON u.company_role = cr.id
        WHERE (u.name ILIKE $1 OR COALESCE(r.title, '') ILIKE $1 OR COALESCE(r.location, '') ILIKE $1)
          AND cr.company_id = $2
          AND r.is_deleted = false
          AND u.status = 'enabled'
        ORDER BY r.created_at DESC
        LIMIT ${sanitizedLimit}
      `

      // PSA User Stories Query
      userStoriesQuery = `
        SELECT bi.id, bi.title, COALESCE(bi.description, '') as description,
          COALESCE(u.name, '') as owner_name, COALESCE(u.avatar, '') as owner_avatar,
          bi.created_at, bi.created_at::VARCHAR as date_field,
          COALESCE(bi.status, '') as additional_info,
          CAST(bi.id AS VARCHAR) as reference_id,
          'user_story' as type
        FROM psa_backlog_items bi
        LEFT JOIN users u ON bi.assignee_id::VARCHAR = u.id::VARCHAR
        INNER JOIN psa_projects p ON bi.project_id = p.id
        WHERE (bi.title ILIKE $1 OR COALESCE(bi.description, '') ILIKE $1)
          AND p.company_id = $2
          AND bi.is_deleted = false
          AND p.is_deleted = false
          AND p.is_active = true
          AND bi.type = 'story'
        ORDER BY bi.created_at DESC
        LIMIT ${sanitizedLimit}
      `

      opportunityParams = [likeQuery, userCompanyId]
      queryParams = [likeQuery, userId, userCompanyId]
      workflowParams = [likeQuery, userCompanyId]
      researchParams = [likeQuery, userCompanyId]
      userQueryParams = [likeQuery, userCompanyId]
      projectsParams = [likeQuery, userCompanyId]
      resourcesParams = [likeQuery, userCompanyId]
      userStoriesParams = [likeQuery, userCompanyId]
    } else {
      // Non-company users
      meetingsQuery = `
        SELECT m.id, m.title, COALESCE(m.summary, '') as description,
          u.name as owner_name, COALESCE(u.avatar, '') as owner_avatar,
          m.created_at, m.datetime as date_field,
          CAST(m.duration AS VARCHAR) as additional_info,
          CAST(m.id AS VARCHAR) as reference_id,
          'meeting' as type
        FROM meetings m
        JOIN users u ON m.org_id = u.id
        JOIN meeting_participants mp ON m.id = mp.meeting_id
        WHERE (m.title ILIKE $1 OR COALESCE(m.summary, '') ILIKE $1)
          AND m.isdeleted = false
          AND mp.user_id = $2
          AND NOT EXISTS (
            SELECT 1 FROM company c WHERE SPLIT_PART(u.email, '@', 2) = c.domain
          )
        ORDER BY m.created_at DESC
        LIMIT ${sanitizedLimit}
      `

      tasksQuery = `
        SELECT t.id, t.title, COALESCE(t.description, '') as description,
          u.name as owner_name, COALESCE(u.avatar, '') as owner_avatar,
          t.created_at, COALESCE(t.duedate::VARCHAR, '') as date_field,
          COALESCE(t.status, '') as additional_info,
          CAST(t.meeting_id AS VARCHAR) as reference_id,
          'task' as type
        FROM tasks t
        LEFT JOIN meetings m ON t.meeting_id = m.id AND (m.org_id = $2 OR t.assigned_id = $2)
        JOIN users u ON t.assigned_id = u.id
        WHERE (t.title ILIKE $1 OR COALESCE(t.description, '') ILIKE $1)
          AND t.isdeleted = false
          AND NOT EXISTS (
            SELECT 1 FROM company c WHERE SPLIT_PART(u.email, '@', 2) = c.domain
          )
        ORDER BY t.created_at DESC
        LIMIT ${sanitizedLimit}
      `

      // workflowQuery = `
      //   SELECT wi.id, wi.name AS title,
      //     COALESCE(ww.name, '') AS description,
      //     COALESCE(u.name, '') AS owner_name,
      //     COALESCE(u.avatar, '') AS owner_avatar,
      //     wi.created_at, wi.created_at::VARCHAR AS date_field,
      //     wi.status AS additional_info,
      //     CAST(wi.id AS VARCHAR) AS reference_id,
      //     'workflow' AS type
      //   FROM workflow_instances wi
      //   LEFT JOIN workflow_workflows ww ON wi.workflow_id = ww.id
      //   LEFT JOIN users u ON wi.assigned_to = u.id
      //   WHERE (wi.name ILIKE $1 OR COALESCE(ww.name, '') ILIKE $1)
      //   ORDER BY wi.created_at DESC
      //   LIMIT ${sanitizedLimit}
      // `;

      workflowQuery = `
  SELECT wi.id, wi.name AS title,
    COALESCE(ww.name, '') AS description,
    COALESCE(u.name, '') AS owner_name,
    COALESCE(u.avatar, '') AS owner_avatar,
    wi.created_at, wi.created_at::VARCHAR AS date_field,
    wi.status AS additional_info,
    CAST(wi.id AS VARCHAR) AS reference_id,
    'workflow' AS type
  FROM workflow_instances wi
  LEFT JOIN workflow_workflows ww ON wi.workflow_id = ww.id
  LEFT JOIN users u ON wi.assigned_to = u.id
  WHERE wi.status = 'active'  -- ✅ Only fetch workflows with active status
    AND (wi.name ILIKE $1 OR COALESCE(ww.name, '') ILIKE $1)
  ORDER BY wi.created_at DESC
  LIMIT ${sanitizedLimit}
`

      usersQuery = `
        SELECT u.id, u.name as title,
          COALESCE(u.bio, u.email) as description,
          u.name as owner_name, COALESCE(u.avatar, '') as owner_avatar,
          u.created_at, u.created_at::VARCHAR as date_field,
          COALESCE(u.email, '') as additional_info,
          CAST(u.id AS VARCHAR) as reference_id,
          u.phone, u.location, u.bio,
          'user' as type
        FROM users u
        WHERE (u.name ILIKE $1 OR u.email ILIKE $1)
          AND u.status = 'enabled'
          AND NOT EXISTS (
            SELECT 1 FROM company c WHERE SPLIT_PART(u.email, '@', 2) = c.domain
          )
        ORDER BY u.created_at DESC
        LIMIT ${sanitizedLimit}
      `

      // NEW: research_requests query for non-company users
      researchQuery = `
        SELECT id, topic AS title, user_email, created_at,
          topic AS description,
          '' AS owner_name, '' AS owner_avatar,
          created_at::VARCHAR AS date_field,
          '' AS additional_info,
          CAST(id AS VARCHAR) AS reference_id,
          'research_request' AS type
        FROM research_requests
        WHERE topic ILIKE $1
          AND NOT EXISTS (
            SELECT 1 FROM company c WHERE SPLIT_PART(user_email, '@', 2) = c.domain
          )
        ORDER BY created_at DESC
        LIMIT ${sanitizedLimit}
      `
      opportunityQuery = `
       (
  SELECT
    op.id AS opportunity_id,
    op.name AS title,
    COALESCE(op.description, '') AS description,
    COALESCE(u.name, '') AS owner_name,
    COALESCE(u.avatar, '') AS owner_avatar,
    op.created_at,
    op.expected_close_date::VARCHAR AS date_field,
    op.stage AS additional_info,
    CAST(op.id AS VARCHAR) AS reference_id,
    'opportunity' AS type,
    c.id AS contact_id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone
  FROM opportunities op
  LEFT JOIN users u ON op.owner_id = u.id
  LEFT JOIN contacts c ON op.account_id = c.id
  WHERE (
    op.name ILIKE $1
    OR COALESCE(op.description, '') ILIKE $1
    OR CONCAT_WS(' ', c.first_name, c.last_name) ILIKE $1
    OR EXISTS (
      SELECT 1
      FROM opportunity_contacts oc
      JOIN contacts cx ON cx.id = oc.contact_id
      WHERE oc.opportunity_id = op.id
        AND CONCAT_WS(' ', cx.first_name, cx.last_name) ILIKE $1
        AND (oc.tenant_id IS NULL OR oc.tenant_id = '')
    )
  )
  AND (op.tenant_id IS NULL OR op.tenant_id = '')
)
ORDER BY created_at DESC
LIMIT ${sanitizedLimit}


      `
      // PSA queries for non-company users (empty since PSA is company-specific)
      projectsQuery = `
        SELECT NULL as id, '' as title, '' as description,
          '' as owner_name, '' as owner_avatar,
          NOW() as created_at, '' as date_field,
          '' as additional_info, '' as reference_id,
          'project' as type
        WHERE 1=0
      `
      resourcesQuery = `
        SELECT NULL as id, '' as title, '' as description,
          '' as owner_name, '' as owner_avatar,
          NOW() as created_at, '' as date_field,
          '' as additional_info, '' as reference_id,
          'resource' as type
        WHERE 1=0
      `
      userStoriesQuery = `
        SELECT NULL as id, '' as title, '' as description,
          '' as owner_name, '' as owner_avatar,
          NOW() as created_at, '' as date_field,
          '' as additional_info, '' as reference_id,
          'user_story' as type
        WHERE 1=0
      `

      opportunityParams = [likeQuery]
      queryParams = [likeQuery, userId]
      workflowParams = [likeQuery]
      researchParams = [likeQuery]
      userQueryParams = [likeQuery]
      projectsParams = [likeQuery]
      resourcesParams = [likeQuery]
      userStoriesParams = [likeQuery]
    }

    const [
      meetingsRes,
      tasksRes,
      usersRes,
      workflowsRes,
      researchRes,
      opportunitiesRes,
      projectsRes,
      resourcesRes,
      userStoriesRes,
    ] = await Promise.all([
      pool.query(meetingsQuery, queryParams),
      pool.query(tasksQuery, queryParams),
      pool.query(usersQuery, userQueryParams),
      pool.query(workflowQuery, workflowParams),
      pool.query(researchQuery, researchParams),
      pool.query(opportunityQuery, opportunityParams),
      pool.query(projectsQuery, projectsParams),
      pool.query(resourcesQuery, resourcesParams),
      pool.query(userStoriesQuery, userStoriesParams),
    ])

    const groupedResults = {
      meeting: meetingsRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        ownerName: r.owner_name,
        ownerAvatar: r.owner_avatar,
        dateField: r.date_field,
        additionalInfo: r.additional_info,
        referenceId: r.reference_id,
        createdAt: r.created_at,
      })),
      task: tasksRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        ownerName: r.owner_name,
        ownerAvatar: r.owner_avatar,
        dateField: r.date_field,
        additionalInfo: r.additional_info,
        referenceId: r.reference_id,
        createdAt: r.created_at,
      })),
      user: usersRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        ownerName: r.owner_name,
        ownerAvatar: r.owner_avatar,
        dateField: r.date_field,
        additionalInfo: r.additional_info,
        referenceId: r.reference_id,
        createdAt: r.created_at,
        phone: r.phone,
        location: r.location,
        bio: r.bio,
      })),
      workflow: workflowsRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        ownerName: r.owner_name,
        ownerAvatar: r.owner_avatar,
        dateField: r.date_field,
        additionalInfo: r.additional_info,
        referenceId: r.reference_id,
        createdAt: r.created_at,
      })),

      research_request: researchRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        ownerName: r.owner_name,
        ownerAvatar: r.owner_avatar,
        dateField: r.date_field,
        additionalInfo: r.additional_info,
        referenceId: r.reference_id,
        createdAt: r.created_at,
      })),
      opportunity: opportunitiesRes.rows.map((r) => ({
        id: r.opportunity_id,
        title: r.title,
        description: r.description,
        ownerName: r.owner_name,
        ownerAvatar: r.owner_avatar,
        dateField: r.date_field,
        additionalInfo: r.additional_info,
        referenceId: r.reference_id,
        createdAt: r.created_at,
        contact: r.contact_id
          ? {
              id: r.contact_id,
              firstName: r.first_name,
              lastName: r.last_name,
              email: r.email,
              phone: r.phone,
            }
          : null,
      })),
      project: projectsRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        ownerName: r.owner_name,
        ownerAvatar: r.owner_avatar,
        dateField: r.date_field,
        additionalInfo: r.additional_info,
        referenceId: r.reference_id,
        createdAt: r.created_at,
      })),
      resource: resourcesRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        ownerName: r.owner_name,
        ownerAvatar: r.owner_avatar,
        dateField: r.date_field,
        additionalInfo: r.additional_info,
        referenceId: r.reference_id,
        createdAt: r.created_at,
      })),
      user_story: userStoriesRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        ownerName: r.owner_name,
        ownerAvatar: r.owner_avatar,
        dateField: r.date_field,
        additionalInfo: r.additional_info,
        referenceId: r.reference_id,
        createdAt: r.created_at,
      })),
    }

    res.json({ success: true, results: groupedResults })
  } catch (error) {
    console.error('Search error:', error)
    handleError(res, error, 'Search operation failed')
  }
}

//=============================================//

// exports.globalSearch = async (req, res) => {
//   const { query = '', limit = 5 } = req.query;
//   const userId = req.user?.id;

//   if (!userId) return res.status(401).json({ success: false, error: 'User not authenticated' });
//   if (!query.trim()) return res.json({ success: true, results: {} });

//   try {
//     const companyRes = await pool.query(
//       `SELECT c.id AS company_id
//        FROM users u
//        LEFT JOIN company c ON SPLIT_PART(u.email, '@', 2) = c.domain
//        WHERE u.id = $1`,
//       [userId]
//     );
//     const userCompanyId = companyRes.rows[0]?.company_id;
//     const sanitizedLimit = Math.min(Math.max(parseInt(limit) || 5, 1), 20);
//     const likeQuery = `%${query.trim()}%`;

//     let workflowSQL, workflowParams;

//     if (userCompanyId) {
//       workflowSQL = `
//         SELECT wi.id, wi.name AS title,
//                COALESCE(ww.name, '') AS description,
//                COALESCE(u.name, '') AS owner_name,
//                COALESCE(u.avatar, '') AS owner_avatar,
//                wi.created_at, wi.created_at::VARCHAR AS date_field,
//                wi.status AS additional_info,
//                CAST(wi.id AS VARCHAR) AS reference_id,
//                'workflow' AS type
//         FROM workflow_instances wi
//         LEFT JOIN workflow_workflows ww ON wi.workflow_id = ww.id
//         LEFT JOIN users u ON wi.assigned_to = u.id
//         WHERE (wi.name ILIKE $1 OR COALESCE(ww.name, '') ILIKE $1)
//           AND (
//             u.id IS NULL
//             OR EXISTS (
//               SELECT 1 FROM company c
//               WHERE c.id = $2
//                 AND SPLIT_PART(u.email, '@', 2) = c.domain
//             )
//           )
//         ORDER BY wi.created_at DESC
//         LIMIT ${sanitizedLimit}
//       `;
//       workflowParams = [likeQuery, userCompanyId];
//     } else {
//       workflowSQL = `
//         SELECT wi.id, wi.name AS title,
//                COALESCE(ww.name, '') AS description,
//                COALESCE(u.name, '') AS owner_name,
//                COALESCE(u.avatar, '') AS owner_avatar,
//                wi.created_at, wi.created_at::VARCHAR AS date_field,
//                wi.status AS additional_info,
//                CAST(wi.id AS VARCHAR) AS reference_id,
//                'workflow' AS type
//         FROM workflow_instances wi
//         LEFT JOIN workflow_workflows ww ON wi.workflow_id = ww.id
//         LEFT JOIN users u ON wi.assigned_to = u.id
//         WHERE (wi.name ILIKE $1 OR COALESCE(ww.name, '') ILIKE $1)
//         ORDER BY wi.created_at DESC
//         LIMIT ${sanitizedLimit}
//       `;
//       workflowParams = [likeQuery];
//     }

//     console.log('workflowSQL params:', workflowParams);
//     const workflowsRes = await pool.query(workflowSQL, workflowParams);
//     console.log('--- workflow query result rows:', workflowsRes.rows);

//     // Continue executing other queries similarly and combine results...
//     // For brevity, only showing workflow handling here

//     const groupedResults = {
//       workflow: workflowsRes.rows.map(r => ({
//         id: r.id,
//         title: r.title,
//         description: r.description,
//         ownerName: r.owner_name,
//         ownerAvatar: r.owner_avatar,
//         dateField: r.date_field,
//         additionalInfo: r.additional_info,
//         referenceId: r.reference_id,
//         createdAt: r.created_at,
//       })),
//       // ... include other results (meeting, task, user) as before
//     };

//     res.json({ success: true, results: groupedResults });

//   } catch (error) {
//     console.error('Search error:', error);
//     handleError(res, error, 'Search operation failed');
//   }
// };

// exports.globalSearch = async (req, res) => {
//     const { query = '', limit = 5 } = req.query;
//     const userId = req.user?.id;

//     if (!userId) {
//         return res.status(401).json({
//             success: false,
//             error: 'User not authenticated'
//         });
//     }

//     if (!query.trim()) {
//         return res.json({
//             success: true,
//             results: {}
//         });
//     }

//     try {
//         const userCompanyQuery = `
//             SELECT c.id as company_id
//             FROM users u
//             LEFT JOIN company c ON SPLIT_PART(u.email, '@', 2) = c.domain
//             WHERE u.id = $1
//         `;
//         const userCompanyResult = await pool.query(userCompanyQuery, [userId]);
//         const userCompanyId = userCompanyResult.rows[0]?.company_id;

//         const sanitizedLimit = Math.min(Math.max(parseInt(limit) || 5, 1), 20);

//         let whereClause = '';
//         let meetingsQuery, tasksQuery;
//         let queryParams;

//         if (userCompanyId) {
//             // Queries for company users
//             meetingsQuery = `
//                 SELECT
//                     m.id,
//                     m.title,
//                     COALESCE(m.summary, '') as description,
//                     u.name as owner_name,
//                     COALESCE(u.avatar, '') as owner_avatar,
//                     m.created_at,
//                     m.datetime as date_field,
//                     CAST(m.duration AS VARCHAR) as additional_info,
//                     CAST(m.id AS VARCHAR) as reference_id,
//                     'meeting' as type
//                 FROM meetings m
//                 JOIN users u ON m.org_id = u.id
//                 JOIN meeting_participants mp ON m.id = mp.meeting_id
//                 WHERE
//                     (m.title ILIKE $1 OR COALESCE(m.summary, '') ILIKE $1)
//                     AND m.isdeleted = false
//                     AND mp.user_id = $2
//                     AND EXISTS (
//                         SELECT 1 FROM company c
//                         WHERE c.id = $3
//                         AND SPLIT_PART(u.email, '@', 2) = c.domain
//                     )
//                 ORDER BY m.created_at DESC
//                 LIMIT ${sanitizedLimit}
//             `;

//             tasksQuery = `
//                 SELECT
//                     t.id,
//                     t.title,
//                     COALESCE(t.description, '') as description,
//                     u.name as owner_name,
//                     COALESCE(u.avatar, '') as owner_avatar,
//                     t.created_at,
//                     COALESCE(t.duedate::VARCHAR, '') as date_field,
//                     COALESCE(t.status, '') as additional_info,
//                     CAST(t.meeting_id AS VARCHAR) as reference_id,
//                     'task' as type
//                 FROM tasks t
//                 LEFT JOIN meetings m ON t.meeting_id = m.id AND (m.org_id = $2 OR t.assigned_id = $2)
//                 JOIN users u ON t.assigned_id = u.id
//                 WHERE
//                     (t.title ILIKE $1 OR COALESCE(t.description, '') ILIKE $1)
//                     AND t.isdeleted = false
//                     AND EXISTS (
//                         SELECT 1 FROM company c
//                         WHERE c.id = $3
//                         AND SPLIT_PART(u.email, '@', 2) = c.domain
//                     )
//                 ORDER BY t.created_at DESC
//                 LIMIT ${sanitizedLimit}
//             `;
//             queryParams = [`%${query.trim()}%`, userId, userCompanyId];
//         } else {
//             // Queries for non-company users
//             meetingsQuery = `
//                 SELECT
//                     m.id,
//                     m.title,
//                     COALESCE(m.summary, '') as description,
//                     u.name as owner_name,
//                     COALESCE(u.avatar, '') as owner_avatar,
//                     m.created_at,
//                     m.datetime as date_field,
//                     CAST(m.duration AS VARCHAR) as additional_info,
//                     CAST(m.id AS VARCHAR) as reference_id,
//                     'meeting' as type
//                 FROM meetings m
//                 JOIN users u ON m.org_id = u.id
//                 JOIN meeting_participants mp ON m.id = mp.meeting_id
//                 WHERE
//                     (m.title ILIKE $1 OR COALESCE(m.summary, '') ILIKE $1)
//                     AND m.isdeleted = false
//                     AND mp.user_id = $2
//                     AND NOT EXISTS (
//                         SELECT 1 FROM company c
//                         WHERE SPLIT_PART(u.email, '@', 2) = c.domain
//                     )
//                 ORDER BY m.created_at DESC
//                 LIMIT ${sanitizedLimit}
//             `;

//             tasksQuery = `
//                 SELECT
//                     t.id,
//                     t.title,
//                     COALESCE(t.description, '') as description,
//                     u.name as owner_name,
//                     COALESCE(u.avatar, '') as owner_avatar,
//                     t.created_at,
//                     COALESCE(t.duedate::VARCHAR, '') as date_field,
//                     COALESCE(t.status, '') as additional_info,
//                     CAST(t.meeting_id AS VARCHAR) as reference_id,
//                     'task' as type
//                 FROM tasks t
//                 LEFT JOIN meetings m ON t.meeting_id = m.id AND (m.org_id = $2 OR t.assigned_id = $2)
//                 JOIN users u ON t.assigned_id = u.id
//                 WHERE
//                     (t.title ILIKE $1 OR COALESCE(t.description, '') ILIKE $1)
//                     AND t.isdeleted = false
//                     AND NOT EXISTS (
//                         SELECT 1 FROM company c
//                         WHERE SPLIT_PART(u.email, '@', 2) = c.domain
//                     )
//                 ORDER BY t.created_at DESC
//                 LIMIT ${sanitizedLimit}
//             `;
//             queryParams = [`%${query.trim()}%`, userId];
//         }

//         let usersQuery;
//         let userQueryParams;

//         if (userCompanyId) {
//             // Query for company users
//             usersQuery = `
//                 SELECT
//                     u.id,
//                     u.name as title,
//                     COALESCE(u.bio, u.email) as description,
//                     u.name as owner_name,
//                     COALESCE(u.avatar, '') as owner_avatar,
//                     u.created_at,
//                     u.created_at::VARCHAR as date_field,
//                     COALESCE(u.email, '') as additional_info,
//                     CAST(u.id AS VARCHAR) as reference_id,
//                     u.phone as phone,
//                     u.location as location,
//                     u.bio as bio,
//                     'user' as type
//                 FROM users u
//                 WHERE
//                     (u.name ILIKE $1 OR u.email ILIKE $1)
//                     AND u.status = 'enabled'
//                     AND EXISTS (
//                         SELECT 1 FROM company c
//                         WHERE c.id = $2
//                         AND SPLIT_PART(u.email, '@', 2) = c.domain
//                     )
//                 ORDER BY u.created_at DESC
//                 LIMIT ${sanitizedLimit}
//             `;
//             userQueryParams = [`%${query.trim()}%`, userCompanyId];
//         } else {
//             // Query for non-company users
//             usersQuery = `
//                 SELECT
//                     u.id,
//                     u.name as title,
//                     COALESCE(u.bio, u.email) as description,
//                     u.name as owner_name,
//                     COALESCE(u.avatar, '') as owner_avatar,
//                     u.created_at,
//                     u.created_at::VARCHAR as date_field,
//                     COALESCE(u.email, '') as additional_info,
//                     CAST(u.id AS VARCHAR) as reference_id,
//                     u.phone as phone,
//                     u.location as location,
//                     u.bio as bio,
//                     'user' as type
//                 FROM users u
//                 WHERE
//                     (u.name ILIKE $1 OR u.email ILIKE $1)
//                     AND u.status = 'enabled'
//                     AND NOT EXISTS (
//                         SELECT 1 FROM company c
//                         WHERE SPLIT_PART(u.email, '@', 2) = c.domain
//                     )
//                 ORDER BY u.created_at DESC
//                 LIMIT ${sanitizedLimit}
//             `;
//             userQueryParams = [`%${query.trim()}%`];
//         }

//         // Execute queries in parallel
//         const [meetingsResult, tasksResult, usersResult] = await Promise.all([
//             pool.query(meetingsQuery, queryParams),
//             pool.query(tasksQuery, queryParams),
//             pool.query(usersQuery, userQueryParams)
//         ]);

//         // Process results
//         const groupedResults = {
//             meeting: meetingsResult.rows.map(item => ({
//                 id: item.id,
//                 title: item.title,
//                 description: item.description,
//                 ownerName: item.owner_name,
//                 ownerAvatar: item.owner_avatar,
//                 dateField: item.date_field,
//                 additionalInfo: item.additional_info,
//                 referenceId: item.reference_id,
//                 createdAt: item.created_at
//             })),
//             task: tasksResult.rows.map(item => ({
//                 id: item.id,
//                 title: item.title,
//                 description: item.description,
//                 ownerName: item.owner_name,
//                 ownerAvatar: item.owner_avatar,
//                 dateField: item.date_field,
//                 additionalInfo: item.additional_info,
//                 referenceId: item.reference_id,
//                 createdAt: item.created_at
//             })),
//             user: usersResult.rows.map(item => ({
//                 id: item.id,
//                 title: item.title,
//                 description: item.description,
//                 ownerName: item.owner_name,
//                 ownerAvatar: item.owner_avatar,
//                 dateField: item.date_field,
//                 additionalInfo: item.additional_info,
//                 referenceId: item.reference_id,
//                 createdAt: item.created_at,
//                 phone: item.phone,
//                 location: item.location,
//                 bio: item.bio
//             }))
//         };

//         res.json({
//             success: true,
//             results: groupedResults
//         });

//     } catch (error) {
//         console.error('Search error:', error);
//         handleError(res, error, 'Search operation failed');
//     }
// };
