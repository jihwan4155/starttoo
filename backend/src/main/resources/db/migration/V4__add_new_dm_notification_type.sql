-- DM 메시지 알림은 reference_seq에 dm_room_seq를 저장한다.
ALTER TABLE notifications
    DROP CONSTRAINT ck_notifications_type;

ALTER TABLE notifications
    ADD CONSTRAINT ck_notifications_type
        CHECK (
            notification_type IN (
                'POST_LIKE',
                'POST_COMMENT',
                'COMMENT_LIKE',
                'FOLLOW',
                'NEW_DM',
                'SYSTEM'
            )
        );

ALTER TABLE notifications
    DROP CONSTRAINT ck_notifications_actor_reference;

ALTER TABLE notifications
    ADD CONSTRAINT ck_notifications_actor_reference
        CHECK (
            (
                notification_type IN (
                    'POST_LIKE',
                    'POST_COMMENT',
                    'COMMENT_LIKE',
                    'FOLLOW',
                    'NEW_DM'
                )
                AND actor_seq IS NOT NULL
                AND reference_seq IS NOT NULL
            )
            OR
            (
                notification_type = 'SYSTEM'
                AND actor_seq IS NULL
            )
        );

CREATE INDEX idx_notifications_receiver_unread_dm_room
    ON notifications (receiver_seq, reference_seq)
    WHERE notification_type = 'NEW_DM'
      AND is_read = FALSE;
