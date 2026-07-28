package com.starttoo.domain.auth.dto;

import java.time.Instant;

public record AccessTokenResponse(
        String accessToken,
        String tokenType,
        Instant expiresAt
) {
}

