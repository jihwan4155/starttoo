from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from api_server.api.dependencies import (
    get_event_log,
    get_generator_service,
)
from api_server.core.event_log import EventLog
from api_server.schemas.generation import (
    GenerateTattooRequest,
    TattooStylesResponse,
)
from api_server.services.tattoo_generator import (
    MAX_STYLES,
    SUPPORTED_STYLES,
    TattooGeneratorService,
    normalize_styles,
)

router = APIRouter(prefix="/generate", tags=["tattoo generation"])


@router.get(
    "/styles",
    response_model=TattooStylesResponse,
    summary="사용 가능한 생성 스타일 조회",
)
async def list_styles() -> TattooStylesResponse:
    return TattooStylesResponse(
        styles=list(SUPPORTED_STYLES),
        max_styles=MAX_STYLES,
    )


@router.post(
    "",
    response_class=Response,
    responses={
        200: {
            "description": "프롬프트와 스타일로 생성한 PNG 타투 도안",
            "content": {"image/png": {}},
        },
        400: {"description": "지원하지 않는 스타일"},
        422: {"description": "요청값 검증 실패"},
        503: {"description": "생성 모델 사용 불가 또는 다른 GPU 작업 처리 중"},
    },
    summary="프롬프트와 스타일로 타투 도안 PNG 생성",
    description=(
        "성공하면 JSON이 아니라 image/png 파일을 반환합니다. Swagger의 기본 예시는 "
        "1024×1024, 30 step입니다."
    ),
)
async def generate_tattoo(
    request: Request,
    payload: GenerateTattooRequest,
    service: TattooGeneratorService = Depends(get_generator_service),
    event_log: EventLog = Depends(get_event_log),
) -> Response:
    try:
        styles = normalize_styles(payload.style)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    request_id = request.state.request_id
    event_log.add(
        "info",
        "generation.accepted",
        "타투 도안 생성 요청 접수",
        request_id=request_id,
        styles=styles,
        prompt_length=len(payload.prompt),
        requested_seed=payload.seed,
        steps=payload.steps,
        guidance=payload.guidance,
        size=payload.size,
    )
    needs_loading = service.status != "ready"
    if needs_loading:
        event_log.add(
            "info",
            "generator.loading",
            "Stable Diffusion 1.5 타투 생성 모델 로딩 시작",
            request_id=request_id,
        )
    try:
        result = await service.generate(
            prompt=payload.prompt,
            style=styles,
            seed=payload.seed,
            steps=payload.steps,
            guidance=payload.guidance,
            size=payload.size,
        )
    except Exception as exc:
        event_log.add(
            "error",
            "generation.failed",
            "타투 도안 생성 실패",
            request_id=request_id,
            error=str(exc),
        )
        raise

    if needs_loading:
        event_log.add(
            "info",
            "generator.ready",
            service.message,
            request_id=request_id,
            device=service.device,
        )

    event_log.add(
        "info",
        "generation.completed",
        "타투 도안 생성 완료",
        request_id=request_id,
        styles=list(result.styles),
        seed=result.seed,
        processing_seconds=round(result.processing_seconds, 3),
        width=result.width,
        height=result.height,
    )
    filename = f"tattoo_generated_{result.seed}.png"
    encoded_name = quote(filename)
    return Response(
        content=result.content,
        media_type="image/png",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"; '
                f"filename*=UTF-8''{encoded_name}"
            ),
            "Cache-Control": "no-store",
            "X-Request-ID": request_id,
            "X-Processing-Seconds": f"{result.processing_seconds:.3f}",
            "X-Image-Width": str(result.width),
            "X-Image-Height": str(result.height),
            "X-Generation-Seed": str(result.seed),
            "X-Generation-Styles": ",".join(result.styles),
        },
    )
