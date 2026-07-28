# 이번 구현에서 확정된 ERD·API 변경점

## ERD

최신 전체 DDL인 `database/starttoo_schema.sql`에는 아래 변경 결과가 모두 합쳐져 있다. 애플리케이션은 스키마를 자동 변경하지 않으며, 이후 변경 SQL은 `database/changes`에 순서대로 보관한다.

| 대상 | 변경 | 이유 |
|---|---|---|
| `images.image_url` | `images.object_key`로 rename | Presigned URL은 만료되므로 영구 저장할 수 없음 |
| `images.content_type` | 최종 DDL에서 제외 | 실제 MIME은 MinIO 객체를 조회해 검증하며 DB에 중복 저장하지 않음 |
| `images.file_size` | 최종 DDL에서 제외 | 실제 크기는 MinIO 객체를 조회해 검증하며 DB에 중복 저장하지 않음 |
| `users.profile_image_url` | `users.profile_image_key`로 rename | 프로필도 URL 대신 object key 저장 |
| `users.profile_image_key` | `NOT NULL`, UNIQUE 없음 | 미선택 회원이 공용 기본 objectKey를 재사용 |
| `dm_messages.image_url` | `dm_messages.image_key`로 rename | DM 첨부도 URL 대신 object key 저장 |
| `dm_messages` CHECK | `image_key` 기준으로 재생성 | TEXT/IMAGE/TEXT_WITH_IMAGE 조합 유지 |
| `notification_settings` | 제거 | 전역 DM 설정 대신 방별 음소거 사용 |
| `dm_room_notification_mutes` | 신규 | `(user_id, dm_room_id)` 행 존재가 알림 끄기 상태 |
| `notifications.reference_type` | 신규 | `DM_ROOM`, `REPORT`, `ARTIST` 참조 의미를 명시 |
| `tattoos.rendering` | 신규, nullable `VARCHAR(20)` | `WATER_COLOR` 같은 렌더링 분류 저장 |

`tattoos.technique` 제거와 `tattoo_artists.shop_city`, `tattoo_artists.popularity` 추가도 최종 DDL에 반영되어 있다. `tattoo_designs.tattoo_id` PK 구조도 유지되므로 한 타투는 도안이 0개 또는 1개다.

`dm_room_participants.last_hidden_message_id`는 FK의 `ON DELETE SET NULL` 대상이므로 이 칼럼과 삭제 상태의 조합을 CHECK로 강제하지 않는다. 동일 채팅방 메시지인지와 `last_left_at` 조합은 Service에서 검증한다.

## API 요청

이미지 업로드는 다음 2단계다.

1. `/uploads/presigned-url`에서 objectKey와 업로드용 Presigned PUT URL 발급
2. 업로드 완료 후 각 API JSON에 objectKey만 전달

이에 따라 프로필, 컬렉션, 게시글, DM, AI 참고 이미지, 커버업, 이미지 검색, 시뮬레이션 합성 요청에서 multipart 파일 입력을 제거했다. 응답의 `imageUrl` 이름은 화면 표시 용도이므로 유지하며, 서버가 조회 시 Presigned GET URL을 생성한다.

Presigned URL 발급 요청의 `contentType`, `fileSize`는 1차 검증용으로 유지한다. 업로드 후에는 MinIO의 실제 객체를 다시 검증하고, 부적합하면 객체를 삭제하며 `images`에는 `object_key`만 저장한다.

## API 기능 변경

- `GET /artists`: `shopCity`와 `nickname` 동시 입력 허용. 닉네임이 있으면 일치도, popularity, userId 순으로 정렬한다.
- `POST /tattoos/{tattooId}/design`: 기존 도안이 있어도 재생성 후 image_id를 덮어쓴다. 항상 200이며 `created` 필드는 없다.
- `GET /posts/{postId}/comments`: `previewReplies`를 제거하고 `replyCount`만 반환한다.
- `DELETE /comments/{commentId}`: 루트 댓글 삭제 시 직속 대댓글까지 소프트 삭제하며 좋아요 이력은 보존한다.
- DM 방별 알림 끄기: `/dm/rooms/{dmRoomId}/notification-mute`의 GET/POST/DELETE를 추가했다.
- 알림 조회: `/notifications/unread-counts`, `/notifications/unread/preview`, `/notifications/unread`로 분리했다. NEW_DM은 방별로 묶고 SYSTEM은 개별 반환한다.
- 회원가입: 선택적인 `profileImageKey`를 받고, 생략 시 서버 환경설정의 공용 기본 objectKey를 사용한다.
- 신고 처리와 타투이스트 승인 변경은 대상 회원의 SYSTEM 알림까지 같은 DB 트랜잭션에 저장한다.
- AR 연결: Android App Link 대신 QR → 모바일 웹 카메라 → WebRTC로 변경했다.

## 외부 연동 전 상태

MinIO, FastAPI/AI, 커버업, 도안 가공, 임베딩 검색, 이미지 합성은 인터페이스와 DTO만 고정되어 있고 501을 반환한다. FCM은 포트와 커밋 후 호출 흐름까지만 구현되어 실제 발송 대신 로그를 남긴다. 외부 연결 이후 구현체를 교체한다.
