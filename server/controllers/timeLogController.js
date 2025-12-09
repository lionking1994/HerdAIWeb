const pool = require("../config/database");

// Create a new time log entry
exports.createTimeLog = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;
    const { log_date, time_from, time_to, description } = req.body;

    // Validate required fields
    if (!log_date || !time_from || !time_to) {
      return res.status(400).json({
        success: false,
        message: "Date, time_from, and time_to are required"
      });
    }

    // Calculate duration
    const fromTime = time_from.split(':');
    const toTime = time_to.split(':');
    const fromMinutes = parseInt(fromTime[0]) * 60 + parseInt(fromTime[1]);
    const toMinutes = parseInt(toTime[0]) * 60 + parseInt(toTime[1]);
    const durationHours = (toMinutes - fromMinutes) / 60;

    if (durationHours <= 0) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time"
      });
    }

    // Check if story exists and user has access
    const storyCheckQuery = `
      SELECT bi.id, bi.title, bi.assignee_id, p.company_id
      FROM psa_backlog_items bi
      JOIN psa_projects p ON bi.project_id = p.id
      WHERE bi.id = $1 AND bi.is_deleted = false AND p.is_deleted = false
    `;
    
    const storyResult = await pool.query(storyCheckQuery, [storyId]);
    
    if (storyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    const story = storyResult.rows[0];

    // Simple access check - user must be assigned to story or have company access
    const userCheckQuery = `
      SELECT u.id
      FROM users u
      JOIN company_roles cr ON u.company_role = cr.id
      WHERE u.id = $1 AND cr.company_id = $2
    `;
    
    const userResult = await pool.query(userCheckQuery, [userId, story.company_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Insert time log
    const insertQuery = `
      INSERT INTO psa_time_logs (story_id, user_id, log_date, time_from, time_to, duration_hours, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      storyId,
      userId,
      log_date,
      time_from,
      time_to,
      durationHours,
      description || null
    ]);

    // Update actual_hours in backlog item
    const updateActualHoursQuery = `
      UPDATE psa_backlog_items 
      SET actual_hours = COALESCE(actual_hours, 0) + $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING actual_hours
    `;

    await pool.query(updateActualHoursQuery, [durationHours, storyId]);

    res.status(201).json({
      success: true,
      message: "Time logged successfully",
      data: {
        timeLog: result.rows[0],
        totalActualHours: (await pool.query(
          'SELECT actual_hours FROM psa_backlog_items WHERE id = $1', 
          [storyId]
        )).rows[0].actual_hours
      }
    });

  } catch (error) {
    console.error("Error creating time log:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get time logs for a story
exports.getTimeLogs = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    // Check access
    const accessQuery = `
      SELECT bi.id, p.company_id
      FROM psa_backlog_items bi
      JOIN psa_projects p ON bi.project_id = p.id
      JOIN users u ON u.id = $1
      JOIN company_roles cr ON u.company_role = cr.id
      WHERE bi.id = $2 AND bi.is_deleted = false AND p.is_deleted = false
        AND cr.company_id = p.company_id
    `;
    
    const accessResult = await pool.query(accessQuery, [userId, storyId]);
    
    if (accessResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Get time logs
    const timeLogsQuery = `
      SELECT 
        tl.id,
        tl.log_date,
        tl.time_from,
        tl.time_to,
        tl.duration_hours,
        tl.description,
        tl.created_at,
        u.name as user_name,
        u.email as user_email
      FROM psa_time_logs tl
      JOIN users u ON tl.user_id = u.id
      WHERE tl.story_id = $1 AND tl.is_deleted = false
      ORDER BY tl.log_date DESC, tl.created_at DESC
    `;

    const result = await pool.query(timeLogsQuery, [storyId]);

    res.status(200).json({
      success: true,
      data: {
        timeLogs: result.rows,
        totalLogs: result.rows.length,
        totalHours: result.rows.reduce((sum, log) => sum + parseFloat(log.duration_hours), 0)
      }
    });

  } catch (error) {
    console.error("Error fetching time logs:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Update a time log entry
exports.updateTimeLog = async (req, res) => {
  try {
    const { logId } = req.params;
    const userId = req.user.id;
    const { log_date, time_from, time_to, description } = req.body;

    // Get existing time log
    const getLogQuery = `
      SELECT tl.*, bi.assignee_id, p.company_id
      FROM psa_time_logs tl
      JOIN psa_backlog_items bi ON tl.story_id = bi.id
      JOIN psa_projects p ON bi.project_id = p.id
      WHERE tl.id = $1 AND tl.is_deleted = false
    `;
    
    const logResult = await pool.query(getLogQuery, [logId]);
    
    if (logResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Time log not found"
      });
    }

    const existingLog = logResult.rows[0];

    // Check if user can edit this log (only the creator)
    const userCheckQuery = `
      SELECT u.id
      FROM users u
      JOIN company_roles cr ON u.company_role = cr.id
      WHERE u.id = $1 AND cr.company_id = $2
    `;
    
    const userResult = await pool.query(userCheckQuery, [userId, existingLog.company_id]);
    
    if (userResult.rows.length === 0 || existingLog.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Calculate new duration
    const fromTime = time_from.split(':');
    const toTime = time_to.split(':');
    const fromMinutes = parseInt(fromTime[0]) * 60 + parseInt(fromTime[1]);
    const toMinutes = parseInt(toTime[0]) * 60 + parseInt(toTime[1]);
    const newDurationHours = (toMinutes - fromMinutes) / 60;

    if (newDurationHours <= 0) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time"
      });
    }

    // Update time log
    const updateQuery = `
      UPDATE psa_time_logs 
      SET log_date = $1, time_from = $2, time_to = $3, duration_hours = $4, description = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      log_date || existingLog.log_date,
      time_from || existingLog.time_from,
      time_to || existingLog.time_to,
      newDurationHours,
      description !== undefined ? description : existingLog.description,
      logId
    ]);

    // Update actual_hours in backlog item (subtract old, add new)
    const hoursDifference = newDurationHours - parseFloat(existingLog.duration_hours);
    
    const updateActualHoursQuery = `
      UPDATE psa_backlog_items 
      SET actual_hours = COALESCE(actual_hours, 0) + $1,
          updated_at = NOW()
      WHERE id = $2
    `;

    await pool.query(updateActualHoursQuery, [hoursDifference, existingLog.story_id]);

    res.status(200).json({
      success: true,
      message: "Time log updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Error updating time log:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Delete a time log entry
exports.deleteTimeLog = async (req, res) => {
  try {
    const { logId } = req.params;
    const userId = req.user.id;

    // Get existing time log
    const getLogQuery = `
      SELECT tl.*, bi.assignee_id, p.company_id
      FROM psa_time_logs tl
      JOIN psa_backlog_items bi ON tl.story_id = bi.id
      JOIN psa_projects p ON bi.project_id = p.id
      WHERE tl.id = $1 AND tl.is_deleted = false
    `;
    
    const logResult = await pool.query(getLogQuery, [logId]);
    
    if (logResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Time log not found"
      });
    }

    const existingLog = logResult.rows[0];

    // Check if user can delete this log (only the creator)
    const userCheckQuery = `
      SELECT u.id
      FROM users u
      JOIN company_roles cr ON u.company_role = cr.id
      WHERE u.id = $1 AND cr.company_id = $2
    `;
    
    const userResult = await pool.query(userCheckQuery, [userId, existingLog.company_id]);
    
    if (userResult.rows.length === 0 || existingLog.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Soft delete time log
    const deleteQuery = `
      UPDATE psa_time_logs 
      SET is_deleted = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(deleteQuery, [logId]);

    // Update actual_hours in backlog item (subtract deleted hours)
    const updateActualHoursQuery = `
      UPDATE psa_backlog_items 
      SET actual_hours = GREATEST(COALESCE(actual_hours, 0) - $1, 0),
          updated_at = NOW()
      WHERE id = $2
    `;

    await pool.query(updateActualHoursQuery, [existingLog.duration_hours, existingLog.story_id]);

    res.status(200).json({
      success: true,
      message: "Time log deleted successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Error deleting time log:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
