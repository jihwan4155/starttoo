# ai — 커버업 도안 검색 엔진

유저가 캔버스에 그린 형태를 받아 닮은 타투 도안 순위를 매겨 돌려주는 **내부 전용**
서비스다. 유저·DB·이미지 저장소를 모르고 순수 검색만 한다.

- `backend` 가 `starttoo-net` 안에서 `http://ai:8000` 으로 호출한다
- 프론트는 이 서비스를 직접 부르지 않는다
- 이미지 파일을 읽거나 서빙하지 않는다 (색인할 때 한 번만 읽는다)

## 구조

```
coverup/
├─ store.py     도안당 고정 18KB 레코드 raw 파일 + mmap. append / tombstone / refresh
├─ features.py  알파 채널을 실루엣 마스크로 (누끼 대응) + 흰배경 폴백
├─ engine.py    line 채점(chamfer). 후보 행 배열만 순회한다
├─ embed.py     1단계 후보 추림용 서술자 (chamfer 풀링 256차원)
├─ builder.py   도안 이미지 → 특징 레코드. 배치 적재와 증분 색인이 같은 코드
├─ service.py   1단계 후보 추림 + 2단계 정확 재채점 오케스트레이션
└─ app.py       FastAPI 엔드포인트
tests/          정확성·계약·성능 검증 (이미지에는 포함되지 않는다)
```

각 파일 상단 주석에 왜 그렇게 만들었는지가 적혀 있다.

## 검색이 동작하는 방식

계산 시점이 셋으로 분리돼 있다.

| 시점 | 하는 일 |
|---|---|
| **색인할 때** (도안 1장당 1회) | 이미지를 읽어 64×64 특징맵 4종을 뽑아 파일에 append |
| **부팅할 때** | 특징 파일을 mmap. 이미지 연산 없음 |
| **요청마다** | 유저 마스크만 계산 → 후보 특징을 mmap 에서 읽어 채점 |

**요청 경로에 이미지 연산도 DB 도 없다.**

검색 모드는 `line` 하나다 — 그린 **선의 궤적**을 닮은 도안을 찾고, 점수는 chamfer
재현·정밀의 조화평균이다.

면(`gate`) 모드는 제품에서 내리면서 검색 경로를 걷어냈다. 다만 스토어 포맷(FORMAT=2)의
`norms`·`emb_gate` 컬럼은 그대로 두어 색인할 때 계속 채운다 — 되살릴 때 전 도안
재색인을 피하기 위함이다. 컬럼까지 지우려면 FORMAT 을 3 으로 올려야 하고, 그 순간
기존 스토어가 전부 무효가 된다(장당 18.4KB → 9.2KB).

크기·회전·좌우반전에 무관하게 매칭한다(쿼리를 90°씩 4방향 회전 + 반전).

## API

오류 본문은 항상 `{"detail": "..."}`. 와이어 필드명은 snake_case 고정.

| | |
|---|---|
| `GET /health` | `{status, ready, rows, alive, stage1, max_concurrent, auth}` |
| `GET /stats` | 행 수 · tombstone · 디스크 · 후보 K · 1단계 활성 여부 |
| `POST /search` | 마스크 → `results[]` + `timing_ms` + `candidates` |
| `POST /designs` | `{key, image_b64}` → 도안 1장 색인 (같은 key 면 교체) |
| `POST /designs/batch` | 여러 장. 실패한 key 를 돌려준다 |
| `DELETE /designs/{key}` | tombstone (행은 남는다) |

`key` 는 **`tattoo_seq`** 다. 이 값으로 backend 가 DB 를 조회한다.

`/health` 를 제외한 모든 경로는 `X-Internal-Token` 헤더를 요구한다
(`COVERUP_INTERNAL_TOKEN` 이 설정된 경우). nginx 가 `/ai-service/` 를 공개로 열어 두므로
이 토큰이 유일한 방어선이다.

### `POST /search`

```json
{ "mask_png_b64": "iVBOR...", "mode": "line", "top_k": 24 }
```

`w_shape`/`w_cover`/`tau` 는 **보내지 않는다.** 튜닝된
서버 기본값이 있다. `candidate_keys` 를 넘기면 1단계를 건너뛰고 그 도안만 재채점한다
(나중에 pgvector 로 후보를 고를 때 쓰는 경로).

응답 `results[]` 는 `key`·`score`·`shape`·`cover`·`weak`·`rec`·`prec` 다.
backend 는 `key`·`score` 만 읽고 나머지는 디버깅용이다.

