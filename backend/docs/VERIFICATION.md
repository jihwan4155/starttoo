# Verification

## 이 작업 환경에서 통과한 검사

- Java 소스·테스트 152개 파일 전체 문법 파싱
- 전체 컨트롤러 20개에 `@Tag` 적용
- 전체 HTTP 매핑 86개에 `@Operation` 설명 적용
- 공개·선택 인증·필수 인증 API의 OpenAPI security 구분
- 컨트롤러·엔드포인트 Swagger 누락을 방지하는 자동 테스트 추가
- `application.yml`, `application-local.yml` YAML 로딩
- PostgreSQL parser 기준 Flyway SQL 전체 구문 분석
  - V1: 56 statements
  - V2: 5 statements
  - V3: 4 statements
  - V4: 5 statements
- 활성 테이블 34개 확인
- FK 78개의 원본/대상 테이블·칼럼 존재 및 자료형 일치 확인
- pgvector extension, table, HNSW index가 주석 상태인지 확인
- `is_flipped`, `is_notification_enabled`, `recent_search_terms`,
  `PUBLISHED/HIDDEN/DELETED` 반영 확인
- `com.starttoo.backend` 내부 import 대상 파일 존재 확인

## 프로젝트에 포함된 자동 테스트

- 성공 응답과 오류 응답 JSON 계약
- HTTP status와 오류 `status`/`code` 일치
- 한국 휴대폰 번호 E.164 정규화
- 한글 자모 분해와 영문·숫자 보존
- 누락된 숫자·논리 입력이 0/false로 처리되지 않는 필수값 검증
- PostgreSQL nullable JDBC 파라미터의 명시적 타입 지정 회귀 검사
- Docker 사용 가능 시 PostgreSQL 17 Flyway 전체 적용 및 활성 테이블 수 검증
- Docker 사용 가능 시 Redis 8 Query Engine의 fuzzy 후보 생성과 삭제 문서 제거 검증
- 주요 복합 쓰기 유스케이스의 writable `@Transactional` 경계 회귀 검사
- Redis 후보 tier 순서(exact→prefix→fuzzy 1→fuzzy 2→contains) 회귀 검사
- DB 커밋 후 계정·아티스트·subject 검색 인덱스 증분 동기화 구조 점검
- subject 검색량 스냅샷과 후속 JSONL 이벤트 기반 Redis 복구 구조 점검
- 최근 검색 조회의 PostgreSQL 폴백과 Redis 변경 실패 503 회귀 검사
- DM 메시지와 해당 방 `NEW_DM` 알림의 동일 트랜잭션 읽음 처리 회귀 검사
- WebSocket·FCM 리스너가 `AFTER_COMMIT`과 전용 비동기 실행기를 사용하는지 검사
- STOMP CONNECT JWT 인증과 개인 DM·알림 구독 경로 제한
- 로그아웃 시 리프레시 토큰과 연결된 푸시 기기의 동일 트랜잭션 비활성화

## 환경 제한

작성 환경에는 JDK 21과 Docker가 없고 JVM의 외부 의존성 다운로드가 차단되어
`./gradlew clean test bootJar` 자체는 이 환경에서 실행하지 못했다. 최종 프로젝트는
Java toolchain 21과 Gradle Wrapper를 고정했고, JDK 21 및 Docker가 있는 개발
환경에서는 다음 명령으로 컴파일·테스트·JAR 생성을 한 번에 검증한다.

```bash
docker compose up -d
./gradlew clean test bootJar
```
