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

## 공정성을 위해 맞춘 것

  · FM 과 chamfer 를 **같은 입력**(정규화된 64x64 선맵)에서 뽑는다. 전처리가
    동일하므로 차이는 서술자 함수 하나로 좁혀진다. 이 입력은 이미 주축 정렬을
    거쳤으므로 FM 에 유리한 쪽으로 관대한 설정이다.
  · FM 은 프로브 1개다(회전 불변이 존재 이유이므로 변형 탐색을 주지 않는다).
    chamfer 는 2단계와 같은 변형 집합으로 다중 프로브 max 를 쓴다.
  · 차원: FM = FM_FREQ(8) x FM_RAD(16) = 128
          chamfer pool p x p = p^2  ->  8x8 = 64, 16x16 = 256
    8x8(64차원)은 FM 의 절반이다. 여기서도 이기면 '차원이 많아서'가 아니다.

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
from coverup.embed import fourier_mellin                     # noqa: E402
from coverup.service import Searcher                         # noqa: E402
from coverup.store import GRID, FeatureStore                 # noqa: E402
from tests import synth                                      # noqa: E402

TOP_K = 16
TAU_REF = engine.LINE_TAU
POOLS = (8, 16)
KS = (100, 200, 500, 1000, 2000)


def pool_near(near_flat: np.ndarray, p: int) -> np.ndarray:
    """(n,4096) 근접도 -> (n, p*p) 평균 풀링 + L2 정규화."""
    n = near_flat.shape[0]
    s = GRID // p
    v = near_flat.reshape(n, p, s, p, s).mean(axis=(2, 4)).reshape(n, p * p)
    nrm = np.linalg.norm(v, axis=1, keepdims=True)
    return (v / np.maximum(nrm, 1e-9)).astype(np.float32)


def design_bank_chamfer(store: FeatureStore, p: int) -> np.ndarray:
    """도안 서술자 — 저장된 ldist 에서 바로 유도한다(새 계산이 필요 없다)."""
    rows = np.arange(store.count)
    out = np.empty((store.count, p * p), np.float32)
    for i in range(0, store.count, 4096):            # 메모리 아끼려고 청크로
        chunk = rows[i:i + 4096]
        near = np.exp(-store.ldist(chunk) / TAU_REF)
        out[i:i + len(chunk)] = pool_near(near, p)
    return out


def design_bank_fm(store: FeatureStore) -> np.ndarray:
    """
    도안 서술자 — 정규화된 선맵(64x64)에 Fourier-Mellin.

    chamfer 쪽과 같은 선맵에서 뽑아 전처리를 맞춘다. FM 은 내부에서 무게중심+반지름
    으로 다시 정규화하므로, 이 입력은 '주축 정렬까지 마친 상태'를 FM 에 얹어 주는
    관대한 조건이다.
    """
    rows = np.arange(store.count)
    out = np.empty((store.count, 8 * 16), np.float32)
    for i in range(0, store.count, 4096):
        chunk = rows[i:i + 4096]
        lines = store.line(chunk).reshape(-1, GRID, GRID)
        for j, lm in enumerate(lines):
            out[i + j] = fourier_mellin(lm)
    return out


def query_probes_chamfer(png: bytes, p: int) -> np.ndarray:
    """쿼리 변형 8개의 서술자. 2단계와 같은 변형 집합을 쓴다."""
    arr = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_GRAYSCALE)
    q = features.query_line_from_strokes(arr)
    variants = engine.line_variants(q, engine.ROT_STEP)
    near = np.stack([np.exp(-engine.dist_to_ink(v) / TAU_REF).reshape(-1)
                     for v in variants])
    return pool_near(near, p)


def query_probe_fm(png: bytes) -> np.ndarray:
    """쿼리 서술자 1개. FM 은 회전 불변이 존재 이유라 변형 탐색을 주지 않는다."""
    arr = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_GRAYSCALE)
    q = features.query_line_from_strokes(arr)
    return fourier_mellin(engine.normalize_line(q))[None, :]


# 이전 이름 — tests/exp_quality.py 가 이 이름으로 가져다 쓴다.
design_bank = design_bank_chamfer
query_probes = query_probes_chamfer


def recalls(bank: np.ndarray, probes_of, queries, truth_rows) -> tuple[list, list]:
    """서술자 하나에 대한 recall@K. probes_of(png) -> (v, dim)."""
    recs = {k: [] for k in KS}
    for q, tr in zip(queries, truth_rows):
        probes = probes_of(q)
        sims = (bank @ probes.T).max(axis=1)      # 변형 max — 2단계와 같은 규칙
        order = np.argsort(-sims)
        for k in KS:
            recs[k].append(len(set(order[:k].tolist()) & set(tr.tolist())) / len(tr))
    return ([float(np.mean(recs[k])) for k in KS],
            [float(np.min(recs[k])) for k in KS])


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

        rows = []

        # --- A: Fourier-Mellin (기각안 재현) ---
        t = time.perf_counter()
        bankA = design_bank_fm(store)
        tA = time.perf_counter() - t
        means, mins = recalls(bankA, query_probe_fm, queries, truth_rows)
        rows.append(("A Fourier-Mellin", bankA.shape[1], means, mins, tA))

        # --- B: chamfer 풀링 (다중 프로브 max) ---
        for p in POOLS:
            t = time.perf_counter()
            bank = design_bank_chamfer(store, p)
            tB = time.perf_counter() - t
            means, mins = recalls(
                bank, lambda q, _p=p: query_probes_chamfer(q, _p),
                queries, truth_rows)
            rows.append((f"B chamfer pool {p}x{p}", p * p, means, mins, tB))

        print(f"{'서술자':24} {'차원':>5} | " + " ".join(f"K={k:<5}" for k in KS))
        print("-" * (32 + 8 * len(KS)))
        for name, dim, means, mins, tb in rows:
            print(f"{name:24} {dim:>5} | " + " ".join(f"{m:.3f}  " for m in means))
            print(f"{'  (최저 쿼리)':24} {'':>5} | " + " ".join(f"{m:.3f}  " for m in mins))
            print(f"{'  (뱅크 구축)':24} {'':>5} | {tb:.1f}s")
        print(f"\n(N={store.count}, 쿼리 {n_q}개, 정답 = 전수 정밀 채점 top-{TOP_K})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
