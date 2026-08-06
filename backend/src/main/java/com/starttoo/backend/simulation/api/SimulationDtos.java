package com.starttoo.backend.simulation.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class SimulationDtos {

    private SimulationDtos() {
    }

    public record CreateArSessionRequest(
            @Schema(
                    description = "PC 에서 미리 고른 도안 식별자 목록. GET /v1/tattoo-designs 의 tattooSeq 와 같다.",
                    example = "[501, 502]"
            )
            @Size(max = 50) List<Long> designSeqs
    ) {
    }

    public record CreateArSessionResponse(
            @Schema(description = "QR 에 실을 세션 식별자", example = "6f1c5c0e-6f0a-4f6e-9f1a-1b2c3d4e5f60")
            UUID sessionId,
            @Schema(description = "세션 만료까지 남은 초", example = "600")
            int expiresInSeconds,
            @Schema(description = "세션 만료 시각")
            OffsetDateTime expiresAt
    ) {
    }

    public record ConnectArSessionResponse(
            @Schema(description = "이 세션에서만 통하는 단기 토큰")
            String sessionToken,
            @Schema(description = "토큰과 세션이 만료되기까지 남은 초", example = "580")
            int expiresInSeconds,
            @Schema(description = "세션 만료 시각")
            OffsetDateTime expiresAt,
            @Schema(description = "PC 가 고른 도안 목록. 없으면 빈 배열")
            List<ArSessionDesignResponse> designs
    ) {
    }

    public record ArSessionDesignResponse(
            @Schema(description = "도안 식별자", example = "501")
            Long designSeq,
            @Schema(
                    description = "도안 이미지의 Presigned GET URL",
                    example = "https://minio.example.com/starttoo/design.png?X-Amz-Algorithm=AWS4-HMAC-SHA256"
            )
            String imageUrl
    ) {
    }

    public record CompositePresignRequest(
            @Schema(description = "업로드할 이미지 MIME 타입", example = "image/png",
                    allowableValues = {"image/jpeg", "image/png", "image/webp"})
            @NotBlank
            @Pattern(regexp = "image/(jpeg|png|webp)")
            String contentType,
            @Schema(description = "확장자를 포함한 원본 파일명", example = "ar-capture.png")
            @NotBlank @Size(max = 150) String originalFilename,
            @Schema(description = "업로드할 파일 크기(byte)", example = "1024000")
            @NotNull @Positive Long fileSize
    ) {
    }

    public record CompositePresignResponse(
            String objectKey,
            String uploadUrl,
            Map<String, String> requiredHeaders,
            int expiresInSeconds
    ) {
    }

    public record CreateCompositeRequest(
            @Schema(description = "presign 응답으로 받은 objectKey")
            @NotBlank @Size(max = 512) String objectKey
    ) {
    }

    public record CompositeResponse(
            @Schema(description = "합성 결과 식별자", example = "9001")
            Long compositeSeq,
            @Schema(description = "합성 결과 이미지 식별자", example = "3201")
            Long imageSeq,
            @Schema(description = "합성 결과 이미지의 Presigned GET URL")
            String imageUrl,
            @Schema(description = "업로드 시각")
            OffsetDateTime regDttm
    ) {
    }

    public record ArSessionStateResponse(
            @Schema(description = "세션 식별자")
            UUID sessionId,
            @Schema(description = "세션 상태", example = "CONNECTED")
            ArSessionStatus status,
            @Schema(description = "폰이 붙었는지 여부", example = "true")
            boolean phoneConnected,
            @Schema(description = "폰이 붙은 시각. 아직이면 null")
            OffsetDateTime phoneConnectedDttm,
            @Schema(description = "세션 만료 시각")
            OffsetDateTime expiresAt,
            @Schema(description = "만료까지 남은 초. 이미 만료·종료면 0", example = "412")
            int expiresInSeconds,
            @Schema(description = "PC 가 고른 도안 목록")
            List<ArSessionDesignResponse> designs,
            @Schema(description = "폰이 올린 합성 결과 목록. 오래된 순")
            List<CompositeResponse> composites
    ) {
    }

    /** DB 상태 3종에 만료 판정을 더한 화면용 상태다. */
    public enum ArSessionStatus {
        CREATED,
        CONNECTED,
        CLOSED,
        EXPIRED
    }

    public record RealtimeEvent(
            String eventId,
            SimulationEventType eventType,
            UUID sessionId,
            CompositeResponse composite,
            OffsetDateTime occurredDttm
    ) {
        public static RealtimeEvent phoneConnected(UUID sessionId) {
            return new RealtimeEvent(
                    UUID.randomUUID().toString(),
                    SimulationEventType.PHONE_CONNECTED,
                    sessionId,
                    null,
                    OffsetDateTime.now()
            );
        }

        public static RealtimeEvent compositeCreated(UUID sessionId, CompositeResponse composite) {
            return new RealtimeEvent(
                    UUID.randomUUID().toString(),
                    SimulationEventType.COMPOSITE_CREATED,
                    sessionId,
                    composite,
                    OffsetDateTime.now()
            );
        }

        public static RealtimeEvent sessionClosed(UUID sessionId) {
            return new RealtimeEvent(
                    UUID.randomUUID().toString(),
                    SimulationEventType.SESSION_CLOSED,
                    sessionId,
                    null,
                    OffsetDateTime.now()
            );
        }
    }

    public enum SimulationEventType {
        PHONE_CONNECTED,
        COMPOSITE_CREATED,
        SESSION_CLOSED
    }
}
