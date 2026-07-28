package com.starttoo.domain.simulation.service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ArSessionStore {

    private final Map<String, ArSession> sessions = new ConcurrentHashMap<>();
    private final Clock clock = Clock.systemUTC();

    void save(ArSession session) {
        removeExpired();
        sessions.put(session.sessionId, session);
    }

    ArSession require(String sessionId) {
        ArSession session = sessions.get(sessionId);
        if (session == null) {
            throw new BusinessException(ErrorCode.AR_SESSION_NOT_FOUND);
        }
        if (clock.instant().isAfter(session.expiresAt)) {
            sessions.remove(sessionId);
            throw new BusinessException(ErrorCode.AR_SESSION_EXPIRED);
        }
        return session;
    }

    public boolean isValidSignalingPeer(String sessionId, String peer, String token) {
        try {
            ArSession session = require(sessionId);
            return switch (peer) {
                case "desktop" -> session.desktopSignalingToken.equals(token);
                case "mobile" -> session.connectTokenUsed && session.mobileSignalingToken.equals(token);
                default -> false;
            };
        } catch (BusinessException exception) {
            return false;
        }
    }

    public void markDisconnected(String sessionId) {
        ArSession session = sessions.get(sessionId);
        if (session != null && "CONNECTED".equals(session.status)) {
            session.status = "DISCONNECTED";
        }
    }

    private void removeExpired() {
        var now = clock.instant();
        sessions.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt));
    }
}
