# Starttoo 백엔드 초안 구조

## 패키지 원칙

```text
com.starttoo
├── common
│   ├── api             공통 오류·커서 응답
│   ├── exception       예외 코드와 전역 처리
│   ├── openapi         공통 오류와 API별 상세 Swagger 계약
│   ├── pagination      커서 인코딩·디코딩
│   └── persistence     공통 생성·수정 시각
├── config
│   ├── security        JWT 검증, 권한, CORS
│   └── websocket       AR WebRTC 시그널링
└── domain
    ├── auth
    ├── user
    ├── artist
    ├── tattoo
    ├── archive
    ├── social
    ├── image
    ├── post
    ├── dm
    ├── notification
    ├── search
    └── admin
```

각 기능은 다음 순서로 작성한다.

```text
Controller → Service → Repository → Entity → MySQL
```

- Controller: HTTP 요청 검증과 상태코드 반환
- Service: 차단, 상태 변경, 권한, 트랜잭션 등 비즈니스 규칙
- Repository: DB 조회와 저장
- Entity: ERD 테이블 매핑
- DTO: API 명세의 Request/Response 전용 객체

Entity를 API 응답으로 직접 반환하지 않는다.

## 현재 포함된 기반

- ERD 26개 테이블의 Entity
- 복합 PK 7종
- Entity별 Spring Data JPA Repository
- 최신 전체 DDL `database/starttoo_schema.sql`
- 표준 오류 응답과 `@RestControllerAdvice`
- 커서 페이지 응답과 Base64 URL 커서 코덱
- Stateless JWT 검증·발급 기반
- USER/ARTIST/ADMIN 경로 권한 골격
- Swagger/OpenAPI와 사용자·관리자 REST API
- 87개 Operation의 핵심 규칙·트랜잭션·주요 오류 설명과 JSON 성공 응답 예시
- 카카오·구글 실제 Authorization Code 교환
- Access/Refresh/Signup JWT와 Refresh Token rotation
- objectKey 기반 이미지 입력 계약과 MinIO 포트
- 모바일 웹 카메라용 메모리 AR 세션과 WebRTC 시그널링

## 다음 구현 순서

1. MinIO 어댑터 구현과 objectKey 소유권/HEAD 검증
2. FastAPI AI·커버업·도안·검색·합성 클라이언트
3. 모바일/데스크톱 WebRTC 프론트엔드
4. 도메인별 통합 테스트와 동시성 테스트

## 반드시 Service 트랜잭션으로 처리할 규칙

- 상세 좋아요 행과 캐시 카운트의 동시 변경
- 차단과 양방향 팔로우 삭제
- 게시물과 이미지 1~10장의 동시 생성
- 신고 ACCEPTED와 게시물 HIDDEN 상태 변경
- DM 나가기와 마지막 숨김 메시지 저장
- 새 DM 수신 시 참여자 `is_active` 재활성화
- 댓글의 부모가 일반 댓글인지 확인
- `last_hidden_message_id`가 같은 DM 방 메시지인지 확인

## 구현 상태

외부 시스템이 필요 없는 사용자·관리자 API는 Service/Repository까지 구현되어 있다. 외부 연동 기능은 DTO·경로·Swagger 계약을 먼저 고정하고 `501 FEATURE_NOT_IMPLEMENTED`를 반환한다.
