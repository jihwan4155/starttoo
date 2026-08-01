package com.starttoo.backend.coverup.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * 커버업 도안 검색 엔진 연동 설정.
 *
 * <p>{@code app.ai.*} 의 AI 서비스와는 별개의 서비스다. 엔진은 내부 전용이므로
 * 외부에 노출하지 않고, 네트워크 격리가 어려우면 {@code internal-token} 으로 막는다.
 */
@ConfigurationProperties(prefix = "app.coverup")
public record CoverupProperties(
        /* false면 엔진을 호출하지 않는다. 검색은 503, 색인 동기화는 건너뛴다. */
        boolean enabled,
        String baseUrl,
        /* 비어 있지 않으면 X-Internal-Token 헤더로 붙인다. */
        String internalToken,
        /* 검색 경로 타임아웃. 유저가 기다리는 경로라 짧게 잡는다. */
        Duration searchTimeout,
        /* 색인 경로 타임아웃. 최대 10MB 이미지를 올리므로 검색보다 길게 잡는다. */
        Duration indexTimeout,
        /* 엔진에 요청할 개수. 삭제 지연·중복 제거로 빠지는 몫을 감안해 결과 수보다 크게 잡는다. */
        int engineTopK,
        /* 프론트에 돌려줄 개수. */
        int resultSize,
        /* 마스크 base64 문자열 상한. 엔진의 COVERUP_MAX_MASK_BODY 와 같은 값이어야 한다. */
        int maxMaskBase64Bytes,
        /* 결과 이미지 Presigned URL 만료. 결과 화면을 열어둔 채 자리를 비워도 살아 있어야 한다. */
        Duration presignExpiry,
        /* 연속 실패가 이 횟수에 도달하면 서킷을 연다. */
        int circuitFailureThreshold,
        /* 서킷이 열려 있는 시간. */
        Duration circuitOpenDuration,
        /* 색인 동기화 스캔 1회가 처리할 최대 건수. */
        int indexSyncBatchSize
) {
}
