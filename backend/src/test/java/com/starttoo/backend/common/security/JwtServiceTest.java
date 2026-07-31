package com.starttoo.backend.common.security;

import com.starttoo.backend.common.config.JwtProperties;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 실제 인코더로 토큰을 만들어 본다.
 *
 * 기존 테스트는 JwtService를 전부 목으로 대체해, 서명 알고리즘을 지정하지 않으면
 * NimbusJwtEncoder가 RS256을 기본값으로 잡아 HMAC 키에서 서명 키를 못 찾는 문제를
 * 잡아내지 못했다. 실제 로그인·가입 요청에서만 500으로 드러났다.
 */
class JwtServiceTest {

    private final JwtProperties properties = new JwtProperties(
            "starttoo",
            "test-secret-key-that-is-at-least-32-bytes-long",
            Duration.ofMinutes(30),
            Duration.ofMinutes(10),
            Duration.ofDays(30)
    );

    private final JwtConfig config = new JwtConfig();
    private final SecretKey key = config.jwtSecretKey(properties);
    private final JwtConfig.JwtService jwtService =
            new JwtConfig.JwtService(config.jwtEncoder(key), properties);
    private final JwtDecoder decoder = config.rawJwtDecoder(key, properties);

    @Test
    void encodesAccessTokenWithHmacKey() {
        JwtConfig.TokenValue token = jwtService.createAccessToken(1, "USER");

        Jwt decoded = decoder.decode(token.value());
        assertThat(decoded.getSubject()).isEqualTo("1");
        assertThat(decoded.getClaimAsString("role")).isEqualTo("USER");
        assertThat(decoded.getClaimAsString("token_type")).isEqualTo("ACCESS");
        assertThat(decoded.getHeaders().get("alg")).hasToString("HS256");
    }

    @Test
    void encodesSignupTokenWithHmacKey() {
        JwtConfig.TokenValue token = jwtService.createTypedToken(
                "kakao-subject-1",
                "SIGNUP",
                Duration.ofMinutes(10),
                Map.of("provider", "KAKAO")
        );

        Jwt decoded = decoder.decode(token.value());
        assertThat(decoded.getSubject()).isEqualTo("kakao-subject-1");
        assertThat(decoded.getClaimAsString("token_type")).isEqualTo("SIGNUP");
        assertThat(decoded.getClaimAsString("provider")).isEqualTo("KAKAO");
        assertThat(decoded.getId()).isNotBlank();
        assertThat(decoded.getHeaders().get("alg")).hasToString("HS256");
    }
}
