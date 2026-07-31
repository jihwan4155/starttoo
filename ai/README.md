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
├─ engine.py    line/gate 채점. 후보 행 배열만 순회한다
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

검색 모드는 둘이다.

- `line` — 그린 **선의 궤적**을 닮은 도안. 점수 = chamfer 재현·정밀의 조화평균
- `gate` — 그린 영역 **안쪽까지 덮는** 도안. `fill`/`opacity` 로 자격을 걸고 실루엣 IoU 로 순위

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
{ "mask_png_b64": "iVBOR...", "mode": "gate", "top_k": 24 }
```

`w_shape`/`w_cover`/`tau`/`min_fill`/`min_opacity` 는 **보내지 않는다.** 튜닝된
서버 기본값이 있다. `candidate_keys` 를 넘기면 1단계를 건너뛰고 그 도안만 재채점한다
(나중에 pgvector 로 후보를 고를 때 쓰는 경로).

응답 `results[]` 는 `key`·`score`·`shape` 공통, `line` 은 `cover`/`weak`/`rec`/`prec`,
`gate` 는 `fill`/`opacity` 가 추가된다. backend 는 `key`·`score` 만 읽는다.

## 설정

| 환경변수 | 기본 | 뜻 |
|---|---|---|
| `COVERUP_STORE` | `/data/coverup_store` | 특징 파일 디렉토리 (볼륨) |
| `COVERUP_INTERNAL_TOKEN` | (빈값) | 내부 토큰. **비면 인증이 꺼진다** |
| `COVERUP_STAGE1` | `auto` | `auto`(3만 장 초과 시 on) / `on` / `off` |
| `COVERUP_MAX_MASK_BODY` | `102400` | 쿼리 마스크 base64 상한(B) |
| `COVERUP_MAX_IMAGE_BODY` | `10485760` | 도안 이미지 base64 상한(B) |
| `COVERUP_MAX_CONCURRENT` | 코어수-1 | 동시 검색 상한 |

## 로컬 실행

```bash
pip install -r requirements.txt
```

```bash
COVERUP_STORE=./coverup_store uvicorn coverup.app:app --port 8000
```

스토어가 비어 있으면 `/search` 가 503 이다. 색인을 먼저 해야 한다.

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
| 원본 대조 (gate) | 위치별 점수 **비트 단위 동일**, 순위 12/12 일치 |
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

- [ ] 최초 대량 적재 CLI (`coverup/cli.py`) — MinIO 에서 받아 색인. 중단 후 재개 가능해야 한다
- [ ] compaction — tombstone 이 쌓이면 정리
- [ ] 구조화 로그·메트릭 — `timing_ms` 를 지금은 흘려보내고 있다
- [ ] pgvector 1단계 — 도안 3만 장 넘을 때. 스키마는 `tattoo_embeddings` 에 준비돼 있다
