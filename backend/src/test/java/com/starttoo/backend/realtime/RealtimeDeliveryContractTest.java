package com.starttoo.backend.realtime;

import com.starttoo.backend.realtime.application.RealtimeDeliveryListener;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class RealtimeDeliveryContractTest {

    @Test
    void realtimeDeliveryRunsAsynchronouslyOnlyAfterCommit() {
        Arrays.stream(RealtimeDeliveryListener.class.getDeclaredMethods())
                .filter(method -> method.getName().startsWith("deliver"))
                .forEach(method -> {
                    TransactionalEventListener listener =
                            method.getAnnotation(TransactionalEventListener.class);
                    Async async = method.getAnnotation(Async.class);

                    assertThat(listener).isNotNull();
                    assertThat(listener.phase()).isEqualTo(TransactionPhase.AFTER_COMMIT);
                    assertThat(async).isNotNull();
                    assertThat(async.value()).isEqualTo("realtimeTaskExecutor");
                });
    }
}
