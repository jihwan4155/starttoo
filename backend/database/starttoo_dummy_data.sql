-- ============================================================================
-- Starttoo 로컬 API 통합 테스트용 더미 데이터
-- 대상: database/starttoo_schema.sql로 생성한 MySQL 8.0+ tattoo_platform DB
--
-- 주의: 이 스크립트는 아래 테이블의 기존 데이터를 모두 TRUNCATE한다.
--       운영 DB에서는 절대 실행하지 말고 로컬 개발 DB에서만 실행한다.
--
-- 고정 테스트 계정
--   USER    : user_id = 1  (테스트유저)
--   ARTIST  : user_id = 2  (서울잉크, VERIFIED)
--   ADMIN   : user_id = 9  (테스트관리자)
--   BLOCKED : user_id = 7  (user_id=1이 차단한 회원)
--   SUSPEND : user_id = 10
--   WITHDRAW: user_id = 11
--
-- 로컬 테스트 로그인
--   POST /v1/test/auth/login
--   body: {"userId": 1} / {"userId": 2} / {"userId": 9}
--
-- Refresh Token 재발급 테스트(한 번 사용하면 회전되어 재사용 불가)
--   raw token: starttoo-test-refresh-user-1
-- ============================================================================

USE `tattoo_platform`;
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- --------------------------------------------------------------------------
-- 0. 기존 로컬 데이터 초기화
-- --------------------------------------------------------------------------

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `user_recent_searches`;
TRUNCATE TABLE `dm_room_notification_mutes`;
TRUNCATE TABLE `dm_room_participants`;
TRUNCATE TABLE `dm_messages`;
TRUNCATE TABLE `dm_rooms`;
TRUNCATE TABLE `post_reports`;
TRUNCATE TABLE `post_hidden_preferences`;
TRUNCATE TABLE `post_bookmarks`;
TRUNCATE TABLE `post_likes`;
TRUNCATE TABLE `comment_likes`;
TRUNCATE TABLE `comments`;
TRUNCATE TABLE `post_images`;
TRUNCATE TABLE `posts`;
TRUNCATE TABLE `user_blocks`;
TRUNCATE TABLE `user_follows`;
TRUNCATE TABLE `user_archive`;
TRUNCATE TABLE `tattoo_collections`;
TRUNCATE TABLE `user_tattoo_preferences`;
TRUNCATE TABLE `tattoo_designs`;
TRUNCATE TABLE `tattoos`;
TRUNCATE TABLE `tattoo_artists`;
TRUNCATE TABLE `notifications`;
TRUNCATE TABLE `refresh_tokens`;
TRUNCATE TABLE `user_devices`;
TRUNCATE TABLE `users`;
TRUNCATE TABLE `images`;

SET FOREIGN_KEY_CHECKS = 1;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS `seed_numbers`;
CREATE TEMPORARY TABLE `seed_numbers` (
    `n` INT NOT NULL,
    PRIMARY KEY (`n`)
);

