package com.starttoo.backend.notification.application;

import com.starttoo.backend.auth.application.RefreshTokenHasher;
import com.starttoo.backend.auth.domain.RefreshToken;
import com.starttoo.backend.auth.domain.RefreshTokenRepository;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.notification.api.DeviceDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class DeviceService {

    private final JdbcTemplate jdbcTemplate;
    private final RefreshTokenRepository refreshTokenRepository;
    private final RefreshTokenHasher refreshTokenHasher;

    @Transactional
    public DeviceDtos.DeviceResponse register(
            Integer userSeq,
            DeviceDtos.RegisterDeviceRequest request
    ) {
        List<Long> deviceSeqs = jdbcTemplate.queryForList("""
                INSERT INTO user_devices (
                    user_seq, push_token, platform, is_active, last_used_dttm
                ) VALUES (?, ?, ?, TRUE, CURRENT_TIMESTAMP)
                ON CONFLICT (push_token)
                DO UPDATE SET
                    user_seq = EXCLUDED.user_seq,
                    platform = EXCLUDED.platform,
                    is_active = TRUE,
                    last_used_dttm = CURRENT_TIMESTAMP,
                    mod_dttm = CURRENT_TIMESTAMP
                WHERE user_devices.user_seq = EXCLUDED.user_seq
                   OR user_devices.is_active = FALSE
                RETURNING device_seq
                """, Long.class, userSeq, request.pushToken(), request.platform());
        if (deviceSeqs.isEmpty()) {
            throw new BusinessException(
                    ErrorCode.STATE_CONFLICT,
                    "다른 활성 계정에 연결된 푸시 토큰입니다."
            );
        }
        Long deviceSeq = deviceSeqs.get(0);
        RefreshToken refreshToken = refreshTokenRepository
                .findByTokenHashForUpdate(refreshTokenHasher.hash(request.refreshToken()))
                .filter(token -> token.usableAt(OffsetDateTime.now()))
                .filter(token -> token.getUserSeq().equals(userSeq))
                .orElseThrow(() -> BusinessException.of(ErrorCode.INVALID_TOKEN));
        if (refreshToken.getDeviceSeq() != null
                && !Objects.equals(refreshToken.getDeviceSeq(), deviceSeq)) {
            // 변경: FCM 토큰 회전으로 새 deviceSeq가 생기면 이전 푸시 연결을 닫고 재연결한다.
            jdbcTemplate.update("""
                    UPDATE user_devices
                       SET is_active = FALSE, mod_dttm = CURRENT_TIMESTAMP
                     WHERE device_seq = ? AND user_seq = ?
                    """, refreshToken.getDeviceSeq(), userSeq);
        }
        refreshToken.attachDevice(deviceSeq);
        return find(userSeq, deviceSeq);
    }

    @Transactional(readOnly = true)
    public List<DeviceDtos.DeviceResponse> list(Integer userSeq) {
        return jdbcTemplate.query("""
                SELECT device_seq, platform, is_active, last_used_dttm
                  FROM user_devices
                 WHERE user_seq = ?
                 ORDER BY device_seq DESC
                """, (rs, rowNum) -> new DeviceDtos.DeviceResponse(
                rs.getLong("device_seq"),
                rs.getString("platform"),
                rs.getBoolean("is_active"),
                rs.getObject("last_used_dttm", OffsetDateTime.class)
        ), userSeq);
    }

    @Transactional
    public void deactivate(Integer userSeq, Long deviceSeq) {
        int changed = jdbcTemplate.update("""
                UPDATE user_devices
                   SET is_active = FALSE, mod_dttm = CURRENT_TIMESTAMP
                 WHERE device_seq = ? AND user_seq = ?
                """, deviceSeq, userSeq);
        if (changed == 0) {
            throw BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND);
        }
        jdbcTemplate.update("""
                UPDATE refresh_tokens
                   SET revoked_dttm = CURRENT_TIMESTAMP
                 WHERE device_seq = ? AND revoked_dttm IS NULL
                """, deviceSeq);
    }

    /**
     * 로그아웃한 현재 세션의 기기를 푸시 대상에서 즉시 제외한다.
     * 리프레시 토큰 폐기는 AuthService가 같은 트랜잭션에서 처리한다.
     */
    @Transactional
    public void deactivateForLogout(Integer userSeq, Long deviceSeq) {
        jdbcTemplate.update("""
                UPDATE user_devices
                   SET is_active = FALSE, mod_dttm = CURRENT_TIMESTAMP
                 WHERE device_seq = ? AND user_seq = ?
                """, deviceSeq, userSeq);
    }

    @Transactional(readOnly = true)
    public List<String> activePushTokens(Integer userSeq) {
        return jdbcTemplate.queryForList("""
                SELECT push_token
                  FROM user_devices
                 WHERE user_seq = ?
                   AND is_active = TRUE
                 ORDER BY device_seq
                """, String.class, userSeq);
    }

    @Transactional
    public void deactivateInvalidPushTokens(Integer userSeq, List<String> pushTokens) {
        if (pushTokens == null || pushTokens.isEmpty()) {
            return;
        }
        jdbcTemplate.batchUpdate("""
                UPDATE user_devices
                   SET is_active = FALSE, mod_dttm = CURRENT_TIMESTAMP
                 WHERE user_seq = ? AND push_token = ?
                """, pushTokens, pushTokens.size(), (statement, pushToken) -> {
            statement.setInt(1, userSeq);
            statement.setString(2, pushToken);
        });
    }

    private DeviceDtos.DeviceResponse find(Integer userSeq, Long deviceSeq) {
        List<DeviceDtos.DeviceResponse> values = jdbcTemplate.query("""
                SELECT device_seq, platform, is_active, last_used_dttm
                  FROM user_devices
                 WHERE device_seq = ? AND user_seq = ?
                """, (rs, rowNum) -> new DeviceDtos.DeviceResponse(
                rs.getLong("device_seq"),
                rs.getString("platform"),
                rs.getBoolean("is_active"),
                rs.getObject("last_used_dttm", OffsetDateTime.class)
        ), deviceSeq, userSeq);
        if (values.isEmpty()) {
            throw BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND);
        }
        return values.get(0);
    }
}
