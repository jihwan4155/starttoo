# Starttoo API v1

기본 경로는 `/v1`이며 별도 표기가 없으면 Bearer JWT 인증이 필요하다. 목록 API는
`items`, `nextCursor`, `hasNext`, `size`를 갖는 커서 응답을 사용한다.
현재 v1 공개 범위는 관리자·테스트 API를 제외한 83개 엔드포인트다.

## 인증·회원

| Method | Path | 인증 | 설명 |
|---|---|---:|---|
| POST | `/auth/social/login` | N | Google/Kakao subject 확인, 로그인 또는 가입 토큰 |
| POST | `/auth/signup` | N | 입력 전화번호 정규화 후 미가입 번호로 단일 OAuth 통합 계정 생성. `role`은 USER 또는 ARTIST |
| POST | `/auth/token/refresh` | N | 리프레시 토큰 회전 |
| POST | `/auth/logout` | N | 리프레시 토큰 폐기와 연결 기기 푸시 비활성화 |
| GET | `/auth/nicknames/suggestions` | N | 활성 회원과 겹치지 않는 닉네임 후보 |
| GET | `/auth/nicknames/availability` | N | 활성 회원 기준 닉네임 중복 확인 |
| GET | `/auth/phones/availability` | N | 번호 사용 가능 여부와 가입된 경우 OAuth provider 코드 |
| GET | `/users/me` | Y | 내 계정 정보 |
| PATCH | `/users/me` | Y | 내 프로필 수정 |
| PATCH | `/users/me/profile-image` | Y | 소유 이미지로 프로필 이미지 변경 |
| DELETE | `/users/me` | Y | 계정 상태를 WITHDRAWN으로 변경하고 토큰 폐기 |
| GET | `/users/{userSeq}` | N | ADMIN을 제외한 공개 프로필 |
| PUT | `/users/{userSeq}/follow` | Y | 팔로우 설정 |
| DELETE | `/users/{userSeq}/follow` | Y | 팔로우 해제 |
| PUT | `/users/{userSeq}/block` | Y | 차단 설정 |
| DELETE | `/users/{userSeq}/block` | Y | 차단 해제 |
| GET | `/users/{userSeq}/followers` | N | 공개 팔로워 목록 |
| GET | `/users/{userSeq}/following` | N | 공개 팔로잉 목록 |
| GET | `/users/me/blocks` | Y | 내가 차단한 회원 목록 |
| GET/PATCH | `/users/me/recent-searches` | Y | 최대 10개 조회·추가·단건 삭제 |

최근 검색어 전체 삭제 API는 제공하지 않는다. Redis의 목록 변경은 dirty 사용자
집합에 기록하고 스케줄러가 PostgreSQL 배열에 지연 반영한다. 조회 시 Redis 장애가
발생하면 PostgreSQL 배열을 반환하고, 추가·삭제는 변경 유실을 막기 위해 503을 반환한다.
비어 있는 최근 검색어와 모든 검색·자동완성 결과는 null이 아닌 빈 배열로 반환한다.

## 아티스트

| Method | Path | 인증 | 설명 |
|---|---|---:|---|
| GET | `/artists` | N | 인증 아티스트 목록. 도시 필터와 최신 게시물 썸네일 최대 6개 포함 |
| PATCH | `/artists/me/profile` | Y | ARTIST 역할 회원의 기존 숍 정보 수정 |

ARTIST 가입 시 역할은 즉시 저장되고 아티스트 행은 `UNVERIFIED`로 생성된다. 심사 요청과
관리자 승인 API는 이후 버전의 확장 범위이며, 승인 시 역할이 아니라
`verificationStatus`만 변경한다.

## 이미지·타투·분류

| Method | Path | 설명 |
|---|---|---|
| POST | `/images/uploads/presign` | 백엔드가 MinIO object key와 PUT URL 생성 |
| POST | `/images/uploads/complete` | 객체 존재와 소유 경로 확인 후 images 행 생성 |
| GET | `/tattoo-designs` | 보관 가능한 활성 타투 도안 목록. 분류 코드는 사람이 읽는 이름과 함께 반환 |
| GET | `/tattoos/{tattooSeq}` | 분석 결과 조회. 분류는 code·name, subject는 이름으로 반환 |
| GET | `/tattoos/{tattooSeq}/image` | variant에 맞는 단기 Presigned GET URL |
| GET | `/classifications/primary-styles` | 활성 주 스타일 목록 |
| GET | `/classifications/secondary-styles` | 활성 보조 스타일 목록 |
| GET | `/classifications/rendering-styles` | 활성 표현 스타일 목록 |
| GET | `/classifications/colors` | 활성 색상 목록 |

