from pydantic import BaseModel, Field


class GenerateCommentRequest(BaseModel):
    """Request model for generating a LinkedIn comment."""

    post_content: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="The LinkedIn post content to generate a comment for",
    )
    tone: str = Field(
        ...,
        description="The tone/style of the comment to generate",
        examples=["professional", "technical", "supportive", "networking", "thoughtful"],
    )

    class Config:
        json_schema_extra = {
            "example": {
                "post_content": "Just started my new role as Software Engineer at Google! Excited for this new chapter.",
                "tone": "professional",
            }
        }