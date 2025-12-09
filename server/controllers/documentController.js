const pool = require("../config/database");
const { sendNotification } = require("../utils/socket");

// Get all comments for a document
const getDocumentComments = async (req, res) => {
  try {
    console.log("document", req.body, req.params);
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({ message: "Document ID is required" });
    }

    const result = await pool.query(
      `SELECT
            dc.ID,
            dc.document_id,
            dc.user_id,
            dc.CONTENT,
            dc.created_at,
            dc.updated_at,
            dc.tags,
            dc.mentioned_users,
            dc.reply_to,
            CASE WHEN dc.reply_to IS NOT NULL THEN true ELSE false END AS is_reply,
            (
            SELECT
                json_agg (
                    jsonb_build_object (
                        'id',
                        u.ID,
                        'name',
                        u.NAME,
                        'email',
                        u.email,
                        'phone',
                        u.phone,
                        'location',
                        u.LOCATION,
                        'bio',
                        u.bio,
                        'company_role_name',
                        cr.NAME,
                        'avatar',
                        u.avatar 
                    ) 
                ) 
            FROM
                users u
                LEFT JOIN company_roles cr ON cr.ID = u.company_role 
            WHERE
                u.ID = dc.user_id 
            ) AS USER,
            (
            SELECT
                jsonb_build_object (
                    'id',
                    u.ID,
                    'name',
                    u.NAME,
                    'email',
                    u.email,
                    'avatar',
                    u.avatar 
                )
            FROM
                users u
                JOIN document_comments dc2 ON u.ID = dc2.user_id
            WHERE
                dc2.ID = dc.reply_to
            ) AS reply_to_user
        FROM
            document_comments dc 
        WHERE
            dc.document_id = $1 
        ORDER BY
            dc.created_at ASC;`,
      [documentId]
    );

    return res.status(200).json({
      success: true,
      totalComments: result.rows.length,
      comments: result.rows,
    });
  } catch (error) {
    console.error("Error getting document comments:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Add a comment to a document
const addDocumentComment = async (req, res) => {
  try {
    const {
      documentId,
      content,
      sectionId,
      taskId,
      replyTo,
      mentionedUsers,
      tags,
    } = req.body;
    const userId = req.user.id;
    console.log("addComment", documentId, content, userId, req.body);
    if (!documentId || !content) {
      return res
        .status(400)
        .json({ message: "Document ID and content are required" });
    }

    // Parse tags from content (hashtags)
    const extractedTags = content.match(/#(\w+)/g) || [];
    const formattedTags = extractedTags.map((tag) => tag.substring(1)); // Remove # prefix

    // Combine extracted tags with any explicitly provided tags
    const finalTags = tags
      ? [...new Set([...formattedTags, ...JSON.parse(tags)])]
      : formattedTags;

    // Parse mentioned users from the request
    const parsedMentionedUsers = mentionedUsers
      ? JSON.parse(mentionedUsers)
      : [];

    // Insert the comment
    const result = await pool.query(
      `INSERT INTO document_comments (document_id, user_id, content, reply_to, section_id, task_id, tags, mentioned_users)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, document_id, user_id, content, tags, mentioned_users, created_at, updated_at`,
      [
        documentId,
        userId,
        content,
        replyTo == "null" ? -1 : replyTo,
        sectionId || null,
        taskId || null,
        finalTags.length > 0 ? finalTags : null,
        parsedMentionedUsers.length > 0
          ? JSON.stringify(parsedMentionedUsers)
          : null,
      ]
    );

    if (parsedMentionedUsers.length) {
      const thread_res = await pool.query(
        `SELECT
            *
          FROM
            task_threads
          WHERE
            task_file = $1`,
        [documentId.split("doc-")[1]]
      );
      parsedMentionedUsers.map(async (user) => {
        const message = `${req.user.name} sent you a comment-on '${thread_res.rows[0].task_file_origin_name}'`;
        await pool.query(
          "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [
            user.id,
            false,
            message,
            false,
            `/task-details?id=${thread_res.rows[0].task_id}&doc_id=${thread_res.rows[0].task_file}&doc_name=${thread_res.rows[0].task_file_origin_name}&comment=${result.rows[0].id}`,
            new Date(),
          ]
        );
        sendNotification({
          id: user.id,
          message: "You received a comment.",
        });
      });
    }
    // Get user information
    const userResult = await pool.query(
      `SELECT name, avatar FROM users WHERE id = $1`,
      [userId]
    );

    const comment = result.rows[0];
    comment.user_name = userResult.rows[0].name;
    comment.user_avatar = userResult.rows[0].avatar;

    // If this is a reply, get the parent comment's user info
    if (replyTo != "null") {
      const parentUserResult = await pool.query(
        `SELECT u.name, u.avatar 
           FROM document_comments dc
           JOIN users u ON dc.user_id = u.id
           WHERE dc.id = $1`,
        [replyTo]
      );

      if (parentUserResult.rows.length > 0) {
        comment.reply_to_user_name = parentUserResult.rows[0].name;
        comment.reply_to_user_avatar = parentUserResult.rows[0].avatar;
      }
      comment.is_reply = true;
    } else {
      comment.is_reply = false;
    }
    // Create notifications for mentioned users
    if (parsedMentionedUsers.length > 0) {
      const commentId = comment.id;

      // Create a notification for each mentioned user
      for (const mentionedUser of parsedMentionedUsers) {
        await pool.query(
          `INSERT INTO comment_notifications (user_id, comment_id, document_id)
           VALUES ($1, $2, $3)`,
          [mentionedUser.id, commentId, documentId]
        );
      }
    }

    return res.status(201).json({
      success: true,
      comment,
    });
  } catch (error) {
    console.error("Error adding document comment:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Update a document comment
const updateDocumentComment = async (req, res) => {
  try {
    const { commentId, content, tags } = req.body;
    const userId = req.user.id;

    if (!commentId || !content) {
      return res
        .status(400)
        .json({ message: "Comment ID and content are required" });
    }

    // Check if the comment belongs to the user
    const checkResult = await pool.query(
      `SELECT user_id, mentioned_users FROM document_comments WHERE id = $1`,
      [commentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res
        .status(403)
        .json({ message: "You can only update your own comments" });
    }

    // Parse tags from content (hashtags)
    const extractedTags = content.match(/#(\w+)/g) || [];
    const formattedTags = extractedTags.map((tag) => tag.substring(1)); // Remove # prefix

    // Combine extracted tags with any explicitly provided tags
    const finalTags = tags
      ? [...new Set([...formattedTags, ...JSON.parse(tags)])]
      : formattedTags;

    // Keep the existing mentioned users
    const existingMentionedUsers = checkResult.rows[0].mentioned_users;

    const result = await pool.query(
      `UPDATE document_comments
       SET content = $1, updated_at = NOW(), tags = $2
       WHERE id = $3
       RETURNING id, document_id, user_id, content, tags, mentioned_users, created_at, updated_at`,
      [content, finalTags.length > 0 ? finalTags : null, commentId]
    );

    // Get user information
    const userResult = await pool.query(
      `SELECT name, avatar FROM users WHERE id = $1`,
      [userId]
    );

    const comment = result.rows[0];
    comment.user_name = userResult.rows[0].name;
    comment.user_avatar = userResult.rows[0].avatar;

    return res.status(200).json({
      success: true,
      comment,
    });
  } catch (error) {
    console.error("Error updating document comment:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Delete a document comment
const deleteDocumentComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = req.user.id;

    if (!commentId) {
      return res.status(400).json({ message: "Comment ID is required" });
    }

    // Check if the comment belongs to the user
    const checkResult = await pool.query(
      `SELECT user_id FROM document_comments WHERE id = $1`,
      [commentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Allow comment deletion for the comment owner
    if (checkResult.rows[0].user_id !== userId) {
      // Check if the user is an admin or has permission to delete
      const isAdmin = await pool.query(
        `SELECT is_admin FROM users WHERE id = $1`,
        [userId]
      );

      if (!isAdmin.rows[0]?.is_admin) {
        return res
          .status(403)
          .json({ message: "You can only delete your own comments" });
      }
    }

    // Delete associated notifications
    await pool.query(
      `DELETE FROM comment_notifications WHERE comment_id = $1`,
      [commentId]
    );

    // Delete the comment
    await pool.query(`DELETE FROM document_comments WHERE id = $1`, [
      commentId,
    ]);

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document comment:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Search users for tagging in comments
const searchUsers = async (req, res) => {
  try {
    const { query, taskId } = req.query;
    const userId = req.user.id;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.avatar, u.email, u.bio, u.phone, u.location
       FROM users u 
       WHERE (u.name ILIKE $1 OR u.email ILIKE $1)
       AND u.status = 'enabled'
       ORDER BY u.name ASC
       LIMIT 10`,
      [`%${query}%`]
    );
    console.log(req.user.email);
    const { rows : participants } = await pool.query(
      `SELECT
        u.id,
        u.name,
        u.avatar,
        u.email, 
        u.bio, 
        u.phone, 
        u.location
      FROM
        users u
        INNER JOIN meeting_participants mp ON u.ID = mp.user_id 
        INNER JOIN meetings m ON mp.meeting_id = m.id
        INNER JOIN tasks t ON m.id = t.meeting_id	
      WHERE (u.name ILIKE $1 OR u.email ILIKE $1) AND t.id = $2 
      ORDER BY
        u.NAME ASC;`,
      [`%${query}%`, taskId]
    );
    const filter_res = result.rows.filter(
      (user) => user.email.split("@")[1] === req.user.email.split("@")[1]
    );
    return res.status(200).json({
      success: true,
      users: [...filter_res, ...participants],
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Get section tags for a document
const getSectionTags = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({ message: "Document ID is required" });
    }

    const result = await pool.query(
      `SELECT id, document_id, tag_name, section_text, created_at
       FROM document_section_tags
       WHERE document_id = $1
       ORDER BY created_at ASC`,
      [documentId]
    );

    return res.status(200).json({ tags: result.rows });
  } catch (error) {
    console.error("Error getting section tags:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Add a highlight to a document
const addDocumentHighlight = async (req, res) => {
  try {
    const { documentId, text, tag, userId } = req.body;

    if (!documentId || !text) {
      return res
        .status(400)
        .json({ message: "Document ID and text are required" });
    }

    // Check if the document_highlights table exists, if not create it
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_highlights (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255) NOT NULL,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        tag VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const result = await pool.query(
      `INSERT INTO document_highlights (document_id, user_id, text, tag)
       VALUES ($1, $2, $3, $4)
       RETURNING id, document_id, user_id, text, tag, created_at, updated_at`,
      [documentId, userId || req.user.id, text, tag]
    );

    return res.status(201).json({
      success: true,
      highlight: result.rows[0],
    });
  } catch (error) {
    console.error("Error adding document highlight:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Get user notifications for comments
const getUserCommentNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        cn.id, 
        cn.user_id, 
        cn.comment_id, 
        cn.document_id, 
        cn.is_read, 
        cn.created_at,
        dc.content as comment_content,
        u.name as commenter_name,
        u.avatar as commenter_avatar
       FROM comment_notifications cn
       JOIN document_comments dc ON cn.comment_id = dc.id
       JOIN users u ON dc.user_id = u.id
       WHERE cn.user_id = $1
       ORDER BY cn.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      notifications: result.rows,
    });
  } catch (error) {
    console.error("Error getting user comment notifications:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Get all highlights for a document
const getDocumentHighlights = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({ message: "Document ID is required" });
    }

    // Check if the document_highlights table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'document_highlights'
      )
    `);

    if (!tableExists.rows[0].exists) {
      return res.status(200).json({
        success: true,
        highlights: [],
      });
    }

    const result = await pool.query(
      `SELECT
        dh.id,
        dh.document_id,
        dh.user_id,
        dh.text,
        dh.tag,
        dh.created_at,
        dh.updated_at,
        u.name as user_name,
        u.avatar as user_avatar
      FROM
        document_highlights dh
      LEFT JOIN
        users u ON u.id = dh.user_id
      WHERE
        dh.document_id = $1
      ORDER BY
        dh.created_at ASC`,
      [documentId]
    );

    return res.status(200).json({
      success: true,
      highlights: result.rows,
    });
  } catch (error) {
    console.error("Error getting document highlights:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
// Mark notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.body;
    const userId = req.user.id;

    if (!notificationId) {
      return res.status(400).json({ message: "Notification ID is required" });
    }

    // Check if the notification belongs to the user
    const checkResult = await pool.query(
      `SELECT user_id FROM comment_notifications WHERE id = $1`,
      [notificationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res
        .status(403)
        .json({ message: "You can only update your own notifications" });
    }

    await pool.query(
      `UPDATE comment_notifications
       SET is_read = TRUE
       WHERE id = $1`,
      [notificationId]
    );

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getDocumentComments,
  addDocumentComment,
  updateDocumentComment,
  deleteDocumentComment,
  searchUsers,
  getSectionTags,
  addDocumentHighlight,
  getDocumentHighlights,
  getUserCommentNotifications,
  markNotificationAsRead,
};
