from __future__ import annotations

from typing import Any

import cv2
import numpy as np
from PIL import Image


def _smoothstep(value: float, low: float, high: float) -> float:
    scaled = float(np.clip((value - low) / max(high - low, 1e-6), 0.0, 1.0))
    return scaled * scaled * (3.0 - 2.0 * scaled)


def _luminance(rgb: np.ndarray) -> np.ndarray:
    pixels = rgb.astype(np.float32)
    return (
        0.299 * pixels[..., 0]
        + 0.587 * pixels[..., 1]
        + 0.114 * pixels[..., 2]
    )


def likely_skin(rgb: np.ndarray) -> np.ndarray:
    """Return a deliberately broad skin/body-colour candidate mask."""
    pixels = rgb.astype(np.float32)
    red = pixels[..., 0]
    green = pixels[..., 1]
    blue = pixels[..., 2]
    maximum = np.maximum(np.maximum(red, green), blue)
    minimum = np.minimum(np.minimum(red, green), blue)
    saturation = (maximum - minimum) / np.maximum(maximum, 1.0)
    luminance = _luminance(rgb)
    cb = 128.0 - 0.168736 * red - 0.331264 * green + 0.5 * blue
    cr = 128.0 + 0.5 * red - 0.418688 * green - 0.081312 * blue
    return np.logical_and.reduce(
        (
            cr >= 108.0,
            cr <= 205.0,
            cb >= 54.0,
            cb <= 164.0,
            luminance >= 10.0,
            saturation <= 0.90,
            red >= blue * 0.62,
        )
    )


def _measurement_region(rgb: np.ndarray) -> tuple[np.ndarray, str]:
    skin = likely_skin(rgb)
    minimum_pixels = max(256, int(skin.size * 0.012))
    if int(skin.sum()) >= minimum_pixels:
        return skin, "skin"

    height, width = skin.shape
    yy, xx = np.ogrid[:height, :width]
    central = (
        ((xx - width * 0.5) / max(width * 0.48, 1.0)) ** 2
        + ((yy - height * 0.5) / max(height * 0.48, 1.0)) ** 2
        <= 1.0
    )
    luminance = _luminance(rgb)
    fallback = central & (luminance >= 9.0)
    if int(fallback.sum()) >= minimum_pixels:
        return fallback, "central_nonblack"
    return luminance >= 9.0, "nonblack"


def analyze_exposure(original: Image.Image) -> dict[str, Any]:
    """Measure body/skin exposure without being fooled by black backgrounds."""
    rgb = np.asarray(original.convert("RGB"), dtype=np.uint8)
    luminance = _luminance(rgb)
    region, source = _measurement_region(rgb)
    values = luminance[region]
    if values.size == 0:
        values = luminance.reshape(-1)

    p10, p25, median, p75, p90 = [
        float(value) for value in np.percentile(values, (10, 25, 50, 75, 90))
    ]
    shadow_fraction = float(np.mean(values < 62.0))
    deep_shadow_fraction = float(np.mean(values < 36.0))
    median_dark = 1.0 - _smoothstep(median, 72.0, 142.0)
    lower_dark = 1.0 - _smoothstep(p25, 42.0, 102.0)
    shadow_score = _smoothstep(shadow_fraction, 0.12, 0.62)
    deep_shadow_score = _smoothstep(deep_shadow_fraction, 0.03, 0.32)
    dark_score = float(
        np.clip(
            0.46 * median_dark
            + 0.24 * lower_dark
            + 0.20 * shadow_score
            + 0.10 * deep_shadow_score,
            0.0,
            1.0,
        )
    )
    enabled = bool(
        dark_score >= 0.20
        and (median < 137.0 or p25 < 92.0 or shadow_fraction > 0.28)
    )
    gamma = float(np.clip(0.84 - 0.25 * dark_score, 0.58, 0.84))
    return {
        "enabled": enabled,
        "dark_score": dark_score,
        "measurement_source": source,
        "measurement_ratio": float(region.mean()),
        "luminance_p10": p10,
        "luminance_p25": p25,
        "luminance_median": median,
        "luminance_p75": p75,
        "luminance_p90": p90,
        "shadow_fraction": shadow_fraction,
        "deep_shadow_fraction": deep_shadow_fraction,
        "gamma": gamma,
    }


