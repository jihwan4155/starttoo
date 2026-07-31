# Starttoo API v1 범용 명세서

> 최종 갱신: 2026-07-31  
> 현재 서버 구현 및 Swagger 기준 API 수: 82개

## 0. 문서 목적

이 문서는 Starttoo 웹·앱 클라이언트와 Spring Boot 서버가 공유하는 HTTP API 계약이다.
입력·출력 형식, 인증, 상태 변경 규칙, 주요 트랜잭션 경계를 정의한다.

다음 정책을 최종 기준으로 사용한다.

- 검색 결과 클릭 점수 API는 제공하지 않는다.
- 이미지 유사 검색 API와 pgvector 검색은 현재 범위에서 제외한다.
- 오타 보정 전용 API는 제공하지 않는다. 사용자·타투이스트·Subject 본 검색에서 fuzzy 검색을 수행한다.
- 자동완성은 prefix 전용이며 본 검색과 분리한다.
- 알림 Top 10은 별도 로직을 만들지 않고 미확인 알림 목록 API에 `size=10`을 전달한다.
- 최근 검색어 전체 삭제 API는 제공하지 않는다.
- 모든 일반 게시글 노출 조건은 `postStatus=PUBLISHED AND isDeleted=false`다.
- 목록 결과가 없으면 `null`이 아니라 빈 배열 `[]`을 반환한다.
- 별도 타투 추출 API는 현재 v1 범위에서 제공하지 않는다.
- 모든 이미지 URL 응답은 DB의 MinIO object key로 요청 시 생성한 단기
  Presigned GET URL이다. DB에 URL을 저장하지 않는다.
- 관리자·테스트 API는 현재 v1 범위에 포함하지 않는다.

---

# 1. 공통 규칙

## 1.1 기본 정보

| 항목 | 값 |
|---|---|
| Base path | `/v1` |
| Content-Type | `application/json; charset=UTF-8` |
| 인증 | `Authorization: Bearer {accessToken}` |
| 날짜·시각 | ISO 8601 UTC, 예: `2026-07-30T01:30:00Z` |
| JSON 필드명 | `camelCase` |
| 회원 식별자 | Java `Integer`, PostgreSQL `INTEGER` |
| 대량 증가 식별자 | Java `Long`, PostgreSQL `BIGINT` |
| 삭제 방식 | 별도 명시가 없으면 소프트 삭제 |

## 1.2 성공 응답

성공 응답은 `data`만 감싼다.
현재 v1은 생성·수정·삭제를 포함한 정상 업무 응답을 HTTP 200으로 통일한다.
비동기 작업 접수 API가 추가되는 경우에만 202를 별도로 사용한다.

```json
{
  "data": {}
}
```

단순 상태 변경 성공:

```json
{
  "data": true
}
```

목록이 비어 있는 경우:

```json
{
  "data": []
}
```

## 1.3 오류 응답

```json
{
  "timestamp": "2026-07-30T01:30:00Z",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "입력값 검증에 실패했습니다.",
  "errors": [
    {
      "field": "nickname",
      "rejectedValue": "a!",
      "reason": "닉네임 형식이 올바르지 않습니다."
    }
  ]
}
```

`errors`는 필드 검증 오류에서만 제공하고 일반 업무 오류에서는 생략하거나 빈 배열로 반환한다.

### 공통 오류 코드

| HTTP | 코드 | 의미 |
|---:|---|---|
| 400 | `INVALID_REQUEST` | JSON, 파라미터, 타입이 잘못됨 |
| 400 | `VALIDATION_ERROR` | 필드 제약 위반 |
| 400 | `INVALID_CURSOR` | 커서 위·변조 또는 형식 오류 |
| 400 | `INVALID_FILE` | 파일명·확장자·요청 메타데이터가 올바르지 않음 |
| 400 | `INVALID_OAUTH_PROVIDER` | 지원하지 않는 OAuth 제공자 |
| 401 | `UNAUTHORIZED` | Access Token이 없어 인증이 필요함 |
| 401 | `INVALID_TOKEN` | 서명·토큰 형식 오류 |
| 401 | `TOKEN_EXPIRED` | 토큰 만료 |
| 401 | `OAUTH_AUTHENTICATION_FAILED` | OAuth 토큰이 거부되거나 subject를 확인할 수 없음 |
| 403 | `FORBIDDEN` | 소유권 또는 역할 부족 |
| 403 | `ACCOUNT_SUSPENDED` | 정지 계정 |
| 403 | `ACCOUNT_BANNED` | 강퇴 계정 |
| 403 | `ACCOUNT_WITHDRAWN` | 탈퇴 계정 |
| 404 | `RESOURCE_NOT_FOUND` | 존재하지 않거나 현재 사용자에게 숨겨진 리소스 |
| 404 | `USER_NOT_FOUND` | 회원을 찾을 수 없음 |
| 404 | `ARTIST_NOT_FOUND` | 인증 타투이스트를 찾을 수 없음 |
| 404 | `IMAGE_NOT_FOUND` | 등록된 이미지 행을 찾을 수 없음 |
| 404 | `TATTOO_NOT_FOUND` | 타투 또는 타투 도안을 찾을 수 없음 |
| 404 | `POST_NOT_FOUND` | 노출 가능한 게시글을 찾을 수 없음 |
| 404 | `COMMENT_NOT_FOUND` | 접근 가능한 댓글을 찾을 수 없음 |
| 404 | `DM_ROOM_NOT_FOUND` | 참여 중인 DM방을 찾을 수 없음 |
| 404 | `UPLOAD_OBJECT_NOT_FOUND` | Presigned URL로 업로드할 객체가 존재하지 않음 |
| 405 | `METHOD_NOT_ALLOWED` | 지원하지 않는 HTTP 메서드 |
| 409 | `DUPLICATE_RESOURCE` | UNIQUE 제약 충돌 |
| 409 | `DUPLICATE_NICKNAME` | 활성 회원 닉네임 중복 |
| 409 | `DUPLICATE_PHONE_NUMBER` | 이미 가입된 활성 휴대폰 번호 |
| 409 | `STATE_CONFLICT` | 현재 상태에서 수행할 수 없는 명령 |
| 413 | `FILE_TOO_LARGE` | 허용된 이미지 크기를 초과함 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 지원하지 않는 Content-Type |
| 422 | `NOT_TATTOO_IMAGE` | 정상 이미지이지만 타투 이미지가 아님 |
| 429 | `RATE_LIMITED` | 호출 제한 초과 |
| 500 | `INTERNAL_SERVER_ERROR` | 예상하지 못한 서버 오류 |
| 502 | `UPSTREAM_SERVICE_ERROR` | OAuth·모델 서버가 잘못된 응답 또는 5xx를 반환함 |
| 503 | `SERVICE_UNAVAILABLE` | Redis·MinIO 등 필수 인프라를 일시적으로 사용할 수 없음 |
| 504 | `PROCESSING_TIMEOUT` | OAuth·모델 서버 처리 시간 초과 |

### 오류 코드 적용 규칙

- 401은 인증 실패, 403은 인증된 사용자의 권한·소유권 부족이다.
- Access Token이 없거나 인증할 수 없으면 401 `UNAUTHORIZED`를 사용한다.
- 공개 프로필·차단 관계처럼 존재를 숨겨야 하는 리소스는 403 대신 404를 반환한다.
  화면에 이미 공개된 리소스의 변경 권한만 부족한 경우에는 403을 반환할 수 있다.
- 좋아요·북마크·팔로우·차단·보관함의 동일 상태 반복은 정상적인 멱등 요청이므로
  `DUPLICATE_REACTION` 오류를 정의하거나 반환하지 않는다.
- 같은 활성 전화번호가 발견되면 다른 OAuth를 추가 연결하지 않고
  409 `DUPLICATE_PHONE_NUMBER`를 반환한다.
- OAuth 제공자가 토큰을 명시적으로 거부한 경우에는 401,
  제공자 장애·5xx는 502, 시간 초과는 504다.
- MinIO와 Redis 연결 장애는 Starttoo의 필수 인프라 장애이므로 503이다.
- Presigned 업로드 완료 시 객체 자체가 없으면 404, 크기 초과는 413,
  MIME 불일치는 415로 분리한다.
- 타투 판별 모델이 정상 이미지를 비타투로 판정하면 파일 형식 오류가 아니므로
  422 `NOT_TATTOO_IMAGE`를 반환한다.

## 1.4 커서 페이지 응답

```json
{
  "data": {
    "items": [],
    "nextCursor": null,
    "hasNext": false,
    "size": 0
  }
}
```

- `cursor`는 클라이언트가 해석하지 않는 불투명 문자열이다.
- 첫 페이지에서는 `cursor`를 생략한다.
- 일반 기본값은 `size=20`, 최대 `size=50`이다.
- 댓글·DM 메시지는 최대 `size=100`까지 허용할 수 있다.
- 동일 정렬값이 존재하면 마지막 정렬키에 식별자를 포함하여 순서를 고정한다.

## 1.5 인증 구분

