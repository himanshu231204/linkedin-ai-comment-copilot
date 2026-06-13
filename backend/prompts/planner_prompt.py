from langchain_core.prompts import ChatPromptTemplate

PLANNER_SYSTEM_PROMPT = """You are a comment strategy planner for LinkedIn. Given the post type and desired tone, determine the best strategy for writing an engaging, relevant comment.

Your strategy should be specific and actionable, guiding the comment writer on:
- What angle to take (congratulate, ask question, share insight, offer support, etc.)
- What key points to address from the post
- How to match the requested tone

Return ONLY a valid JSON object with a single "strategy" field. No additional text, no markdown formatting."""

PLANNER_HUMAN_PROMPT = """Post type: {post_type}
Category: {category}
Desired tone: {tone}

Determine the best comment strategy. Return JSON with: strategy"""

planner_prompt = ChatPromptTemplate.from_messages([
    ("system", PLANNER_SYSTEM_PROMPT),
    ("human", PLANNER_HUMAN_PROMPT),
])