const axios = require("axios");
const pool = require("../config/database");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const { inviteNewUser } = require("./taskController");
const { processAI, test_prompt } = require("../utils/llmservice");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { sendUpcomingMeetingAlerts } = require("../utils/socket");
const Meeting = require("../models/Meeting");
const User = require("../models/User");
const TeamsUser = require("../models/TeamsUser");
const ZoomUser = require("../models/ZoomUser");
const GmeetUser = require("../models/GmeetUser");
const { DateTime } = require('luxon');
const { getPlatform } = require("../controllers/authController");

require("dotenv").config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1", // specify your region
});
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

exports.getMeetingList = async (req, res) => {
  const userId = req.user.id;

  try {
    const query = `
      SELECT 
        m.id, 
        m.title, 
        m.summary,
        m.org_id,
        m.transcription_link,
        m.duration,
        m.datetime,
        m.status,
        m.record_link,
        m.platform,
        m.isdeleted,
        (m.org_id = $1) as is_owner,
        json_agg(
          json_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'avatar', u.avatar
          )
        ) as participants
      FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      INNER JOIN users u ON mp.user_id = u.id
      WHERE m.org_id = $1 AND m.isdeleted = false
      GROUP BY m.id, m.title, m.summary, m.org_id, m.transcription_link, 
               m.duration, m.datetime, m.status, m.record_link, m.platform
      ORDER BY m.id DESC`;

    const result = await pool.query(query, [userId]);

    res.status(200).json({
      success: true,
      meetings: result.rows,
    });
  } catch (error) {
    console.error("Error fetching meeting list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch meeting list",
    });
  }
};

exports.getUpcomingMeetings = async (req, res) => {
  const userId = req.user.id;

  try {
    // Get upcoming meetings from the next 7 days
    const query = `
      SELECT 
        m.id, 
        m.title, 
        m.summary,
        m.org_id,
        m.transcription_link,
        m.duration,
        m.datetime,
        m.status,
        m.record_link,
        m.platform,
        m.join_url,
        m.isdeleted
      FROM meetings m
      WHERE m.org_id = $1 
        AND m.isdeleted = false
        AND m.schedule_datetime >= NOW()
        AND m.schedule_datetime <= NOW() + INTERVAL '7 days'
      ORDER BY m.schedule_datetime ASC
      LIMIT 20`;

    const result = await pool.query(query, [userId]);

    res.status(200).json({
      success: true,
      meetings: result.rows,
    });
  } catch (error) {
    console.error("Error fetching upcoming meetings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming meetings",
    });
  }
};

exports.getMeetingDetails = async (req, res) => {
  const meetingId = req.query.meetingId;
  const shouldFetchSimilarTasks = req.query.similarTasks === "true";
  const userId = req.user.id;
  try {
    const roleQuery = `SELECT role FROM users WHERE id = $1`;
    const role = (await pool.query(roleQuery, [userId])).rows[0]?.role;
    console.log("$$$@@@@@@@@@@@@@@@@@@@-----role", role);
    const query = `
      SELECT
        m.id,
        m.title,
        m.summary,
        m.description,
        m.org_id,
        m.transcription_link,
        m.duration,
        m.datetime,
        m.status,
        m.record_link,
        m.platform,
        m.strategy_score,
        m.strategy_explanation,
        m.strategy_analysis,
        m.schedule_datetime,
        m.api_by_tasks,
        m.api_by_summary,
        m.interactive_node_graph_json,
        m.interactive_message,
        t.prompt,
        t.name as template_name,
        m.template_id,
        cl.show_cost_estimates,
        (m.org_id = $2) as is_owner,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'phone', u.phone,
            'location', u.location,
            'bio', u.bio,
            'company_role_name', cr.name,
            'est_cph', cr.est_cph,
            'avatar', u.avatar,
            'role', mp.role, 
            'impact_value_score', mp.impact_value_score, 
            'impact_score_evidence' , mp.impact_score_evidence
          )
        ) as participants,
        (
          SELECT json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'description', t.description,
              'status', t.status,
              'duedate', t.duedate,
              'priority', t.priority,
              'assigned_name', u.name,
              'assigned_id', t.assigned_id,
              'average_time', t.average_time
            )
          )
          FROM tasks t
          LEFT JOIN users u ON t.assigned_id = u.id
          WHERE t.meeting_id = m.id AND t.isdeleted = false
        ) as tasks
      FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      INNER JOIN users u ON mp.user_id = u.id
      LEFT JOIN company_roles cr ON cr.id = u.company_role
      INNER JOIN meeting_participants mpl ON m.id = mpl.meeting_id
      INNER JOIN users ul ON mpl.user_id = ul.id
      LEFT JOIN company_roles crl ON crl.id = ul.company_role
      LEFT JOIN company cl on cl.id = crl.company_id
      LEFT JOIN templates t on m.template_id = t.id
      WHERE m.id = $1 AND m.isdeleted = false
      GROUP BY m.id, m.title, m.summary, m.org_id, m.transcription_link,
               m.duration, m.datetime, m.status, m.record_link, m.platform, m.description,
               m.strategy_score, m.strategy_explanation, m.strategy_analysis, m.schedule_datetime,cl.show_cost_estimates, t.prompt, m.template_id,t.name
    `;

    const result = await pool.query(query, [meetingId, userId]);

    const mpQuery = `SELECT * FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2`;

    const mpResult = await pool.query(mpQuery, [meetingId, userId]);

    console.log("$$$@@@@@@@@@@@@@@@@@@@-----mpResult", mpResult);

    if (result.rows.length && mpResult.rows.length == 0 && role !== "padmin") {
      console.log("status code: 401");
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "You are not authorized to view this meeting",
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    const meeting = result.rows[0];

  

    // Fetch similar tasks for each task if requested
    if (shouldFetchSimilarTasks && meeting.tasks && meeting.tasks.length > 0) {
      try {
        // Get threshold for similarity matching
        const thresholdQuery = await pool.query(
          `SELECT setting_value FROM system_settings WHERE setting_key = 'threshold'`
        );
        const threshold =
          thresholdQuery.rows.length > 0
            ? parseInt(thresholdQuery.rows[0].setting_value) / 100
            : 0;

        // Process each task to find similar tasks
        for (let i = 0; i < meeting.tasks.length; i++) {
          const task = meeting.tasks[i];

          if (task.title && task.description) {
            const similarTasksQuery = await pool.query(
              `
              WITH user_company AS (
                SELECT SPLIT_PART(email, '@', 2) as domain
                FROM users
                WHERE id = $1
              ),
              similarity_scores AS (
                SELECT 
                  t.id,
                  t.title,
                  t.description,
                  t.status,
                  t.priority,
                  t.rate,
                  t.review,
                  u.name as assignee_name,
                  u.id as assignee_id,
                  u.email as assignee_email,
                  u.bio as assignee_bio,
                  u.avatar as assignee_avatar,
                  u.phone as assignee_phone,
                  u.location as assignee_location,
                  c.name as company_name,
                  c.domain as company_domain,
                  m.title as meeting_title,
                  (
                    similarity(COALESCE(t.title, ''), $2::text) +
                    similarity(COALESCE(t.description, ''), $3::text)
                  ) / 2 as match_score
                FROM tasks t
                LEFT JOIN users u ON t.assigned_id = u.id
                LEFT JOIN meetings m ON t.meeting_id = m.id
                LEFT JOIN company c ON SPLIT_PART(u.email, '@', 2) = c.domain
                JOIN user_company uc ON SPLIT_PART(u.email, '@', 2) = uc.domain
                WHERE t.status IN ('Completed', 'Rated')
                  AND t.isdeleted = false
              )
              SELECT *
              FROM similarity_scores
              WHERE match_score >= $4
              ORDER BY match_score DESC
              LIMIT $5
            `, [meeting.org_id, task.title || "", task.description || "", threshold, 10]
            );

            // Format the similar tasks with additional data
            const formattedSimilarTasks = similarTasksQuery.rows.map((similarTask) => ({
              id: similarTask.id,
              title: similarTask.title,
              description: similarTask.description,
              status: similarTask.status,
              priority: similarTask.priority,
              rate: similarTask.rate,
              review: similarTask.review,
              assigneeId: similarTask.assignee_id,
              assigneeName: similarTask.assignee_name,
              assigneeEmail: similarTask.assignee_email,
              assigneeBio: similarTask.assignee_bio,
              assigneeAvatar: similarTask.assignee_avatar,
              assigneePhone: similarTask.assignee_phone,
              assigneeLocation: similarTask.assignee_location,
              companyName: similarTask.company_name,
              companyDomain: similarTask.company_domain,
              meetingTitle: similarTask.meeting_title,
              similarity: (Number(similarTask.match_score) * 100).toFixed(1),
              matchScore: similarTask.match_score,
            }));

            meeting.tasks[i].similarTasks = formattedSimilarTasks;
          } else {
            meeting.tasks[i].similarTasks = [];
          }
        }
      } catch (similarTasksError) {
        console.error("Error fetching similar tasks:", similarTasksError);
        // Don't fail the main request, just set empty similar tasks
        meeting.tasks.forEach((task) => {
          task.similarTasks = [];
        });
      }
    }

    res.status(200).json({
      success: true,
      meeting: meeting,
    });
  } catch (error) {
    console.error("Error fetching meeting details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch meeting details",
    });
  }
};

