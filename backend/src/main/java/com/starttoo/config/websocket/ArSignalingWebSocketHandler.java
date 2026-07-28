package com.starttoo.config.websocket;

import com.starttoo.domain.simulation.service.ArSessionStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
public class ArSignalingWebSocketHandler extends TextWebSocketHandler {

    private static final int MAX_SIGNAL_SIZE = 128 * 1024;

    private final ArSessionStore sessionStore;
    private final Map<String, Map<String, WebSocketSession>> peers = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String sessionId = attribute(session, "arSessionId");
        String peer = attribute(session, "arPeer");
        peers.computeIfAbsent(sessionId, ignored -> new ConcurrentHashMap<>()).put(peer, session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        if (message.getPayloadLength() > MAX_SIGNAL_SIZE) {
            session.close(CloseStatus.TOO_BIG_TO_PROCESS);
            return;
        }

        String sessionId = attribute(session, "arSessionId");
        String peer = attribute(session, "arPeer");
        String targetPeer = "mobile".equals(peer) ? "desktop" : "mobile";
        WebSocketSession target = peers.getOrDefault(sessionId, Map.of()).get(targetPeer);
        if (target != null && target.isOpen()) {
            synchronized (target) {
                target.sendMessage(message);
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = attribute(session, "arSessionId");
        String peer = attribute(session, "arPeer");
        Map<String, WebSocketSession> sessionPeers = peers.get(sessionId);
        if (sessionPeers != null) {
            sessionPeers.remove(peer);
            if (sessionPeers.isEmpty()) {
                peers.remove(sessionId);
            }
        }
        sessionStore.markDisconnected(sessionId);
    }

    private String attribute(WebSocketSession session, String name) {
        return String.valueOf(session.getAttributes().get(name));
    }
}
