from __future__ import annotations

import argparse
import csv
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

from infer_segformer_binary_v1 import (
    DEFAULT_PRETRAINED,
    build_model,
    collect_images,
    prepare,
)
from roi_gate_v5_1 import (
    load_roi_gate,
    predict_roi_tattoo_probability,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = (
    PROJECT_ROOT
    / "models"
    / "segmentation"
    / "segformer_tattoo_binary_v4_red_lettering"
    / "best_model.pt"
)
DEFAULT_OUTPUT = (
    PROJECT_ROOT
    / "outputs"
    / "segformer_tattoo_binary_v5_roi_hysteresis"
)
DEFAULT_ROI_GATE = (
    PROJECT_ROOT
    / "models"
    / "roi_gate"
    / "convnext_tiny_tattoo_roi_v5_1"
    / "best_model.pt"
)


@dataclass(frozen=True)
class PipelineConfig:
    coarse_size: int = 512
    roi_size: int = 768
    high_threshold: float = 0.85
    low_threshold: float = 0.35
    bridge_radius: int = 2
    roi_padding_ratio: float = 0.20
    min_roi_padding: int = 24
    max_rois: int = 6
    fusion_weight: float = 0.80
    fusion_mode: str = "boost"
    refine_min_seed_ratio: float = 0.005
    refine_max_seed_ratio: float = 0.045
    max_growth_factor: float = 4.50


@dataclass
class PipelineResult:
    coarse_probability: np.ndarray
    refined_probability: np.ndarray
    seed_mask: np.ndarray
    final_mask: np.ndarray
    alpha: np.ndarray
    roi_boxes: list[tuple[int, int, int, int]]
    roi_gate_probabilities: list[float]
    refinement_applied: bool
    fallback_reason: str
    elapsed_seconds: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extract tattoo masks using a coarse SegFormer pass, high-resolution "
            "ROI refinement, and connected dual-threshold growth."
        )
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--pretrained", type=Path, default=DEFAULT_PRETRAINED)
    parser.add_argument("--coarse-size", type=int, default=None)
    parser.add_argument("--roi-size", type=int, default=768)
    parser.add_argument("--high-threshold", type=float, default=None)
    parser.add_argument("--low-threshold", type=float, default=0.35)
    parser.add_argument("--bridge-radius", type=int, default=2)
    parser.add_argument("--roi-padding-ratio", type=float, default=0.20)
    parser.add_argument("--min-roi-padding", type=int, default=24)
    parser.add_argument("--max-rois", type=int, default=6)
    parser.add_argument("--fusion-weight", type=float, default=0.80)
    parser.add_argument(
        "--fusion-mode",
        choices=("replace", "blend", "boost"),
        default="boost",
    )
    parser.add_argument("--refine-min-seed-ratio", type=float, default=0.005)
    parser.add_argument("--refine-max-seed-ratio", type=float, default=0.045)
    parser.add_argument("--max-growth-factor", type=float, default=4.50)
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    parser.add_argument("--roi-gate-model", type=Path, default=None)
    parser.add_argument("--roi-gate-threshold", type=float, default=None)
    return parser.parse_args()


def validate_config(config: PipelineConfig) -> None:
    if config.coarse_size <= 0 or config.roi_size <= 0:
        raise ValueError("Inference sizes must be positive.")
    if not 0.0 < config.low_threshold < config.high_threshold < 1.0:
        raise ValueError(
            "Thresholds must satisfy 0 < low_threshold < high_threshold < 1."
        )
    if config.bridge_radius < 0:
        raise ValueError("bridge_radius must be non-negative.")
    if config.roi_padding_ratio < 0 or config.min_roi_padding < 0:
        raise ValueError("ROI padding must be non-negative.")
    if config.max_rois <= 0:
        raise ValueError("max_rois must be positive.")
    if not 0.0 <= config.fusion_weight <= 1.0:
        raise ValueError("fusion_weight must be between 0 and 1.")
    if config.fusion_mode not in {"replace", "blend", "boost"}:
        raise ValueError("fusion_mode must be replace, blend, or boost.")
    if not (
        0.0
        <= config.refine_min_seed_ratio
        < config.refine_max_seed_ratio
        <= 1.0
    ):
        raise ValueError("Invalid adaptive seed-ratio range.")
    if config.max_growth_factor < 1.0:
        raise ValueError("max_growth_factor must be at least 1.")


