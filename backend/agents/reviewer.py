from typing import Dict, Any
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import Runnable

try:
    from ..prompts.reviewer_prompt import reviewer_prompt
    from ..models.llm import create_llm, get_default_llm_config
except ImportError:
    from prompts.reviewer_prompt import reviewer_prompt
    from models.llm import create_llm, get_default_llm_config


def create_reviewer_agent(llm_config=None) -> Runnable:
    """Create the comment reviewer agent."""
    if llm_config is None:
        llm_config = get_default_llm_config()

    llm = create_llm(llm_config)
    parser = JsonOutputParser()

    return reviewer_prompt | llm | parser


async def review_comment(
    post_content: str,
    generated_comment: str,
    tone: str,
    llm_config=None
) -> Dict[str, Any]:
    """Review a generated comment and return approval status and score."""
    agent = create_reviewer_agent(llm_config)
    result = await agent.ainvoke({
        "post_content": post_content,
        "generated_comment": generated_comment,
        "tone": tone,
    })
    return result