import os
import sys

# Fix Windows async DNS resolution issue with aiohttp/litellm
# Must be set before importing any async libraries
if sys.platform == "win32":
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

try:
    from .schemas.request import GenerateCommentRequest
    from .schemas.response import GenerateCommentResponse, HealthResponse, CostTestResponse
    from .graph.comment_graph import comment_graph, CommentState
    from .models.llm import (
        create_llm,
        get_llm_cost,
        get_analyzer_llm_config,
        get_writer_llm_config,
    )
except ImportError:
    from schemas.request import GenerateCommentRequest
    from schemas.response import GenerateCommentResponse, HealthResponse, CostTestResponse
    from graph.comment_graph import comment_graph, CommentState
    from models.llm import (
        create_llm,
        get_llm_cost,
        get_analyzer_llm_config,
        get_writer_llm_config,
    )


load_dotenv()


def configure_langsmith():
    """Configure LangSmith tracing for LangChain/LangGraph."""
    langsmith_api_key = os.getenv("LANGSMITH_API_KEY")
    if langsmith_api_key:
        os.environ["LANGSMITH_TRACING"] = "true"
        os.environ["LANGSMITH_API_KEY"] = langsmith_api_key
        os.environ["LANGSMITH_ENDPOINT"] = os.getenv(
            "LANGSMITH_ENDPOINT", "https://api.smith.langchain.com"
        )
        os.environ["LANGSMITH_PROJECT"] = os.getenv(
            "LANGSMITH_PROJECT", "linkedin-ai-comment-copilot"
        )
        print(f"LangSmith tracing enabled for project: {os.environ['LANGSMITH_PROJECT']}")
    else:
        print("WARNING: LANGSMITH_API_KEY not set - LangSmith tracing disabled")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    configure_langsmith()

    if not os.getenv("GOOGLE_API_KEY"):
        print("WARNING: GOOGLE_API_KEY not set in environment")
    if not os.getenv("GROQ_API_KEY"):
        print("WARNING: GROQ_API_KEY not set in environment")
    yield
    # Shutdown (if needed)


app = FastAPI(
    title="LinkedIn AI Comment Copilot API",
    description="Generate AI-powered LinkedIn comments using LangGraph multi-agent workflow",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for Chrome Extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="healthy")


@app.post("/test-cost", response_model=CostTestResponse, tags=["Testing"])
async def test_cost(agent: str = "analyzer") -> CostTestResponse:
    """Run a single LLM call and return the cost breakdown.

    Query param ``agent`` selects which model to test:
    ``analyzer`` or ``planner`` → Gemini 2.5 Flash,
    ``writer`` or ``reviewer`` → Groq Llama 3.3 70B.
    """
    import langchain_core.messages as msg

    sample_post = (
        "Excited to share that I've just started my new role as Software Engineer "
        "at Google! Grateful for this opportunity and looking forward to contributing "
        "to the team. #newjob #google #softwareengineering"
    )

    # Pick model based on agent param
    agent_lower = agent.strip().lower()
    if agent_lower in ("writer", "reviewer"):
        config = get_writer_llm_config()
    else:
        config = get_analyzer_llm_config()

    llm = create_llm(config)

    messages = [
        msg.SystemMessage(content="You are a helpful assistant. Reply in one short sentence."),
        msg.HumanMessage(content=sample_post),
    ]

    response = await llm.ainvoke(messages)
    cost = get_llm_cost(response, config.model_name)

    return CostTestResponse(
        model=cost.model,
        prompt_tokens=cost.prompt_tokens,
        completion_tokens=cost.completion_tokens,
        total_tokens=cost.total_tokens,
        input_cost_usd=cost.input_cost_usd,
        output_cost_usd=cost.output_cost_usd,
        total_cost_usd=cost.total_cost_usd,
    )


@app.post("/generate-comment", response_model=GenerateCommentResponse, tags=["Comments"])
async def generate_comment(request: GenerateCommentRequest) -> GenerateCommentResponse:
    """
    Generate a LinkedIn comment using the multi-agent LangGraph workflow.

    The workflow:
    1. Analyzer - Classifies the post type, category, and sentiment
    2. Planner - Determines the comment strategy based on post type and tone
    3. Writer - Generates the comment following the strategy and tone
    4. Reviewer - Evaluates quality and approves/regenerates
    """
    try:
        initial_state: CommentState = {
            "post_content": request.post_content,
            "tone": request.tone.lower(),
            "post_type": "",
            "category": "",
            "sentiment": "",
            "strategy": "",
            "generated_comment": "",
            "review_score": 0,
            "approved": False,
            "final_comment": "",
            "llm_config": {},
        }

        result = await comment_graph.ainvoke(initial_state)

        if not result.get("approved") or not result.get("final_comment"):
            raise HTTPException(
                status_code=500,
                detail="Failed to generate approved comment after review",
            )

        return GenerateCommentResponse(comment=result["final_comment"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )