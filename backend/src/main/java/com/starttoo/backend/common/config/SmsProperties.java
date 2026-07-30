package com.starttoo.backend.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.sms")
public record SmsProperties(String webhookUrl, String apiKey) {
}
