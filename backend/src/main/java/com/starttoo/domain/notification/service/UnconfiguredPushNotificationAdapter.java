package com.starttoo.domain.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class UnconfiguredPushNotificationAdapter implements PushNotificationPort {

    @Override
    public void send(PushMessage message) {
        log.info(
                "FCM 미연결로 푸시 발송을 건너뜁니다. receiverId={}, notificationId={}, type={}",
                message.receiverId(),
                message.notificationId(),
                message.notificationType()
        );
    }
}
