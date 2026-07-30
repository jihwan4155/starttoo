package com.starttoo.backend.notification.domain;

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

@Getter
@Builder
@Entity
@Table(name = "notifications")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_seq")
    private Long notificationSeq;

    @Column(name = "receiver_seq", nullable = false)
    private Integer receiverSeq;

    @Column(name = "actor_seq")
    private Integer actorSeq;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 20)
    private NotificationType notificationType;

    @Column(name = "reference_seq")
    private Long referenceSeq;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 500)
    private String body;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    @Column(name = "read_dttm")
    private OffsetDateTime readDttm;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    public void markRead() {
        if (!read) {
            this.read = true;
            this.readDttm = OffsetDateTime.now();
        }
    }
}
