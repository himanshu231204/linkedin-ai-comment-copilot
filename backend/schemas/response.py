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