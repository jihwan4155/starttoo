package com.starttoo.backend.auth;

import com.starttoo.backend.auth.application.PhoneVerificationService;
import com.starttoo.backend.auth.application.PhoneNumberNormalizer;
import com.starttoo.backend.auth.application.SmsGateway;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PhoneVerificationServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private PhoneNumberNormalizer phoneNumberNormalizer;
    @Mock
    private Environment environment;
    @Mock
    private SmsGateway smsGateway;
    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private PhoneVerificationService phoneVerificationService;

    @Test
    void verifiedPhoneTokenCanBeConsumedOnlyOnce() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.getAndDelete("auth:phone:verified:phone-token"))
                .thenReturn("+821012345678", (String) null);

        assertThat(phoneVerificationService.consume("phone-token"))
                .isEqualTo("+821012345678");
        assertThatThrownBy(() -> phoneVerificationService.consume("phone-token"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.PHONE_VERIFICATION_REQUIRED));
    }

    @Test
    void responseContractsExposeAbsoluteExpiryWithoutPhoneNumber() {
        assertThat(componentNames(PhoneVerificationService.VerificationRequested.class))
                .containsExactly("requestId", "expiresAt", "debugCode");
        assertThat(componentNames(PhoneVerificationService.VerificationConfirmed.class))
                .containsExactly("phoneVerificationToken", "expiresAt");
    }

    private String[] componentNames(Class<? extends Record> type) {
        return Arrays.stream(type.getRecordComponents())
                .map(component -> component.getName())
                .toArray(String[]::new);
    }
}
