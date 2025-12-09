const UserAnalytics = require("../models/UserAnalytics");
const crypto = require("crypto");
const pool = require("../config/database");

// Helper function to generate session ID
const generateSessionId = () => {
  return crypto.randomBytes(16).toString("hex");
};

// Helper function to get client IP
const getClientIP = (req) => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null)
  );
};

// Helper function to calculate time based on specific action types
const calculateTimeByActionTypes = (
  sessionActions,
  actionTypes = ["page_view", "path_change", "visibility_change"]
) => {
  const pageTimeMap = {};
  const pageDurations = [];

  // Sort actions by timestamp
  sessionActions.sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  // Filter for specific action types
  const targetEvents = sessionActions.filter((action) =>
    actionTypes.includes(action.action_type)
  );

  // Calculate time between events
  for (let i = 0; i < targetEvents.length - 1; i++) {
    const currentEvent = targetEvents[i];
    const nextEvent = targetEvents[i + 1];

    const pageStart = new Date(currentEvent.created_at).getTime();
    const pageEnd = new Date(nextEvent.created_at).getTime();
    const timeOnPage = pageEnd - pageStart;

    // Only include reasonable page durations (between 1 second and 2 hours)
    if (timeOnPage >= 1000 && timeOnPage <= 2 * 60 * 1000) {
      const page = currentEvent.url || "404";
      pageDurations.push(timeOnPage);

      if (!pageTimeMap[page]) {
        pageTimeMap[page] = [];
      }
      pageTimeMap[page].push(timeOnPage);
    }
  }

  // Handle the last event (time until session end)
  if (targetEvents.length > 0) {
    const lastEvent = targetEvents[targetEvents.length - 1];
    const lastAction = sessionActions[sessionActions.length - 1];

    const pageStart = new Date(lastEvent.created_at).getTime();
    const pageEnd = new Date(lastAction.created_at).getTime();
    const timeOnPage = pageEnd - pageStart;

    if (timeOnPage >= 1000 && timeOnPage <= 2 * 60 * 1000) {
      const page = lastEvent.url || "404";
      pageDurations.push(timeOnPage);

      if (!pageTimeMap[page]) {
        pageTimeMap[page] = [];
      }
      pageTimeMap[page].push(timeOnPage);
    }
  }

  return { pageTimeMap, pageDurations };
};

