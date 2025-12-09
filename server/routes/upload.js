const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload_file');
const multer = require('multer');
const AWS = require('aws-sdk');

// Endpoint for file uploads with progress tracking
router.post('/file', authenticateToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Return file information with fileUrl for client compatibility
        const fileUrl = `${process.env.API_BASE_URL}/api/files/${req.file.filename}`;
        res.status(200).json({
            success: true,
            fileUrl: fileUrl,
            file: {
                filename: req.file.filename,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                path: req.file.path.replace('public', '')
            }
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ success: false, message: 'Error uploading file' });
    }
});

// New: Upload PDF directly to S3 and return the S3 URL
const memoryUpload = multer({ storage: multer.memoryStorage() });
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

router.post('/pdf', authenticateToken, memoryUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const isPdf = req.file.mimetype === 'application/pdf' || (req.file.originalname || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return res.status(400).json({ success: false, message: 'Only PDF files are allowed' });
    }

    const key = `pdf/${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: 'application/pdf',
    };

    const { Location } = await s3.upload(params).promise();

    return res.status(200).json({ success: true, url: Location, key });
  } catch (error) {
    console.error('Error uploading PDF to S3:', error);
    return res.status(500).json({ success: false, message: 'Error uploading PDF' });
  }
});

// Get file by filename
router.get('/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        
        // Sanitize filename to prevent directory traversal attacks
        const sanitizedFilename = path.basename(filename);
        const filePath = path.join(__dirname, '../../public/files', sanitizedFilename);

        // Check if file exists
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found'
                });
            }

            // Send the file
            res.sendFile(filePath);
        });
    } catch (error) {
        console.error('Error retrieving file:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving file'
        });
    }
});

module.exports = router;

