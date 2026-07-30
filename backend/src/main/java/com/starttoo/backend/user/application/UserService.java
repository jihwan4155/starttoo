package com.starttoo.backend.user.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.notification.domain.NotificationType;
import com.starttoo.backend.search.application.SearchIndexEventPublisher;
import com.starttoo.backend.user.api.UserDtos;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final ImageRepository imageRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;
    private final SearchIndexEventPublisher searchIndexEventPublisher;

    @Transactional(readOnly = true)
    public UserDtos.MyProfile me(Integer userSeq) {
        User user = find(userSeq);
        return new UserDtos.MyProfile(
                user.getUserSeq(),
                user.getNickname(),
                user.getPhoneNumber(),
                user.getPhoneVerifiedDttm(),
                user.getProfileImageSeq(),
                user.getBirthDate(),
                user.getGender(),
                user.getRole(),
                user.getAccountStatus(),
                user.getRecentSearchTerms() == null
                        ? List.of()
                        : Arrays.asList(user.getRecentSearchTerms()),
                user.getRegDttm()
        );
    }

    @Transactional(readOnly = true)
    public UserDtos.PublicProfile profile(Integer targetSeq, Integer viewerSeq) {
        User user = find(targetSeq);
        if (user.getAccountStatus() != AccountStatus.ACTIVE || user.getRole().name().equals("ADMIN")) {
            throw BusinessException.of(ErrorCode.USER_NOT_FOUND);
        }
        if (viewerSeq != null && Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1 FROM user_blocks
                     WHERE (blocker_seq = ? AND blocked_seq = ?)
                        OR (blocker_seq = ? AND blocked_seq = ?)
                )
                """, Boolean.class, viewerSeq, targetSeq, targetSeq, viewerSeq))) {
            throw BusinessException.of(ErrorCode.USER_NOT_FOUND);
        }
        Long followers = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_follows WHERE following_seq = ?",
                Long.class,
                targetSeq
        );
        Long following = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_follows WHERE follower_seq = ?",
                Long.class,
                targetSeq
        );
        boolean followed = viewerSeq != null && Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM user_follows WHERE follower_seq = ? AND following_seq = ?)",
                Boolean.class,
                viewerSeq,
                targetSeq
        ));
        return new UserDtos.PublicProfile(
                targetSeq,
                user.getNickname(),
                user.getProfileImageSeq(),
                user.getRole(),
                followers == null ? 0 : followers,
                following == null ? 0 : following,
                followed
        );
    }

    @Transactional
    public UserDtos.MyProfile update(Integer userSeq, UserDtos.UpdateProfileRequest request) {
        User user = findForUpdate(userSeq);
        if (!user.getNickname().equals(request.nickname())
                && userRepository.existsByNicknameAndDeletedFalse(request.nickname())) {
            throw BusinessException.of(ErrorCode.DUPLICATE_NICKNAME);
        }
        if (request.profileImageSeq() != null) {
            imageRepository.findByImageSeqAndDeletedFalse(request.profileImageSeq())
                    .filter(image -> image.getRegUsrSeq().equals(userSeq))
                    .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
        }
        user.updateProfile(
                request.nickname(),
                request.profileImageSeq(),
                request.birthDate(),
                request.gender(),
                userSeq
        );
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

    private boolean exists(String table, String firstColumn, Integer first, String secondColumn, Integer second) {
        String sql = "SELECT EXISTS(SELECT 1 FROM " + table
                + " WHERE " + firstColumn + " = ? AND " + secondColumn + " = ?)";
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(sql, Boolean.class, first, second));
    }
}
