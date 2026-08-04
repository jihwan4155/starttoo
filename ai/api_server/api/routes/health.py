from __future__ import annotations

from fastapi import APIRouter, Depends

from api_server import __version__
from api_server.api.dependencies import (
    get_extractor_service,
    get_generator_service,
    get_classifier_service,
)
from api_server.schemas.health import HealthResponse
from api_server.services.tattoo_extractor import TattooExtractorService
from api_server.services.tattoo_generator import TattooGeneratorService
from api_server.services.tattoo_classifier import TattooClassifierService

router = APIRouter(tags=["system"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="서버 상태 확인",
)
async def health(
    service: TattooExtractorService = Depends(get_extractor_service),
    generator: TattooGeneratorService = Depends(get_generator_service),
    classifier: TattooClassifierService = Depends(get_classifier_service),
) -> HealthResponse:
    # 로딩 중이거나 아직 로드하지 않은 상태는 정상으로 본다(지연 로딩이 정상 운영 방식이다).
    # 실제로 로딩에 실패한 error 만 degraded 로 드러낸다. 이게 없으면 status 가 항상 "ok" 라
    # 분류 모델이 죽어 있어도 겉으로는 멀쩡해 보인다.
    degraded = "error" in {
        service.status,
        generator.status,
        classifier.status,
    }
    return HealthResponse(
        status="degraded" if degraded else "ok",
        version=__version__,
        pipeline_configured=service.configured,
        pipeline_status=service.status,
        model=service.model_name,
        device=service.device,
        message=service.message,
        generator_configured=generator.configured,
        generator_status=generator.status,
        generator_model=generator.model_name,
        generator_device=generator.device,
        generator_message=generator.message,
        classifier_configured=classifier.configured,
        classifier_status=classifier.status,
        classifier_model=classifier.model_name,
        subject_model=classifier.subject_model_name,
        classifier_device=classifier.device,
        classifier_message=classifier.message,
        inference_busy=(
            service.is_busy or generator.is_busy or classifier.is_busy
        ),
    )