| 구분 | 의미 |
|---|---|
| Public | 인증 없이 호출 가능 |
| Optional | 인증 없이 호출 가능하나 인증 시 관계 상태를 추가 계산 |
| User | ACTIVE 회원 Access Token 필요 |
| Artist | `role=ARTIST`인 ACTIVE 회원 필요 |

`ADMIN`은 사용자·타투이스트 검색 결과와 일반 공개 프로필에서 제외한다.

## 1.6 상태 설정 API

좋아요, 북마크, 관심 없음, 팔로우, 차단, 보관 상태는 토글 API나
`enabled` 요청 바디를 사용하지 않는다.

- `PUT`: 관계 설정
- `DELETE`: 관계 해제

- 이미 같은 상태라면 성공으로 반환한다.
- 관계 행·카운트·취향 점수는 실제 상태가 바뀐 경우에만 변경한다.
- 반복 요청으로 카운트나 점수가 중복 반영되지 않아야 한다.

## 1.7 공통 트랜잭션 원칙

- DB 상태가 함께 바뀌어야 하는 작업은 하나의 `@Transactional` 경계에서 처리한다.
- 카운트는 값을 읽고 덮어쓰지 않고 `SET count = count + 1` 형태의 원자적 SQL로 갱신한다.
- 외부 OAuth·AI 모델·MinIO 네트워크 호출은 장시간 DB 트랜잭션 내부에서 수행하지 않는다.
- WebSocket·FCM·Redis 검색 인덱스 갱신은 DB 커밋 성공 후 `AFTER_COMMIT`에서 수행한다.
- 커밋 후 실시간 전송 실패는 이미 저장된 메시지·알림·게시물을 롤백하지 않는다.
- Redis 캐시나 WebSocket은 원본 데이터가 아니며 PostgreSQL을 최종 상태로 본다.

---

# 2. 공통 응답 모델

## 2.1 `RelationState`

```json
{
  "enabled": true
}
```

## 2.2 `UserSummary`

```json
{
  "userSeq": 101,
  "nickname": "검은장미",
  "role": "ARTIST",
  "profileImageSeq": 301,
  "profileImageUrl": "https://temporary-download-url"
}
```

## 2.3 `PostImage`

```json
{
  "postImageSeq": 1001,
  "imageSeq": 301,
  "imageUrl": "https://temporary-download-url",
  "tattooSeq": 501,
  "displayOrder": 1
}
```

## 2.4 `Post`

```json
{
  "postSeq": 2001,
  "author": {
    "userSeq": 101,
    "nickname": "검은장미",
    "role": "ARTIST",
    "profileImageSeq": 301,
    "profileImageUrl": "https://temporary-download-url"
  },
  "content": "장미 라인워크 작업입니다.",
  "likeCount": 12,
  "commentCount": 3,
  "images": [],
  "likedByMe": false,
  "bookmarkedByMe": false,
  "regDttm": "2026-07-30T01:30:00Z",
  "modDttm": "2026-07-30T01:30:00Z"
}
```

비로그인 요청의 `likedByMe`, `bookmarkedByMe`는 `false`다.

---

# 3. 타투 도안 보관함

## 3.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 보관함 조회 | GET | `/v1/archive` | User |
| 도안 보관 | PUT | `/v1/archive/{tattooSeq}` | User |
| 도안 보관 해제 | DELETE | `/v1/archive/{tattooSeq}` | User |

## 3.2 보관함 조회

```http
GET /v1/archive?cursor={cursor}&size=20
```

### 출력 `TattooDesignItem`

| 필드 | 타입 | 필수 | 설명 |
|---|---|---:|---|
| `tattooSeq` | Long | Y | 도안 타투 식별자 |
| `designImageSeq` | Long | Y | 가공된 도안 이미지 |
| `designImageUrl` | String | Y | 단기 다운로드 URL |
| `primaryStyleSeq` | Integer | Y | 주 스타일 |
| `colorSeq` | Integer | N | 색상 |
| `subjects` | Array | Y | Subject 목록, 없으면 `[]` |
| `archivedDttm` | DateTime | Y | 보관 시각 |

### 처리

- 현재 회원의 `user_archive`만 조회한다.
- 활성 `tattoo_designs`, 활성 `tattoos`, 활성 이미지인 항목만 반환한다.
- 보관 시각 내림차순, `tattooSeq` 내림차순 커서를 사용한다.

## 3.3 도안 보관·해제

```http
PUT /v1/archive/501
```

해제는 같은 경로에 `DELETE`를 사용한다. 요청 바디는 없다.

### 출력

```json
{
  "data": {
    "enabled": true
  }
}
```

### 트랜잭션

`PUT`:

1. 활성 `tattoos`와 `tattoo_designs` 존재 확인
2. `user_archive` 멱등 INSERT
3. 실제 신규 저장일 때만 해당 타투의 중복 제거된 `primaryStyle`, `color`에 보관 가중치 반영

`DELETE`:

1. 현재 회원의 보관 관계 DELETE
2. 실제 삭제된 경우에만 이전에 반영한 취향 점수 역산

원본 `tattoos`, `tattoo_designs`, `images`는 삭제하지 않는다.

---

# 4. 타투이스트

## 4.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 인증 타투이스트 목록 | GET | `/v1/artists` | Public |
| 내 타투이스트 프로필 작성·수정 | PATCH | `/v1/artists/me/profile` | User |

## 4.2 타투이스트 목록

```http
GET /v1/artists?city=서울&cursor={cursor}&size=20
```

### 출력 `ArtistProfile`

| 필드 | 타입 | 필수 |
|---|---|---:|
| `userSeq` | Integer | Y |
| `nickname` | String | Y |
| `profileImageSeq` | Long | N |
| `profileImageUrl` | String | N |
| `shopName` | String(100) | N |
| `shopCity` | String(100) | N |
| `shopAddress` | String(255) | N |
| `shopPhone` | String(30) | N |
| `shopDetails` | String(1000) | N |
| `verificationStatus` | String | Y |
| `followerCount` | Long | Y |

### 처리

- `users.role=ARTIST`
- `users.accountStatus=ACTIVE`
- `users.isDeleted=false`
- `artists.verificationStatus=VERIFIED`
- `artists.isDeleted=false`
- `city`가 있으면 `shopCity` 정확 일치
- 팔로워 수 내림차순, `userSeq` 내림차순
- `popularity` 칼럼과 별도 인기도 점수는 사용하지 않는다.

## 4.3 타투이스트 프로필 수정

```http
PATCH /v1/artists/me/profile
```

```json
{
  "shopName": "스타투 스튜디오",
  "shopCity": "서울",
  "shopAddress": "서울특별시 강남구 테헤란로 1",
  "shopPhone": "02-1234-5678",
  "shopDetails": "평일 12:00~21:00, 예약제"
}
```

### 트랜잭션

- 프로필이 없으면 `UNVERIFIED` 상태로 생성한다.
- 있으면 간략한 숍 정보만 수정한다.
- 독립적인 `shops` 엔티티는 만들지 않는다.
- `modDttm`, `modUsrSeq`를 프로필 변경과 함께 저장한다.
- 이 API만으로 `users.role`이나 인증 상태를 변경하지 않는다.

---

# 5. Auth

## 5.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 소셜 로그인 | POST | `/v1/auth/social/login` | Public |
| 단일 OAuth 통합 계정 가입 | POST | `/v1/auth/signup` | Public |
| Access Token 재발급 | POST | `/v1/auth/token/refresh` | Public |
| 로그아웃 | POST | `/v1/auth/logout` | Public |
| 닉네임 추천 | GET | `/v1/auth/nicknames/suggestions` | Public |
| 닉네임 중복 확인 | GET | `/v1/auth/nicknames/availability` | Public |
| 휴대폰 번호 가입 여부 확인 | GET | `/v1/auth/phones/availability` | Public |

프로필 이미지 업로드 URL은 중복 Auth API를 만들지 않고
`POST /v1/images/uploads/presign`에 `purpose=PROFILE`을 전달한다.

## 5.2 소셜 로그인

```http
POST /v1/auth/social/login
```

```json
{
  "provider": "KAKAO",
  "accessToken": "example"
}
```

### 출력

기존 연결 계정:

```json
{
  "data": {
    "signupRequired": false,
    "signupToken": null,
    "tokens": {
      "accessToken": "example",
      "accessTokenExpiresAt": "2026-07-30T02:00:00Z",
      "refreshToken": "example",
      "refreshTokenExpiresAt": "2026-08-29T01:30:00Z",
      "tokenType": "Bearer"
    }
  }
}
```

신규 OAuth subject:

```json
{
  "data": {
    "signupRequired": true,
    "signupToken": "short-lived-signup-token",
    "tokens": null
  }
}
```

### 처리

- 제공자 API에서 액세스 토큰을 검증하고 불변 `providerSubject`를 얻는다.
- 이메일과 `emailVerified`는 저장하지 않는다.
- 연결 계정이면 `lastLoginDttm`을 갱신하고 토큰을 발급한다.
- 비활성 계정은 상태별 오류를 반환한다.
- 미연결 계정이면 `users`를 만들지 않고 가입용 단기 토큰만 발급한다.
- 제공자가 Access Token을 명시적으로 거부하면
  401 `OAUTH_AUTHENTICATION_FAILED`를 반환한다.
