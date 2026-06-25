from typing import TypedDict, Literal
from langgraph.graph import StateGraph, END

try:
    from ..agents.analyzer import analyze_post
    from ..agents.planner import plan_strategy
    from ..agents.writer import write_comment
    from ..agents.reviewer import review_comment
except ImportError:
    from agents.analyzer import analyze_post
    from agents.planner import plan_strategy
    from agents.writer import write_comment
    from agents.reviewer import review_comment


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


async def analyzer_node(state: CommentState) -> CommentState:
    """Analyze the LinkedIn post (Groq primary, Gemini fallback via Router)."""
    result = await analyze_post(state["post_content"])

    return {
        **state,
        "post_type": result.get("post_type", "unknown"),
        "category": result.get("category", "general"),
        "sentiment": result.get("sentiment", "neutral"),
    }


async def planner_node(state: CommentState) -> CommentState:
    """Plan the comment strategy (Groq primary, Gemini fallback via Router)."""
    result = await plan_strategy(
        state["post_type"],
        state["category"],
        state["tone"],
    )

    return {
        **state,
        "strategy": result.get("strategy", "write a relevant comment"),
    }


async def writer_node(state: CommentState) -> CommentState:
    """Write the comment (Groq primary, Gemini fallback via Router)."""
    comment = await write_comment(
        state["post_content"],
        state["tone"],
        state["strategy"],
    )

    return {
        **state,
        "generated_comment": comment,
    }


async def reviewer_node(state: CommentState) -> CommentState:
    """Review the generated comment (Groq primary, Gemini fallback via Router)."""
    result = await review_comment(
        state["post_content"],
        state["generated_comment"],
        state["tone"],
    )

    approved = result.get("approved", False)
    score = result.get("score", 0)

    return {
        **state,
        "review_score": score,
        "approved": approved,
        "final_comment": state["generated_comment"] if approved else "",
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