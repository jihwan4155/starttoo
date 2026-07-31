"""
검증 스크립트. 여덟 가지를 실측해서 보고한다.

  1) 스토어 왕복 — append/delete/remap 이 데이터를 보존하나
  2) 누끼 오염 재현 — IMREAD_COLOR 로 읽으면 실제로 fill/opacity 가 1.0 이 되나
  3) 알파 경로 등가성 — 투명 영역 아래가 검정이든 흰색이든 같은 특징이 나오나
  4) coverup3 원본과의 동일성 — 같은 입력에 같은 순위/점수가 나오나
  5) 거리변환 uint8 정량화의 영향 — 점수가 얼마나 달라지나
  6) 1단계 서술자 — 기각안의 회전 불변성 + 채택안의 2단계 상위 포착률
  7) 성능 — 색인 속도, 디스크, 전수 vs 2단계 지연
  8) 엔진의 회전 사각지대 — 등방 모멘트 형태에서 점수가 흔들리는 성질(원본부터 있음)

  실행:  python -m tests.check          (py-engine 디렉토리에서)
"""

from __future__ import annotations

import shutil
import sys
import tempfile
import time
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# 윈도우 콘솔 기본 코드페이지(cp949)는 em-dash 를 못 찍는다
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from coverup import engine, features                      # noqa: E402
from coverup.builder import design_record                 # noqa: E402
from coverup import embed                                  # noqa: E402
from coverup.service import Searcher                       # noqa: E402
from coverup.store import FeatureStore, LDIST_SCALE        # noqa: E402
from tests import synth                                    # noqa: E402

C3 = Path(r"C:\Users\SSAFY\Desktop\coverup3\python-search")
OK, FAIL = "  [OK]", "  [FAIL]"
_fails: list[str] = []


def check(cond: bool, msg: str) -> None:
    print((OK if cond else FAIL), msg)
    if not cond:
        _fails.append(msg)


def head(t: str) -> None:
    print(f"\n{'=' * 72}\n{t}\n{'=' * 72}")


# ---------------------------------------------------------------------------
def t1_store_roundtrip(tmp: Path) -> None:
    head("1) 스토어 왕복 — append / delete / remap")
    st = FeatureStore.create(tmp / "s1", overwrite=True)
    items = synth.corpus(40, seed=1, under="black")

    recs = [design_record(k, png) for k, png, _ in items]
    check(all(r is not None for r in recs), f"레코드 {len(recs)}건 전부 생성됨")
    st.append(recs)
    check(st.count == 40, f"count == 40 (실제 {st.count})")

    # 재오픈해서 mmap 으로 다시 읽는다
    st2 = FeatureStore(tmp / "s1")
    check(st2.count == 40, "재오픈 후 count 유지")
    rows = np.arange(40)
    check(np.array_equal(st2.line(rows), np.stack([r.line for r in recs])), "line 배열 일치")
    check(np.array_equal(st2.opac(rows), np.stack([r.opac for r in recs])), "opac 배열 일치")
    check(np.array_equal(st2.norms(rows), np.stack([r.norms for r in recs])), "norms 배열 일치")
    check(np.allclose(st2.fill, [r.fill for r in recs]), "fill 스칼라 일치")
    check(np.array_equal(st2.keys, [r.key for r in recs]), "key 순서 일치")

    # 정렬 뽑기가 순서를 보존하나 (store._take 의 argsort 경로)
    pick = np.array([7, 2, 39, 15, 0])
    check(np.array_equal(st2.line(pick), np.stack([recs[i].line for i in pick])),
          "비정렬 행 인덱싱이 요청 순서를 보존")

    st2.delete([items[3][0], items[10][0]])
    check(st2.stats()["alive"] == 38, f"삭제 2건 반영 (alive={st2.stats()['alive']})")
    check(len(FeatureStore(tmp / "s1").alive_rows()) == 38, "삭제가 디스크에 남는다")

    # 같은 key 재색인 = 이미지 교체
    st2.append([design_record(items[0][0], items[5][1])])
    check(st2.count == 41 and st2.stats()["alive"] == 38,
          "같은 key 재색인 시 기존 행이 죽고 새 행이 붙는다")
    check(st2.row_of(items[0][0]) == 40, "key -> 최신 행으로 매핑")


