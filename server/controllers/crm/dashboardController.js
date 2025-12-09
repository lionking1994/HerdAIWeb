const pool = require('../../config/database');
const { getTenantId, getOrCreateTenant, getTenant } = require('../../utils/crm');

// Get dashboard opportunities for a specific user
const getDashboardOpportunities = async (req, res) => {
  try {

    const user_id = req.user.id;
    // Query to get opportunities with stage information and filtering
    const query = `
      SELECT 
        o.id,
        o.name,
        o.description,
        o.amount,
        o.probability,        
        o.stage_id,
        o.expected_close_date,
        o.actual_close_date,
        o.account_id,
        o.owner_id,
        o.tenant_id,
        o.created_at,
        o.updated_at,
        a.name as account_name,
        s.name as stage_name,
        s.is_closed_won,
        s.is_closed_lost,
        s.name as stage,
         COALESCE(
        json_agg(
            json_build_object(
                'id', c.id,
                'first_name', c.first_name,
                'last_name', c.last_name,
                'email', c.email,
                'title', c.title
            )
        ) FILTER (WHERE c.id IS NOT NULL),
        '[]'
    ) AS related_contacts
      FROM opportunities o
      LEFT JOIN accounts a ON o.account_id = a.id AND a.tenant_id = $1
      LEFT JOIN opportunity_stages s ON o.stage_id = s.id AND s.tenant_id = $1
      LEFT JOIN opportunity_contacts oc ON oc.opportunity_id = o.id  AND oc.tenant_id = $1
      LEFT JOIN contacts c ON c.id = oc.contact_id
      WHERE o.owner_id = $1
        AND (s.is_closed_won = false OR s.is_closed_won IS NULL)
        AND (s.is_closed_lost = false OR s.is_closed_lost IS NULL)

      GROUP BY 
      o.id, o.name, o.description, o.amount, o.probability, 
      o.stage_id, o.expected_close_date, o.actual_close_date,
      o.account_id, o.owner_id, o.tenant_id, 
      o.created_at, o.updated_at, 
      a.name, s.name, s.is_closed_won, s.is_closed_lost
      ORDER BY o.expected_close_date ASC, o.amount DESC
    `;

    const result = await pool.query(query, [parseInt(user_id)]);

    // Process the opportunities data
    const opportunities = result.rows.map(opportunity => {
      // Calculate if stage is closed
      const isStageClosed = (opportunity.is_closed_won === true) || (opportunity.is_closed_lost === true);

      // Get stage color based on stage name
      const getStageColor = (stageName) => {
        if (!stageName) return 'bg-gray-100 text-gray-800';

        switch (stageName.toLowerCase()) {
          case 'proposal':
            return 'bg-blue-100 text-blue-800';
          case 'negotiation':
            return 'bg-yellow-100 text-yellow-800';
          case 'qualification':
            return 'bg-green-100 text-green-800';
          case 'won':
            return 'bg-green-100 text-green-800';
          case 'lost':
            return 'bg-red-100 text-red-800';
          default:
            return 'bg-gray-100 text-gray-800';
        }
      };

      return {
        ...opportunity,
        is_stage_closed: isStageClosed,
        stage_color: getStageColor(opportunity.stage_name),
        // Format amount for display
        formatted_amount: opportunity.amount ? parseFloat(opportunity.amount).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }) : null
      };
    });

    // Calculate summary statistics
    const totalValue = opportunities.reduce((sum, opp) => {
      return sum + (opp.amount ? parseFloat(opp.amount) : 0);
    }, 0);

    const stagesBreakdown = opportunities.reduce((acc, opp) => {
      const stage = opp.stage_name || 'Unknown';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        opportunities: opportunities,
        total_count: opportunities.length,
        summary: {
          total_value: totalValue,
          stages_breakdown: stagesBreakdown
        }
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard opportunities:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get dashboard projects for a specific user (PSA assigned stories)
const getDashboardProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Query to get projects where user has assigned stories
    const query = `
      SELECT 
        p.id as project_id,
        p.name as project_title,
        p.description,
        COUNT(bi.id) FILTER (WHERE bi.assignee_id = $1) as assigned_stories_count,
        COUNT(bi.id) FILTER (WHERE bi.assignee_id = $1 AND bi.status IN ('in_progress', 'review')) as active_stories_count,
        (SELECT bi_first.id FROM psa_backlog_items bi_first 
         WHERE bi_first.project_id = p.id 
         AND bi_first.assignee_id = $1 
         AND bi_first.type = 'story'
         AND bi_first.is_deleted = false
         ORDER BY bi_first.created_at ASC 
         LIMIT 1) as first_story_id
      FROM psa_projects p
      LEFT JOIN psa_backlog_items bi ON p.id = bi.project_id 
        AND bi.type = 'story' 
        AND bi.assignee_id = $1
        AND bi.is_deleted = false
      WHERE p.is_active = true 
        AND p.is_deleted = false
        AND EXISTS(SELECT 1 FROM psa_backlog_items bi2 
                   WHERE bi2.project_id = p.id 
                   AND bi2.assignee_id = $1 
                   AND bi2.type = 'story'
                   AND bi2.is_deleted = false)
      GROUP BY p.id, p.name, p.description
      HAVING COUNT(bi.id) FILTER (WHERE bi.assignee_id = $1) > 0
      ORDER BY assigned_stories_count DESC
    `;
    
    const result = await pool.query(query, [parseInt(userId)]);
    
    res.json({
      success: true,
      data: {
        projects: result.rows,
        total_projects: result.rows.length,
        has_assigned_stories: result.rows.length > 0
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard projects:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  getDashboardOpportunities,
  getDashboardProjects
};
