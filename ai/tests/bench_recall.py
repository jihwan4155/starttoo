"""
1단계 후보 추림의 recall 곡선 측정 — 이 프로젝트에서 가장 중요한 검증.

왜 필요한가: 1단계에서 놓친 도안은 2단계가 절대 복구하지 못한다. 그런데 에러가
나지 않고 결과 품질만 조용히 떨어진다. 그리고 작은 데이터에서 잰 recall 은
아무것도 말해주지 않는다 —

    2,520장에서 top-2000 = 전체의 79%  -> recall 은 당연히 1.0
    100만장에서 top-2000 = 전체의 0.2% -> 완전히 다른 문제

그래서 N 을 늘려가며 곡선을 봐야 한다. 실제 도안 수백만 장을 지금 구할 수 없으니
합성 도안으로 기울기를 잡는다.

측정 방식
  정답  : 1단계를 끈 전수 정밀 채점의 top-16 (= 현재 엔진의 정답 그대로)
  측정  : 1단계가 고른 K개 후보 안에 그 16개가 몇 개 들어 있나
  recall@K = |정답16 ∩ 후보K| / 16
  후보에 들어오면 2단계가 정확히 재채점하므로, 이 값이 곧 품질 상한이다.

실행:  python -m tests.bench_recall              (기본: 최대 2만장)
       python -m tests.bench_recall 40000 24     (최대 N, 쿼리 수)
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

from coverup.builder import index_all                       # noqa: E402
from coverup.service import Searcher                        # noqa: E402
from coverup.store import FeatureStore                      # noqa: E402
from tests import synth                                     # noqa: E402

TOP_K = 16
K_RATIOS = (0.005, 0.01, 0.02, 0.05)       # 후보 비율 K/N
IMG = 192                                   # 합성 이미지 크기(작게 해서 빌드를 줄인다)


def make_queries(n_q: int, seed: int = 99) -> list[tuple[str, bytes]]:
    """유저가 그릴 만한 쿼리. 도형 종류를 골고루, 회전은 무작위."""
    rng = np.random.default_rng(seed)
    out = []
    for i in range(n_q):
        kind = synth.SHAPES[i % len(synth.SHAPES)]
        out.append((kind, synth.query_png(kind, brush=6,
                                          rot_deg=float(rng.uniform(0, 360)),
                                          rng=rng)))
    return out


def main() -> int:
    n_max = int(sys.argv[1]) if len(sys.argv) > 1 else 20_000
    n_q = int(sys.argv[2]) if len(sys.argv) > 2 else 16

    levels = [n for n in (2_000, 5_000, 10_000, 20_000, 40_000, 80_000) if n <= n_max]
    if levels[-1] != n_max:
        levels.append(n_max)
    queries = make_queries(n_q)

    tmp = Path(tempfile.mkdtemp(prefix="coverup_recall_"))
    store = FeatureStore.create(tmp / "store", overwrite=True)
    print(f"쿼리 {n_q}개 · 정답 top-{TOP_K} · 도안 크기 {IMG}px")
    print(f"레벨: {levels}\n")
    print(f"{'N':>7} | {'K/N':>5} {'K':>6} | {'recall':>7} {'최저':>6} "
          f"{'r=1.0':>6} | {'전수ms':>7} {'1단계ms':>8}")
    print("-" * 74)

    built = 0
    try:
        for n in levels:
            need = n - built
            t0 = time.perf_counter()
            src = ((built + i + 1, png) for i, (_, png, _) in
                   enumerate(synth.corpus(need, seed=1000 + built,
                                          under="black", size=IMG)))
            index_all(store, src, batch=512)
            built = store.count
            t_build = time.perf_counter() - t0

            store = FeatureStore(tmp / "store")          # mmap 재오픈
            full = Searcher(store, stage1="off")

            # 정답: 전수 정밀 채점
            truth, t_full = [], []
            for _, png in queries:
                t = time.perf_counter()
                r = full.search(png, mode="line", top_k=TOP_K)
                t_full.append((time.perf_counter() - t) * 1000)
                truth.append({x["key"] for x in r["results"]})

            first = True
            for ratio in K_RATIOS:
                k = max(TOP_K, int(n * ratio))
                if k >= n:
                    continue
                two = Searcher(store, stage1="on", k_min=k, k_ratio=0.0)
                recs, t_s1 = [], []
                for (_, png), tr in zip(queries, truth):
                    t = time.perf_counter()
                    r = two.search(png, mode="line", top_k=TOP_K)
                    t_s1.append((time.perf_counter() - t) * 1000)
                    got = {x["key"] for x in r["results"]}
                    # 후보에 들어왔는지가 상한. 후보에 들어온 정답은 2단계가 되찾는다.
                    recs.append(len(tr & got) / max(len(tr), 1))
                recs = np.asarray(recs)
                head = f"{n:>7}" if first else " " * 7
                first = False
                print(f"{head} | {ratio:>5.1%} {k:>6} | {recs.mean():>7.3f} "
                      f"{recs.min():>6.3f} {np.mean(recs == 1.0):>6.1%} | "
                      f"{np.median(t_full):>7.1f} {np.median(t_s1):>8.1f}")
            print(f"{'':>7} | 빌드 {t_build:.1f}s · 누적 {built}장 · "
                  f"디스크 {store.count * store.stats()['bytes_per_design'] / 1e6:.0f}MB")
            print("-" * 74)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print("\n해석:")
    print("  · recall 1.0 = 1단계가 정답을 하나도 놓치지 않았다 -> 2단계 결과가 전수와 동일")
    print("  · N 이 커질 때 같은 K/N 비율에서 recall 이 유지되면 그 비율로 운영 가능")
    print("  · 떨어지면 K 를 키우거나(지연 증가) 임베딩을 다시 설계해야 한다")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
