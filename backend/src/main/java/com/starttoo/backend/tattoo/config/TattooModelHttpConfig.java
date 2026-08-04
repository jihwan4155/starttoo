package com.starttoo.backend.tattoo.config;

import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.tattoo.application.TattooModelRestClientFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * 타투 모델 전용 RestClient 팩토리. 공용 {@code RestClient.Builder} 의 read timeout 은
 * 15초라 배치 분석에 그대로 쓰면 두 장부터 타임아웃한다. 배치는 이미지를 한 장씩
 * 순차로 추론하므로 타임아웃도 장수에 비례해야 한다.
 */
@Configuration
public class TattooModelHttpConfig {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);

    @Bean
    TattooModelRestClientFactory tattooModelRestClientFactory(AiProperties properties) {
        // 커넥션 풀을 유지하려고 HttpClient 는 한 번만 만들어 공유한다.
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
        return readTimeout -> {
            // 호출마다 새로 만드는 것은 factory 객체뿐이다. 공유 상태를 변경하지 않으므로
            // 여러 워커 스레드가 서로 다른 타임아웃으로 동시에 호출해도 안전하다.
            JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
            factory.setReadTimeout(readTimeout);
            return RestClient.builder()
                    .requestFactory(factory)
                    .baseUrl(properties.baseUrl())
                    .build();
        };
    }
}
