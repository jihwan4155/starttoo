package com.starttoo.backend.admin.application;

import com.starttoo.backend.admin.api.AdminDtos;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.search.application.SearchIndexEventPublisher;
import com.starttoo.backend.user.application.UserService;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserService userService;
    private final PostRepository postRepository;
    private final JdbcTemplate jdbcTemplate;
    private final SearchIndexEventPublisher searchIndexEventPublisher;

    @Transactional
    public AdminDtos.AccountStatusResponse changeAccountStatus(
            Integer userSeq,
            Integer adminSeq,
            AdminDtos.AccountStatusRequest request
    ) {
        if (userSeq.equals(adminSeq) && request.status() != AccountStatus.ACTIVE) {
            throw new BusinessException(
                    ErrorCode.FORBIDDEN,
                    "관리자는 자신의 계정을 비활성 상태로 변경할 수 없습니다."
            );
        }
        List<Integer> lockedUsers = jdbcTemplate.queryForList(
                "SELECT user_seq FROM users WHERE user_seq = ? AND is_deleted = FALSE FOR UPDATE",
                Integer.class,
                userSeq
        );
        if (lockedUsers.isEmpty()) {
            throw BusinessException.of(ErrorCode.USER_NOT_FOUND);
        }
        User user = userService.find(userSeq);
        AccountStatus previous = user.getAccountStatus();
        if (previous == request.status()) {
            throw BusinessException.of(ErrorCode.STATE_CONFLICT);
        }
        user.changeStatus(request.status(), adminSeq);
        jdbcTemplate.update("""
                INSERT INTO user_account_status_histories (
                    user_seq,
                    previous_status,
                    changed_status,
                    reason_type,
                    reason_detail,
                    expired_dttm,
                    reg_usr_seq
                ) VALUES (?, ?, ?, 'ADMIN_ACTION', ?, ?, ?)
                """,
                userSeq,
                previous.name(),
                request.status().name(),
                request.reasonDetail(),
                request.expiredDttm(),
                adminSeq
        );
        if (request.status() != AccountStatus.ACTIVE) {
            jdbcTemplate.update("""
                    UPDATE refresh_tokens
                       SET revoked_dttm = CURRENT_TIMESTAMP
                     WHERE user_seq = ? AND revoked_dttm IS NULL
                    """, userSeq);
        }
        searchIndexEventPublisher.accountChanged(userSeq);
        return new AdminDtos.AccountStatusResponse(
                userSeq,
                user.getAccountStatus(),
                user.getStatusChangedDttm()
        );
    }

    @Transactional
    public void decideReport(
            Long reportSeq,
            Integer adminSeq,
            AdminDtos.ReportDecision request
    ) {
        List<ReportRow> rows = jdbcTemplate.query("""
                SELECT post_seq, report_status
                  FROM post_reports
                 WHERE report_seq = ?
                 FOR UPDATE
                """, (rs, rowNum) -> new ReportRow(
                rs.getLong("post_seq"),
                rs.getString("report_status")
        ), reportSeq);
        if (rows.isEmpty()) {
            throw BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND);
        }
        ReportRow row = rows.get(0);
        if (!"PENDING".equals(row.status())) {
            throw BusinessException.of(ErrorCode.STATE_CONFLICT);
        }
        jdbcTemplate.update("""
                UPDATE post_reports
                   SET report_status = ?,
                       processing_note = ?,
                       mod_dttm = CURRENT_TIMESTAMP,
                       mod_usr_seq = ?
                 WHERE report_seq = ?
                """, request.status().name(), request.processingNote(), adminSeq, reportSeq);
        if (request.status() == AdminDtos.ReportStatus.ACCEPTED) {
            Post post = postRepository.findById(row.postSeq())
                    .orElseThrow(() -> BusinessException.of(ErrorCode.POST_NOT_FOUND));
            post.hide(adminSeq);
        }
    }

    @Scheduled(fixedDelayString = "${app.account.suspension-restore-delay:60000}")
    @Transactional
    public void restoreExpiredSuspensions() {
        Boolean lockAcquired = jdbcTemplate.queryForObject(
                "SELECT pg_try_advisory_xact_lock(2026072901)",
                Boolean.class
        );
        if (!Boolean.TRUE.equals(lockAcquired)) {
            return;
        }
        List<Integer> userSeqs = jdbcTemplate.queryForList("""
                SELECT u.user_seq
                  FROM users u
                  JOIN LATERAL (
                      SELECT changed_status, expired_dttm
                        FROM user_account_status_histories h
                       WHERE h.user_seq = u.user_seq
                       ORDER BY h.account_status_history_seq DESC
                       LIMIT 1
                  ) latest ON TRUE
                 WHERE u.account_status = 'SUSPENDED'
                   AND u.is_deleted = FALSE
                   AND latest.changed_status = 'SUSPENDED'
                   AND latest.expired_dttm <= CURRENT_TIMESTAMP
                """, Integer.class);
        for (Integer userSeq : userSeqs) {
            int restored = jdbcTemplate.update("""
                    UPDATE users u
                       SET account_status = 'ACTIVE',
                           status_changed_dttm = CURRENT_TIMESTAMP,
                           mod_dttm = CURRENT_TIMESTAMP,
                           mod_usr_seq = NULL
                     WHERE u.user_seq = ?
                       AND u.account_status = 'SUSPENDED'
                       AND u.is_deleted = FALSE
                       AND EXISTS (
                           SELECT 1
                             FROM user_account_status_histories h
                            WHERE h.account_status_history_seq = (
                                SELECT MAX(latest.account_status_history_seq)
                                  FROM user_account_status_histories latest
                                 WHERE latest.user_seq = u.user_seq
                            )
                              AND h.changed_status = 'SUSPENDED'
                              AND h.expired_dttm <= CURRENT_TIMESTAMP
                       )
                    """, userSeq);
            if (restored == 0) {
                continue;
            }
            jdbcTemplate.update("""
                    INSERT INTO user_account_status_histories (
                        user_seq,
                        previous_status,
                        changed_status,
                        reason_type,
                        reg_usr_seq
                    ) VALUES (?, 'SUSPENDED', 'ACTIVE', 'SUSPENSION_EXPIRED', NULL)
                    """, userSeq);
            searchIndexEventPublisher.accountChanged(userSeq);
        }
    }

    private record ReportRow(Long postSeq, String status) {
    }
}
