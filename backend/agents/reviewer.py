from typing import Dict, Any
import os
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import Runnable

try:
    from ..prompts.reviewer_prompt import reviewer_prompt
    from ..models.llm import create_llm, create_llm_with_router, get_reviewer_llm_config, get_fallback_llm_config
except ImportError:
    from prompts.reviewer_prompt import reviewer_prompt
    from models.llm import create_llm, create_llm_with_router, get_reviewer_llm_config, get_fallback_llm_config


def create_reviewer_agent(llm_config=None) -> Runnable:
    """Create the comment reviewer agent."""
    if llm_config is None:
        llm_config = get_reviewer_llm_config()

    llm = create_llm(llm_config)
    parser = JsonOutputParser()

    return reviewer_prompt | llm | parser


def create_reviewer_agent_with_router() -> Runnable:
    """Create the reviewer agent with automatic fallback via Router."""
    groq_key = os.getenv("GROQ_API_KEY")
    google_key = os.getenv("GOOGLE_API_KEY")

    if not groq_key:
        raise ValueError("GROQ_API_KEY environment variable is required")

    llm = create_llm_with_router(
        primary_model="groq/llama-3.3-70b-versatile",
        primary_api_key=groq_key,
        fallback_model="gemini/gemini-2.5-flash",
        fallback_api_key=google_key,
        temperature=0.3,
        max_tokens=300,
    )
    parser = JsonOutputParser()

    return reviewer_prompt | llm | parser


async def review_comment(
    post_content: str,
    generated_comment: str,
    tone: str,
    llm_config=None
) -> Dict[str, Any]:
    """Review a generated comment and return approval status and score."""
    agent = create_reviewer_agent_with_router()
    result = await agent.ainvoke({
        "post_content": post_content,
        "generated_comment": generated_comment,
        "tone": tone,
    })
    return result