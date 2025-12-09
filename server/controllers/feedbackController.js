const pool = require("../config/database");
const dotenv = require("dotenv");
const { processAI } = require("../utils/llmservice");
dotenv.config();

const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});

exports.saveFeedback = async (req, res) => {
  const { subject, details, url } = req.body;
  const userId = req.user.id;
  const attachment = req.file; // Get the uploaded file from multer

  try {
    // Insert feedback into the database with attachment info
    const query = `
            INSERT INTO feedback (
                user_id, 
                date_time, 
                subject, 
                details, 
                url, 
                attachment
            ) 
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
    const values = [
      userId,
      new Date(),
      subject,
      details,
      url,
      attachment ? attachment.filename : null,
    ];

    await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: "Feedback saved successfully",
    });
  } catch (error) {
    console.error("Error creating feedback:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create feedback",
    });
  }
};

exports.feedbackStatistic = async (req, res) => {
  const { year, quat, isYTD } = req.body;
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
    const Feedbacks = await pool.query(
      `
          SELECT *
          FROM feedback
          WHERE date_time BETWEEN $1 AND $2
        `,
      [quat_start, quat_end]
    );

    if (Feedbacks.rowCount == 0) {
      return res.json({
        success: true,
        feedbacks: [],
      });
    }

    /*
        const bedrockParams = {
            modelId: "anthropic.claude-v2",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                prompt: `\n\nHuman: Summarize the titles and descriptions of up to 50 recent items into each 50 item text. Format the response as a JSON array of objects with "text" and "value" and "id" properties. Example:
                'I think sidebar width is long' => text: 'sidebar width long', value: 1, id: 1
                id must be same with feedback_id
                
        Output format:
        {
          "words": [
            {
              "text": "performance",
              "value": 85,
              "id": 1
            },
            {
              "text": "sidebar width long",
              "value": 45,
              "id": 2
            }
          ]
        }
        
        Rules:
        - in this id is Feedback id
        - Exclude common stop words (the, a, an, in, etc.)
        - one Feedback must be one item
        - text can be configured by multiple words
        - Combine similar terms (e.g., "fast" and "quick" should be merged)
        - Value should be between 1-100 based on frequency and importance
        - Include only meaningful terms that provide insight
        
        Feedbacks to analyze: ${Feedbacks.rows.map(f => 'subject: ' + f.subject + '\n' + 'details: ' + f.details + '\n' + 'feedback_id: ' + f.id).join('\n')}\n\nAssistant: I'll analyze the feedback and synthesize user opinions into word cloud data. The words should be in the format of {text: "word", value: 1-100, id: 1}.`,
                max_tokens_to_sample: 1024,
                temperature: 0.7,
                anthropic_version: "bedrock-2023-05-31",
            }),
        };

        const command = new InvokeModelCommand(bedrockParams);
        const response = await bedrockClient.send(command);
        const completion = JSON.parse(new TextDecoder().decode(response.body));
        */
    const sysprompt = `Analyze this feedback.`;
    const userprompt = `Summarize the titles with 1~2 words and descriptions of up to 50 recent items into each 50 item text. Format the response as a JSON array of objects with "text" and "value" and "id" properties. Example:
       'I think sidebar width is long' => text: 'sidebar width long', value: 1, id: 1
       id must be same with feedback_id
       
Output format:
{
 "words": [
   {
     "text": "performance",
     "value": 85,
     "id": 1
   },
   {
     "text": "sidebar width long",
     "value": 45,
     "id": 2
   }
 ]
}

Rules:
- in this id is Feedback id
- Exclude common stop words (the, a, an, in, etc.)
- one Feedback must be one item
- text can be configured by multiple words
- Combine similar terms (e.g., "fast" and "quick" should be merged)
- Value should be between 1-100 based on frequency and importance
- Include only meaningful terms that provide insight

Feedbacks to analyze: ${Feedbacks.rows
      .map(
        (f) =>
          "subject: " +
          f.subject +
          "\n" +
          "details: " +
          f.details +
          "\n" +
          "feedback_id: " +
          f.id
      )
      .join(
        "\n"
      )}: I'll analyze the feedback and synthesize user opinions into word cloud data. The words should be in the format of {text: "word", value: 1-100, id: 1}.`;

    const completion = await processAI(sysprompt, userprompt, 1024);

    // Extract JSON content more robustly
    let performanceCloud;
    try {
      // First try to extract from code blocks if present
      const jsonMatch = completion.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        performanceCloud = JSON.parse(jsonMatch[1]).words;
      } else {
        // Otherwise try to find JSON object directly in the completion
        const jsonStart = completion.indexOf("{");
        const jsonEnd = completion.lastIndexOf("}") + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonStr = completion.slice(jsonStart, jsonEnd);
          performanceCloud = JSON.parse(jsonStr).words;
        } else {
          // If no feedback data, return empty array
          performanceCloud = [];
        }
      }

      // Ensure we have valid data structure
      if (!Array.isArray(performanceCloud)) {
        performanceCloud = [];
      }

      res.status(200).json({
        success: true,
        feedbacks: performanceCloud,
      });
    } catch (parseError) {
      console.error("Error parsing feedback data:", parseError);
      res.status(200).json({
        success: true,
        feedbacks: [],
      });
    }
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e,
    });
  }
};

