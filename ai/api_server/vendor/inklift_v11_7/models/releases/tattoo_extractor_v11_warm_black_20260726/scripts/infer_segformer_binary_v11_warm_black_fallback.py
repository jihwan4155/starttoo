from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image

from infer_segformer_binary_v1 import (
    DEFAULT_PRETRAINED,
    build_model,
    collect_images,
)
from infer_segformer_binary_v5_roi_hysteresis import (
    connected_hysteresis,
    predict_probability,
)
from infer_segformer_binary_v8_adaptive_faint_red import adaptive_mask
from infer_segformer_binary_v9_tiled_faint import (
    positions,
    save_outputs,
    tiled_probability,
)
from infer_segformer_binary_v10_multicolor_fallback import (
    add_color_specialist_tiles,
)
from roi_gate_v5_1 import (
    load_roi_gate,
    predict_roi_tattoo_probability,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PRETRAINED = PROJECT_ROOT / "pretrained_segformer_b0"
DEFAULT_BASE_MODEL = (
    PROJECT_ROOT
    / "weights"
    / "base_segformer_v7_calibrated_t080.pt"
)
DEFAULT_COLOR_MODEL = (
    PROJECT_ROOT
    / "weights"
    / "multicolor_specialist_v10.pt"
)
DEFAULT_WARM_MODEL = (
    PROJECT_ROOT
    / "weights"
    / "warm_black_specialist_v11.pt"
)
DEFAULT_TILE_GATE = (
    PROJECT_ROOT
    / "weights"
    / "roi_gate_v9_balanced_red.pt"
)
DEFAULT_WARM_GATE = (
    PROJECT_ROOT
    / "weights"
    / "warm_black_roi_gate_v11.pt"
)
DEFAULT_OUTPUT = PROJECT_ROOT / "outputs"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Preserve V10 and add a narrowly guarded warm, blurred, faint "
            "black tattoo fallback."
        )
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--base-model", type=Path, default=DEFAULT_BASE_MODEL)
    parser.add_argument(
        "--specialist-model",
        type=Path,
        default=DEFAULT_COLOR_MODEL,
    )
    parser.add_argument(
        "--warm-model",
        type=Path,
        default=DEFAULT_WARM_MODEL,
    )
    parser.add_argument("--pretrained", type=Path, default=DEFAULT_PRETRAINED)
    parser.add_argument("--tile-gate-model", type=Path, default=DEFAULT_TILE_GATE)
    parser.add_argument("--warm-gate-model", type=Path, default=DEFAULT_WARM_GATE)
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    parser.add_argument("--tile-size", type=int, default=256)
    parser.add_argument("--tile-overlap", type=float, default=0.50)
    parser.add_argument("--high-threshold", type=float, default=0.80)
    parser.add_argument("--min-tile-seed-ratio", type=float, default=0.0015)
    parser.add_argument("--max-tile-seed-ratio", type=float, default=0.35)
    parser.add_argument("--min-tile-skin-ratio", type=float, default=0.15)
    parser.add_argument("--min-seed-color-fraction", type=float, default=0.04)
    parser.add_argument("--min-seed-color-pixels", type=int, default=8)
    parser.add_argument("--tile-gate-threshold", type=float, default=0.15)
    parser.add_argument("--interior-margin-ratio", type=float, default=0.06)
    parser.add_argument("--base-anchor-radius", type=int, default=18)
    parser.add_argument(
        "--min-base-anchor-image-ratio",
        type=float,
        default=0.02,
    )
    parser.add_argument(
        "--small-anchor-rescue-ratio",
        type=float,
        default=0.003,
    )
    parser.add_argument(
        "--small-anchor-rescue-color-fraction",
        type=float,
        default=0.70,
    )
    parser.add_argument("--warm-high-threshold", type=float, default=0.92)
    parser.add_argument("--warm-low-threshold", type=float, default=0.85)
    parser.add_argument("--warm-gate-threshold", type=float, default=0.15)
    parser.add_argument("--min-warmth", type=float, default=0.65)
    parser.add_argument("--min-yellowness", type=float, default=0.48)
    parser.add_argument("--max-warm-blur-variance", type=float, default=80.0)
    parser.add_argument("--min-warm-candidate-ratio", type=float, default=0.003)
    parser.add_argument("--max-warm-candidate-ratio", type=float, default=0.14)
    parser.add_argument("--min-warm-contrast", type=float, default=0.06)
    return parser.parse_args()


