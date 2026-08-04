package com.starttoo.backend.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.ai")
public record AiProperties(
        boolean enabled,
        String baseUrl,
        String tattooDetectionPath,
        String tattooAnalysisPath,
        String tattooBatchAnalysisPath,
        String generationPath,
        String coverupPath,
        String simulationPath,
        // 배치 분석은 이미지를 한 장씩 순차로 추론하므로 장수에 비례해 시간이 늘어난다.
        // 공용 RestClient 의 15초 read timeout 을 쓰면 두 장부터 타임아웃하므로
        // perImage × 장수 + overhead 로 계산한 전용 타임아웃을 사용한다.
        Duration batchTimeoutPerImage,
        Duration batchTimeoutOverhead,
        // 분류 백필 스케줄러. 비동기 워커가 실패하거나 서버가 재시작돼도
        // PENDING·FAILED 로 남은 게시물 이미지를 이 잡이 최종적으로 처리한다.
        String classificationBackfillCron,
        int classificationMaxAttempts,
        int classificationBackfillBatchSize,
        Duration classificationRetryDelay
) {
}
