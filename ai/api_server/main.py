from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from api_server import __version__
from api_server.api.routes import (
    classification,
    demo,
    extraction,
    generation,
    health,
    logs,
    tattoos,
)
from api_server.core.config import Settings, get_settings
from api_server.core.event_log import EventLog
from api_server.core.exceptions import (
    ClassificationFailedError,
    ClassifierNotConfiguredError,
    ClassifierNotReadyError,
    ExtractionFailedError,
    GenerationFailedError,
    GeneratorNotConfiguredError,
    GeneratorNotReadyError,
    InferenceBusyError,
    PipelineNotConfiguredError,
    PipelineNotReadyError,
)
from api_server.services.tattoo_extractor import TattooExtractorService
from api_server.services.tattoo_generator import TattooGeneratorService
from api_server.services.tattoo_classifier import TattooClassifierService

WEB_ROOT = Path(__file__).resolve().parent / "web"
RUNTIME_ROOT = Path(__file__).resolve().parent / "runtime"


def create_app(
    settings: Settings | None = None,
    extractor_service: TattooExtractorService | None = None,
    generator_service: TattooGeneratorService | None = None,
    classifier_service: TattooClassifierService | None = None,
    event_log: EventLog | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    inference_gate = asyncio.Semaphore(1)
    inference_wait_timeout = settings.inference_wait_timeout_seconds
    extractor_service = extractor_service or TattooExtractorService(
        settings.extractor_root,
        max_upload_bytes=settings.max_upload_mb * 1024 * 1024,
        inference_gate=inference_gate,
        inference_wait_timeout=inference_wait_timeout,
    )
    generator_service = generator_service or TattooGeneratorService(
        settings.generator_root,
        inference_gate=inference_gate,
        inference_wait_timeout=inference_wait_timeout,
        cpu_offload=settings.generator_cpu_offload,
        unload_after_request=settings.generator_unload_after_request,
    )
    classifier_service = classifier_service or TattooClassifierService(
        settings.classifier_root,
        inference_gate=inference_gate,
        inference_wait_timeout=inference_wait_timeout,
    )
    if settings.low_vram_mode:
        generator_service.set_before_activate(classifier_service.unload)
        classifier_service.set_before_activate(generator_service.unload)
    event_log = event_log or EventLog(RUNTIME_ROOT / "api_server.log")

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        async def load_model() -> None:
            event_log.add(
                "info",
                "model.loading",
                "V11.7 모델 로딩 시작",
            )
            await extractor_service.load()
            event_log.add(
                "info" if extractor_service.status == "ready" else "error",
                (
                    "model.ready"
                    if extractor_service.status == "ready"
                    else "model.error"
                ),
                extractor_service.message,
                device=extractor_service.device,
            )

        async def load_generator() -> None:
            event_log.add(
                "info",
                "generator.loading",
                "Stable Diffusion 1.5 타투 생성 모델 로딩 시작",
            )
            await generator_service.load()
            event_log.add(
                "info" if generator_service.status == "ready" else "error",
                (
                    "generator.ready"
                    if generator_service.status == "ready"
                    else "generator.error"
                ),
                generator_service.message,
                device=generator_service.device,
            )

        async def load_classifier() -> None:
            event_log.add(
                "info",
                "classifier.loading",
                "ConvNeXtV2와 SigLIP2 분류 모델 로딩 시작",
            )
            await classifier_service.load()
            event_log.add(
                "info" if classifier_service.status == "ready" else "error",
                (
                    "classifier.ready"
                    if classifier_service.status == "ready"
                    else "classifier.error"
                ),
                classifier_service.message,
                device=classifier_service.device,
            )

        # 반드시 순차로 로드한다. 동시에 로드하면 서로 다른 스레드에서 transformers 를
        # 같이 import 하다가 부분 초기화된 모듈을 보고 죽는다. 실제로 추출기가
        # "cannot import name 'SegformerForSemanticSegmentation' from 'transformers'" 로
        # 실패했고, 추출기가 죽으면 타투 유무 판별이 불가능해 분류가 전량 실패한다.
        # 추출기를 먼저 올려서 판별 기능이 가장 빨리 살아나게 한다.
        async def load_models() -> None:
            if settings.model_load_on_startup:
                await load_model()
            if settings.generator_load_on_startup:
                await load_generator()
            if settings.classifier_load_on_startup:
                await load_classifier()

        # 기동을 막지 않도록 전체를 하나의 백그라운드 태스크로 띄운다.
        load_task = asyncio.create_task(load_models())
        application.state.model_load_task = load_task
        application.state.generator_load_task = load_task
        application.state.classifier_load_task = load_task
        yield
        if not load_task.done():
            await load_task

    application = FastAPI(
        title=settings.app_name,
        version=__version__,
        description="Tattoo AI inference API",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    application.state.settings = settings
    application.state.extractor_service = extractor_service
    application.state.generator_service = generator_service
    application.state.classifier_service = classifier_service
    application.state.event_log = event_log
    application.mount(
        "/demo-assets",
        StaticFiles(directory=WEB_ROOT),
        name="demo-assets",
    )

    if settings.cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_credentials=False,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=[
                "Content-Disposition",
                "X-Request-ID",
                "X-Processing-Seconds",
                "X-Image-Width",
                "X-Image-Height",
                "X-Image-Resized",
                "X-Predicted-Ratio",
                "X-Output-Variant",
                "X-Generation-Seed",
                "X-Generation-Styles",
            ],
        )

    @application.middleware("http")
    async def log_api_requests(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or uuid4().hex
        request.state.request_id = request_id
        should_log = (
            request.url.path.startswith(settings.api_prefix)
            and request.url.path != f"{settings.api_prefix}/logs"
        )
        started = time.perf_counter()
        if should_log:
            event_log.add(
                "info",
                "http.request.started",
                f"{request.method} {request.url.path}",
                request_id=request_id,
            )
        try:
            response = await call_next(request)
        except Exception as exc:
            if should_log:
                event_log.add(
                    "error",
                    "http.request.failed",
                    f"{request.method} {request.url.path}",
                    request_id=request_id,
                    error=str(exc),
                    duration_seconds=round(time.perf_counter() - started, 3),
                )
            raise
        response.headers.setdefault("X-Request-ID", request_id)
        if should_log:
            event_log.add(
                "info" if response.status_code < 400 else "warning",
                "http.request.completed",
                f"{request.method} {request.url.path}",
                request_id=request_id,
                status_code=response.status_code,
                duration_seconds=round(time.perf_counter() - started, 3),
            )
        return response

    @application.exception_handler(PipelineNotConfiguredError)
    async def handle_pipeline_not_configured(
        _request: Request,
        exc: PipelineNotConfiguredError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "PIPELINE_NOT_CONFIGURED",
                    "message": str(exc),
                }
            },
        )

    @application.exception_handler(PipelineNotReadyError)
    async def handle_pipeline_not_ready(
        _request: Request,
        exc: PipelineNotReadyError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "PIPELINE_NOT_READY",
                    "message": str(exc),
                }
            },
        )

    @application.exception_handler(ExtractionFailedError)
    async def handle_extraction_failed(
        _request: Request,
        exc: ExtractionFailedError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "EXTRACTION_FAILED",
                    "message": str(exc),
                }
            },
        )

    @application.exception_handler(GeneratorNotConfiguredError)
    async def handle_generator_not_configured(
        _request: Request,
        exc: GeneratorNotConfiguredError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "GENERATOR_NOT_CONFIGURED",
                    "message": str(exc),
                }
            },
        )

    @application.exception_handler(GeneratorNotReadyError)
    async def handle_generator_not_ready(
        _request: Request,
        exc: GeneratorNotReadyError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "GENERATOR_NOT_READY",
                    "message": str(exc),
                }
            },
        )

    @application.exception_handler(GenerationFailedError)
    async def handle_generation_failed(
        _request: Request,
        exc: GenerationFailedError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "GENERATION_FAILED",
                    "message": str(exc),
                }
            },
        )

    @application.exception_handler(InferenceBusyError)
    async def handle_inference_busy(
        _request: Request,
        exc: InferenceBusyError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "AI_SERVER_BUSY",
                    "message": str(exc),
                }
            },
            headers={"Retry-After": "3"},
        )

    @application.exception_handler(ClassifierNotConfiguredError)
    async def handle_classifier_not_configured(
        _request: Request,
        exc: ClassifierNotConfiguredError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "CLASSIFIER_NOT_CONFIGURED",
                    "message": str(exc),
                }
            },
        )

    @application.exception_handler(ClassifierNotReadyError)
    async def handle_classifier_not_ready(
        _request: Request,
        exc: ClassifierNotReadyError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "CLASSIFIER_NOT_READY",
                    "message": str(exc),
                }
            },
        )

    @application.exception_handler(ClassificationFailedError)
    async def handle_classification_failed(
        _request: Request,
        exc: ClassificationFailedError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "CLASSIFICATION_FAILED",
                    "message": str(exc),
                }
            },
        )

    @application.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "version": __version__,
            "health": "/health",
            "extract": f"{settings.api_prefix}/extract",
            "generate": f"{settings.api_prefix}/generate",
            "styles": f"{settings.api_prefix}/generate/styles",
            "classify": f"{settings.api_prefix}/classify",
            "tattoo_detect": f"{settings.api_prefix}/tattoos/detect",
            "tattoo_analyze": f"{settings.api_prefix}/tattoos/analyze",
            "demo": "/demo",
            "docs": "/docs",
        }

    application.include_router(demo.router)
    application.include_router(health.router)
    application.include_router(extraction.router, prefix=settings.api_prefix)
    application.include_router(generation.router, prefix=settings.api_prefix)
    application.include_router(classification.router, prefix=settings.api_prefix)
    application.include_router(tattoos.router, prefix=settings.api_prefix)
    application.include_router(tattoos.router, prefix="/v1", include_in_schema=False)
    application.include_router(logs.router, prefix=settings.api_prefix)
    return application


app = create_app()
