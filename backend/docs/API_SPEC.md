# Starttoo API v1

기본 경로는 `/v1`이며 별도 표기가 없으면 Bearer JWT 인증이 필요하다. 목록 API는
`items`, `nextCursor`, `hasNext`, `size`를 갖는 커서 응답을 사용한다.

## 인증·회원

| Method | Path | 인증 | 설명 |
|---|---|---:|---|
| POST | `/auth/social/login` | N | Google/Kakao subject 확인, 로그인 또는 가입 토큰 |
| POST | `/auth/phone/verifications` | N | 한국 번호 정규화 후 인증번호 요청 |
| POST | `/auth/phone/verifications/confirm` | N | 휴대폰 인증 토큰 발급 |
| POST | `/auth/signup` | N | 신규 통합 계정 생성 또는 기존 전화번호 계정에 OAuth 연결 |
| POST | `/auth/token/refresh` | N | 리프레시 토큰 회전 |
| POST | `/auth/logout` | N | 리프레시 토큰 폐기와 연결 기기 푸시 비활성화 |
| GET | `/auth/nicknames/availability` | N | 활성 회원 기준 닉네임 중복 확인 |
| GET | `/users/me` | Y | 내 계정 정보 |
| PATCH | `/users/me` | Y | 내 프로필 수정 |
| DELETE | `/users/me` | Y | 계정 상태를 WITHDRAWN으로 변경하고 토큰 폐기 |
| GET | `/users/{userSeq}` | N | ADMIN을 제외한 공개 프로필 |
| PUT | `/users/{userSeq}/follow?enabled=` | Y | 팔로우 상태 설정 |
| PUT | `/users/{userSeq}/block?enabled=` | Y | 차단 상태 설정 |
| GET/POST/DELETE | `/users/me/recent-searches` | Y | 최대 10개 조회·추가·단건 삭제 |

최근 검색어 전체 삭제 API는 제공하지 않는다. Redis의 목록 변경은 dirty 사용자
집합에 기록하고 스케줄러가 PostgreSQL 배열에 지연 반영한다. 조회 시 Redis 장애가
발생하면 PostgreSQL 배열을 반환하고, 추가·삭제는 변경 유실을 막기 위해 503을 반환한다.
비어 있는 최근 검색어와 모든 검색·자동완성 결과는 null이 아닌 빈 배열로 반환한다.

## 아티스트

| Method | Path | 인증 | 설명 |
|---|---|---:|---|
| GET | `/artists` | N | 인증 아티스트 목록 |
| GET | `/artists/{userSeq}` | N | 인증 아티스트 상세 |
| GET | `/artists/me/profile` | Y | 내 심사 상태 포함 프로필 |
| PATCH | `/artists/me/profile` | Y | 숍 자유 정보 작성·수정 |
| POST | `/artists/me/verification` | Y | 인증 심사 요청 |
| PATCH | `/admin/artists/{userSeq}/verification` | ADMIN | VERIFIED/REJECTED 처리 |

VERIFIED 승인과 `users.role=ARTIST` 변경은 같은 트랜잭션이다.

## 이미지·타투·AI

| Method | Path | 설명 |
|---|---|---|
| POST | `/images/uploads/presign` | 백엔드가 MinIO object key와 PUT URL 생성 |
| POST | `/images/uploads/complete` | 객체 존재와 소유 경로 확인 후 images 행 생성 |
| GET | `/images/{imageSeq}` | 짧은 만료시간의 GET URL 발급 |
| GET | `/tattoos/{tattooSeq}` | 분석 결과와 다중 subject 조회 |
| POST | `/ai/generations` | 모델 연결 전 DB 미저장 모의 응답 |
| POST | `/ai/coverups` | 이미지 소유권 검증 후 모의 응답 |
| POST | `/ai/simulations` | 이미지·배치 입력 검증 후 모의 응답 |

현재 모델 호출은 비활성화되어 세 API 모두 `MODEL_INTEGRATION_PENDING` 응답을
반환한다. 생성 요청과 결과는 DB에 저장하지 않는다는 최종 정책은 그대로 유지한다.

## 게시물·댓글

