package com.starttoo.backend.simulation.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
@Entity
@Table(name = "ar_simulation_sessions")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ArSimulationSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ar_session_seq")
    private Long arSessionSeq;

    /** QR 에 실리는 공개 식별자. 추측 가능한 순번을 노출하지 않으려고 UUID 를 쓴다. */
    @Column(name = "session_id", nullable = false, unique = true)
    private UUID sessionId;

    @Column(name = "owner_seq", nullable = false)
    private Integer ownerSeq;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private ArSimulationSessionStatus status;

    /** 발급한 sessionToken 의 jti. 세션을 닫으면 비워서 JWT 만료 전에도 토큰을 죽인다. */
    @Column(name = "session_token_id")
    private UUID sessionTokenId;

    @Column(name = "phone_connected_dttm")
    private OffsetDateTime phoneConnectedDttm;

    @Column(name = "composite_count", nullable = false)
    private short compositeCount;

    @Column(name = "expires_dttm", nullable = false)
    private OffsetDateTime expiresDttm;

    @Column(name = "closed_dttm")
    private OffsetDateTime closedDttm;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;

    public boolean isExpiredAt(OffsetDateTime now) {
        return !now.isBefore(expiresDttm);
    }

    public boolean isClosed() {
        return status == ArSimulationSessionStatus.CLOSED;
    }

    public boolean isPhoneConnected() {
        return phoneConnectedDttm != null;
    }

    /**
     * 폰 1대를 붙인다. 이미 붙은 세션이면 false 를 돌려 두 번째 기기를 거부한다.
     * 동시 요청은 session_id 단위 비관적 잠금이 직렬화한다.
     */
    public boolean connectPhone(UUID sessionTokenId) {
        if (status != ArSimulationSessionStatus.CREATED) {
            return false;
        }
        this.status = ArSimulationSessionStatus.CONNECTED;
        this.sessionTokenId = sessionTokenId;
        this.phoneConnectedDttm = OffsetDateTime.now();
        this.modDttm = this.phoneConnectedDttm;
        return true;
    }

    public void addComposite() {
        this.compositeCount = (short) (this.compositeCount + 1);
        this.modDttm = OffsetDateTime.now();
    }

    public void close() {
        this.status = ArSimulationSessionStatus.CLOSED;
        this.sessionTokenId = null;
        this.closedDttm = OffsetDateTime.now();
        this.modDttm = this.closedDttm;
    }
}
