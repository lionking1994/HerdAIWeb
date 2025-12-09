const pool = require("../config/database");
const { sendNotification } = require("../utils/socket");

// Add an emoji reaction to a task thread
exports.addEmojiReaction = async (req, res) => {
  const { threadId, emoji } = req.body;
  const userId = req.user.id;

  try {
    // Check if thread exists
    const threadResult = await pool.query(
      "SELECT task_threads.*, tasks.title as task_title, tasks.assigned_id FROM task_threads JOIN tasks ON task_threads.task_id = tasks.id WHERE task_threads.id = $1",
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Thread not found",
      });
    }

    const thread = threadResult.rows[0];

    // Insert emoji reaction (if it already exists, the unique constraint will prevent duplicates)
    const result = await pool.query(
      "INSERT INTO emoji_reactions (thread_id, user_id, emoji, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (thread_id, user_id, emoji) DO NOTHING RETURNING *",
      [threadId, userId, emoji, new Date()]
    );

    // If no rows were affected, the reaction already exists
    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Emoji reaction already exists",
      });
    }

    // Determine recipient for notification
    let recipientId;
    if (userId === thread.org_id) {
      // If sender is meeting owner, notify task assignee
      recipientId = thread.assigned_id;
    } else if (userId === thread.assigned_id) {
      // If sender is task assignee, notify meeting owner
      recipientId = thread.org_id;
    } else if (thread.user_id !== userId) {
      // If sender is neither, notify the comment author
      recipientId = thread.user_id;
    }

    // Get user info for notification
    const userResult = await pool.query(
      "SELECT name FROM users WHERE id = $1",
      [userId]
    );
    const userName = userResult.rows[0].name;

    // Create notification message
    const notificationMessage = `${userName} reacted with ${emoji} to a comment on task '${thread.task_title}'`;

    // Insert notification
    if (recipientId) {
      await pool.query(
        "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          recipientId,
          false,
          notificationMessage,
          false,
          `/task-details?id=${thread.task_id}`,
          new Date(),
        ]
      );

      // Send real-time notification
      sendNotification({
        id: recipientId,
        message: notificationMessage,
      });
    }

    res.status(200).json({
      success: true,
      message: "Emoji reaction added successfully",
      reaction: result.rows[0],
    });
  } catch (error) {
    console.error("Error adding emoji reaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add emoji reaction",
      error: error.message,
    });
  }
};

// Remove an emoji reaction from a task thread
exports.removeEmojiReaction = async (req, res) => {
  const { threadId, emoji } = req.body;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      "DELETE FROM emoji_reactions WHERE thread_id = $1 AND user_id = $2 AND emoji = $3 RETURNING *",
      [threadId, userId, emoji]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Emoji reaction not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Emoji reaction removed successfully",
    });
  } catch (error) {
    console.error("Error removing emoji reaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove emoji reaction",
      error: error.message,
    });
  }
};

// Get all emoji reactions for a task thread
exports.getEmojiReactions = async (req, res) => {
  const { threadId } = req.params;

  try {
    const result = await pool.query(
      "SELECT er.*, u.name, u.avatar FROM emoji_reactions er JOIN users u ON er.user_id = u.id WHERE er.thread_id = $1 ORDER BY er.created_at ASC",
      [threadId]
    );

    res.status(200).json({
      success: true,
      reactions: result.rows,
    });
  } catch (error) {
    console.error("Error getting emoji reactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get emoji reactions",
      error: error.message,
    });
  }
};

// Get all emoji reactions for multiple task threads
exports.getMultipleThreadReactions = async (req, res) => {
  const { threadIds } = req.body;

  try {
    const result = await pool.query(
      "SELECT er.*, u.name FROM emoji_reactions er JOIN users u ON er.user_id = u.id WHERE er.thread_id = ANY($1) ORDER BY er.thread_id, er.created_at ASC",
      [threadIds]
    );

    // Group reactions by thread_id
    const groupedReactions = result.rows.reduce((acc, reaction) => {
      if (!acc[reaction.thread_id]) {
        acc[reaction.thread_id] = [];
      }
      acc[reaction.thread_id].push(reaction);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      reactions: groupedReactions,
    });
  } catch (error) {
    console.error("Error getting multiple thread reactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get multiple thread reactions",
      error: error.message,
    });
  }
};

