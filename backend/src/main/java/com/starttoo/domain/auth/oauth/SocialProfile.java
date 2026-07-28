package com.starttoo.domain.auth.oauth;

public record SocialProfile(
        String provider,
        String subject,
        String email
) {
}
