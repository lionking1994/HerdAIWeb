const pool = require("../config/database");
const { sendEmail } = require("../utils/email");
const dotenv = require("dotenv");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
dotenv.config();

exports.get = async (req, res) => {
  const { userId } = req.body;
  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const query = `
    SELECT u.*, cr.name as company_role_name 
        FROM users u
        LEFT JOIN company_roles cr ON cr.id = u.company_role
        WHERE u.id = $1`;
    const result = await pool.query(query, [userId]);
    return res.status(200).json({
      success: true,
      user: result.rows[0],
    });
  } catch (e) {
    console.log("Failed to get user data");
    return {
      success: false,
      error: "Failed to get user data",
    };
  }
};

exports.search = async (req, res) => {
  const { email, limit, cur_emails, searchGlobal, meetingId, isAddingUser } =
    req.body;

  try {
    // Validate inputs
    if (!email || !limit) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Prepare the query parameters
    const emailFilter = `%${email}%`;
    console.log(cur_emails);
    const curEmailsFilter = cur_emails
      ? cur_emails.map((user) => user.email).join(", ")
      : "";
    // Determine the query based on searchGlobal
    let query;
    let result;
    console.log(
      "isAddingUser:",
      isAddingUser,
      emailFilter,
      "curEmailsFilter",
      curEmailsFilter
    );
    if (isAddingUser) {
      query = `
            SELECT * FROM users 
            WHERE (email ILIKE $1 OR name ILIKE $2) AND email NOT IN ('${curEmailsFilter}') AND status = 'enabled' LIMIT 10`;
      console.log(
        `1 OR name ILIKE $2) AND email NOT IN (${curEmailsFilter}) AND stat`
      );
      result = await pool.query(query, [emailFilter, emailFilter]);
    } else {
      if (searchGlobal) {
        console.log(curEmailsFilter);
        query = `
                SELECT * FROM users 
                WHERE (email ILIKE $1 OR name ILIKE $2) LIMIT 10`;

        console.log("searchGlobal_query: ", query);
        result = await pool.query(query, [emailFilter, emailFilter]);
      } else {
        query = `
                SELECT u.* FROM users u
                JOIN meeting_participants mp ON u.id = mp.user_id
                WHERE mp.meeting_id = $3 
                AND (u.email ILIKE $1 OR u.name ILIKE $2)
                LIMIT 10`;
        result = await pool.query(query, [emailFilter, emailFilter, meetingId]);
      }
    }
    // Save task to database

    res.status(201).json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create task",
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

exports.statisticUser = async (req, res) => {
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
    let Users;
    if (company) {
      Users = await pool.query(
        `
          WITH company_info AS (
            SELECT domain 
            FROM company 
            WHERE id = $3
          ),
          company_users AS (
            SELECT u.*
            FROM users u
            CROSS JOIN company_info ci
            WHERE SPLIT_PART(u.email, '@', 2) = ci.domain
          )
          SELECT
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as user_count
          FROM company_users
          WHERE created_at BETWEEN $1 AND $2
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month ASC
        `,
        [quat_start, quat_end, company]
      );
    } else {
      Users = await pool.query(
        `
          SELECT
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as user_count
          FROM users
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

      Users.rows.forEach((row) => {
        const monthIndex = new Date(row.month).getMonth(); // Get month index (0-11)
        monthCounts[monthIndex] = parseInt(row.user_count);
      });
    } else {
      // For quarterly view
      labels = [
        months[quat * 3 - 3], // First month of quarter (e.g., 'Jan')
        months[quat * 3 - 2], // Second month of quarter (e.g., 'Feb')
        months[quat * 3 - 1], // Third month of quarter (e.g., 'Mar')
      ];
      monthCounts = Array(3).fill(0); // Initialize array for 3 months

      Users.rows.forEach((row) => {
        const monthIndex = new Date(row.month).getMonth() % 3; // Get index (0-2) within quarter
        monthCounts[monthIndex] = parseInt(row.user_count);
      });
    }

    const usersData = {
      labels: labels,
      datasets: [
        {
          label: "Number of Users",
          data: monthCounts, // Array of user counts for each month
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          fill: true, // Fill the area under the line
          tension: 0.4, // Smoothness of the line
        },
      ],
    };

    res.status(200).json({
      status: true,
      users: usersData,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      status: false,
      error: e,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  const {
    page,
    per_page,
    filter,
    status,
    company,
    subscription_status,
    sort_by,
    sort_order,
  } = req.body;

  // Add validation for subscription_status
  if (
    subscription_status &&
    !["active", "canceled", "all"].includes(subscription_status)
  ) {
    return res.status(400).json({
      success: false,
      error: "Invalid subscription status",
    });
  }

  // Validate sorting parameters
  const allowedSortFields = [
    "name",
    "email",
    "role",
    "status",
    "company_role_name",
  ];
  const validSortBy =
    sort_by && allowedSortFields.includes(sort_by) ? sort_by : "name";
  const validSortOrder =
    sort_order && ["asc", "desc"].includes(sort_order.toLowerCase())
      ? sort_order.toUpperCase()
      : "ASC";

  // Map frontend field names to database field names
  const fieldMapping = {
    name: "u.name",
    email: "u.email",
    role: "u.role",
    status: "u.status",
    company_role_name: "cr.name",
  };

  const sortField = fieldMapping[validSortBy] || "u.name";

  try {
    // First get total count with same filters
    let countQuery, countParams;

    if (company) {
      countQuery = `
                WITH company_info AS (
                    SELECT domain FROM company WHERE id = $3
                )
                SELECT COUNT(*) as total 
                FROM users u
                CROSS JOIN company_info ci
                WHERE (u.name ILIKE $1 OR u.email ILIKE $1) 
                    AND u.status = $2
                    AND SPLIT_PART(u.email, '@', 2) = ci.domain
                    AND ($4 = 'all' OR $4 = (
                        CASE
                            WHEN EXISTS (SELECT 1 FROM payment_subscriptions ps WHERE ps.user_id = u.id) 
                            THEN 'active'
                            ELSE 'canceled'
                        END
                    ))`;
      countParams = [
        `%${filter}%`,
        status || "enabled",
        company,
        subscription_status || "all",
      ];
    } else {
      countQuery = `
                SELECT COUNT(*) as total 
                FROM users u 
                WHERE (u.name ILIKE $1 OR u.email ILIKE $1) 
                    AND u.status = $2
                    AND ($3 = 'all' OR $3 = (
                        CASE
                            WHEN EXISTS (SELECT 1 FROM payment_subscriptions ps WHERE ps.user_id = u.id) 
                            THEN 'active'
                            ELSE 'canceled'
                        END
                    ))`;
      countParams = [
        `%${filter}%`,
        status || "enabled",
        subscription_status || "all",
      ];
    }

    const totalResult = await pool.query(countQuery, countParams);
    const total = parseInt(totalResult.rows[0].total);

    // Calculate offset
    const offset = (page - 1) * per_page;

    // Get paginated users with sorting
    if (company) {
      const query = `
                WITH company_info AS (
                    SELECT domain
                    FROM company
                    WHERE id = $5
                )
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.role,
                    u.avatar,
                    u.phone,
                    u.location,
                    u.bio,
                    u.status,
                    CASE
                        WHEN EXISTS (
                            SELECT 1 FROM payment_subscriptions ps
                            WHERE ps.user_id = u.id
                        ) THEN 'active'
                        ELSE 'canceled'
                    END AS subscription_status,
                    cr.name AS company_role_name,
                    cr.id AS company_role_id
                FROM users u
                CROSS JOIN company_info ci
                LEFT JOIN company_roles cr ON u.company_role = cr.id
                WHERE (u.name ILIKE $3 OR u.email ILIKE $3)
                    AND u.status = $4
                    AND SPLIT_PART(u.email, '@', 2) = ci.domain
                    AND ($6 = 'all' OR $6 = (
                        CASE
                            WHEN EXISTS (
                                SELECT 1 FROM payment_subscriptions ps
                                WHERE ps.user_id = u.id
                            ) THEN 'active'
                            ELSE 'canceled'
                        END
                    ))
                ORDER BY ${sortField} ${validSortOrder}
                LIMIT $1 OFFSET $2`;

      const result = await pool.query(query, [
        per_page,
        offset,
        `%${filter}%`,
        status || "enabled",
        company,
        subscription_status || "all",
      ]);

      return res.status(200).json({
        success: true,
        users: result.rows,
        total: total,
        page: page,
        per_page: per_page,
        total_pages: Math.ceil(total / per_page),
      });
    } else {
      const query = `
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.role,
                    u.avatar,
                    u.phone,
                    u.location,
                    u.bio,
                    u.status,
                    CASE
                        WHEN EXISTS (
                            SELECT 1 FROM payment_subscriptions ps
                            WHERE ps.user_id = u.id
                        ) THEN 'active'
                        ELSE 'canceled'
                    END AS subscription_status
                FROM users u
                WHERE (u.name ILIKE $3 OR u.email ILIKE $3)
                    AND u.status = $4
                    AND ($5 = 'all' OR $5 = (
                        CASE
                            WHEN EXISTS (
                                SELECT 1 FROM payment_subscriptions ps
                                WHERE ps.user_id = u.id
                            ) THEN 'active'
                            ELSE 'canceled'
                        END
                    ))
                ORDER BY ${sortField} ${validSortOrder}
                LIMIT $1 OFFSET $2`;

      const result = await pool.query(query, [
        per_page,
        offset,
        `%${filter}%`,
        status || "enabled",
        subscription_status || "all",
      ]);

      return res.status(200).json({
        success: true,
        users: result.rows,
        total: total,
        page: page,
        per_page: per_page,
        total_pages: Math.ceil(total / per_page),
      });
    }
  } catch (e) {
    console.error("Failed to get users:", e);
    return res.status(500).json({
      success: false,
      error: "Failed to get users",
    });
  }
};

const domain_extract = (email) => {
  if (!email || typeof email !== "string") {
    return null;
  }

  try {
    // Split the email at '@' and get the domain part
    const [, domain] = email.split("@");

    // Return null if no domain was found
    if (!domain) {
      return null;
    }

    // Return the domain in lowercase to ensure consistency
    return domain?.toLowerCase();
  } catch (error) {
    console.error("Error extracting domain from email:", error);
    return null;
  }
};

exports.updateUserRole = async (req, res) => {
  const { userId, role } = req.body;

  // Validate role
  const validRoles = ["user", "cadmin", "padmin", "dev"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      error: "Invalid role specified",
    });
  }

  try {
    const query = `
            UPDATE users 
            SET role = $1
            WHERE id = $2
            RETURNING id, name, email, role`;
    const result = await pool.query(query, [role, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    const extracted_domain = domain_extract(result.rows[0].email);

    // Handle company admin role changes
    if (role == "user") {
      const query_company_get = `
                DELETE FROM company 
                WHERE admin_id = $1
            `;
      const result_company_get = await pool.query(query_company_get, [userId]);
    }

    // Only cadmin role should manage company relationships
    if (role == "cadmin") {
      const query_company_get = `
                SELECT * FROM company 
                WHERE domain = $1
            `;
      const result_company_get = await pool.query(query_company_get, [
        extracted_domain,
      ]);
      if (result_company_get.rowCount) {
        const query_update_admin_role = `
                    UPDATE users 
                    SET role = 'user'
                    WHERE id = $1
                `;
        await pool.query(query_update_admin_role, [
          result_company_get.rows[0].admin_id,
        ]);

        const query_company_update = `
                    UPDATE company 
                    SET admin_id = $1
                    WHERE id = $2
                `;
        await pool.query(query_company_update, [
          userId,
          result_company_get.rows[0].id,
        ]);
      } else {
        const query_company_insert = `
                    INSERT INTO company (name, domain, admin_id, created_at, updated_at)
                    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id, name, domain, admin_id
                `;
        await pool.query(query_company_insert, [
          extracted_domain.split(".")[0], // Use first part of domain as company name
          extracted_domain,
          userId,
        ]);
      }
    }

    return res.status(200).json({
      success: true,
      user: result.rows[0],
    });
  } catch (e) {
    console.error("Failed to update user role:", e);
    return res.status(500).json({
      success: false,
      error: "Failed to update user role",
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  const { userId, status } = req.body;

  // Validate status
  const validStatuses = ["disabled", "enabled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: "Invalid status specified",
    });
  }

  try {
    const query = `
            UPDATE users 
            SET status = $1
            WHERE id = $2
            RETURNING id, name, email, status`; // Adjust the RETURNING clause as needed
    const result = await pool.query(query, [status, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    //send email to user if status is enabled similar style with create user with approval
    if (result.rows[0].status == "enabled") {
      const userName = result.rows[0].name;
      const userEmail = result.rows[0].email;
      
      // Send fashionable approval email
      await sendEmail({
        to: userEmail,
        subject: '🎉 Welcome to HerdAI - Your Account is Approved!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Approved - Welcome to HerdAI</title>
            <style>
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 0; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 20px; 
                overflow: hidden; 
                box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
                margin-top: 40px; 
                margin-bottom: 40px;
              }
              .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 40px 30px; 
                text-align: center; 
                position: relative;
              }
              .header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.1"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
              }
              .header h1 { 
                margin: 0; 
                font-size: 32px; 
                font-weight: 700; 
                position: relative; 
                z-index: 1;
              }
              .header p { 
                margin: 10px 0 0 0; 
                opacity: 0.9; 
                font-size: 18px; 
                position: relative; 
                z-index: 1;
              }
              .content { 
                padding: 40px 30px; 
                background: white;
              }
              .welcome-section {
                text-align: center;
                margin-bottom: 30px;
              }
              .welcome-section h2 {
                color: #667eea;
                font-size: 24px;
                margin-bottom: 15px;
              }
              .approval-badge {
                display: inline-block;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                padding: 12px 24px;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                margin: 20px 0;
                box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
              }
              .features-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin: 30px 0;
              }
              .feature-card {
                background: #f8fafc;
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                border: 1px solid #e2e8f0;
                transition: transform 0.2s ease;
              }
              .feature-card:hover {
                transform: translateY(-2px);
              }
              .feature-icon {
                font-size: 24px;
                margin-bottom: 10px;
              }
              .feature-title {
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 8px;
              }
              .feature-desc {
                font-size: 14px;
                color: #64748b;
              }
              .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 32px;
                text-decoration: none;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                margin: 30px 0;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
              }
              .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
              }
              .footer {
                background: #f8fafc;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
              }
              .footer p {
                margin: 5px 0;
                color: #64748b;
                font-size: 14px;
              }
              .social-links {
                margin: 20px 0;
              }
              .social-links a {
                display: inline-block;
                margin: 0 10px;
                color: #667eea;
                text-decoration: none;
                font-weight: 500;
              }
              @media (max-width: 600px) {
                .features-grid {
                  grid-template-columns: 1fr;
                }
                .header h1 {
                  font-size: 24px;
                }
                .content {
                  padding: 30px 20px;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Welcome to HerdAI!</h1>
                <p>Your account has been approved and is ready to use</p>
              </div>
              
              <div class="content">
                <div class="welcome-section">
                  <h2>Hello ${userName}!</h2>
                  <div class="approval-badge">✅ Account Approved</div>
                  <p style="color: #64748b; font-size: 16px; margin: 20px 0;">
                    Great news! Your HerdAI account has been successfully approved. You can now access all the powerful features and start collaborating with your team.
                  </p>
                </div>

                <div class="features-grid">
                  <div class="feature-card">
                    <div class="feature-icon">🤖</div>
                    <div class="feature-title">AI-Powered Meetings</div>
                    <div class="feature-desc">Smart meeting summaries and action items</div>
                  </div>
                  <div class="feature-card">
                    <div class="feature-icon">📊</div>
                    <div class="feature-title">Analytics Dashboard</div>
                    <div class="feature-desc">Track productivity and insights</div>
                  </div>
                  <div class="feature-card">
                    <div class="feature-icon">👥</div>
                    <div class="feature-title">Team Collaboration</div>
                    <div class="feature-desc">Seamless team communication</div>
                  </div>
                  <div class="feature-card">
                    <div class="feature-icon">⚡</div>
                    <div class="feature-title">Real-time Updates</div>
                    <div class="feature-desc">Instant notifications and sync</div>
                  </div>
                </div>

                <div style="text-align: center;">
                  <a href="${process.env.FRONTEND_URL}" class="cta-button">
                    🚀 Get Started Now
                  </a>
                </div>

                <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin: 30px 0;">
                  <h3 style="color: #1e293b; margin-top: 0;">What's Next?</h3>
                  <ul style="color: #64748b; line-height: 1.8;">
                    <li>Complete your profile setup</li>
                    <li>Connect your calendar and meeting platforms</li>
                    <li>Invite team members to collaborate</li>
                    <li>Explore our AI-powered features</li>
                  </ul>
                </div>
              </div>

              <div class="footer">
                <p><strong>Welcome to the HerdAI family!</strong></p>
                <p>We're excited to see what you'll accomplish with our platform.</p>
                <div class="social-links">
                  <a href="#">Help Center</a> • 
                  <a href="#">Documentation</a> • 
                  <a href="#">Support</a>
                </div>
                <p style="font-size: 12px; margin-top: 20px;">
                  This email was sent to ${userEmail}. If you have any questions, please contact our support team.
                </p>
              </div>
            </div>
          </body>
          </html>
        `
      });
    }

    return res.status(200).json({
      success: true,
      user: result.rows[0],
    });
  } catch (e) {
    console.error("Failed to update user status:", e);
    return res.status(500).json({
      success: false,
      error: "Failed to update user status",
    });
  }
};