- 제공자 5xx·비정상 응답은 502 `UPSTREAM_SERVICE_ERROR`,
  시간 초과는 504 `PROCESSING_TIMEOUT`으로 구분한다.

## 5.3 단일 OAuth 통합 계정 가입

```json
{
  "signupToken": "short-lived-signup-token",
  "phoneNumber": "010-1234-5678",
  "nickname": "검은장미1",
  "requestedRole": "ARTIST",
  "birthDate": "1998-05-21",
  "gender": "M"
}
```

### 제약

- `requestedRole`: `USER`, `ARTIST`만 허용
- `ADMIN` 공개 가입 금지
- 휴대폰 번호는 하이픈·공백 제거 후 한국 번호 `+82` E.164 형식으로 정규화
- 닉네임: `^[가-힣A-Za-z0-9]{2,20}$`
- 영문 대소문자를 구분한다.
- 성별: `M`, `F`, `null`

### 역할 정책

- `requestedRole=USER`: 일반 `users` 계정을 생성한다.
- `requestedRole=ARTIST`: `users`는 우선 `role=USER`로 만들고 `artists` 확장 행을
  `UNVERIFIED`로 함께 생성한다.
- 관리자의 인증 승인 트랜잭션에서만 `users.role=ARTIST`가 된다.

### 트랜잭션

1. 가입 토큰 유효성 검증
2. 휴대폰 번호 정규화와 활성 계정 중복 확인
3. `users` 생성
4. 최초 `ACTIVE` 계정 상태 이력 생성
5. ARTIST 가입 유형이면 `artists` 확장 행 생성
6. `user_oauth_accounts` 한 건 연결
7. 리프레시 토큰 저장

같은 활성 휴대폰 번호가 이미 있으면 다른 OAuth provider를 추가 연결하지 않고
409 `DUPLICATE_PHONE_NUMBER`를 반환한다. 현재 API 가입 흐름은 한 사람당 하나의
통합 계정과 하나의 OAuth provider를 목표로 한다.

가입 토큰은 DB 커밋이 성공한 후에만 Redis에서 소비 처리한다. DB 저장이 실패하면
가입 토큰은 소비되지 않아 재시도할 수 있다. 커밋 후 사용자 검색 인덱스를 증분 갱신한다.

## 5.4 휴대폰 번호 가입 여부 확인

```http
GET /v1/auth/phones/availability?phoneNumber=010-1234-5678
```

미가입 번호:

```json
{
  "data": {
    "normalizedPhoneNumber": "+821012345678",
    "available": true,
    "provider": null
  }
}
```

가입된 번호:

```json
{
  "data": {
    "normalizedPhoneNumber": "+821012345678",
    "available": false,
    "provider": "KAKAO"
  }
}
```

- `provider`는 `GOOGLE`, `KAKAO`, `null` 중 하나다.
- 탈퇴 회원 번호는 재사용할 수 있다.
- 정지·강퇴 계정 번호는 계속 예약한다.
- 공개 조회 API이므로 IP와 번호 기준의 강한 Rate Limit을 적용한다.
- 최종 전화번호 유일성은 가입 트랜잭션의 부분 UNIQUE 인덱스로 다시 검증한다.

휴대폰 인증번호 요청·확인 API는 제공하지 않는다.

## 5.5 토큰 재발급

```json
{
  "refreshToken": "example"
}
```

- 기존 리프레시 토큰 폐기와 새 토큰 저장을 같은 트랜잭션에서 수행한다.
- 새 Access Token뿐 아니라 새 Refresh Token도 함께 반환한다.
- 이미 사용·폐기·만료된 Refresh Token은 재사용할 수 없다.

## 5.6 로그아웃

```json
{
  "refreshToken": "example"
}
```

- 해당 Refresh Token을 폐기한다.
- 연결된 기기가 있으면 같은 트랜잭션에서 푸시 수신을 비활성화한다.
- 이미 폐기된 토큰에 대한 반복 요청은 성공으로 처리한다.
- 클라이언트는 Access Token 삭제와 WebSocket 종료를 별도로 수행한다.

## 5.7 닉네임 추천·중복 확인

```http
GET /v1/auth/nicknames/suggestions?count=5
GET /v1/auth/nicknames/availability?nickname=검은장미1
```

추천 출력:

```json
{
  "data": {
    "items": ["검은장미17", "푸른나비24", "BlackRose31"]
  }
}
```

중복 확인 출력:

```json
{
  "data": {
    "nickname": "검은장미1",
    "available": true
  }
}
```

추천 결과는 추천 시점의 미중복이며 최종 유일성은 회원가입 트랜잭션의 UNIQUE 제약으로 보장한다.

---

# 6. 댓글

## 6.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 최상위 댓글 목록 | GET | `/v1/posts/{postSeq}/comments` | Optional |
| 답글 목록 | GET | `/v1/comments/{commentSeq}/replies` | Optional |
| 댓글·답글 작성 | POST | `/v1/posts/{postSeq}/comments` | User |
| 댓글 삭제 | DELETE | `/v1/comments/{commentSeq}` | User |
| 댓글 좋아요 | PUT | `/v1/comments/{commentSeq}/like` | User |
| 댓글 좋아요 해제 | DELETE | `/v1/comments/{commentSeq}/like` | User |

댓글 수정 API는 현재 범위에서 제공하지 않는다.

## 6.2 댓글 응답

```json
{
  "commentSeq": 501,
  "postSeq": 2001,
  "author": {
    "userSeq": 101,
    "nickname": "검은장미",
    "profileImageSeq": 301,
    "profileImageUrl": "https://temporary-download-url"
  },
  "parentCommentSeq": null,
  "content": "색감이 정말 좋네요.",
  "likeCount": 2,
  "replyCount": 1,
  "likedByMe": false,
  "deleted": false,
  "regDttm": "2026-07-30T01:30:00Z",
  "modDttm": "2026-07-30T01:30:00Z"
}
```

삭제된 최상위 댓글에 활성 답글이 있으면 스레드 보존을 위해 tombstone을 반환한다.

```json
{
  "commentSeq": 501,
  "author": null,
  "content": null,
  "deleted": true,
  "replyCount": 2
}
```

## 6.3 최상위 댓글 목록

```http
GET /v1/posts/2001/comments?cursor={cursor}&size=30
```

- `parentCommentSeq IS NULL`인 댓글만 반환한다.
- `commentSeq` 오름차순 커서를 사용한다.
- 각 댓글에 활성 답글 수 `replyCount`를 포함한다.
- 차단 관계 사용자의 댓글은 제외한다.

## 6.4 답글 목록

```http
GET /v1/comments/501/replies?cursor={cursor}&size=30
```

- 지정 댓글은 최상위 댓글이어야 한다.
- 해당 댓글을 부모로 갖는 1단계 답글만 반환한다.
- 답글의 `replyCount`는 항상 0이다.

## 6.5 댓글·답글 작성

최상위 댓글:

```json
{
  "parentCommentSeq": null,
  "content": "색감이 정말 좋네요."
}
```

답글:

```json
{
  "parentCommentSeq": 501,
  "content": "감사합니다."
}
```

### 트랜잭션

1. 대상 게시물 `PUBLISHED` 확인
2. 답글이면 부모가 같은 게시물의 최상위 댓글인지 확인
3. 댓글 행 생성
4. `posts.commentCount = commentCount + 1`
5. 알림 생성

알림 대상은 최상위 댓글이면 게시물 작성자, 답글이면 부모 댓글 작성자다.
본인에게는 알림을 만들지 않는다. 커밋 후 WebSocket·FCM 전송을 시도한다.

## 6.6 댓글 삭제

- 작성자만 삭제할 수 있다.
- 댓글을 소프트 삭제하고 `posts.commentCount`를 원자적으로 감소시킨다.
- 최상위 댓글의 답글을 연쇄 삭제하지 않는다.
- 이미 삭제된 댓글의 반복 삭제는 성공으로 처리한다.

## 6.7 댓글 좋아요

설정은 `PUT`, 해제는 같은 경로의 `DELETE`를 사용하며 요청 바디는 없다.

### 트랜잭션

- 실제 상태 변경 시에만 `comment_likes` INSERT/DELETE
- 실제 상태 변경 시에만 `comments.likeCount` 원자적 증감
- 신규 좋아요일 때만 댓글 작성자 알림 생성
- 관계·카운트·알림은 같은 트랜잭션
- 같은 상태의 반복 요청은 성공하며 카운트를 중복 변경하지 않는다.

---

# 7. DM

## 7.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 채팅방 생성·진입 | POST | `/v1/dm/rooms` | User |
| 채팅방 목록 | GET | `/v1/dm/rooms` | User |
| 메시지 목록 | GET | `/v1/dm/rooms/{roomSeq}/messages` | User |
| 메시지 전송 | POST | `/v1/dm/rooms/{roomSeq}/messages` | User |
| 방 읽음 처리 | PATCH | `/v1/dm/rooms/{roomSeq}/read` | User |
| 방 알림 설정 | PATCH | `/v1/dm/rooms/{roomSeq}/notification` | User |
| 채팅방 나가기 | DELETE | `/v1/dm/rooms/{roomSeq}` | User |

