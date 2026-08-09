"""
커버업 채점 엔진. coverup3/python-search/app/coverup.py 의 line 모드 수식을 그대로
옮기고 '후보 행만 도는' 형태로 바꿨다.

원본과의 차이 (수식은 동일, 접근 방식만 다름)
  ① 전수 순회 -> 후보 행 배열(rows)을 받아 그 행만 계산한다. 원본의 line 모드는
     전체를 돌았다. 수백만 장에서는 O(N) 자체가 불가능하다.
  ② soft_ink 전역 캐시(장당 41MB, tau 바뀌면 전량 재계산)를 없앴다. 후보 K개의
     거리맵만 mmap 에서 읽어 exp() 를 그 자리에서 취한다. 2,000장이면 8.2M 원소로
     수 ms 다. 저장도 안 하고 상주도 안 한다.
  ③ 거리변환을 float32 로 저장하지 않고 1/8 px uint8 로 정량화해 읽는다(store 참고).
  ④ allow(카테고리 하드필터)를 뺐다. 필터링은 1단계 후보 선정에서 끝낸다
     (pgvector 쿼리의 WHERE 로 내려가므로 엔진이 알 필요가 없다).
  ⑤ 결과 id 가 파일 상대경로가 아니라 tattoo_seq(int) 다.
  ⑥ 면(gate) 모드를 걷어냈다. 제품에서 선 모드만 노출하므로 검색 경로가 죽어 있었다.
     스토어 포맷(FORMAT=2)은 그대로라 norms·emb_gate 컬럼은 계속 기록된다 —
     되살릴 때 재색인이 필요 없게 하기 위함이다.
"""

from __future__ import annotations

import numpy as np
import cv2

from .store import FeatureStore, GRID, AREA

NORM = GRID
FILL = 0.82          # 캔버스 채움 비율
LINE_DUP_COSINE = 0.93
LINE_TAU = 2.5       # exp(-거리/TAU) 감쇠 폭
FAR = 1e3
ROT_STEP = 90        # 선 모드 회전 탐색 간격(도)


# ---------------------------------------------------------------------------
# 정규화 — 원본 _normalize_pair 와 동일
# ---------------------------------------------------------------------------
def normalize_pair(mask: np.ndarray, opac: np.ndarray | None = None,
                   size: int = NORM, fill: float = FILL, line: bool = False,
                   extra_deg: float = 0.0):
    z = np.zeros((size, size), np.uint8)
    M = cv2.moments(mask, binaryImage=True)
    if M["m00"] == 0:
        return z, (z.copy() if opac is not None else None)
    cx, cy = M["m10"] / M["m00"], M["m01"] / M["m00"]
    mu20, mu02, mu11 = M["mu20"] / M["m00"], M["mu02"] / M["m00"], M["mu11"] / M["m00"]
    angle = 0.5 * np.arctan2(2 * mu11, mu20 - mu02)

    h, w = mask.shape
    rot = cv2.getRotationMatrix2D((cx, cy), np.degrees(angle) + extra_deg, 1.0)
    mr = cv2.warpAffine(mask, rot, (w, h), flags=cv2.INTER_NEAREST)
    orr = cv2.warpAffine(opac, rot, (w, h), flags=cv2.INTER_LINEAR) if opac is not None else None

    ys, xs = np.nonzero(mr)
    if len(xs) < 5:
        return z, (z.copy() if opac is not None else None)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    mc = mr[y0:y1 + 1, x0:x1 + 1]
    ch, cw = mc.shape
    scale = (size * fill) / max(ch, cw)
    nh, nw = max(1, int(round(ch * scale))), max(1, int(round(cw * scale)))
    # line=True: 면적 평균으로 축소해 얇은 선이 끊기지 않게 한다.
    mcR = cv2.resize(mc, (nw, nh),
                     interpolation=cv2.INTER_AREA if line else cv2.INTER_NEAREST)

    cm = np.zeros((size, size), np.uint8)
    oy, ox = (size - nh) // 2, (size - nw) // 2
    cm[oy:oy + nh, ox:ox + nw] = mcR
    norm_mask = (cm > 0).astype(np.uint8)

    norm_opac = None
    if opac is not None:
        ocR = cv2.resize(orr[y0:y1 + 1, x0:x1 + 1], (nw, nh), interpolation=cv2.INTER_LINEAR)
        co = np.zeros((size, size), np.uint8)
        co[oy:oy + nh, ox:ox + nw] = ocR
        norm_opac = co
    return norm_mask, norm_opac


