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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

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
        if (exempt()) {
            filterChain.doFilter(request, response);
            return;
        }
        Limit limit = resolveLimit(request);
        try {
            long used = 0;
            for (String clientKey : resolveClientKeys(request)) {
                String key = "rate-limit:" + clientKey + ":" + limit.bucket();
                Long count = redisTemplate.execute(
                        SCRIPT,
                        List.of(key),
                        Long.toString(limit.window().toMillis())
                );
                used = Math.max(used, count == null ? 0 : count);
            }
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
        String uri = request.getRequestURI();
        if (HttpMethod.GET.matches(request.getMethod())
                && "/v1/auth/phones/availability".equals(uri)) {
            return new Limit(
                    properties.phoneAvailabilityCapacity(),
                    properties.phoneAvailabilityWindow(),
                    "phone-availability"
            );
        }

        if (HttpMethod.POST.matches(request.getMethod())
                && "/v1/designs/search-by-shape".equals(uri)) {
            // 검색은 POST 지만 조회성 요청이다. 등록·수정용 mutation 한도와 분리한다.
            return new Limit(
                    properties.coverupSearchCapacity(),
                    properties.coverupSearchWindow(),
                    "coverup-search"
            );
        }

        if (HttpMethod.POST.matches(request.getMethod())
                && uri.startsWith("/v1/simulations/ar-sessions/")) {
            // connect·업로드는 비로그인 진입점이라 클라이언트 키가 IP 뿐이다.
            // 회원 mutation 한도와 섞지 않고 자체 버킷으로 분리한다.
            return new Limit(
                    properties.arSessionCapacity(),
                    properties.arSessionWindow(),
                    "ar-session"
            );
        }

        boolean mutation = !HttpMethod.GET.matches(request.getMethod())
                && !HttpMethod.HEAD.matches(request.getMethod())
                && !HttpMethod.OPTIONS.matches(request.getMethod());

        if (mutation && uri.startsWith("/v1/dm")) {
            // 대화는 짧은 메시지를 연달아 보내는 것이 정상 사용이라 게시·좋아요와 성격이 다르다.
            // 같은 mutation 버킷을 쓰면 평범한 채팅이 커뮤니티 활동 한도를 잠식한다.
            return new Limit(
                    properties.dmCapacity(),
                    properties.dmWindow(),
                    "dm"
            );
        }

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

    /**
     * 부하 시연·데모처럼 한도가 방해가 되는 계정을 설정으로 열어준다.
     * 로그인 요청에만 적용되며, IP 로만 묶이는 비로그인 진입점에는 영향이 없다.
     */
    private boolean exempt() {
        Set<Long> exemptUserSeqs = properties.exemptUserSeqs();
        if (exemptUserSeqs == null || exemptUserSeqs.isEmpty()) {
            return false;
        }
        String subject = currentUserSubject();
        if (subject == null) {
            return false;
        }
        try {
            return exemptUserSeqs.contains(Long.valueOf(subject));
        } catch (NumberFormatException exception) {
            return false;
        }
    }

    private List<String> resolveClientKeys(HttpServletRequest request) {
        if (HttpMethod.GET.matches(request.getMethod())
                && "/v1/auth/phones/availability".equals(request.getRequestURI())) {
            String phoneNumber = request.getParameter("phoneNumber");
            return List.of(
                    "ip:" + resolveIp(request),
                    "phone:" + sha256(canonicalPhone(phoneNumber))
            );
        }
        return List.of(resolveClientKey(request));
    }

    private String resolveClientKey(HttpServletRequest request) {
        String subject = currentUserSubject();
        if (subject != null) {
            return "user:" + subject;
        }
        return "ip:" + resolveIp(request);
    }

    private String currentUserSubject() {
        Authentication authentication =
                org.springframework.security.core.context.SecurityContextHolder
                        .getContext()
                        .getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwt && authentication.isAuthenticated()) {
            return jwt.getToken().getSubject();
        }
        return null;
    }

    private String resolveIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank()
                ? request.getRemoteAddr()
                : forwarded.split(",")[0].trim();
    }

    private String canonicalPhone(String phoneNumber) {
        String value = phoneNumber == null ? "" : phoneNumber.replaceAll("[\\s-]", "");
        if (value.startsWith("010")) {
            return "+82" + value.substring(1);
        }
        if (value.startsWith("8210")) {
            return "+" + value;
        }
        return value;
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private record Limit(long capacity, Duration window, String bucket) {
    }
}
