package com.starttoo.backend.coverup;

import com.starttoo.backend.coverup.application.CoverupCircuitBreaker;
import com.starttoo.backend.coverup.config.CoverupProperties;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class CoverupCircuitBreakerTest {

    @Test
    void opensOnlyAfterConsecutiveFailuresReachTheThreshold() {
        CoverupCircuitBreaker breaker = breaker(Duration.ofSeconds(30));

        breaker.recordFailure();
        breaker.recordFailure();

        assertThat(breaker.isOpen()).isFalse();

        breaker.recordFailure();

        assertThat(breaker.isOpen()).isTrue();
    }

    @Test
    void successResetsTheFailureStreak() {
        CoverupCircuitBreaker breaker = breaker(Duration.ofSeconds(30));

        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordSuccess();
        breaker.recordFailure();
        breaker.recordFailure();

        assertThat(breaker.isOpen()).isFalse();
    }

    @Test
    void allowsAProbeCallOnceTheOpenWindowElapses() throws InterruptedException {
        CoverupCircuitBreaker breaker = breaker(Duration.ofMillis(80));
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordFailure();
        assertThat(breaker.isOpen()).isTrue();

        Thread.sleep(120);

        assertThat(breaker.isOpen()).isFalse();
    }

    private CoverupCircuitBreaker breaker(Duration openDuration) {
        return new CoverupCircuitBreaker(new CoverupProperties(
                true,
                "http://coverup-engine.test",
                "",
                Duration.ofSeconds(3),
                Duration.ofSeconds(30),
                24,
                16,
                102400,
                Duration.ofHours(1),
                3,
                openDuration,
                50
        ));
    }
}