exports.getFeedbackDetails = async (req, res) => {
  const { id } = req.body;
  console.log("getFeedbackDetails:", id);
  try {
    const feedbacks = await pool.query(
      `
          SELECT feedback.*, users.name as user_name, users.email as user_email, users.avatar as user_avatar
          FROM feedback
          LEFT JOIN users ON feedback.user_id = users.id
          WHERE feedback.id = $1
        `,
      [id]
    );

    if (feedbacks.rowCount == 0) {
      return res.json({
        success: true,
        feedbacks: [],
      });
    }

    res.status(200).json({
      success: true,
      feedback: feedbacks.rows[0],
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      success: false,
      error: e,
    });
  }
};

exports.updateFeedbackStatus = async (req, res) => {
  const { feedbackId, status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE feedback 
       SET status = $1
       WHERE id = $2 
       RETURNING *`,
      [status, feedbackId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    res.json({
      success: true,
      feedback: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating feedback status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getAllFeedback = async (req, res) => {

  const { page = 1, per_page = 10, filter, status, path } = req.query;
  const userId = req.user.id;
  try {
    // Get user role
    const userRoleQuery = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [userId]
    );
    const userRole = userRoleQuery.rows[0].role;

    // Build the WHERE clause
    let whereClause = "";
    const params = [];
    let paramCount = 1;

    // Add role-based filtering
    if (userRole === "dev") {
      // Developers can only see approved feedback
      whereClause += " WHERE f.status = $1";
      params.push("approved");
      paramCount++;
    } else if (userRole === "padmin") {
      // Platform admins see all feedback ordered by status priority
      whereClause += " WHERE 1=1"; // Base condition to make subsequent AND clauses easier
    }


    if (filter) {
      whereClause += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR f.subject ILIKE $${paramCount})`;
      params.push(`%${filter}%`);
      paramCount++;
    }

    if (status && status !== "all" && userRole !== "dev") {
      // Skip status filter for devs
      if (Array.isArray(status)) {
        whereClause += ` AND f.status = ANY($${paramCount})`;
        params.push(status);
      } else {
        whereClause += ` AND f.status = $${paramCount}`;
        params.push(status);
      }
      paramCount++;
    }

    if (path) {
      whereClause += ` AND f.url ILIKE $${paramCount}`;
      params.push(`%${path}%`);
      paramCount++;
    }

    // Get total count for notifications
    const countQuery = `
            SELECT
               COUNT(*) as total
            FROM feedback f
            WHERE f.status = $1

        `;
        const totalCount = await pool.query(countQuery, [status]);
        console.log('status', status);
        console.log(totalCount.rows[0].total);

    // Get paginated data with status-based ordering for padmin
    const query = `
            SELECT 
                f.*,
                u.name as user_name,
                u.email as user_email,
                u.avatar as user_avatar
            FROM feedback f
            LEFT JOIN users u ON f.user_id = u.id
            ${whereClause}
            ORDER BY
                ${
                  userRole === "padmin"
                    ? `
                    CASE f.status 
                        WHEN 'pending' THEN 1
                        WHEN 'approved' THEN 2
                        WHEN 'rejected' THEN 3
                        WHEN 'completed' THEN 4
                        ELSE 5
                    END,
                `
                    : ""
                }
                f.date_time DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;

    const offset = (page - 1) * per_page;
    const feedbacks = await pool.query(query, [...params, per_page, offset]);

    res.status(200).json({
      data: feedbacks.rows,
      total: parseInt(totalCount.rows[0].total),
      page: parseInt(page),
      per_page: parseInt(per_page),
      total_pages: Math.ceil(
        totalCount.rows[0].total / per_page
      ),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      status: false,
      error: "Failed to fetch feedback",
    });
  }
};

exports.getAllCompaniesFeedback = async (req, res) => {
  const { page = 1, per_page = 10, filter, status } = req.query;
  try {
    // Build the WHERE clause
    let whereClause = "";
    const params = [];
    let paramCount = 1;

    if (filter) {
      whereClause += ` WHERE (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR f.subject ILIKE $${paramCount} OR c.name ILIKE $${paramCount})`;
      params.push(`%${filter}%`);
      paramCount++;
    }

    if (status && status !== "all") {
      whereClause += whereClause ? " AND" : " WHERE";
      whereClause += ` f.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    // Get total count
    const countQuery = `
            SELECT COUNT(*) 
            FROM feedback f
            LEFT JOIN users u ON f.user_id = u.id
            LEFT JOIN company c ON u.company_id = c.id
            ${whereClause}
        `;
    const totalCount = await pool.query(countQuery, params);

    // Get paginated data
    const query = `
            SELECT 
                f.*,
                u.name as user_name,
                u.email as user_email,
                u.avatar as user_avatar,
                c.name as company_name
            FROM feedback f
            LEFT JOIN users u ON f.user_id = u.id
            LEFT JOIN company c ON u.company_id = c.id
            ${whereClause}
            ORDER BY f.date_time DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;

    const offset = (page - 1) * per_page;
    const feedbacks = await pool.query(query, [...params, per_page, offset]);

    res.status(200).json({
      data: feedbacks.rows,
      total: parseInt(totalCount.rows[0].count),
      page: parseInt(page),
      per_page: parseInt(per_page),
      total_pages: Math.ceil(parseInt(totalCount.rows[0].count) / per_page),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      status: false,
      error: "Failed to fetch feedback",
    });
  }
};

exports.getFeedbackStats = async (req, res) => {
  const { path } = req.query;
  try {
    // Query to get feedback stats
    const statsQuery = `
            SELECT 
                status,
                COUNT(*) as count
            FROM feedback
            WHERE url ILIKE $1
            GROUP BY status
        `;
    const result = await pool.query(statsQuery, [path ? `%${path}%` : "%%"]);

    // Initialize stats object with all possible statuses
    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      prReady:0
    };
    const statusMap = {
      'pending': 'pending',
      'approved': 'approved',
      'rejected': 'rejected',
      'completed': 'completed',
      'pr ready': 'prReady'
    };

    // Update counts from query results
    result.rows.forEach((row) => {
      const key = statusMap[row.status?.toLowerCase()];
      if (key) {
        stats[key] = parseInt(row.count);
      }
    });
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error getting feedback stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get feedback statistics",
    });
  }
};

// Add middleware to check user role
exports.checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        error: "Unauthorized access",
      });
    }
    next();
  };
};

// Get Feedback Details By Id
exports.getFeedbackDetailsById = async (req, res)=>{
    try {
        const { feedbackId } = req.params;
        const feedbacks = await pool.query(`
            SELECT feedback.*, users.name as user_name, users.email as user_email, users.avatar as user_avatar
            FROM feedback
            LEFT JOIN users ON feedback.user_id = users.id
            WHERE feedback.id = $1
          `, [feedbackId]);
  
          if (feedbacks.rowCount == 0) {
              return res.json({
                  status: true,
                  feedbacks: [],
              });
          }
  
          res.status(200).json({
              status: true,
              feedback: feedbacks.rows[0],
          });
    }
    catch (error) {
        return res.status(500).json({
            status: false,
            error: e,
            feedbacks: []
        })
    }
}

// Add: Update feedback details (subject, details, url)
exports.updateFeedback = async (req, res) => {
  const { feedbackId } = req.params;
  const { subject, details, url } = req.body;

  try {
    const result = await pool.query(
      `UPDATE feedback
       SET subject = COALESCE($1, subject),
           details = COALESCE($2, details),
           url = COALESCE($3, url)
       WHERE id = $4
       RETURNING *`,
      [subject ?? null, details ?? null, url ?? null, feedbackId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    return res.status(200).json({
      success: true,
      feedback: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating feedback:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update feedback",
    });
  }
};
