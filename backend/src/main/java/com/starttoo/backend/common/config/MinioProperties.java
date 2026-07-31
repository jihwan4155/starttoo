package com.starttoo.backend.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.minio")
public record MinioProperties(
        String endpoint,
        String publicEndpoint,
        String accessKey,
        String secretKey,
        String bucket,
        long maxImageBytes,
        Duration uploadExpiry,
        Duration downloadExpiry
) {
}
