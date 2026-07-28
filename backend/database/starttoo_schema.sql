-- Starttoo 로컬 MySQL 전체 스키마
-- 현재까지 확정된 모든 스키마 변경 결과를 합친 독립 실행용 SQL이다.
-- 더미 데이터는 포함하지 않는다.
-- MySQL 8.0 이상에서 실행한다.

CREATE DATABASE IF NOT EXISTS `tattoo_platform`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `tattoo_platform`;
SET NAMES utf8mb4;

-- 반복 실행 시 현재 스키마를 완전히 다시 만든다.
-- 운영 데이터가 있는 DB에서는 백업 없이 실행하지 않는다.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `user_recent_searches`;
DROP TABLE IF EXISTS `dm_room_notification_mutes`;
DROP TABLE IF EXISTS `dm_room_participants`;
DROP TABLE IF EXISTS `dm_messages`;
DROP TABLE IF EXISTS `dm_rooms`;
DROP TABLE IF EXISTS `post_reports`;
DROP TABLE IF EXISTS `post_hidden_preferences`;
DROP TABLE IF EXISTS `post_bookmarks`;
DROP TABLE IF EXISTS `post_likes`;
DROP TABLE IF EXISTS `comment_likes`;
DROP TABLE IF EXISTS `comments`;
DROP TABLE IF EXISTS `post_images`;
DROP TABLE IF EXISTS `posts`;
DROP TABLE IF EXISTS `user_blocks`;
DROP TABLE IF EXISTS `user_follows`;
DROP TABLE IF EXISTS `user_archive`;
DROP TABLE IF EXISTS `tattoo_collections`;
DROP TABLE IF EXISTS `user_tattoo_preferences`;
DROP TABLE IF EXISTS `tattoo_designs`;
DROP TABLE IF EXISTS `tattoos`;
DROP TABLE IF EXISTS `tattoo_artists`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `notification_settings`;
DROP TABLE IF EXISTS `refresh_tokens`;
DROP TABLE IF EXISTS `user_devices`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `images`;
SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================
-- 1. 공통 이미지
-- =========================================================

