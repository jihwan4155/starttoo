from __future__ import annotations

import asyncio
import gc
import io
import logging
import secrets
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal

import numpy as np
from PIL import Image

from api_server.core.exceptions import (
    GenerationFailedError,
    GeneratorNotConfiguredError,
    GeneratorNotReadyError,
    InferenceBusyError,
)

TattooStyle = Literal[
    "realism",
    "minimal",
    "geometric_ornamental",
    "lettering",
    "graphic_illustrative",
    "new_school",
    "tribal_indigenous",
    "western_traditional",
    "japanese",
    "abstract_experimental",
]

STYLE_PHRASES: dict[str, str] = {
    "realism": "realism",
    "minimal": "minimalist fine line",
    "geometric_ornamental": "geometric ornamental",
    "lettering": "lettering",
    "graphic_illustrative": "graphic illustrative",
    "new_school": "new school",
    "tribal_indigenous": "tribal",
    "western_traditional": "western traditional",
    "japanese": "japanese irezumi",
    "abstract_experimental": "abstract",
}
STYLE_EXTRAS = {
    "minimal": (
        "single thin continuous black line, no shading, no fill, "
        "simple linework, negative space"
    ),
}
NEGATIVE_PROMPT = (
    "on skin, tattooed arm, tattooed leg, body, photograph, photo, "
    "blurry, low quality, jpeg artifacts, watermark, signature, "
    "frame, border, paper texture, beige background, colored background, "
    "cropped, cut off, close-up, zoomed in, out of frame, partial"
)
STYLE_NEGATIVE_EXTRAS = {
    "minimal": (
        "thick lines, heavy shading, dotwork, hyperrealistic, "
        "dense detail, busy composition"
    ),
    "japanese": "empty background, western style, plain solid color fill",
    "lettering": (
        "animal, creature, portrait, illustration, picture, "
        "drawing of an object"
    ),
}
MAX_STYLES = 2
DEFAULT_INFERENCE_WAIT_TIMEOUT_SECONDS = 120.0
SUPPORTED_STYLES = tuple(STYLE_PHRASES)
BASE_MODEL_REPO = "stable-diffusion-v1-5/stable-diffusion-v1-5"
logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class GenerationResult:
    content: bytes
    width: int
    height: int
    seed: int
    styles: tuple[str, ...]
    processing_seconds: float


def normalize_styles(style: list[str] | None) -> list[str]:
    styles = list(style or [])
    if len(styles) > MAX_STYLES:
        raise ValueError(
            f"스타일은 최대 {MAX_STYLES}개까지 선택할 수 있습니다."
        )
    unknown = [item for item in styles if item not in STYLE_PHRASES]
    if unknown:
        raise ValueError(
            f"지원하지 않는 스타일입니다: {', '.join(unknown)}"
        )
    return styles


def build_prompt(styles: list[str], user_prompt: str) -> str:
    if not styles:
        return f"tat_design, {user_prompt}, tattoo design on white background"

    if "lettering" in styles:
        others = [item for item in styles if item != "lettering"]
        prefix = f"{STYLE_PHRASES[others[0]]} style, " if others else ""
        return (
            f'tat_design, {prefix}lettering style, the text "{user_prompt}" '
            "in bold tattoo script lettering, tattoo design on white background"
        )

    phrases = [STYLE_PHRASES[item] for item in styles]
    style_text = " and ".join(f"{phrase} style" for phrase in phrases)
    extras = [STYLE_EXTRAS[item] for item in styles if item in STYLE_EXTRAS]
    subject = f"{style_text}, {user_prompt}"
    if extras:
        subject += ", " + ", ".join(extras)
    return f"tat_design, {subject}, tattoo design on white background"


def build_negative_prompt(styles: list[str]) -> str:
    extras = [
        STYLE_NEGATIVE_EXTRAS[item]
        for item in styles
        if item in STYLE_NEGATIVE_EXTRAS
    ]
    if not extras:
        return NEGATIVE_PROMPT
    return f"{NEGATIVE_PROMPT}, {', '.join(extras)}"


