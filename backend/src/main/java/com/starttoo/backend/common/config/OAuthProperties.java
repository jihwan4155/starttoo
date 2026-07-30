package com.starttoo.backend.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.oauth")
public record OAuthProperties(Provider google, Provider kakao) {

    public record Provider(
            String clientId,
            String clientSecret,
            String tokenUri,
            String userInfoUri
    ) {
    }
}
