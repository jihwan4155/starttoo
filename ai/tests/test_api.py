"""
HTTP 계약 검증. 앱을 실제로 띄워(TestClient) 엔드포인트를 두드린다.

확인 항목
  · 워밍업 후 /health 가 ready=true
  · POST /search 응답 필드가 모드별로 계약과 맞나
  · POST /designs 로 넣은 도안이 즉시 검색에 잡히나
  · DELETE /designs 로 뺀 도안이 검색에서 사라지나
  · 삭제가 디스크에 남아 재시작 후에도 유지되나 (tombstone)
  · 잘못된 입력이 400, 본문 초과가 400, 없는 key 가 404
"""

from __future__ import annotations

import base64
import os
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from tests import synth                                    # noqa: E402

OK, FAIL = "  [OK]", "  [FAIL]"
_fails: list[str] = []


def check(cond: bool, msg: str) -> None:
    print((OK if cond else FAIL), msg)
    if not cond:
        _fails.append(msg)


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="coverup_api_"))
    store_dir = tmp / "store"
    try:
        # 스토어를 먼저 만들어 둔다(앱은 부팅 때 이 디렉토리를 연다)
        from coverup.builder import index_all
        from coverup.store import FeatureStore
        st = FeatureStore.create(store_dir, overwrite=True)
        items = synth.corpus(150, seed=5, under="black", size=192)
        index_all(st, ((k, p) for k, p, _ in items), batch=64)
        print(f"스토어 준비: {st.count}장\n")

        os.environ["COVERUP_STORE"] = str(store_dir)
        os.environ["COVERUP_STAGE1"] = "off"
        for m in list(sys.modules):
            if m.startswith("coverup.app"):
                del sys.modules[m]
        from fastapi.testclient import TestClient
        from coverup.app import app

        with TestClient(app) as c:
            h = c.get("/health").json()
            print("  /health ->", h)
            check(h["ready"] is True, "워밍업 후 ready=true")
            check(h["rows"] == 150 and h["alive"] == 150, "행 수 보고 정확")

            b64 = base64.b64encode(synth.query_png("ring", brush=6)).decode()

            r = c.post("/search", json={"mask_png_b64": "data:image/png;base64," + b64,
                                        "mode": "line", "top_k": 8})
            check(r.status_code == 200, f"선 모드 200 (실제 {r.status_code})")
            d = r.json()
            print(f"  line  -> count={d['count']} timing={d['timing_ms']} "
                  f"cand={d['candidates']} stage1={d['stage1']}")
            check(d["count"] == 8, "top_k 만큼 반환")
            need = {"key", "score", "shape", "cover", "weak", "rec", "prec"}
            check(set(d["results"][0]) == need, f"선 모드 필드 == {sorted(need)}")
            check(isinstance(d["results"][0]["key"], int), "key 가 정수(tattoo_seq)")
            scores = [x["score"] for x in d["results"]]
            check(scores == sorted(scores, reverse=True), "점수 내림차순")
            # 접두어를 뗀 것과 붙인 것이 같은 결과여야 한다
            plain = c.post("/search", json={"mask_png_b64": b64, "mode": "line", "top_k": 8})
            check(plain.json()["results"] == d["results"],
                  "data:image/png;base64, 접두어가 있어도 같은 결과")

            g64 = base64.b64encode(synth.query_png("disc", brush=16)).decode()
            r = c.post("/search", json={"mask_png_b64": g64, "mode": "gate", "top_k": 8})
            d = r.json()
            need_g = {"key", "score", "shape", "fill", "opacity"}
            check(r.status_code == 200 and set(d["results"][0]) == need_g,
                  f"게이트 모드 필드 == {sorted(need_g)}")

            # 증분 색인
            mask = synth.shape_mask("ring", size=256, thick=9)
            png = synth.cutout_png(mask, under="black")
            r = c.post("/designs", json={"key": 999_001,
                                         "image_b64": base64.b64encode(png).decode()})
            check(r.status_code == 201, f"POST /designs 201 (실제 {r.status_code})")
            check(c.get("/health").json()["alive"] == 151, "색인 후 alive 151")

            r = c.post("/search", json={"mask_png_b64": b64, "mode": "line", "top_k": 16})
            keys = [x["key"] for x in r.json()["results"]]
            check(999_001 in keys, f"방금 넣은 도안이 검색에 잡힘 (순위 {keys.index(999_001) + 1})"
                  if 999_001 in keys else "방금 넣은 도안이 검색에 잡힘")

            # 삭제
            r = c.delete("/designs/999001")
            check(r.status_code == 200 and r.json()["alive"] == 150, "DELETE 반영")
            r = c.post("/search", json={"mask_png_b64": b64, "mode": "line", "top_k": 16})
            check(999_001 not in [x["key"] for x in r.json()["results"]],
                  "삭제된 도안이 검색에서 사라짐")
            check(c.delete("/designs/424242").status_code == 404, "없는 key 는 404")

            # 오류 경로
            check(c.post("/search", json={"mask_png_b64": b64, "mode": "bogus"}
                         ).status_code == 400, "잘못된 mode 는 400")
            check(c.post("/search", json={"mask_png_b64": b64, "tau": 99.0}
                         ).status_code == 400, "표현 범위를 넘는 tau 는 400")
            check(c.post("/search", json={"mask_png_b64": base64.b64encode(b"nope").decode()}
                         ).status_code == 400, "PNG 아닌 본문은 400")
            check(c.post("/search", json={"mask_png_b64": "A" * 200_000}
                         ).status_code == 400, "본문 크기 초과는 400")

            s = c.get("/stats").json()
            print("  /stats ->", s)
            # 150장 적재 + 1장 추가 = 151행, 그중 1행 삭제 -> alive 150 / dead 1
            check(s["rows"] == 151 and s["alive"] == 150 and s["dead"] == 1,
                  f"rows/alive/dead = 151/150/1 (실제 {s['rows']}/{s['alive']}/{s['dead']})")

        # 공유 시크릿 인증 (리버스 프록시가 경로를 공개로 열어 둔 경우의 방어선)
        os.environ["COVERUP_INTERNAL_TOKEN"] = "test-secret-value"
        for m in list(sys.modules):
            if m.startswith("coverup.app"):
                del sys.modules[m]
        from coverup.app import app as app_auth
        with TestClient(app_auth) as ca:
            check(ca.get("/health").json()["auth"] is True, "시크릿 설정 시 /health auth=true")
            check(ca.get("/health").status_code == 200, "/health 는 시크릿 없이도 열려 있다")
            check(ca.post("/search", json={"mask_png_b64": b64}).status_code == 401,
                  "/search 는 시크릿 없으면 401")
            check(ca.post("/search", json={"mask_png_b64": b64},
                          headers={"X-Internal-Token": "wrong"}).status_code == 401,
                  "틀린 시크릿은 401")
            check(ca.get("/stats").status_code == 401, "/stats 도 시크릿 필요")
            check(ca.delete("/designs/1").status_code == 401, "DELETE 도 시크릿 필요")
            ok = ca.post("/search", json={"mask_png_b64": b64, "top_k": 4},
                         headers={"X-Internal-Token": "test-secret-value"})
            check(ok.status_code == 200 and ok.json()["count"] == 4, "맞는 시크릿이면 정상 동작")
        os.environ.pop("COVERUP_INTERNAL_TOKEN", None)

        # 재시작해도 삭제가 유지되나
        for m in list(sys.modules):
            if m.startswith("coverup.app"):
                del sys.modules[m]
        from coverup.app import app as app2
        with TestClient(app2) as c2:
            check(c2.get("/health").json()["alive"] == 150,
                  "재시작 후에도 삭제 상태 유지 (디스크에 기록됨)")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print()
    if _fails:
        print(f"실패 {len(_fails)}건:")
        for f in _fails:
            print("  -", f)
        return 1
    print("전부 통과")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
