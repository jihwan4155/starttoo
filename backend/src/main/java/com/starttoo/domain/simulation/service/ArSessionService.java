package com.starttoo.domain.simulation.service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.domain.image.repository.ImageRepository;
import com.starttoo.domain.image.service.ObjectStoragePort;
import com.starttoo.domain.simulation.dto.SimulationDtos.ArSessionResponse;
import com.starttoo.domain.simulation.dto.SimulationDtos.ConnectArSessionResponse;
import com.starttoo.domain.simulation.dto.SimulationDtos.CreateArSessionResponse;
import com.starttoo.domain.tattoo.repository.TattooDesignRepository;
import com.starttoo.domain.tattoo.repository.TattooRepository;
import com.starttoo.domain.social.repository.UserBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ArSessionService {

    private final TattooRepository tattooRepository;
    private final UserBlockRepository userBlockRepository;
    private final TattooDesignRepository tattooDesignRepository;
    private final ImageRepository imageRepository;
    private final ObjectStoragePort objectStoragePort;
    private final ArSessionStore sessionStore;
    private final SecureRandom random = new SecureRandom();
    private final Clock clock = Clock.systemUTC();

    @Value("${app.ar.session-seconds}")
    private long sessionSeconds;

    @Value("${app.ar.connected-session-seconds}")
    private long connectedSessionSeconds;

    @Value("${app.ar.mobile-capture-base-url}")
    private String mobileCaptureBaseUrl;

    public CreateArSessionResponse create(Long userId, Long tattooId, String apiBaseUrl) {
        var tattoo = tattooRepository.findById(tattooId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TATTOO_NOT_FOUND));
        if (tattoo.getUserId() != null && !tattoo.getUserId().equals(userId)
                && userBlockRepository.existsEitherDirection(userId, tattoo.getUserId())) {
            throw new BusinessException(ErrorCode.TATTOO_NOT_FOUND);
        }

        var design = tattooDesignRepository.findById(tattooId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TATTOO_DESIGN_REQUIRED));
        var image = imageRepository.findById(design.getImageId())
                .orElseThrow(() -> new BusinessException(ErrorCode.TATTOO_DESIGN_NOT_FOUND));

        String sessionId = "ars_" + UUID.randomUUID().toString().replace("-", "");
        String connectToken = token();
        String desktopToken = token();
        String mobileToken = token();
        Instant createdAt = clock.instant();
        Instant expiresAt = createdAt.plusSeconds(sessionSeconds);
        String designUrl = objectStoragePort.createDownloadUrl(image.getObjectKey());
        String mobileUrl = UriComponentsBuilder.fromUriString(mobileCaptureBaseUrl)
                .queryParam("sessionId", sessionId)
                .queryParam("connectToken", connectToken)
                .build().toUriString();
        String qrUrl = UriComponentsBuilder.fromUriString(apiBaseUrl)
                .path("/simulations/ar-sessions/{sessionId}/qr")
                .queryParam("connectToken", connectToken)
                .buildAndExpand(sessionId).toUriString();
        String signalingUrl = apiBaseUrl.replaceFirst("^http", "ws") + "/ws/ar";

        sessionStore.save(new ArSession(
                sessionId, userId, tattooId, designUrl, mobileUrl,
                connectToken, desktopToken, mobileToken, createdAt, expiresAt
        ));

        return new CreateArSessionResponse(
                sessionId, tattooId, designUrl, "WAITING", qrUrl, mobileUrl,
                signalingUrl, desktopToken, expiresAt, createdAt
        );
    }

    public synchronized ConnectArSessionResponse connect(
            String sessionId,
            String connectToken,
            String apiBaseUrl
    ) {
        ArSession session = sessionStore.require(sessionId);
        if (session.connectTokenUsed || !constantTimeEquals(session.connectToken, connectToken)) {
            throw new BusinessException(ErrorCode.CONNECT_TOKEN_INVALID);
        }
        if ("CONNECTED".equals(session.status)) {
            throw new BusinessException(ErrorCode.SESSION_ALREADY_CONNECTED);
        }

        Instant connectedAt = clock.instant();
        session.connectTokenUsed = true;
        session.connectedAt = connectedAt;
        session.expiresAt = connectedAt.plusSeconds(connectedSessionSeconds);
        session.status = "CONNECTED";

        return new ConnectArSessionResponse(
                session.sessionId,
                session.status,
                session.tattooId,
                session.designImageUrl,
                apiBaseUrl.replaceFirst("^http", "ws") + "/ws/ar",
                session.mobileSignalingToken,
                connectedAt,
                session.expiresAt
        );
    }

    public ArSessionResponse get(Long userId, String sessionId) {
        ArSession session = sessionStore.require(sessionId);
        if (!session.ownerId.equals(userId)) {
            throw new BusinessException(ErrorCode.SESSION_OWNER_MISMATCH);
        }
        return new ArSessionResponse(
                session.sessionId,
                session.tattooId,
                session.status,
                session.connectedAt == null ? null : "MOBILE_WEB",
                session.connectedAt,
                session.expiresAt
        );
    }

    public void validateCompositeAccess(Long userId, String sessionId) {
        ArSession session = sessionStore.require(sessionId);
        if (!session.ownerId.equals(userId)) throw new BusinessException(ErrorCode.SESSION_OWNER_MISMATCH);
        if (!"CONNECTED".equals(session.status)) throw new BusinessException(ErrorCode.AR_SESSION_NOT_CONNECTED);
    }

    public String mobileCaptureUrl(String sessionId, String connectToken) {
        ArSession session = sessionStore.require(sessionId);
        if (!constantTimeEquals(session.connectToken, connectToken)) {
            throw new BusinessException(ErrorCode.CONNECT_TOKEN_INVALID);
        }
        return session.mobileCaptureUrl;
    }

    private String token() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private boolean constantTimeEquals(String expected, String actual) {
        if (actual == null || expected.length() != actual.length()) {
            return false;
        }
        int result = 0;
        for (int index = 0; index < expected.length(); index++) {
            result |= expected.charAt(index) ^ actual.charAt(index);
        }
        return result == 0;
    }
}
