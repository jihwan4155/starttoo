"""
특징 스토어 — 도안당 고정 길이 레코드를 raw 바이너리로 두고 mmap 으로 읽는다.

왜 npz 가 아니라 raw 인가:
  · npz 는 zip 이라 mmap 이 안 된다(np.load(mmap_mode=) 가 무시된다). 수백만 장이
    되면 전체(수십 GB)를 메모리에 올릴 수 없으므로 mmap 이 전제조건이다.
  · 레코드가 고정 길이라 i번 도안의 위치가 i*4096 으로 즉시 나온다. 인덱스 탐색이
    없다. 후보 K개만 fancy indexing 하면 그 페이지만 실제로 읽힌다.
  · 파일 끝에 append 하면 증분 색인이 된다. 삭제는 alive 플래그(tombstone).

도안 1장당 디스크 (실측 18,448 B):
  norms/opac/line/ldist 각 4096 B = 16 KB
  + 스칼라 16 B + 모드별 서술자 2 x 256 x 4 B = 2 KB
  → 100만 장 18 GB / 500만 장 92 GB. 요청당 읽는 양은 K에만 비례한다.

ldist 는 거리변환을 1/8 px 고정소수점 uint8 로 정량화한 것이다. float32(16KB)를
그대로 두면 레코드가 2배가 되는데, exp(-d/tau) 로만 쓰이므로 그럴 필요가 없다.
표현 한계는 d=31.875 px 이고 그 이상은 clamp 된다 — tau<=8 에서 기여가 1e-4
미만이라 무해하다(LDIST_MAX_TAU 참고). tau 를 더 키우려면 스케일을 낮춰야 한다.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np

GRID = 64
AREA = GRID * GRID
EMB_DIM = 256      # 16x16 평균 풀링 서술자 (embed.py 참고)

LDIST_SCALE = 8            # 1 단위 = 1/8 px
LDIST_MAX = 255 / LDIST_SCALE   # = 31.875 px 까지 표현
LDIST_MAX_TAU = 8.0        # 이 tau 까지는 clamp 오차가 무시 가능하다

FORMAT = 2         # v1: 임베딩 1벌 128차원(Fourier-Mellin, 기각) -> v2: 모드별 2벌 256차원

# (파일명, dtype, 행당 원소 수)
_MAPS = (
    ("norms.u8", np.uint8, AREA),
    ("opac.u8", np.uint8, AREA),
    ("line.u8", np.uint8, AREA),
    ("ldist.u8", np.uint8, AREA),
)
_SCALARS = (
    ("keys.i64", np.int64, 1),
    ("alive.u8", np.uint8, 1),
    ("fill.f32", np.float32, 1),
    ("opacity.f32", np.float32, 1),
)
# 모드별로 서술자가 다르다. line 은 chamfer 근접도(exp(-d/tau))를, gate 는 실루엣을
# 풀링한다 — 두 모드의 점수 함수가 각각 chamfer 와 IoU 라서 유도식이 다르다.
_EMBEDS = (
    ("emb_line.f32", np.float32, EMB_DIM),
    ("emb_gate.f32", np.float32, EMB_DIM),
)
_ALL = _MAPS + _SCALARS + _EMBEDS


def quantize_dist(d: np.ndarray) -> np.ndarray:
    """거리변환 float32 -> 1/8 px uint8."""
    return np.clip(np.rint(d * LDIST_SCALE), 0, 255).astype(np.uint8)


class Record:
    """도안 1장의 특징. builder 가 만들어 store.append() 에 넘긴다."""

    __slots__ = ("key", "fill", "opacity", "norms", "opac", "line", "ldist",
                 "emb_line", "emb_gate")

    def __init__(self, key: int, fill: float, opacity: float,
                 norms: np.ndarray, opac: np.ndarray, line: np.ndarray,
                 ldist: np.ndarray, emb_line: np.ndarray, emb_gate: np.ndarray):
        self.key = int(key)
        self.fill = float(fill)
        self.opacity = float(opacity)
        self.norms = norms
        self.opac = opac
        self.line = line
        self.ldist = ldist
        self.emb_line = emb_line
        self.emb_gate = emb_gate


class FeatureStore:
    """
    읽기는 mmap, 쓰기는 append. 한 프로세스에서 쓰고 여러 프로세스가 읽는 형태를
    전제로 한다(uvicorn 워커들이 같은 파일을 mmap 하면 OS 페이지 캐시를 공유하므로
    인덱스가 워커 수만큼 상주하지 않는다 — 이게 raw+mmap 을 고른 핵심 이유다).
    """

    def __init__(self, dirpath: str | Path):
        self.dir = Path(dirpath)
        self.count = 0
        self._mm: dict[str, np.memmap] = {}
        self._key2row: dict[int, int] = {}
        self._meta_sig: tuple | None = None
        if (self.dir / "meta.json").exists():
            self._load()
        else:
            # 스토어가 아직 없어도 배열 접근이 KeyError 로 죽지 않게 빈 매핑을 만든다.
            # 서버가 빈 스토어로 부팅한 뒤 CLI 가 색인하면 refresh() 가 집어 올린다.
            self._remap()

    # -- 생성 -------------------------------------------------------------
    @classmethod
    def create(cls, dirpath: str | Path, overwrite: bool = False) -> "FeatureStore":
        d = Path(dirpath)
        if d.exists() and overwrite:
            shutil.rmtree(d)
        d.mkdir(parents=True, exist_ok=True)
        for name, _, _ in _ALL:
            (d / name).write_bytes(b"")
        (d / "meta.json").write_text(json.dumps({
            "format": FORMAT, "count": 0, "grid": GRID,
            "ldist_scale": LDIST_SCALE, "emb_dim": EMB_DIM,
        }, indent=2), encoding="utf-8")
        return cls(d)

    # -- 로드/매핑 ---------------------------------------------------------
    def _load(self) -> None:
        meta = json.loads((self.dir / "meta.json").read_text(encoding="utf-8"))
        if meta.get("format") != FORMAT:
            raise ValueError(f"스토어 포맷 {meta.get('format')} != {FORMAT}. 재빌드 필요")
        if meta.get("grid") != GRID or meta.get("ldist_scale") != LDIST_SCALE:
            raise ValueError("grid/ldist_scale 이 코드와 다르다. 재빌드 필요")
        self.count = int(meta["count"])
        self._meta_sig = self._sig()
        self._remap()
        keys = np.asarray(self._mm["keys.i64"]).reshape(-1)
        self._key2row = {int(k): i for i, k in enumerate(keys)}

    def _sig(self) -> tuple | None:
        """meta.json 의 변경 감지용 지문."""
        try:
            st = (self.dir / "meta.json").stat()
        except FileNotFoundError:
            return None
        return (st.st_mtime_ns, st.st_size, st.st_ino if hasattr(st, "st_ino") else 0)

    def refresh(self) -> bool:
        """
        다른 프로세스가 색인/삭제한 것을 이 프로세스가 보게 하는 유일한 경로.

        워커 프로세스를 여러 개 띄우면 각자 자기 mmap 을 들고 있다. 쓰기 담당
        프로세스가 append/delete 해도 읽기 워커의 count·alive 는 그대로여서, 새로
        승인한 도안이 "어떤 요청에는 나오고 어떤 요청에는 안 나오는" 재현 불가
        버그가 된다. 그래서 요청마다 meta.json 을 stat 해서(수 마이크로초) 바뀌었을
        때만 다시 매핑한다. append 와 delete 둘 다 meta.json 을 갱신한다.

        @return 실제로 다시 매핑했으면 True
        """
        if self._sig() == self._meta_sig:
            return False
        self._load()
        return True

    def _remap(self) -> None:
        self._mm.clear()
        for name, dtype, per in _ALL:
            path = self.dir / name
            if self.count == 0:
                # 스토어가 아직 없을 수도 있다(서버가 빈 볼륨으로 부팅하고 CLI 가
                # 나중에 만드는 순서). 파일을 stat 하지 않고 빈 배열만 놓는다.
                self._mm[name] = np.empty((0, per), dtype)
                continue
            expect = self.count * per * np.dtype(dtype).itemsize
            actual = path.stat().st_size
            if actual != expect:
                # 행 수가 어긋나면 도안 A 점수에 도안 B 이미지가 붙는다.
                # 조용히 틀린 결과를 내는 대신 여기서 멈춘다.
                raise ValueError(
                    f"{name}: {actual}B 인데 count={self.count} 면 {expect}B 여야 한다. "
                    "스토어가 깨졌다 — 재빌드 필요")
            self._mm[name] = np.memmap(path, dtype=dtype, mode="r",
                                       shape=(self.count, per))

    # -- 배열 접근 (읽기 전용 뷰) -------------------------------------------
    @property
    def keys(self) -> np.ndarray:
        return np.asarray(self._mm["keys.i64"]).reshape(-1)

    @property
    def alive(self) -> np.ndarray:
        return np.asarray(self._mm["alive.u8"]).reshape(-1)

    @property
    def fill(self) -> np.ndarray:
        return np.asarray(self._mm["fill.f32"]).reshape(-1)

    @property
    def opacity(self) -> np.ndarray:
        return np.asarray(self._mm["opacity.f32"]).reshape(-1)

    def norms(self, rows) -> np.ndarray:
        return self._take("norms.u8", rows)

    def opac(self, rows) -> np.ndarray:
        return self._take("opac.u8", rows)

    def line(self, rows) -> np.ndarray:
        return self._take("line.u8", rows)

    def ldist(self, rows) -> np.ndarray:
        """후보 행의 거리맵을 float32 px 단위로 되돌려 준다."""
        return self._take("ldist.u8", rows).astype(np.float32) / LDIST_SCALE

    def ldist_cols(self, rows, cols: np.ndarray) -> np.ndarray:
        """
        거리맵의 지정 칸만 float32 px 로. 선 모드는 쿼리 잉크가 있는 칸만 보므로
        (4096칸 중 보통 300~2000칸) 전체를 float 로 펼쳐 exp() 하는 낭비를 없앤다.
        """
        return self._take("ldist.u8", rows)[:, cols].astype(np.float32) / LDIST_SCALE

    def emb(self, mode: str) -> np.ndarray:
        """(N, EMB_DIM) 모드별 1단계 서술자."""
        return np.asarray(self._mm["emb_line.f32" if mode == "line" else "emb_gate.f32"])

    def _take(self, name: str, rows) -> np.ndarray:
        mm = self._mm[name]
        if rows is None:
            return np.asarray(mm)
        rows = np.asarray(rows, dtype=np.int64)
        # 정렬해서 뽑으면 mmap 페이지를 앞에서 뒤로 한 번만 훑는다(랜덤 시크 감소).
        order = np.argsort(rows, kind="stable")
        out = np.empty((len(rows), mm.shape[1]), mm.dtype)
        out[order] = mm[rows[order]]
        return out

    # -- 쓰기 -------------------------------------------------------------
    def append(self, recs: list[Record]) -> list[int]:
        """
        파일 끝에 붙인다. 이미 있는 key 는 기존 행을 죽이고 새 행을 붙인다
        (도안 이미지 교체 = 특징만 갱신, key 는 유지).
        """
        if not recs:
            return []
        dead = [self._key2row[r.key] for r in recs if r.key in self._key2row]
        blocks = {
            "norms.u8": [r.norms for r in recs],
            "opac.u8": [r.opac for r in recs],
            "line.u8": [r.line for r in recs],
            "ldist.u8": [r.ldist for r in recs],
            "keys.i64": [np.int64(r.key) for r in recs],
            "alive.u8": [np.uint8(1) for _ in recs],
            "fill.f32": [np.float32(r.fill) for r in recs],
            "opacity.f32": [np.float32(r.opacity) for r in recs],
            "emb_line.f32": [r.emb_line for r in recs],
            "emb_gate.f32": [r.emb_gate for r in recs],
        }
        for name, dtype, per in _ALL:
            buf = np.concatenate([np.asarray(b, dtype).reshape(-1) for b in blocks[name]])
            assert buf.size == len(recs) * per, name
            with open(self.dir / name, "ab") as f:
                f.write(buf.tobytes())

        first = self.count
        self.count += len(recs)
        self._write_meta()
        self._remap()
        for i, r in enumerate(recs):
            self._key2row[r.key] = first + i
        if dead:
            self._set_alive(dead, 0)
        return list(range(first, self.count))

    def delete(self, keys: list[int]) -> int:
        rows = [self._key2row[k] for k in keys if k in self._key2row]
        if rows:
            self._set_alive(rows, 0)
            # count 는 안 바뀌지만 meta.json 을 다시 써서 mtime 을 올린다.
            # 이게 없으면 다른 워커의 refresh() 가 삭제를 감지하지 못한다.
            self._write_meta()
            self._meta_sig = self._sig()
        return len(rows)

    def _set_alive(self, rows: list[int], value: int) -> None:
        path = self.dir / "alive.u8"
        with open(path, "r+b") as f:
            for r in rows:
                f.seek(r)
                f.write(bytes([value]))
        self._mm["alive.u8"] = np.memmap(path, dtype=np.uint8, mode="r",
                                         shape=(self.count, 1))

    def _write_meta(self) -> None:
        (self.dir / "meta.json").write_text(json.dumps({
            "format": FORMAT, "count": self.count, "grid": GRID,
            "ldist_scale": LDIST_SCALE, "emb_dim": EMB_DIM,
        }, indent=2), encoding="utf-8")

    # -- 조회 -------------------------------------------------------------
    def row_of(self, key: int) -> int | None:
        return self._key2row.get(int(key))

    def alive_rows(self) -> np.ndarray:
        if self.count == 0:
            return np.empty(0, np.int64)
        return np.nonzero(self.alive)[0].astype(np.int64)

    def gate_rows(self, min_fill: float, min_opacity: float) -> np.ndarray:
        """
        게이트 1단계를 로컬에서 적용한다. 운영에서는 이 필터를 pgvector 쿼리의
        WHERE 로 내려서 O(N) 스캔 자체를 없앤다(engine.search 의 candidates 인자).
        """
        if self.count == 0:
            return np.empty(0, np.int64)
        ok = (self.alive > 0) & (self.fill >= min_fill) & (self.opacity >= min_opacity)
        return np.nonzero(ok)[0].astype(np.int64)

    def stats(self) -> dict:
        alive = int(self.alive.sum()) if self.count else 0
        return {"rows": self.count, "alive": alive, "dead": self.count - alive,
                "bytes_per_design": AREA * 4 + 8 + 8 + EMB_DIM * 4 * 2}
