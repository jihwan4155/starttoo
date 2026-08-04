package com.starttoo.backend.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
public class TattooGenerationHttpConfig {

    @Bean
    RestClient tattooGenerationRestClient(
            AiProperties properties,
            @Value("${app.ai.generation-timeout:10m}") Duration generationTimeout
    ) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(generationTimeout)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(generationTimeout);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl(properties.baseUrl())
                .build();
    }
}
