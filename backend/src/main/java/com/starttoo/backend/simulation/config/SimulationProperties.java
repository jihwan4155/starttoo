package com.starttoo.backend.simulation.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * AR 시뮬레이션 세션 정책값.
 *
 * @param sessionTtl        세션·sessionToken 수명. QR 을 띄워두고 폰을 꺼내는 시간만 감안한다.
 * @param maxDesigns        PC 가 세션에 담을 수 있는 도안 수
 * @param maxComposites     세션 하나가 받을 수 있는 업로드 횟수 상한
 * @param designUrlExpiry   폰에 내려주는 도안 Presigned GET URL 만료. 세션 수명보다 길게 잡는다.
 */
@ConfigurationProperties(prefix = "app.simulation")
public record SimulationProperties(
        Duration sessionTtl,
        int maxDesigns,
        int maxComposites,
        Duration designUrlExpiry
) {
}
