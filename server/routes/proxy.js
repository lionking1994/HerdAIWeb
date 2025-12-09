const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Proxy route for PDF files to handle CORS
router.get('/proxy-pdf', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Fetch the PDF from the external URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Failed to fetch PDF: ${response.statusText}` 
      });
    }

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    // Stream the PDF content
    response.body.pipe(res);
  } catch (error) {
    console.error('Error proxying PDF:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
