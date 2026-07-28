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

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "user_devices")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class UserDeviceEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "device_id")
    private Long deviceId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "push_token", nullable = false, length = 512)
    private String pushToken;

    @Column(name = "platform", nullable = false, length = 20)
    private String platform;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    public void activate(Long userId, String platform, LocalDateTime now) {
        this.userId = userId;
        this.platform = platform;
        this.active = true;
        this.lastUsedAt = now;
    }

    public void deactivate() {
        this.active = false;
    }
}
