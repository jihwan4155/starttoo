package com.starttoo.backend.realtime.application;

import com.starttoo.backend.dm.application.DmRealtimeDeliveryEvent;
import com.starttoo.backend.notification.application.DeviceService;
import com.starttoo.backend.notification.application.NotificationCreatedEvent;
import com.starttoo.backend.notification.application.PushNotificationSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class RealtimeDeliveryListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final DeviceService deviceService;
    private final PushNotificationSender pushNotificationSender;

    @Async("realtimeTaskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void deliverDm(DmRealtimeDeliveryEvent event) {
        try {
            messagingTemplate.convertAndSendToUser(
                    event.receiverSeq().toString(),
                    "/queue/dm-events",
                    event.payload()
            );
        } catch (RuntimeException exception) {
            // 변경: 커밋된 메시지를 되돌리지 않고 재접속 REST 동기화로 복구한다.
            log.error(
                    "WebSocket DM delivery failed. receiverSeq={}, eventId={}",
                    event.receiverSeq(),
                    event.payload().eventId(),
                    exception
            );
        }
    }

    @Async("realtimeTaskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void deliverNotification(NotificationCreatedEvent event) {
        try {
            messagingTemplate.convertAndSendToUser(
                    event.receiverSeq().toString(),
                    "/queue/notifications",
                    event.notification()
            );
        } catch (RuntimeException exception) {
            log.error(
                    "WebSocket notification delivery failed. receiverSeq={}, notificationSeq={}",
                    event.receiverSeq(),
                    event.notification().notificationSeq(),
                    exception
            );
        }

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
