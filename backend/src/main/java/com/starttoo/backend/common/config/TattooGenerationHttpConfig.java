package com.starttoo.backend.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class TattooGenerationHttpConfig {

    @Bean
    RestClient tattooGenerationRestClient(
            RestClient.Builder builder,
            AiProperties properties,
            @Value("${app.ai.generation-timeout:10m}") Duration generationTimeout
    ) {
        return builder.clone()
                .requestFactory(ClientHttpRequestFactoryBuilder.detect()
                        .build(ClientHttpRequestFactorySettings.defaults()
                                .withConnectTimeout(generationTimeout)
                                .withReadTimeout(generationTimeout)))
                .baseUrl(properties.baseUrl())
                .build();
    }
}
