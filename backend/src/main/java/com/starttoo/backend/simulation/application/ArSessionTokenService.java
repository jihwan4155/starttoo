package com.starttoo.backend.simulation.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.common.security.JwtConfig;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/**
 * 비로그인 폰이 쓰는 세션 전용 토큰을 발급·검증한다.
 *
 * <p>액세스 토큰과 같은 키로 서명하지만 {@code token_type} 이 {@code AR_SESSION} 이라
 * 기본 {@link JwtDecoder}(ACCESS 만 통과)를 쓰는 리소스 서버 경로에서는 절대 인증되지
 * 않는다. 즉 이 토큰이 새어도 다른 API 를 회원 자격으로 호출할 수 없다.
 */
@Component
public class ArSessionTokenService {

    public static final String TOKEN_TYPE = "AR_SESSION";
    private static final String SCHEME = "Session ";

    private final JwtConfig.JwtService jwtService;
    private final JwtDecoder decoder;

    public ArSessionTokenService(
            JwtConfig.JwtService jwtService,
            @Qualifier("rawJwtDecoder") JwtDecoder decoder
    ) {
        this.jwtService = jwtService;
        this.decoder = decoder;
    }

    public IssuedToken issue(UUID sessionId, Integer ownerSeq, Duration ttl) {
        UUID tokenId = UUID.randomUUID();
        JwtConfig.TokenValue token = jwtService.createTypedToken(
                sessionId.toString(),
                TOKEN_TYPE,
                ttl,
                Map.of(
                        "jti", tokenId.toString(),
                        "ownerSeq", ownerSeq
                )
        );
        return new IssuedToken(token.value(), tokenId);
    }

    /**
     * {@code Authorization: Session {token}} 헤더를 검증한다.
     * 서명·만료·토큰 종류·대상 세션이 하나라도 어긋나면 401 로 끝낸다.
     */
    public UUID verify(String authorizationHeader, UUID sessionId) {
        if (authorizationHeader == null || !authorizationHeader.startsWith(SCHEME)) {
            throw BusinessException.of(ErrorCode.UNAUTHORIZED);
        }
        String value = authorizationHeader.substring(SCHEME.length()).trim();
        if (value.isEmpty()) {
            throw BusinessException.of(ErrorCode.UNAUTHORIZED);
        }
        Jwt jwt;
        try {
            jwt = decoder.decode(value);
        } catch (JwtException exception) {
            throw BusinessException.of(ErrorCode.INVALID_TOKEN);
        }
        if (!TOKEN_TYPE.equals(jwt.getClaimAsString("token_type"))
                || !sessionId.toString().equals(jwt.getSubject())) {
            throw BusinessException.of(ErrorCode.INVALID_TOKEN);
        }
        try {
            return UUID.fromString(jwt.getId());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw BusinessException.of(ErrorCode.INVALID_TOKEN);
        }
    }

    public record IssuedToken(String value, UUID tokenId) {
    }
}
