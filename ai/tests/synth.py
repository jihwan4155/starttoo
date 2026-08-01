"""
합성 도안·쿼리 생성기.

누끼(투명 PNG)를 **투명 영역 아래 RGB 가 검정인 것과 흰색인 것 두 가지로** 만든다.
이 둘은 이미지 뷰어에서 똑같이 보이지만 IMREAD_COLOR 로 읽으면 결과가 완전히
갈린다(검정이면 프레임 전체가 전경이 되어 fill=1.0/opacity=1.0 인 쓰레기가 된다).
알파 경로가 그 차이를 실제로 없애는지 검증하는 데 쓴다.
"""

from __future__ import annotations

import numpy as np
import cv2

# 앞 12종은 고정 도형, 뒤 4종은 파라미터가 연속적으로 변해 실제 도안처럼 다양하다.
# recall 벤치마크는 다양성이 낮으면 결과가 낙관적으로 나오므로 뒤쪽이 필요하다.
SHAPES = ("ring", "disc", "square_outline", "square_filled", "triangle",
          "ell", "ellipse_outline", "cross", "star", "bar", "arc", "blob",
          "petals", "scribble", "hatch", "spiral")


def _canvas(size: int) -> np.ndarray:
    return np.zeros((size, size), np.uint8)


def shape_mask(kind: str, size: int = 512, rot_deg: float = 0.0,
               scale: float = 0.7, thick: int = 10, rng=None) -> np.ndarray:
    """도안의 잉크 마스크(0/255)를 만든다. rot_deg 로 돌린다."""
    rng = rng or np.random.default_rng(0)
    m = _canvas(size)
    c = size // 2
    r = int(size * scale / 2)

    if kind == "ring":
        cv2.circle(m, (c, c), r, 255, thick)
    elif kind == "disc":
        cv2.circle(m, (c, c), r, 255, -1)
    elif kind == "square_outline":
        cv2.rectangle(m, (c - r, c - r), (c + r, c + r), 255, thick)
    elif kind == "square_filled":
        cv2.rectangle(m, (c - r, c - r), (c + r, c + r), 255, -1)
    elif kind == "triangle":
        pts = np.array([[c, c - r], [c - r, c + r], [c + r, c + r]], np.int32)
        cv2.polylines(m, [pts], True, 255, thick)
    elif kind == "ell":
        cv2.line(m, (c - r, c - r), (c - r, c + r), 255, thick)
        cv2.line(m, (c - r, c + r), (c + r, c + r), 255, thick)
    elif kind == "ellipse_outline":
        cv2.ellipse(m, (c, c), (r, int(r * 0.55)), 0, 0, 360, 255, thick)
    elif kind == "cross":
        cv2.line(m, (c - r, c), (c + r, c), 255, thick)
        cv2.line(m, (c, c - r), (c, c + r), 255, thick)
    elif kind == "star":
        pts = []
        for i in range(10):
            a = -np.pi / 2 + i * np.pi / 5
            rr = r if i % 2 == 0 else r * 0.45
            pts.append([int(c + rr * np.cos(a)), int(c + rr * np.sin(a))])
        cv2.polylines(m, [np.array(pts, np.int32)], True, 255, thick)
    elif kind == "bar":
        cv2.rectangle(m, (c - r, c - thick), (c + r, c + thick), 255, -1)
    elif kind == "arc":
        cv2.ellipse(m, (c, c), (r, r), 0, 20, 250, 255, thick)
    elif kind == "blob":
        pts = []
        for i in range(9):
            a = i * 2 * np.pi / 9
            rr = r * float(rng.uniform(0.55, 1.0))
            pts.append([int(c + rr * np.cos(a)), int(c + rr * np.sin(a))])
        cv2.fillPoly(m, [np.array(pts, np.int32)], 255)
    elif kind == "petals":
        # n겹 로제트. n 이 연속적으로 바뀌어 각도 주파수가 다양해진다.
        n = int(rng.integers(3, 9))
        t = np.linspace(0, 2 * np.pi, 400)
        rr = r * (0.45 + 0.55 * np.abs(np.cos(n * t / 2)))
        pts = np.stack([c + rr * np.cos(t), c + rr * np.sin(t)], 1).astype(np.int32)
        cv2.polylines(m, [pts], True, 255, thick)
    elif kind == "scribble":
        for _ in range(int(rng.integers(2, 5))):
            k = int(rng.integers(3, 7))
            pts = (rng.uniform(c - r, c + r, size=(k, 2))).astype(np.int32)
            cv2.polylines(m, [pts], False, 255, thick)
    elif kind == "hatch":
        n = int(rng.integers(3, 8))
        for i in range(n):
            y = c - r + int(2 * r * (i + 0.5) / n)
            cv2.line(m, (c - r, y), (c + r, y), 255, thick)
        for i in range(int(rng.integers(1, 4))):
            x = c - r + int(2 * r * (i + 0.5) / 3)
            cv2.line(m, (x, c - r), (x, c + r), 255, thick)
    elif kind == "spiral":
        turns = float(rng.uniform(1.5, 4.0))
        t = np.linspace(0, turns * 2 * np.pi, 500)
        rr = r * t / t[-1]
        pts = np.stack([c + rr * np.cos(t), c + rr * np.sin(t)], 1).astype(np.int32)
        cv2.polylines(m, [pts], False, 255, thick)
    else:
        raise ValueError(kind)

    if rot_deg:
        M = cv2.getRotationMatrix2D((c, c), rot_deg, 1.0)
        m = cv2.warpAffine(m, M, (size, size), flags=cv2.INTER_NEAREST)
    return m


