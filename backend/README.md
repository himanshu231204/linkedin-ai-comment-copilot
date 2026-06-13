# LinkedIn AI Comment Copilot - Backend

FastAPI backend with LangGraph multi-agent workflow for generating LinkedIn comments.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file with your LLMGateway API key:
```env
LLMGATEWAY_API_KEY=your_api_key_here
```

Get your API key from [LLMGateway](https://llmgateway.io).

## Running the Server

```bash
# Development mode with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health Check
```
GET /health
```
Response:
```json
{"status": "healthy"}
```

### Generate Comment
```
POST /generate-comment
Content-Type: application/json

{
  "post_content": "Just started my new role as Software Engineer at Google!",
  "tone": "professional"
}
```

Response:
```json
{
  "comment": "Congratulations on the new role! Wishing you an exciting and impactful journey at Google."
}
```

Supported tones: `professional`, `technical`, `supportive`, `networking`, `thoughtful`, `friendly`, `encouraging`, `curious`, `founder`, `recruiter`

## Architecture

```
POST /generate-comment
         │
         ▼
    ┌─────────┐
    │Analyzer │ ──► Classifies post (type, category, sentiment)
    └─────────┘
         │
         ▼
    ┌─────────┐
    │ Planner │ ──► Determines comment strategy
    └─────────┘
         │
         ▼
    ┌─────────┐
    │ Writer  │ ──► Generates comment
    └─────────┘
         │
         ▼
    ┌─────────┐
    │Reviewer │ ──► Scores & approves (or triggers regeneration)
    └─────────┘
         │
         ▼
   Generated Comment
```

## Model Routing

The system automatically selects the best model based on post content:
- **< 400 chars**: Gemini 2.5 Flash (fast, cheap)
- **Technical keywords**: Claude Sonnet 4 (technical expertise)
- **Otherwise**: GPT-5.5 (premium quality)

## Project Structure

```
backend/
├── main.py                 # FastAPI entry point
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
├── agents/
│   ├── analyzer.py        # Post analysis agent
│   ├── planner.py         # Strategy planning agent
│   ├── writer.py          # Comment writing agent
│   └── reviewer.py        # Quality review agent
├── graph/
│   └── comment_graph.py   # LangGraph workflow
├── models/
│   ├── llm.py             # LLM configuration
│   └── model_router.py    # Model selection logic
├── prompts/
│   ├── analyzer_prompt.py
│   ├── planner_prompt.py
│   ├── writer_prompt.py
│   └── reviewer_prompt.py
└── schemas/
    ├── request.py         # Request models
    └── response.py        # Response models
```