def normalize_line(mask: np.ndarray, extra_deg: float = 0.0) -> np.ndarray:
    return normalize_pair(mask, None, line=True, extra_deg=extra_deg)[0]


def dist_to_ink(binary: np.ndarray) -> np.ndarray:
    """각 픽셀에서 가장 가까운 잉크까지의 유클리드 거리맵."""
    if binary.max() == 0:
        return np.full(binary.shape, FAR, "float32")
    inv = np.where(binary > 0, 0, 255).astype(np.uint8)
    return cv2.distanceTransform(inv, cv2.DIST_L2, 3)


def line_variants(mask: np.ndarray, step: int = ROT_STEP) -> list[np.ndarray]:
    """
    쿼리를 step도씩 돌려가며 정규화한 것 + 각각의 좌우반전.

    주축 회전을 쓰는데 삼각형·정사각형처럼 2차 모멘트가 등방적인 형태는 주축이
    정의되지 않아 각도가 아무 값이나 나온다. 90도 단위 변형만으로는 그 잔차를 못
    덮으므로 회전 자체를 탐색한다.
    """
    out, seen = [], set()
    for deg in range(0, 360, max(1, step)):
        v = normalize_line(mask, extra_deg=float(deg))
        if v.sum() == 0:
            continue
        for c in (v, np.ascontiguousarray(v[:, ::-1])):
            key = c.tobytes()
            if key not in seen:          # 대칭 형태는 중복 변형이 나온다
                seen.add(key)
                out.append(c)
    return out


def bbox_aspect(binary: np.ndarray) -> float:
    """채워진 영역 종횡비 min/max(0~1). 1=정사각, 0=납작."""
    ys, xs = np.nonzero(binary)
    if len(xs) == 0:
        return 0.0
    h = float(ys.max() - ys.min() + 1)
    w = float(xs.max() - xs.min() + 1)
    return min(h, w) / max(h, w)


def _aspects(flat: np.ndarray) -> np.ndarray:
    """(k, 4096) 0/1 -> 행별 bbox 종횡비. bbox_aspect 를 벡터화한 것."""
    g = flat.reshape(-1, GRID, GRID) > 0
    ra, ca = g.any(axis=2), g.any(axis=1)
    has = ra.any(axis=1)
    y0 = ra.argmax(axis=1)
    y1 = GRID - 1 - ra[:, ::-1].argmax(axis=1)
    x0 = ca.argmax(axis=1)
    x1 = GRID - 1 - ca[:, ::-1].argmax(axis=1)
    h = (y1 - y0 + 1).astype(np.float32)
    w = (x1 - x0 + 1).astype(np.float32)
    return np.where(has, np.minimum(h, w) / np.maximum(h, w), 0.0).astype(np.float32)


# ---------------------------------------------------------------------------
# 점수순으로 훑되 시그니처가 거의 같은 도안(중복/near-dup)은 스킵
# ---------------------------------------------------------------------------
def _pick_top(final: np.ndarray, sig: np.ndarray, top_k: int, thr: float) -> list[int]:
    # 노름은 실제로 검사하는 행만 구한다. 원본은 (N,4096) 전체의 노름을 미리
    # 계산했는데 루프는 top_k 채우면 끝나므로 보통 수십 행만 본다.
    kept, kept_sig = [], []
    for o in np.argsort(-final, kind="stable"):
        o = int(o)
        s = sig[o]
        n = float(np.linalg.norm(s)) + 1e-6
        if any(float(s @ ks) / (n * kn) > thr for ks, kn in kept_sig):
            continue
        kept.append(o)
        kept_sig.append((s, n))
        if len(kept) >= top_k:
            break
    return kept