INSERT INTO `seed_numbers` (`n`) VALUES
    (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
    (11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
    (21),(22),(23),(24),(25),(26),(27),(28),(29),(30),
    (31),(32),(33),(34),(35),(36),(37),(38),(39),(40),
    (41),(42),(43),(44),(45),(46),(47),(48),(49),(50),
    (51),(52),(53),(54),(55),(56),(57),(58),(59),(60),
    (61),(62),(63),(64),(65),(66),(67),(68),(69),(70),
    (71),(72);

-- --------------------------------------------------------------------------
-- 1. 이미지 메타데이터
--    1~12  : 타투 원본
--    13~20 : 타투 도안
--    21~52 : 게시글 이미지
--    53~62 : 컬렉션 이미지
--    63~72 : 관리자 학습 테스트용 미연결 이미지
-- --------------------------------------------------------------------------

INSERT INTO `images` (
    `image_id`, `object_key`, `is_used_for_training`, `trained_at`, `created_at`
)
SELECT
    sn.n,
    CASE
        WHEN sn.n BETWEEN 1 AND 12 THEN CONCAT(
            'tattoos/original/tattoo-', LPAD(sn.n, 2, '0'), '.webp'
        )
        WHEN sn.n BETWEEN 13 AND 20 THEN CONCAT(
            'tattoos/design/tattoo-', LPAD(sn.n - 12, 2, '0'), '-design.webp'
        )
        WHEN sn.n BETWEEN 21 AND 50 THEN CONCAT(
            'posts/seed/post-', LPAD(sn.n - 20, 2, '0'), '/image-0.webp'
        )
        WHEN sn.n = 51 THEN 'posts/seed/post-01/image-1.webp'
        WHEN sn.n = 52 THEN 'posts/seed/post-02/image-1.webp'
        WHEN sn.n BETWEEN 53 AND 62 THEN CONCAT(
            'collections/seed/collection-', LPAD(sn.n - 52, 2, '0'), '.webp'
        )
        ELSE CONCAT(
            'training/seed/unlinked-', LPAD(sn.n - 62, 2, '0'), '.webp'
        )
    END,
    CASE WHEN MOD(sn.n, 10) = 4 THEN 1 ELSE 0 END,
    CASE
        WHEN MOD(sn.n, 10) = 4
            THEN TIMESTAMPADD(DAY, -2, '2026-07-22 00:00:00')
        ELSE NULL
    END,
    TIMESTAMPADD(MINUTE, -sn.n, '2026-07-22 00:00:00')
FROM `seed_numbers` sn
WHERE sn.n <= 72;

-- --------------------------------------------------------------------------
-- 2. 회원
--    profile_image_key는 images 테이블에 넣지 않는 현재 ERD 규칙을 따른다.
-- --------------------------------------------------------------------------

INSERT INTO `users` (
    `user_id`, `oauth_provider`, `oauth_subject`, `email`, `nickname`,
    `profile_image_key`, `birth_date`, `gender`, `role`, `account_status`,
    `withdrawal_reason`, `withdrawn_at`, `created_at`, `updated_at`
) VALUES
    (1,  'KAKAO',  'seed-user-1',  'user1@starttoo.local',  '테스트유저',
     'profiles/seed/user-1.webp', '1998-04-12', 'UNSPECIFIED', 'USER', 'ACTIVE',
     NULL, NULL, '2026-06-01 01:00:00', '2026-07-20 01:00:00'),
    (2,  'GOOGLE', 'seed-artist-2', 'artist2@starttoo.local', '서울잉크',
     'profiles/seed/artist-2.webp', '1992-03-08', 'FEMALE', 'ARTIST', 'ACTIVE',
     NULL, NULL, '2026-05-01 01:00:00', '2026-07-20 02:00:00'),
    (3,  'KAKAO',  'seed-artist-3', 'artist3@starttoo.local', '라인워크민수',
     'profiles/seed/artist-3.webp', '1994-11-21', 'MALE', 'ARTIST', 'ACTIVE',
     NULL, NULL, '2026-05-02 01:00:00', '2026-07-19 02:00:00'),
    (4,  'GOOGLE', 'seed-artist-4', 'artist4@starttoo.local', '부산블랙',
     'profiles/seed/artist-4.webp', NULL, NULL, 'ARTIST', 'ACTIVE',
     NULL, NULL, '2026-05-03 01:00:00', '2026-07-18 02:00:00'),
    (5,  'KAKAO',  'seed-artist-5', 'artist5@starttoo.local', '제주바늘',
     'profiles/seed/artist-5.webp', '1996-01-30', 'OTHER', 'ARTIST', 'ACTIVE',
     NULL, NULL, '2026-05-04 01:00:00', '2026-07-17 02:00:00'),
    (6,  'GOOGLE', 'seed-user-6', 'user6@starttoo.local', '팔로워하나',
     'profiles/seed/user-6.webp', '2000-02-15', 'UNSPECIFIED', 'USER', 'ACTIVE',
     NULL, NULL, '2026-06-02 01:00:00', '2026-07-16 02:00:00'),
    (7,  'KAKAO',  'seed-user-7', 'user7@starttoo.local', '차단대상',
     'profiles/seed/user-7.webp', NULL, NULL, 'USER', 'ACTIVE',
     NULL, NULL, '2026-06-03 01:00:00', '2026-07-15 02:00:00'),
    (8,  'GOOGLE', 'seed-user-8', 'user8@starttoo.local', '디엠친구',
     'system/profile/default-profile.webp', '1999-09-09', 'FEMALE', 'USER', 'ACTIVE',
     NULL, NULL, '2026-06-04 01:00:00', '2026-07-14 02:00:00'),
    (9,  'KAKAO',  'seed-admin-9', 'admin@starttoo.local', '테스트관리자',
     'system/profile/default-profile.webp', NULL, NULL, 'ADMIN', 'ACTIVE',
     NULL, NULL, '2026-04-01 01:00:00', '2026-07-13 02:00:00'),
    (10, 'GOOGLE', 'seed-suspended-10', 'suspended@starttoo.local', '정지회원',
     'system/profile/default-profile.webp', NULL, NULL, 'USER', 'SUSPENDED',
     NULL, NULL, '2026-06-05 01:00:00', '2026-07-12 02:00:00'),
    (11, 'KAKAO',  'seed-withdrawn-11', 'withdrawn@starttoo.local', '탈퇴회원',
     'system/profile/default-profile.webp', NULL, NULL, 'USER', 'WITHDRAWN',
     '통합 테스트용 탈퇴 계정', '2026-07-01 00:00:00',
     '2026-06-06 01:00:00', '2026-07-01 00:00:00'),
    (12, 'GOOGLE', 'seed-artist-12', 'artist12@starttoo.local', '대구도트',
     'profiles/seed/artist-12.webp', NULL, NULL, 'ARTIST', 'ACTIVE',
     NULL, NULL, '2026-05-05 01:00:00', '2026-07-11 02:00:00'),
    (13, 'KAKAO',  'seed-artist-13', 'artist13@starttoo.local', '서울파인라인',
     'profiles/seed/artist-13.webp', NULL, NULL, 'ARTIST', 'ACTIVE',
     NULL, NULL, '2026-05-06 01:00:00', '2026-07-10 02:00:00'),
    (14, 'GOOGLE', 'seed-artist-14', 'artist14@starttoo.local', '부산올드스쿨',
     'profiles/seed/artist-14.webp', NULL, NULL, 'ARTIST', 'ACTIVE',
     NULL, NULL, '2026-05-07 01:00:00', '2026-07-09 02:00:00'),
    (15, 'KAKAO',  'seed-user-15', 'user15@starttoo.local', '이미지없는회원',
     'system/profile/default-profile.webp', NULL, 'UNSPECIFIED', 'USER', 'ACTIVE',
     NULL, NULL, '2026-06-07 01:00:00', '2026-07-08 02:00:00');

-- 타투이스트 목록 커서 페이지네이션을 검증하기 위한 추가 활성 타투이스트 20명
INSERT INTO `users` (
    `user_id`, `oauth_provider`, `oauth_subject`, `email`, `nickname`,
    `profile_image_key`, `role`, `account_status`, `created_at`, `updated_at`
)
SELECT
    15 + `n`,
    CASE WHEN MOD(`n`, 2) = 0 THEN 'GOOGLE' ELSE 'KAKAO' END,
    CONCAT('seed-generated-artist-', `n`),
    CONCAT('generated-artist-', `n`, '@starttoo.local'),
    CONCAT('시드아티스트', LPAD(`n`, 2, '0')),
    CONCAT('profiles/seed/generated-artist-', `n`, '.webp'),
    'ARTIST',
    'ACTIVE',
    TIMESTAMPADD(DAY, -`n`, '2026-06-30 00:00:00'),
    TIMESTAMPADD(DAY, -`n`, '2026-07-22 00:00:00')
FROM `seed_numbers`
WHERE `n` <= 20;

-- --------------------------------------------------------------------------
-- 3. 타투이스트 상세 상태
-- --------------------------------------------------------------------------

INSERT INTO `tattoo_artists` (
    `user_id`, `shop_name`, `shop_city`, `shop_address`, `shop_phone`,
    `business_hours`, `popularity`, `approval_status`, `rejection_reason`,
    `approved_at`, `created_at`, `updated_at`
) VALUES
    (2, '서울잉크 스튜디오', '서울', '서울 마포구 월드컵북로 10', '02-111-0002',
     '월-토 12:00~21:00, 일요일 예약제', 98.5000, 'VERIFIED', NULL,
     '2026-05-10 00:00:00', '2026-05-01 01:00:00', '2026-07-20 02:00:00'),
    (3, '민수 라인워크', '서울', '서울 성동구 연무장길 20', '02-111-0003',
     '화-일 11:00~20:00', 87.2000, 'PENDING', NULL,
     NULL, '2026-05-02 01:00:00', '2026-07-19 02:00:00'),
    (4, '부산 블랙룸', '부산', '부산 수영구 광안해변로 30', '051-111-0004',
     '예약 문의 필수', 76.4000, 'REJECTED', '사업자 증빙 자료를 다시 제출해 주세요.',
     NULL, '2026-05-03 01:00:00', '2026-07-18 02:00:00'),
    (5, '제주 바늘', '제주', '제주 제주시 애월로 40', '064-111-0005',
     '수-일 10:00~19:00', 66.3000, 'ASPIRING', NULL,
     NULL, '2026-05-04 01:00:00', '2026-07-17 02:00:00'),
    (12, '대구 도트랩', '대구', '대구 중구 동성로 12', '053-111-0012',
     '예약제', 55.5000, 'UNVERIFIED', NULL,
     NULL, '2026-05-05 01:00:00', '2026-07-16 02:00:00'),
    (13, '서울 파인라인', '서울', '서울 용산구 녹사평대로 13', '02-111-0013',
     '매일 13:00~22:00', 92.1000, 'VERIFIED', NULL,
     '2026-05-15 00:00:00', '2026-05-06 01:00:00', '2026-07-15 02:00:00'),
    (14, '부산 올드스쿨', '부산', '부산 부산진구 서전로 14', '051-111-0014',
     '월요일 휴무', 83.7000, 'VERIFIED', NULL,
     '2026-05-16 00:00:00', '2026-05-07 01:00:00', '2026-07-14 02:00:00');

INSERT INTO `tattoo_artists` (
    `user_id`, `shop_name`, `shop_city`, `shop_address`, `shop_phone`,
    `business_hours`, `popularity`, `approval_status`, `rejection_reason`,
    `approved_at`, `created_at`, `updated_at`
)
SELECT
    15 + `n`,
    CONCAT('시드 스튜디오 ', LPAD(`n`, 2, '0')),
    CASE MOD(`n`, 4)
        WHEN 0 THEN '서울'
        WHEN 1 THEN '부산'
        WHEN 2 THEN '대구'
        ELSE '제주'
    END,
    CONCAT('테스트 주소 ', `n`),
    CONCAT('010-9000-', LPAD(`n`, 4, '0')),
    '평일 12:00~20:00, 방문 전 예약',
    CAST(70.0000 - (`n` * 1.2500) AS DECIMAL(8,4)),
    CASE MOD(`n`, 5)
        WHEN 0 THEN 'VERIFIED'
        WHEN 1 THEN 'PENDING'
        WHEN 2 THEN 'ASPIRING'
        WHEN 3 THEN 'UNVERIFIED'
        ELSE 'VERIFIED'
    END,
    NULL,
    CASE
        WHEN MOD(`n`, 5) IN (0, 4)
            THEN TIMESTAMPADD(DAY, -`n`, '2026-07-01 00:00:00')
        ELSE NULL
    END,
    TIMESTAMPADD(DAY, -`n`, '2026-06-30 00:00:00'),
    TIMESTAMPADD(DAY, -`n`, '2026-07-22 00:00:00')
FROM `seed_numbers`
WHERE `n` <= 20;

-- --------------------------------------------------------------------------
-- 4. 기기, Refresh Token, 알림 설정
-- --------------------------------------------------------------------------

INSERT INTO `user_devices` (
    `device_id`, `user_id`, `push_token`, `platform`, `is_active`,
    `last_used_at`, `created_at`, `updated_at`
) VALUES
    (1, 1, 'seed-push-token-user-1-web', 'WEB', 1,
     '2026-07-22 00:10:00', '2026-07-01 00:00:00', '2026-07-22 00:10:00'),
    (2, 2, 'seed-push-token-artist-2-android', 'ANDROID', 1,
     '2026-07-22 00:11:00', '2026-07-02 00:00:00', '2026-07-22 00:11:00'),
    (3, 1, 'seed-push-token-user-1-old', 'ANDROID', 0,
     '2026-06-30 00:00:00', '2026-06-01 00:00:00', '2026-06-30 00:00:00'),
    (4, 6, 'seed-push-token-user-6-ios', 'IOS', 1,
     '2026-07-21 23:00:00', '2026-07-03 00:00:00', '2026-07-21 23:00:00');

INSERT INTO `refresh_tokens` (
    `refresh_token_id`, `user_id`, `device_id`, `token_hash`, `expires_at`,
    `revoked_at`, `last_used_at`, `created_at`
) VALUES
    (1, 1, 1, LOWER(SHA2('starttoo-test-refresh-user-1', 256)),
     '2099-12-31 23:59:59', NULL, NULL, '2026-07-22 00:00:00'),
    (2, 6, 4, LOWER(SHA2('starttoo-expired-refresh-user-6', 256)),
     '2026-07-10 00:00:00', NULL, NULL, '2026-07-01 00:00:00'),
    (3, 2, 2, LOWER(SHA2('starttoo-revoked-refresh-artist-2', 256)),
     '2099-12-31 23:59:59', '2026-07-20 00:00:00', '2026-07-20 00:00:00',
     '2026-07-01 00:00:00');

-- --------------------------------------------------------------------------
-- 5. 타투, 타투 도안, 취향, 컬렉션, 보관함
-- --------------------------------------------------------------------------

INSERT INTO `tattoos` (
    `tattoo_id`, `user_id`, `image_id`, `source_type`,
    `primary_style`, `secondary_style`, `color`, `rendering`,
    `created_at`, `updated_at`
) VALUES
    (1, NULL, 1, 'DEFAULT', 'BLACKWORK', 'LINEWORK', 'BLACK', 'SKETCH',
     '2026-06-01 00:00:00', '2026-06-01 00:00:00'),
    (2, NULL, 2, 'DEFAULT', 'MINIMAL', NULL, 'BLACK', 'LINE_ART',
     '2026-06-02 00:00:00', '2026-06-02 00:00:00'),
    (3, 1, 3, 'AI_GENERATED', 'GEOMETRIC', 'DOTWORK', 'BLACK', 'WATER_COLOR',
     '2026-06-03 00:00:00', '2026-06-03 00:00:00'),
    (4, 2, 4, 'USER_PROFILE', 'ORIENTAL', 'BLACKWORK', 'COLOR', 'REALISTIC',
     '2026-06-04 00:00:00', '2026-06-04 00:00:00'),
    (5, 3, 5, 'USER_PROFILE', 'LINEWORK', 'MINIMAL', 'BLACK', NULL,
     '2026-06-05 00:00:00', '2026-06-05 00:00:00'),
    (6, 6, 6, 'AI_GENERATED', 'LETTERING', NULL, 'BLACK', 'SKETCH',
     '2026-06-06 00:00:00', '2026-06-06 00:00:00'),
    (7, 13, 7, 'USER_PROFILE', 'FINE_LINE', 'FLORAL', 'BLACK', 'LINE_ART',
     '2026-06-07 00:00:00', '2026-06-07 00:00:00'),
    (8, 14, 8, 'USER_PROFILE', 'OLD_SCHOOL', NULL, 'COLOR', 'WATER_COLOR',
     '2026-06-08 00:00:00', '2026-06-08 00:00:00'),
    (9, 1, 9, 'AI_GENERATED', 'BLACKWORK', NULL, 'BLACK', NULL,
     '2026-06-09 00:00:00', '2026-06-09 00:00:00'),
    (10, 2, 10, 'USER_PROFILE', 'REALISM', NULL, 'MONOCHROME', 'REALISTIC',
     '2026-06-10 00:00:00', '2026-06-10 00:00:00'),
    (11, 5, 11, 'USER_PROFILE', 'WATERCOLOR', 'FLORAL', 'COLOR', 'WATER_COLOR',
     '2026-06-11 00:00:00', '2026-06-11 00:00:00'),
    (12, 8, 12, 'AI_GENERATED', NULL, NULL, NULL, NULL,
     '2026-06-12 00:00:00', '2026-06-12 00:00:00');

INSERT INTO `tattoo_designs` (
    `tattoo_id`, `image_id`, `created_at`, `updated_at`
) VALUES
    (1, 13, '2026-06-15 00:00:00', '2026-06-15 00:00:00'),
    (2, 14, '2026-06-15 00:01:00', '2026-06-15 00:01:00'),
    (3, 15, '2026-06-15 00:02:00', '2026-06-15 00:02:00'),
    (4, 16, '2026-06-15 00:03:00', '2026-06-15 00:03:00'),
    (5, 17, '2026-06-15 00:04:00', '2026-06-15 00:04:00'),
    (6, 18, '2026-06-15 00:05:00', '2026-06-15 00:05:00'),
    (7, 19, '2026-06-15 00:06:00', '2026-06-15 00:06:00'),
    (8, 20, '2026-06-15 00:07:00', '2026-06-15 00:07:00');

INSERT INTO `user_tattoo_preferences` (
    `user_id`, `tattoo_id`, `preference_source`, `score`, `created_at`, `updated_at`
) VALUES
    (1, 1, 'SURVEY',   1.0000, '2026-07-01 00:00:00', '2026-07-01 00:00:00'),
    (1, 2, 'SURVEY',   1.0000, '2026-07-01 00:00:01', '2026-07-01 00:00:01'),
    (1, 3, 'SURVEY',   1.0000, '2026-07-01 00:00:02', '2026-07-01 00:00:02'),
    (1, 4, 'LIKE',     0.8000, '2026-07-02 00:00:00', '2026-07-02 00:00:00'),
    (1, 7, 'BEHAVIOR', 0.6500, '2026-07-03 00:00:00', '2026-07-03 00:00:00'),
    (2, 4, 'SURVEY',   1.0000, '2026-07-01 00:00:00', '2026-07-01 00:00:00'),
    (6, 2, 'SURVEY',   1.0000, '2026-07-01 00:00:00', '2026-07-01 00:00:00');

INSERT INTO `tattoo_collections` (
    `collection_id`, `user_id`, `body_part`, `collection_image_id`,
    `created_at`, `updated_at`
) VALUES
    (1, 1, '왼쪽 팔뚝', 53, '2026-07-01 10:00:00', '2026-07-01 10:00:00'),
    (2, 1, '오른쪽 어깨', 54, '2026-07-02 10:00:00', '2026-07-02 10:00:00'),
    (3, 1, '등', 55, '2026-07-03 10:00:00', '2026-07-03 10:00:00'),
    (4, 1, '왼쪽 발목', 56, '2026-07-04 10:00:00', '2026-07-04 10:00:00'),
    (5, 1, '쇄골', 57, '2026-07-05 10:00:00', '2026-07-05 10:00:00'),
    (6, 2, '오른쪽 팔', 58, '2026-07-06 10:00:00', '2026-07-06 10:00:00'),
    (7, 2, '종아리', 59, '2026-07-07 10:00:00', '2026-07-07 10:00:00'),
    (8, 6, '손목', 60, '2026-07-08 10:00:00', '2026-07-08 10:00:00'),
    (9, 8, '등', 61, '2026-07-09 10:00:00', '2026-07-09 10:00:00'),
    (10, 15, '발목', 62, '2026-07-10 10:00:00', '2026-07-10 10:00:00');

INSERT INTO `user_archive` (`user_id`, `tattoo_id`, `saved_at`) VALUES
    (1, 1, '2026-07-15 12:00:00'),
    (1, 2, '2026-07-16 12:00:00'),
    (1, 3, '2026-07-17 12:00:00'),
    (1, 4, '2026-07-18 12:00:00'),
    (1, 5, '2026-07-19 12:00:00'),
    (2, 6, '2026-07-20 12:00:00'),
    (6, 7, '2026-07-21 12:00:00');

-- --------------------------------------------------------------------------
-- 6. 팔로우와 차단
-- --------------------------------------------------------------------------

-- user_id=1은 활성 타투이스트를 모두 팔로우한다. 기본 size=20 커서 검증 가능.
INSERT INTO `user_follows` (`follower_id`, `following_id`, `created_at`)
SELECT
    1,
    `user_id`,
    TIMESTAMPADD(MINUTE, `user_id`, '2026-07-01 00:00:00')
FROM `users`
WHERE `role` = 'ARTIST' AND `account_status` = 'ACTIVE';

-- 다수의 타투이스트가 user_id=1을 팔로우하여 팔로워 커서도 검증한다.
INSERT INTO `user_follows` (`follower_id`, `following_id`, `created_at`)
SELECT
    `user_id`,
    1,
    TIMESTAMPADD(MINUTE, `user_id`, '2026-07-02 00:00:00')
FROM `users`
WHERE `role` = 'ARTIST' AND `account_status` = 'ACTIVE';

INSERT IGNORE INTO `user_follows` (`follower_id`, `following_id`, `created_at`) VALUES
    (6, 2, '2026-07-03 00:00:00'),
    (6, 3, '2026-07-03 00:01:00'),
    (8, 2, '2026-07-03 00:02:00'),
    (2, 3, '2026-07-03 00:03:00'),
    (3, 2, '2026-07-03 00:04:00');

INSERT INTO `user_blocks` (`blocker_id`, `blocked_id`, `created_at`) VALUES
    (1, 7, '2026-07-20 00:00:00'),
    (6, 8, '2026-07-20 00:01:00');

-- --------------------------------------------------------------------------
-- 7. 게시글 30개와 이미지
-- --------------------------------------------------------------------------

INSERT INTO `posts` (
    `post_id`, `author_id`, `post_type`, `content`, `post_status`,
    `like_count`, `comment_count`, `report_count`, `created_at`, `updated_at`
)
SELECT
    `n`,
    CASE MOD(`n`, 8)
        WHEN 0 THEN 1
        WHEN 1 THEN 2
        WHEN 2 THEN 3
        WHEN 3 THEN 5
        WHEN 4 THEN 6
        WHEN 5 THEN 7
        WHEN 6 THEN 13
        ELSE 14
    END AS author_id,
    CASE MOD(`n`, 8)
        WHEN 0 THEN 'USER_POST'
        WHEN 4 THEN 'USER_POST'
        WHEN 5 THEN 'USER_POST'
        ELSE 'ARTIST_WORK'
    END AS post_type,
    CASE
        WHEN `n` = 10 THEN NULL
        ELSE CONCAT('API 통합 테스트용 게시글 ', LPAD(`n`, 2, '0'),
                    '입니다. 스타일과 이미지 응답을 확인하세요.')
    END,
    CASE
        WHEN `n` IN (6, 27) THEN 'HIDDEN'
        WHEN `n` = 28 THEN 'DELETED'
        ELSE 'PUBLISHED'
    END,
    0, 0, 0,
    TIMESTAMPADD(MINUTE, -`n`, '2026-07-22 00:00:00'),
    TIMESTAMPADD(MINUTE, -`n`, '2026-07-22 00:00:00')
FROM `seed_numbers`
WHERE `n` <= 30;

INSERT INTO `post_images` (
    `post_image_id`, `post_id`, `image_id`, `display_order`, `created_at`
)
SELECT
    `n`, `n`, 20 + `n`, 0,
    TIMESTAMPADD(MINUTE, -`n`, '2026-07-22 00:00:00')
FROM `seed_numbers`
WHERE `n` <= 30;

INSERT INTO `post_images` (
    `post_image_id`, `post_id`, `image_id`, `display_order`, `created_at`
) VALUES
    (31, 1, 51, 1, '2026-07-21 23:59:30'),
    (32, 2, 52, 1, '2026-07-21 23:58:30');

-- 게시글 등록 서비스와 동일하게 각 게시글 이미지를 tattoos에도 연결한다.
INSERT INTO `tattoos` (
    `tattoo_id`, `user_id`, `image_id`, `source_type`,
    `primary_style`, `secondary_style`, `color`, `rendering`,
    `created_at`, `updated_at`
)
SELECT
    100 + p.`post_id`,
    p.`author_id`,
    20 + p.`post_id`,
    'USER_POST',
    CASE MOD(p.`post_id`, 5)
        WHEN 0 THEN 'BLACKWORK'
        WHEN 1 THEN 'LINEWORK'
        WHEN 2 THEN 'OLD_SCHOOL'
        WHEN 3 THEN 'MINIMAL'
        ELSE 'REALISM'
    END,
    CASE WHEN MOD(p.`post_id`, 3) = 0 THEN 'DOTWORK' ELSE NULL END,
    CASE WHEN MOD(p.`post_id`, 4) = 0 THEN 'COLOR' ELSE 'BLACK' END,
    CASE MOD(p.`post_id`, 4)
        WHEN 0 THEN 'WATER_COLOR'
        WHEN 1 THEN 'LINE_ART'
        WHEN 2 THEN 'SKETCH'
        ELSE NULL
    END,
    p.`created_at`,
    p.`updated_at`
FROM `posts` p;

INSERT INTO `tattoos` (
    `tattoo_id`, `user_id`, `image_id`, `source_type`,
    `primary_style`, `secondary_style`, `color`, `rendering`,
    `created_at`, `updated_at`
) VALUES
    (131, 2, 51, 'USER_POST', 'LINEWORK', NULL, 'BLACK', 'LINE_ART',
     '2026-07-21 23:59:30', '2026-07-21 23:59:30'),
    (132, 3, 52, 'USER_POST', 'BLACKWORK', 'DOTWORK', 'BLACK', 'SKETCH',
     '2026-07-21 23:58:30', '2026-07-21 23:58:30');

-- --------------------------------------------------------------------------
-- 8. 게시글 좋아요, 북마크, 관심 없음
-- --------------------------------------------------------------------------

INSERT INTO `post_likes` (`post_id`, `user_id`, `created_at`)
SELECT
    p.`post_id`,
    u.`user_id`,
    TIMESTAMPADD(SECOND, u.`user_id`, p.`created_at`)
FROM `posts` p
JOIN `users` u
  ON u.`user_id` IN (1, 2, 3, 6, 7, 8, 13, 14)
 AND u.`user_id` <> p.`author_id`
WHERE MOD(p.`post_id` + u.`user_id`, 3) = 0;

INSERT INTO `post_bookmarks` (`post_id`, `user_id`, `created_at`) VALUES
    (2, 1, '2026-07-20 10:00:00'),
    (3, 1, '2026-07-20 10:01:00'),
    (4, 1, '2026-07-20 10:02:00'),
    (5, 1, '2026-07-20 10:03:00'),
    (10, 1, '2026-07-20 10:04:00'),
    (20, 1, '2026-07-20 10:05:00'),
    (1, 2, '2026-07-20 10:06:00'),
    (3, 6, '2026-07-20 10:07:00');

INSERT INTO `post_hidden_preferences` (`post_id`, `user_id`, `created_at`) VALUES
    (3, 1, '2026-07-21 10:00:00'),
    (5, 1, '2026-07-21 10:01:00'),
    (2, 6, '2026-07-21 10:02:00');

-- --------------------------------------------------------------------------
-- 9. 댓글, 대댓글, 댓글 좋아요
-- --------------------------------------------------------------------------

-- post_id=1의 루트 댓글 25개: size=20 커서 테스트 가능
INSERT INTO `comments` (
    `comment_id`, `post_id`, `author_id`, `parent_comment_id`, `content`,
    `like_count`, `comment_status`, `created_at`, `updated_at`
)
SELECT
    `n`,
    1,
    CASE MOD(`n`, 6)
        WHEN 0 THEN 1
        WHEN 1 THEN 2
        WHEN 2 THEN 3
        WHEN 3 THEN 6
        WHEN 4 THEN 7
        ELSE 8
    END,
    NULL,
    CONCAT('게시글 1의 루트 댓글 ', LPAD(`n`, 2, '0')),
    0,
    CASE WHEN `n` = 24 THEN 'DELETED' ELSE 'PUBLISHED' END,
    TIMESTAMPADD(MINUTE, `n`, '2026-07-20 00:00:00'),
    TIMESTAMPADD(MINUTE, `n`, '2026-07-20 00:00:00')
FROM `seed_numbers`
WHERE `n` <= 25;

-- comment_id=1에 달린 대댓글 7개
INSERT INTO `comments` (
    `comment_id`, `post_id`, `author_id`, `parent_comment_id`, `content`,
    `like_count`, `comment_status`, `created_at`, `updated_at`
) VALUES
    (26, 1, 1, 1, '첫 번째 대댓글입니다.', 0, 'PUBLISHED',
     '2026-07-20 01:00:00', '2026-07-20 01:00:00'),
    (27, 1, 2, 1, '두 번째 대댓글입니다.', 0, 'PUBLISHED',
     '2026-07-20 01:01:00', '2026-07-20 01:01:00'),
    (28, 1, 3, 1, '세 번째 대댓글입니다.', 0, 'PUBLISHED',
     '2026-07-20 01:02:00', '2026-07-20 01:02:00'),
    (29, 1, 6, 1, '네 번째 대댓글입니다.', 0, 'PUBLISHED',
     '2026-07-20 01:03:00', '2026-07-20 01:03:00'),
    (30, 1, 7, 1, '차단 회원이 작성한 대댓글입니다.', 0, 'PUBLISHED',
     '2026-07-20 01:04:00', '2026-07-20 01:04:00'),
    (31, 1, 8, 1, '다섯 번째로 보이는 대댓글입니다.', 0, 'PUBLISHED',
     '2026-07-20 01:05:00', '2026-07-20 01:05:00'),
    (32, 1, 2, 1, '삭제된 대댓글입니다.', 0, 'DELETED',
     '2026-07-20 01:06:00', '2026-07-20 01:06:00');

-- 부모 댓글 삭제 트랜잭션으로 부모와 대댓글이 함께 소프트 삭제된 상태
INSERT INTO `comments` (
    `comment_id`, `post_id`, `author_id`, `parent_comment_id`, `content`,
    `like_count`, `comment_status`, `created_at`, `updated_at`
) VALUES
    (33, 1, 6, NULL, '삭제될 루트 댓글', 0, 'DELETED',
     '2026-07-20 02:00:00', '2026-07-20 02:00:00');

-- 자기 참조 FK가 있으므로 부모 comment_id=33 삽입 후 자식을 별도 삽입한다.
INSERT INTO `comments` (
    `comment_id`, `post_id`, `author_id`, `parent_comment_id`, `content`,
    `like_count`, `comment_status`, `created_at`, `updated_at`
) VALUES
    (34, 1, 8, 33, '삭제된 루트와 함께 삭제된 대댓글', 0, 'DELETED',
     '2026-07-20 02:01:00', '2026-07-20 02:01:00'),
    (35, 2, 1, NULL, '게시글 2의 댓글', 0, 'PUBLISHED',
     '2026-07-20 03:00:00', '2026-07-20 03:00:00'),
    (36, 2, 6, NULL, '게시글 2의 두 번째 댓글', 0, 'PUBLISHED',
     '2026-07-20 03:01:00', '2026-07-20 03:01:00'),
    (37, 3, 2, NULL, '게시글 3의 댓글', 0, 'PUBLISHED',
     '2026-07-20 03:02:00', '2026-07-20 03:02:00'),
    (38, 4, 3, NULL, '게시글 4의 댓글', 0, 'PUBLISHED',
     '2026-07-20 03:03:00', '2026-07-20 03:03:00'),
    (39, 5, 8, NULL, '게시글 5의 댓글', 0, 'PUBLISHED',
     '2026-07-20 03:04:00', '2026-07-20 03:04:00'),
    (40, 7, 1, NULL, '게시글 7의 댓글', 0, 'PUBLISHED',
     '2026-07-20 03:05:00', '2026-07-20 03:05:00');

INSERT INTO `comment_likes` (`comment_id`, `user_id`, `created_at`)
SELECT
    c.`comment_id`,
    u.`user_id`,
    TIMESTAMPADD(SECOND, u.`user_id`, c.`created_at`)
FROM `comments` c
JOIN `users` u
  ON u.`user_id` IN (1, 2, 6, 8)
 AND u.`user_id` <> c.`author_id`
WHERE c.`comment_status` = 'PUBLISHED'
  AND MOD(c.`comment_id` + u.`user_id`, 2) = 0;

-- --------------------------------------------------------------------------
-- 10. 게시글 신고
-- --------------------------------------------------------------------------

INSERT INTO `post_reports` (
    `report_id`, `post_id`, `reporter_id`, `reason_code`, `reason_detail`,
    `report_status`, `processing_note`, `created_at`, `processed_at`
) VALUES
    (1, 4, 1, 'SPAM', NULL, 'PENDING', NULL,
     '2026-07-21 00:00:00', NULL),
    (2, 4, 2, 'INAPPROPRIATE', '이미지 내용 확인이 필요합니다.', 'PENDING', NULL,
     '2026-07-21 00:01:00', NULL),
    (3, 4, 3, 'OTHER', '동일한 홍보 문구가 반복됩니다.', 'PENDING', NULL,
     '2026-07-21 00:02:00', NULL),
    (4, 5, 1, 'HARASSMENT', NULL, 'PENDING', NULL,
     '2026-07-21 00:03:00', NULL),
    (5, 5, 2, 'COPYRIGHT', '다른 작가의 이미지로 보입니다.', 'PENDING', NULL,
     '2026-07-21 00:04:00', NULL),
    (6, 6, 1, 'INAPPROPRIATE', NULL, 'ACCEPTED', '게시물을 숨김 처리했습니다.',
     '2026-07-18 00:00:00', '2026-07-19 00:00:00'),
    (7, 7, 1, 'SPAM', NULL, 'REJECTED', '신고 사유가 확인되지 않았습니다.',
     '2026-07-17 00:00:00', '2026-07-18 00:00:00'),
    (8, 8, 2, 'OTHER', '관리자 페이지 정렬 테스트', 'PENDING', NULL,
     '2026-07-21 00:05:00', NULL),
    (9, 8, 3, 'SPAM', NULL, 'PENDING', NULL,
     '2026-07-21 00:06:00', NULL);

-- 상세 테이블과 캐시 카운트를 정확히 일치시킨다.
UPDATE `posts` p
SET `like_count` = (
        SELECT COUNT(*) FROM `post_likes` pl WHERE pl.`post_id` = p.`post_id`
    ),
    `comment_count` = (
        SELECT COUNT(*)
        FROM `comments` c
        WHERE c.`post_id` = p.`post_id`
          AND c.`comment_status` <> 'DELETED'
    ),
    `report_count` = (
        SELECT COUNT(*) FROM `post_reports` pr WHERE pr.`post_id` = p.`post_id`
    )
WHERE p.`post_id` >= 1;

UPDATE `comments` c
SET `like_count` = (
    SELECT COUNT(*) FROM `comment_likes` cl WHERE cl.`comment_id` = c.`comment_id`
)
WHERE c.`comment_id` >= 1;

-- --------------------------------------------------------------------------
-- 11. DM 채팅방, 메시지, 나가기 상태
-- --------------------------------------------------------------------------

INSERT INTO `dm_rooms` (
    `dm_room_id`, `user1_id`, `user2_id`, `last_message_at`, `created_at`
) VALUES
    (1, 1, 2, '2026-07-21 10:04:00', '2026-07-20 10:00:00'),
    (2, 1, 6, '2026-07-21 11:04:00', '2026-07-20 11:00:00'),
    (3, 1, 7, '2026-07-21 12:00:00', '2026-07-20 12:00:00'),
    (4, 2, 3, '2026-07-21 13:00:00', '2026-07-20 13:00:00'),
    (5, 1, 8, '2026-07-21 14:02:00', '2026-07-20 14:00:00');

INSERT INTO `dm_messages` (
    `dm_message_id`, `dm_room_id`, `sender_id`, `message_type`,
    `text_content`, `image_key`, `read_at`, `is_deleted`, `created_at`
) VALUES
    (1, 1, 1, 'TEXT', '안녕하세요. 작업 문의드립니다.', NULL,
     '2026-07-21 10:00:30', 0, '2026-07-21 10:00:00'),
    (2, 1, 2, 'TEXT', '안녕하세요. 어떤 스타일을 원하시나요?', NULL,
     '2026-07-21 10:01:30', 0, '2026-07-21 10:01:00'),
    (3, 1, 1, 'IMAGE', NULL, 'dm/seed/room-1/reference.webp',
     '2026-07-21 10:02:30', 0, '2026-07-21 10:02:00'),
    (4, 1, 2, 'TEXT_WITH_IMAGE', '이런 방향은 어떠세요?', 'dm/seed/room-1/suggestion.webp',
     NULL, 0, '2026-07-21 10:03:00'),
    (5, 1, 2, 'TEXT', '확인 후 답변 부탁드립니다.', NULL,
     NULL, 0, '2026-07-21 10:04:00'),

    (6, 2, 1, 'TEXT', '주말에 시간 괜찮으세요?', NULL,
     '2026-07-21 11:00:30', 0, '2026-07-21 11:00:00'),
    (7, 2, 6, 'TEXT', '토요일 오후 가능합니다.', NULL,
     '2026-07-21 11:01:30', 0, '2026-07-21 11:01:00'),
    (8, 2, 1, 'TEXT', '좋아요.', NULL,
     '2026-07-21 11:02:30', 0, '2026-07-21 11:02:00'),
    (9, 2, 6, 'TEXT', '삭제된 메시지 테스트', NULL,
     NULL, 1, '2026-07-21 11:03:00'),
    (10, 2, 6, 'TEXT', '채팅방 나가기 이전 마지막 메시지입니다.', NULL,
     NULL, 0, '2026-07-21 11:04:00'),

    (11, 3, 7, 'TEXT', '차단 관계에서는 목록에 보이지 않아야 합니다.', NULL,
     NULL, 0, '2026-07-21 12:00:00'),
    (12, 4, 2, 'TEXT', '타투이스트끼리의 DM입니다.', NULL,
     NULL, 0, '2026-07-21 13:00:00'),

    (13, 5, 1, 'TEXT', '나가기 전 첫 번째 메시지', NULL,
     '2026-07-21 14:00:30', 0, '2026-07-21 14:00:00'),
    (14, 5, 8, 'TEXT', '나가기 전 마지막 메시지', NULL,
     NULL, 0, '2026-07-21 14:01:00'),
    (15, 5, 8, 'TEXT', '나간 뒤 도착해 채팅방을 다시 활성화하는 메시지', NULL,
     NULL, 0, '2026-07-21 14:02:00');

INSERT INTO `dm_room_participants` (
    `dm_room_id`, `user_id`, `is_active`, `last_hidden_message_id`, `last_left_at`
) VALUES
    (1, 1, 1, NULL, NULL),
    (1, 2, 1, NULL, NULL),
    (2, 1, 0, 10, '2026-07-21 11:05:00'),
    (2, 6, 1, NULL, NULL),
    (3, 1, 1, NULL, NULL),
    (3, 7, 1, NULL, NULL),
    (4, 2, 1, NULL, NULL),
    (4, 3, 1, NULL, NULL),
    (5, 1, 1, 14, '2026-07-21 14:01:30'),
    (5, 8, 1, NULL, NULL);

-- 행이 존재하면 해당 회원에게 그 방의 알림 행과 푸시를 만들지 않는다.
-- 방을 나갔다가 다시 활성화해도 이 설정은 유지된다.
INSERT INTO `dm_room_notification_mutes` (
    `user_id`, `dm_room_id`, `created_at`
) VALUES
    (1, 5, '2026-07-21 14:01:30'),
    (6, 2, '2026-07-21 11:05:00');

-- --------------------------------------------------------------------------
-- 12. 알림
--     user_id=1에 미읽음 알림을 20개 이상 넣어 커서를 검증한다.
--     room 3의 actor_id=7 알림은 차단 필터 테스트 대상이다.
-- --------------------------------------------------------------------------

INSERT INTO `notifications` (
    `notification_id`, `receiver_id`, `actor_id`, `notification_type`,
    `reference_type`, `reference_id`, `title`, `body`,
    `is_read`, `read_at`, `created_at`
)
SELECT
    `n`,
    1,
    CASE
        WHEN MOD(`n`, 7) = 0 THEN NULL
        WHEN MOD(`n`, 3) = 0 THEN 7
        WHEN MOD(`n`, 2) = 0 THEN 6
        ELSE 2
    END,
    CASE WHEN MOD(`n`, 7) = 0 THEN 'SYSTEM' ELSE 'NEW_DM' END,
    CASE WHEN MOD(`n`, 7) = 0 THEN NULL ELSE 'DM_ROOM' END,
    CASE
        WHEN MOD(`n`, 7) = 0 THEN NULL
        WHEN MOD(`n`, 3) = 0 THEN 3
        WHEN MOD(`n`, 2) = 0 THEN 2
        ELSE 1
    END,
    CASE WHEN MOD(`n`, 7) = 0
        THEN CONCAT('시스템 알림 ', `n`)
        ELSE '새 메시지가 도착했습니다.'
    END,
    CONCAT('통합 테스트용 알림 본문 ', LPAD(`n`, 2, '0')),
    CASE WHEN `n` >= 30 THEN 1 ELSE 0 END,
    CASE WHEN `n` >= 30 THEN TIMESTAMPADD(MINUTE, `n`, '2026-07-21 00:00:00') ELSE NULL END,
    TIMESTAMPADD(MINUTE, `n`, '2026-07-20 00:00:00')
FROM `seed_numbers`
WHERE `n` <= 32;

INSERT INTO `notifications` (
    `notification_id`, `receiver_id`, `actor_id`, `notification_type`,
    `reference_type`, `reference_id`, `title`, `body`,
    `is_read`, `read_at`, `created_at`
) VALUES
    (33, 2, 1, 'NEW_DM', 'DM_ROOM', 1, '새 메시지가 도착했습니다.',
     '작업 문의드립니다.', 0, NULL, '2026-07-21 10:00:00'),
    (34, 2, NULL, 'SYSTEM', 'ARTIST', 2, '승인 상태 안내',
     '타투이스트 인증이 완료되었습니다.', 1, '2026-07-19 00:00:00',
     '2026-07-18 00:00:00'),
    (35, 6, 1, 'NEW_DM', 'DM_ROOM', 2, '새 메시지가 도착했습니다.',
     '알림 끄기 전에 생성되어 설정과 함께 읽음 처리된 알림입니다.',
     1, '2026-07-21 11:05:00', '2026-07-21 11:00:00');

-- --------------------------------------------------------------------------
-- 13. 최근 검색어
-- --------------------------------------------------------------------------

INSERT INTO `user_recent_searches` (
    `recent_search_id`, `user_id`, `keyword`, `searched_at`
) VALUES
    (1, 1, '블랙워크', '2026-07-22 00:10:00'),
    (2, 1, '서울 타투', '2026-07-22 00:09:00'),
    (3, 1, '라인워크', '2026-07-22 00:08:00'),
    (4, 1, '미니 타투', '2026-07-22 00:07:00'),
    (5, 1, '부산', '2026-07-22 00:06:00'),
    (6, 1, '파인라인', '2026-07-22 00:05:00'),
    (7, 1, '올드스쿨', '2026-07-22 00:04:00'),
    (8, 1, '커버업', '2026-07-22 00:03:00'),
    (9, 1, '팔뚝 도안', '2026-07-22 00:02:00'),
    (10, 1, '꽃 타투', '2026-07-22 00:01:00'),
    (11, 2, '블랙워크', '2026-07-21 00:03:00'),
    (12, 2, '서울', '2026-07-21 00:02:00'),
    (13, 2, '도트워크', '2026-07-21 00:01:00');

DROP TEMPORARY TABLE `seed_numbers`;

COMMIT;

-- --------------------------------------------------------------------------
-- 14. 삽입 결과 확인
-- --------------------------------------------------------------------------

SELECT 'users' AS table_name, COUNT(*) AS row_count FROM `users`
UNION ALL SELECT 'tattoo_artists', COUNT(*) FROM `tattoo_artists`
UNION ALL SELECT 'images', COUNT(*) FROM `images`
UNION ALL SELECT 'tattoos', COUNT(*) FROM `tattoos`
UNION ALL SELECT 'tattoo_designs', COUNT(*) FROM `tattoo_designs`
UNION ALL SELECT 'posts', COUNT(*) FROM `posts`
UNION ALL SELECT 'comments', COUNT(*) FROM `comments`
UNION ALL SELECT 'post_reports', COUNT(*) FROM `post_reports`
UNION ALL SELECT 'dm_rooms', COUNT(*) FROM `dm_rooms`
UNION ALL SELECT 'dm_messages', COUNT(*) FROM `dm_messages`
UNION ALL SELECT 'notifications', COUNT(*) FROM `notifications`;

SELECT
    `user_id`, `nickname`, `role`, `account_status`
FROM `users`
WHERE `user_id` IN (1, 2, 7, 9, 10, 11)
ORDER BY `user_id`;

SELECT
    `post_id`, `author_id`, `post_status`,
    `like_count`, `comment_count`, `report_count`
FROM `posts`
WHERE `post_id` IN (1, 4, 5, 6, 7, 8, 27, 28)
ORDER BY `post_id`;
