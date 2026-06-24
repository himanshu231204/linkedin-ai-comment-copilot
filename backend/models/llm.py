import os
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from langchain_litellm import ChatLiteLLM
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult

try:
    from litellm import model_cost
except ImportError:
    model_cost = {}

logger = logging.getLogger(__name__)


class LLMConfig(BaseModel):
    """Configuration for LLM models (using LiteLLM)."""

    model_name: str = Field(..., description="Model identifier (format: provider/model)")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: int = Field(default=500, ge=1, le=4000, description="Maximum tokens in response")
    api_key: str = Field(..., description="API key for the provider")
    base_url: Optional[str] = Field(default=None, description="API base URL (if not using default)")
    source_domain: Optional[str] = Field(default=None, description="X-Source header for domain identification")
    session_id: Optional[str] = Field(default=None, description="Session ID for conversation tracking")
    enable_reasoning: bool = Field(default=False, description="Enable reasoning for supported models")
    reasoning_effort: Optional[str] = Field(default=None, description="Reasoning effort level (low, medium, high)")
    custom_llm_provider: Optional[str] = Field(default=None, description="LiteLLM provider name (auto-detected if None)")


# ---------- Pricing helpers ----------

# Fallback pricing per 1M tokens (USD) in case litellm.model_cost is stale/missing.
_FALLBACK_PRICING: Dict[str, Dict[str, float]] = {
    "gemini/gemini-2.5-flash":      {"input": 0.15, "output": 0.60},
    "groq/llama-3.3-70b-versatile": {"input": 0.59, "output": 0.79},
}


@dataclass
class LLMCostResult:
    """Result of a single LLM call cost measurement."""
    model: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    input_cost_usd: float = 0.0
    output_cost_usd: float = 0.0
    total_cost_usd: float = 0.0


def _resolve_pricing(model_name: str) -> Dict[str, float]:
    """Return {'input': cost_per_1m, 'output': cost_per_1m} for a model."""
    # Try litellm's built-in pricing table first
    if model_name in model_cost:
        entry = model_cost[model_name]
        return {
            "input": float(entry.get("input_cost_per_token", 0)) * 1_000_000,
            "output": float(entry.get("output_cost_per_token", 0)) * 1_000_000,
        }
    # Fall back to our hardcoded table
    if model_name in _FALLBACK_PRICING:
        return _FALLBACK_PRICING[model_name]
    return {"input": 0.0, "output": 0.0}


def get_llm_cost(response: LLMResult, model_name: str) -> LLMCostResult:
    """Extract token usage from a LangChain LLMResult and compute cost.

    This works with any ChatLiteLLM response — no callback wiring required.
    """
    prompt_tokens = 0
    completion_tokens = 0

    # Token usage lives in llm_output under the 'token_usage' key
    token_usage: Dict[str, int] = {}
    if response.llm_output:
        token_usage = response.llm_output.get("token_usage", {})

    prompt_tokens = token_usage.get("prompt_tokens", 0)
    completion_tokens = token_usage.get("completion_tokens", 0)
    total_tokens = prompt_tokens + completion_tokens

    pricing = _resolve_pricing(model_name)
    input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
    output_cost = (completion_tokens / 1_000_000) * pricing["output"]

    return LLMCostResult(
        model=model_name,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        input_cost_usd=round(input_cost, 8),
        output_cost_usd=round(output_cost, 8),
        total_cost_usd=round(input_cost + output_cost, 8),
    )


