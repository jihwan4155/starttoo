package com.starttoo.backend.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

@Getter
@Builder
@Entity
@Table(name = "refresh_tokens")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "refresh_token_seq")
    private Long refreshTokenSeq;

    @Column(name = "user_seq", nullable = false)
    private Integer userSeq;

    @Column(name = "device_seq")
    private Long deviceSeq;

    @Column(name = "token_hash", nullable = false, unique = true, columnDefinition = "bytea")
    private byte[] tokenHash;

    @Column(name = "expires_dttm", nullable = false)
    private OffsetDateTime expiresDttm;

    @Column(name = "revoked_dttm")
    private OffsetDateTime revokedDttm;

    @Column(name = "last_used_dttm")
    private OffsetDateTime lastUsedDttm;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    public boolean usableAt(OffsetDateTime now) {
        return revokedDttm == null && expiresDttm.isAfter(now);
    }

    public void revoke(OffsetDateTime now) {
        this.revokedDttm = now;
        this.lastUsedDttm = now;
    }

    public void attachDevice(Long deviceSeq) {
        this.deviceSeq = deviceSeq;
    }
}
