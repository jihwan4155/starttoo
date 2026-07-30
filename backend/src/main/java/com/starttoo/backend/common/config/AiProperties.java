package com.starttoo.backend.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.ai")
public record AiProperties(
        boolean enabled,
        String baseUrl,
        String tattooDetectionPath,
        String tattooAnalysisPath,
        String generationPath,
        String coverupPath,
        String simulationPath
) {
}
