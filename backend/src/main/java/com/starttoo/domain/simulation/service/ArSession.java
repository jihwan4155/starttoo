package com.starttoo.domain.simulation.service;

import java.time.Instant;

final class ArSession {

    final String sessionId;
    final Long ownerId;
    final Long tattooId;
    final String designImageUrl;
    final String mobileCaptureUrl;
    final String connectToken;
    final String desktopSignalingToken;
    final String mobileSignalingToken;
    final Instant createdAt;
    volatile Instant expiresAt;
    volatile Instant connectedAt;
    volatile String status;
    volatile boolean connectTokenUsed;

    ArSession(
            String sessionId,
            Long ownerId,
            Long tattooId,
            String designImageUrl,
            String mobileCaptureUrl,
            String connectToken,
            String desktopSignalingToken,
            String mobileSignalingToken,
            Instant createdAt,
            Instant expiresAt
    ) {
        this.sessionId = sessionId;
        this.ownerId = ownerId;
        this.tattooId = tattooId;
        this.designImageUrl = designImageUrl;
        this.mobileCaptureUrl = mobileCaptureUrl;
        this.connectToken = connectToken;
        this.desktopSignalingToken = desktopSignalingToken;
        this.mobileSignalingToken = mobileSignalingToken;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.status = "WAITING";
    }
}