# ---------------------------------------------------------------------------
def t2_cutout_pollution() -> None:
    head("2) 누끼 오염 재현 — IMREAD_COLOR 로 읽으면 어떻게 되나")
    mask = synth.shape_mask("ring", size=384, thick=10)

    for under in ("black", "white"):
        png = synth.cutout_png(mask, under=under)
        buf = np.frombuffer(png, np.uint8)
        bgr = cv2.imdecode(buf, cv2.IMREAD_COLOR)      # 알파를 버리는 옛 경로
        m = features.silhouette_mask(bgr)
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        filled = np.zeros_like(m)
        if cnts:
            cv2.drawContours(filled, cnts, -1, 255, -1)
        region = max(1, int((filled > 0).sum()))
        fill = float((m > 0).sum()) / region
        op = features.opacity_map(bgr, m)
        opacity = float(op[m > 0].mean() / 255.0)
        gate = fill >= engine.MIN_FILL and opacity >= engine.MIN_OPACITY
        print(f"    under={under:5s}  fill={fill:.3f}  opacity={opacity:.3f}  "
              f"게이트통과={gate}")
        if under == "black":
            check(gate and fill > 0.99,
                  "검정 누끼는 IMREAD_COLOR 로 읽으면 fill≈1.0 으로 게이트를 통과한다(오염 확인)")
        else:
            check(not gate or fill < 0.5,
                  "흰색 누끼는 IMREAD_COLOR 로도 정상 판정된다")


# ---------------------------------------------------------------------------
def t3_alpha_equivalence() -> None:
    head("3) 알파 경로 등가성 — 투명 영역 아래 RGB 와 무관해야 한다")
    same_fill, same_op, same_map = True, True, True
    for i, kind in enumerate(synth.SHAPES):
        mask = synth.shape_mask(kind, size=384, rot_deg=17.0 * i, thick=9)
        rb = design_record(1, synth.cutout_png(mask, under="black"))
        rw = design_record(1, synth.cutout_png(mask, under="white"))
        same_fill &= abs(rb.fill - rw.fill) < 1e-9
        same_op &= abs(rb.opacity - rw.opacity) < 1e-9
        same_map &= (np.array_equal(rb.norms, rw.norms)
                     and np.array_equal(rb.line, rw.line)
                     and np.array_equal(rb.opac, rw.opac)
                     and np.array_equal(rb.ldist, rw.ldist))
    check(same_fill, "fill 이 under 와 무관")
    check(same_op, "opacity 가 under 와 무관")
    check(same_map, f"norms/opac/line/ldist 가 under 와 무관 ({len(synth.SHAPES)} 도형)")

    # 알파 없는 흰 배경 이미지와도 사실상 같은 값이 나오는지 (폴백 경로)
    mask = synth.shape_mask("ring", size=384, thick=10)
    ra = design_record(1, synth.cutout_png(mask, under="white"))
    rn = design_record(1, synth.white_bg_png(mask))
    d = int(np.abs(ra.line.astype(int) - rn.line.astype(int)).sum())
    print(f"    알파 경로 vs 흰배경 폴백: line 픽셀 차이 {d} / {ra.line.size}")
    check(d <= ra.line.size * 0.02, "알파 경로와 흰배경 폴백이 2% 이내로 일치")


