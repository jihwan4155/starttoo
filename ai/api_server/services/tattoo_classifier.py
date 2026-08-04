from __future__ import annotations

import asyncio
import io
import json
import logging
import math
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import timm
import torch
from PIL import Image, ImageOps
from torch import nn
from torch.nn import functional as F
from torchvision.transforms import InterpolationMode
from torchvision.transforms import functional as TF

from api_server.core.exceptions import (
    ClassificationFailedError,
    ClassifierNotConfiguredError,
    ClassifierNotReadyError,
    InferenceBusyError,
)

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
DEFAULT_INFERENCE_WAIT_TIMEOUT_SECONDS = 120.0
RENDERING_MULTI_LABEL_THRESHOLD = 0.7
MAX_RENDERING_LABELS = 2

HUE_BINS = 12
SATURATION_BINS = 8
VALUE_BINS = 8
LAB_L_BINS = 8
LAB_AB_BINS = 6
COLOR_SUMMARY_COUNT = 14
COLOR_FEATURES_PER_VIEW = (
    HUE_BINS
    + SATURATION_BINS
    + VALUE_BINS
    + LAB_L_BINS
    + 2 * LAB_AB_BINS
    + COLOR_SUMMARY_COUNT
)
COLOR_FEATURE_COUNT = COLOR_FEATURES_PER_VIEW * 2
logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class LabelPrediction:
    label: str
    confidence: float


@dataclass(frozen=True, slots=True)
class ClassificationResult:
    primary: LabelPrediction
    secondary: LabelPrediction
    color: LabelPrediction
    rendering: LabelPrediction
    renderings: list[LabelPrediction]
    subject: LabelPrediction
    processing_seconds: float


def _taxonomy_labels(taxonomy: dict[str, Any]) -> dict[str, Any]:
    children_by_parent = {
        parent: list(children)
        for parent, children in taxonomy["secondary"]["children"].items()
    }
    children = [
        child
        for parent in taxonomy["secondary"]["parent_classes"]
        for child in children_by_parent[parent]
    ]
    return {
        "primary": list(taxonomy["primary"]["classes"]),
        "secondary_parent": list(taxonomy["secondary"]["parent_classes"]),
        "secondary_child": children,
        "children_by_parent": children_by_parent,
        "color": list(taxonomy["color"]["classes"]),
        "rendering": list(taxonomy["rendering"]["classes"]),
    }


def _create_backbone(
    model_name: str,
    encoder_checkpoint: Path,
) -> nn.Module:
    model = timm.create_model(
        model_name,
        pretrained=False,
        num_classes=0,
        global_pool="avg",
    )
    payload = torch.load(
        encoder_checkpoint,
        map_location="cpu",
        weights_only=False,
    )
    state = payload.get("backbone", payload.get("backbone_state_dict"))
    if state is None:
        raise KeyError(f"No backbone state in {encoder_checkpoint}")
    missing, unexpected = model.load_state_dict(state, strict=False)
    if unexpected:
        raise RuntimeError(f"Unexpected backbone keys: {unexpected[:20]}")
    if len(missing) > 4:
        raise RuntimeError(f"Too many missing backbone keys: {missing[:20]}")
    return model


class _PrimaryModel(nn.Module):
    def __init__(
        self,
        labels: list[str],
        model_name: str,
        encoder_checkpoint: Path,
    ) -> None:
        super().__init__()
        self.backbone = _create_backbone(model_name, encoder_checkpoint)
        feature_dim = int(self.backbone.num_features)
        self.head = nn.Sequential(
            nn.LayerNorm(feature_dim),
            nn.Dropout(0.18),
            nn.Linear(feature_dim, len(labels)),
        )

    def forward(
        self,
        on_body: torch.Tensor,
        segmented: torch.Tensor,
    ) -> torch.Tensor:
        batch_size = len(on_body)
        features = self.backbone(torch.cat([on_body, segmented], dim=0))
        return self.head(features[:batch_size])


