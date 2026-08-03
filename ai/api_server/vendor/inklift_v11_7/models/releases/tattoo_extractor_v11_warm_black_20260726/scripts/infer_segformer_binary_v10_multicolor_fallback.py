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
from infer_segformer_binary_v5_roi_hysteresis import predict_probability
from infer_segformer_binary_v8_adaptive_faint_red import adaptive_mask
from infer_segformer_binary_v9_tiled_faint import (
    positions,
    save_outputs,
    tiled_probability,
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
DEFAULT_SPECIALIST_MODEL = (
    PROJECT_ROOT
    / "weights"
    / "multicolor_specialist_v10.pt"
)
DEFAULT_TILE_GATE = (
    PROJECT_ROOT
    / "weights"
    / "roi_gate_v9_balanced_red.pt"
)
DEFAULT_OUTPUT = PROJECT_ROOT / "outputs"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Preserve V9 and add specialist predictions only for connected "
            "blue/green ink components in marker-gated tiles."
        )
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--base-model", type=Path, default=DEFAULT_BASE_MODEL)
    parser.add_argument(
        "--specialist-model",
        type=Path,
        default=DEFAULT_SPECIALIST_MODEL,
    )
    parser.add_argument("--pretrained", type=Path, default=DEFAULT_PRETRAINED)
    parser.add_argument("--tile-gate-model", type=Path, default=DEFAULT_TILE_GATE)
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
    parser.add_argument(
        "--base-anchor-radius",
        type=int,
        default=18,
        help=(
            "Specialist components must touch a V9 high-confidence region "
            "within this many pixels."
        ),
    )
    parser.add_argument(
        "--min-base-anchor-image-ratio",
        type=float,
        default=0.02,
        help="Normal minimum V9 high-confidence area before color expansion.",
    )
    parser.add_argument(
        "--small-anchor-rescue-ratio",
        type=float,
        default=0.003,
        help="Lower V9 area allowed only for nearly pure color ink.",
    )
    parser.add_argument(
        "--small-anchor-rescue-color-fraction",
        type=float,
        default=0.70,
    )
    return parser.parse_args()


def broad_skin_ratio(rgb: np.ndarray) -> float:
    red = rgb[..., 0] * 255.0
    green = rgb[..., 1] * 255.0
    blue = rgb[..., 2] * 255.0
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = (maximum - minimum) / np.maximum(maximum, 1.0 / 255.0)
    luminance = 0.299 * red + 0.587 * green + 0.114 * blue
    cb = 128.0 - 0.168736 * red - 0.331264 * green + 0.5 * blue
    cr = 128.0 + 0.5 * red - 0.418688 * green - 0.081312 * blue
    skin = np.logical_and.reduce(
        (
            cr >= 133.0,
            cr <= 180.0,
            cb >= 77.0,
            cb <= 135.0,
            luminance >= 25.0,
            maximum - minimum > 8.0 / 255.0,
            saturation <= 0.72,
            red >= green * 0.92,
            red >= blue,
        )
    )
    return float(skin.mean())


