package com.starttoo.backend.search.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.search.api.SearchDtos;
import com.starttoo.backend.search.application.RedisSearchGateway.SearchCandidate;
import com.starttoo.backend.user.domain.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.DefaultTypedTuple;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.StringJoiner;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private static final String ACCOUNT_KEY = "autocomplete:accounts";
    private static final String ARTIST_KEY = "autocomplete:artists";
    private static final String SUBJECT_KEY = "autocomplete:subjects";
    private static final String ACCOUNT_MEMBER_LOOKUP = "autocomplete:accounts:members";
    private static final String ARTIST_MEMBER_LOOKUP = "autocomplete:artists:members";
    private static final String SUBJECT_COUNTS = "search:subjects:query-count";
    private static final String DELIMITER = "\u0001";
    private static final long MAX_COUNTED_SUBJECTS = 100_000;
    @SuppressWarnings("rawtypes")
    private static final DefaultRedisScript<List> PREFIX_SCRIPT = new DefaultRedisScript<>(
            "return redis.call('ZRANGEBYLEX', KEYS[1], ARGV[1], ARGV[2], 'LIMIT', 0, ARGV[3])",
            List.class
    );

    private final StringRedisTemplate redisTemplate;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final KoreanJamoNormalizer jamoNormalizer;
    private final SearchLogService searchLogService;
    private final RedisSearchGateway redisSearchGateway;
    private final PreferenceScoreService preferenceScoreService;

    @EventListener(ApplicationReadyEvent.class)
    public void initialize() {
        try {
            searchLogService.restoreSubjectCountsIfMissing();
            boolean rebuildRequired = redisSearchGateway.prepareIndexes()
                    || !Boolean.TRUE.equals(redisTemplate.hasKey(ACCOUNT_KEY));
            if (rebuildRequired) {
                rebuildIndexes();
            } else {
                refreshSubjectAutocomplete();
            }
        } catch (RuntimeException exception) {
            log.warn("Search initialization deferred: {}", exception.getMessage());
        }
    }

    /**
     * 실시간 변경은 AFTER_COMMIT 이벤트로 반영하고, 이 작업은 누락·불일치를 복구하는
     * 저빈도 전체 대조 작업으로만 사용한다.
     */
    @Scheduled(cron = "${app.search.reconciliation-cron:0 0 4 * * *}", zone = "UTC")
    public void reconcileIndexes() {
        rebuildIndexes();
    }

    @Scheduled(fixedDelayString = "${app.search.autocomplete-refresh-delay:600000}")
    public void refreshSubjectAutocomplete() {
        try {
            rebuildSubjectAutocomplete();
        } catch (RuntimeException exception) {
            log.warn("Subject autocomplete refresh skipped: {}", exception.getMessage());
        }
    }

    public void rebuildIndexes() {
        try {
            redisSearchGateway.prepareIndexes();
            rebuildAccounts();
            rebuildSubjects();
            redisSearchGateway.markRebuilt();
        } catch (RuntimeException exception) {
            log.warn("Search index reconciliation skipped: {}", exception.getMessage());
        }
    }

    @TransactionalEventListener(
            phase = TransactionPhase.AFTER_COMMIT,
            fallbackExecution = true
    )
    public void synchronizeAfterCommit(SearchIndexChangedEvent event) {
        try {
            switch (event.targetType()) {
                case ACCOUNT -> synchronizeAccount(event.targetSeq());
                case SUBJECT -> synchronizeSubject(event.targetSeq());
            }
        } catch (RuntimeException exception) {
            // DB 커밋은 이미 끝났으므로 검색 장애가 업무 트랜잭션을 되돌리지는 않는다.
            // 다음 동일 엔티티 변경 또는 일일 대조 작업이 누락을 복구한다.
            log.warn(
                    "Search index incremental update failed. type={}, seq={}",
                    event.targetType(),
                    event.targetSeq(),
                    exception
            );
        }
    }

    public List<SearchDtos.AccountResult> autocompleteAccounts(String query, int size) {
        return autocompleteAccounts(ACCOUNT_KEY, query, size, false);
    }

    public List<SearchDtos.AccountResult> autocompleteArtists(String query, int size) {
        return autocompleteAccounts(ARTIST_KEY, query, size, true);
    }

    public List<String> autocompleteSubjects(String query, int size) {
        String prefix = jamoNormalizer.normalize(query);
        return members(SUBJECT_KEY, prefix, size).stream()
                .map(this::lastValue)
                .sorted(Comparator
                        .comparingInt((String value) -> value.equals(query) ? 0 : 1)
                        .thenComparingInt(String::length)
                        .thenComparing(Comparator.naturalOrder()))
                .toList();
    }

    public List<SearchDtos.AccountResult> searchAccounts(
            String query,
            int size,
            boolean artistsOnly
    ) {
        searchLogService.record(null, artistsOnly ? "ARTIST" : "ACCOUNT", query);
        int safeSize = Math.min(Math.max(size, 1), 50);
        int candidateLimit = Math.min(Math.max(safeSize * 10, 100), 500);
        String normalizedQuery = jamoNormalizer.normalize(query);
        List<SearchCandidate> candidates = artistsOnly
                ? redisSearchGateway.artistCandidates(normalizedQuery, candidateLimit)
                : redisSearchGateway.accountCandidates(normalizedQuery, candidateLimit);
        return accountResults(candidates, safeSize, artistsOnly);
    }

    public List<SearchDtos.SubjectCorrection> correctSubject(String query, int size) {
        return subjectCandidates(query, 200).stream()
                .limit(Math.min(Math.max(size, 1), 10))
                .map(value -> new SearchDtos.SubjectCorrection(
                        value.subjectSeq(),
                        value.subjectName(),
                        value.matchTier().name(),
                        value.matchTier().editDistance(),
                        value.redisScore()
                ))
                .toList();
    }

    public List<SearchDtos.PostSearchResult> searchPosts(
            Integer userSeq,
            String query,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        List<SubjectCandidate> candidates = subjectCandidates(query, 250).stream()
                .limit(Math.min(Math.max(safeSize * 5, 50), 250))
                .toList();
        SubjectCandidate canonical = candidates.isEmpty() ? null : candidates.get(0);
        if (candidates.isEmpty()) {
            searchLogService.recordPostSearch(userSeq, query, null, null);
            return List.of();
        }

        StringJoiner values = new StringJoiner(", ");
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("userSeq", userSeq)
                .addValue("limit", safeSize);
        for (int index = 0; index < candidates.size(); index++) {
            SubjectCandidate candidate = candidates.get(index);
            String suffix = Integer.toString(index);
            values.add("(:subject" + suffix
                    + ", :tier" + suffix
                    + ", :score" + suffix
                    + ", :candidateOrder" + suffix + ")");
            parameters
                    .addValue("subject" + suffix, candidate.subjectSeq())
                    .addValue("tier" + suffix, candidate.matchTier().rank())
                    .addValue("score" + suffix, candidate.redisScore())
                    .addValue("candidateOrder" + suffix, candidate.candidateOrder());
        }

        String sql = """
                WITH candidates(
                    subject_seq,
                    match_tier,
                    redis_score,
                    candidate_order
                ) AS (
                    VALUES %s
                ),
                post_matches AS (
                    SELECT DISTINCT
                           p.post_seq,
                           c.match_tier,
                           c.redis_score,
                           c.candidate_order
                      FROM candidates c
                      JOIN tattoo_subjects ts ON ts.subject_seq = c.subject_seq
                      JOIN tattoos t
                        ON t.tattoo_seq = ts.tattoo_seq
                       AND t.is_deleted = FALSE
                      JOIN post_images pi ON pi.image_seq = t.image_seq
                      JOIN posts p ON p.post_seq = pi.post_seq
                     WHERE p.post_status = 'PUBLISHED'
                       AND p.is_deleted = FALSE
                       AND (
                           CAST(:userSeq AS INTEGER) IS NULL OR NOT EXISTS (
                               SELECT 1
                                 FROM user_blocks b
                                WHERE (
                                    b.blocker_seq = :userSeq
                                    AND b.blocked_seq = p.author_seq
                                ) OR (
                                    b.blocker_seq = p.author_seq
                                    AND b.blocked_seq = :userSeq
                                )
                           )
                       )
                       AND (
                           CAST(:userSeq AS INTEGER) IS NULL OR NOT EXISTS (
                               SELECT 1
                                 FROM post_hidden_preferences h
                                WHERE h.post_seq = p.post_seq
                                  AND h.user_seq = :userSeq
                           )
                       )
                ),
                best_post_match AS (
                    SELECT DISTINCT ON (post_seq)
                           post_seq,
                           match_tier,
                           redis_score,
                           candidate_order
                      FROM post_matches
                     ORDER BY post_seq,
                              match_tier,
                              redis_score DESC,
                              candidate_order
                ),
                ranked_posts AS (
                    SELECT *
                      FROM best_post_match
                     ORDER BY match_tier,
                              redis_score DESC,
                              candidate_order,
                              post_seq DESC
                     LIMIT :limit
                )
                SELECT rp.post_seq,
                       ARRAY_AGG(DISTINCT s.subject_name ORDER BY s.subject_name)
                           AS matched_subjects,
                       rp.match_tier,
                       rp.redis_score
                  FROM ranked_posts rp
                  JOIN post_images pi ON pi.post_seq = rp.post_seq
                  JOIN tattoos t
                    ON t.image_seq = pi.image_seq
                   AND t.is_deleted = FALSE
                  JOIN tattoo_subjects ts ON ts.tattoo_seq = t.tattoo_seq
                  JOIN candidates c ON c.subject_seq = ts.subject_seq
                  JOIN subjects s ON s.subject_seq = c.subject_seq
                 GROUP BY rp.post_seq,
                          rp.match_tier,
                          rp.redis_score,
                          rp.candidate_order
                 ORDER BY rp.match_tier,
                          rp.redis_score DESC,
                          rp.candidate_order,
                          rp.post_seq DESC
                """.formatted(values);
        List<SearchDtos.PostSearchResult> results = namedParameterJdbcTemplate.query(
                sql,
                parameters,
                (rs, rowNum) -> {
            Object[] matchedSubjects = (Object[]) rs.getArray("matched_subjects").getArray();
            return new SearchDtos.PostSearchResult(
                    rs.getLong("post_seq"),
                    java.util.Arrays.stream(matchedSubjects).map(Object::toString).toList(),
                    RedisSearchGateway.MatchTier.values()[rs.getInt("match_tier") - 1].name(),
                    rs.getDouble("redis_score")
            );
        });
        searchLogService.recordPostSearch(
                userSeq,
                query,
                canonical.subjectSeq(),
                canonical.subjectName()
        );
        return results;
    }

    @Transactional
    public boolean recordPostSearchClick(Integer userSeq, Long postSeq) {
        Boolean postExists = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                      FROM posts
                     WHERE post_seq = ?
                       AND post_status = 'PUBLISHED'
                       AND is_deleted = FALSE
                )
                """, Boolean.class, postSeq);
        if (!Boolean.TRUE.equals(postExists)) {
            throw BusinessException.of(ErrorCode.POST_NOT_FOUND);
        }
        preferenceScoreService.applySearchClick(userSeq, postSeq);
        return true;
    }

    private List<SearchDtos.AccountResult> autocompleteAccounts(
            String key,
            String query,
            int size,
            boolean artistsOnly
    ) {
        List<Integer> ids = members(
                key,
                jamoNormalizer.normalize(query),
                Math.min(Math.max(size, 1), 20)
        ).stream().map(this::idValue).toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Integer, SearchDtos.AccountResult> byId = accountResultMap(ids, artistsOnly);
        return ids.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparingInt((SearchDtos.AccountResult value) ->
                                value.nickname().equals(query) ? 0 : 1)
                        .thenComparingInt(value -> value.nickname().length())
                        .thenComparing(SearchDtos.AccountResult::nickname))
                .toList();
    }

    private List<SearchDtos.AccountResult> accountResults(
            List<SearchCandidate> candidates,
            int size,
            boolean artistsOnly
    ) {
        if (candidates.isEmpty()) {
            return List.of();
        }
        List<Integer> ids = candidates.stream().map(SearchCandidate::targetSeq).toList();
        Map<Integer, SearchDtos.AccountResult> byId = accountResultMap(ids, artistsOnly);
        // Redis가 반환한 tier와 점수 순서를 그대로 보존한다. PostgreSQL은 최신 노출
        // 상태를 재검증하고 화면 필드만 공급한다.
        return candidates.stream()
                .map(candidate -> byId.get(candidate.targetSeq()))
                .filter(Objects::nonNull)
                .limit(size)
                .toList();
    }

    private Map<Integer, SearchDtos.AccountResult> accountResultMap(
            List<Integer> ids,
            boolean artistsOnly
    ) {
        Map<Integer, SearchDtos.AccountResult> byId = new LinkedHashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT u.user_seq, u.nickname, u.role
                  FROM users u
                  LEFT JOIN artists a
                    ON a.user_seq = u.user_seq
                   AND a.is_deleted = FALSE
                 WHERE u.user_seq IN (:ids)
                   AND u.role <> 'ADMIN'
                   AND u.account_status = 'ACTIVE'
                   AND u.is_deleted = FALSE
                   AND (
                       :artistsOnly = FALSE
                       OR (
                           u.role = 'ARTIST'
                           AND a.verification_status = 'VERIFIED'
                       )
                   )
                """, new MapSqlParameterSource()
                .addValue("ids", ids)
                .addValue("artistsOnly", artistsOnly), rs -> {
            SearchDtos.AccountResult value = new SearchDtos.AccountResult(
                    rs.getInt("user_seq"),
                    rs.getString("nickname"),
                    UserRole.valueOf(rs.getString("role"))
            );
            byId.put(value.userSeq(), value);
        });
        return byId;
    }

    private List<SubjectCandidate> subjectCandidates(String query, int candidateLimit) {
        String normalizedQuery = jamoNormalizer.normalize(query);
        List<SearchCandidate> candidates = redisSearchGateway.subjectCandidates(
                normalizedQuery,
                candidateLimit
        );
        if (candidates.isEmpty()) {
            return List.of();
        }
        List<Integer> ids = candidates.stream().map(SearchCandidate::targetSeq).toList();
        Map<Integer, String> names = new LinkedHashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT subject_seq, subject_name
                  FROM subjects
                 WHERE subject_seq IN (:ids)
                """, new MapSqlParameterSource("ids", ids), rs -> {
            // 변경: 반환값이 있는 Map.put 표현식 람다는 ResultSetExtractor와
            // RowCallbackHandler 양쪽으로 추론될 수 있으므로 void 블록으로 명시한다.
            names.put(rs.getInt("subject_seq"), rs.getString("subject_name"));
        });
        return candidates.stream()
                .filter(candidate -> names.containsKey(candidate.targetSeq()))
                .map(candidate -> new SubjectCandidate(
                        candidate.targetSeq(),
                        names.get(candidate.targetSeq()),
                        candidate.matchTier(),
                        candidate.redisScore(),
                        candidate.candidateOrder()
                ))
                .toList();
    }

    private void rebuildAccounts() {
        Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<String>> accounts =
                new LinkedHashSet<>();
        Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<String>> artists =
                new LinkedHashSet<>();
        Map<String, String> accountMembers = new LinkedHashMap<>();
        Map<String, String> artistMembers = new LinkedHashMap<>();
        Map<Integer, String> accountDocuments = new LinkedHashMap<>();
        Map<Integer, String> artistDocuments = new LinkedHashMap<>();
        jdbcTemplate.query("""
                SELECT u.user_seq, u.nickname, u.role,
                       COALESCE(a.verification_status, '') AS verification_status
                  FROM users u
                  LEFT JOIN artists a ON a.user_seq = u.user_seq AND a.is_deleted = FALSE
                 WHERE u.role <> 'ADMIN'
                   AND u.account_status = 'ACTIVE'
                   AND u.is_deleted = FALSE
                """, rs -> {
            Integer userSeq = rs.getInt("user_seq");
            String normalized = jamoNormalizer.normalize(rs.getString("nickname"));
            String member = normalized + DELIMITER + userSeq;
            accounts.add(new DefaultTypedTuple<>(member, 0.0));
            accountMembers.put(userSeq.toString(), member);
            accountDocuments.put(userSeq, normalized);
            if ("ARTIST".equals(rs.getString("role"))
                    && "VERIFIED".equals(rs.getString("verification_status"))) {
                artists.add(new DefaultTypedTuple<>(member, 0.0));
                artistMembers.put(userSeq.toString(), member);
                artistDocuments.put(userSeq, normalized);
            }
        });
        replace(ACCOUNT_KEY, accounts);
        replace(ARTIST_KEY, artists);
        replaceHash(ACCOUNT_MEMBER_LOOKUP, accountMembers);
        replaceHash(ARTIST_MEMBER_LOOKUP, artistMembers);
        redisSearchGateway.replaceAccounts(accountDocuments);
        redisSearchGateway.replaceArtists(artistDocuments);
    }

    private void rebuildSubjects() {
        Map<Integer, String> subjectDocuments = new LinkedHashMap<>();
        jdbcTemplate.query("""
                SELECT subject_seq, subject_name
                  FROM subjects
                """, rs -> {
            Integer subjectSeq = rs.getInt("subject_seq");
            String subject = rs.getString("subject_name");
            subjectDocuments.put(subjectSeq, jamoNormalizer.normalize(subject));
        });
        redisSearchGateway.replaceSubjects(subjectDocuments);
        rebuildSubjectAutocomplete();
    }

    private void rebuildSubjectAutocomplete() {
        Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<String>> subjects =
                new LinkedHashSet<>();
        jdbcTemplate.query("""
                SELECT s.subject_name, COUNT(t.tattoo_seq) AS frequency
                  FROM subjects s
                  LEFT JOIN tattoo_subjects ts ON ts.subject_seq = s.subject_seq
                  LEFT JOIN tattoos t
                    ON t.tattoo_seq = ts.tattoo_seq
                   AND t.is_deleted = FALSE
                 GROUP BY s.subject_seq, s.subject_name
                 ORDER BY frequency DESC, s.subject_name
                 LIMIT 2000
                """, rs -> {
            String subject = rs.getString("subject_name");
            subjects.add(new DefaultTypedTuple<>(
                    jamoNormalizer.normalize(subject) + DELIMITER + subject,
                    0.0
            ));
        });

        Set<String> searchedSubjectSeqs = redisTemplate.opsForZSet()
                .reverseRange(SUBJECT_COUNTS, 0, 999);
        if (searchedSubjectSeqs != null && !searchedSubjectSeqs.isEmpty()) {
            List<Integer> ids = searchedSubjectSeqs.stream()
                    .map(this::safeInteger)
                    .filter(Objects::nonNull)
                    .toList();
            if (!ids.isEmpty()) {
                namedParameterJdbcTemplate.query("""
                        SELECT subject_seq, subject_name
                          FROM subjects
                         WHERE subject_seq IN (:ids)
                        """, new MapSqlParameterSource("ids", ids), rs -> {
                    String subject = rs.getString("subject_name");
                    subjects.add(new DefaultTypedTuple<>(
                            jamoNormalizer.normalize(subject) + DELIMITER + subject,
                            0.0
                    ));
                });
            }
        }

        Long countedSubjects = redisTemplate.opsForZSet().zCard(SUBJECT_COUNTS);
        if (countedSubjects != null && countedSubjects > MAX_COUNTED_SUBJECTS) {
            redisTemplate.opsForZSet().removeRange(
                    SUBJECT_COUNTS,
                    0,
                    countedSubjects - MAX_COUNTED_SUBJECTS - 1
            );
        }
        replace(SUBJECT_KEY, subjects);
    }

    private void synchronizeAccount(Integer userSeq) {
        List<AccountIndexRow> rows = jdbcTemplate.query("""
                SELECT u.nickname,
                       u.role,
                       u.account_status,
                       u.is_deleted,
                       COALESCE(a.verification_status, '') AS verification_status
                  FROM users u
                  LEFT JOIN artists a
                    ON a.user_seq = u.user_seq
                   AND a.is_deleted = FALSE
                 WHERE u.user_seq = ?
                """, (rs, rowNum) -> new AccountIndexRow(
                rs.getString("nickname"),
                rs.getString("role"),
                rs.getString("account_status"),
                rs.getBoolean("is_deleted"),
                rs.getString("verification_status")
        ), userSeq);

        if (rows.isEmpty()) {
            removeAccountEntries(userSeq);
            return;
        }
        AccountIndexRow row = rows.get(0);
        boolean accountEligible = !row.deleted()
                && "ACTIVE".equals(row.accountStatus())
                && !"ADMIN".equals(row.role());
        if (!accountEligible) {
            removeAccountEntries(userSeq);
            return;
        }

        String normalized = jamoNormalizer.normalize(row.nickname());
        redisSearchGateway.upsertAccount(userSeq, normalized);
        synchronizeAutocompleteMember(
                ACCOUNT_KEY,
                ACCOUNT_MEMBER_LOOKUP,
                userSeq,
                normalized + DELIMITER + userSeq
        );

        boolean artistEligible = "ARTIST".equals(row.role())
                && "VERIFIED".equals(row.verificationStatus());
        if (artistEligible) {
            redisSearchGateway.upsertArtist(userSeq, normalized);
            synchronizeAutocompleteMember(
                    ARTIST_KEY,
                    ARTIST_MEMBER_LOOKUP,
                    userSeq,
                    normalized + DELIMITER + userSeq
            );
        } else {
            redisSearchGateway.removeArtist(userSeq);
            synchronizeAutocompleteMember(ARTIST_KEY, ARTIST_MEMBER_LOOKUP, userSeq, null);
        }
    }

    private void removeAccountEntries(Integer userSeq) {
        redisSearchGateway.removeAccount(userSeq);
        redisSearchGateway.removeArtist(userSeq);
        synchronizeAutocompleteMember(ACCOUNT_KEY, ACCOUNT_MEMBER_LOOKUP, userSeq, null);
        synchronizeAutocompleteMember(ARTIST_KEY, ARTIST_MEMBER_LOOKUP, userSeq, null);
    }

    private void synchronizeSubject(Integer subjectSeq) {
        List<String> names = jdbcTemplate.queryForList(
                "SELECT subject_name FROM subjects WHERE subject_seq = ?",
                String.class,
                subjectSeq
        );
        if (names.isEmpty()) {
            redisSearchGateway.removeSubject(subjectSeq);
            return;
        }
        redisSearchGateway.upsertSubject(subjectSeq, jamoNormalizer.normalize(names.get(0)));
    }

    private void synchronizeAutocompleteMember(
            String zsetKey,
            String lookupKey,
            Integer id,
            String newMember
    ) {
        Object existing = redisTemplate.opsForHash().get(lookupKey, id.toString());
        if (existing != null) {
            redisTemplate.opsForZSet().remove(zsetKey, existing.toString());
        }
        if (newMember == null) {
            redisTemplate.opsForHash().delete(lookupKey, id.toString());
            return;
        }
        redisTemplate.opsForZSet().add(zsetKey, newMember, 0);
        redisTemplate.opsForHash().put(lookupKey, id.toString(), newMember);
    }

    private void replace(
            String key,
            Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<String>> tuples
    ) {
        String temporary = key + ":rebuild:" + UUID.randomUUID();
        redisTemplate.delete(temporary);
        if (tuples.isEmpty()) {
            redisTemplate.delete(key);
            return;
        }
        redisTemplate.opsForZSet().add(temporary, tuples);
        redisTemplate.rename(temporary, key);
    }

    private void replaceHash(String key, Map<String, String> values) {
        String temporary = key + ":rebuild:" + UUID.randomUUID();
        redisTemplate.delete(temporary);
        if (values.isEmpty()) {
            redisTemplate.delete(key);
            return;
        }
        redisTemplate.opsForHash().putAll(temporary, values);
        redisTemplate.rename(temporary, key);
    }

    @SuppressWarnings("unchecked")
    private List<String> members(String key, String prefix, int size) {
        if (prefix.isBlank()) {
            return List.of();
        }
        try {
            List<String> result = (List<String>) redisTemplate.execute(
                    PREFIX_SCRIPT,
                    List.of(key),
                    "[" + prefix,
                    "[" + prefix + "\uffff",
                    Integer.toString(size)
            );
            return result == null ? List.of() : result;
        } catch (RuntimeException exception) {
            throw new BusinessException(
                    ErrorCode.SERVICE_UNAVAILABLE,
                    "검색 자동완성을 일시적으로 사용할 수 없습니다."
            );
        }
    }

    private Integer idValue(String member) {
        return Integer.valueOf(lastValue(member));
    }

    private String lastValue(String member) {
        return member.substring(member.lastIndexOf(DELIMITER) + 1);
    }

    private Integer safeInteger(String value) {
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private record SubjectCandidate(
            Integer subjectSeq,
            String subjectName,
            RedisSearchGateway.MatchTier matchTier,
            double redisScore,
            int candidateOrder
    ) {
    }

    private record AccountIndexRow(
            String nickname,
            String role,
            String accountStatus,
            boolean deleted,
            String verificationStatus
    ) {
    }
}
