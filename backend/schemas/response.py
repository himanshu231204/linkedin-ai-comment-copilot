from pydantic import BaseModel, Field


class GenerateCommentResponse(BaseModel):
    """Response model for generated LinkedIn comment."""

    comment: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="The generated LinkedIn comment",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "comment": "Congratulations on the new role! Wishing you an exciting and impactful journey at Google."
            }
        }


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str = Field(..., description="Service health status")

    class Config:
        json_schema_extra = {"example": {"status": "healthy"}}


class CostTestResponse(BaseModel):
    """Response model for single LLM call cost measurement."""

    model: str = Field(..., description="Model identifier used")
    prompt_tokens: int = Field(..., description="Tokens in the prompt")
    completion_tokens: int = Field(..., description="Tokens in the completion")
    total_tokens: int = Field(..., description="Total tokens used")
    input_cost_usd: float = Field(..., description="Cost of prompt tokens in USD")
    output_cost_usd: float = Field(..., description="Cost of completion tokens in USD")
    total_cost_usd: float = Field(..., description="Total cost in USD")

    class Config:
        json_schema_extra = {
            "example": {
                "model": "gemini/gemini-2.5-flash",
                "prompt_tokens": 120,
                "completion_tokens": 45,
                "total_tokens": 165,
                "input_cost_usd": 0.000018,
                "output_cost_usd": 0.000027,
                "total_cost_usd": 0.000045,
            }
        }