exports.getApiSettings = async (req, res) => {
  try {
    // Query to get API configurations with their associated models
    const result = await pool.query(
      `SELECT ac.*, 
              array_agg(
                CASE 
                  WHEN acm.id IS NOT NULL THEN 
                    json_build_object(
                      'id', acm.id,
                      'name', acm.name,
                      'model', acm.model
                    )
                  ELSE NULL 
                END
              ) FILTER (WHERE acm.id IS NOT NULL) as models
       FROM api_configurations ac
       LEFT JOIN api_config_models acm ON ac.id = acm.config_id
       GROUP BY ac.id`
    );

    res.json({
      success: true,
      apiConfigs: result.rows,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch settings",
    });
  }
};

exports.getFileUrl = async (req, res) => {
  let videoKey = req.query.videoKey;
  let type = req.query.type;

  // Remove s3://bucket-name/ prefix if present
  if (videoKey.startsWith("s3://")) {
    videoKey = videoKey.split("/").slice(3).join("/");
  }

  const params = {
    Bucket: "zoommeeting-output-transcription-bucket",
    Key: videoKey,
  };

  try {
    if (type === "json") {
      // Get the JSON file content directly from S3
      const data = await s3.getObject(params).promise();
      res.status(200).json(data.Body.toString("utf-8"));
    } else {
      // For non-JSON files, still use presigned URL as it's more efficient
      const presignedUrl = await s3.getSignedUrlPromise("getObject", params);
      res.json({ url: presignedUrl });
    }
  } catch (error) {
    console.error("Error accessing S3 file:", error);
    res.status(500).json({
      success: false,
      error: "Failed to access file",
    });
  }
};

exports.updateTranscription = async (req, res) => {
  const { meetingId, transcription, transcriptionKey } = req.body;

  try {
    // Upload the updated transcription to S3

    let transKey = transcriptionKey.split("/").slice(3).join("/");
    const params = {
      Bucket: "zoommeeting-output-transcription-bucket",
      Key: transKey,
      Body: transcription,
      ContentType: "application/json",
    };

    const result = await s3.putObject(params).promise();
    console.log("result", result);

    // Update only the transcription_link in the database if needed
    const query = `

      UPDATE meetings
      SET transcription_link = $1
      WHERE id = $2
    `;

    await pool.query(query, [transcriptionKey, meetingId]);

    res.status(200).json({
      success: true,
      message: "Transcription updated successfully",
    });
  } catch (error) {
    console.error("Error updating transcription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update transcription",
    });
  }
};

exports.addUserToMeeting = async (req, res) => {
  const { email, meetingId } = req.body;

  try {
    // Loop through each email and insert into meeting_participants
    // Fetch user ID based on email
    const userQuery = `SELECT id FROM users WHERE email = $1`;
    const userResult = await pool.query(userQuery, [email]);
    let userId = null;
    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
    } else {
      userId = await inviteNewUser(meetingId, null, email);
    }
    // Insert into meeting_participants
    const insertQuery = `
      INSERT INTO meeting_participants (meeting_id, user_id, role)
      VALUES ($1, $2, 'new_invite')
    `;
    await pool.query(insertQuery, [Number(meetingId), userId]);

    res.status(200).json({
      success: true,
      message: "User added to the meeting successfully",
    });
  } catch (error) {
    console.error("Error adding user to meeting:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add user to the meeting",
    });
  }
};

exports.getMeetingAllList = async (req, res) => {
  const userId = req.user.id;
  const { sort_by, sort_order } = req.query;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const teamsUser = await TeamsUser.findByUserId(user.id);
    const zoomUser = await ZoomUser.findByUserId(user.id);
    const googleUser = await GmeetUser.findByUserId(user.id);

    const isAnyPlatformEnabled =
      zoomUser?.is_connected === true ||
      teamsUser?.is_connected === true ||
      googleUser?.is_connected === true
        ? true
        : false;

    // Whitelist of allowed sorting configurations
    const allowedSorts = {
      title_asc: "m.title ASC",
      title_desc: "m.title DESC",
      organizer_asc: "u.name ASC",
      organizer_desc: "u.name DESC",
      dateTime_asc: "m.datetime ASC",
      dateTime_desc: "m.datetime DESC",
      duration_asc: "m.duration ASC",
      duration_desc: "m.duration DESC",
      platform_asc: "m.platform ASC",
      platform_desc: "m.platform DESC",
      participantCount_asc: "participant_count ASC",
      participantCount_desc: "participant_count DESC",
    };

    // Default sorting
    let orderClause = "m.datetime DESC";

    // Build sort key and validate
    if (sort_by && sort_order) {
      const sortKey = `${sort_by}_${sort_order.toLowerCase()}`;
      if (allowedSorts[sortKey]) {
        orderClause = allowedSorts[sortKey];
      }
    }

    const query = `
      SELECT 
        m.id, 
        m.title,
        m.summary,
        m.duration,
        m.datetime,
        m.platform,
        m.strategy_score,
        m.agenda_score,
        m.agenda_reason,
        u.name as organizer,
        (
          SELECT COUNT(*)
          FROM meeting_participants mp2
          WHERE mp2.meeting_id = m.id
        ) as participant_count,
        json_agg(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'email', p.email,
            'avatar', p.avatar
          )
        ) as participants,
        (
          SELECT COUNT(*)
          FROM tasks t1
          WHERE t1.meeting_id = m.id AND t1.isdeleted = false
        ) as tasks_count,
        (
          SELECT COUNT(*)
          FROM tasks t
          WHERE t.meeting_id = m.id AND t.isdeleted = false AND (t.status = 'Rated' OR t.status = 'Completed' )
        ) as completed_tasks_count,
        (
          SELECT COUNT(*)
          FROM tasks t
          WHERE t.meeting_id = m.id AND t.isdeleted = false AND (t.duedate::timestamptz)::date < CURRENT_DATE AND (t.status = 'Pending' OR t.status = 'Assigned' OR t.status = 'In Progress' )
        ) as Due_past_tasks_count
      FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      INNER JOIN users p ON mp.user_id = p.id
      INNER JOIN meeting_participants mp_org ON m.id = mp_org.meeting_id AND mp_org.role = 'organizer'
      INNER JOIN users u ON mp_org.user_id = u.id
      WHERE mp.user_id = $1
      AND m.isdeleted = false
      GROUP BY m.id, m.title, m.summary, m.duration, m.datetime, m.platform, u.name, m.agenda_score,
        m.agenda_reason
      ORDER BY ${orderClause}
    `;

    const result = await pool.query(query, [userId]);
    res.status(200).json({
      success: true,
      meetings: result.rows,
      anyMeetingPlatformConnected: isAnyPlatformEnabled,
    });
  } catch (error) {
    console.error("Error fetching all meetings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch meetings",
    });
  }
};

exports.deleteMeeting = async (req, res) => {
  const meetingId = req.body.meetingId; // Assuming meetingId is passed as a URL parameter
  console.log("Meeting ID:", meetingId);
  try {
    // Begin transaction
    await pool.query("BEGIN");

    // Update meeting, tasks, and task_threads in a single transaction
    const queries = [
      // Update meeting
      `UPDATE meetings 
       SET isdeleted = true 
       WHERE id = $1`,

      // Update related tasks
      `UPDATE tasks 
       SET isdeleted = true 
       WHERE meeting_id = $1`,

      // Update related task threads
      `UPDATE task_threads 
       SET isdeleted = true 
       WHERE task_id IN (SELECT id FROM tasks WHERE meeting_id = $1)`,
    ];

    // Execute all queries
    for (const query of queries) {
      await pool.query(query, [meetingId]);
    }

    // Commit transaction
    await pool.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Meeting and related items deleted successfully",
    });
  } catch (error) {
    // Rollback in case of error
    await pool.query("ROLLBACK");
    console.error("Error deleting meeting:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete meeting",
    });
  }
};

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

