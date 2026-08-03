from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw

from infer_segformer_binary_v1 import (
    DEFAULT_PRETRAINED,
    build_model,
    collect_images,
)
from infer_segformer_binary_v5_roi_hysteresis import predict_probability
from infer_segformer_binary_v8_adaptive_faint_red import adaptive_mask
from roi_gate_v5_1 import (
    load_roi_gate,
    predict_roi_tattoo_probability,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = (
    PROJECT_ROOT
    / "models"
    / "segmentation"
    / "segformer_tattoo_binary_v7_balanced"
    / "best_model_calibrated_t080.pt"
)
DEFAULT_OUTPUT = (
    PROJECT_ROOT / "outputs" / "segformer_tattoo_binary_v9_tiled_faint"
)
DEFAULT_TILE_GATE = (
    PROJECT_ROOT
    / "models"
    / "roi_gate"
    / "convnext_tiny_tattoo_roi_v9_balanced_red"
    / "best_model.pt"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run calibrated v7 globally and on overlapping high-resolution "
            "tiles to recover small faint tattoos."
        )
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--pretrained", type=Path, default=DEFAULT_PRETRAINED)
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    parser.add_argument("--tile-size", type=int, default=256)
    parser.add_argument("--tile-overlap", type=float, default=0.50)
    parser.add_argument("--high-threshold", type=float, default=0.80)
    parser.add_argument("--min-tile-seed-ratio", type=float, default=0.0015)
    parser.add_argument("--max-tile-seed-ratio", type=float, default=0.35)
    parser.add_argument("--min-tile-seed-redness", type=float, default=0.25)
    parser.add_argument("--interior-margin-ratio", type=float, default=0.06)
    parser.add_argument(
        "--min-tile-skin-ratio",
        type=float,
        default=0.15,
        help="Minimum broad skin-like pixel ratio required in a tile.",
    )
    parser.add_argument(
        "--tile-red-support-factor",
        type=float,
        default=0.0,
        help=(
            "If positive, fuse tile probabilities only near pixels whose "
            "redness reaches this fraction of median seed redness."
        ),
    )
    parser.add_argument(
        "--tile-gate-model",
        type=Path,
        default=DEFAULT_TILE_GATE,
        help="Optional marker-aware ROI gate applied to candidate tiles.",
    )
    parser.add_argument(
        "--tile-gate-threshold",
        type=float,
        default=0.15,
        help="Override the decision threshold stored in the ROI-gate checkpoint.",
    )
    parser.add_argument(
        "--disable-tile-gate",
        action="store_true",
        help="Disable the marker-aware candidate-tile gate.",
    )
    return parser.parse_args()


def positions(length: int, tile_size: int, stride: int) -> list[int]:
    if length <= tile_size:
        return [0]
    result = list(range(0, max(length - tile_size + 1, 1), stride))
    final = length - tile_size
    if not result or result[-1] != final:
        result.append(final)
    return result


def tiled_probability(
    model: torch.nn.Module,
    original: Image.Image,
    input_size: int,
    device: torch.device,
    tile_size: int,
    overlap: float,
    high_threshold: float,
    min_seed_ratio: float,
    max_seed_ratio: float,
    min_seed_redness: float,
    interior_margin_ratio: float,
    min_skin_ratio: float = 0.0,
    red_support_factor: float = 0.0,
    tile_gate_model: torch.nn.Module | None = None,
    tile_gate_input_size: int = 224,
    tile_gate_threshold: float = 0.5,
) -> tuple[np.ndarray, list[dict[str, float | int | bool]]]:
    original = original.convert("RGB")
    width, height = original.size
    global_probability = predict_probability(
        model,
        original,
        input_size,
        device,
        amp_enabled=device.type == "cuda",
    )
    fused = global_probability.copy()
    actual_tile = min(tile_size, width, height)
    stride = max(32, int(round(actual_tile * (1.0 - overlap))))
    xs = positions(width, actual_tile, stride)
    ys = positions(height, actual_tile, stride)
    diagnostics: list[dict[str, float | int | bool]] = []
    for top in ys:
        for left in xs:
            right = min(left + actual_tile, width)
            bottom = min(top + actual_tile, height)
            crop = original.crop((left, top, right, bottom))
            probability = predict_probability(
                model,
                crop,
                input_size,
                device,
                amp_enabled=device.type == "cuda",
            )
            seed = probability >= high_threshold
            seed_ratio = float(seed.mean())
            crop_rgb = (
                np.asarray(crop.convert("RGB"), dtype=np.float32) / 255.0
            )
            red_channel = crop_rgb[..., 0] * 255.0
            green_channel = crop_rgb[..., 1] * 255.0
            blue_channel = crop_rgb[..., 2] * 255.0
            maximum_channel = np.max(crop_rgb, axis=2)
            minimum_channel = np.min(crop_rgb, axis=2)
            saturation = (
                (maximum_channel - minimum_channel)
                / np.maximum(maximum_channel, 1.0 / 255.0)
            )
            luminance = (
                0.299 * red_channel
                + 0.587 * green_channel
                + 0.114 * blue_channel
            )
            cb_channel = (
                128.0
                - 0.168736 * red_channel
                - 0.331264 * green_channel
                + 0.5 * blue_channel
            )
            cr_channel = (
                128.0
                + 0.5 * red_channel
                - 0.418688 * green_channel
                - 0.081312 * blue_channel
            )
            skin_like = np.logical_and.reduce(
                (
                    cr_channel >= 133.0,
                    cr_channel <= 180.0,
                    cb_channel >= 77.0,
                    cb_channel <= 135.0,
                    luminance >= 25.0,
                    maximum_channel - minimum_channel > 8.0 / 255.0,
                    saturation <= 0.72,
                    red_channel >= green_channel * 0.92,
                    red_channel >= blue_channel,
                )
            )
            skin_ratio = float(skin_like.mean())
            redness = crop_rgb[..., 0] - np.maximum(
                crop_rgb[..., 1], crop_rgb[..., 2]
            )
            seed_redness_median = (
                float(np.median(redness[seed])) if np.any(seed) else -1.0
            )
            seed_red_fraction = (
                float((redness[seed] >= 0.08).mean())
                if np.any(seed)
                else 0.0
            )
            margin = max(
                2,
                int(round(min(probability.shape) * interior_margin_ratio)),
            )
            interior = np.zeros(seed.shape, dtype=bool)
            interior[
                margin : max(margin + 1, seed.shape[0] - margin),
                margin : max(margin + 1, seed.shape[1] - margin),
            ] = True
            interior_seed_ratio = float(np.logical_and(seed, interior).mean())
            segmentation_accepted = (
                min_seed_ratio <= seed_ratio <= max_seed_ratio
                and interior_seed_ratio >= min_seed_ratio * 0.35
                and seed_redness_median >= min_seed_redness
                and skin_ratio >= min_skin_ratio
            )
            tile_gate_probability = -1.0
            tile_gate_accepted = True
            if segmentation_accepted and tile_gate_model is not None:
                tile_gate_probability = predict_roi_tattoo_probability(
                    tile_gate_model,
                    crop,
                    tile_gate_input_size,
                    device,
                    amp_enabled=device.type == "cuda",
                )
                tile_gate_accepted = (
                    tile_gate_probability >= tile_gate_threshold
                )
            accepted = segmentation_accepted and tile_gate_accepted
            diagnostics.append(
                {
                    "left": left,
                    "top": top,
                    "right": right,
                    "bottom": bottom,
                    "seed_ratio": seed_ratio,
                    "interior_seed_ratio": interior_seed_ratio,
                    "maximum_probability": float(probability.max()),
                    "seed_redness_median": seed_redness_median,
                    "seed_red_fraction": seed_red_fraction,
                    "skin_ratio": skin_ratio,
                    "segmentation_accepted": segmentation_accepted,
                    "tile_gate_probability": tile_gate_probability,
                    "tile_gate_accepted": tile_gate_accepted,
                    "accepted": accepted,
                }
            )
            if not accepted:
                continue
            tile_view = fused[top:bottom, left:right]
            use = interior
            if red_support_factor > 0.0:
                support_threshold = max(
                    0.08,
                    seed_redness_median * red_support_factor,
                )
                support = redness >= support_threshold
                padded = np.pad(
                    support,
                    ((1, 1), (1, 1)),
                    mode="constant",
                    constant_values=False,
                )
                expanded = np.zeros_like(support)
                for vertical in range(3):
                    for horizontal in range(3):
                        expanded |= padded[
                            vertical : vertical + support.shape[0],
                            horizontal : horizontal + support.shape[1],
                        ]
                use = np.logical_and(use, expanded)
                diagnostics[-1]["red_support_threshold"] = float(
                    support_threshold
                )
                diagnostics[-1]["red_support_ratio"] = float(
                    expanded.mean()
                )
            tile_view[use] = np.maximum(tile_view[use], probability[use])
    return fused, diagnostics


def save_outputs(
    original: Image.Image,
    probability: np.ndarray,
    diagnostics: list[dict[str, float | int | bool]],
    output_root: Path,
    stem: str,
    mask: np.ndarray,
    adaptive_diagnostics: dict[str, float | bool | str],
) -> dict[str, str | int | float]:
    probability_u8 = np.clip(
        np.round(probability * 255.0), 0, 255
    ).astype(np.uint8)
    mask_u8 = mask.astype(np.uint8) * 255
    probability_path = output_root / f"{stem}_probability.png"
    mask_path = output_root / f"{stem}_mask.png"
    overlay_path = output_root / f"{stem}_overlay.jpg"
    Image.fromarray(probability_u8, mode="L").save(
        probability_path, optimize=True
    )
    Image.fromarray(mask_u8, mode="L").save(mask_path, optimize=True)
    overlay = original.convert("RGBA")
    red = Image.new("RGBA", original.size, (255, 0, 0, 0))
    red.putalpha(
        Image.fromarray(mask_u8, mode="L").point(
            lambda value: 110 if value else 0
        )
    )
    overlay = Image.alpha_composite(overlay, red).convert("RGB")
    draw = ImageDraw.Draw(overlay)
    for item in diagnostics:
        if not item["accepted"]:
            continue
        draw.rectangle(
            (
                int(item["left"]),
                int(item["top"]),
                int(item["right"]) - 1,
                int(item["bottom"]) - 1,
            ),
            outline=(0, 255, 70),
            width=2,
        )
    overlay.save(overlay_path, quality=95, subsampling=0)
    diagnostics_path = output_root / f"{stem}_tiles.json"
    diagnostics_path.write_text(
        json.dumps(diagnostics, indent=2), encoding="utf-8"
    )
    return {
        "probability_file": str(probability_path),
        "mask_file": str(mask_path),
        "overlay_file": str(overlay_path),
        "tile_diagnostics_file": str(diagnostics_path),
        "tiles_tested": len(diagnostics),
        "tiles_accepted": sum(bool(item["accepted"]) for item in diagnostics),
        "predicted_ratio": float(mask.mean()),
        "adaptive_triggered": bool(
            adaptive_diagnostics["adaptive_triggered"]
        ),
        "adaptive_growth_factor": float(
            adaptive_diagnostics["growth_factor"]
        ),
    }


@torch.inference_mode()
def main() -> int:
    args = parse_args()
    if args.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is unavailable.")
    if not 0.0 <= args.tile_overlap < 1.0:
        raise ValueError("tile-overlap must be in [0, 1).")
    device = torch.device(args.device)
    checkpoint = torch.load(
        args.model.resolve(), map_location="cpu", weights_only=False
    )
    input_size = int(checkpoint.get("input_size", 512))
    model = build_model(args.pretrained, checkpoint, device)
    tile_gate_model: torch.nn.Module | None = None
    tile_gate_input_size = 224
    tile_gate_threshold = 0.5
    if not args.disable_tile_gate and args.tile_gate_model is not None:
        tile_gate_model, tile_gate_checkpoint = load_roi_gate(
            args.tile_gate_model,
            device,
        )
        tile_gate_input_size = int(
            tile_gate_checkpoint.get("input_size", 224)
        )
        tile_gate_threshold = (
            float(args.tile_gate_threshold)
            if args.tile_gate_threshold is not None
            else float(tile_gate_checkpoint.get("threshold", 0.5))
        )
    images = collect_images(args.input.resolve())
    if not images:
        raise RuntimeError("No supported images found.")
    output_root = args.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str | int | float]] = []
    for index, path in enumerate(images, start=1):
        with Image.open(path) as opened:
            original = opened.convert("RGB")
        probability, diagnostics = tiled_probability(
            model,
            original,
            input_size,
            device,
            args.tile_size,
            args.tile_overlap,
            args.high_threshold,
            args.min_tile_seed_ratio,
            args.max_tile_seed_ratio,
            args.min_tile_seed_redness,
            args.interior_margin_ratio,
            args.min_tile_skin_ratio,
            args.tile_red_support_factor,
            tile_gate_model,
            tile_gate_input_size,
            tile_gate_threshold,
        )
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
        print(
            f"{index}/{len(images)} {path.name} "
            f"tiles={output['tiles_accepted']}/{output['tiles_tested']} "
            f"ratio={output['predicted_ratio']:.4f}",
            flush=True,
        )
    with (output_root / "inference_manifest.csv").open(
        "w", encoding="utf-8-sig", newline=""
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    config = {
        "model": str(args.model.resolve()),
        "tile_size": args.tile_size,
        "tile_overlap": args.tile_overlap,
        "high_threshold": args.high_threshold,
        "min_tile_seed_ratio": args.min_tile_seed_ratio,
        "max_tile_seed_ratio": args.max_tile_seed_ratio,
        "min_tile_seed_redness": args.min_tile_seed_redness,
        "interior_margin_ratio": args.interior_margin_ratio,
        "min_tile_skin_ratio": args.min_tile_skin_ratio,
        "tile_red_support_factor": args.tile_red_support_factor,
        "tile_gate_model": (
            str(args.tile_gate_model.resolve())
            if not args.disable_tile_gate and args.tile_gate_model is not None
            else None
        ),
        "tile_gate_input_size": tile_gate_input_size,
        "tile_gate_threshold": (
            tile_gate_threshold
            if not args.disable_tile_gate and args.tile_gate_model is not None
            else None
        ),
    }
    (output_root / "config.json").write_text(
        json.dumps(config, indent=2), encoding="utf-8"
    )
    print(f"output={output_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
