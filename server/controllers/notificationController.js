const pool = require("../config/database");

exports.getNotification = async (req, res) => {
    try {
        // const { limit, offset } = req.body;       
        const userId = req.user.id;

        // const result = await pool.query("SELECT * FROM notifications WHERE user_id = $1 AND deleted = FALSE ORDER BY id DESC LIMIT $2 OFFSET $3", [userId, limit, offset]);
        const result = await pool.query("SELECT * FROM notifications WHERE user_id = $1 AND deleted = FALSE ORDER BY id DESC ", [userId]);
        await pool.query(` WITH rows_to_update AS (
          SELECT id
          FROM notifications
          WHERE user_id = $1 AND deleted = FALSE 
          ORDER BY id DESC
         
      )
      UPDATE notifications
      SET checked = TRUE
      FROM rows_to_update
      WHERE notifications.id = rows_to_update.id`, [userId]);
      
        res.status(200).json({
            success: true,
            notifications: result.rows,
        });
    } catch (error) {
        console.error('Fetch Notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notification'
        });
    }
}

exports.isNewNotification = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query("SELECT * FROM notifications WHERE user_id = $1 AND deleted = FALSE AND checked = FALSE", [userId]);
        
        res.status(200).json({
            success: true,
            isNews: !!result.rows.length,
            count: result.rows.length,
        });
    } catch (error) {
        console.error('Fetch New Notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch new notification'
        });
    }
}


exports.removeNotification = async (req, res) => {
    const { notificationId } = req.body;
    try {

        const result = await pool.query("DELETE FROM notifications WHERE id = $1", [notificationId]);

        res.status(200).json({
            success: true,
            notifications: result.rows,
        });
    }
    catch (error) {
        console.error('Delete Notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete notification'
        });
    }

}