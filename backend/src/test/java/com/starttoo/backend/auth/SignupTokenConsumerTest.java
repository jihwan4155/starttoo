package com.starttoo.backend.auth;

import com.starttoo.backend.auth.application.SignupTokenConsumer;
import com.starttoo.backend.auth.application.SignupTokenDecoder;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void signupTokenCanBeConsumedOnlyOnce() {
        Jwt jwt = signupJwt();
        when(signupTokenDecoder.decode("signup-token")).thenReturn(jwt);
        when(valueOperations.setIfAbsent(
                eq("auth:signup:consumed:token-id"),
                eq("1"),
                any(Duration.class)
        )).thenReturn(true, false);

        assertThat(signupTokenConsumer.consume("signup-token")).isSameAs(jwt);
        assertThatThrownBy(() -> signupTokenConsumer.consume("signup-token"))
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
