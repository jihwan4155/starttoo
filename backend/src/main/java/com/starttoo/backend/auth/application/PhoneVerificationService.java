package com.starttoo.backend.auth.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PhoneVerificationService {

    private static final Duration CODE_TTL = Duration.ofMinutes(3);
    private static final Duration VERIFIED_TTL = Duration.ofMinutes(10);
    private static final DefaultRedisScript<String> CONFIRM_SCRIPT =
            new DefaultRedisScript<>("""
                    local value = redis.call('GET', KEYS[1])
                    if not value then
                        return nil
                    end
                    if string.sub(value, -6) ~= ARGV[1] then
                        return ''
                    end
                    local phone = string.sub(value, 1, string.len(value) - 7)
                    redis.call('DEL', KEYS[1])
                    redis.call('SET', KEYS[2], phone, 'EX', ARGV[2])
                    return phone
                    """, String.class);

    private final StringRedisTemplate redisTemplate;
    private final PhoneNumberNormalizer phoneNumberNormalizer;
    private final Environment environment;
    private final SmsGateway smsGateway;
    private final SecureRandom random = new SecureRandom();

    public VerificationRequested request(String rawPhoneNumber) {
        String phoneNumber = phoneNumberNormalizer.normalizeKorean(rawPhoneNumber);
        String requestId = UUID.randomUUID().toString();
        String code = "%06d".formatted(random.nextInt(1_000_000));
        boolean local = Arrays.asList(environment.getActiveProfiles()).contains("local");
        if (local) {
            log.info("Local SMS verification code. requestId={}, phoneNumber={}, code={}",
                    requestId, mask(phoneNumber), code);
        } else {
            smsGateway.sendVerificationCode(phoneNumber, code);
        }
        redisTemplate.opsForValue().set(codeKey(requestId), phoneNumber + ":" + code, CODE_TTL);
        return new VerificationRequested(
                requestId,
                Instant.now().plus(CODE_TTL),
                local ? code : null
        );
    }

    public VerificationConfirmed confirm(String requestId, String code) {
        String token = UUID.randomUUID().toString();
        String phoneNumber = redisTemplate.execute(
                CONFIRM_SCRIPT,
                List.of(codeKey(requestId), verifiedKey(token)),
                code,
                Long.toString(VERIFIED_TTL.toSeconds())
        );
        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw BusinessException.of(ErrorCode.PHONE_VERIFICATION_FAILED);
        }
        return new VerificationConfirmed(token, Instant.now().plus(VERIFIED_TTL));
    }

    public String consume(String verificationToken) {
        String phoneNumber = redisTemplate.opsForValue()
                .getAndDelete(verifiedKey(verificationToken));
        if (phoneNumber == null) {
            throw BusinessException.of(ErrorCode.PHONE_VERIFICATION_REQUIRED);
        }
        return phoneNumber;
    }

    private String codeKey(String requestId) {
        return "auth:phone:code:" + requestId;
    }

    private String verifiedKey(String token) {
        return "auth:phone:verified:" + token;
    }

    private String mask(String value) {
        return value.length() <= 6
                ? "******"
                : value.substring(0, 4) + "****" + value.substring(value.length() - 3);
    }

    public record VerificationRequested(String requestId, Instant expiresAt, String debugCode) {
    }

    public record VerificationConfirmed(
            String phoneVerificationToken,
            Instant expiresAt
    ) {
    }
}
