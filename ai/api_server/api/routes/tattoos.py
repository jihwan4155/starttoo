from __future__ import annotations

import asyncio
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest
from urllib.request import urlopen

from fastapi import APIRouter, Depends, HTTPException, Request

from api_server.api.dependencies import (
    get_classifier_service,
    get_event_log,
    get_extractor_service,
)
from api_server.api.routes.extraction import READ_CHUNK_BYTES, _validate_image
from api_server.core.event_log import EventLog
from api_server.schemas.tattoos import (
    TattooAnalysisResponse,
    TattooDetectionResponse,
    TattooImageRequest,
)
from api_server.services.tattoo_classifier import TattooClassifierService
from api_server.services.tattoo_extractor import TattooExtractorService

router = APIRouter(prefix="/tattoos", tags=["tattoo analysis"])

MIN_TATTOO_RATIO = 0.0005
DOWNLOAD_TIMEOUT_SECONDS = 10


def _download_image_sync(image_url: str, max_bytes: int) -> bytes:
    request = UrlRequest(
        image_url,
        headers={"User-Agent": "starttoo-ai-server/1.0"},
        method="GET",
    )
    try:
        with urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
            content = bytearray()
            while True:
                chunk = response.read(READ_CHUNK_BYTES)
                if not chunk:
                    break
                content.extend(chunk)
                if len(content) > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Image must be {max_bytes // (1024 * 1024)}MB or smaller.",
                    )
    except HTTPException:
        raise
    except HTTPError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Image download failed with status {exc.code}.",
        ) from exc
    except (OSError, URLError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Image URL could not be downloaded.",
        ) from exc
    if not content:
        raise HTTPException(status_code=400, detail="Image URL returned an empty body.")
    return bytes(content)


async def _download_image(image_url: str, max_bytes: int) -> bytes:
    return await asyncio.to_thread(_download_image_sync, image_url, max_bytes)


async def _load_valid_image(
    payload: TattooImageRequest,
    extractor: TattooExtractorService,
) -> bytes:
    raw = await _download_image(str(payload.image_url), extractor.max_upload_bytes)
    _validate_image(raw)
    return raw


@router.post(
    "/detect",
    response_model=TattooDetectionResponse,
    summary="Detect whether an image contains a tattoo",
)
async def detect_tattoo(
    payload: TattooImageRequest,
    request: Request,
    extractor: TattooExtractorService = Depends(get_extractor_service),
    event_log: EventLog = Depends(get_event_log),
) -> TattooDetectionResponse:
    request_id = request.state.request_id
    extractor.ensure_ready()
    raw = await _load_valid_image(payload, extractor)
    result = await extractor.extract(raw, "mask")
    is_tattoo = result.predicted_ratio >= MIN_TATTOO_RATIO
    event_log.add(
        "info",
        "tattoo.detect.completed",
        "Tattoo detection completed",
        request_id=request_id,
        predicted_ratio=round(result.predicted_ratio, 6),
        is_tattoo=is_tattoo,
    )
    return TattooDetectionResponse(is_tattoo=is_tattoo)


@router.post(
    "/analyze",
    response_model=TattooAnalysisResponse,
    summary="Analyze tattoo style, color, rendering, and subject labels",
)
async def analyze_tattoo(
    payload: TattooImageRequest,
    request: Request,
    extractor: TattooExtractorService = Depends(get_extractor_service),
    classifier: TattooClassifierService = Depends(get_classifier_service),
    event_log: EventLog = Depends(get_event_log),
) -> TattooAnalysisResponse:
    request_id = request.state.request_id
    extractor.ensure_ready()
    classifier.ensure_configured()
    raw = await _load_valid_image(payload, extractor)
    extracted = await extractor.extract(raw, "transparent")
    if extracted.predicted_ratio < MIN_TATTOO_RATIO:
        raise HTTPException(status_code=422, detail="Image does not contain a tattoo.")
    result = await classifier.classify(raw, extracted.content)
    secondary = [] if result.secondary.label == "none" else [result.secondary.label]
    renderings = [rendering.label for rendering in result.renderings[:2]]
    event_log.add(
        "info",
        "tattoo.analyze.completed",
        "Tattoo analysis completed",
        request_id=request_id,
        primary=result.primary.label,
        secondary=secondary,
        color=result.color.label,
        rendering=renderings,
        subject=result.subject.label,
    )
    return TattooAnalysisResponse(
        primary_style_code=result.primary.label,
        secondary_style_codes=secondary,
        rendering_style_codes=renderings,
        color_code=result.color.label,
        subjects=[result.subject.label],
    )
