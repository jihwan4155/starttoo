from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    # degraded = 서버는 응답하지만 모델 중 하나가 로딩에 실패한 상태다. 컨테이너를 unhealthy 로
    # 떨어뜨리지는 않는다(nginx 가 ai-api 의 healthy 를 기다리므로 사이트가 같이 내려간다).
    status: Literal["ok", "degraded"]
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
