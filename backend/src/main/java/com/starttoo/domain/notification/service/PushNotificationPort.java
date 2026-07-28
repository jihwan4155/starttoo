package com.starttoo.domain.notification.service;

public interface PushNotificationPort {

    void send(PushMessage message);

    record PushMessage(
            Long receiverId,
            Long notificationId,
            String notificationType,
            String referenceType,
            Long referenceId,
            String title,
            String body
    ) {
    }
}
