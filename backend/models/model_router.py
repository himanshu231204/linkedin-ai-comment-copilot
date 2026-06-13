from .llm import (
    LLMConfig,
    get_analyzer_llm_config,
    get_planner_llm_config,
    get_writer_llm_config,
    get_reviewer_llm_config,
    get_default_llm_config,
    get_premium_llm_config,
)


TECHNICAL_KEYWORDS = [
    "AI",
    "ML",
    "LLM",
    "LangGraph",
    "RAG",
    "Agent",
    "MCP",
    "Vector Database",
    "Transformer",
    "Research",
    "Machine Learning",
    "Deep Learning",
    "Neural Network",
    "Fine-tuning",
    "Prompt Engineering",
    "Embeddings",
    "LangChain",
    "Hugging Face",
    "PyTorch",
    "TensorFlow",
    "Kubernetes",
    "Docker",
    "Microservices",
    "Distributed Systems",
]


def contains_technical_keywords(text: str) -> bool:
    """Check if text contains technical keywords."""
    text_lower = text.lower()
    return any(keyword.lower() in text_lower for keyword in TECHNICAL_KEYWORDS)


def select_model_config(post_content: str, source_domain: str = "linkedin-ai-comment-copilot") -> LLMConfig:
    """
    Select the appropriate model configuration based on post content.

    Deprecated: Use get_analyzer_llm_config, get_writer_llm_config, etc. directly.
    Kept for backward compatibility.
    """
    return get_default_llm_config(source_domain=source_domain)