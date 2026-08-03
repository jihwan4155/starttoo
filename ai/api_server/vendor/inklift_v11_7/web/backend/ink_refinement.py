from __future__ import annotations

import cv2
import numpy as np
from PIL import Image


def _smoothstep(
    values: np.ndarray, low: float, high: float
) -> np.ndarray:
    scaled = np.clip((values - low) / max(high - low, 1e-6), 0.0, 1.0)
    return scaled * scaled * (3.0 - 2.0 * scaled)


def _likely_skin(rgb: np.ndarray) -> np.ndarray:
    red = rgb[..., 0].astype(np.float32)
    green = rgb[..., 1].astype(np.float32)
    blue = rgb[..., 2].astype(np.float32)
    maximum = np.maximum(np.maximum(red, green), blue)
    minimum = np.minimum(np.minimum(red, green), blue)
    saturation = (maximum - minimum) / np.maximum(maximum, 1.0)
    luminance = 0.299 * red + 0.587 * green + 0.114 * blue
    cb = 128.0 - 0.168736 * red - 0.331264 * green + 0.5 * blue
    cr = 128.0 + 0.5 * red - 0.418688 * green - 0.081312 * blue
    likely_skin = np.logical_and.reduce(
        (
            cr >= 112.0,
            cr <= 200.0,
            cb >= 58.0,
            cb <= 158.0,
            luminance >= 16.0,
            saturation <= 0.84,
            red >= blue * 0.70,
        )
    )
    return likely_skin


def _exterior_skin_seed(
    rgb: np.ndarray, roi: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    likely_skin = _likely_skin(rgb)
    red = rgb[..., 0].astype(np.float32)
    green = rgb[..., 1].astype(np.float32)
    blue = rgb[..., 2].astype(np.float32)
    luminance = 0.299 * red + 0.587 * green + 0.114 * blue
    exclusion_radius = max(
        3, int(round(min(rgb.shape[:2]) * 0.004))
    )
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (exclusion_radius * 2 + 1, exclusion_radius * 2 + 1),
    )
    expanded_roi = cv2.dilate(
        roi.astype(np.uint8), kernel, iterations=1
    ).astype(bool)
    seed = np.logical_and(likely_skin, ~expanded_roi)
    if int(seed.sum()) < max(128, int(seed.size * 0.01)):
        seed = np.logical_and(~expanded_roi, luminance >= 24.0)
    return seed, likely_skin


def _normalized_lab_estimate(
    lab: np.ndarray,
    seed: np.ndarray,
    fallback: np.ndarray,
    sigma: float,
) -> tuple[np.ndarray, np.ndarray]:
    weights = seed.astype(np.float32)
    denominator = cv2.GaussianBlur(
        weights,
        (0, 0),
        sigmaX=sigma,
        sigmaY=sigma,
        borderType=cv2.BORDER_REFLECT,
    )
    channels: list[np.ndarray] = []
    for channel in range(3):
        numerator = cv2.GaussianBlur(
            lab[..., channel] * weights,
            (0, 0),
            sigmaX=sigma,
            sigmaY=sigma,
            borderType=cv2.BORDER_REFLECT,
        )
        estimate = numerator / np.maximum(denominator, 1e-5)
        estimate = np.where(
            denominator >= 0.003, estimate, fallback[channel]
        )
        channels.append(estimate)
    return np.stack(channels, axis=2), denominator


