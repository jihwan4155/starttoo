# 정적 검증 결과

- Java main/test 소스 153개를 Java parser로 파싱 성공
- `application.yml`, 테스트용 `application.yml` YAML 파싱 성공
- 전체 DDL 58개 문장과 더미 데이터 79개 문장을 MySQL 문법 parser로 검사 성공
- 독립 실행 DDL에 26개 테이블과 모든 테이블의 `DROP TABLE IF EXISTS` 반영
- 최종 DDL의 26개 테이블과 JPA `@Table` Entity 26개가 1:1 대응
- 전역 `notification_settings` 코드 제거, 방별 `dm_room_notification_mutes` Entity·Repository·DDL 반영
- `users.profile_image_key NOT NULL`, `notifications.reference_type`, `tattoos.rendering` 반영
- Controller 15개, HTTP 매핑 92개 확인. 테스트 로그인 1개를 제외한 운영 API 91개와 Swagger 상세 문서 91개가 정확히 대응하며 중복 Method+Path 없음
- 관리자 Controller와 신고·학습·타투이스트 승인 API 5개 확인

이 실행 환경에는 Java 17 런타임만 있고 Gradle 9.5.1 배포 파일 다운로드가 차단되어 `./gradlew test`는 실행하지 못했다. IntelliJ에서 Gradle JVM을 Java 21로 지정한 뒤 아래 두 명령으로 최종 컴파일·테스트해야 한다.

```powershell
.\gradlew.bat clean test
.\gradlew.bat bootRun
```

그 다음 `http://localhost:8080/v1/swagger-ui.html`과 `GET /v1/actuator/health`를 확인한다.
