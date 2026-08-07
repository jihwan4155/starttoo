package com.starttoo.backend.common.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.Set;

@ConfigurationProperties(prefix = "app.rate-limit")
public record RateLimitProperties(
        long defaultCapacity,
        Duration defaultWindow,
        long mutationCapacity,
        Duration mutationWindow,
        long phoneAvailabilityCapacity,
        Duration phoneAvailabilityWindow,
        long coverupSearchCapacity,
        Duration coverupSearchWindow,
        long arSessionCapacity,
        Duration arSessionWindow,
        long dmCapacity,
        Duration dmWindow,
        Set<Long> exemptUserSeqs
) {
}
