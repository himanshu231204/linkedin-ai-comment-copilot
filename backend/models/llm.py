import os
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from langchain_litellm import ChatLiteLLM
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult


class LLMConfig(BaseModel):
    """Configuration for LLM models via xAI Grok (using LiteLLM)."""

    model_name: str = Field(..., description="Model identifier (format: provider/model)")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: int = Field(default=500, ge=1, le=4000, description="Maximum tokens in response")
    api_key: str = Field(..., description="xAI API key")
    base_url: str = Field(default="https://api.x.ai/v1", description="xAI API base URL")
    # xAI-specific options
    source_domain: Optional[str] = Field(default=None, description="X-Source header for domain identification")
    session_id: Optional[str] = Field(default=None, description="Session ID for conversation tracking")
    enable_reasoning: bool = Field(default=False, description="Enable reasoning for supported models")
    reasoning_effort: Optional[str] = Field(default=None, description="Reasoning effort level (low, medium, high)")
    # LiteLLM specific
    custom_llm_provider: str = Field(default="openai", description="LiteLLM provider name")


class LLMCallbackHandler(BaseCallbackHandler):
    """Callback handler to capture LLM response metadata (cost, tokens, etc.)."""

    def __init__(self):
        self.last_response_metadata: Dict[str, Any] = {}
        self.total_tokens: int = 0
        self.prompt_tokens: int = 0
        self.completion_tokens: int = 0
        self.estimated_cost: float = 0.0

    def on_llm_end(self, response: LLMResult, **kwargs) -> None:
        """Capture response metadata from xAI Grok via LiteLLM."""
        if response.llm_output:
            self.last_response_metadata = response.llm_output.get('metadata', {})
            # LiteLLM provides token usage in llm_output
            token_usage = response.llm_output.get('token_usage', {})
            if token_usage:
                self.prompt_tokens = token_usage.get('prompt_tokens', 0)
                self.completion_tokens = token_usage.get('completion_tokens', 0)
                self.total_tokens = token_usage.get('total_tokens', 0)
            # Cost info if available
            self.estimated_cost = response.llm_output.get('cost', 0.0)


def create_llm(config: LLMConfig, callbacks: Optional[List[BaseCallbackHandler]] = None) -> ChatLiteLLM:
    """Create a ChatLiteLLM instance configured for xAI Grok API."""
    # Build default headers for xAI API
    default_headers = {}
    if config.source_domain:
        default_headers["X-Source"] = config.source_domain
    if config.session_id:
        default_headers["X-Session-ID"] = config.session_id

    # Model kwargs for xAI-specific features
    model_kwargs = {}
    if config.enable_reasoning:
        model_kwargs["reasoning"] = {"effort": config.reasoning_effort or "medium"}

    # LiteLLM uses the format: "provider/model" or just "model" with custom_llm_provider
    # For xAI Grok, we use the OpenAI-compatible endpoint
    model = config.model_name
    if "/" in model and not model.startswith("openai/"):
        # Convert provider/model to litellm format
        provider, model_name = model.split("/", 1)
        model = f"{provider}/{model_name}"

    return ChatLiteLLM(
        model=model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        api_key=config.api_key,
        api_base=config.base_url,
        custom_llm_provider=config.custom_llm_provider,
        default_headers=default_headers if default_headers else None,
        model_kwargs=model_kwargs if model_kwargs else None,
        callbacks=callbacks,
    )


def get_default_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get default LLM configuration (Grok 3 - fast & capable)."""
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY environment variable is required")

    return LLMConfig(
        model_name="grok-3",
        temperature=0.7,
        max_tokens=500,
        api_key=api_key,
        base_url="https://api.x.ai/v1",
        source_domain=source_domain,
        custom_llm_provider="openai",
    )


def get_premium_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get premium LLM configuration (Grok 3 with reasoning - highest quality)."""
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY environment variable is required")

    return LLMConfig(
        model_name="grok-3",
        temperature=0.7,
        max_tokens=500,
        api_key=api_key,
        base_url="https://api.x.ai/v1",
        source_domain=source_domain,
        custom_llm_provider="openai",
        enable_reasoning=True,
        reasoning_effort="medium",
    )


def get_technical_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get technical LLM configuration (Grok 3 Mini - fast for technical content)."""
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY environment variable is required")

    return LLMConfig(
        model_name="grok-3-mini",
        temperature=0.5,
        max_tokens=500,
        api_key=api_key,
        base_url="https://api.x.ai/v1",
        source_domain=source_domain,
        custom_llm_provider="openai",
    )


def get_reasoning_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get reasoning-enabled LLM configuration (Grok 3 with high reasoning - for complex analysis tasks)."""
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY environment variable is required")

    return LLMConfig(
        model_name="grok-3",
        temperature=0.3,
        max_tokens=1000,
        api_key=api_key,
        base_url="https://api.x.ai/v1",
        source_domain=source_domain,
        custom_llm_provider="openai",
        enable_reasoning=True,
        reasoning_effort="high",
    )