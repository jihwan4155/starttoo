# Starttoo Backend

타투이스트 중심 타투 추천·커뮤니티·DM 서비스를 위한 Spring Boot 모듈러 모놀리스다.

- Java 21
- Spring Boot 3.5.16
- Gradle 8.14.3
- PostgreSQL 17 + Flyway
- Redis 8.6.5 Query Engine
- MinIO
- Spring Security JWT
- STOMP over WebSocket
- Firebase Cloud Messaging(선택 활성화)
- springdoc OpenAPI/Swagger
- 실행 산출물: `starttoo-backend.jar`

## 실행

필수 환경은 JDK 21과 Docker Compose다.

```bash
cp .env.example .env
docker compose up -d
./gradlew bootRun --args='--spring.profiles.active=local'
```

local 프로필에서는 다음 주소를 사용한다.

- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`
- Health: `http://localhost:8080/actuator/health`
- MinIO Console: `http://localhost:9001`

Swagger에는 이번 v1 범위의 전체 84개 API 인증 조건, 입력 제약, 처리 흐름과 공통 오류 응답이
기재되어 있다. 자물쇠가 있는 API는 우측 상단 `Authorize`에 액세스 토큰 원문만
입력한다. 공개 API 중 로그인 여부에 따라 응답이 달라지는 피드·프로필·댓글·검색은
익명 호출과 Bearer JWT 호출을 모두 허용하도록 표시한다.

실행 JAR 생성:

```bash
./gradlew clean test bootJar
java -jar build/libs/starttoo-backend.jar --spring.profiles.active=local
```

## 로컬 휴대폰 인증

로컬 휴대폰 인증 API는 응답의 `debugCode`를 제공한다. 다른 프로필은
`SMS_WEBHOOK_URL`에 다음 JSON을 전송하며, URL이 없으면 503을 반환한다.

```json
{
  "phoneNumber": "+821012345678",
  "verificationCode": "123456"
}
```

## 응답 계약

성공 응답에는 `data`만 둔다.

```json
{
  "data": {
    "userSeq": 2
  }
}
```

오류 응답은 HTTP 상태와 `status`를 일치시키며 다음 형식으로 고정한다.

```json
{
  "timestamp": "2026-07-29T07:30:00Z",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "입력값 검증에 실패했습니다.",
  "errors": [
    {
      "field": "nickname",
      "rejectedValue": "",
      "reason": "공백일 수 없습니다"
    }
  ]
}
```

Rate limit 초과는 HTTP 429와 `RATE_LIMITED`를 반환한다. 읽기와 상태 변경
버킷은 분리되어 있고 Redis 장애 시에는 전체 API 장애를 피하기 위해 요청을
통과시킨다.

## 주요 처리 규칙

- `users`는 정규화된 휴대폰 번호 하나에 대응하는 통합 계정이다.
- Google/Kakao의 불변 subject는 `user_oauth_accounts`에 저장하며 한 회원이
  서로 다른 제공자를 복수로 연결할 수 있다.
- 닉네임은 공백·특수문자 없이 2~20자이며 영문 대소문자를 구분한다.
- 현재 게시물·컬렉션 등록의 모델 호출은 비활성화되어 있다. 소유 이미지 검증 후
  `OTHER`·`LINE`·`BLACK`·`타투` 고정값으로 tattoos를 생성하므로 API와 DB
  트랜잭션을 모델 서버 없이 검증할 수 있다.
- 모델 연결 후에는 타투 여부 판별을 통과한 이미지에 한해 primary style 1개,
  secondary style 최대 2개, rendering style 최대 2개, nullable color 1개와
  다중 subject를 저장한다.
- 좋아요 변경, 게시물 카운트의 원자 증감, 취향 점수 변경은 한 트랜잭션이다.
- 체류시간은 사용자×게시물 원본 통계를 저장하지 않고 즉시 점수화한다.
- 최근 검색어는 Redis에서 즉시 변경하고 `users.recent_search_terms`에
  주기적으로 write-behind 한다.
- 검색 로그는 Redis에 임시 적재한 뒤 MinIO의 일자별 JSONL 객체로 배치 저장한다.
  실제 존재하는 정답 subject만 검색량을 올리며, 집계는 버전별 스냅샷으로 별도 보관한다.
- 닉네임과 전체 subject 검색은 Redis Search가 `exact → prefix → fuzzy 1 →
  fuzzy 2 → contains` 순으로 후보와 점수를 결정한다. Spring은 재정렬하지 않고
  PostgreSQL의 최신 활성·삭제·인증 상태만 검증한다.
- 계정 생성·닉네임 변경·상태 변경과 subject 생성은 DB 커밋 후 Redis
  인덱스에 증분 반영한다. Redis 유실이나 인덱스 버전 변경 시 전체 재구축하고 매일
  PostgreSQL과 저빈도 대조한다.