| Method | Path | 설명 |
|---|---|---|
| POST | `/posts` | 소유 이미지에 임시 분석값을 적용해 게시물 등록 |
| GET | `/posts` | PUBLISHED만 노출 |
| GET/PATCH/DELETE | `/posts/{postSeq}` | 상세/작성자 수정/작성자 삭제 |
| PUT | `/posts/{postSeq}/like?enabled=` | 좋아요 상태와 count·취향 점수 동시 변경 |
| PUT | `/posts/{postSeq}/bookmark?enabled=` | 북마크 상태와 취향 점수 동시 변경 |
| PUT | `/posts/{postSeq}/not-interested?enabled=` | 피드 숨김과 음수 취향 점수 |
| POST | `/posts/{postSeq}/dwell` | 원본 체류 통계 없이 시간 구간을 점수화 |
| POST | `/posts/{postSeq}/reports` | 회원당 게시물 1회 신고 |
| GET/POST | `/posts/{postSeq}/comments` | 댓글 목록/등록 |
| PATCH/DELETE | `/comments/{commentSeq}` | 작성자 수정/삭제 |
| PUT | `/comments/{commentSeq}/like?enabled=` | 댓글 좋아요 상태 |

`PUBLISHED`만 일반 조회에 노출한다. `HIDDEN`은 관리자 처리, `DELETED`는 작성자
삭제이며 `is_deleted`와 CHECK로 일관성을 보장한다.

## 취향·컬렉션·보관함

| Method | Path | 설명 |
|---|---|---|
| POST | `/preferences/survey` | 최초 설문 점수 |
| GET | `/preferences` | primary style/color 현재 합산 점수 |
| POST/GET | `/collections` | 임시 분석값을 적용한 배치 컬렉션 등록/목록 |
| PATCH/DELETE | `/collections/{collectionSeq}` | 배치 수정/소프트 삭제 |
| GET | `/archive` | tattoo_designs 기반 보관함 |
| PUT | `/archive/{tattooSeq}?enabled=` | 보관 상태 설정 |

컬렉션 배치는 `bodyView`, 0~1의 `positionX/Y`, 양수 `scaleRatio`,
-180~180의 `rotationDegree`, `flipped`를 모두 저장한다.
컬렉션과 보관함의 실제 상태가 변경된 경우에만 primary style/color 취향 점수를
증감하여 동일 요청의 반복으로 점수가 중복 반영되지 않게 한다.

## 검색

| Method | Path | 설명 |
|---|---|---|
| GET | `/search/accounts/autocomplete` | ADMIN 제외 계정 자모 접두어 |
| GET | `/search/artists/autocomplete` | VERIFIED 아티스트 자모 접두어 |
| GET | `/search/accounts` | Redis fuzzy 후보 기반 대소문자 구분 닉네임 검색 |
| GET | `/search/artists` | Redis fuzzy 후보 기반 인증 아티스트 닉네임 검색 |
| GET | `/search/subjects/autocomplete` | 선별 subject 사전 접두어 |
| GET | `/search/subjects/corrections` | Redis 전체 subject 사전의 편집거리 후보 |
| GET | `/search/posts` | fuzzy subject 후보와 post image를 통한 게시물 검색 |
| POST | `/search/posts/{postSeq}/click` | 검색 결과 클릭의 주 스타일·색상 점수 반영 |

계정 Redis 인덱스는 검색키와 `userSeq`만 유지한다. 화면 응답은 userSeq 목록으로
PostgreSQL을 다시 조회한다. 한글 완성형은 호환 자모로 분해하며 영문 대소문자와
숫자는 그대로 보존한다. 자동완성은 ZSET 접두어 사전을 사용하고 본 검색과 오타
보정은 Redis Search가 exact·prefix·contains·Levenshtein 거리 1~2 후보를 생성한다.
본 검색은 Redis Search가 `exact → prefix → fuzzy 거리 1 → fuzzy 거리 2 →
contains` 순으로 후보를 결정하며 같은 단계 안에서 Redis 점수를 사용한다. Spring은
편집거리나 사용자 취향으로 다시 정렬하지 않고 PostgreSQL에서 활성·삭제·인증 상태를
재검증한다. 자동완성은 이와 별개로 선별된 ZSET 접두어 사전을 사용한다.

게시물 검색 로그에는 원문과 Redis가 고른 최상위 정답 subject를 함께 기록하고,
실제 존재하는 정답 subject만 검색량을 +1 한다. Redis의 실시간 집계는 MinIO의
버전별 스냅샷과 이후 JSONL 로그로 복구할 수 있다. 계정·아티스트·subject 원본 인덱스는
DB 커밋 후 증분 갱신하며, 매일 PostgreSQL과 대조한다.