## 7.2 채팅방 생성·진입

```json
{
  "partnerSeq": 102
}
```

### 출력 `DmRoom`

```json
{
  "dmRoomSeq": 701,
  "partner": {
    "userSeq": 102,
    "nickname": "푸른나비",
    "profileImageSeq": 302,
    "profileImageUrl": "https://temporary-download-url"
  },
  "active": true,
  "notificationEnabled": true,
  "unreadCount": 0,
  "lastMessagePreview": "상담 가능할까요?",
  "lastMessageDttm": "2026-07-30T01:30:00Z"
}
```

### 트랜잭션

1. 자기 자신, 비활성 회원, 양방향 차단 관계 거부
2. 두 회원 seq를 작은 값·큰 값으로 정규화하여 기존 1대1 방 조회
3. 없으면 방과 참여자 2명을 생성
4. 있으면 요청자의 `isActive=true`
5. 요청자가 읽지 않은 상대 메시지 일괄 읽음 처리
6. `notificationType=NEW_DM AND referenceSeq=roomSeq`인 요청자 알림 일괄 읽음 처리

따라서 이 API를 실제 화면 진입 시 호출하면 채팅방 진입과 읽음 처리가 함께 완료된다.
이미 열린 방에서 새 메시지를 받은 경우에는 별도 읽음 API를 호출한다.

## 7.3 채팅방 목록

```http
GET /v1/dm/rooms?cursor={cursor}&size=30
```

- 현재 참여자의 `isActive=true`인 방만 반환한다.
- 가장 최근 메시지 시각 내림차순으로 정렬한다.
- 상대 이름, 프로필, 미읽음 수, 알림 설정, 마지막 메시지 미리보기를 포함한다.
- 나가기 전에 숨긴 메시지 이하의 메시지는 미리보기와 미읽음 계산에서 제외한다.

## 7.4 메시지 목록

```http
GET /v1/dm/rooms/701/messages?cursor={cursor}&size=30
```

### 출력 `DmMessage`

```json
{
  "dmMessageSeq": 9001,
  "dmRoomSeq": 701,
  "senderSeq": 101,
  "messageType": "TEXT_WITH_IMAGE",
  "textContent": "이런 느낌을 원해요.",
  "imageSeq": 401,
  "imageUrl": "https://temporary-download-url",
  "readDttm": null,
  "deleted": false,
  "regDttm": "2026-07-30T01:30:00Z"
}
```

- 메시지 seq 내림차순 커서
- 현재 참여자의 `lastHiddenMessageSeq` 이하 제외
- 삭제 메시지는 행을 유지하되 `textContent`, `imageSeq`, `imageUrl`을 `null`로 반환

## 7.5 메시지 전송

```json
{
  "textContent": "상담 가능할까요?",
  "imageSeq": null
}
```

- `textContent` 또는 `imageSeq` 중 하나 이상 필수
- 텍스트 최대 4,000자
- 이미지가 있으면 발신자 소유의 활성 이미지인지 확인
- 별도 클라이언트 메시지 식별자나 전송 재시도 멱등키는 현재 제공하지 않는다.
  `dmMessageSeq`는 DB 저장 후 서버가 생성하는 정렬·커서 식별자다.

### 트랜잭션

1. 참여자와 차단 관계 확인
2. 메시지 타입 결정: `TEXT`, `IMAGE`, `TEXT_WITH_IMAGE`
3. `dm_messages` 저장
4. 방의 `lastMessageDttm` 갱신
5. 양 참여자의 방을 활성화
6. 수신자가 방 알림을 켠 경우에만 `NEW_DM` 알림 행 생성

방 알림을 꺼도 메시지는 저장되고 DM 미읽음 수에는 포함된다.
커밋 후 발신자와 수신자에게 WebSocket 이벤트를 전송하고, 알림 행이 생성된 경우에만 FCM을 시도한다.

## 7.6 읽음 처리

```http
PATCH /v1/dm/rooms/701/read
```

하나의 트랜잭션에서 다음을 처리한다.

- 본인이 보내지 않은 미읽음 메시지의 `readDttm` 갱신
- 해당 방의 미확인 `NEW_DM` 알림 읽음 처리

출력은 실제 읽음 처리된 메시지 수다.

## 7.7 방 알림 설정

```json
{
  "enabled": false
}
```

`dm_room_participants.isNotificationEnabled`만 변경한다.
메시지 저장, 방 목록 노출, 미읽음 메시지 수에는 영향을 주지 않는다.

## 7.8 채팅방 나가기

- 현재 마지막 메시지를 `lastHiddenMessageSeq`로 저장한다.
- 요청자의 `isActive=false`, `lastLeftDttm=now`로 변경한다.
- 방과 메시지를 삭제하지 않는다.
- 이후 새 메시지가 오면 방은 재활성화되지만 나가기 이전 메시지는 계속 숨긴다.

## 7.9 실시간 계약

STOMP WebSocket:

- Handshake: `/ws`
- CONNECT 헤더: `Authorization: Bearer {accessToken}`
- DM 구독: `/user/queue/dm-events`
- 알림 구독: `/user/queue/notifications`

DM 이벤트:

- `MESSAGE_CREATED`
- `MESSAGES_READ`

클라이언트 메시지 전송은 WebSocket SEND가 아니라 REST API만 사용한다.

---

# 8. 알림

## 8.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 미확인 알림 목록 | GET | `/v1/notifications` | User |
| 타입별 미확인 개수 | GET | `/v1/notifications/unread-counts` | User |
| 개별 읽음 처리 | PATCH | `/v1/notifications/{notificationSeq}/read` | User |
| 전체 읽음 처리 | PATCH | `/v1/notifications/read-all` | User |

미확인 알림 Top 10은 별도 API가 아니라 `GET /v1/notifications?size=10`을 사용한다.

## 8.2 알림 응답

```json
{
  "notificationSeq": 8001,
  "actorSeq": 102,
  "notificationType": "POST_LIKE",
  "referenceSeq": 2001,
  "title": "게시글 좋아요",
  "body": "푸른나비님이 게시글을 좋아합니다.",
  "regDttm": "2026-07-30T01:30:00Z"
}
```

지원 타입:

- `POST_LIKE`
- `POST_COMMENT`
- `COMMENT_LIKE`
- `FOLLOW`
- `NEW_DM`
- `SYSTEM`

## 8.3 미확인 알림 목록

- `isRead=false`만 반환한다.
- `notificationSeq` 내림차순 커서
- 결과가 없으면 `items=[]`
- `size=10`을 사용하면 Top 10 기능과 동일하다.

## 8.4 타입별 미확인 개수

```json
{
  "data": {
    "total": 12,
    "byType": {
      "POST_LIKE": 4,
      "POST_COMMENT": 2,
      "COMMENT_LIKE": 1,
      "FOLLOW": 2,
      "NEW_DM": 3,
      "SYSTEM": 0
    }
  }
}
```

누락된 타입 없이 모든 타입을 0 이상으로 반환한다.

## 8.5 읽음 처리

- 개별 읽음: 현재 회원이 수신한 알림만 처리
- 전체 읽음: 현재 회원의 `isRead=false`를 한 번의 UPDATE로 처리
- `isRead=true`와 `readDttm`은 항상 함께 변경
- 반복 호출은 성공하는 멱등 명령

---

# 9. 게시글

## 9.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 공개 전체 피드 | GET | `/v1/posts` | Optional |
| 게시글 상세 | GET | `/v1/posts/{postSeq}` | Optional |
| 다른 회원 게시글 | GET | `/v1/users/{userSeq}/posts` | Optional |
| 내가 작성한 게시글 | GET | `/v1/posts/me` | User |
| 북마크한 게시글 | GET | `/v1/posts/bookmarked` | User |
| 팔로잉 피드 | GET | `/v1/posts/following` | User |
| 게시글 작성 | POST | `/v1/posts` | User |
| 게시글 수정 | PATCH | `/v1/posts/{postSeq}` | User |
| 게시글 삭제 | DELETE | `/v1/posts/{postSeq}` | User |
| 좋아요 | PUT | `/v1/posts/{postSeq}/like` | User |
| 좋아요 해제 | DELETE | `/v1/posts/{postSeq}/like` | User |
| 북마크 | PUT | `/v1/posts/{postSeq}/bookmark` | User |
| 북마크 해제 | DELETE | `/v1/posts/{postSeq}/bookmark` | User |
| 관심 없음 설정 | PUT | `/v1/posts/{postSeq}/not-interested` | User |
| 관심 없음 해제 | DELETE | `/v1/posts/{postSeq}/not-interested` | User |
| 게시글 체류시간 반영 | POST | `/v1/posts/{postSeq}/dwell` | User |
| 게시글 신고 | POST | `/v1/posts/{postSeq}/reports` | User |

## 9.2 목록 공통

