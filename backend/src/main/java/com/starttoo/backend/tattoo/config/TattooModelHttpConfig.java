package com.starttoo.backend.tattoo.config;

import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.tattoo.application.TattooModelRestClientFactory;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * 타투 모델 전용 RestClient 팩토리. 공용 {@code RestClient.Builder} 의 read timeout 은
 * 15초라 배치 분석에 그대로 쓰면 두 장부터 타임아웃한다. 배치는 이미지를 한 장씩
 * 순차로 추론하므로 타임아웃도 장수에 비례해야 한다.
 */
@Configuration
public class TattooModelHttpConfig {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);

    /**
     * 요청 팩토리는 반드시 Boot 의 {@link ClientHttpRequestFactoryBuilder} 로 만든다.
     * {@code JdkClientHttpRequestFactory} 를 직접 만들어 공유 {@code HttpClient} 만 넘기면
     * 본문을 쓰는 executor 가 없어 요청 body 가 빈 채로 전송된다. 실제로 AI 서버가
     * 422 {@code {"loc":["body"],"msg":"Field required"}} 를 돌려주며 전량 실패했다.
     */
    @Bean
    TattooModelRestClientFactory tattooModelRestClientFactory(
            RestClient.Builder builder,
            AiProperties properties
    ) {
        return readTimeout -> builder.clone()
                .requestFactory(ClientHttpRequestFactoryBuilder.detect()
                        .build(ClientHttpRequestFactorySettings.defaults()
                                .withConnectTimeout(CONNECT_TIMEOUT)
                                .withReadTimeout(readTimeout)))
                .baseUrl(properties.baseUrl())
                .build();
    }
}
