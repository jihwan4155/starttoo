"""
검색 서버 (FastAPI). 팀 Spring 서버만 호출하는 내부 전용 서비스다.

원본 coverup3/app/main.py 와의 차이
  · CORS 전면 개방 제거 — 프론트가 직접 부르지 않는다. 팀 서버가 상대경로로 프록시한다
  · GET /coverup_image 제거 — 이미지는 MinIO presigned URL 로 프론트가 직접 받는다
  · POST/DELETE /designs 추가 — 증분 색인. 전체 재빌드는 최초 적재에만 쓴다
  · 본문 크기 상한 추가 — 실제 마스크는 ~5KB 인데 상한이 없었다
  · 부팅 시 워밍업 후 readiness — /health 가 파일 존재만 보던 것을 실제 준비로 바꿨다
  · 동시 검색 상한 — 검색은 CPU 바운드라 무제한이면 코어를 다 먹는다
  · 응답 id 가 파일 상대경로가 아니라 tattoo_seq(int)

와이어 필드명은 snake_case 로 둔다(팀 서버가 camelCase 로 바꿔 프론트에 준다).
"""

from __future__ import annotations

import base64
import binascii
import logging
import os
import secrets
from contextlib import asynccontextmanager
from threading import BoundedSemaphore

import numpy as np
from fastapi import Body, FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import engine
from .builder import design_record, index_all
from .service import BadRequest, Searcher
from .store import FeatureStore

STORE_DIR = os.environ.get("COVERUP_STORE", "coverup_store")
STAGE1 = os.environ.get("COVERUP_STAGE1", "auto")
# 마스크와 도안 이미지는 크기 자체가 다르다. 하나로 묶으면 둘 중 하나가 틀린다 —
# 마스크 기준(100KB)으로 잡으면 정상 도안 업로드가 거절되고, 도안 기준(10MB)으로
# 잡으면 검색 엔드포인트가 CPU 무제한 입력에 노출된다.
MAX_MASK_BODY = int(os.environ.get("COVERUP_MAX_MASK_BODY", 100 * 1024))
MAX_IMAGE_BODY = int(os.environ.get("COVERUP_MAX_IMAGE_BODY", 10 * 1024 * 1024))
MAX_CONCURRENT = int(os.environ.get("COVERUP_MAX_CONCURRENT",
                                    max(1, (os.cpu_count() or 2) - 1)))

# 내부 토큰. 이 서비스는 내부 전용이지만 리버스 프록시가 경로를 공개로 열어 둘
# 수 있다(예: nginx 의 /ai-service/). 검색은 유저 인증이 없고 CPU 무제한이라 공개되면
# 몇 명이 서버를 마비시킬 수 있다. 프록시 설정에 의존하지 않고 여기서 막는다.
# 비워 두면 인증이 꺼진다 — 개발 편의용이고, 운영에서는 반드시 설정해야 한다.
#
# 헤더·환경변수 이름은 팀 백엔드와 맞춰야 한다(CoverupEngineClient 의
# INTERNAL_TOKEN_HEADER, application.yml 의 app.coverup.internal-token).
INTERNAL_TOKEN_HEADER = "x-internal-token"
API_SECRET = os.environ.get("COVERUP_INTERNAL_TOKEN", "")
# /health 는 열어 둔다. 컨테이너 HEALTHCHECK·모니터링이 쓰고, 노출되는 건 행 수뿐이다.
OPEN_PATHS = frozenset({"/health"})

_log = logging.getLogger("coverup")
_state: dict = {"store": None, "searcher": None, "ready": False}
_slots = BoundedSemaphore(MAX_CONCURRENT)


