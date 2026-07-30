package com.starttoo.backend.auth.application;

import com.starttoo.backend.common.config.SmsProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

@Component
public class SmsGateway {

    private final RestClient restClient;
    private final SmsProperties properties;

    public SmsGateway(RestClient.Builder builder, SmsProperties properties) {
        this.restClient = builder.build();
        this.properties = properties;
    }

    public void sendVerificationCode(String phoneNumber, String code) {
        if (properties.webhookUrl() == null || properties.webhookUrl().isBlank()) {
            throw new BusinessException(
                    ErrorCode.SERVICE_UNAVAILABLE,
                    "SMS_WEBHOOK_URL이 설정되지 않았습니다."
            );
        }
        try {
            var request = restClient.post()
                    .uri(properties.webhookUrl())
                    .body(Map.of(
                            "phoneNumber", phoneNumber,
                            "verificationCode", code
                    ));
            if (properties.apiKey() != null && !properties.apiKey().isBlank()) {
                request.header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey());
            }
            request.retrieve().toBodilessEntity();
        } catch (RestClientException exception) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
    }
}
