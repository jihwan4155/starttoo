from __future__ import annotations

import argparse
import csv
from pathlib import Path

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


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = (
    PROJECT_ROOT / "models" / "segmentation"
    / "segformer_tattoo_binary_v7_balanced"
    / "best_model_calibrated_t080.pt"
)
DEFAULT_OUTPUT = (
    PROJECT_ROOT / "outputs"
    / "segformer_tattoo_binary_v8_adaptive_faint_red"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extract tattoo masks with v7 and a conservative adaptive "
            "faint-red connected-threshold branch."
        )
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--pretrained", type=Path, default=DEFAULT_PRETRAINED)
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    return parser.parse_args()


def adaptive_mask(
    original: Image.Image,
    probability: np.ndarray,
) -> tuple[np.ndarray, dict[str, float | bool | str]]:
    high_threshold = 0.80
    low_threshold = 0.10
    seed = probability >= high_threshold
    rgb = np.asarray(original.convert("RGB"), dtype=np.float32) / 255.0
    redness = rgb[..., 0] - np.maximum(rgb[..., 1], rgb[..., 2])
    seed_ratio = float(seed.mean())
    seed_red_median = (
        float(np.median(redness[seed])) if seed.any() else -1.0
    )
    global_rgb_std_max = float(
        rgb.reshape(-1, 3).std(axis=0).max()
    )
    triggered = (
        0.005 <= seed_ratio <= 0.08
        and seed_red_median >= 0.25
        and global_rgb_std_max <= 0.12
    )
    fallback_reason = ""
    growth_factor = 1.0
    if triggered:
        _, grown = connected_hysteresis(
            probability,
            high_threshold,
            low_threshold,
            bridge_radius=1,
        )
        growth_factor = float(grown.sum()) / max(1, int(seed.sum()))
        if growth_factor <= 4.5:
            final_mask = grown
        else:
            final_mask = seed
            triggered = False
            fallback_reason = "growth_factor_guard"
    else:
        final_mask = seed
        fallback_reason = "adaptive_conditions_not_met"
    return final_mask, {
        "adaptive_triggered": triggered,
        "seed_ratio": seed_ratio,
        "seed_red_median": seed_red_median,
        "global_rgb_std_max": global_rgb_std_max,
        "growth_factor": growth_factor,
        "high_threshold": high_threshold,
        "low_threshold": low_threshold,
        "fallback_reason": fallback_reason,
    }


def save_outputs(
    original: Image.Image,
    probability: np.ndarray,
    mask: np.ndarray,
    destination: Path,
) -> dict[str, str | float]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    probability_u8 = np.clip(
        np.round(probability * 255.0), 0, 255
    ).astype(np.uint8)
    mask_u8 = (mask.astype(np.uint8) * 255)
    alpha_u8 = np.where(mask, probability_u8, 0).astype(np.uint8)
    probability_image = Image.fromarray(probability_u8, mode="L")
    mask_image = Image.fromarray(mask_u8, mode="L")
    alpha_image = Image.fromarray(alpha_u8, mode="L")
    probability_path = destination.with_name(
        f"{destination.name}_probability.png"
    )
    mask_path = destination.with_name(f"{destination.name}_mask.png")
    alpha_path = destination.with_name(f"{destination.name}_alpha.png")
    transparent_path = destination.with_name(
        f"{destination.name}_transparent.png"
    )
    white_path = destination.with_name(f"{destination.name}_white.png")
    overlay_path = destination.with_name(f"{destination.name}_overlay.jpg")
    probability_image.save(probability_path, optimize=True)
    mask_image.save(mask_path, optimize=True)
    alpha_image.save(alpha_path, optimize=True)
    transparent = original.convert("RGBA")
    transparent.putalpha(alpha_image)
    transparent.save(transparent_path, optimize=True)
    white = Image.new("RGB", original.size, "white")
    white.paste(original, (0, 0), alpha_image)
    white.save(white_path, optimize=True)
    overlay = original.convert("RGBA")
    red = Image.new("RGBA", original.size, (255, 0, 0, 0))
    red.putalpha(mask_image.point(lambda value: 112 if value else 0))
    overlay = Image.alpha_composite(overlay, red).convert("RGB")
    overlay.save(overlay_path, quality=95, subsampling=0)
    return {
        "mask_file": str(mask_path),
        "alpha_file": str(alpha_path),
        "probability_file": str(probability_path),
        "transparent_file": str(transparent_path),
        "white_file": str(white_path),
        "overlay_file": str(overlay_path),
        "predicted_ratio": float(mask.mean()),
    }


@torch.inference_mode()
def main() -> int:
    args = parse_args()
    if args.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is unavailable.")
    device = torch.device(args.device)
    checkpoint = torch.load(
        args.model.resolve(), map_location="cpu", weights_only=False
    )
    input_size = int(checkpoint.get("input_size", 512))
    model = build_model(args.pretrained, checkpoint, device)
    images = collect_images(args.input.resolve())
    if not images:
        raise RuntimeError("No supported images found.")
    output_root = args.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str | float | bool]] = []
    for index, image_path in enumerate(images, start=1):
        with Image.open(image_path) as opened:
            original = opened.convert("RGB")
        probability = predict_probability(
            model,
            original,
            input_size,
            device,
            amp_enabled=device.type == "cuda",
        )
        mask, diagnostics = adaptive_mask(original, probability)
        output = save_outputs(
            original, probability, mask, output_root / image_path.stem
        )
        rows.append(
            {
                "source_file": str(image_path),
                **diagnostics,
                **output,
            }
        )
        print(
            f"{index}/{len(images)} {image_path.name} "
            f"ratio={output['predicted_ratio']:.4f} "
            f"adaptive={diagnostics['adaptive_triggered']}",
            flush=True,
        )
    with (output_root / "inference_manifest.csv").open(
        "w", encoding="utf-8-sig", newline=""
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"output={output_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