exports.statisticMeeting = async (req, res) => {
  const { year, quat, company, isYTD } = req.body;
  let quat_start = null;
  let quat_end = null;

  if (year) {
    if (isYTD) {
      // For YTD, set start to January 1st and end to December 31st
      quat_start = new Date(year, 0, 1);
      quat_end = new Date(year, 11, 31);
    } else if (quat) {
      // For quarterly view
      quat_start = new Date(year, quat * 3 - 3, 1);
      quat_end = new Date(year, quat * 3, 0);
    }
  }

  try {
    let Meetings;
    if (company) {
      Meetings = await pool.query(
        `
      WITH company_info AS (
        SELECT domain 
        FROM company 
        WHERE id = $3
      ),
      company_meetings AS (
        SELECT m.*
        FROM meetings m
        JOIN users u ON m.org_id = u.id
        CROSS JOIN company_info ci
        WHERE SPLIT_PART(u.email, '@', 2) = ci.domain
      )
      SELECT
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as meeting_count
      FROM company_meetings
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `,
        [quat_start, quat_end, company]
      );
    } else {
      Meetings = await pool.query(
        `
      SELECT
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as meeting_count
      FROM meetings
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `,
        [quat_start, quat_end]
      );
    }

    let labels = [];
    let monthCounts = [];

    if (isYTD) {
      // For YTD, we need all 12 months
      labels = months;
      monthCounts = Array(12).fill(0); // Initialize array for 12 months

      Meetings.rows.forEach((row) => {
        const monthIndex = new Date(row.month).getMonth(); // Get month index (0-11)
        monthCounts[monthIndex] = parseInt(row.meeting_count);
      });
    } else {
      // For quarterly view
      labels = [
        months[quat * 3 - 3], // First month of quarter (e.g., 'Jan')
        months[quat * 3 - 2], // Second month of quarter (e.g., 'Feb')
        months[quat * 3 - 1], // Third month of quarter (e.g., 'Mar')
      ];
      monthCounts = Array(3).fill(0); // Initialize array for 3 months

      Meetings.rows.forEach((row) => {
        const monthIndex = new Date(row.month).getMonth() % 3; // Get index (0-2) within quarter
        monthCounts[monthIndex] = parseInt(row.meeting_count);
      });
    }

    const meetingData = {
      labels: labels,
      datasets: [
        {
          label: "Number of Meetings",
          data: monthCounts, // Array of meeting counts for each month
          borderColor: "#10B981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
      ],
    };

    res.status(200).json({
      status: true,
      meetings: meetingData,
    });
  } catch (e) {
    return res.status(500).json({
      status: false,
      error: e,
    });
  }
};

exports.getTopExpensiveMeetings = async (req, res) => {
  const { year, quat, company, isYTD } = req.body;
  let quat_start = null;
  let quat_end = null;

  if (year) {
    if (isYTD) {
      // For YTD, set start to January 1st and end to December 31st
      quat_start = new Date(year, 0, 1);
      quat_end = new Date(year, 11, 31);
    } else if (quat) {
      // For quarterly view
      quat_start = new Date(year, quat * 3 - 3, 1);
      quat_end = new Date(year, quat * 3, 0);
    }
  }

  try {
    let expensiveMeetings;
    
    if (company) {
      // Get top 5 expensive meetings for specific company
      expensiveMeetings = await pool.query(
        `
        WITH company_info AS (
          SELECT domain 
          FROM company 
          WHERE id = $3
        ),
        company_meetings AS (
          SELECT m.*, u.name as organizer_name
          FROM meetings m
          JOIN users u ON m.org_id = u.id
          CROSS JOIN company_info ci
          WHERE SPLIT_PART(u.email, '@', 2) = ci.domain
            AND m.isdeleted = false
        ),
        meeting_costs AS (
          SELECT 
            m.id,
            m.title,
            m.organizer_name,
            m.duration,
            m.datetime,
            COALESCE((m.duration / 60.0) * total_participant_cph, 0) as estimated_cost
          FROM company_meetings m
          JOIN (
            SELECT 
              meeting_id,
              SUM(COALESCE(cr.est_cph, 0)) as total_participant_cph
            FROM meeting_participants mp
            JOIN users u ON mp.user_id = u.id
            LEFT JOIN company_roles cr ON u.company_role = cr.id
            GROUP BY meeting_id
          ) participant_costs ON m.id = participant_costs.meeting_id
          WHERE m.datetime BETWEEN $1 AND $2
        )
        SELECT 
          id,
          title,
          organizer_name,
          duration,
          datetime,
          estimated_cost
        FROM meeting_costs
        WHERE estimated_cost > 0
        ORDER BY estimated_cost DESC
        LIMIT 5
        `,
        [quat_start, quat_end, company]
      );
    } else {
      // Get top 5 expensive meetings for all companies
      expensiveMeetings = await pool.query(
        `
        WITH meeting_costs AS (
          SELECT 
            m.id,
            m.title,
            u.name as organizer_name,
            m.duration,
            m.datetime,
            COALESCE((m.duration / 60.0) * total_participant_cph, 0) as estimated_cost
          FROM meetings m
          JOIN users u ON m.org_id = u.id
          JOIN (
            SELECT 
              meeting_id,
              SUM(COALESCE(cr.est_cph, 0)) as total_participant_cph
            FROM meeting_participants mp
            JOIN users u ON mp.user_id = u.id
            LEFT JOIN company_roles cr ON u.company_role = cr.id
            GROUP BY meeting_id
          ) participant_costs ON m.id = participant_costs.meeting_id
          WHERE m.isdeleted = false
            AND m.datetime BETWEEN $1 AND $2
        )
        SELECT 
          id,
          title,
          organizer_name,
          duration,
          datetime,
          estimated_cost
        FROM meeting_costs
        WHERE estimated_cost > 0
        ORDER BY estimated_cost DESC
        LIMIT 5
        `,
        [quat_start, quat_end]
      );
    }

    // Format the response
    const formattedMeetings = expensiveMeetings.rows.map((meeting, index) => ({
      id: meeting.id,
      title: meeting.title,
      organizer: meeting.organizer_name,
      duration: meeting.duration,
      datetime: meeting.datetime,
      cost: Math.round(meeting.estimated_cost * 100) / 100, // Round to 2 decimal places
      rank: index + 1
    }));

    res.status(200).json({
      status: true,
      expensiveMeetings: formattedMeetings,
    });
  } catch (error) {
    console.error("Error getting expensive meetings:", error);
    return res.status(500).json({
      status: false,
      error: "Failed to get expensive meetings data",
    });
  }
};

exports.getMeetingAnalytics = async (req, res) => {
  try {
    const { meetingId } = req.body;

    // First check if we have cached analytics
    const cachedQuery = `
      SELECT chart_data
      FROM meeting_analytics
      WHERE meeting_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
    `;
    const cachedResult = await pool.query(cachedQuery, [meetingId]);

    // If we have cached data, return it immediately
    if (cachedResult.rows.length > 0) {
      return res.json({
        success: true,
        data: cachedResult.rows[0].chart_data,
        cached: true,
      });
    }

    // If no cached data, proceed with the rest of your existing code...
    const meetingQuery = `
      SELECT transcription_link, title
      FROM meetings
      WHERE id = $1 AND isdeleted = false
    `;
    const meetingResult = await pool.query(meetingQuery, [meetingId]);

    if (meetingResult.rows.length === 0) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const transcription = meetingResult.rows[0].transcription_link;

    const userprompt = `
      Analyze this meeting transcription and provide data for 4 different visualizations.
      Format the response as a JSON object with 4 properties: talkTime, speakerSentiment, sentimentOverTime, and dominance.

      1. For talkTime (Pie Chart):
         Calculate the total speaking time for each participant.
         Format: { "talkTime": [{ "name": "Speaker Name", "value": timeInSeconds }] }

      2. For speakerSentiment (Bar Chart):
         Analyze overall sentiment for each speaker on a scale of -1 to 1.
         Format: { "speakerSentiment": [{ "name": "Speaker Name", "value": sentimentScore }] }

      3. For sentimentOverTime (Line Chart):
         Break the meeting into 5-minute blocks and track sentiment by speaker.
         Format: { "sentimentOverTime": [{ "timeBlock": "0-5", "Speaker1": score1, "Speaker2": score2 }] }

      4. For dominance (Bar Chart):
         Show speaking dominance in 5-minute blocks, sum must be 100.
         Format: { "dominance": [{ "timeBlock": "0-5", "Speaker1": percentage1, "Speaker2": percentage2 }] }

      Meeting Transcription:
      ${transcription}
    `;
    /*
    const bedrockParams = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `\n\nHuman: ${prompt}\n\nAssistant: I'll analyze the transcription and provide the data in the requested JSON format.`,
        max_tokens_to_sample: 2048,
        temperature: 0.7,
        anthropic_version: "bedrock-2023-05-31"
      })
    };

    const command = new InvokeModelCommand(bedrockParams);
    const response = await bedrockClient.send(command);
    const completion = JSON.parse(new TextDecoder().decode(response.body));
*/

    const sysprompt = `I'll analyze the transcription and provide the data in the requested JSON format.`;
    const completion = await processAI(sysprompt, userprompt, 2048);

    // Parse the completion to extract the JSON data
    let chartData;
    try {
      // Find the JSON object in the completion text
      const jsonMatch = completion.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        chartData = JSON.parse(jsonMatch[0]);
      } else {
        // Otherwise try to find JSON object directly in the completion
        const jsonStart = completion.indexOf("{");
        const jsonEnd = completion.lastIndexOf("}") + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonStr = completion.slice(jsonStart, jsonEnd);
          chartData = JSON.parse(jsonStr);
        } else {
          // If no feedback data, return empty array
          chartData = [];
        }
      }
    } catch (error) {
      console.error("Error parsing chart data:", error);
      return res.status(500).json({ error: "Failed to parse analytics data" });
    }

    // Cache the results in the database
    const cacheQuery = `
      INSERT INTO meeting_analytics (meeting_id, chart_data, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (meeting_id)
      DO UPDATE SET chart_data = $2, created_at = NOW()
    `;
    await pool.query(cacheQuery, [meetingId, chartData]);

    res.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    console.error("Error generating meeting analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate meeting analytics",
    });
  }
};