class _SecondaryModel(nn.Module):
    def __init__(
        self,
        labels: dict[str, Any],
        model_name: str,
        encoder_checkpoint: Path,
    ) -> None:
        super().__init__()
        self.backbone = _create_backbone(model_name, encoder_checkpoint)
        feature_dim = int(self.backbone.num_features)
        self.view_gate = nn.Sequential(
            nn.LayerNorm(feature_dim * 3),
            nn.Linear(feature_dim * 3, feature_dim // 2),
            nn.GELU(),
            nn.Linear(feature_dim // 2, feature_dim),
            nn.Sigmoid(),
        )
        self.shared = nn.Sequential(
            nn.LayerNorm(feature_dim),
            nn.Dropout(0.18),
        )
        self.primary_head = nn.Linear(feature_dim, len(labels["primary"]))
        self.parent_head = nn.Linear(
            feature_dim,
            len(labels["secondary_parent"]),
        )
        self.child_heads = nn.ModuleDict(
            {
                parent: nn.Sequential(
                    nn.LayerNorm(feature_dim),
                    nn.Dropout(0.18),
                    nn.Linear(feature_dim, len(children)),
                )
                for parent, children in labels["children_by_parent"].items()
                if children
            }
        )
        self.style_head = nn.Sequential(
            nn.LayerNorm(feature_dim),
            nn.Dropout(0.18),
            nn.Linear(feature_dim, len(labels["secondary_child"])),
        )

    def forward(
        self,
        on_body: torch.Tensor,
        segmented: torch.Tensor,
    ) -> dict[str, Any]:
        combined = self.backbone(torch.cat([on_body, segmented], dim=0))
        first, second = combined.chunk(2, dim=0)
        gate = self.view_gate(
            torch.cat([first, second, (first - second).abs()], dim=1)
        )
        features = self.shared(gate * first + (1.0 - gate) * second)
        return {
            "children": {
                parent: head(features)
                for parent, head in self.child_heads.items()
            }
        }


class _ColorModel(nn.Module):
    def __init__(
        self,
        labels: list[str],
        model_name: str,
        encoder_checkpoint: Path,
    ) -> None:
        super().__init__()
        self.backbone = _create_backbone(model_name, encoder_checkpoint)
        feature_dim = int(self.backbone.num_features)
        self.view_gate = nn.Sequential(
            nn.LayerNorm(feature_dim * 3),
            nn.Linear(feature_dim * 3, feature_dim // 2),
            nn.GELU(),
            nn.Linear(feature_dim // 2, feature_dim),
            nn.Sigmoid(),
        )
        self.stat_encoder = nn.Sequential(
            nn.LayerNorm(COLOR_FEATURE_COUNT),
            nn.Linear(COLOR_FEATURE_COUNT, 192),
            nn.GELU(),
            nn.Dropout(0.08),
            nn.Linear(192, 192),
            nn.GELU(),
        )
        self.classifier = nn.Sequential(
            nn.LayerNorm(feature_dim + 192),
            nn.Linear(feature_dim + 192, feature_dim // 2),
            nn.GELU(),
            nn.Dropout(0.16),
            nn.Linear(feature_dim // 2, len(labels)),
        )

    def forward(
        self,
        on_body: torch.Tensor,
        segmented: torch.Tensor,
        statistics: torch.Tensor,
    ) -> torch.Tensor:
        combined = self.backbone(torch.cat([on_body, segmented], dim=0))
        first, second = combined.chunk(2, dim=0)
        gate = self.view_gate(
            torch.cat([first, second, (first - second).abs()], dim=1)
        )
        visual = gate * first + (1.0 - gate) * second
        encoded_stats = self.stat_encoder(statistics.float())
        return self.classifier(torch.cat([visual, encoded_stats], dim=1))


class _RenderingModel(nn.Module):
    def __init__(
        self,
        labels: list[str],
        model_name: str,
        encoder_checkpoint: Path,
    ) -> None:
        super().__init__()
        self.backbone = _create_backbone(model_name, encoder_checkpoint)
        feature_dim = int(self.backbone.num_features)
        self.patch_attention = nn.Sequential(
            nn.LayerNorm(feature_dim),
            nn.Linear(feature_dim, feature_dim // 4),
            nn.GELU(),
            nn.Linear(feature_dim // 4, 1),
        )
        self.fusion = nn.Sequential(
            nn.LayerNorm(feature_dim * 3),
            nn.Linear(feature_dim * 3, feature_dim),
            nn.GELU(),
            nn.Dropout(0.18),
            nn.Linear(feature_dim, len(labels)),
        )

    def forward(
        self,
        global_image: torch.Tensor,
        patches: torch.Tensor,
    ) -> torch.Tensor:
        batch_size, patch_count = patches.shape[:2]
        global_features = self.backbone(global_image)
        patch_features = self.backbone(
            patches.flatten(0, 1)
        ).reshape(batch_size, patch_count, -1)
        attention = torch.softmax(
            self.patch_attention(patch_features).squeeze(-1),
            dim=1,
        )
        local_features = torch.sum(
            patch_features * attention.unsqueeze(-1),
            dim=1,
        )
        return self.fusion(
            torch.cat(
                [
                    global_features,
                    local_features,
                    (global_features - local_features).abs(),
                ],
                dim=1,
            )
        )


def _open_rgb(raw: bytes) -> Image.Image:
    with Image.open(io.BytesIO(raw)) as opened:
        return ImageOps.exif_transpose(opened).convert("RGB")


def _open_segmented(raw: bytes) -> tuple[Image.Image, Image.Image]:
    with Image.open(io.BytesIO(raw)) as opened:
        rgba = ImageOps.exif_transpose(opened).convert("RGBA")
    alpha = rgba.getchannel("A")
    if alpha.getextrema() == (255, 255):
        rgb = np.asarray(rgba.convert("RGB"), dtype=np.int16)
        border = np.concatenate(
            [rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]],
            axis=0,
        )
        background = np.median(border, axis=0)
        distance = np.abs(rgb - background).max(axis=2)
        alpha = Image.fromarray(
            np.where(distance > 18, 255, 0).astype(np.uint8),
            mode="L",
        )
    white = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    white.alpha_composite(rgba)
    return white.convert("RGB"), alpha


def _normalize_image(image: Image.Image, size: int) -> torch.Tensor:
    resized = TF.resize(
        image,
        [size, size],
        InterpolationMode.BICUBIC,
    )
    return TF.normalize(TF.to_tensor(resized), IMAGENET_MEAN, IMAGENET_STD)


def _normalized_histogram(
    values: np.ndarray,
    weights: np.ndarray,
    bins: int,
    value_range: tuple[float, float],
) -> np.ndarray:
    histogram, _ = np.histogram(
        values,
        bins=bins,
        range=value_range,
        weights=weights,
    )
    histogram = histogram.astype(np.float32)
    return histogram / max(float(histogram.sum()), 1.0e-6)


def _color_statistics(
    image: Image.Image,
    pigment_mask: Image.Image,
    footprint_mask: Image.Image,
) -> np.ndarray:
    image_array = np.asarray(image.resize((256, 256)), dtype=np.uint8)
    pigment = np.asarray(
        pigment_mask.resize((256, 256)),
        dtype=np.float32,
    ) / 255.0
    footprint = np.asarray(
        footprint_mask.resize((256, 256)),
        dtype=np.float32,
    ) / 255.0
    hsv = cv2.cvtColor(image_array, cv2.COLOR_RGB2HSV).astype(np.float32)
    lab = cv2.cvtColor(image_array, cv2.COLOR_RGB2LAB).astype(np.float32)
    hue = hsv[..., 0] / 179.0
    saturation = hsv[..., 1] / 255.0
    value = hsv[..., 2] / 255.0
    l_channel = lab[..., 0] / 255.0
    a_channel = lab[..., 1] / 255.0
    b_channel = lab[..., 2] / 255.0
    weights = np.clip(
        pigment + 0.45 * footprint * np.clip(saturation * 2.2, 0.0, 1.0),
        0.0,
        1.0,
    )
    if float(weights.sum()) < 16.0:
        weights = np.clip(footprint, 0.0, 1.0)
    if float(weights.sum()) < 16.0:
        weights = np.ones_like(weights)
    hue_weights = weights * np.clip(saturation * 1.5, 0.0, 1.0)
    histograms = [
        _normalized_histogram(hue, hue_weights, HUE_BINS, (0.0, 1.0)),
        _normalized_histogram(
            saturation,
            weights,
            SATURATION_BINS,
            (0.0, 1.0),
        ),
        _normalized_histogram(value, weights, VALUE_BINS, (0.0, 1.0)),
        _normalized_histogram(l_channel, weights, LAB_L_BINS, (0.0, 1.0)),
        _normalized_histogram(a_channel, weights, LAB_AB_BINS, (0.0, 1.0)),
        _normalized_histogram(b_channel, weights, LAB_AB_BINS, (0.0, 1.0)),
    ]
    denominator = max(float(weights.sum()), 1.0e-6)

    def ratio(condition: np.ndarray) -> float:
        return float(
            (weights * condition.astype(np.float32)).sum() / denominator
        )

    chromatic_hue_hist = histograms[0]
    nonzero_hue = chromatic_hue_hist[chromatic_hue_hist > 1.0e-8]
    hue_entropy = float(
        -(nonzero_hue * np.log(nonzero_hue)).sum()
        / max(math.log(HUE_BINS), 1.0)
    )
    mean_saturation = float((weights * saturation).sum() / denominator)
    summary = np.array(
        [
            float(pigment.mean()),
            float(footprint.mean()),
            ratio(saturation > 0.16),
            ratio(saturation > 0.32),
            ratio(saturation > 0.52),
            ratio(value < 0.22),
            ratio((saturation < 0.14) & (value >= 0.22) & (value < 0.78)),
            ratio(value >= 0.78),
            ratio((saturation > 0.20) & (value >= 0.30)),
            hue_entropy,
            mean_saturation,
            float((weights * value).sum() / denominator),
            float((weights * l_channel).sum() / denominator),
            float(
                np.sqrt(
                    (
                        weights
                        * (saturation - mean_saturation) ** 2
                    ).sum()
                    / denominator
                )
            ),
        ],
        dtype=np.float32,
    )
    result = np.concatenate([*histograms, summary]).astype(np.float32)
    if result.shape != (COLOR_FEATURES_PER_VIEW,):
        raise RuntimeError(f"Unexpected color feature shape: {result.shape}")
    return result


def _rendering_patches(
    image: Image.Image,
    footprint: Image.Image,
    crop_size: int,
    patch_count: int,
) -> list[Image.Image]:
    image = image.resize((512, 512), Image.Resampling.BICUBIC)
    footprint_array = np.asarray(
        footprint.resize((512, 512), Image.Resampling.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    gray = np.asarray(image.convert("L"), dtype=np.float32) / 255.0
    gradient_x = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
    gradient_y = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
    edge = np.clip(gradient_x + gradient_y, 0.0, 1.0)
    half = crop_size // 2
    centers = [
        (x, y)
        for y in (half, 192, 256, 320, 512 - half)
        for x in (half, 192, 256, 320, 512 - half)
        if half <= x <= 512 - half and half <= y <= 512 - half
    ]
    scored: list[tuple[float, int, int]] = []
    for x, y in centers:
        left, top = x - half, y - half
        mask_patch = footprint_array[top : top + crop_size, left : left + crop_size]
        edge_patch = edge[top : top + crop_size, left : left + crop_size]
        mask_ratio = float(mask_patch.mean())
        edge_score = float(
            (edge_patch * (0.35 + 0.65 * mask_patch)).mean()
        )
        center_bonus = 0.02 * (
            1.0 - math.hypot(x - 256, y - 256) / math.hypot(256, 256)
        )
        scored.append((edge_score * 3.0 + mask_ratio + center_bonus, x, y))
    scored.sort(reverse=True)
    selected: list[tuple[int, int]] = []
    for _, x, y in scored:
        if all(
            math.hypot(x - px, y - py) >= crop_size * 0.42
            for px, py in selected
        ):
            selected.append((x, y))
        if len(selected) == patch_count:
            break
    while len(selected) < patch_count:
        selected.append((256, 256))
    return [
        image.crop((x - half, y - half, x + half, y + half))
        for x, y in selected
    ]


class TattooClassifierService:
    model_name = "convnextv2-specialist-system-0729-v3"
    subject_model_name = "google/siglip2-so400m-patch16-384"

    def __init__(
        self,
        classifier_root: Path,
        inference_gate: asyncio.Semaphore | None = None,
        inference_wait_timeout: float = DEFAULT_INFERENCE_WAIT_TIMEOUT_SECONDS,
    ) -> None:
        self.classifier_root = classifier_root.resolve()
        self.inference_wait_timeout = inference_wait_timeout
        self.checkpoint_root = self.classifier_root / "checkpoints"
        self.siglip_root = (
            self.classifier_root / "siglip2-so400m-patch16-384"
        )
        self.taxonomy_path = self.classifier_root / "taxonomy.json"
        self.subject_taxonomy_path = (
            self.classifier_root / "subject_taxonomy.json"
        )
        self._status = "not_loaded" if self.configured else "not_configured"
        self._message = (
            "분류 모델이 아직 로드되지 않았습니다. "
            "공개 SigLIP2 모델이 없으면 최초 요청에서 자동 다운로드합니다."
            if self.configured
            else self._missing_assets_message()
        )
        self._device: str | None = None
        self._torch_device: torch.device | None = None
        self._labels: dict[str, Any] | None = None
        self._subject_labels: list[str] = []
        self._subject_labels_ko: list[str] = []
        self._subject_template_count = 0
        self._primary_payload: dict[str, Any] | None = None
        self._secondary_payload: dict[str, Any] | None = None
        self._color_payload: dict[str, Any] | None = None
        self._rendering_payload: dict[str, Any] | None = None
        self._primary_model: nn.Module | None = None
        self._secondary_model: nn.Module | None = None
        self._color_model: nn.Module | None = None
        self._rendering_model: nn.Module | None = None
        self._subject_processor: Any = None
        self._subject_model: Any = None
        self._subject_text_features: torch.Tensor | None = None
        self._load_lock = threading.Lock()
        self._inference_gate = inference_gate or asyncio.Semaphore(1)

    @property
    def configured(self) -> bool:
        required = [
            self.taxonomy_path,
            self.subject_taxonomy_path,
            self.checkpoint_root / "encoder.pt",
            self.checkpoint_root / "primary.pt",
            self.checkpoint_root / "secondary.pt",
            self.checkpoint_root / "color.pt",
            self.checkpoint_root / "rendering.pt",
        ]
        return all(path.is_file() for path in required)

    @property
    def subject_model_available(self) -> bool:
        required = (
            self.siglip_root / "config.json",
            self.siglip_root / "model.safetensors",
            self.siglip_root / "preprocessor_config.json",
            self.siglip_root / "tokenizer.json",
            self.siglip_root / "tokenizer.model",
            self.siglip_root / "tokenizer_config.json",
        )
        return all(path.is_file() for path in required)

    def _download_subject_model(self) -> None:
        if self.subject_model_available:
            return

        from huggingface_hub import snapshot_download

        self.siglip_root.parent.mkdir(parents=True, exist_ok=True)
        logger.info(
            "Downloading public subject model: %s", self.subject_model_name
        )
        snapshot_download(
            repo_id=self.subject_model_name,
            local_dir=self.siglip_root,
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
        if not self.subject_model_available:
            raise FileNotFoundError(
                "SigLIP2 다운로드가 완료되지 않았습니다. "
                "네트워크 연결과 Hugging Face 접근 권한을 확인해주세요."
            )

    @property
    def status(self) -> str:
        return self._status

    @property
    def message(self) -> str:
        return self._message

    @property
    def device(self) -> str | None:
        return self._device

    @property
    def is_busy(self) -> bool:
        return self._inference_gate.locked()

    def _missing_assets_message(self) -> str:
        return (
            "분류 모델 파일이 누락되었습니다: "
            f"{self.classifier_root}"
        )

    def ensure_configured(self) -> None:
        if not self.configured:
            self._status = "not_configured"
            self._message = self._missing_assets_message()
            raise ClassifierNotConfiguredError(self._message)

    def ensure_ready(self) -> None:
        self.ensure_configured()
        if self._status != "ready":
            raise ClassifierNotReadyError(self._message)

    async def _acquire_inference_gate(self) -> None:
        try:
            await asyncio.wait_for(
                self._inference_gate.acquire(),
                timeout=self.inference_wait_timeout,
            )
        except TimeoutError as exc:
            raise InferenceBusyError(
                "AI 서버가 다른 이미지 작업을 처리 중입니다. 잠시 후 다시 요청해주세요."
            ) from exc

    async def load(self) -> None:
        await self._acquire_inference_gate()
        try:
            await asyncio.to_thread(self._load_sync)
        finally:
            self._inference_gate.release()

    def _load_sync(self) -> None:
        with self._load_lock:
            if self._status in {"loading", "ready"}:
                return
            self.ensure_configured()
            self._status = "loading"
            self._message = (
                "ConvNeXtV2와 SigLIP2 분류 모델을 준비하고 있습니다. "
                "공개 SigLIP2 모델이 없으면 자동 다운로드합니다."
            )
            try:
                from transformers import AutoModel, AutoProcessor

                self._download_subject_model()

                device = torch.device(
                    "cuda" if torch.cuda.is_available() else "cpu"
                )
                encoder_path = self.checkpoint_root / "encoder.pt"
                taxonomy = json.loads(
                    self.taxonomy_path.read_text(encoding="utf-8")
                )
                labels = _taxonomy_labels(taxonomy)
                subject_taxonomy = json.loads(
                    self.subject_taxonomy_path.read_text(encoding="utf-8")
                )
                subject_values = subject_taxonomy["attributes"]["subject"][
                    "values"
                ]
                subject_labels = [item["id"] for item in subject_values]
                subject_labels_ko = [
                    item.get("label_ko")
                    or item.get("label_en")
                    or item["id"]
                    for item in subject_values
                ]
                subject_templates = (
                    "This is a photo of {}.",
                    "a tattoo design depicting {}",
                )
                subject_prompts = [
                    template.format(item["label_en"].lower())
                    for template in subject_templates
                    for item in subject_values
                ]

                primary_payload = torch.load(
                    self.checkpoint_root / "primary.pt",
                    map_location="cpu",
                    weights_only=False,
                )
                primary_model = _PrimaryModel(
                    primary_payload["labels"],
                    primary_payload["model_name"],
                    encoder_path,
                )
                primary_model.load_state_dict(primary_payload.pop("model"))

                secondary_payload = torch.load(
                    self.checkpoint_root / "secondary.pt",
                    map_location="cpu",
                    weights_only=False,
                )
                secondary_model = _SecondaryModel(
                    labels,
                    secondary_payload["model_name"],
                    encoder_path,
                )
                secondary_model.load_state_dict(secondary_payload.pop("model"))

                color_payload = torch.load(
                    self.checkpoint_root / "color.pt",
                    map_location="cpu",
                    weights_only=False,
                )
                color_model = _ColorModel(
                    color_payload["labels"],
                    color_payload["model_name"],
                    encoder_path,
                )
                color_model.load_state_dict(color_payload.pop("model"))

                rendering_payload = torch.load(
                    self.checkpoint_root / "rendering.pt",
                    map_location="cpu",
                    weights_only=False,
                )
                rendering_model = _RenderingModel(
                    rendering_payload["labels"],
                    rendering_payload["model_name"],
                    encoder_path,
                )
                rendering_model.load_state_dict(rendering_payload.pop("model"))

                specialist_models = (
                    primary_model,
                    secondary_model,
                    color_model,
                    rendering_model,
                )
                for model in specialist_models:
                    model.eval().to(device)

                subject_dtype = (
                    torch.float16 if device.type == "cuda" else torch.float32
                )
                subject_processor = AutoProcessor.from_pretrained(
                    self.siglip_root,
                    local_files_only=True,
                )
                subject_model = AutoModel.from_pretrained(
                    self.siglip_root,
                    local_files_only=True,
                    dtype=subject_dtype,
                ).eval().to(device)
                text_inputs = subject_processor(
                    text=subject_prompts,
                    padding="max_length",
                    return_tensors="pt",
                )
                text_inputs = {
                    key: value.to(device)
                    for key, value in text_inputs.items()
                }
                with torch.inference_mode():
                    text_outputs = subject_model.get_text_features(
                        **text_inputs
                    )
                    text_features = text_outputs.pooler_output
                    text_features = F.normalize(text_features.float(), dim=-1)

                self._torch_device = device
                self._labels = labels
                self._subject_labels = subject_labels
                self._subject_labels_ko = subject_labels_ko
                self._subject_template_count = len(subject_templates)
                self._primary_payload = primary_payload
                self._secondary_payload = secondary_payload
                self._color_payload = color_payload
                self._rendering_payload = rendering_payload
                self._primary_model = primary_model
                self._secondary_model = secondary_model
                self._color_model = color_model
                self._rendering_model = rendering_model
                self._subject_processor = subject_processor
                self._subject_model = subject_model
                self._subject_text_features = text_features
                self._device = (
                    f"cuda · {torch.cuda.get_device_name(0)}"
                    if device.type == "cuda"
                    else "cpu"
                )
                self._status = "ready"
                self._message = (
                    "ConvNeXtV2 4축 분류와 SigLIP2 subject 모델이 준비되었습니다."
                )
            except Exception as exc:
                logger.exception("Tattoo classifier loading failed")
                self._status = "error"
                self._message = f"분류 모델 로딩 실패: {exc}"
                self._clear_models()

    def _clear_models(self) -> None:
        self._primary_model = None
        self._secondary_model = None
        self._color_model = None
        self._rendering_model = None
        self._subject_model = None
        self._subject_processor = None
        self._subject_text_features = None

    async def classify(
        self,
        raw: bytes,
        segmented_png: bytes,
    ) -> ClassificationResult:
        await self._acquire_inference_gate()
        try:
            if self._status != "ready":
                await asyncio.to_thread(self._load_sync)
            self.ensure_ready()
            return await asyncio.to_thread(
                self._classify_sync,
                raw,
                segmented_png,
            )
        finally:
            self._inference_gate.release()

    def _classify_sync(
        self,
        raw: bytes,
        segmented_png: bytes,
    ) -> ClassificationResult:
        self.ensure_ready()
        if any(
            item is None
            for item in (
                self._torch_device,
                self._labels,
                self._primary_payload,
                self._secondary_payload,
                self._color_payload,
                self._rendering_payload,
                self._primary_model,
                self._secondary_model,
                self._color_model,
                self._rendering_model,
                self._subject_model,
                self._subject_processor,
                self._subject_text_features,
            )
        ) or not (
            self._subject_labels
            and len(self._subject_labels) == len(self._subject_labels_ko)
        ):
            raise ClassifierNotReadyError(
                "분류 모델 내부 상태가 준비되지 않았습니다."
            )

        started = time.perf_counter()
        try:
            device = self._torch_device
            labels = self._labels
            primary_payload = self._primary_payload
            secondary_payload = self._secondary_payload
            color_payload = self._color_payload
            rendering_payload = self._rendering_payload
            on_body = _open_rgb(raw)
            segmented, alpha = _open_segmented(segmented_png)

            primary_size = int(primary_payload["image_size"])
            primary_on_body = _normalize_image(
                on_body,
                primary_size,
            ).unsqueeze(0).to(device)
            primary_segmented = _normalize_image(
                segmented,
                primary_size,
            ).unsqueeze(0).to(device)

            secondary_size = int(secondary_payload["image_size"])
            secondary_on_body = _normalize_image(
                on_body,
                secondary_size,
            ).unsqueeze(0).to(device)
            secondary_segmented = _normalize_image(
                segmented,
                secondary_size,
            ).unsqueeze(0).to(device)

            color_size = int(color_payload["image_size"])
            color_on_body = _normalize_image(
                on_body,
                color_size,
            ).unsqueeze(0).to(device)
            color_segmented = _normalize_image(
                segmented,
                color_size,
            ).unsqueeze(0).to(device)
            statistics = np.concatenate(
                [
                    _color_statistics(on_body, alpha, alpha),
                    _color_statistics(segmented, alpha, alpha),
                ]
            )
            color_statistics_tensor = torch.from_numpy(statistics).unsqueeze(0).to(
                device
            )

            global_size = int(rendering_payload["global_size"])
            patch_size = int(rendering_payload["patch_size"])
            patch_count = int(rendering_payload["patch_count"])
            crop_size = min(288, max(patch_size, 224))
            patches = _rendering_patches(
                segmented,
                alpha,
                crop_size,
                patch_count,
            )
            global_image = _normalize_image(
                segmented,
                global_size,
            ).unsqueeze(0).to(device)
            patch_tensor = torch.stack(
                [_normalize_image(patch, patch_size) for patch in patches]
            ).unsqueeze(0).to(device)

            autocast_enabled = device.type == "cuda"
            with torch.inference_mode(), torch.autocast(
                device_type=device.type,
                dtype=torch.float16,
                enabled=autocast_enabled,
            ):
                primary_logits = self._primary_model(
                    primary_on_body,
                    primary_segmented,
                )
                secondary_output = self._secondary_model(
                    secondary_on_body,
                    secondary_segmented,
                )
                color_logits = self._color_model(
                    color_on_body,
                    color_segmented,
                    color_statistics_tensor,
                )
                rendering_logits = self._rendering_model(
                    global_image,
                    patch_tensor,
                )

            primary_probability = F.softmax(primary_logits.float(), dim=1)[0]
            primary_index = int(primary_probability.argmax())
            primary_label = primary_payload["labels"][primary_index]
            primary_result = LabelPrediction(
                primary_label,
                float(primary_probability[primary_index]),
            )

            children = labels["children_by_parent"][primary_label]
            if children:
                child_logits = secondary_output["children"][primary_label]
                child_probability = F.softmax(child_logits.float(), dim=1)[0]
                child_index = int(child_probability.argmax())
                secondary_result = LabelPrediction(
                    children[child_index],
                    float(child_probability[child_index]),
                )
            else:
                secondary_result = LabelPrediction("none", 1.0)

            color_probability = F.softmax(color_logits.float(), dim=1)[0]
            color_index = int(color_probability.argmax())
            color_result = LabelPrediction(
                color_payload["labels"][color_index],
                float(color_probability[color_index]),
            )

            rendering_probability = torch.sigmoid(rendering_logits.float())[0]
            rendering_indices = torch.argsort(
                rendering_probability,
                descending=True,
            ).tolist()
            selected_rendering_indices = [
                int(index)
                for index in rendering_indices
                if float(rendering_probability[index]) >= RENDERING_MULTI_LABEL_THRESHOLD
            ][:MAX_RENDERING_LABELS]
            if not selected_rendering_indices:
                selected_rendering_indices = [int(rendering_indices[0])]
            rendering_index = selected_rendering_indices[0]
            rendering_result = LabelPrediction(
                rendering_payload["labels"][rendering_index],
                float(rendering_probability[rendering_index]),
            )
            rendering_results = [
                LabelPrediction(
                    rendering_payload["labels"][index],
                    float(rendering_probability[index]),
                )
                for index in selected_rendering_indices
            ]

            subject_inputs = self._subject_processor(
                images=[on_body, segmented],
                return_tensors="pt",
            )
            subject_dtype = next(self._subject_model.parameters()).dtype
            subject_inputs = {
                key: (
                    value.to(device=device, dtype=subject_dtype)
                    if value.is_floating_point()
                    else value.to(device)
                )
                for key, value in subject_inputs.items()
            }
            with torch.inference_mode():
                image_outputs = self._subject_model.get_image_features(
                    **subject_inputs
                )
                image_features = image_outputs.pooler_output
                image_features = F.normalize(image_features.float(), dim=-1)
                subject_logits = image_features @ self._subject_text_features.T
                logit_scale = getattr(self._subject_model, "logit_scale", None)
                logit_bias = getattr(self._subject_model, "logit_bias", None)
                if logit_scale is not None:
                    subject_logits = subject_logits * logit_scale.exp().float()
                if logit_bias is not None:
                    subject_logits = subject_logits + logit_bias.float()
                subject_probability = torch.sigmoid(subject_logits).reshape(
                    len(subject_inputs["pixel_values"]),
                    self._subject_template_count,
                    len(self._subject_labels),
                ).amax(dim=(0, 1))
            subject_index = int(subject_probability.argmax())
            subject_result = LabelPrediction(
                label=self._subject_labels_ko[subject_index],
                confidence=float(subject_probability[subject_index]),
            )

            return ClassificationResult(
                primary=primary_result,
                secondary=secondary_result,
                color=color_result,
                rendering=rendering_result,
                renderings=rendering_results,
                subject=subject_result,
                processing_seconds=time.perf_counter() - started,
            )
        except (ClassifierNotConfiguredError, ClassifierNotReadyError):
            raise
        except Exception as exc:
            raise ClassificationFailedError(
                f"타투 속성 분류 중 오류가 발생했습니다: {exc}"
            ) from exc
        finally:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
