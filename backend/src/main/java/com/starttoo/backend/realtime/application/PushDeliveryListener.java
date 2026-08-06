package com.starttoo.backend.realtime.application;

import com.starttoo.backend.notification.application.DeviceService;
import com.starttoo.backend.notification.application.NotificationCreatedEvent;
import com.starttoo.backend.notification.application.PushNotificationSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;

/**
 * FCM 푸시 전달.
 *
 * <p>WebSocket 전달({@link RealtimeDeliveryListener})과 같은 이벤트를 받지만 실행기를
 * 분리한다. 푸시는 외부 HTTP 왕복이라 같은 풀을 쓰면 실시간 메시지가 그 뒤에서 대기하고,
 * 풀이 포화되면 커밋을 마친 요청 스레드까지 끌어들여 DM 전송 응답이 느려진다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PushDeliveryListener {

    private final DeviceService deviceService;
    private final PushNotificationSender pushNotificationSender;

    @Async("pushTaskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void deliverPush(NotificationCreatedEvent event) {
        try {
            List<String> tokens = deviceService.activePushTokens(event.receiverSeq());
            if (tokens.isEmpty()) {
                return;
            }
            List<String> invalidTokens = pushNotificationSender.send(
                    tokens,
                    event.notification()
            );
            deviceService.deactivateInvalidPushTokens(event.receiverSeq(), invalidTokens);
        } catch (RuntimeException exception) {
            // 변경: 외부 푸시 실패는 이미 커밋된 메시지·알림을 롤백하지 않는다.
            log.error(
                    "FCM notification delivery failed. receiverSeq={}, notificationSeq={}",
                    event.receiverSeq(),
                    event.notification().notificationSeq(),
                    exception
            );
        }
    }
}