exports.searchAgent = async (req, res) => {
  const { term, curEmails } = req.body;
  const emailFilter = `%${term}%`;
  const curEmailsFilter = curEmails.map((email) => `'${email}'`).join(",");
  try {
    const query = `
            SELECT * FROM users 
            WHERE (email ILIKE $1 OR name ILIKE $1) 
            ${curEmailsFilter ? `AND email NOT IN (${curEmailsFilter})` : ""}
            AND status = 'enabled' 
            LIMIT 10`;
    const result = await pool.query(query, [emailFilter]);

    res.status(200).json({
      success: true,
      users: result.rows,
    });
  } catch (e) {
    console.error("Failed to search users:", e);
    return res.status(500).json({
      success: false,
      error: "Failed to search users",
    });
  }
};

exports.updateCompanyUserRole = async (req, res) => {
  try {
    const { user_id, company_role } = req.body;

    // Validate input
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: user_id and/or company_role",
      });
    }

    // Update query
    const result = await pool.query(
      "UPDATE users SET company_role = $1 WHERE id = $2 RETURNING *",
      [company_role ? company_role : null, user_id]
    );

    // Check if the user was found and updated
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found or no changes made",
      });
    }
    if (company_role) {
      const result2 = await pool.query(
        "SELECT name FROM company_roles WHERE id = $1",
        [company_role]
      );
      return res.json({
        success: true,
        message: "Updated successfully",
        company_role_name: result2.rows[0].name, // Return the updated user
      });
    } else {
      return res.json({
        success: true,
        message: "Updated successfully",
        company_role_name: null, // Return the updated user
      });
    }
    return res.json({
      success: true,
      message: "Updated successfully",
      company_role_name: result2.rowCount ? result2.rows[0].name : null, // Return the updated user
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating the user role",
    });
  }
};
// Default weights
// const DEFAULT_WEIGHTS = {
//   meeting_weight: 0.2,
//   research_review_weight: 0.3,
//   task_weight: 0.35,
//   rating_given_weight: 0.15,
//   top_meeting_count: 10,
//   research_review_top_count: 5,
//   task_top_count: 8,
//   rating_given_top_count: 5,
// };

