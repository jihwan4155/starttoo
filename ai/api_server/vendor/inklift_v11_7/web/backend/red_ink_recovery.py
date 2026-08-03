from __future__ import annotations

from typing import Any

import cv2
import numpy as np
from PIL import Image


def _smoothstep(
    values: np.ndarray, low: float, high: float
) -> np.ndarray:
    scaled = np.clip((values - low) / max(high - low, 1e-6), 0.0, 1.0)
    return scaled * scaled * (3.0 - 2.0 * scaled)


def _dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    radius = max(1, int(radius))
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (radius * 2 + 1, radius * 2 + 1),
    )
    return cv2.dilate(mask.astype(np.uint8), kernel).astype(bool)


def red_ink_likelihood(original: Image.Image) -> tuple[np.ndarray, dict[str, Any]]:
    """Estimate red-ink evidence relative to the surrounding skin colour."""
    rgb_u8 = np.asarray(original.convert("RGB"), dtype=np.uint8)
    rgb = rgb_u8.astype(np.float32) / 255.0
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maximum = np.max(rgb, axis=2)
    minimum = np.min(rgb, axis=2)
    saturation = (maximum - minimum) / np.maximum(maximum, 1.0 / 255.0)
    redness = red - 0.55 * green - 0.45 * blue

    lab = cv2.cvtColor(rgb_u8, cv2.COLOR_RGB2LAB).astype(np.float32)
    channel_a = lab[..., 1]
    min_dimension = min(rgb_u8.shape[:2])
    sigma = float(np.clip(min_dimension * 0.040, 8.0, 48.0))
    smooth_a = cv2.GaussianBlur(
        channel_a,
        (0, 0),
        sigmaX=sigma,
        sigmaY=sigma,
        borderType=cv2.BORDER_REFLECT,
    )
    smooth_redness = cv2.GaussianBlur(
        redness,
        (0, 0),
        sigmaX=sigma,
        sigmaY=sigma,
        borderType=cv2.BORDER_REFLECT,
    )
    local_a_excess = channel_a - smooth_a
    local_red_excess = redness - smooth_redness
    lightness = lab[..., 0]
    local_lightness = cv2.GaussianBlur(
        lightness,
        (0, 0),
        sigmaX=1.8,
        sigmaY=1.8,
        borderType=cv2.BORDER_REFLECT,
    )
    dark_detail = _smoothstep(
        local_lightness - lightness,
        1.2,
        13.0,
    )

    hue = cv2.cvtColor(rgb_u8, cv2.COLOR_RGB2HSV)[..., 0].astype(np.float32)
    red_hue = np.maximum(
        1.0 - np.clip(hue / 24.0, 0.0, 1.0),
        np.clip((hue - 138.0) / 32.0, 0.0, 1.0),
    )
    red_hue *= _smoothstep(saturation, 0.08, 0.38)

    local_score = np.maximum(
        _smoothstep(local_a_excess, 1.5, 16.0),
        _smoothstep(local_red_excess, 0.008, 0.090),
    )
    redness_score = _smoothstep(redness, 0.025, 0.22)
    saturation_score = _smoothstep(saturation, 0.08, 0.46)
    colour_score = (
        0.42 * redness_score
        + 0.34 * red_hue
        + 0.24 * saturation_score
    )
    saturated_red = _smoothstep(saturation, 0.24, 0.66)
    score = (
        0.68 * local_score
        + 0.32 * colour_score * saturated_red
    )
    ink_structure = np.maximum(dark_detail, saturated_red)
    score *= 0.75 + 0.25 * ink_structure
    warm_red = (
        (hue <= 25.0)
        & (red >= green * 1.015)
        & (red >= blue * 1.035)
    )
    burgundy_red = (
        (hue >= 138.0)
        & (red >= green * 1.015)
        & (red >= blue * 0.82)
    )
    red_dominant = (warm_red | burgundy_red) & (saturation >= 0.07)
    score *= red_dominant.astype(np.float32)
    score = np.clip(score, 0.0, 1.0).astype(np.float32)
    return score, {
        "red_candidate_ratio": float((score >= 0.30).mean()),
        "red_strong_ratio": float((score >= 0.48).mean()),
        "red_score_mean": float(score.mean()),
        "red_score_max": float(score.max()),
    }


