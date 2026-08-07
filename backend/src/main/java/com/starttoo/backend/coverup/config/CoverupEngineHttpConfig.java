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

    /**
     * ★ HTTP/1.1 을 못 박는다.
     *
     * <p>{@code HttpClient.newBuilder()} 의 기본값은 HTTP/2 라, 평문 http 상대에게는
     * 요청마다 {@code Upgrade: h2c} 를 붙여 HTTP/2 로 올려달라고 시도한다. 엔진은
     * uvicorn(h11) 이라 HTTP/1.1 만 말한다 — 업그레이드를 거절하면서
     * {@code Unsupported upgrade request.} 를 남기고, 이어서 요청 파싱이 어긋나
     * {@code Invalid HTTP request received.} 400 을 돌려준다. 그 400 은 엔진이 준
     * 사유로 그대로 전달되어 화면에는 "이미지를 처리할 수 없어요" 로만 보인다.
     *
     * <p>버전을 고정하면 업그레이드 시도 자체가 사라진다(로컬 uvicorn 으로 확인:
     * 기본값이면 경고가 뜨고, HTTP_1_1 이면 경고가 없다).
     */
    private RestClient restClient(String baseUrl, Duration timeout) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
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
