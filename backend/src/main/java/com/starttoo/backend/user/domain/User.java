package com.starttoo.backend.user.domain;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Getter
@Builder
@Entity
@Table(name = "users")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_seq")
    private Integer userSeq;

    @Column(nullable = false, length = 20)
    private String nickname;

    @Column(name = "phone_number", nullable = false, length = 16)
    private String phoneNumber;

    @Column(name = "phone_verified_dttm", nullable = false)
    private OffsetDateTime phoneVerifiedDttm;

    @Column(name = "profile_image_seq")
    private Long profileImageSeq;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    // 변경: PostgreSQL CHAR(1)을 Hibernate가 VARCHAR(1)로 검증하지 않도록 명시한다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 1)
    private String gender;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private UserRole role;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "recent_search_terms", nullable = false, columnDefinition = "varchar(100)[]")
    private String[] recentSearchTerms;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_status", nullable = false, length = 12)
    private AccountStatus accountStatus;

    @Column(name = "status_changed_dttm", nullable = false)
    private OffsetDateTime statusChangedDttm;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;

    @Column(name = "mod_usr_seq")
    private Integer modUsrSeq;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    public void initializeModifier() {
        this.modUsrSeq = this.userSeq;
    }

    public void updateProfile(
            String nickname,
            LocalDate birthDate,
            String gender,
            Integer modifierSeq
    ) {
        this.nickname = nickname;
        this.birthDate = birthDate;
        this.gender = gender;
        this.modUsrSeq = modifierSeq;
        this.modDttm = OffsetDateTime.now();
    }

    public void replaceProfileImage(Long profileImageSeq, Integer modifierSeq) {
        this.profileImageSeq = profileImageSeq;
        this.modUsrSeq = modifierSeq;
        this.modDttm = OffsetDateTime.now();
    }

    public void changeRole(UserRole role, Integer modifierSeq) {
        this.role = role;
        this.modUsrSeq = modifierSeq;
        this.modDttm = OffsetDateTime.now();
    }

    public void changeStatus(AccountStatus status, Integer modifierSeq) {
        this.accountStatus = status;
        this.statusChangedDttm = OffsetDateTime.now();
        this.modUsrSeq = modifierSeq;
        this.modDttm = OffsetDateTime.now();
    }

    public void withdraw(Integer modifierSeq) {
        changeStatus(AccountStatus.WITHDRAWN, modifierSeq);
    }

    public void replaceRecentSearchTerms(String[] terms) {
        this.recentSearchTerms = terms;
        this.modDttm = OffsetDateTime.now();
        this.modUsrSeq = null;
    }
}
