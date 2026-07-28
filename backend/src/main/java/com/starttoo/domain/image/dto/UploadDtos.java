package com.starttoo.domain.image.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;

public final class UploadDtos {

    private UploadDtos() {
    }

    public record PresignedUploadRequest(
            @NotBlank @Schema(description = "업로드 용도. 서버가 objectKey prefix와 정책을 결정하는 데 사용", example = "POST_IMAGE") String purpose,
            @NotBlank @Schema(description = "업로드할 실제 이미지 MIME", allowableValues = {"image/jpeg", "image/png", "image/webp"}, example = "image/webp") String contentType,
            @Min(1) @Max(10_485_760) @Schema(description = "업로드할 파일 크기(byte), 최대 10MB", example = "1852043") long fileSize
    ) {
    }

    public record PresignedUploadResponse(
            String objectKey,
            String uploadUrl,
            String method,
            String contentType,
            Instant expiresAt
    ) {
    }
}
