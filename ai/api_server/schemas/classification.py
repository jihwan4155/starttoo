from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class LabelResult(BaseModel):
    label: str
    confidence: float = Field(ge=0.0, le=1.0)


class TattooClassificationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    request_id: str = Field(serialization_alias="requestId")
    processing_seconds: float = Field(serialization_alias="processingSeconds")
    primary: LabelResult
    secondary: LabelResult
    color: LabelResult
    rendering: LabelResult
    subject: LabelResult
