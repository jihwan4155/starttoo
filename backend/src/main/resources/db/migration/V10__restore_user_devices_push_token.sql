ALTER TABLE user_devices
    RENAME COLUMN firebase_installation_id TO push_token;

ALTER TABLE user_devices
    ALTER COLUMN push_token TYPE VARCHAR(512);

ALTER TABLE user_devices
    RENAME CONSTRAINT uq_user_devices_firebase_installation_id
    TO uq_user_devices_push_token;
