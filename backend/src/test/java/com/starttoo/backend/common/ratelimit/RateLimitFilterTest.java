package com.starttoo.backend.common.ratelimit;

import com.starttoo.backend.common.error.ApiErrorWriter;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Duration;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RateLimitFilterTest {

    @Test
    void phoneAvailabilityUsesStrongIpAndHashedNumberBuckets() throws Exception {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        ApiErrorWriter errorWriter = mock(ApiErrorWriter.class);
        FilterChain chain = mock(FilterChain.class);
        when(redisTemplate.execute(
                any(RedisScript.class),
                anyList(),
                any()
        )).thenReturn(1L);
        RateLimitFilter filter = new RateLimitFilter(
                redisTemplate,
                properties(),
                errorWriter
        );
        MockHttpServletRequest request =
                new MockHttpServletRequest("GET", "/v1/auth/phones/availability");
        request.setRemoteAddr("127.0.0.1");
        request.setParameter("phoneNumber", "010-1234-5678");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("5");
        verify(redisTemplate, times(2)).execute(
                any(RedisScript.class),
                anyList(),
                eq("60000")
        );
        @SuppressWarnings("rawtypes")
        org.mockito.ArgumentCaptor<List> keys =
                org.mockito.ArgumentCaptor.forClass(List.class);
        verify(redisTemplate, times(2)).execute(
                any(RedisScript.class),
                keys.capture(),
                any()
        );
        assertThat(keys.getAllValues().toString())
                .contains("rate-limit:ip:127.0.0.1:phone-availability")
                .contains("rate-limit:phone:")
                .doesNotContain("01012345678")
                .doesNotContain("+821012345678");
    }

    @Test
    void coverupShapeSearchUsesItsOwnBucketInsteadOfMutationLimit() throws Exception {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        ApiErrorWriter errorWriter = mock(ApiErrorWriter.class);
        FilterChain chain = mock(FilterChain.class);
        when(redisTemplate.execute(
                any(RedisScript.class),
                anyList(),
                any()
        )).thenReturn(1L);
        RateLimitFilter filter = new RateLimitFilter(
                redisTemplate,
                properties(),
                errorWriter
        );
        MockHttpServletRequest request =
                new MockHttpServletRequest("POST", "/v1/designs/search-by-shape");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        // 조회성 요청이므로 등록·수정용 mutation 한도(20)가 아니라 자체 한도(30)를 쓴다.
        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("30");
        @SuppressWarnings("rawtypes")
        org.mockito.ArgumentCaptor<List> keys =
                org.mockito.ArgumentCaptor.forClass(List.class);
        verify(redisTemplate).execute(
                any(RedisScript.class),
                keys.capture(),
                any()
        );
        assertThat(keys.getValue().toString()).contains("coverup-search");
    }

    @Test
    void arSessionEntryPointsUseTheirOwnIpBucket() throws Exception {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        ApiErrorWriter errorWriter = mock(ApiErrorWriter.class);
        FilterChain chain = mock(FilterChain.class);
        when(redisTemplate.execute(
                any(RedisScript.class),
                anyList(),
                any()
        )).thenReturn(1L);
        RateLimitFilter filter = new RateLimitFilter(
                redisTemplate,
                properties(),
                errorWriter
        );
        MockHttpServletRequest request = new MockHttpServletRequest(
                "POST",
                "/v1/simulations/ar-sessions/6f1c5c0e-6f0a-4f6e-9f1a-1b2c3d4e5f60/connect"
        );
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        // 비로그인 진입점이라 회원 mutation 한도(20)가 아니라 자체 한도(15)를 쓴다.
        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("15");
        @SuppressWarnings("rawtypes")
        org.mockito.ArgumentCaptor<List> keys =
                org.mockito.ArgumentCaptor.forClass(List.class);
        verify(redisTemplate).execute(
                any(RedisScript.class),
                keys.capture(),
                any()
        );
        assertThat(keys.getValue().toString())
                .contains("rate-limit:ip:127.0.0.1:ar-session");
    }

    @Test
    void dmMutationsUseTheirOwnBucketInsteadOfTheSharedMutationLimit() throws Exception {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        ApiErrorWriter errorWriter = mock(ApiErrorWriter.class);
        FilterChain chain = mock(FilterChain.class);
        when(redisTemplate.execute(
                any(RedisScript.class),
                anyList(),
                any()
        )).thenReturn(1L);
        RateLimitFilter filter = new RateLimitFilter(
                redisTemplate,
                properties(),
                errorWriter
        );
        MockHttpServletRequest request =
                new MockHttpServletRequest("POST", "/v1/dm/rooms/1/messages");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        // 게시·좋아요와 같은 mutation 한도(20)가 아니라 채팅 자체 한도(40)를 쓴다.
        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("40");
        @SuppressWarnings("rawtypes")
        org.mockito.ArgumentCaptor<List> keys =
                org.mockito.ArgumentCaptor.forClass(List.class);
        verify(redisTemplate).execute(
                any(RedisScript.class),
                keys.capture(),
                any()
        );
        assertThat(keys.getValue().toString())
                .contains(":dm")
                .doesNotContain("mutation");
    }

    @Test
    void dmReadsStayOnTheSharedReadBucket() throws Exception {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        ApiErrorWriter errorWriter = mock(ApiErrorWriter.class);
        FilterChain chain = mock(FilterChain.class);
        when(redisTemplate.execute(
                any(RedisScript.class),
                anyList(),
                any()
        )).thenReturn(1L);
        RateLimitFilter filter = new RateLimitFilter(
                redisTemplate,
                properties(),
                errorWriter
        );
        MockHttpServletRequest request =
                new MockHttpServletRequest("GET", "/v1/dm/rooms/1/messages");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("60");
        @SuppressWarnings("rawtypes")
        org.mockito.ArgumentCaptor<List> keys =
                org.mockito.ArgumentCaptor.forClass(List.class);
        verify(redisTemplate).execute(
                any(RedisScript.class),
                keys.capture(),
                any()
        );
        assertThat(keys.getValue().toString()).contains(":read");
    }

    @Test
    void exemptAccountSkipsCountingEntirely() throws Exception {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        ApiErrorWriter errorWriter = mock(ApiErrorWriter.class);
        FilterChain chain = mock(FilterChain.class);
        RateLimitFilter filter = new RateLimitFilter(
                redisTemplate,
                properties(),
                errorWriter
        );
        authenticateAs("8");
        MockHttpServletRequest request =
                new MockHttpServletRequest("POST", "/v1/posts");
        MockHttpServletResponse response = new MockHttpServletResponse();

        try {
            filter.doFilter(request, response, chain);
        } finally {
            SecurityContextHolder.clearContext();
        }

        // 카운트 자체를 건너뛰므로 Redis 호출도, 잔여 한도 헤더도 없다.
        verify(redisTemplate, never()).execute(any(RedisScript.class), anyList(), any());
        verify(chain).doFilter(request, response);
        assertThat(response.getHeader("X-RateLimit-Limit")).isNull();
    }

    @Test
    void nonExemptAccountStillCounts() throws Exception {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        ApiErrorWriter errorWriter = mock(ApiErrorWriter.class);
        FilterChain chain = mock(FilterChain.class);
        when(redisTemplate.execute(
                any(RedisScript.class),
                anyList(),
                any()
        )).thenReturn(1L);
        RateLimitFilter filter = new RateLimitFilter(
                redisTemplate,
                properties(),
                errorWriter
        );
        authenticateAs("9");
        MockHttpServletRequest request =
                new MockHttpServletRequest("POST", "/v1/posts");
        MockHttpServletResponse response = new MockHttpServletResponse();

        try {
            filter.doFilter(request, response, chain);
        } finally {
            SecurityContextHolder.clearContext();
        }

        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("20");
        @SuppressWarnings("rawtypes")
        org.mockito.ArgumentCaptor<List> keys =
                org.mockito.ArgumentCaptor.forClass(List.class);
        verify(redisTemplate).execute(
                any(RedisScript.class),
                keys.capture(),
                any()
        );
        assertThat(keys.getValue().toString()).contains("rate-limit:user:9:mutation");
    }

    private void authenticateAs(String userSeq) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(userSeq)
                .build();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
        SecurityContextHolder.setContext(context);
    }

    private RateLimitProperties properties() {
        return new RateLimitProperties(
                60,
                Duration.ofMinutes(1),
                20,
                Duration.ofMinutes(1),
                5,
                Duration.ofMinutes(1),
                30,
                Duration.ofMinutes(1),
                15,
                Duration.ofMinutes(1),
                40,
                Duration.ofMinutes(1),
                Set.of(8L)
        );
    }
}
