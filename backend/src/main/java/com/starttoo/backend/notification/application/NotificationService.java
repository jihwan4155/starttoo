package com.starttoo.backend.notification.application;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.notification.api.NotificationDtos;
import com.starttoo.backend.notification.domain.Notification;
import com.starttoo.backend.notification.domain.NotificationRepository;
import com.starttoo.backend.notification.domain.NotificationType;
import com.starttoo.backend.media.application.MediaService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.nio.charset.StandardCharsets;
import java.sql.Types;
import java.util.Base64;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final MediaService mediaService;
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
        NotificationDtos.NotificationResponse response = response(notification, 1L, partner(receiverSeq, type, referenceSeq));
        // 변경: 같은 트랜잭션의 모든 DB 작업이 커밋된 뒤에만 실시간·FCM 전송한다.
        eventPublisher.publishEvent(new NotificationCreatedEvent(receiverSeq, response));
        return response;
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<NotificationDtos.NotificationResponse> list(
            Integer receiverSeq,
            String cursor,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        NotificationCursor decoded = decodeCursor(cursor);
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("receiverSeq", receiverSeq, Types.INTEGER)
                .addValue("cursorDttm", decoded == null ? null : decoded.regDttm(), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("cursorSeq", decoded == null ? null : decoded.notificationSeq(), Types.BIGINT)
                .addValue("limit", safeSize + 1, Types.INTEGER);
        List<NotificationRow> rows = namedParameterJdbcTemplate.query("""
                WITH dm_ranked AS (
                    SELECT notification.*,
                           COUNT(*) OVER (
                               PARTITION BY notification.reference_seq
                           ) AS unread_count,
                           ROW_NUMBER() OVER (
                               PARTITION BY notification.reference_seq
                               ORDER BY notification.reg_dttm DESC,
                                        notification.notification_seq DESC
                           ) AS group_rank
                      FROM notifications notification
                     WHERE notification.receiver_seq = :receiverSeq
                       AND notification.is_read = FALSE
                       AND notification.notification_type = 'NEW_DM'
                ), notification_items AS (
                    SELECT dm.*
                      FROM dm_ranked dm
                     WHERE dm.group_rank = 1
                    UNION ALL
                    SELECT system_notification.*, 1 AS unread_count, 1 AS group_rank
                      FROM notifications system_notification
                     WHERE system_notification.receiver_seq = :receiverSeq
                       AND system_notification.is_read = FALSE
                       AND system_notification.notification_type = 'SYSTEM'
                )
                SELECT item.notification_seq,
                       item.actor_seq,
                       item.notification_type,
                       item.reference_seq,
                       item.title,
                       item.body,
                       item.reg_dttm,
                       item.unread_count,
                       partner.user_seq AS partner_seq,
                       partner.nickname AS partner_nickname,
                       partner.profile_image_seq AS partner_profile_image_seq,
                       profile_image.object_key AS partner_profile_object_key,
                       COALESCE(
                           partner.role = 'ARTIST'
                           AND artist.verification_status = 'VERIFIED',
                           FALSE
                       ) AS partner_verified
                  FROM notification_items item
                  LEFT JOIN dm_rooms room
                    ON item.notification_type = 'NEW_DM'
                   AND room.dm_room_seq = item.reference_seq
                  LEFT JOIN users partner
                    ON partner.user_seq = CASE
                        WHEN room.user1_seq = :receiverSeq THEN room.user2_seq
                        ELSE room.user1_seq
                    END
                  LEFT JOIN images profile_image
                    ON profile_image.image_seq = partner.profile_image_seq
                   AND profile_image.is_deleted = FALSE
                  LEFT JOIN artists artist
                    ON artist.user_seq = partner.user_seq
                   AND artist.is_deleted = FALSE
                 WHERE (
                     CAST(:cursorDttm AS timestamptz) IS NULL
                     OR item.reg_dttm < :cursorDttm
                     OR (
                         item.reg_dttm = :cursorDttm
                         AND item.notification_seq < :cursorSeq
                     )
                 )
                 ORDER BY item.reg_dttm DESC, item.notification_seq DESC
                 LIMIT :limit
                """, parameters, (rs, rowNum) -> new NotificationRow(
                rs.getLong("notification_seq"),
                rs.getObject("actor_seq", Integer.class),
                NotificationType.valueOf(rs.getString("notification_type")),
                rs.getObject("reference_seq", Long.class),
                rs.getString("title"),
                rs.getString("body"),
                rs.getObject("reg_dttm", OffsetDateTime.class),
                rs.getLong("unread_count"),
                rs.getObject("partner_seq", Integer.class),
                rs.getString("partner_nickname"),
                rs.getObject("partner_profile_image_seq", Long.class),
                rs.getString("partner_profile_object_key"),
                rs.getBoolean("partner_verified")
        ));
        boolean hasNext = rows.size() > safeSize;
        List<NotificationRow> page = hasNext ? rows.subList(0, safeSize) : rows;
        List<NotificationDtos.NotificationResponse> items = page.stream()
                .map(this::response)
                .toList();
        String next = hasNext ? encodeCursor(page.get(page.size() - 1)) : null;
        return CursorPageResponse.of(items, next, hasNext);
    }

    @Transactional
    public NotificationDtos.NotificationResponse read(Integer receiverSeq, Long notificationSeq) {
        Notification notification = notificationRepository
                .findByNotificationSeqAndReceiverSeq(notificationSeq, receiverSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND));
        NotificationDtos.NotificationResponse response;
        if (notification.getNotificationType() == NotificationType.NEW_DM) {
            long unreadCount = unreadDmCount(receiverSeq, notification.getReferenceSeq());
            response = response(
                    notification,
                    unreadCount,
                    partner(receiverSeq, NotificationType.NEW_DM, notification.getReferenceSeq())
            );
            readDmRoom(receiverSeq, notification.getReferenceSeq(), OffsetDateTime.now());
        } else {
            response = response(notification, notification.isRead() ? 0L : 1L, null);
            notification.markRead();
        }
        return response;
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

    @Transactional(readOnly = true)
    public NotificationDtos.UnreadCounts unreadCounts(Integer receiverSeq) {
        EnumMap<NotificationType, Long> byType = new EnumMap<>(NotificationType.class);
        for (NotificationType type : NotificationType.values()) {
            byType.put(type, 0L);
        }
        List<UnreadRow> rows = jdbcTemplate.query("""
                SELECT notification_type, COUNT(*) AS unread_count
                  FROM notifications
                 WHERE receiver_seq = ?
                   AND is_read = FALSE
                 GROUP BY notification_type
                """, (rs, rowNum) -> new UnreadRow(
                NotificationType.valueOf(rs.getString("notification_type")),
                rs.getLong("unread_count")
        ), receiverSeq);
        rows.forEach(row -> byType.put(row.type(), row.count()));
        long total = byType.values().stream()
                .mapToLong(Long::longValue)
                .sum();
        return new NotificationDtos.UnreadCounts(total, Map.copyOf(byType));
    }

    private NotificationDtos.NotificationResponse response(
            Notification notification,
            long unreadCount,
            NotificationDtos.NotificationPartner partner
    ) {
        return new NotificationDtos.NotificationResponse(
                notification.getNotificationSeq(),
                notification.getActorSeq(),
                notification.getNotificationType(),
                notification.getReferenceSeq(),
                partner,
                unreadCount,
                notification.getTitle(),
                notification.getBody(),
                notification.getRegDttm()
        );
    }

    private NotificationDtos.NotificationResponse response(NotificationRow row) {
        NotificationDtos.NotificationPartner partner = row.partnerSeq() == null ? null
                : new NotificationDtos.NotificationPartner(
                row.partnerSeq(),
                row.partnerNickname(),
                row.partnerProfileImageSeq(),
                row.partnerProfileObjectKey() == null
                        ? null
                        : mediaService.downloadUrl(row.partnerProfileObjectKey()),
                row.partnerVerified()
        );
        return new NotificationDtos.NotificationResponse(
                row.notificationSeq(),
                row.actorSeq(),
                row.notificationType(),
                row.referenceSeq(),
                partner,
                row.unreadCount(),
                row.title(),
                row.body(),
                row.regDttm()
        );
    }

    private NotificationDtos.NotificationPartner partner(
            Integer receiverSeq,
            NotificationType type,
            Long referenceSeq
    ) {
        if (type != NotificationType.NEW_DM || referenceSeq == null) {
            return null;
        }
        List<NotificationDtos.NotificationPartner> partners = jdbcTemplate.query("""
                SELECT partner.user_seq,
                       partner.nickname,
                       partner.profile_image_seq,
                       image.object_key,
                       COALESCE(
                           partner.role = 'ARTIST'
                           AND artist.verification_status = 'VERIFIED',
                           FALSE
                       ) AS partner_verified
                  FROM dm_rooms room
                  JOIN users partner
                    ON partner.user_seq = CASE
                        WHEN room.user1_seq = ? THEN room.user2_seq
                        ELSE room.user1_seq
                    END
                  LEFT JOIN images image
                    ON image.image_seq = partner.profile_image_seq
                   AND image.is_deleted = FALSE
                  LEFT JOIN artists artist
                    ON artist.user_seq = partner.user_seq
                   AND artist.is_deleted = FALSE
                 WHERE room.dm_room_seq = ?
                   AND (room.user1_seq = ? OR room.user2_seq = ?)
                """, (rs, rowNum) -> new NotificationDtos.NotificationPartner(
                rs.getInt("user_seq"),
                rs.getString("nickname"),
                rs.getObject("profile_image_seq", Long.class),
                rs.getString("object_key") == null
                        ? null
                        : mediaService.downloadUrl(rs.getString("object_key")),
                rs.getBoolean("partner_verified")
        ), receiverSeq, referenceSeq, receiverSeq, receiverSeq);
        return partners.isEmpty() ? null : partners.get(0);
    }

    private long unreadDmCount(Integer receiverSeq, Long roomSeq) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                  FROM notifications
                 WHERE receiver_seq = ?
                   AND notification_type = 'NEW_DM'
                   AND reference_seq = ?
                   AND is_read = FALSE
                """, Long.class, receiverSeq, roomSeq);
        return count == null ? 0L : count;
    }

    private NotificationCursor decodeCursor(String cursor) {
        if (cursor == null) {
            return null;
        }
        try {
            String decoded = new String(
                    Base64.getUrlDecoder().decode(cursor),
                    StandardCharsets.UTF_8
            );
            String[] values = decoded.split("\\|", -1);
            if (values.length != 2) {
                throw new IllegalArgumentException("invalid cursor");
            }
            return new NotificationCursor(
                    OffsetDateTime.parse(values[0]),
                    Long.parseLong(values[1])
            );
        } catch (RuntimeException exception) {
            throw BusinessException.of(ErrorCode.INVALID_CURSOR);
        }
    }

    private String encodeCursor(NotificationRow row) {
        String value = row.regDttm() + "|" + row.notificationSeq();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private record UnreadRow(NotificationType type, long count) {
    }

    private record NotificationCursor(OffsetDateTime regDttm, Long notificationSeq) {
    }

    private record NotificationRow(
            Long notificationSeq,
            Integer actorSeq,
            NotificationType notificationType,
            Long referenceSeq,
            String title,
            String body,
            OffsetDateTime regDttm,
            long unreadCount,
            Integer partnerSeq,
            String partnerNickname,
            Long partnerProfileImageSeq,
            String partnerProfileObjectKey,
            boolean partnerVerified
    ) {
    }
}
