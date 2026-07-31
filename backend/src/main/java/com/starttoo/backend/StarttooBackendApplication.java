package com.starttoo.backend;

import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.common.config.CorsProperties;
import com.starttoo.backend.common.config.FirebaseProperties;
import com.starttoo.backend.common.config.JwtProperties;
import com.starttoo.backend.common.config.MinioProperties;
import com.starttoo.backend.common.config.OAuthProperties;
import com.starttoo.backend.common.ratelimit.RateLimitProperties;
import com.starttoo.backend.coverup.config.CoverupProperties;
import com.starttoo.backend.preference.config.PreferenceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@EnableConfigurationProperties({
        JwtProperties.class,
        MinioProperties.class,
        OAuthProperties.class,
        AiProperties.class,
        FirebaseProperties.class,
        RateLimitProperties.class,
        PreferenceProperties.class,
        CorsProperties.class,
        CoverupProperties.class
})
@SpringBootApplication
public class StarttooBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(StarttooBackendApplication.class, args);
    }
}