- `PUBLISHED AND isDeleted=false`만 반환한다.
- 로그인 회원에게 양방향 차단 관계와 관심 없음 게시물을 제외한다.
- 공개 전체·회원 작성·내 작성·팔로잉 피드는 `postSeq` 내림차순 커서다.
- 북마크 목록은 북마크 저장 시각 내림차순, `postSeq` 내림차순이다.
- 다른 회원이 비활성·ADMIN이거나 차단 관계면 404 또는 빈 목록 정책을 일관되게 적용한다.

## 9.3 게시글 작성

```json
{
  "content": "장미 라인워크 작업입니다.",
  "imageSeqs": [301, 302]
}
```

### 제약

- 이미지 1~10개
- 중복 `imageSeq` 금지
- 본문 최대 3,000자, `null` 허용
- 모든 이미지는 요청자 소유이고 아직 다른 게시글에 사용되지 않은 활성 이미지

### 모델 처리

처리 흐름:

1. 이미지 소유권 검증
2. 타투 여부 판별 모델 실행
3. 하나라도 타투가 아니면 422 `NOT_TATTOO_IMAGE`로 등록 거부
4. 타투 분석 모델에서 `primaryStyle`, `secondaryStyle` 최대 2개,
   `color`, `rendering` 최대 2개, 다중 `subjects` 수신
5. 분석 성공 후 DB 저장 트랜잭션 시작

모든 이미지의 판별·분석은 동기로 순서대로 완료하며, 하나라도 실패하면 DB 저장을
시작하지 않는다. 모델 호출 중에는 DB 쓰기 트랜잭션을 열지 않는다.
`AI_ENABLED=true`이면 모델 서버를 호출하고, 기본값 `false`에서는 명시적인
개발용 분석값을 사용한다.

### DB 트랜잭션

1. 이미지마다 `tattoos` 생성
2. Subject upsert 및 `tattoo_subjects` 생성
3. `posts` 생성
4. 요청 순서대로 `post_images` 생성

중간 하나라도 실패하면 게시글과 모든 이미지 연결을 롤백한다.
성공 응답은 DB 커밋이 끝난 뒤에만 반환한다.

## 9.4 게시글 수정

```json
{
  "content": "본문을 수정했습니다."
}
```

- 작성자만 가능
- 현재 범위에서는 본문만 수정
- 이미지와 분석 결과는 변경하지 않음
- `content`, `modDttm`, `modUsrSeq`만 명시적인 부분 UPDATE
- `likeCount`, `commentCount`, `reportCount`는 UPDATE 대상에서 제외
- 저장 후 최신 게시글을 다시 조회하여 동시 변경된 카운트를 응답

## 9.5 게시글 삭제

- 작성자만 가능
- `postStatus`, `isDeleted`, `modDttm`, `modUsrSeq`만 부분 UPDATE
- `likeCount`, `commentCount`, `reportCount`는 UPDATE 대상에서 제외
- 물리 삭제하지 않음
- 일반 피드·상세·검색에서 즉시 제외

출력:

```json
{
  "data": true
}
```

## 9.6 좋아요

설정은 `PUT`, 해제는 같은 경로의 `DELETE`를 사용하며 요청 바디는 없다.

### 트랜잭션

실제 ON 전환:

1. `post_likes` INSERT
2. `posts.likeCount = likeCount + 1`
3. 게시글 내 타투의 중복 제거된 주 스타일·색상에 좋아요 가중치 반영
4. 작성자가 본인이 아니면 알림 생성

실제 OFF 전환:

1. 관계 DELETE
2. 카운트 원자적 감소
3. 취향 점수 역산

동일 상태 반복은 관계·카운트·점수를 변경하지 않는다.

좋아요·북마크·관심 없음 출력은 모두 현재 최종 상태다.

```json
{
  "data": {
    "enabled": true
  }
}
```

## 9.7 북마크

- 설정은 `PUT`, 해제는 같은 경로의 `DELETE`를 사용하며 요청 바디는 없다.
- 관계 INSERT/DELETE와 취향 점수 증감·역산을 같은 트랜잭션으로 처리한다.
- 게시글 카운트 칼럼은 별도로 두지 않는다.
- 작성자 알림은 만들지 않는다.

## 9.8 관심 없음

- 설정은 `PUT`, 해제는 같은 경로의 `DELETE`를 사용하며 요청 바디는 없다.
- ON이면 `post_hidden_preferences`를 생성하고 이후 해당 회원의 피드에서 제외한다.
- 주 스타일·색상에 음수 가중치를 적용한다.
- OFF이면 관계를 삭제하고 기존 감점을 역산한다.
- 좋아요·북마크 관계를 자동으로 해제하지 않는다.

## 9.9 게시글 신고

```json
{
  "reasonCode": "INAPPROPRIATE",
  "reasonDetail": "타인의 작업물을 도용한 것으로 보입니다."
}
```

### 트랜잭션

1. `PUBLISHED` 게시물 확인
2. 회원당 게시물 1회 제약 확인
3. `PENDING` 신고 생성
4. `posts.reportCount` 원자적 증가

관리자가 `ACCEPTED`로 처리하기 전까지 게시물은 노출된다.

출력:

```json
{
  "data": {
    "reportSeq": 7001,
    "reportStatus": "PENDING"
  }
}
```

---

# 10. 타투

## 10.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 타투 도안 목록 조회 | GET | `/v1/tattoo-designs` | Optional |
| 타투 상세 조회 | GET | `/v1/tattoos/{tattooSeq}` | Optional |
| 타투 이미지 조회 | GET | `/v1/tattoos/{tattooSeq}/image` | Optional |

## 10.2 타투 도안 목록

```http
GET /v1/tattoo-designs?cursor={cursor}&size=20
```

- 활성 `tattoo_designs`만 반환한다.
- 최신 등록순 커서
- 로그인 회원이면 `archivedByMe`를 계산한다.
- 원본 타투 이미지가 아니라 가공된 도안 이미지 정보를 반환한다.

## 10.3 타투 상세

```json
{
  "tattooSeq": 501,
  "registrantSeq": 101,
  "imageSeq": 301,
  "sourceType": "USER_POST",
  "primaryStyleSeq": 1,
  "secondaryStyleSeqs": [2, 3],
  "renderingStyleSeqs": [1],
  "colorSeq": 2,
  "subjects": [
    {
      "subjectSeq": 10,
      "subjectName": "장미"
    }
  ],
  "usedForTraining": false,
  "trainedDttm": null,
  "regDttm": "2026-07-30T01:30:00Z"
}
```

- `primaryStyleSeq` 필수 1개
- `colorSeq` 선택 1개
- `secondaryStyleSeqs` 최대 2개
- `renderingStyleSeqs` 최대 2개
- `subjects` 다중 라벨

## 10.4 타투 이미지

```http
GET /v1/tattoos/501/image?variant=ORIGINAL
```

`variant`:

- `ORIGINAL`: `tattoos.imageSeq`
- `DESIGN`: `tattoo_designs.imageSeq`, 도안이 없으면 404

출력은 `imageSeq`, 단기 `downloadUrl`, `expiresAt`이다.

---

# 11. Presigned URL

## 11.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 업로드 URL 발급 | POST | `/v1/images/uploads/presign` | User |
| 업로드 완료 등록 | POST | `/v1/images/uploads/complete` | User |

## 11.2 업로드 URL 발급

```json
{
  "purpose": "PROFILE",
  "contentType": "image/png",
  "originalFilename": "profile.png",
  "fileSize": 1024000
}
```

`purpose`:

- `PROFILE`
- `POST`
- `DM`
- `COLLECTION`
- `EXTRACTION`

허용 MIME:

- `image/jpeg`
- `image/png`
- `image/webp`

### 출력

```json
{
  "data": {
    "objectKey": "users/101/profile/uuid.png",
    "uploadUrl": "https://temporary-put-url",
    "requiredHeaders": {
      "Content-Type": "image/png"
    },
    "expiresInSeconds": 600
  }
}
```

백엔드가 object key를 만든다. MinIO가 클라이언트에게 object key를 배정하지 않는다.
이 단계에서는 `images` 행을 만들지 않는다.

## 11.3 업로드 완료

```json
{
  "objectKey": "users/101/profile/uuid.png"
}
```

출력:

```json
{
  "data": {
    "imageSeq": 301,
    "objectKey": "users/101/profile/uuid.png",
    "downloadUrl": "https://temporary-download-url",
    "regDttm": "2026-07-30T01:30:00Z"
  }
}
```

### 처리

1. object key가 현재 회원에게 발급된 경로인지 검증
2. MinIO stat으로 객체 존재, 크기, MIME 확인
3. 검증 성공 후 `images` 생성

오류:

- 객체 없음: 404 `UPLOAD_OBJECT_NOT_FOUND`
- 크기 초과: 413 `FILE_TOO_LARGE`
- MIME 불일치: 415 `UNSUPPORTED_MEDIA_TYPE`
- MinIO 연결 장애: 503 `SERVICE_UNAVAILABLE`

DB INSERT가 실패해 남은 MinIO 객체는 주기적인 orphan cleanup 대상으로 처리한다.

---

# 12. 사용자

