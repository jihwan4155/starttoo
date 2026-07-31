DROP INDEX IF EXISTS uq_users_active_nickname;
DROP INDEX IF EXISTS uq_users_active_phone_number;

CREATE UNIQUE INDEX uq_users_active_nickname
    ON users (nickname)
    WHERE is_deleted = FALSE
      AND account_status <> 'WITHDRAWN';

CREATE UNIQUE INDEX uq_users_active_phone_number
    ON users (phone_number)
    WHERE is_deleted = FALSE
      AND account_status <> 'WITHDRAWN';
