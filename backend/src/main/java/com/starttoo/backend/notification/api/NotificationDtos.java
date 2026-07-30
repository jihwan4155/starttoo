package com.starttoo.backend.notification.api;

import com.starttoo.backend.notification.domain.NotificationType;

import java.time.OffsetDateTime;

public final class NotificationDtos {

    private NotificationDtos() {
    }

    public record NotificationResponse(
            Long notificationSeq,
            Integer actorSeq,
            NotificationType notificationType,
            Long referenceSeq,
            String title,
            String body,
            boolean read,
            OffsetDateTime readDttm,
            OffsetDateTime regDttm
    ) {
    }

    public record UnreadCount(long count) {
    }
}