@torch.inference_mode()
def predict_probability(
    model: torch.nn.Module,
    image: Image.Image,
    inference_size: int,
    device: torch.device,
    amp_enabled: bool,
) -> np.ndarray:
    pixels = prepare(image, inference_size).to(device)
    with torch.autocast(
        device_type=device.type,
        enabled=amp_enabled,
        dtype=torch.float16,
    ):
        logits = model(pixel_values=pixels).logits
    return (
        F.interpolate(
            logits.float(),
            size=(image.height, image.width),
            mode="bilinear",
            align_corners=False,
        )
        .softmax(dim=1)[0, 1]
        .cpu()
        .numpy()
        .astype(np.float32, copy=False)
    )


def connected_hysteresis(
    probability: np.ndarray,
    high_threshold: float,
    low_threshold: float,
    bridge_radius: int,
    extra_seed: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Keep low-threshold components that touch a high-confidence seed."""
    candidate = probability >= low_threshold
    seed = probability >= high_threshold
    if extra_seed is not None:
        if extra_seed.shape != seed.shape:
            raise ValueError("extra_seed shape does not match probability.")
        seed |= extra_seed.astype(bool, copy=False)
    candidate |= seed
    if not seed.any() or not candidate.any():
        return seed, np.zeros_like(candidate, dtype=bool)

    labels, count = ndimage.label(
        candidate,
        structure=np.ones((3, 3), dtype=np.uint8),
    )
    if count == 0:
        return seed, np.zeros_like(candidate, dtype=bool)

    seed_support = seed
    if bridge_radius:
        seed_support = ndimage.binary_dilation(
            seed,
            structure=np.ones((3, 3), dtype=bool),
            iterations=bridge_radius,
        )
    kept_labels = np.unique(labels[seed_support & (labels > 0)])
    if kept_labels.size == 0:
        return seed, np.zeros_like(candidate, dtype=bool)
    grown = np.isin(labels, kept_labels)
    return seed, grown


def _square_and_clip_box(
    box: tuple[int, int, int, int],
    width: int,
    height: int,
    padding_ratio: float,
    min_padding: int,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    box_width = max(1, right - left)
    box_height = max(1, bottom - top)
    padding = max(
        min_padding,
        int(round(max(box_width, box_height) * padding_ratio)),
    )
    center_x = (left + right) / 2.0
    center_y = (top + bottom) / 2.0
    side = min(max(width, height), max(box_width, box_height) + 2 * padding)
    side = min(side, width, height)

    new_left = int(round(center_x - side / 2.0))
    new_top = int(round(center_y - side / 2.0))
    new_left = max(0, min(width - side, new_left))
    new_top = max(0, min(height - side, new_top))
    return (
        int(new_left),
        int(new_top),
        int(new_left + side),
        int(new_top + side),
    )


def _boxes_touch(
    first: tuple[int, int, int, int],
    second: tuple[int, int, int, int],
) -> bool:
    return not (
        first[2] < second[0]
        or second[2] < first[0]
        or first[3] < second[1]
        or second[3] < first[1]
    )


def _merge_boxes(
    boxes: list[tuple[int, int, int, int]],
) -> list[tuple[int, int, int, int]]:
    pending = list(boxes)
    merged: list[tuple[int, int, int, int]] = []
    while pending:
        current = pending.pop(0)
        changed = True
        while changed:
            changed = False
            remaining: list[tuple[int, int, int, int]] = []
            for other in pending:
                if _boxes_touch(current, other):
                    current = (
                        min(current[0], other[0]),
                        min(current[1], other[1]),
                        max(current[2], other[2]),
                        max(current[3], other[3]),
                    )
                    changed = True
                else:
                    remaining.append(other)
            pending = remaining
        merged.append(current)
    return merged


def mask_to_roi_boxes(
    mask: np.ndarray,
    padding_ratio: float,
    min_padding: int,
    max_rois: int,
) -> list[tuple[int, int, int, int]]:
    labels, count = ndimage.label(
        mask,
        structure=np.ones((3, 3), dtype=np.uint8),
    )
    if count == 0:
        return []
    height, width = mask.shape
    components: list[tuple[int, tuple[int, int, int, int]]] = []
    for label_id, region in enumerate(ndimage.find_objects(labels), start=1):
        if region is None:
            continue
        y_slice, x_slice = region
        area = int((labels[region] == label_id).sum())
        raw_box = (
            int(x_slice.start),
            int(y_slice.start),
            int(x_slice.stop),
            int(y_slice.stop),
        )
        components.append(
            (
                area,
                _square_and_clip_box(
                    raw_box,
                    width,
                    height,
                    padding_ratio,
                    min_padding,
                ),
            )
        )
    components.sort(key=lambda value: value[0], reverse=True)
    selected = [box for _, box in components[:max_rois]]
    return _merge_boxes(selected)


def fuse_roi_probability(
    coarse_region: np.ndarray,
    refined_region: np.ndarray,
    fusion_weight: float,
    fusion_mode: str,
) -> np.ndarray:
    if fusion_mode == "replace":
        return refined_region
    if fusion_mode == "blend":
        return np.clip(
            (1.0 - fusion_weight) * coarse_region
            + fusion_weight * refined_region,
            0.0,
            1.0,
        )
    if fusion_mode == "boost":
        boost = np.maximum(refined_region - coarse_region, 0.0)
        return np.clip(
            coarse_region + fusion_weight * boost,
            0.0,
            1.0,
        )
    raise ValueError(f"Unsupported fusion mode: {fusion_mode}")


@torch.inference_mode()
def run_pipeline(
    model: torch.nn.Module,
    original: Image.Image,
    config: PipelineConfig,
    device: torch.device,
    amp_enabled: bool,
    roi_gate_model: torch.nn.Module | None = None,
    roi_gate_input_size: int = 224,
    roi_gate_threshold: float = 0.5,
) -> PipelineResult:
    validate_config(config)
    start = time.perf_counter()
    image = original.convert("RGB")
    coarse = predict_probability(
        model,
        image,
        config.coarse_size,
        device,
        amp_enabled,
    )
    coarse_seed, coarse_grown = connected_hysteresis(
        coarse,
        config.high_threshold,
        config.low_threshold,
        config.bridge_radius,
    )
    seed_ratio = float(coarse_seed.mean())
    if seed_ratio < config.refine_min_seed_ratio:
        baseline_mask = coarse_seed.copy()
        return PipelineResult(
            coarse_probability=coarse,
            refined_probability=coarse.copy(),
            seed_mask=coarse_seed,
            final_mask=baseline_mask,
            alpha=np.where(baseline_mask, coarse, 0.0).astype(np.float32),
            roi_boxes=[],
            roi_gate_probabilities=[],
            refinement_applied=False,
            fallback_reason="seed_ratio_below_refinement_range",
            elapsed_seconds=time.perf_counter() - start,
        )
    if seed_ratio > config.refine_max_seed_ratio:
        baseline_mask = coarse_seed.copy()
        return PipelineResult(
            coarse_probability=coarse,
            refined_probability=coarse.copy(),
            seed_mask=coarse_seed,
            final_mask=baseline_mask,
            alpha=np.where(baseline_mask, coarse, 0.0).astype(np.float32),
            roi_boxes=[],
            roi_gate_probabilities=[],
            refinement_applied=False,
            fallback_reason="seed_ratio_above_refinement_range",
            elapsed_seconds=time.perf_counter() - start,
        )
    boxes = mask_to_roi_boxes(
        coarse_grown,
        config.roi_padding_ratio,
        config.min_roi_padding,
        config.max_rois,
    )
    gate_probabilities: list[float] = []
    if roi_gate_model is not None and boxes:
        accepted_boxes: list[tuple[int, int, int, int]] = []
        accepted_probabilities: list[float] = []
        for box in boxes:
            probability = predict_roi_tattoo_probability(
                roi_gate_model,
                image.crop(box),
                roi_gate_input_size,
                device,
                amp_enabled,
            )
            gate_probabilities.append(probability)
            if probability >= roi_gate_threshold:
                accepted_boxes.append(box)
                accepted_probabilities.append(probability)
        boxes = accepted_boxes
        if not boxes:
            baseline_mask = coarse_seed.copy()
            return PipelineResult(
                coarse_probability=coarse,
                refined_probability=coarse.copy(),
                seed_mask=coarse_seed,
                final_mask=baseline_mask,
                alpha=np.where(baseline_mask, coarse, 0.0).astype(np.float32),
                roi_boxes=[],
                roi_gate_probabilities=gate_probabilities,
                refinement_applied=False,
                fallback_reason="roi_gate_rejected",
                elapsed_seconds=time.perf_counter() - start,
            )
        gate_probabilities = accepted_probabilities

    refined = coarse.copy()
    for left, top, right, bottom in boxes:
        crop = image.crop((left, top, right, bottom))
        crop_probability = predict_probability(
            model,
            crop,
            config.roi_size,
            device,
            amp_enabled,
        )
        coarse_region = refined[top:bottom, left:right]
        refined[top:bottom, left:right] = fuse_roi_probability(
            coarse_region,
            crop_probability,
            config.fusion_weight,
            config.fusion_mode,
        )

    seed, final_mask = connected_hysteresis(
        refined,
        config.high_threshold,
        config.low_threshold,
        config.bridge_radius,
        extra_seed=coarse_seed,
    )
    growth_factor = float(final_mask.mean()) / max(seed_ratio, 1e-9)
    if growth_factor > config.max_growth_factor:
        final_mask = coarse_seed.copy()
        refined = coarse.copy()
        seed = coarse_seed
        boxes = []
        fallback_reason = "growth_factor_guard"
        refinement_applied = False
    else:
        fallback_reason = ""
        refinement_applied = True
    alpha = np.where(final_mask, refined, 0.0).astype(np.float32)
    return PipelineResult(
        coarse_probability=coarse,
        refined_probability=refined,
        seed_mask=seed,
        final_mask=final_mask,
        alpha=alpha,
        roi_boxes=boxes,
        roi_gate_probabilities=gate_probabilities,
        refinement_applied=refinement_applied,
        fallback_reason=fallback_reason,
        elapsed_seconds=time.perf_counter() - start,
    )


def _to_gray(array: np.ndarray) -> Image.Image:
    return Image.fromarray(
        np.clip(np.round(array * 255.0), 0, 255).astype(np.uint8),
        mode="L",
    )


def _binary_image(mask: np.ndarray) -> Image.Image:
    return Image.fromarray(mask.astype(np.uint8) * 255, mode="L")


def _overlay(
    original: Image.Image,
    mask: Image.Image,
    boxes: list[tuple[int, int, int, int]],
) -> Image.Image:
    base = original.convert("RGBA")
    color = Image.new("RGBA", base.size, (255, 0, 0, 0))
    color.putalpha(mask.point(lambda value: 112 if value else 0))
    output = Image.alpha_composite(base, color).convert("RGB")
    draw = ImageDraw.Draw(output)
    for box in boxes:
        draw.rectangle(box, outline=(0, 190, 255), width=3)
    return output


def _fit(image: Image.Image, size: int) -> Image.Image:
    copy = image.convert("RGB")
    copy.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (size, size), "white")
    canvas.paste(copy, ((size - copy.width) // 2, (size - copy.height) // 2))
    return canvas


def _font(size: int) -> ImageFont.ImageFont:
    for path in (
        Path(r"C:\Windows\Fonts\malgun.ttf"),
        Path(r"C:\Windows\Fonts\arial.ttf"),
    ):
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def save_outputs(
    original: Image.Image,
    result: PipelineResult,
    destination: Path,
    config: PipelineConfig,
) -> dict[str, str | float | int]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    coarse_probability_image = _to_gray(result.coarse_probability)
    refined_probability_image = _to_gray(result.refined_probability)
    seed_image = _binary_image(result.seed_mask)
    mask_image = _binary_image(result.final_mask)
    alpha_image = _to_gray(result.alpha)

    paths = {
        "coarse_probability_file": destination.with_name(
            f"{destination.name}_coarse_probability.png"
        ),
        "refined_probability_file": destination.with_name(
            f"{destination.name}_refined_probability.png"
        ),
        "seed_file": destination.with_name(f"{destination.name}_seed.png"),
        "mask_file": destination.with_name(f"{destination.name}_mask.png"),
        "alpha_file": destination.with_name(f"{destination.name}_alpha.png"),
        "transparent_file": destination.with_name(
            f"{destination.name}_transparent.png"
        ),
        "white_file": destination.with_name(f"{destination.name}_white.png"),
        "overlay_file": destination.with_name(f"{destination.name}_overlay.jpg"),
        "debug_file": destination.with_name(f"{destination.name}_debug.jpg"),
        "metadata_file": destination.with_name(
            f"{destination.name}_metadata.json"
        ),
    }
    coarse_probability_image.save(paths["coarse_probability_file"], optimize=True)
    refined_probability_image.save(
        paths["refined_probability_file"], optimize=True
    )
    seed_image.save(paths["seed_file"], optimize=True)
    mask_image.save(paths["mask_file"], optimize=True)
    alpha_image.save(paths["alpha_file"], optimize=True)

    transparent = original.convert("RGBA")
    transparent.putalpha(alpha_image)
    transparent.save(paths["transparent_file"], optimize=True)
    white = Image.new("RGB", original.size, "white")
    white.paste(original.convert("RGB"), (0, 0), alpha_image)
    white.save(paths["white_file"], optimize=True)
    overlay = _overlay(original, mask_image, result.roi_boxes)
    overlay.save(paths["overlay_file"], quality=95, subsampling=0)

    panel_size = 280
    label_height = 44
    panel = Image.new(
        "RGB",
        (panel_size * 5, panel_size + label_height),
        "white",
    )
    panels = (
        ("original", original),
        ("coarse probability", coarse_probability_image),
        ("high-confidence seed", seed_image),
        ("ROI refined probability", refined_probability_image),
        ("final mask + ROI", overlay),
    )
    draw = ImageDraw.Draw(panel)
    font = _font(16)
    for index, (label, image) in enumerate(panels):
        x = index * panel_size
        panel.paste(_fit(image, panel_size), (x, 0))
        draw.text((x + 8, panel_size + 11), label, font=font, fill="black")
    panel.save(paths["debug_file"], quality=96, subsampling=0)

    metadata = {
        "pipeline": "segformer_v4_roi_hysteresis_v5",
        "config": asdict(config),
        "roi_boxes": [list(box) for box in result.roi_boxes],
        "roi_gate_probabilities": result.roi_gate_probabilities,
        "roi_count": len(result.roi_boxes),
        "refinement_applied": result.refinement_applied,
        "fallback_reason": result.fallback_reason,
        "seed_ratio": float(result.seed_mask.mean()),
        "predicted_ratio": float(result.final_mask.mean()),
        "elapsed_seconds": result.elapsed_seconds,
    }
    paths["metadata_file"].write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )
    return {
        **{key: str(value) for key, value in paths.items()},
        "roi_count": len(result.roi_boxes),
        "roi_gate_max_probability": (
            max(result.roi_gate_probabilities)
            if result.roi_gate_probabilities
            else ""
        ),
        "refinement_applied": int(result.refinement_applied),
        "fallback_reason": result.fallback_reason,
        "seed_ratio": float(result.seed_mask.mean()),
        "predicted_ratio": float(result.final_mask.mean()),
        "elapsed_seconds": result.elapsed_seconds,
    }


@torch.inference_mode()
def main() -> int:
    args = parse_args()
    if args.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is unavailable.")
    device = torch.device(args.device)
    amp_enabled = device.type == "cuda"
    checkpoint = torch.load(
        args.model.resolve(),
        map_location="cpu",
        weights_only=False,
    )
    config = PipelineConfig(
        coarse_size=(
            int(args.coarse_size)
            if args.coarse_size is not None
            else int(checkpoint.get("input_size", 512))
        ),
        roi_size=args.roi_size,
        high_threshold=(
            float(args.high_threshold)
            if args.high_threshold is not None
            else float(checkpoint["threshold"])
        ),
        low_threshold=args.low_threshold,
        bridge_radius=args.bridge_radius,
        roi_padding_ratio=args.roi_padding_ratio,
        min_roi_padding=args.min_roi_padding,
        max_rois=args.max_rois,
        fusion_weight=args.fusion_weight,
        fusion_mode=args.fusion_mode,
        refine_min_seed_ratio=args.refine_min_seed_ratio,
        refine_max_seed_ratio=args.refine_max_seed_ratio,
        max_growth_factor=args.max_growth_factor,
    )
    validate_config(config)
    model = build_model(args.pretrained, checkpoint, device)
    roi_gate_model: torch.nn.Module | None = None
    roi_gate_input_size = 224
    roi_gate_threshold = 0.5
    if args.roi_gate_model is not None:
        roi_gate_model, roi_gate_checkpoint = load_roi_gate(
            args.roi_gate_model,
            device,
        )
        roi_gate_input_size = int(
            roi_gate_checkpoint.get("input_size", 224)
        )
        roi_gate_threshold = (
            float(args.roi_gate_threshold)
            if args.roi_gate_threshold is not None
            else float(roi_gate_checkpoint["threshold"])
        )
    images = collect_images(args.input.resolve())
    if not images:
        raise RuntimeError("No supported images found.")

    output_root = args.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str | float | int]] = []
    for index, image_path in enumerate(images, start=1):
        with Image.open(image_path) as opened:
            original = opened.convert("RGB")
        result = run_pipeline(
            model,
            original,
            config,
            device,
            amp_enabled,
            roi_gate_model=roi_gate_model,
            roi_gate_input_size=roi_gate_input_size,
            roi_gate_threshold=roi_gate_threshold,
        )
        output = save_outputs(
            original,
            result,
            output_root / image_path.stem,
            config,
        )
        rows.append({"source_file": str(image_path), **output})
        print(
            f"{index}/{len(images)} {image_path.name} "
            f"rois={output['roi_count']} "
            f"predicted_ratio={output['predicted_ratio']:.4f} "
            f"seconds={output['elapsed_seconds']:.3f}",
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
    (output_root / "pipeline_config.json").write_text(
        json.dumps(
            {
                **asdict(config),
                "roi_gate_model": (
                    str(args.roi_gate_model.resolve())
                    if args.roi_gate_model is not None
                    else None
                ),
                "roi_gate_threshold": (
                    roi_gate_threshold
                    if roi_gate_model is not None
                    else None
                ),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps(asdict(config), indent=2))
    print(f"output={output_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
