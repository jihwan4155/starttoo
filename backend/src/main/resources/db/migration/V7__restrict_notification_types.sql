DELETE FROM notifications
 WHERE notification_type NOT IN ('NEW_DM', 'SYSTEM');

ALTER TABLE notifications
    DROP CONSTRAINT ck_notifications_type;

ALTER TABLE notifications
    ADD CONSTRAINT ck_notifications_type
        CHECK (notification_type IN ('NEW_DM', 'SYSTEM'));

ALTER TABLE notifications
    DROP CONSTRAINT ck_notifications_actor_reference;

ALTER TABLE notifications
    ADD CONSTRAINT ck_notifications_actor_reference
        CHECK (
            (
                notification_type = 'NEW_DM'
                AND actor_seq IS NOT NULL
                AND reference_seq IS NOT NULL
            )
            OR
            (
                notification_type = 'SYSTEM'
                AND actor_seq IS NULL
            )
        );
