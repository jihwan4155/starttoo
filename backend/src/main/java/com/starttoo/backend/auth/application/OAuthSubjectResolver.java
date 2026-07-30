package com.starttoo.backend.auth.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.starttoo.backend.common.config.OAuthProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
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

    public OAuthSubject resolve(String provider, String authorizationCode, String redirectUri) {
        String normalized = provider.toUpperCase(Locale.ROOT);
        String accessToken = exchangeAuthorizationCode(normalized, authorizationCode, redirectUri);
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

    private String exchangeAuthorizationCode(
            String provider,
            String authorizationCode,
            String redirectUri
    ) {
        OAuthProperties.Provider config = providerConfig(provider);
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", config.clientId());
        form.add("code", authorizationCode);
        form.add("redirect_uri", redirectUri);
        if (hasText(config.clientSecret())) {
            form.add("client_secret", config.clientSecret());
        }

        try {
            JsonNode response = restClient.post()
                    .uri(config.tokenUri())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
            return text(response, "access_token");
        } catch (RestClientException | NullPointerException exception) {
            throw new BusinessException(
                    ErrorCode.OAUTH_AUTHENTICATION_FAILED,
                    "OAuth authorization code exchange failed."
            );
        }
    }

    private OAuthProperties.Provider providerConfig(String provider) {
        return switch (provider) {
            case "GOOGLE" -> properties.google();
            case "KAKAO" -> properties.kakao();
            default -> throw BusinessException.of(ErrorCode.INVALID_OAUTH_PROVIDER);
        };
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
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
