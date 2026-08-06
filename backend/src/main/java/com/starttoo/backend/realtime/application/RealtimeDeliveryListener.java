package com.starttoo.backend.realtime.application;

import com.starttoo.backend.dm.application.DmRealtimeDeliveryEvent;
import com.starttoo.backend.notification.application.NotificationCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * WebSocket 전달만 담당한다. FCM 은 {@link PushDeliveryListener} 가 별도 풀에서 처리한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RealtimeDeliveryListener {

    private final SimpMessagingTemplate messagingTemplate;

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
    }
}
