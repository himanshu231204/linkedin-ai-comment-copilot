from typing import Dict, Any
import os
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable

try:
    from ..prompts.writer_prompt import writer_prompt
    from ..models.llm import create_llm, create_llm_with_router, get_writer_llm_config, get_fallback_llm_config
except ImportError:
    from prompts.writer_prompt import writer_prompt
    from models.llm import create_llm, create_llm_with_router, get_writer_llm_config, get_fallback_llm_config


def create_writer_agent(llm_config=None) -> Runnable:
    """Create the comment writer agent."""
    if llm_config is None:
        llm_config = get_writer_llm_config()

    llm = create_llm(llm_config)
    parser = StrOutputParser()

    return writer_prompt | llm | parser


def create_writer_agent_with_router() -> Runnable:
    """Create the writer agent with automatic fallback via Router."""
    groq_key = os.getenv("GROQ_API_KEY")
    google_key = os.getenv("GOOGLE_API_KEY")

    if not groq_key:
        raise ValueError("GROQ_API_KEY environment variable is required")

    llm = create_llm_with_router(
        primary_model="groq/llama-3.3-70b-versatile",
        primary_api_key=groq_key,
        fallback_model="gemini/gemini-2.5-flash",
        fallback_api_key=google_key,
        temperature=0.7,
        max_tokens=500,
    )
    parser = StrOutputParser()

    return writer_prompt | llm | parser


async def write_comment(
    post_content: str,
    tone: str,
    strategy: str,
    llm_config=None
) -> str:
    """Write a LinkedIn comment based on post content, tone, and strategy."""
    agent = create_writer_agent_with_router()
    result = await agent.ainvoke({
        "post_content": post_content,
        "tone": tone,
        "strategy": strategy,
    })
    return result.strip()