# Object Storage 계약

## 저장 원칙

Presigned URL은 만료되므로 DB에 저장하지 않는다. DB에는 다음 영구 식별자만 저장한다.

| 테이블 | 기존 | 현재 |
|---|---|---|
| `images` | `image_url` | `object_key` |
| `users` | `profile_image_url` | `profile_image_key` |
| `dm_messages` | `image_url` | `image_key` |

`tattoos`, `tattoo_designs`, `post_images`, `tattoo_collections`는 기존처럼 `images.image_id`를 참조한다.
프로필 이미지와 DM 첨부 이미지는 `images` 테이블에 등록하지 않고 각각 `users.profile_image_key`, `dm_messages.image_key`에 objectKey를 직접 저장한다.

## 업로드 흐름

1. 클라이언트가 `POST /v1/uploads/presigned-url`에 purpose, contentType, fileSize를 보낸다.
2. 서버가 사용자 ID가 포함된 충돌 불가능한 objectKey와 짧은 만료 시간의 Presigned PUT URL을 발급한다.
3. 클라이언트가 MinIO에 직접 PUT 한다.
4. 클라이언트가 도메인 API에 objectKey를 보낸다.
5. 서버가 objectKey prefix 소유권과 HEAD 존재 여부를 확인하고 MinIO에서 읽은 실제 크기·형식·디코딩 결과를 검증한다.
6. 검증에 성공하면 DB에는 objectKey만 기록한다. 실패하면 부적합한 MinIO 객체를 삭제하고 DB에는 기록하지 않는다.

`contentType`과 `fileSize`는 Presigned URL 발급 전의 1차 검증에만 사용한다. 업로드 후 도메인 API는 objectKey만 전달하며, 서버는 클라이언트가 선언한 메타데이터가 아니라 MinIO의 실제 객체를 다시 검사한다.

## 조회 흐름

도메인 Service가 차단·공개·소유권을 먼저 검사하고, 저장된 objectKey로 Presigned GET URL을 생성해 `imageUrl`로 반환한다. 이 URL은 만료되므로 클라이언트가 장기 저장하면 안 된다.

현재 `UnconfiguredObjectStorageAdapter`는 의도적으로 501을 반환한다. MinIO 연결 시 이 구현체만 교체한다.

## 프로필 이미지 API

- `POST /v1/auth/signup/profile-image/presigned-url`: Access Token 발급 전 signupToken으로 가입용 objectKey와 Presigned PUT URL을 발급한다.
- `POST /v1/auth/signup`: 선택적인 `profileImageKey`를 검증해 저장하며, 생략하면 환경설정의 공용 기본 objectKey를 저장한다.
- `PATCH /v1/users/me`: 닉네임·생년월일·성별만 수정한다.
- `PUT /v1/users/me/profile-image`: 업로드 완료 객체를 검증한 뒤 `users.profile_image_key`를 등록하거나 교체한다.
- `DELETE /v1/users/me/profile-image`: `users.profile_image_key`를 공용 기본 objectKey로 되돌린다.

가입 전 objectKey는 signupToken의 oauthProvider+oauthSubject와 연결된 짧은 TTL 업로드 Intent로 Redis 등에 저장할 예정이다. 프로필 이미지 등록·교체 과정에서는 `images` 행을 생성하지 않는다. 공용 기본 objectKey는 여러 회원이 재사용하고 삭제 대상에서 제외한다. 기존 사용자 지정 MinIO 객체의 실제 삭제는 스토리지 정리 정책으로 별도 처리한다.
