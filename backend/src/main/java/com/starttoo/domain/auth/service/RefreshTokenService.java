package com.starttoo.domain.auth.service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.domain.auth.entity.RefreshTokenEntity;
import com.starttoo.domain.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final SecureRandom random = new SecureRandom();
    private final Clock clock = Clock.systemUTC();

    @Value("${app.security.jwt.refresh-token-seconds}")
    private long refreshTokenSeconds;

    @Transactional
    public IssuedRefreshToken issue(Long userId, Long deviceId) {
        byte[] tokenBytes = new byte[64];
        random.nextBytes(tokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        LocalDateTime expiresAt = now().plusSeconds(refreshTokenSeconds);
        refreshTokenRepository.save(RefreshTokenEntity.builder()
                .userId(userId)
                .deviceId(deviceId)
                .tokenHash(hash(rawToken))
                .expiresAt(expiresAt)
                .build());
        return new IssuedRefreshToken(rawToken, expiresAt);
    }

    @Transactional
    public RotatedRefreshToken rotate(String rawToken) {
        RefreshTokenEntity current = refreshTokenRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID));
        LocalDateTime now = now();
        if (current.getRevokedAt() != null) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_REUSED);
        }
        if (!current.getExpiresAt().isAfter(now)) {
            current.revoke(now);
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_EXPIRED);
        }
        current.rotate(now);
        IssuedRefreshToken next = issue(current.getUserId(), current.getDeviceId());
        return new RotatedRefreshToken(
                current.getUserId(), current.getDeviceId(), next.token(), next.expiresAt()
        );
    }

    @Transactional
    public void revoke(String rawToken, Long expectedUserId) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(hash(rawToken)).ifPresent(token -> {
            if (token.getUserId().equals(expectedUserId)) {
                token.revoke(now());
            }
        });
    }

    @Transactional
    public void revokeAll(Long userId) {
        LocalDateTime now = now();
        refreshTokenRepository.findAllByUserIdAndRevokedAtIsNull(userId)
                .forEach(token -> token.revoke(now));
    }

    private String hash(String token) {
        if (token == null || token.isBlank()) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    public record IssuedRefreshToken(String token, LocalDateTime expiresAt) {
    }

    public record RotatedRefreshToken(
            Long userId,
            Long deviceId,
            String token,
            LocalDateTime expiresAt
    ) {
    }
}
