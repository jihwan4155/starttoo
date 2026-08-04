from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_GENERATOR_ROOT = (
    PROJECT_ROOT / "api_server" / "vendor" / "tattoo_generator_sd15"
)
DEFAULT_CLASSIFIER_ROOT = (
    PROJECT_ROOT / "api_server" / "vendor" / "tattoo_classifier_v3"
)


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_origins(value: str | None) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(origin.strip() for origin in value.split(",") if origin.strip())


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str
    environment: str
    host: str
    port: int
    reload: bool
    log_level: str
    api_prefix: str
    cors_origins: tuple[str, ...]
    extractor_root: Path
    model_load_on_startup: bool
    max_upload_mb: int
    generator_root: Path = DEFAULT_GENERATOR_ROOT
    generator_load_on_startup: bool = False
    classifier_root: Path = DEFAULT_CLASSIFIER_ROOT
    classifier_load_on_startup: bool = False
    # 추론 슬롯은 전역 1개다. 대기는 단일 GPU 환경의 정상 상태이지 오류가 아니므로
    # 넉넉히 기다린다. 짧게 잡으면 동시 요청이 곧바로 503으로 떨어진다.
    inference_wait_timeout_seconds: float = 120.0

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv(PROJECT_ROOT / ".env")
        default_extractor_root = (
            PROJECT_ROOT
            / "api_server"
            / "vendor"
            / "inklift_v11_7"
        )
        return cls(
            app_name=os.getenv("APP_NAME", "Tattoo AI API"),
            environment=os.getenv("APP_ENV", "local"),
            host=os.getenv("APP_HOST", "127.0.0.1"),
            port=int(os.getenv("APP_PORT", "8000")),
            reload=_as_bool(os.getenv("APP_RELOAD"), default=False),
            log_level=os.getenv("APP_LOG_LEVEL", "info").lower(),
            api_prefix=os.getenv("API_PREFIX", "/api/v1").rstrip("/"),
            cors_origins=_as_origins(os.getenv("CORS_ORIGINS")),
            extractor_root=Path(
                os.getenv("TATTOO_EXTRACTOR_ROOT", str(default_extractor_root))
            ).resolve(),
            model_load_on_startup=_as_bool(
                os.getenv("MODEL_LOAD_ON_STARTUP"),
                default=True,
            ),
            max_upload_mb=max(1, int(os.getenv("MAX_UPLOAD_MB", "20"))),
            generator_root=Path(
                os.getenv(
                    "TATTOO_GENERATOR_ROOT",
                    str(DEFAULT_GENERATOR_ROOT),
                )
            ).resolve(),
            generator_load_on_startup=_as_bool(
                os.getenv("GENERATOR_LOAD_ON_STARTUP"),
                default=False,
            ),
            classifier_root=Path(
                os.getenv(
                    "TATTOO_CLASSIFIER_ROOT",
                    str(DEFAULT_CLASSIFIER_ROOT),
                )
            ).resolve(),
            classifier_load_on_startup=_as_bool(
                os.getenv("CLASSIFIER_LOAD_ON_STARTUP"),
                default=False,
            ),
            inference_wait_timeout_seconds=max(
                1.0,
                float(os.getenv("INFERENCE_WAIT_TIMEOUT_SECONDS", "120")),
            ),
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings.from_env()
