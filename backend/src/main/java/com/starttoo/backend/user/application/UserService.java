package com.starttoo.backend.user.application;

import com.starttoo.backend.artist.domain.Artist;
import com.starttoo.backend.artist.domain.ArtistRepository;
import com.starttoo.backend.artist.domain.VerificationStatus;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.notification.domain.NotificationType;
import com.starttoo.backend.search.application.SearchIndexEventPublisher;
import com.starttoo.backend.user.api.UserDtos;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import com.starttoo.backend.user.domain.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final ArtistRepository artistRepository;
    private final ImageRepository imageRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final MediaService mediaService;
    private final NotificationService notificationService;
    private final SearchIndexEventPublisher searchIndexEventPublisher;

    @Transactional(readOnly = true)
    public UserDtos.MyProfile me(Integer userSeq) {
        User user = find(userSeq);
        ProfileImage profileImage = profileImage(user);
        return new UserDtos.MyProfile(
                user.getUserSeq(),
                user.getNickname(),
                user.getPhoneNumber(),
                user.getPhoneVerifiedDttm(),
                profileImage.imageSeq(),
                profileImage.imageUrl(),
                user.getBirthDate(),
                user.getGender(),
                user.getRole(),
                user.getAccountStatus(),
                user.getRole() == UserRole.ARTIST
                        ? artistProfile(userSeq, false)
                        : null,
                user.getRegDttm()
        );
    }

    @Transactional(readOnly = true)
    public UserDtos.PublicProfile profile(Integer targetSeq, Integer viewerSeq) {
        User user = publicUser(targetSeq, viewerSeq);
        Long followers = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                  FROM user_follows relation
                  JOIN users follower ON follower.user_seq = relation.follower_seq
                 WHERE relation.following_seq = ?
                   AND follower.account_status = 'ACTIVE'
                   AND follower.role <> 'ADMIN'
                   AND follower.is_deleted = FALSE
                """,
                Long.class,
                targetSeq
        );
        Long following = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                  FROM user_follows relation
                  JOIN users followed ON followed.user_seq = relation.following_seq
                 WHERE relation.follower_seq = ?
                   AND followed.account_status = 'ACTIVE'
                   AND followed.role <> 'ADMIN'
                   AND followed.is_deleted = FALSE
                """,
                Long.class,
                targetSeq
        );
        boolean followed = viewerSeq != null && Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM user_follows WHERE follower_seq = ? AND following_seq = ?)",
                Boolean.class,
                viewerSeq,
                targetSeq
        ));
        ProfileImage profileImage = profileImage(user);
        return new UserDtos.PublicProfile(
                targetSeq,
                user.getNickname(),
                profileImage.imageSeq(),
                profileImage.imageUrl(),
                user.getRole(),
                followers == null ? 0 : followers,
                following == null ? 0 : following,
                followed,
                user.getRole() == UserRole.ARTIST
                        ? artistProfile(targetSeq, true)
                        : null
        );
    }

    @Transactional
    public UserDtos.MyProfile update(Integer userSeq, UserDtos.UpdateProfileRequest request) {
        User user = findForUpdate(userSeq);
        if (!user.getNickname().equals(request.nickname())
                && userRepository.existsByNicknameAndAccountStatusNotAndDeletedFalse(
                request.nickname(),
                AccountStatus.WITHDRAWN
        )) {
            throw BusinessException.of(ErrorCode.DUPLICATE_NICKNAME);
        }
        user.updateProfile(
                request.nickname(),
                request.birthDate(),
                request.gender(),
                userSeq
        );
        try {
            userRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw BusinessException.of(ErrorCode.DUPLICATE_NICKNAME);
        }
        searchIndexEventPublisher.accountChanged(userSeq);
        return me(userSeq);
    }

    @Transactional
    public UserDtos.MyProfile replaceProfileImage(Integer userSeq, Long imageSeq) {
        User user = findForUpdate(userSeq);
        Image image = imageRepository.findByImageSeqAndDeletedFalse(imageSeq)
                .filter(value -> value.getRegUsrSeq().equals(userSeq))
                .filter(value -> value.getObjectKey().startsWith(
                        "users/" + userSeq + "/profile/"
                ))
                .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
        user.replaceProfileImage(image.getImageSeq(), userSeq);
        searchIndexEventPublisher.accountChanged(userSeq);
        return me(userSeq);
    }

    @Transactional
    public void withdraw(Integer userSeq) {
        User user = findForUpdate(userSeq);
        AccountStatus previous = user.getAccountStatus();
        if (previous == AccountStatus.WITHDRAWN) {
            throw BusinessException.of(ErrorCode.STATE_CONFLICT);
        }
        user.withdraw(userSeq);
        jdbcTemplate.update("""
                INSERT INTO user_account_status_histories (
                    user_seq, previous_status, changed_status, reason_type, reg_usr_seq
                ) VALUES (?, ?, 'WITHDRAWN', 'USER_REQUEST', ?)
                """, userSeq, previous.name(), userSeq);
        jdbcTemplate.update(
                "UPDATE refresh_tokens SET revoked_dttm = CURRENT_TIMESTAMP WHERE user_seq = ? AND revoked_dttm IS NULL",
                userSeq
        );
        jdbcTemplate.update("""
                UPDATE user_devices
                   SET is_active = FALSE, mod_dttm = CURRENT_TIMESTAMP
                 WHERE user_seq = ? AND is_active = TRUE
                """, userSeq);
        searchIndexEventPublisher.accountChanged(userSeq);
    }

    @Transactional
    public boolean setFollow(Integer actorSeq, Integer targetSeq, boolean enabled) {
        ensureRelationTarget(actorSeq, targetSeq);
        if (enabled && Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1 FROM user_blocks
                     WHERE (blocker_seq = ? AND blocked_seq = ?)
                        OR (blocker_seq = ? AND blocked_seq = ?)
                )
                """, Boolean.class, actorSeq, targetSeq, targetSeq, actorSeq))) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        if (enabled) {
            int inserted = jdbcTemplate.update("""
                    INSERT INTO user_follows (follower_seq, following_seq)
                    VALUES (?, ?)
                    ON CONFLICT DO NOTHING
                    """, actorSeq, targetSeq);
            if (inserted > 0) {
                notificationService.create(
                        targetSeq,
                        actorSeq,
                        NotificationType.FOLLOW,
                        actorSeq.longValue(),
                        "새 팔로워",
                        "새로운 회원이 회원님을 팔로우했습니다."
                );
            }
            return inserted > 0 || exists("user_follows", "follower_seq", actorSeq, "following_seq", targetSeq);
        }
        jdbcTemplate.update(
                "DELETE FROM user_follows WHERE follower_seq = ? AND following_seq = ?",
                actorSeq,
                targetSeq
        );
        return false;
    }

    @Transactional
    public boolean setBlock(Integer actorSeq, Integer targetSeq, boolean enabled) {
        ensureRelationTarget(actorSeq, targetSeq);
        if (enabled) {
            jdbcTemplate.update("""
                    INSERT INTO user_blocks (blocker_seq, blocked_seq)
                    VALUES (?, ?)
                    ON CONFLICT DO NOTHING
                    """, actorSeq, targetSeq);
            jdbcTemplate.update("""
                    DELETE FROM user_follows
                    WHERE (follower_seq = ? AND following_seq = ?)
                       OR (follower_seq = ? AND following_seq = ?)
                    """, actorSeq, targetSeq, targetSeq, actorSeq);
            return true;
        }
        jdbcTemplate.update(
                "DELETE FROM user_blocks WHERE blocker_seq = ? AND blocked_seq = ?",
                actorSeq,
                targetSeq
        );
        return false;
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<UserDtos.RelationUser> followers(
            Integer targetSeq,
            Integer viewerSeq,
            String cursor,
            int size
    ) {
        publicUser(targetSeq, viewerSeq);
        return relations(
                targetSeq,
                viewerSeq,
                cursor,
                size,
                RelationListType.FOLLOWERS
        );
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<UserDtos.RelationUser> following(
            Integer targetSeq,
            Integer viewerSeq,
            String cursor,
            int size
    ) {
        publicUser(targetSeq, viewerSeq);
        return relations(
                targetSeq,
                viewerSeq,
                cursor,
                size,
                RelationListType.FOLLOWING
        );
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<UserDtos.RelationUser> blocks(
            Integer userSeq,
            String cursor,
            int size
    ) {
        return relations(userSeq, userSeq, cursor, size, RelationListType.BLOCKS);
    }

    public User find(Integer userSeq) {
        return userRepository.findByUserSeqAndDeletedFalse(userSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.USER_NOT_FOUND));
    }

    public User findForUpdate(Integer userSeq) {
        return userRepository.findActiveForUpdate(userSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.USER_NOT_FOUND));
    }

    private void ensureRelationTarget(Integer actorSeq, Integer targetSeq) {
        if (actorSeq.equals(targetSeq)) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        User target = find(targetSeq);
        if (target.getRole().name().equals("ADMIN") || target.getAccountStatus() != AccountStatus.ACTIVE) {
            throw BusinessException.of(ErrorCode.USER_NOT_FOUND);
        }
    }

    private User publicUser(Integer targetSeq, Integer viewerSeq) {
        User user = find(targetSeq);
        if (user.getAccountStatus() != AccountStatus.ACTIVE
                || user.getRole() == UserRole.ADMIN) {
            throw BusinessException.of(ErrorCode.USER_NOT_FOUND);
        }
        if (viewerSeq != null && blocked(viewerSeq, targetSeq)) {
            throw BusinessException.of(ErrorCode.USER_NOT_FOUND);
        }
        return user;
    }

    private boolean blocked(Integer firstSeq, Integer secondSeq) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1 FROM user_blocks
                     WHERE (blocker_seq = ? AND blocked_seq = ?)
                        OR (blocker_seq = ? AND blocked_seq = ?)
                )
                """, Boolean.class, firstSeq, secondSeq, secondSeq, firstSeq));
    }

    private CursorPageResponse<UserDtos.RelationUser> relations(
            Integer ownerSeq,
            Integer viewerSeq,
            String cursor,
            int size,
            RelationListType type
    ) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        RelationCursor decoded = decodeRelationCursor(cursor);
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("ownerSeq", ownerSeq, Types.INTEGER)
                .addValue("viewerSeq", viewerSeq, Types.INTEGER)
                .addValue("hideBlocked", type.hideBlocked(), Types.BOOLEAN)
                .addValue(
                        "cursorDttm",
                        decoded == null ? null : decoded.regDttm(),
                        Types.TIMESTAMP_WITH_TIMEZONE
                )
                .addValue(
                        "cursorUserSeq",
                        decoded == null ? null : decoded.userSeq(),
                        Types.INTEGER
                )
                .addValue("limit", safeSize + 1, Types.INTEGER);
        List<RelationRow> rows = namedParameterJdbcTemplate.query("""
                SELECT related.user_seq,
                       related.nickname,
                       related.role,
                       profile_image.image_seq AS profile_image_seq,
                       profile_image.object_key AS profile_object_key,
                       relation.reg_dttm,
                       CASE
                           WHEN :viewerSeq IS NULL THEN FALSE
                           ELSE EXISTS(
                               SELECT 1
                                 FROM user_follows mine
                                WHERE mine.follower_seq = :viewerSeq
                                  AND mine.following_seq = related.user_seq
                           )
                       END AS followed_by_me
                  FROM %s relation
                  JOIN users related
                    ON related.user_seq = relation.%s
                   AND related.account_status = 'ACTIVE'
                   AND related.role <> 'ADMIN'
                   AND related.is_deleted = FALSE
                  LEFT JOIN images profile_image
                    ON profile_image.image_seq = related.profile_image_seq
                   AND profile_image.is_deleted = FALSE
                 WHERE relation.%s = :ownerSeq
                   AND (
                       :hideBlocked = FALSE
                       OR :viewerSeq IS NULL
                       OR NOT EXISTS(
                           SELECT 1
                             FROM user_blocks blocked
                            WHERE (
                                blocked.blocker_seq = :viewerSeq
                                AND blocked.blocked_seq = related.user_seq
                            ) OR (
                                blocked.blocker_seq = related.user_seq
                                AND blocked.blocked_seq = :viewerSeq
                            )
                       )
                   )
                   AND (
                       :cursorDttm IS NULL
                       OR relation.reg_dttm < :cursorDttm
                       OR (
                           relation.reg_dttm = :cursorDttm
                           AND related.user_seq < :cursorUserSeq
                       )
                   )
                 ORDER BY relation.reg_dttm DESC, related.user_seq DESC
                 LIMIT :limit
                """.formatted(
                type.table(),
                type.relatedColumn(),
                type.ownerColumn()
        ), parameters, (rs, rowNum) -> new RelationRow(
                rs.getInt("user_seq"),
                rs.getString("nickname"),
                UserRole.valueOf(rs.getString("role")),
                rs.getObject("profile_image_seq", Long.class),
                rs.getString("profile_object_key"),
                rs.getBoolean("followed_by_me"),
                rs.getObject("reg_dttm", OffsetDateTime.class)
        ));
        boolean hasNext = rows.size() > safeSize;
        List<RelationRow> page = hasNext ? rows.subList(0, safeSize) : rows;
        List<UserDtos.RelationUser> items = page.stream()
                .map(row -> new UserDtos.RelationUser(
                        row.userSeq(),
                        row.nickname(),
                        row.role(),
                        row.profileImageSeq(),
                        row.profileObjectKey() == null
                                ? null
                                : mediaService.downloadUrl(row.profileObjectKey()),
                        row.followedByMe()
                ))
                .toList();
        String nextCursor = hasNext ? encodeRelationCursor(page.get(page.size() - 1)) : null;
        return CursorPageResponse.of(items, nextCursor, hasNext);
    }

    private RelationCursor decodeRelationCursor(String cursor) {
        if (cursor == null) {
            return null;
        }
        try {
            String decoded = new String(
                    Base64.getUrlDecoder().decode(cursor),
                    StandardCharsets.UTF_8
            );
            String[] values = decoded.split("\\|", -1);
            if (values.length != 2) {
                throw new IllegalArgumentException("invalid cursor");
            }
            return new RelationCursor(
                    OffsetDateTime.parse(values[0]),
                    Integer.valueOf(values[1])
            );
        } catch (RuntimeException exception) {
            throw BusinessException.of(ErrorCode.INVALID_CURSOR);
        }
    }

    private String encodeRelationCursor(RelationRow row) {
        String value = row.regDttm() + "|" + row.userSeq();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private ProfileImage profileImage(User user) {
        if (user.getProfileImageSeq() == null) {
            return new ProfileImage(null, null);
        }
        return imageRepository.findByImageSeqAndDeletedFalse(user.getProfileImageSeq())
                .map(image -> new ProfileImage(
                        image.getImageSeq(),
                        mediaService.downloadUrl(image.getObjectKey())
                ))
                .orElseGet(() -> new ProfileImage(null, null));
    }

    private UserDtos.ArtistProfileSummary artistProfile(
            Integer userSeq,
            boolean verifiedOnly
    ) {
        return artistRepository.findByUserSeqAndDeletedFalse(userSeq)
                .filter(artist -> !verifiedOnly
                        || artist.getVerificationStatus() == VerificationStatus.VERIFIED)
                .map(this::artistProfile)
                .orElse(null);
    }

    private UserDtos.ArtistProfileSummary artistProfile(Artist artist) {
        return new UserDtos.ArtistProfileSummary(
                artist.getShopName(),
                artist.getVerificationStatus()
        );
    }

    private boolean exists(String table, String firstColumn, Integer first, String secondColumn, Integer second) {
        String sql = "SELECT EXISTS(SELECT 1 FROM " + table
                + " WHERE " + firstColumn + " = ? AND " + secondColumn + " = ?)";
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(sql, Boolean.class, first, second));
    }

    private enum RelationListType {
        FOLLOWERS("user_follows", "following_seq", "follower_seq", true),
        FOLLOWING("user_follows", "follower_seq", "following_seq", true),
        BLOCKS("user_blocks", "blocker_seq", "blocked_seq", false);

        private final String table;
        private final String ownerColumn;
        private final String relatedColumn;
        private final boolean hideBlocked;

        RelationListType(
                String table,
                String ownerColumn,
                String relatedColumn,
                boolean hideBlocked
        ) {
            this.table = table;
            this.ownerColumn = ownerColumn;
            this.relatedColumn = relatedColumn;
            this.hideBlocked = hideBlocked;
        }

        String table() {
            return table;
        }

        String ownerColumn() {
            return ownerColumn;
        }

        String relatedColumn() {
            return relatedColumn;
        }

        boolean hideBlocked() {
            return hideBlocked;
        }
    }

    private record RelationCursor(OffsetDateTime regDttm, Integer userSeq) {
    }

    private record RelationRow(
            Integer userSeq,
            String nickname,
            UserRole role,
            Long profileImageSeq,
            String profileObjectKey,
            boolean followedByMe,
            OffsetDateTime regDttm
    ) {
    }

    private record ProfileImage(Long imageSeq, String imageUrl) {
    }
}
