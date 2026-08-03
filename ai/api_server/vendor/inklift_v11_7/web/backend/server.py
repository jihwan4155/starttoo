from __future__ import annotations

import io
import json
import mimetypes
import os
import sys
import threading
import time
import traceback
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import unquote, urlparse

import numpy as np
from PIL import Image, ImageOps

from dark_multiview import (
    analyze_exposure,
    build_dark_views,
    fuse_multiview_probabilities,
)
from ink_refinement import (
    compose_connected_shade_alpha,
    compose_skin_tone_ink_alpha,
    compose_spatial_skin_residual_alpha,
    refine_ink_alpha,
    refine_ink_alpha_balanced,
)
from red_ink_recovery import recover_red_ink_alpha


WEB_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = WEB_ROOT.parent
RELEASE_ROOT = (
    PROJECT_ROOT
    / "models"
    / "releases"
    / "tattoo_extractor_v11_warm_black_20260726"
)
RED_CHECKPOINT_PATH = (
    PROJECT_ROOT
    / "models"
    / "segmentation"
    / "segformer_tattoo_binary_v4_red_lettering"
    / "best_model.pt"
)
SCRIPTS_ROOT = RELEASE_ROOT / "scripts"
JOBS_ROOT = WEB_ROOT / "runtime" / "jobs"
HOST = "127.0.0.1"
PORT = int(os.environ.get("INKLIFT_API_PORT", "8017"))
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_LONG_EDGE = 3200
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}

Image.MAX_IMAGE_PIXELS = 40_000_000