## 12.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 역할 기반 내 정보 | GET | `/v1/users/me` | User |
| 내 정보 수정 | PATCH | `/v1/users/me` | User |
| 프로필 이미지 교체 | PATCH | `/v1/users/me/profile-image` | User |
| 회원 탈퇴 | DELETE | `/v1/users/me` | User |
| 다른 회원 프로필 | GET | `/v1/users/{userSeq}` | Optional |
| 팔로우 | PUT | `/v1/users/{userSeq}/follow` | User |
| 팔로우 해제 | DELETE | `/v1/users/{userSeq}/follow` | User |
| 차단 | PUT | `/v1/users/{userSeq}/block` | User |
| 차단 해제 | DELETE | `/v1/users/{userSeq}/block` | User |
| 팔로워 목록 | GET | `/v1/users/{userSeq}/followers` | Optional |
| 팔로잉 목록 | GET | `/v1/users/{userSeq}/following` | Optional |
| 차단 목록 | GET | `/v1/users/me/blocks` | User |
| 최근 검색어 조회 | GET | `/v1/users/me/recent-searches` | User |
| 최근 검색어 수정 | PATCH | `/v1/users/me/recent-searches` | User |
| 푸시토큰 등록·재활성화 | POST | `/v1/devices` | User |
| 푸시토큰 비활성화 | DELETE | `/v1/devices/{deviceSeq}` | User |

중복으로 기재된 “내 정보 수정”은 하나의 `PATCH /users/me`만 사용한다.

## 12.2 내 정보

```json
{
  "userSeq": 101,
  "nickname": "검은장미",
  "phoneNumber": "+821012345678",
  "phoneVerifiedDttm": "2026-07-30T01:00:00Z",
  "profileImageSeq": 301,
  "profileImageUrl": "https://temporary-download-url",
  "birthDate": "1998-05-21",
  "gender": "M",
  "role": "ARTIST",
  "accountStatus": "ACTIVE",
  "artistProfile": {
    "shopName": "스타투 스튜디오",
    "verificationStatus": "VERIFIED"
  },
  "regDttm": "2026-07-30T01:00:00Z"
}
```

`artistProfile`은 아티스트 확장 행이 있을 때만 제공한다.

## 12.3 내 정보 수정

```json
{
  "nickname": "BlackRose1",
  "birthDate": "1998-05-21",
  "gender": "F"
}
```

### 트랜잭션

- 활성 닉네임 중복 확인
- 사용자 프로필과 `modDttm`, `modUsrSeq` 갱신
- 커밋 후 기존 닉네임 Redis 검색키 제거 및 새 키 추가

## 12.4 프로필 이미지 교체

```json
{
  "imageSeq": 302
}
```

- 본인이 업로드한 활성 `PROFILE` 이미지인지 검증한다.
- `users.profileImageSeq`만 교체한다.
- 기존 이미지 행과 MinIO 객체를 즉시 삭제하지 않는다.

## 12.5 다른 회원 프로필

- 비로그인 호출 가능
- ADMIN, 비활성, 삭제 회원은 공개하지 않음
- 어느 방향이든 차단 관계가 있으면 404
- 인증 사용자는 `followedByMe`를 계산
- 아티스트 확장 정보는 `VERIFIED`일 때만 포함

## 12.6 팔로우

설정은 `PUT`, 해제는 같은 경로의 `DELETE`를 사용하며 요청 바디는 없다.

### 트랜잭션

- 자기 자신, ADMIN, 비활성 회원, 차단 관계 거부
- 실제 ON 전환일 때만 팔로우 관계 생성과 `FOLLOW` 알림 저장
- OFF 전환은 관계만 삭제
- 커밋 후 알림 실시간 전송

## 12.7 차단

설정은 `PUT`, 해제는 같은 경로의 `DELETE`를 사용하며 요청 바디는 없다.

ON 전환 트랜잭션:

1. 차단 관계 생성
2. 양방향 팔로우 관계 삭제

기존 DM과 메시지는 삭제하지 않지만 차단 중 새 메시지 전송은 거부한다.

## 12.8 팔로워·팔로잉·차단 목록

- 모두 커서 페이지를 사용한다.
- 비활성·삭제·ADMIN 회원 제외
- 차단 목록은 본인만 조회 가능
- 검색 API와 동일하게 화면 응답은 PostgreSQL 현재 상태를 기준으로 구성한다.

각 `items`는 다음 공통 관계 회원 정보를 사용한다.

```json
{
  "userSeq": 102,
  "nickname": "푸른나비",
  "role": "USER",
  "profileImageSeq": 302,
  "profileImageUrl": "https://temporary-download-url",
  "followedByMe": true
}
```

## 12.9 회원 탈퇴

하나의 트랜잭션에서:

1. `accountStatus=WITHDRAWN`
2. `USER_REQUEST` 계정 상태 이력 생성
3. 모든 유효 Refresh Token 폐기
4. 모든 푸시 기기 비활성화

회원 행을 즉시 물리 삭제하지 않는다. 커밋 후 사용자·아티스트 Redis 검색 인덱스에서 제거한다.
탈퇴 계정의 닉네임과 휴대폰 번호는 신규 가입에서 재사용할 수 있다. 탈퇴 이력과 기존
회원 행은 관리자 정리·복구 확장을 위해 유지한다.

## 12.10 최근 검색어

조회:

```http
GET /v1/users/me/recent-searches
```

수정:

```http
PATCH /v1/users/me/recent-searches
```

```json
{
  "operation": "ADD",
  "term": "검은 장미"
}
```

`operation`:

- `ADD`: 동일 항목을 제거한 후 맨 앞에 추가
- `REMOVE`: 완전히 일치하는 단일 항목 제거

정책:

- 최대 10개
- 최신 검색어가 앞
- Redis에서 즉시 반영
- dirty 사용자 집합에 기록
- 스케줄러가 `users.recentSearchTerms` 배열에 지연 일괄 반영
- Redis 값이 없을 때만 DB 배열로 복구
- Redis 장애 시 조회는 DB 폴백, 수정은 503
- 전체 삭제 operation은 제공하지 않음

## 12.11 푸시토큰

등록·재활성화:

```json
{
  "pushToken": "fcm-token",
  "platform": "ANDROID",
  "refreshToken": "example"
}
```

- push token 전역 upsert
- 현재 회원·플랫폼으로 연결하고 활성화
- 현재 Refresh Token과 기기 연결
- 토큰 회전 시 이전 기기 연결 비활성화

비활성화:

```http
DELETE /v1/devices/901
```

- 본인 기기만 가능
- 기기 비활성화와 연결된 Refresh Token 폐기를 같은 트랜잭션에서 처리

---

# 13. 컬렉션

## 13.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 내 컬렉션 조회 | GET | `/v1/collections` | User |
| 다른 회원 컬렉션 조회 | GET | `/v1/users/{userSeq}/collections` | Optional |
| 컬렉션 등록 | POST | `/v1/collections` | User |
| 컬렉션 삭제 | DELETE | `/v1/collections/{collectionSeq}` | User |

현재 범위에서는 컬렉션 배치 수정 API를 제공하지 않는다.

## 13.2 컬렉션 응답

```json
{
  "collectionSeq": 601,
  "ownerSeq": 101,
  "tattooSeq": 501,
  "imageSeq": 301,
  "imageUrl": "https://temporary-download-url",
  "bodyView": "front",
  "positionX": 0.42,
  "positionY": 0.35,
  "scaleRatio": 0.8,
  "rotationDegree": -15.0,
  "flipped": false,
  "regDttm": "2026-07-30T01:30:00Z"
}
```

## 13.3 컬렉션 등록

```json
{
  "imageSeq": 301,
  "bodyView": "front",
  "positionX": 0.42,
  "positionY": 0.35,
  "scaleRatio": 0.8,
  "rotationDegree": -15,
  "flipped": false
}
```

### 검증

- `bodyView`: 비어 있지 않은 최대 10자
- `positionX`, `positionY`: 0~1
- `scaleRatio`: 0보다 큼
- `rotationDegree`: -180~180
- 모든 필드 필수

### 모델 처리

1. 회원 소유 이미지 확인
2. 타투 여부 판별
3. 타투일 때만 분석 모델 실행
4. 분석 결과로 primary, secondary 최대 2개, color, rendering 최대 2개, subjects 확보

모델 호출은 DB 트랜잭션 밖에서 수행한다.
비타투 이미지는 422 `NOT_TATTOO_IMAGE`, 모델 서버 장애는 502,
시간 초과는 504로 반환한다.

### DB 트랜잭션

1. `tattoos(sourceType=USER_COLLECTION)` 생성
2. Subject upsert와 `tattoo_subjects` 생성
3. `tattoo_collections` 생성
4. 주 스타일·색상 컬렉션 가중치 반영

## 13.4 다른 회원 컬렉션

- 활성 회원의 소프트 삭제되지 않은 컬렉션만 반환
- 어느 방향이든 차단 관계면 404
- 별도 공개 범위 칼럼이 없으므로 현재는 모든 활성 컬렉션을 공개

## 13.5 컬렉션 삭제

하나의 트랜잭션에서:

- 소유 컬렉션 소프트 삭제
- 컬렉션 전용 `tattoos` 소프트 삭제
- 기존 취향 점수 역산

