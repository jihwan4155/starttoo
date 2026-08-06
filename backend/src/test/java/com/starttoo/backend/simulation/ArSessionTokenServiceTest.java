package com.starttoo.backend.simulation;

import com.starttoo.backend.common.config.JwtProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.common.security.JwtConfig;
import com.starttoo.backend.simulation.application.ArSessionTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ArSessionTokenServiceTest {

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
    private final ArSessionTokenService tokenService = new ArSessionTokenService(
            jwtService,
            config.rawJwtDecoder(key, properties)
    );

    @Test
    void issuedTokenCarriesSessionSubjectAndMatchingTokenId() {
        UUID sessionId = UUID.randomUUID();

        ArSessionTokenService.IssuedToken issued =
                tokenService.issue(sessionId, 7, Duration.ofMinutes(10));

        assertThat(tokenService.verify("Session " + issued.value(), sessionId))
                .isEqualTo(issued.tokenId());
    }

    /**
     * 세션 토큰이 리소스 서버 경로에서 액세스 토큰처럼 쓰이면 비로그인 폰이 회원 API 를
     * 전부 열게 된다. 기본 디코더가 ACCESS 만 통과시키는지 토큰 종류로 고정한다.
     */
    @Test
    void issuedTokenIsRejectedByTheAccessTokenDecoder() {
        ArSessionTokenService.IssuedToken issued =
                tokenService.issue(UUID.randomUUID(), 7, Duration.ofMinutes(10));
        JwtDecoder accessDecoder = config.jwtDecoder(key, properties);

        assertThatThrownBy(() -> accessDecoder.decode(issued.value()))
                .hasMessageContaining("token_type");
    }

    @Test
    void tokenOfAnotherSessionIsRejected() {
        ArSessionTokenService.IssuedToken issued =
                tokenService.issue(UUID.randomUUID(), 7, Duration.ofMinutes(10));
        UUID otherSessionId = UUID.randomUUID();

        assertThatThrownBy(() -> tokenService.verify("Session " + issued.value(), otherSessionId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_TOKEN);
    }

    @Test
    void bearerSchemeIsNotAcceptedForSessionEndpoints() {
        UUID sessionId = UUID.randomUUID();
        ArSessionTokenService.IssuedToken issued =
                tokenService.issue(sessionId, 7, Duration.ofMinutes(10));

        assertThatThrownBy(() -> tokenService.verify("Bearer " + issued.value(), sessionId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.UNAUTHORIZED);
    }

    @Test
    void missingAuthorizationHeaderIsUnauthorized() {
        assertThatThrownBy(() -> tokenService.verify(null, UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.UNAUTHORIZED);
    }
}
