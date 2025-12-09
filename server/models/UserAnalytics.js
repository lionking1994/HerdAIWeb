const pool = require("../config/database");

class UserAnalytics {
  // Session management
  static async createSession(sessionData) {
    const {
      user_id,
      session_id,
      path,
      referrer,
      user_agent,
      ip_address,
      viewport_width,
      viewport_height,
    } = sessionData;

    const query = `
      INSERT INTO user_analytics_sessions (
        user_id, session_id, path, referrer, user_agent, 
        ip_address, viewport_width, viewport_height
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      user_id,
      session_id,
      path,
      referrer,
      user_agent,
      ip_address,
      viewport_width,
      viewport_height,
    ]);
    return rows[0];
  }

  static async updateSession(sessionId, updateData) {
    const { ended_at, time_spent } = updateData;
    const query = `
      UPDATE user_analytics_sessions 
      SET ended_at = $2, time_spent = $3, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = $1
      RETURNING *
    `;

    const { rows } = await pool.query(query, [sessionId, ended_at, time_spent]);
    return rows[0];
  }

  static async findSessionBySessionId(sessionId) {
    const query = "SELECT * FROM user_analytics_sessions WHERE session_id = $1";
    const { rows } = await pool.query(query, [sessionId]);
    return rows[0];
  }

  // Mouse movement tracking
  static async createMouseMovements(movements) {
    if (!movements || movements.length === 0) return [];

    const values = [];
    const placeholders = [];

    movements.forEach((movement, index) => {
      const offset = index * 9;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${
          offset + 5
        }, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
      );
      values.push(
        movement.session_id,
        movement.user_id,
        movement.path,
        movement.x,
        movement.y,
        movement.scroll_x || 0,
        movement.scroll_y || 0,
        movement.viewport_width,
        movement.timestamp
      );
    });

    const query = `
      INSERT INTO user_analytics_mouse_movements (
        session_id, user_id, path, x, y, scroll_x, scroll_y, viewport_width, timestamp
      )
      VALUES ${placeholders.join(", ")}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    return rows;
  }