def _estimate_skin_lab(
    rgb: np.ndarray, roi: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    exterior_seed, likely_skin = _exterior_skin_seed(rgb, roi)
    if np.any(exterior_seed):
        fallback = np.median(
            lab[exterior_seed], axis=0
        ).astype(np.float32)
    else:
        fallback = np.median(
            lab.reshape(-1, 3), axis=0
        ).astype(np.float32)

    height, width = roi.shape
    initial_sigma = float(
        np.clip(min(height, width) * 0.07, 24.0, 115.0)
    )
    initial, _ = _normalized_lab_estimate(
        lab, exterior_seed, fallback, initial_sigma
    )

    lightness_ratio = lab[..., 0] / np.maximum(initial[..., 0], 12.0)
    chroma_delta = np.sqrt(
        np.square(lab[..., 1] - initial[..., 1])
        + np.square(lab[..., 2] - initial[..., 2])
    ) / 255.0
    pixel_chroma = np.sqrt(
        np.square(lab[..., 1] - 128.0)
        + np.square(lab[..., 2] - 128.0)
    ) / 255.0
    initial_chroma = np.sqrt(
        np.square(initial[..., 1] - 128.0)
        + np.square(initial[..., 2] - 128.0)
    ) / 255.0
    added_chroma = np.maximum(pixel_chroma - initial_chroma, 0.0)
    smooth_lightness = cv2.GaussianBlur(
        lab[..., 0],
        (0, 0),
        sigmaX=2.6,
        sigmaY=2.6,
        borderType=cv2.BORDER_REFLECT,
    )
    fine_texture = (
        np.abs(lab[..., 0] - smooth_lightness) / 255.0
    )

    normal_skin_inside = np.logical_and.reduce(
        (
            roi,
            likely_skin,
            lightness_ratio >= 0.72,
            lightness_ratio <= 1.38,
            chroma_delta <= 0.095,
            added_chroma <= 0.035,
            fine_texture <= 0.045,
        )
    )
    smooth_shadow_inside = np.logical_and.reduce(
        (
            roi,
            likely_skin,
            lightness_ratio >= 0.28,
            lightness_ratio < 0.72,
            chroma_delta <= 0.055,
            added_chroma <= 0.022,
            fine_texture <= 0.025,
        )
    )
    interior_seed = np.logical_or(
        normal_skin_inside, smooth_shadow_inside
    ).astype(np.uint8)
    interior_seed = cv2.morphologyEx(
        interior_seed,
        cv2.MORPH_OPEN,
        np.ones((3, 3), dtype=np.uint8),
    ).astype(bool)
    combined_seed = np.logical_or(exterior_seed, interior_seed)
    refined_sigma = float(
        np.clip(min(height, width) * 0.038, 14.0, 72.0)
    )
    refined, coverage = _normalized_lab_estimate(
        lab, combined_seed, fallback, refined_sigma
    )
    use_refined = coverage >= 0.008
    skin_lab = np.where(use_refined[..., None], refined, initial)
    return lab, skin_lab


def _estimate_exterior_skin_lab(
    rgb: np.ndarray, roi: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    exterior_seed, _ = _exterior_skin_seed(rgb, roi)
    if np.any(exterior_seed):
        fallback = np.median(
            lab[exterior_seed], axis=0
        ).astype(np.float32)
    else:
        fallback = np.median(
            lab.reshape(-1, 3), axis=0
        ).astype(np.float32)
    sigma = float(
        np.clip(min(roi.shape) * 0.065, 22.0, 110.0)
    )
    estimate, _ = _normalized_lab_estimate(
        lab, exterior_seed, fallback, sigma
    )
    return lab, estimate


def _connected_ink_support(
    score: np.ndarray,
    roi: np.ndarray,
) -> tuple[np.ndarray, int, int]:
    weak = np.logical_and(score >= 0.045, roi)
    strong = np.logical_and(score >= 0.115, roi)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        weak.astype(np.uint8), connectivity=8
    )
    image_area = float(weak.size)
    flat_labels = labels.reshape(-1)
    flat_score = score.reshape(-1)
    sums = np.bincount(
        flat_labels, weights=flat_score, minlength=count
    )
    maxima = np.zeros(count, dtype=np.float32)
    np.maximum.at(maxima, flat_labels, flat_score)
    strong_counts = np.bincount(
        labels[strong].reshape(-1), minlength=count
    )
    areas = stats[:, cv2.CC_STAT_AREA].astype(np.float32)
    means = sums / np.maximum(areas, 1.0)
    meaningful_area = max(6, int(image_area * 0.000006))
    keep_labels = np.logical_or(
        strong_counts > 0,
        np.logical_and.reduce(
            (
                areas >= meaningful_area,
                maxima >= 0.085,
                means >= 0.055,
            )
        ),
    )
    keep_labels[0] = False
    keep = keep_labels[labels]
    kept_components = int(keep_labels.sum())
    removed_components = max(0, count - 1 - kept_components)
    return keep, kept_components, removed_components


def refine_ink_alpha(
    original: Image.Image,
    semantic_mask: np.ndarray,
    probability: np.ndarray,
    skin_suppression_factor: float = 0.0,
) -> tuple[np.ndarray, np.ndarray, dict[str, float | int]]:
    """Turn a semantic tattoo region into an ink-only mask and soft alpha."""

    rgb = np.asarray(original.convert("RGB"), dtype=np.uint8)
    roi = semantic_mask.astype(bool)
    if not np.any(roi):
        empty = np.zeros(roi.shape, dtype=np.uint8)
        return roi, empty, {
            "semantic_ratio": 0.0,
            "refined_ratio": 0.0,
            "skin_pixels_removed_ratio": 0.0,
            "components_kept": 0,
            "components_removed": 0,
        }

    lab, skin_lab = _estimate_skin_lab(rgb, roi)
    lightness_delta = (skin_lab[..., 0] - lab[..., 0]) / 255.0
    darkness = np.maximum(lightness_delta, 0.0)
    brightness = np.maximum(-lightness_delta, 0.0)
    lightness_ratio = lab[..., 0] / np.maximum(
        skin_lab[..., 0], 12.0
    )
    chroma_delta = np.sqrt(
        np.square(lab[..., 1] - skin_lab[..., 1])
        + np.square(lab[..., 2] - skin_lab[..., 2])
    ) / 255.0

    pixel_chroma = np.sqrt(
        np.square(lab[..., 1] - 128.0)
        + np.square(lab[..., 2] - 128.0)
    ) / 255.0
    skin_chroma = np.sqrt(
        np.square(skin_lab[..., 1] - 128.0)
        + np.square(skin_lab[..., 2] - 128.0)
    ) / 255.0
    added_chroma = np.maximum(pixel_chroma - skin_chroma, 0.0)

    deep_black_score = _smoothstep(
        1.0 - lightness_ratio, 0.28, 0.76
    )
    color_signal = np.maximum(
        added_chroma * 1.35,
        np.minimum(chroma_delta, added_chroma * 2.4),
    )
    color_score = _smoothstep(color_signal, 0.010, 0.18)
    white_ink_score = _smoothstep(brightness, 0.045, 0.24)

    local_lightness = cv2.GaussianBlur(
        lab[..., 0], (0, 0), sigmaX=2.2, sigmaY=2.2
    )
    fine_dark_detail = np.maximum(
        (local_lightness - lab[..., 0]) / 255.0, 0.0
    )
    detail_score = _smoothstep(fine_dark_detail, 0.010, 0.095)

    base_dark_score = _smoothstep(darkness, 0.016, 0.30)
    dark_score = np.maximum.reduce(
        (
            base_dark_score,
            deep_black_score,
            detail_score * 0.72,
        )
    )

    confidence = _smoothstep(
        probability.astype(np.float32), 0.68, 0.94
    )
    non_white_score = np.maximum.reduce(
        (
            dark_score,
            color_score,
            detail_score * 0.72,
        )
    )
    anchor = np.logical_and(non_white_score >= 0.13, roi)
    anchor_radius = int(
        np.clip(round(min(roi.shape) * 0.006), 3, 13)
    )
    near_anchor = cv2.dilate(
        anchor.astype(np.uint8),
        cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (anchor_radius * 2 + 1, anchor_radius * 2 + 1),
        ),
    ).astype(bool)
    white_ink_score = np.where(near_anchor, white_ink_score, 0.0)
    score = np.maximum(non_white_score, white_ink_score)
    likely_skin = _likely_skin(rgb)
    smooth_skin_surface = np.logical_and.reduce(
        (
            likely_skin,
            lightness_ratio >= 0.76,
            lightness_ratio <= 1.38,
            chroma_delta <= 0.150,
            added_chroma <= 0.042,
            fine_dark_detail <= 0.100,
        )
    )
    smooth_shadow_surface = np.logical_and.reduce(
        (
            likely_skin,
            lightness_ratio >= 0.34,
            lightness_ratio < 0.78,
            chroma_delta <= 0.080,
            added_chroma <= 0.030,
            fine_dark_detail <= 0.080,
        )
    )
    confident_skin_surface = np.logical_or(
        smooth_skin_surface, smooth_shadow_surface
    )
    score[confident_skin_surface] *= float(
        np.clip(skin_suppression_factor, 0.0, 1.0)
    )
    score *= 0.72 + confidence * 0.28
    score[~roi] = 0.0

    support, kept_components, removed_components = _connected_ink_support(
        score, roi
    )
    alpha = np.where(
        support,
        _smoothstep(score, 0.035, 0.82),
        0.0,
    )

    alpha_u8 = np.clip(np.round(alpha * 255.0), 0, 255).astype(np.uint8)
    refined_mask = alpha_u8 >= 14
    semantic_pixels = max(1, int(roi.sum()))
    removed = int(np.logical_and(roi, ~refined_mask).sum())
    diagnostics: dict[str, float | int] = {
        "semantic_ratio": float(roi.mean()),
        "refined_ratio": float(refined_mask.mean()),
        "skin_pixels_removed_ratio": float(removed / semantic_pixels),
        "components_kept": kept_components,
        "components_removed": removed_components,
        "mean_alpha_inside_refined": (
            float(alpha_u8[refined_mask].mean())
            if np.any(refined_mask)
            else 0.0
        ),
    }
    return refined_mask, alpha_u8, diagnostics


