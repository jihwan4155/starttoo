from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
    pipeline_configured: bool
    pipeline_status: Literal[
        "not_configured",
        "not_loaded",
        "loading",
        "ready",
        "error",
    ]
    model: str
    device: str | None = None
    message: str
    generator_configured: bool
    generator_status: Literal[
        "not_configured",
        "not_loaded",
        "loading",
        "ready",
        "error",
    ]
    generator_model: str
    generator_device: str | None = None
    generator_message: str
    classifier_configured: bool
    classifier_status: Literal[
        "not_configured",
        "not_loaded",
        "loading",
        "ready",
        "error",
    ]
    classifier_model: str
    subject_model: str
    classifier_device: str | None = None
    classifier_message: str
    inference_busy: bool
