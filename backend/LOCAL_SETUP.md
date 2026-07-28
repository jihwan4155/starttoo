# Starttoo 로컬·서버 DB 구성

## 현재 설정

- Java 21
- Spring Boot 4.1.0
- MySQL 8.0 이상
- 데이터베이스: `tattoo_platform`
- 로컬 계정 기본값: `ssafy` / `ssafy`
- API 기본 경로: `http://localhost:8080/v1`
- 스키마 자동 생성·변경 없음
- JPA `ddl-auto=validate`

`application.yml`의 계정은 로컬 실행 기본값이다. 서버에서는 반드시 환경 변수로 덮어쓴다.

## 최초 DB 생성

MySQL Workbench에서 아래 파일 전체를 실행한다.

```text
database/starttoo_schema.sql
```

이 파일은 다음 작업을 수행한다.

1. `tattoo_platform` 데이터베이스 생성
2. UTF-8 문자셋과 Collation 설정
3. 최신 ERD 기준 26개 테이블 생성
4. PK, FK, UNIQUE, CHECK, INDEX 생성

더미 데이터는 포함하지 않는다. 반복 실행을 위해 기존 26개 테이블을 `DROP TABLE IF EXISTS`로 삭제한 뒤 다시 생성하므로 해당 DB의 기존 데이터는 모두 사라진다. 로컬 초기화 또는 운영 DB 최초 구성에만 사용하고, 운영 데이터가 있으면 반드시 백업 후 개별 변경 SQL을 적용한다.

## 애플리케이션 실행

IntelliJ의 Project SDK와 Gradle JVM을 Java 21로 지정한다. 그다음 `BackendApplication`을 실행하거나 다음 명령을 사용한다.

```powershell
.\gradlew.bat clean test
.\gradlew.bat bootRun
```

정상 실행 확인:

```text
GET http://localhost:8080/v1/actuator/health
http://localhost:8080/v1/swagger-ui.html
```

애플리케이션은 테이블을 생성하거나 수정하지 않는다. Entity와 실제 DB 구조가 다르면 JPA `validate` 단계에서 실행을 중단한다.

## 서버 환경 변수

```text
DB_URL=jdbc:mysql://{DB주소}:3306/tattoo_platform?serverTimezone=UTC&characterEncoding=UTF-8
DB_USERNAME={DB계정}
DB_PASSWORD={DB비밀번호}
JWT_SECRET=change-me
KAKAO_CLIENT_ID={카카오 REST API 키}
KAKAO_CLIENT_SECRET={선택 값}
GOOGLE_CLIENT_ID={구글 OAuth Client ID}
GOOGLE_CLIENT_SECRET={구글 OAuth Client Secret}
OAUTH_ALLOWED_REDIRECT_URIS={허용할 콜백 URL}
DEFAULT_PROFILE_IMAGE_KEY={MinIO 공용 기본 프로필 objectKey}
```

## 이후 스키마 변경

스키마 변경은 `database/changes`에 새 SQL 파일로 기록한다.

```text
database/changes/001_add_example_column.sql
database/changes/002_add_example_index.sql
```

서버 적용 순서:

1. 로컬 DB에서 SQL 검증
2. 서버 DB 백업
3. 서버 DB에 변경 SQL 직접 실행
4. 변경된 Spring Boot 배포
5. JPA `ddl-auto=validate` 통과 확인

이미 서버에 적용한 변경 SQL을 수정하거나 삭제하지 않는다. 추가 수정은 다음 번호의 SQL로 작성한다.

## 이미지 API 테스트 시 주의

현재 MinIO 어댑터는 비어 있다. `/uploads/presigned-url`과 이미지 URL이 필요한 API가 `501 FEATURE_NOT_IMPLEMENTED`를 반환하는 것은 정상이다. MinIO 연결 전에도 텍스트 전용 API, 인증/JWT, 팔로우·차단·좋아요 상태 로직은 테스트할 수 있다.