def refine_ink_alpha_balanced(
    original: Image.Image,
    semantic_mask: np.ndarray,
    probability: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, dict[str, float | int]]:
    """V11.1-compatible variant that prioritizes faint shade retention."""

    rgb = np.asarray(original.convert("RGB"), dtype=np.uint8)
    roi = semantic_mask.astype(bool)
    if not np.any(roi):
        empty = np.zeros(roi.shape, dtype=np.uint8)
        return roi, empty, {
            "semantic_ratio": 0.0,
            "refined_ratio": 0.0,
            "skin_pixels_removed_ratio": 0.0,
            "components_kept": 0,
            "components_removed": 0,
        }

    lab, skin_lab = _estimate_exterior_skin_lab(rgb, roi)
    lightness_delta = (skin_lab[..., 0] - lab[..., 0]) / 255.0
    darkness = np.maximum(lightness_delta, 0.0)
    brightness = np.maximum(-lightness_delta, 0.0)
    chroma_delta = np.sqrt(
        np.square(lab[..., 1] - skin_lab[..., 1])
        + np.square(lab[..., 2] - skin_lab[..., 2])
    ) / 255.0
    pixel_chroma = np.sqrt(
        np.square(lab[..., 1] - 128.0)
        + np.square(lab[..., 2] - 128.0)
    ) / 255.0
    skin_chroma = np.sqrt(
        np.square(skin_lab[..., 1] - 128.0)
        + np.square(skin_lab[..., 2] - 128.0)
    ) / 255.0
    added_chroma = np.maximum(pixel_chroma - skin_chroma, 0.0)

    dark_score = _smoothstep(darkness, 0.016, 0.30)
    color_score = _smoothstep(
        np.maximum(chroma_delta, added_chroma * 1.18),
        0.026,
        0.22,
    )
    white_ink_score = _smoothstep(brightness, 0.045, 0.24)
    local_lightness = cv2.GaussianBlur(
        lab[..., 0], (0, 0), sigmaX=2.2, sigmaY=2.2
    )
    fine_dark_detail = np.maximum(
        (local_lightness - lab[..., 0]) / 255.0, 0.0
    )
    detail_score = _smoothstep(fine_dark_detail, 0.010, 0.095)
    confidence = _smoothstep(
        probability.astype(np.float32), 0.68, 0.94
    )
    score = np.maximum.reduce(
        (
            dark_score,
            color_score,
            white_ink_score,
            detail_score * 0.72,
        )
    )
    score *= 0.72 + confidence * 0.28
    score[~roi] = 0.0
    support, kept_components, removed_components = _connected_ink_support(
        score, roi
    )
    alpha = np.where(
        support,
        _smoothstep(score, 0.035, 0.82),
        0.0,
    )
    alpha_u8 = np.clip(np.round(alpha * 255.0), 0, 255).astype(np.uint8)
    refined_mask = alpha_u8 >= 14
    semantic_pixels = max(1, int(roi.sum()))
    removed = int(np.logical_and(roi, ~refined_mask).sum())
    diagnostics: dict[str, float | int] = {
        "semantic_ratio": float(roi.mean()),
        "refined_ratio": float(refined_mask.mean()),
        "skin_pixels_removed_ratio": float(removed / semantic_pixels),
        "components_kept": kept_components,
        "components_removed": removed_components,
        "mean_alpha_inside_refined": (
            float(alpha_u8[refined_mask].mean())
            if np.any(refined_mask)
            else 0.0
        ),
    }
    return refined_mask, alpha_u8, diagnostics


