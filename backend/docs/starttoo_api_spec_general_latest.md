# Starttoo API v1 범용 명세서

> 최종 갱신: 2026-08-01
> 현재 서버 구현 및 Swagger 기준 API 수: 83개

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
- 컬렉션 등록처럼 타투 이미지가 필수인 API에서 모델이 정상 이미지를 비타투로
  판정하면 파일 형식 오류가 아니므로 422 `NOT_TATTOO_IMAGE`를 반환한다.
  게시글 작성은 비타투 이미지를 허용하므로 이 오류를 반환하지 않는다.

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
| `archivedDttm` | DateTime | Y | 보관 시각 |

응답 예시:

```json
{
  "data": {
    "items": [
      {
        "tattooSeq": 501,
        "designImageSeq": 901,
        "designImageUrl": "https://minio.example/designs/901?X-Amz-Signature=...",
        "archivedDttm": "2026-08-01T09:30:00Z"
      }
    ],
    "nextCursor": null,
    "hasNext": false,
    "size": 1
  }
}
```

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
2. 보관 시 반영한 취향 점수는 행동 이력으로 유지하며 역보정하지 않음

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

### 출력 `ArtistListItem`

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
| `posts` | Array | Y, 최대 6개 |
| `regDttm` | DateTime | Y |

`posts` 항목:

| 필드 | 타입 | 필수 | 설명 |
|---|---|---:|---|
| `postSeq` | Long | Y | 게시물 식별자 |
| `imageUrl` | String | Y | `displayOrder=1` 이미지의 단기 Presigned GET URL |
| `likeCount` | Integer | Y | 현재 좋아요 수 |

### 처리

- `users.role=ARTIST`
- `users.accountStatus=ACTIVE`
- `users.isDeleted=false`
- `artists.verificationStatus=VERIFIED`
- `artists.isDeleted=false`
- `city`가 있으면 `shopCity` 정확 일치
- 팔로워 수 내림차순, `userSeq` 내림차순
- 각 아티스트의 `PUBLISHED AND isDeleted=false` 게시물을 `postSeq` 내림차순 최대 6개 반환
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

- `users.role=ARTIST`인 회원만 사용할 수 있다.
- 가입할 때 이미 생성된 `artists` 행의 간략한 숍 정보만 수정한다.
- `ARTIST` 역할인데 확장 행이 없다면 데이터 불일치로 404 `ARTIST_NOT_FOUND`를 반환한다.
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

웹 authorization code 방식은 다음과 같다. `accessToken`과 동시에 보낼 수 없다.

```json
{
  "provider": "KAKAO",
  "authorizationCode": "one-time-authorization-code",
  "redirectUri": "https://app.example.com/auth/kakao/callback"
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
- `accessToken` 또는 `authorizationCode` 중 정확히 하나만 필수다.
- `authorizationCode` 방식에서는 인가 요청 때와 정확히 같은 `redirectUri`가 필수다.
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
  "role": "ARTIST",
  "birthDate": "1998-05-21",
  "gender": "M"
}
```

### 제약

- `role`: `USER`, `ARTIST`만 허용하며 가입 즉시 `users.role`에 저장
- `ADMIN` 공개 가입 금지
- 휴대폰 번호는 하이픈·공백 제거 후 한국 번호 `+82` E.164 형식으로 정규화
- 닉네임: `^[가-힣A-Za-z0-9]{2,20}$`
- 영문 대소문자를 구분한다.
- 성별: `M`, `F`, `null`

### 역할 정책

- `role=USER`: 일반 `users` 계정을 생성한다.
- `role=ARTIST`: `users.role=ARTIST`와 `artists.verificationStatus=UNVERIFIED`를 함께 생성한다.
- 추후 관리자 인증은 `verificationStatus`만 변경하며 역할은 바꾸지 않는다.

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

삭제된 댓글과 답글은 목록에서 반환하지 않는다.

## 6.3 최상위 댓글 목록

```http
GET /v1/posts/2001/comments?cursor={cursor}&size=30
```

- `parentCommentSeq IS NULL`, `PUBLISHED`, `isDeleted=false`인 댓글만 반환한다.
- `commentSeq` 오름차순 커서를 사용한다.
- 각 댓글에 활성 답글 수 `replyCount`를 포함한다.
- 차단 관계 사용자의 댓글은 제외한다.

## 6.4 답글 목록

```http
GET /v1/comments/501/replies?cursor={cursor}&size=30
```

- 지정 댓글은 활성 최상위 댓글이어야 한다.
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
2. 답글이면 부모 최상위 댓글 행을 잠그고 같은 게시물의 활성 댓글인지 확인
3. 댓글 행 생성
4. `posts.commentCount = commentCount + 1`

댓글·답글 작성으로 서비스 알림을 생성하지 않는다.

## 6.6 댓글 삭제

- 작성자만 삭제할 수 있다.
- 답글이면 해당 답글만 소프트 삭제한다.
- 최상위 댓글이면 해당 댓글과 현재 활성 답글을 모두 소프트 삭제한다.
- `posts.commentCount`를 실제 소프트 삭제된 행 수만큼 원자적으로 감소시킨다.
- 최상위 댓글 행 잠금으로 답글 생성과 연쇄 삭제를 직렬화한다.
- 이미 삭제된 댓글의 반복 삭제는 성공으로 처리한다.

## 6.7 댓글 좋아요

설정은 `PUT`, 해제는 같은 경로의 `DELETE`를 사용하며 요청 바디는 없다.

### 트랜잭션