def _lift_saturation(rgb: np.ndarray, factor: float) -> np.ndarray:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hsv[..., 1] = np.clip(
        hsv[..., 1].astype(np.float32) * factor, 0.0, 255.0
    ).astype(np.uint8)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)


def _gamma_view(rgb: np.ndarray, gamma: float) -> np.ndarray:
    table = np.clip(
        np.round((np.arange(256, dtype=np.float32) / 255.0) ** gamma * 255.0),
        0,
        255,
    ).astype(np.uint8)
    return cv2.LUT(rgb, table)


def _clahe_view(rgb: np.ndarray, dark_score: float) -> np.ndarray:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    lightness, channel_a, channel_b = cv2.split(lab)
    clip_limit = float(1.55 + 0.75 * dark_score)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    equalized = clahe.apply(lightness)
    blend = float(0.58 + 0.16 * dark_score)
    corrected = np.clip(
        lightness.astype(np.float32) * (1.0 - blend)
        + equalized.astype(np.float32) * blend,
        0.0,
        255.0,
    ).astype(np.uint8)
    result = cv2.cvtColor(
        cv2.merge((corrected, channel_a, channel_b)),
        cv2.COLOR_LAB2RGB,
    )
    return _lift_saturation(result, 1.04 + 0.08 * dark_score)


def _retinex_view(
    rgb: np.ndarray, gamma_rgb: np.ndarray, dark_score: float
) -> np.ndarray:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    lightness = lab[..., 0].astype(np.float32)
    height, width = lightness.shape
    sigma = float(np.clip(min(height, width) * 0.075, 18.0, 80.0))
    illumination = cv2.GaussianBlur(
        lightness,
        (0, 0),
        sigmaX=sigma,
        sigmaY=sigma,
        borderType=cv2.BORDER_REFLECT,
    )
    reflectance = np.log1p(lightness) - np.log1p(illumination)
    valid = lightness >= 6.0
    samples = reflectance[valid]
    if samples.size < 64:
        samples = reflectance.reshape(-1)
    low, high = np.percentile(samples, (2.0, 98.0))
    normalized = np.clip(
        (reflectance - float(low)) / max(float(high - low), 1e-6),
        0.0,
        1.0,
    )
    local_lightness = normalized * 255.0

    gamma_lab = cv2.cvtColor(gamma_rgb, cv2.COLOR_RGB2LAB)
    gamma_lightness = gamma_lab[..., 0].astype(np.float32)
    local_weight = float(0.25 + 0.18 * dark_score)
    corrected = np.clip(
        gamma_lightness * (1.0 - local_weight)
        + local_lightness * local_weight,
        0.0,
        255.0,
    ).astype(np.uint8)
    corrected_lab = gamma_lab.copy()
    corrected_lab[..., 0] = corrected
    result = cv2.cvtColor(corrected_lab, cv2.COLOR_LAB2RGB)
    return _lift_saturation(result, 1.03 + 0.08 * dark_score)


def build_dark_views(
    original: Image.Image, exposure: dict[str, Any]
) -> dict[str, Image.Image]:
    """Create moderate analysis-only views; output colours still use the original."""
    rgb = np.asarray(original.convert("RGB"), dtype=np.uint8)
    dark_score = float(exposure["dark_score"])
    gamma_rgb = _gamma_view(rgb, float(exposure["gamma"]))
    clahe_rgb = _clahe_view(gamma_rgb, dark_score)
    retinex_rgb = _retinex_view(rgb, gamma_rgb, dark_score)
    return {
        "gamma": Image.fromarray(gamma_rgb, mode="RGB"),
        "clahe": Image.fromarray(clahe_rgb, mode="RGB"),
        "retinex": Image.fromarray(retinex_rgb, mode="RGB"),
    }


def _dilated(mask: np.ndarray, radius: int) -> np.ndarray:
    radius = max(1, int(radius))
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (radius * 2 + 1, radius * 2 + 1),
    )
    return cv2.dilate(mask.astype(np.uint8), kernel).astype(bool)


