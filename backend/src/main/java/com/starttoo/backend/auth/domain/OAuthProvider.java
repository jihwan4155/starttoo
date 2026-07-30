package com.starttoo.backend.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Getter
@Entity
@Table(name = "oauth_providers")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class OAuthProvider {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "oauth_provider_seq")
    private Integer oauthProviderSeq;

    @Column(name = "provider_code", nullable = false, unique = true, length = 10)
    private String providerCode;

    @Column(name = "provider_name", nullable = false, length = 30)
    private String providerName;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "reg_usr_seq", nullable = false)
    private Integer regUsrSeq;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;

    @Column(name = "mod_usr_seq", nullable = false)
    private Integer modUsrSeq;
}