- 실제 상태 변경 시에만 `comment_likes` INSERT/DELETE
- 실제 상태 변경 시에만 `comments.likeCount` 원자적 증감
- 댓글 좋아요 알림은 생성하지 않는다.
- 관계·카운트는 같은 트랜잭션
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
  "notificationType": "NEW_DM",
  "referenceSeq": 701,
  "partner": {
    "userSeq": 102,
    "nickname": "푸른나비",
    "profileImageSeq": 302,
    "profileImageUrl": "https://temporary-download-url"
  },
  "unreadCount": 4,
  "title": "새 메시지",
  "body": "상담 가능할까요?",
  "regDttm": "2026-07-30T01:30:00Z"
}
```

지원 타입:

- `NEW_DM`
- `SYSTEM`

`SYSTEM`은 `actorSeq`, `partner`가 `null`이고 `unreadCount=1`이다.

## 8.3 미확인 알림 목록

- 현재 회원의 `isRead=false`만 대상으로 한다.
- `NEW_DM`은 전체 미확인 알림을 `referenceSeq=dmRoomSeq`로 먼저 그룹화한다.
- 그룹 대표값은 `regDttm DESC, notificationSeq DESC`의 첫 알림이다.
- 대표 알림의 제목·본문·시각과 그룹 원본 행 수 `unreadCount`, 상대 회원 정보를 반환한다.
- `SYSTEM`은 그룹화하지 않고 각 행을 개별 항목으로 반환한다.
- 그룹 대표와 SYSTEM을 합쳐 `regDttm DESC, notificationSeq DESC`로 정렬한 후
  불투명 복합 커서와 `size`를 적용한다.
- 결과가 없으면 `items=[]`
- `size=10`을 사용하면 Top 10 기능과 동일하다.

## 8.4 타입별 미확인 개수

```json
{
  "data": {
    "total": 7,
    "byType": {
      "NEW_DM": 5,
      "SYSTEM": 2
    }
  }
}
```

개수는 목록의 그룹 수가 아니라 DB의 실제 미확인 알림 행 수다. 메시지 한 건당 `NEW_DM`
알림 한 건이므로 방 알림이 켜진 채 수신한 미확인 DM 수와 같다. 방 알림이 꺼져 알림 행이
생성되지 않은 메시지는 포함하지 않는다. 두 타입은 값이 0이어도 항상 반환한다.

## 8.5 읽음 처리

- 개별 `SYSTEM`: 지정한 한 행만 처리
- 집계 `NEW_DM`: 대표 `notificationSeq`가 가리키는 방의 모든 미확인 NEW_DM 알림 처리
- 알림 읽음 API는 `dm_messages.readDttm`을 변경하지 않는다.
- 채팅방 진입 또는 DM 읽음 API에서만 메시지와 해당 방 알림을 함께 처리한다.
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
3. 비타투 이미지는 정상 게시물 이미지로 유지하고 타투 분석은 생략
4. 타투로 판별된 이미지에만 분석 모델을 실행해 `primaryStyle`, `secondaryStyle` 최대 2개,
   `color`, `rendering` 최대 2개, 다중 `subjects` 수신
5. 분석 성공 후 DB 저장 트랜잭션 시작

모든 이미지의 판별과 타투 이미지 분석은 동기로 순서대로 완료한다. 비타투 판별은 실패가
아니며, 모델 장애·비정상 분석·시간 초과가 하나라도 발생하면 DB 저장을 시작하지 않는다.
모델 호출 중에는 DB 쓰기 트랜잭션을 열지 않는다.
`AI_ENABLED=true`이면 모델 서버를 호출하고, 기본값 `false`에서는 명시적인
개발용 분석값을 사용한다.

### DB 트랜잭션

1. 타투로 판별된 이미지에만 `tattoos` 생성
2. 해당 타투 분석 결과의 Subject upsert 및 `tattoo_subjects` 생성
3. `posts` 생성
4. 타투 여부와 관계없이 요청한 모든 이미지를 순서대로 `post_images`에 연결

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

실제 OFF 전환:

1. 관계 DELETE
2. 카운트 원자적 감소
3. ON에서 반영한 취향 점수는 행동 이력으로 유지하고 역보정하지 않음

게시글 좋아요 서비스 알림은 생성하지 않는다. 동일 상태 반복은 관계·카운트·점수를
변경하지 않는다.

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
- 신규 북마크 INSERT 때만 취향 점수를 가산한다.
- DELETE에서는 관계만 제거하고 기존 취향 점수는 역보정하지 않는다.
- 게시글 카운트 칼럼은 별도로 두지 않는다.
- 작성자 알림은 만들지 않는다.

## 9.8 관심 없음

- 설정은 `PUT`, 해제는 같은 경로의 `DELETE`를 사용하며 요청 바디는 없다.
- ON이면 `post_hidden_preferences`를 생성하고 이후 해당 회원의 피드에서 제외한다.
- 주 스타일·색상에 음수 가중치를 적용한다.
- OFF이면 관계만 삭제하고 기존 감점은 행동 이력으로 유지한다.
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
| 형태 기반 도안 검색 | POST | `/v1/designs/search-by-shape` | Public |

## 10.2 타투 도안 목록

```http
GET /v1/tattoo-designs?cursor={cursor}&size=20
```

- 활성 `tattoo_designs`만 반환한다.
- 최신 등록순 커서
- 로그인 회원이면 `archivedByMe`를 계산한다.
- 원본 타투 이미지가 아니라 가공된 도안 이미지 정보를 반환한다.
- 주 스타일·색상은 `{code, name}`, Subject는 이름 문자열 목록으로 반환한다.

## 10.3 타투 상세

```json
{
  "tattooSeq": 501,
  "registrantSeq": 101,
  "imageSeq": 301,
  "sourceType": "USER_POST",
  "primaryStyle": {"code": "BLACKWORK", "name": "블랙워크"},
  "secondaryStyles": [
    {"code": "GEOMETRIC", "name": "기하학"}
  ],
  "renderingStyles": [
    {"code": "LINE", "name": "라인"}
  ],
  "color": {"code": "BLACK", "name": "검정"},
  "subjects": ["장미", "뱀"],
  "usedForTraining": false,
  "trainedDttm": null,
  "regDttm": "2026-07-30T01:30:00Z"
}
```

- `primaryStyle`은 필수 `{code, name}` 1개
- `color`는 선택 `{code, name}` 1개, 미분류이면 `null`
- `secondaryStyles`, `renderingStyles`는 각각 최대 2개
- `subjects`는 화면에 바로 표시할 수 있는 이름 문자열 목록

## 10.4 타투 이미지

```http
GET /v1/tattoos/501/image?variant=ORIGINAL
```

`variant`:

- `ORIGINAL`: `tattoos.imageSeq`
- `DESIGN`: `tattoo_designs.imageSeq`, 도안이 없으면 404

출력은 `imageSeq`, 단기 `downloadUrl`, `expiresAt`이다.

## 10.5 형태 기반 도안 검색

```http
POST /v1/designs/search-by-shape
```

요청:

```json
{
  "maskPngB64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "mode": "coverup"
}
```

| 필드 | 타입 | 필수 | 제약 |
|---|---|---:|---|
| `maskPngB64` | String | Y | 검은 배경과 흰 획으로 된 PNG base64, data URI 접두어 허용 |
| `mode` | String | Y | `coverup` 또는 `shape` |

응답:

```json
{
  "data": {
    "mode": "coverup",
    "count": 1,
    "results": [
      {
        "tattooSeq": 501,
        "imageUrl": "https://temporary-design-url",
        "score": 0.86,
        "styleCode": "GEOMETRIC",
        "styleName": "기하학"
      }
    ]
  }
}
```

- 검색 엔진 점수 내림차순을 유지한다.
- DB에서 삭제된 타투·도안·이미지는 제외하므로 엔진 결과보다 `count`가 작을 수 있다.
- `imageUrl`은 도안 object key로 생성한 단기 Presigned GET URL이다.
- 엔진 장애·회로 차단 상태는 503 `SERVICE_UNAVAILABLE`로 반환한다.

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
- 실제 ON 전환일 때만 팔로우 관계 생성
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

## 12.11 Firebase Installation ID

등록·재활성화:

```json
{
  "fid": "c1234567890abcdefghijk",
  "platform": "ANDROID",
  "refreshToken": "example"
}
```

- FID 전역 upsert
- 현재 회원·플랫폼으로 연결하고 활성화
- 현재 Refresh Token과 기기 연결
- 같은 세션에 연결된 이전 기기 비활성화

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
- 등록 시 반영된 취향 점수는 행동 이력으로 유지하고 역보정하지 않음

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
    "role": "ARTIST",
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
  "posts": [
    {
      "postSeq": 2001,
      "imageUrl": "https://minio.example/post?X-Amz-Signature=...",
      "likeCount": 12
    }
  ],
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
  "primaryStyle": {"code": "BLACKWORK", "name": "블랙워크"},
  "color": {"code": "BLACK", "name": "검정"},
  "subjects": ["장미"],
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

`GET /v1/notifications`의 `items` 한 건:

```json
{
  "notificationSeq": 8004,
  "actorSeq": 102,
  "notificationType": "NEW_DM",
  "referenceSeq": 801,
  "partner": {
    "userSeq": 102,
    "nickname": "푸른나비",
    "profileImageSeq": 302,
    "profileImageUrl": "https://minio.example/profile?X-Amz-Signature=..."
  },
  "unreadCount": 4,
  "title": "새 메시지",
  "body": "상담 가능할까요?",
  "regDttm": "2026-07-31T10:00:00Z"
}
```

`GET /v1/notifications/unread-counts`:

```json
{
  "data": {
    "total": 7,
    "byType": {
      "NEW_DM": 5,
      "SYSTEM": 2
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
| ARTIST 역할 | 가입 즉시 부여, 관리자는 `verificationStatus`만 승인 처리 |
| 게시글 노출 | `PUBLISHED`만 |
| 게시글 생성 | 모든 AI 판별 완료 후 짧은 DB 트랜잭션, 비타투 허용, 타투 이미지만 분석·저장 |
| 게시글 수정·삭제 | 카운터를 제외한 명시적 부분 UPDATE |
| 관계 상태 API | PUT으로 설정, DELETE로 해제, 요청 바디 없음 |
| 댓글 계층 | 최상위 댓글 + 1단계 답글 |
| 댓글 삭제 | 최상위 댓글 삭제 시 활성 답글까지 소프트 삭제, 실제 삭제 수만큼 카운트 감소 |
| 취향 점수 해제 | 좋아요·북마크·관심 없음·보관·컬렉션 삭제 시 역보정하지 않음 |
| 알림 타입 | `NEW_DM`, `SYSTEM`만 사용 |
| 알림 목록 | NEW_DM 방별 그룹화 후 대표 최신 시각 내림차순 커서 페이지네이션 |
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

---

# 18. 전체 엔드포인트 인덱스

아래 83개 항목은 현재 컨트롤러와 Swagger에 공개되는 v1 HTTP API 전체다.
각 API의 요청·응답·처리 규칙은 앞선 도메인별 절을 따른다.

| 도메인 | Method | Path |
|---|---|---|
| 보관함 | GET | `/v1/archive` |
| 보관함 | PUT | `/v1/archive/{tattooSeq}` |
| 보관함 | DELETE | `/v1/archive/{tattooSeq}` |
| 타투이스트 | GET | `/v1/artists` |
| 타투이스트 | PATCH | `/v1/artists/me/profile` |
| 인증 | POST | `/v1/auth/social/login` |
| 인증 | POST | `/v1/auth/signup` |
| 인증 | POST | `/v1/auth/token/refresh` |
| 인증 | POST | `/v1/auth/logout` |
| 인증 | GET | `/v1/auth/nicknames/suggestions` |
| 인증 | GET | `/v1/auth/nicknames/availability` |
| 인증 | GET | `/v1/auth/phones/availability` |
| 분류 | GET | `/v1/classifications/primary-styles` |
| 분류 | GET | `/v1/classifications/secondary-styles` |
| 분류 | GET | `/v1/classifications/rendering-styles` |
| 분류 | GET | `/v1/classifications/colors` |
| 컬렉션 | POST | `/v1/collections` |
| 컬렉션 | GET | `/v1/collections` |
| 컬렉션 | GET | `/v1/users/{userSeq}/collections` |
| 컬렉션 | DELETE | `/v1/collections/{collectionSeq}` |
| 댓글 | POST | `/v1/posts/{postSeq}/comments` |
| 댓글 | GET | `/v1/posts/{postSeq}/comments` |
| 댓글 | GET | `/v1/comments/{commentSeq}/replies` |
| 댓글 | DELETE | `/v1/comments/{commentSeq}` |
| 댓글 | PUT | `/v1/comments/{commentSeq}/like` |
| 댓글 | DELETE | `/v1/comments/{commentSeq}/like` |
| 커버업 검색 | POST | `/v1/designs/search-by-shape` |
| 기기 | POST | `/v1/devices` |
| 기기 | DELETE | `/v1/devices/{deviceSeq}` |
| DM | POST | `/v1/dm/rooms` |
| DM | GET | `/v1/dm/rooms` |
| DM | POST | `/v1/dm/rooms/{roomSeq}/messages` |
| DM | GET | `/v1/dm/rooms/{roomSeq}/messages` |
| DM | PATCH | `/v1/dm/rooms/{roomSeq}/read` |
| DM | PATCH | `/v1/dm/rooms/{roomSeq}/notification` |
| DM | DELETE | `/v1/dm/rooms/{roomSeq}` |
| 이미지 | POST | `/v1/images/uploads/presign` |
| 이미지 | POST | `/v1/images/uploads/complete` |
| 알림 | GET | `/v1/notifications` |
| 알림 | GET | `/v1/notifications/unread-counts` |
| 알림 | PATCH | `/v1/notifications/{notificationSeq}/read` |
| 알림 | PATCH | `/v1/notifications/read-all` |
| 게시글 | POST | `/v1/posts` |
| 게시글 | GET | `/v1/posts` |
| 게시글 | GET | `/v1/posts/me` |
| 게시글 | GET | `/v1/posts/bookmarked` |
| 게시글 | GET | `/v1/posts/following` |
| 게시글 | GET | `/v1/users/{userSeq}/posts` |
| 게시글 | GET | `/v1/posts/{postSeq}` |
| 게시글 | PATCH | `/v1/posts/{postSeq}` |
| 게시글 | DELETE | `/v1/posts/{postSeq}` |
| 게시글 | PUT | `/v1/posts/{postSeq}/like` |
| 게시글 | DELETE | `/v1/posts/{postSeq}/like` |
| 게시글 | PUT | `/v1/posts/{postSeq}/bookmark` |
| 게시글 | DELETE | `/v1/posts/{postSeq}/bookmark` |
| 게시글 | PUT | `/v1/posts/{postSeq}/not-interested` |
| 게시글 | DELETE | `/v1/posts/{postSeq}/not-interested` |
| 게시글 | POST | `/v1/posts/{postSeq}/dwell` |
| 게시글 | POST | `/v1/posts/{postSeq}/reports` |
| 취향 | POST | `/v1/preferences/survey` |
| 검색 | GET | `/v1/search/accounts/autocomplete` |
| 검색 | GET | `/v1/search/accounts` |
| 검색 | GET | `/v1/search/artists/autocomplete` |
| 검색 | GET | `/v1/search/artists` |
| 검색 | GET | `/v1/search/subjects/autocomplete` |
| 검색 | GET | `/v1/search/posts` |
| 타투 | GET | `/v1/tattoo-designs` |
| 타투 | GET | `/v1/tattoos/{tattooSeq}` |
| 타투 | GET | `/v1/tattoos/{tattooSeq}/image` |
| 사용자 | GET | `/v1/users/me` |
| 사용자 | PATCH | `/v1/users/me` |
| 사용자 | PATCH | `/v1/users/me/profile-image` |
| 사용자 | DELETE | `/v1/users/me` |
| 사용자 | GET | `/v1/users/{userSeq}` |
| 사용자 | PUT | `/v1/users/{userSeq}/follow` |
| 사용자 | DELETE | `/v1/users/{userSeq}/follow` |
| 사용자 | PUT | `/v1/users/{userSeq}/block` |
| 사용자 | DELETE | `/v1/users/{userSeq}/block` |
| 사용자 | GET | `/v1/users/{userSeq}/followers` |
| 사용자 | GET | `/v1/users/{userSeq}/following` |
| 사용자 | GET | `/v1/users/me/blocks` |
| 사용자 | GET | `/v1/users/me/recent-searches` |
| 사용자 | PATCH | `/v1/users/me/recent-searches` |

---

# 19. API별 상세 계약

이 절은 클라이언트가 API 하나만 읽어도 구현할 수 있도록 모든 공개 API를 같은 형식으로
정리한다. 성공·실패 응답은 실제 공통 envelope를 사용하며, 예시의 Presigned URL과 토큰은
설명용 값이다. Bearer 인증 API는 `Authorization: Bearer {accessToken}` 헤더가 필요하다.

## 19.1 인증

### POST `/v1/auth/social/login`

**API 개요:** Google 또는 Kakao 자격 증명을 검증하여 로그인 토큰이나 가입 토큰을 발급한다. 인증은 필요 없다.

**Request:** JSON body. `provider`는 `GOOGLE|KAKAO`, 최대 20자다. `accessToken`과
`authorizationCode` 중 정확히 하나만 보내며 각각 최대 4096자다. code 방식은
`redirectUri`(최대 2048자)가 필수다.

```json
{"provider":"KAKAO","authorizationCode":"oauth-code","redirectUri":"https://app.example.com/auth/callback"}
```

**Response:** `signupRequired`, `signupToken`, `tokens`를 반환한다. 기존 계정은
`signupRequired=false`, `tokens=TokenResponse`; 신규 OAuth subject는
`signupRequired=true`, `signupToken`만 제공한다.

**설명:** 서버가 제공자 API에서 불변 subject를 확인한다. code 방식의 토큰 교환 비밀키는
서버에만 둔다. 기존 ACTIVE 계정이면 마지막 로그인 시각을 갱신한다.

**성공 예시**
```json
{"data":{"signupRequired":true,"signupToken":"signup.jwt","tokens":null}}
```

**실패 예시**
```json
{"status":400,"code":"VALIDATION_ERROR","message":"accessToken 또는 authorizationCode 중 하나만 제공해야 합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### POST `/v1/auth/signup`

**API 개요:** 소셜 로그인에서 발급된 가입 토큰으로 단일 OAuth 통합 계정을 생성한다. 인증은 필요 없다.

**Request:** JSON body. `signupToken` 필수, `phoneNumber` 필수·최대 30자,
`nickname`은 한글·영문·숫자 2~20자이며 대소문자를 구분한다. `role`은 `USER|ARTIST`,
`birthDate`와 `gender(M|F)`는 선택값이다.

```json
{"signupToken":"signup.jwt","phoneNumber":"010-1234-5678","nickname":"BlackRose1","role":"ARTIST","birthDate":"1998-05-21","gender":"F"}
```

**Response:** `accessToken`, `accessTokenExpiresAt`, `refreshToken`,
`refreshTokenExpiresAt`, `tokenType=Bearer`를 반환한다.

**설명:** 전화번호를 `+82` E.164로 정규화한다. ARTIST는 가입 즉시 역할을 부여하고
`artists.verificationStatus=UNVERIFIED` 행을 만든다. 사용자·OAuth·상태 이력 저장은 한 트랜잭션이다.

**성공 예시**
```json
{"data":{"accessToken": "example","accessTokenExpiresAt":"2026-08-01T11:00:00Z","refreshToken": "example","refreshTokenExpiresAt":"2026-08-15T10:00:00Z","tokenType":"Bearer"}}
```

**실패 예시**
```json
{"status":409,"code":"DUPLICATE_PHONE_NUMBER","message":"이미 가입된 휴대폰 번호입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### POST `/v1/auth/token/refresh`

**API 개요:** 유효한 리프레시 토큰을 새 액세스·리프레시 토큰 쌍으로 회전한다. 인증은 필요 없다.

**Request:** JSON body의 `refreshToken` 필수, 최대 512자다.
```json
{"refreshToken": "example"}
```

**Response:** 회원가입과 같은 `TokenResponse`를 반환한다.

**설명:** 기존 토큰 폐기와 새 토큰 저장을 한 트랜잭션으로 처리한다. 만료되거나 이미
회전·폐기된 토큰은 재사용할 수 없다.

**성공 예시**
```json
{"data":{"accessToken": "example","accessTokenExpiresAt":"2026-08-01T11:00:00Z","refreshToken": "example","refreshTokenExpiresAt":"2026-08-15T10:00:00Z","tokenType":"Bearer"}}
```

**실패 예시**
```json
{"status":401,"code":"INVALID_TOKEN","message":"유효하지 않은 리프레시 토큰입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### POST `/v1/auth/logout`

**API 개요:** 리프레시 토큰과 연결된 현재 기기 세션을 로그아웃한다. 인증은 필요 없다.

**Request:** JSON body의 `refreshToken` 필수, 최대 512자다.
```json
{"refreshToken": "example"}
```

**Response:** 처리 완료 여부 `Boolean`을 반환한다.

**설명:** 토큰을 폐기하고 연결 기기를 비활성화한다. 이미 폐기되거나 없는 토큰에 대한
반복 요청도 성공하는 멱등 API다.

**성공 예시**
```json
{"data":true}
```

**실패 예시**
```json
{"status":400,"code":"VALIDATION_ERROR","message":"refreshToken은 필수입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/auth/nicknames/suggestions`

**API 개요:** 요청 시점에 활성 회원과 겹치지 않는 닉네임 후보를 추천한다. 인증은 필요 없다.

**Request:** Query `count`는 선택값이며 기본 5, 범위 1~10이다. Body는 없다.

**Response:** `items: String[]`를 반환하며 결과가 없으면 빈 배열이다.

**설명:** 추천값은 즉시 사용을 보장하는 예약값이 아니다. 최종 중복은 가입 시 DB UNIQUE로 다시 확인한다.

**성공 예시**
```json
{"data":{"items":["검은장미7","BlueLine21"]}}
```

**실패 예시**
```json
{"status":400,"code":"VALIDATION_ERROR","message":"count는 10 이하여야 합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/auth/nicknames/availability`

**API 개요:** 닉네임 형식과 활성 회원 중복 여부를 확인한다. 인증은 필요 없다.

**Request:** Query `nickname` 필수. 한글·영문·숫자만 허용하며 2~20자, 영문 대소문자를 구분한다.

**Response:** 확인한 `nickname`과 `available`을 반환한다.

**설명:** 탈퇴해 소프트 삭제된 회원의 닉네임은 재사용할 수 있다.

**성공 예시**
```json
{"data":{"nickname":"BlackRose1","available":true}}
```

**실패 예시**
```json
{"status":400,"code":"VALIDATION_ERROR","message":"nickname 형식이 올바르지 않습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/auth/phones/availability`

**API 개요:** 전화번호 가입 여부와 기존 계정의 OAuth provider를 확인한다. 인증은 필요 없다.

**Request:** Query `phoneNumber` 필수, 최대 30자다. 하이픈과 공백을 허용한다.

**Response:** `normalizedPhoneNumber`, `available`, `provider`를 반환한다. 미가입이면
`provider=null`, 가입 상태면 `GOOGLE|KAKAO`다.

**설명:** 번호를 E.164로 정규화해 DB를 조회한다. 탈퇴 회원 번호는 재사용할 수 있으나
정지·강퇴 계정의 번호는 사용 불가다.

**성공 예시**
```json
{"data":{"normalizedPhoneNumber":"+821012345678","available":false,"provider":"KAKAO"}}
```

**실패 예시**
```json
{"status":400,"code":"VALIDATION_ERROR","message":"한국 휴대폰 번호 형식이 아닙니다.","timestamp":"2026-08-01T10:00:00Z"}
```

## 19.2 타투이스트

### GET `/v1/artists`

**API 개요:** 인증된 타투이스트 목록과 각 타투이스트의 최신 게시물 최대 6개를 조회한다. 인증은 필요 없다.

**Request:** Query `cursor` 선택, `size` 기본 20·범위 1~50, `city` 선택·최대 100자다.

**Response:** 커서 페이지의 각 항목은 `userSeq`, `nickname`, 프로필 이미지 seq·URL,
숍 정보, `verificationStatus`, `followerCount`, `posts`, `regDttm`을 갖는다. `posts`는
`postSeq`, 첫 이미지 `imageUrl`, `likeCount`만 포함한다.

**설명:** `ARTIST+VERIFIED+ACTIVE`만 노출한다. city는 저장값과 정확히 일치하고,
팔로워 수·userSeq 내림차순으로 정렬한다. 모든 이미지 URL은 요청 시 생성한다.

**성공 예시**
```json
{"data":{"items":[{"userSeq":102,"nickname":"InkKim","profileImageSeq":301,"profileImageUrl":"https://minio.example/profile?X-Amz-Signature=...","shopName":"스타투숍","shopCity":"서울","shopAddress":"서울 강남구","shopPhone":"02-1234-5678","shopDetails":"예약제","verificationStatus":"VERIFIED","followerCount":120,"posts":[{"postSeq":2001,"imageUrl":"https://minio.example/post?X-Amz-Signature=...","likeCount":15}],"regDttm":"2026-07-01T09:00:00Z"}],"nextCursor":null,"hasNext":false,"size":1}}
```

**실패 예시**
```json
{"status":400,"code":"INVALID_CURSOR","message":"유효하지 않은 커서입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PATCH `/v1/artists/me/profile`

**API 개요:** ARTIST 회원이 가입 시 생성된 숍 프로필을 수정한다. Bearer 인증이 필요하다.

**Request:** JSON body. 모든 필드는 선택값이며 `shopName`·`shopCity` 최대 100자,
`shopAddress` 최대 255자, `shopPhone` 최대 30자, `shopDetails` 최대 2000자다.
```json
{"shopName":"스타투숍","shopCity":"서울","shopAddress":"서울 강남구","shopPhone":"02-1234-5678","shopDetails":"예약제"}
```

**Response:** 수정된 `ArtistProfile`을 반환한다. `verificationStatus`와 `role`은 바뀌지 않는다.

**설명:** USER 역할이거나 artists 행이 없으면 수정할 수 없다. 별도 숍 엔티티는 생성하지 않는다.

**성공 예시**
```json
{"data":{"userSeq":102,"nickname":"InkKim","profileImageSeq":301,"profileImageUrl":"https://minio.example/profile?X-Amz-Signature=...","shopName":"스타투숍","shopCity":"서울","shopAddress":"서울 강남구","shopPhone":"02-1234-5678","shopDetails":"예약제","verificationStatus":"UNVERIFIED","followerCount":0,"regDttm":"2026-08-01T09:00:00Z"}}
```

**실패 예시**
```json
{"status":403,"code":"FORBIDDEN","message":"ARTIST 역할이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

## 19.3 컬렉션과 보관함

### POST `/v1/collections`

**API 개요:** 회원 소유 타투 이미지를 분석하여 신체 배치 컬렉션으로 등록한다. Bearer 인증이 필요하다.

**Request:** JSON body. `imageSeq`, `bodyView`(최대 10자), `positionX/Y`(0~1),
`scaleRatio`(0 초과), `rotationDegree`(-180~180), `flipped`가 모두 필수다.
```json
{"imageSeq":201,"bodyView":"front","positionX":0.42,"positionY":0.35,"scaleRatio":0.8,"rotationDegree":-15,"flipped":false}
```

**Response:** `collectionSeq`, `ownerSeq`, `tattooSeq`, 원본 `imageSeq`·`imageUrl`,
배치 필드와 `regDttm`을 반환한다.

**설명:** 모델 호출은 DB 트랜잭션 밖에서 동기로 완료한다. 비타투 이미지는 거부하며,
성공 후 타투·subject·컬렉션·취향 점수를 한 트랜잭션으로 저장한다.

**성공 예시**
```json
{"data":{"collectionSeq":701,"ownerSeq":101,"tattooSeq":501,"imageSeq":201,"imageUrl":"https://minio.example/image?X-Amz-Signature=...","bodyView":"front","positionX":0.42,"positionY":0.35,"scaleRatio":0.8,"rotationDegree":-15.0,"flipped":false,"regDttm":"2026-08-01T10:00:00Z"}}
```

**실패 예시**
```json
{"status":422,"code":"NOT_TATTOO_IMAGE","message":"타투 이미지가 아닙니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/collections`

**API 개요:** 내 활성 타투 컬렉션을 조회한다. Bearer 인증이 필요하다.

**Request:** Query `cursor`는 마지막 `collectionSeq`, `size`는 기본 20·범위 1~50이다.

**Response:** `CollectionResponse` 커서 페이지를 반환한다.

**설명:** `USER_COLLECTION`이며 소프트 삭제되지 않은 항목만 collectionSeq 내림차순으로 반환한다.

**성공 예시**
```json
{"data":{"items":[{"collectionSeq":701,"ownerSeq":101,"tattooSeq":501,"imageSeq":201,"imageUrl":"https://minio.example/image?X-Amz-Signature=...","bodyView":"front","positionX":0.42,"positionY":0.35,"scaleRatio":0.8,"rotationDegree":-15.0,"flipped":false,"regDttm":"2026-08-01T10:00:00Z"}],"nextCursor":null,"hasNext":false,"size":1}}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/users/{userSeq}/collections`

**API 개요:** 공개 가능한 다른 회원의 활성 컬렉션을 조회한다. 인증은 선택이다.

**Request:** Path `userSeq` 필수. Query `cursor` 선택, `size` 기본 20·범위 1~50이다.

**Response:** `CollectionResponse` 커서 페이지를 반환한다.

**설명:** ACTIVE 비삭제 USER·ARTIST만 대상이다. 로그인 조회자와 양방향 차단 관계면 404다.

**성공 예시**
```json
{"data":{"items":[],"nextCursor":null,"hasNext":false,"size":0}}
```

**실패 예시**
```json
{"status":404,"code":"USER_NOT_FOUND","message":"회원을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/collections/{collectionSeq}`

**API 개요:** 내 컬렉션과 컬렉션 전용 타투를 소프트 삭제한다. Bearer 인증이 필요하다.

**Request:** Path `collectionSeq` 필수. Body는 없다.

**Response:** 삭제 완료 여부 `Boolean`을 반환한다.

**설명:** 원본 image 행과 MinIO 객체는 유지한다. 등록 당시 취향 점수도 역보정하지 않는다.

**성공 예시**
```json
{"data":true}
```

**실패 예시**
```json
{"status":404,"code":"RESOURCE_NOT_FOUND","message":"컬렉션을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/archive`

**API 개요:** 내 타투 도안 보관함을 조회한다. Bearer 인증이 필요하다.

**Request:** Query `cursor` 선택, `size` 기본 20·범위 1~50이다. 커서는 보관 시각과 tattooSeq 복합값이다.

**Response:** 각 항목은 `tattooSeq`, `designImageSeq`, `designImageUrl`, `archivedDttm`만 포함한다.

**설명:** 보관 시각·tattooSeq 내림차순이며 활성 tattoo, tattoo_design, image만 반환한다.

**성공 예시**
```json
{"data":{"items":[{"tattooSeq":501,"designImageSeq":301,"designImageUrl":"https://minio.example/design?X-Amz-Signature=...","archivedDttm":"2026-08-01T09:30:00Z"}],"nextCursor":null,"hasNext":false,"size":1}}
```

**실패 예시**
```json
{"status":400,"code":"INVALID_CURSOR","message":"유효하지 않은 커서입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PUT `/v1/archive/{tattooSeq}`

**API 개요:** 공개 타투 도안을 내 보관함에 설정한다. Bearer 인증이 필요하다.

**Request:** Path `tattooSeq` 필수. Body는 없다.

**Response:** 최종 상태 `enabled=true`를 반환한다.

**설명:** 멱등 INSERT이며 실제 신규 보관일 때만 취향 점수를 가산한다.

**성공 예시**
```json
{"data":{"enabled":true}}
```

**실패 예시**
```json
{"status":404,"code":"TATTOO_NOT_FOUND","message":"보관할 타투 도안을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/archive/{tattooSeq}`

**API 개요:** 타투 도안을 내 보관함에서 해제한다. Bearer 인증이 필요하다.

**Request:** Path `tattooSeq` 필수. Body는 없다.

**Response:** 최종 상태 `enabled=false`를 반환한다.

**설명:** 관계가 없어도 성공한다. 기존 취향 점수는 행동 이력으로 유지한다.

**성공 예시**
```json
{"data":{"enabled":false}}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

## 19.4 사용자

### GET `/v1/users/me`

**API 개요:** 로그인한 회원의 계정·프로필 전체 정보를 조회한다. Bearer 인증이 필요하다.

**Request:** Header의 Bearer token 외 Path, Query, Body는 없다.

**Response:** `userSeq`, `nickname`, 전화번호·인증시각, 프로필 이미지 seq·URL,
`birthDate`, `gender`, `role`, `accountStatus`, 선택 `artistProfile`, `regDttm`을 반환한다.

**설명:** ARTIST이고 확장 행이 있으면 숍 이름과 verificationStatus를 포함한다. URL은 object key로 생성한다.

**성공 예시**
```json
{"data":{"userSeq":101,"nickname":"BlackRose1","phoneNumber":"+821012345678","phoneVerifiedDttm":"2026-07-01T09:00:00Z","profileImageSeq":301,"profileImageUrl":"https://minio.example/profile?X-Amz-Signature=...","birthDate":"1998-05-21","gender":"F","role":"ARTIST","accountStatus":"ACTIVE","artistProfile":{"shopName":"스타투숍","verificationStatus":"UNVERIFIED"},"regDttm":"2026-07-01T09:00:00Z"}}
```

**실패 예시**
```json
{"status":401,"code":"TOKEN_EXPIRED","message":"Access Token이 만료되었습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PATCH `/v1/users/me`

**API 개요:** 내 닉네임·생년월일·성별을 수정한다. Bearer 인증이 필요하다.

**Request:** JSON body. `nickname` 필수·한글/영문/숫자 2~20자, `birthDate` 선택,
`gender`는 선택 `M|F`다.
```json
{"nickname":"BlackRose2","birthDate":"1998-05-21","gender":"F"}
```

**Response:** 수정 후 `MyProfile` 전체를 반환한다.

**설명:** 닉네임 중복을 DB에서 확인하고 커밋 후 검색 인덱스를 갱신한다. 프로필 이미지는 별도 API를 사용한다.

**성공 예시**
```json
{"data":{"userSeq":101,"nickname":"BlackRose2","phoneNumber":"+821012345678","phoneVerifiedDttm":"2026-07-01T09:00:00Z","profileImageSeq":null,"profileImageUrl":null,"birthDate":"1998-05-21","gender":"F","role":"USER","accountStatus":"ACTIVE","artistProfile":null,"regDttm":"2026-07-01T09:00:00Z"}}
```

**실패 예시**
```json
{"status":409,"code":"DUPLICATE_NICKNAME","message":"이미 사용 중인 닉네임입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PATCH `/v1/users/me/profile-image`

**API 개요:** 내 프로필 이미지를 업로드 완료된 이미지로 교체한다. Bearer 인증이 필요하다.

**Request:** JSON body의 `imageSeq` 필수다.
```json
{"imageSeq":302}
```

**Response:** 교체 후 `MyProfile` 전체를 반환한다.

**설명:** 현재 회원이 `PROFILE` 목적으로 올린 활성 이미지만 사용할 수 있다. 이전 이미지와 객체는 즉시 삭제하지 않는다.

**성공 예시**
```json
{"data":{"userSeq":101,"nickname":"BlackRose1","phoneNumber":"+821012345678","phoneVerifiedDttm":"2026-07-01T09:00:00Z","profileImageSeq":302,"profileImageUrl":"https://minio.example/profile302?X-Amz-Signature=...","birthDate":null,"gender":null,"role":"USER","accountStatus":"ACTIVE","artistProfile":null,"regDttm":"2026-07-01T09:00:00Z"}}
```

**실패 예시**
```json
{"status":404,"code":"IMAGE_NOT_FOUND","message":"사용 가능한 프로필 이미지를 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/users/me`

**API 개요:** 현재 계정을 탈퇴 상태로 전환한다. Bearer 인증이 필요하다.

**Request:** 별도 Path, Query, Body는 없다.

**Response:** 완료 여부 `Boolean`을 반환한다.

**설명:** 계정을 물리 삭제하지 않고 WITHDRAWN으로 변경하며 모든 리프레시 토큰과 기기를 비활성화한다.

**성공 예시**
```json
{"data":true}
```

**실패 예시**
```json
{"status":409,"code":"STATE_CONFLICT","message":"이미 탈퇴한 계정입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/users/{userSeq}`

**API 개요:** 공개 가능한 회원 프로필을 조회한다. 인증은 선택이다.

**Request:** Path `userSeq` 필수. Body는 없다.

**Response:** `userSeq`, `nickname`, 프로필 이미지, `role`, follower/following 수,
`followedByMe`, 선택 `artistProfile`을 반환한다.

**설명:** ADMIN·비활성 회원과 차단 관계는 404로 숨긴다. VERIFIED 아티스트 정보만 공개한다.

**성공 예시**
```json
{"data":{"userSeq":102,"nickname":"InkKim","profileImageSeq":301,"profileImageUrl":"https://minio.example/profile?X-Amz-Signature=...","role":"ARTIST","followerCount":120,"followingCount":30,"followedByMe":true,"artistProfile":{"shopName":"스타투숍","verificationStatus":"VERIFIED"}}}
```

**실패 예시**
```json
{"status":404,"code":"USER_NOT_FOUND","message":"회원을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PUT `/v1/users/{userSeq}/follow`

**API 개요:** 대상 회원 팔로우를 설정한다. Bearer 인증이 필요하다.

**Request:** Path `userSeq` 필수. Body는 없다.

**Response:** `enabled=true`를 반환한다.

**설명:** 멱등 INSERT다. 자기 자신·ADMIN·비활성·차단 회원은 불가하며 팔로우 알림은 생성하지 않는다.

**성공 예시**
```json
{"data":{"enabled":true}}
```

**실패 예시**
```json
{"status":403,"code":"FORBIDDEN","message":"팔로우할 수 없는 회원입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/users/{userSeq}/follow`

**API 개요:** 대상 회원 팔로우를 해제한다. Bearer 인증이 필요하다.

**Request:** Path `userSeq` 필수. Body는 없다.

**Response:** `enabled=false`를 반환한다.

**설명:** 관계가 없어도 성공하는 멱등 DELETE다.

**성공 예시**
```json
{"data":{"enabled":false}}
```

**실패 예시**
```json
{"status":404,"code":"USER_NOT_FOUND","message":"대상 회원을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PUT `/v1/users/{userSeq}/block`

**API 개요:** 대상 회원을 차단한다. Bearer 인증이 필요하다.

**Request:** Path `userSeq` 필수. Body는 없다.

**Response:** `enabled=true`를 반환한다.

**설명:** 차단 관계를 멱등 생성하고 양방향 팔로우 관계를 같은 트랜잭션에서 삭제한다.

**성공 예시**
```json
{"data":{"enabled":true}}
```

**실패 예시**
```json
{"status":403,"code":"FORBIDDEN","message":"자기 자신을 차단할 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/users/{userSeq}/block`

**API 개요:** 대상 회원 차단을 해제한다. Bearer 인증이 필요하다.

**Request:** Path `userSeq` 필수. Body는 없다.

**Response:** `enabled=false`를 반환한다.

**설명:** 과거 팔로우 관계는 복원하지 않으며 관계가 없어도 성공한다.

**성공 예시**
```json
{"data":{"enabled":false}}
```

**실패 예시**
```json
{"status":404,"code":"USER_NOT_FOUND","message":"대상 회원을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/users/{userSeq}/followers`

**API 개요:** 대상 회원의 팔로워 목록을 조회한다. 인증은 선택이다.

**Request:** Path `userSeq`, Query `cursor` 선택, `size` 기본 20·범위 1~50이다.

**Response:** `RelationUser` 커서 페이지. 항목은 회원 seq·닉네임·역할·프로필 이미지·`followedByMe`다.

**설명:** 관계 생성 시각 내림차순이며 비활성·삭제·ADMIN 회원은 제외한다.

**성공 예시**
```json
{"data":{"items":[{"userSeq":103,"nickname":"LineArt","role":"USER","profileImageSeq":null,"profileImageUrl":null,"followedByMe":false}],"nextCursor":null,"hasNext":false,"size":1}}
```

**실패 예시**
```json
{"status":400,"code":"INVALID_CURSOR","message":"유효하지 않은 커서입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/users/{userSeq}/following`

**API 개요:** 대상 회원의 팔로잉 목록을 조회한다. 인증은 선택이다.

**Request:** Path `userSeq`, Query `cursor` 선택, `size` 기본 20·범위 1~50이다.

**Response:** `RelationUser` 커서 페이지를 반환한다.

**설명:** 공개 가능 여부와 차단 관계를 검사하고 로그인 조회자의 followedByMe를 계산한다.

**성공 예시**
```json
{"data":{"items":[],"nextCursor":null,"hasNext":false,"size":0}}
```

**실패 예시**
```json
{"status":404,"code":"USER_NOT_FOUND","message":"회원을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/users/me/blocks`

**API 개요:** 내가 차단한 회원 목록을 조회한다. Bearer 인증이 필요하다.

**Request:** Query `cursor` 선택, `size` 기본 20·범위 1~50이다.

**Response:** `RelationUser` 커서 페이지를 반환한다.

**설명:** 차단 생성 시각 내림차순이며 비활성·삭제·ADMIN 회원은 제외한다.

**성공 예시**
```json
{"data":{"items":[],"nextCursor":null,"hasNext":false,"size":0}}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/users/me/recent-searches`

**API 개요:** 내 최근 검색어 최대 10개를 조회한다. Bearer 인증이 필요하다.

**Request:** 별도 Path, Query, Body는 없다.

**Response:** 최신순 `String[]`를 반환하며 비어 있으면 `[]`다.

**설명:** Redis 우선 조회 후 DB 배열로 복원·폴백한다. Redis 장애 시 DB 반영 주기만큼 오래된 값일 수 있다.

**성공 예시**
```json
{"data":["장미","블랙워크"]}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PATCH `/v1/users/me/recent-searches`

**API 개요:** 최근 검색어를 추가하거나 한 건 제거한다. Bearer 인증이 필요하다.

**Request:** JSON body. `operation`은 `ADD|REMOVE`, `term`은 필수·최대 100자이며 제어문자를 허용하지 않는다.
```json
{"operation":"ADD","term":"검은 장미"}
```

**Response:** 변경 후 최신순 `String[]`를 반환한다.

**설명:** ADD는 중복을 제거해 맨 앞에 넣고 최대 10개로 자른다. Redis 장애 시 변경 유실 방지를 위해 503이다.

**성공 예시**
```json
{"data":["검은 장미","장미"]}
```

**실패 예시**
```json
{"status":503,"code":"SERVICE_UNAVAILABLE","message":"최근 검색어 저장소를 사용할 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

## 19.5 댓글

### POST `/v1/posts/{postSeq}/comments`

**API 개요:** 게시물에 최상위 댓글 또는 1단계 답글을 작성한다. Bearer 인증이 필요하다.

**Request:** Path `postSeq`. JSON body의 `content`는 필수·최대 1000자,
`parentCommentSeq`는 최상위 댓글이면 null, 답글이면 최상위 댓글 seq다.
```json
{"parentCommentSeq":501,"content":"색감이 정말 좋네요."}
```

**Response:** `commentSeq`, `postSeq`, 작성자, 부모 seq, 내용, like/reply count,
`likedByMe`, `deleted`, 등록·수정시각을 반환한다.

**설명:** 답글의 답글은 허용하지 않는다. 댓글 저장과 post.commentCount 증가는 한 트랜잭션이며 알림은 없다.

**성공 예시**
```json
{"data":{"commentSeq":502,"postSeq":2001,"author":{"userSeq":101,"nickname":"BlackRose1","profileImageSeq":null,"profileImageUrl":null},"parentCommentSeq":501,"content":"색감이 정말 좋네요.","likeCount":0,"replyCount":0,"likedByMe":false,"deleted":false,"regDttm":"2026-08-01T10:00:00Z","modDttm":"2026-08-01T10:00:00Z"}}
```

**실패 예시**
```json
{"status":400,"code":"INVALID_REQUEST","message":"답글에 다시 답글을 작성할 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/posts/{postSeq}/comments`

**API 개요:** 게시물의 활성 최상위 댓글 목록을 조회한다. 인증은 선택이다.

**Request:** Path `postSeq`, Query `cursor` 선택, `size` 기본 30·범위 1~100이다.

**Response:** `CommentResponse` 커서 페이지이며 각 항목에 활성 `replyCount`를 포함한다.

**설명:** commentSeq 오름차순이다. 로그인 시 likedByMe를 계산하고 삭제 댓글은 반환하지 않는다.

**성공 예시**
```json
{"data":{"items":[{"commentSeq":501,"postSeq":2001,"author":{"userSeq":102,"nickname":"InkKim","profileImageSeq":301,"profileImageUrl":"https://minio.example/profile?X-Amz-Signature=..."},"parentCommentSeq":null,"content":"감사합니다.","likeCount":2,"replyCount":1,"likedByMe":false,"deleted":false,"regDttm":"2026-08-01T09:00:00Z","modDttm":"2026-08-01T09:00:00Z"}],"nextCursor":null,"hasNext":false,"size":1}}
```

**실패 예시**
```json
{"status":404,"code":"POST_NOT_FOUND","message":"게시글을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/comments/{commentSeq}/replies`

**API 개요:** 활성 최상위 댓글의 1단계 답글 목록을 조회한다. 인증은 선택이다.

**Request:** Path `commentSeq`, Query `cursor` 선택, `size` 기본 30·범위 1~100이다.

**Response:** `CommentResponse` 커서 페이지이며 답글 `replyCount`는 항상 0이다.

**설명:** commentSeq 오름차순이며 삭제·숨김·답글 자체를 부모로 요청하면 조회할 수 없다.

**성공 예시**
```json
{"data":{"items":[],"nextCursor":null,"hasNext":false,"size":0}}
```

**실패 예시**
```json
{"status":404,"code":"COMMENT_NOT_FOUND","message":"댓글을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/comments/{commentSeq}`

**API 개요:** 내가 작성한 댓글을 소프트 삭제한다. Bearer 인증이 필요하다.

**Request:** Path `commentSeq` 필수. Body는 없다.

**Response:** 완료 여부 `Boolean`을 반환한다.

**설명:** 답글은 한 건, 최상위 댓글은 활성 답글까지 삭제한다. 실제 삭제 행 수만큼 commentCount를 감소시킨다.

**성공 예시**
```json
{"data":true}
```

**실패 예시**
```json
{"status":403,"code":"FORBIDDEN","message":"댓글 작성자만 삭제할 수 있습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PUT `/v1/comments/{commentSeq}/like`

**API 개요:** 댓글 좋아요를 설정한다. Bearer 인증이 필요하다.

**Request:** Path `commentSeq` 필수. Body는 없다.

**Response:** `enabled=true`를 반환한다.

**설명:** 멱등 INSERT이며 실제 생성 시에만 likeCount를 +1 한다. 알림은 생성하지 않는다.

**성공 예시**
```json
{"data":{"enabled":true}}
```

**실패 예시**
```json
{"status":404,"code":"COMMENT_NOT_FOUND","message":"댓글을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/comments/{commentSeq}/like`

**API 개요:** 댓글 좋아요를 해제한다. Bearer 인증이 필요하다.

**Request:** Path `commentSeq` 필수. Body는 없다.

**Response:** `enabled=false`를 반환한다.

**설명:** 멱등 DELETE이며 실제 삭제 시에만 likeCount를 -1 한다.

**성공 예시**
```json
{"data":{"enabled":false}}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

## 19.6 게시글

게시글 응답의 `author`는 회원 seq·닉네임·role·프로필 이미지, `images`는
`postImageSeq`, `imageSeq`, Presigned `imageUrl`, 선택 `tattooSeq`, `displayOrder`를 갖는다.

### POST `/v1/posts`

**API 개요:** 이미지 1~10개와 선택 본문으로 게시글을 작성한다. Bearer 인증이 필요하다.

**Request:** JSON body. `content` 선택·최대 3000자, `imageSeqs` 필수·1~10개이며 null과 중복을 허용하지 않는다.
```json
{"content":"새로운 장미 작업입니다.","imageSeqs":[101,102]}
```

**Response:** `postSeq`, author, content, like/comment count, images, `likedByMe`,
`bookmarkedByMe`, 등록·수정 시각을 포함한 `PostResponse`다.

**설명:** 모든 이미지의 타투 여부를 트랜잭션 밖에서 동기 판별한다. 비타투도 게시 가능하며
타투 이미지만 분석·tattoos 저장한다. 모델 오류 시 DB 저장 전에 요청 전체가 실패한다.

**성공 예시**
```json
{"data":{"postSeq":2001,"author":{"userSeq":101,"nickname":"BlackRose1","role":"USER","profileImageSeq":null,"profileImageUrl":null},"content":"새로운 장미 작업입니다.","likeCount":0,"commentCount":0,"images":[{"postImageSeq":4001,"imageSeq":101,"imageUrl":"https://minio.example/post101?X-Amz-Signature=...","tattooSeq":501,"displayOrder":1},{"postImageSeq":4002,"imageSeq":102,"imageUrl":"https://minio.example/post102?X-Amz-Signature=...","tattooSeq":null,"displayOrder":2}],"likedByMe":false,"bookmarkedByMe":false,"regDttm":"2026-08-01T10:00:00Z","modDttm":"2026-08-01T10:00:00Z"}}
```

**실패 예시**
```json
{"status":502,"code":"UPSTREAM_SERVICE_ERROR","message":"타투 판별 모델 처리에 실패했습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/posts`

**API 개요:** 공개 게시글 피드를 조회한다. 인증은 선택이다.

**Request:** Query `cursor`는 마지막 postSeq, `size` 기본 20·범위 1~50이다.

**Response:** `PostResponse` 커서 페이지를 반환한다.

**설명:** PUBLISHED 활성 게시글을 postSeq 내림차순으로 반환한다. 로그인 시 차단·관심 없음 항목을 제외한다.

**성공 예시**
```json
{"data":{"items":[],"nextCursor":null,"hasNext":false,"size":0}}
```

**실패 예시**
```json
{"status":400,"code":"VALIDATION_ERROR","message":"size는 50 이하여야 합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/posts/me`

**API 개요:** 내 공개 게시글 목록을 조회한다. Bearer 인증이 필요하다.

**Request:** Query `cursor` 선택, `size` 기본 20·범위 1~50이다.

**Response:** 내 `PostResponse` 커서 페이지를 반환한다.

**설명:** 현재 회원 authorSeq 조건과 일반 PUBLISHED 노출 조건을 함께 적용한다.

**성공 예시**
```json
{"data":{"items":[],"nextCursor":null,"hasNext":false,"size":0}}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/posts/bookmarked`

**API 개요:** 내가 북마크한 공개 게시글을 조회한다. Bearer 인증이 필요하다.

**Request:** Query `cursor` 선택, `size` 기본 20·범위 1~50이다. 커서는 북마크 시각·postSeq 복합값이다.

**Response:** `PostResponse` 커서 페이지를 반환한다.

**설명:** 북마크 시각·postSeq 내림차순이며 삭제·차단·관심 없음 게시글을 제외한다.

**성공 예시**
```json
{"data":{"items":[],"nextCursor":null,"hasNext":false,"size":0}}
```

**실패 예시**
```json
{"status":400,"code":"INVALID_CURSOR","message":"유효하지 않은 커서입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/posts/following`

**API 개요:** 내가 팔로우한 회원의 공개 게시글을 조회한다. Bearer 인증이 필요하다.

**Request:** Query `cursor` 선택, `size` 기본 20·범위 1~50이다.

**Response:** `PostResponse` 커서 페이지를 반환한다.

**설명:** 팔로잉 관계를 조인하고 차단·관심 없음 게시글을 제외한 뒤 postSeq 내림차순으로 반환한다.

**성공 예시**
```json
{"data":{"items":[],"nextCursor":null,"hasNext":false,"size":0}}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/users/{userSeq}/posts`

**API 개요:** 공개 가능한 회원의 게시글 목록을 조회한다. 인증은 선택이다.

**Request:** Path `userSeq`, Query `cursor` 선택, `size` 기본 20·범위 1~50이다.

**Response:** 해당 회원의 `PostResponse` 커서 페이지를 반환한다.

**설명:** 대상은 ACTIVE USER·ARTIST여야 하며 ADMIN·비활성·차단 관계는 404로 숨긴다.

**성공 예시**
```json
{"data":{"items":[],"nextCursor":null,"hasNext":false,"size":0}}
```

**실패 예시**
```json
{"status":404,"code":"USER_NOT_FOUND","message":"회원을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/posts/{postSeq}`

**API 개요:** 공개 게시글 한 건을 조회한다. 인증은 선택이다.

**Request:** Path `postSeq` 필수. Body는 없다.

**Response:** `PostResponse` 한 건을 반환한다.

**설명:** PUBLISHED 활성 게시글만 제공한다. 로그인 회원의 차단·관심 없음 상태도 확인한다.

**성공 예시**
```json
{"data":{"postSeq":2001,"author":{"userSeq":102,"nickname":"InkKim","role":"ARTIST","profileImageSeq":301,"profileImageUrl":"https://minio.example/profile?X-Amz-Signature=..."},"content":"장미 작업","likeCount":15,"commentCount":3,"images":[],"likedByMe":true,"bookmarkedByMe":false,"regDttm":"2026-07-31T10:00:00Z","modDttm":"2026-07-31T10:00:00Z"}}
```

**실패 예시**
```json
{"status":404,"code":"POST_NOT_FOUND","message":"게시글을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PATCH `/v1/posts/{postSeq}`

**API 개요:** 내가 작성한 게시글의 본문만 수정한다. Bearer 인증이 필요하다.

**Request:** Path `postSeq`. JSON body의 `content`는 선택·최대 3000자다.
```json
{"content":"수정한 작업 설명입니다."}
```

**Response:** 수정된 `PostResponse`를 반환한다.

**설명:** 이미지와 like/comment/report count는 수정하지 않는 명시적 부분 UPDATE다.

**성공 예시**
```json
{"data":{"postSeq":2001,"author":{"userSeq":101,"nickname":"BlackRose1","role":"USER","profileImageSeq":null,"profileImageUrl":null},"content":"수정한 작업 설명입니다.","likeCount":15,"commentCount":3,"images":[],"likedByMe":false,"bookmarkedByMe":false,"regDttm":"2026-07-31T10:00:00Z","modDttm":"2026-08-01T10:00:00Z"}}
```

**실패 예시**
```json
{"status":403,"code":"FORBIDDEN","message":"게시글 작성자만 수정할 수 있습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/posts/{postSeq}`

**API 개요:** 내가 작성한 게시글을 소프트 삭제한다. Bearer 인증이 필요하다.

**Request:** Path `postSeq` 필수. Body는 없다.

**Response:** 완료 여부 `Boolean`을 반환한다.

**설명:** 상태를 DELETED로 바꾸고 isDeleted를 함께 설정한다. 이미지·타투·MinIO 객체는 즉시 삭제하지 않는다.

**성공 예시**
```json
{"data":true}
```

**실패 예시**
```json
{"status":403,"code":"FORBIDDEN","message":"게시글 작성자만 삭제할 수 있습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PUT `/v1/posts/{postSeq}/like`

**API 개요:** 게시글 좋아요를 설정한다. Bearer 인증이 필요하다.

**Request:** Path `postSeq` 필수. Body는 없다.

**Response:** `enabled=true`를 반환한다.

**설명:** 실제 신규 관계일 때만 likeCount와 취향 점수를 가산한다. 서비스 알림은 생성하지 않는다.

**성공 예시**
```json
{"data":{"enabled":true}}
```

**실패 예시**
```json
{"status":404,"code":"POST_NOT_FOUND","message":"게시글을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/posts/{postSeq}/like`

**API 개요:** 게시글 좋아요를 해제한다. Bearer 인증이 필요하다.

**Request:** Path `postSeq` 필수. Body는 없다.

**Response:** `enabled=false`를 반환한다.

**설명:** 실제 관계 삭제 시 likeCount만 -1 하며 과거 취향 점수는 역보정하지 않는다.

**성공 예시**
```json
{"data":{"enabled":false}}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PUT `/v1/posts/{postSeq}/bookmark`

**API 개요:** 게시글 북마크를 설정한다. Bearer 인증이 필요하다.

**Request:** Path `postSeq` 필수. Body는 없다.

**Response:** `enabled=true`를 반환한다.

**설명:** 실제 신규 북마크일 때만 주 스타일·색상 취향 점수를 가산한다.

**성공 예시**
```json
{"data":{"enabled":true}}
```

**실패 예시**
```json
{"status":404,"code":"POST_NOT_FOUND","message":"게시글을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/posts/{postSeq}/bookmark`

**API 개요:** 게시글 북마크를 해제한다. Bearer 인증이 필요하다.

**Request:** Path `postSeq` 필수. Body는 없다.

**Response:** `enabled=false`를 반환한다.

**설명:** 관계만 제거하고 기존 취향 점수는 역보정하지 않는다.

**성공 예시**
```json
{"data":{"enabled":false}}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PUT `/v1/posts/{postSeq}/not-interested`

**API 개요:** 게시글을 관심 없음으로 설정해 개인 피드에서 숨긴다. Bearer 인증이 필요하다.

**Request:** Path `postSeq` 필수. Body는 없다.

**Response:** `enabled=true`를 반환한다.

**설명:** 실제 신규 숨김일 때만 취향 점수를 감점한다.

**성공 예시**
```json
{"data":{"enabled":true}}
```

**실패 예시**
```json
{"status":404,"code":"POST_NOT_FOUND","message":"게시글을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/posts/{postSeq}/not-interested`

**API 개요:** 게시글 관심 없음 설정을 해제한다. Bearer 인증이 필요하다.

**Request:** Path `postSeq` 필수. Body는 없다.

**Response:** `enabled=false`를 반환한다.

**설명:** 개인 숨김 관계만 제거하고 기존 취향 감점은 역보정하지 않는다.

**성공 예시**
```json
{"data":{"enabled":false}}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### POST `/v1/posts/{postSeq}/dwell`

**API 개요:** 게시글 체류시간을 구간화해 취향 점수에 반영한다. Bearer 인증이 필요하다.

**Request:** Path `postSeq`. JSON body `seconds` 필수, 0~3600 정수다.
```json
{"seconds":18}
```

**Response:** 처리 완료 여부 `Boolean`을 반환한다.

**설명:** 원본 체류 통계 행은 만들지 않고 설정된 시간 구간의 가중치만 누적한다.

**성공 예시**
```json
{"data":true}
```

**실패 예시**
```json
{"status":400,"code":"VALIDATION_ERROR","message":"seconds는 0 이상 3600 이하여야 합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### POST `/v1/posts/{postSeq}/reports`

**API 개요:** 게시글을 사유와 함께 신고한다. Bearer 인증이 필요하다.

**Request:** Path `postSeq`. JSON body `reasonCode` 필수·최대 30자,
`reasonDetail` 선택·최대 1000자다.
```json
{"reasonCode":"INAPPROPRIATE","reasonDetail":"타인의 작업물을 무단 도용했습니다."}
```

**Response:** 생성된 `reportSeq`와 `reportStatus=PENDING`을 반환한다.

**설명:** 회원 한 명은 게시글 하나에 한 번만 신고할 수 있다. 신고 생성과 reportCount 증가는 한 트랜잭션이다.

**성공 예시**
```json
{"data":{"reportSeq":9001,"reportStatus":"PENDING"}}
```

**실패 예시**
```json
{"status":409,"code":"DUPLICATE_RESOURCE","message":"이미 신고한 게시글입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

## 19.7 이미지·타투·분류

### POST `/v1/images/uploads/presign`

**API 개요:** MinIO 직접 업로드용 단기 Presigned PUT URL을 발급한다. Bearer 인증이 필요하다.

**Request:** JSON body. `purpose`는 `PROFILE|POST|DM|COLLECTION|EXTRACTION`,
`contentType`은 `image/jpeg|image/png|image/webp`, `originalFilename`은 필수·최대 150자,
`fileSize`는 양수다.
```json
{"purpose":"POST","contentType":"image/png","originalFilename":"rose.png","fileSize":1024000}
```

**Response:** 서버가 만든 `objectKey`, `uploadUrl`, 클라이언트가 PUT 시 보낼
`requiredHeaders`, `expiresInSeconds`를 반환한다.

**설명:** 이 단계에서는 images 행을 만들지 않는다. 클라이언트는 반환된 URL에 파일을 직접 PUT한다.

**성공 예시**
```json
{"data":{"objectKey":"users/101/post/uuid.png","uploadUrl":"https://minio.example/bucket/users/101/post/uuid.png?X-Amz-Signature=...","requiredHeaders":{"Content-Type":"image/png"},"expiresInSeconds":600}}
```

**실패 예시**
```json
{"status":413,"code":"FILE_TOO_LARGE","message":"허용된 이미지 크기를 초과했습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### POST `/v1/images/uploads/complete`

**API 개요:** MinIO 업로드 결과를 검증하고 images 행으로 등록한다. Bearer 인증이 필요하다.

**Request:** JSON body의 `objectKey` 필수·최대 512자이며 presign 응답값을 그대로 사용한다.
```json
{"objectKey":"users/101/post/uuid.png"}
```

**Response:** `imageSeq`, `objectKey`, 단기 `downloadUrl`, `regDttm`을 반환한다.

**설명:** object key 소유권·구조와 객체 존재·크기·Content-Type을 검증한 뒤 짧은 DB 트랜잭션으로 등록한다.

**성공 예시**
```json
{"data":{"imageSeq":301,"objectKey":"users/101/post/uuid.png","downloadUrl":"https://minio.example/bucket/users/101/post/uuid.png?X-Amz-Signature=...","regDttm":"2026-08-01T10:00:00Z"}}
```

**실패 예시**
```json
{"status":404,"code":"UPLOAD_OBJECT_NOT_FOUND","message":"업로드된 객체를 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/tattoo-designs`

**API 개요:** 보관 가능한 공개 타투 도안 목록을 조회한다. 인증은 선택이다.

**Request:** Query `cursor` 선택, `size` 기본 20·범위 1~50이다.

**Response:** 커서 페이지 항목은 `tattooSeq`, `designImageSeq`, Presigned
`designImageUrl`, `primaryStyle{code,name}`, 선택 `color{code,name}`, subject 이름 배열,
`archivedByMe`, `regDttm`을 갖는다.

**설명:** 활성 tattoo_designs·tattoos·images만 등록시각·tattooSeq 내림차순으로 반환한다.

**성공 예시**
```json
{"data":{"items":[{"tattooSeq":501,"designImageSeq":301,"designImageUrl":"https://minio.example/design?X-Amz-Signature=...","primaryStyle":{"code":"BLACKWORK","name":"블랙워크"},"color":{"code":"BLACK","name":"검정"},"subjects":["장미"],"archivedByMe":false,"regDttm":"2026-07-31T10:00:00Z"}],"nextCursor":null,"hasNext":false,"size":1}}
```

**실패 예시**
```json
{"status":400,"code":"INVALID_CURSOR","message":"유효하지 않은 커서입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/tattoos/{tattooSeq}`

**API 개요:** 분석 완료 타투의 분류·subject 정보를 조회한다. 인증은 선택이다.

**Request:** Path `tattooSeq` 필수. Body는 없다.

**Response:** 타투·등록자·원본 이미지 seq, `sourceType`, primary/secondary/rendering
분류 `{code,name}`, 선택 color, subject 이름 배열, 학습 사용 정보와 시각을 반환한다.

**설명:** 분류 seq는 노출하지 않고 기준정보를 조인한 코드와 표시명을 제공한다.

**성공 예시**
```json
{"data":{"tattooSeq":501,"registrantSeq":101,"imageSeq":301,"sourceType":"USER_POST","primaryStyle":{"code":"BLACKWORK","name":"블랙워크"},"secondaryStyles":[{"code":"LINE","name":"라인"}],"renderingStyles":[{"code":"REALISTIC","name":"리얼리스틱"}],"color":{"code":"BLACK","name":"검정"},"subjects":["장미"],"usedForTraining":false,"trainedDttm":null,"regDttm":"2026-07-31T10:00:00Z"}}
```

**실패 예시**
```json
{"status":404,"code":"TATTOO_NOT_FOUND","message":"타투를 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/tattoos/{tattooSeq}/image`

**API 개요:** 타투 원본 또는 가공 도안 이미지의 단기 URL을 발급한다. 인증은 선택이다.

**Request:** Path `tattooSeq`, Query `variant=ORIGINAL|DESIGN`이 필수다.

**Response:** 선택된 `imageSeq`, Presigned `downloadUrl`, `expiresAt`을 반환한다.

**설명:** ORIGINAL은 tattoos.imageSeq, DESIGN은 활성 tattoo_designs.imageSeq를 사용한다.

**성공 예시**
```json
{"data":{"imageSeq":301,"downloadUrl":"https://minio.example/design?X-Amz-Signature=...","expiresAt":"2026-08-01T11:00:00Z"}}
```

**실패 예시**
```json
{"status":404,"code":"IMAGE_NOT_FOUND","message":"요청한 디자인 이미지를 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/classifications/primary-styles`

**API 개요:** 활성 주 스타일 기준정보를 조회한다. 인증은 필요 없다.

**Request:** Path, Query, Body가 없다.

**Response:** seq 오름차순의 `{seq,code,name}[]`를 반환한다.

**설명:** 타투 분석과 취향 점수에 사용하는 현재 활성 항목만 제공한다.

**성공 예시**
```json
{"data":[{"seq":1,"code":"BLACKWORK","name":"블랙워크"}]}
```

**실패 예시**
```json
{"status":500,"code":"INTERNAL_SERVER_ERROR","message":"기준정보 조회에 실패했습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/classifications/secondary-styles`

**API 개요:** 활성 보조 스타일 기준정보를 조회한다. 인증은 필요 없다.

**Request:** Path, Query, Body가 없다.

**Response:** seq 오름차순의 `{seq,code,name}[]`를 반환한다.

**설명:** 분석 결과 한 타투에 최대 두 개까지 연결 가능한 보조 스타일 목록이다.

**성공 예시**
```json
{"data":[{"seq":1,"code":"LINE","name":"라인"}]}
```

**실패 예시**
```json
{"status":500,"code":"INTERNAL_SERVER_ERROR","message":"기준정보 조회에 실패했습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/classifications/rendering-styles`

**API 개요:** 활성 표현(렌더링) 스타일 기준정보를 조회한다. 인증은 필요 없다.

**Request:** Path, Query, Body가 없다.

**Response:** seq 오름차순의 `{seq,code,name}[]`를 반환한다.

**설명:** 분석 결과 한 타투에 최대 두 개까지 연결 가능한 표현 스타일 목록이다.

**성공 예시**
```json
{"data":[{"seq":1,"code":"REALISTIC","name":"리얼리스틱"}]}
```

**실패 예시**
```json
{"status":500,"code":"INTERNAL_SERVER_ERROR","message":"기준정보 조회에 실패했습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/classifications/colors`

**API 개요:** 활성 색상 기준정보를 조회한다. 인증은 필요 없다.

**Request:** Path, Query, Body가 없다.

**Response:** seq 오름차순의 `{seq,code,name}[]`를 반환한다.

**설명:** 타투 분석의 선택 색상과 회원 색상 취향 점수에 사용하는 목록이다.

**성공 예시**
```json
{"data":[{"seq":1,"code":"BLACK","name":"검정"}]}
```

**실패 예시**
```json
{"status":500,"code":"INTERNAL_SERVER_ERROR","message":"기준정보 조회에 실패했습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### POST `/v1/designs/search-by-shape`

**API 개요:** 캔버스 마스크 형태와 닮은 커버업 도안을 검색한다. 인증은 필요 없다.

**Request:** JSON body. `maskPngB64`는 검은 배경·흰 획 PNG base64 필수이며 `data:`
접두어를 허용한다. `mode`는 `coverup|shape`다.
```json
{"maskPngB64":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA","mode":"coverup"}
```

**Response:** 요청 `mode`, 결과 `count`, 점수 내림차순 `results`를 반환한다. 항목은
`tattooSeq`, Presigned `imageUrl`, 소수 2자리 `score`, 선택 style code·name이다.

**설명:** 삭제 도안은 DB에서 재검증해 제외한다. 검색 엔진 장애는 다른 API에 전파하지 않고 이 요청만 503이다.

**성공 예시**
```json
{"data":{"mode":"coverup","count":1,"results":[{"tattooSeq":501,"imageUrl":"https://minio.example/design?X-Amz-Signature=...","score":0.86,"styleCode":"BLACKWORK","styleName":"블랙워크"}]}}
```

**실패 예시**
```json
{"status":503,"code":"SERVICE_UNAVAILABLE","message":"도안 검색 엔진을 사용할 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

## 19.8 DM·기기·알림

### POST `/v1/dm/rooms`

**API 개요:** 상대 회원과 1대1 채팅방을 생성하거나 기존 방에 진입한다. Bearer 인증이 필요하다.

**Request:** JSON body의 `partnerSeq` 필수다.
```json
{"partnerSeq":102}
```

**Response:** `dmRoomSeq`, 상대 회원 정보, `active`, `notificationEnabled`,
`unreadCount`, 마지막 메시지 미리보기·시각을 반환한다.

**설명:** 두 회원 조합당 방 하나를 보장한다. 진입 시 요청자의 상대 메시지와 해당 방 NEW_DM 알림을 읽음 처리한다.

**성공 예시**
```json
{"data":{"dmRoomSeq":801,"partner":{"userSeq":102,"nickname":"InkKim","profileImageSeq":301,"profileImageUrl":"https://minio.example/profile?X-Amz-Signature=..."},"active":true,"notificationEnabled":true,"unreadCount":0,"lastMessagePreview":"상담 가능할까요?","lastMessageDttm":"2026-08-01T09:30:00Z"}}
```

**실패 예시**
```json
{"status":403,"code":"FORBIDDEN","message":"차단 관계의 회원과 채팅할 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/dm/rooms`

**API 개요:** 내 활성 채팅방 목록을 조회한다. Bearer 인증이 필요하다.

**Request:** Query `cursor` 선택, `size` 기본 30·범위 1~100이다. 커서는 마지막 메시지 시각·roomSeq 복합값이다.

**Response:** `RoomResponse` 커서 페이지를 반환한다.

**설명:** 상대 정보, 숨김 기준 이후 미읽음 수, 방 알림 설정, 마지막 메시지 정보를 조합한다.

**성공 예시**
```json
{"data":{"items":[{"dmRoomSeq":801,"partner":{"userSeq":102,"nickname":"InkKim","profileImageSeq":301,"profileImageUrl":"https://minio.example/profile?X-Amz-Signature=..."},"active":true,"notificationEnabled":true,"unreadCount":3,"lastMessagePreview":"상담 가능할까요?","lastMessageDttm":"2026-08-01T09:30:00Z"}],"nextCursor":null,"hasNext":false,"size":1}}
```

**실패 예시**
```json
{"status":400,"code":"INVALID_CURSOR","message":"유효하지 않은 커서입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### POST `/v1/dm/rooms/{roomSeq}/messages`

**API 개요:** 채팅방에 텍스트·이미지 또는 복합 메시지를 전송한다. Bearer 인증이 필요하다.

**Request:** Path `roomSeq`. JSON body `textContent` 선택·최대 4000자, `imageSeq` 선택이며
둘 중 하나 이상 필요하다. 이미지는 업로드 완료 후 받은 imageSeq다.
```json
{"textContent":"상담 가능할까요?","imageSeq":401}
```

**Response:** `dmMessageSeq`, room/sender seq, `messageType(TEXT|IMAGE|TEXT_WITH_IMAGE)`,
텍스트, 이미지 seq·Presigned URL, `readDttm`, `deleted`, `regDttm`을 반환한다.

**설명:** 메시지와 방 상태를 저장한다. 상대가 방 알림 ON이면 NEW_DM 행도 만들고 커밋 후 WebSocket·FCM을 전송한다.

**성공 예시**
```json
{"data":{"dmMessageSeq":9001,"dmRoomSeq":801,"senderSeq":101,"messageType":"TEXT_WITH_IMAGE","textContent":"상담 가능할까요?","imageSeq":401,"imageUrl":"https://minio.example/dm?X-Amz-Signature=...","readDttm":null,"deleted":false,"regDttm":"2026-08-01T10:00:00Z"}}
```

**실패 예시**
```json
{"status":400,"code":"VALIDATION_ERROR","message":"textContent 또는 imageSeq 중 하나 이상이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/dm/rooms/{roomSeq}/messages`

**API 개요:** 채팅방의 과거 메시지를 조회한다. Bearer 인증이 필요하다.

**Request:** Path `roomSeq`, Query `cursor`는 마지막 dmMessageSeq, `size` 기본 30·범위 1~100이다.

**Response:** `MessageResponse` 커서 페이지를 반환한다.

**설명:** messageSeq 내림차순이며 마지막 나가기 시 저장한 숨김 기준 이하 메시지는 제외한다. 삭제 메시지 내용은 null이다.

**성공 예시**
```json
{"data":{"items":[{"dmMessageSeq":9001,"dmRoomSeq":801,"senderSeq":102,"messageType":"TEXT","textContent":"안녕하세요","imageSeq":null,"imageUrl":null,"readDttm":null,"deleted":false,"regDttm":"2026-08-01T09:30:00Z"}],"nextCursor":null,"hasNext":false,"size":1}}
```

**실패 예시**
```json
{"status":404,"code":"DM_ROOM_NOT_FOUND","message":"참여 중인 채팅방을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PATCH `/v1/dm/rooms/{roomSeq}/read`

**API 개요:** 방의 상대방 미읽음 메시지와 NEW_DM 알림을 일괄 읽음 처리한다. Bearer 인증이 필요하다.

**Request:** Path `roomSeq` 필수. Body는 없다.

**Response:** 실제 읽음으로 변경된 DM 메시지 행 수 `Integer`를 반환한다.

**설명:** 메시지와 해당 방 알림 UPDATE는 한 트랜잭션이다. 커밋 후 상대에게 MESSAGES_READ 이벤트를 보낸다.

**성공 예시**
```json
{"data":3}
```

**실패 예시**
```json
{"status":404,"code":"DM_ROOM_NOT_FOUND","message":"참여 중인 채팅방을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PATCH `/v1/dm/rooms/{roomSeq}/notification`

**API 개요:** 내 채팅방별 NEW_DM 알림 수신 설정을 변경한다. Bearer 인증이 필요하다.

**Request:** Path `roomSeq`. JSON body `enabled` Boolean 필수다.
```json
{"enabled":false}
```

**Response:** 적용된 Boolean 상태를 반환한다.

**설명:** OFF여도 메시지 저장과 채팅방 미읽음 메시지 수는 유지하고 NEW_DM 알림 행·푸시만 생략한다.

**성공 예시**
```json
{"data":false}
```

**실패 예시**
```json
{"status":404,"code":"DM_ROOM_NOT_FOUND","message":"참여 중인 채팅방을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/dm/rooms/{roomSeq}`

**API 개요:** 채팅방 목록에서 방을 나가고 이전 메시지를 숨긴다. Bearer 인증이 필요하다.

**Request:** Path `roomSeq` 필수. Body는 없다.

**Response:** 완료 여부 `Boolean`을 반환한다.

**설명:** 현재 마지막 메시지 seq를 숨김 기준으로 저장하고 참여 상태만 비활성화한다. 방과 메시지는 삭제하지 않는다.

**성공 예시**
```json
{"data":true}
```

**실패 예시**
```json
{"status":404,"code":"DM_ROOM_NOT_FOUND","message":"참여 중인 채팅방을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### POST `/v1/devices`

**API 개요:** 푸시 수신 기기를 현재 로그인 세션과 연결한다. Bearer 인증이 필요하다.

**Request:** JSON body. `fid` 필수·최대 128자, `platform`은 `WEB|ANDROID|IOS`,
`refreshToken` 필수·최대 512자다.
```json
{"fid":"c1234567890abcdefghijk","platform":"ANDROID","refreshToken": "example"}
```

**Response:** `deviceSeq`, `platform`, `active`, `lastUsedDttm`을 반환한다.

**설명:** Firebase Installations SDK가 발급한 FID를 전역 고유키로 upsert하고 현재 회원의 리프레시 토큰과 연결한다. FCM registration token은 받지 않는다. 현재 세션에 다른 기기가 연결되어 있으면 이전 기기를 비활성화한다.

**성공 예시**
```json
{"data":{"deviceSeq":601,"platform":"ANDROID","active":true,"lastUsedDttm":"2026-08-01T10:00:00Z"}}
```

**실패 예시**
```json
{"status":403,"code":"FORBIDDEN","message":"리프레시 토큰의 회원이 일치하지 않습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### DELETE `/v1/devices/{deviceSeq}`

**API 개요:** 내 푸시 기기와 연결된 세션을 비활성화한다. Bearer 인증이 필요하다.

**Request:** Path `deviceSeq` 필수. Body는 없다.

**Response:** 완료 여부 `Boolean`을 반환한다.

**설명:** 기기 행은 유지하고 active=false로 변경하며 연결된 유효 리프레시 토큰을 함께 폐기한다.

**성공 예시**
```json
{"data":true}
```

**실패 예시**
```json
{"status":404,"code":"RESOURCE_NOT_FOUND","message":"소유한 기기를 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/notifications`

**API 개요:** 내 미확인 NEW_DM·SYSTEM 알림 목록을 조회한다. Bearer 인증이 필요하다.

**Request:** Query `cursor` 선택, `size` 기본 30·범위 1~100이다. 커서는 대표 시각·notificationSeq 복합값이다.

**Response:** 항목은 notification/actor/reference seq, 타입, NEW_DM 상대 정보,
`unreadCount`, title, body, regDttm을 갖는 커서 페이지다.

**설명:** 전체 미확인 NEW_DM을 roomSeq로 먼저 그룹화하고 최신 행을 대표로 삼는다. SYSTEM은 개별 행이다.

**성공 예시**
```json
{"data":{"items":[{"notificationSeq":8004,"actorSeq":102,"notificationType":"NEW_DM","referenceSeq":801,"partner":{"userSeq":102,"nickname":"InkKim","profileImageSeq":301,"profileImageUrl":"https://minio.example/profile?X-Amz-Signature=..."},"unreadCount":4,"title":"새 메시지","body":"상담 가능할까요?","regDttm":"2026-08-01T09:30:00Z"}],"nextCursor":null,"hasNext":false,"size":1}}
```

**실패 예시**
```json
{"status":400,"code":"INVALID_CURSOR","message":"유효하지 않은 커서입니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/notifications/unread-counts`

**API 개요:** 타입별 미확인 알림 원본 행 수를 조회한다. Bearer 인증이 필요하다.

**Request:** Path, Query, Body가 없다.

**Response:** `total`과 `byType{NEW_DM,SYSTEM}`을 반환하며 없는 타입도 0이다.

**설명:** 목록의 그룹 수가 아니라 DB 미확인 행 수를 센다. NEW_DM은 알림 ON 상태에서 생성된 미확인 메시지 알림 수다.

**성공 예시**
```json
{"data":{"total":7,"byType":{"NEW_DM":5,"SYSTEM":2}}}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PATCH `/v1/notifications/{notificationSeq}/read`

**API 개요:** SYSTEM 한 건 또는 NEW_DM 한 방의 알림 전체를 읽음 처리한다. Bearer 인증이 필요하다.

**Request:** Path `notificationSeq` 필수. Body는 없다.

**Response:** 처리 대상 대표 `NotificationResponse`를 반환한다.

**설명:** NEW_DM이면 대표 알림의 referenceSeq 방에 속한 모든 미확인 NEW_DM을 처리한다. DM 메시지 readDttm은 바꾸지 않는다.

**성공 예시**
```json
{"data":{"notificationSeq":8004,"actorSeq":102,"notificationType":"NEW_DM","referenceSeq":801,"partner":{"userSeq":102,"nickname":"InkKim","profileImageSeq":301,"profileImageUrl":"https://minio.example/profile?X-Amz-Signature=..."},"unreadCount":4,"title":"새 메시지","body":"상담 가능할까요?","regDttm":"2026-08-01T09:30:00Z"}}
```

**실패 예시**
```json
{"status":404,"code":"RESOURCE_NOT_FOUND","message":"알림을 찾을 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### PATCH `/v1/notifications/read-all`

**API 개요:** 내 모든 미확인 알림을 읽음 처리한다. Bearer 인증이 필요하다.

**Request:** Path, Query, Body가 없다.

**Response:** 실제 변경된 알림 행 수 `Integer`를 반환한다.

**설명:** NEW_DM과 SYSTEM 미확인 행을 한 번의 UPDATE로 처리한다. DM 메시지 자체는 변경하지 않는다.

**성공 예시**
```json
{"data":7}
```

**실패 예시**
```json
{"status":401,"code":"UNAUTHORIZED","message":"인증이 필요합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

## 19.9 검색·취향 설문

### GET `/v1/search/accounts/autocomplete`

**API 개요:** 회원 닉네임 접두어 자동완성 결과를 조회한다. 인증은 필요 없다.

**Request:** Query `q` 필수·한글/자모/영문/숫자 1~20자, `size` 기본 10·범위 1~20이다.

**Response:** `{userSeq,nickname,role}[]`를 반환하며 결과가 없으면 `[]`다.

**설명:** Redis ZSET 접두어 후보를 얻은 뒤 DB에서 ACTIVE·비삭제·ADMIN 제외 조건을 재검증한다.

**성공 예시**
```json
{"data":[{"userSeq":101,"nickname":"BlackRose1","role":"USER"}]}
```

**실패 예시**
```json
{"status":503,"code":"SERVICE_UNAVAILABLE","message":"검색 인덱스를 사용할 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/search/accounts`

**API 개요:** 회원 닉네임 본 검색을 수행한다. 인증은 필요 없다.

**Request:** Query `q` 필수·한글/자모/영문/숫자 2~20자, `size` 기본 20·범위 1~50이다.

**Response:** Redis가 결정한 순서의 `{userSeq,nickname,role}[]`를 반환한다.

**설명:** exact → prefix → fuzzy 거리 1 → fuzzy 거리 2 → contains 단계로 검색하고 DB 상태를 재검증한다.

**성공 예시**
```json
{"data":[{"userSeq":101,"nickname":"BlackRose1","role":"USER"}]}
```

**실패 예시**
```json
{"status":400,"code":"VALIDATION_ERROR","message":"검색어는 2자 이상이어야 합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/search/artists/autocomplete`

**API 개요:** 인증 타투이스트 닉네임 접두어 자동완성 결과를 조회한다. 인증은 필요 없다.

**Request:** Query `q` 필수·1~20자, `size` 기본 10·범위 1~20이다.

**Response:** VERIFIED ARTIST의 `{userSeq,nickname,role}[]`를 반환한다.

**설명:** 아티스트 전용 Redis 접두어 사전을 사용하고 DB에서 ARTIST·VERIFIED·ACTIVE를 재검증한다.

**성공 예시**
```json
{"data":[{"userSeq":102,"nickname":"InkKim","role":"ARTIST"}]}
```

**실패 예시**
```json
{"status":503,"code":"SERVICE_UNAVAILABLE","message":"검색 인덱스를 사용할 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/search/artists`

**API 개요:** 인증 타투이스트 닉네임 본 검색을 수행한다. 인증은 필요 없다.

**Request:** Query `q` 필수·2~20자, `size` 기본 20·범위 1~50이다.

**Response:** VERIFIED ARTIST의 `{userSeq,nickname,role}[]`를 반환한다.

**설명:** Redis fuzzy 단계 순서를 보존하고 DB 상태를 재검증한다. 팔로워 수·취향 점수는 정렬에 사용하지 않는다.

**성공 예시**
```json
{"data":[{"userSeq":102,"nickname":"InkKim","role":"ARTIST"}]}
```

**실패 예시**
```json
{"status":400,"code":"VALIDATION_ERROR","message":"검색어는 2자 이상이어야 합니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/search/subjects/autocomplete`

**API 개요:** 타투 이미지 subject 접두어 자동완성 결과를 조회한다. 인증은 필요 없다.

**Request:** Query `q` 필수·한글/자모/영문/숫자 1~50자, `size` 기본 10·범위 1~20이다.

**Response:** `{subjectSeq,subjectName}[]`를 반환한다.

**설명:** 연결 빈도·검색량으로 선별한 Redis ZSET 사전을 사용하며 정확 일치·짧은 이름·사전순으로 정렬한다.

**성공 예시**
```json
{"data":[{"subjectSeq":10,"subjectName":"장미"}]}
```

**실패 예시**
```json
{"status":503,"code":"SERVICE_UNAVAILABLE","message":"검색 인덱스를 사용할 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### GET `/v1/search/posts`

**API 개요:** 입력을 최상위 subject로 보정해 연결 게시글을 검색한다. 인증은 선택이다.

**Request:** Query `q` 필수·2~50자, `cursor` 선택 postSeq, `size` 기본 20·범위 1~50이다.

**Response:** 원문 `query`, `matchedSubject{subjectSeq,subjectName}`, `matchType`,
`PostResponse items`, `nextCursor`, `hasNext`, `size`를 반환한다.

**설명:** subject를 exact/prefix/fuzzy/contains 순으로 결정한 뒤 PUBLISHED 게시글을 조회한다.
로그인 회원에게는 차단·관심 없음 항목을 제외하고 실제 보정 subject의 검색량을 기록한다.

**성공 예시**
```json
{"data":{"query":"장미","matchedSubject":{"subjectSeq":10,"subjectName":"장미"},"matchType":"EXACT","items":[],"nextCursor":null,"hasNext":false,"size":0}}
```

**실패 예시**
```json
{"status":503,"code":"SERVICE_UNAVAILABLE","message":"검색 인덱스를 사용할 수 없습니다.","timestamp":"2026-08-01T10:00:00Z"}
```

### POST `/v1/preferences/survey`

**API 개요:** 회원가입 후 최초 주 스타일·색상 취향 점수를 반영한다. Bearer 인증이 필요하다.

**Request:** JSON body. `primaryStyleSeqs`는 필수·1~50개, `colorSeqs`는 선택·최대
50개이며 각 원소는 null일 수 없다. 서버가 중복을 제거한다.
```json
{"primaryStyleSeqs":[1,3,5],"colorSeqs":[1,2]}
```

**Response:** `primaryStyles`, `colors` 배열을 반환하며 각 항목은
`classificationSeq`, 반영된 `score`를 갖는다.

**설명:** 기존 주 스타일·색상 취향 행이 하나도 없는 회원에게 한 번만 허용하며 전체 upsert는 한 트랜잭션이다.

**성공 예시**
```json
{"data":{"primaryStyles":[{"classificationSeq":1,"score":3.0},{"classificationSeq":3,"score":3.0}],"colors":[{"classificationSeq":1,"score":3.0}]}}
```

**실패 예시**
```json
{"status":409,"code":"STATE_CONFLICT","message":"최초 취향 설문이 이미 반영되었습니다.","timestamp":"2026-08-01T10:00:00Z"}
```
