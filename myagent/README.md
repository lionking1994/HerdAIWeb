# HerdAI Agent - Conversational AI Assistant

HerdAI Agent is an intelligent conversational AI system that combines ElevenLabs' voice technology with advanced meeting search and research capabilities. The system consists of a Next.js web application and a FastAPI backend server that work together to provide contextual AI conversations based on historical meeting data and research documents.

## 🚀 Features

- **Voice-Powered Conversations**: Real-time voice interactions using ElevenLabs' advanced text-to-speech and speech-to-text technology
- **Meeting Search**: AI-powered semantic search through historical meeting transcripts and summaries using Pinecone vector database
- **Research Integration**: Access to research documents and contextual information during conversations
- **Dynamic Voice Selection**: Choose from various English voice models with preview functionality
- **Auto-Start Conversations**: URL-based auto-start functionality with pre-configured parameters
- **Responsive UI**: Modern, accessible interface built with Next.js, Tailwind CSS, and Framer Motion

## 🏗️ Architecture

The project consists of two main components:

### Frontend (Next.js Web App)
- **Technology**: Next.js 14, React 18, Tailwind CSS, Framer Motion
- **Key Features**: Voice assistant interface, meeting search integration, responsive design
- **Main Components**: VoiceAssistant, Auto-start functionality, Meeting search UI

### Backend (Tools Server)
- **Technology**: FastAPI, Python 3.8+
- **Services**: Pinecone vector search, OpenAI GPT integration, PostgreSQL database
- **Endpoints**: Meeting search, research document retrieval, summary generation

## 📋 Prerequisites

### For the Web App:
- Node.js 18+ 
- npm or yarn package manager

### For the Tools Server:
- Python 3.8+
- PostgreSQL database
- Pinecone account and API key
- OpenAI API key

### Environment Variables Required:
- `NEXT_PUBLIC_ELEVENLABS_API_KEY`: ElevenLabs API key
- `NEXT_PUBLIC_TOOLS_SERVER_HOST`: Tools server URL
- `NEXT_PUBLIC_TOOLS_API_KEY`: API key for tools server
- `PINECONE_API_KEY`: Pinecone vector database API key
- `PINECONE_INDEX_NAME`: Name of your Pinecone index
- `OPENAI_API_KEY`: OpenAI API key for embeddings and summaries
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL connection details

## 🚀 Deployment Guide

### 1. Deploy the Tools Server (Backend)

#### Local Development:
```bash
# Navigate to tools server directory
cd tools-server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# Run the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Production Deployment (Docker):
```bash
# Create Dockerfile in tools-server directory
cat > tools-server/Dockerfile << EOF
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

# Build and run
cd tools-server
docker build -t herd-ai-tools-server .
docker run -p 8000:8000 --env-file .env herd-ai-tools-server
```

#### Production Deployment (Cloud):
For cloud deployment, you can use:
- **AWS**: Deploy using ECS, Lambda, or EC2 with Application Load Balancer
- **Google Cloud**: Deploy using Cloud Run or Compute Engine
- **Heroku**: Use the Heroku CLI with the provided Dockerfile
- **DigitalOcean**: Use App Platform or Droplets

### 2. Deploy the Web Application (Frontend)

#### Local Development:
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual values

# Run development server
npm run dev

# The app will be available at http://localhost:3000
```

#### Production Deployment:

**Option 1: Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Add all required NEXT_PUBLIC_* variables
```

**Option 2: Docker**
```bash
# Create Dockerfile in root directory
cat > Dockerfile << EOF
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
EOF

# Build and run
docker build -t herd-ai-webapp .
docker run -p 3000:3000 --env-file .env.local herd-ai-webapp
```

**Option 3: Static Export**
```bash
# Add to next.config.mjs
output: 'export'

# Build static files
npm run build

# Deploy the 'out' directory to any static hosting service
# (Netlify, GitHub Pages, AWS S3, etc.)
```

## 🔧 Configuration

### Environment Variables

Create `.env.local` for the web app:
```env
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_api_key
NEXT_PUBLIC_TOOLS_SERVER_HOST=https://your-tools-server-url.com
NEXT_PUBLIC_TOOLS_API_KEY=your-secret-api-key-here
```

Create `.env` for the tools server:
```env
API_KEY=your-secret-api-key-here
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=meetings-history
OPENAI_API_KEY=your_openai_api_key
DB_HOST=localhost
DB_PORT=5432
DB_NAME=herdai
DB_USER=postgres
DB_PASSWORD=your_db_password
```

### Auto-Start URLs

You can create direct conversation links using URL parameters:
```
/auto-start?user_name=John%20Doe&user_id=123&topics=Project%20planning&voice_id=voice_id_here&avatar_url=optional_avatar_url
```

## 📚 API Documentation

The tools server provides the following endpoints:

- `POST /search-meetings`: Search through meeting transcripts
- `POST /get-research-documents`: Retrieve research documents for a user
- `GET /health`: Health check endpoint
