package com.starttoo.domain.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public final class TestAuthDtos {

    private TestAuthDtos() {
    }

    public record TestLoginRequest(
            @NotNull
            @Positive
            @Schema(description = "JWT를 발급받을 기존 회원 ID", example = "1")
            Long userId
    ) {
    }

    public record TestLoginResponse(
            @Schema(description = "인증 요청에 사용할 Access Token")
            String accessToken,
            @Schema(description = "Authorization 헤더의 인증 방식", example = "Bearer")
            String tokenType,
            @Schema(description = "Access Token 유효 시간(초)", example = "1800")
            long expiresIn,
            TestUser user
    ) {
    }

    public record TestUser(
            Long userId,
            String nickname,
            String role,
            String accountStatus
    ) {
    }
}