# ---------------------------------------------------------------------------
def _c3_index(items):
    sys.path.insert(0, str(C3))
    from app import coverup as c3            # noqa: PLC0415
    idx = {"ids": [], "norms": [], "opac": [], "line": [], "fill": [], "opacity": []}
    for key, mask in items:
        bgr = synth.white_bg_bgr(mask)
        f = c3.design_cover_features(bgr)
        if f is None:
            continue
        idx["ids"].append(key)
        idx["norms"].append(f["norm"])
        idx["opac"].append(f["opac"])
        idx["line"].append(f["line"])
        idx["fill"].append(f["fill_ratio"])
        idx["opacity"].append(f["opacity"])
    for k in ("norms", "opac", "line"):
        idx[k] = np.stack(idx[k])
    idx["fill"] = np.asarray(idx["fill"], "float32")
    idx["opacity"] = np.asarray(idx["opacity"], "float32")
    return c3, idx


def t4_parity(tmp: Path) -> None:
    head("4) coverup3 원본과의 동일성")
    if not C3.exists():
        print("  (coverup3 없음 — 건너뜀)")
        return

    rng = np.random.default_rng(7)
    items = []
    for i in range(120):
        kind = synth.SHAPES[i % len(synth.SHAPES)]
        items.append((i + 1, synth.shape_mask(
            kind, size=384, rot_deg=float(rng.uniform(0, 360)),
            scale=float(rng.uniform(0.5, 0.85)),
            thick=int(rng.integers(6, 16)), rng=rng)))

    c3, idx = _c3_index(items)

    st = FeatureStore.create(tmp / "s4", overwrite=True)
    st.append([design_record(k, synth.white_bg_png(m)) for k, m in items])
    searcher = Searcher(st, stage1="off")
    check(st.count == len(idx["ids"]), f"양쪽 도안 수 일치 ({st.count})")

    # 스칼라 특징 비교
    check(np.allclose(st.fill, idx["fill"], atol=1e-6), "fill 완전 일치")
    check(np.allclose(st.opacity, idx["opacity"], atol=1e-6), "opacity 완전 일치")
    allrows = np.arange(st.count)
    check(np.array_equal(st.norms(allrows), idx["norms"].reshape(st.count, -1)),
          "norms 맵 완전 일치")
    check(np.array_equal(st.line(allrows), idx["line"].reshape(st.count, -1)),
          "line 맵 완전 일치")
    check(np.array_equal(st.opac(allrows), idx["opac"].reshape(st.count, -1)),
          "opac 맵 완전 일치")

    cases = []
    for kind in ("ring", "square_outline", "triangle", "ell", "ellipse_outline", "cross"):
        for rot in (0.0, 33.0):
            cases.append((kind, rot))

    # 순위가 어긋나도 '같은 위치의 점수가 같으면' 동점 스왑이라 알고리즘은 동일하다.
    # 원본 np.argsort 는 quicksort(불안정)이고 여기는 stable 이라 동점 순서가 다르다.
    # 그래서 (a) 결과 집합이 같은지 (b) 위치별 점수가 같은지 두 가지로 판정한다.
    def compare(a, b, ka="id", kb="key"):
        keys_a = [r[ka] for r in a]
        keys_b = [r[kb] for r in b]
        gaps = [abs(x["score"] - y["score"]) for x, y in zip(a, b)]
        swaps = sum(1 for x, y in zip(keys_a, keys_b) if x != y)
        tie_swaps = sum(1 for i, (x, y) in enumerate(zip(keys_a, keys_b))
                        if x != y and gaps[i] == 0.0)
        return {"same_set": set(keys_a) == set(keys_b),
                "exact_rank": keys_a == keys_b,
                "dmax": max(gaps, default=0.0),
                "swaps": swaps, "tie_swaps": tie_swaps, "n": len(keys_a)}

    agg = {"line": [], "gate": []}
    for kind, rot in cases:
        png = synth.query_png(kind, brush=6, rot_deg=rot)
        arr = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_GRAYSCALE)
        q = features.query_line_from_strokes(arr)
        agg["line"].append(compare(
            c3.line_search(q, dict(idx), top_k=16),
            searcher.search(png, mode="line", top_k=16)["results"]))

        pngg = synth.query_png(kind, brush=16, rot_deg=rot)
        arrg = cv2.imdecode(np.frombuffer(pngg, np.uint8), cv2.IMREAD_GRAYSCALE)
        qg = features.query_mask_from_strokes(arrg)
        agg["gate"].append(compare(
            c3.coverup_search_gate(qg, dict(idx), top_k=16),
            searcher.search(pngg, mode="gate", top_k=16)["results"]))

    n = len(cases)
    for mode, rs in agg.items():
        exact = sum(r["exact_rank"] for r in rs)
        sets = sum(r["same_set"] for r in rs)
        dmax = max(r["dmax"] for r in rs)
        swaps = sum(r["swaps"] for r in rs)
        ties = sum(r["tie_swaps"] for r in rs)
        slots = sum(r["n"] for r in rs)
        print(f"    {mode:5s}: 순위 완전일치 {exact}/{n} · 결과집합 일치 {sets}/{n} · "
              f"위치별 점수 최대차 {dmax:.6f}")
        print(f"           자리 바뀜 {swaps}/{slots} (그중 점수 완전동점 {ties})")
        agg[mode] = {"exact": exact, "sets": sets, "dmax": dmax,
                     "swaps": swaps, "ties": ties}

    g, l = agg["gate"], agg["line"]
    check(g["dmax"] == 0.0, "게이트: 위치별 점수가 원본과 비트 단위로 동일")
    check(g["swaps"] == g["ties"], "게이트: 자리 바뀜이 전부 완전동점 스왑 (알고리즘 동일)")
    check(g["sets"] == n, "게이트: 결과 집합이 모든 케이스에서 동일")
    check(l["dmax"] < 0.005, f"선: 위치별 점수차 < 0.005 (정량화 오차, 실측 {l['dmax']:.6f})")
    check(l["sets"] >= n - 1, f"선: 결과 집합 일치 {l['sets']}/{n}")