## 설정

| 환경변수 | 기본 | 뜻 |
|---|---|---|
| `COVERUP_STORE` | `/data/coverup_store` | 특징 파일 디렉토리 (볼륨) |
| `COVERUP_INTERNAL_TOKEN` | (빈값) | 내부 토큰. **비면 인증이 꺼진다** |
| `COVERUP_STAGE1` | `auto` | `auto`(3만 장 초과 시 on) / `on` / `off` |
| `COVERUP_MAX_MASK_BODY` | `102400` | 쿼리 마스크 base64 상한(B) |
| `COVERUP_MAX_IMAGE_BODY` | `10485760` | 도안 이미지 base64 상한(B) |
| `COVERUP_MAX_CONCURRENT` | 코어수-1 | 동시 검색 상한 |

## 최초 대량 적재 (운영 CLI)

스토어가 비어 있으면 `/search` 는 503 이다. **기존 도안 전체를 한 번 색인해야 검색이
동작한다.** 이후로는 백엔드의 증분 색인이 도안을 하나씩 추가하므로 다시 할 일이 없다.

### 1. 매니페스트를 만든다 (백엔드가 SQL 로)

엔진은 DB 를 직접 보지 않는다. TSV 한 장이 계약이다.

```sql
SELECT td.tattoo_seq, i.object_key
FROM   tattoo_designs td
JOIN   images  i ON i.image_seq  = td.image_seq
JOIN   tattoos t ON t.tattoo_seq = td.tattoo_seq
WHERE  td.is_deleted = false AND i.is_deleted = false AND t.is_deleted = false;
```

`tattoo_seq<TAB>object_key` 형식으로 저장해 컨테이너가 읽을 수 있는 곳에 둔다
(예: 볼륨 안 `/data/coverup_store/designs.tsv`).

### 2. 색인한다

```bash
docker compose exec ai python -m coverup.cli index --source minio --manifest /data/coverup_store/designs.tsv --workers 8
```

```bash
docker compose exec ai python -m coverup.cli stat
```

| 옵션 | 기본 | 뜻 |
|---|---|---|
| `--source` | `minio` | `minio` 또는 `folder`(개발용) |
| `--manifest` | — | TSV 경로 (minio 소스) |
| `--path` | — | 이미지 폴더 (folder 소스) |
| `--workers` | 8 | 다운로드·특징계산 병렬도. **붙이기는 항상 단일 스레드다** |
| `--batch` | 512 | 한 번에 붙일 레코드 수 |
| `--limit` | — | 앞에서 N건만 (시험용) |
| `--reindex` | off | 이미 색인된 key 도 다시 처리 (이미지 교체) |
| `--failed` | `<store>/failed.txt` | 실패한 key 목록 |

**중단해도 된다.** 같은 명령을 다시 실행하면 이미 색인된 key 를 건너뛰고 이어서 한다
(`store.row_of()` 가 O(1) 이라 재개 비용이 사실상 0이다). `Ctrl-C` 를 누르면 진행분을
저장하고 끝낸다.

실패한 도안은 `failed.txt` 에 남는다 — 깨진 파일, 알파가 전부 0인 빈 PNG 같은 것들이다.
백엔드가 `indexed=false` 로 두고 주기 스캔에서 재시도하지만, 계속 실패하면 이미지 자체
문제이므로 사람이 봐야 한다.

### 예상 시간

장당 약 20ms (다운로드 + 특징 계산) 기준.

| 도안 수 | 단일 | 8 워커 | 디스크 |
|---|---|---|---|
| 2,520 | 50초 | 10초 | 45 MB |
| 100,000 | 33분 | 5분 | 1.8 GB |
| 1,000,000 | 5.5시간 | 40분 | 18 GB |

### ⚠️ 순서 — 적재를 켜기 전에 끝낸다

**서버가 뜬 상태로 CLI 를 돌려도 된다.** `append()` 가 데이터 파일을 먼저 쓰고
`meta.json` 을 나중에 갱신하므로, 서버가 새 `meta.json` 을 본 시점에는 데이터가 이미
디스크에 있다. 서버는 요청마다 `meta.json` 을 stat 해 바뀌었을 때만 다시 매핑한다
(`store.refresh()`) — **재시작 없이 새 도안이 검색에 잡힌다.**

**단 쓰는 쪽이 하나여야 한다.** `COVERUP_ENABLED=true` 로 켜면 백엔드의 색인 동기화
스캔도 쓰기 때문에, 최초 적재는 **켜기 전에** 끝내야 한다.

