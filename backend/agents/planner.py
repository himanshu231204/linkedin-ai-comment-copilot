from typing import Dict, Any
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import Runnable

try:
    from ..prompts.planner_prompt import planner_prompt
    from ..models.llm import create_llm, get_default_llm_config
except ImportError:
    from prompts.planner_prompt import planner_prompt
    from models.llm import create_llm, get_default_llm_config


def create_planner_agent(llm_config=None) -> Runnable:
    """Create the comment strategy planner agent."""
    if llm_config is None:
        llm_config = get_default_llm_config()

    llm = create_llm(llm_config)
    parser = JsonOutputParser()

    return planner_prompt | llm | parser


async def plan_strategy(post_type: str, category: str, tone: str, llm_config=None) -> Dict[str, Any]:
    """Plan the comment strategy based on post type and tone."""
    agent = create_planner_agent(llm_config)
    result = await agent.ainvoke({
        "post_type": post_type,
        "category": category,
        "tone": tone,
    })
    return result