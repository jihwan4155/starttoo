package com.starttoo.domain.simulation.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public final class SimulationDtos {

    private SimulationDtos() {
    }

    public record CreateArSessionRequest(
            @NotNull @Schema(description = "AR에 사용할 tattoo_designs가 존재하는 타투 ID", example = "301") Long tattooId
    ) {
    }

    public record CreateArSessionResponse(
            String sessionId,
            Long tattooId,
            String designImageUrl,
            String status,
            String qrCodeImageUrl,
            String mobileCaptureUrl,
            String signalingUrl,
            String desktopSignalingToken,
            Instant expiresAt,
            Instant createdAt
    ) {
    }

    public record ConnectArSessionRequest(
            @NotBlank @Schema(description = "QR URL에서 전달받은 일회성 연결 토큰", example = "connect-token") String connectToken
    ) {
    }

    public record ConnectArSessionResponse(
            String sessionId,
            String status,
            Long tattooId,
            String designImageUrl,
            String signalingUrl,
            String mobileSignalingToken,
            Instant connectedAt,
            Instant expiresAt
    ) {
    }

    public record ArSessionResponse(
            String sessionId,
            Long tattooId,
            String status,
            String connectedPlatform,
            Instant connectedAt,
            Instant expiresAt
    ) {
    }

    public record CompositeImageResponse(
            String sessionId,
            Long tattooId,
            String compositedImageUrl,
            Instant createdAt
    ) {
    }

    public record CompositeImageRequest(
            @NotBlank @Schema(description = "합성할 신체 이미지의 업로드 완료 objectKey", example = "simulations/101/body.webp") String bodyImageObjectKey
    ) {
    }
}
