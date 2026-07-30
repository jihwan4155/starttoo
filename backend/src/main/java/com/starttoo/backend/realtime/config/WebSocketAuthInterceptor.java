package com.starttoo.backend.realtime.config;

import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private static final Set<String> ALLOWED_SUBSCRIPTIONS = Set.of(
            "/user/queue/dm-events",
            "/user/queue/notifications"
    );

    private final JwtDecoder jwtDecoder;
    private final UserRepository userRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(
                message,
                StompHeaderAccessor.class
        );
        if (accessor == null) {
            return message;
        }
        StompCommand command = accessor.getCommand();
        if (command == null) {
            return message;
        }
        if (command == StompCommand.CONNECT) {
            authenticate(accessor);
            return message;
        }
        if (command == StompCommand.SUBSCRIBE) {
            requireAuthenticated(accessor);
            String destination = accessor.getDestination();
            if (!ALLOWED_SUBSCRIPTIONS.contains(destination)) {
                throw new AccessDeniedException("허용되지 않은 WebSocket 구독 경로입니다.");
            }
            return message;
        }
        if (command == StompCommand.SEND) {
            // 변경: 메시지 저장은 REST 트랜잭션을 단일 진입점으로 유지한다.
            throw new AccessDeniedException("현재 WebSocket 메시지 발행은 허용되지 않습니다.");
        }
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null) {
            authorization = accessor.getFirstNativeHeader("authorization");
        }
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new BadCredentialsException("WebSocket CONNECT에 Bearer 토큰이 필요합니다.");
        }

        try {
            Jwt jwt = jwtDecoder.decode(authorization.substring(7).trim());
            Integer userSeq = Integer.valueOf(jwt.getSubject());
            User user = userRepository.findByUserSeqAndDeletedFalse(userSeq)
                    .filter(value -> value.getAccountStatus() == AccountStatus.ACTIVE)
                    .orElseThrow(() -> new BadCredentialsException(
                            "활성 상태의 회원만 WebSocket에 연결할 수 있습니다."
                    ));
            JwtAuthenticationToken authentication = new JwtAuthenticationToken(
                    jwt,
                    Set.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())),
                    userSeq.toString()
            );
            accessor.setUser(authentication);
        } catch (JwtException | NumberFormatException exception) {
            throw new BadCredentialsException("WebSocket 액세스 토큰이 올바르지 않습니다.", exception);
        }
    }

    private void requireAuthenticated(StompHeaderAccessor accessor) {
        if (accessor.getUser() == null) {
            throw new AccessDeniedException("인증된 WebSocket 연결이 필요합니다.");
        }
    }
}
