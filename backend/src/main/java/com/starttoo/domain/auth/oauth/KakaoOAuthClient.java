package com.starttoo.domain.auth.oauth;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

@Component
public class KakaoOAuthClient implements SocialOAuthClient {

    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;

    public KakaoOAuthClient(
            RestClient.Builder builder,
            @Value("${app.oauth.kakao.client-id}") String clientId,
            @Value("${app.oauth.kakao.client-secret:}") String clientSecret
    ) {
        this.restClient = builder.build();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    @Override
    public String provider() {
        return "KAKAO";
    }

    @Override
    public SocialProfile exchange(String authorizationCode, String redirectUri) {
        OAuthClientSupport.requireConfigured(clientId);
        try {
            var form = new LinkedMultiValueMap<String, String>();
            form.add("grant_type", "authorization_code");
            form.add("client_id", clientId);
            form.add("redirect_uri", redirectUri);
            form.add("code", authorizationCode);
            if (clientSecret != null && !clientSecret.isBlank()) {
                form.add("client_secret", clientSecret);
            }

            KakaoToken token = restClient.post()
                    .uri("https://kauth.kakao.com/oauth/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(KakaoToken.class);
            if (token == null || token.accessToken() == null) {
                throw new IllegalStateException("Kakao access token is missing");
            }

            KakaoUser user = restClient.get()
                    .uri("https://kapi.kakao.com/v2/user/me")
                    .headers(headers -> headers.setBearerAuth(token.accessToken()))
                    .retrieve()
                    .body(KakaoUser.class);
            if (user == null || user.id() == null) {
                throw new IllegalStateException("Kakao user id is missing");
            }
            return new SocialProfile(
                    provider(),
                    String.valueOf(user.id()),
                    user.account() == null ? null : user.account().email()
            );
        } catch (Exception exception) {
            throw OAuthClientSupport.translate(exception);
        }
    }

    private record KakaoToken(@JsonProperty("access_token") String accessToken) {
    }

    private record KakaoUser(Long id, @JsonProperty("kakao_account") KakaoAccount account) {
    }

    private record KakaoAccount(String email) {
    }
}