  // Click tracking
  static async createClicks(clicks) {
    if (!clicks || clicks.length === 0) return [];

    const values = [];
    const placeholders = [];

    clicks.forEach((click, index) => {
      const offset = index * 15;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${
          offset + 5
        }, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${
          offset + 10
        }, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${
          offset + 14
        }, $${offset + 15})`
      );
      values.push(
        click.session_id,
        click.user_id,
        click.path,
        click.x,
        click.y,
        click.scroll_x || 0,
        click.scroll_y || 0,
        click.target_tag,
        click.target_id,
        click.target_class,
        click.target_text,
        click.button_type || 0,
        click.ctrl_key || false,
        click.shift_key || false,
        click.timestamp
      );
    });

    const query = `
      INSERT INTO user_analytics_clicks (
        session_id, user_id, path, x, y, scroll_x, scroll_y, 
        target_tag, target_id, target_class, target_text, 
        button_type, ctrl_key, shift_key, timestamp
      )
      VALUES ${placeholders.join(", ")}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    return rows;
  }

  // Analytics data retrieval
  static async getAnalyticsByUser(userId, filters = {}) {
    const { startDate, endDate, path } = filters;
    let whereClause = "WHERE s.user_id = $1";
    const params = [userId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      whereClause += ` AND s.started_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND s.started_at <= $${paramCount}`;
      params.push(endDate);
    }

    if (path) {
      paramCount++;
      whereClause += ` AND s.path = $${paramCount}`;
      params.push(path);
    }

    const query = `
      SELECT 
        s.*,
        COALESCE(m.mouse_movements, 0) as mouse_movements_count,
        COALESCE(c.clicks, 0) as clicks_count
      FROM user_analytics_sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as mouse_movements 
        FROM user_analytics_mouse_movements 
        GROUP BY session_id
      ) m ON s.id = m.session_id
      LEFT JOIN (
        SELECT session_id, COUNT(*) as clicks 
        FROM user_analytics_clicks 
        GROUP BY session_id
      ) c ON s.id = c.session_id
      ${whereClause}
      ORDER BY s.started_at DESC
    `;

    const { rows } = await pool.query(query, params);
    return rows;
  }

  static async getPathAnalytics(userId, filters = {}) {
    const { startDate, endDate } = filters;
    let whereClause = "WHERE user_id = $1";
    const params = [userId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      whereClause += ` AND started_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND started_at <= $${paramCount}`;
      params.push(endDate);
    }

    const query = `
      SELECT 
        path,
        COUNT(*) as visit_count,
        AVG(time_spent) as avg_time_spent,
        MAX(time_spent) as max_time_spent,
        MIN(time_spent) as min_time_spent
      FROM user_analytics_sessions
      ${whereClause}
      GROUP BY path
      ORDER BY visit_count DESC
    `;

    const { rows } = await pool.query(query, params);
    return rows;
  }

  static async getClickAnalytics(userId, filters = {}) {
    const { startDate, endDate, path } = filters;
    let whereClause = "WHERE user_id = $1";
    const params = [userId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      whereClause += ` AND timestamp >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND timestamp <= $${paramCount}`;
      params.push(endDate);
    }

    if (path) {
      paramCount++;
      whereClause += ` AND path = $${paramCount}`;
      params.push(path);
    }

    const query = `
      SELECT 
        path,
        target_tag,
        target_id,
        target_class,
        COUNT(*) as click_count,
        AVG(x) as avg_x,
        AVG(y) as avg_y
      FROM user_analytics_clicks
      ${whereClause}
      GROUP BY path, target_tag, target_id, target_class
      ORDER BY click_count DESC
    `;

    const { rows } = await pool.query(query, params);
    return rows;
  }

  static async getMouseMovementAnalytics(userId, filters = {}) {
    const { startDate, endDate, path } = filters;
    let whereClause = "WHERE user_id = $1";
    const params = [userId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      whereClause += ` AND timestamp >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND timestamp <= $${paramCount}`;
      params.push(endDate);
    }

    if (path) {
      paramCount++;
      whereClause += ` AND path = $${paramCount}`;
      params.push(path);
    }

    const query = `
      SELECT 
        path,
        COUNT(*) as movement_count,
        AVG(x) as avg_x,
        AVG(y) as avg_y,
        MIN(timestamp) as first_movement,
        MAX(timestamp) as last_movement
      FROM user_analytics_mouse_movements
      ${whereClause}
      GROUP BY path
      ORDER BY movement_count DESC
    `;

    const { rows } = await pool.query(query, params);
    return rows;
  }

  static async getActivityTimeline(userId, filters = {}) {
    const { startDate, endDate } = filters;
    let whereClause = "WHERE user_id = $1";
    const params = [userId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      whereClause += ` AND timestamp >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND timestamp <= $${paramCount}`;
      params.push(endDate);
    }

    const query = `
      SELECT 
        EXTRACT(HOUR FROM timestamp) as hour,
        COUNT(*) as click_count
      FROM user_analytics_clicks
      ${whereClause}
      GROUP BY EXTRACT(HOUR FROM timestamp)
      ORDER BY hour
    `;

    const { rows } = await pool.query(query, params);
    return rows;
  }

  // Admin analytics - get data for all users
  static async getAllUsersAnalytics(filters = {}) {
    const { startDate, endDate, userId } = filters;
    let whereClause = "WHERE 1=1";
    const params = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      whereClause += ` AND s.started_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND s.started_at <= $${paramCount}`;
      params.push(endDate);
    }

    if (userId) {
      paramCount++;
      whereClause += ` AND s.user_id = $${paramCount}`;
      params.push(userId);
    }

    const query = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT s.path) as unique_paths,
        COALESCE(SUM(s.time_spent), 0) as total_time_spent,
        COALESCE(m.total_movements, 0) as total_mouse_movements,
        COALESCE(c.total_clicks, 0) as total_clicks
      FROM users u
      LEFT JOIN user_analytics_sessions s ON u.id = s.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as total_movements 
        FROM user_analytics_mouse_movements 
        GROUP BY user_id
      ) m ON u.id = m.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as total_clicks 
        FROM user_analytics_clicks 
        GROUP BY user_id
      ) c ON u.id = c.user_id
      ${whereClause}
      GROUP BY u.id, u.name, u.email, m.total_movements, c.total_clicks
      ORDER BY total_sessions DESC
    `;

    const { rows } = await pool.query(query, params);
    return rows;
  }

  // ===== NEW TRACKING ACTIONS METHODS =====

  // Save tracking actions in bulk
  static async saveTrackingActions(actions) {
    if (!actions || actions.length === 0) return [];

    // Use individual INSERT statements for better error handling
    const results = [];

    for (const action of actions) {
      try {
        // Extract nested data with proper fallbacks
        const element = action.element || {};
        const position = action.position || {};
        const scrollPosition = action.scrollPosition || {};
        const modifiers = action.modifiers || {};
        const screenResolution = action.screenResolution || {};
        const viewport = action.viewport || {};

        // Build dynamic query with only the columns we have data for
        const columns = ["user_id", "session_id", "action_type", "timestamp"];
        const values = [
          action.user_id,
          action.sessionId,
          action.type,
          action.timestamp,
        ];
        let paramCount = 4;

        // Add optional fields if they exist
        if (action.url !== undefined) {
          columns.push("url");
          values.push(action.url);
          paramCount++;
        }

        if (action.title !== undefined) {
          columns.push("title");
          values.push(action.title);
          paramCount++;
        }

        if (action.referrer !== undefined) {
          columns.push("referrer");
          values.push(action.referrer);
          paramCount++;
        }

        if (action.userAgent !== undefined) {
          columns.push("user_agent");
          values.push(action.userAgent);
          paramCount++;
        }

        // Element fields
        if (element.tagName !== undefined) {
          columns.push("element_tag");
          values.push(element.tagName);
          paramCount++;
        }

        if (element.id !== undefined) {
          columns.push("element_id");
          values.push(element.id);
          paramCount++;
        }

        if (element.className !== undefined) {
          columns.push("element_class");
          values.push(element.className);
          paramCount++;
        }

        if (element.textContent !== undefined) {
          columns.push("element_text");
          values.push(element.textContent);
          paramCount++;
        }

        if (element.href !== undefined) {
          columns.push("element_href");
          values.push(element.href);
          paramCount++;
        }

        if (element.type !== undefined) {
          columns.push("element_type");
          values.push(element.type);
          paramCount++;
        }

        // Position fields
        if (position.x !== undefined) {
          columns.push("position_x");
          values.push(position.x);
          paramCount++;
        }

        if (position.y !== undefined) {
          columns.push("position_y");
          values.push(position.y);
          paramCount++;
        }

        if (position.pageX !== undefined) {
          columns.push("position_page_x");
          values.push(position.pageX);
          paramCount++;
        }

        if (position.pageY !== undefined) {
          columns.push("position_page_y");
          values.push(position.pageY);
          paramCount++;
        }

        // Scroll fields
        if (scrollPosition.scrollX !== undefined) {
          columns.push("scroll_x");
          values.push(scrollPosition.scrollX);
          paramCount++;
        }

        if (scrollPosition.scrollY !== undefined) {
          columns.push("scroll_y");
          values.push(scrollPosition.scrollY);
          paramCount++;
        }

        if (scrollPosition.scrollTop !== undefined) {
          columns.push("scroll_top");
          values.push(scrollPosition.scrollTop);
          paramCount++;
        }

        if (scrollPosition.scrollLeft !== undefined) {
          columns.push("scroll_left");
          values.push(scrollPosition.scrollLeft);
          paramCount++;
        }

        // Key fields
        if (action.key !== undefined) {
          columns.push("key_pressed");
          values.push(action.key);
          paramCount++;
        }

        if (action.code !== undefined) {
          columns.push("key_code");
          values.push(action.code);
          paramCount++;
        }

        // Modifier keys
        if (modifiers.ctrlKey !== undefined) {
          columns.push("ctrl_key");
          values.push(modifiers.ctrlKey);
          paramCount++;
        }

        if (modifiers.shiftKey !== undefined) {
          columns.push("shift_key");
          values.push(modifiers.shiftKey);
          paramCount++;
        }

        if (modifiers.altKey !== undefined) {
          columns.push("alt_key");
          values.push(modifiers.altKey);
          paramCount++;
        }

        if (modifiers.metaKey !== undefined) {
          columns.push("meta_key");
          values.push(modifiers.metaKey);
          paramCount++;
        }

        // Screen and viewport fields
        if (screenResolution.width !== undefined) {
          columns.push("screen_width");
          values.push(screenResolution.width);
          paramCount++;
        }

        if (screenResolution.height !== undefined) {
          columns.push("screen_height");
          values.push(screenResolution.height);
          paramCount++;
        }

        if (viewport.width !== undefined) {
          columns.push("viewport_width");
          values.push(viewport.width);
          paramCount++;
        }

        if (viewport.height !== undefined) {
          columns.push("viewport_height");
          values.push(viewport.height);
          paramCount++;
        }

        // Hidden field
        if (action.hidden !== undefined) {
          columns.push("hidden");
          values.push(action.hidden);
          paramCount++;
        }

        // Additional data
        if (action.additional_data !== undefined) {
          columns.push("additional_data");
          values.push(JSON.stringify(action.additional_data));
          paramCount++;
        }

        if (action.pathName !== undefined) {
          columns.push("pathname");
          values.push(action.pathName);
          paramCount++;
        }

        if (action.tab !== undefined) {
          columns.push("tab");
          values.push(action.tab);
          paramCount++;
        }

        // Build the query with dynamic placeholders
        const placeholders = values
          .map((_, index) => `$${index + 1}`)
          .join(", ");

        const query = `
          INSERT INTO user_tracking_actions (${columns.join(", ")})
          VALUES (${placeholders})
          RETURNING id, action_type, timestamp
        `;

        const { rows } = await pool.query(query, values);
        results.push(rows[0]);
      } catch (error) {
        // Continue with other actions instead of failing completely
      }
    }

    console.log(
      `Successfully saved ${results.length} out of ${actions.length} tracking actions`
    );
    return results;
  }

  // Get tracking statistics for a user
  static async getTrackingStats(
    userId,
    startTimestamp = null,
    endTimestamp = null
  ) {
    const query = `
      SELECT * FROM get_user_tracking_stats($1, $2, $3)
    `;

    const { rows } = await pool.query(query, [
      userId,
      startTimestamp,
      endTimestamp,
    ]);
    return rows[0] || null;
  }

  // Get session timeline
  static async getSessionTimeline(sessionId) {
    const query = `
      SELECT * FROM get_session_timeline($1)
    `;

    const { rows } = await pool.query(query, [sessionId]);
    return rows;
  }

  // Get actions by type for a user
  static async getActionsByType(userId, actionType, limit = 100, offset = 0) {
    const query = `
      SELECT * FROM user_tracking_actions
      WHERE user_id = $1 AND action_type = $2
      ORDER BY timestamp DESC
      LIMIT $3 OFFSET $4
    `;

    const { rows } = await pool.query(query, [
      userId,
      actionType,
      limit,
      offset,
    ]);
    return rows;
  }

  // Get recent actions for a user
  static async getRecentActions(userId, limit = 50) {
    const query = `
      SELECT * FROM user_tracking_actions
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;

    const { rows } = await pool.query(query, [userId, limit]);
    return rows;
  }

  // Get actions within time range
  static async getActionsInTimeRange(
    userId,
    startTimestamp,
    endTimestamp,
    actionType = null
  ) {
    let query = `
      SELECT * FROM user_tracking_actions
      WHERE user_id = $1 AND timestamp >= $2 AND timestamp <= $3
    `;
    const params = [userId, startTimestamp, endTimestamp];

    if (actionType) {
      query += ` AND action_type = $4`;
      params.push(actionType);
    }

    query += ` ORDER BY timestamp ASC`;

    const { rows } = await pool.query(query, params);
    return rows;
  }

  // Get unique sessions for a user
  static async getUserSessions(userId, limit = 100) {
    const query = `
      SELECT DISTINCT session_id, 
             MIN(timestamp) as session_start,
             MAX(timestamp) as session_end,
             COUNT(*) as action_count,
             array_agg(DISTINCT action_type) as action_types
      FROM user_tracking_actions
      WHERE user_id = $1
      GROUP BY session_id
      ORDER BY session_start DESC
      LIMIT $2
    `;

    const { rows } = await pool.query(query, [userId, limit]);
    return rows;
  }

  // Get click heatmap data
  static async getClickHeatmap(
    userId,
    url = null,
    startTimestamp = null,
    endTimestamp = null
  ) {
    let query = `
      SELECT 
        position_x,
        position_y,
        COUNT(*) as click_count,
        AVG(position_x) as avg_x,
        AVG(position_y) as avg_y
      FROM user_tracking_actions
      WHERE user_id = $1 AND action_type = 'click'
    `;
    const params = [userId];
    let paramCount = 1;

    if (url) {
      paramCount++;
      query += ` AND url = $${paramCount}`;
      params.push(url);
    }

    if (startTimestamp) {
      paramCount++;
      query += ` AND timestamp >= $${paramCount}`;
      params.push(startTimestamp);
    }

    if (endTimestamp) {
      paramCount++;
      query += ` AND timestamp <= $${paramCount}`;
      params.push(endTimestamp);
    }

    query += `
      GROUP BY position_x, position_y
      ORDER BY click_count DESC
    `;

    const { rows } = await pool.query(query, params);
    return rows;
  }
}

module.exports = UserAnalytics;
