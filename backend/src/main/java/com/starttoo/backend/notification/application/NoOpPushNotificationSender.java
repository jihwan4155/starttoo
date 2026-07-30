package com.starttoo.backend.notification.application;

import com.starttoo.backend.notification.api.NotificationDtos;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(
        prefix = "app.firebase",
        name = "enabled",
        havingValue = "false",
        matchIfMissing = true
)
public class NoOpPushNotificationSender implements PushNotificationSender {

    @Override
    public List<String> send(
            List<String> pushTokens,
            NotificationDtos.NotificationResponse notification
    ) {
        return List.of();
    }
}
