package com.starttoo.domain.auth.oauth;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

@Component
public class GoogleOAuthClient implements SocialOAuthClient {

    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;

    public GoogleOAuthClient(
            RestClient.Builder builder,
            @Value("${app.oauth.google.client-id}") String clientId,
            @Value("${app.oauth.google.client-secret}") String clientSecret
    ) {
        this.restClient = builder.build();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    @Override
    public String provider() {
        return "GOOGLE";
    }

    @Override
    public SocialProfile exchange(String authorizationCode, String redirectUri) {
        OAuthClientSupport.requireConfigured(clientId);
        OAuthClientSupport.requireConfigured(clientSecret);
        try {
            var form = new LinkedMultiValueMap<String, String>();
            form.add("grant_type", "authorization_code");
            form.add("client_id", clientId);
            form.add("client_secret", clientSecret);
            form.add("redirect_uri", redirectUri);
            form.add("code", authorizationCode);

            GoogleToken token = restClient.post()
                    .uri("https://oauth2.googleapis.com/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(GoogleToken.class);
            if (token == null || token.accessToken() == null) {
                throw new IllegalStateException("Google access token is missing");
            }

            GoogleUser user = restClient.get()
                    .uri("https://openidconnect.googleapis.com/v1/userinfo")
                    .headers(headers -> headers.setBearerAuth(token.accessToken()))
                    .retrieve()
                    .body(GoogleUser.class);
            if (user == null || user.subject() == null) {
                throw new IllegalStateException("Google user id is missing");
            }
            return new SocialProfile(provider(), user.subject(), user.email());
        } catch (Exception exception) {
            throw OAuthClientSupport.translate(exception);
        }
    }

    private record GoogleToken(@JsonProperty("access_token") String accessToken) {
    }

    private record GoogleUser(@JsonProperty("sub") String subject, String email) {
    }
}
