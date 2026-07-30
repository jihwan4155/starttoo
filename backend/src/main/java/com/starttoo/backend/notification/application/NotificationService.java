package com.starttoo.backend.notification.application;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.notification.api.NotificationDtos;
import com.starttoo.backend.notification.domain.Notification;
import com.starttoo.backend.notification.domain.NotificationRepository;
import com.starttoo.backend.notification.domain.NotificationType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public NotificationDtos.NotificationResponse create(
            Integer receiverSeq,
            Integer actorSeq,
            NotificationType type,
            Long referenceSeq,
            String title,
            String body
    ) {
        if (Objects.equals(receiverSeq, actorSeq)) {
            return null;
        }
        Notification notification = notificationRepository.save(Notification.builder()
                .receiverSeq(receiverSeq)
                .actorSeq(actorSeq)
                .notificationType(type)
                .referenceSeq(referenceSeq)
                .title(title)
                .body(body)
                .read(false)
                .regDttm(OffsetDateTime.now())
                .build());
        NotificationDtos.NotificationResponse response = response(notification);
        // 변경: 같은 트랜잭션의 모든 DB 작업이 커밋된 뒤에만 실시간·FCM 전송한다.
        eventPublisher.publishEvent(new NotificationCreatedEvent(receiverSeq, response));
        return response;
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<NotificationDtos.NotificationResponse> list(
            Integer receiverSeq,
            Long cursor,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        List<Long> ids = jdbcTemplate.queryForList("""
                SELECT notification_seq
                  FROM notifications
                 WHERE receiver_seq = ?
                   AND (CAST(? AS BIGINT) IS NULL OR notification_seq < ?)
                 ORDER BY notification_seq DESC
                 LIMIT ?
                """, Long.class, receiverSeq, cursor, cursor, safeSize + 1);
        boolean hasNext = ids.size() > safeSize;
        List<Long> page = hasNext ? ids.subList(0, safeSize) : ids;
        Map<Long, Notification> byId = new HashMap<>();
        notificationRepository.findAllById(page)
                .forEach(value -> byId.put(value.getNotificationSeq(), value));
        List<NotificationDtos.NotificationResponse> items = page.stream()
                .map(id -> response(java.util.Objects.requireNonNull(byId.get(id))))
                .toList();
        String next = hasNext ? page.get(page.size() - 1).toString() : null;
        return CursorPageResponse.of(items, next, hasNext);
    }

    @Transactional
    public NotificationDtos.NotificationResponse read(Integer receiverSeq, Long notificationSeq) {
        Notification notification = notificationRepository
                .findByNotificationSeqAndReceiverSeq(notificationSeq, receiverSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND));
        notification.markRead();
        return response(notification);
    }

    @Transactional
    public int readAll(Integer receiverSeq) {
        return notificationRepository.markAllRead(receiverSeq);
    }

    @Transactional
    public int readDmRoom(Integer receiverSeq, Long roomSeq, OffsetDateTime readDttm) {
        // 변경: NEW_DM의 referenceSeq는 dmRoomSeq이므로 해당 방 알림만 일괄 읽음 처리한다.
        return notificationRepository.markDmRoomRead(
                receiverSeq,
                roomSeq,
                NotificationType.NEW_DM,
                readDttm
        );
    }

    public long unreadCount(Integer receiverSeq) {
        return notificationRepository.countByReceiverSeqAndReadFalse(receiverSeq);
    }

    private NotificationDtos.NotificationResponse response(Notification notification) {
        return new NotificationDtos.NotificationResponse(
                notification.getNotificationSeq(),
                notification.getActorSeq(),
                notification.getNotificationType(),
                notification.getReferenceSeq(),
                notification.getTitle(),
                notification.getBody(),
                notification.isRead(),
                notification.getReadDttm(),
                notification.getRegDttm()
        );
    }
}