exports.upcomingMeetingAlert = async (req, res) => {
  const meetingList = req.body;

  const formattedMeetingList = meetingList.map((meeting) => {
    return { id: meeting.id, title: meeting.title, org_id: meeting.org_id };
  });

  formattedMeetingList.forEach((meeting) => sendUpcomingMeetingAlerts(meeting));

  res.status(200).send("Notification received");
};

exports.upcomingMeetingAlertTest = async (req, res) => {
  const { userId, msgId } = req.body;
  console.log("upcomingMeetingAlertTest: ", userId, msgId);
  res.status(200).send("Notification received");
};

exports.companyMeetings = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      page = 1,
      pageSize = 10,
      sortBy = "datetime",
      sortOrder = "desc",
      search = "",
    } = req.body; // Changed from req.query to req.body

    console.log(
      "companyMeetings, companyId:",
      companyId,
      "page:",
      page,
      "pageSize:",
      pageSize
    );

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize))); // Limit max page size to 100
    const offset = (pageNum - 1) * pageSizeNum;

    // Validate sort parameters
    const allowedSortFields = [
      "title",
      "datetime",
      "participant_count",
      "task_count",
      "organizer_name",
    ];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "datetime";
    const sortDirection = ["asc", "desc"].includes(sortOrder.toLowerCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    // Build search condition
    let searchCondition = "";
    let searchParams = [companyId];
    let paramIndex = 2;

    if (search && search.trim()) {
      searchCondition = `
        AND (
          m.title ILIKE $${paramIndex} OR 
          m.summary ILIKE $${paramIndex} OR
          u.name ILIKE $${paramIndex} OR
          u.email ILIKE $${paramIndex}
        )
      `;
      searchParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Get total count for pagination
    const countQuery = `
      WITH company_info AS (
        SELECT domain 
        FROM company 
        WHERE id = $1
      )
      SELECT COUNT(*) as total
      FROM meetings m
      JOIN users u ON m.org_id = u.id
      CROSS JOIN company_info ci
      WHERE SPLIT_PART(u.email, '@', 2) = ci.domain
        AND m.isdeleted = false
        ${searchCondition}
    `;

    const countResult = await pool.query(countQuery, searchParams);
    const totalCount = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalCount / pageSizeNum);

    // Get paginated results
    const dataQuery = `
      WITH company_info AS (
        SELECT domain 
        FROM company 
        WHERE id = $1
      )
      SELECT 
        m.id,
        m.title,
        m.summary as description,
        m.datetime,
        m.transcription_link,
        (
          SELECT COUNT(*)
          FROM meeting_participants mp
          WHERE mp.meeting_id = m.id
        ) as participant_count,
        (
          SELECT COUNT(*)
          FROM tasks t
          WHERE t.meeting_id = m.id
          AND t.isdeleted = false
        ) as task_count,
        u.name as organizer_name,
        u.email as organizer_email
      FROM meetings m
      JOIN users u ON m.org_id = u.id
      CROSS JOIN company_info ci
      WHERE SPLIT_PART(u.email, '@', 2) = ci.domain
        AND m.isdeleted = false
        ${searchCondition}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...searchParams, pageSizeNum, offset];
    const result = await pool.query(dataQuery, dataParams);

    res.status(200).json({
      success: true,
      meetings: result.rows,
      pagination: {
        currentPage: pageNum,
        pageSize: pageSizeNum,
        totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
      sorting: {
        sortBy: sortField,
        sortOrder: sortDirection.toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Error fetching company meetings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch company meetings",
      message: error.message,
    });
  }
};

// Get meetings for dropdown selection (simplified version for CRM)
exports.getMeetingsForDropdown = async (req, res) => {
  try {
    const { companyId } = req.params;

    console.log("getMeetingsForDropdown, companyId:", companyId);

    // Get meetings for the company (last 100 meetings, ordered by date desc)
    const query = `
      WITH company_info AS (
        SELECT domain
        FROM company
        WHERE id = $1
      )
      SELECT
        m.id,
        m.title,
        m.datetime,
        m.platform,
        u.name as organizer_name
      FROM meetings m
      JOIN users u ON m.org_id = u.id
      CROSS JOIN company_info ci
      WHERE SPLIT_PART(u.email, '@', 2) = ci.domain
        AND m.isdeleted = false
        AND m.title IS NOT NULL
        AND m.title != ''
      ORDER BY m.datetime DESC
      LIMIT 100
    `;

    const result = await pool.query(query, [companyId]);

    res.status(200).json({
      success: true,
      meetings: result.rows.map(meeting => ({
        id: meeting.id,
        title: meeting.title,
        datetime: meeting.datetime,
        platform: meeting.platform,
        organizer_name: meeting.organizer_name,
        display_text: `${meeting.title} - ${new Date(meeting.datetime).toLocaleDateString()} (${meeting.organizer_name})`
      }))
    });
  } catch (error) {
    console.error("Error fetching meetings for dropdown:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch meetings",
      message: error.message,
    });
  }
};

const processTranscription = async (transcription) => {
  //generate summary with transcription
  const sysprompt = `Provide an executive summary of the meeting.`;
  const userprompt = `Original text: ${transcription}`;
  const completion = await processAI(sysprompt, userprompt, 1000);
  return completion;
};

const checkTranscriptionStatus = async (jobName, meetingId) => {
  const transcribeClient = new AWS.TranscribeService({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });

  try {
    const data = await transcribeClient
      .getTranscriptionJob({ TranscriptionJobName: jobName })
      .promise();
    const status = data.TranscriptionJob.TranscriptionJobStatus;

    if (status === "COMPLETED") {
      // Get the transcription file URL
      const transcriptFileUrl =
        data.TranscriptionJob.Transcript.TranscriptFileUri;

      // Download the transcription file
      const response = await axios.get(transcriptFileUrl);
      const transcriptionData = response.data;

      // Extract the transcript text
      let transcriptText = "";
      if (
        transcriptionData &&
        transcriptionData.results &&
        transcriptionData.results.transcripts
      ) {
        transcriptText = transcriptionData.results.transcripts
          .map((transcript) => transcript.transcript)
          .join("\n");
      }
      // Update the meeting record with the transcription

      const summary = await processTranscription(transcriptText);

      await pool.query(
        "UPDATE meetings SET transcription_link = $1, summary = $2 WHERE id = $3",
        [transcriptText, summary, meetingId]
      );

      console.log(
        `Transcription completed and updated for meeting ${meetingId}`
      );
    } else if (status === "FAILED") {
      console.error(`Transcription job ${jobName} failed`);
    } else {
      // Job is still in progress, check again after a delay
      setTimeout(() => checkTranscriptionStatus(jobName, meetingId), 30000); // Check every 30 seconds
    }
  } catch (error) {
    console.error("Error checking transcription status:", error);
  }
};

exports.uploadMeetingAudio = async (req, res) => {
  const { user_id, datetime, title } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `audio/${Date.now()}_${Math.random() * 100000}`,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  };
  s3.upload(params, async (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error uploading file" });
    }

    const transcribeClient = new AWS.TranscribeService({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const transcriptionJobName = `meeting-transcription-${Date.now()}`;

    const transcribeParams = {
      TranscriptionJobName: transcriptionJobName,
      LanguageCode: "en-US", // Set appropriate language code
      MediaFormat: "mp3", // Extract format from mimetype (e.g., 'mp3' from 'audio/mp3')
      Media: {
        MediaFileUri: data.Location,
      },
      OutputBucketName: process.env.S3_BUCKET_NAME,
      OutputKey: `transcriptions/${transcriptionJobName}.json`,
    };

    transcribeClient.startTranscriptionJob(
      transcribeParams,
      async (transcribeErr, transcribeData) => {
        if (transcribeErr) {
          console.error("Error starting transcription job:", transcribeErr);
          // Continue with meeting creation even if transcription fails
        } else {
          // Create the meeting record first
          const result = await Meeting.create({
            meeting_id: uuidv4(),
            title: title || "NO TITLE",
            description: "",
            summary: "",
            datetime: new Date(),
            duration: null,
            joinUrl: null,
            teams_id: null,
            status: "Mobile App",
            org_id: user_id,
            platform: "Mobile App",
            transcription_link: null,
            record_link: data.Location,
          });
          const resultMeetingParticipants = await pool.query(
            "INSERT INTO meeting_participants (meeting_id, user_id, role) VALUES ($1, $2, $3)",
            [result.id, user_id, "organizer"]
          );

          // Start checking the transcription status
          setTimeout(
            () => checkTranscriptionStatus(transcriptionJobName, result.id),
            30000
          );

          res.json({
            message: "File uploaded successfully and transcription started",
            meetingId: result.id,
            url: data.Location,
          });
        }
      }
    );
  });
};

// exports.prepareMeeting = async (req, res) => {
//   try {
//     const { meetingId } = req.body;

//     // Get meeting details
//     const meetingQuery = `
//       SELECT 
//         m.*,
//         u.name as organizer_name,
//         u.email as organizer_email
//       FROM meetings m
//       JOIN users u ON m.org_id = u.id
//       WHERE m.id = $1`;
//     const meetingResult = await pool.query(meetingQuery, [meetingId]);
//     const meeting = meetingResult.rows[0];

//     if (!meeting) {
//       return res.status(404).json({
//         success: false,
//         message: "Meeting not found",
//       });
//     }

//     // Get current meeting participants with their open tasks count
//     const participantsQuery = `
//       WITH participant_tasks AS (
//         SELECT
//           t.*
//         FROM tasks t
//         JOIN meetings m ON t.meeting_id = m.id
//         WHERE t.assigned_id IN (
//           SELECT user_id
//           FROM meeting_participants
//           WHERE meeting_id = $1
//         )
//         AND t.status IN ('Pending', 'Assigned', 'In Progress', 'Ready For Review')
//         AND t.isdeleted = false
//         AND m.id != $1
//       )
//       SELECT 
//         u.id as user_id,
//         u.name,
//         u.email,
//         u.avatar,
//         COUNT(pt.id) as open_tasks_count
//       FROM meeting_participants mp
//       JOIN users u ON mp.user_id = u.id
//       LEFT JOIN participant_tasks pt ON u.id = pt.assigned_id
//       WHERE mp.meeting_id = $1
//       GROUP BY u.id, u.name, u.email, u.avatar`;

//     const participants = await pool.query(participantsQuery, [meetingId]);

//     res.status(200).json({
//       success: true,
//       meeting,
//       participants: participants.rows,
//     });
//   } catch (error) {
//     console.error("Error preparing meeting:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to prepare meeting",
//       error: error.message,
//     });
//   }
// };

exports.prepareMeeting = async (req, res) => {
  try {
    const { meetingId } = req.body;
 
    const serverNow = new Date();
    const clientNow = serverNow;
    const offsetMs = clientNow.getTime() - serverNow.getTime();
    const offsetMsWithUTC = offsetMs + (0 - serverNow.getTimezoneOffset()) * 60000;
    // Get meeting details
    const meetingQuery = `
     SELECT
      m.*,
      u.name AS organizer_name,
      u.email AS organizer_email
      FROM meetings m
      JOIN users u ON
      (m.org_id IS NOT NULL AND m.org_id = u.id)
      OR
      (m.org_id IS NULL AND u.id = (SELECT user_id FROM meeting_participants WHERE meeting_id = m.id
      ORDER BY
      CASE WHEN role = 'organiser' THEN 0 ELSE 1 END
      LIMIT 1
      ))
      WHERE m.id = $1`;
     
    const meetingResult = await pool.query(meetingQuery, [meetingId]);
    const meeting = meetingResult.rows[0];
 
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }
    else{
      const schduledatetime = meeting.schedule_datetime
       const utcDateStart = new Date(schduledatetime);
       const localDateStart = new Date(utcDateStart.getTime() + offsetMsWithUTC);
       meeting.schedule_datetime=localDateStart;
    }
 
    // Get current meeting participants with their open tasks count
    const participantsQuery = `
      WITH participant_tasks AS (
        SELECT
          t.*
        FROM tasks t
        JOIN meetings m ON t.meeting_id = m.id
        WHERE t.assigned_id IN (
          SELECT user_id
          FROM meeting_participants
          WHERE meeting_id = $1
        )
        AND t.status IN ('Pending', 'Assigned', 'In Progress', 'Ready For Review')
        AND t.isdeleted = false
        AND m.id != $1
      )
      SELECT
        u.id as user_id,
        u.name,
        u.email,
        u.avatar,
        COUNT(pt.id) as open_tasks_count
      FROM meeting_participants mp
      JOIN users u ON mp.user_id = u.id
      LEFT JOIN participant_tasks pt ON u.id = pt.assigned_id
      WHERE mp.meeting_id = $1
      GROUP BY u.id, u.name, u.email, u.avatar`;
 
    const participants = await pool.query(participantsQuery, [meetingId]);
 
    res.status(200).json({
      success: true,
      meeting,
      participants: participants.rows,
    });
  } catch (error) {
    console.error("Error preparing meeting:", error);
    res.status(500).json({
      success: false,
      message: "Failed to prepare meeting",
      error: error.message,
    });
  }
};

