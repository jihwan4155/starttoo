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
@Table(name = "user_oauth_accounts")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class UserOAuthAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_oauth_account_seq")
    private Long userOauthAccountSeq;

    @Column(name = "user_seq", nullable = false)
    private Integer userSeq;

    @Column(name = "oauth_provider_seq", nullable = false)
    private Integer oauthProviderSeq;

    @Column(name = "provider_subject", nullable = false, length = 255)
    private String providerSubject;

    @Column(name = "last_login_dttm")
    private OffsetDateTime lastLoginDttm;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    public void recordLogin() {
        OffsetDateTime now = OffsetDateTime.now();
        this.lastLoginDttm = now;
        this.modDttm = now;
    }
}