모든 이미지 URL은 DB의 MinIO object key로 요청 시점에 생성한 단기 Presigned GET
URL이다. DB에는 URL을 저장하지 않는다.

## 커버업 도안 형태 검색

| Method | Path | 인증 | 설명 |
|---|---|---:|---|
| POST | `/designs/search-by-shape` | Y | 캔버스 마스크와 닮은 도안을 점수순으로 조회 |

요청은 `maskPngB64`(검은 배경 + 흰 획 PNG의 base64, `data:` 접두어 허용)와
`mode`를 받는다. `mode`는 `coverup`(그린 영역 안쪽까지 덮는 도안) 또는
`shape`(선 형태가 닮은 도안)이며 다른 값은 400이다. `maskPngB64`가 100KB를 넘으면
`MASK_TOO_LARGE` 400이고, 이 경로는 등록·수정과 분리된 자체 레이트리밋 버킷을 쓴다.

응답 `results`는 검색 점수 내림차순이며 `tattooSeq`, `imageUrl`, `score`(소수 2자리),
`styleCode`, `styleName`을 갖는다. 검색 엔진 내부 지표는 노출하지 않는다.
`imageUrl`은 만료 1시간의 Presigned GET URL이라 결과 화면을 열어둔 채 시간이 지나도
이미지가 깨지지 않는다.

순위는 검색 엔진이 준 순서를 그대로 따르고 DB 조회 순서를 쓰지 않는다. 삭제 판정은
`tattoos`·`tattoo_designs`·`images` 세 테이블의 `is_deleted`를 모두 확인하므로 삭제된
도안은 결과에서 빠지며, 그만큼 결과 수가 요청 수보다 적을 수 있다. 검색 엔진 장애는
이 API만 503으로 끝나고 다른 기능에 전파되지 않는다. 연속 실패가 임계치에 닿으면
서킷을 열어 일정 시간 호출 없이 곧바로 503을 준다.

엔진 색인은 `tattoo_designs.indexed`로 추적하고, 색인 누락과 삭제 잔존은 주기 정합성
스캔이 맞춘다. 색인의 식별자는 `tattoo_seq`이므로 값을 바꾸면 안 된다.

## 게시물·댓글

| Method | Path | 설명 |
|---|---|---|
| POST | `/posts` | 모든 이미지의 동기 AI 판별 완료 후 게시물 등록. 비타투 이미지도 허용 |
| GET | `/posts` | PUBLISHED만 노출 |
| GET | `/users/{userSeq}/posts` | 공개 회원 게시물 |
| GET | `/posts/me` | 내 게시물 |
| GET | `/posts/bookmarked` | 내 북마크 게시물 |
| GET | `/posts/following` | 팔로잉 회원 게시물 |
| GET/PATCH/DELETE | `/posts/{postSeq}` | 상세/작성자 수정/작성자 삭제 |
| PUT | `/posts/{postSeq}/like` | 좋아요 설정과 count·취향 점수 동시 변경 |
| DELETE | `/posts/{postSeq}/like` | 좋아요 해제와 count 감소. 기존 취향 점수는 유지 |
| PUT | `/posts/{postSeq}/bookmark` | 북마크 설정과 취향 점수 동시 변경 |
| DELETE | `/posts/{postSeq}/bookmark` | 북마크 해제. 기존 취향 점수는 유지 |
| PUT | `/posts/{postSeq}/not-interested` | 피드 숨김과 음수 취향 점수 |
| DELETE | `/posts/{postSeq}/not-interested` | 피드 숨김 해제. 기존 취향 감점은 유지 |
| POST | `/posts/{postSeq}/dwell` | 원본 체류 통계 없이 시간 구간을 점수화 |
| POST | `/posts/{postSeq}/reports` | 회원당 게시물 1회 신고 |
| GET/POST | `/posts/{postSeq}/comments` | 댓글 목록/등록 |
| GET | `/comments/{commentSeq}/replies` | 최상위 댓글의 답글 목록 |
| DELETE | `/comments/{commentSeq}` | 작성자 소프트 삭제. 최상위 댓글이면 활성 답글도 함께 삭제 |
| PUT | `/comments/{commentSeq}/like` | 댓글 좋아요 설정 |
| DELETE | `/comments/{commentSeq}/like` | 댓글 좋아요 해제 |

