from __future__ import annotations

from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torchvision.models import convnext_tiny


IMAGENET_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
IMAGENET_STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)


def build_roi_gate(
    num_classes: int = 2,
) -> torch.nn.Module:
    model = convnext_tiny(weights=None)
    input_features = model.classifier[2].in_features
    model.classifier[2] = torch.nn.Linear(input_features, num_classes)
    return model


def load_roi_gate(
    checkpoint_path: Path,
    device: torch.device,
) -> tuple[torch.nn.Module, dict[str, object]]:
    checkpoint = torch.load(
        checkpoint_path.resolve(),
        map_location="cpu",
        weights_only=False,
    )
    model = build_roi_gate(num_classes=2)
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    model.to(device)
    model.eval()
    return model, checkpoint


def prepare_roi(
    image: Image.Image,
    input_size: int,
) -> torch.Tensor:
    resized = image.convert("RGB").resize(
        (input_size, input_size),
        Image.Resampling.BILINEAR,
    )
    array = np.asarray(resized, dtype=np.float32).transpose(2, 0, 1).copy()
    pixels = torch.from_numpy(array) / 255.0
    return ((pixels - IMAGENET_MEAN) / IMAGENET_STD).unsqueeze(0)


@torch.inference_mode()
def predict_roi_tattoo_probability(
    model: torch.nn.Module,
    image: Image.Image,
    input_size: int,
    device: torch.device,
    amp_enabled: bool,
) -> float:
    pixels = prepare_roi(image, input_size).to(device)
    with torch.autocast(
        device_type=device.type,
        enabled=amp_enabled,
        dtype=torch.float16,
    ):
        logits = model(pixels)
    return float(logits.float().softmax(dim=1)[0, 1].item())