const DEFAULT_WEIGHTS = {
  meeting_weight: 0.25,
  research_review_weight: 0.25,
  task_weight: 0.25,
  rating_given_weight: 0.25,
  top_meeting_count: 5,
  research_review_top_count: 5,
  task_top_count: 5,
  rating_given_top_count: 5,
  name: 'default',
};

exports.getProductivityScore = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRow = (
      await pool.query("SELECT email FROM users WHERE id = $1", [userId])
    ).rows[0];
    if (!userRow) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const userEmail = userRow.email;
    const clientTimeRaw = req.body?.time; // Get client time from request

    // Get user's company role
    const userRole = await pool.query(
      "SELECT company_role FROM users WHERE id = $1",
      [userId]
    );
    let roleWeights = null;
    if (userRole.rowCount) {
      const companyRoleId = userRole.rows[0].company_role;
      // Get role weights
      roleWeights = await pool.query(
        "SELECT name, meeting_weight, research_review_weight, task_weight, rating_given_weight, top_meeting_count, research_review_top_count, task_top_count, rating_given_top_count FROM company_roles WHERE id = $1",
        [companyRoleId]
      );
      if (!roleWeights.rowCount) {
        return res.status(404).json({
          success: false,
          no_company_role: true,
          message: "Company role not found",
        });
      }
    } else {
      return res.status(404).json({
        success: false,
        no_company_role: true,
        message: "Company role not found",
      });
    }
    const weights =
      roleWeights && roleWeights.rows[0]
        ? roleWeights.rows[0]
        : DEFAULT_WEIGHTS;

    // Use default if any weight is null/undefined
    const meeting_weight =
      weights.meeting_weight ?? DEFAULT_WEIGHTS.meeting_weight;
    const research_review_weight =
      weights.research_review_weight ?? DEFAULT_WEIGHTS.research_review_weight;
    const task_weight = weights.task_weight ?? DEFAULT_WEIGHTS.task_weight;
    const rating_given_weight =
      weights.rating_given_weight ?? DEFAULT_WEIGHTS.rating_given_weight;
    const top_meeting_count =
      weights.top_meeting_count ?? DEFAULT_WEIGHTS.top_meeting_count;
    const research_review_top_count =
      weights.research_review_top_count ??
      DEFAULT_WEIGHTS.research_review_top_count;
    const task_top_count =
      weights.task_top_count ?? DEFAULT_WEIGHTS.task_top_count;
    const rating_given_top_count =
      weights.rating_given_top_count ?? DEFAULT_WEIGHTS.rating_given_top_count;

    // Use client time (number ms or ISO string) or now; guard invalid
    let currentTime = new Date();
    if (clientTimeRaw != null) {
      const ms = typeof clientTimeRaw === 'number' ? clientTimeRaw : Date.parse(String(clientTimeRaw));
      if (!Number.isNaN(ms)) currentTime = new Date(ms);
    }
    if (isNaN(currentTime.getTime())) currentTime = new Date();

    // Create start of day and end of day in UTC based on client time
    const startOfDay = new Date(currentTime);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(currentTime);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Get meeting count - use range query instead of complex offset calculation
    const meetingCountResult = await pool.query(
      `SELECT m.id
                FROM meetings m
                INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
                INNER JOIN users u ON mp.user_id = u.id
                WHERE mp.user_id = $1
                    AND m.isdeleted = false
                    AND m.datetime >= $2
                    AND m.datetime <= $3
                GROUP BY m.id
            `,
      [userId, startOfDay.toISOString(), endOfDay.toISOString()]
    );

    console.log("---------- meetingCountResult log begin ----------");
    console.log(meetingCountResult.rows);
    console.log("---------- meetingCountResult log end----------");

    const meetingCount = parseInt(
      Math.min(meetingCountResult.rowCount, top_meeting_count) || 0
    );

    // Get research review count - use range query
    const researchCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM research_requests 
            WHERE user_email = $1 
            AND created_at >= $2
            AND created_at <= $3`,
      [userEmail, startOfDay.toISOString(), endOfDay.toISOString()]
    );
    const researchCount = parseInt(
      Math.min(researchCountResult.rows[0]?.count, research_review_top_count) ||
        0
    );

    // Get completed task count - use range query
    const taskCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM tasks 
            WHERE assigned_id = $1 
            AND (status = 'Completed' OR status = 'Rated') 
            AND completed_at >= $2
            AND completed_at <= $3`,
      [userId, startOfDay.toISOString(), endOfDay.toISOString()]
    );
    const taskCount = parseInt(
      Math.min(taskCountResult.rows[0]?.count, task_top_count) || 0
    );

    // Get ratings given count - use range query
    const ratingCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM tasks
            WHERE assigned_id = $1 
            AND status = 'Rated' 
            AND rated_at >= $2
            AND rated_at <= $3`,
      [userId, startOfDay.toISOString(), endOfDay.toISOString()]
    );
    const ratingCount = parseInt(
      Math.min(ratingCountResult.rows[0]?.count, rating_given_top_count) || 0
    );

    // Calculate normalized scores (guard against zero denominators)
    const safeDiv = (n, d) => (d ? n / d : 0);
    const meetingScore = safeDiv(meetingCount, top_meeting_count);
    const researchScore = safeDiv(researchCount, research_review_top_count);
    const taskScore = safeDiv(taskCount, task_top_count);
    const ratingScore = safeDiv(ratingCount, rating_given_top_count);

    const unitWeight =
      1 /
      (meeting_weight +
        research_review_weight +
        task_weight +
        rating_given_weight);

    // Calculate weighted productivity score
    const productivityScore =
      meetingScore * meeting_weight * unitWeight +
      researchScore * research_review_weight * unitWeight +
      taskScore * task_weight * unitWeight +
      ratingScore * rating_given_weight * unitWeight;

    // Return the result
    return res.status(200).json({
      success: true,
      productivityScore,
      components: {
        meetings: {
          count: meetingCount,
          maxExpected: top_meeting_count,
          normalizedScore: meetingScore,
          weight: meeting_weight * unitWeight,
        },
        research: {
          count: researchCount,
          maxExpected: research_review_top_count,
          normalizedScore: researchScore,
          weight: research_review_weight * unitWeight,
        },
        tasks: {
          count: taskCount,
          maxExpected: task_top_count,
          normalizedScore: taskScore,
          weight: task_weight * unitWeight,
        },
        ratings: {
          count: ratingCount,
          maxExpected: rating_given_top_count,
          normalizedScore: ratingScore,
          weight: rating_given_weight * unitWeight,
        },
      },
      role: weights.name,
    });
  } catch (error) {
    console.error("Error calculating productivity score:", error);
    return res.status(500).json({
      success: false,
      message: "Server error calculating productivity score",
    });
  }
};


exports.updateLinkedinUrl = async (req, res) => {
  try {
    const { linkedInUrl } = req.body;

    // Step 1: Initiate LinkedIn data scraping/query
    const data = JSON.stringify([{ url: linkedInUrl }]);
    const queryResponse = await axios.post(
      "https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_l1viktl72bvl7bjuj0&include_errors=true",
      data,
      {
        headers: {
          Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const jobId = queryResponse.data.snapshot_id || queryResponse.data.id;
    console.log("LinkedIn scraping job initiated:", jobId);

    // Step 2: Monitor progress until ready
    const monitorProgress = async (
      jobId,
      maxAttempts = 30,
      interval = 5000
    ) => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(
            `Monitoring attempt ${attempt}/${maxAttempts} for job ${jobId}`
          );

          const progressResponse = await axios.get(
            `https://api.brightdata.com/datasets/v3/progress/${jobId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
              },
            }
          );

          const status = progressResponse.data.status;
          console.log(`Job ${jobId} status: ${status}`);

          // Check if job is complete
          if (status === "ready" || status === "completed") {
            console.log("LinkedIn data scraping completed successfully");

            // Fetch the scraped data
            const dataResponse = await axios.get(
              `https://api.brightdata.com/datasets/v3/snapshot/${jobId}`,
              {
                headers: {
                  Authorization:
                    `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
                },
              }
            );

            return {
              success: true,
              data: dataResponse.data,
              message: "LinkedIn data scraped successfully",
              status: "completed",
            };
          }

          // Check for failed status
          if (status === "failed" || status === "error") {
            throw new Error(`LinkedIn scraping failed with status: ${status}`);
          }

          // Wait before next attempt (only if not the last attempt)
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, interval));
          }
        } catch (error) {
          console.error(
            `Error monitoring job ${jobId}, attempt ${attempt}:`,
            error.message
          );

          // If it's the last attempt, throw the error
          if (attempt === maxAttempts) {
            throw error;
          }

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }

      // If we reach here, monitoring timed out
      throw new Error("LinkedIn data scraping timed out");
    };

    // Monitor and wait for completion
    const result = await monitorProgress(jobId);

    // Update user profile with LinkedIn data
    const userId = req.user?.id; // Assuming user ID is available in req.user
    let updateResult = null;
    if (userId && result.data) {
      // Use the first item from the scraped data array
      const linkedinData = result.data;
      updateResult = await updateUserProfileFromLinkedinData(
        linkedinData,
        userId
      );
    }

    // Return response with scraped data and update status
    res.status(200).json({
      success: true,
      message: "LinkedIn data retrieved successfully",
      jobId: jobId,
      data: result.data,
      status: result.status,
      profileUpdate: updateResult,
    });
  } catch (error) {
    console.error("Error processing LinkedIn URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process LinkedIn URL",
      error: error.message,
    });
  }
};

// Helper function to download and save avatar image
const downloadAndSaveAvatar = async (avatarUrl, userId) => {
  try {
    if (!avatarUrl || !avatarUrl.trim()) {
      return null;
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, "../public/avatars");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate filename based on user ID and timestamp
    const timestamp = Date.now();
    const fileExtension = path.extname(new URL(avatarUrl).pathname) || ".jpg";
    const fileName = `avatar_${userId}_${timestamp}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);
    const relativePath = `uploads/avatars/${fileName}`;

    // Download the image
    const response = await axios({
      method: "GET",
      url: avatarUrl,
      responseType: "stream",
      timeout: 30000, // 30 seconds timeout
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    // Save the image to local file
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`Avatar downloaded successfully: ${fileName}`);
        resolve(fileName);
      });
      writer.on("error", (error) => {
        console.error("Error saving avatar:", error);
        // Clean up partial file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
    });
  } catch (error) {
    console.error("Error downloading avatar:", error.message);
    return null; // Return null instead of throwing to allow other updates to proceed
  }
};

