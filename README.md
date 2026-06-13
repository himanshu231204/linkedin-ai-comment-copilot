<div align="center">

# LinkedIn AI Comment Copilot

### AI-Powered Chrome Extension for Intelligent LinkedIn Engagement

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-green.svg)](https://python.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-orange.svg)](https://langchain-ai.github.io/langgraph/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Async-blue.svg)](https://fastapi.tiangolo.com/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-yellow.svg)](https://developer.chrome.com/docs/extensions/mv3/)

*Generate context-aware, human-like LinkedIn comments in real time using a LangGraph multi-agent workflow powered by LLMGateway.*

[Features](#features) | [Architecture](#architecture) | [Quick Start](#quick-start) | [API Reference](#api-reference) | [Extension Setup](#extension-setup)

</div>

---

## Overview

LinkedIn AI Comment Copilot is a full-stack application consisting of a **Chrome Extension** and a **FastAPI backend** that work together to analyze LinkedIn posts and generate high-quality, context-aware comments. The system uses a **LangGraph multi-agent workflow** with four specialized agents to ensure every comment is relevant, professional, and human-sounding.

**Key highlights:**
- No database required
- No user authentication
- No data storage — everything runs in real time
- Smart model routing based on post content and complexity
- Multiple comment tones to match your style

---

## Features

| Feature | Description |
|---------|-------------|
| **Post Detection** | Automatically detects all visible LinkedIn posts on your feed |
| **AI Comment Button** | Injects a "Generate AI Comment" button under every post |
| **Tone Selector** | Choose from 10 comment tones: Professional, Technical, Supportive, Networking, Thoughtful, Friendly, Encouraging, Curious, Founder, Recruiter |
| **Smart Model Routing** | Automatically selects the optimal LLM (Gemini Flash, Claude Sonnet 4, or GPT-5.5) based on post content |
| **One-Click Copy** | Copy generated comments to clipboard instantly |
| **Insert to LinkedIn** | Automatically fills the LinkedIn comment box with one click |
| **Regenerate** | Generate alternative variations with a single click |
| **Quality Review** | Built-in reviewer agent scores and approves comments before delivery |

---

## Architecture

### System Flow

```mermaid
graph TD
    A[LinkedIn Page] -->|Detects Posts| B[Chrome Extension]
    B -->|Extracts Content| C[Content Script]
    C -->|"Click 'Generate AI Comment'"| D[Background Service Worker]
    D -->|"POST /generate-comment"| E[FastAPI Backend]
    E -->|Invokes| F[LangGraph Workflow]
    
    F --> G[1. Analyzer Agent]
    G -->|Classifies post type,<br>category, sentiment| H[2. Planner Agent]
    H -->|Determines comment<br>strategy| I[3. Writer Agent]
    I -->|Generates comment| J[4. Reviewer Agent]
    
    J -->|Approved| K[Return Comment]
    J -->|Rejected| I
    
    K --> E
    E -->|Response| D
    D -->|Display| L[Extension Popup]
    L -->|Copy / Insert| M[User Action]
    
    style A fill:#0A66C2,color:#fff
    style F fill:#FF6B35,color:#fff
    style G fill:#2196F3,color:#fff
    style H fill:#9C27B0,color:#fff
    style I fill:#4CAF50,color:#fff
    style J fill:#FF9800,color:#fff
```

### LangGraph Agent Pipeline

```mermaid
graph LR
    A[Post Content] --> B[Analyzer]
    B -->|post_type, category, sentiment| C[Planner]
    C -->|strategy| D[Writer]
    D -->|generated_comment| E[Reviewer]
    E -->|score >= threshold| F[Final Comment]
    E -->|score < threshold| D
    
    style A fill:#E3F2FD
    style B fill:#2196F3,color:#fff
    style C fill:#9C27B0,color:#fff
    style D fill:#4CAF50,color:#fff
    style E fill:#FF9800,color:#fff
    style F fill:#057642,color:#fff
```

### Model Router Logic

```mermaid
graph TD
    A[LinkedIn Post] --> B{Post Length < 400 chars?}
    B -->|Yes| C[Gemini 2.5 Flash<br>Fast & Cheap]
    B -->|No| D{Contains Technical<br>Keywords?}
    D -->|Yes| E[Claude Sonnet 4<br>Technical Expertise]
    D -->|No| F[GPT-5.5<br>Premium Quality]
    
    style C fill:#4CAF50,color:#fff
    style E fill:#9C27B0,color:#fff
    style F fill:#2196F3,color:#fff
```

### Project Structure

```
linkedin-ai-comment-copilot/
├── backend/
│   ├── main.py                    # FastAPI application entry point
│   ├── agents/
│   │   ├── analyzer.py            # Post classification agent
│   │   ├── planner.py             # Comment strategy planner
│   │   ├── writer.py              # Comment generation agent
│   │   └── reviewer.py            # Quality assurance agent
│   ├── graph/
│   │   └── comment_graph.py       # LangGraph workflow definition
│   ├── models/
│   │   ├── llm.py                 # LLMGateway configuration
│   │   └── model_router.py        # Intelligent model selection
│   ├── prompts/
│   │   ├── analyzer_prompt.py     # Analyzer system prompt
│   │   ├── planner_prompt.py      # Planner system prompt
│   │   ├── writer_prompt.py       # Writer system prompt
│   │   └── reviewer_prompt.py     # Reviewer system prompt
│   ├── schemas/
│   │   ├── request.py             # Pydantic request models
│   │   └── response.py            # Pydantic response models
│   └── requirements.txt           # Python dependencies
│
├── extension/
│   ├── manifest.json              # Chrome Extension Manifest V3
│   ├── content.js                 # LinkedIn page injection script
│   ├── content.css                # Injected button styles
│   ├── popup.html                 # Extension popup UI
│   ├── popup.js                   # Popup logic & API calls
│   ├── popup.css                  # Popup styles
│   ├── background.js              # Service worker for API calls
│   └── icons/                     # Extension icons (16/32/48/128px)
│
└── README.md
```

---

## Tech Stack

### Backend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | FastAPI | Async API server |
| **AI Orchestration** | LangGraph | Multi-agent workflow |
| **LLM Integration** | LangChain + LiteLLM | Prompt management & LLM calls |
| **LLM Provider** | LLMGateway | Unified API for GPT-5.5, Claude, Gemini |
| **Validation** | Pydantic | Request/response schemas |
| **Server** | Uvicorn | ASGI server |

### Chrome Extension

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Manifest** | V3 | Chrome Extension standard |
| **Frontend** | Vanilla JS + HTML/CSS | Lightweight, no dependencies |
| **API** | Chrome Extension APIs | Tab management, storage, messaging |
| **Permissions** | `activeTab`, `scripting`, `storage` | Minimal required permissions |

### LLM Models

| Model | Use Case | Trigger |
|-------|----------|---------|
| `google/gemini-2.5-flash` | Default — fast & cost-effective | Posts < 400 characters |
| `anthropic/claude-sonnet-4` | Technical content expertise | Posts containing AI/ML keywords |
| `openai/gpt-5.5` | Premium quality analysis | All other posts |

---

## Quick Start

### Prerequisites

- Python 3.11 or higher
- Google Chrome browser
- [LLMGateway API key](https://llmgateway.io) (free tier available)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/linkedin-ai-comment-copilot.git
cd linkedin-ai-comment-copilot
```

### 2. Set Up the Backend

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Add your API key to .env
# LLMGATEWAY_API_KEY=your_api_key_here
```

### 3. Start the Backend Server

```bash
# From the backend directory
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Verify it's running:

```bash
curl http://localhost:8000/health
# {"status": "healthy"}
```

### 4. Install the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The extension icon will appear in your Chrome toolbar

### 5. Start Using

1. Navigate to [linkedin.com/feed](https://www.linkedin.com/feed/)
2. Open the extension popup by clicking the icon in your toolbar
3. Select your preferred comment tone
4. Click **"Generate AI Comment"** on any post
5. Copy, regenerate, or insert the generated comment

---

## API Reference

### POST `/generate-comment`

Generate a LinkedIn comment using the multi-agent workflow.

**Request Body:**

```json
{
  "post_content": "Just started my new role as Software Engineer at Google! Excited for this new chapter.",
  "tone": "professional"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `post_content` | string | Yes | LinkedIn post content (1-5000 chars) |
| `tone` | string | Yes | Comment tone/style |

**Available Tones:**

| Tone | Description |
|------|-------------|
| `professional` | Business-appropriate, formal |
| `technical` | Technical depth and expertise |
| `supportive` | Encouraging and empathetic |
| `networking` | Relationship-building focused |
| `thoughtful` | Deep, reflective insights |
| `friendly` | Warm and approachable |
| `encouraging` | Motivating and uplifting |
| `curious` | Question-driven engagement |
| `founder` | Entrepreneurial perspective |
| `recruiter` | Talent-focused messaging |

**Response:**

```json
{
  "comment": "Congratulations on the new role! Wishing you an exciting and impactful journey at Google."
}
```

**Error Response:**

```json
{
  "detail": "Failed to generate approved comment after review"
}
```

---

### GET `/health`

Check API health status.

**Response:**

```json
{
  "status": "healthy"
}
```

---

## How It Works

### 1. Post Analysis (Analyzer Agent)

The Analyzer agent classifies the LinkedIn post by:
- **Post type**: Internship, Job Update, Promotion, Achievement, Project Showcase, Open Source, Research, Startup, AI/ML, Hackathon, Hiring
- **Category**: Career, Technology, Industry, etc.
- **Sentiment**: Positive, neutral, negative

### 2. Strategy Planning (Planner Agent)

Based on the post classification and selected tone, the Planner agent determines the optimal comment strategy — what angle to take, what to emphasize, and how to structure the response.

### 3. Comment Writing (Writer Agent)

The Writer agent generates the actual comment following:
- The determined strategy
- The selected tone
- LinkedIn best practices (1-3 lines, max 60 words)
- Human-sounding, non-generic language

### 4. Quality Review (Reviewer Agent)

The Reviewer agent evaluates the generated comment on:
- **Relevance** to the post content
- **Human-likeness** and natural flow
- **Spam score** (low is better)
- **Generic score** (low is better)
- **Professionalism** and appropriateness

If the comment doesn't meet quality standards, the workflow loops back to the Writer for regeneration.

---

## Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Required
LLMGATEWAY_API_KEY=your_llmgateway_api_key

# Optional (defaults shown)
# API_HOST=0.0.0.0
# API_PORT=8000
```

### CORS Configuration

The backend is pre-configured to accept requests from:
- Chrome Extension (`chrome-extension://*`)
- Local development (`http://localhost:*`)
- LinkedIn domains (`https://*.linkedin.com`)

---

## Technical Keywords

The model router detects these keywords to route posts to Claude Sonnet 4:

```
AI, ML, LLM, LangGraph, RAG, Agent, MCP, Vector Database, Transformer,
Research, Machine Learning, Deep Learning, Neural Network, Fine-tuning,
Prompt Engineering, Embeddings, LangChain, Hugging Face, PyTorch,
TensorFlow, Kubernetes, Docker, Microservices, Distributed Systems
```

---

## Development

### Backend Development

```bash
cd backend

# Run with auto-reload
uvicorn main:app --reload

# API docs available at
# http://localhost:8000/docs (Swagger UI)
# http://localhost:8000/redoc (ReDoc)
```

### Extension Development

After making changes to the extension:
1. Go to `chrome://extensions/`
2. Click the refresh icon on your extension
3. Reload the LinkedIn page

---

## Security

- **API Key Safety**: The LLMGateway API key is stored only on the backend server — never exposed to the extension
- **No Data Storage**: No posts, comments, or user data are stored anywhere
- **Minimal Permissions**: The extension only requests `activeTab`, `scripting`, and `storage`
- **CORS Protection**: Backend only accepts requests from allowed origins

---

## Roadmap

### V1.0 (Current)
- Multi-agent comment generation
- 10 comment tones
- Smart model routing
- One-click copy/insert
- Quality review system

### V2.0 (Planned)
- [ ] Comment scoring & analytics
- [ ] Personal writing style learning
- [ ] RAG for domain-specific comments
- [ ] Team workspace
- [ ] LinkedIn engagement analytics
- [ ] Auto-comment suggestions
- [ ] Multi-language support
- [ ] Local Ollama integration
- [ ] Feedback-based learning

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## Author

**Himanshu** — [LinkedIn](https://linkedin.com/in/your-profile) | [GitHub](https://github.com/yourusername)

---

<div align="center">

**Built with LangGraph, FastAPI, and Chrome Extension APIs**

*No database. No auth. Just intelligent comments.*

</div>
