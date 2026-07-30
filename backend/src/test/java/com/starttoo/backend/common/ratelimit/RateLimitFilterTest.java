package com.starttoo.backend.common.ratelimit;

import com.starttoo.backend.common.error.ApiErrorWriter;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RateLimitFilterTest {

    @Test
    void phoneVerificationEndpointsUseSeparateStrongerLimits() throws Exception {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        ApiErrorWriter errorWriter = mock(ApiErrorWriter.class);
        FilterChain chain = mock(FilterChain.class);
        when(redisTemplate.execute(
                any(RedisScript.class),
                anyList(),
                any()
        )).thenReturn(1L);
        RateLimitProperties properties = new RateLimitProperties(
                60,
                Duration.ofMinutes(1),
                20,
                Duration.ofMinutes(1),
                5,
                Duration.ofMinutes(1),
                10,
                Duration.ofMinutes(1)
        );
        RateLimitFilter filter = new RateLimitFilter(
                redisTemplate,
                properties,
                errorWriter
        );

        MockHttpServletResponse requestResponse = execute(
                filter,
                chain,
                "/v1/auth/phone/verifications"
        );
        MockHttpServletResponse confirmResponse = execute(
                filter,
                chain,
                "/v1/auth/phone/verifications/confirm"
        );

        assertThat(requestResponse.getHeader("X-RateLimit-Limit")).isEqualTo("5");
        assertThat(confirmResponse.getHeader("X-RateLimit-Limit")).isEqualTo("10");
    }

    private MockHttpServletResponse execute(
            RateLimitFilter filter,
            FilterChain chain,
            String uri
    ) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", uri);
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }
}
