package com.starttoo.domain.notification.repository;

import com.starttoo.domain.notification.entity.NotificationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {

    interface GroupedUnreadRow {
        Long getNotificationId();
        String getNotificationType();
        Long getActorId();
        String getReferenceType();
        Long getReferenceId();
        Long getItemCount();
        String getTitle();
        String getBody();
        LocalDateTime getCreatedAt();
    }

    interface UnreadCountRow {
        Long getTotalCount();
        Long getNewDmCount();
        Long getSystemCount();
    }

    @Query(value = """
            WITH ranked_dm AS (
                SELECT
                    n.notification_id,
                    n.notification_type,
                    n.actor_id,
                    n.reference_type,
                    n.reference_id,
                    n.title,
                    n.body,
                    n.created_at,
                    COUNT(*) OVER (PARTITION BY n.reference_id) AS item_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY n.reference_id
                        ORDER BY n.created_at DESC, n.notification_id DESC
                    ) AS row_number_in_room
                FROM notifications n
                WHERE n.receiver_id = :receiverId
                  AND n.is_read = 0
                  AND n.notification_type = 'NEW_DM'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM user_blocks b
                      WHERE (b.blocker_id = :receiverId AND b.blocked_id = n.actor_id)
                         OR (b.blocker_id = n.actor_id AND b.blocked_id = :receiverId)
                  )
            ),
            grouped_items AS (
                SELECT
                    notification_id,
                    notification_type,
                    actor_id,
                    reference_type,
                    reference_id,
                    item_count,
                    title,
                    body,
                    created_at
                FROM ranked_dm
                WHERE row_number_in_room = 1

                UNION ALL

                SELECT
                    n.notification_id,
                    n.notification_type,
                    n.actor_id,
                    n.reference_type,
                    n.reference_id,
                    1 AS item_count,
                    n.title,
                    n.body,
                    n.created_at
                FROM notifications n
                WHERE n.receiver_id = :receiverId
                  AND n.is_read = 0
                  AND n.notification_type = 'SYSTEM'
                  AND (
                      n.actor_id IS NULL
                      OR NOT EXISTS (
                          SELECT 1
                          FROM user_blocks b
                          WHERE (b.blocker_id = :receiverId AND b.blocked_id = n.actor_id)
                             OR (b.blocker_id = n.actor_id AND b.blocked_id = :receiverId)
                      )
                  )
            )
            SELECT
                notification_id AS notificationId,
                notification_type AS notificationType,
                actor_id AS actorId,
                reference_type AS referenceType,
                reference_id AS referenceId,
                item_count AS itemCount,
                title,
                body,
                created_at AS createdAt
            FROM grouped_items
            WHERE :cursorCreatedAt IS NULL
               OR created_at < :cursorCreatedAt
               OR (created_at = :cursorCreatedAt AND notification_id < :cursorNotificationId)
            ORDER BY created_at DESC, notification_id DESC
            """, nativeQuery = true)
    List<GroupedUnreadRow> findGroupedUnread(
            @Param("receiverId") Long receiverId,
            @Param("cursorCreatedAt") LocalDateTime cursorCreatedAt,
            @Param("cursorNotificationId") Long cursorNotificationId,
            Pageable pageable
    );

    @Query(value = """
            SELECT
                COUNT(*) AS totalCount,
                COALESCE(SUM(CASE WHEN n.notification_type = 'NEW_DM' THEN 1 ELSE 0 END), 0) AS newDmCount,
                COALESCE(SUM(CASE WHEN n.notification_type = 'SYSTEM' THEN 1 ELSE 0 END), 0) AS systemCount
            FROM notifications n
            WHERE n.receiver_id = :receiverId
              AND n.is_read = 0
              AND (
                  n.actor_id IS NULL
                  OR NOT EXISTS (
                      SELECT 1
                      FROM user_blocks b
                      WHERE (b.blocker_id = :receiverId AND b.blocked_id = n.actor_id)
                         OR (b.blocker_id = n.actor_id AND b.blocked_id = :receiverId)
                  )
              )
            """, nativeQuery = true)
    UnreadCountRow countGroupedUnread(@Param("receiverId") Long receiverId);

    Optional<NotificationEntity> findByNotificationIdAndReceiverId(Long notificationId, Long receiverId);
    List<NotificationEntity> findAllByReceiverIdAndReadFalse(Long receiverId);
    List<NotificationEntity> findAllByReceiverIdAndNotificationTypeAndReferenceTypeAndReferenceIdAndReadFalse(
            Long receiverId,
            String notificationType,
            String referenceType,
            Long referenceId
    );
}
