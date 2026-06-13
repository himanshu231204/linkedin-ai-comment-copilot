from typing import TypedDict, Literal
from langgraph.graph import StateGraph, END
from ..agents.analyzer import analyze_post
from ..agents.planner import plan_strategy
from ..agents.writer import write_comment
from ..agents.reviewer import review_comment
from ..models.model_router import select_model_config


class CommentState(TypedDict):
    post_content: str
    tone: str
    post_type: str
    category: str
    sentiment: str
    strategy: str
    generated_comment: str
    review_score: int
    approved: bool
    final_comment: str
    llm_config: dict


async def analyzer_node(state: CommentState) -> CommentState:
    """Analyze the LinkedIn post."""
    llm_config = select_model_config(state["post_content"])
    result = await analyze_post(state["post_content"], llm_config)

    return {
        **state,
        "post_type": result.get("post_type", "unknown"),
        "category": result.get("category", "general"),
        "sentiment": result.get("sentiment", "neutral"),
        "llm_config": llm_config.model_dump(),
    }


async def planner_node(state: CommentState) -> CommentState:
    """Plan the comment strategy."""
    llm_config = select_model_config(state["post_content"])
    result = await plan_strategy(
        state["post_type"],
        state["category"],
        state["tone"],
        llm_config,
    )

    return {
        **state,
        "strategy": result.get("strategy", "write a relevant comment"),
        "llm_config": llm_config.model_dump(),
    }


async def writer_node(state: CommentState) -> CommentState:
    """Write the comment."""
    llm_config = select_model_config(state["post_content"])
    comment = await write_comment(
        state["post_content"],
        state["tone"],
        state["strategy"],
        llm_config,
    )

    return {
        **state,
        "generated_comment": comment,
        "llm_config": llm_config.model_dump(),
    }


async def reviewer_node(state: CommentState) -> CommentState:
    """Review the generated comment."""
    llm_config = select_model_config(state["post_content"])
    result = await review_comment(
        state["post_content"],
        state["generated_comment"],
        state["tone"],
        llm_config,
    )

    approved = result.get("approved", False)
    score = result.get("score", 0)

    return {
        **state,
        "review_score": score,
        "approved": approved,
        "final_comment": state["generated_comment"] if approved else "",
        "llm_config": llm_config.model_dump(),
    }


def should_regenerate(state: CommentState) -> Literal["writer", "end"]:
    """Decide whether to regenerate or end."""
    if state["approved"]:
        return "end"
    return "writer"


def create_comment_graph() -> StateGraph:
    """Create the LangGraph workflow for comment generation."""
    workflow = StateGraph(CommentState)

    workflow.add_node("analyzer", analyzer_node)
    workflow.add_node("planner", planner_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("reviewer", reviewer_node)

    workflow.set_entry_point("analyzer")
    workflow.add_edge("analyzer", "planner")
    workflow.add_edge("planner", "writer")
    workflow.add_edge("writer", "reviewer")
    workflow.add_conditional_edges(
        "reviewer",
        should_regenerate,
        {
            "writer": "writer",
            "end": END,
        },
    )

    return workflow.compile()


comment_graph = create_comment_graph()