원본 `images` 행과 MinIO 객체는 삭제하지 않는다.

출력:

```json
{
  "data": true
}
```

---

# 14. 검색·취향 입력

## 14.1 API 목록

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 사용자 자동완성 | GET | `/v1/search/accounts/autocomplete` | Public |
| 사용자 검색 | GET | `/v1/search/accounts` | Public |
| 타투이스트 자동완성 | GET | `/v1/search/artists/autocomplete` | Public |
| 타투이스트 검색 | GET | `/v1/search/artists` | Public |
| Subject 자동완성 | GET | `/v1/search/subjects/autocomplete` | Public |
| Subject 게시글 검색 | GET | `/v1/search/posts` | Optional |
| 회원가입 설문 제공 | POST | `/v1/preferences/survey` | User |

제공하지 않는 API:

- Subject 오타 보정 전용 API
- 검색 결과 클릭 API
- 이미지 유사 검색 API

## 14.2 사용자·타투이스트 자동완성

```http
GET /v1/search/accounts/autocomplete?q=검ㅇ&size=10
GET /v1/search/artists/autocomplete?q=검ㅇ&size=10
```

출력:

```json
{
  "data": [
    {
      "userSeq": 101,
      "nickname": "검은장미",
      "role": "ARTIST"
    }
  ]
}
```

- prefix 전용
- 한글 완성형을 호환 자모로 분해
- 숫자·영문은 그대로 보존
- 영문 대소문자 구분
- Redis에는 정규화 검색키와 `userSeq`만 저장
- 응답 직전 PostgreSQL에서 현재 계정 상태 재검증
- 사용자 자동완성은 ADMIN 제외
- 타투이스트 자동완성은 `ARTIST + VERIFIED`만 허용

## 14.3 사용자·타투이스트 본 검색

```http
GET /v1/search/accounts?q=검은장미&size=20
GET /v1/search/artists?q=검은장미&size=20
```

Redis Search 단계:

1. `EXACT`
2. `PREFIX`
3. `FUZZY_1`
4. `FUZZY_2`
5. `CONTAINS`

- 단계가 높은 후보를 먼저 반환한다.
- 같은 단계 안에서 Redis relevance score를 사용한다.
- Spring에서 편집거리나 취향으로 다시 정렬하지 않는다.
- PostgreSQL에서 삭제·탈퇴·차단·인증 상태를 다시 확인한다.

## 14.4 Subject 자동완성

```http
GET /v1/search/subjects/autocomplete?q=장&size=10
```

```json
{
  "data": [
    {
      "subjectSeq": 10,
      "subjectName": "장미"
    }
  ]
}
```

- 자동완성 전용 선별 사전을 Redis ZSET으로 유지한다.
- 초기 목록은 타투 연결 빈도가 높은 Subject로 구성한다.
- 이후 보정된 정답 Subject 검색량을 반영하여 목록을 조정한다.
- 전체 `subjects`가 자동완성 목록일 필요는 없다.

## 14.5 Subject 게시글 검색

```http
GET /v1/search/posts?q=장믜&cursor={cursor}&size=20
```

### 출력

```json
{
  "data": {
    "query": "장믜",
    "matchedSubject": {
      "subjectSeq": 10,
      "subjectName": "장미"
    },
    "matchType": "FUZZY_1",
    "items": [],
    "nextCursor": null,
    "hasNext": false,
    "size": 0
  }
}
```

### 처리

1. 전체 Subject Redis Search 인덱스에서 exact→prefix→fuzzy1→fuzzy2→contains
2. 최상위 정답 Subject 결정
3. `subjects → tattoo_subjects → tattoos → post_images → posts` 조회
4. `PUBLISHED`, 활성, 차단·관심 없음 조건 검증
5. 보정된 실제 Subject 기준 검색량 +1
6. 원문과 정답 Subject를 검색 로그로 적재

오타 보정은 이 API 내부에서 수행하므로 별도 correction API를 호출하지 않는다.

검색 로그는 Redis 대기열을 거쳐 스케줄러가 MinIO JSONL로 저장한다.
Subject count 스냅샷도 버전별로 MinIO에 보관하여 Redis 데이터 유실 시 자동완성 목록을 재구성한다.

## 14.6 게시글 시청시간

```json
{
  "seconds": 18
}
```

- 프론트엔드가 계산한 0~3,600초
- 원본 체류시간과 사용자×게시물 통계 행은 저장하지 않음
- 구간별 점수로 변환하여 게시글 타투의 중복 제거된 주 스타일·색상 점수만 갱신
- 호출마다 반영되므로 상태 변경 Rate Limit 적용

출력:

```json
{
  "data": true
}
```

권장 기본 구간:

| 구간 | 점수 |
|---|---:|
| 0~2초 | 0 |
| 3~9초 | 0.1 |
| 10~29초 | 0.5 |
| 30초 이상 | 1.0 |

## 14.7 회원가입 설문

```json
{
  "primaryStyleSeqs": [1, 3, 5],
  "colorSeqs": [1, 2]
}
```

- 주 스타일 1개 이상
- 색상은 `null` 또는 빈 배열 허용
- 서버에서 중복 제거
- 취향 점수 행이 전혀 없는 회원에게 한 번만 허용
- 전체 점수 upsert를 하나의 트랜잭션으로 처리
- secondary와 rendering은 취향 점수에 사용하지 않음

출력:

```json
{
  "data": {
    "primaryStyles": [
      {
        "classificationSeq": 1,
        "score": 5.0
      }
    ],
    "colors": [
      {
        "classificationSeq": 2,
        "score": 5.0
      }
    ]
  }
}
```

---

# 15. 분류 기준정보 지원 API

설문과 타투 분석 결과 표시를 위해 다음 조회 API를 유지한다.

| Method | URL |
|---|---|
| GET | `/v1/classifications/primary-styles` |
| GET | `/v1/classifications/secondary-styles` |
| GET | `/v1/classifications/rendering-styles` |
| GET | `/v1/classifications/colors` |

출력:

```json
{
  "data": [
    {
      "seq": 1,
      "code": "LINE",
      "name": "라인워크"
    }
  ]
}
```

활성 기준정보만 반환한다.

---

# 16. 성공 응답 예시 빠른 참조

모든 예시는 실제 HTTP 응답의 최상위 `ApiResponse.data` 래퍼를 포함한다.
Presigned URL 문자열은 설명을 위한 예시이며 호출할 때마다 달라질 수 있다.

## 16.1 토큰 응답

`POST /v1/auth/signup`, `POST /v1/auth/token/refresh`:

```json
{
  "data": {
    "accessToken": "example",
    "accessTokenExpiresAt": "2026-07-31T11:00:00Z",
    "refreshToken": "example",
    "refreshTokenExpiresAt": "2026-08-30T10:00:00Z",
    "tokenType": "Bearer"
  }
}
```

## 16.2 커서 목록 응답

게시글·댓글·DM·알림·회원 관계·컬렉션·보관함 목록이 공유하는 기본 형태:

```json
{
  "data": {
    "items": [],
    "nextCursor": null,
    "hasNext": false,
    "size": 0
  }
}
```

게시글이 있는 경우:

```json
{
  "data": {
    "items": [
      {
        "postSeq": 2001,
        "author": {
          "userSeq": 101,
          "nickname": "검은장미",
          "role": "ARTIST",
          "profileImageSeq": 301,
          "profileImageUrl": "https://minio.example/profile?X-Amz-Signature=..."
        },
        "content": "장미 라인워크 작업입니다.",
        "likeCount": 12,
        "commentCount": 3,
        "images": [
          {
            "postImageSeq": 1001,
            "imageSeq": 401,
            "imageUrl": "https://minio.example/post?X-Amz-Signature=...",
            "tattooSeq": 501,
            "displayOrder": 1
          }
        ],
        "likedByMe": false,
        "bookmarkedByMe": true,
        "regDttm": "2026-07-31T10:00:00Z",
        "modDttm": "2026-07-31T10:00:00Z"
      }
    ],
    "nextCursor": "2001",
    "hasNext": true,
    "size": 1
  }
}
```

## 16.3 상태 설정·삭제 응답

좋아요·북마크·관심 없음·팔로우·차단·보관 설정:

```json
{
  "data": {
    "enabled": true
  }
}
```

같은 경로에 `DELETE`를 호출해 해제한 경우:

```json
{
  "data": {
    "enabled": false
  }
}
```

게시글·댓글·컬렉션·기기·회원 삭제와 로그아웃:

```json
{
  "data": true
}
```

## 16.4 사용자·아티스트·기기

`GET /v1/users/me`:

```json
{
  "data": {
    "userSeq": 101,
    "nickname": "검은장미",
    "phoneNumber": "+821012345678",
    "phoneVerifiedDttm": "2026-07-31T09:00:00Z",
    "profileImageSeq": 301,
    "profileImageUrl": "https://minio.example/profile?X-Amz-Signature=...",
    "birthDate": "1998-05-21",
    "gender": "M",
    "role": "USER",
    "accountStatus": "ACTIVE",
    "artistProfile": {
      "shopName": "스타투 스튜디오",
      "verificationStatus": "UNVERIFIED"
    },
    "regDttm": "2026-07-31T09:00:00Z"
  }
}
```

