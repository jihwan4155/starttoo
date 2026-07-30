package com.starttoo.backend.media.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.Map;

public final class MediaDtos {

    private MediaDtos() {
    }

    public record PresignUploadRequest(
            @Schema(description = "업로드할 이미지 MIME 타입", example = "image/png",
                    allowableValues = {"image/jpeg", "image/png", "image/webp"})
            @NotBlank
            @Pattern(regexp = "image/(jpeg|png|webp)")
            String contentType,
            @Schema(description = "확장자를 포함한 원본 파일명", example = "rose-tattoo.png")
            @NotBlank @Size(max = 150) String originalFilename
    ) {
    }

    public record PresignUploadResponse(
            String objectKey,
            String uploadUrl,
            Map<String, String> requiredHeaders,
            int expiresInSeconds
    ) {
    }

    public record CompleteUploadRequest(
            @Schema(description = "presign 응답으로 받은 objectKey")
            @NotBlank @Size(max = 512) String objectKey
    ) {
    }

    public record ImageResponse(
            Long imageSeq,
            String objectKey,
            String downloadUrl,
            OffsetDateTime regDttm
    ) {
    }
}
