package com.starttoo.backend.admin.application;

import com.starttoo.backend.search.application.SearchIndexEventPublisher;
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

    private final JdbcTemplate jdbcTemplate;
    private final SearchIndexEventPublisher searchIndexEventPublisher;

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
}