def compose_connected_shade_alpha(
    original: Image.Image,
    semantic_mask: np.ndarray,
    strict_alpha_u8: np.ndarray,
    balanced_alpha_u8: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, dict[str, float | int]]:
    """Restore ink-like shade connected to the strict V11.2 result.

    The strict branch is good at rejecting skin and illumination, while the
    balanced branch retains faint tattoo shade. This compositor restores only
    balanced pixels that are close to confirmed ink and have local ink
    evidence, instead of globally relaxing skin suppression.
    """

    rgb = np.asarray(original.convert("RGB"), dtype=np.uint8)
    roi = semantic_mask.astype(bool)
    strict = strict_alpha_u8.astype(np.float32) / 255.0
    balanced = balanced_alpha_u8.astype(np.float32) / 255.0
    if not np.any(roi):
        empty = np.zeros(roi.shape, dtype=np.uint8)
        return roi, empty, {
            "hybrid_ratio": 0.0,
            "restored_pixels_ratio": 0.0,
            "mean_restoration_gate": 0.0,
        }

    confirmed_ink = np.logical_and(strict >= 0.10, roi)
    if not np.any(confirmed_ink):
        mask = balanced_alpha_u8 >= 14
        return mask, balanced_alpha_u8.copy(), {
            "hybrid_ratio": float(mask.mean()),
            "restored_pixels_ratio": float(mask.mean()),
            "mean_restoration_gate": 1.0,
        }

    distance = cv2.distanceTransform(
        (~confirmed_ink).astype(np.uint8),
        cv2.DIST_L2,
        5,
    )
    connection_radius = float(
        np.clip(min(roi.shape) * 0.028, 12.0, 48.0)
    )
    near_ink = np.clip(
        1.0 - distance / max(connection_radius, 1.0),
        0.0,
        1.0,
    )
    extended_near_ink = np.clip(
        1.0 - distance / max(connection_radius * 2.15, 1.0),
        0.0,
        1.0,
    )

    lab, skin_lab = _estimate_skin_lab(rgb, roi)
    darkness = np.maximum(
        (skin_lab[..., 0] - lab[..., 0]) / 255.0,
        0.0,
    )
    chroma_delta = np.sqrt(
        np.square(lab[..., 1] - skin_lab[..., 1])
        + np.square(lab[..., 2] - skin_lab[..., 2])
    ) / 255.0
    fine_blur = cv2.GaussianBlur(
        lab[..., 0],
        (0, 0),
        sigmaX=2.2,
        sigmaY=2.2,
        borderType=cv2.BORDER_REFLECT,
    )
    form_blur = cv2.GaussianBlur(
        lab[..., 0],
        (0, 0),
        sigmaX=8.0,
        sigmaY=8.0,
        borderType=cv2.BORDER_REFLECT,
    )
    fine_detail = np.abs(lab[..., 0] - fine_blur) / 255.0
    form_detail = np.abs(lab[..., 0] - form_blur) / 255.0

    dark_evidence = _smoothstep(darkness, 0.024, 0.17)
    color_evidence = _smoothstep(chroma_delta, 0.025, 0.15)
    fine_evidence = _smoothstep(fine_detail, 0.006, 0.050)
    form_evidence = _smoothstep(form_detail, 0.012, 0.085)
    textured_ink = np.maximum.reduce(
        (
            fine_evidence,
            form_evidence,
            color_evidence,
        )
    )
    shade_evidence = np.maximum(
        textured_ink,
        dark_evidence * (0.28 + form_evidence * 0.72),
    )
    balanced_strength = _smoothstep(balanced, 0.035, 0.72)

    local_gate = near_ink * shade_evidence
    extended_gate = (
        extended_near_ink
        * np.maximum(fine_evidence, color_evidence)
        * balanced_strength
        * 0.86
    )
    restoration_gate = np.maximum(local_gate, extended_gate)
    restoration_gate *= 0.52 + balanced_strength * 0.48
    restoration_gate[~roi] = 0.0

    candidate = np.maximum(balanced - strict, 0.0)
    hybrid = np.maximum(
        strict,
        strict + candidate * restoration_gate,
    )
    hybrid[~roi] = 0.0
    hybrid_u8 = np.clip(
        np.round(hybrid * 255.0), 0, 255
    ).astype(np.uint8)
    hybrid_mask = hybrid_u8 >= 14
    restored = np.logical_and(hybrid_mask, strict_alpha_u8 < 14)
    diagnostics: dict[str, float | int] = {
        "hybrid_ratio": float(hybrid_mask.mean()),
        "restored_pixels_ratio": float(restored.mean()),
        "mean_restoration_gate": (
            float(restoration_gate[restored].mean())
            if np.any(restored)
            else 0.0
        ),
        "connection_radius": float(connection_radius),
    }
    return hybrid_mask, hybrid_u8, diagnostics