def warm_tile_features(
    crop: Image.Image,
    probability: np.ndarray,
    low_threshold: float,
) -> tuple[dict[str, float], np.ndarray, np.ndarray]:
    rgb_u8 = np.asarray(crop.convert("RGB"), dtype=np.uint8)
    rgb = rgb_u8.astype(np.float32) / 255.0
    luminance = (
        0.299 * rgb[..., 0]
        + 0.587 * rgb[..., 1]
        + 0.114 * rgb[..., 2]
    )
    valid = np.logical_and(luminance >= 0.12, luminance <= 0.98)
    if int(valid.sum()) < 64:
        valid = np.ones_like(luminance, dtype=bool)
    median_rgb = np.median(rgb[valid], axis=0)
    candidate = probability >= low_threshold
    contrast = 0.0
    if np.any(candidate):
        count, labels, stats, _ = cv2.connectedComponentsWithStats(
            candidate.astype(np.uint8),
            connectivity=8,
        )
        if count > 1:
            component = 1 + int(
                np.argmax(stats[1:, cv2.CC_STAT_AREA])
            )
            focus = labels == component
        else:
            focus = candidate
        dilated = cv2.dilate(
            focus.astype(np.uint8),
            np.ones((19, 19), dtype=np.uint8),
            iterations=1,
        ).astype(bool)
        ring = np.logical_and(dilated, ~focus)
        if int(ring.sum()) < 32:
            ring = np.logical_and(~focus, valid)
        contrast = float(
            np.median(luminance[ring]) - np.median(luminance[focus])
        )
    gray = cv2.cvtColor(rgb_u8, cv2.COLOR_RGB2GRAY)
    values = {
        "maximum_probability": float(probability.max()),
        "seed_ratio": float(candidate.mean()),
        "median_warmth": float(median_rgb[0] - median_rgb[2]),
        "median_yellowness": float(
            (median_rgb[0] + median_rgb[1]) * 0.5 - median_rgb[2]
        ),
        "blur_variance": float(
            cv2.Laplacian(gray, cv2.CV_32F).var()
        ),
        "candidate_contrast": contrast,
    }
    darkness_support = luminance <= float(np.median(luminance[valid]))
    return values, darkness_support, candidate


def add_warm_black_tiles(
    specialist: torch.nn.Module,
    original: Image.Image,
    input_size: int,
    device: torch.device,
    fused: np.ndarray,
    warm_gate: torch.nn.Module,
    warm_gate_input_size: int,
    args: argparse.Namespace,
) -> tuple[np.ndarray, list[dict[str, float | int | bool | str]]]:
    original = original.convert("RGB")
    width, height = original.size
    actual_tile = min(args.tile_size, width, height)
    stride = max(
        32,
        int(round(actual_tile * (1.0 - args.tile_overlap))),
    )
    diagnostics: list[dict[str, float | int | bool | str]] = []
    for top in positions(height, actual_tile, stride):
        for left in positions(width, actual_tile, stride):
            right = min(left + actual_tile, width)
            bottom = min(top + actual_tile, height)
            crop = original.crop((left, top, right, bottom))
            probability = predict_probability(
                specialist,
                crop,
                input_size,
                device,
                amp_enabled=device.type == "cuda",
            )
            values, darkness_support, _ = warm_tile_features(
                crop,
                probability,
                args.warm_low_threshold,
            )
            _, grown = connected_hysteresis(
                probability,
                args.warm_high_threshold,
                args.warm_low_threshold,
                bridge_radius=1,
            )
            supported = np.logical_and(grown, darkness_support)
            margin = max(
                2,
                int(round(min(supported.shape) * args.interior_margin_ratio)),
            )
            interior = np.zeros_like(supported)
            interior[
                margin : max(margin + 1, supported.shape[0] - margin),
                margin : max(margin + 1, supported.shape[1] - margin),
            ] = True
            supported &= interior
            feature_accepted = (
                values["maximum_probability"]
                >= args.warm_high_threshold
                and args.min_warm_candidate_ratio
                <= values["seed_ratio"]
                <= args.max_warm_candidate_ratio
                and values["median_warmth"] >= args.min_warmth
                and values["median_yellowness"] >= args.min_yellowness
                and values["blur_variance"]
                <= args.max_warm_blur_variance
                and values["candidate_contrast"] >= args.min_warm_contrast
                and bool(np.any(supported))
            )
            gate_probability = -1.0
            gate_accepted = False
            if feature_accepted:
                gate_probability = predict_roi_tattoo_probability(
                    warm_gate,
                    crop,
                    warm_gate_input_size,
                    device,
                    amp_enabled=device.type == "cuda",
                )
                gate_accepted = (
                    gate_probability >= args.warm_gate_threshold
                )
            accepted = feature_accepted and gate_accepted
            diagnostics.append(
                {
                    "branch": "warm_faint_black_specialist",
                    "left": left,
                    "top": top,
                    "right": right,
                    "bottom": bottom,
                    **values,
                    "supported_ratio": float(supported.mean()),
                    "feature_accepted": feature_accepted,
                    "tile_gate_probability": gate_probability,
                    "tile_gate_accepted": gate_accepted,
                    "accepted": accepted,
                }
            )
            if not accepted:
                continue
            view = fused[top:bottom, left:right]
            view[supported] = np.maximum(
                view[supported],
                probability[supported],
            )
    return fused, diagnostics


