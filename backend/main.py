import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .schemas.request import GenerateCommentRequest
from .schemas.response import GenerateCommentResponse, HealthResponse
from .graph.comment_graph import comment_graph, CommentState


load_dotenv()


def configure_langsmith():
    """Configure LangSmith tracing for LangChain/LangGraph."""
    langsmith_api_key = os.getenv("LANGCHAIN_API_KEY")
    if langsmith_api_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = langsmith_api_key
        os.environ["LANGCHAIN_ENDPOINT"] = os.getenv(
            "LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com"
        )
        os.environ["LANGCHAIN_PROJECT"] = os.getenv(
            "LANGCHAIN_PROJECT", "linkedin-ai-comment-copilot"
        )
        print(f"LangSmith tracing enabled for project: {os.environ['LANGCHAIN_PROJECT']}")
    else:
        print("WARNING: LANGCHAIN_API_KEY not set - LangSmith tracing disabled")


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
    allow_origins=["chrome-extension://*", "http://localhost:*", "https://*.linkedin.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="healthy")


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