const updateUserProfileFromLinkedinData = async (linkedinData, userId) => {
  if (!linkedinData || !userId) {
    return { success: false, message: "Missing required data or user ID" };
  }
  console.log("-------- 1 ---------");
  try {
    const updates = [];
    const values = [];
    let valueIndex = 1;

    updates.push(`linkedin_url = $${valueIndex++}`);
    values.push(linkedinData.url);

    updates.push(`linkedin_last_updated = $${valueIndex++}`);
    values.push(new Date().toISOString());

    // Update name if available
    if (linkedinData.name && linkedinData.name.trim()) {
      updates.push(`name = $${valueIndex++}`);
      values.push(linkedinData.name.trim());
    }

    // Update avatar/profile image if available - download and save locally
    if (linkedinData.avatar && linkedinData.avatar.trim()) {
      const localAvatarPath = await downloadAndSaveAvatar(
        linkedinData.avatar.trim(),
        userId
      );
      if (localAvatarPath) {
        updates.push(`avatar = $${valueIndex++}`);
        values.push(localAvatarPath);
      }
    }

    // Update location if available
    if (linkedinData.city || linkedinData.location) {
      const location = linkedinData.city || linkedinData.location;
      if (location && location.trim()) {
        updates.push(`location = $${valueIndex++}`);
        values.push(location.trim());
      }
    }

    // // Add education data as JSONB if available
    // if (linkedinData.education && Array.isArray(linkedinData.education) && linkedinData.education.length > 0) {
    //     updates.push(`education = $${valueIndex++}`);
    //     values.push(JSON.stringify(linkedinData.education));
    // }

    // Add certifications as JSONB if available
    if (
      linkedinData.certifications &&
      Array.isArray(linkedinData.certifications) &&
      linkedinData.certifications.length > 0
    ) {
      updates.push(`certifications = $${valueIndex++}`);
      values.push(JSON.stringify(linkedinData.certifications));
    }

    // Add skills as JSONB if available
    if (
      linkedinData.skills &&
      Array.isArray(linkedinData.skills) &&
      linkedinData.skills.length > 0
    ) {
      updates.push(`skills = $${valueIndex++}`);
      values.push(JSON.stringify(linkedinData.skills));
    }

    // Add projects as JSONB if available
    if (
      linkedinData.projects &&
      Array.isArray(linkedinData.projects) &&
      linkedinData.projects.length > 0
    ) {
      updates.push(`projects = $${valueIndex++}`);
      values.push(JSON.stringify(linkedinData.projects));
    }

    // Add recommendations as JSONB if available
    if (
      linkedinData.recommendations &&
      Array.isArray(linkedinData.recommendations) &&
      linkedinData.recommendations.length > 0
    ) {
      updates.push(`recommendations = $${valueIndex++}`);
      values.push(JSON.stringify(linkedinData.recommendations));
    }

    // Add publications as JSONB if available
    if (
      linkedinData.publications &&
      Array.isArray(linkedinData.publications) &&
      linkedinData.publications.length > 0
    ) {
      updates.push(`publications = $${valueIndex++}`);
      values.push(JSON.stringify(linkedinData.publications));
    }

    // Add updated timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // If no updates to make, return early
    if (updates.length <= 1) {
      // Only timestamp update
      return { success: false, message: "No relevant data to update" };
    }

    // Add user ID as the last parameter
    values.push(userId);

    // Build and execute the update query
    const query = `
            UPDATE users 
            SET ${updates.join(", ")}
            WHERE id = $${valueIndex}
            RETURNING id, name, avatar, location, education, certifications, skills`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return { success: false, message: "User not found" };
    }

    return {
      success: true,
      message: "User profile updated successfully",
      updatedUser: result.rows[0],
      updatedFields: updates.map((update) => update.split(" = ")[0]),
    };
  } catch (error) {
    console.error("Error updating user profile from LinkedIn data:", error);
    return {
      success: false,
      message: "Failed to update user profile",
      error: error.message,
    };
  }
};

