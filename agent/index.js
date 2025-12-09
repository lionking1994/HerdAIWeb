import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { WorkflowManager } from './langgraph/dist/graph.js';

dotenv.config();

const workflowManager = new WorkflowManager();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static('public'));

// API key middleware
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
    }
    
    next();
};

app.post('/api/graph/:requestId/init', authenticateApiKey, async (req, res) => {
    const requestId = req.params.requestId;
    const { email } = req.body;
    
    if (!email || !requestId) {
        return res.status(404).send('');
    }

    console.log(`[${new Date().toISOString()}] Init request - RequestID: ${requestId}, Email: ${email}`);

    try {
        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        await workflowManager.setState(requestId, email);
        const stream = await workflowManager.invoke("Hi!", requestId);
        
        // Handle connection close
        req.on('close', () => {
            res.end();
        });

        res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

        for await (const chunk of stream) {
            if (chunk[0] && chunk[0].constructor.name === 'AIMessageChunk' && chunk[0].content) {
                res.write(`data: ${JSON.stringify({ 
                    type: 'chunk', 
                    content: chunk[0].content 
                })}\n\n`);
            }
        }

        res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Graph Initialization error:', error);
        res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error.message 
        })}\n\n`);
        res.end();
    }
});

app.post('/api/graph/:requestId/invoke', authenticateApiKey, async (req, res) => {
    const requestId = req.params.requestId;
    const { query } = req.body;
    if (!query) {
        return res.json({ error: 'Query is required' });
    }
    
    if (!requestId) {
        return res.status(404).send('');
    }

    console.log(`[${new Date().toISOString()}] Invoke request - RequestID: ${requestId}, Query: ${query}`);

    try {
        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = await workflowManager.invoke(query, requestId);
        
        // Handle connection close
        req.on('close', () => {
            res.end();
        });

        res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

        for await (const chunk of stream) {
            if (chunk[0] && chunk[0].constructor.name === 'AIMessageChunk' && chunk[0].content) {
                res.write(`data: ${JSON.stringify({ 
                    type: 'chunk', 
                    content: chunk[0].content 
                })}\n\n`);
            }
        }

        res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Graph invocation error:', error);
        res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error.message 
        })}\n\n`);
        res.end();
    }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});