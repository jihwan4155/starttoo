"""
1단계 후보 추림용 서술자.

## 설계 근거 (실측으로 정한 것)

처음에는 Fourier-Mellin(극좌표 FFT 크기)로 회전 불변 형태 임베딩을 만들었다.
회전 불변성 자체는 잘 됐다(16 도형 × 회전/반전에서 최저 코사인 0.9586). 그런데
**recall 이 형편없었다.**

    N=10,000 · 정답 = 전수 top-16 · 24 쿼리
                        K=100   K=200   K=500   K=1000  K=2000
    Fourier-Mellin      0.432   0.570   0.737   0.820   0.945
    chamfer 풀링 16x16  0.677   0.760   0.893   0.943   1.000

이유: 엔진 점수는 **soft chamfer 의 rec/prec 조화평균**이고 정규화도 bbox 기준인데,
Fourier-Mellin 은 무게중심+반지름 기준의 범용 형태 서술자다. 애초에 다른 함수라서
순위가 정렬될 이유가 없다.

## 채택안 — 점수 함수에서 유도한다

    rec = (1/|Q|) Σ_{p∈Q} nearInk_D(p) = dot(Q지시함수, nearInk_D) / |Q|

**rec 은 이미 내적이다.** 양쪽을 nearInk = exp(-거리/tau) 로 표현해 평균 풀링하면
코사인이 chamfer 유사도를 근사한다. prec 은 반대 방향 내적이라 같은 대칭 표현이
둘 다 담는다. 회전은 2단계와 똑같이 처리한다 — 쿼리 변형마다 조회해 유사도를 max.

그리고 도안 서술자는 **이미 저장된 ldist 에서 그대로 유도된다.** 새 특징 계산이
필요 없다.

## 실제 품질 영향 (N=10,000)

    K/N     결과개수  top1일치  1위점수차  겹친자리 최악 점수차
    1%      11.5      91.7%     0.0000     0.0428
    5%      14.3      95.8%     0.0000     0.0153
    10%     16.0      95.8%     0.0000     0.0144
    20%     16.0      95.8%     0.0000     0.0000

**1위 점수는 모든 K 에서 전수와 완전히 같다.** top1 키 불일치는 점수 동점 스왑이다.
집합 일치율(recall)이 1.0 에 못 가는 건 원리적이다 — 엔진의 prec 은
`dot(도안잉크, nearQ)/|도안잉크|` 라서 **잉크가 아주 적은 도안이 형태와 무관하게
prec≈1.0 을 받는다.** 그런 축퇴 승자는 어떤 형태 서술자로도 못 찾는다. 그래서
집합 일치율이 아니라 점수 손실로 판단해야 한다.

실제 제약은 **중복제거(코사인>0.93) 후 16개가 남느냐**이고, 위 표의 결과 개수가
그것이다. 합성 도안은 도형 16종뿐이라 같은 종류가 수백 장씩 있어 중복제거가
과하게 걷어낸다 — 실제 도안은 다양해서 더 작은 K 로 채워진다. 안전하게는 엔진에
top_k 를 넉넉히(20~30) 요청하고 팀 서버가 16개로 줄인다.
"""

from __future__ import annotations

import numpy as np
import cv2

from .store import GRID, AREA, EMB_DIM

POOL = 16                       # 64x64 -> 16x16 평균 풀링
TAU_REF = 2.5                   # 서술자용 고정 tau (엔진 기본값과 같게)

assert POOL * POOL == EMB_DIM, f"POOL^2({POOL * POOL}) != EMB_DIM({EMB_DIM})"


def pool_l2(flat: np.ndarray) -> np.ndarray:
    """(n, 4096) -> (n, POOL*POOL) 평균 풀링 + L2 정규화."""
    if flat.ndim == 1:
        flat = flat[None, :]
    n, s = flat.shape[0], GRID // POOL
    v = flat.reshape(n, POOL, s, POOL, s).mean(axis=(2, 4)).reshape(n, EMB_DIM)
    return (v / np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)).astype(np.float32)


def line_descriptor(ldist_px: np.ndarray) -> np.ndarray:
    """
    도안 선맵의 거리변환(px) -> 서술자. store 에 저장된 ldist 에서 바로 유도한다.
    exp(-d/TAU_REF) 를 풀링하므로 코사인이 chamfer rec/prec 을 근사한다.
    """
    return pool_l2(np.exp(-np.asarray(ldist_px, np.float32) / TAU_REF))