exports.getUsernameById = async (req, res) => {
  try {
    const { id } = req.body;
    const result = await pool.query("SELECT name FROM users WHERE id = $1", [id]);
    res.status(200).json({ success: true, username: result.rows[0].name });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to get username" });
  }
};

// Get accounts for consolidation with open tasks count
exports.getConsolidationAccounts = async (req, res) => {
  try {
    const { offset = 0, limit = 10, sortBy = 'name', sortOrder = 'asc', searchKey = '' } = req.body;
    
    // Validate sort parameters
    const allowedSortFields = ['name', 'email', 'status', 'open_tasks_count'];
    const allowedSortOrders = ['asc', 'desc'];
    
    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        error: "Invalid sort field"
      });
    }
    
    if (!allowedSortOrders.includes(sortOrder.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: "Invalid sort order"
      });
    }
    
    // Build the ORDER BY clause
    let orderByClause = '';
    if (sortBy === 'open_tasks_count') {
      orderByClause = `ORDER BY COALESCE(task_counts.open_tasks_count, 0) ${sortOrder.toUpperCase()}`;
    } else {
      orderByClause = `ORDER BY u.${sortBy} ${sortOrder.toUpperCase()}`;
    }
    
    // Get total count first with search filter
    let countQuery, countParams;
    if (searchKey) {
      countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        WHERE u.status = 'enabled'
        AND (u.name ILIKE $1 OR u.email ILIKE $1)
      `;
      countParams = [`%${searchKey}%`];
    } else {
      countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        WHERE u.status = 'enabled'
      `;
      countParams = [];
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated and sorted users with open tasks count
    let query, queryParams;
    if (searchKey) {
      query = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.status,
          COALESCE(task_counts.open_tasks_count, 0) as open_tasks_count
        FROM users u
        LEFT JOIN (
          SELECT 
            user_id,
            COUNT(*) as open_tasks_count
          FROM (
            SELECT owner_id as user_id FROM tasks 
            WHERE status IN ('Unassigned', 'Assigned', 'In Progress', 'Ready For Review')
            AND owner_id IS NOT NULL
            UNION ALL
            SELECT assigned_id as user_id FROM tasks 
            WHERE status IN ('Unassigned', 'Assigned', 'In Progress', 'Ready For Review')
            AND assigned_id IS NOT NULL
          ) task_users
          GROUP BY user_id
        ) task_counts ON u.id = task_counts.user_id
        WHERE u.status = 'enabled'
        AND (u.name ILIKE $3 OR u.email ILIKE $3)
        ${orderByClause}
        LIMIT $1 OFFSET $2
      `;
      queryParams = [limit, offset, `%${searchKey}%`];
    } else {
      query = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.status,
          COALESCE(task_counts.open_tasks_count, 0) as open_tasks_count
        FROM users u
        LEFT JOIN (
          SELECT 
            user_id,
            COUNT(*) as open_tasks_count
          FROM (
            SELECT owner_id as user_id FROM tasks 
            WHERE status IN ('Unassigned', 'Assigned', 'In Progress', 'Ready For Review')
            AND owner_id IS NOT NULL
            UNION ALL
            SELECT assigned_id as user_id FROM tasks 
            WHERE status IN ('Unassigned', 'Assigned', 'In Progress', 'Ready For Review')
            AND assigned_id IS NOT NULL
          ) task_users
          GROUP BY user_id
        ) task_counts ON u.id = task_counts.user_id
        WHERE u.status = 'enabled'
        ${orderByClause}
        LIMIT $1 OFFSET $2
      `;
      queryParams = [limit, offset];
    }
    const result = await pool.query(query, queryParams);
    
    return res.status(200).json({
      success: true,
      accounts: result.rows,
      total: total,
      offset: offset,
      limit: limit,
      sortBy: sortBy,
      sortOrder: sortOrder,
      searchKey: searchKey
    });
  } catch (error) {
    console.error('Failed to get consolidation accounts:', error);
    return res.status(500).json({
      success: false,
      error: "Failed to get consolidation accounts"
    });
  }
};