`GET /v1/users/{userSeq}`:

```json
{
  "data": {
    "userSeq": 101,
    "nickname": "검은장미",
    "profileImageSeq": 301,
    "profileImageUrl": "https://minio.example/profile?X-Amz-Signature=...",
    "role": "ARTIST",
    "followerCount": 120,
    "followingCount": 32,
    "followedByMe": true,
    "artistProfile": {
      "shopName": "스타투 스튜디오",
      "verificationStatus": "VERIFIED"
    }
  }
}
```

`GET /v1/artists`의 `items` 한 건:

```json
{
  "userSeq": 101,
  "nickname": "검은장미",
  "profileImageSeq": 301,
  "profileImageUrl": "https://minio.example/profile?X-Amz-Signature=...",
  "shopName": "스타투 스튜디오",
  "shopCity": "서울",
  "shopAddress": "서울특별시 강남구 테헤란로 1",
  "shopPhone": "02-1234-5678",
  "shopDetails": "평일 12:00~21:00, 예약제",
  "verificationStatus": "VERIFIED",
  "followerCount": 120,
  "regDttm": "2026-07-31T09:00:00Z"
}
```

`POST /v1/devices`:

```json
{
  "data": {
    "deviceSeq": 901,
    "platform": "WEB",
    "active": true,
    "lastUsedDttm": "2026-07-31T10:00:00Z"
  }
}
```

`GET /v1/users/me/recent-searches`와 최근 검색어 수정:

```json
{
  "data": [
    "검은 장미",
    "라인워크"
  ]
}
```

## 16.5 이미지·타투·컬렉션·보관함

`POST /v1/images/uploads/presign`:

```json
{
  "data": {
    "objectKey": "users/101/post/550e8400-e29b-41d4-a716-446655440000.png",
    "uploadUrl": "https://minio.example/upload?X-Amz-Signature=...",
    "requiredHeaders": {
      "Content-Type": "image/png"
    },
    "expiresInSeconds": 600
  }
}
```

`POST /v1/images/uploads/complete`:

```json
{
  "data": {
    "imageSeq": 401,
    "objectKey": "users/101/post/550e8400-e29b-41d4-a716-446655440000.png",
    "downloadUrl": "https://minio.example/download?X-Amz-Signature=...",
    "regDttm": "2026-07-31T10:00:00Z"
  }
}
```

`GET /v1/tattoo-designs`의 `items` 한 건:

```json
{
  "tattooSeq": 501,
  "designImageSeq": 402,
  "designImageUrl": "https://minio.example/design?X-Amz-Signature=...",
  "primaryStyleSeq": 1,
  "colorSeq": 2,
  "subjects": [
    {
      "subjectSeq": 10,
      "subjectName": "장미"
    }
  ],
  "archivedByMe": false,
  "regDttm": "2026-07-31T10:00:00Z"
}
```

`GET /v1/tattoos/{tattooSeq}/image?variant=DESIGN`:

```json
{
  "data": {
    "imageSeq": 402,
    "downloadUrl": "https://minio.example/design?X-Amz-Signature=...",
    "expiresAt": "2026-07-31T10:10:00Z"
  }
}
```

`POST /v1/collections`:

```json
{
  "data": {
    "collectionSeq": 601,
    "ownerSeq": 101,
    "tattooSeq": 501,
    "imageSeq": 401,
    "imageUrl": "https://minio.example/collection?X-Amz-Signature=...",
    "bodyView": "front",
    "positionX": 0.42,
    "positionY": 0.35,
    "scaleRatio": 0.8,
    "rotationDegree": -15.0,
    "flipped": false,
    "regDttm": "2026-07-31T10:00:00Z"
  }
}
```

## 16.6 댓글·DM·알림

댓글 목록의 `items` 한 건:

```json
{
  "commentSeq": 701,
  "postSeq": 2001,
  "author": {
    "userSeq": 102,
    "nickname": "푸른나비",
    "profileImageSeq": 302,
    "profileImageUrl": "https://minio.example/profile?X-Amz-Signature=..."
  },
  "parentCommentSeq": null,
  "content": "색감이 정말 좋네요.",
  "likeCount": 2,
  "replyCount": 1,
  "likedByMe": false,
  "deleted": false,
  "regDttm": "2026-07-31T10:00:00Z",
  "modDttm": "2026-07-31T10:00:00Z"
}
```

`POST /v1/dm/rooms/{roomSeq}/messages`:

```json
{
  "data": {
    "dmMessageSeq": 9001,
    "dmRoomSeq": 801,
    "senderSeq": 101,
    "messageType": "TEXT_WITH_IMAGE",
    "textContent": "이런 느낌을 원해요.",
    "imageSeq": 401,
    "imageUrl": "https://minio.example/dm?X-Amz-Signature=...",
    "readDttm": null,
    "deleted": false,
    "regDttm": "2026-07-31T10:00:00Z"
  }
}
```

`PATCH /v1/dm/rooms/{roomSeq}/read`:

```json
{
  "data": 3
}
```

`PATCH /v1/dm/rooms/{roomSeq}/notification`:

```json
{
  "data": false
}
```

`GET /v1/notifications/unread-counts`:

```json
{
  "data": {
    "total": 7,
    "byType": {
      "POST_LIKE": 2,
      "POST_COMMENT": 1,
      "COMMENT_LIKE": 0,
      "FOLLOW": 1,
      "NEW_DM": 3,
      "SYSTEM": 0
    }
  }
}
```

`PATCH /v1/notifications/read-all`:

```json
{
  "data": 7
}
```

## 16.7 검색·취향·분류

사용자·타투이스트 검색:

```json
{
  "data": [
    {
      "userSeq": 101,
      "nickname": "검은장미",
      "role": "ARTIST"
    }
  ]
}
```

Subject 자동완성:

```json
{
  "data": [
    {
      "subjectSeq": 10,
      "subjectName": "장미"
    }
  ]
}
```

`GET /v1/search/posts`:

```json
{
  "data": {
    "query": "장미",
    "matchedSubject": {
      "subjectSeq": 10,
      "subjectName": "장미"
    },
    "matchType": "EXACT",
    "items": [],
    "nextCursor": null,
    "hasNext": false,
    "size": 0
  }
}
```

`POST /v1/preferences/survey`:

```json
{
  "data": {
    "primaryStyles": [
      {
        "classificationSeq": 1,
        "score": 3.0
      }
    ],
    "colors": [
      {
        "classificationSeq": 2,
        "score": 3.0
      }
    ]
  }
}
```

분류 기준정보 API:

```json
{
  "data": [
    {
      "seq": 1,
      "code": "LINE",
      "name": "라인워크"
    }
  ]
}
```

---

# 17. 최종 정책표

| 항목 | 최종 정책 |
|---|---|
| 사용자 가입 | USER 또는 ARTIST 가입 유형, ADMIN 금지 |
| 휴대폰 가입 확인 | 미가입이면 provider=null, 가입이면 기존 OAuth provider 반환 |
| 계정·OAuth | 활성 전화번호당 통합 계정 1개, 가입 API에서 추가 provider 연결 금지 |
| 탈퇴 식별자 | 탈퇴 계정의 닉네임·휴대폰 번호 재사용 허용 |
| ARTIST 역할 | 관리자 인증 승인 후 부여 |
| 게시글 노출 | `PUBLISHED`만 |
| 게시글 생성 | 모든 AI 검증 완료 후 짧은 DB 트랜잭션, 커밋 후 성공 응답 |
| 게시글 수정·삭제 | 카운터를 제외한 명시적 부분 UPDATE |
| 관계 상태 API | PUT으로 설정, DELETE로 해제, 요청 바디 없음 |
| 댓글 계층 | 최상위 댓글 + 1단계 답글 |
| 검색 오타 보정 | 본 검색 내부 fuzzy |
| 검색 정렬 | exact → prefix → fuzzy1 → fuzzy2 → contains |
| 검색 클릭 점수 | 사용하지 않음 |
| 이미지 유사 검색 | 사용하지 않음 |
| 자동완성 | 별도 Redis prefix 사전 |
| Subject 검색량 | 보정된 실제 Subject 기준 |
| 최근 검색어 | Redis 즉시, PostgreSQL 배열 지연 반영 |
| DM 알림 OFF | 메시지·미읽음 수 유지, 알림 행·푸시만 생략 |
| DM 입장 | 메시지와 해당 방 알림 함께 읽음 |
| DM 전송 재시도 | 별도 클라이언트 멱등키 없이 현행 `dmMessageSeq` 사용 |
| 실시간 전송 | DB 커밋 후 WebSocket·FCM |
| 외부 전송 실패 | DB 커밋 롤백하지 않음 |
| 모델 호출 | DB 트랜잭션 밖 |
| 이미지 URL | DB에는 MinIO object key만 저장하고 응답 시 Presigned GET URL 생성 |
| 관리자·테스트·추출 API | 현재 v1에서 제공하지 않음 |
| 빈 목록 | 항상 `[]` |
