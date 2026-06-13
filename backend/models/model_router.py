from .llm import LLMConfig, get_default_llm_config, get_premium_llm_config, get_technical_llm_config


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
    Select the appropriate Grok model configuration based on post content.

    Logic:
    - If post length < 400 chars: Use Grok 3 Mini (fast, lightweight)
    - If post contains technical keywords: Use Grok 3 Mini (fast for technical analysis)
    - Otherwise: Use Grok 3 (full capability)

    Args:
        post_content: The LinkedIn post content to analyze
        source_domain: Domain identifier for xAI API X-Source header (analytics)

    Returns:
        LLMConfig with appropriate Grok model and settings
    """
    if len(post_content) < 400:
        return get_default_llm_config(source_domain=source_domain)

    if contains_technical_keywords(post_content):
        return get_technical_llm_config(source_domain=source_domain)

    return get_premium_llm_config(source_domain=source_domain)