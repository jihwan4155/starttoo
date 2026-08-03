from __future__ import annotations

import argparse
import csv
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from transformers import SegformerForSemanticSegmentation


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = (
    PROJECT_ROOT
    / "models"
    / "segmentation"
    / "segformer_tattoo_binary_v1"
    / "best_model.pt"
)
DEFAULT_PRETRAINED = Path(
    r"C:\Users\SSAFY\Desktop\tattoo_ai\models\pretrained\segformer-b0-ade512"
)
IMAGENET_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
IMAGENET_STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract tattoo masks with SegFormer tattoo binary v1."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument(
        "--output-root",
        type=Path,
        default=PROJECT_ROOT / "outputs" / "segformer_tattoo_binary_v1",
    )
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--pretrained", type=Path, default=DEFAULT_PRETRAINED)
    parser.add_argument("--threshold", type=float, default=None)
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    return parser.parse_args()


def collect_images(input_path: Path) -> list[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() not in IMAGE_SUFFIXES:
            raise ValueError(f"Unsupported image: {input_path}")
        return [input_path.resolve()]
    if input_path.is_dir():
        return sorted(
            path.resolve()
            for path in input_path.rglob("*")
            if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
        )
    raise FileNotFoundError(input_path)


def build_model(
    pretrained: Path,
    checkpoint: dict[str, object],
    device: torch.device,
) -> SegformerForSemanticSegmentation:
    model = SegformerForSemanticSegmentation.from_pretrained(
        str(pretrained.resolve()),
        num_labels=2,
        id2label={0: "background", 1: "tattoo"},
        label2id={"background": 0, "tattoo": 1},
        ignore_mismatched_sizes=True,
        local_files_only=True,
    )
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    model.to(device)
    model.eval()
    return model


def prepare(image: Image.Image, input_size: int) -> torch.Tensor:
    resized = image.resize(
        (input_size, input_size), Image.Resampling.BILINEAR
    )
    pixels = (
        torch.from_numpy(
            np.asarray(resized, dtype=np.float32).transpose(2, 0, 1).copy()
        )
        / 255.0
    )
    return ((pixels - IMAGENET_MEAN) / IMAGENET_STD).unsqueeze(0)


def save_outputs(
    original: Image.Image,
    probability: np.ndarray,
    threshold: float,
    destination: Path,
) -> dict[str, str | float]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    probability_image = Image.fromarray(
        np.clip(np.round(probability * 255.0), 0, 255).astype(np.uint8),
        mode="L",
    )
    mask_image = Image.fromarray(
        ((probability >= threshold) * 255).astype(np.uint8),
        mode="L",
    )
    probability_path = destination.with_name(
        f"{destination.name}_probability.png"
    )
    mask_path = destination.with_name(f"{destination.name}_mask.png")
    transparent_path = destination.with_name(
        f"{destination.name}_transparent.png"
    )
    white_path = destination.with_name(f"{destination.name}_white.png")
    overlay_path = destination.with_name(f"{destination.name}_overlay.jpg")

    probability_image.save(probability_path, optimize=True)
    mask_image.save(mask_path, optimize=True)

    transparent = original.convert("RGBA")
    transparent.putalpha(mask_image)
    transparent.save(transparent_path, optimize=True)

    white = Image.new("RGB", original.size, "white")
    white.paste(original, (0, 0), mask_image)
    white.save(white_path, optimize=True)

    overlay = original.convert("RGBA")
    red = Image.new("RGBA", original.size, (255, 0, 0, 0))
    red.putalpha(mask_image.point(lambda value: 112 if value else 0))
    overlay = Image.alpha_composite(overlay, red).convert("RGB")
    overlay.save(overlay_path, quality=95, subsampling=0)

    return {
        "mask_file": str(mask_path),
        "probability_file": str(probability_path),
        "transparent_file": str(transparent_path),
        "white_file": str(white_path),
        "overlay_file": str(overlay_path),
        "predicted_ratio": float(
            (np.asarray(mask_image, dtype=np.uint8) >= 128).mean()
        ),
    }


@torch.inference_mode()
def main() -> int:
    args = parse_args()
    if args.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is unavailable.")
    device = torch.device(args.device)
    amp_enabled = device.type == "cuda"
    checkpoint = torch.load(
        args.model.resolve(), map_location="cpu", weights_only=False
    )
    threshold = (
        float(args.threshold)
        if args.threshold is not None
        else float(checkpoint["threshold"])
    )
    input_size = int(checkpoint.get("input_size", 512))
    model = build_model(args.pretrained, checkpoint, device)
    images = collect_images(args.input.resolve())
    if not images:
        raise RuntimeError("No supported images found.")

    output_root = args.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str | float]] = []
    for index, image_path in enumerate(images, start=1):
        with Image.open(image_path) as opened:
            original = opened.convert("RGB")
        pixels = prepare(original, input_size).to(device)
        with torch.autocast(
            device_type=device.type,
            enabled=amp_enabled,
            dtype=torch.float16,
        ):
            logits = model(pixel_values=pixels).logits
        probability = (
            F.interpolate(
                logits.float(),
                size=(original.height, original.width),
                mode="bilinear",
                align_corners=False,
            )
            .softmax(dim=1)[0, 1]
            .cpu()
            .numpy()
        )
        destination = output_root / image_path.stem
        output = save_outputs(
            original, probability, threshold, destination
        )
        rows.append(
            {
                "source_file": str(image_path),
                "threshold": threshold,
                **output,
            }
        )
        print(
            f"{index}/{len(images)} {image_path.name} "
            f"predicted_ratio={output['predicted_ratio']:.4f}",
            flush=True,
        )

    with (output_root / "inference_manifest.csv").open(
        "w", encoding="utf-8-sig", newline=""
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"threshold={threshold:.2f}")
    print(f"output={output_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
