"""
검색 오케스트레이션 — 1단계 후보 추림과 2단계 정확 재채점을 엮는다.

여기가 '1단계를 꺼둔 상태로 런칭' 스위치가 있는 곳이다. 도안이 적을 때는 전수
정밀 채점이 더 정확하고 빠르므로 1단계를 건너뛴다. 도안이 늘면 켜기만 하면 되고,
2단계 코드는 이미 후보 배열을 받는 형태라 바뀌지 않는다.

STAGE1_MIN_ROWS 아래에서는 자동으로 꺼진다. 1단계에서 놓친 도안은 2단계가 절대
복구하지 못하므로, 켜기 전에 tests/bench_recall.py 로 recall 곡선을 확인해야 한다.
"""

from __future__ import annotations

import time

import cv2
import numpy as np

from . import engine, features
from .embed import gate_probes, line_probes, topk_multiprobe
from .store import FeatureStore, LDIST_MAX_TAU

STAGE1_MIN_ROWS = 30_000    # 이 아래면 전수 탐색이 더 낫다
K_MIN = 2_000               # 후보 최소 개수
K_RATIO = 0.003             # 후보 = max(K_MIN, N * 0.3%) — N 이 커지면 함께 키운다

# 프로세스 안 브루트포스 코사인의 상한. 256차원 float32(EMB_DIM) 면 50만 장이 512MB 로
# 요청마다 그만큼 읽는다(RAM 에 캐시되면 공짜). 이 위로는 요청당 GB 를 읽게 되므로
# pgvector HNSW 로 후보를 받아야 한다 — 조용히 메모리를 터뜨리지 않고 여기서 막는다.
BRUTE_MAX_ROWS = 500_000


class BadRequest(ValueError):
    """400 으로 내보낼 입력 오류."""


class Searcher:
    def __init__(self, store: FeatureStore, stage1: str = "auto",
                 k_min: int = K_MIN, k_ratio: float = K_RATIO):
        if stage1 not in ("auto", "on", "off"):
            raise ValueError("stage1 은 auto/on/off")
        self.store = store
        self.stage1 = stage1
        self.k_min = k_min
        self.k_ratio = k_ratio

    # -- 후보 개수 ---------------------------------------------------------
    def candidate_k(self, n: int) -> int:
        return max(self.k_min, int(n * self.k_ratio))

    def stage1_on(self, n_alive: int) -> bool:
        if self.stage1 == "on":
            return True
        if self.stage1 == "off":
            return False
        return n_alive > STAGE1_MIN_ROWS

    # -- 검색 -------------------------------------------------------------
    def search(self, mask_png: bytes, mode: str = "line", top_k: int = 16,
               w_shape: float = 1.0, w_cover: float = 0.0,
               tau: float = engine.LINE_TAU,
               min_fill: float = engine.MIN_FILL,
               min_opacity: float = engine.MIN_OPACITY,
               candidates: np.ndarray | None = None) -> dict:
        """
        candidates 를 넘기면 1단계를 건너뛰고 그 행만 재채점한다. 운영에서 pgvector
        + SQL WHERE 로 후보를 고른 경우가 이 경로다(엔진이 DB 를 몰라도 된다).
        """
        if mode not in ("line", "gate"):
            raise BadRequest(f"mode 는 line 또는 gate 여야 함: {mode}")
        if not 0 < tau <= LDIST_MAX_TAU:
            raise BadRequest(f"tau 는 0 초과 {LDIST_MAX_TAU} 이하여야 함: {tau}")

        # 다른 워커 프로세스가 색인/삭제한 것을 반영한다. stat 한 번이라 사실상 무료다.
        self.store.refresh()

        arr = cv2.imdecode(np.frombuffer(mask_png, np.uint8), cv2.IMREAD_GRAYSCALE)
        if arr is None or arr.size == 0:
            raise BadRequest("PNG 디코딩 실패")

        t0 = time.perf_counter()
        # 쿼리 정규화는 여기서 한 번만 한다. 1단계 프로브와 2단계 채점이 같은 것을 쓴다.
        if mode == "line":
            query = features.query_line_from_strokes(arr)
            variants = engine.line_variants(query, engine.ROT_STEP)
            probes = line_probes(variants, tau) if variants else None
            sn = None
        else:
            query = features.query_mask_from_strokes(arr)
            variants = None
            sn = engine.normalize_shape(query)
            probes = gate_probes(sn) if sn.sum() else None
        t_prep = time.perf_counter()

        rows, staged = self._candidates(mode, probes, min_fill, min_opacity, candidates)
        t_stage1 = time.perf_counter()

        if mode == "line":
            results = engine.line_search(query, self.store, rows, top_k,
                                         w_shape, w_cover, tau, variants=variants)
        else:
            results = engine.gate_search(query, self.store, rows, top_k, sn=sn)
        t_end = time.perf_counter()

        return {
            "mode": mode,
            "count": len(results),
            "results": results,
            "timing_ms": {
                "prepare": round((t_prep - t0) * 1000, 1),
                "stage1": round((t_stage1 - t_prep) * 1000, 1),
                "stage2": round((t_end - t_stage1) * 1000, 1),
                "total": round((t_end - t0) * 1000, 1),
            },
            "candidates": int(len(rows)),
            "stage1": staged,
        }

    def _candidates(self, mode: str, probes: np.ndarray | None,
                    min_fill: float, min_opacity: float,
                    given: np.ndarray | None) -> tuple[np.ndarray, str]:
        if given is not None:
            return np.asarray(given, np.int64), "given"

        # 게이트 1단계(fill/opacity)는 도안 자체 속성이라 쿼리와 무관하다. 운영에서는
        # 이 필터를 pgvector 쿼리의 WHERE 로 내려 O(N) 스캔 자체를 없앤다.
        rows = (self.store.gate_rows(min_fill, min_opacity) if mode == "gate"
                else self.store.alive_rows())
        if len(rows) == 0:
            return rows, "empty"

        if not self.stage1_on(len(rows)):
            return rows, "off"
        if len(rows) > BRUTE_MAX_ROWS:
            raise BadRequest(
                f"후보 대상 {len(rows):,}행 > 브루트포스 상한 {BRUTE_MAX_ROWS:,}. "
                "pgvector 로 후보를 골라 candidate_keys 로 넘겨야 한다")

        if probes is None or not np.any(probes):
            return rows, "off"          # 서술자를 못 만들면 전수로 떨어진다
        k = self.candidate_k(len(rows))
        if k >= len(rows):
            return rows, "off"
        # 부분집합이면 사본이 싸고, 거의 전체면 memmap 을 그대로 훑는 게 싸다.
        bank = self.store.emb(mode)
        if len(rows) * 2 < bank.shape[0]:
            picked = topk_multiprobe(probes, bank[rows], k)
            return rows[picked], "on"
        allow = np.zeros(bank.shape[0], bool)
        allow[rows] = True
        return topk_multiprobe(probes, bank, k, allow=allow), "on"
