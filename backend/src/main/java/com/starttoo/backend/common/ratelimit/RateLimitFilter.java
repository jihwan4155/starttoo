package com.starttoo.backend.common.ratelimit;

import com.starttoo.backend.common.error.ApiErrorWriter;
import com.starttoo.backend.common.error.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.List;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private static final DefaultRedisScript<Long> SCRIPT = new DefaultRedisScript<>("""
            local current = redis.call('INCR', KEYS[1])
            if current == 1 then
              redis.call('PEXPIRE', KEYS[1], ARGV[1])
            end
            return current
            """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final RateLimitProperties properties;
    private final ApiErrorWriter errorWriter;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri.startsWith("/swagger-ui")
                || uri.startsWith("/v3/api-docs")
                || uri.startsWith("/actuator");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Limit limit = resolveLimit(request);
        String key = "rate-limit:" + resolveClientKey(request) + ":" + limit.bucket();
        try {
            Long count = redisTemplate.execute(
                    SCRIPT,
                    List.of(key),
                    Long.toString(limit.window().toMillis())
            );
            long used = count == null ? 0 : count;
            response.setHeader("X-RateLimit-Limit", Long.toString(limit.capacity()));
            response.setHeader(
                    "X-RateLimit-Remaining",
                    Long.toString(Math.max(0, limit.capacity() - used))
            );
            if (used > limit.capacity()) {
                errorWriter.write(response, ErrorCode.RATE_LIMITED);
                return;
            }
        } catch (RuntimeException exception) {
            // Rate Limit 장애가 전체 API 장애로 확산되지 않게 Redis 장애 시에는 통과시킨다.
            log.warn("Rate limit Redis unavailable; request allowed");
        }
        filterChain.doFilter(request, response);
    }

    private Limit resolveLimit(HttpServletRequest request) {
        boolean mutation = !HttpMethod.GET.matches(request.getMethod())
                && !HttpMethod.HEAD.matches(request.getMethod())
                && !HttpMethod.OPTIONS.matches(request.getMethod());
        if (mutation) {
            return new Limit(
                    properties.mutationCapacity(),
                    properties.mutationWindow(),
                    "mutation"
            );
        }
        return new Limit(
                properties.defaultCapacity(),
                properties.defaultWindow(),
                "read"
        );
    }

    private String resolveClientKey(HttpServletRequest request) {
        Authentication authentication =
                org.springframework.security.core.context.SecurityContextHolder
                        .getContext()
                        .getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwt && authentication.isAuthenticated()) {
            return "user:" + jwt.getToken().getSubject();
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        String ip = forwarded == null || forwarded.isBlank()
                ? request.getRemoteAddr()
                : forwarded.split(",")[0].trim();
        return "ip:" + ip;
    }

    private record Limit(long capacity, Duration window, String bucket) {
    }
}
