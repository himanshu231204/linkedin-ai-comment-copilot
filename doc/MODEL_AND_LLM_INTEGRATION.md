# Model & LLM Integration Documentation

**LinkedIn AI Comment Copilot** — Complete guide to the AI model layer, Grok integration, and LangGraph agent architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Grok Model Integration](#grok-model-integration)
4. [LLM Configuration](#llm-configuration)
5. [Model Router](#model-router)
6. [LangGraph Agent Workflow](#langgraph-agent-workflow)
7. [Prompts](#prompts)
8. [API Reference](#api-reference)
9. [Environment Variables](#environment-variables)
10. [Error Handling](#error-handling)
11. [Cost Optimization](#cost-optimization)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The backend uses **xAI Grok** models as the default LLM provider, integrated via **LiteLLM** (OpenAI-compatible adapter) and orchestrated through a **LangGraph** multi-agent workflow. Each LinkedIn post goes through four specialized agents — Analyzer, Planner, Writer, and Reviewer — before a final comment is returned.

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| LLM Config | `backend/models/llm.py` | Model configuration, factory functions, callback handler |
| Model Router | `backend/models/model_router.py` | Selects the right Grok variant based on post content |
| LangGraph Graph | `backend/graph/comment_graph.py` | Defines the multi-agent workflow and state |
| Agents | `backend/agents/*.py` | Individual agent implementations |
| Prompts | `backend/prompts/*.py` | System and human prompt templates |
| Schemas | `backend/schemas/*.py` | Request/response Pydantic models |

---

## Architecture

```
LinkedIn Post (text)
        │
        ▼
┌───────────────────┐
│   Model Router    │ ← Selects Grok variant based on content
└───────────────────┘
        │
        ▼
┌───────────────────┐
│   LangGraph       │
│   State Machine   │
│                   │
│  ┌─────────────┐  │
│  │  Analyzer   │  │ ← Classifies post type, category, sentiment
│  └─────────────┘  │
│        │          │
│        ▼          │
│  ┌─────────────┐  │
│  │  Planner    │  │ ← Determines comment strategy
│  └─────────────┘  │
│        │          │
│        ▼          │
│  ┌─────────────┐  │
│  │  Writer     │  │ ← Generates the comment
│  └─────────────┘  │
│        │          │
│        ▼          │
│  ┌─────────────┐  │
│  │  Reviewer   │  │ ← Scores and approves/rejects
│  └─────────────┘  │
│        │          │
│   [regenerate?]   │ ← If score < 80, loops back to Writer
│        │          │
└───────────────────┘
        │
        ▼
  Final Comment (text)
```

---

## Grok Model Integration

### Why Grok?

- **Fast inference** — Grok 3 is optimized for low-latency responses
- **Strong reasoning** — Native reasoning mode for complex analysis
- **Cost-effective** — Competitive pricing via xAI API
- **OpenAI-compatible** — Uses standard OpenAI SDK format, no vendor lock-in

### Available Models

| Model | ID | Use Case | Max Tokens | Speed |
|-------|-----|----------|------------|-------|
| **Grok 3** | `grok-3` | Default, premium quality, reasoning | 131,072 | Fast |
| **Grok 3 Mini** | `grok-3-mini` | Lightweight, fast for short/simple posts | 131,072 | Very Fast |

### xAI API Endpoint

```
Base URL: https://api.x.ai/v1
Auth: Bearer token (XAI_API_KEY)
Format: OpenAI-compatible (chat/completions)
```

### SDK Compatibility

The project uses `langchain-litellm` which wraps the OpenAI SDK. Since xAI's API is OpenAI-compatible, we configure:

```python
ChatLiteLLM(
    model="grok-3",
    api_key="xai-...",
    api_base="https://api.x.ai/v1",
    custom_llm_provider="openai",
)
```

---

## LLM Configuration

### LLMConfig Model

Defined in `backend/models/llm.py`:

```python
class LLMConfig(BaseModel):
    model_name: str          # "grok-3" or "grok-3-mini"
    temperature: float       # 0.0 - 2.0 (default: 0.7)
    max_tokens: int          # 1 - 4000 (default: 500)
    api_key: str             # xAI API key
    base_url: str            # "https://api.x.ai/v1"
    source_domain: str       # Optional X-Source header
    session_id: str          # Optional session tracking
    enable_reasoning: bool   # Enable Grok reasoning mode
    reasoning_effort: str    # "low", "medium", "high"
    custom_llm_provider: str # "openai" (for LiteLLM)
```

### Factory Functions

| Function | Model | Temperature | Reasoning | Use Case |
|----------|-------|-------------|-----------|----------|
| `get_default_llm_config()` | `grok-3` | 0.7 | Off | Short posts (<400 chars) |
| `get_premium_llm_config()` | `grok-3` | 0.7 | Medium | Long/complex posts |
| `get_technical_llm_config()` | `grok-3-mini` | 0.5 | Off | Technical content |
| `get_reasoning_llm_config()` | `grok-3` | 0.3 | High | Complex analysis tasks |

### Callback Handler

`LLMCallbackHandler` captures per-request metrics:

```python
handler = LLMCallbackHandler()
llm = create_llm(config, callbacks=[handler])

# After invocation:
handler.total_tokens      # Total tokens used
handler.prompt_tokens     # Input tokens
handler.completion_tokens # Output tokens
handler.estimated_cost    # Cost estimate (if provided by API)
```

---

## Model Router

The `select_model_config()` function in `backend/models/model_router.py` implements content-aware routing:

### Routing Logic

```
IF post_length < 400 characters:
    → Grok 3 Mini (fast, cheap)
    
ELSE IF post contains technical keywords:
    → Grok 3 Mini (fast for technical analysis)
    
ELSE:
    → Grok 3 with reasoning (premium quality)
```

### Technical Keywords

Posts are classified as "technical" if they contain any of:

```
AI, ML, LLM, LangGraph, RAG, Agent, MCP, Vector Database,
Transformer, Research, Machine Learning, Deep Learning,
Neural Network, Fine-tuning, Prompt Engineering, Embeddings,
LangChain, Hugging Face, PyTorch, TensorFlow, Kubernetes,
Docker, Microservices, Distributed Systems
```

### Usage

```python
from backend.models.model_router import select_model_config

config = select_model_config(post_content="Just shipped a new RAG pipeline...")
# Returns: Grok 3 Mini config (technical keywords detected)

config = select_model_config(post_content="Excited to announce my promotion!")
# Returns: Grok 3 config (short post, no technical keywords)
```

---

## LangGraph Agent Workflow

### State Schema

```python
class CommentState(TypedDict):
    post_content: str       # Input: LinkedIn post text
    tone: str               # Input: Desired comment tone
    post_type: str          # Analyzer output: post classification
    category: str           # Analyzer output: broad category
    sentiment: str          # Analyzer output: emotional tone
    strategy: str           # Planner output: comment strategy
    generated_comment: str  # Writer output: generated comment
    review_score: int       # Reviewer output: quality score (0-100)
    approved: bool          # Reviewer output: pass/fail
    final_comment: str      # Final output: approved comment
    llm_config: dict        # Current LLM config (serialized)
```

### Graph Flow

```python
analyzer_node → planner_node → writer_node → reviewer_node
                                                │
                                        [approved?]
                                           /    \
                                        yes      no
                                         │        │
                                        END    writer (loop)
```

### Agent Details

#### 1. Analyzer Agent

- **Input**: Raw post content
- **Output**: `{ post_type, category, sentiment }`
- **Model**: Selected by router
- **Parser**: `JsonOutputParser`

#### 2. Planner Agent

- **Input**: Post type, category, tone
- **Output**: `{ strategy }` — specific instructions for the writer
- **Model**: Selected by router
- **Parser**: `JsonOutputParser`

#### 3. Writer Agent

- **Input**: Post content, tone, strategy
- **Output**: Comment text (plain string)
- **Model**: Selected by router
- **Parser**: `StrOutputParser`

#### 4. Reviewer Agent

- **Input**: Post content, generated comment, tone
- **Output**: `{ approved, score, feedback }`
- **Model**: Selected by router
- **Parser**: `JsonOutputParser`
- **Threshold**: Score >= 80 for approval

---

## Prompts

### Analyzer Prompt

```
System: You are an expert LinkedIn post analyzer. Classify the post into:
  - post_type: internship, job_update, promotion, achievement, etc.
  - category: career, technical, personal, company, learning
  - sentiment: positive, neutral, negative

Human: Analyze this LinkedIn post:
  {post_content}
  Return JSON with: post_type, category, sentiment
```

### Planner Prompt

```
System: You are a comment strategy planner. Determine the best strategy for:
  - What angle to take
  - What key points to address
  - How to match the requested tone

Human: Post type: {post_type}, Category: {category}, Tone: {tone}
  Return JSON with: strategy
```

### Writer Prompt

```
System: You are an expert LinkedIn comment writer. Rules:
  - Sound human, not robotic
  - No cringe, no excessive emojis
  - 1-3 lines, max 60 words
  - No hashtags, no "Great post!"
  - Match tone exactly

Human: Post: {post_content}, Tone: {tone}, Strategy: {strategy}
  Write the comment:
```

### Reviewer Prompt

```
System: You are a LinkedIn comment quality reviewer. Score 0-100 on:
  1. relevance
  2. human_likeness
  3. spam_score (inverted)
  4. generic_score (inverted)
  5. professionalism
  
  Overall = average. Approved if >= 80.

Human: Post: {post_content}, Comment: {generated_comment}, Tone: {tone}
  Return JSON with: approved, score, feedback
```

---

## API Reference

### POST /generate-comment

**Request:**

```json
{
  "post_content": "Just started my new role as Software Engineer at Google!",
  "tone": "professional"
}
```

**Response:**

```json
{
  "comment": "Congratulations on the new role! Wishing you an exciting and impactful journey at Google."
}
```

**Supported Tones:**

| Tone | Description |
|------|-------------|
| `professional` | Polished, respectful, business-appropriate |
| `technical` | Knowledgeable, uses relevant terminology |
| `supportive` | Encouraging, empathetic, validating |
| `networking` | Connection-focused, opens dialogue |
| `thoughtful` | Reflective, insightful, deep engagement |
| `friendly` | Warm, approachable, conversational |
| `encouraging` | Motivating, uplifting, positive |
| `curious` | Inquisitive, asks genuine questions |
| `founder` | Entrepreneurial, strategic, growth-oriented |
| `recruiter` | Talent-focused, opportunity-aware |

### GET /health

```json
{
  "status": "healthy"
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `XAI_API_KEY` | Yes | xAI API key for Grok models |

### Setup

Create a `.env` file in `backend/`:

```env
XAI_API_KEY=xai-your-api-key-here
```

### Getting an API Key

1. Visit [console.x.ai](https://console.x.ai)
2. Sign up / log in
3. Navigate to API Keys
4. Create a new key
5. Copy and save securely

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `XAI_API_KEY not set` | Missing env var | Add `XAI_API_KEY` to `.env` |
| `401 Unauthorized` | Invalid API key | Check key at console.x.ai |
| `429 Rate Limited` | Too many requests | Implement retry with backoff |
| `500 Server Error` | xAI API issue | Retry or check status at status.x.ai |
| `JSON parse error` | LLM returned invalid JSON | Reviewer catches and regenerates |

### Retry Logic

The LangGraph workflow handles retries internally:

- If the Reviewer rejects a comment (score < 80), the graph loops back to the Writer
- Maximum loop iterations are bounded by the graph structure
- Each node has independent error handling

---

## Cost Optimization

### Token Usage Estimates

| Agent | Avg Input Tokens | Avg Output Tokens | Calls per Request |
|-------|------------------|-------------------|-------------------|
| Analyzer | ~200 | ~50 | 1 |
| Planner | ~150 | ~30 | 1 |
| Writer | ~300 | ~60 | 1-2 (regeneration) |
| Reviewer | ~400 | ~40 | 1-2 |

**Total per request**: ~1,000-1,500 input tokens, ~180-250 output tokens

### Optimization Strategies

1. **Content-aware routing** — Short posts use `grok-3-mini` (cheaper)
2. **Temperature tuning** — Lower temp for reviewer (fewer retries)
3. **Token limits** — `max_tokens=500` prevents runaway outputs
4. **Reasoning mode** — Only enabled for premium/complex posts

---

## Troubleshooting

### Debug Mode

Add logging to see LLM interactions:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Testing Individual Agents

```python
from backend.agents.analyzer import analyze_post
from backend.models.llm import get_default_llm_config

config = get_default_llm_config()
result = await analyze_post("Your test post here", config)
print(result)
```

### Verifying API Connection

```python
from openai import OpenAI

client = OpenAI(
    api_key="xai-your-key",
    base_url="https://api.x.ai/v1"
)

response = client.chat.completions.create(
    model="grok-3",
    messages=[{"role": "user", "content": "Hello"}]
)
print(response.choices[0].message.content)
```

### Common Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| Empty responses | `comment: ""` | Check API key, increase max_tokens |
| Slow responses | >5s latency | Use `grok-3-mini`, reduce max_tokens |
| Generic comments | Low reviewer score | Adjust prompts, lower temperature |
| Rate limiting | 429 errors | Add delay between requests |

---

## File Reference

```
backend/
├── models/
│   ├── __init__.py
│   ├── llm.py                    # LLMConfig, create_llm, factory functions
│   └── model_router.py           # select_model_config, technical keywords
├── agents/
│   ├── __init__.py
│   ├── analyzer.py               # Post classification agent
│   ├── planner.py                # Strategy planning agent
│   ├── writer.py                 # Comment writing agent
│   └── reviewer.py               # Quality review agent
├── graph/
│   ├── __init__.py
│   └── comment_graph.py          # LangGraph workflow definition
├── prompts/
│   ├── __init__.py
│   ├── analyzer_prompt.py        # Analyzer prompt template
│   ├── planner_prompt.py         # Planner prompt template
│   ├── writer_prompt.py          # Writer prompt template
│   └── reviewer_prompt.py        # Reviewer prompt template
├── schemas/
│   ├── __init__.py
│   ├── request.py                # GenerateCommentRequest
│   └── response.py               # GenerateCommentResponse, HealthResponse
├── main.py                       # FastAPI application entry point
└── requirements.txt              # Python dependencies
```

---

## Dependencies

```
fastapi              # Web framework
uvicorn              # ASGI server
langchain            # LLM orchestration
langgraph            # Multi-agent workflow
langchain-litellm    # LiteLLM integration for LangChain
litellm              # Universal LLM proxy
openai               # OpenAI SDK (used for xAI Grok)
python-dotenv        # Environment variable loading
pydantic             # Data validation
httpx                # HTTP client
```

---

*Last updated: June 2026*