class ModelRuntime:
    def __init__(self) -> None:
        self.status = "loading"
        self.message = "V11.7 무굴곡 타투 추출 모델을 GPU에 올리고 있어요"
        self.device_name = ""
        self.error = ""
        self.lock = threading.Lock()

    def health(self) -> dict[str, str]:
        return {
            "status": self.status,
            "message": self.message,
            "device": self.device_name,
            "model": "tattoo_extractor_v11_7_no_flat_portable_20260727",
            "pipeline": (
                "V11.7 red ink recovery + V11.6 dark multiview "
                "+ V11.5 spatial skin residual + flat restore disabled"
            ),
        }

    def load(self) -> None:
        try:
            if not RELEASE_ROOT.exists():
                raise FileNotFoundError(f"V11 release not found: {RELEASE_ROOT}")
            if not RED_CHECKPOINT_PATH.is_file():
                raise FileNotFoundError(
                    f"V11.7 red checkpoint not found: {RED_CHECKPOINT_PATH}"
                )
            sys.path.insert(0, str(SCRIPTS_ROOT))

            import torch
            from infer_segformer_binary_v1 import build_model
            from infer_segformer_binary_v5_roi_hysteresis import (
                predict_probability,
            )
            from infer_segformer_binary_v8_adaptive_faint_red import adaptive_mask
            from infer_segformer_binary_v9_tiled_faint import tiled_probability
            from infer_segformer_binary_v10_multicolor_fallback import (
                add_color_specialist_tiles,
            )
            from infer_segformer_binary_v11_warm_black_fallback import (
                add_warm_black_tiles,
            )
            from roi_gate_v5_1 import (
                load_roi_gate,
                predict_roi_tattoo_probability,
            )

            self.torch = torch
            self.predict_probability = predict_probability
            self.tiled_probability = tiled_probability
            self.add_color_specialist_tiles = add_color_specialist_tiles
            self.add_warm_black_tiles = add_warm_black_tiles
            self.adaptive_mask = adaptive_mask
            self.predict_roi_tattoo_probability = (
                predict_roi_tattoo_probability
            )

            if torch.cuda.is_available():
                self.device = torch.device("cuda")
                self.device_name = f"cuda · {torch.cuda.get_device_name(0)}"
            else:
                self.device = torch.device("cpu")
                self.device_name = "cpu"

            pretrained = RELEASE_ROOT / "pretrained_segformer_b0"
            weights = RELEASE_ROOT / "weights"
            self.base_checkpoint = torch.load(
                weights / "base_segformer_v7_calibrated_t080.pt",
                map_location="cpu",
                weights_only=False,
            )
            self.color_checkpoint = torch.load(
                weights / "multicolor_specialist_v10.pt",
                map_location="cpu",
                weights_only=False,
            )
            self.warm_checkpoint = torch.load(
                weights / "warm_black_specialist_v11.pt",
                map_location="cpu",
                weights_only=False,
            )
            self.red_checkpoint = torch.load(
                RED_CHECKPOINT_PATH,
                map_location="cpu",
                weights_only=False,
            )
            self.base = build_model(
                pretrained, self.base_checkpoint, self.device
            )
            self.color = build_model(
                pretrained, self.color_checkpoint, self.device
            )
            self.warm = build_model(
                pretrained, self.warm_checkpoint, self.device
            )
            self.red = build_model(
                pretrained, self.red_checkpoint, self.device
            )
            self.tile_gate, tile_gate_checkpoint = load_roi_gate(
                weights / "roi_gate_v9_balanced_red.pt", self.device
            )
            self.warm_gate, warm_gate_checkpoint = load_roi_gate(
                weights / "warm_black_roi_gate_v11.pt", self.device
            )
            self.tile_gate_input_size = int(
                tile_gate_checkpoint.get("input_size", 224)
            )
            self.warm_gate_input_size = int(
                warm_gate_checkpoint.get("input_size", 224)
            )
            self.args = SimpleNamespace(
                tile_size=256,
                tile_overlap=0.50,
                high_threshold=0.80,
                min_tile_seed_ratio=0.0015,
                max_tile_seed_ratio=0.35,
                min_tile_skin_ratio=0.15,
                min_seed_color_fraction=0.04,
                min_seed_color_pixels=8,
                tile_gate_threshold=0.15,
                interior_margin_ratio=0.06,
                base_anchor_radius=18,
                min_base_anchor_image_ratio=0.02,
                small_anchor_rescue_ratio=0.003,
                small_anchor_rescue_color_fraction=0.70,
                warm_high_threshold=0.92,
                warm_low_threshold=0.85,
                warm_gate_threshold=0.15,
                min_warmth=0.65,
                min_yellowness=0.48,
                max_warm_blur_variance=80.0,
                min_warm_candidate_ratio=0.003,
                max_warm_candidate_ratio=0.14,
                min_warm_contrast=0.06,
            )
            self.status = "ready"
            self.message = (
                "V11.7 붉은 잉크 복원 모델이 준비되었습니다"
            )
            print(
                f"[ready] V11.7 red recovery loaded on {self.device_name}",
                flush=True,
            )
        except Exception as exc:
            self.status = "error"
            self.error = str(exc)
            self.message = f"모델 준비 실패: {exc}"
            traceback.print_exc()

    def extract(
        self, original: Image.Image
    ) -> tuple[np.ndarray, np.ndarray, list[dict], dict, dict]:
        if self.status != "ready":
            raise RuntimeError(self.message)
        original = original.convert("RGB")
        with self.lock, self.torch.inference_mode():
            probability, red_diagnostics = self.tiled_probability(
                self.base,
                original,
                int(self.base_checkpoint.get("input_size", 512)),
                self.device,
                self.args.tile_size,
                self.args.tile_overlap,
                self.args.high_threshold,
                self.args.min_tile_seed_ratio,
                self.args.max_tile_seed_ratio,
                0.25,
                self.args.interior_margin_ratio,
                self.args.min_tile_skin_ratio,
                0.0,
                self.tile_gate,
                self.tile_gate_input_size,
                self.args.tile_gate_threshold,
            )
            for item in red_diagnostics:
                item["branch"] = "v9_red"
            probability, color_diagnostics = self.add_color_specialist_tiles(
                self.color,
                original,
                int(self.color_checkpoint.get("input_size", 512)),
                self.device,
                probability,
                probability.copy(),
                self.tile_gate,
                self.tile_gate_input_size,
                self.args,
            )
            probability, warm_diagnostics = self.add_warm_black_tiles(
                self.warm,
                original,
                int(self.warm_checkpoint.get("input_size", 256)),
                self.device,
                probability,
                self.warm_gate,
                self.warm_gate_input_size,
                self.args,
            )
            diagnostics = [
                *red_diagnostics,
                *color_diagnostics,
                *warm_diagnostics,
            ]
            exposure = analyze_exposure(original)
            dark_views = build_dark_views(original, exposure)
            enhanced_probabilities: dict[str, np.ndarray] = {}
            if bool(exposure["enabled"]):
                amp_enabled = self.device.type == "cuda"
                base_size = int(self.base_checkpoint.get("input_size", 512))
                color_size = int(self.color_checkpoint.get("input_size", 512))
                warm_size = int(self.warm_checkpoint.get("input_size", 256))
                for view_name in ("gamma", "clahe", "retinex"):
                    enhanced_probabilities[f"base_{view_name}"] = (
                        self.predict_probability(
                            self.base,
                            dark_views[view_name],
                            base_size,
                            self.device,
                            amp_enabled,
                        )
                    )
                enhanced_probabilities["color_clahe"] = (
                    self.predict_probability(
                        self.color,
                        dark_views["clahe"],
                        color_size,
                        self.device,
                        amp_enabled,
                    )
                )
                enhanced_probabilities["warm_retinex"] = (
                    self.predict_probability(
                        self.warm,
                        dark_views["retinex"],
                        warm_size,
                        self.device,
                        amp_enabled,
                    )
                )
            original_branch_probability = probability.copy()
            original_branch_mask, _ = self.adaptive_mask(
                original, original_branch_probability
            )
            probability, ensemble_debug, fusion = (
                fuse_multiview_probabilities(
                    probability,
                    enhanced_probabilities,
                    original,
                    exposure,
                )
            )
            red_probability = self.predict_probability(
                self.red,
                original,
                int(self.red_checkpoint.get("input_size", 512)),
                self.device,
                self.device.type == "cuda",
            )
            red_roi_gate_probability = self.predict_roi_tattoo_probability(
                self.tile_gate,
                original,
                self.tile_gate_input_size,
                self.device,
                self.device.type == "cuda",
            )
            mask, adaptive_diagnostics = self.adaptive_mask(
                original, probability
            )
            mask = np.logical_or(mask, original_branch_mask)
        dark_artifacts = {
            "exposure": exposure,
            "fusion": fusion,
            "views": dark_views,
            "ensemble_debug": ensemble_debug,
            "baseline_probability": original_branch_probability,
            "baseline_mask": original_branch_mask,
            "red_probability": red_probability,
            "red_roi_gate_probability": red_roi_gate_probability,
        }
        return (
            probability,
            mask,
            diagnostics,
            adaptive_diagnostics,
            dark_artifacts,
        )


