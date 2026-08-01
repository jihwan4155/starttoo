"""
도안 이미지 -> 특징 레코드. 배치 적재와 증분 색인이 같은 함수를 쓴다.

coverup3 의 build_coverup.py 는 폴더를 훑어 npz 를 통째로 새로 쓰는 배치 전용이었다.
수백만 장이 되면 전체 재빌드가 불가능하므로(MinIO 다운로드 + OpenCV 로 100만 장이면
16워커 병렬에도 1~2시간) 레코드 단위로 만들어 append 하는 형태로 바꿨다.

이미지 소스는 (key, bytes) 이터레이터로 추상화했다. 테스트는 로컬 폴더, 운영은
MinIO 를 물린다 — 엔진은 어느 쪽인지 모른다.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, Iterator

import cv2
import numpy as np

from . import engine, features
from .embed import gate_descriptor, line_descriptor
from .store import FeatureStore, LDIST_SCALE, Record, quantize_dist


def design_record(key: int, data: bytes) -> Record | None:
    """
    도안 이미지 바이트 -> Record. 디코딩 실패·빈 마스크면 None.

    fill/opacity 는 64x64 정규화 맵이 아니라 '원본 해상도의 실루엣 내부'에서 잰다.
    정규화 맵에서 재면 경계 픽셀 비중이 커서 값이 0쪽으로 희석된다.
    """
    decoded = features.decode_design(data)
    if decoded is None:
        return None
    bgr, mask = decoded

    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(mask)
    if cnts:
        cv2.drawContours(filled, cnts, -1, 255, thickness=cv2.FILLED)
    region = max(1, int((filled > 0).sum()))
    fg = mask > 0
    fill_ratio = float(fg.sum()) / region

    opac_gray = features.opacity_map(bgr, mask)
    opacity = float(opac_gray[fg].mean() / 255.0) if fg.any() else 0.0

    norm, opac = engine.normalize_pair(mask, opac_gray)
    line = engine.normalize_pair(mask, None, line=True)[0]
    ldist = quantize_dist(engine.dist_to_ink(line))

    # 1단계 서술자는 방금 만든 특징에서 그대로 유도된다(새 이미지 연산 없음).
    # line 은 거리변환에서, gate 는 실루엣에서 — 각 모드의 점수 함수를 근사한다.
    dist_px = ldist.reshape(-1).astype(np.float32) / LDIST_SCALE

    return Record(key=key, fill=fill_ratio, opacity=opacity,
                  norms=norm.reshape(-1), opac=opac.reshape(-1),
                  line=line.reshape(-1), ldist=ldist.reshape(-1),
                  emb_line=line_descriptor(dist_px)[0],
                  emb_gate=gate_descriptor(norm.reshape(-1))[0])


def index_all(store: FeatureStore, source: Iterable[tuple[int, bytes]],
              batch: int = 256, on_progress=None) -> dict:
    """
    (key, bytes) 스트림을 배치로 색인한다. 실패한 key 를 그대로 돌려주므로
    호출측이 tattoo_designs.indexed 를 false 로 남겨 재시도할 수 있다.
    """
    added, failed, buf = 0, [], []
    for key, data in source:
        rec = design_record(key, data)
        if rec is None:
            failed.append(int(key))
            continue
        buf.append(rec)
        if len(buf) >= batch:
            store.append(buf)
            added += len(buf)
            buf = []
            if on_progress:
                on_progress(added, len(failed))
    if buf:
        store.append(buf)
        added += len(buf)
    if on_progress:
        on_progress(added, len(failed))
    return {"added": added, "failed": failed}


# --- 이미지 소스 두 가지 --------------------------------------------------

_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def local_folder(root: str | Path) -> Iterator[tuple[int, bytes]]:
    """
    로컬 폴더 소스 (테스트·오프라인 적재용). 파일명 앞부분이 정수면 그것을 key 로,
    아니면 정렬 순서를 key 로 쓴다.
    """
    root = Path(root)
    paths = sorted(p for p in root.rglob("*") if p.suffix.lower() in _EXTS)
    for i, p in enumerate(paths):
        stem = p.stem.split("_")[0]
        key = int(stem) if stem.isdigit() else i + 1
        yield key, p.read_bytes()


def minio_source(client, bucket: str, items: Iterable[tuple[int, str]]) -> Iterator[tuple[int, bytes]]:
    """
    MinIO 소스. items 는 (tattoo_seq, object_key) — 팀 DB 에서
    tattoo_designs JOIN images 로 뽑아 넘긴다.
    """
    for key, object_key in items:
        resp = client.get_object(bucket, object_key)
        try:
            yield key, resp.read()
        finally:
            resp.close()
            resp.release_conn()