exports.previewPrompt = async (req, res) => {
  let {
    modelId,
    promptEndpoint,
    system_prompt,
    user_prompt,
    maxTokens,
    meeting,
  } = req.body;
  if (
    !modelId ||
    !promptEndpoint ||
    !system_prompt ||
    !user_prompt ||
    !maxTokens ||
    !meeting
  ) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
      details:
        "All fields (modelId, provider, promptEndpoint, system_prompt, user_prompt, maxTokens, meeting) are required",
    });
  }

  try {
    // Get the provider and model from the modelId
    const modelQuery = await pool.query(
      `SELECT ac.provider, acm.model
   FROM api_configurations ac
   JOIN api_config_models acm ON ac.id = acm.config_id
   WHERE acm.id = $1`,
      [modelId]
    );

    if (modelQuery.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Model not found",
      });
    }

    const { provider, model } = modelQuery.rows[0];
    if (promptEndpoint === "task") {
      system_prompt = `${system_prompt} 
    Current timestamp: ${new Date().toISOString()}
    Categories :sales,
    marketing,
    business development,
    product development,
    e&d,
    personal objective,
    company objective,
    consulting,
    other`;
    }

    const response = await test_prompt(
      system_prompt,
      user_prompt,
      maxTokens,
      provider,
      model
    );
console.log("test_prompt", response);
    if (response.status === true) {
      let preview = response.preview;
      if (promptEndpoint === "task") {
        preview = await jsonContentProvider(response.preview, meeting);
        // preview = preview.tasks;
      }
      return res.status(200).json({
        success: true,
        preview: preview,
        message: "Preview generated successfully",
      });
    } else {
      return res.status(500).json({
        success: false,
        error: response.preview,
        message: "Failed to generate preview",
      });
    }
  } catch (error) {
    console.error("Error in previewPrompt:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process preview request",
      error: error.message || "Unknown error occurred",
    });
  }
};