def blue_green_support(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = (maximum - minimum) / np.maximum(maximum, 1.0 / 255.0)
    blue_support = np.logical_and.reduce(
        (
            blue - red >= 0.025,
            blue - green >= 0.005,
            saturation >= 0.10,
        )
    )
    green_support = np.logical_and.reduce(
        (
            green - red >= 0.018,
            green - blue >= 0.005,
            saturation >= 0.09,
        )
    )
    return blue_support, green_support


def supported_seed_components(
    seed: np.ndarray,
    color_support: np.ndarray,
    base_anchor: np.ndarray,
    anchor_radius: int,
) -> tuple[np.ndarray, int]:
    expanded = cv2.dilate(
        color_support.astype(np.uint8),
        np.ones((7, 7), dtype=np.uint8),
        iterations=1,
    ).astype(bool)
    anchor_size = max(1, 2 * anchor_radius + 1)
    expanded_anchor = cv2.dilate(
        base_anchor.astype(np.uint8),
        np.ones((anchor_size, anchor_size), dtype=np.uint8),
        iterations=1,
    ).astype(bool)
    count, labels = cv2.connectedComponents(
        seed.astype(np.uint8),
        connectivity=8,
    )
    keep = np.zeros_like(seed)
    accepted_components = 0
    for component in range(1, count):
        component_mask = labels == component
        component_area = int(component_mask.sum())
        overlap = int(np.logical_and(component_mask, expanded).sum())
        anchor_overlap = int(
            np.logical_and(component_mask, expanded_anchor).sum()
        )
        if (
            overlap >= max(3, int(round(component_area * 0.005)))
            and anchor_overlap >= max(1, int(round(component_area * 0.002)))
        ):
            keep |= component_mask
            accepted_components += 1
    return keep, accepted_components


def add_color_specialist_tiles(
    specialist: torch.nn.Module,
    original: Image.Image,
    input_size: int,
    device: torch.device,
    fused: np.ndarray,
    base_probability: np.ndarray,
    tile_gate: torch.nn.Module,
    tile_gate_input_size: int,
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
    base_anchor_image_ratio = float(
        (base_probability >= args.high_threshold).mean()
    )
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
            seed = probability >= args.high_threshold
            seed_ratio = float(seed.mean())
            rgb = np.asarray(crop, dtype=np.float32) / 255.0
            blue, green = blue_green_support(rgb)
            support = np.logical_or(blue, green)
            color_seed = np.logical_and(seed, support)
            color_pixels = int(color_seed.sum())
            color_fraction = (
                float(color_pixels / int(seed.sum())) if np.any(seed) else 0.0
            )
            blue_fraction = (
                float(np.logical_and(seed, blue).sum() / int(seed.sum()))
                if np.any(seed)
                else 0.0
            )
            green_fraction = (
                float(np.logical_and(seed, green).sum() / int(seed.sum()))
                if np.any(seed)
                else 0.0
            )
            skin_ratio = broad_skin_ratio(rgb)
            margin = max(
                2,
                int(round(min(seed.shape) * args.interior_margin_ratio)),
            )
            interior = np.zeros_like(seed)
            interior[
                margin : max(margin + 1, seed.shape[0] - margin),
                margin : max(margin + 1, seed.shape[1] - margin),
            ] = True
            interior_seed_ratio = float(np.logical_and(seed, interior).mean())
            component_support, accepted_components = supported_seed_components(
                seed,
                support,
                (
                    base_probability[top:bottom, left:right]
                    >= args.high_threshold
                ),
                args.base_anchor_radius,
            )
            image_anchor_accepted = (
                base_anchor_image_ratio
                >= args.min_base_anchor_image_ratio
                or (
                    base_anchor_image_ratio
                    >= args.small_anchor_rescue_ratio
                    and color_fraction
                    >= args.small_anchor_rescue_color_fraction
                )
            )
            segmentation_accepted = (
                args.min_tile_seed_ratio
                <= seed_ratio
                <= args.max_tile_seed_ratio
                and interior_seed_ratio
                >= args.min_tile_seed_ratio * 0.35
                and skin_ratio >= args.min_tile_skin_ratio
                and color_pixels >= args.min_seed_color_pixels
                and color_fraction >= args.min_seed_color_fraction
                and accepted_components > 0
                and image_anchor_accepted
            )
            tile_gate_probability = -1.0
            tile_gate_accepted = False
            if segmentation_accepted:
                tile_gate_probability = predict_roi_tattoo_probability(
                    tile_gate,
                    crop,
                    tile_gate_input_size,
                    device,
                    amp_enabled=device.type == "cuda",
                )
                tile_gate_accepted = (
                    tile_gate_probability >= args.tile_gate_threshold
                )
            accepted = segmentation_accepted and tile_gate_accepted
            diagnostics.append(
                {
                    "branch": "blue_green_specialist",
                    "left": left,
                    "top": top,
                    "right": right,
                    "bottom": bottom,
                    "seed_ratio": seed_ratio,
                    "interior_seed_ratio": interior_seed_ratio,
                    "maximum_probability": float(probability.max()),
                    "skin_ratio": skin_ratio,
                    "seed_color_pixels": color_pixels,
                    "seed_color_fraction": color_fraction,
                    "seed_blue_fraction": blue_fraction,
                    "seed_green_fraction": green_fraction,
                    "supported_components": accepted_components,
                    "base_anchor_image_ratio": base_anchor_image_ratio,
                    "image_anchor_accepted": image_anchor_accepted,
                    "segmentation_accepted": segmentation_accepted,
                    "tile_gate_probability": tile_gate_probability,
                    "tile_gate_accepted": tile_gate_accepted,
                    "accepted": accepted,
                }
            )
            if not accepted:
                continue
            use = np.logical_and(component_support, interior)
            view = fused[top:bottom, left:right]
            view[use] = np.maximum(view[use], probability[use])
    return fused, diagnostics


@torch.inference_mode()
def main() -> int:
    args = parse_args()
    if args.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is unavailable.")
    device = torch.device(args.device)
    base_checkpoint = torch.load(
        args.base_model.resolve(),
        map_location="cpu",
        weights_only=False,
    )
    specialist_checkpoint = torch.load(
        args.specialist_model.resolve(),
        map_location="cpu",
        weights_only=False,
    )
    base = build_model(args.pretrained, base_checkpoint, device)
    specialist = build_model(
        args.pretrained,
        specialist_checkpoint,
        device,
    )
    tile_gate, gate_checkpoint = load_roi_gate(
        args.tile_gate_model,
        device,
    )
    gate_input_size = int(gate_checkpoint.get("input_size", 224))
    images = collect_images(args.input.resolve())
    output_root = args.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str | int | float]] = []
    for index, path in enumerate(images, start=1):
        with Image.open(path) as opened:
            original = opened.convert("RGB")
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
            gate_input_size,
            args.tile_gate_threshold,
        )
        for item in red_diagnostics:
            item["branch"] = "v9_red"
        probability, color_diagnostics = add_color_specialist_tiles(
            specialist,
            original,
            int(specialist_checkpoint.get("input_size", 512)),
            device,
            probability,
            probability.copy(),
            tile_gate,
            gate_input_size,
            args,
        )
        diagnostics = [*red_diagnostics, *color_diagnostics]
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
        color_accepted = sum(
            bool(item["accepted"]) for item in color_diagnostics
        )
        print(
            f"{index}/{len(images)} {path.name} "
            f"color_tiles={color_accepted}/{len(color_diagnostics)} "
            f"ratio={float(output['predicted_ratio']):.4f}",
            flush=True,
        )
    with (output_root / "inference_manifest.csv").open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    config = {
        "base_model": str(args.base_model.resolve()),
        "specialist_model": str(args.specialist_model.resolve()),
        "tile_gate_model": str(args.tile_gate_model.resolve()),
        "tile_size": args.tile_size,
        "tile_overlap": args.tile_overlap,
        "high_threshold": args.high_threshold,
        "min_tile_seed_ratio": args.min_tile_seed_ratio,
        "max_tile_seed_ratio": args.max_tile_seed_ratio,
        "min_tile_skin_ratio": args.min_tile_skin_ratio,
        "min_seed_color_fraction": args.min_seed_color_fraction,
        "min_seed_color_pixels": args.min_seed_color_pixels,
        "tile_gate_threshold": args.tile_gate_threshold,
        "base_anchor_radius": args.base_anchor_radius,
        "min_base_anchor_image_ratio": args.min_base_anchor_image_ratio,
        "small_anchor_rescue_ratio": args.small_anchor_rescue_ratio,
        "small_anchor_rescue_color_fraction": (
            args.small_anchor_rescue_color_fraction
        ),
        "strategy": (
            "V9 unchanged plus connected specialist seed components that "
            "overlap blue/green color support and a nearby V9 "
            "high-confidence anchor in marker-gated skin tiles."
        ),
    }
    (output_root / "config.json").write_text(
        json.dumps(config, indent=2),
        encoding="utf-8",
    )
    print(f"output={output_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
