package com.starttoo.domain.notification.service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.common.pagination.CursorCodec;
import com.starttoo.domain.dm.entity.DmRoomParticipantId;
import com.starttoo.domain.dm.repository.DmRoomParticipantRepository;
import com.starttoo.domain.notification.dto.NotificationDtos.DmRoomMuteResponse;
import com.starttoo.domain.notification.dto.NotificationDtos.NotificationItem;
import com.starttoo.domain.notification.dto.NotificationDtos.NotificationPage;
import com.starttoo.domain.notification.dto.NotificationDtos.NotificationPreview;
import com.starttoo.domain.notification.dto.NotificationDtos.UnreadCountsResponse;
import com.starttoo.domain.notification.entity.DmRoomNotificationMuteEntity;
import com.starttoo.domain.notification.entity.DmRoomNotificationMuteId;
import com.starttoo.domain.notification.entity.NotificationEntity;
import com.starttoo.domain.notification.repository.DmRoomNotificationMuteRepository;
import com.starttoo.domain.notification.repository.NotificationRepository;
import com.starttoo.domain.notification.repository.NotificationRepository.GroupedUnreadRow;
import com.starttoo.domain.notification.service.PushNotificationPort.PushMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static com.starttoo.common.time.TimeMapper.toInstant;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final String TYPE_NEW_DM = "NEW_DM";
    public static final String TYPE_SYSTEM = "SYSTEM";
    public static final String REFERENCE_DM_ROOM = "DM_ROOM";
    public static final String REFERENCE_REPORT = "REPORT";
    public static final String REFERENCE_ARTIST = "ARTIST";

    private final NotificationRepository notificationRepository;
    private final DmRoomNotificationMuteRepository muteRepository;
    private final DmRoomParticipantRepository participantRepository;
    private final PushNotificationPort pushNotificationPort;
    private final CursorCodec cursorCodec;
    private final Clock clock = Clock.systemUTC();

    @Transactional(readOnly = true)
    public UnreadCountsResponse unreadCounts(Long userId) {
        var row = notificationRepository.countGroupedUnread(userId);
        long newDm = value(row == null ? null : row.getNewDmCount());
        long system = value(row == null ? null : row.getSystemCount());
        return new UnreadCountsResponse(
                value(row == null ? null : row.getTotalCount()),
                Map.of(TYPE_NEW_DM, newDm, TYPE_SYSTEM, system)
        );
    }

    @Transactional(readOnly = true)
    public NotificationPreview preview(Long userId) {
        List<NotificationItem> items = notificationRepository.findGroupedUnread(
                userId,
                null,
                Long.MAX_VALUE,
                PageRequest.of(0, 10)
        ).stream().map(this::item).toList();
        return new NotificationPreview(items, unreadCounts(userId).totalCount());
    }

    @Transactional(readOnly = true)
    public NotificationPage unread(Long userId, String cursor, int size) {
        Map<String, Object> cursorValues = cursorCodec.decode(cursor);
        LocalDateTime cursorCreatedAt = cursorDateTime(cursorValues);
        long cursorNotificationId = cursorLong(cursorValues, "notificationId", Long.MAX_VALUE);
        List<GroupedUnreadRow> rows = notificationRepository.findGroupedUnread(
                userId,
                cursorCreatedAt,
                cursorNotificationId,
                PageRequest.of(0, size + 1)
        );
        boolean hasNext = rows.size() > size;
        List<GroupedUnreadRow> page = rows.subList(0, Math.min(size, rows.size()));
        List<NotificationItem> items = page.stream().map(this::item).toList();
        String nextCursor = null;
        if (hasNext && !page.isEmpty()) {
            GroupedUnreadRow last = page.getLast();
            nextCursor = cursorCodec.encode(Map.of(
                    "createdAt", last.getCreatedAt().toString(),
                    "notificationId", last.getNotificationId()
            ));
        }
        return new NotificationPage(items, nextCursor, hasNext, unreadCounts(userId).totalCount());
    }

    @Transactional
    public DmRoomMuteResponse muteRoom(Long userId, Long dmRoomId) {
        requireParticipant(userId, dmRoomId);
        DmRoomNotificationMuteId id = new DmRoomNotificationMuteId(userId, dmRoomId);
        DmRoomNotificationMuteEntity mute = muteRepository.findById(id)
                .orElseGet(() -> muteRepository.saveAndFlush(
                        DmRoomNotificationMuteEntity.builder().id(id).build()
                ));
        LocalDateTime now = now();
        markRoomNotificationsRead(userId, dmRoomId, now);
        Instant updatedAt = mute.getCreatedAt() == null ? toInstant(now) : toInstant(mute.getCreatedAt());
        return new DmRoomMuteResponse(dmRoomId, true, updatedAt);
    }

    @Transactional
    public DmRoomMuteResponse unmuteRoom(Long userId, Long dmRoomId) {
        requireParticipant(userId, dmRoomId);
        DmRoomNotificationMuteId id = new DmRoomNotificationMuteId(userId, dmRoomId);
        if (muteRepository.existsById(id)) {
            muteRepository.deleteById(id);
        }
        return new DmRoomMuteResponse(dmRoomId, false, Instant.now(clock));
    }

    @Transactional(readOnly = true)
    public DmRoomMuteResponse roomMute(Long userId, Long dmRoomId) {
        requireParticipant(userId, dmRoomId);
        return muteRepository.findById(new DmRoomNotificationMuteId(userId, dmRoomId))
                .map(value -> new DmRoomMuteResponse(dmRoomId, true, toInstant(value.getCreatedAt())))
                .orElseGet(() -> new DmRoomMuteResponse(dmRoomId, false, null));
    }

    @Transactional(readOnly = true)
    public boolean isRoomMuted(Long userId, Long dmRoomId) {
        return muteRepository.existsById(new DmRoomNotificationMuteId(userId, dmRoomId));
    }

    @Transactional
    public NotificationEntity createNewDm(
            Long receiverId,
            Long actorId,
            Long dmRoomId,
            String body
    ) {
        if (isRoomMuted(receiverId, dmRoomId)) {
            return null;
        }
        return create(
                receiverId,
                actorId,
                TYPE_NEW_DM,
                REFERENCE_DM_ROOM,
                dmRoomId,
                "새 메시지가 도착했습니다.",
                body
        );
    }

    @Transactional
    public NotificationEntity createSystem(
            Long receiverId,
            String referenceType,
            Long referenceId,
            String title,
            String body
    ) {
        if (!List.of(REFERENCE_REPORT, REFERENCE_ARTIST).contains(referenceType)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "지원하지 않는 시스템 알림 참조 유형입니다.");
        }
        return create(receiverId, null, TYPE_SYSTEM, referenceType, referenceId, title, body);
    }

    @Transactional
    public void read(Long userId, Long notificationId) {
        NotificationEntity value = notificationRepository.findByNotificationIdAndReceiverId(notificationId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOTIFICATION_NOT_FOUND));
        value.markRead(now());
    }

    @Transactional
    public void readAll(Long userId) {
        LocalDateTime now = now();
        notificationRepository.findAllByReceiverIdAndReadFalse(userId)
                .forEach(value -> value.markRead(now));
    }

    @Transactional
    public void readRoom(Long userId, Long dmRoomId) {
        markRoomNotificationsRead(userId, dmRoomId, now());
    }

    private NotificationEntity create(
            Long receiverId,
            Long actorId,
            String notificationType,
            String referenceType,
            Long referenceId,
            String title,
            String body
    ) {
        NotificationEntity notification = notificationRepository.saveAndFlush(NotificationEntity.builder()
                .receiverId(receiverId)
                .actorId(actorId)
                .notificationType(notificationType)
                .referenceType(referenceType)
                .referenceId(referenceId)
                .title(title)
                .body(body)
                .build());
        publishPushAfterCommit(notification);
        return notification;
    }

    private void markRoomNotificationsRead(Long userId, Long dmRoomId, LocalDateTime now) {
        notificationRepository
                .findAllByReceiverIdAndNotificationTypeAndReferenceTypeAndReferenceIdAndReadFalse(
                        userId,
                        TYPE_NEW_DM,
                        REFERENCE_DM_ROOM,
                        dmRoomId
                )
                .forEach(value -> value.markRead(now));
    }

    private void publishPushAfterCommit(NotificationEntity notification) {
        PushMessage message = new PushMessage(
                notification.getReceiverId(),
                notification.getNotificationId(),
                notification.getNotificationType(),
                notification.getReferenceType(),
                notification.getReferenceId(),
                notification.getTitle(),
                notification.getBody()
        );
        Runnable push = () -> {
            try {
                pushNotificationPort.send(message);
            } catch (RuntimeException exception) {
                log.warn(
                        "알림 저장 후 푸시 발송에 실패했습니다. notificationId={}",
                        notification.getNotificationId(),
                        exception
                );
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    push.run();
                }
            });
        } else {
            push.run();
        }
    }

    private NotificationItem item(GroupedUnreadRow row) {
        return new NotificationItem(
                row.getNotificationId(),
                row.getNotificationType(),
                row.getActorId(),
                row.getReferenceType(),
                row.getReferenceId(),
                value(row.getItemCount()),
                row.getTitle(),
                row.getBody(),
                toInstant(row.getCreatedAt())
        );
    }

    private void requireParticipant(Long userId, Long dmRoomId) {
        if (!participantRepository.existsById(new DmRoomParticipantId(dmRoomId, userId))) {
            throw new BusinessException(ErrorCode.NOT_DM_PARTICIPANT);
        }
    }

    private LocalDateTime cursorDateTime(Map<String, Object> cursor) {
        Object value = cursor.get("createdAt");
        if (value == null) {
            return null;
        }
        try {
            return LocalDateTime.parse(value.toString());
        } catch (RuntimeException exception) {
            throw new BusinessException(ErrorCode.INVALID_CURSOR);
        }
    }

    private long cursorLong(Map<String, Object> cursor, String name, long defaultValue) {
        Object value = cursor.get(name);
        if (value == null) {
            return defaultValue;
        }
        try {
            return Long.parseLong(value.toString());
        } catch (RuntimeException exception) {
            throw new BusinessException(ErrorCode.INVALID_CURSOR);
        }
    }

    private long value(Long value) {
        return value == null ? 0L : value;
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
