package com.starttoo.backend.coverup.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * 엔진 전용 RestClient. 공용 {@code RestClient.Builder} 는 read timeout 이 15초라
 * 검색 경로에 그대로 쓰면 엔진이 느려질 때 요청 스레드를 그만큼 붙잡는다.
 */
@Configuration
public class CoverupEngineHttpConfig {

    @Bean
    RestClient coverupSearchRestClient(CoverupProperties properties) {
        return restClient(properties.baseUrl(), properties.searchTimeout());
    }

    @Bean
    RestClient coverupIndexRestClient(CoverupProperties properties) {
        return restClient(properties.baseUrl(), properties.indexTimeout());
    }

    private RestClient restClient(String baseUrl, Duration timeout) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(timeout)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(timeout);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl(baseUrl)
                .build();
    }
}
