from __future__ import annotations

import io
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import RedirectResponse
from PIL import Image, UnidentifiedImageError

from api_server.api.dependencies import get_event_log, get_extractor_service
from api_server.core.event_log import EventLog
from api_server.services.tattoo_extractor import TattooExtractorService

router = APIRouter(prefix="/extract", tags=["tattoo extraction"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/octet-stream",
}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_IMAGE_PIXELS = 40_000_000
READ_CHUNK_BYTES = 1024 * 1024


@router.get(
    "",
    response_class=RedirectResponse,
    include_in_schema=False,
)
async def open_extraction_demo() -> RedirectResponse:
    return RedirectResponse(url="/demo", status_code=303)


async def _read_upload(file: UploadFile, max_bytes: int) -> bytes:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="JPG, PNG 또는 WEBP 이미지만 업로드할 수 있습니다.",
        )

    content = bytearray()
    try:
        while chunk := await file.read(READ_CHUNK_BYTES):
            content.extend(chunk)
            if len(content) > max_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"업로드 파일은 {max_bytes // (1024 * 1024)}MB 이하여야 합니다.",
                )
    finally:
        await file.close()

    if not content:
        raise HTTPException(status_code=400, detail="빈 파일은 처리할 수 없습니다.")
    return bytes(content)


def _validate_image(raw: bytes) -> None:
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in ALLOWED_FORMATS:
                raise HTTPException(
                    status_code=415,
                    detail="JPG, PNG 또는 WEBP 이미지만 업로드할 수 있습니다.",
                )
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=413,
                    detail="이미지 해상도는 4천만 픽셀 이하여야 합니다.",
                )
            image.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail="손상되었거나 지원하지 않는 이미지입니다.",
        ) from exc


@router.post(
    "",
    response_class=Response,
    responses={
        200: {
            "description": "배경이 제거된 PNG",
            "content": {"image/png": {}},
        },
        413: {"description": "파일 또는 이미지가 너무 큼"},
        415: {"description": "지원하지 않는 파일 형식"},
        422: {"description": "유효하지 않은 이미지"},
        503: {"description": "모델 사용 불가 또는 다른 GPU 작업 처리 중"},
    },
    summary="타투 사진에서 도안 PNG 추출",
)
async def extract_tattoo(
    request: Request,
    file: Annotated[
        UploadFile,
        File(description="JPG, PNG 또는 WEBP 타투 사진"),
    ],
    output: Annotated[
        Literal["transparent", "white", "mask", "alpha"],
        Query(description="반환할 PNG 종류"),
    ] = "transparent",
    service: TattooExtractorService = Depends(get_extractor_service),
    event_log: EventLog = Depends(get_event_log),
) -> Response:
    request_id = request.state.request_id
    service.ensure_ready()
    max_bytes = service.max_upload_bytes
    raw = await _read_upload(file, max_bytes)
    _validate_image(raw)

    event_log.add(
        "info",
        "upload.accepted",
        "업로드 이미지 검증 완료",
        request_id=request_id,
        filename=Path(file.filename or "tattoo").name,
        bytes=len(raw),
        output=output,
    )
    try:
        result = await service.extract(raw, output)
    except Exception as exc:
        event_log.add(
            "error",
            "extraction.failed",
            "타투 도안 추출 실패",
            request_id=request_id,
            error=str(exc),
        )
        raise

    event_log.add(
        "info",
        "extraction.completed",
        "타투 도안 추출 완료",
        request_id=request_id,
        output=output,
        processing_seconds=round(result.processing_seconds, 3),
        width=result.width,
        height=result.height,
        predicted_ratio=round(result.predicted_ratio, 6),
    )
    original_stem = Path(file.filename or "tattoo").stem
    safe_stem = "".join(
        char for char in original_stem if char.isalnum() or char in {"-", "_"}
    )[:80] or "tattoo"
    download_name = f"{safe_stem}_{output}.png"
    encoded_name = quote(download_name)

    return Response(
        content=result.content,
        media_type="image/png",
        headers={
            "Content-Disposition": (
                f"attachment; filename=\"tattoo_{output}.png\"; "
                f"filename*=UTF-8''{encoded_name}"
            ),
            "Cache-Control": "no-store",
            "X-Request-ID": request_id,
            "X-Processing-Seconds": f"{result.processing_seconds:.3f}",
            "X-Image-Width": str(result.width),
            "X-Image-Height": str(result.height),
            "X-Image-Resized": str(result.resized).lower(),
            "X-Predicted-Ratio": f"{result.predicted_ratio:.6f}",
            "X-Output-Variant": output,
        },
    )