def recover_red_ink_alpha(
    original: Image.Image,
    base_probability: np.ndarray,
    red_probability: np.ndarray,
    current_alpha_u8: np.ndarray,
    roi_gate_probability: float | None = None,
) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    """Add only specialist-supported red ink connected to existing tattoo."""
    base_probability = np.asarray(base_probability, dtype=np.float32)
    red_probability = np.asarray(red_probability, dtype=np.float32)
    current_alpha_u8 = np.asarray(current_alpha_u8, dtype=np.uint8)
    if (
        base_probability.shape != red_probability.shape
        or base_probability.shape != current_alpha_u8.shape
    ):
        raise ValueError("Red recovery inputs must have matching shapes.")

    red_score, diagnostics = red_ink_likelihood(original)
    min_dimension = min(red_score.shape)
    anchor = (current_alpha_u8 >= 16) | (base_probability >= 0.52)
    anchor_radius = max(7, int(round(min_dimension * 0.045)))
    anchor_support = _dilate(anchor, anchor_radius)

    raw_specialist_core = red_probability >= 0.85
    raw_specialist_coverage = (
        float((current_alpha_u8[raw_specialist_core] >= 16).mean())
        if raw_specialist_core.any()
        else 1.0
    )
    specialist_red_score_median = (
        float(np.median(red_score[raw_specialist_core]))
        if raw_specialist_core.any()
        else 0.0
    )
    uncovered_specialist_core = raw_specialist_core & (current_alpha_u8 < 16)
    uncovered_red_score_median = (
        float(np.median(red_score[uncovered_specialist_core]))
        if uncovered_specialist_core.any()
        else specialist_red_score_median
    )
    candidate_score_threshold = 0.28
    seed_score_threshold = 0.38
    candidate = (
        (red_probability >= 0.58)
        & (red_score >= candidate_score_threshold)
    )
    seed = (
        (red_probability >= 0.80)
        & (red_score >= seed_score_threshold)
        & anchor_support
    )
    specialist_core = (
        (red_probability >= 0.80)
        & (red_score >= seed_score_threshold)
    )
    specialist_core_coverage = (
        float((current_alpha_u8[specialist_core] >= 16).mean())
        if specialist_core.any()
        else 1.0
    )
    if candidate.any() and seed.any():
        count, labels = cv2.connectedComponents(
            candidate.astype(np.uint8), connectivity=8
        )
        touching = np.unique(labels[seed])
        touching = touching[touching > 0]
        connected = np.isin(labels, touching) if touching.size else np.zeros_like(candidate)
    else:
        connected = np.zeros_like(candidate)

    score_span = 0.10 if candidate_score_threshold < 0.10 else 0.22
    normalized_red_evidence = _smoothstep(
        red_score,
        candidate_score_threshold,
        candidate_score_threshold + score_span,
    )
    target_strength = (
        (0.42 + 0.58 * red_probability)
        * normalized_red_evidence
    )
    target_alpha = np.clip(
        np.round(255.0 * target_strength),
        0,
        255,
    ).astype(np.uint8)
    addition_candidate = connected & (target_alpha > current_alpha_u8)

    maximum_addition_ratio = 0.045
    roi_gate_threshold = 0.82
    roi_gate_rejected = (
        roi_gate_probability is not None
        and roi_gate_probability < roi_gate_threshold
    )
    low_chroma_rejected = specialist_red_score_median < 0.22
    if roi_gate_rejected:
        maximum_addition_ratio = 0.0
        addition_candidate[:] = False
    if low_chroma_rejected:
        maximum_addition_ratio = 0.0
        addition_candidate[:] = False
    if (
        specialist_core_coverage >= 0.80
        and raw_specialist_coverage >= 0.65
    ):
        maximum_addition_ratio = 0.0
        addition_candidate[:] = False
    if float(addition_candidate.mean()) > maximum_addition_ratio:
        evidence = (
            target_strength
            * (0.55 + 0.45 * red_score)
            * (0.72 + 0.28 * np.clip(base_probability / 0.45, 0.0, 1.0))
        )
        indices = np.flatnonzero(addition_candidate)
        keep_count = max(1, int(round(maximum_addition_ratio * connected.size)))
        values = evidence.reshape(-1)[indices]
        selected = indices[np.argpartition(values, -keep_count)[-keep_count:]]
        addition_candidate = np.zeros_like(connected)
        addition_candidate.reshape(-1)[selected] = True

    recovered = current_alpha_u8.copy()
    recovered[addition_candidate] = np.maximum(
        recovered[addition_candidate],
        target_alpha[addition_candidate],
    )
    added = recovered.astype(np.int16) - current_alpha_u8.astype(np.int16)
    added_mask = added > 4
    diagnostics.update(
        {
            "red_specialist_probability_mean": float(red_probability.mean()),
            "red_specialist_probability_max": float(red_probability.max()),
            "red_anchor_support_ratio": float(anchor_support.mean()),
            "red_specialist_core_coverage": specialist_core_coverage,
            "red_raw_specialist_coverage": raw_specialist_coverage,
            "red_specialist_red_score_median": specialist_red_score_median,
            "red_uncovered_score_median": uncovered_red_score_median,
            "red_candidate_score_threshold": candidate_score_threshold,
            "red_connected_candidate_ratio": float(connected.mean()),
            "red_restored_pixels_ratio": float(added_mask.mean()),
            "red_added_alpha_mean": float(added[added_mask].mean())
            if added_mask.any()
            else 0.0,
            "red_maximum_addition_ratio": maximum_addition_ratio,
            "red_roi_gate_probability": roi_gate_probability,
            "red_roi_gate_threshold": roi_gate_threshold,
            "red_roi_gate_rejected": roi_gate_rejected,
            "red_low_chroma_rejected": low_chroma_rejected,
        }
    )
    debug = np.clip(
        np.round(red_score * red_probability * connected * 255.0),
        0,
        255,
    ).astype(np.uint8)
    return recovered, debug, diagnostics
