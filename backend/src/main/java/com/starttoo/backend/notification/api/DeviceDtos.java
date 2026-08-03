package com.starttoo.backend.notification.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class DeviceDtos {

    private DeviceDtos() {
    }

    public record RegisterDeviceRequest(
            @Schema(
                    description = "Firebase Installations SDK가 발급한 Firebase Installation ID",
                    example = "c1234567890abcdefghijk"
            )
            @NotBlank @Size(max = 128) String fid,
            @Schema(description = "클라이언트 플랫폼", example = "ANDROID",
                    allowableValues = {"WEB", "ANDROID", "IOS"})
            @NotBlank @Pattern(regexp = "WEB|ANDROID|IOS") String platform,
            @Schema(description = "현재 세션의 기기 연결 대상 리프레시 토큰")
            @NotBlank @Size(max = 512) String refreshToken
    ) {
    }

    public record DeviceResponse(
            Long deviceSeq,
            String platform,
            boolean active,
            OffsetDateTime lastUsedDttm
    ) {
    }
}