def whiten_background(image: Image.Image, tolerance: int = 20) -> Image.Image:
    pixels = np.array(image.convert("RGB")).astype(np.int16)
    border = np.concatenate(
        [pixels[0], pixels[-1], pixels[:, 0], pixels[:, -1]],
        axis=0,
    )
    background = np.median(border, axis=0)
    if background.min() < 165:
        return image
    distance = np.abs(pixels - background).max(axis=2)
    pixels[distance <= tolerance] = [255, 255, 255]
    return Image.fromarray(pixels.astype("uint8"))


def content_bbox(
    image: Image.Image,
    threshold: int = 245,
) -> tuple[int, int, int, int] | None:
    pixels = np.array(image.convert("RGB"))
    mask = (pixels < threshold).any(axis=2)
    if not mask.any():
        return None
    ys, xs = np.where(mask)
    return (
        int(xs.min()),
        int(ys.min()),
        int(xs.max()) + 1,
        int(ys.max()) + 1,
    )


def fit_to_canvas(
    image: Image.Image,
    size: int,
    content_fraction: float = 0.8,
) -> Image.Image:
    bbox = content_bbox(image)
    if bbox is None:
        return image
    x0, y0, x1, y1 = bbox
    width, height = x1 - x0, y1 - y0
    crop = image.convert("RGB").crop(bbox)
    target = max(1, int(size * content_fraction))
    scale = target / max(width, height)
    resized_width = max(1, round(width * scale))
    resized_height = max(1, round(height * scale))
    crop = crop.resize((resized_width, resized_height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    canvas.paste(
        crop,
        ((size - resized_width) // 2, (size - resized_height) // 2),
    )
    return canvas


class TattooGeneratorService:
    model_name = "tattoo-design-sd15-lora"

    def __init__(
        self,
        generator_root: Path,
        inference_gate: asyncio.Semaphore | None = None,
        inference_wait_timeout: float = DEFAULT_INFERENCE_WAIT_TIMEOUT_SECONDS,
        cpu_offload: bool = False,
        unload_after_request: bool = False,
    ) -> None:
        self.generator_root = generator_root.resolve()
        self.inference_wait_timeout = inference_wait_timeout
        self.cpu_offload = cpu_offload
        self.unload_after_request = unload_after_request
        self.base_model_root = (
            self.generator_root / "models" / "stable-diffusion-v1-5"
        )
        self.lora_path = (
            self.generator_root / "pytorch_lora_weights.safetensors"
        )
        self._status = "not_loaded" if self.configured else "not_configured"
        self._message = (
            "Stable Diffusion 1.5 타투 생성 모델이 아직 로드되지 않았습니다. "
            "공개 베이스 모델이 없으면 최초 요청에서 자동 다운로드합니다."
            if self.configured
            else self._missing_assets_message()
        )
        self._device: str | None = None
        self._pipeline: object | None = None
        self._torch: object | None = None
        self._load_lock = threading.Lock()
        self._inference_gate = inference_gate or asyncio.Semaphore(1)
        self._before_activate: Callable[[], None] | None = None

    @property
    def configured(self) -> bool:
        # 공개 Stable Diffusion 1.5는 최초 로딩 때 내려받습니다.
        # 배포 ZIP에 반드시 포함되어야 하는 파일은 커스텀 LoRA입니다.
        return self.lora_path.is_file()

    @property
    def public_models_available(self) -> bool:
        configs_available = all(
            path.is_file()
            for path in (
                self.base_model_root / "model_index.json",
                self.base_model_root / "unet" / "config.json",
                self.base_model_root / "vae" / "config.json",
            )
        )
        weight_patterns = ("*.safetensors", "*.bin")
        weights_available = all(
            any(
                any(directory.glob(pattern))
                for pattern in weight_patterns
            )
            for directory in (
                self.base_model_root / "text_encoder",
                self.base_model_root / "unet",
                self.base_model_root / "vae",
            )
        )
        return configs_available and weights_available

    def _download_public_models(self) -> None:
        if self.public_models_available:
            return

        from huggingface_hub import snapshot_download

        self.base_model_root.parent.mkdir(parents=True, exist_ok=True)
        if not self.public_models_available:
            logger.info("Downloading public SD1.5 model: %s", BASE_MODEL_REPO)
            snapshot_download(
                repo_id=BASE_MODEL_REPO,
                local_dir=self.base_model_root,
                allow_patterns=[
                    "model_index.json",
                    "scheduler/*",
                    "tokenizer/*",
                    "text_encoder/*",
                    "unet/*",
                    "vae/*",
                    "feature_extractor/*",
                ],
                ignore_patterns=[
                    "*.ckpt",
                    "*.safetensors.index.json",
                    "*non_ema*",
                ],
            )

        if not self.public_models_available:
            raise FileNotFoundError(
                "공개 Stable Diffusion 1.5 모델 다운로드가 완료되지 않았습니다. "
                "네트워크 연결과 Hugging Face 접근 권한을 확인해주세요."
            )

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

    def _missing_assets_message(self) -> str:
        return f"커스텀 생성 LoRA 파일이 없습니다: {self.lora_path}"

    def ensure_configured(self) -> None:
        if not self.configured:
            self._status = "not_configured"
            self._message = self._missing_assets_message()
            raise GeneratorNotConfiguredError(self._message)

    def ensure_ready(self) -> None:
        self.ensure_configured()
        if self._status != "ready":
            raise GeneratorNotReadyError(self._message)

    def set_before_activate(self, callback: Callable[[], None] | None) -> None:
        self._before_activate = callback

    def unload(self) -> None:
        with self._load_lock:
            pipeline = self._pipeline
            torch_module = self._torch
            self._pipeline = None
            self._torch = None
            self._device = None
            self._status = "not_loaded" if self.configured else "not_configured"
            self._message = (
                "Stable Diffusion 1.5 타투 생성 모델이 메모리에서 해제되었습니다."
                if self.configured
                else self._missing_assets_message()
            )
        del pipeline
        gc.collect()
        if (
            torch_module is not None
            and getattr(torch_module, "cuda", None) is not None
            and torch_module.cuda.is_available()
        ):
            torch_module.cuda.empty_cache()

    async def _run_before_activate(self) -> None:
        if self._before_activate is not None:
            await asyncio.to_thread(self._before_activate)

    async def load(self) -> None:
        await self._acquire_inference_gate()
        try:
            await self._run_before_activate()
            await asyncio.to_thread(self._load_sync)
        finally:
            self._inference_gate.release()

    async def _acquire_inference_gate(self) -> None:
        try:
            await asyncio.wait_for(
                self._inference_gate.acquire(),
                timeout=self.inference_wait_timeout,
            )
        except TimeoutError as exc:
            raise InferenceBusyError(
                "AI 서버가 다른 이미지 작업을 처리 중입니다. 잠시 후 다시 요청해주세요."
            ) from exc

    def _load_sync(self) -> None:
        with self._load_lock:
            if self._status in {"loading", "ready"}:
                return
            self.ensure_configured()
            self._status = "loading"
            self._message = (
                "Stable Diffusion 1.5 타투 생성 모델을 준비하고 있습니다. "
                "공개 모델이 없으면 자동 다운로드합니다."
            )
            try:
                import torch
                from diffusers import (
                    DPMSolverMultistepScheduler,
                    StableDiffusionPipeline,
                )

                self._download_public_models()

                device = "cuda" if torch.cuda.is_available() else "cpu"
                dtype = torch.float16 if device == "cuda" else torch.float32
                pipeline = StableDiffusionPipeline.from_pretrained(
                    self.base_model_root,
                    torch_dtype=dtype,
                    local_files_only=True,
                    safety_checker=None,
                )
                pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
                    pipeline.scheduler.config
                )
                pipeline.load_lora_weights(
                    str(self.lora_path.parent),
                    weight_name=self.lora_path.name,
                    local_files_only=True,
                )
                if device == "cuda":
                    pipeline.enable_attention_slicing()
                    try:
                        pipeline.enable_xformers_memory_efficient_attention()
                    except Exception:
                        logger.info("xFormers is unavailable; using attention slicing")
                    if self.cpu_offload:
                        pipeline.enable_model_cpu_offload()
                        self._device = (
                            f"cuda-offload · {torch.cuda.get_device_name(0)}"
                        )
                    else:
                        pipeline.to("cuda")
                        self._device = f"cuda · {torch.cuda.get_device_name(0)}"
                else:
                    pipeline.to("cpu")
                    self._device = "cpu"

                self._pipeline = pipeline
                self._torch = torch
                self._status = "ready"
                self._message = (
                    "Stable Diffusion 1.5 타투 도안 생성 모델이 준비되었습니다."
                )
            except Exception as exc:
                logger.exception("SD1.5 tattoo generator loading failed")
                self._pipeline = None
                self._torch = None
                self._status = "error"
                self._message = f"생성 모델 로딩 실패: {exc}"

    async def generate(
        self,
        *,
        prompt: str,
        style: list[str] | None,
        seed: int | None,
        steps: int,
        guidance: float,
        size: int,
    ) -> GenerationResult:
        styles = normalize_styles(style)
        actual_seed = seed if seed is not None else secrets.randbelow(2**32)
        await self._acquire_inference_gate()
        try:
            await self._run_before_activate()
            if self._status != "ready":
                await asyncio.to_thread(self._load_sync)
            self.ensure_ready()
            return await asyncio.to_thread(
                self._generate_sync,
                prompt,
                styles,
                actual_seed,
                steps,
                guidance,
                size,
            )
        finally:
            if self.unload_after_request:
                await asyncio.to_thread(self.unload)
            self._inference_gate.release()

    def _generate_sync(
        self,
        prompt: str,
        styles: list[str],
        seed: int,
        steps: int,
        guidance: float,
        size: int,
    ) -> GenerationResult:
        self.ensure_ready()
        if self._pipeline is None or self._torch is None:
            raise GeneratorNotReadyError(
                "Stable Diffusion 1.5 타투 생성 런타임이 준비되지 않았습니다."
            )

        started = time.perf_counter()
        try:
            full_prompt = build_prompt(styles, prompt)
            negative_prompt = build_negative_prompt(styles)
            generator_device = (
                "cpu"
                if self.cpu_offload
                else "cuda" if str(self._device).startswith("cuda") else "cpu"
            )
            generator = self._torch.Generator(
                device=generator_device
            ).manual_seed(seed)
            with self._torch.inference_mode():
                image = self._pipeline(
                    full_prompt,
                    negative_prompt=negative_prompt,
                    num_inference_steps=steps,
                    guidance_scale=guidance,
                    width=size,
                    height=size,
                    generator=generator,
                ).images[0]
            image = whiten_background(image)
            image = fit_to_canvas(image, size=size, content_fraction=0.8)
            output = io.BytesIO()
            image.save(output, format="PNG", optimize=True)
            return GenerationResult(
                content=output.getvalue(),
                width=image.width,
                height=image.height,
                seed=seed,
                styles=tuple(styles),
                processing_seconds=time.perf_counter() - started,
            )
        except (GeneratorNotConfiguredError, GeneratorNotReadyError):
            raise
        except Exception as exc:
            raise GenerationFailedError(
                f"타투 도안 생성 중 오류가 발생했습니다: {exc}"
            ) from exc
        finally:
            if (
                getattr(self._torch, "cuda", None) is not None
                and self._torch.cuda.is_available()
            ):
                self._torch.cuda.empty_cache()
