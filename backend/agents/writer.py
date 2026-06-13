from typing import Dict, Any
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable
from ..prompts.writer_prompt import writer_prompt
from ..models.llm import create_llm, get_default_llm_config


def create_writer_agent(llm_config=None) -> Runnable:
    """Create the comment writer agent."""
    if llm_config is None:
        llm_config = get_default_llm_config()

    llm = create_llm(llm_config)
    parser = StrOutputParser()

    return writer_prompt | llm | parser


async def write_comment(
    post_content: str,
    tone: str,
    strategy: str,
    llm_config=None
) -> str:
    """Write a LinkedIn comment based on post content, tone, and strategy."""
    agent = create_writer_agent(llm_config)
    result = await agent.ainvoke({
        "post_content": post_content,
        "tone": tone,
        "strategy": strategy,
    })
    return result.strip()