# ---------------------------------------------------------------------------
# 선 모드: 그린 '선 형태'와 도안의 선 구조를 chamfer로 비교해 랭킹
#   rec (재현): 내가 그린 선이 도안 선 위에 얼마나 얹히나
#   prec(정밀): 도안 선이 내가 그린 형태를 얼마나 벗어나지 않나
#   F = 조화평균. 원을 그리면 '원판'이 아니라 '원 테두리' 도안이 위로 온다.
# ---------------------------------------------------------------------------
def line_search(scar_line: np.ndarray, store: FeatureStore, rows: np.ndarray,
                top_k: int = 16, w_shape: float = 1.0, w_cover: float = 0.0,
                tau: float = LINE_TAU, rot_step: int = ROT_STEP,
                variants: list[np.ndarray] | None = None) -> list[dict]:
    # variants(회전·반전 정규화 8종)는 1단계 프로브를 만들 때 이미 계산했으면 받는다.
    if variants is None:
        variants = line_variants(scar_line, rot_step)
    if not variants or len(rows) == 0:
        return []

    rows = np.asarray(rows, np.int64)
    k = len(rows)
    Lflat = store.line(rows).astype("float32")               # (k,4096) 0/1
    Lsum = np.maximum(Lflat.sum(axis=1), 1.0)

    # rec 는 '쿼리 잉크가 있는 칸'의 근접도만 쓴다. 모든 변형의 잉크 합집합을 모아
    # 그 칸만 읽어 exp() 한다 — (k,4096) 전체를 펼치면 후보 2,000장에 8.2M 번
    # exp() 를 하게 되는데 실제로 필요한 건 보통 그 1/5 이하다.
    union = np.zeros(AREA, bool)
    for v in variants:
        union |= v.reshape(-1) > 0
    cols = np.nonzero(union)[0]
    colpos = np.full(AREA, -1, np.int32)
    colpos[cols] = np.arange(len(cols), dtype=np.int32)
    near_sub = np.exp(-store.ldist_cols(rows, cols) / max(tau, 1e-3))   # (k,|cols|)

    # 종횡비 게이트: 납작한 도안(한 줄 레터링 등)이 십자 획 안에 숨어 prec=1.0 을
    # 받는 일을 막는다. 회전에 무관하도록 min/max 비로 비교.
    qar = bbox_aspect(variants[0])
    LAR = _aspects(Lflat)
    ar_sim = np.minimum(qar, LAR) / np.maximum(np.maximum(qar, LAR), 1e-6)
    ar_gate = 0.5 + 0.5 * ar_sim

    best_f = np.full(k, -1.0, "float32")
    best_rec = np.zeros(k, "float32")
    best_prec = np.zeros(k, "float32")
    best_var = np.zeros(k, "int32")

    for vi, v in enumerate(variants):
        vidx = np.nonzero(v.reshape(-1))[0]
        kk = max(len(vidx), 1)
        rec = near_sub[:, colpos[vidx]].sum(axis=1, dtype="float32") / kk
        near_q = np.exp(-dist_to_ink(v) / max(tau, 1e-3)).reshape(-1).astype("float32")
        prec = (Lflat @ near_q) / Lsum
        f = np.where(rec + prec > 0, 2 * rec * prec / (rec + prec + 1e-6), 0.0)

        better = f > best_f
        best_f = np.where(better, f, best_f)
        best_rec = np.where(better, rec, best_rec)
        best_prec = np.where(better, prec, best_prec)
        best_var = np.where(better, vi, best_var)

    # 잉크 밀도는 변형마다 다시 구할 필요가 없다(변형 1개당 비용의 70%였음).
    # 이긴 변형별로 묶어 도안마다 정확히 한 번씩만 계산한다.
    opac = store.opac(rows).astype("float32") / 255.0
    best_cov = np.zeros(k, "float32")
    best_weak = np.zeros(k, "float32")
    for vi in np.unique(best_var):
        sel = best_var == vi
        sub = opac[sel][:, variants[int(vi)].reshape(-1) > 0]
        best_cov[sel] = sub.mean(axis=1)
        best_weak[sel] = np.percentile(sub, 10, axis=1)

    best_f = np.maximum(best_f, 0.0) * ar_gate     # 변형과 무관하므로 순위 확정 후 한 번
    final = w_shape * best_f + w_cover * best_cov
    # 비침 페널티는 '덮기' 관심사라서 밀도 비중만큼만 적용한다. 그냥 곱하면
    # 선 모드에서 원하는 얇은 라인워크가 전부 깎여 나간다.
    final = final * (1.0 - w_cover * (1.0 - np.clip(best_weak * 4.0, 0.5, 1.0)))

    kept = _pick_top(final, Lflat, top_k, LINE_DUP_COSINE)
    keys = store.keys
    return [{
        "key": int(keys[rows[o]]),
        "score": round(float(final[o]), 4),
        "shape": round(float(best_f[o]), 3),
        "cover": round(float(best_cov[o]), 3),
        "weak": round(float(best_weak[o]), 3),
        "rec": round(float(best_rec[o]), 3),
        "prec": round(float(best_prec[o]), 3),
    } for o in kept]
