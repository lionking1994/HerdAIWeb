const pool = require('../config/database');

exports.getAllLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const usernameSearch = req.query.filter || '';
        
        // Set default date range from yesterday to now if not provided
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const fromDate = req.query.from_date || yesterday.toISOString();
        const toDate = req.query.to_date || now.toISOString();

        const logs = await pool.query(
            'SELECT * FROM request_logs WHERE username != $1 AND username ILIKE $2 AND timestamp BETWEEN $3 AND $4 ORDER BY timestamp DESC LIMIT $5 OFFSET $6',
            ['anonymous', `%${usernameSearch}%`, fromDate, toDate, limit, offset]
        );

        const totalCount = await pool.query(
            'SELECT COUNT(*) FROM request_logs WHERE username != $1 AND username ILIKE $2 AND timestamp BETWEEN $3 AND $4',
            ['anonymous', `%${usernameSearch}%`, fromDate, toDate]
        );
        const totalPages = Math.ceil(totalCount.rows[0].count / limit);

        res.json({
            logs: logs.rows,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: parseInt(totalCount.rows[0].count),
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};