def compose_skin_tone_ink_alpha(
    original: Image.Image,
    semantic_mask: np.ndarray,
    probability: np.ndarray,
    connected_alpha_u8: np.ndarray,
    balanced_alpha_u8: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, dict[str, float | int]]:
    """Restore brown and skin-like ink without reopening the whole skin ROI.

    Brown, beige, and muted red ink can be close to the wearer's skin colour.
    The adaptive skin estimate used by the strict branch may consequently
    absorb those colours. This final compositor deliberately estimates skin
    from *outside* the semantic tattoo ROI and restores only pixels that are:

    1. confidently inside the semantic tattoo region,
    2. connected to already confirmed ink, and
    3. different from exterior skin or enclosed by confirmed ink lines.

    Fine local texture is intentionally not used as evidence here. That keeps
    pores, freckles, compression noise, and hair from becoming stronger merely
    because they happen to sit inside a coarse semantic ROI.
    """

    rgb = np.asarray(original.convert("RGB"), dtype=np.uint8)
    roi = semantic_mask.astype(bool)
    base = connected_alpha_u8.astype(np.float32) / 255.0
    balanced = balanced_alpha_u8.astype(np.float32) / 255.0
    empty_diagnostics: dict[str, float | int] = {
        "skin_tone_ratio": float((base >= (14.0 / 255.0)).mean()),
        "skin_tone_restored_pixels_ratio": 0.0,
        "skin_tone_added_alpha_mean": 0.0,
        "skin_tone_connection_radius": 0.0,
        "skin_tone_enclosed_ratio": 0.0,
        "skin_tone_colour_diversity": 0.0,
        "skin_tone_colour_diversity_gate": 0.0,
    }
    if not np.any(roi):
        return base >= (14.0 / 255.0), connected_alpha_u8.copy(), (
            empty_diagnostics
        )

    confirmed_ink = np.logical_and(base >= 0.10, roi)
    if not np.any(confirmed_ink):
        # A colour-only recovery is unsafe without an ink anchor. In
        # particular, this prevents a false semantic skin region from being
        # filled just because its lighting differs from the surrounding skin.
        return base >= (14.0 / 255.0), connected_alpha_u8.copy(), (
            empty_diagnostics
        )

    distance = cv2.distanceTransform(
        (~confirmed_ink).astype(np.uint8),
        cv2.DIST_L2,
        5,
    )
    connection_radius = float(
        np.clip(min(roi.shape) * 0.065, 24.0, 80.0)
    )
    near_confirmed_ink = np.clip(
        1.0 - distance / max(connection_radius, 1.0),
        0.0,
        1.0,
    )

    roi_distance = cv2.distanceTransform(
        roi.astype(np.uint8),
        cv2.DIST_L2,
        5,
    )
    safely_inside_roi = _smoothstep(roi_distance, 2.0, 12.0)
    confidence = _smoothstep(
        probability.astype(np.float32), 0.70, 0.96
    )

    lab, exterior_skin_lab = _estimate_exterior_skin_lab(rgb, roi)
    darkness = np.maximum(
        (exterior_skin_lab[..., 0] - lab[..., 0]) / 255.0,
        0.0,
    )
    chroma_delta = np.sqrt(
        np.square(lab[..., 1] - exterior_skin_lab[..., 1])
        + np.square(lab[..., 2] - exterior_skin_lab[..., 2])
    ) / 255.0
    dark_evidence = _smoothstep(darkness, 0.018, 0.150)
    colour_evidence = _smoothstep(chroma_delta, 0.014, 0.115)

    confirmed_colours = lab[confirmed_ink, 1:3]
    if confirmed_colours.shape[0] >= 128:
        colour_bounds = np.quantile(
            confirmed_colours,
            (0.10, 0.90),
            axis=0,
        )
        colour_diversity = float(
            np.linalg.norm(colour_bounds[1] - colour_bounds[0])
            / 255.0
        )
    else:
        colour_diversity = 0.0
    colour_diversity_gate = float(
        _smoothstep(
            np.asarray(colour_diversity, dtype=np.float32),
            0.095,
            0.145,
        )
    )

    # Treat already recovered ink as thin walls. A weak region fully enclosed
    # by those walls is more likely to be a deliberately filled tattoo colour
    # than open skin around the tattoo.
    walls = np.logical_and(base >= 0.22, roi).astype(np.uint8)
    walls = cv2.dilate(
        walls,
        np.ones((3, 3), dtype=np.uint8),
        iterations=1,
    ).astype(bool)
    free_space = np.logical_and(roi, ~walls)
    _, free_labels = cv2.connectedComponents(
        free_space.astype(np.uint8),
        connectivity=8,
    )
    eroded_roi = cv2.erode(
        roi.astype(np.uint8),
        np.ones((7, 7), dtype=np.uint8),
        iterations=1,
    ).astype(bool)
    roi_boundary = np.logical_and(roi, ~eroded_roi)
    open_labels = np.unique(
        free_labels[np.logical_and(roi_boundary, free_space)]
    )
    enclosed = np.logical_and(
        free_space,
        ~np.isin(free_labels, open_labels),
    )
    enclosed_evidence = (
        enclosed.astype(np.float32)
        * _smoothstep(balanced, 0.025, 0.28)
        * 0.72
    )

    # A pure luminance change can simply be a shadow. Chroma gets full weight;
    # darkness gets full weight only when it is also supported by some colour
    # difference or by an enclosed, ink-bounded region.
    chroma_support = _smoothstep(chroma_delta, 0.006, 0.050)
    dark_support = np.maximum(chroma_support, enclosed_evidence)
    skin_tone_evidence = np.maximum.reduce(
        (
            colour_evidence,
            dark_evidence * (0.22 + 0.78 * dark_support),
            enclosed_evidence,
        )
    )

    restoration_target = np.maximum(
        balanced,
        skin_tone_evidence * (0.72 + confidence * 0.28),
    )
    connection_support = np.maximum(
        near_confirmed_ink,
        enclosed.astype(np.float32) * 0.92,
    )
    restoration_gate = (
        safely_inside_roi
        * confidence
        * connection_support
        * np.sqrt(np.clip(skin_tone_evidence, 0.0, 1.0))
        * colour_diversity_gate
    )
    restoration_gate[~roi] = 0.0

    candidate = np.maximum(restoration_target - base, 0.0)
    restored_alpha = np.maximum(
        base,
        base + candidate * restoration_gate,
    )
    restored_alpha[~roi] = 0.0
    restored_alpha_u8 = np.clip(
        np.round(restored_alpha * 255.0), 0, 255
    ).astype(np.uint8)
    restored_mask = restored_alpha_u8 >= 14
    newly_visible = np.logical_and(
        restored_mask,
        connected_alpha_u8 < 14,
    )
    added = np.maximum(restored_alpha - base, 0.0)
    diagnostics: dict[str, float | int] = {
        "skin_tone_ratio": float(restored_mask.mean()),
        "skin_tone_restored_pixels_ratio": float(newly_visible.mean()),
        "skin_tone_added_alpha_mean": (
            float(added[added > 0.0].mean())
            if np.any(added > 0.0)
            else 0.0
        ),
        "skin_tone_connection_radius": float(connection_radius),
        "skin_tone_enclosed_ratio": float(enclosed.mean()),
        "skin_tone_colour_diversity": float(colour_diversity),
        "skin_tone_colour_diversity_gate": float(
            colour_diversity_gate
        ),
    }
    return restored_mask, restored_alpha_u8, diagnostics


