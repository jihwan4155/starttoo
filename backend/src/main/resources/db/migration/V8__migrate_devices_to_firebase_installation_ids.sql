UPDATE user_devices
   SET push_token = 'legacy-token-' || device_seq,
       is_active = FALSE,
       mod_dttm = CURRENT_TIMESTAMP;

ALTER TABLE user_devices
    ALTER COLUMN push_token TYPE VARCHAR(128);

ALTER TABLE user_devices
    RENAME COLUMN push_token TO firebase_installation_id;

ALTER TABLE user_devices
    RENAME CONSTRAINT uq_user_devices_push_token
    TO uq_user_devices_firebase_installation_id;
