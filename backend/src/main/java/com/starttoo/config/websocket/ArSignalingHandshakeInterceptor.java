package com.starttoo.config.websocket;

import com.starttoo.domain.simulation.service.ArSessionStore;
import lombok.RequiredArgsConstructor;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class ArSignalingHandshakeInterceptor implements HandshakeInterceptor {

    private final ArSessionStore sessionStore;

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        var params = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams();
        String sessionId = params.getFirst("sessionId");
        String peer = params.getFirst("peer");
        String token = params.getFirst("token");
        if (sessionId == null || peer == null || token == null
                || !sessionStore.isValidSignalingPeer(sessionId, peer, token)) {
            return false;
        }
        attributes.put("arSessionId", sessionId);
        attributes.put("arPeer", peer);
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
    }
}