const jsonContentProvider = async (completion, meeting) => {
  const jsonMatch = completion.match(/```json\n([\s\S]*?)\n```/);

  let jsonContent;

  if (jsonMatch) {
    jsonContent = JSON.parse(jsonMatch[1]);
  } else {
    // Otherwise try to find JSON object directly in the completion
    const jsonStart = completion.indexOf("{");
    const jsonEnd = completion.lastIndexOf("}") + 1;
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const jsonStr = completion.slice(jsonStart, jsonEnd);
      jsonContent = JSON.parse(jsonStr);
    } else {
      // If no feedback data, return empty array
      jsonContent = [];
    }
  }

  let tasks;
  let meeting_participants;
  let meetingId = meeting.id;
  try {
    tasks = jsonContent.tasks; // Extract the tasks array from the response object
    // Get meeting participants
    const participantsResult = await pool.query(
      `SELECT users.id, users.name 
      FROM meeting_participants 
      JOIN users ON meeting_participants.user_id = users.id 
      WHERE meeting_participants.meeting_id = $1`,
      [meetingId]
    );
    meeting_participants = participantsResult.rows;

    // Validate and clean tasks before database insertion
    tasks = tasks.map((task) => ({
      ...task,
      title: String(task.title).slice(0, 255),
      description: String(task.description).slice(0, 1000),
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
      average_time: task.average_time ? parseInt(task.average_time) : 1,
      assigned_name: task.assigned_id,
      assigned_id: task.assigned_id
        ? meeting_participants.find((participant) =>
            String(participant.name?.toLowerCase()).includes(
              task.assigned_id?.toLowerCase()
            )
          )?.id
          ? meeting_participants.find((participant) =>
              String(participant.name?.toLowerCase()).includes(
                task.assigned_id?.toLowerCase()
              )
            )?.id
          : null
        : null,
      category: task.category,
    }));
    return tasks;
  } catch (parseError) {
    console.error("Error parsing Bedrock response:", parseError);
    return res.status(500).json({
      success: false,
      error: "Failed to parse generated tasks",
      rawResponse: completion.completion,
    });
  }
};
// Add this endpoint to handle participant removal
exports.removeParticipant = async (req, res) => {
  const { meetingId, userId } = req.body;

  try {
    // Check if the user making the request is the meeting owner or has admin rights
    const meetingResult = await pool.query(
      "SELECT org_id FROM meetings WHERE id = $1",
      [meetingId]
    );

    if (meetingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    const meeting = meetingResult.rows[0];

    // Only allow meeting owner or admins to remove participants
    if (meeting.org_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message:
          "You don't have permission to remove participants from this meeting",
      });
    }

    // Don't allow removing the meeting owner
    if (userId === meeting.org_id) {
      return res.status(400).json({
        success: false,
        message: "Cannot remove the meeting owner",
      });
    }

    // Remove the participant from meeting_participants table
    await pool.query(
      "DELETE FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2",
      [meetingId, userId]
    );

    // Also update any tasks assigned to this user in this meeting
    await pool.query(
      "UPDATE tasks SET assigned_id = NULL WHERE meeting_id = $1 AND assigned_id = $2",
      [meetingId, userId]
    );

    res.status(200).json({
      success: true,
      message: "Participant removed successfully",
    });
  } catch (error) {
    console.error("Error removing participant:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove participant",
    });
  }
};

/**
 * Get today's schedule for a user, properly handling timezone conversion
 * 
 * Request body can include:
 * - time: ISO string of current client time (optional, defaults to server time)
 * - timezone: timezone string like 'UTC-4', 'UTC+5', etc. (optional, defaults to 'UTC-4')  
 * - timezoneOffset: direct offset in hours, e.g. -4 for UTC-4 (optional, takes priority over timezone string)
 * 
 * Examples:
 * { "time": "2023-12-25T14:30:00.000Z", "timezone": "UTC-4" }
 * { "time": "2023-12-25T14:30:00.000Z", "timezoneOffset": -4 }
 */
exports.todaysSchedule = async (req, res) => {
  const userId = req.user.id;
  const clientTime = req.body.time; // should be ISO string or timestamp from client
  const timeOffset = new Date(clientTime) - new Date();
  const timeOffsetHours = timeOffset / (1000 * 60 * 60);
  console.log("today-schedule-timeOffset:", timeOffset);
  console.log("today-schedule-timeOffsetHours:", timeOffsetHours);
  try {
    // Use client time directly, or current time as fallback (same pattern as getProductivityScore)
    const currentTime = clientTime ? new Date(clientTime) : new Date();

    // Parse timezone offset (UTC-4 means client is 4 hours behind UTC)
    let timezoneOffsetHours = 0;
    
    // Priority: direct offset > timezone string > default
    if (typeof timeOffsetHours === 'number') {
      // Direct offset provided (e.g., -4 for UTC-4)
      // Convert to hours to add to client time to get UTC
      timezoneOffsetHours = -timeOffsetHours;
    } else {
      // Default to UTC-4 if no offset provided
      timezoneOffsetHours = -4;
    }

    const clientTimeUTC = new Date(currentTime.getTime() + (timezoneOffsetHours * 60 * 60 * 1000));
    
    const startOfDay = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
    const startOfDayUTC = new Date(startOfDay.getTime() + (timezoneOffsetHours * 60 * 60 * 1000));

    // Calculate end of day in client timezone, converted to UTC
    const endOfDay = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), 23, 59, 59, 999);
    const endOfDayUTC = new Date(endOfDay.getTime() + (timezoneOffsetHours * 60 * 60 * 1000));

    console.log("---------- Time Range ----------");
    console.log("Current time:", currentTime.toISOString());
    console.log("Client time:", clientTime);
    console.log("Timezone offset (hours):", timezoneOffsetHours);
    console.log("Start of day (client local):", startOfDay.toISOString());
    console.log("Start of day (UTC):", startOfDayUTC.toISOString());
    console.log("End of day (client local):", endOfDay.toISOString());
    console.log("End of day (UTC):", endOfDayUTC.toISOString());
    console.log("---------- Time Range ----------");

    const result = await pool.query(
      `
      SELECT
        m.id,
        m.title,
        m.datetime,
        m.schedule_datetime,
        m.platform,
        m.record_link,
        m.duration,
        m.research_topic,
        m.agenda_score,
        m.join_url,
        m.agenda_reason,
        c.show_cost_estimates,
        json_agg(
          json_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'avatar', u.avatar,
            'est_cph', cr.est_cph
          )
        ) as participants
      FROM  meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      INNER JOIN users u ON mp.user_id = u.id AND mp.user_id = $1
      LEFT JOIN company_roles cr ON cr.id = u.company_role
      LEFT JOIN company c ON c.id = cr.company_id
      WHERE EXISTS (
        SELECT 1 FROM meeting_participants mp2
        WHERE mp2.meeting_id = m.id AND mp2.user_id = $1
      )
      AND m.isdeleted = false
      AND m.schedule_datetime + INTERVAL '1 minute' * m.schedule_duration >= $2
      AND m.schedule_datetime  <= $3
      GROUP BY m.id, m.title, m.datetime, m.schedule_datetime, m.platform, m.record_link, m.duration, m.research_topic, c.show_cost_estimates,
      m.agenda_score, m.agenda_reason, m.join_url
      ORDER BY m.schedule_datetime ASC
      `,
      [userId, clientTimeUTC.toISOString(), endOfDayUTC.toISOString()]
    );

    // No need for complex offset calculations - just return the meetings as they are
    // The database stores times in UTC and the client can handle the local display
    const meetings = result.rows.map((meeting) => ({
      ...meeting,
      schedule_datetime_local: meeting.schedule_datetime, // Keep original UTC time for client to handle
    }));

    res.status(200).json({
      success: true,
      meetings,
    });
  } catch (e) {
    console.error(`Today's Schedule:`, e);
    res.status(500).json({
      success: false,
      message: e,
    });
  }
};

