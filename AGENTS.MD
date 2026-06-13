# Project Specification for Coding Agent

## Project Name

**LinkedIn AI Comment Copilot**

An AI-powered Chrome Extension that analyzes LinkedIn posts in real time and generates context-aware comments using a LangGraph multi-agent workflow and LLMGateway.

---

# 1. Project Goal

Build a Chrome Extension that:

* Works directly on LinkedIn
* Detects LinkedIn posts
* Injects a "Generate AI Comment" button
* Lets users select a comment tone
* Sends post content to a FastAPI backend
* Uses LangGraph agents to generate high-quality comments
* Returns comments instantly
* Allows:

  * Copy Comment
  * Regenerate Comment
  * Insert Comment into LinkedIn comment box

No database.

No authentication.

No user accounts.

No comment history.

No storage of user data.

Everything runs in real time.

---

# 2. Tech Stack

## Frontend

### Chrome Extension

Manifest Version:

```json
Manifest V3
```

Technologies:

```text
HTML
CSS
Vanilla JavaScript
Chrome Extension APIs
```

---

## Backend

### API Framework

```text
FastAPI
```

Reason:

* Fast
* Async support
* Easy integration with LangGraph

---

## AI Framework

### LangChain

Used for:

```text
Prompt Management
LLM Calls
Structured Output
```

---

### LangGraph

Used for:

```text
Multi-Agent Workflow
State Management
Agent Orchestration
Conditional Routing
```

---

## LLM Provider

### LLMGateway

Official endpoint:

```text
https://api.llmgateway.io/v1
```

Used through OpenAI SDK compatibility.

Benefits:

```text
Single API Key

Access to:

GPT-5.5
Claude
Gemini
DeepSeek
Llama
```

---

## Models

### Default Model

```text
google/gemini-2.5-flash
```

Fast and cheap.

---

### Premium Quality

```text
openai/gpt-5.5
```

---

### Technical Posts

```text
anthropic/claude-sonnet-4
```

---

# 3. Architecture

```text
LinkedIn Page
       │
       ▼
Chrome Extension
       │
       ▼
Post Extraction
       │
       ▼
Generate Button
       │
       ▼
FastAPI API
       │
       ▼
LangGraph
       │
 ┌─────────────┐
 │ Analyzer    │
 └─────────────┘
       │
       ▼
 ┌─────────────┐
 │ Planner     │
 └─────────────┘
       │
       ▼
 ┌─────────────┐
 │ Writer      │
 └─────────────┘
       │
       ▼
 ┌─────────────┐
 │ Reviewer    │
 └─────────────┘
       │
       ▼
Generated Comment
       │
       ▼
Extension UI
```

---

# 4. Folder Structure

```text
linkedin-ai-comment-copilot/

├── backend/
│
│   ├── main.py
│
│   ├── agents/
│   │
│   │   ├── analyzer.py
│   │   ├── planner.py
│   │   ├── writer.py
│   │   └── reviewer.py
│
│   ├── graph/
│   │
│   │   └── comment_graph.py
│
│   ├── models/
│   │
│   │   ├── llm.py
│   │   └── model_router.py
│
│   ├── prompts/
│   │
│   │   ├── analyzer_prompt.py
│   │   ├── planner_prompt.py
│   │   ├── writer_prompt.py
│   │   └── reviewer_prompt.py
│
│   ├── schemas/
│   │
│   │   ├── request.py
│   │   └── response.py
│
│   └── requirements.txt
│
│
├── extension/
│
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── background.js
│   └── icons/
│
└── README.md
```

---

# 5. LangGraph State

```python
from typing import TypedDict

class CommentState(TypedDict):

    post_content: str

    tone: str

    post_type: str

    category: str

    strategy: str

    generated_comment: str

    review_score: int

    approved: bool

    final_comment: str
```

---

# 6. Supported Tones

```text
Professional

Technical

Supportive

Networking

Thoughtful

Friendly

Encouraging

Curious

Founder

Recruiter
```

---

# 7. Agent Design

## Agent 1

### Post Analyzer

Purpose:

Understand the post.

Input:

```text
LinkedIn post content
```

Output:

```json
{
  "post_type":"internship",
  "category":"career",
  "sentiment":"positive"
}
```

Classifications:

```text
Internship
Job Update
Promotion
Achievement
Project Showcase
Open Source
Research
Startup
AI/ML
Hackathon
Hiring
```

---

## Agent 2

### Comment Strategy Planner

Input:

```json
{
  "post_type":"internship",
  "tone":"technical"
}
```

Output:

```json
{
  "strategy":"congratulate and discuss future learning opportunities"
}
```

---

## Agent 3

### Comment Writer

Input:

```text
Post Content
+
Tone
+
Strategy
```

Rules:

```text
Human sounding

Not generic

No cringe

No excessive emojis

LinkedIn style

1–3 lines

Maximum 60 words
```

Output:

```text
Congratulations on this milestone.
Looking forward to seeing the projects and impact you'll create during the internship.
```

---

## Agent 4

### Reviewer

Checks:

```text
Relevance

Human-likeness

Spam score

Generic score

Professionalism
```

Output:

```json
{
  "approved": true,
  "score": 94
}
```

---

# 8. Model Router

Purpose:

Reduce cost.

Logic:

```python
if len(post) < 400:
    Gemini Flash

elif technical_keywords:
    Claude Sonnet

else:
    GPT-5.5
```

Technical Keywords:

```text
AI
ML
LLM
LangGraph
RAG
Agent
MCP
Vector Database
Transformer
Research
```

---

# 9. API Design

## Generate Comment

Endpoint:

```http
POST /generate-comment
```

Request:

```json
{
  "post_content": "...",
  "tone": "technical"
}
```

Response:

```json
{
  "comment": "Congratulations on this achievement..."
}
```

---

## Health Check

```http
GET /health
```

Response:

```json
{
  "status":"healthy"
}
```

---

# 10. Chrome Extension Features

## Feature 1

Post Detection

Detect all visible LinkedIn posts.

---

## Feature 2

AI Comment Button

Inject:

```text
Generate AI Comment
```

under every post.

---

## Feature 3

Tone Selector

Dropdown:

```text
Professional
Technical
Networking
Supportive
Thoughtful
```

---

## Feature 4

Generate Comment

Calls FastAPI.

---

## Feature 5

Copy Comment

One-click copy.

---

## Feature 6

Insert Comment

Automatically fills LinkedIn comment box.

---

## Feature 7

Regenerate

Generates another variation.

---

# 11. Security

Store API key only in backend:

```env
LLMGATEWAY_API_KEY=xxxx
```

Never expose:

```text
API Key
Backend URL secrets
```

to extension code.

---

# 12. Python Dependencies

```txt
fastapi
uvicorn

langchain
langgraph

langchain-openai

openai

python-dotenv

pydantic

httpx
```

---

# 13. Future V2 Features (Not in Current Scope)

* Comment scoring
* Personal writing style
* RAG
* Team workspace
* LinkedIn analytics
* Auto-comment suggestions
* Multi-language comments
* Local Ollama support
* Feedback learning

---

# Expected Deliverable

A production-quality Chrome Extension + FastAPI backend that:

1. Runs locally.
2. Uses LangGraph multi-agent architecture.
3. Uses LLMGateway for all LLM calls.
4. Generates human-like LinkedIn comments in real time.
5. Requires no database.
6. Requires no authentication.
7. Supports multiple comment tones.
8. Can be demonstrated in a portfolio, internship application, GitHub project, and LinkedIn post.