`PUBLISHED`만 일반 조회에 노출한다. `HIDDEN`은 관리자 처리, `DELETED`는 작성자
삭제이며 `is_deleted`와 CHECK로 일관성을 보장한다.
게시글 작성 시 모든 이미지의 타투 여부를 DB 트랜잭션 밖에서 동기 판별하고, 타투로
판정된 이미지만 분석하여 `tattoos` 행을 만든다. 어느 이미지에서든 모델 오류가 나면
게시글과 이미지 연결을 저장하지 않고 요청 전체를 실패시킨다.

## 취향·컬렉션·보관함

| Method | Path | 설명 |
|---|---|---|
| POST | `/preferences/survey` | 최초 설문 점수 |
| POST/GET | `/collections` | 동기 AI 검증 후 배치 컬렉션 등록/목록 |
| GET | `/users/{userSeq}/collections` | 공개 회원의 활성 컬렉션 |
| DELETE | `/collections/{collectionSeq}` | 컬렉션과 연결 타투 소프트 삭제 |
| GET | `/archive` | `tattooSeq`, `designImageSeq`, `designImageUrl`, `archivedDttm` 보관함 |
| PUT | `/archive/{tattooSeq}` | 보관 설정 |
| DELETE | `/archive/{tattooSeq}` | 보관 해제 |

컬렉션 배치는 `bodyView`, 0~1의 `positionX/Y`, 양수 `scaleRatio`,
-180~180의 `rotationDegree`, `flipped`를 모두 저장한다.
컬렉션 등록과 도안 보관의 실제 ON 상태 전환에서만 primary style/color 취향 점수를
가산한다. 컬렉션 삭제와 보관 해제에서는 과거 점수를 역보정하지 않으며, 동일 PUT을
반복해도 점수를 중복 반영하지 않는다.

## 검색

| Method | Path | 설명 |
|---|---|---|
| GET | `/search/accounts/autocomplete` | ADMIN 제외 계정 자모 접두어 |
| GET | `/search/artists/autocomplete` | VERIFIED 아티스트 자모 접두어 |
| GET | `/search/accounts` | Redis fuzzy 후보 기반 대소문자 구분 닉네임 검색 |
| GET | `/search/artists` | Redis fuzzy 후보 기반 인증 아티스트 닉네임 검색 |
| GET | `/search/subjects/autocomplete` | 선별 subject 사전의 seq·이름 접두어 |
| GET | `/search/posts` | 보정된 최상위 subject의 커서 기반 Post 검색 |

계정 Redis 인덱스는 검색키와 `userSeq`만 유지한다. 화면 응답은 userSeq 목록으로
PostgreSQL을 다시 조회한다. 한글 완성형은 호환 자모로 분해하며 영문 대소문자와
숫자는 그대로 보존한다. 자동완성은 ZSET 접두어 사전을 사용하고 본 검색과
Subject 게시글 검색 내부 오타 보정은 Redis Search가 exact·prefix·contains·
Levenshtein 거리 1~2 후보를 생성한다.
본 검색은 Redis Search가 `exact → prefix → fuzzy 거리 1 → fuzzy 거리 2 →
contains` 순으로 후보를 결정하며 같은 단계 안에서 Redis 점수를 사용한다. Spring은
편집거리나 사용자 취향으로 다시 정렬하지 않고 PostgreSQL에서 활성·삭제·인증 상태를
재검증한다. 자동완성은 이와 별개로 선별된 ZSET 접두어 사전을 사용한다.

게시물 검색 로그에는 원문과 Redis가 고른 최상위 정답 subject를 함께 기록하고,
실제 존재하는 정답 subject만 검색량을 +1 한다. Redis의 실시간 집계는 MinIO의
버전별 스냅샷과 이후 JSONL 로그로 복구할 수 있다. 계정·아티스트·subject 원본 인덱스는
DB 커밋 후 증분 갱신하며, 매일 PostgreSQL과 대조한다.

