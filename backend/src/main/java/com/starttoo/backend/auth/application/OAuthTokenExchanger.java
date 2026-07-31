package com.starttoo.backend.auth.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.starttoo.backend.common.config.OAuthProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.Locale;
import java.util.concurrent.TimeoutException;

/**
 * 웹 프론트엔드가 넘긴 authorization code를 제공자 액세스 토큰으로 교환한다.
 *
 * <p>카카오 JavaScript SDK는 브라우저에 액세스 토큰을 주지 않고 authorization code까지만
 * 돌려주며, 코드를 토큰으로 바꾸려면 REST API 키가 필요하다. 이 키는 서버 전용이므로
 * 교환은 반드시 백엔드에서 수행한다. 구글도 동일한 표준 흐름을 지원해 같은 방식으로 처리한다.
 *
 * <p>네이티브 앱 SDK는 액세스 토큰을 직접 발급받으므로 이 단계를 거치지 않는다.
 */
@Component
public class OAuthTokenExchanger {

    private final RestClient restClient;
    private final OAuthProperties properties;

    public OAuthTokenExchanger(RestClient.Builder builder, OAuthProperties properties) {
        this.restClient = builder.build();
        this.properties = properties;
    }

    public String exchange(String provider, String authorizationCode, String redirectUri) {
        if (provider == null) {
            throw BusinessException.of(ErrorCode.INVALID_OAUTH_PROVIDER);
        }
        String normalized = provider.toUpperCase(Locale.ROOT);
        OAuthProperties.Provider config = switch (normalized) {
            case "GOOGLE" -> properties.google();
            case "KAKAO" -> properties.kakao();
            default -> throw BusinessException.of(ErrorCode.INVALID_OAUTH_PROVIDER);
        };
        if (config == null || isBlank(config.clientId()) || isBlank(config.tokenUri())) {
            // 자격 증명이 주입되지 않은 환경 — 클라이언트 잘못이 아니므로 503으로 구분한다.
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", config.clientId());
        form.add("redirect_uri", redirectUri);
        form.add("code", authorizationCode);
        if (!isBlank(config.clientSecret())) {
            form.add("client_secret", config.clientSecret());
        }

        try {
            JsonNode response = restClient.post()
                    .uri(config.tokenUri())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
            if (response == null
                    || !response.hasNonNull("access_token")
                    || response.get("access_token").asText().isBlank()) {
                throw BusinessException.of(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
            }
            return response.get("access_token").asText();
        } catch (RestClientResponseException exception) {
            // 만료·재사용된 코드, redirect_uri 불일치는 모두 4xx로 떨어진다.
            int status = exception.getStatusCode().value();
            if (status == 400 || status == 401 || status == 403) {
                throw BusinessException.of(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
            }
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        } catch (ResourceAccessException exception) {
            if (hasTimeoutCause(exception)) {
                throw BusinessException.of(ErrorCode.PROCESSING_TIMEOUT);
            }
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        } catch (RestClientException exception) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean hasTimeoutCause(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof SocketTimeoutException
                    || current instanceof HttpTimeoutException
                    || current instanceof TimeoutException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
