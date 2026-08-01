"""
운영 CLI. 컨테이너 안에서 실행한다.

    docker compose exec ai python -m coverup.cli stat
    docker compose exec ai python -m coverup.cli index --source minio --manifest /data/designs.tsv
    docker compose exec ai python -m coverup.cli index --source folder --path /data/images

왜 HTTP(POST /designs) 가 아니라 CLI 인가
  · base64 가 33% 부풀린다. 도안 평균 2MB 면 100만 장에 2.7TB 를 HTTP 로 밀어야 한다
  · 요청마다 파일 쓰기가 한 번씩 일어나 배치 이득이 사라진다
  · 왕복 지연이 장당 붙는다 (100만 장 × 1ms = 17분)
  CLI 는 볼륨의 파일에 직접 쓴다. 네트워크를 타지 않는다.

병렬과 직렬을 나눈다
  다운로드는 네트워크 대기라 병렬이 이득이고, 특징 계산도 OpenCV·numpy 가 GIL 을
  놓아 스레드로 병렬이 된다. 그런데 **store.append() 는 반드시 단일 스레드다** —
  두 스레드가 같은 파일 끝에 동시에 쓰면 바이트가 섞여 스토어가 깨지고, 도안 A 의
  점수에 도안 B 의 이미지가 붙는다. 그래서 워커는 레코드만 만들고 붙이는 건 메인
  스레드가 한다.

서버를 띄운 채 돌려도 되나
  된다. append() 가 데이터 파일을 먼저 쓰고 meta.json 을 나중에 갱신하므로, 서버가
  새 meta.json 을 본 시점에는 데이터가 이미 디스크에 있다(중간 상태를 읽을 수 없다).
  단 **쓰는 쪽이 하나여야 한다** — COVERUP_ENABLED=true 로 켜면 백엔드의 색인 동기화
  스캔도 쓰기 때문에 최초 적재는 켜기 전에 끝내야 한다.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable, Iterable, Iterator
from urllib.parse import urlparse

from .builder import design_record, local_folder
from .store import FeatureStore, Record

DEFAULT_STORE = os.environ.get("COVERUP_STORE", "coverup_store")
PROGRESS_EVERY_SEC = 3.0

# 출력에 한글이 있다. 윈도우 콘솔 기본 코드페이지(cp949)나 로케일 미설정 컨테이너에서
# UnicodeEncodeError 로 죽지 않게 UTF-8 로 고정한다.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# 이미지 소스
# ---------------------------------------------------------------------------
def read_manifest(path: str | Path) -> list[tuple[int, str]]:
    """
    TSV 매니페스트: `tattoo_seq<TAB>object_key`. 빈 줄과 # 주석은 건너뛴다.

    백엔드가 이 SQL 로 만들어 준다 (엔진이 DB 를 직접 보지 않게 하려는 것이다):

        SELECT td.tattoo_seq, i.object_key
        FROM   tattoo_designs td
        JOIN   images  i ON i.image_seq  = td.image_seq
        JOIN   tattoos t ON t.tattoo_seq = td.tattoo_seq
        WHERE  td.is_deleted = false AND i.is_deleted = false AND t.is_deleted = false;
    """
    items: list[tuple[int, str]] = []
    with open(path, encoding="utf-8") as f:
        for lineno, raw in enumerate(f, 1):
            line = raw.rstrip("\r\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) != 2:
                raise SystemExit(
                    f"{path}:{lineno}: 탭으로 구분된 2개 필드가 필요하다 "
                    f"(tattoo_seq<TAB>object_key). 실제 {len(parts)}개: {line[:80]!r}")
            key_text, object_key = parts[0].strip(), parts[1].strip()
            if not key_text.isdigit():
                raise SystemExit(f"{path}:{lineno}: tattoo_seq 가 정수가 아니다: {key_text!r}")
            items.append((int(key_text), object_key))
    return items


def minio_fetcher() -> Callable[[str], bytes]:
    """
    MinIO 에서 오브젝트 바이트를 받아오는 함수. 접속 정보는 환경변수로 받는다
    (compose 의 backend 와 같은 이름을 쓴다).
    """
    try:
        from minio import Minio                          # noqa: PLC0415
    except ImportError as e:                             # pragma: no cover
        raise SystemExit("minio 패키지가 없다. pip install minio") from e

    endpoint = os.environ.get("MINIO_ENDPOINT", "http://minio:9000")
    parsed = urlparse(endpoint if "//" in endpoint else f"//{endpoint}")
    host = parsed.netloc or parsed.path
    bucket = os.environ.get("MINIO_BUCKET", "starttoo")
    client = Minio(
        host,
        access_key=os.environ.get("MINIO_ACCESS_KEY", "starttoo"),
        secret_key=os.environ.get("MINIO_SECRET_KEY", ""),
        secure=parsed.scheme == "https",
    )

    def fetch(object_key: str) -> bytes:
        resp = client.get_object(bucket, object_key)
        try:
            return resp.read()
        finally:
            resp.close()
            resp.release_conn()

    print(f"[minio] {host} / 버킷 {bucket}")
    return fetch


def folder_items(path: str | Path) -> tuple[list[tuple[int, str]], Callable[[str], bytes]]:
    """로컬 폴더 소스 (개발·테스트용). key 는 파일명 앞 정수, 없으면 정렬 순서."""
    items = [(key, str(p)) for key, p in _folder_pairs(path)]

    def fetch(file_path: str) -> bytes:
        return Path(file_path).read_bytes()

    return items, fetch


def _folder_pairs(root: str | Path) -> Iterator[tuple[int, Path]]:
    root = Path(root)
    if not root.is_dir():
        raise SystemExit(f"폴더가 없다: {root}")
    exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
    paths = sorted(p for p in root.rglob("*") if p.suffix.lower() in exts)
    for i, p in enumerate(paths):
        stem = p.stem.split("_")[0]
        yield (int(stem) if stem.isdigit() else i + 1), p


# ---------------------------------------------------------------------------
# 병렬 레코드 생성 (다운로드 + 특징 계산) — 붙이기는 호출측 단일 스레드
# ---------------------------------------------------------------------------
def _make_record(key: int, ref: str, fetch: Callable[[str], bytes]) -> Record | None:
    try:
        return design_record(key, fetch(ref))
    except Exception as e:                    # 다운로드 실패·깨진 파일 등
        print(f"  [실패] key={key} ref={ref}: {type(e).__name__}: {e}", file=sys.stderr)
        return None


def _records(items: Iterable[tuple[int, str]], fetch: Callable[[str], bytes],
             workers: int) -> Iterator[tuple[int, Record | None]]:
    """
    입력 순서대로 (key, Record|None) 을 낸다. 앞서 나가는 작업 수를 workers*2 로
    묶어 이미지 바이트가 메모리에 무한정 쌓이지 않게 한다.
    """
    if workers <= 1:
        for key, ref in items:
            yield key, _make_record(key, ref, fetch)
        return

    it = iter(items)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        pending: deque = deque()

        def submit() -> bool:
            try:
                key, ref = next(it)
            except StopIteration:
                return False
            pending.append((key, pool.submit(_make_record, key, ref, fetch)))
            return True

        for _ in range(workers * 2):
            if not submit():
                break
        while pending:
            key, fut = pending.popleft()
            yield key, fut.result()
            submit()


# ---------------------------------------------------------------------------
# index
# ---------------------------------------------------------------------------
def cmd_index(args: argparse.Namespace) -> int:
    store = _open_store(args.store, create=True)

    if args.source == "minio":
        if not args.manifest:
            raise SystemExit("--source minio 에는 --manifest 가 필요하다")
        items = read_manifest(args.manifest)
        fetch = minio_fetcher()
    else:
        if not args.path:
            raise SystemExit("--source folder 에는 --path 가 필요하다")
        items, fetch = folder_items(args.path)

    total_listed = len(items)
    if args.limit:
        items = items[: args.limit]

    # 재개: 이미 색인된 key 는 건너뛴다. row_of 는 O(1) 이라 재개 비용이 사실상 0이다.
    todo = items if args.reindex else [(k, r) for k, r in items if store.row_of(k) is None]
    skipped = len(items) - len(todo)

    print(f"[index] 매니페스트 {total_listed}건"
          + (f" (--limit {args.limit})" if args.limit else "")
          + f" / 이미 색인됨 {skipped}건 건너뜀 / 처리할 {len(todo)}건")
    print(f"[index] 워커 {args.workers} · 배치 {args.batch} · 스토어 {store.dir}")
    if not todo:
        print("[index] 할 일이 없다.")
        return 0

    added, failed, buf = 0, [], []
    t0 = last = time.monotonic()
    interrupted = False
    try:
        for key, rec in _records(todo, fetch, args.workers):
            if rec is None:
                failed.append(key)
            else:
                buf.append(rec)
                if len(buf) >= args.batch:
                    store.append(buf)
                    added += len(buf)
                    buf = []
            now = time.monotonic()
            if now - last >= PROGRESS_EVERY_SEC:
                _progress(added + len(buf), len(failed), len(todo), t0)
                last = now
    except KeyboardInterrupt:
        interrupted = True
        print("\n[index] 중단 요청 — 진행분을 저장한다", file=sys.stderr)
    finally:
        if buf:
            store.append(buf)
            added += len(buf)

    _progress(added, len(failed), len(todo), t0, final=True)

    if failed:
        # 기본 위치는 스토어 디렉토리다. 컨테이너의 작업 디렉토리(/app)는 root 소유이고
        # 프로세스는 non-root 로 도니 거기 쓰려면 PermissionError 가 난다.
        out = Path(args.failed) if args.failed else store.dir / "failed.txt"
        out.write_text("\n".join(str(k) for k in failed) + "\n", encoding="utf-8")
        print(f"[index] 실패 {len(failed)}건 -> {out}")
        print("        백엔드가 tattoo_designs.indexed=false 로 두고 주기 스캔에서")
        print("        재시도하지만, 계속 실패하면 이미지 자체 문제이므로 확인이 필요하다.")

    s = store.stats()
    print(f"[index] 스토어: 행 {s['rows']} · 살아있음 {s['alive']} · "
          f"디스크 {s['rows'] * s['bytes_per_design'] / 1e6:.1f} MB")
    if interrupted:
        print("[index] 같은 명령을 다시 실행하면 이어서 진행한다.")
        return 130
    return 0


def _progress(done: int, failed: int, total: int, t0: float, final: bool = False) -> None:
    elapsed = time.monotonic() - t0
    seen = done + failed
    tag = "완료" if final else "진행"
    msg = (f"[{tag}] {seen}/{total} ({seen / max(total, 1):.1%}) · "
           f"성공 {done} 실패 {failed} · 경과 {_dur(elapsed)}")
    # 경과가 너무 짧으면 속도·ETA 가 의미 없는 숫자가 된다(0으로 나누는 것에 가깝다).
    if elapsed >= 0.5:
        rate = seen / elapsed
        msg += f" · {rate:.1f}건/s"
        if not final and rate > 0:
            msg += f" · 남은 시간 ~{_dur((total - seen) / rate)}"
    print(msg, flush=True)


def _dur(sec: float) -> str:
    sec = int(sec)
    if sec < 60:
        return f"{sec}s"
    if sec < 3600:
        return f"{sec // 60}m{sec % 60:02d}s"
    return f"{sec // 3600}h{(sec % 3600) // 60:02d}m"


# ---------------------------------------------------------------------------
# stat
# ---------------------------------------------------------------------------
def cmd_stat(args: argparse.Namespace) -> int:
    store = _open_store(args.store, create=False)
    s = store.stats()
    disk = s["rows"] * s["bytes_per_design"]
    dead_ratio = s["dead"] / s["rows"] if s["rows"] else 0.0

    print(f"스토어      {store.dir}")
    print(f"행           {s['rows']:,}")
    print(f"살아있음     {s['alive']:,}")
    print(f"tombstone    {s['dead']:,} ({dead_ratio:.1%})")
    print(f"도안당       {s['bytes_per_design'] / 1024:.1f} KB")
    print(f"디스크       {disk / 1e6:.1f} MB")

    if s["rows"] == 0:
        print("\n스토어가 비어 있다. /search 는 503 을 낸다 — index 를 먼저 실행하라.")
    elif dead_ratio > 0.2:
        print(f"\ntombstone 이 {dead_ratio:.0%} 다. 죽은 행도 디스크와 스캔 비용을 "
              "차지하므로 compaction 을 고려하라(작업 B, 아직 미구현).")
    return 0


# ---------------------------------------------------------------------------
def _open_store(path: str, create: bool) -> FeatureStore:
    d = Path(path)
    if not (d / "meta.json").exists():
        if not create:
            raise SystemExit(f"스토어가 없다: {d}")
        print(f"[store] 새로 만든다: {d}")
        return FeatureStore.create(d)
    return FeatureStore(d)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m coverup.cli",
        description="커버업 검색 엔진 운영 CLI (컨테이너 안에서 실행)")
    p.add_argument("--store", default=DEFAULT_STORE,
                   help=f"특징 파일 디렉토리 (기본 {DEFAULT_STORE})")
    sub = p.add_subparsers(dest="cmd", required=True)

    ix = sub.add_parser("index", help="도안을 색인한다 (중단 후 재실행하면 이어서 진행)")
    ix.add_argument("--source", choices=("minio", "folder"), default="minio")
    ix.add_argument("--manifest", help="TSV: tattoo_seq<TAB>object_key (minio 소스)")
    ix.add_argument("--path", help="이미지 폴더 (folder 소스)")
    ix.add_argument("--workers", type=int, default=8,
                    help="다운로드·특징계산 병렬도. 붙이기는 항상 단일 스레드다 (기본 8)")
    ix.add_argument("--batch", type=int, default=512, help="한 번에 붙일 레코드 수 (기본 512)")
    ix.add_argument("--limit", type=int, help="앞에서 N건만 처리 (시험용)")
    ix.add_argument("--reindex", action="store_true",
                    help="이미 색인된 key 도 다시 처리한다 (이미지 교체용)")
    ix.add_argument("--failed", default=None,
                    help="실패한 key 목록 출력 경로 (기본: <store>/failed.txt)")
    ix.set_defaults(func=cmd_index)

    st = sub.add_parser("stat", help="스토어 상태를 본다")
    st.set_defaults(func=cmd_stat)

    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