exports.availableMeetingTypes = async (req, res) => {
  const userId = req.user.id;
  try {
    const queryGoogle = `SELECT 1 FROM gmeet_users WHERE user_id = $1 AND is_connected = true`;
    const queryTeams = `SELECT 1 FROM teams_users WHERE user_id = $1 AND is_connected = true`;
    const queryZoom = `SELECT 1 FROM zoom_users WHERE user_id = $1 AND is_connected = true`;
    const googleResult = await pool.query(queryGoogle, [userId]);
    const teamsResult = await pool.query(queryTeams, [userId]);
    const zoomResult = await pool.query(queryZoom, [userId]);
    const googleAvailable = googleResult.rows.length > 0;
    const teamsAvailable = teamsResult.rows.length > 0;
    const zoomAvailable = zoomResult.rows.length > 0;
    res.status(200).json({
      success: true,
      googleAvailable,
      teamsAvailable,
      zoomAvailable,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to check available meeting types",
    });
  }
};

exports.getResearchTopic = async (req, res) => {
  const meetingId = req.body.meetingId;
  console.log("upcomingMeeting:", meetingId);
  try {
    // Get meeting title and description
    const meetingQuery = `
      SELECT m.title, m.description,
        json_agg(u.email) AS participants
      FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      INNER JOIN users u ON mp.user_id = u.id
      WHERE m.id = $1
      GROUP BY m.id
    `;
    const result = await pool.query(meetingQuery, [meetingId]);
    if (!result.rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }
    const { title, description, participants } = result.rows[0];

    // Format prompt as requested
    const sysprompt =
      "Prompt: Given this meeting, what is the single best research topic I should consider to help me prepare? , Topic must be one sentence and less than 20 words.";
    const userprompt = `

    Meeting Title: ${title}

    Description: 
    ${description || ""}

    External Attendee${participants.length === 1 ? " is" : "s are"} from 

    ${participants.join(", ")}
    `;

    const completion = await processAI(sysprompt, userprompt, 2048);
    if (
      completion != "Sorry, an error occurred while processing your request."
    ) {
      // Update research_topic field in meeting table
      await pool.query(
        "UPDATE meetings SET research_topic = $1 WHERE id = $2",
        [completion, meetingId]
      );
      res.status(200).json({
        success: true,
        research_topic: completion,
      });
    }
    res.status(500).json({
      success: false,
      message: completion,
    });
  } catch (error) {
    console.error("Error in upcomingResearch:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate research prompt",
      error: error.message,
    });
  }
};

exports.getUsersUpcomingMeetings = async (req, res) => {
  const { userEmails } = req.body;

  if (!userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide a non-empty array of user emails.",
    });
  }

  try {
    const query = `
      SELECT m.id, m.title, m.datetime, m.duration
      FROM meetings m
      JOIN meeting_participants mp ON m.id = mp.meeting_id
      JOIN users u ON mp.user_id = u.id
      WHERE u.email = ANY($1)
        AND m.datetime >= NOW()
        AND m.datetime <= NOW() + INTERVAL '14 days'
        AND m.isdeleted = false;
    `;

    const result = await pool.query(query, [userEmails]);

    res.status(200).json({
      success: true,
      meetings: result.rows,
    });
  } catch (error) {
    console.error("Error fetching upcoming meetings for users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming meetings for users",
      error: error.message,
    });
  }
};

exports.getLast10Meetings = async (req, res) => {
  let userId = req.user.id;
  const { userId: userIdParams } = req.body;

  if (userIdParams) {
    userId = userIdParams;
  }

  try {
    //Need to get meeting participants length
    //there are some participants on meeting
    //check user id is in meeting participants
    const query = `
      SELECT m.id, m.title, m.datetime, m.duration, COUNT(mp.user_id) AS participants_count
      FROM meetings m
      JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE (m.org_id = $1 OR mp.user_id = $1)
        AND m.isdeleted = false
        GROUP BY m.id, m.title, m.datetime, m.duration
        ORDER BY m.datetime DESC
        LIMIT 10;
    `;
    const result = await pool.query(query, [userId]);
    res.status(200).json({
      success: true,
      meetings: result.rows,
    });
  } catch (error) {
    console.error("Error fetching last 10 meetings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch last 10 meetings",
      error: error.message,
    });
  }
};

exports.getTimeInMeetingsPercentage = async (req, res) => {
  let userId = req.user.id;
  const { userId: userIdParam } = req.body;
  if (userIdParam) {
    userId = userIdParam;
  }

  try {
    // Get current year and calculate start of year
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1); // January 1st
    const currentDate = new Date();

    // Calculate weeks from January 1st to current date
    const msPerWeek = 7 * 24 * 60 * 60 * 1000; // milliseconds in a week
    const weeksFromStartOfYear = Math.ceil((currentDate - startOfYear) / msPerWeek);

    // Calculate total working hours (weeks * 40 hours per week)
    const totalWorkingHours = weeksFromStartOfYear * 40;

    // Get all meetings from January to current month for the user
    const query = `
      SELECT 
        COALESCE(SUM(m.duration), 0) as total_meeting_minutes
      FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE mp.user_id = $1
        AND m.isdeleted = false
        AND m.datetime >= $2
        AND m.datetime <= $3
    `;

    const result = await pool.query(query, [
      userId,
      startOfYear.toISOString(),
      currentDate.toISOString()
    ]);

    const totalMeetingMinutes = parseInt(result.rows[0].total_meeting_minutes || 0);
    const totalMeetingHours = totalMeetingMinutes / 60;

    // Calculate percentage: (total meeting hours / total working hours) * 100
    const percentage = totalWorkingHours > 0
      ? Math.round((totalMeetingHours / totalWorkingHours) * 100 * 10) / 10 // Round to 1 decimal place
      : 0;

    res.status(200).json({
      success: true,
      data: {
        percentage,
        totalMeetingHours: Math.round(totalMeetingHours * 10) / 10, // Round to 1 decimal place
        totalWorkingHours,
        weeksFromStartOfYear,
        meetingCount: await getMeetingCount(userId, startOfYear, currentDate)
      }
    });

  } catch (error) {
    console.error("Error calculating time in meetings percentage:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate time in meetings percentage",
      error: error.message,
    });
  }
};

// Helper function to get meeting count
const getMeetingCount = async (userId, startDate, endDate) => {
  try {
    const query = `
      SELECT COUNT(*) as meeting_count
      FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE mp.user_id = $1
        AND m.isdeleted = false
        AND m.datetime >= $2
        AND m.datetime <= $3
    `;

    const result = await pool.query(query, [userId, startDate.toISOString(), endDate.toISOString()]);
    return parseInt(result.rows[0].meeting_count || 0);
  } catch (error) {
    console.error("Error getting meeting count:", error);
    return 0;
  }
};


exports.getLastThreeMeetings = async (req, res) => {
  try {
    const { assigned_id } = req.body; // Assuming assigned_id is passed in the request body
    const userId = req.user.id; // Authenticated user's ID

    const query = `
    SELECT m.title AS "title", m.datetime AS "datetime", m.id AS "id"
    FROM meetings m
    WHERE m."datetime" <= CURRENT_TIMESTAMP AND m.isdeleted = FALSE -- only past meetings
      AND m."id" IN (
        SELECT mp1.meeting_id
        FROM meeting_participants mp1
        WHERE mp1.user_id = $1
          AND EXISTS (
            SELECT 1
            FROM meeting_participants mp2
            WHERE mp2.meeting_id = mp1.meeting_id
              AND mp2.user_id = $2
          )
      )
    ORDER BY m."datetime" DESC
    LIMIT 3;
    `;

    const result = await pool.query(query, [userId, assigned_id]);

    return res.status(200).json({
      success: true,
      lastMeetings: result.rows,
    });
  } catch (error) {
    console.error("Error fetching last three meetings:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching meetings.",
    });
  }
};

