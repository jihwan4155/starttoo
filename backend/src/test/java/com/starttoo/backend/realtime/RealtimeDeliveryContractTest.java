package com.starttoo.backend.realtime;

import com.starttoo.backend.realtime.application.PushDeliveryListener;
import com.starttoo.backend.realtime.application.RealtimeDeliveryListener;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RealtimeDeliveryContractTest {

    @Test
    void realtimeDeliveryRunsAsynchronouslyOnlyAfterCommit() {
        assertDeliveredAfterCommitOn(
                RealtimeDeliveryListener.class,
                "deliver",
                "realtimeTaskExecutor"
        );
    }

    /**
     * 푸시는 외부 HTTP 왕복이라 WebSocket 전달과 실행기를 공유하면 실시간 메시지가 그
     * 뒤에서 밀린다. 풀 분리가 유지되는지 실행기 이름으로 고정한다.
     */
    @Test
    void pushDeliveryUsesItsOwnExecutor() {
        assertDeliveredAfterCommitOn(
                PushDeliveryListener.class,
                "deliver",
                "pushTaskExecutor"
        );
    }

    private void assertDeliveredAfterCommitOn(
            Class<?> listenerType,
            String methodPrefix,
            String executorName
    ) {
        List<Method> methods = Arrays.stream(listenerType.getDeclaredMethods())
                .filter(method -> method.getName().startsWith(methodPrefix))
                .toList();

        assertThat(methods).isNotEmpty();
        methods.forEach(method -> {
            TransactionalEventListener listener =
                    method.getAnnotation(TransactionalEventListener.class);
            Async async = method.getAnnotation(Async.class);

            assertThat(listener).isNotNull();
            assertThat(listener.phase()).isEqualTo(TransactionPhase.AFTER_COMMIT);
            assertThat(async).isNotNull();
            assertThat(async.value()).isEqualTo(executorName);
        });
    }
}
