package com.starttoo.backend.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * 커밋 이후 작업용 실행기들.
 *
 * <p>여기서 명시적으로 정의한 실행기는 {@code spring.threads.virtual.enabled} 와
 * 무관하게 플랫폼 스레드를 쓴다. 의도한 것이다 — AI 추론 슬롯과 외부 푸시 왕복은
 * 경계 없는 동시성이 오히려 해로워서 풀 크기가 곧 부하 제어 수단이다.
 */
@Slf4j
@EnableAsync
@Configuration
public class RealtimeAsyncConfig {

    /**
     * 커밋 이후 WebSocket 전송이 HTTP 응답을 지연시키지 않도록 분리한다.
     * 이 실행기는 영속 큐가 아니므로 서버 장애 중 이벤트 재시도가 필요해지면
     * Transactional Outbox와 외부 브로커로 교체한다.
     */
    @Bean(name = "realtimeTaskExecutor")
    Executor realtimeTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(1000);
        executor.setThreadNamePrefix("realtime-");
        // 변경: 큐 포화 시 커밋 완료 요청에 잘못된 500을 반환하지 않고 호출 스레드가 처리한다.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        return executor;
    }

    /**
     * 푸시 발송 전용 실행기.
     *
     * <p>FCM 은 외부 HTTP 왕복이라 WebSocket 전달과 같은 풀을 쓰면 두 가지가 겹친다.
     * 실시간 메시지가 푸시 뒤에서 대기하고, 큐가 차면 CallerRunsPolicy 가 커밋을 마친
     * 요청 스레드에서 FCM 을 돌려 DM 전송 응답 시간에 푸시 왕복이 그대로 붙는다.
     * 그래서 풀을 분리하고, 네트워크 대기가 대부분이라 스레드를 넉넉히 준다.
     *
     * <p>포화 시에는 버린다. AbortPolicy 는 커밋 이후 리스너를 호출한 스레드로
     * 예외를 되돌려 이미 저장된 메시지에 500을 씌울 수 있고, 푸시 유실이 응답 지연보다
     * 낫다는 기존 판단(RealtimeDeliveryListener)과도 맞다. 대신 경고를 남긴다.
     */
    @Bean(name = "pushTaskExecutor")
    Executor pushTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(32);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("push-");
        executor.setRejectedExecutionHandler((task, pool) -> log.warn(
                "Push delivery rejected; queue is full. activeThreads={}, queuedTasks={}",
                pool.getActiveCount(),
                pool.getQueue().size()
        ));
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        return executor;
    }

    /**
     * AI 서버는 추론 슬롯이 전역 1개다. 워커를 늘리면 서로 슬롯을 다투다 실패하므로
     * 스레드 1개로 직렬화한다. 큐에 밀린 게시물은 순서대로 처리되고, 유실되더라도
     * post_images.classification_status 를 보는 백필 스케줄러가 최종적으로 처리한다.
     */
    @Bean(name = "postAiTaskExecutor")
    Executor postAiTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("post-ai-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        return executor;
    }
}