exports.scheduleMeeting = async (req, res) => {
  const { title, attendees, userEmail, description, assigned_id, datetime } = req.body;

  try {
    console.log('---scheduleMeeting controller called---');
    console.log(`title: ${title}, attendees: ${attendees}, userEmail: ${userEmail}, description: ${description}, datetime: ${datetime}`);

    const allParticipants = [...new Set([userEmail, ...attendees])];

    // Fetch user's default platform
    const defaultPlatform = await getPlatform(userEmail);

    console.log("---defaultPlatform---", defaultPlatform);

    // Get upcoming meetings for all participants
    const upcomingMeetingsResponse = await axios.post(
      `${process.env.API_BASE_URL}/api/meeting/get-users-upcoming-meetings`,
      { userEmails: allParticipants },
      {
        headers: {
          'x-api-key': process.env.REST_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log("---upcomingMeetings---", upcomingMeetingsResponse.data.meetings);

    if (!upcomingMeetingsResponse.data.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch upcoming meetings for participants.'
      });
    }

    const existingMeetings = upcomingMeetingsResponse.data.meetings.map((meeting) => ({
      start: DateTime.fromISO(meeting.datetime),
      end: DateTime.fromISO(meeting.datetime).plus({ minutes: meeting.duration }),
    }));

    // Helper function to get the next available time slot
    const getNextAvailableSlot = (currentTime) => {
      // Round up to the next 30-minute slot
      const minutes = currentTime.minute;
      const roundedMinutes = Math.ceil(minutes / 30) * 30;

      if (roundedMinutes >= 60) {
        return currentTime.plus({ hours: 1 }).set({ minute: 0, second: 0, millisecond: 0 });
      } else {
        return currentTime.set({ minute: roundedMinutes, second: 0, millisecond: 0 });
      }
    };

    // Helper function to get next business day (Monday-Friday)
    const getNextBusinessDay = (currentTime) => {
      let nextDay = currentTime;

      // If it's Saturday (6) or Sunday (7), move to Monday
      while (nextDay.weekday === 6 || nextDay.weekday === 7) {
        nextDay = nextDay.plus({ days: 1 });
      }

      return nextDay;
    };

    const now = DateTime.now().setZone('America/New_York');

    // Check if datetime is provided, if so use it; otherwise calculate available time
    let proposedTime;
    if (datetime) {
      // Use the provided datetime
      console.log("---Using provided datetime---", datetime);
      proposedTime = DateTime.fromISO(datetime).setZone('America/New_York');
      
      // Validate that the provided datetime is in the future
      if (proposedTime <= now) {
        return res.status(400).json({
          success: false,
          message: 'Provided datetime must be in the future.'
        });
      }
    } else {
      // Calculate available time (existing logic)
      console.log("---Calculating available time---");
      if (now.hour < 9) {
        // If before 9 AM, start from 9 AM today (if it's a business day)
        proposedTime = getNextBusinessDay(now).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
      } else if (now.hour >= 17 || now.weekday === 6 || now.weekday === 7) {
        // If after 5 PM or on weekend, start from 9 AM next business day
        proposedTime = getNextBusinessDay(now.plus({ days: 1 })).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
      } else {
        // If during business hours on a business day, start from next available slot
        proposedTime = getNextAvailableSlot(now);
      }
    }

    let scheduled = false;
    let meetingLink = '';

    // If datetime is provided, try to schedule at that specific time first
    if (datetime) {
      console.log("---Attempting to schedule at provided datetime---", proposedTime.toISO());
      
      const proposedEndTime = proposedTime.plus({ minutes: 30 });
      
      // Check for conflicts
      const isConflict = existingMeetings.some((meeting) =>
        (proposedTime >= meeting.start && proposedTime < meeting.end) ||
        (proposedEndTime > meeting.start && proposedEndTime <= meeting.end) ||
        (proposedTime <= meeting.start && proposedEndTime >= meeting.end)
      );

      if (!isConflict) {
        const payload = {
          title,
          description: description || '',
          startTime: proposedTime.toISO(),
          endTime: proposedEndTime.toISO(),
          attendees: allParticipants,
          organizerEmail: userEmail,
          timeZone: 'America/New_York',
          contentType: "HTML",
          content: description || ''
        };

        const scheduleApiMap = {
          'google': `${process.env.API_BASE_URL}/api/gmeet/create-google-calendar-meeting`,
          'zoom': `${process.env.API_BASE_URL}/api/zoom/create-zoom-meeting`,
          'teams': `${process.env.API_BASE_URL}/api/teams/schedule-teams-meeting-agent`
        };

        const apiLink = scheduleApiMap[defaultPlatform];
        console.log("--- apiLink ---", apiLink);

        try {
          const scheduleResponse = await axios.post(apiLink, JSON.stringify(payload), {
            headers: {
              'x-api-key': process.env.REST_API_KEY,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });

          console.log("--- scheduleResponse ---", scheduleResponse.data);

          if (scheduleResponse.data.success) {
            scheduled = true;
            meetingLink = defaultPlatform === 'teams'
              ? scheduleResponse.data.data.onlineMeeting.joinUrl
              : defaultPlatform === 'google'
                ? scheduleResponse.data.meeting.hangoutLink
                : scheduleResponse.data.data.join_url;
          }
        } catch (error) {
          console.log("---Failed to schedule at provided datetime, will try available slots---", error.message);
        }
      } else {
        console.log("---Conflict detected at provided datetime, will try available slots---");
      }
    }

    // If not scheduled yet (either no datetime provided, or conflict/error with provided datetime), 
    // try to schedule for the next 14 business days
    if (!scheduled) {
      console.log("---Trying to find available slots---");
      
      for (let i = 0; i < 14 * 16; i++) { // 16 slots per day (30-min slots from 9-5)
        console.log("--- proposedTime ---", i, proposedTime.toISO(), 'weekday:', proposedTime.weekday);

        // Skip weekends
        if (proposedTime.weekday === 6 || proposedTime.weekday === 7) {
          proposedTime = getNextBusinessDay(proposedTime.plus({ days: 1 })).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
          continue;
        }

        // Business hours: 9 AM to 5 PM on business days only
        while (proposedTime.hour >= 9 && proposedTime.hour < 17 && proposedTime.weekday >= 1 && proposedTime.weekday <= 5) {
          const proposedEndTime = proposedTime.plus({ minutes: 30 });

          // Ensure the proposed time is after current time
          if (proposedTime > now) {
            const isConflict = existingMeetings.some((meeting) =>
              (proposedTime >= meeting.start && proposedTime < meeting.end) ||
              (proposedEndTime > meeting.start && proposedEndTime <= meeting.end) ||
              (proposedTime <= meeting.start && proposedEndTime >= meeting.end)
            );

            if (!isConflict) {
              const payload = {
                title,
                description: description || '',
                startTime: proposedTime.toISO(),
                endTime: proposedEndTime.toISO(),
                attendees: allParticipants,
                organizerEmail: userEmail,
                timeZone: 'America/New_York',
                contentType: "HTML",
                content: description || ''
              };

              const scheduleApiMap = {
                'google': `${process.env.API_BASE_URL}/api/gmeet/create-google-calendar-meeting`,
                'zoom': `${process.env.API_BASE_URL}/api/zoom/create-zoom-meeting`,
                'teams': `${process.env.API_BASE_URL}/api/teams/schedule-teams-meeting-agent`
              };

              const apiLink = scheduleApiMap[defaultPlatform];
              console.log("--- apiLink ---", apiLink);

              const scheduleResponse = await axios.post(apiLink, JSON.stringify(payload), {
                headers: {
                  'x-api-key': process.env.REST_API_KEY,
                  'Content-Type': 'application/json'
                },
                timeout: 30000
              });

              console.log("--- scheduleResponse ---", scheduleResponse.data);

              if (scheduleResponse.data.success) {
                scheduled = true;
                meetingLink = defaultPlatform === 'teams'
                  ? scheduleResponse.data.data.onlineMeeting.joinUrl
                  : defaultPlatform === 'google'
                    ? scheduleResponse.data.meeting.hangoutLink
                    : scheduleResponse.data.data.join_url;
                break;
              }
            }
          }

          // Move to the next 30-minute slot
          proposedTime = proposedTime.plus({ minutes: 30 });
        }

        if (scheduled) break;

        // Move to the next business day, 9 AM
        proposedTime = getNextBusinessDay(proposedTime.plus({ days: 1 })).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
      }
    }

    if (scheduled) {
      return res.status(200).json({
        success: true,
        meeting: {
          title,
          description: description || '',
          attendees: allParticipants,
          dateTime: proposedTime.toISO(),
          platform: defaultPlatform,
          joinUrl: meetingLink
        },
        message: `Meeting scheduled successfully for ${proposedTime.toLocaleString()} EST`
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Failed to schedule meeting after trying all available slots.',
        meeting: {
          title,
          description: description || '',
          attendees: allParticipants,
          dateTime: null,
          platform: defaultPlatform,
          joinUrl: null
        }
      });
    }

  } catch (error) {
    console.error('Error in scheduleMeeting controller:', error);
    const errorMessage = axios.isAxiosError(error)
      ? `Error scheduling meeting: ${error.response?.data?.message || error.message}`
      : `Error scheduling meeting: ${error.message}`;

    return res.status(500).json({
      success: false,
      error: errorMessage,
      meeting: {
        title: title || '',
        description: description || '',
        attendees: attendees || [],
        dateTime: null,
        platform: null,
        joinUrl: null
      }
    });
  }
};