// Consolidate accounts
exports.consolidateAccounts = async (req, res) => {
  const { selectedAccountIds, primaryAccountId } = req.body;
  
  try {
    // Validate inputs
    if (!selectedAccountIds || !primaryAccountId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }
    
    if (!Array.isArray(selectedAccountIds) || selectedAccountIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: "At least 2 accounts must be selected"
      });
    }
    
    if (!selectedAccountIds.includes(primaryAccountId)) {
      return res.status(400).json({
        success: false,
        error: "Primary account must be selected"
      });
    }
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get accounts to be consolidated
      const accountsQuery = `
        SELECT id, name, email, status
        FROM users 
        WHERE id = ANY($1)
      `;
      const accountsResult = await client.query(accountsQuery, [selectedAccountIds]);
      
      if (accountsResult.rows.length !== selectedAccountIds.length) {
        throw new Error('Some accounts not found');
      }
      
      // Get primary account
      const primaryAccount = accountsResult.rows.find(acc => acc.id === primaryAccountId);
      if (!primaryAccount) {
        throw new Error('Primary account not found');
      }
      
      // Get accounts to be deactivated (all except primary)
      const accountsToDeactivate = accountsResult.rows.filter(acc => acc.id !== primaryAccountId);
      
      // Update tasks: reassign all open tasks from deactivated accounts to primary account
      // Update owner tasks
      const updateOwnerTasksQuery = `
        UPDATE tasks 
        SET owner_id = $1, owner_name = $2
        WHERE owner_id = ANY($3) 
        AND status IN ('Unassigned', 'Assigned', 'In Progress', 'Ready For Review')
      `;
      await client.query(updateOwnerTasksQuery, [
        primaryAccountId, 
        primaryAccount.name, 
        accountsToDeactivate.map(acc => acc.id)
      ]);
      
      // Update assigned tasks
      const updateAssignedTasksQuery = `
        UPDATE tasks 
        SET assigned_id = $1, assigned_name = $2
        WHERE assigned_id = ANY($3) 
        AND status IN ('Unassigned', 'Assigned', 'In Progress', 'Ready For Review')
      `;
      await client.query(updateAssignedTasksQuery, [
        primaryAccountId, 
        primaryAccount.name, 
        accountsToDeactivate.map(acc => acc.id)
      ]);
      
      // Deactivate non-primary accounts
      const deactivateAccountsQuery = `
        UPDATE users 
        SET status = 'disabled'
        WHERE id = ANY($1)
      `;
      await client.query(deactivateAccountsQuery, [accountsToDeactivate.map(acc => acc.id)]);
      
      // Commit transaction
      await client.query('COMMIT');
      
      return res.status(200).json({
        success: true,
        message: `Successfully consolidated ${accountsToDeactivate.length} accounts into ${primaryAccount.name}`,
        consolidatedAccounts: accountsToDeactivate.length,
        primaryAccount: primaryAccount.name,
        reassignedTasks: await getReassignedTasksCount(client, accountsToDeactivate.map(acc => acc.id))
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Failed to consolidate accounts:', error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to consolidate accounts"
    });
  }
};

// Helper function to get count of reassigned tasks
const getReassignedTasksCount = async (client, accountIds) => {
  const query = `
    SELECT COUNT(*) as count
    FROM tasks 
    WHERE (owner_id = ANY($1) OR assigned_id = ANY($1))
    AND status IN ('Unassigned', 'Assigned', 'In Progress', 'Ready For Review')
  `;
  const result = await client.query(query, [accountIds]);
  return parseInt(result.rows[0].count);
};

/**
 * Get users for a specific company (for dropdowns/selectors)
 * Lightweight endpoint for task assignment, etc.
 */
exports.getCompanyUsers = async (req, res) => {
  try {
    const { company } = req.query;

    if (!company) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required"
      });
    }

    const query = `
      SELECT u.id, u.name, u.email, u.avatar, u.role
      FROM users u
      JOIN company c ON SPLIT_PART(u.email, '@', 2) = c.domain
      WHERE c.id = $1
        AND u.status = 'enabled'
      ORDER BY u.name ASC
    `;

    const result = await pool.query(query, [company]);

    res.status(200).json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error("Error fetching company users:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch company users"
    });
  }
};
