-- 감사 FK를 만족시키기 위한 최초 관리자와 OAuth 제공자 기준정보.
-- 최초 관리자는 비밀번호 로그인을 제공하지 않으며 운영 배포 후 실제 관리자 정책에 맞춰 교체한다.
INSERT INTO users (
    user_seq,
    nickname,
    phone_number,
    phone_verified_dttm,
    role,
    account_status,
    status_changed_dttm,
    reg_dttm,
    mod_dttm,
    mod_usr_seq,
    is_deleted
) VALUES (
    1,
    'starttooAdmin',
    '+821000000000',
    CURRENT_TIMESTAMP,
    'ADMIN',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    NULL,
    FALSE
);

UPDATE users SET mod_usr_seq = user_seq WHERE user_seq = 1;
ALTER TABLE users ALTER COLUMN user_seq RESTART WITH 2;

INSERT INTO user_account_status_histories (
    user_seq,
    previous_status,
    changed_status,
    reason_type,
    reg_usr_seq
) VALUES (1, NULL, 'ACTIVE', 'SIGNUP', 1);

INSERT INTO oauth_providers (
    provider_code,
    provider_name,
    is_active,
    reg_usr_seq,
    mod_usr_seq
) VALUES
    ('GOOGLE', 'Google', TRUE, 1, 1),
    ('KAKAO', 'Kakao', TRUE, 1, 1);