@torch.inference_mode()
def main() -> int:
    args = parse_args()
    if args.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is unavailable.")
    device = torch.device(args.device)
    base_checkpoint = torch.load(
        args.base_model.resolve(), map_location="cpu", weights_only=False
    )
    color_checkpoint = torch.load(
        args.specialist_model.resolve(),
        map_location="cpu",
        weights_only=False,
    )
    warm_checkpoint = torch.load(
        args.warm_model.resolve(), map_location="cpu", weights_only=False
    )
    base = build_model(args.pretrained, base_checkpoint, device)
    color_specialist = build_model(
        args.pretrained, color_checkpoint, device
    )
    warm_specialist = build_model(
        args.pretrained, warm_checkpoint, device
    )
    tile_gate, tile_gate_checkpoint = load_roi_gate(
        args.tile_gate_model, device
    )
    warm_gate, warm_gate_checkpoint = load_roi_gate(
        args.warm_gate_model, device
    )
    tile_gate_input_size = int(
        tile_gate_checkpoint.get("input_size", 224)
    )
    warm_gate_input_size = int(
        warm_gate_checkpoint.get("input_size", 224)
    )
    images = collect_images(args.input.resolve())
    output_root = args.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str | int | float]] = []
    for index, path in enumerate(images, start=1):
        original = Image.open(path).convert("RGB")
        probability, red_diagnostics = tiled_probability(
            base,
            original,
            int(base_checkpoint.get("input_size", 512)),
            device,
            args.tile_size,
            args.tile_overlap,
            args.high_threshold,
            args.min_tile_seed_ratio,
            args.max_tile_seed_ratio,
            0.25,
            args.interior_margin_ratio,
            args.min_tile_skin_ratio,
            0.0,
            tile_gate,
            tile_gate_input_size,
            args.tile_gate_threshold,
        )
        for item in red_diagnostics:
            item["branch"] = "v9_red"
        probability, color_diagnostics = add_color_specialist_tiles(
            color_specialist,
            original,
            int(color_checkpoint.get("input_size", 512)),
            device,
            probability,
            probability.copy(),
            tile_gate,
            tile_gate_input_size,
            args,
        )
        probability, warm_diagnostics = add_warm_black_tiles(
            warm_specialist,
            original,
            int(warm_checkpoint.get("input_size", 256)),
            device,
            probability,
            warm_gate,
            warm_gate_input_size,
            args,
        )
        diagnostics = [
            *red_diagnostics,
            *color_diagnostics,
            *warm_diagnostics,
        ]
        mask, adaptive_diagnostics = adaptive_mask(original, probability)
        output = save_outputs(
            original,
            probability,
            diagnostics,
            output_root,
            path.stem,
            mask,
            adaptive_diagnostics,
        )
        rows.append({"source_file": str(path), **output})
        warm_accepted = sum(
            bool(item["accepted"]) for item in warm_diagnostics
        )
        print(
            f"{index}/{len(images)} {path.name} "
            f"warm_tiles={warm_accepted}/{len(warm_diagnostics)} "
            f"ratio={float(output['predicted_ratio']):.4f}",
            flush=True,
        )
    with (output_root / "inference_manifest.csv").open(
        "w", encoding="utf-8-sig", newline=""
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    config = {
        "base_model": str(args.base_model.resolve()),
        "color_specialist_model": str(args.specialist_model.resolve()),
        "warm_specialist_model": str(args.warm_model.resolve()),
        "tile_gate_model": str(args.tile_gate_model.resolve()),
        "warm_gate_model": str(args.warm_gate_model.resolve()),
        "tile_size": args.tile_size,
        "tile_overlap": args.tile_overlap,
        "warm_high_threshold": args.warm_high_threshold,
        "warm_low_threshold": args.warm_low_threshold,
        "warm_gate_threshold": args.warm_gate_threshold,
        "min_warmth": args.min_warmth,
        "min_yellowness": args.min_yellowness,
        "max_warm_blur_variance": args.max_warm_blur_variance,
        "min_warm_candidate_ratio": args.min_warm_candidate_ratio,
        "max_warm_candidate_ratio": args.max_warm_candidate_ratio,
        "min_warm_contrast": args.min_warm_contrast,
        "strategy": (
            "V10 preserved; V11 warm-black probabilities are fused only "
            "inside connected high/low-threshold components that are darker "
            "than the tile median and pass extreme warmth, blur, size, "
            "contrast, and marker-aware gate checks."
        ),
    }
    (output_root / "config.json").write_text(
        json.dumps(config, indent=2), encoding="utf-8"
    )
    print(f"output={output_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