def _warmup() -> None:
    """
    인덱스 로드 + 더미 검색 1회. 이게 끝난 뒤에 readiness 를 켠다.
    원본은 첫 요청에서 인덱스 로드와 캐시 채우기가 동기로 일어나 첫 사용자가
    725ms 를 맞았다. /health 를 readiness 프로브로 쓰면 그 상태로 트래픽이 들어온다.
    """
    store = FeatureStore(STORE_DIR)
    searcher = Searcher(store, stage1=STAGE1)
    _state["store"] = store
    _state["searcher"] = searcher
    if store.count:
        import cv2
        dummy = np.zeros((520, 420), np.uint8)
        cv2.circle(dummy, (210, 260), 120, 255, 6)
        png = cv2.imencode(".png", dummy)[1].tobytes()
        for mode in ("line", "gate"):
            try:
                searcher.search(png, mode=mode, top_k=4)
            except Exception:       # 빈 스토어·구버전 등. 워밍업 실패가 부팅을 막지 않는다
                pass
    _state["ready"] = True
    if not API_SECRET:
        _log.warning("COVERUP_INTERNAL_TOKEN 이 비어 있다 — 인증이 꺼진 상태다. "
                     "리버스 프록시가 이 서비스를 공개로 열어 두면 누구나 검색을 "
                     "호출할 수 있다(CPU 무제한). 운영에서는 반드시 설정하라.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _warmup()
    yield


app = FastAPI(title="coverup-search", lifespan=lifespan)


@app.middleware("http")
async def _require_secret(request: Request, call_next):
    """
    공유 시크릿 검사. 리버스 프록시가 이 서비스를 공개로 열어 두더라도 팀 서버가
    아닌 호출은 여기서 막힌다. 타이밍 공격을 피해 compare_digest 를 쓴다.
    """
    if API_SECRET and request.url.path not in OPEN_PATHS:
        given = request.headers.get(INTERNAL_TOKEN_HEADER, "")
        if not secrets.compare_digest(given, API_SECRET):
            return JSONResponse(status_code=401, content={"detail": "인증 실패"})
    return await call_next(request)


@app.exception_handler(BadRequest)
async def _bad_request(_: Request, exc: BadRequest):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


class SearchReq(BaseModel):
    mask_png_b64: str
    mode: str = "line"
    top_k: int = Field(16, ge=1, le=200)
    w_shape: float = 1.0
    w_cover: float = 0.0
    tau: float = engine.LINE_TAU
    min_fill: float = engine.MIN_FILL
    min_opacity: float = engine.MIN_OPACITY
    # 팀 서버가 pgvector + SQL WHERE 로 후보를 고른 경우 그 tattoo_seq 목록.
    # 넘기면 엔진의 1단계를 건너뛴다.
    candidate_keys: list[int] | None = None


class DesignReq(BaseModel):
    key: int
    image_b64: str


def _b64(s: str, what: str, limit: int) -> bytes:
    # "data:image/png;base64,..." 접두어 허용. base64 알파벳이 아닌 문자는 무시된다.
    s = s[s.rfind(",") + 1:] if "," in s else s
    if len(s) > limit:
        raise BadRequest(f"{what} 가 너무 크다: {len(s)}B > {limit}B")
    try:
        return base64.b64decode(s, validate=False)
    except (binascii.Error, ValueError) as e:
        raise BadRequest(f"base64 디코딩 실패: {e}") from e


@app.get("/health")
def health():
    store: FeatureStore | None = _state["store"]
    s = store.stats() if store else {"rows": 0, "alive": 0}
    return {"status": "ok", "ready": _state["ready"],
            "rows": s["rows"], "alive": s["alive"],
            "stage1": STAGE1, "max_concurrent": MAX_CONCURRENT,
            "auth": bool(API_SECRET)}


@app.post("/search")
def search(req: SearchReq):
    if not _state["ready"]:
        return JSONResponse(status_code=503, content={"detail": "워밍업 중"})
    searcher: Searcher = _state["searcher"]
    store: FeatureStore = _state["store"]
    if store.count == 0:
        return JSONResponse(status_code=503,
                            content={"detail": f"스토어가 비어 있다({STORE_DIR}). 색인 먼저"})

    raw = _b64(req.mask_png_b64, "mask_png_b64", MAX_MASK_BODY)
    cand = None
    if req.candidate_keys is not None:
        rows = [store.row_of(k) for k in req.candidate_keys]
        cand = np.array([r for r in rows if r is not None], np.int64)

    if not _slots.acquire(timeout=5.0):
        return JSONResponse(status_code=503, content={"detail": "검색 동시 처리 한도 초과"})
    try:
        return searcher.search(raw, mode=req.mode, top_k=req.top_k,
                               w_shape=req.w_shape, w_cover=req.w_cover,
                               tau=req.tau, min_fill=req.min_fill,
                               min_opacity=req.min_opacity, candidates=cand)
    finally:
        _slots.release()


@app.post("/designs", status_code=201)
def add_design(req: DesignReq):
    """
    도안 1장 색인. 이미 있는 key 면 기존 행을 죽이고 새로 붙인다(이미지 교체).
    디스크에 먼저 쓰고 메모리(mmap)를 갱신하는 순서다 — 반대로 하면 재시작 때
    조용히 사라진다.
    """
    store: FeatureStore = _state["store"]
    rec = design_record(req.key, _b64(req.image_b64, "image_b64", MAX_IMAGE_BODY))
    if rec is None:
        raise BadRequest("이미지 디코딩 실패 또는 빈 마스크")
    store.append([rec])
    return {"key": req.key, "row": store.row_of(req.key), "rows": store.count}


@app.post("/designs/batch", status_code=201)
def add_designs(items: list[DesignReq] = Body(...)):
    store: FeatureStore = _state["store"]
    src = ((it.key, _b64(it.image_b64, "image_b64", MAX_IMAGE_BODY)) for it in items)
    return index_all(store, src)


@app.delete("/designs/{key}")
def delete_design(key: int):
    """
    tombstone 만 세운다(행은 남는다). 파일 중간을 빼면 뒤가 다 밀리기 때문이다.
    빈 자리는 나중에 compaction 으로 일괄 정리한다.
    """
    store: FeatureStore = _state["store"]
    n = store.delete([key])
    if n == 0:
        return JSONResponse(status_code=404, content={"detail": f"없는 key: {key}"})
    return {"key": key, "deleted": n, "alive": store.stats()["alive"]}


@app.get("/stats")
def stats():
    store: FeatureStore = _state["store"]
    s = store.stats()
    searcher: Searcher = _state["searcher"]
    alive = s["alive"]
    s["candidate_k"] = searcher.candidate_k(alive) if alive else 0
    s["stage1_active"] = searcher.stage1_on(alive)
    s["disk_bytes"] = s["rows"] * s["bytes_per_design"]
    return s