def fuse_multiview_probabilities(
    original_probability: np.ndarray,
    view_probabilities: dict[str, np.ndarray],
    original: Image.Image,
    exposure: dict[str, Any],
) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    """Safely add consensus evidence while preserving the original prediction."""
    base = np.asarray(original_probability, dtype=np.float32)
    if not view_probabilities:
        debug = np.clip(np.round(base * 255.0), 0, 255).astype(np.uint8)
        return base.copy(), debug, {
            "enabled": False,
            "reason": "no_enhanced_probabilities",
            "restored_probability_ratio": 0.0,
            "mean_probability_gain": 0.0,
            "maximum_probability_gain": 0.0,
            "agreement_ratio": 0.0,
        }

    shapes = {probability.shape for probability in view_probabilities.values()}
    if shapes != {base.shape}:
        raise ValueError("Enhanced-view probability shape mismatch.")

    stack = np.stack(
        [
            np.asarray(probability, dtype=np.float32)
            for probability in view_probabilities.values()
        ],
        axis=0,
    )
    sorted_probabilities = np.sort(stack, axis=0)
    top = sorted_probabilities[-1]
    second = (
        sorted_probabilities[-2]
        if stack.shape[0] >= 2
        else sorted_probabilities[-1]
    )
    consensus = 0.56 * top + 0.44 * second

    rgb = np.asarray(original.convert("RGB"), dtype=np.uint8)
    skin = likely_skin(rgb)
    min_dimension = min(base.shape)
    body_radius = max(9, int(round(min_dimension * 0.055)))
    body_support = _dilated(skin, body_radius)

    anchor = base >= 0.25
    if not anchor.any():
        anchor = base >= max(float(np.percentile(base, 99.2)), 0.12)
    anchor_radius = max(8, int(round(min_dimension * 0.045)))
    anchor_support = _dilated(anchor, anchor_radius)

    local_detail = cv2.GaussianBlur(
        _luminance(rgb),
        (0, 0),
        sigmaX=1.4,
        sigmaY=1.4,
        borderType=cv2.BORDER_REFLECT,
    )
    local_detail = np.abs(_luminance(rgb) - local_detail) / 255.0
    strong_agreement = (top >= 0.64) & (second >= 0.47)
    anchored_agreement = (
        (base >= 0.18)
        & (top >= 0.57)
        & (second >= 0.34)
    )
    eligible = (
        body_support
        & anchor_support
        & (strong_agreement | anchored_agreement)
        & ((local_detail >= 0.006) | (base >= 0.30) | (second >= 0.62))
    )

    requested_gain = np.maximum(consensus - base, 0.0)
    dark_score = float(exposure["dark_score"])
    fusion_weight = float(np.clip(0.24 + 0.36 * dark_score, 0.24, 0.60))
    maximum_gain = float(np.clip(0.22 + 0.20 * dark_score, 0.22, 0.42))
    raw_eligible = eligible.copy()
    active = eligible & (requested_gain > 0.01)
    restore_cap_ratio = float(
        np.clip(0.018 + 0.052 * dark_score, 0.018, 0.070)
    )
    active_ratio = float(active.mean())
    if active_ratio > restore_cap_ratio:
        active_scores = (
            requested_gain
            * (0.42 + 0.58 * second)
            * (0.70 + 0.30 * np.clip(base / 0.35, 0.0, 1.0))
        )
        active_indices = np.flatnonzero(active)
        keep_count = max(1, int(round(restore_cap_ratio * active.size)))
        active_values = active_scores.reshape(-1)[active_indices]
        selected_local = np.argpartition(
            active_values, -keep_count
        )[-keep_count:]
        selected_indices = active_indices[selected_local]
        eligible = np.zeros_like(eligible, dtype=bool)
        eligible.reshape(-1)[selected_indices] = True
    gain = np.minimum(requested_gain * fusion_weight, maximum_gain)
    gain *= eligible.astype(np.float32)
    fused = np.clip(base + gain, 0.0, 1.0).astype(np.float32)

    ensemble_debug = np.clip(
        np.round(consensus * eligible.astype(np.float32) * 255.0),
        0,
        255,
    ).astype(np.uint8)
    restored = gain > 0.01
    diagnostics = {
        "enabled": True,
        "views": list(view_probabilities),
        "fusion_weight": fusion_weight,
        "maximum_gain": maximum_gain,
        "body_support_ratio": float(body_support.mean()),
        "anchor_support_ratio": float(anchor_support.mean()),
        "agreement_ratio": float(eligible.mean()),
        "raw_agreement_ratio": float(raw_eligible.mean()),
        "restore_cap_ratio": restore_cap_ratio,
        "restored_probability_ratio": float(restored.mean()),
        "mean_probability_gain": float(gain[restored].mean())
        if restored.any()
        else 0.0,
        "maximum_probability_gain": float(gain.max()),
    }
    return fused, ensemble_debug, diagnostics
