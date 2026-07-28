package com.starttoo.domain.image.service;

import java.time.Instant;

public interface ObjectStoragePort {

    PresignedUpload createUpload(String purpose, String contentType, long fileSize, Long userId);

    /**
     * 아직 user_id가 없는 가입 단계에서 소셜 subject에 귀속된 업로드 Intent를 만든다.
     * 실제 구현은 짧은 TTL의 Intent를 Redis 등에 저장한 뒤 MinIO Presigned PUT을 발급한다.
     */
    PresignedUpload createSignupUpload(
            String contentType,
            long fileSize,
            String oauthProvider,
            String oauthSubject
    );

    String createDownloadUrl(String objectKey);

    /**
     * objectKey 소유권과 객체 존재 여부를 확인하고, MinIO에서 읽은 실제 크기와
     * 이미지 형식·디코딩 결과를 검증한다. 부적합 객체 삭제는 구현체가 담당한다.
     */
    void verifyUploadedObject(String objectKey, Long userId);

    /**
     * 회원가입 전 업로드한 객체가 소셜 계정의 업로드 Intent에 속하는지 검증한다.
     * 추후 Redis의 signup upload intent와 MinIO 객체 검증을 함께 구현한다.
     */
    void verifySignupUploadedObject(
            String objectKey,
            String oauthProvider,
            String oauthSubject
    );

    record PresignedUpload(
            String objectKey,
            String uploadUrl,
            String method,
            String contentType,
            Instant expiresAt
    ) {
    }
}
