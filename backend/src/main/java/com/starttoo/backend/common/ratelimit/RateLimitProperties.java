package com.starttoo.backend.common.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.rate-limit")
public record RateLimitProperties(
        long defaultCapacity,
        Duration defaultWindow,
        long mutationCapacity,
        Duration mutationWindow,
        long phoneVerificationRequestCapacity,
        Duration phoneVerificationRequestWindow,
        long phoneVerificationConfirmCapacity,
        Duration phoneVerificationConfirmWindow
) {
}
