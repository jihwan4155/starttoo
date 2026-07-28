package com.starttoo.domain.notification.entity;

import com.starttoo.common.persistence.CreatedAtEntity;
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
@Table(name = "notifications")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class NotificationEntity extends CreatedAtEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long notificationId;

    @Column(name = "receiver_id", nullable = false)
    private Long receiverId;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "notification_type", nullable = false, length = 30)
    private String notificationType;

    @Column(name = "reference_type", length = 20)
    private String referenceType;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "body", nullable = false, length = 500)
    private String body;

    @Builder.Default
    @Column(name = "is_read", nullable = false)
    private boolean read = false;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    public void markRead(LocalDateTime now) {
        if (!this.read) {
            this.read = true;
            this.readAt = now;
        }
    }
}
