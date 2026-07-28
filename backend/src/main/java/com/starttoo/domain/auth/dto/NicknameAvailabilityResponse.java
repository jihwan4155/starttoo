package com.starttoo.domain.auth.dto;

public record NicknameAvailabilityResponse(
        String nickname,
        boolean available
) {
}