class LLMCallbackHandler(BaseCallbackHandler):
    """Callback handler that automatically tracks token usage and cost after each LLM call.

    Usage::

        handler = LLMCallbackHandler()
        llm = create_llm(config, callbacks=[handler])
        await llm.ainvoke(messages)
        print(handler.last_cost)  # LLMCostResult
    """

    def __init__(self):
        self.last_response_metadata: Dict[str, Any] = {}
        self.total_tokens: int = 0
        self.prompt_tokens: int = 0
        self.completion_tokens: int = 0
        self.estimated_cost: float = 0.0
        self.last_cost: Optional[LLMCostResult] = None
        self._model_name: str = ""

    def set_model_name(self, model_name: str) -> None:
        """Set the model name so cost lookup works in on_llm_end."""
        self._model_name = model_name

    def on_llm_end(self, response: LLMResult, **kwargs) -> None:
        """Capture token usage and cost from the LLM response."""
        if response.llm_output:
            self.last_response_metadata = response.llm_output.get("metadata", {})
            token_usage = response.llm_output.get("token_usage", {})
            if token_usage:
                self.prompt_tokens = token_usage.get("prompt_tokens", 0)
                self.completion_tokens = token_usage.get("completion_tokens", 0)
                self.total_tokens = token_usage.get("total_tokens", 0)
            self.estimated_cost = response.llm_output.get("cost", 0.0)

        # Compute structured cost result
        self.last_cost = get_llm_cost(response, self._model_name)


def create_llm(config: LLMConfig, callbacks: Optional[List[BaseCallbackHandler]] = None) -> ChatLiteLLM:
    """Create a ChatLiteLLM instance based on config."""
    # Build default headers
    default_headers = {}
    if config.source_domain:
        default_headers["X-Source"] = config.source_domain
    if config.session_id:
        default_headers["X-Session-ID"] = config.session_id

    # Model kwargs for reasoning features
    model_kwargs = {}
    if config.enable_reasoning:
        model_kwargs["reasoning"] = {"effort": config.reasoning_effort or "medium"}

    # Build kwargs for ChatLiteLLM
    kwargs = {
        "model": config.model_name,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "api_key": config.api_key,
    }

    # Add base_url only if provided (some providers use default)
    if config.base_url:
        kwargs["api_base"] = config.base_url

    # Add custom_llm_provider only if specified
    if config.custom_llm_provider:
        kwargs["custom_llm_provider"] = config.custom_llm_provider

    # Add optional headers
    if default_headers:
        kwargs["default_headers"] = default_headers

    # Add model kwargs if any
    if model_kwargs:
        kwargs["model_kwargs"] = model_kwargs

    # Add callbacks
    if callbacks:
        kwargs["callbacks"] = callbacks

    return ChatLiteLLM(**kwargs)


def get_analyzer_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get LLM configuration for Analyzer agent (Gemini 2.5 Flash)."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is required")

    return LLMConfig(
        model_name="gemini/gemini-2.5-flash",
        temperature=0.3,
        max_tokens=200,
        api_key=api_key,
        source_domain=source_domain,
    )


def get_planner_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get LLM configuration for Planner agent (Gemini 2.5 Flash)."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is required")

    return LLMConfig(
        model_name="gemini/gemini-2.5-flash",
        temperature=0.5,
        max_tokens=200,
        api_key=api_key,
        source_domain=source_domain,
    )


def get_writer_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get LLM configuration for Writer agent (Llama 3.3 70B Versatile via Groq)."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is required")

    return LLMConfig(
        model_name="groq/llama-3.3-70b-versatile",
        temperature=0.7,
        max_tokens=500,
        api_key=api_key,
        source_domain=source_domain,
    )


def get_reviewer_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get LLM configuration for Reviewer agent (Llama 3.3 70B Versatile via Groq)."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is required")

    return LLMConfig(
        model_name="groq/llama-3.3-70b-versatile",
        temperature=0.3,
        max_tokens=300,
        api_key=api_key,
        source_domain=source_domain,
    )


def get_default_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get default LLM configuration (Gemini 2.5 Flash)."""
    return get_analyzer_llm_config(source_domain=source_domain)


def get_fallback_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get fallback LLM configuration (Groq Llama 3.3 70B) for when primary provider fails."""
    return get_writer_llm_config(source_domain=source_domain)


def get_premium_llm_config(source_domain: Optional[str] = None) -> LLMConfig:
    """Get premium LLM configuration (Llama 3.3 70B Versatile via Groq)."""
    return get_writer_llm_config(source_domain=source_domain)