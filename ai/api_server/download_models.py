from __future__ import annotations

import argparse
from pathlib import Path

from huggingface_hub import snapshot_download

API_SERVER_ROOT = Path(__file__).resolve().parent
GENERATOR_REPO = "stable-diffusion-v1-5/stable-diffusion-v1-5"
SUBJECT_REPO = "google/siglip2-so400m-patch16-384"


def download_generator_model() -> None:
    target = (
        API_SERVER_ROOT
        / "vendor"
        / "tattoo_generator_sd15"
        / "models"
        / "stable-diffusion-v1-5"
    )
    target.mkdir(parents=True, exist_ok=True)
    print(f"[generator] {GENERATOR_REPO} -> {target}")
    snapshot_download(
        repo_id=GENERATOR_REPO,
        local_dir=target,
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


def download_subject_model() -> None:
    target = (
        API_SERVER_ROOT
        / "vendor"
        / "tattoo_classifier_v3"
        / "siglip2-so400m-patch16-384"
    )
    target.mkdir(parents=True, exist_ok=True)
    print(f"[classifier] {SUBJECT_REPO} -> {target}")
    snapshot_download(
        repo_id=SUBJECT_REPO,
        local_dir=target,
        allow_patterns=[
            "config.json",
            "model.safetensors",
            "preprocessor_config.json",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer.model",
            "tokenizer_config.json",
        ],
        ignore_patterns=["*.bin", "*.onnx*"],
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Tattoo AI 서버가 사용하는 공개 베이스 모델을 설치합니다."
    )
    parser.add_argument(
        "models",
        nargs="*",
        choices=("generator", "classifier"),
        default=("generator", "classifier"),
        help="설치할 모델. 생략하면 generator와 classifier를 모두 설치합니다.",
    )
    return parser.parse_args()


def main() -> int:
    selected = parse_args().models
    if "generator" in selected:
        download_generator_model()
    if "classifier" in selected:
        download_subject_model()
    print("[OK] 공개 모델 설치가 완료되었습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
