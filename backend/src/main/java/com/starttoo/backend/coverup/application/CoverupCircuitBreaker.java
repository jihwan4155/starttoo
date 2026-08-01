package com.starttoo.backend.coverup.application;

import com.starttoo.backend.coverup.config.CoverupProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 엔진 장애가 요청 스레드를 계속 붙잡지 않게 막는 최소 서킷브레이커.
 *
 * <p>연속 실패가 임계치에 닿으면 일정 시간 호출 자체를 건너뛰고 즉시 503을 준다.
 * 열린 시간이 지나면 한 건을 흘려보내 회복을 확인한다(반열림).
 *
 * <p>엔진이 준 4xx는 실패로 세지 않는다. 그건 우리가 보낸 값이 틀렸다는 뜻이지
 * 엔진이 죽었다는 뜻이 아니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CoverupCircuitBreaker {

    private final CoverupProperties properties;
    private final AtomicInteger consecutiveFailures = new AtomicInteger();
    private final AtomicLong openUntil = new AtomicLong();

    public boolean isOpen() {
        long deadline = openUntil.get();
        if (deadline == 0L) {
            return false;
        }
        if (System.currentTimeMillis() < deadline) {
            return true;
        }
        if (openUntil.compareAndSet(deadline, 0L)) {
            consecutiveFailures.set(0);
            log.info("Coverup engine circuit half-open; allowing a probe call");
        }
        return false;
    }

    public void recordSuccess() {
        consecutiveFailures.set(0);
        openUntil.set(0L);
    }

    public void recordFailure() {
        int failures = consecutiveFailures.incrementAndGet();
        if (failures < properties.circuitFailureThreshold()) {
            return;
        }
        long deadline = System.currentTimeMillis() + properties.circuitOpenDuration().toMillis();
        openUntil.set(deadline);
        log.warn(
                "Coverup engine circuit opened after {} consecutive failures for {}",
                failures,
                properties.circuitOpenDuration()
        );
    }
}
