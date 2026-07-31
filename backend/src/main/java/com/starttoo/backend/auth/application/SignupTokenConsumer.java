package com.starttoo.backend.auth.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;

@Component
@Slf4j
@RequiredArgsConstructor
public class SignupTokenConsumer {

    private final SignupTokenDecoder signupTokenDecoder;
    private final StringRedisTemplate redisTemplate;

    public Jwt validate(String token) {
        Jwt jwt = decode(token);
        String tokenId = jwt.getId();
        Instant expiresAt = jwt.getExpiresAt();
        Instant now = Instant.now();
        if (tokenId == null || tokenId.isBlank()
                || expiresAt == null || !expiresAt.isAfter(now)) {
            throw BusinessException.of(ErrorCode.INVALID_TOKEN);
        }

        try {
            if (Boolean.TRUE.equals(redisTemplate.hasKey(consumedKey(tokenId)))) {
                throw BusinessException.of(ErrorCode.INVALID_TOKEN);
            }
            return jwt;
        } catch (DataAccessException exception) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public void consumeAfterCommit(Jwt jwt) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            throw new IllegalStateException(
                    "Signup token consumption requires an active transaction synchronization"
            );
        }
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        markConsumed(jwt);
                    }
                }
        );
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

    private void markConsumed(Jwt jwt) {
        Instant expiresAt = jwt.getExpiresAt();
        Duration ttl = expiresAt == null
                ? Duration.ZERO
                : Duration.between(Instant.now(), expiresAt);
        if (ttl.isZero() || ttl.isNegative()) {
            return;
        }
        try {
            redisTemplate.opsForValue().set(
                    consumedKey(jwt.getId()),
                    "1",
                    ttl
            );
        } catch (DataAccessException exception) {
            // DB 가입은 이미 커밋됐다. OAuth provider subject 유일성으로 중복 가입을 막고
            // 이후 소셜 로그인에서 정상 토큰 발급이 가능하므로 응답을 실패시키지 않는다.
            log.error("Failed to mark signup token as consumed after commit", exception);
        }
    }

    private String consumedKey(String tokenId) {
        return "auth:signup:consumed:" + tokenId;
    }
}
