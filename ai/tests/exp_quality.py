"""
1단계가 '유저가 보는 품질'을 실제로 얼마나 깎는지 측정.

recall@K(집합 일치율)는 지표로 불충분하다. 정답 16개 중 하나를 놓쳤어도 그게
15위의 동점 도안이면 유저는 차이를 못 느낀다. 반대로 1위를 놓치면 치명적이다.
그래서 점수 기준으로 잰다.

  · top-1 일치율        — 1등이 같은가 (가장 중요)
  · 점수 손실           — 2단계 결과의 점수 합 / 전수 결과의 점수 합
  · 위치별 최대 점수차  — 어느 순위에서 얼마나 나빠지나

엔진의 line 점수는 prec = dot(도안잉크, nearQ)/|도안잉크| 라서 **잉크가 아주 적은
도안이 형태와 무관하게 prec≈1.0 을 받는다.** 그런 '축퇴 승자'는 어떤 형태 서술자로도
못 찾는다. 그래서 집합 일치율은 원리적으로 1.0 에 못 간다 — 점수 손실로 봐야 한다.

실행:  python -m tests.exp_quality [N] [쿼리수]
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
from tests.exp_descriptor import design_bank, query_probes    # noqa: E402

TOP_K = 16
POOL = 16
KS = (100, 200, 500, 1000, 2000)


def main() -> int:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10_000
    n_q = int(sys.argv[2]) if len(sys.argv) > 2 else 24

    tmp = Path(tempfile.mkdtemp(prefix="coverup_q_"))
    try:
        store = FeatureStore.create(tmp / "store", overwrite=True)
        t = time.perf_counter()
        index_all(store, ((k, png) for k, png, _ in
                          synth.corpus(n, seed=2024, under="black", size=192)),
                  batch=512)
        store = FeatureStore(tmp / "store")
        print(f"도안 {store.count}장 색인 {time.perf_counter() - t:.1f}s")

        bank = design_bank(store, POOL)
        print(f"chamfer 서술자 {POOL}x{POOL} = {bank.shape[1]}차원 준비 완료\n")

        rng = np.random.default_rng(77)
        queries = [synth.query_png(synth.SHAPES[i % len(synth.SHAPES)], brush=6,
                                   rot_deg=float(rng.uniform(0, 360)), rng=rng)
                   for i in range(n_q)]

        searcher = Searcher(store, stage1="off")
        full = [searcher.search(q, mode="line", top_k=TOP_K)["results"] for q in queries]

        ncnt = [len(r) for r in full]
        print(f"전수 결과 개수: 평균 {np.mean(ncnt):.1f} / 최소 {min(ncnt)} "
              f"(중복제거 후 top-{TOP_K} 를 채웠나)\n")

        print(f"{'K':>6} {'K/N':>6} | {'개수':>5} | {'top1':>6} {'top3':>6} | "
              f"{'1위점수차':>9} {'겹친자리최악':>12} | {'집합':>6}")
        print("-" * 76)

        for k in KS:
            if k >= store.count:
                continue
            top1 = top3 = 0
            cnts, d1, dworst, jac = [], [], [], []
            for q, ref in zip(queries, full):
                probes = query_probes(q, POOL)
                sims = (bank @ probes.T).max(axis=1)
                cand = np.argpartition(-sims, k - 1)[:k].astype(np.int64)
                got = searcher.search(q, mode="line", top_k=TOP_K,
                                      candidates=cand)["results"]
                cnts.append(len(got))
                if not got:
                    continue
                rs = [x["score"] for x in ref]
                gs = [x["score"] for x in got]
                top1 += int(got[0]["key"] == ref[0]["key"])
                top3 += int(got[0]["key"] in {x["key"] for x in ref[:3]})
                d1.append(rs[0] - gs[0])
                dworst.append(max(a - b for a, b in zip(rs, gs)))
                jac.append(len({x["key"] for x in got} & {x["key"] for x in ref}) / len(rs))
            print(f"{k:>6} {k / store.count:>6.1%} | {np.mean(cnts):>5.1f} | "
                  f"{top1 / n_q:>6.1%} {top3 / n_q:>6.1%} | "
                  f"{np.mean(d1):>9.4f} {np.max(dworst):>12.4f} | {np.mean(jac):>6.3f}")

        print("\n  개수         : 2단계가 실제로 돌려준 결과 수 (중복제거로 16 미만이 될 수 있다)")
        print("  top1/top3    : 2단계 1등이 전수 1등 / 전수 상위3 안에 들어간 비율")
        print("  1위점수차    : 전수 1위 점수 - 2단계 1위 점수 (평균)")
        print("  겹친자리최악 : 두 결과가 겹치는 순위 구간에서 가장 크게 나빠진 점수차")
        print("  집합         : recall@K (참고용)")
        print("\n⚠ 합성 도안은 도형 16종뿐이라 같은 종류가 수백 장씩 있다. 중복제거"
              "(코사인>0.93)가\n  후보를 실제보다 훨씬 많이 걷어내므로 필요한 K 가"
              " 과대평가된다. 실제 도안은 다양해서\n  이 값보다 작은 K 로도 16개를 채운다.")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
