const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

// Check if file exists
router.get('/check/:filename', authenticateToken, (req, res) => {
    try {
        const { filename } = req.params;

        // Additional validation for research files
        if (!filename.match(/^research-[\w-]+\.docx$/)) {
            return res.status(400).json({
                exists: false,
                message: 'Invalid filename format'
            });
        }

        // Sanitize filename to prevent directory traversal attacks
        const sanitizedFilename = path.basename(filename);
        const filePath = path.join(__dirname, '../public/files', sanitizedFilename);

        // Check if file exists
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                return res.json({
                    exists: false,
                    message: 'Research file not found'
                });
            }

            // Optional: Check file size and other properties
            fs.stat(filePath, (statErr, stats) => {
                if (statErr) {
                    return res.json({
                        exists: false,
                        message: 'File access error'
                    });
                }

                res.json({
                    exists: true,
                    message: 'Research file is available',
                    filename: sanitizedFilename,
                    size: stats.size,
                    modified: stats.mtime
                });
            });
        });

    } catch (error) {
        console.error('Error checking file:', error);
        res.status(500).json({
            exists: false,
            message: 'Error checking file existence'
        });
    }
});

module.exports = router; 