- 회원가입 취향 설문은 primary style과 선택 색상의 중복을 제거해 최초 한 번만
  반영하고, 게시물 체류시간은 구간 점수로 변환해 중복 제거된 분류에만 반영한다.
- DM 방별 알림 설정은 메시지 저장과 읽지 않음 수에 영향을 주지 않는다.
- DM 읽음 처리는 상대 메시지와 해당 방의 `NEW_DM` 알림을 한 트랜잭션으로 갱신한다.
- DM 메시지·알림 행은 DB에 먼저 커밋하고 WebSocket·FCM은 `AFTER_COMMIT`에서
  비동기로 전달한다. 실시간 전달 실패는 저장 내용을 롤백하지 않으며 재조회로 복구한다.

## DM WebSocket·FCM

WebSocket 연결 경로는 `ws://localhost:8080/ws`이며 STOMP `CONNECT` 헤더에
다음과 같이 액세스 토큰을 제공한다.

```text
Authorization: Bearer {accessToken}
```

구독 목적지는 다음과 같다.

- `/user/queue/dm-events`: 메시지 생성·읽음
- `/user/queue/notifications`: DB에 커밋된 알림

DM 전송과 읽음 처리는 기존 REST API를 사용한다. 현재 WebSocket은 서버→클라이언트
실시간 갱신 전용이며 클라이언트 `SEND`는 차단한다. 앱은 `eventId`와 각 seq로
WebSocket·FCM 중복 이벤트를 제거하고 재연결 시 REST 커서 조회로 누락을 보충한다.

FCM은 기본적으로 비활성화되어 있어 자격 증명 없이 로컬 서버를 실행할 수 있다.
운영에서 다음 환경 변수를 설정하면 Firebase Admin SDK가 활성화된다.

```text
FIREBASE_ENABLED=true
FIREBASE_CREDENTIALS_PATH=/run/secrets/firebase-service-account.json
FIREBASE_PROJECT_ID=starttoo-production
```

기기 등록은 `POST /v1/devices`에서 FCM 토큰과 현재 리프레시 토큰을 연결한다.
로그아웃하면 해당 리프레시 토큰과 연결된 기기의 푸시가 같은 트랜잭션에서
비활성화된다. 클라이언트도 로그아웃 시 WebSocket 연결과 로컬 인증 정보를 정리한다.

## 타투 분석 모델 연동

현재 `AI_ENABLED=false`가 기본값이며 외부 모델 호출 코드는 서비스의
`TODO(model-integration)` 지점에서 비활성화되어 있다. 현재 게시물·컬렉션 등록은
소유 이미지 검증 뒤 명시적 고정 분석값을 사용한다.

추후 연결할 외부 계약은 다음 엔드포인트를 전제로 한다.

- `POST /v1/tattoos/detect`: `{"imageUrl":"..."}` → `{"isTattoo":true}`
- `POST /v1/tattoos/analyze`

분석 응답:

```json
{
  "primaryStyleCode": "OTHER",
  "secondaryStyleCodes": [],
  "renderingStyleCodes": ["LINE"],
  "colorCode": "BLACK",
  "subjects": ["장미", "나비"]
}
```

모델 연동 시 고정 분석값을 제거하고, Swagger의 임시 동작 설명도 실제
실패·재시도·타임아웃 계약에 맞춰 함께 변경해야 한다.

## 데이터베이스

Flyway가 다음 순서로 적용된다.

1. `V1__initial_schema.sql`: 34개 활성 테이블과 인덱스
2. `V2__bootstrap_reference_data.sql`: 최초 관리자와 OAuth 제공자
3. `V3__seed_reference_classifications.sql`: 최소 모델 분류 기준정보
4. `V4__add_new_dm_notification_type.sql`: DM 알림 타입·제약·읽음 인덱스

pgvector의 확장·테이블·HNSW 인덱스는 V1에서 주석 상태다. 임베딩 모델과 차원을
확정한 뒤 별도의 새 Flyway 마이그레이션으로 활성화해야 하며, 이미 적용된 V1을
수정해서는 안 된다.

운영 배포 전에는 OAuth 키, JWT 비밀키, SMS webhook,
모델 연결 구현, MinIO 자격 증명과 CORS 도메인을 반드시 교체한다.

## 테스트

- 성공/오류 JSON 계약과 HTTP 상태 일치
- 휴대폰 번호 한국→E.164 정규화
- 한글 자모 분해와 영문·숫자 보존
- Docker 사용 가능 시 PostgreSQL 17에 Flyway 전체 적용 및 34개 테이블 확인

API 목록과 세부 정책은 [docs/API_SPEC.md](docs/API_SPEC.md)에 정리되어 있으며,
실제 Swagger 설명은 컨트롤러·서비스 구현의 트랜잭션 흐름까지 대조해 작성했다.