const userAnalyticsController = {
  // Track user session and interactions
  async trackSession(req, res) {
    try {
      const { path, referrer, viewport_width, viewport_height } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Generate or get session ID
      let sessionId = req.headers["x-session-id"] || generateSessionId();

      const sessionData = {
        user_id: userId,
        session_id: sessionId,
        path,
        referrer,
        user_agent: req.headers["user-agent"],
        ip_address: getClientIP(req),
        viewport_width,
        viewport_height,
      };

      const session = await UserAnalytics.createSession(sessionData);

      res.json({
        success: true,
        session_id: sessionId,
        session: session,
      });
    } catch (error) {
      console.error("Error tracking session:", error);
      res.status(500).json({ error: "Failed to track session" });
    }
  },

  // Update session when user leaves or changes page
  async updateSession(req, res) {
    try {
      const { session_id, time_spent } = req.body;

      if (!session_id) {
        return res.status(400).json({ error: "Session ID required" });
      }

      const updateData = {
        ended_at: new Date(),
        time_spent: time_spent || 0,
      };

      const updatedSession = await UserAnalytics.updateSession(
        session_id,
        updateData
      );

      res.json({
        success: true,
        session: updatedSession,
      });
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  },

  // Track mouse movements
  async trackMouseMovements(req, res) {
    try {
      const { session_id, movements } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!session_id || !movements || !Array.isArray(movements)) {
        return res
          .status(400)
          .json({ error: "Session ID and movements array required" });
      }

      // Add user_id and session_id to each movement
      const enrichedMovements = movements.map((movement) => ({
        ...movement,
        user_id: userId,
        session_id: session_id,
        timestamp: movement.timestamp || new Date(),
      }));

      const savedMovements = await UserAnalytics.createMouseMovements(
        enrichedMovements
      );

      res.json({
        success: true,
        movements_saved: savedMovements.length,
      });
    } catch (error) {
      console.error("Error tracking mouse movements:", error);
      res.status(500).json({ error: "Failed to track mouse movements" });
    }
  },

  // Track clicks
  async trackClicks(req, res) {
    try {
      const { session_id, clicks } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!session_id || !clicks || !Array.isArray(clicks)) {
        return res
          .status(400)
          .json({ error: "Session ID and clicks array required" });
      }

      // Add user_id and session_id to each click
      const enrichedClicks = clicks.map((click) => ({
        ...click,
        user_id: userId,
        session_id: session_id,
        timestamp: click.timestamp || new Date(),
        target_tag: click.target?.tagName,
        target_id: click.target?.id,
        target_class: click.target?.className,
        target_text: click.target?.textContent
          ? click.target.textContent.substring(0, 1000)
          : null,
      }));

      const savedClicks = await UserAnalytics.createClicks(enrichedClicks);

      res.json({
        success: true,
        clicks_saved: savedClicks.length,
      });
    } catch (error) {
      console.error("Error tracking clicks:", error);
      res.status(500).json({ error: "Failed to track clicks" });
    }
  },

  // Bulk tracking endpoint for efficiency
  async trackBulk(req, res) {
    try {
      const { session_id, movements, clicks, session_update } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const results = {};

      // Track movements if provided
      if (movements && Array.isArray(movements) && movements.length > 0) {
        const enrichedMovements = movements.map((movement) => ({
          ...movement,
          user_id: userId,
          session_id: session_id,
          timestamp: movement.timestamp || new Date(),
        }));

        const savedMovements = await UserAnalytics.createMouseMovements(
          enrichedMovements
        );
        results.movements_saved = savedMovements.length;
      }

      // Track clicks if provided
      if (clicks && Array.isArray(clicks) && clicks.length > 0) {
        const enrichedClicks = clicks.map((click) => ({
          ...click,
          user_id: userId,
          session_id: session_id,
          timestamp: click.timestamp || new Date(),
          target_tag: click.target?.tagName,
          target_id: click.target?.id,
          target_class: click.target?.className,
          target_text: click.target?.textContent
            ? click.target.textContent.substring(0, 1000)
            : null,
        }));

        const savedClicks = await UserAnalytics.createClicks(enrichedClicks);
        results.clicks_saved = savedClicks.length;
      }

      // Update session if provided
      if (session_update && session_id) {
        const updatedSession = await UserAnalytics.updateSession(
          session_id,
          session_update
        );
        results.session_updated = !!updatedSession;
      }

      res.json({ success: true, ...results });
    } catch (error) {
      console.error("Error in bulk tracking:", error);
      res.status(500).json({ error: "Failed to track bulk data" });
    }
  },

  // Get analytics data for current user
  async getMyAnalytics(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { start_date, end_date, path } = req.query;

      const filters = {};
      if (start_date) filters.startDate = new Date(start_date);
      if (end_date) filters.endDate = new Date(end_date);
      if (path) filters.path = path;

      const [
        sessions,
        pathAnalytics,
        clickAnalytics,
        movementAnalytics,
        activityTimeline,
      ] = await Promise.all([
        UserAnalytics.getAnalyticsByUser(userId, filters),
        UserAnalytics.getPathAnalytics(userId, filters),
        UserAnalytics.getClickAnalytics(userId, filters),
        UserAnalytics.getMouseMovementAnalytics(userId, filters),
        UserAnalytics.getActivityTimeline(userId, filters),
      ]);

      res.json({
        success: true,
        data: {
          sessions,
          pathAnalytics,
          clickAnalytics,
          movementAnalytics,
          activityTimeline,
        },
      });
    } catch (error) {
      console.error("Error getting user analytics:", error);
      res.status(500).json({ error: "Failed to get analytics data" });
    }
  },

  // Admin endpoint - get analytics for all users
  async getAllAnalytics(req, res) {
    try {
      // Check if user is admin
      const userRole = req.user?.role;
      if (!["padmin", "cadmin", "dev"].includes(userRole)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { start_date, end_date, user_id } = req.query;

      const filters = {};
      if (start_date) filters.startDate = new Date(start_date);
      if (end_date) filters.endDate = new Date(end_date);
      if (user_id) filters.userId = user_id;

      const analyticsData = await UserAnalytics.getAllUsersAnalytics(filters);

      res.json({
        success: true,
        data: analyticsData,
      });
    } catch (error) {
      console.error("Error getting all analytics:", error);
      res.status(500).json({ error: "Failed to get analytics data" });
    }
  },

  // Get analytics for specific user (admin only)
  async getUserAnalytics(req, res) {
    try {
      // Check if user is admin
      const userRole = req.user?.role;
      if (!["padmin", "cadmin", "dev"].includes(userRole)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { userId } = req.params;
      const { start_date, end_date, path } = req.query;

      const filters = {};
      if (start_date) filters.startDate = new Date(start_date);
      if (end_date) filters.endDate = new Date(end_date);
      if (path) filters.path = path;

      const [
        sessions,
        pathAnalytics,
        clickAnalytics,
        movementAnalytics,
        activityTimeline,
      ] = await Promise.all([
        UserAnalytics.getAnalyticsByUser(userId, filters),
        UserAnalytics.getPathAnalytics(userId, filters),
        UserAnalytics.getClickAnalytics(userId, filters),
        UserAnalytics.getMouseMovementAnalytics(userId, filters),
        UserAnalytics.getActivityTimeline(userId, filters),
      ]);

      res.json({
        success: true,
        data: {
          sessions,
          pathAnalytics,
          clickAnalytics,
          movementAnalytics,
          activityTimeline,
        },
      });
    } catch (error) {
      console.error("Error getting user analytics:", error);
      res.status(500).json({ error: "Failed to get user analytics data" });
    }
  },

  async updatePer10Seconds(req, res) {
    try {
      const { actions } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!Array.isArray(actions)) {
        return res.status(400).json({ error: "Actions must be an array" });
      }

      // Add user_id to each action
      const enrichedActions = actions.map((action) => ({
        ...action,
        user_id: userId,
      }));

      // Save actions to database using the new comprehensive tracking method
      const savedActions = await UserAnalytics.saveTrackingActions(
        enrichedActions
      );

      // Count actions by type for response
      const actionCounts = actions.reduce((acc, action) => {
        acc[action.type] = (acc[action.type] || 0) + 1;
        return acc;
      }, {});

      res.json({
        success: true,
        saved_count: savedActions.length,
        action_counts: actionCounts,
        message: `Successfully processed ${savedActions.length} actions`,
      });
    } catch (error) {
      console.error("Error updating per 10 seconds:", error);
      res.status(500).json({ error: "Failed to update per 10 seconds" });
    }
  },

  // ===== NEW TRACKING ACTIONS ENDPOINTS =====

  // Handle comprehensive tracking data from client
  async trackActions(req, res) {
    try {
      const actions = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!Array.isArray(actions)) {
        return res.status(400).json({ error: "Actions must be an array" });
      }

      // Add user_id to each action
      const enrichedActions = actions.map((action) => ({
        ...action,
        user_id: userId,
      }));

      // Save actions to database
      const savedActions = await UserAnalytics.saveTrackingActions(
        enrichedActions
      );

      res.json({
        success: true,
        saved_count: savedActions.length,
        message: `Successfully processed ${savedActions.length} actions`,
      });
    } catch (error) {
      console.error("Error tracking actions:", error);
      res.status(500).json({ error: "Failed to track actions" });
    }
  },

  // Get tracking statistics for current user
  async getMyTrackingStats(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { start_timestamp, end_timestamp } = req.query;

      const stats = await UserAnalytics.getTrackingStats(
        userId,
        start_timestamp ? parseInt(start_timestamp) : null,
        end_timestamp ? parseInt(end_timestamp) : null
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error getting tracking stats:", error);
      res.status(500).json({ error: "Failed to get tracking statistics" });
    }
  },

  // Get session timeline
  async getSessionTimeline(req, res) {
    try {
      const userId = req.user?.id;
      const { session_id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!session_id) {
        return res.status(400).json({ error: "Session ID required" });
      }

      const timeline = await UserAnalytics.getSessionTimeline(session_id);

      res.json({
        success: true,
        data: timeline,
      });
    } catch (error) {
      console.error("Error getting session timeline:", error);
      res.status(500).json({ error: "Failed to get session timeline" });
    }
  },

  // Get recent actions for current user
  async getMyRecentActions(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { limit = 50, action_type } = req.query;

      let actions;
      if (action_type) {
        actions = await UserAnalytics.getActionsByType(
          userId,
          action_type,
          parseInt(limit)
        );
      } else {
        actions = await UserAnalytics.getRecentActions(userId, parseInt(limit));
      }

      res.json({
        success: true,
        data: actions,
      });
    } catch (error) {
      console.error("Error getting recent actions:", error);
      res.status(500).json({ error: "Failed to get recent actions" });
    }
  },

  // Get user sessions
  async getMySessions(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { limit = 100 } = req.query;

      const sessions = await UserAnalytics.getUserSessions(
        userId,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      console.error("Error getting user sessions:", error);
      res.status(500).json({ error: "Failed to get user sessions" });
    }
  },

  // Get click heatmap data
  async getClickHeatmap(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { url, start_timestamp, end_timestamp } = req.query;

      const heatmapData = await UserAnalytics.getClickHeatmap(
        userId,
        url,
        start_timestamp ? parseInt(start_timestamp) : null,
        end_timestamp ? parseInt(end_timestamp) : null
      );

      res.json({
        success: true,
        data: heatmapData,
      });
    } catch (error) {
      console.error("Error getting click heatmap:", error);
      res.status(500).json({ error: "Failed to get click heatmap data" });
    }
  },

  // Admin endpoint - get tracking data for all users
  async getAllTrackingData(req, res) {
    try {
      // Check if user is admin
      const userRole = req.user?.role;
      if (!["padmin", "cadmin", "dev"].includes(userRole)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const {
        user_id,
        action_type,
        start_timestamp,
        end_timestamp,
        limit = 100,
      } = req.query;

      let actions;
      if (user_id && action_type) {
        actions = await UserAnalytics.getActionsByType(
          user_id,
          action_type,
          parseInt(limit)
        );
      } else if (user_id) {
        actions = await UserAnalytics.getRecentActions(
          user_id,
          parseInt(limit)
        );
      } else {
        // Get all recent actions (admin only)
        const query = `
          SELECT * FROM user_tracking_actions
          ORDER BY timestamp DESC
          LIMIT $1
        `;
        const { rows } = await pool.query(query, [parseInt(limit)]);
        actions = rows;
      }

      res.json({
        success: true,
        data: actions,
      });
    } catch (error) {
      console.error("Error getting all tracking data:", error);
      res.status(500).json({ error: "Failed to get tracking data" });
    }
  },

  // Get tracking data with stats - supports user_id filtering
  async getTrackingData(req, res) {
    try {
      // Check if user is admin
      const userRole = req.user?.role;
      if (!["padmin", "cadmin", "dev"].includes(userRole)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { user_id, limit = 1000, path, date_range } = req.query;

      let actions;
      let stats;
      let pageVisitsByPage = {};
      let clicksByPage = {};
      let activityTimeline = {};
      let recentClickActivity = [];

      // Build WHERE clause for filtering
      let whereConditions = [];
      let queryParams = [];
      let paramCount = 0;

      if (user_id) {
        paramCount++;
        whereConditions.push(`uta.user_id = $${paramCount}`);
        queryParams.push(user_id);
      }

      if (path && path !== "all") {
        paramCount++;
        whereConditions.push(`uta.url = $${paramCount}`);
        queryParams.push(path);
      }

      // Add date range filtering - default to today if no date_range provided
      if (!date_range || date_range === "today") {
        // Default to today
        const now = new Date();
        const startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const endDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1
        );

        paramCount++;
        whereConditions.push(`uta.created_at >= $${paramCount}`);
        queryParams.push(startDate.toISOString());

        paramCount++;
        whereConditions.push(`uta.created_at < $${paramCount}`);
        queryParams.push(endDate.toISOString());
      } else if (date_range !== "all") {
        const now = new Date();
        let startDate;
        let endDate;

        switch (date_range) {
          case "24h":
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            endDate = now;
            break;
          case "7d":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            endDate = now;
            break;
          case "30d":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            endDate = now;
            break;
          default:
            startDate = null;
            endDate = null;
        }

        if (startDate) {
          paramCount++;
          whereConditions.push(`uta.created_at >= $${paramCount}`);
          queryParams.push(startDate.toISOString());
        }

        if (endDate) {
          paramCount++;
          whereConditions.push(`uta.created_at <= $${paramCount}`);
          queryParams.push(endDate.toISOString());
        }
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      if (user_id) {
        // Get data for specific user with filters and user info
        const query = `
          SELECT uta.*, u.name as user_name, u.email as user_email
          FROM user_tracking_actions uta
          LEFT JOIN users u ON uta.user_id = u.id
          ${whereClause}
          ORDER BY uta.created_at DESC
          LIMIT $${paramCount + 1}
        `;
        const { rows } = await pool.query(query, [
          ...queryParams,
          parseInt(limit),
        ]);
        actions = rows;

        // Get stats for specific user with filters
        const statsQuery = `
          SELECT 
            COUNT(*) as total_actions,
            COUNT(CASE WHEN uta.action_type = 'page_view' OR uta.action_type = 'path_change' THEN 1 END) as page_views,
            COUNT(CASE WHEN uta.action_type = 'click' THEN 1 END) as clicks,
            COUNT(CASE WHEN uta.action_type = 'mousemove' THEN 1 END) as mouse_movements,
            COUNT(CASE WHEN uta.action_type = 'scroll' THEN 1 END) as scrolls,
            COUNT(CASE WHEN uta.action_type = 'keypress' THEN 1 END) as keypresses,
            COUNT(CASE WHEN uta.action_type = 'visibility_change' THEN 1 END) as visibility_changes,
            COUNT(CASE WHEN uta.action_type = 'path_change' THEN 1 END) as path_changes,
            COUNT(DISTINCT uta.session_id) as unique_sessions,
            COUNT(DISTINCT uta.url) as unique_urls,
            COALESCE(AVG(CASE WHEN uta.additional_data->>'timeOnPage' IS NOT NULL THEN (uta.additional_data->>'timeOnPage')::INTEGER END), 0) as avg_time_on_page,
            COALESCE(AVG(CASE WHEN uta.additional_data->>'sessionDuration' IS NOT NULL THEN (uta.additional_data->>'sessionDuration')::INTEGER END), 0) as avg_session_duration
          FROM user_tracking_actions uta
          ${whereClause}
        `;
        const statsResult = await pool.query(statsQuery, queryParams);
        stats = statsResult.rows[0];
      } else {
        // Get all data (admin only) with filters and user info
        const query = `
          SELECT uta.*, u.name as user_name, u.email as user_email
          FROM user_tracking_actions uta
          LEFT JOIN users u ON uta.user_id = u.id
          ${whereClause}
          ORDER BY uta.created_at DESC
          LIMIT $${paramCount + 1}
        `;
        const { rows } = await pool.query(query, [
          ...queryParams,
          parseInt(limit),
        ]);
        actions = rows;

        // Get aggregated stats for all users with filters
        const statsQuery = `
        SELECT 
          COUNT(*) as total_actions,
            COUNT(CASE WHEN uta.action_type = 'page_view' OR uta.action_type = 'path_change' THEN 1 END) as page_views,
            COUNT(CASE WHEN uta.action_type = 'click' THEN 1 END) as clicks,
            COUNT(CASE WHEN uta.action_type = 'mousemove' THEN 1 END) as mouse_movements,
            COUNT(CASE WHEN uta.action_type = 'scroll' THEN 1 END) as scrolls,
            COUNT(CASE WHEN uta.action_type = 'keypress' THEN 1 END) as keypresses,
            COUNT(CASE WHEN uta.action_type = 'visibility_change' THEN 1 END) as visibility_changes,
            COUNT(CASE WHEN uta.action_type = 'path_change' THEN 1 END) as path_changes,
            COUNT(DISTINCT uta.session_id) as unique_sessions,
            COUNT(DISTINCT uta.url) as unique_urls,
            COALESCE(AVG(CASE WHEN uta.additional_data->>'timeOnPage' IS NOT NULL THEN (uta.additional_data->>'timeOnPage')::INTEGER END), 0) as avg_time_on_page,
            COALESCE(AVG(CASE WHEN uta.additional_data->>'sessionDuration' IS NOT NULL THEN (uta.additional_data->>'sessionDuration')::INTEGER END), 0) as avg_session_duration
          FROM user_tracking_actions uta
        ${whereClause}
      `;
        const statsResult = await pool.query(statsQuery, queryParams);
        stats = statsResult.rows[0];
      }

      // Enhance actions with user names and better time data
      actions = actions.map((action) => ({
        ...action,
        additional_data: {
          ...action.additional_data,
          user_name: action.user_name,
          user_email: action.user_email,
          time_spent: action.additional_data?.time_spent || 0,
        },
      }));

      // Calculate session-based time data for better analytics
      const sessionTimeMap = {};
      const sessions = {};

      // Group actions by session
      actions.forEach((action) => {
        if (!sessions[action.session_id]) {
          sessions[action.session_id] = [];
        }
        sessions[action.session_id].push(action);
      });

      // Calculate session durations and time spent on each page
      Object.entries(sessions).forEach(([sessionId, sessionActions]) => {
        if (sessionActions.length > 1) {
          sessionActions.sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );

          // Group actions by URL to calculate time spent on each page
          const pageGroups = {};
          sessionActions.forEach((action) => {
            const url = action.url || "unknown";
            if (!pageGroups[url]) {
              pageGroups[url] = [];
            }
            pageGroups[url].push(action);
          });

          // Calculate time spent on each page
          Object.entries(pageGroups).forEach(([url, pageActions]) => {
            if (pageActions.length > 1) {
              const pageStart = new Date(pageActions[0].created_at).getTime();
              const pageEnd = new Date(
                pageActions[pageActions.length - 1].created_at
              ).getTime();
              const timeOnPage = pageEnd - pageStart;

              // Only include reasonable page durations (between 1 second and 2 hours)
              if (timeOnPage >= 1000 && timeOnPage <= 2 * 60 * 60 * 1000) {
                // Distribute page time among actions on that page
                const timePerAction = timeOnPage / pageActions.length;
                pageActions.forEach((action) => {
                  if (!sessionTimeMap[action.id]) {
                    sessionTimeMap[action.id] = 0;
                  }
                  sessionTimeMap[action.id] += timePerAction;
                });
              }
            }
          });
        }
      });

      // Update actions with calculated session time
      actions = actions.map((action) => ({
        ...action,
        additional_data: {
          ...action.additional_data,
          user_name: action.user_name,
          user_email: action.user_email,
          time_spent:
            sessionTimeMap[action.id] ||
            action.additional_data?.time_spent ||
            0,
          session_duration: sessionTimeMap[action.id] || 0,
        },
      }));

      // Calculate page visits by page
      actions.forEach((action) => {
        if (
          action.action_type === "page_view" ||
          action.action_type === "path_change"
        ) {
          const url = action.url || "unknown";
          pageVisitsByPage[url] = (pageVisitsByPage[url] || 0) + 1;
        }
      });

      // Calculate clicks by page
      actions.forEach((action) => {
        if (action.action_type === "click") {
          const url = action.url || "unknown";
          clicksByPage[url] = (clicksByPage[url] || 0) + 1;
        }
      });

      // Calculate activity timeline (clicks by hour)
      activityTimeline = {
        "0:00": 0,
        "1:00": 0,
        "2:00": 0,
        "3:00": 0,
        "4:00": 0,
        "5:00": 0,
        "6:00": 0,
        "7:00": 0,
        "8:00": 0,
        "9:00": 0,
        "10:00": 0,
        "11:00": 0,
        "12:00": 0,
        "13:00": 0,
        "14:00": 0,
        "15:00": 0,
        "16:00": 0,
        "17:00": 0,
        "18:00": 0,
        "19:00": 0,
        "20:00": 0,
        "21:00": 0,
        "22:00": 0,
        "23:00": 0,
      };

      actions.forEach((action) => {
        if (action.action_type === "click") {
          const hour = new Date(action.created_at).getHours();
          const hourKey = `${hour}:00`;
          activityTimeline[hourKey] = (activityTimeline[hourKey] || 0) + 1;
        }
      });

      // Get recent click activity (last 10 clicks)
      recentClickActivity = actions
        .filter((action) => action.action_type === "click")
        .slice(0, 10)
        .map((click) => ({
          created_at: click.created_at,
          url: click.url || "unknown",
          element_tag: click.element_tag || "unknown",
          element_id: click.element_id,
          position_x: click.position_x,
          position_y: click.position_y,
        }));

      // Calculate most visited page per count action type is visibility_change.
      const mostVisitedPage =
        actions.filter((a) => a.action_type === "visibility_change").length > 0
          ? actions
              .filter((a) => a.action_type === "visibility_change")
              .reduce((a, b) => (a.url.length > b.url.length ? a : b)).url
          : "";

      // Find most clicked page
      const mostClickedPage =
        Object.keys(clicksByPage).length > 0
          ? Object.keys(clicksByPage).reduce((a, b) =>
              clicksByPage[a] > clicksByPage[b] ? a : b
            )
          : "";

      // Calculate path change statistics
      const pathChanges = actions.filter(
        (a) => a.action_type === "path_change"
      );
      const pathChangeStats = {
        totalPathChanges: pathChanges.length,
        pathTransitions: {},
        mostFrequentPaths: {},
      };

      pathChanges.forEach((change) => {
        const fromPath = change.pathChange?.from || "unknown";
        const toPath = change.pathChange?.to || "unknown";

        // Track path transitions
        const transitionKey = `${fromPath} -> ${toPath}`;
        pathChangeStats.pathTransitions[transitionKey] =
          (pathChangeStats.pathTransitions[transitionKey] || 0) + 1;

        // Track most frequent destination paths
        pathChangeStats.mostFrequentPaths[toPath] =
          (pathChangeStats.mostFrequentPaths[toPath] || 0) + 1;
      });

      // Sort most frequent paths by count
      pathChangeStats.mostFrequentPaths = Object.entries(
        pathChangeStats.mostFrequentPaths
      )
        .sort(([, a], [, b]) => b - a)
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});

      // Calculate time metrics
      const timeMetrics = userAnalyticsController.calculateTimeMetrics(actions);

      console.log("Time metrics calculated:", {
        averageTimeOnPage: Math.round(timeMetrics.averageTimeOnPage / 1000),
        averageTimeOnSite: Math.round(timeMetrics.averageTimeOnSite / 1000),
        totalSessions: timeMetrics.totalSessions,
        totalPageViews: timeMetrics.totalPageViews,
      });

      // Calculate chart data on backend
      const monthlyAvgTimeChartData =
        userAnalyticsController.calculateMonthlyAvgTimeChartData(actions);
      const topUsersChartData =
        userAnalyticsController.calculateTopUsersChartData(actions);
      const monthOverMonthChartData =
        userAnalyticsController.calculateMonthOverMonthChartData(actions);
      const topPagesByTimeChartData =
        userAnalyticsController.calculateTopPagesByTimeChartData(actions);

      console.log("Analytics response data:", {
        actionsCount: actions.length,
        timeMetrics: timeMetrics,
        pageVisitsByPage: Object.keys(pageVisitsByPage).length,
        clicksByPage: Object.keys(clicksByPage).length,
        chartData: {
          monthlyAvgTime: monthlyAvgTimeChartData.labels.length,
          topUsers: topUsersChartData.labels.length,
          monthOverMonth: monthOverMonthChartData.labels.length,
        },
      });

      res.json({
        success: true,
        data: {
          stats: stats,
          analytics: {
            totalPaths: Object.keys(pageVisitsByPage).length,
            totalMouseMovements: actions.filter(
              (a) => a.action_type === "mousemove"
            ).length,
            totalClicks: actions.filter((a) => a.action_type === "click")
              .length,
            pathFrequency: pageVisitsByPage,
            clicksByPath: clicksByPage,
            movementsByPath: {},
            mostVisitedPath: mostVisitedPage,
            mostClickedPath: mostClickedPage,
          },
          pageVisitsByPage: pageVisitsByPage,
          clicksByPage: clicksByPage,
          activityTimeline: activityTimeline,
          recentClickActivity: recentClickActivity,
          pathChangeStats: pathChangeStats,
          timeMetrics: timeMetrics,
          chartData: {
            monthlyAvgTime: monthlyAvgTimeChartData,
            topUsers: topUsersChartData,
            monthOverMonth: monthOverMonthChartData,
            topPagesByTime: topPagesByTimeChartData,
          },
          filters: {
            user_id: user_id || null,
            path: path || null,
            date_range: date_range || null,
            limit: parseInt(limit),
          },
        },
      });
    } catch (error) {
      console.error("Error getting tracking data:", error);
      res.status(500).json({ error: "Failed to get tracking data" });
    }
  },

  // Get unique paths for filtering
  async getUniquePaths(req, res) {
    try {
      // Check if user is admin
      const userRole = req.user?.role;
      if (!["padmin", "cadmin", "dev"].includes(userRole)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { user_id } = req.query;

      let whereClause = "";
      let queryParams = [];

      if (user_id) {
        whereClause = "WHERE user_id = $1";
        queryParams.push(user_id);
      }

      const query = `
        SELECT DISTINCT url 
        FROM user_tracking_actions 
        ${whereClause}
        AND url IS NOT NULL 
        AND url != ''
        ORDER BY url
      `;

      const { rows } = await pool.query(query, queryParams);
      const paths = rows.map((row) => row.url).filter(Boolean);

      res.json({
        success: true,
        data: paths,
      });
    } catch (error) {
      console.error("Error getting unique paths:", error);
      res.status(500).json({ error: "Failed to get unique paths" });
    }
  },

  // Calculate time metrics from tracking actions - ITEM-BASED APPROACH
  calculateTimeMetrics(actions) {
    const timeMetrics = {
      averageTimeOnPage: 0,
      averageTimeOnSite: 0,
      totalSessions: 0,
      totalPageViews: 0,
      timeByPage: {},
      totalTimeByPage: {},
    };

    if (!actions || actions.length === 0) {
      return timeMetrics;
    }

    // Sort all actions by timestamp
    const sortedActions = actions.sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    // Group actions by session
    const sessions = {};
    sortedActions.forEach((action) => {
      if (!sessions[action.session_id]) {
        sessions[action.session_id] = [];
      }
      sessions[action.session_id].push(action);
    });

    // Calculate metrics for each session
    const sessionDurations = [];
    const pageDurations = [];
    const pageTimeMap = {};

    Object.values(sessions).forEach((sessionActions) => {
      // Sort actions by timestamp
      sessionActions.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      // Calculate session duration
      const sessionStart = new Date(sessionActions[0].created_at);
      const sessionEnd = new Date(
        sessionActions[sessionActions.length - 1].created_at
      );
      const sessionDuration = sessionEnd - sessionStart;
      sessionDurations.push(sessionDuration);

      // ITEM-BASED TIME CALCULATION using helper function
      const {
        pageTimeMap: sessionPageTimeMap,
        pageDurations: sessionPageDurations,
      } = calculateTimeByActionTypes(sessionActions, [
        "page_view",
        "path_change",
        "visibility_change",
      ]);

      // Merge session page data into global page data
      pageDurations.push(...sessionPageDurations);
      Object.entries(sessionPageTimeMap).forEach(([page, durations]) => {
        if (!pageTimeMap[page]) {
          pageTimeMap[page] = [];
        }
        pageTimeMap[page].push(...durations);
      });
    });

    // Calculate averages
    timeMetrics.totalSessions = sessionDurations.length;
    timeMetrics.totalPageViews = pageDurations.length;

    if (sessionDurations.length > 0) {
      timeMetrics.averageTimeOnSite =
        sessionDurations.reduce((sum, duration) => sum + duration, 0) /
        sessionDurations.length;
    }

    if (pageDurations.length > 0) {
      timeMetrics.averageTimeOnPage =
        pageDurations.reduce((sum, duration) => sum + duration, 0) /
        pageDurations.length;
    }

    // Calculate average time per page
    Object.keys(pageTimeMap).forEach((page) => {
      const durations = pageTimeMap[page];
      timeMetrics.timeByPage[page] =
        durations.reduce((sum, duration) => sum + duration, 0) /
        durations.length;
      timeMetrics.totalTimeByPage[page] = durations.reduce(
        (sum, duration) => sum + duration,
        0
      );
    });

    return timeMetrics;
  },

  // Calculate Monthly Average Time in App chart data
  calculateMonthlyAvgTimeChartData(actions) {
    if (!actions || actions.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Group actions by session and calculate session durations
    const sessions = {};

    // Group actions by session
    actions.forEach((action) => {
      if (!sessions[action.session_id]) {
        sessions[action.session_id] = {
          actions: [],
          startTime: new Date(action.created_at).getTime(),
          endTime: new Date(action.created_at).getTime(),
        };
      }
      sessions[action.session_id].actions.push(action);

      // Update start and end times
      const actionTime = new Date(action.created_at).getTime();
      if (actionTime < sessions[action.session_id].startTime) {
        sessions[action.session_id].startTime = actionTime;
      }
      if (actionTime > sessions[action.session_id].endTime) {
        sessions[action.session_id].endTime = actionTime;
      }
    });

    // Calculate session durations and group by month
    const monthlyData = {};

    Object.values(sessions).forEach((session) => {
      const sessionDuration = session.endTime - session.startTime;
      const firstAction = session.actions[0];
      const date = new Date(firstAction.created_at).toISOString().slice(0, 7); // YYYY-MM

      // Only include reasonable session durations (between 1 second and 8 hours)
      if (sessionDuration >= 1000 && sessionDuration <= 8 * 60 * 60 * 1000) {
        if (!monthlyData[date]) {
          monthlyData[date] = { totalTime: 0, userCount: 0, sessionCount: 0 };
        }

        monthlyData[date].totalTime += sessionDuration;
        monthlyData[date].sessionCount += 1;
      }
    });

    // Count unique users per month
    Object.keys(monthlyData).forEach((month) => {
      const uniqueUsers = new Set(
        actions
          .filter(
            (a) => new Date(a.created_at).toISOString().slice(0, 7) === month
          )
          .map((a) => a.user_id)
      );
      monthlyData[month].userCount = uniqueUsers.size;
    });

    const sortedMonths = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        avgTime: data.userCount > 0 ? data.totalTime / data.userCount : 0,
      }));

    // Only return data if we have real time metrics
    if (sortedMonths.every(({ avgTime }) => avgTime === 0)) {
      return { labels: [], datasets: [] };
    }

    return {
      labels: sortedMonths.map(({ month }) => month),
      datasets: [
        {
          label: "Average Time in App (seconds)",
          data: sortedMonths.map(({ avgTime }) => Math.round(avgTime / 1000)),
          backgroundColor: "rgba(100, 102, 241, 0.8)",
          borderColor: "rgb(100, 102, 241)",
          borderWidth: 1,
        },
      ],
    };
  },

  // Calculate Top 5 Users (by Time in App) chart data
  calculateTopUsersChartData(actions) {
    if (!actions || actions.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Group actions by session and calculate session durations
    const sessions = {};

    // Group actions by session
    actions.forEach((action) => {
      if (!sessions[action.session_id]) {
        sessions[action.session_id] = {
          actions: [],
          startTime: new Date(action.created_at).getTime(),
          endTime: new Date(action.created_at).getTime(),
        };
      }
      sessions[action.session_id].actions.push(action);

      // Update start and end times
      const actionTime = new Date(action.created_at).getTime();
      if (actionTime < sessions[action.session_id].startTime) {
        sessions[action.session_id].startTime = actionTime;
      }
      if (actionTime > sessions[action.session_id].endTime) {
        sessions[action.session_id].endTime = actionTime;
      }
    });

    // Calculate total time per user
    const userTimeMap = {};
    const userNameMap = {};

    Object.values(sessions).forEach((session) => {
      const sessionDuration = session.endTime - session.startTime;
      const firstAction = session.actions[0];
      const userId = firstAction.user_id;

      // Only include reasonable session durations
      if (sessionDuration >= 1000 && sessionDuration <= 8 * 60 * 60 * 1000) {
        if (!userTimeMap[userId]) {
          userTimeMap[userId] = 0;
        }
        userTimeMap[userId] += sessionDuration;

        // Store user name if available
        if (firstAction.additional_data?.user_name) {
          userNameMap[userId] = firstAction.additional_data.user_name;
        }
      }
    });

    const sortedUsers = Object.entries(userTimeMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return {
      labels: sortedUsers.map(
        ([userId]) => userNameMap[userId] || `User ${userId.slice(0, 8)}`
      ),
      datasets: [
        {
          label: "Total Time (seconds)",
          data: sortedUsers.map(([, ms]) => Math.round(ms / 1000)),
          backgroundColor: "rgba(34, 197, 94, 0.8)",
          borderColor: "rgb(34, 197, 94)",
          borderWidth: 1,
        },
      ],
    };
  },

  // Calculate Month Over Month Avg Time in App Per Person chart data
  calculateMonthOverMonthChartData(actions) {
    if (!actions || actions.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Debug: actions count

    // Group actions by session and calculate session durations
    const sessions = {};

    // Group actions by session
    actions.forEach((action) => {
      if (!sessions[action.session_id]) {
        sessions[action.session_id] = {
          actions: [],
          startTime: new Date(action.created_at).getTime(),
          endTime: new Date(action.created_at).getTime(),
        };
      }
      sessions[action.session_id].actions.push(action);

      // Update start and end times
      const actionTime = new Date(action.created_at).getTime();
      if (actionTime < sessions[action.session_id].startTime) {
        sessions[action.session_id].startTime = actionTime;
      }
      if (actionTime > sessions[action.session_id].endTime) {
        sessions[action.session_id].endTime = actionTime;
      }
    });

    // Group sessions by user and month
    const userMonthlyData = {};

    Object.values(sessions).forEach((session) => {
      const sessionDuration = session.endTime - session.startTime;
      const firstAction = session.actions[0];
      const userId = firstAction.user_id;
      const date = new Date(firstAction.created_at).toISOString().slice(0, 7); // YYYY-MM

      // Only include reasonable session durations
      if (sessionDuration >= 1000 && sessionDuration <= 8 * 60 * 60 * 1000) {
        if (!userMonthlyData[userId]) {
          userMonthlyData[userId] = {};
        }
        if (!userMonthlyData[userId][date]) {
          userMonthlyData[userId][date] = 0;
        }
        userMonthlyData[userId][date] += sessionDuration;
      }
    });

    // Get all unique months from data
    const allMonths = new Set();
    Object.values(userMonthlyData).forEach((userData) => {
      Object.keys(userData).forEach((month) => allMonths.add(month));
    });

    // Generate months from January to December of current year
    const currentYear = new Date().getFullYear();
    const janToDecMonths = [];
    for (let month = 0; month < 12; month++) {
      const date = new Date(currentYear, month, 1);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      janToDecMonths.push(monthKey);
    }

    // Use January to December months, but include any additional months from data if they exist
    const sortedMonths = [
      ...new Set([...janToDecMonths, ...Array.from(allMonths)]),
    ].sort();

    // Create datasets for top 5 users
    const topUsers = Object.entries(userMonthlyData)
      .map(([userId, userData]) => ({
        userId,
        totalTime: Object.values(userData).reduce((sum, time) => sum + time, 0),
      }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 5);

    const colors = [
      "rgba(99, 102, 241, 0.8)",
      "rgba(34, 197, 94, 0.8)",
      "rgba(239, 68, 68, 0.8)",
      "rgba(245, 158, 11, 0.8)",
      "rgba(168, 85, 247, 0.8)",
    ];

    return {
      labels: sortedMonths,
      datasets: topUsers.map((user, index) => ({
        label: `User ${user.userId.slice(0, 8)}`,
        data: sortedMonths.map((month) => {
          const timeInSeconds = userMonthlyData[user.userId][month] || 0;
          return Math.round(timeInSeconds / 1000);
        }),
        borderColor: colors[index % colors.length].replace("0.8", "1"),
        backgroundColor: colors[index % colors.length],
        borderWidth: 2,
        fill: false,
        tension: 0.4,
      })),
    };
  },

  // Calculate Top Pages with Most Time chart data - ITEM-BASED APPROACH
  calculateTopPagesByTimeChartData(actions) {
    if (!actions || actions.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Sort all actions by timestamp
    const sortedActions = actions.sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    // Group actions by session
    const sessions = {};
    sortedActions.forEach((action) => {
      if (!sessions[action.session_id]) {
        sessions[action.session_id] = [];
      }
      sessions[action.session_id].push(action);
    });

    // Calculate total time per page using item-based approach
    const pageTimeMap = {};

    Object.values(sessions).forEach((sessionActions) => {
      const { pageTimeMap: sessionPageTimeMap } = calculateTimeByActionTypes(
        sessionActions,
        ["page_view", "path_change", "visibility_change"]
      );

      // Sum up total time per page
      Object.entries(sessionPageTimeMap).forEach(([page, durations]) => {
        const totalTime = durations.reduce(
          (sum, duration) => sum + duration,
          0
        );
        if (!pageTimeMap[page]) {
          pageTimeMap[page] = 0;
        }
        pageTimeMap[page] += totalTime;
      });
    });

    // Get top 5 pages by total time
    const sortedPages = Object.entries(pageTimeMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return {
      labels: sortedPages.map(([page]) => page),
      datasets: [
        {
          label: "Total Time (seconds)",
          data: sortedPages.map(([, ms]) => Math.round(ms / 1000)),
          backgroundColor: "rgba(239, 68, 68, 0.8)",
          borderColor: "rgb(239, 68, 68)",
          borderWidth: 1,
        },
      ],
    };
  },
};

module.exports = userAnalyticsController;