# ---------------------------------------------------------------------------
def t5_quantization(tmp: Path) -> None:
    head(f"5) 거리변환 정량화 영향 (1/{LDIST_SCALE} px uint8)")
    mask = synth.shape_mask("ring", size=384, thick=10)
    line = engine.normalize_pair(mask, None, line=True)[0]
    exact = engine.dist_to_ink(line)
    quant = np.clip(np.rint(exact * LDIST_SCALE), 0, 255).astype(np.uint8) / LDIST_SCALE
    err = np.abs(exact - quant)
    print(f"    거리 오차   : 최대 {err.max():.4f} px  평균 {err.mean():.4f} px")
    for tau in (1.0, 2.5, 4.0, 8.0):
        de = np.abs(np.exp(-exact / tau) - np.exp(-quant / tau))
        print(f"    tau={tau:4.1f} -> exp() 오차 최대 {de.max():.2e}")
    check(err.max() <= 0.5 / LDIST_SCALE + 1e-6,
          f"거리 오차가 ±1/{2 * LDIST_SCALE} px 이내")


# ---------------------------------------------------------------------------
def t6_rotation_invariance() -> None:
    head("6) 회전 대응 — 기각안(Fourier-Mellin) vs 채택안(chamfer 다중프로브)")

    # (a) 기각안: 서술자 자체가 회전 불변이다. 이 성질은 성립했지만 recall 이 낮아
    #     기각됐다(근거는 embed.py 문서와 tests/exp_descriptor.py).
    worst_fm = 1.0
    for kind in synth.SHAPES:
        base = embed.fourier_mellin(synth.shape_mask(kind, size=384, thick=10))
        sims = [float(base @ embed.fourier_mellin(
            synth.shape_mask(kind, size=384, rot_deg=r, thick=10)))
            for r in (13, 47, 90, 137, 211, 285)]
        sims.append(float(base @ embed.fourier_mellin(
            synth.shape_mask(kind, size=384, thick=10)[:, ::-1].copy())))
        worst_fm = min(worst_fm, min(sims))
    print(f"    (a) 기각안 Fourier-Mellin: 회전/반전 최저 코사인 {worst_fm:.4f}")
    check(worst_fm > 0.90, f"기각안의 회전 불변성 자체는 성립 (최저 {worst_fm:.4f})")

    # (b) 채택안에 요구되는 성질은 '회전 불변'이 아니라 **2단계 점수와의 일치**다.
    #     1단계는 후보만 고르고 순위는 2단계가 정하므로, 서술자 유사도가 2단계 점수와
    #     같은 방향으로 움직이면 된다. 그래서 순위 상관을 잰다.
    tmp = Path(tempfile.mkdtemp(prefix="coverup_agree_"))
    try:
        st = FeatureStore.create(tmp / "s", overwrite=True)
        from coverup.builder import index_all
        items = synth.corpus(600, seed=31, under="black", size=192)
        index_all(st, ((k, p) for k, p, _ in items), batch=200)
        st = FeatureStore(tmp / "s")
        searcher = Searcher(st, stage1="off")
        bank = np.stack([embed.line_descriptor(st.ldist([i]).reshape(-1))[0]
                         for i in range(st.count)])

        rhos, hits, top1 = [], [], []
        for i in range(0, len(synth.SHAPES)):
            png = synth.query_png(synth.SHAPES[i], brush=6, rot_deg=17.0 * i)
            res = searcher.search(png, mode="line", top_k=st.count)["results"]
            key2row = {int(k): r for r, k in enumerate(st.keys)}
            score = np.zeros(st.count, np.float32)
            for r in res:
                score[key2row[r["key"]]] = r["score"]

            arr = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_GRAYSCALE)
            probes = embed.line_probes(engine.line_variants(
                features.query_line_from_strokes(arr), engine.ROT_STEP))
            sim = (bank @ probes.T).max(axis=1)

            # 스피어만 = 순위끼리의 피어슨 상관
            rs = np.argsort(np.argsort(-score)).astype(np.float64)
            rv = np.argsort(np.argsort(-sim)).astype(np.float64)
            rhos.append(float(np.corrcoef(rs, rv)[0, 1]))

            k = max(16, st.count // 10)                    # K = 10%
            cand = set(np.argsort(-sim)[:k].tolist())
            best16 = np.argsort(-score)[:16]
            hits.append(len(cand & set(best16.tolist())) / 16)
            top1.append(int(best16[0]) in cand)

        # ρ(전체 순위상관)는 참고용이다. 600장 대부분은 점수가 0 근처라 순위가 사실상
        # 노이즈이고, 그 꼬리가 상관계수를 지배한다. 1단계에 필요한 성질은
        # '상위를 후보에 담는가' 하나뿐이므로 그것으로 판정한다.
        print(f"    전체 순위상관 ρ (참고): 평균 {np.mean(rhos):.3f} · 최저 {np.min(rhos):.3f}")
        print(f"    K=10% 가 2단계 top-16 을 담은 비율: 평균 {np.mean(hits):.3f} "
              f"· 최저 {np.min(hits):.3f}")
        print(f"    K=10% 가 2단계 **1위**를 담은 비율: {np.mean(top1):.1%}")
        check(np.mean(top1) == 1.0, "K=10% 가 2단계 1위를 항상 포함 (가장 중요한 성질)")
        check(np.mean(hits) > 0.8, f"K=10% 로 2단계 top-16 대부분 포착 (평균 {np.mean(hits):.3f})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def t8_rotation_blindspot(tmp: Path) -> None:
    head("8) 엔진의 회전 사각지대 (coverup3 부터 있던 성질)")
    print("    ROT_STEP=90 이라 쿼리를 0/90/180/270 만 돌려본다. 그런데 십자·정사각처럼")
    print("    2차 모멘트가 등방적인 형태는 주축이 정의되지 않아 정규화가 회전을 못 잡는다.")
    print("    -> 저장된 방향과 최대 45도 어긋난 채로 비교될 수 있다.\n")

    st = FeatureStore.create(tmp / "s8", overwrite=True)
    from coverup.builder import index_all
    items = synth.corpus(300, seed=41, under="black", size=192)
    target = 900_001
    mask = synth.shape_mask("cross", size=256, rot_deg=0.0, thick=10)
    index_all(st, [(k, p) for k, p, _ in items] + [(target, synth.cutout_png(mask))])
    st = FeatureStore(tmp / "s8")
    searcher = Searcher(st, stage1="off")

    print(f"    {'쿼리 회전':>9} | {'대상 도안 순위':>13} {'점수':>7}")
    ranks = []
    for rot in (0, 15, 30, 45, 60, 90):
        res = searcher.search(synth.query_png("cross", brush=6, rot_deg=float(rot)),
                              mode="line", top_k=st.count)["results"]
        keys = [r["key"] for r in res]
        rank = keys.index(target) + 1 if target in keys else -1
        sc = next((r["score"] for r in res if r["key"] == target), 0.0)
        ranks.append(rank)
        print(f"    {rot:>7}도 | {rank:>13} {sc:>7.4f}")
    print("\n    45도 근처에서 순위가 떨어지면 사각지대가 실재한다는 뜻이다.")
    print("    고치려면 ROT_STEP 을 45 이하로 낮춘다(변형 수가 늘어 2단계 비용 증가).")
    check(all(r > 0 for r in ranks), "모든 회전에서 대상 도안이 결과에 존재")


# ---------------------------------------------------------------------------
def t7_timing(tmp: Path) -> None:
    head("7) 성능 (합성 2,000장)")
    st = FeatureStore.create(tmp / "s7", overwrite=True)
    t0 = time.perf_counter()
    items = synth.corpus(2000, seed=3, under="black", size=256)
    t1 = time.perf_counter()
    from coverup.builder import index_all
    res = index_all(st, ((k, p) for k, p, _ in items), batch=500)
    t2 = time.perf_counter()
    print(f"    합성 이미지 생성 {t1 - t0:.1f}s / 색인 {t2 - t1:.1f}s "
          f"({res['added']}건, 실패 {len(res['failed'])})")
    s = st.stats()
    print(f"    디스크 {s['rows'] * s['bytes_per_design'] / 1e6:.1f} MB "
          f"({s['bytes_per_design'] / 1024:.1f} KB/도안)")

    st = FeatureStore(tmp / "s7")             # 콜드 오픈 (mmap)
    for label, stage1 in (("전수", "off"), ("2단계", "on")):
        searcher = Searcher(st, stage1=stage1, k_min=300)
        for mode, brush in (("line", 6), ("gate", 16)):
            png = synth.query_png("ring", brush=brush)
            searcher.search(png, mode=mode, top_k=16)     # 워밍업
            ts = []
            for _ in range(5):
                r = searcher.search(png, mode=mode, top_k=16)
                ts.append(r["timing_ms"]["total"])
            print(f"    {label:4s} {mode:5s}: {np.median(ts):6.1f} ms "
                  f"(후보 {r['candidates']}, stage1={r['stage1']})")


# ---------------------------------------------------------------------------
def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="coverup_check_"))
    try:
        t1_store_roundtrip(tmp)
        t2_cutout_pollution()
        t3_alpha_equivalence()
        t4_parity(tmp)
        t5_quantization(tmp)
        t6_rotation_invariance()
        t7_timing(tmp)
        t8_rotation_blindspot(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    head("결과")
    if _fails:
        print(f"실패 {len(_fails)}건:")
        for f in _fails:
            print("  -", f)
        return 1
    print("전부 통과")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