인증 회원이 검색 결과 게시물을 열면 호출마다 검색 클릭 가중치 0.5를 적용한다.
별도 클릭 이력이나 중복 제한은 저장하지 않고 공통 상태 변경 rate limit만 사용한다.

## DM·알림

| Method | Path | 설명 |
|---|---|---|
| POST/GET | `/dm/rooms` | 1대1 방 생성/내 활성 방 |
| POST/GET | `/dm/rooms/{roomSeq}/messages` | 메시지 전송/과거 조회 |
| PATCH | `/dm/rooms/{roomSeq}/read` | 상대 메시지와 해당 방 NEW_DM 알림 일괄 읽음 |
| DELETE | `/dm/rooms/{roomSeq}` | 현재까지 메시지를 숨기고 방 목록 비활성 |
| PATCH | `/dm/rooms/{roomSeq}/notification` | 방별 알림만 설정 |
| GET | `/notifications` | 알림 목록 |
| GET | `/notifications/unread-count` | 읽지 않은 알림 수 |
| PATCH | `/notifications/{seq}/read` | 단건 읽음 |
| PATCH | `/notifications/read-all` | 전체 읽음 |
| POST/GET/DELETE | `/devices[/{seq}]` | 푸시 토큰·현재 리프레시 토큰 연결/조회/비활성 |

DM 전송 시 방 알림을 켜둔 수신자에게 `referenceSeq=roomSeq`인 `NEW_DM` 알림을
생성한다. 방 알림을 꺼도 메시지는 저장되고 읽지 않음 수에 포함된다. 방 읽음 API는
상대 메시지와 해당 방의 미읽음 `NEW_DM` 알림을 하나의 트랜잭션으로 처리한다.
기기 등록 요청은 현재 세션의 리프레시 토큰을 받아 `deviceSeq`와 연결하며, 기기
비활성화 시 그 기기에 연결된 리프레시 토큰만 폐기한다. `/auth/logout`은 요청한
리프레시 토큰을 폐기하면서 해당 토큰의 기기만 `is_active=false`로 변경한다.
FCM 토큰이 회전하면 이전 기기 연결을 비활성화하고 현재 리프레시 토큰을 새 기기에
연결한다. FCM이 `UNREGISTERED`로 반환한 토큰도 후속 전송 대상에서 제외한다.

### DM 실시간 연결

STOMP WebSocket 핸드셰이크 경로는 `/ws`다. HTTP 핸드셰이크 이후 STOMP
`CONNECT`의 `Authorization` 헤더에 `Bearer {accessToken}`을 전달한다.

클라이언트가 구독할 수 있는 개인 목적지는 다음 두 개로 제한한다.

| 구독 목적지 | 전달 내용 |
|---|---|
| `/user/queue/dm-events` | `MESSAGE_CREATED`, `MESSAGES_READ`, `MESSAGE_DELETED` |
| `/user/queue/notifications` | 커밋된 서비스 알림 |

현재 메시지 저장은 `POST /v1/dm/rooms/{roomSeq}/messages`만 사용한다. WebSocket의
클라이언트 `SEND`는 허용하지 않으므로 REST와 WebSocket이 서로 다른 트랜잭션
로직을 갖지 않는다. 메시지·방 상태·NEW_DM 알림 행을 DB 트랜잭션으로 먼저 저장한
뒤 `AFTER_COMMIT`에서 개인 WebSocket 목적지와 활성 기기 FCM으로 전달한다.

FCM 및 WebSocket 전달 실패는 이미 커밋된 메시지와 알림 행을 롤백하지 않는다.
앱은 재연결 시 과거 메시지 API를 커서로 조회하여 누락된 화면 상태를 복구하고,
`eventId`, `dmMessageSeq`, `notificationSeq`로 중복 표시를 방지한다. 로그아웃 시
클라이언트도 WebSocket 연결을 종료하고 로컬 토큰을 제거해야 한다.

## 관리자

- 계정 ACTIVE/SUSPENDED/BANNED/WITHDRAWN 처리와 상태 이력
- 정지 만료의 시스템 자동 복구(`mod_usr_seq=NULL`)
- 신고 ACCEPTED 시 같은 트랜잭션으로 게시물을 HIDDEN 처리
- 분류 기준정보 등록·활성 상태 변경
- 타투의 보관 가능 도안 등록과 추가 학습 사용 완료 표시