def cutout_png(mask: np.ndarray, ink=(30, 30, 30), under: str = "black") -> bytes:
    """
    누끼 PNG(RGBA) 바이트. under 가 투명 영역 아래 RGB 를 정한다.
      "black" -> (0,0,0)      IMREAD_COLOR 로 읽으면 전경으로 잡혀 인덱스가 오염된다
      "white" -> (255,255,255) IMREAD_COLOR 로 읽어도 정상 동작한다
    알파 경로를 쓰면 둘 다 같은 결과가 나와야 한다.
    """
    h, w = mask.shape
    fill = 0 if under == "black" else 255
    bgra = np.full((h, w, 4), fill, np.uint8)
    bgra[:, :, 3] = 0
    sel = mask > 0
    bgra[sel, 0], bgra[sel, 1], bgra[sel, 2] = ink
    bgra[sel, 3] = 255
    return cv2.imencode(".png", bgra)[1].tobytes()


def white_bg_png(mask: np.ndarray, ink=(30, 30, 30)) -> bytes:
    """알파 없는 흰 배경 도안(원본 coverup3 과 같은 형식). parity 테스트용."""
    h, w = mask.shape
    bgr = np.full((h, w, 3), 255, np.uint8)
    sel = mask > 0
    bgr[sel, 0], bgr[sel, 1], bgr[sel, 2] = ink
    return cv2.imencode(".png", bgr)[1].tobytes()


def white_bg_bgr(mask: np.ndarray, ink=(30, 30, 30)) -> np.ndarray:
    h, w = mask.shape
    bgr = np.full((h, w, 3), 255, np.uint8)
    sel = mask > 0
    bgr[sel, 0], bgr[sel, 1], bgr[sel, 2] = ink
    return bgr


def query_png(kind: str, w: int = 420, h: int = 520, brush: int = 6,
              rot_deg: float = 0.0, rng=None) -> bytes:
    """
    프론트가 만드는 것과 같은 형식의 쿼리 마스크: 검은 배경 + 흰 획, 420x520.
    도형을 캔버스 비율에 맞춰 그린다.
    """
    m = shape_mask(kind, size=max(w, h), rot_deg=rot_deg, scale=0.62,
                   thick=brush, rng=rng)
    m = m[(max(w, h) - h) // 2:(max(w, h) - h) // 2 + h,
          (max(w, h) - w) // 2:(max(w, h) - w) // 2 + w]
    return cv2.imencode(".png", m)[1].tobytes()


def corpus(n: int, seed: int = 0, under: str = "black", size: int = 384):
    """
    (key, png_bytes, kind) 목록. key 는 1부터. 도형·회전·크기·굵기·색을 섞는다.
    """
    rng = np.random.default_rng(seed)
    out = []
    for i in range(n):
        kind = SHAPES[i % len(SHAPES)]
        mask = shape_mask(kind, size=size,
                          rot_deg=float(rng.uniform(0, 360)),
                          scale=float(rng.uniform(0.5, 0.85)),
                          thick=int(rng.integers(6, 16)), rng=rng)
        ink = tuple(int(v) for v in rng.integers(10, 90, 3))
        out.append((i + 1, cutout_png(mask, ink, under), kind))
    return out
