package com.starttoo.backend.notification.api;

import com.starttoo.backend.notification.domain.NotificationType;

import java.time.OffsetDateTime;
import java.util.Map;

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
            OffsetDateTime regDttm
    ) {
    }

    public record UnreadCounts(
            long total,
            Map<NotificationType, Long> byType
    ) {
    }
}
