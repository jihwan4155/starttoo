package com.starttoo.backend.notification.application;

import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.SendResponse;
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

    /** sendEach 한 번에 담을 수 있는 메시지 수 상한 (Firebase 규격) */
    private static final int SEND_EACH_LIMIT = 500;

    private final FirebaseMessaging firebaseMessaging;

    /**
     * 토큰마다 순차로 보내면 기기 수만큼 왕복이 쌓여 발송 스레드를 오래 붙잡는다.
     * sendEach 는 SDK 가 내부에서 병렬로 보내므로 대기 시간이 기기 수에 비례하지 않는다.
     * 토큰별 결과는 BatchResponse 순서로 돌아와 만료 토큰 정리는 그대로 유지한다.
     */
    @Override
    public List<String> send(
            List<String> pushTokens,
            NotificationDtos.NotificationResponse notification
    ) {
        List<String> invalidTokens = new ArrayList<>();
        for (int start = 0; start < pushTokens.size(); start += SEND_EACH_LIMIT) {
            List<String> chunk = pushTokens.subList(
                    start,
                    Math.min(start + SEND_EACH_LIMIT, pushTokens.size())
            );
            invalidTokens.addAll(sendChunk(chunk, notification));
        }
        return List.copyOf(invalidTokens);
    }

    private List<String> sendChunk(
            List<String> pushTokens,
            NotificationDtos.NotificationResponse notification
    ) {
        BatchResponse batchResponse;
        try {
            batchResponse = firebaseMessaging.sendEach(pushTokens.stream()
                    .map(pushToken -> message(pushToken, notification))
                    .toList());
        } catch (FirebaseMessagingException exception) {
            // 요청 자체가 실패한 경우다. 개별 토큰 상태를 알 수 없으므로 아무것도 지우지 않는다.
            log.warn(
                    "FCM batch send failed. notificationSeq={}, errorCode={}",
                    notification.notificationSeq(),
                    exception.getMessagingErrorCode()
            );
            return List.of();
        }

        List<SendResponse> responses = batchResponse.getResponses();
        List<String> invalidTokens = new ArrayList<>();
        for (int index = 0; index < responses.size(); index++) {
            SendResponse response = responses.get(index);
            if (response.isSuccessful()) {
                continue;
            }
            FirebaseMessagingException exception = response.getException();
            MessagingErrorCode errorCode = exception == null
                    ? null
                    : exception.getMessagingErrorCode();
            if (errorCode == MessagingErrorCode.UNREGISTERED) {
                invalidTokens.add(pushTokens.get(index));
                log.info("FCM registration token is no longer registered.");
            } else {
                // 변경: 일시 오류 때문에 로그인 기기 연결을 제거하지 않는다.
                log.warn(
                        "FCM send failed. notificationSeq={}, errorCode={}",
                        notification.notificationSeq(),
                        errorCode
                );
            }
        }
        return invalidTokens;
    }

    private Message message(
            String pushToken,
            NotificationDtos.NotificationResponse notification
    ) {
        Message.Builder builder = Message.builder()
                .setToken(pushToken)
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