## DM·알림

| Method | Path | 설명 |
|---|---|---|
| POST/GET | `/dm/rooms` | 1대1 방 생성/내 활성 방 |
| POST/GET | `/dm/rooms/{roomSeq}/messages` | 메시지 전송/과거 조회 |
| PATCH | `/dm/rooms/{roomSeq}/read` | 상대 메시지와 해당 방 NEW_DM 알림 일괄 읽음 |
| DELETE | `/dm/rooms/{roomSeq}` | 현재까지 메시지를 숨기고 방 목록 비활성 |
| PATCH | `/dm/rooms/{roomSeq}/notification` | 방별 알림만 설정 |
| GET | `/notifications` | 미확인 알림 목록. NEW_DM은 방별 집계, SYSTEM은 개별 반환 |
| GET | `/notifications/unread-counts` | 집계 전 원본 행 기준 전체·유형별 미확인 수 |
| PATCH | `/notifications/{notificationSeq}/read` | SYSTEM 단건 또는 같은 방 NEW_DM 전체 읽음 |
| PATCH | `/notifications/read-all` | 전체 읽음 |
| POST | `/devices` | Firebase Installation ID와 현재 리프레시 토큰 연결 |
| DELETE | `/devices/{deviceSeq}` | 기기와 연결 세션 비활성 |

알림 타입은 `NEW_DM`, `SYSTEM`만 허용한다. DM 전송 시 방 알림을 켜둔 수신자에게
`referenceSeq=roomSeq`인 `NEW_DM` 알림을 생성한다. 방 알림을 꺼도 메시지는 저장되고
DM방의 읽지 않음 메시지 수에는 포함되지만 알림 행과 푸시는 만들지 않는다. 알림 목록은
전체 미확인 `NEW_DM`을 방별로 먼저 묶고 각 방의 최신 알림 시각 내림차순으로 SYSTEM과
함께 정렬한 뒤 커서 페이지네이션한다. 방 읽음 API는
상대 메시지와 해당 방의 미읽음 `NEW_DM` 알림을 하나의 트랜잭션으로 처리한다.
기기 등록 요청은 현재 세션의 리프레시 토큰을 받아 `deviceSeq`와 연결하며, 기기
비활성화 시 그 기기에 연결된 리프레시 토큰만 폐기한다. `/auth/logout`은 요청한
리프레시 토큰을 폐기하면서 해당 토큰의 기기만 `is_active=false`로 변경한다.
현재 리프레시 토큰에 다른 기기가 연결되어 있으면 이전 기기를 비활성화하고 새 FID
기기에 연결한다. FCM이 `UNREGISTERED`로 반환한 FID도 후속 전송 대상에서 제외한다.

### DM 실시간 연결

STOMP WebSocket 핸드셰이크 경로는 `/ws`다. HTTP 핸드셰이크 이후 STOMP
`CONNECT`의 `Authorization` 헤더에 `Bearer {accessToken}`을 전달한다.

클라이언트가 구독할 수 있는 개인 목적지는 다음 두 개로 제한한다.

| 구독 목적지 | 전달 내용 |
|---|---|
| `/user/queue/dm-events` | `MESSAGE_CREATED`, `MESSAGES_READ` |
| `/user/queue/notifications` | 커밋된 서비스 알림 |

현재 메시지 저장은 `POST /v1/dm/rooms/{roomSeq}/messages`만 사용한다. WebSocket의
클라이언트 `SEND`는 허용하지 않으므로 REST와 WebSocket이 서로 다른 트랜잭션
로직을 갖지 않는다. 메시지·방 상태·NEW_DM 알림 행을 DB 트랜잭션으로 먼저 저장한
뒤 `AFTER_COMMIT`에서 개인 WebSocket 목적지와 활성 기기 FCM으로 전달한다.

FCM 및 WebSocket 전달 실패는 이미 커밋된 메시지와 알림 행을 롤백하지 않는다.
앱은 재연결 시 과거 메시지 API를 커서로 조회하여 누락된 화면 상태를 복구하고,
`eventId`, `dmMessageSeq`, `notificationSeq`로 중복 표시를 방지한다. 로그아웃 시
클라이언트도 WebSocket 연결을 종료하고 로컬 토큰을 제거해야 한다.
