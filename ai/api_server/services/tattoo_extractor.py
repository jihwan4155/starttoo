from __future__ import annotations

import asyncio
import importlib.util
import logging
import sys
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import Literal

from api_server.core.exceptions import (
    ExtractionFailedError,
    InferenceBusyError,
    PipelineNotConfiguredError,
    PipelineNotReadyError,
)

OutputVariant = Literal["transparent", "white", "mask", "alpha"]
INFERENCE_WAIT_TIMEOUT_SECONDS = 1.0
logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ExtractionResult:
    content: bytes
    width: int
    height: int
    resized: bool
    predicted_ratio: float
    processing_seconds: float


class TattooExtractorService:
    model_name = "inklift-v11.7-no-flat"

    def __init__(
        self,
        extractor_root: Path,
        max_upload_bytes: int = 20 * 1024 * 1024,
        inference_gate: asyncio.Semaphore | None = None,
    ) -> None:
        self.extractor_root = extractor_root.resolve()
        self.max_upload_bytes = max_upload_bytes
        self.backend_path = (
            self.extractor_root / "web" / "backend" / "server.py"
        )
        self._status = (
            "not_loaded" if self.backend_path.is_file() else "not_configured"
        )
        self._message = (
            "V11.7 모델이 아직 로드되지 않았습니다."
            if self.configured
            else f"V11.7 백엔드를 찾을 수 없습니다: {self.backend_path}"
        )
        self._device: str | None = None
        self._backend: ModuleType | None = None
        self._runtime: object | None = None
        self._load_lock = threading.Lock()
        self._inference_gate = inference_gate or asyncio.Semaphore(1)

    @property
    def configured(self) -> bool:
        return self.backend_path.is_file()

    @property
    def status(self) -> str:
        return self._status

    @property
    def message(self) -> str:
        return self._message

    @property
    def device(self) -> str | None:
        return self._device

    @property
    def is_busy(self) -> bool:
        return self._inference_gate.locked()

    def ensure_ready(self) -> None:
        if not self.configured:
            raise PipelineNotConfiguredError(self._message)
        if self._status != "ready":
            raise PipelineNotReadyError(self._message)

    async def load(self) -> None:
        await asyncio.to_thread(self._load_sync)

    def _load_sync(self) -> None:
        with self._load_lock:
            if self._status in {"loading", "ready"}:
                return
            if not self.configured:
                self._status = "not_configured"
                return

            self._status = "loading"
            self._message = "V11.7 모델을 로드하고 있습니다."
            try:
                backend = self._load_backend_module()
                runtime = backend.ModelRuntime()
                runtime.load()
                if runtime.status != "ready":
                    raise RuntimeError(runtime.message)
                self._backend = backend
                self._runtime = runtime
                self._device = str(runtime.device_name)
                self._status = "ready"
                self._message = "V11.7 타투 추출 모델이 준비되었습니다."
            except Exception as exc:
                logger.exception("V11.7 model loading failed")
                self._status = "error"
                self._message = f"V11.7 모델 로딩 실패: {exc}"

    def _load_backend_module(self) -> ModuleType:
        path_key = str(self.backend_path).lower().encode("utf-8").hex()[-24:]
        module_name = f"_inklift_v117_backend_{path_key}"
        existing = sys.modules.get(module_name)
        if isinstance(existing, ModuleType):
            return existing

        backend_dir = str(self.backend_path.parent)
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        spec = importlib.util.spec_from_file_location(
            module_name,
            self.backend_path,
        )
        if spec is None or spec.loader is None:
            raise ImportError(f"백엔드 모듈을 열 수 없습니다: {self.backend_path}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        try:
            spec.loader.exec_module(module)
        except Exception:
            sys.modules.pop(module_name, None)
            raise
        return module

    async def extract(
        self,
        raw: bytes,
        output: OutputVariant = "transparent",
    ) -> ExtractionResult:
        self.ensure_ready()
        try:
            await asyncio.wait_for(
                self._inference_gate.acquire(),
                timeout=INFERENCE_WAIT_TIMEOUT_SECONDS,
            )
        except TimeoutError as exc:
            raise InferenceBusyError(
                "AI 서버가 다른 이미지 작업을 처리 중입니다. 잠시 후 다시 요청해주세요."
            ) from exc
        try:
            return await asyncio.to_thread(self._extract_sync, raw, output)
        finally:
            self._inference_gate.release()

    def _extract_sync(
        self,
        raw: bytes,
        output: OutputVariant,
    ) -> ExtractionResult:
        self.ensure_ready()
        if self._backend is None or self._runtime is None:
            raise PipelineNotReadyError("V11.7 런타임이 준비되지 않았습니다.")

        started = time.perf_counter()
        output_names = {
            "transparent": "transparent.png",
            "white": "white.png",
            "mask": "mask.png",
            "alpha": "alpha.png",
        }
        try:
            original, resized = self._backend.prepare_image(raw)
            probability, mask, diagnostics, _, dark_artifacts = (
                self._runtime.extract(original)
            )
            with tempfile.TemporaryDirectory(prefix="tattoo-ai-v117-") as temp:
                job_root = Path(temp) / uuid.uuid4().hex
                summary = self._backend.save_outputs(
                    original,
                    probability,
                    mask,
                    diagnostics,
                    job_root,
                    dark_artifacts,
                )
                content = (job_root / output_names[output]).read_bytes()
            return ExtractionResult(
                content=content,
                width=original.width,
                height=original.height,
                resized=bool(resized),
                predicted_ratio=float(summary["predicted_ratio"]),
                processing_seconds=time.perf_counter() - started,
            )
        except (PipelineNotConfiguredError, PipelineNotReadyError):
            raise
        except Exception as exc:
            raise ExtractionFailedError(
                f"타투 도안 추출 중 오류가 발생했습니다: {exc}"
            ) from exc