runtime = ModelRuntime()


def clean_old_jobs(max_age_hours: int = 24) -> None:
    JOBS_ROOT.mkdir(parents=True, exist_ok=True)
    cutoff = time.time() - max_age_hours * 3600
    for path in JOBS_ROOT.iterdir():
        try:
            if path.is_dir() and path.stat().st_mtime < cutoff:
                for child in path.iterdir():
                    if child.is_file():
                        child.unlink()
                path.rmdir()
        except OSError:
            continue


def prepare_image(raw: bytes) -> tuple[Image.Image, bool]:
    with Image.open(io.BytesIO(raw)) as opened:
        opened.verify()
    with Image.open(io.BytesIO(raw)) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
    resized = False
    if max(image.size) > MAX_LONG_EDGE:
        image.thumbnail((MAX_LONG_EDGE, MAX_LONG_EDGE), Image.Resampling.LANCZOS)
        resized = True
    return image, resized


def compose_v11_5_reference_alpha(
    original: Image.Image,
    probability: np.ndarray,
    semantic_mask: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Rebuild the frozen V11.5 result so V11.6 can never erase it."""
    strict_mask, strict_alpha_u8, _ = refine_ink_alpha(
        original,
        semantic_mask.astype(bool),
        probability,
        skin_suppression_factor=0.0,
    )
    _, balanced_alpha_u8, _ = refine_ink_alpha_balanced(
        original,
        semantic_mask.astype(bool),
        probability,
    )
    _, connected_alpha_u8, _ = compose_connected_shade_alpha(
        original,
        semantic_mask.astype(bool),
        strict_alpha_u8,
        balanced_alpha_u8,
    )
    _, skin_tone_alpha_u8, _ = compose_skin_tone_ink_alpha(
        original,
        semantic_mask.astype(bool),
        probability,
        connected_alpha_u8,
        balanced_alpha_u8,
    )
    reference_mask, reference_alpha_u8, _, _, _ = (
        compose_spatial_skin_residual_alpha(
            original,
            semantic_mask.astype(bool),
            probability,
            skin_tone_alpha_u8,
            balanced_alpha_u8,
        )
    )
    reference_mask |= strict_mask
    return reference_mask, reference_alpha_u8


def save_outputs(
    original: Image.Image,
    probability: np.ndarray,
    mask: np.ndarray,
    diagnostics: list[dict],
    job_root: Path,
    dark_artifacts: dict[str, object],
) -> dict[str, object]:
    job_root.mkdir(parents=True, exist_ok=False)
    original.save(job_root / "original.jpg", quality=95, subsampling=0)
    dark_views = dark_artifacts["views"]
    if not isinstance(dark_views, dict):
        raise TypeError("dark multiview artifacts are invalid")
    for view_name in ("gamma", "clahe", "retinex"):
        view = dark_views[view_name]
        if not isinstance(view, Image.Image):
            raise TypeError(f"dark {view_name} view is invalid")
        view.save(
            job_root / f"dark_{view_name}.jpg",
            quality=94,
            subsampling=0,
        )
    ensemble_debug = np.asarray(
        dark_artifacts["ensemble_debug"], dtype=np.uint8
    )
    Image.fromarray(ensemble_debug, mode="L").save(
        job_root / "dark_ensemble_probability.png",
        optimize=True,
    )
    exposure_diagnostics = {
        "exposure": dark_artifacts["exposure"],
        "fusion": dark_artifacts["fusion"],
    }
    (job_root / "dark_multiview_diagnostics.json").write_text(
        json.dumps(exposure_diagnostics, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    probability_u8 = np.clip(
        np.round(probability * 255.0), 0, 255
    ).astype(np.uint8)
    semantic_mask = mask.astype(bool)
    strict_mask, strict_alpha_u8, strict_refinement = refine_ink_alpha(
        original,
        semantic_mask,
        probability,
        skin_suppression_factor=0.0,
    )
    balanced_mask, balanced_alpha_u8, balanced_refinement = (
        refine_ink_alpha_balanced(
            original,
            semantic_mask,
            probability,
        )
    )
    connected_mask, connected_alpha_u8, hybrid_refinement = (
        compose_connected_shade_alpha(
            original,
            semantic_mask,
            strict_alpha_u8,
            balanced_alpha_u8,
        )
    )
    skin_tone_mask, skin_tone_alpha_u8, skin_tone_refinement = (
        compose_skin_tone_ink_alpha(
            original,
            semantic_mask,
            probability,
            connected_alpha_u8,
            balanced_alpha_u8,
        )
    )
    (
        refined_mask,
        alpha_u8,
        spatial_refinement,
        skin_reference_rgb,
        ink_residual_u8,
    ) = compose_spatial_skin_residual_alpha(
        original,
        semantic_mask,
        probability,
        skin_tone_alpha_u8,
        balanced_alpha_u8,
    )
    preserved_reference_ratio = 0.0
    exposure_artifact = dark_artifacts["exposure"]
    if not isinstance(exposure_artifact, dict):
        raise TypeError("dark exposure artifact is invalid")
    if bool(exposure_artifact["enabled"]):
        reference_mask, reference_alpha_u8 = compose_v11_5_reference_alpha(
            original,
            np.asarray(
                dark_artifacts["baseline_probability"], dtype=np.float32
            ),
            np.asarray(dark_artifacts["baseline_mask"], dtype=bool),
        )
        preserved = reference_alpha_u8 > alpha_u8
        preserved_reference_ratio = float(preserved.mean())
        alpha_u8 = np.maximum(alpha_u8, reference_alpha_u8)
        refined_mask = np.logical_or(refined_mask, reference_mask)
    red_probability = np.asarray(
        dark_artifacts["red_probability"], dtype=np.float32
    )
    alpha_u8, red_evidence_u8, red_refinement = recover_red_ink_alpha(
        original,
        probability,
        red_probability,
        alpha_u8,
        float(dark_artifacts["red_roi_gate_probability"]),
    )
    refined_mask = np.logical_or(refined_mask, alpha_u8 >= 5)
    mask_u8 = refined_mask.astype(np.uint8) * 255
    semantic_mask_u8 = semantic_mask.astype(np.uint8) * 255

    probability_image = Image.fromarray(probability_u8, mode="L")
    mask_image = Image.fromarray(mask_u8, mode="L")
    alpha_image = Image.fromarray(alpha_u8, mode="L")
    strict_mask_image = Image.fromarray(
        strict_mask.astype(np.uint8) * 255, mode="L"
    )
    strict_alpha_image = Image.fromarray(
        strict_alpha_u8, mode="L"
    )
    balanced_mask_image = Image.fromarray(
        balanced_mask.astype(np.uint8) * 255, mode="L"
    )
    balanced_alpha_image = Image.fromarray(
        balanced_alpha_u8, mode="L"
    )
    Image.fromarray(skin_reference_rgb, mode="RGB").save(
        job_root / "skin_reference.png",
        optimize=True,
    )
    Image.fromarray(ink_residual_u8, mode="L").save(
        job_root / "ink_residual.png",
        optimize=True,
    )
    Image.fromarray(
        np.clip(np.round(red_probability * 255.0), 0, 255).astype(np.uint8),
        mode="L",
    ).save(
        job_root / "red_specialist_probability.png",
        optimize=True,
    )
    Image.fromarray(red_evidence_u8, mode="L").save(
        job_root / "red_ink_evidence.png",
        optimize=True,
    )
    (job_root / "red_ink_diagnostics.json").write_text(
        json.dumps(red_refinement, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    Image.fromarray(semantic_mask_u8, mode="L").save(
        job_root / "semantic_roi_mask.png", optimize=True
    )
    probability_image.save(job_root / "probability.png", optimize=True)
    mask_image.save(job_root / "mask.png", optimize=True)
    alpha_image.save(job_root / "alpha.png", optimize=True)
    strict_mask_image.save(
        job_root / "strict_mask.png", optimize=True
    )
    strict_alpha_image.save(
        job_root / "strict_alpha.png", optimize=True
    )
    balanced_mask_image.save(
        job_root / "balanced_mask.png", optimize=True
    )
    balanced_alpha_image.save(
        job_root / "balanced_alpha.png", optimize=True
    )

    transparent = original.convert("RGBA")
    transparent.putalpha(alpha_image)
    transparent.save(job_root / "transparent.png", optimize=True)

    white = Image.new("RGB", original.size, "white")
    white.paste(original, (0, 0), alpha_image)
    white.save(job_root / "white.png", optimize=True)

    strict_transparent = original.convert("RGBA")
    strict_transparent.putalpha(strict_alpha_image)
    strict_transparent.save(
        job_root / "strict_transparent.png", optimize=True
    )
    strict_white = Image.new("RGB", original.size, "white")
    strict_white.paste(original, (0, 0), strict_alpha_image)
    strict_white.save(
        job_root / "strict_white.png", optimize=True
    )

    balanced_transparent = original.convert("RGBA")
    balanced_transparent.putalpha(balanced_alpha_image)
    balanced_transparent.save(
        job_root / "balanced_transparent.png", optimize=True
    )
    balanced_white = Image.new("RGB", original.size, "white")
    balanced_white.paste(original, (0, 0), balanced_alpha_image)
    balanced_white.save(
        job_root / "balanced_white.png", optimize=True
    )

    overlay = original.convert("RGBA")
    blue = Image.new("RGBA", original.size, (49, 87, 255, 0))
    blue.putalpha(mask_image.point(lambda value: 108 if value else 0))
    overlay = Image.alpha_composite(overlay, blue).convert("RGB")
    overlay.save(job_root / "overlay.jpg", quality=94, subsampling=0)

    accepted = sum(bool(item.get("accepted")) for item in diagnostics)
    (job_root / "diagnostics.json").write_text(
        json.dumps(diagnostics, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    exposure = dark_artifacts["exposure"]
    fusion = dark_artifacts["fusion"]
    if not isinstance(exposure, dict) or not isinstance(fusion, dict):
        raise TypeError("dark multiview diagnostics are invalid")
    return {
        "predicted_ratio": float(refined_mask.mean()),
        "semantic_ratio": float(semantic_mask.mean()),
        "strict_ratio": float(strict_mask.mean()),
        "balanced_ratio": float(balanced_mask.mean()),
        "skin_pixels_removed_ratio": strict_refinement[
            "skin_pixels_removed_ratio"
        ],
        "restored_pixels_ratio": hybrid_refinement[
            "restored_pixels_ratio"
        ],
        "skin_tone_restored_pixels_ratio": skin_tone_refinement[
            "skin_tone_restored_pixels_ratio"
        ],
        "skin_tone_added_alpha_mean": skin_tone_refinement[
            "skin_tone_added_alpha_mean"
        ],
        "spatial_residual_restored_pixels_ratio": spatial_refinement[
            "spatial_residual_restored_pixels_ratio"
        ],
        "spatial_residual_added_alpha_mean": spatial_refinement[
            "spatial_residual_added_alpha_mean"
        ],
        "spatial_skin_reliability_mean": spatial_refinement[
            "spatial_skin_reliability_mean"
        ],
        "spatial_residual_colour_gate": spatial_refinement[
            "spatial_residual_colour_gate"
        ],
        "balanced_skin_pixels_removed_ratio": balanced_refinement[
            "skin_pixels_removed_ratio"
        ],
        "accepted_tiles": accepted,
        "total_tiles": len(diagnostics),
        "dark_multiview_enabled": bool(exposure["enabled"]),
        "dark_exposure_score": float(exposure["dark_score"]),
        "dark_luminance_median": float(exposure["luminance_median"]),
        "dark_shadow_fraction": float(exposure["shadow_fraction"]),
        "dark_multiview_restored_probability_ratio": float(
            fusion["restored_probability_ratio"]
        ),
        "dark_multiview_mean_probability_gain": float(
            fusion["mean_probability_gain"]
        ),
        "v11_5_preserved_alpha_ratio": preserved_reference_ratio,
        "red_ink_restored_pixels_ratio": float(
            red_refinement["red_restored_pixels_ratio"]
        ),
        "red_ink_added_alpha_mean": float(
            red_refinement["red_added_alpha_mean"]
        ),
        "red_specialist_core_coverage": float(
            red_refinement["red_specialist_core_coverage"]
        ),
        "red_roi_gate_probability": float(
            red_refinement["red_roi_gate_probability"]
        ),
    }


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "INKLIFT/11.7"

    def log_message(self, format: str, *args: object) -> None:
        print(
            f"[http] {self.client_address[0]} {format % args}",
            flush=True,
        )

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, X-Filename",
        )
        self.send_header("Access-Control-Expose-Headers", "Content-Disposition")

    def _json(
        self, payload: dict[str, object], status: int = HTTPStatus.OK
    ) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._json(runtime.health())
            return
        if parsed.path.startswith("/files/"):
            parts = parsed.path.strip("/").split("/")
            if len(parts) != 3:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            _, job_id, filename = parts
            if not (
                len(job_id) == 32
                and all(char in "0123456789abcdef" for char in job_id)
            ):
                self.send_error(HTTPStatus.BAD_REQUEST)
                return
            allowed = {
                "original.jpg",
                "mask.png",
                "alpha.png",
                "probability.png",
                "semantic_roi_mask.png",
                "strict_mask.png",
                "strict_alpha.png",
                "strict_transparent.png",
                "strict_white.png",
                "balanced_mask.png",
                "balanced_alpha.png",
                "balanced_transparent.png",
                "balanced_white.png",
                "skin_reference.png",
                "ink_residual.png",
                "dark_gamma.jpg",
                "dark_clahe.jpg",
                "dark_retinex.jpg",
                "dark_ensemble_probability.png",
                "red_specialist_probability.png",
                "red_ink_evidence.png",
                "overlay.jpg",
                "transparent.png",
                "white.png",
            }
            if filename not in allowed:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            path = JOBS_ROOT / job_id / filename
            if not path.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            body = path.read_bytes()
            self.send_response(HTTPStatus.OK)
            self._cors()
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header(
                "Content-Disposition",
                f'inline; filename="{path.name}"',
            )
            self.end_headers()
            self.wfile.write(body)
            return
        self._json(
            {
                "service": "INKLIFT Tattoo Extractor",
                "version": "V11.7",
                **runtime.health(),
            }
        )

    def do_POST(self) -> None:
        request_path = urlparse(self.path).path
        if request_path != "/extract":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if runtime.status != "ready":
            self._json(
                {"error": runtime.message},
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        content_type = self.headers.get("Content-Type", "").split(";")[0]
        if content_type not in ALLOWED_MIME:
            self._json(
                {"error": "JPG, PNG, WEBP 이미지 파일만 지원합니다."},
                HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
            )
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_UPLOAD_BYTES:
            self._json(
                {"error": "파일 크기는 20MB 이하여야 합니다."},
                HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
            )
            return

        started = time.perf_counter()
        filename = unquote(self.headers.get("X-Filename", "upload.jpg"))
        job_id = uuid.uuid4().hex
        job_root = JOBS_ROOT / job_id
        try:
            raw = self.rfile.read(length)
            original, resized = prepare_image(raw)
            (
                probability,
                mask,
                diagnostics,
                _,
                dark_artifacts,
            ) = runtime.extract(original)
            summary = save_outputs(
                original,
                probability,
                mask,
                diagnostics,
                job_root,
                dark_artifacts,
            )
            base_url = f"http://{HOST}:{PORT}/files/{job_id}"
            warning = ""
            if float(summary["predicted_ratio"]) == 0.0:
                warning = (
                    "이 사진에서는 확실한 타투 영역을 찾지 못했습니다. "
                    "조금 더 가까이 촬영한 사진을 사용해 보세요."
                )
            elif resized:
                warning = (
                    "매우 큰 사진이라 긴 변을 3200px로 줄여 처리했습니다."
                )
            self._json(
                {
                    "job_id": job_id,
                    "filename": filename,
                    "width": original.width,
                    "height": original.height,
                    **summary,
                    "processing_seconds": round(
                        time.perf_counter() - started, 3
                    ),
                    "warning": warning,
                    "urls": {
                        "original": f"{base_url}/original.jpg",
                        "mask": f"{base_url}/mask.png",
                        "alpha": f"{base_url}/alpha.png",
                        "probability": f"{base_url}/probability.png",
                        "overlay": f"{base_url}/overlay.jpg",
                        "transparent": f"{base_url}/transparent.png",
                        "white": f"{base_url}/white.png",
                        "strict_mask": f"{base_url}/strict_mask.png",
                        "strict_alpha": f"{base_url}/strict_alpha.png",
                        "strict_transparent": (
                            f"{base_url}/strict_transparent.png"
                        ),
                        "strict_white": f"{base_url}/strict_white.png",
                        "balanced_mask": f"{base_url}/balanced_mask.png",
                        "balanced_alpha": f"{base_url}/balanced_alpha.png",
                        "balanced_transparent": (
                            f"{base_url}/balanced_transparent.png"
                        ),
                        "balanced_white": (
                            f"{base_url}/balanced_white.png"
                        ),
                        "skin_reference": (
                            f"{base_url}/skin_reference.png"
                        ),
                        "ink_residual": (
                            f"{base_url}/ink_residual.png"
                        ),
                        "dark_gamma": f"{base_url}/dark_gamma.jpg",
                        "dark_clahe": f"{base_url}/dark_clahe.jpg",
                        "dark_retinex": f"{base_url}/dark_retinex.jpg",
                        "dark_ensemble_probability": (
                            f"{base_url}/dark_ensemble_probability.png"
                        ),
                        "red_specialist_probability": (
                            f"{base_url}/red_specialist_probability.png"
                        ),
                        "red_ink_evidence": (
                            f"{base_url}/red_ink_evidence.png"
                        ),
                    },
                }
            )
            print(
                f"[done] {filename} job={job_id} "
                f"ratio={summary['predicted_ratio']:.4f} "
                f"skin_removed={summary['skin_pixels_removed_ratio']:.3f} "
                f"seconds={time.perf_counter() - started:.2f}",
                flush=True,
            )
        except Exception as exc:
            traceback.print_exc()
            self._json(
                {"error": f"이미지를 처리하지 못했습니다: {exc}"},
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )

def main() -> int:
    clean_old_jobs()
    loader = threading.Thread(target=runtime.load, daemon=True)
    loader.start()
    server = ThreadingHTTPServer((HOST, PORT), RequestHandler)
    print(f"[server] http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
