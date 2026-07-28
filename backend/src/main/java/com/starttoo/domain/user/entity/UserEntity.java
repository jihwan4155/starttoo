package com.starttoo.domain.user.entity;

import com.starttoo.common.persistence.BaseTimeEntity;
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

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "users")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class UserEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "oauth_provider", nullable = false, length = 20)
    private String oauthProvider;

    @Column(name = "oauth_subject", nullable = false, length = 255)
    private String oauthSubject;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "nickname", nullable = false, length = 50)
    private String nickname;

    @Column(name = "profile_image_key", nullable = false, length = 1000)
    private String profileImageKey;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "gender", length = 20)
    private String gender;

    @Builder.Default
    @Column(name = "role", nullable = false, length = 20)
    private String role = "USER";

    @Builder.Default
    @Column(name = "account_status", nullable = false, length = 20)
    private String accountStatus = "ACTIVE";

    @Column(name = "withdrawal_reason", length = 255)
    private String withdrawalReason;

    @Column(name = "withdrawn_at")
    private LocalDateTime withdrawnAt;

    public void updateProfile(
            String nickname,
            LocalDate birthDate,
            String gender
    ) {
        this.nickname = nickname;
        this.birthDate = birthDate;
        this.gender = gender;
    }

    public void updateProfileImage(String profileImageKey) {
        this.profileImageKey = profileImageKey;
    }

    public void resetProfileImage(String defaultImageKey) {
        this.profileImageKey = defaultImageKey;
    }

    public void withdraw(String reason, LocalDateTime now) {
        this.accountStatus = "WITHDRAWN";
        this.withdrawalReason = reason;
        this.withdrawnAt = now;
    }
}
