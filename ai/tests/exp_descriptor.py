"""
1단계 서술자 비교 실험.

앞선 bench_recall 결과: Fourier-Mellin 임베딩의 recall 이 K/N=5% 에서도 0.75,
일부 쿼리는 0.000 이었다. 1단계에서 놓친 도안은 2단계가 복구하지 못하므로 이대로는
쓸 수 없다.

가설: 문제는 해상도가 아니라 **함수가 다르다**는 것이다.
  엔진 점수 = soft chamfer 의 rec/prec 조화평균. 정규화도 bbox 기준이다.
  Fourier-Mellin = 극좌표 FFT 크기. 정규화는 무게중심+반지름 기준.
  둘은 애초에 다른 것을 재고 있으므로 순위가 정렬될 이유가 없다.

대안(B): 서술자를 점수 함수에서 유도한다.
  rec  = (1/|Q|) Σ_{p∈Q} nearInk_D(p) = dot(Q지시함수, nearInk_D) / |Q|
  즉 rec 은 이미 **내적**이다. 양쪽을 nearInk = exp(-거리/tau) 로 표현하고 평균 풀링
  하면 코사인이 chamfer 유사도를 근사한다. prec 은 반대 방향 내적이라 대칭 표현이
  둘 다 담는다.
  회전은 2단계와 똑같이 처리한다 — 쿼리 변형 8개로 각각 조회하고 유사도를 max.

실행:  python -m tests.exp_descriptor [N] [쿼리수]
"""

from __future__ import annotations

import shutil
import sys
import tempfile
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import cv2                                                  # noqa: E402
from coverup import engine, features                         # noqa: E402
from coverup.builder import index_all                        # noqa: E402
from coverup.service import Searcher                         # noqa: E402
from coverup.store import FeatureStore                       # noqa: E402
from tests import synth                                      # noqa: E402

TOP_K = 16
TAU_REF = engine.LINE_TAU
POOLS = (8, 16)
KS = (100, 200, 500, 1000, 2000)


def pool_near(near_flat: np.ndarray, p: int) -> np.ndarray:
    """(n,4096) 근접도 -> (n, p*p) 평균 풀링 + L2 정규화."""
    n = near_flat.shape[0]
    s = 64 // p
    v = near_flat.reshape(n, p, s, p, s).mean(axis=(2, 4)).reshape(n, p * p)
    nrm = np.linalg.norm(v, axis=1, keepdims=True)
    return (v / np.maximum(nrm, 1e-9)).astype(np.float32)


def design_bank(store: FeatureStore, p: int) -> np.ndarray:
    """도안 서술자 — 저장된 ldist 에서 바로 유도한다(새 계산이 필요 없다)."""
    rows = np.arange(store.count)
    out = np.empty((store.count, p * p), np.float32)
    for i in range(0, store.count, 4096):            # 메모리 아끼려고 청크로
        chunk = rows[i:i + 4096]
        near = np.exp(-store.ldist(chunk) / TAU_REF)
        out[i:i + len(chunk)] = pool_near(near, p)
    return out


def query_probes(png: bytes, p: int) -> np.ndarray:
    """쿼리 변형 8개의 서술자. 2단계와 같은 변형 집합을 쓴다."""
    arr = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_GRAYSCALE)
    q = features.query_line_from_strokes(arr)
    variants = engine.line_variants(q, engine.ROT_STEP)
    near = np.stack([np.exp(-engine.dist_to_ink(v) / TAU_REF).reshape(-1)
                     for v in variants])
    return pool_near(near, p)


def main() -> int:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10_000
    n_q = int(sys.argv[2]) if len(sys.argv) > 2 else 24

    tmp = Path(tempfile.mkdtemp(prefix="coverup_desc_"))
    try:
        store = FeatureStore.create(tmp / "store", overwrite=True)
        t = time.perf_counter()
        index_all(store, ((k, png) for k, png, _ in
                          synth.corpus(n, seed=2024, under="black", size=192)),
                  batch=512)
        store = FeatureStore(tmp / "store")
        print(f"도안 {store.count}장 색인 {time.perf_counter() - t:.1f}s\n")

        rng = np.random.default_rng(77)
        queries = [synth.query_png(synth.SHAPES[i % len(synth.SHAPES)], brush=6,
                                   rot_deg=float(rng.uniform(0, 360)), rng=rng)
                   for i in range(n_q)]

        full = Searcher(store, stage1="off")
        t = time.perf_counter()
        truth = [{x["key"] for x in full.search(q, mode="line", top_k=TOP_K)["results"]}
                 for q in queries]
        print(f"정답(전수 top-{TOP_K}) {(time.perf_counter() - t) / n_q * 1000:.0f} ms/쿼리\n")

        keys = store.keys
        key2row = {int(k): i for i, k in enumerate(keys)}
        truth_rows = [np.array([key2row[k] for k in t_], np.int64) for t_ in truth]

        print(f"{'서술자':22} {'차원':>5} | " +
              " ".join(f"K={k:<5}" for k in KS))
        print("-" * (30 + 8 * len(KS)))

        # --- A: 현재 Fourier-Mellin (store.emb) ---
        bankA = np.asarray(store.emb)
        rowsA = []
        for p_ in (None,):
            recs = {k: [] for k in KS}
            for q, tr in zip(queries, truth_rows):
                arr = cv2.imdecode(np.frombuffer(q, np.uint8), cv2.IMREAD_GRAYSCALE)
                qm = features.query_line_from_strokes(arr)
                from coverup.embed import shape_embedding
                sims = bankA @ shape_embedding(qm)
                order = np.argsort(-sims)
                for k in KS:
                    recs[k].append(len(set(order[:k].tolist()) & set(tr.tolist())) / len(tr))
            rowsA.append(("A Fourier-Mellin", bankA.shape[1],
                          [float(np.mean(recs[k])) for k in KS],
                          [float(np.min(recs[k])) for k in KS]))

        # --- B: chamfer 풀링 (다중 프로브 max) ---
        rowsB = []
        for p in POOLS:
            bank = design_bank(store, p)
            recs = {k: [] for k in KS}
            for q, tr in zip(queries, truth_rows):
                probes = query_probes(q, p)             # (v, p*p)
                sims = (bank @ probes.T).max(axis=1)    # 변형 max — 2단계와 같은 규칙
                order = np.argsort(-sims)
                for k in KS:
                    recs[k].append(len(set(order[:k].tolist()) & set(tr.tolist())) / len(tr))
            rowsB.append((f"B chamfer pool {p}x{p}", p * p,
                          [float(np.mean(recs[k])) for k in KS],
                          [float(np.min(recs[k])) for k in KS]))

        for name, dim, means, mins in rowsA + rowsB:
            print(f"{name:22} {dim:>5} | " +
                  " ".join(f"{m:.3f}  " for m in means))
            print(f"{'  (최저)':22} {'':>5} | " +
                  " ".join(f"{m:.3f}  " for m in mins))
        print(f"\n(N={store.count}, 쿼리 {n_q}개, 정답 top-{TOP_K})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
