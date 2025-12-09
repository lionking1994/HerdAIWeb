const pool = require("../config/database");

// Get initiative intelligence data (aggregated by category)
const getInitiativeIntelligence = async (req, res) => {
  try {
    let { year, quat, company, isYTD, includeUncategorized } = req.body ?? {};

    // ---- Input validation / normalization ----
    const yearNum = Number(year);
    if (!Number.isInteger(yearNum)) {
      return res.status(400).json({ success: false, message: "Invalid 'year'." });
    }

    if (typeof isYTD !== 'boolean') {
      isYTD = String(isYTD).toLowerCase() === 'true';
    }

    let quarterNum = null;
    if (!isYTD) {
      quarterNum = Number(quat);
      if (![1, 2, 3, 4].includes(quarterNum)) {
        return res.status(400).json({ success: false, message: "Invalid 'quat' (quarter must be 1-4) when isYTD=false." });
      }
    }

    let companyId = null;
    if (company !== undefined && company !== null && company !== '') {
      companyId = Number(company);
      if (!Number.isInteger(companyId)) {
        return res.status(400).json({ success: false, message: "Invalid 'company'." });
      }
    }

    // Default: show Uncategorized too (set false to exclude)
    if (typeof includeUncategorized !== 'boolean') {
      includeUncategorized = true;
    }

    // ---- Build parameterized SQL ----
    // We split categories, normalize them, and aggregate per category.
    const params = [];
    let p = 0;

    let companyCondition = '';
    if (companyId !== null) {
      params.push(companyId);
      companyCondition = `AND c.id = $${++p}`;
    }

    params.push(yearNum);
    let dateCondition = `created_year = $${++p}`;
    if (!isYTD) {
      params.push(quarterNum);
      dateCondition += ` AND created_quarter = $${++p}`;
    }

    // Optionally exclude 'Uncategorized'
    let uncategorizedCondition = '';
    if (!includeUncategorized) {
      uncategorizedCondition = `AND category <> 'Uncategorized'`;
    }

   const query = `
      WITH base AS (
        SELECT
          t.id,
          t.owner_id,
          COALESCE(t.assigned_id, t.owner_id) AS effective_owner,  -- NEW: effective user
          t.category,
          COALESCE(t.average_time, 0) AS avg_minutes,       
          COALESCE(c.default_cph, 0)   AS default_cph,      
          EXTRACT(YEAR FROM t.created_at)    AS created_year,
          EXTRACT(QUARTER FROM t.created_at) AS created_quarter
        FROM tasks t
        JOIN users u        ON u.id = t.owner_id
        JOIN company_roles cr ON cr.id = u.company_role
        JOIN company c      ON c.id = cr.company_id
        WHERE t.isdeleted = false
          ${companyCondition}
      ),
      split AS (
        SELECT
          b.id,
          b.effective_owner,
          b.avg_minutes,
          b.default_cph,
          b.created_year,
          b.created_quarter,
          CASE
            WHEN b.category IS NULL OR btrim(b.category) = '' THEN 'Uncategorized'
            ELSE x
          END AS raw_cat
        FROM base b
        LEFT JOIN LATERAL regexp_split_to_table(b.category, E'\\s*,\\s*') AS x ON TRUE
      ),
      norm AS (
        SELECT
          id,
          effective_owner,
          avg_minutes,
          default_cph,
          created_year,
          created_quarter,
          INITCAP(
            LOWER(
              regexp_replace(btrim(raw_cat), '^"|"$', '', 'g')
            )
          ) AS category
        FROM split
      )
      SELECT
        category,
        COUNT(*) AS task_count,
        SUM(avg_minutes) / 60.0 AS total_time_hours,
        SUM((avg_minutes / 60.0) * default_cph) AS total_cost,
        COUNT(DISTINCT effective_owner) AS people_count   -- NEW: use effective_owner
      FROM norm
      WHERE ${dateCondition}
      ${uncategorizedCondition}
      GROUP BY category
      ORDER BY total_time_hours DESC NULLS LAST, category;
    `;


    const result = await pool.query(query, params);
    const rows = result.rows || [];

    // Top-level summary (optional; can remove if not used)
    const taskCount = rows.reduce((acc, r) => acc + Number(r.task_count || 0), 0);
    const maxTime   = rows.reduce((mx, r) => Math.max(mx, Number(r.total_time_hours || 0)), 0);

    return res.status(200).json({
      success: true,
      initiatives: rows, // aggregated per category
      taskCount,
      maxTime
    });
  } catch (error) {
    console.error('Error getting initiative intelligence:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get initiative intelligence data',
      error: error.message
    });
  }
};

module.exports = { getInitiativeIntelligence };