def _estimate_spatial_skin_reference(
    rgb: np.ndarray,
    roi: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Estimate a smoothly varying skin/illumination map around the tattoo."""

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    exterior_seed, likely_skin = _exterior_skin_seed(rgb, roi)
    strict_seed = np.logical_and.reduce(
        (
            exterior_seed,
            likely_skin,
            lab[..., 0] >= 28.0,
        )
    )
    if int(strict_seed.sum()) >= 128:
        seed_colours = lab[strict_seed]
        median_colour = np.median(seed_colours, axis=0)
        chroma_distance = np.sqrt(
            np.square(lab[..., 1] - median_colour[1])
            + np.square(lab[..., 2] - median_colour[2])
        )
        strict_seed = np.logical_and(
            strict_seed,
            chroma_distance <= 38.0,
        )
    if int(strict_seed.sum()) < 128:
        strict_seed = exterior_seed

    if np.any(strict_seed):
        fallback = np.median(
            lab[strict_seed], axis=0
        ).astype(np.float32)
    else:
        fallback = np.median(
            lab.reshape(-1, 3), axis=0
        ).astype(np.float32)

    height, width = roi.shape
    seed_y, seed_x = np.nonzero(strict_seed)
    if seed_x.size >= 128:
        max_fit_samples = 40_000
        stride = max(1, int(np.ceil(seed_x.size / max_fit_samples)))
        fit_x = seed_x[::stride].astype(np.float32)
        fit_y = seed_y[::stride].astype(np.float32)
        fit_lab = lab[seed_y[::stride], seed_x[::stride]]
        normalized_x = fit_x / max(width - 1, 1) * 2.0 - 1.0
        normalized_y = fit_y / max(height - 1, 1) * 2.0 - 1.0
        design = np.stack(
            (
                np.ones_like(normalized_x),
                normalized_x,
                normalized_y,
                normalized_x * normalized_y,
                normalized_x * normalized_x,
                normalized_y * normalized_y,
            ),
            axis=1,
        )
        coefficients, _, _, _ = np.linalg.lstsq(
            design,
            fit_lab,
            rcond=None,
        )
        initial_fit = design @ coefficients
        residual = np.linalg.norm(fit_lab - initial_fit, axis=1)
        residual_median = float(np.median(residual))
        residual_mad = float(
            np.median(np.abs(residual - residual_median))
        )
        robust_limit = residual_median + max(
            6.0,
            residual_mad * 3.5,
        )
        inliers = residual <= robust_limit
        if int(inliers.sum()) >= 96:
            coefficients, _, _, _ = np.linalg.lstsq(
                design[inliers],
                fit_lab[inliers],
                rcond=None,
            )

        grid_y, grid_x = np.indices((height, width), dtype=np.float32)
        grid_x = grid_x / max(width - 1, 1) * 2.0 - 1.0
        grid_y = grid_y / max(height - 1, 1) * 2.0 - 1.0
        grid_design = np.stack(
            (
                np.ones_like(grid_x),
                grid_x,
                grid_y,
                grid_x * grid_y,
                grid_x * grid_x,
                grid_y * grid_y,
            ),
            axis=2,
        )
        polynomial_skin = grid_design @ coefficients
        polynomial_skin = np.clip(
            polynomial_skin,
            0.0,
            255.0,
        ).astype(np.float32)
        polynomial_reliability = float(
            np.clip(
                strict_seed.sum() / max(strict_seed.size * 0.012, 1.0),
                0.0,
                1.0,
            )
        )
    else:
        polynomial_skin = np.broadcast_to(
            fallback,
            lab.shape,
        ).astype(np.float32)
        polynomial_reliability = 0.0

    sigma = float(
        np.clip(min(roi.shape) * 0.038, 16.0, 78.0)
    )
    local_skin, coverage = _normalized_lab_estimate(
        lab,
        strict_seed,
        fallback,
        sigma,
    )
    local_weight = _smoothstep(coverage, 0.004, 0.032)
    skin_lab = (
        polynomial_skin * (1.0 - local_weight[..., None])
        + local_skin * local_weight[..., None]
    )
    local_reliability = _smoothstep(coverage, 0.0015, 0.025)
    reliability = np.maximum(
        local_reliability,
        polynomial_reliability * 0.74,
    )
    return lab, skin_lab, reliability


def compose_spatial_skin_residual_alpha(
    original: Image.Image,
    semantic_mask: np.ndarray,
    probability: np.ndarray,
    base_alpha_u8: np.ndarray,
    balanced_alpha_u8: np.ndarray,
) -> tuple[
    np.ndarray,
    np.ndarray,
    dict[str, float | int],
    np.ndarray,
    np.ndarray,
]:
    """V11.5: recover ink from a position-aware skin residual map.

    The surrounding skin is treated as a smooth sheet whose colour and
    brightness change with body curvature and illumination. The function
    predicts what untouched skin would look like at every tattoo pixel, then
    measures the residual between that prediction and the photograph.

    Residual colour is never accepted by itself. It must also be inside a
    confident semantic tattoo ROI, close to confirmed ink or enclosed by ink
    lines, and part of a sufficiently diverse colour illustration. Those
    conditions keep shadows, pores, bruises, and marker drawings conservative.
    """

    rgb = np.asarray(original.convert("RGB"), dtype=np.uint8)
    roi = semantic_mask.astype(bool)
    base = base_alpha_u8.astype(np.float32) / 255.0
    balanced = balanced_alpha_u8.astype(np.float32) / 255.0
    empty_mask = base >= (14.0 / 255.0)
    empty_residual = np.zeros(roi.shape, dtype=np.uint8)

    lab, skin_lab, skin_reliability = _estimate_spatial_skin_reference(
        rgb,
        roi,
    )
    skin_reference_rgb = cv2.cvtColor(
        np.clip(np.round(skin_lab), 0, 255).astype(np.uint8),
        cv2.COLOR_LAB2RGB,
    )
    empty_diagnostics: dict[str, float | int] = {
        "spatial_residual_ratio": float(empty_mask.mean()),
        "spatial_residual_restored_pixels_ratio": 0.0,
        "spatial_residual_added_alpha_mean": 0.0,
        "spatial_skin_reliability_mean": 0.0,
        "spatial_residual_colour_diversity": 0.0,
        "spatial_residual_colour_gate": 0.0,
        "spatial_residual_connection_radius": 0.0,
    }
    if not np.any(roi):
        return (
            empty_mask,
            base_alpha_u8.copy(),
            empty_diagnostics,
            skin_reference_rgb,
            empty_residual,
        )

    confirmed_ink = np.logical_and(base >= 0.10, roi)
    if not np.any(confirmed_ink):
        return (
            empty_mask,
            base_alpha_u8.copy(),
            empty_diagnostics,
            skin_reference_rgb,
            empty_residual,
        )

    probability_float = probability.astype(np.float32)
    confidence = _smoothstep(probability_float, 0.72, 0.97)
    roi_distance = cv2.distanceTransform(
        roi.astype(np.uint8),
        cv2.DIST_L2,
        5,
    )
    safely_inside_roi = _smoothstep(roi_distance, 1.5, 10.0)

    distance = cv2.distanceTransform(
        (~confirmed_ink).astype(np.uint8),
        cv2.DIST_L2,
        5,
    )
    connection_radius = float(
        np.clip(min(roi.shape) * 0.085, 28.0, 105.0)
    )
    near_confirmed_ink = np.clip(
        1.0 - distance / max(connection_radius, 1.0),
        0.0,
        1.0,
    )

    walls = np.logical_and(base >= 0.20, roi).astype(np.uint8)
    walls = cv2.dilate(
        walls,
        np.ones((3, 3), dtype=np.uint8),
        iterations=1,
    ).astype(bool)
    free_space = np.logical_and(roi, ~walls)
    _, free_labels = cv2.connectedComponents(
        free_space.astype(np.uint8),
        connectivity=8,
    )
    eroded_roi = cv2.erode(
        roi.astype(np.uint8),
        np.ones((7, 7), dtype=np.uint8),
        iterations=1,
    ).astype(bool)
    roi_boundary = np.logical_and(roi, ~eroded_roi)
    open_labels = np.unique(
        free_labels[np.logical_and(roi_boundary, free_space)]
    )
    enclosed = np.logical_and(
        free_space,
        ~np.isin(free_labels, open_labels),
    )
    connection_support = np.maximum(
        near_confirmed_ink,
        enclosed.astype(np.float32) * 0.94,
    )

    lightness_residual = (
        skin_lab[..., 0] - lab[..., 0]
    ) / 255.0
    darkness = np.maximum(lightness_residual, 0.0)
    brightness = np.maximum(-lightness_residual, 0.0)
    chroma_delta = np.sqrt(
        np.square(lab[..., 1] - skin_lab[..., 1])
        + np.square(lab[..., 2] - skin_lab[..., 2])
    ) / 255.0
    delta_e = np.sqrt(
        np.square(lightness_residual * 0.68)
        + np.square((lab[..., 1] - skin_lab[..., 1]) / 255.0)
        + np.square((lab[..., 2] - skin_lab[..., 2]) / 255.0)
    )

    chroma_score = _smoothstep(chroma_delta, 0.008, 0.090)
    chroma_support = _smoothstep(chroma_delta, 0.004, 0.040)
    dark_score = _smoothstep(darkness, 0.012, 0.125)
    bright_score = _smoothstep(brightness, 0.030, 0.170)
    delta_score = _smoothstep(delta_e, 0.015, 0.120)
    raw_residual = np.maximum.reduce(
        (
            chroma_score,
            dark_score * (0.12 + chroma_support * 0.88),
            bright_score * chroma_support * 0.70,
            delta_score * chroma_support,
        )
    )

    # A small blur joins pinholes inside one coloured ink field. The original
    # residual still carries most of the weight, so colour boundaries remain
    # crisp while sensor noise and pores do not become isolated alpha dots.
    coherent_residual = cv2.GaussianBlur(
        raw_residual,
        (0, 0),
        sigmaX=2.2,
        sigmaY=2.2,
        borderType=cv2.BORDER_REFLECT,
    )
    residual_score = np.maximum(
        raw_residual * 0.66,
        coherent_residual,
    )
    residual_score[~roi] = 0.0

    confirmed_colours = lab[confirmed_ink, 1:3]
    if confirmed_colours.shape[0] >= 128:
        colour_bounds = np.quantile(
            confirmed_colours,
            (0.10, 0.90),
            axis=0,
        )
        colour_diversity = float(
            np.linalg.norm(colour_bounds[1] - colour_bounds[0])
            / 255.0
        )
    else:
        colour_diversity = 0.0
    colour_gate = float(
        _smoothstep(
            np.asarray(colour_diversity, dtype=np.float32),
            0.095,
            0.145,
        )
    )

    reliability_gate = 0.58 + skin_reliability * 0.42
    restoration_target = np.maximum.reduce(
        (
            base,
            balanced,
            residual_score * (0.76 + confidence * 0.24),
        )
    )
    restoration_gate = (
        safely_inside_roi
        * confidence
        * connection_support
        * np.sqrt(np.clip(residual_score, 0.0, 1.0))
        * reliability_gate
        * colour_gate
    )
    restoration_gate[~roi] = 0.0

    candidate = np.maximum(restoration_target - base, 0.0)
    final_alpha = np.maximum(
        base,
        base + candidate * restoration_gate,
    )
    final_alpha[~roi] = 0.0
    final_alpha_u8 = np.clip(
        np.round(final_alpha * 255.0), 0, 255
    ).astype(np.uint8)
    final_mask = final_alpha_u8 >= 14
    newly_visible = np.logical_and(
        final_mask,
        base_alpha_u8 < 14,
    )
    added = np.maximum(final_alpha - base, 0.0)
    residual_u8 = np.clip(
        np.round(
            residual_score
            * confidence
            * safely_inside_roi
            * 255.0
        ),
        0,
        255,
    ).astype(np.uint8)
    residual_u8[~roi] = 0

    diagnostics: dict[str, float | int] = {
        "spatial_residual_ratio": float(final_mask.mean()),
        "spatial_residual_restored_pixels_ratio": float(
            newly_visible.mean()
        ),
        "spatial_residual_added_alpha_mean": (
            float(added[added > 0.0].mean())
            if np.any(added > 0.0)
            else 0.0
        ),
        "spatial_skin_reliability_mean": float(
            skin_reliability[roi].mean()
        ),
        "spatial_residual_colour_diversity": float(
            colour_diversity
        ),
        "spatial_residual_colour_gate": float(colour_gate),
        "spatial_residual_connection_radius": float(
            connection_radius
        ),
    }
    return (
        final_mask,
        final_alpha_u8,
        diagnostics,
        skin_reference_rgb,
        residual_u8,
    )