```
① COVERUP_ENABLED=false 인 상태에서 ai 컨테이너 기동
② CLI 로 최초 적재
③ stat 으로 확인
④ COVERUP_INTERNAL_TOKEN 설정
⑤ COVERUP_ENABLED=true 로 백엔드 재기동
```

> **Git Bash 사용 시**: `/data/...` 같은 인수가 윈도우 경로로 바뀌어 엉뚱한 곳을
>가리킨다(MSYS 경로 변환). `MSYS_NO_PATHCONV=1` 을 앞에 붙이거나 PowerShell 을 쓴다.

## 로컬 실행

```bash
pip install -r requirements.txt
```

```bash
COVERUP_STORE=./coverup_store uvicorn coverup.app:app --port 8000
```

```bash
python -m coverup.cli --store ./coverup_store index --source folder --path ./images
```

## 검증

```bash
python -m tests.check          # 정확성 8종 (원본 대조·알파·정량화·회전 사각지대)
python -m tests.test_api       # HTTP 계약 + 인증
python -m tests.exp_descriptor # 1단계 서술자 A/B 비교
python -m tests.exp_quality    # 1단계가 깎는 실제 품질
python -m tests.bench_recall   # N 을 늘려가며 recall 곡선
```

`tests/check.py` 4번 항목은 원본 구현(coverup3)과 수치를 대조한다. 그 경로가 없으면
자동으로 건너뛴다. **알고리즘을 건드렸다면 이 항목을 반드시 다시 통과시켜야 한다.**

### 측정된 값

| | |
|---|---|
| 원본 대조 (line) | 결과 집합 12/12 일치, 점수 최대차 0.0017 (거리 정량화) |
| 누끼 처리 | 16종 도형에서 투명 영역 아래 RGB 와 무관하게 완전 일치 |
| 1단계 서술자 | K=10% 가 2단계 1위를 **100%** 포함 |
| 성능 (2,000장) | 전수 line 116ms · 2단계 line 25ms |
| 디스크 | **18.0 KB/도안** → 100만 장 18GB |

2단계를 켜면 후보 수가 고정되므로 **지연이 도안 수와 무관해진다.**

## ⚠️ 어기면 데이터가 깨지는 제약

1. **`--workers` 를 늘리지 마라.** 특징 파일 쓰기(`POST/DELETE /designs`)가 단일
   프로세스여야 한다. 두 워커가 같은 파일에 동시에 append 하면 스토어가 깨지고,
   도안 A 의 점수에 도안 B 의 이미지가 붙는다.
2. **특징 파일을 네트워크 스토리지에 두지 마라.** 요청당 33MB 랜덤 읽기다.
3. **증분 색인은 디스크 먼저, mmap 나중.** `store.append()` 가 이 순서를 지킨다.
   반대로 하면 재시작 때 조용히 사라진다.
4. **`service.search()` 의 `store.refresh()` 를 빼지 마라.** 다중 워커에서 추가된
   도안이 안 보이게 된다.

## 알려진 한계 — 회전 사각지대

`ROT_STEP=90` 이라 쿼리를 0/90/180/270 만 돌려본다. 그런데 십자·정사각처럼 2차
모멘트가 등방적인 형태는 주축이 정의되지 않아 정규화 각도가 부동소수점 노이즈로
정해진다. 그래서 최대 45도가 어긋난 채 비교될 수 있다.

같은 십자 도안이 그린 각도에 따라 **0.17~0.91 로 5배 흔들린다** (`tests/check.py` 8번).
원본 구현부터 있던 성질이다. `engine.ROT_STEP` 을 45 로 낮추면 고쳐지지만 변형이
8→16개로 늘어 선 모드 지연이 약 2배가 된다. 원·자유곡선은 영향이 없다.

## 남은 작업

- [x] 최초 대량 적재 CLI (`coverup/cli.py`)
- [ ] compaction — tombstone 이 쌓이면 정리 (`stat` 이 20% 넘으면 알려준다)
- [ ] 구조화 로그·메트릭 — `timing_ms` 를 지금은 흘려보내고 있다
- [ ] pgvector 1단계 — 도안 **50만 장**(`BRUTE_MAX_ROWS`)을 넘으면 브루트포스 코사인이
      막히므로 그 전에 필요하다. 3만 장(`STAGE1_MIN_ROWS`)은 1단계가 켜지는 지점일 뿐
      pgvector 가 필요한 지점이 아니다. 스키마는 `tattoo_embeddings` 에 준비돼 있다
