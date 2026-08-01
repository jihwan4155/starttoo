"""
마스크 추출. coverup3/python-search/app/features.py 를 옮기고 알파 경로를 더했다.

핵심 차이 — 도안 이미지가 누끼(투명 PNG)라서 알파 채널이 곧 실루엣이다.
cv2.imread 를 IMREAD_COLOR 로 읽으면 알파를 버리고 그 아래 깔린 RGB 를 그대로
쓰는데, 그 값이 도구마다 흰색이거나 검정이다. 검정이면 실루엣 판정(V>235 & S<25)
에서 전경으로 잡혀 프레임 전체가 도안이 되고, fill=1.0 / opacity=1.0 이 되어
게이트 두 단계를 모두 통과한다 — 에러 없이 인덱스가 오염된다.

그래서 IMREAD_UNCHANGED 로 읽고 알파가 있으면 알파를 마스크로 쓴다. 투명 영역
아래 RGB 가 무엇이든 무관해진다. 단 모폴로지(OPEN 1 / CLOSE 2)는 반드시 같이
통과시킨다 — 튜닝 상수(FILL·MIN_FILL·LINE_TAU·DUP_COSINE)가 그 정리를 거친
출력 분포에 맞춰진 값이다.
"""

from __future__ import annotations

import numpy as np
import cv2

ALPHA_THRESHOLD = 127      # 누끼 경계는 안티에일리어싱이라 중간값이 있다
_K3 = np.ones((3, 3), np.uint8)
_K5 = np.ones((5, 5), np.uint8)


def decode_design(data: bytes) -> tuple[np.ndarray, np.ndarray] | None:
    """
    도안 이미지 바이트 -> (bgr, mask). 알파가 있으면 알파를, 없으면 흰 배경
    휴리스틱을 쓴다. 디코딩 실패나 빈 마스크면 None.
    """
    buf = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
    if img is None or img.size == 0:
        return None
    if img.ndim == 2:
        bgr, mask = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR), None
    elif img.shape[2] == 4:
        bgr = composite_on_white(img)
        mask = alpha_mask(img[:, :, 3])
    else:
        bgr, mask = img, None
    if mask is None:
        mask = silhouette_mask(bgr)
    if not mask.any():
        return None
    return bgr, mask


def composite_on_white(bgra: np.ndarray) -> np.ndarray:
    """
    RGBA -> 흰 배경에 합성한 BGR.

    마스크는 알파에서 뽑지만 색은 합성해야 한다. alpha_mask 의 CLOSE(2회)가 알파
    경계 밖 픽셀을 최대 2px 끌어들이는데, 합성하지 않으면 그 자리에 '투명 영역
    아래 RGB'가 그대로 남아 opacity 가 배경색에 따라 달라진다(검정이면 255, 흰색
    이면 0). 흰색으로 합성하면 끌려온 픽셀이 흰 배경 도안과 같은 값이 되어
    under 와 무관해지고, 튜닝 상수가 가정하는 흰 배경 의미와도 맞는다.
    알파=255 인 안쪽 픽셀은 합성으로 값이 바뀌지 않는다.
    """
    a = bgra[:, :, 3:4].astype(np.float32) / 255.0
    bgr = bgra[:, :, :3].astype(np.float32) * a + 255.0 * (1.0 - a)
    return np.ascontiguousarray(np.rint(bgr).astype(np.uint8))


def alpha_mask(alpha: np.ndarray) -> np.ndarray:
    """알파 채널 -> 실루엣 마스크(0/255). 모폴로지는 흰배경 경로와 동일하게."""
    m = ((alpha > ALPHA_THRESHOLD) * 255).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, _K3, iterations=1)
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, _K3, iterations=2)


def silhouette_mask(bgr: np.ndarray, white_v: int = 235, white_s: int = 25) -> np.ndarray:
    """
    '흰 배경 위 도안' -> 이진 실루엣 마스크(0/255).
    배경(흰색) = 밝고(V 높음) 채도 낮음(S 낮음). 그 외 전부 전경.
    알파가 없는 이미지에만 쓰는 폴백이다.
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    s, v = hsv[:, :, 1], hsv[:, :, 2]
    m = np.where((v > white_v) & (s < white_s), 0, 255).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, _K3, iterations=1)
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, _K3, iterations=2)


def opacity_map(bgr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """
    픽셀별 '불투명도'(잉크가 얼마나 확실히 덮나) 0~255.
      = max(어둡기, 채도)  -> 새까맣거나 진한 컬러=높음, 옅은 파스텔/수채=낮음.
    배경(실루엣 밖)은 0. 알파 경로에서도 마스크 안쪽만 보므로 배경 RGB 와 무관하다.
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    op = np.maximum(255 - hsv[:, :, 2], hsv[:, :, 1]).astype(np.uint8)
    op[mask == 0] = 0
    return op


# --- 쿼리(사용자가 그린 마스크) 전처리. 원본과 동일 ------------------------

def _binarize(mask_png: np.ndarray) -> np.ndarray:
    if mask_png.ndim == 3:
        mask_png = cv2.cvtColor(mask_png, cv2.COLOR_BGR2GRAY)
    _, m = cv2.threshold(mask_png, 10, 255, cv2.THRESH_BINARY)
    return m


def query_mask_from_strokes(mask_png: np.ndarray) -> np.ndarray:
    """그린 선 -> 안쪽까지 채운 이진 마스크. (게이트 모드)"""
    m = cv2.dilate(_binarize(mask_png), _K5, iterations=2)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(m)
    if cnts:
        cv2.drawContours(filled, cnts, -1, 255, thickness=cv2.FILLED)
    return filled if filled.any() else m


def query_line_from_strokes(mask_png: np.ndarray) -> np.ndarray:
    """
    그린 선 -> 획 궤적 그대로의 이진 마스크. (선 모드)
    안쪽을 채우지 않는다. 원을 그리면 '원판'이 아니라 '원 테두리'로 남는다.
    """
    return cv2.morphologyEx(_binarize(mask_png), cv2.MORPH_CLOSE, _K3, iterations=1)