def gate_descriptor(norms: np.ndarray) -> np.ndarray:
    """
    정규화 실루엣 -> 서술자.

    <p>면(gate) 모드 검색 경로는 걷어냈지만 스토어 포맷(FORMAT=2)의 emb_gate 컬럼은
    남아 있어 색인할 때 계속 채워야 한다. 포맷을 유지하는 덕에 면 모드를 되살릴 때
    전 도안 재색인이 필요 없다. 포맷을 올려 이 컬럼을 지우면 이 함수도 함께 지운다.
    """
    return pool_l2(np.asarray(norms, np.float32))


def line_probes(variants: list[np.ndarray], tau: float = TAU_REF) -> np.ndarray:
    """
    쿼리 변형들의 서술자 (v, EMB_DIM). 2단계가 변형별 최대를 취하는 것과 같은 규칙을
    쓰려면 각 변형으로 조회하고 유사도를 max 해야 한다.
    """
    from .engine import dist_to_ink                  # 순환 임포트 회피
    near = np.stack([np.exp(-dist_to_ink(v).reshape(-1) / max(tau, 1e-3))
                     for v in variants])
    return pool_l2(near)


def topk_multiprobe(probes: np.ndarray, bank: np.ndarray, k: int,
                    allow: np.ndarray | None = None) -> np.ndarray:
    """
    프로브 여러 개로 조회해 도안별 최대 유사도로 top-k. pgvector 를 쓰지 않는 경로다
    (~50만 장까지. 그 위는 아래처럼 프로브마다 조회하고 합집합을 취한다).

        SELECT tattoo_seq FROM tattoo_embeddings
        WHERE  embedding_model_code = 'coverup_chamfer_v1'
        ORDER  BY embedding <=> %s        -- 프로브 1개
        LIMIT  %s;                        -- 프로브 수만큼 반복 후 UNION
    """
    if bank.shape[0] == 0 or k <= 0:
        return np.empty(0, np.int64)
    sims = (np.asarray(bank) @ np.asarray(probes).T).max(axis=1)
    if allow is not None:
        sims = np.where(allow, sims, -np.inf)
    k = min(k, int(np.isfinite(sims).sum()))
    if k <= 0:
        return np.empty(0, np.int64)
    part = np.argpartition(-sims, k - 1)[:k]
    return part[np.argsort(-sims[part], kind="stable")].astype(np.int64)


# ---------------------------------------------------------------------------
# 기각된 대안 — 남겨 두는 이유는 위 문서의 근거를 재현할 수 있게 하기 위함이다.
# 회전 불변성은 좋지만(최저 코사인 0.9586) recall 이 chamfer 풀링보다 크게 낮다.
# ---------------------------------------------------------------------------
FM_ANG, FM_RAD, FM_FREQ, FM_CANON = 64, 16, 8, 128


def fourier_mellin(mask: np.ndarray) -> np.ndarray:
    """
    극좌표 FFT 크기 기반 회전·반전 불변 서술자 (기각안).
    ① 무게중심 이동 + 반지름 정규화  ② 극좌표 -> 회전이 각도축 순환이동이 됨
    ③ 각도축 FFT 크기 -> 순환이동 불변  ④ 실수 신호 역순 DFT 는 켤레라 반전도 불변
    """
    m = (mask > 0).astype(np.float32)
    ys, xs = np.nonzero(m)
    if len(xs) < 5:
        return np.zeros(FM_FREQ * FM_RAD, np.float32)
    cx, cy = float(xs.mean()), float(ys.mean())
    r = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    rmax = float(np.percentile(r, 99))
    if rmax < 1e-6:
        return np.zeros(FM_FREQ * FM_RAD, np.float32)

    s = FM_CANON / (2.0 * rmax * 1.05)
    if s < 1.0:
        k = max(1, int(round(1.0 / s)))
        if k > 1:
            m = cv2.blur(m, (k, k))
    M = np.array([[s, 0.0, FM_CANON / 2.0 - s * cx],
                  [0.0, s, FM_CANON / 2.0 - s * cy]], np.float32)
    sq = cv2.warpAffine(m, M, (FM_CANON, FM_CANON), flags=cv2.INTER_LINEAR,
                        borderMode=cv2.BORDER_CONSTANT, borderValue=0.0)
    polar = cv2.warpPolar(sq, (FM_RAD, FM_ANG), (FM_CANON / 2.0, FM_CANON / 2.0),
                          FM_CANON / 2.0, cv2.INTER_LINEAR + cv2.WARP_FILL_OUTLIERS)
    v = np.log1p(np.abs(np.fft.rfft(polar, axis=0)[:FM_FREQ])).ravel().astype(np.float32)
    n = float(np.linalg.norm(v))
    return v / n if n > 1e-9 else np.zeros(FM_FREQ * FM_RAD, np.float32)
