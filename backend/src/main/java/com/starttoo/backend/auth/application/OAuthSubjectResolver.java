package com.starttoo.backend.auth.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.starttoo.backend.common.config.OAuthProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Locale;

@Component
public class OAuthSubjectResolver {

    private final RestClient restClient;
    private final OAuthProperties properties;

    public OAuthSubjectResolver(RestClient.Builder builder, OAuthProperties properties) {
        this.restClient = builder.build();
        this.properties = properties;
    }

    public OAuthSubject resolve(String provider, String accessToken) {
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
        } catch (RestClientException | NullPointerException exception) {
            throw new BusinessException(
                    ErrorCode.OAUTH_AUTHENTICATION_FAILED,
                    "OAuth 제공자의 회원 식별자를 확인하지 못했습니다."
            );
        }
    }

    private String text(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field) || node.get(field).asText().isBlank()) {
            throw BusinessException.of(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
        }
        return node.get(field).asText();
    }

    public record OAuthSubject(String providerCode, String providerSubject) {
    }
}
