package com.starttoo.backend.notification.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Optional<Notification> findByNotificationSeqAndReceiverSeq(
            Long notificationSeq,
            Integer receiverSeq
    );

    @Modifying
    @Query("""
            update Notification n
               set n.read = true, n.readDttm = CURRENT_TIMESTAMP
             where n.receiverSeq = :receiverSeq and n.read = false
            """)
    int markAllRead(@Param("receiverSeq") Integer receiverSeq);

    @Modifying
    @Query("""
            update Notification n
               set n.read = true, n.readDttm = :readDttm
             where n.receiverSeq = :receiverSeq
               and n.notificationType = :notificationType
               and n.referenceSeq = :roomSeq
               and n.read = false
            """)
    int markDmRoomRead(
            @Param("receiverSeq") Integer receiverSeq,
            @Param("roomSeq") Long roomSeq,
            @Param("notificationType") NotificationType notificationType,
            @Param("readDttm") OffsetDateTime readDttm
    );
}
