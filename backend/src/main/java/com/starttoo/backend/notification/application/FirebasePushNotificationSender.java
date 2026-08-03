package com.starttoo.backend.notification.application;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.starttoo.backend.notification.api.NotificationDtos;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.firebase", name = "enabled", havingValue = "true")
public class FirebasePushNotificationSender implements PushNotificationSender {

    private final FirebaseMessaging firebaseMessaging;

    @Override
    public List<String> send(
            List<String> fids,
            NotificationDtos.NotificationResponse notification
    ) {
        List<String> invalidFids = new ArrayList<>();
        for (String fid : fids) {
            try {
                firebaseMessaging.send(message(fid, notification));
            } catch (FirebaseMessagingException exception) {
                if (exception.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED) {
                    invalidFids.add(fid);
                    log.info("Firebase installation is no longer registered.");
                } else {
                    // 일시 오류 때문에 로그인 기기 연결을 제거하지 않는다.
                    log.warn(
                            "FCM send failed. notificationSeq={}, errorCode={}",
                            notification.notificationSeq(),
                            exception.getMessagingErrorCode()
                    );
                }
            }
        }
        return List.copyOf(invalidFids);
    }

    private Message message(
            String fid,
            NotificationDtos.NotificationResponse notification
    ) {
        Message.Builder builder = Message.builder()
                .setFid(fid)
                .setNotification(com.google.firebase.messaging.Notification.builder()
                        .setTitle(notification.title())
                        .setBody(notification.body())
                        .build())
                .putData("type", notification.notificationType().name())
                .putData("notificationSeq", notification.notificationSeq().toString());
        if (notification.referenceSeq() != null) {
            builder.putData("referenceSeq", notification.referenceSeq().toString());
        }
        return builder.build();
    }
}
