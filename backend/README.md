# Starttoo Backend

Starttoo API를 구현하는 Spring Boot 백엔드 초안이다. MySQL/JPA, 카카오·구글 OAuth 코드 교환, JWT, 사용자·관리자 REST API, Swagger, AR WebRTC 시그널링 서버를 포함한다.

## 먼저 할 일

1. IntelliJ에서 이 폴더의 `build.gradle`을 연다.
2. Project SDK와 Gradle JVM을 Java 21로 지정한다.
3. 로컬 MySQL에서 `database/starttoo_schema.sql`을 실행한다.
4. `BackendApplication`을 실행한다.
5. `GET http://localhost:8080/v1/actuator/health`가 `UP`인지 확인한다.
6. `http://localhost:8080/v1/swagger-ui.html`에서 API를 확인한다.

상세한 DB 실행 방법은 [LOCAL_SETUP.md](LOCAL_SETUP.md), 코드 배치는 [ARCHITECTURE.md](ARCHITECTURE.md)를 참고한다.

## 구현 범위

- 실제 구현: Auth, Users, Artists, Archive, Tattoos 조회, Posts, Comments, DM REST·방별 알림 끄기, grouped unread Notifications, Admin
- 실제 구현: 메모리 기반 AR 세션, QR, WebRTC Offer/Answer/ICE 전달용 `/ws/ar`
- 명시적 501 껍데기: MinIO Presigned URL, AI 생성, 커버업, 타투 도안 가공, 게시글 임베딩 검색, 이미지 합성
- 연결 대기 어댑터: FCM 푸시는 DB 커밋 후 포트까지 호출하고 현재는 로그만 남긴다.
- 관리자 목록은 `page`가 1부터 시작하는 번호 기반 페이지네이션을 사용하며, 일반 목록은 커서 페이지네이션을 유지한다.

이미지 입력 API는 파일 대신 업로드 완료 `objectKey`를 받는다. 조회 응답의 `imageUrl`은 MinIO 어댑터가 조회용 Presigned GET URL을 생성한 결과다. 현재 어댑터는 의도적으로 비어 있으므로 이미지 연동 API는 `501 FEATURE_NOT_IMPLEMENTED`를 반환한다.

## 주요 디렉터리

```text
src/main/java/com/starttoo
├── common                 공통 응답, 예외, 커서, 시간 필드
├── config/security        JWT, URL 권한, CORS
└── domain                 기능별 Controller/Service/Repository/Entity

database
├── starttoo_schema.sql    빈 MySQL에 실행하는 최신 전체 DDL
└── changes                서버 반영이 끝난 변경 SQL 보관

src/main/resources
└── application.yml        로컬·서버 실행 설정
```

## 주의 사항

- 애플리케이션은 DB 스키마를 자동 생성하거나 변경하지 않는다.
- 최초 DB는 `database/starttoo_schema.sql`로 생성한다.
- 이후 변경은 `database/changes`에 순번이 포함된 SQL로 남기고, 백업 후 서버 DB에 직접 적용한다.
- JPA `ddl-auto=validate`가 Entity와 실제 스키마의 일치 여부만 확인한다.
- 운영 환경에서는 DB 비밀번호와 `JWT_SECRET`을 반드시 환경 변수로 주입한다.
- 기본 프로필 objectKey는 `DEFAULT_PROFILE_IMAGE_KEY` 환경 변수로 관리한다.
- Entity를 Controller 응답으로 직접 반환하지 말고 Request/Response DTO를 사용한다.
- 상세 좋아요 행과 카운트, 신고 처리와 게시물 숨김 같은 연관 변경은 Service의 한 트랜잭션에서 처리한다.
- 전체 구현 현황은 [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), 이미지 계약은 [OBJECT_STORAGE_CONTRACT.md](OBJECT_STORAGE_CONTRACT.md), AR 연결은 [AR_WEBRTC_CONTRACT.md](AR_WEBRTC_CONTRACT.md)를 참고한다.
