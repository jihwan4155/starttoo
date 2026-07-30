package com.starttoo.backend.auth.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

@Component
@RequiredArgsConstructor
public class SignupTokenConsumer {

    private final SignupTokenDecoder signupTokenDecoder;
    private final StringRedisTemplate redisTemplate;

    public Jwt consume(String token) {
        Jwt jwt = decode(token);
        String tokenId = jwt.getId();
        Instant expiresAt = jwt.getExpiresAt();
        Instant now = Instant.now();
        if (tokenId == null || tokenId.isBlank()
                || expiresAt == null || !expiresAt.isAfter(now)) {
            throw BusinessException.of(ErrorCode.INVALID_TOKEN);
        }

        try {
            Boolean consumed = redisTemplate.opsForValue().setIfAbsent(
                    consumedKey(tokenId),
                    "1",
                    Duration.between(now, expiresAt)
            );
            if (!Boolean.TRUE.equals(consumed)) {
                throw BusinessException.of(ErrorCode.INVALID_TOKEN);
            }
            return jwt;
        } catch (DataAccessException exception) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    private Jwt decode(String token) {
        try {
            Jwt jwt = signupTokenDecoder.decode(token);
            if (!"SIGNUP".equals(jwt.getClaimAsString("token_type"))) {
                throw BusinessException.of(ErrorCode.INVALID_TOKEN);
            }
            return jwt;
        } catch (JwtException exception) {
            throw BusinessException.of(ErrorCode.INVALID_TOKEN);
        }
    }

    private String consumedKey(String tokenId) {
        return "auth:signup:consumed:" + tokenId;
    }
}
