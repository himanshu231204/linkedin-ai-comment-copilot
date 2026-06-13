from typing import Dict, Any
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import Runnable

try:
    from ..prompts.analyzer_prompt import analyzer_prompt
    from ..models.llm import create_llm, get_default_llm_config, get_fallback_llm_config
except ImportError:
    from prompts.analyzer_prompt import analyzer_prompt
    from models.llm import create_llm, get_default_llm_config, get_fallback_llm_config


def create_analyzer_agent(llm_config=None) -> Runnable:
    """Create the post analyzer agent."""
    if llm_config is None:
        llm_config = get_default_llm_config()

    llm = create_llm(llm_config)
    parser = JsonOutputParser()

    return analyzer_prompt | llm | parser


async def analyze_post(post_content: str, llm_config=None) -> Dict[str, Any]:
    """Analyze a LinkedIn post and return classification with fallback to Groq."""
    try:
        agent = create_analyzer_agent(llm_config)
        result = await agent.ainvoke({"post_content": post_content})
        return result
    except Exception as primary_error:
        print(f"Primary LLM failed (Gemini): {primary_error}")
        print("Falling back to Groq...")
        try:
            fallback_config = get_fallback_llm_config()
            agent = create_analyzer_agent(fallback_config)
            result = await agent.ainvoke({"post_content": post_content})
            return result
        except Exception as fallback_error:
            print(f"Fallback LLM also failed (Groq): {fallback_error}")
            raise fallback_error