CREATE TABLE `images` (
    `image_id` BIGINT NOT NULL AUTO_INCREMENT,
    `object_key` VARCHAR(1000) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `is_used_for_training` TINYINT(1) NOT NULL DEFAULT 0,
    `trained_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`image_id`),
    CONSTRAINT `uq_images_object_key` UNIQUE (`object_key`),
    KEY `idx_images_training_created_id`
        (`is_used_for_training`, `created_at` DESC, `image_id` DESC),
    CONSTRAINT `ck_images_training_state` CHECK (
        (`is_used_for_training` = 0 AND `trained_at` IS NULL)
        OR (`is_used_for_training` = 1 AND `trained_at` IS NOT NULL)
    )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 2. 회원·인증·알림
-- =========================================================

CREATE TABLE `users` (
    `user_id` BIGINT NOT NULL AUTO_INCREMENT,
    `oauth_provider` VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `oauth_subject` VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
    `email` VARCHAR(255) NULL,
    `nickname` VARCHAR(50) COLLATE utf8mb4_0900_as_cs NOT NULL,
    `profile_image_key` VARCHAR(1000) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `birth_date` DATE NULL,
    `gender` VARCHAR(20) NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'USER',
    `account_status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `withdrawal_reason` VARCHAR(255) NULL,
    `withdrawn_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    CONSTRAINT `uq_users_oauth` UNIQUE (`oauth_provider`, `oauth_subject`),
    CONSTRAINT `uq_users_nickname` UNIQUE (`nickname`),
    KEY `idx_users_role_status_id` (`role`, `account_status`, `user_id`),
    CONSTRAINT `ck_users_oauth_provider` CHECK (
        `oauth_provider` IN ('GOOGLE', 'KAKAO')
    ),
    CONSTRAINT `ck_users_nickname` CHECK (
        `nickname` = TRIM(`nickname`)
        AND CHAR_LENGTH(`nickname`) BETWEEN 2 AND 50
    ),
    CONSTRAINT `ck_users_gender` CHECK (
        `gender` IS NULL
        OR `gender` IN ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED')
    ),
    CONSTRAINT `ck_users_role` CHECK (
        `role` IN ('USER', 'ARTIST', 'ADMIN')
    ),
    CONSTRAINT `ck_users_account_status` CHECK (
        `account_status` IN ('ACTIVE', 'SUSPENDED', 'WITHDRAWN')
    ),
    CONSTRAINT `ck_users_withdrawal_state` CHECK (
        (`account_status` = 'WITHDRAWN' AND `withdrawn_at` IS NOT NULL)
        OR (`account_status` <> 'WITHDRAWN' AND `withdrawn_at` IS NULL)
    )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_devices` (
    `device_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `push_token` VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `platform` VARCHAR(20) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `last_used_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`device_id`),
    CONSTRAINT `uq_user_devices_push_token` UNIQUE (`push_token`),
    KEY `idx_user_devices_user_active` (`user_id`, `is_active`),
    CONSTRAINT `ck_user_devices_platform` CHECK (
        `platform` IN ('WEB', 'ANDROID', 'IOS')
    ),
    CONSTRAINT `ck_user_devices_is_active` CHECK (`is_active` IN (0, 1)),
    CONSTRAINT `fk_user_devices_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `refresh_tokens` (
    `refresh_token_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `device_id` BIGINT NULL,
    `token_hash` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `revoked_at` DATETIME NULL,
    `last_used_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`refresh_token_id`),
    CONSTRAINT `uq_refresh_tokens_token_hash` UNIQUE (`token_hash`),
    KEY `idx_refresh_tokens_user_state` (`user_id`, `revoked_at`, `expires_at`),
    KEY `idx_refresh_tokens_device` (`device_id`),
    CONSTRAINT `ck_refresh_tokens_expiration` CHECK (`expires_at` > `created_at`),
    CONSTRAINT `fk_refresh_tokens_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_refresh_tokens_device`
        FOREIGN KEY (`device_id`) REFERENCES `user_devices` (`device_id`)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `notifications` (
    `notification_id` BIGINT NOT NULL AUTO_INCREMENT,
    `receiver_id` BIGINT NOT NULL,
    `actor_id` BIGINT NULL,
    `notification_type` VARCHAR(30) NOT NULL,
    `reference_type` VARCHAR(20) NULL,
    `reference_id` BIGINT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` VARCHAR(500) NOT NULL,
    `is_read` TINYINT(1) NOT NULL DEFAULT 0,
    `read_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`notification_id`),
    KEY `idx_notifications_receiver_read_created_id`
        (`receiver_id`, `is_read`, `created_at` DESC, `notification_id` DESC),
    KEY `idx_notifications_receiver_type_created_id`
        (
            `receiver_id`,
            `notification_type`,
            `created_at` DESC,
            `notification_id` DESC
        ),
    KEY `idx_notifications_actor` (`actor_id`),
    KEY `idx_notifications_unread_dm_room`
        (
            `receiver_id`,
            `is_read`,
            `notification_type`,
            `reference_type`,
            `reference_id`,
            `created_at` DESC,
            `notification_id` DESC
        ),
    CONSTRAINT `ck_notifications_type` CHECK (
        `notification_type` IN ('NEW_DM', 'SYSTEM')
    ),
    CONSTRAINT `ck_notifications_read_state` CHECK (
        (`is_read` = 0 AND `read_at` IS NULL)
        OR (`is_read` = 1 AND `read_at` IS NOT NULL)
    ),
    CONSTRAINT `ck_notifications_reference` CHECK (
        (
            `notification_type` = 'NEW_DM'
            AND `reference_type` = 'DM_ROOM'
            AND `reference_id` IS NOT NULL
        )
        OR (
            `notification_type` = 'SYSTEM'
            AND (
                (`reference_type` IS NULL AND `reference_id` IS NULL)
                OR (
                    `reference_type` IN ('REPORT', 'ARTIST')
                    AND `reference_id` IS NOT NULL
                )
            )
        )
    ),
    CONSTRAINT `fk_notifications_receiver`
        FOREIGN KEY (`receiver_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_notifications_actor`
        FOREIGN KEY (`actor_id`) REFERENCES `users` (`user_id`)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 3. 타투이스트·타투·개인화
-- =========================================================

CREATE TABLE `tattoo_artists` (
    `user_id` BIGINT NOT NULL,
    `shop_name` VARCHAR(100) NULL,
    `shop_city` VARCHAR(30) NULL,
    `shop_address` VARCHAR(500) NULL,
    `shop_phone` VARCHAR(30) NULL,
    `business_hours` VARCHAR(500) NULL,
    `popularity` DECIMAL(8,4) NOT NULL DEFAULT 1.0000,
    `approval_status` VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED',
    `rejection_reason` VARCHAR(2000) NULL,
    `approved_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    KEY `idx_tattoo_artists_approval_user` (`approval_status`, `user_id`),
    KEY `idx_tattoo_artists_popularity_user`
        (`popularity` DESC, `user_id` DESC),
    KEY `idx_tattoo_artists_city_popularity_user`
        (`shop_city`, `popularity` DESC, `user_id` DESC),
    CONSTRAINT `ck_tattoo_artists_shop_city` CHECK (
        `shop_city` IS NULL
        OR CHAR_LENGTH(TRIM(`shop_city`)) BETWEEN 1 AND 30
    ),
    CONSTRAINT `ck_tattoo_artists_popularity` CHECK (`popularity` >= 0),
    CONSTRAINT `ck_tattoo_artists_approval_status` CHECK (
        `approval_status` IN (
            'UNVERIFIED', 'PENDING', 'ASPIRING', 'VERIFIED', 'REJECTED'
        )
    ),
    CONSTRAINT `ck_tattoo_artists_rejection` CHECK (
        (
            `approval_status` = 'REJECTED'
            AND `rejection_reason` IS NOT NULL
            AND CHAR_LENGTH(TRIM(`rejection_reason`)) > 0
        )
        OR (`approval_status` <> 'REJECTED' AND `rejection_reason` IS NULL)
    ),
    CONSTRAINT `ck_tattoo_artists_approval_time` CHECK (
        (`approval_status` = 'VERIFIED' AND `approved_at` IS NOT NULL)
        OR (`approval_status` <> 'VERIFIED' AND `approved_at` IS NULL)
    ),
    CONSTRAINT `fk_tattoo_artists_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tattoos` (
    `tattoo_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NULL,
    `image_id` BIGINT NOT NULL,
    `source_type` VARCHAR(30) NOT NULL,
    `primary_style` VARCHAR(100) NULL,
    `secondary_style` VARCHAR(100) NULL,
    `color` VARCHAR(100) NULL,
    `rendering` VARCHAR(20) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`tattoo_id`),
    CONSTRAINT `uq_tattoos_image` UNIQUE (`image_id`),
    KEY `idx_tattoos_user_created_id`
        (`user_id`, `created_at` DESC, `tattoo_id` DESC),
    KEY `idx_tattoos_source_created_id`
        (`source_type`, `created_at` DESC, `tattoo_id` DESC),
    KEY `idx_tattoos_classification`
        (`primary_style`, `color`, `secondary_style`, `rendering`),
    CONSTRAINT `ck_tattoos_source_type` CHECK (
        `source_type` IN ('USER_PROFILE', 'AI_GENERATED', 'USER_POST', 'DEFAULT')
    ),
    CONSTRAINT `ck_tattoos_source_user` CHECK (
        (`source_type` = 'DEFAULT' AND `user_id` IS NULL)
        OR (`source_type` <> 'DEFAULT' AND `user_id` IS NOT NULL)
    ),
    CONSTRAINT `fk_tattoos_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
    CONSTRAINT `fk_tattoos_image`
        FOREIGN KEY (`image_id`) REFERENCES `images` (`image_id`)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tattoo_designs` (
    `tattoo_id` BIGINT NOT NULL,
    `image_id` BIGINT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`tattoo_id`),
    CONSTRAINT `uq_tattoo_designs_image` UNIQUE (`image_id`),
    CONSTRAINT `fk_tattoo_designs_tattoo`
        FOREIGN KEY (`tattoo_id`) REFERENCES `tattoos` (`tattoo_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_tattoo_designs_image`
        FOREIGN KEY (`image_id`) REFERENCES `images` (`image_id`)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_tattoo_preferences` (
    `user_id` BIGINT NOT NULL,
    `tattoo_id` BIGINT NOT NULL,
    `preference_source` VARCHAR(20) NOT NULL DEFAULT 'SURVEY',
    `score` DECIMAL(8,4) NOT NULL DEFAULT 1.0000,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `tattoo_id`, `preference_source`),
    KEY `idx_user_tattoo_preferences_tattoo_user` (`tattoo_id`, `user_id`),
    CONSTRAINT `ck_user_tattoo_preferences_source` CHECK (
        `preference_source` IN ('SURVEY', 'LIKE', 'BEHAVIOR')
    ),
    CONSTRAINT `ck_user_tattoo_preferences_score` CHECK (`score` >= 0),
    CONSTRAINT `fk_user_tattoo_preferences_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_user_tattoo_preferences_tattoo`
        FOREIGN KEY (`tattoo_id`) REFERENCES `tattoos` (`tattoo_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tattoo_collections` (
    `collection_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `body_part` VARCHAR(50) NOT NULL,
    `collection_image_id` BIGINT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`collection_id`),
    KEY `idx_tattoo_collections_user_created_id`
        (`user_id`, `created_at` DESC, `collection_id` DESC),
    KEY `idx_tattoo_collections_image` (`collection_image_id`),
    CONSTRAINT `ck_tattoo_collections_body_part` CHECK (
        CHAR_LENGTH(TRIM(`body_part`)) > 0
    ),
    CONSTRAINT `fk_tattoo_collections_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_tattoo_collections_image`
        FOREIGN KEY (`collection_image_id`) REFERENCES `images` (`image_id`)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_archive` (
    `user_id` BIGINT NOT NULL,
    `tattoo_id` BIGINT NOT NULL,
    `saved_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `tattoo_id`),
    KEY `idx_user_archive_user_saved_tattoo`
        (`user_id`, `saved_at` DESC, `tattoo_id` DESC),
    KEY `idx_user_archive_tattoo_user` (`tattoo_id`, `user_id`),
    CONSTRAINT `fk_user_archive_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_user_archive_tattoo_design`
        FOREIGN KEY (`tattoo_id`) REFERENCES `tattoo_designs` (`tattoo_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 4. 소셜 관계·차단
-- =========================================================

CREATE TABLE `user_follows` (
    `follower_id` BIGINT NOT NULL,
    `following_id` BIGINT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`follower_id`, `following_id`),
    KEY `idx_user_follows_follower_created`
        (`follower_id`, `created_at` DESC, `following_id` DESC),
    KEY `idx_user_follows_following_created`
        (`following_id`, `created_at` DESC, `follower_id` DESC),
    CONSTRAINT `ck_user_follows_not_self` CHECK (`follower_id` <> `following_id`),
    CONSTRAINT `fk_user_follows_follower`
        FOREIGN KEY (`follower_id`) REFERENCES `users` (`user_id`),
    CONSTRAINT `fk_user_follows_following`
        FOREIGN KEY (`following_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_blocks` (
    `blocker_id` BIGINT NOT NULL,
    `blocked_id` BIGINT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`blocker_id`, `blocked_id`),
    KEY `idx_user_blocks_blocker_created`
        (`blocker_id`, `created_at` DESC, `blocked_id` DESC),
    KEY `idx_user_blocks_blocked_blocker` (`blocked_id`, `blocker_id`),
    CONSTRAINT `ck_user_blocks_not_self` CHECK (`blocker_id` <> `blocked_id`),
    CONSTRAINT `fk_user_blocks_blocker`
        FOREIGN KEY (`blocker_id`) REFERENCES `users` (`user_id`),
    CONSTRAINT `fk_user_blocks_blocked`
        FOREIGN KEY (`blocked_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 5. 커뮤니티 피드
-- =========================================================

CREATE TABLE `posts` (
    `post_id` BIGINT NOT NULL AUTO_INCREMENT,
    `author_id` BIGINT NOT NULL,
    `post_type` VARCHAR(20) NOT NULL,
    `content` TEXT NULL,
    `post_status` VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    `like_count` BIGINT NOT NULL DEFAULT 0,
    `comment_count` BIGINT NOT NULL DEFAULT 0,
    `report_count` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`post_id`),
    KEY `idx_posts_status_created_id`
        (`post_status`, `created_at` DESC, `post_id` DESC),
    KEY `idx_posts_status_like_id`
        (`post_status`, `like_count` DESC, `post_id` DESC),
    KEY `idx_posts_type_status_created_id`
        (`post_type`, `post_status`, `created_at` DESC, `post_id` DESC),
    KEY `idx_posts_author_status_created_id`
        (`author_id`, `post_status`, `created_at` DESC, `post_id` DESC),
    KEY `idx_posts_report_count_id` (`report_count` DESC, `post_id` DESC),
    CONSTRAINT `ck_posts_type` CHECK (`post_type` IN ('USER_POST', 'ARTIST_WORK')),
    CONSTRAINT `ck_posts_status` CHECK (
        `post_status` IN ('PUBLISHED', 'HIDDEN', 'DELETED')
    ),
    CONSTRAINT `ck_posts_content` CHECK (
        `content` IS NULL OR CHAR_LENGTH(TRIM(`content`)) > 0
    ),
    CONSTRAINT `ck_posts_counts` CHECK (
        `like_count` >= 0 AND `comment_count` >= 0 AND `report_count` >= 0
    ),
    CONSTRAINT `fk_posts_author`
        FOREIGN KEY (`author_id`) REFERENCES `users` (`user_id`)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `post_images` (
    `post_image_id` BIGINT NOT NULL AUTO_INCREMENT,
    `post_id` BIGINT NOT NULL,
    `image_id` BIGINT NOT NULL,
    `display_order` INT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`post_image_id`),
    CONSTRAINT `uq_post_images_order` UNIQUE (`post_id`, `display_order`),
    KEY `idx_post_images_image` (`image_id`),
    CONSTRAINT `ck_post_images_display_order` CHECK (
        `display_order` BETWEEN 0 AND 9
    ),
    CONSTRAINT `fk_post_images_post`
        FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_post_images_image`
        FOREIGN KEY (`image_id`) REFERENCES `images` (`image_id`)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `comments` (
    `comment_id` BIGINT NOT NULL AUTO_INCREMENT,
    `post_id` BIGINT NOT NULL,
    `author_id` BIGINT NOT NULL,
    `parent_comment_id` BIGINT NULL,
    `content` VARCHAR(1000) NOT NULL,
    `like_count` BIGINT NOT NULL DEFAULT 0,
    `comment_status` VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`comment_id`),
    CONSTRAINT `uq_comments_post_comment` UNIQUE (`post_id`, `comment_id`),
    KEY `idx_comments_post_parent_status_created_id`
        (
            `post_id`,
            `parent_comment_id`,
            `comment_status`,
            `created_at` DESC,
            `comment_id` DESC
        ),
    KEY `idx_comments_post_parent_status_like_id`
        (
            `post_id`,
            `parent_comment_id`,
            `comment_status`,
            `like_count` DESC,
            `comment_id` DESC
        ),
    KEY `idx_comments_author_created_id`
        (`author_id`, `created_at` DESC, `comment_id` DESC),
    CONSTRAINT `ck_comments_content` CHECK (CHAR_LENGTH(TRIM(`content`)) > 0),
    CONSTRAINT `ck_comments_like_count` CHECK (`like_count` >= 0),
    CONSTRAINT `ck_comments_status` CHECK (
        `comment_status` IN ('PUBLISHED', 'HIDDEN', 'DELETED')
    ),
    CONSTRAINT `fk_comments_post`
        FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_comments_author`
        FOREIGN KEY (`author_id`) REFERENCES `users` (`user_id`)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_comments_parent_same_post`
        FOREIGN KEY (`post_id`, `parent_comment_id`)
        REFERENCES `comments` (`post_id`, `comment_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `comment_likes` (
    `comment_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`comment_id`, `user_id`),
    KEY `idx_comment_likes_user_comment` (`user_id`, `comment_id`),
    CONSTRAINT `fk_comment_likes_comment`
        FOREIGN KEY (`comment_id`) REFERENCES `comments` (`comment_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_comment_likes_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `post_likes` (
    `post_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`post_id`, `user_id`),
    KEY `idx_post_likes_user_post` (`user_id`, `post_id`),
    CONSTRAINT `fk_post_likes_post`
        FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_post_likes_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `post_bookmarks` (
    `post_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`post_id`, `user_id`),
    KEY `idx_post_bookmarks_user_created_post`
        (`user_id`, `created_at` DESC, `post_id` DESC),
    CONSTRAINT `fk_post_bookmarks_post`
        FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_post_bookmarks_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `post_hidden_preferences` (
    `post_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`post_id`, `user_id`),
    KEY `idx_post_hidden_preferences_user_created_post`
        (`user_id`, `created_at` DESC, `post_id` DESC),
    CONSTRAINT `fk_post_hidden_preferences_post`
        FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_post_hidden_preferences_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `post_reports` (
    `report_id` BIGINT NOT NULL AUTO_INCREMENT,
    `post_id` BIGINT NOT NULL,
    `reporter_id` BIGINT NOT NULL,
    `reason_code` VARCHAR(50) NOT NULL,
    `reason_detail` VARCHAR(1000) NULL,
    `report_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `processing_note` VARCHAR(1000) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `processed_at` DATETIME NULL,
    PRIMARY KEY (`report_id`),
    CONSTRAINT `uq_post_reports_post_reporter` UNIQUE (`post_id`, `reporter_id`),
    KEY `idx_post_reports_status_created_post`
        (`report_status`, `created_at` DESC, `post_id` DESC),
    KEY `idx_post_reports_post_status_report`
        (`post_id`, `report_status`, `report_id`),
    KEY `idx_post_reports_reporter` (`reporter_id`),
    CONSTRAINT `ck_post_reports_reason_code` CHECK (
        CHAR_LENGTH(TRIM(`reason_code`)) > 0
    ),
    CONSTRAINT `ck_post_reports_status` CHECK (
        `report_status` IN ('PENDING', 'ACCEPTED', 'REJECTED')
    ),
    CONSTRAINT `ck_post_reports_processed` CHECK (
        (`report_status` = 'PENDING' AND `processed_at` IS NULL)
        OR (`report_status` <> 'PENDING' AND `processed_at` IS NOT NULL)
    ),
    CONSTRAINT `fk_post_reports_post`
        FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_post_reports_reporter`
        FOREIGN KEY (`reporter_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 6. 1대1 DM
-- =========================================================

CREATE TABLE `dm_rooms` (
    `dm_room_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user1_id` BIGINT NOT NULL,
    `user2_id` BIGINT NOT NULL,
    `last_message_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`dm_room_id`),
    CONSTRAINT `uq_dm_rooms_users` UNIQUE (`user1_id`, `user2_id`),
    KEY `idx_dm_rooms_last_message_id`
        (`last_message_at` DESC, `dm_room_id` DESC),
    CONSTRAINT `ck_dm_rooms_user_order` CHECK (`user1_id` < `user2_id`),
    CONSTRAINT `fk_dm_rooms_user1`
        FOREIGN KEY (`user1_id`) REFERENCES `users` (`user_id`),
    CONSTRAINT `fk_dm_rooms_user2`
        FOREIGN KEY (`user2_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `dm_messages` (
    `dm_message_id` BIGINT NOT NULL AUTO_INCREMENT,
    `dm_room_id` BIGINT NOT NULL,
    `sender_id` BIGINT NOT NULL,
    `message_type` VARCHAR(20) NOT NULL,
    `text_content` TEXT NULL,
    `image_key` VARCHAR(1000) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `read_at` DATETIME NULL,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`dm_message_id`),
    CONSTRAINT `uq_dm_messages_room_message` UNIQUE (`dm_room_id`, `dm_message_id`),
    KEY `idx_dm_messages_sender` (`sender_id`),
    KEY `idx_dm_messages_room_read` (`dm_room_id`, `read_at`, `dm_message_id`),
    CONSTRAINT `ck_dm_messages_type` CHECK (
        `message_type` IN ('TEXT', 'IMAGE', 'TEXT_WITH_IMAGE')
    ),
    CONSTRAINT `ck_dm_messages_content` CHECK (
        (
            `message_type` = 'TEXT'
            AND `text_content` IS NOT NULL
            AND CHAR_LENGTH(TRIM(`text_content`)) > 0
            AND `image_key` IS NULL
        )
        OR (
            `message_type` = 'IMAGE'
            AND `text_content` IS NULL
            AND `image_key` IS NOT NULL
        )
        OR (
            `message_type` = 'TEXT_WITH_IMAGE'
            AND `text_content` IS NOT NULL
            AND CHAR_LENGTH(TRIM(`text_content`)) > 0
            AND `image_key` IS NOT NULL
        )
    ),
    CONSTRAINT `ck_dm_messages_is_deleted` CHECK (`is_deleted` IN (0, 1)),
    CONSTRAINT `fk_dm_messages_room`
        FOREIGN KEY (`dm_room_id`) REFERENCES `dm_rooms` (`dm_room_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_dm_messages_sender`
        FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `dm_room_participants` (
    `dm_room_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `last_hidden_message_id` BIGINT NULL,
    `last_left_at` DATETIME NULL,
    PRIMARY KEY (`dm_room_id`, `user_id`),
    KEY `idx_dm_room_participants_user_active`
        (`user_id`, `is_active`, `dm_room_id`),
    KEY `idx_dm_room_participants_hidden_message` (`last_hidden_message_id`),
    CONSTRAINT `ck_dm_room_participants_is_active` CHECK (`is_active` IN (0, 1)),
    CONSTRAINT `ck_dm_room_participants_left_state` CHECK (
        (`is_active` = 1)
        OR (`is_active` = 0 AND `last_left_at` IS NOT NULL)
    ),
    CONSTRAINT `fk_dm_room_participants_room`
        FOREIGN KEY (`dm_room_id`) REFERENCES `dm_rooms` (`dm_room_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_dm_room_participants_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT `fk_dm_room_participants_hidden_message`
        FOREIGN KEY (`last_hidden_message_id`) REFERENCES `dm_messages` (`dm_message_id`)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `dm_room_notification_mutes` (
    `user_id` BIGINT NOT NULL,
    `dm_room_id` BIGINT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `dm_room_id`),
    KEY `idx_dm_room_notification_mutes_room_user` (`dm_room_id`, `user_id`),
    CONSTRAINT `fk_dm_room_notification_mutes_participant`
        FOREIGN KEY (`dm_room_id`, `user_id`)
        REFERENCES `dm_room_participants` (`dm_room_id`, `user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 7. 검색
-- =========================================================

CREATE TABLE `user_recent_searches` (
    `recent_search_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `keyword` VARCHAR(100) NOT NULL,
    `searched_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`recent_search_id`),
    CONSTRAINT `uq_user_recent_searches_user_keyword` UNIQUE (`user_id`, `keyword`),
    KEY `idx_user_recent_searches_user_searched_id`
        (`user_id`, `searched_at` DESC, `recent_search_id` DESC),
    CONSTRAINT `ck_user_recent_searches_keyword` CHECK (
        CHAR_LENGTH(TRIM(`keyword`)) > 0
    ),
    CONSTRAINT `fk_user_recent_searches_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- DB 제약만으로 완전히 보장하기 어려워 서비스에서 처리할 규칙
-- =========================================================
-- 1. tattoo_artists.user_id 회원의 role은 ARTIST여야 한다.
-- 2. tattoos.image_id와 tattoo_designs.image_id는 서로 달라야 한다.
-- 3. 게시물 생성 시 post_images가 최소 한 행 존재해야 한다.
-- 4. 답글의 부모는 일반 댓글이어야 하며 답글에 다시 답글을 달 수 없다.
-- 5. 좋아요 상세 행과 캐시 카운트 변경은 하나의 트랜잭션으로 처리한다.
-- 6. 차단 시 양방향 팔로우 관계를 삭제하고 이후 팔로우·DM을 제한한다.
-- 7. dm_room_participants.user_id는 해당 방의 user1_id 또는 user2_id여야 한다.
-- 8. dm_messages.sender_id는 해당 채팅방 참여자여야 한다.
-- 9. last_hidden_message_id는 동일한 DM 채팅방 메시지여야 하며,
--    값이 있으면 last_left_at도 반드시 존재해야 한다.
--    last_hidden_message_id는 ON DELETE SET NULL FK 대상이므로 MySQL 제약상
--    해당 칼럼을 CHECK에서 참조하지 않고 서비스 계층에서 검증한다.
-- 10. 최근 검색 기록은 회원당 최대 10개만 유지한다.
-- 11. tattoo_artists.popularity는 공개 수정 API가 아닌 백엔드 내부 로직으로 계산한다.
-- 12. 닉네임 부분 일치도 계산과 relevance 커서는 백엔드 검색 로직에서 처리한다.
-- 13. 차단·관심 없음·게시물 공개 상태 필터는 모든 조회 쿼리에서 일관되게 적용한다.
-- 14. 승인 상태 변경 시 approval_status, rejection_reason, approved_at을 한 트랜잭션으로 갱신한다.
-- 15. AI 생성·커버업·AR 연결 세션·이미지 합성 이력은 이 스키마에 영구 저장하지 않는다.
-- 16. 프로필 기본 이미지는 환경설정의 공용 objectKey를 재사용하며 images 테이블에 넣지 않는다.
-- 17. DM 방 알림 끄기는 dm_room_notification_mutes 행의 존재 여부로 판단한다.
--     설정 시 기존 미확인 NEW_DM 알림을 읽음 처리하고 이후 해당 방 알림 행·푸시를 생성하지 않는다.
-- 18. 일반 댓글 삭제 시 해당 댓글과 직속 대댓글을 모두 DELETED로 변경하되
--     댓글 본문과 comment_likes 이력은 보존한다.
-- 19. 알림 저장은 업무 트랜잭션에 포함하고, 외부 푸시 발송은 커밋 이후 수행한다.
-- 20. NEW_DM의 actor_id는 필수지만 users 삭제 시 ON DELETE SET NULL이 필요하므로
--     MySQL CHECK에서 actor_id를 참조하지 않고 서비스 계층에서 검증한다.
