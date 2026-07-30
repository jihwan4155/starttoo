package com.starttoo.backend.auth.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.starttoo.backend.common.config.OAuthProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;

import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.Locale;
import java.util.concurrent.TimeoutException;

@Component
public class OAuthSubjectResolver {

    private final RestClient restClient;
    private final OAuthProperties properties;

    public OAuthSubjectResolver(RestClient.Builder builder, OAuthProperties properties) {
        this.restClient = builder.build();
        this.properties = properties;
    }

    public OAuthSubject resolve(String provider, String accessToken) {
        if (provider == null) {
            throw BusinessException.of(ErrorCode.INVALID_OAUTH_PROVIDER);
        }
        String normalized = provider.toUpperCase(Locale.ROOT);
        String uri = switch (normalized) {
            case "GOOGLE" -> properties.google().userInfoUri();
            case "KAKAO" -> properties.kakao().userInfoUri();
            default -> throw BusinessException.of(ErrorCode.INVALID_OAUTH_PROVIDER);
        };
        try {
            JsonNode response = restClient.get()
                    .uri(uri)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(JsonNode.class);
            String subject = switch (normalized) {
                case "GOOGLE" -> text(response, "sub");
                case "KAKAO" -> text(response, "id");
                default -> throw BusinessException.of(ErrorCode.INVALID_OAUTH_PROVIDER);
            };
            return new OAuthSubject(normalized, subject);
        } catch (RestClientResponseException exception) {
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

    private String text(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field) || node.get(field).asText().isBlank()) {
            throw BusinessException.of(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
        }
        return node.get(field).asText();
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

    public record OAuthSubject(String providerCode, String providerSubject) {
    }
}
