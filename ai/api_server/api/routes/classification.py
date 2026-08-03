from __future__ import annotations

import time
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Request, UploadFile

from api_server.api.dependencies import (
    get_classifier_service,
    get_event_log,
    get_extractor_service,
)
from api_server.api.routes.extraction import _read_upload, _validate_image
from api_server.core.event_log import EventLog
from api_server.schemas.classification import (
    LabelResult,
    TattooClassificationResponse,
)
from api_server.services.tattoo_classifier import TattooClassifierService
from api_server.services.tattoo_extractor import TattooExtractorService

router = APIRouter(prefix="/classify", tags=["tattoo classification"])


@router.post(
    "",
    response_model=TattooClassificationResponse,
    responses={
        200: {"description": "primary, secondary, color, rendering, subject 추론 결과"},
        413: {"description": "파일 또는 이미지가 너무 큼"},
        415: {"description": "지원하지 않는 파일 형식"},
        422: {"description": "유효하지 않은 이미지"},
        500: {"description": "이미지 분류 실패"},
        503: {"description": "모델 사용 불가 또는 다른 GPU 작업 처리 중"},
    },
    summary="타투 이미지의 5개 라벨 분류",
    description=(
        "이미지에서 primary, secondary, color, rendering을 ConvNeXtV2 specialist로 "
        "추론하고 subject를 google/siglip2-so400m-patch16-384로 추론합니다."
    ),
)
async def classify_tattoo(
    request: Request,
    file: Annotated[
        UploadFile,
        File(description="JPG, PNG 또는 WEBP 타투 이미지"),
    ],
    classifier: TattooClassifierService = Depends(get_classifier_service),
    extractor: TattooExtractorService = Depends(get_extractor_service),
    event_log: EventLog = Depends(get_event_log),
) -> TattooClassificationResponse:
    request_id = request.state.request_id
    extractor.ensure_ready()
    classifier.ensure_configured()
    raw = await _read_upload(file, extractor.max_upload_bytes)
    _validate_image(raw)
    filename = Path(file.filename or "tattoo").name
    event_log.add(
        "info",
        "classification.accepted",
        "타투 이미지 5축 분류 요청 접수",
        request_id=request_id,
        filename=filename,
        bytes=len(raw),
    )
    started = time.perf_counter()
    needs_loading = classifier.status != "ready"
    if needs_loading:
        event_log.add(
            "info",
            "classifier.loading",
            "ConvNeXtV2와 SigLIP2 분류 모델 로딩 시작",
            request_id=request_id,
        )
    try:
        extracted = await extractor.extract(raw, "transparent")
        result = await classifier.classify(raw, extracted.content)
    except Exception as exc:
        event_log.add(
            "error",
            "classification.failed",
            "타투 이미지 5축 분류 실패",
            request_id=request_id,
            error=str(exc),
        )
        raise
    if needs_loading:
        event_log.add(
            "info",
            "classifier.ready",
            classifier.message,
            request_id=request_id,
            device=classifier.device,
        )
    total_seconds = time.perf_counter() - started
    event_log.add(
        "info",
        "classification.completed",
        "타투 이미지 5축 분류 완료",
        request_id=request_id,
        processing_seconds=round(total_seconds, 3),
        primary=result.primary.label,
        secondary=result.secondary.label,
        color=result.color.label,
        rendering=result.rendering.label,
        subject=result.subject.label,
    )
    return TattooClassificationResponse(
        request_id=request_id,
        processing_seconds=round(total_seconds, 3),
        primary=LabelResult(
            label=result.primary.label,
            confidence=result.primary.confidence,
        ),
        secondary=LabelResult(
            label=result.secondary.label,
            confidence=result.secondary.confidence,
        ),
        color=LabelResult(
            label=result.color.label,
            confidence=result.color.confidence,
        ),
        rendering=LabelResult(
            label=result.rendering.label,
            confidence=result.rendering.confidence,
        ),
        subject=LabelResult(
            label=result.subject.label,
            confidence=result.subject.confidence,
        ),
    )
