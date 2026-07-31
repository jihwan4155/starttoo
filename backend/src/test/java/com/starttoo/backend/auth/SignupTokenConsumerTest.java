package com.starttoo.backend.auth;

import com.starttoo.backend.auth.application.SignupTokenConsumer;
import com.starttoo.backend.auth.application.SignupTokenDecoder;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SignupTokenConsumerTest {

    @Mock
    private SignupTokenDecoder signupTokenDecoder;
    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private SignupTokenConsumer signupTokenConsumer;

    @Test
    void validationDoesNotConsumeTokenBeforeDatabaseCommit() {
        Jwt jwt = signupJwt();
        when(signupTokenDecoder.decode("signup-token")).thenReturn(jwt);
        when(redisTemplate.hasKey("auth:signup:consumed:token-id")).thenReturn(false);

        assertThat(signupTokenConsumer.validate("signup-token")).isSameAs(jwt);

        verify(valueOperations, never()).set(
                eq("auth:signup:consumed:token-id"),
                eq("1"),
                any(Duration.class)
        );
    }

    @Test
    void tokenIsMarkedConsumedOnlyAfterCommitCallback() {
        Jwt jwt = org.mockito.Mockito.mock(Jwt.class);
        when(jwt.getId()).thenReturn("token-id");
        when(jwt.getExpiresAt()).thenReturn(Instant.now().plusSeconds(600));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        TransactionSynchronizationManager.initSynchronization();
        try {
            signupTokenConsumer.consumeAfterCommit(jwt);

            verify(valueOperations, never()).set(
                    eq("auth:signup:consumed:token-id"),
                    eq("1"),
                    any(Duration.class)
            );
            TransactionSynchronizationManager.getSynchronizations()
                    .forEach(TransactionSynchronization::afterCommit);
            verify(valueOperations).set(
                    eq("auth:signup:consumed:token-id"),
                    eq("1"),
                    any(Duration.class)
            );
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void consumedSignupTokenIsRejectedDuringValidation() {
        Jwt jwt = signupJwt();
        when(signupTokenDecoder.decode("signup-token")).thenReturn(jwt);
        when(redisTemplate.hasKey("auth:signup:consumed:token-id")).thenReturn(true);

        assertThatThrownBy(() -> signupTokenConsumer.validate("signup-token"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_TOKEN));
    }

    private Jwt signupJwt() {
        Jwt jwt = org.mockito.Mockito.mock(Jwt.class);
        when(jwt.getClaimAsString("token_type")).thenReturn("SIGNUP");
        when(jwt.getId()).thenReturn("token-id");
        when(jwt.getExpiresAt()).thenReturn(Instant.now().plusSeconds(600));
        return jwt;
    }
}
